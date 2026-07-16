import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { domainEventPublisher } from '@/lib/domain-events/publisher';
import { orderEmailService } from '@/lib/email/order-confirmation';
import { financePostingService } from '@/lib/finance-posting';
import { getSystemSettingsMap, writeAuditLog } from '@/lib/hq-security';
import { notificationService, NOTIFICATION_EVENT_TYPE } from '@/lib/notifications';
import { paymentAttemptService } from '@/lib/payment-attempt';
import {
  FULFILLMENT_STATUS,
  ORDER_STATUS,
  RETURN_REFUND_STATUS,
  RETURN_REQUEST_STATUS,
  RETURN_REQUEST_TYPE,
  getFulfillmentStatusLabel,
  getFulfillmentStatusQueryValues,
  getFulfillmentTimelineEventName,
  getOrderStatusForFulfillment,
  getOrderStatusTimelineEventName,
  getSynchronizedFulfillmentStatus,
  getSynchronizedOrderStatus,
  isFulfillmentTransitionAllowed,
  isShipmentInformationStage,
  normalizeFulfillmentStatusValue,
  normalizeOrderStatusValue,
} from './lifecycle';
import { OrderError } from './errors';
import { OrderInventoryService, ORDER_INVENTORY_RESERVATION_RESULT } from './inventory-service';

const ORDER_TIMELINE_SYSTEM_USER = 'System';
const ORDER_CONFIRMATION_EMAIL_SENT = 'SENT';
const ORDER_CONFIRMATION_EMAIL_FAILED = 'FAILED';
const ORDER_CONFIRMATION_EMAIL_SKIPPED = 'SKIPPED';
const ORDER_PUBLIC_NUMBER_PREFIX = 'OM';
const ORDER_PUBLIC_NUMBER_SEGMENT_LENGTH = 5;
const ORDER_PUBLIC_NUMBER_RETRY_LIMIT = 10;
const ORDER_PUBLIC_NUMBER_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  paymentAttempt: true,
  returnRequest: true,
  timelines: {
    orderBy: { createdAt: 'asc' },
  },
};

function logOrderCreation({
  orderNumber = '',
  publicOrderNumber = '',
  checkoutNumber = '',
  paymentAttemptNumber = '',
  durationMs,
  validationResult,
}) {
  const payload = {
    orderNumber,
    publicOrderNumber,
    checkoutNumber,
    paymentAttemptNumber,
    durationMs,
    validationResult,
  };

  if (validationResult === 'FAILED') {
    console.warn('[OrderService]', payload);
    return;
  }

  console.log('[OrderService]', payload);
}

function logOrderEmailEvent({
  eventName = '',
  orderId = '',
  orderNumber = '',
  publicOrderNumber = '',
  customerEmail = '',
  customerName = '',
  reason = '',
  status = '',
}) {
  const payload = {
    scope: 'ORDER_EMAIL',
    eventName,
    timestamp: new Date().toISOString(),
    orderId,
    orderNumber,
    publicOrderNumber,
    customerEmail,
    customerName,
    reason,
    status,
  };

  if (eventName === 'ORDER_CONFIRMATION_EMAIL_FAILED') {
    console.error('[OrderService]', payload);
    return;
  }

  console.info('[OrderService]', payload);
}

function generatePublicOrderNumberCandidate() {
  const bytes = crypto.randomBytes(ORDER_PUBLIC_NUMBER_SEGMENT_LENGTH * 2);
  let firstSegment = '';
  let secondSegment = '';

  for (let index = 0; index < ORDER_PUBLIC_NUMBER_SEGMENT_LENGTH; index += 1) {
    firstSegment += ORDER_PUBLIC_NUMBER_CHARSET[bytes[index] % ORDER_PUBLIC_NUMBER_CHARSET.length];
    secondSegment += ORDER_PUBLIC_NUMBER_CHARSET[bytes[index + ORDER_PUBLIC_NUMBER_SEGMENT_LENGTH] % ORDER_PUBLIC_NUMBER_CHARSET.length];
  }

  return `${ORDER_PUBLIC_NUMBER_PREFIX}-${firstSegment}-${secondSegment}`;
}

function normalizePublicOrderNumberValue(value) {
  return String(value || '').trim().toUpperCase();
}

function buildOrderLookupWhere(orderIdentifier) {
  const normalizedIdentifier = normalizePublicOrderNumberValue(orderIdentifier);

  if (!normalizedIdentifier) {
    return null;
  }

  return {
    OR: [
      {
        publicOrderNumber: {
          equals: normalizedIdentifier,
          mode: 'insensitive',
        },
      },
      {
        orderNumber: {
          equals: normalizedIdentifier,
          mode: 'insensitive',
        },
      },
    ],
  };
}

function logOrderLifecyclePhase({
  phase = '',
  orderId = '',
  orderNumber = '',
  paymentAttemptId = '',
  paymentAttemptNumber = '',
  checkoutSessionId = '',
  checkoutNumber = '',
  inventoryReservationResult = '',
  transactionDurationMs = 0,
  durationMs = 0,
  reason = '',
  validationResult = 'PASSED',
}) {
  const payload = {
    phase,
    orderId,
    orderNumber,
    paymentAttemptId,
    paymentAttemptNumber,
    checkoutSessionId,
    checkoutNumber,
    inventoryReservationResult,
    transactionDurationMs,
    durationMs,
    reason,
    validationResult,
  };

  if (validationResult === 'FAILED') {
    console.warn('[OrderService]', payload);
    return;
  }

  console.log('[OrderService]', payload);
}

function logFulfillmentUpdate({
  orderNumber = '',
  previousStatus = '',
  newStatus = '',
  updatedBy = '',
  validationResult,
  durationMs,
}) {
  const payload = {
    orderNumber,
    previousStatus,
    newStatus,
    updatedBy,
    validationResult,
    durationMs,
  };

  if (validationResult === 'FAILED') {
    console.warn('[OrderService]', payload);
    return;
  }

  console.log('[OrderService]', payload);
}

function normalizeSortField(sortBy) {
  const allowed = {
    orderNumber: 'orderNumber',
    publicOrderNumber: 'publicOrderNumber',
    orderDate: 'createdAt',
    createdAt: 'createdAt',
    customerName: 'customerName',
    totalAmount: 'grandTotal',
    grandTotal: 'grandTotal',
    fulfillmentStatus: 'fulfillmentStatus',
    paymentStatus: 'createdAt',
    totalItems: 'createdAt',
  };

  return allowed[sortBy] || 'createdAt';
}

function normalizeSortOrder(sortOrder) {
  return String(sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizePositiveInteger(value, fallback, max = 100) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildFulfillmentStatusWhere(fulfillmentStatus) {
  const queryValues = getFulfillmentStatusQueryValues(fulfillmentStatus);

  if (queryValues.length === 0) {
    return null;
  }

  if (queryValues.length === 1) {
    return {
      fulfillmentStatus: queryValues[0],
    };
  }

  return {
    OR: queryValues.map((value) => ({
      fulfillmentStatus: value,
    })),
  };
}

function mergeWhereCondition(baseWhere, nextCondition) {
  if (!nextCondition || Object.keys(nextCondition).length === 0) {
    return baseWhere;
  }

  if (!baseWhere || Object.keys(baseWhere).length === 0) {
    return nextCondition;
  }

  return {
    AND: [baseWhere, nextCondition],
  };
}

function buildOrderStatusSynchronizationNotes({ previousStatus = '', newStatus = '', fulfillmentStatus = '' }) {
  return `Order status synchronized from ${previousStatus || 'UNKNOWN'} to ${newStatus || 'UNKNOWN'} after fulfillment changed to ${fulfillmentStatus || 'UNKNOWN'}.`;
}

function formatShipmentTimelineDate(value) {
  const date = value instanceof Date ? value : new Date(value || new Date());
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function buildShipmentDispatchedTimelineNotes({ shipmentCourier = '', shipmentService = '', trackingNumber = '', shippingDate = null, notes = '' }) {
  const sections = [
    `Courier: ${shipmentCourier}`,
    `Service: ${shipmentService}`,
    `Tracking Number: ${trackingNumber}`,
    `Shipping Date: ${formatShipmentTimelineDate(shippingDate)}`,
  ];

  if (notes) {
    sections.push('', `Notes: ${notes}`);
  }

  return sections.join('\n');
}

function buildDeliveredTimelineNotes({ notes = '' }) {
  if (!notes) {
    return '';
  }

  return `Notes: ${notes}`;
}

function hasShipmentFieldMutation(order, { shipmentCourier = '', shipmentService = '', trackingNumber = '', shippingDate = null } = {}) {
  const currentShippingDate = order.shippingDate ? new Date(order.shippingDate).toISOString() : '';
  const nextShippingDate = shippingDate ? new Date(shippingDate).toISOString() : '';

  return String(shipmentCourier || '').trim() !== String(order.shipmentCourier || '').trim()
    || String(shipmentService || '').trim() !== String(order.shipmentService || '').trim()
    || String(trackingNumber || '').trim() !== String(order.trackingNumber || '').trim()
    || nextShippingDate !== currentShippingDate;
}

function buildTimelineEntry({ id, orderId, eventName, updatedBy = '', notes = '', createdAt = null }) {
  return {
    id,
    orderId,
    eventName,
    updatedBy,
    notes,
    ...(createdAt ? { createdAt } : {}),
  };
}

function normalizeDateRangeBoundary(value, boundary = 'start') {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const date = normalized.includes('T')
    ? new Date(normalized)
    : new Date(`${normalized}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeCustomerEmailValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeOrderNumberValue(value) {
  return String(value || '').trim().toUpperCase();
}

const CUSTOMER_CANCELLABLE_PAYMENT_STATUSES = new Set(['CREATED', 'PENDING', 'EXPIRED']);
const CUSTOMER_CANCELLABLE_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAID,
  ORDER_STATUS.READY_FOR_FULFILLMENT,
]);
const CUSTOMER_CANCELLABLE_FULFILLMENT_STATUSES = new Set([
  FULFILLMENT_STATUS.PENDING,
]);
const RETURN_WINDOW_DAYS = 7;

function buildShipmentAddress(order) {
  return [
    order.streetAddress,
    order.districtName,
    order.cityName,
    order.provinceName,
    order.postalCode,
  ].filter(Boolean).join(', ');
}

function getDeliveredTimelineEntry(order) {
  return [...(order?.timelines || [])]
    .filter((entry) => String(entry.eventName || '').trim() === 'ORDER_DELIVERED')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;
}

function getDeliveredAt(order) {
  const deliveredTimelineEntry = getDeliveredTimelineEntry(order);
  return deliveredTimelineEntry?.createdAt || null;
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
}

function normalizeReturnAttachments(attachments = []) {
  return Array.isArray(attachments)
    ? attachments.map((attachment) => String(attachment || '').trim()).filter(Boolean)
    : [];
}

function getOrderDisplayStatus(order) {
  const normalizedFulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order?.status,
    fulfillmentStatus: order?.fulfillmentStatus,
  });

  return getSynchronizedOrderStatus({
    orderStatus: order?.status,
    fulfillmentStatus: normalizedFulfillmentStatus,
  });
}

function normalizeRefundStatusValue(value) {
  return String(value || '').trim().toUpperCase();
}

function buildRefundTimeline(returnRequest) {
  if (!returnRequest) {
    return [];
  }

  const timeline = [];
  const pushTimeline = (status, label, timestamp, notes = '') => {
    if (!timestamp) {
      return;
    }

    timeline.push({
      status,
      label,
      timestamp,
      notes,
    });
  };

  pushTimeline(
    RETURN_REFUND_STATUS.REQUESTED,
    'Requested',
    returnRequest.refundRequestedAt || returnRequest.requestedAt || returnRequest.createdAt,
    buildReturnTimelineNotes({
      reason: returnRequest.reason,
      description: returnRequest.description,
      refundStatus: RETURN_REFUND_STATUS.REQUESTED,
    }),
  );
  pushTimeline(
    RETURN_REFUND_STATUS.APPROVED,
    'Approved',
    returnRequest.refundApprovedAt || returnRequest.approvedAt,
    buildReturnTimelineNotes({ refundStatus: RETURN_REFUND_STATUS.APPROVED }),
  );
  pushTimeline(
    RETURN_REFUND_STATUS.PROCESSING,
    'Processing',
    returnRequest.refundProcessingAt,
    buildReturnTimelineNotes({
      refundStatus: RETURN_REFUND_STATUS.PROCESSING,
      refundAmount: returnRequest.refundAmount,
      refundReference: returnRequest.refundReference,
      refundProviderId: returnRequest.refundProviderId,
    }),
  );
  pushTimeline(
    RETURN_REFUND_STATUS.COMPLETED,
    'Completed',
    returnRequest.refundCompletedAt || returnRequest.completedAt,
    buildReturnTimelineNotes({
      refundStatus: RETURN_REFUND_STATUS.COMPLETED,
      refundAmount: returnRequest.refundAmount,
      refundReference: returnRequest.refundReference,
      refundProviderId: returnRequest.refundProviderId,
    }),
  );
  pushTimeline(
    RETURN_REFUND_STATUS.REJECTED,
    'Rejected',
    returnRequest.rejectedAt,
    buildReturnTimelineNotes({
      refundStatus: RETURN_REFUND_STATUS.REJECTED,
      rejectReason: returnRequest.rejectReason,
    }),
  );
  pushTimeline(
    RETURN_REFUND_STATUS.FAILED,
    'Failed',
    returnRequest.lastRefundAttemptAt,
    buildReturnTimelineNotes({
      refundStatus: RETURN_REFUND_STATUS.FAILED,
      refundReference: returnRequest.refundReference,
      refundProviderId: returnRequest.refundProviderId,
      failureReason: returnRequest.refundFailureReason,
    }),
  );

  return timeline.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function canCustomerCancelOrder(order) {
  const paymentStatus = String(order?.paymentAttempt?.status || '').trim().toUpperCase();
  const displayStatus = String(getOrderDisplayStatus(order) || '').trim().toUpperCase();
  const fulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order?.status,
    fulfillmentStatus: order?.fulfillmentStatus,
  });

  if (order?.returnRequest) {
    return false;
  }

  if (!CUSTOMER_CANCELLABLE_PAYMENT_STATUSES.has(paymentStatus) && !CUSTOMER_CANCELLABLE_ORDER_STATUSES.has(displayStatus)) {
    return false;
  }

  return CUSTOMER_CANCELLABLE_FULFILLMENT_STATUSES.has(fulfillmentStatus);
}

function canCustomerRequestReturn(order) {
  if (order?.returnRequest) {
    return false;
  }

  const displayStatus = String(getOrderDisplayStatus(order) || '').trim().toUpperCase();
  const fulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order?.status,
    fulfillmentStatus: order?.fulfillmentStatus,
  });
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt) {
    return false;
  }

  const canReturnByStatus = displayStatus === ORDER_STATUS.COMPLETED || fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED;
  if (!canReturnByStatus) {
    return false;
  }

  return addDays(deliveredAt, RETURN_WINDOW_DAYS).getTime() >= Date.now();
}

function buildReturnResponse(returnRequest) {
  if (!returnRequest) {
    return null;
  }

  return {
    id: returnRequest.id,
    orderId: returnRequest.orderId,
    customerId: returnRequest.customerId,
    requestType: returnRequest.requestType || RETURN_REQUEST_TYPE.PRODUCT_RETURN,
    previousOrderStatus: returnRequest.previousOrderStatus || '',
    previousFulfillmentStatus: returnRequest.previousFulfillmentStatus || '',
    reason: returnRequest.reason,
    description: returnRequest.description,
    status: returnRequest.status,
    rejectReason: returnRequest.rejectReason,
    refundStatus: normalizeRefundStatusValue(returnRequest.refundStatus || RETURN_REFUND_STATUS.NONE),
    refundReference: returnRequest.refundReference || '',
    refundAmount: Number(returnRequest.refundAmount || 0),
    refundProvider: returnRequest.refundProvider || '',
    refundProviderId: returnRequest.refundProviderId || '',
    refundFailureReason: returnRequest.refundFailureReason || '',
    refundMetadata: returnRequest.refundMetadata || null,
    attachments: normalizeReturnAttachments(returnRequest.attachments),
    requestedAt: returnRequest.requestedAt,
    approvedAt: returnRequest.approvedAt,
    completedAt: returnRequest.completedAt,
    refundRequestedAt: returnRequest.refundRequestedAt || returnRequest.requestedAt || null,
    refundApprovedAt: returnRequest.refundApprovedAt || returnRequest.approvedAt || null,
    refundProcessingAt: returnRequest.refundProcessingAt || null,
    refundCompletedAt: returnRequest.refundCompletedAt || returnRequest.completedAt || null,
    lastRefundAttemptAt: returnRequest.lastRefundAttemptAt || null,
    rejectedAt: returnRequest.rejectedAt || null,
    timeline: buildRefundTimeline(returnRequest),
    createdAt: returnRequest.createdAt,
    updatedAt: returnRequest.updatedAt,
  };
}

function buildReturnTimelineNotes({ reason = '', description = '', rejectReason = '', refundStatus = '', refundAmount = 0, refundReference = '', refundProviderId = '', failureReason = '' } = {}) {
  const lines = [];

  if (reason) {
    lines.push(`Reason: ${reason}`);
  }
  if (description) {
    lines.push(`Description: ${description}`);
  }
  if (rejectReason) {
    lines.push(`Reject Reason: ${rejectReason}`);
  }
  if (refundStatus) {
    lines.push(`Refund Status: ${refundStatus}`);
  }
  if (Number(refundAmount || 0) > 0) {
    lines.push(`Refund Amount: ${Number(refundAmount || 0).toLocaleString('id-ID')}`);
  }
  if (refundReference) {
    lines.push(`Refund Reference: ${refundReference}`);
  }
  if (refundProviderId) {
    lines.push(`Refund Provider ID: ${refundProviderId}`);
  }
  if (failureReason) {
    lines.push(`Failure Reason: ${failureReason}`);
  }

  return lines.join('\n');
}

function getRefundWorkflowDisplayStatus(order) {
  const refundStatus = normalizeRefundStatusValue(order?.returnRequest?.refundStatus || '');

  switch (refundStatus) {
    case RETURN_REFUND_STATUS.REQUESTED:
      return 'REFUND_REQUESTED';
    case RETURN_REFUND_STATUS.APPROVED:
      return 'REFUND_APPROVED';
    case RETURN_REFUND_STATUS.PROCESSING:
      return 'REFUND_PROCESSING';
    case RETURN_REFUND_STATUS.COMPLETED:
      return 'REFUND_COMPLETED';
    case RETURN_REFUND_STATUS.REJECTED:
      return 'REFUND_REJECTED';
    case RETURN_REFUND_STATUS.FAILED:
      return 'REFUND_FAILED';
    default:
      return '';
  }
}

function getOperationalOrderTabStatus(order) {
  const orderStatus = normalizeOrderStatusValue(order?.status || '');
  const fulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus,
    fulfillmentStatus: order?.fulfillmentStatus,
  });

  if (orderStatus === ORDER_STATUS.PENDING_PAYMENT) {
    return 'PENDING_PAYMENT';
  }
  if (orderStatus === ORDER_STATUS.PAID) {
    return 'PAID';
  }
  if (orderStatus === ORDER_STATUS.CANCELLED) {
    return 'CANCELLED';
  }
  if (orderStatus === ORDER_STATUS.READY_FOR_FULFILLMENT || fulfillmentStatus === FULFILLMENT_STATUS.PENDING) {
    return 'NEED_FULFILLMENT';
  }
  if (fulfillmentStatus === FULFILLMENT_STATUS.PICKING || fulfillmentStatus === FULFILLMENT_STATUS.PACKING) {
    return 'PROCESSING';
  }
  if (fulfillmentStatus === FULFILLMENT_STATUS.READY_TO_SHIP) {
    return 'PACKED';
  }
  if (fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED) {
    return 'SHIPPED';
  }
  if (fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) {
    return 'DELIVERED';
  }
  if (orderStatus === ORDER_STATUS.COMPLETED) {
    return 'COMPLETED';
  }

  return orderStatus || 'UNKNOWN';
}

function getOrderStatusTabStatus(order) {
  const refundWorkflowStatus = getRefundWorkflowDisplayStatus(order);
  return refundWorkflowStatus || getOperationalOrderTabStatus(order);
}

function matchesOrderStatusTab(order, statusTab) {
  const normalizedStatusTab = String(statusTab || 'ALL').trim().toUpperCase();
  if (!normalizedStatusTab || normalizedStatusTab === 'ALL') {
    return true;
  }

  const orderStatus = normalizeOrderStatusValue(order?.status || '');
  const fulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order?.status,
    fulfillmentStatus: order?.fulfillmentStatus,
  });
  const refundWorkflowStatus = getRefundWorkflowDisplayStatus(order);

  if (normalizedStatusTab.startsWith('REFUND_')) {
    return refundWorkflowStatus === normalizedStatusTab;
  }

  if (normalizedStatusTab === 'DELIVERED') {
    return fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED;
  }

  if (normalizedStatusTab === 'COMPLETED') {
    return orderStatus === ORDER_STATUS.COMPLETED;
  }

  return getOrderStatusTabStatus(order) === normalizedStatusTab;
}

function isOrderUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function attachInternalOrderMetadata(orderResponse, meta = {}) {
  Object.defineProperty(orderResponse, '__meta', {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return orderResponse;
}

async function writeOrderAuditLog(prismaClient, payload) {
  if (!prismaClient?.auditLog?.create) {
    return null;
  }

  return writeAuditLog({ prismaClient, ...payload });
}

export class OrderService {
  constructor({
    prismaClient = prisma,
    paymentAttempt = paymentAttemptService,
    eventPublisher = domainEventPublisher,
    orderEmail = orderEmailService,
    financePosting = financePostingService,
    notificationDispatcher = notificationService,
    inventoryReservationService = null,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.paymentAttemptService = paymentAttempt;
    this.eventPublisher = eventPublisher;
    this.orderEmailService = orderEmail;
    this.financePostingService = financePosting;
    this.notificationService = notificationDispatcher;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
    this.inventoryReservationService = inventoryReservationService || new OrderInventoryService({
      prismaClient,
      idGenerator,
      nowFactory,
    });
  }

  async generateOrderNumber() {
    const now = this.nowFactory();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    let configuredPrefix = 'ORD';
    try {
      if (this.prisma?.systemSetting || this.prisma?.role) {
        const systemSettings = await getSystemSettingsMap(this.prisma);
        configuredPrefix = String(systemSettings.order_prefix?.value || 'ORD').trim().toUpperCase() || 'ORD';
      }
    } catch {
      configuredPrefix = 'ORD';
    }

    const prefix = `${configuredPrefix}-${year}${month}-`;

    const existing = await this.prisma.order.findMany({
      where: { orderNumber: { startsWith: prefix } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });

    let maxSeq = 0;
    for (const entry of existing) {
      const parts = entry.orderNumber.split('-');
      const seq = parseInt(parts[parts.length - 1] || '0', 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  async generatePublicOrderNumber() {
    for (let attempt = 0; attempt < ORDER_PUBLIC_NUMBER_RETRY_LIMIT; attempt += 1) {
      const candidate = generatePublicOrderNumberCandidate();
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          publicOrderNumber: candidate,
        },
        select: { id: true },
      });

      if (!existingOrder) {
        return candidate;
      }
    }

    throw new OrderError({
      message: 'Public order number could not be generated.',
      statusCode: 500,
      code: 'ORDER_PUBLIC_NUMBER_GENERATION_FAILED',
    });
  }

  buildOrderResponse(order) {
    const normalizedFulfillmentStatus = getSynchronizedFulfillmentStatus({
      orderStatus: order?.status,
      fulfillmentStatus: order?.fulfillmentStatus,
    });
    const synchronizedStatus = getOrderDisplayStatus(order);
    const deliveredAt = getDeliveredAt(order);
    const returnWindowEndsAt = deliveredAt ? addDays(deliveredAt, RETURN_WINDOW_DAYS) : null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      publicOrderNumber: order.publicOrderNumber,
      checkoutSessionId: order.checkoutSessionId,
      paymentAttemptId: order.paymentAttemptId,
      paymentReference: order.paymentReference,
      customerId: order.customerId,
      customerCode: order.customerCode,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      salesChannelId: order.salesChannelId,
      salesChannelCode: order.salesChannelCode,
      salesChannelName: order.salesChannelName,
      shipping: {
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        address: buildShipmentAddress(order),
        originDistrict: order.originDistrict,
        destinationDistrict: order.destinationDistrict,
        courier: order.courier,
        courierService: order.courierService,
        shippingDescription: order.shippingDescription,
        estimatedDelivery: order.estimatedDelivery,
        provinceId: order.provinceId,
        provinceName: order.provinceName,
        cityId: order.cityId,
        cityName: order.cityName,
        districtId: order.districtId,
        districtName: order.districtName,
        postalCode: order.postalCode,
        streetAddress: order.streetAddress,
        shippingCost: order.shippingCost,
      },
      payment: order.paymentAttempt ? {
        id: order.paymentAttempt.id,
        attemptNumber: order.paymentAttempt.attemptNumber,
        provider: order.paymentAttempt.provider,
        providerReference: order.paymentAttempt.providerReference,
        providerTransactionId: order.paymentAttempt.providerTransactionId,
        paymentMethod: order.paymentAttempt.paymentType || order.paymentAttempt.provider,
        issuer: order.paymentAttempt.issuer,
        acquirer: order.paymentAttempt.acquirer,
        transactionTime: order.paymentAttempt.transactionTime,
        settlementTime: order.paymentAttempt.settlementTime,
        grossAmount: order.paymentAttempt.grossAmount,
        currency: order.paymentAttempt.currency,
        status: order.paymentAttempt.status,
        expiresAt: order.paymentAttempt.expiresAt,
      } : null,
      returnRequest: buildReturnResponse(order.returnRequest),
      status: synchronizedStatus,
      fulfillmentStatus: normalizedFulfillmentStatus,
      fulfillmentStatusLabel: getFulfillmentStatusLabel(normalizedFulfillmentStatus),
      shipment: {
        courier: order.shipmentCourier || '',
        service: order.shipmentService || '',
        trackingNumber: order.trackingNumber || '',
        shippingDate: order.shippingDate || null,
      },
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingCost: order.shippingCost,
      tax: order.tax,
      grandTotal: order.grandTotal,
      items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        productImage: item.productImage,
        price: item.price,
        weight: item.weight,
        quantity: item.quantity,
        subtotal: item.subtotal,
        currency: item.currency,
      })),
      timeline: (order.timelines || []).map((entry) => ({
        id: entry.id,
        eventName: entry.eventName,
        updatedBy: entry.updatedBy,
        notes: entry.notes,
        timestamp: entry.createdAt,
        createdAt: entry.createdAt,
      })),
      actions: {
        canCancel: canCustomerCancelOrder(order),
        canRequestReturn: canCustomerRequestReturn(order),
      },
      returnPolicy: {
        returnWindowDays: RETURN_WINDOW_DAYS,
        deliveredAt,
        returnWindowEndsAt,
      },
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  buildOrderListItem(order) {
    const normalizedFulfillmentStatus = getSynchronizedFulfillmentStatus({
      orderStatus: order?.status,
      fulfillmentStatus: order?.fulfillmentStatus,
    });
    const synchronizedStatus = getOrderDisplayStatus(order);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      publicOrderNumber: order.publicOrderNumber,
      orderDate: order.createdAt,
      customerName: order.customerName,
      totalAmount: order.grandTotal,
      paymentStatus: order.paymentAttempt?.status || 'UNKNOWN',
      status: synchronizedStatus,
      fulfillmentStatus: normalizedFulfillmentStatus,
      fulfillmentStatusLabel: getFulfillmentStatusLabel(normalizedFulfillmentStatus),
      courier: order.shipmentCourier || order.courier || '',
      totalItems: order._count?.items || order.items?.length || 0,
      returnRequest: buildReturnResponse(order.returnRequest),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async listOrders({
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    paymentStatus = '',
    fulfillmentStatus = '',
    status = 'ALL',
    startDate = '',
    endDate = '',
    courier = '',
  } = {}) {
    const normalizedPage = normalizePositiveInteger(page, 1, 1000);
    const normalizedLimit = normalizePositiveInteger(limit, 10, 100);
    const normalizedSortField = normalizeSortField(sortBy);
    const normalizedSortOrder = normalizeSortOrder(sortOrder);
    const normalizedSearch = String(search || '').trim();
    const normalizedPaymentStatus = String(paymentStatus || '').trim().toUpperCase();
    const normalizedFulfillmentStatus = normalizeFulfillmentStatusValue(fulfillmentStatus);
    const normalizedStatusTab = String(status || 'ALL').trim().toUpperCase() || 'ALL';
    const normalizedCourier = String(courier || '').trim();
    const startBoundary = normalizeDateRangeBoundary(startDate, 'start');
    const endBoundary = normalizeDateRangeBoundary(endDate, 'end');

    let baseWhere = {};

    if (normalizedSearch) {
      baseWhere = mergeWhereCondition(baseWhere, {
        OR: [
          { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
          { publicOrderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
          { customerName: { contains: normalizedSearch, mode: 'insensitive' } },
          { customerEmail: { contains: normalizedSearch, mode: 'insensitive' } },
          { trackingNumber: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      });
    }

    if (normalizedPaymentStatus) {
      baseWhere = mergeWhereCondition(baseWhere, {
        paymentAttempt: {
          status: normalizedPaymentStatus,
        },
      });
    }

    if (normalizedFulfillmentStatus) {
      baseWhere = mergeWhereCondition(baseWhere, buildFulfillmentStatusWhere(normalizedFulfillmentStatus));
    }

    if (startBoundary || endBoundary) {
      baseWhere = mergeWhereCondition(baseWhere, {
        createdAt: {
          ...(startBoundary ? { gte: startBoundary } : {}),
          ...(endBoundary ? { lte: endBoundary } : {}),
        },
      });
    }

    if (normalizedCourier) {
      baseWhere = mergeWhereCondition(baseWhere, {
        OR: [
          { shipmentCourier: { contains: normalizedCourier, mode: 'insensitive' } },
          { courier: { contains: normalizedCourier, mode: 'insensitive' } },
        ],
      });
    }

    const summaryOrders = await this.prisma.order.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        fulfillmentStatus: true,
        returnRequest: {
          select: {
            refundStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      all: summaryOrders.length,
      pendingPayment: 0,
      paid: 0,
      needFulfillment: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      refundRequested: 0,
      refundApproved: 0,
      refundProcessing: 0,
      refundCompleted: 0,
      refundRejected: 0,
      refundFailed: 0,
    };

    for (const order of summaryOrders) {
      const refundWorkflowStatus = getRefundWorkflowDisplayStatus(order);
      const orderStatus = normalizeOrderStatusValue(order.status);
      const fulfillmentStatusValue = getSynchronizedFulfillmentStatus({
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
      });

      if (refundWorkflowStatus === 'REFUND_REQUESTED') summary.refundRequested += 1;
      if (refundWorkflowStatus === 'REFUND_APPROVED') summary.refundApproved += 1;
      if (refundWorkflowStatus === 'REFUND_PROCESSING') summary.refundProcessing += 1;
      if (refundWorkflowStatus === 'REFUND_COMPLETED') summary.refundCompleted += 1;
      if (refundWorkflowStatus === 'REFUND_REJECTED') summary.refundRejected += 1;
      if (refundWorkflowStatus === 'REFUND_FAILED') summary.refundFailed += 1;

      if (refundWorkflowStatus) {
        continue;
      }

      if (orderStatus === ORDER_STATUS.PENDING_PAYMENT) summary.pendingPayment += 1;
      if (orderStatus === ORDER_STATUS.PAID) summary.paid += 1;
      if (orderStatus === ORDER_STATUS.CANCELLED) summary.cancelled += 1;
      if (orderStatus === ORDER_STATUS.READY_FOR_FULFILLMENT || fulfillmentStatusValue === FULFILLMENT_STATUS.PENDING) summary.needFulfillment += 1;
      if ([FULFILLMENT_STATUS.PICKING, FULFILLMENT_STATUS.PACKING].includes(fulfillmentStatusValue)) summary.processing += 1;
      if (fulfillmentStatusValue === FULFILLMENT_STATUS.READY_TO_SHIP) summary.packed += 1;
      if (fulfillmentStatusValue === FULFILLMENT_STATUS.SHIPPED) summary.shipped += 1;
      if (fulfillmentStatusValue === FULFILLMENT_STATUS.DELIVERED) summary.delivered += 1;
      if (orderStatus === ORDER_STATUS.COMPLETED) summary.completed += 1;
    }

    const matchingIds = summaryOrders
      .filter((order) => matchesOrderStatusTab(order, normalizedStatusTab))
      .map((order) => order.id);

    let where = baseWhere;
    if (normalizedStatusTab !== 'ALL') {
      where = mergeWhereCondition(where, {
        id: {
          in: matchingIds.length > 0 ? matchingIds : ['__no_match__'],
        },
      });
    }

    const [totalItems, orders] = await Promise.all([
      Promise.resolve(normalizedStatusTab === 'ALL' ? summary.all : matchingIds.length),
      this.prisma.order.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          paymentAttempt: {
            select: {
              status: true,
            },
          },
          returnRequest: true,
        },
        orderBy: {
          [normalizedSortField]: normalizedSortOrder,
        },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / normalizedLimit));

    return {
      data: orders.map((order) => this.buildOrderListItem(order)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
        hasPreviousPage: normalizedPage > 1,
      },
      sorting: {
        sortBy: normalizedSortField,
        sortOrder: normalizedSortOrder,
      },
      filters: {
        search: normalizedSearch,
        paymentStatus: normalizedPaymentStatus,
        fulfillmentStatus: normalizedFulfillmentStatus,
        status: normalizedStatusTab,
        startDate: startDate || '',
        endDate: endDate || '',
        courier: normalizedCourier,
      },
      summary: {
        ...summary,
        pending: summary.needFulfillment,
        picking: 0,
        packing: summary.processing,
        readyToShip: summary.packed,
      },
    };
  }

  async listOrdersByCustomerEmail({
    email = '',
    page = 1,
    limit = 10,
  } = {}) {
    const normalizedEmail = normalizeCustomerEmailValue(email);
    if (!normalizedEmail) {
      throw new OrderError({
        message: 'email is required.',
        statusCode: 400,
        code: 'ORDER_CUSTOMER_EMAIL_REQUIRED',
      });
    }

    const normalizedPage = normalizePositiveInteger(page, 1, 1000);
    const normalizedLimit = normalizePositiveInteger(limit, 10, 100);
    const where = {
      customerEmail: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
      status: {
        not: ORDER_STATUS.PENDING_PAYMENT,
      },
    };

    const [
      totalItems,
      orders,
      pending,
      picking,
      packing,
      readyToShip,
      shipped,
      delivered,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          paymentAttempt: {
            select: {
              status: true,
            },
          },
          returnRequest: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.PENDING)) }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.PICKING)) }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.PACKING)) }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.READY_TO_SHIP)) }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.SHIPPED)) }),
      this.prisma.order.count({ where: mergeWhereCondition(where, buildFulfillmentStatusWhere(FULFILLMENT_STATUS.DELIVERED)) }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / normalizedLimit));

    return {
      data: orders.map((order) => this.buildOrderListItem(order)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
        hasPreviousPage: normalizedPage > 1,
      },
      sorting: {
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      filters: {
        email: normalizedEmail,
      },
      summary: {
        pending,
        picking,
        packing,
        readyToShip,
        shipped,
        delivered,
      },
    };
  }

  async getCheckoutSessionSnapshot(checkoutSessionId) {
    if (!checkoutSessionId) {
      throw new OrderError({
        message: 'checkoutSessionId is required.',
        statusCode: 400,
        code: 'ORDER_CHECKOUT_SESSION_REQUIRED',
      });
    }

    const checkoutSession = await this.prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: { items: true },
    });

    if (!checkoutSession) {
      throw new OrderError({
        message: 'Checkout session was not found.',
        statusCode: 404,
        code: 'CHECKOUT_SESSION_NOT_FOUND',
      });
    }

    return checkoutSession;
  }

  async getOrderRecord(orderId) {
    if (!orderId) {
      throw new OrderError({
        message: 'orderId is required.',
        statusCode: 400,
        code: 'ORDER_ID_REQUIRED',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    return order;
  }

  async getOrderById(orderId) {
    const order = await this.getOrderRecord(orderId);
    return this.buildOrderResponse(order);
  }

  async getOrderRecordByNumber(orderNumber) {
    const normalizedPublicOrderNumber = normalizePublicOrderNumberValue(orderNumber);
    if (!normalizedPublicOrderNumber) {
      throw new OrderError({
        message: 'orderNumber is required.',
        statusCode: 400,
        code: 'ORDER_NUMBER_REQUIRED',
      });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        publicOrderNumber: {
          equals: normalizedPublicOrderNumber,
          mode: 'insensitive',
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    return order;
  }

  async getOrderByNumber(orderNumber) {
    const order = await this.getOrderRecordByNumber(orderNumber);
    return this.buildOrderResponse(order);
  }

  async getOrderByCheckoutSessionId(checkoutSessionId) {
    if (!checkoutSessionId) {
      throw new OrderError({
        message: 'checkoutSessionId is required.',
        statusCode: 400,
        code: 'ORDER_CHECKOUT_SESSION_REQUIRED',
      });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        checkoutSessionId,
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    return this.buildOrderResponse(order);
  }

  async trackOrder({ email = '', orderNumber = '' } = {}) {
    const normalizedEmail = normalizeCustomerEmailValue(email);
    if (!normalizedEmail) {
      throw new OrderError({
        message: 'email is required.',
        statusCode: 400,
        code: 'ORDER_CUSTOMER_EMAIL_REQUIRED',
      });
    }

    const normalizedPublicOrderNumber = normalizePublicOrderNumberValue(orderNumber);
    if (!normalizedPublicOrderNumber) {
      throw new OrderError({
        message: 'orderNumber is required.',
        statusCode: 400,
        code: 'ORDER_NUMBER_REQUIRED',
      });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        customerEmail: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        publicOrderNumber: {
          equals: normalizedPublicOrderNumber,
          mode: 'insensitive',
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    return this.buildOrderResponse(order);
  }

  async getExistingOrderForPaymentAttempt(paymentAttempt) {
    return this.prisma.order.findFirst({
      where: {
        OR: [
          { paymentAttemptId: paymentAttempt.id },
          { checkoutSessionId: paymentAttempt.checkoutSessionId },
        ],
      },
      include: ORDER_DETAIL_INCLUDE,
    });
  }

  async ensurePendingOrderForCheckoutSession({ checkoutSessionId, checkoutSession = null } = {}) {
    if (!checkoutSessionId) {
      throw new OrderError({
        message: 'checkoutSessionId is required.',
        statusCode: 400,
        code: 'ORDER_CHECKOUT_SESSION_REQUIRED',
      });
    }

    const existingOrder = await this.prisma.order.findFirst({
      where: { checkoutSessionId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (existingOrder) {
      return existingOrder;
    }

    const resolvedCheckoutSession = checkoutSession || await this.getCheckoutSessionSnapshot(checkoutSessionId);
    const createdAt = this.nowFactory();
    const orderNumber = await this.generateOrderNumber();
    const publicOrderNumber = await this.generatePublicOrderNumber();

    try {
      return await this.prisma.order.create({
        data: {
          id: this.idGenerator(),
          orderNumber,
          publicOrderNumber,
          checkoutSessionId: resolvedCheckoutSession.id,
          paymentAttemptId: null,
          paymentReference: '',
          customerId: resolvedCheckoutSession.customerId,
          customerCode: resolvedCheckoutSession.customerCode,
          customerName: resolvedCheckoutSession.customerName,
          customerEmail: resolvedCheckoutSession.customerEmail,
          customerPhone: resolvedCheckoutSession.customerPhone,
          salesChannelId: resolvedCheckoutSession.salesChannelId,
          salesChannelCode: resolvedCheckoutSession.salesChannelCode,
          salesChannelName: resolvedCheckoutSession.salesChannelName,
          recipientName: resolvedCheckoutSession.recipientName,
          recipientPhone: resolvedCheckoutSession.phone,
          originDistrict: resolvedCheckoutSession.originDistrict,
          destinationDistrict: resolvedCheckoutSession.destinationDistrict,
          courier: resolvedCheckoutSession.courier,
          courierService: resolvedCheckoutSession.courierService,
          shippingDescription: resolvedCheckoutSession.shippingDescription,
          estimatedDelivery: resolvedCheckoutSession.estimatedDelivery,
          provinceId: resolvedCheckoutSession.provinceId,
          provinceName: resolvedCheckoutSession.provinceName,
          cityId: resolvedCheckoutSession.cityId,
          cityName: resolvedCheckoutSession.cityName,
          districtId: resolvedCheckoutSession.districtId,
          districtName: resolvedCheckoutSession.districtName,
          postalCode: resolvedCheckoutSession.postalCode,
          streetAddress: resolvedCheckoutSession.streetAddress,
          status: ORDER_STATUS.PENDING_PAYMENT,
          fulfillmentStatus: FULFILLMENT_STATUS.PENDING,
          currency: resolvedCheckoutSession.currency,
          subtotal: resolvedCheckoutSession.subtotal,
          discount: resolvedCheckoutSession.discount,
          shippingCost: resolvedCheckoutSession.shippingCost,
          tax: resolvedCheckoutSession.tax,
          grandTotal: resolvedCheckoutSession.grandTotal,
          items: {
            create: resolvedCheckoutSession.items.map((item) => ({
              id: this.idGenerator(),
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              productName: item.productName,
              variantName: item.variantName,
              productImage: item.productImage || '',
              price: item.price,
              weight: item.weight || 0,
              quantity: item.qty,
              subtotal: item.subtotal,
              currency: item.currency || resolvedCheckoutSession.currency,
            })),
          },
          timelines: {
            create: [
              buildTimelineEntry({
                id: this.idGenerator(),
                eventName: 'Order Created',
                updatedBy: ORDER_TIMELINE_SYSTEM_USER,
                notes: `Order ${orderNumber} was created from checkout ${resolvedCheckoutSession.checkoutNumber}.`,
                createdAt,
              }),
              buildTimelineEntry({
                id: this.idGenerator(),
                eventName: 'WAITING_PAYMENT',
                updatedBy: ORDER_TIMELINE_SYSTEM_USER,
                notes: 'Waiting Payment',
                createdAt: new Date(createdAt.getTime() + 1),
              }),
            ],
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });
    } catch (error) {
      if (isOrderUniqueConstraintError(error)) {
        const concurrentOrder = await this.prisma.order.findFirst({
          where: { checkoutSessionId },
          include: ORDER_DETAIL_INCLUDE,
        });
        if (concurrentOrder) {
          return concurrentOrder;
        }
      }
      throw error;
    }
  }

  async createOrderRecord({ paymentAttempt, checkoutSession }) {
    const startedAt = Date.now();
    const orderNumber = await this.generateOrderNumber();
    const publicOrderNumber = await this.generatePublicOrderNumber();
    const createdAt = this.nowFactory();

    try {
      const order = await this.prisma.order.create({
        data: {
          id: this.idGenerator(),
          orderNumber,
          publicOrderNumber,
          checkoutSessionId: checkoutSession.id,
          paymentAttemptId: paymentAttempt.id,
          paymentReference: paymentAttempt.providerReference || paymentAttempt.attemptNumber,
          customerId: checkoutSession.customerId,
          customerCode: checkoutSession.customerCode,
          customerName: checkoutSession.customerName,
          customerEmail: checkoutSession.customerEmail,
          customerPhone: checkoutSession.customerPhone,
          salesChannelId: checkoutSession.salesChannelId,
          salesChannelCode: checkoutSession.salesChannelCode,
          salesChannelName: checkoutSession.salesChannelName,
          recipientName: checkoutSession.recipientName,
          recipientPhone: checkoutSession.phone,
          originDistrict: checkoutSession.originDistrict,
          destinationDistrict: checkoutSession.destinationDistrict,
          courier: checkoutSession.courier,
          courierService: checkoutSession.courierService,
          shippingDescription: checkoutSession.shippingDescription,
          estimatedDelivery: checkoutSession.estimatedDelivery,
          provinceId: checkoutSession.provinceId,
          provinceName: checkoutSession.provinceName,
          cityId: checkoutSession.cityId,
          cityName: checkoutSession.cityName,
          districtId: checkoutSession.districtId,
          districtName: checkoutSession.districtName,
          postalCode: checkoutSession.postalCode,
          streetAddress: checkoutSession.streetAddress,
          status: ORDER_STATUS.READY_FOR_FULFILLMENT,
          fulfillmentStatus: FULFILLMENT_STATUS.PENDING,
          currency: checkoutSession.currency,
          subtotal: checkoutSession.subtotal,
          discount: checkoutSession.discount,
          shippingCost: checkoutSession.shippingCost,
          tax: checkoutSession.tax,
          grandTotal: checkoutSession.grandTotal,
          items: {
            create: checkoutSession.items.map((item) => ({
              id: this.idGenerator(),
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              productName: item.productName,
              variantName: item.variantName,
              productImage: item.productImage || '',
              price: item.price,
              weight: item.weight || 0,
              quantity: item.qty,
              subtotal: item.subtotal,
              currency: item.currency || checkoutSession.currency,
            })),
          },
          timelines: {
            create: [
              buildTimelineEntry({
                id: this.idGenerator(),
                eventName: 'Order Created',
                updatedBy: ORDER_TIMELINE_SYSTEM_USER,
                notes: `Order ${orderNumber} was created from checkout ${checkoutSession.checkoutNumber}.`,
                createdAt,
              }),
              buildTimelineEntry({
                id: this.idGenerator(),
                eventName: 'Payment Received',
                updatedBy: ORDER_TIMELINE_SYSTEM_USER,
                notes: `Payment attempt ${paymentAttempt.attemptNumber} was settled successfully.`,
                createdAt: new Date(createdAt.getTime() + 1),
              }),
            ],
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });

      return {
        order,
        transactionDurationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (isOrderUniqueConstraintError(error)) {
        const concurrentOrder = await this.getExistingOrderForPaymentAttempt(paymentAttempt);
        if (concurrentOrder) {
          return {
            order: concurrentOrder,
            transactionDurationMs: Date.now() - startedAt,
            action: 'FOUND',
          };
        }
      }

      throw error;
    }
  }

  async publishOrderLifecycleEvents({ order, orderAction, inventoryReservationResult }) {
    const startedAt = Date.now();
    const publishedEvents = [];

    if (orderAction === 'CREATED') {
      await this.eventPublisher.publish('OrderCreated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: order.checkoutSessionId,
        paymentAttemptId: order.paymentAttemptId,
      });
      publishedEvents.push('OrderCreated');
    }

    if (inventoryReservationResult === ORDER_INVENTORY_RESERVATION_RESULT.COMMITTED) {
      await this.eventPublisher.publish('InventoryCommitted', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: order.checkoutSessionId,
      });
      publishedEvents.push('InventoryCommitted');
    }

    return {
      publishedEvents,
      transactionDurationMs: Date.now() - startedAt,
    };
  }

  async postSalesJournalIfNeeded(order) {
    if (!order) {
      return {
        action: 'SKIPPED',
        journal: null,
      };
    }

    return this.financePostingService.postSalesJournal(order);
  }

  async postCogsJournalIfNeeded(order) {
    if (!order) {
      return {
        action: 'SKIPPED',
        journal: null,
      };
    }

    return this.financePostingService.postCogsJournal(order);
  }

  async sendOrderConfirmationEmailIfNeeded(order) {
    if (!order || order.orderConfirmationEmailSentAt) {
      return {
        status: ORDER_CONFIRMATION_EMAIL_SKIPPED,
        reason: order?.orderConfirmationEmailSentAt ? 'ALREADY_SENT' : 'ORDER_MISSING',
      };
    }

    const customerOrderCreatedEnabled = await this.notificationService.isSettingEnabled('customer_order_created', { prismaClient: this.prisma });
    const customerPaymentReceivedEnabled = await this.notificationService.isSettingEnabled('customer_payment_received', { prismaClient: this.prisma });
    if (!customerOrderCreatedEnabled || !customerPaymentReceivedEnabled) {
      return {
        status: ORDER_CONFIRMATION_EMAIL_SKIPPED,
        reason: 'CUSTOMER_EMAIL_NOTIFICATION_DISABLED',
      };
    }

    if (!order.customerEmail) {
      return {
        status: ORDER_CONFIRMATION_EMAIL_SKIPPED,
        reason: 'CUSTOMER_EMAIL_MISSING',
      };
    }

    try {
      const emailResult = await this.orderEmailService.sendOrderConfirmationEmail({ order });
      if (emailResult?.skipped) {
        return {
          status: ORDER_CONFIRMATION_EMAIL_SKIPPED,
          reason: emailResult.reason || 'SKIPPED',
        };
      }

      const sentAt = this.nowFactory();
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          orderConfirmationEmailSentAt: sentAt,
        },
      });
      order.orderConfirmationEmailSentAt = sentAt;

      logOrderEmailEvent({
        eventName: 'ORDER_CONFIRMATION_EMAIL_SENT',
        orderId: order.id,
        orderNumber: order.orderNumber,
        publicOrderNumber: order.publicOrderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: ORDER_CONFIRMATION_EMAIL_SENT,
      });

      return {
        status: ORDER_CONFIRMATION_EMAIL_SENT,
        reason: '',
      };
    } catch (error) {
      logOrderEmailEvent({
        eventName: 'ORDER_CONFIRMATION_EMAIL_FAILED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        publicOrderNumber: order.publicOrderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        reason: error instanceof Error ? error.message : 'Unknown email delivery error.',
        status: ORDER_CONFIRMATION_EMAIL_FAILED,
      });

      return {
        status: ORDER_CONFIRMATION_EMAIL_FAILED,
        reason: error instanceof Error ? error.message : 'Unknown email delivery error.',
      };
    }
  }

  async sendOrderStatusUpdateEmailIfNeeded(order, statusType) {
    const settingKey = statusType === FULFILLMENT_STATUS.SHIPPED ? 'customer_order_shipped' : 'customer_order_delivered';
    const enabled = await this.notificationService.isSettingEnabled(settingKey, { prismaClient: this.prisma });
    if (!enabled) {
      return { skipped: true, reason: 'CUSTOMER_EMAIL_NOTIFICATION_DISABLED' };
    }

    return this.orderEmailService.sendOrderStatusUpdateEmail({
      order,
      statusType: statusType === FULFILLMENT_STATUS.SHIPPED ? 'SHIPPED' : 'DELIVERED',
    });
  }

  async createFromCheckoutSession({ paymentAttemptId }) {
    const startedAt = Date.now();
    let orderId = '';
    let orderNumber = '';
    let publicOrderNumber = '';
    let checkoutSessionId = '';
    let checkoutNumber = '';
    let paymentAttemptNumber = '';
    let inventoryReservationResult = ORDER_INVENTORY_RESERVATION_RESULT.SKIPPED;

    try {
      if (!paymentAttemptId) {
        throw new OrderError({
          message: 'paymentAttemptId is required.',
          statusCode: 400,
          code: 'ORDER_PAYMENT_ATTEMPT_REQUIRED',
        });
      }

      const paymentAttempt = await this.paymentAttemptService.getPaymentAttemptById(paymentAttemptId);
      paymentAttemptNumber = paymentAttempt.attemptNumber;
      checkoutSessionId = paymentAttempt.checkoutSessionId;

      if (paymentAttempt.status !== 'PAID') {
        throw new OrderError({
          message: 'Payment attempt is not ready for order creation.',
          statusCode: 400,
          code: 'ORDER_PAYMENT_ATTEMPT_INVALID_STATUS',
        });
      }

      logOrderLifecyclePhase({
        phase: 'PAYMENT_ATTEMPT_CONFIRMED',
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        durationMs: Date.now() - startedAt,
        validationResult: 'CONFIRMED',
      });

      const checkoutSession = await this.getCheckoutSessionSnapshot(paymentAttempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber;

      if (checkoutSession.status !== 'PAID') {
        throw new OrderError({
          message: 'Checkout session is not paid.',
          statusCode: 400,
          code: 'ORDER_CHECKOUT_INVALID_STATUS',
        });
      }

      logOrderLifecyclePhase({
        phase: 'CHECKOUT_SESSION_CONFIRMED',
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        durationMs: Date.now() - startedAt,
        validationResult: 'CONFIRMED',
      });

      let existingOrder = await this.getExistingOrderForPaymentAttempt(paymentAttempt);
      let orderAction = 'FOUND';
      let orderCreationDurationMs = 0;

      if (!existingOrder) {
        const orderCreation = await this.createOrderRecord({
          paymentAttempt,
          checkoutSession,
        });
        existingOrder = orderCreation.order;
        orderAction = orderCreation.action || 'CREATED';
        orderCreationDurationMs = orderCreation.transactionDurationMs || 0;
      }

      const needsPaymentPromotion = existingOrder.status === ORDER_STATUS.PENDING_PAYMENT;
      if (needsPaymentPromotion || existingOrder.paymentAttemptId !== paymentAttempt.id || existingOrder.paymentReference !== (paymentAttempt.providerReference || paymentAttempt.attemptNumber)) {
        const timelineEntries = [];
        const promotionTimestamp = this.nowFactory();

        if (needsPaymentPromotion && !(existingOrder.timelines || []).some((entry) => String(entry.eventName || '').trim() === 'Payment Received')) {
          timelineEntries.push(buildTimelineEntry({
            id: this.idGenerator(),
            orderId: existingOrder.id,
            eventName: 'Payment Received',
            updatedBy: ORDER_TIMELINE_SYSTEM_USER,
            notes: `Payment attempt ${paymentAttempt.attemptNumber} was settled successfully.`,
            createdAt: promotionTimestamp,
          }));
          timelineEntries.push(buildTimelineEntry({
            id: this.idGenerator(),
            orderId: existingOrder.id,
            eventName: getOrderStatusTimelineEventName(ORDER_STATUS.READY_FOR_FULFILLMENT),
            updatedBy: ORDER_TIMELINE_SYSTEM_USER,
            notes: buildOrderStatusSynchronizationNotes({
              previousStatus: ORDER_STATUS.PENDING_PAYMENT,
              newStatus: ORDER_STATUS.READY_FOR_FULFILLMENT,
              fulfillmentStatus: existingOrder.fulfillmentStatus,
            }),
            createdAt: new Date(promotionTimestamp.getTime() + 1),
          }));
        }

        existingOrder = await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: existingOrder.id },
            data: {
              status: needsPaymentPromotion ? ORDER_STATUS.READY_FOR_FULFILLMENT : existingOrder.status,
              paymentAttemptId: paymentAttempt.id,
              paymentReference: paymentAttempt.providerReference || paymentAttempt.attemptNumber,
            },
          });

          if (timelineEntries.length > 0) {
            await tx.orderTimeline.createMany({ data: timelineEntries });
          }

          return tx.order.findUnique({
            where: { id: existingOrder.id },
            include: ORDER_DETAIL_INCLUDE,
          });
        });
      }

      orderId = existingOrder.id;
      orderNumber = existingOrder.orderNumber;
      publicOrderNumber = existingOrder.publicOrderNumber;

      logOrderLifecyclePhase({
        phase: orderAction === 'CREATED' ? 'ORDER_CREATED' : 'ORDER_FOUND',
        orderId,
        orderNumber,
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        durationMs: Date.now() - startedAt,
        transactionDurationMs: orderCreationDurationMs,
        validationResult: orderAction === 'CREATED' ? 'CREATED' : 'REUSED',
      });

      const inventoryReservationStartedAt = Date.now();

      try {
        const inventoryReservation = await this.inventoryReservationService.reserveForOrder(orderId);
        inventoryReservationResult = inventoryReservation.result;

        logOrderLifecyclePhase({
          phase: 'INVENTORY_RESERVATION_COMPLETED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult,
          durationMs: Date.now() - startedAt,
          transactionDurationMs: inventoryReservation.transactionDurationMs || (Date.now() - inventoryReservationStartedAt),
          validationResult: inventoryReservationResult,
        });
      } catch (error) {
        logOrderLifecyclePhase({
          phase: 'INVENTORY_RESERVATION_FAILED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult: 'FAILED',
          durationMs: Date.now() - startedAt,
          transactionDurationMs: Date.now() - inventoryReservationStartedAt,
          reason: error?.message || 'Inventory reservation failed.',
          validationResult: 'FAILED',
        });

        if (error instanceof OrderError) {
          error.orderId = orderId;
          error.orderNumber = orderNumber;
          error.paymentAttemptId = paymentAttempt.id;
          error.checkoutSessionId = checkoutSessionId;
          error.inventoryReservationResult = 'FAILED';
          throw error;
        }

        const retryableError = new OrderError({
          message: 'Order was created, but inventory reservation failed. Please retry the webhook.',
          statusCode: 503,
          code: 'ORDER_INVENTORY_RESERVATION_RETRY_REQUIRED',
        });
        retryableError.orderId = orderId;
        retryableError.orderNumber = orderNumber;
        retryableError.paymentAttemptId = paymentAttempt.id;
        retryableError.checkoutSessionId = checkoutSessionId;
        retryableError.inventoryReservationResult = 'FAILED';
        throw retryableError;
      }

      const eventPublishing = await this.publishOrderLifecycleEvents({
        order: existingOrder,
        orderAction,
        inventoryReservationResult,
      });

      if (orderAction === 'CREATED') {
        await this.notificationService.dispatch({
          type: NOTIFICATION_EVENT_TYPE.NEW_ORDER,
          payload: {
            orderNumber,
            publicOrderNumber,
            customerName: existingOrder.customerName,
          },
          prismaClient: this.prisma,
        });
        await this.notificationService.dispatch({
          type: NOTIFICATION_EVENT_TYPE.PAYMENT_RECEIVED,
          payload: {
            orderNumber,
            publicOrderNumber,
          },
          prismaClient: this.prisma,
        });
      }

      logOrderLifecyclePhase({
        phase: eventPublishing.publishedEvents.length > 0 ? 'DOMAIN_EVENTS_PUBLISHED' : 'DOMAIN_EVENTS_SKIPPED',
        orderId,
        orderNumber,
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        inventoryReservationResult,
        durationMs: Date.now() - startedAt,
        transactionDurationMs: eventPublishing.transactionDurationMs,
        validationResult: eventPublishing.publishedEvents.length > 0 ? 'PUBLISHED' : 'SKIPPED',
      });

      try {
        const salesJournal = await this.postSalesJournalIfNeeded(existingOrder);
        logOrderLifecyclePhase({
          phase: 'SALES_JOURNAL_POSTED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult,
          durationMs: Date.now() - startedAt,
          validationResult: salesJournal.action,
        });
      } catch (error) {
        logOrderLifecyclePhase({
          phase: 'SALES_JOURNAL_FAILED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult,
          durationMs: Date.now() - startedAt,
          reason: error?.message || 'Sales journal posting failed.',
          validationResult: 'FAILED',
        });

        const retryableError = new OrderError({
          message: 'Order was created, but sales journal posting failed. Please retry the webhook.',
          statusCode: 503,
          code: 'ORDER_SALES_JOURNAL_RETRY_REQUIRED',
        });
        retryableError.orderId = orderId;
        retryableError.orderNumber = orderNumber;
        retryableError.paymentAttemptId = paymentAttempt.id;
        retryableError.checkoutSessionId = checkoutSessionId;
        throw retryableError;
      }

      try {
        const cogsJournal = await this.postCogsJournalIfNeeded(existingOrder);
        logOrderLifecyclePhase({
          phase: 'COGS_JOURNAL_POSTED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult,
          durationMs: Date.now() - startedAt,
          validationResult: cogsJournal.action,
        });
      } catch (error) {
        logOrderLifecyclePhase({
          phase: 'COGS_JOURNAL_FAILED',
          orderId,
          orderNumber,
          paymentAttemptId: paymentAttempt.id,
          paymentAttemptNumber,
          checkoutSessionId,
          checkoutNumber,
          inventoryReservationResult,
          durationMs: Date.now() - startedAt,
          reason: error?.message || 'COGS journal posting failed.',
          validationResult: 'FAILED',
        });

        const retryableError = new OrderError({
          message: 'Order was created, but COGS journal posting failed. Please retry the webhook.',
          statusCode: 503,
          code: 'ORDER_COGS_JOURNAL_RETRY_REQUIRED',
        });
        retryableError.orderId = orderId;
        retryableError.orderNumber = orderNumber;
        retryableError.paymentAttemptId = paymentAttempt.id;
        retryableError.checkoutSessionId = checkoutSessionId;
        throw retryableError;
      }

      const orderConfirmationEmail = await this.sendOrderConfirmationEmailIfNeeded(existingOrder);

      logOrderLifecyclePhase({
        phase: 'ORDER_CONFIRMATION_EMAIL_PROCESSED',
        orderId,
        orderNumber,
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        inventoryReservationResult,
        durationMs: Date.now() - startedAt,
        reason: orderConfirmationEmail.reason,
        validationResult: orderConfirmationEmail.status,
      });

      logOrderLifecyclePhase({
        phase: 'ORDER_WORKFLOW_COMPLETED',
        orderId,
        orderNumber,
        paymentAttemptId: paymentAttempt.id,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        inventoryReservationResult,
        durationMs: Date.now() - startedAt,
        validationResult: 'COMPLETED',
      });

      logOrderCreation({
        orderNumber,
        publicOrderNumber,
        checkoutNumber,
        paymentAttemptNumber,
        durationMs: Date.now() - startedAt,
        validationResult: orderAction === 'CREATED' ? 'CREATED' : 'REUSED',
      });

      return attachInternalOrderMetadata(this.buildOrderResponse(existingOrder), {
        action: orderAction,
        inventoryCommitted: inventoryReservationResult === ORDER_INVENTORY_RESERVATION_RESULT.COMMITTED,
        inventoryReservationResult,
      });
    } catch (error) {
      logOrderLifecyclePhase({
        phase: 'ORDER_WORKFLOW_FAILED',
        orderId,
        orderNumber,
        paymentAttemptId,
        paymentAttemptNumber,
        checkoutSessionId,
        checkoutNumber,
        inventoryReservationResult,
        durationMs: Date.now() - startedAt,
        reason: error?.message || 'Order creation failed.',
        validationResult: 'FAILED',
      });

      logOrderCreation({
        orderNumber,
        publicOrderNumber,
        checkoutNumber,
        paymentAttemptNumber,
        durationMs: Date.now() - startedAt,
        validationResult: 'FAILED',
      });
      throw error;
    }
  }

  async cancelOrderByCustomer({
    orderId,
    customerEmail = '',
    reason = '',
  }) {
    const order = await this.getOrderRecord(orderId);
    const normalizedCustomerEmail = normalizeCustomerEmailValue(customerEmail);
    if (!normalizedCustomerEmail || normalizedCustomerEmail !== normalizeCustomerEmailValue(order.customerEmail)) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    if (!canCustomerCancelOrder(order)) {
      throw new OrderError({
        message: 'This order can no longer be cancelled.',
        statusCode: 409,
        code: 'ORDER_CANCELLATION_NOT_ALLOWED',
      });
    }

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      throw new OrderError({
        message: 'Cancellation reason is required.',
        statusCode: 400,
        code: 'ORDER_CANCELLATION_REASON_REQUIRED',
      });
    }

    const paymentStatus = String(order?.paymentAttempt?.status || '').trim().toUpperCase();
    const previousOrderStatus = normalizeOrderStatusValue(order.status);
    const previousFulfillmentStatus = getSynchronizedFulfillmentStatus({
      orderStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
    });
    const timelineTimestamp = this.nowFactory();
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: ORDER_STATUS.CANCELLED,
          fulfillmentStatus: FULFILLMENT_STATUS.CANCELLED,
        },
      });

      if (paymentStatus === 'PAID') {
        await tx.returnRequest.create({
          data: {
            id: this.idGenerator(),
            orderId: order.id,
            customerId: order.customerId,
            requestType: RETURN_REQUEST_TYPE.ORDER_CANCELLATION,
            previousOrderStatus,
            previousFulfillmentStatus,
            reason: normalizedReason,
            description: 'Customer requested cancellation before fulfillment.',
            status: RETURN_REQUEST_STATUS.REQUESTED,
            refundStatus: RETURN_REFUND_STATUS.REQUESTED,
            attachments: [],
            refundAmount: Number(order.grandTotal || 0),
            requestedAt: timelineTimestamp,
            refundRequestedAt: timelineTimestamp,
          },
        });
      } else {
        await tx.paymentAttempt.updateMany({
          where: {
            orderId: order.id,
            status: { in: ['CREATED', 'PENDING'] },
          },
          data: { status: 'CANCELLED' },
        });

        await tx.checkoutSession.updateMany({
          where: { id: order.checkoutSessionId },
          data: { status: 'CANCELLED' },
        });
      }

      await tx.orderTimeline.createMany({
        data: [
          buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: 'CANCELLED',
            updatedBy: order.customerName || order.customerEmail || ORDER_TIMELINE_SYSTEM_USER,
            notes: buildReturnTimelineNotes({ reason: normalizedReason, description: 'Customer requested cancellation.' }),
            createdAt: timelineTimestamp,
          }),
          buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: 'FULFILLMENT_CANCELLED',
            updatedBy: ORDER_TIMELINE_SYSTEM_USER,
            notes: 'Fulfillment synchronized to Cancelled.',
            createdAt: new Date(timelineTimestamp.getTime() + 1),
          }),
          ...(paymentStatus === 'PAID' ? [buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: 'REFUND_REQUESTED',
            updatedBy: order.customerName || order.customerEmail || ORDER_TIMELINE_SYSTEM_USER,
            notes: buildReturnTimelineNotes({
              reason: normalizedReason,
              description: 'Customer requested refund after cancellation.',
              refundStatus: RETURN_REFUND_STATUS.REQUESTED,
              refundAmount: Number(order.grandTotal || 0),
            }),
            createdAt: new Date(timelineTimestamp.getTime() + 2),
          })] : []),
        ],
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    await this.notificationService.dispatch({
      type: NOTIFICATION_EVENT_TYPE.ORDER_CANCELLED,
      payload: {
        orderNumber: updatedOrder.orderNumber,
        publicOrderNumber: updatedOrder.publicOrderNumber,
      },
      prismaClient: this.prisma,
    });

    if (paymentStatus === 'PAID') {
      await this.notificationService.dispatch({
        type: NOTIFICATION_EVENT_TYPE.REFUND_REQUESTED,
        payload: {
          orderNumber: updatedOrder.orderNumber,
          publicOrderNumber: updatedOrder.publicOrderNumber,
          customerName: updatedOrder.customerName,
        },
        prismaClient: this.prisma,
      });
    }

    return this.buildOrderResponse(updatedOrder);
  }

  async requestReturnByCustomer({
    orderId,
    customerEmail = '',
    reason = '',
    description = '',
    attachments = [],
  }) {
    const order = await this.getOrderRecord(orderId);
    const normalizedCustomerEmail = normalizeCustomerEmailValue(customerEmail);
    if (!normalizedCustomerEmail || normalizedCustomerEmail !== normalizeCustomerEmailValue(order.customerEmail)) {
      throw new OrderError({
        message: 'Order was not found.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    if (!canCustomerRequestReturn(order)) {
      throw new OrderError({
        message: 'This order is not eligible for a return request.',
        statusCode: 409,
        code: 'ORDER_RETURN_NOT_ALLOWED',
      });
    }

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      throw new OrderError({
        message: 'Return reason is required.',
        statusCode: 400,
        code: 'ORDER_RETURN_REASON_REQUIRED',
      });
    }

    const normalizedAttachments = normalizeReturnAttachments(attachments).slice(0, 5);
    const normalizedDescription = String(description || '').trim();
    const requestedAt = this.nowFactory();

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.create({
        data: {
          id: this.idGenerator(),
          orderId: order.id,
          customerId: order.customerId,
          requestType: RETURN_REQUEST_TYPE.PRODUCT_RETURN,
          reason: normalizedReason,
          description: normalizedDescription,
          status: RETURN_REQUEST_STATUS.REQUESTED,
          refundStatus: RETURN_REFUND_STATUS.REQUESTED,
          attachments: normalizedAttachments,
          refundAmount: Number(order.grandTotal || 0),
          requestedAt,
          refundRequestedAt: requestedAt,
        },
      });

      await tx.orderTimeline.createMany({
        data: [
          buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: 'RETURN_REQUESTED',
            updatedBy: order.customerName || order.customerEmail || ORDER_TIMELINE_SYSTEM_USER,
            notes: buildReturnTimelineNotes({ reason: normalizedReason, description: normalizedDescription, refundStatus: RETURN_REFUND_STATUS.REQUESTED }),
            createdAt: requestedAt,
          }),
          buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: 'REFUND_REQUESTED',
            updatedBy: order.customerName || order.customerEmail || ORDER_TIMELINE_SYSTEM_USER,
            notes: buildReturnTimelineNotes({
              reason: normalizedReason,
              description: normalizedDescription,
              refundStatus: RETURN_REFUND_STATUS.REQUESTED,
              refundAmount: Number(order.grandTotal || 0),
            }),
            createdAt: new Date(requestedAt.getTime() + 1),
          }),
        ],
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    await this.notificationService.dispatch({
      type: NOTIFICATION_EVENT_TYPE.REFUND_REQUESTED,
      payload: {
        orderNumber: updatedOrder.orderNumber,
        publicOrderNumber: updatedOrder.publicOrderNumber,
        customerName: updatedOrder.customerName,
      },
      prismaClient: this.prisma,
    });

    return this.buildOrderResponse(updatedOrder);
  }

  async sendRefundToGateway({ returnRequestId, updatedBy = '' }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
          include: {
            paymentAttempt: true,
          },
        },
      },
    });

    if (!returnRequest || !returnRequest.order) {
      throw new OrderError({
        message: 'Return request was not found.',
        statusCode: 404,
        code: 'RETURN_REQUEST_NOT_FOUND',
      });
    }

    const normalizedUpdatedBy = String(updatedBy || '').trim() || 'HQ Admin';
    const paymentAttemptId = returnRequest.order.paymentAttemptId || returnRequest.order.paymentAttempt?.id || '';
    if (!paymentAttemptId) {
      throw new OrderError({
        message: 'Order payment attempt was not found for refund processing.',
        statusCode: 404,
        code: 'ORDER_REFUND_PAYMENT_ATTEMPT_NOT_FOUND',
      });
    }

    const refundAmount = Number(returnRequest.refundAmount || returnRequest.order.grandTotal || 0);
    const attemptAt = this.nowFactory();

    try {
      const refundResult = await this.paymentAttemptService.requestRefund({
        paymentAttemptId,
        amount: refundAmount,
        reason: returnRequest.reason || 'Customer refund approved by HQ.',
      });

      const processingOrder = await this.prisma.$transaction(async (tx) => {
        await tx.returnRequest.update({
          where: { id: returnRequest.id },
          data: {
            refundStatus: RETURN_REFUND_STATUS.PROCESSING,
            refundProcessingAt: attemptAt,
            lastRefundAttemptAt: attemptAt,
            refundReference: refundResult.refundReference || returnRequest.refundReference || '',
            refundProvider: 'MIDTRANS',
            refundProviderId: refundResult.refundProviderId || '',
            refundAmount: Number(refundResult.amount || refundAmount || 0),
            refundFailureReason: '',
            refundMetadata: refundResult.providerPayload || null,
          },
        });

        await tx.orderTimeline.create({
          data: buildTimelineEntry({
            id: this.idGenerator(),
            orderId: returnRequest.orderId,
            eventName: 'REFUND_PROCESSING',
            updatedBy: normalizedUpdatedBy,
            notes: buildReturnTimelineNotes({
              refundStatus: RETURN_REFUND_STATUS.PROCESSING,
              refundAmount: Number(refundResult.amount || refundAmount || 0),
              refundReference: refundResult.refundReference || '',
              refundProviderId: refundResult.refundProviderId || '',
            }),
            createdAt: attemptAt,
          }),
        });

        return tx.order.findUnique({
          where: { id: returnRequest.orderId },
          include: ORDER_DETAIL_INCLUDE,
        });
      });

      await writeOrderAuditLog(this.prisma, {
        user: null,
        module: 'SALES',
        action: 'REFUND_SENT_TO_MIDTRANS',
        description: `Refund request ${returnRequest.id} was sent to Midtrans.`,
        metadata: {
          returnRequestId: returnRequest.id,
          orderId: returnRequest.orderId,
          refundReference: refundResult.refundReference || '',
        },
      });

      return this.buildOrderResponse(processingOrder);
    } catch (error) {
      const failureReason = error?.providerMessage || error?.message || 'Refund request could not be sent to Midtrans.';
      const failedAt = this.nowFactory();

      const failedOrder = await this.prisma.$transaction(async (tx) => {
        await tx.returnRequest.update({
          where: { id: returnRequest.id },
          data: {
            refundStatus: RETURN_REFUND_STATUS.FAILED,
            lastRefundAttemptAt: failedAt,
            refundFailureReason: failureReason,
            refundMetadata: error?.responseBody ? { responseBody: error.responseBody } : returnRequest.refundMetadata || null,
          },
        });

        await tx.orderTimeline.create({
          data: buildTimelineEntry({
            id: this.idGenerator(),
            orderId: returnRequest.orderId,
            eventName: 'REFUND_FAILED',
            updatedBy: normalizedUpdatedBy,
            notes: buildReturnTimelineNotes({
              refundStatus: RETURN_REFUND_STATUS.FAILED,
              refundReference: returnRequest.refundReference || '',
              refundProviderId: returnRequest.refundProviderId || '',
              failureReason,
            }),
            createdAt: failedAt,
          }),
        });

        return tx.order.findUnique({
          where: { id: returnRequest.orderId },
          include: ORDER_DETAIL_INCLUDE,
        });
      });

      await writeOrderAuditLog(this.prisma, {
        user: null,
        module: 'SALES',
        action: 'REFUND_FAILED',
        description: `Refund request ${returnRequest.id} failed to send to Midtrans.`,
        metadata: {
          returnRequestId: returnRequest.id,
          orderId: returnRequest.orderId,
          failureReason,
        },
      });

      return this.buildOrderResponse(failedOrder);
    }
  }

  async approveReturnRequest({ returnRequestId, updatedBy = '' }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!returnRequest) {
      throw new OrderError({
        message: 'Return request was not found.',
        statusCode: 404,
        code: 'RETURN_REQUEST_NOT_FOUND',
      });
    }

    if (returnRequest.status !== RETURN_REQUEST_STATUS.REQUESTED) {
      throw new OrderError({
        message: 'Only requested refund requests can be approved.',
        statusCode: 409,
        code: 'RETURN_REQUEST_APPROVAL_NOT_ALLOWED',
      });
    }

    const normalizedUpdatedBy = String(updatedBy || '').trim() || 'HQ Admin';
    const approvedAt = this.nowFactory();

    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: {
          status: RETURN_REQUEST_STATUS.APPROVED,
          refundStatus: RETURN_REFUND_STATUS.APPROVED,
          approvedAt,
          refundApprovedAt: approvedAt,
          rejectReason: '',
          refundFailureReason: '',
        },
      });

      await tx.orderTimeline.create({
        data: buildTimelineEntry({
          id: this.idGenerator(),
          orderId: returnRequest.orderId,
          eventName: 'REFUND_APPROVED',
          updatedBy: normalizedUpdatedBy,
          notes: buildReturnTimelineNotes({ refundStatus: RETURN_REFUND_STATUS.APPROVED, refundAmount: returnRequest.refundAmount || 0 }),
          createdAt: approvedAt,
        }),
      });
    });

    return this.sendRefundToGateway({ returnRequestId, updatedBy: normalizedUpdatedBy });
  }

  async retryRefundRequest({ returnRequestId, updatedBy = '' }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!returnRequest) {
      throw new OrderError({
        message: 'Return request was not found.',
        statusCode: 404,
        code: 'RETURN_REQUEST_NOT_FOUND',
      });
    }

    const normalizedRefundStatus = normalizeRefundStatusValue(returnRequest.refundStatus || RETURN_REFUND_STATUS.NONE);
    if (![RETURN_REFUND_STATUS.APPROVED, RETURN_REFUND_STATUS.FAILED].includes(normalizedRefundStatus)) {
      throw new OrderError({
        message: 'Refund retry is only available for approved or failed refund requests.',
        statusCode: 409,
        code: 'RETURN_REQUEST_REFUND_RETRY_NOT_ALLOWED',
      });
    }

    return this.sendRefundToGateway({ returnRequestId, updatedBy });
  }

  async rejectReturnRequest({ returnRequestId, rejectReason = '', updatedBy = '' }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!returnRequest) {
      throw new OrderError({
        message: 'Return request was not found.',
        statusCode: 404,
        code: 'RETURN_REQUEST_NOT_FOUND',
      });
    }

    const currentRefundStatus = normalizeRefundStatusValue(returnRequest.refundStatus || RETURN_REFUND_STATUS.NONE);
    if (![RETURN_REFUND_STATUS.REQUESTED, RETURN_REFUND_STATUS.APPROVED, RETURN_REFUND_STATUS.FAILED].includes(currentRefundStatus)) {
      throw new OrderError({
        message: 'Only requested, approved, or failed refund requests can be rejected.',
        statusCode: 409,
        code: 'RETURN_REQUEST_REJECTION_NOT_ALLOWED',
      });
    }

    const normalizedRejectReason = String(rejectReason || '').trim();
    if (!normalizedRejectReason) {
      throw new OrderError({
        message: 'Reject reason is required.',
        statusCode: 400,
        code: 'RETURN_REQUEST_REJECT_REASON_REQUIRED',
      });
    }

    const rejectedAt = this.nowFactory();
    const normalizedUpdatedBy = String(updatedBy || '').trim() || 'HQ Admin';

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const nextOrderData = {};
      const timelineEntries = [
        buildTimelineEntry({
          id: this.idGenerator(),
          orderId: returnRequest.orderId,
          eventName: 'REFUND_REJECTED',
          updatedBy: normalizedUpdatedBy,
          notes: buildReturnTimelineNotes({ rejectReason: normalizedRejectReason, refundStatus: RETURN_REFUND_STATUS.REJECTED }),
          createdAt: rejectedAt,
        }),
      ];

      if (returnRequest.requestType === RETURN_REQUEST_TYPE.ORDER_CANCELLATION && returnRequest.previousOrderStatus) {
        const restoredOrderStatus = normalizeOrderStatusValue(returnRequest.previousOrderStatus);
        const restoredFulfillmentStatus = returnRequest.previousFulfillmentStatus
          ? normalizeFulfillmentStatusValue(returnRequest.previousFulfillmentStatus)
          : getSynchronizedFulfillmentStatus({ orderStatus: restoredOrderStatus, fulfillmentStatus: '' });

        nextOrderData.status = restoredOrderStatus;
        nextOrderData.fulfillmentStatus = restoredFulfillmentStatus;

        timelineEntries.push(buildTimelineEntry({
          id: this.idGenerator(),
          orderId: returnRequest.orderId,
          eventName: 'ORDER_RESTORED',
          updatedBy: normalizedUpdatedBy,
          notes: `Order restored to ${restoredOrderStatus} with fulfillment ${restoredFulfillmentStatus}.`,
          createdAt: new Date(rejectedAt.getTime() + 1),
        }));
      }

      if (Object.keys(nextOrderData).length > 0) {
        await tx.order.update({
          where: { id: returnRequest.orderId },
          data: nextOrderData,
        });
      }

      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: {
          status: RETURN_REQUEST_STATUS.REJECTED,
          refundStatus: RETURN_REFUND_STATUS.REJECTED,
          rejectReason: normalizedRejectReason,
          refundFailureReason: '',
          rejectedAt,
        },
      });

      await tx.orderTimeline.createMany({ data: timelineEntries });

      return tx.order.findUnique({
        where: { id: returnRequest.orderId },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    await writeOrderAuditLog(this.prisma, {
      user: null,
      module: 'SALES',
      action: 'ORDER_RESTORED',
      description: `Order ${updatedOrder.orderNumber} was restored after refund rejection.`,
      metadata: {
        returnRequestId,
        orderId: updatedOrder.id,
        restoredOrderStatus: updatedOrder.status,
        restoredFulfillmentStatus: updatedOrder.fulfillmentStatus,
      },
    });

    return this.buildOrderResponse(updatedOrder);
  }

  async updateReturnRefundStatus() {
    throw new OrderError({
      message: 'Refund status is synchronized automatically from HQ approval and Midtrans webhook events.',
      statusCode: 405,
      code: 'RETURN_REQUEST_REFUND_STATUS_MANUAL_UPDATE_DISABLED',
    });
  }

  async listRefundRequests({ page = 1, limit = 10, search = '', refundStatus = '' } = {}) {
    const normalizedPage = normalizePositiveInteger(page, 1, 1000);
    const normalizedLimit = normalizePositiveInteger(limit, 10, 100);
    const normalizedSearch = String(search || '').trim();
    const normalizedRefundStatus = normalizeRefundStatusValue(refundStatus);

    const where = {
      ...(normalizedRefundStatus && normalizedRefundStatus !== 'ALL' ? { refundStatus: normalizedRefundStatus } : {}),
      ...(normalizedSearch ? {
        OR: [
          { reason: { contains: normalizedSearch, mode: 'insensitive' } },
          { order: { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } } },
          { order: { publicOrderNumber: { contains: normalizedSearch, mode: 'insensitive' } } },
          { order: { customerName: { contains: normalizedSearch, mode: 'insensitive' } } },
          { order: { customerEmail: { contains: normalizedSearch, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    const [totalItems, requests] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        include: {
          order: {
            include: {
              paymentAttempt: true,
            },
          },
          customer: true,
        },
        orderBy: [{ requestedAt: 'desc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
    ]);

    return {
      data: requests.map((request) => ({
        id: request.id,
        orderId: request.orderId,
        orderNumber: request.order?.orderNumber || '',
        publicOrderNumber: request.order?.publicOrderNumber || '',
        customerName: request.order?.customerName || request.customer?.customerName || '',
        customerEmail: request.order?.customerEmail || request.customer?.email || '',
        orderTotal: Number(request.order?.grandTotal || request.refundAmount || 0),
        paymentMethod: request.order?.paymentAttempt?.paymentType || request.order?.paymentAttempt?.provider || '',
        cancelledDate: request.order?.updatedAt || request.requestedAt,
        refundStatus: normalizeRefundStatusValue(request.refundStatus || RETURN_REFUND_STATUS.NONE),
        reason: request.reason,
        requestType: request.requestType || RETURN_REQUEST_TYPE.PRODUCT_RETURN,
      })),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / normalizedLimit)),
        hasNextPage: normalizedPage * normalizedLimit < totalItems,
        hasPreviousPage: normalizedPage > 1,
      },
    };
  }

  async getRefundRequestById(returnRequestId) {
    const request = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
          include: ORDER_DETAIL_INCLUDE,
        },
        customer: true,
      },
    });

    if (!request) {
      throw new OrderError({
        message: 'Return request was not found.',
        statusCode: 404,
        code: 'RETURN_REQUEST_NOT_FOUND',
      });
    }

    return {
      id: request.id,
      requestType: request.requestType || RETURN_REQUEST_TYPE.PRODUCT_RETURN,
      reason: request.reason,
      description: request.description,
      refundStatus: normalizeRefundStatusValue(request.refundStatus || RETURN_REFUND_STATUS.NONE),
      status: request.status,
      rejectReason: request.rejectReason,
      refundAmount: Number(request.refundAmount || request.order?.grandTotal || 0),
      refundReference: request.refundReference || '',
      refundProvider: request.refundProvider || '',
      refundProviderId: request.refundProviderId || '',
      refundFailureReason: request.refundFailureReason || '',
      refundMetadata: request.refundMetadata || null,
      previousOrderStatus: request.previousOrderStatus || '',
      previousFulfillmentStatus: request.previousFulfillmentStatus || '',
      refundRequestedAt: request.refundRequestedAt || request.requestedAt || null,
      refundApprovedAt: request.refundApprovedAt || request.approvedAt || null,
      refundProcessingAt: request.refundProcessingAt || null,
      refundCompletedAt: request.refundCompletedAt || request.completedAt || null,
      lastRefundAttemptAt: request.lastRefundAttemptAt || null,
      rejectedAt: request.rejectedAt || null,
      timeline: buildRefundTimeline(request),
      order: request.order ? this.buildOrderResponse(request.order) : null,
    };
  }

  async completeRefundForPaymentAttempt({ paymentAttemptId, notification = null } = {}) {
    const order = await this.prisma.order.findFirst({
      where: { paymentAttemptId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order || !order.returnRequest) {
      return order ? this.buildOrderResponse(order) : null;
    }

    if (normalizeRefundStatusValue(order.returnRequest.refundStatus) === RETURN_REFUND_STATUS.COMPLETED) {
      return this.buildOrderResponse(order);
    }

    const completedAt = notification?.refundDate || this.nowFactory();
    const refundAmount = Number(notification?.refundAmount || order.returnRequest.refundAmount || order.grandTotal || 0);
    const refundReference = String(notification?.refundKey || order.returnRequest.refundReference || '').trim();
    const refundProviderId = String(notification?.refundTransactionId || order.returnRequest.refundProviderId || '').trim();

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: order.returnRequest.id },
        data: {
          refundStatus: RETURN_REFUND_STATUS.COMPLETED,
          refundProvider: 'MIDTRANS',
          refundAmount,
          refundReference,
          refundProviderId,
          refundFailureReason: '',
          refundMetadata: notification?.providerPayload || order.returnRequest.refundMetadata || null,
          refundCompletedAt: completedAt,
          completedAt,
        },
      });

      await tx.orderTimeline.create({
        data: buildTimelineEntry({
          id: this.idGenerator(),
          orderId: order.id,
          eventName: 'REFUND_COMPLETED',
          updatedBy: ORDER_TIMELINE_SYSTEM_USER,
          notes: buildReturnTimelineNotes({
            refundStatus: RETURN_REFUND_STATUS.COMPLETED,
            refundAmount,
            refundReference,
            refundProviderId,
          }),
          createdAt: completedAt,
        }),
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    await writeOrderAuditLog(this.prisma, {
      user: null,
      module: 'SALES',
      action: 'REFUND_COMPLETED',
      description: `Refund completed for order ${updatedOrder.orderNumber}.`,
      metadata: {
        orderId: updatedOrder.id,
        returnRequestId: order.returnRequest.id,
        refundReference,
        refundProviderId,
      },
    });

    return this.buildOrderResponse(updatedOrder);
  }

  async getReturnSummary() {
    const [refundRequested, refundProcessing, refundCompleted, refundRejected, refundFailed, cancelledOrders] = await Promise.all([
      this.prisma.returnRequest.count({ where: { refundStatus: RETURN_REFUND_STATUS.REQUESTED } }),
      this.prisma.returnRequest.count({ where: { refundStatus: RETURN_REFUND_STATUS.PROCESSING } }),
      this.prisma.returnRequest.count({ where: { refundStatus: RETURN_REFUND_STATUS.COMPLETED } }),
      this.prisma.returnRequest.count({ where: { refundStatus: RETURN_REFUND_STATUS.REJECTED } }),
      this.prisma.returnRequest.count({ where: { refundStatus: RETURN_REFUND_STATUS.FAILED } }),
      this.prisma.order.count({ where: { status: ORDER_STATUS.CANCELLED } }),
    ]);

    return {
      refundRequested,
      refundProcessing,
      refundCompleted,
      refundRejected,
      refundFailed,
      cancelledOrders,
    };
  }

  async updateFulfillmentStatus({
    orderId,
    fulfillmentStatus,
    updatedBy = '',
    notes = '',
    shipmentCourier = '',
    shipmentService = '',
    trackingNumber = '',
    shippingDate = null,
  }) {
    const startedAt = Date.now();
    let orderNumber = '';
    let previousStatus = '';
    let nextStatus = '';

    try {
      if (!orderId) {
        throw new OrderError({
          message: 'orderId is required.',
          statusCode: 400,
          code: 'ORDER_ID_REQUIRED',
        });
      }

      if (!fulfillmentStatus) {
        throw new OrderError({
          message: 'fulfillmentStatus is required.',
          statusCode: 400,
          code: 'ORDER_FULFILLMENT_STATUS_REQUIRED',
        });
      }

      const normalizedStatus = normalizeFulfillmentStatusValue(fulfillmentStatus);
      if (!Object.values(FULFILLMENT_STATUS).includes(normalizedStatus)) {
        throw new OrderError({
          message: 'Fulfillment status is invalid.',
          statusCode: 400,
          code: 'ORDER_FULFILLMENT_STATUS_INVALID',
        });
      }

      const order = await this.getOrderRecord(orderId);
      orderNumber = order.orderNumber;
      previousStatus = getSynchronizedFulfillmentStatus({
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
      });
      nextStatus = normalizedStatus;

      if (normalizeOrderStatusValue(order.status) === ORDER_STATUS.CANCELLED) {
        throw new OrderError({
          message: 'Cancelled orders cannot be updated in fulfillment.',
          statusCode: 409,
          code: 'ORDER_FULFILLMENT_CANCELLED_LOCKED',
        });
      }

      if (!isFulfillmentTransitionAllowed(previousStatus, nextStatus)) {
        throw new OrderError({
          message: 'Fulfillment status transition is invalid.',
          statusCode: 409,
          code: 'ORDER_FULFILLMENT_TRANSITION_INVALID',
        });
      }

      const previousBusinessStatus = getSynchronizedOrderStatus({
        orderStatus: order.status,
        fulfillmentStatus: previousStatus,
      });
      const nextBusinessStatus = getOrderStatusForFulfillment(nextStatus);
      const normalizedUpdatedBy = String(updatedBy || '').trim() || 'HQ Admin';
      const normalizedNotes = String(notes || '').trim();
      const normalizedShipmentCourier = String(shipmentCourier || '').trim();
      const normalizedShipmentService = String(shipmentService || '').trim();
      const normalizedTrackingNumber = String(trackingNumber || '').trim();
      const parsedShippingDate = shippingDate ? new Date(shippingDate) : null;
      const normalizedShippingDate = parsedShippingDate && !Number.isNaN(parsedShippingDate.getTime()) ? parsedShippingDate : null;
      const currentShipmentLocked = previousStatus === FULFILLMENT_STATUS.SHIPPED || previousStatus === FULFILLMENT_STATUS.DELIVERED;

      if (currentShipmentLocked && hasShipmentFieldMutation(order, {
        shipmentCourier: normalizedShipmentCourier || order.shipmentCourier || '',
        shipmentService: normalizedShipmentService || order.shipmentService || '',
        trackingNumber: normalizedTrackingNumber || order.trackingNumber || '',
        shippingDate: normalizedShippingDate || order.shippingDate || null,
      })) {
        throw new OrderError({
          message: 'Shipment information is locked after dispatch.',
          statusCode: 409,
          code: 'ORDER_SHIPMENT_LOCKED',
        });
      }

      const resolvedShippingDate = nextStatus === FULFILLMENT_STATUS.SHIPPED
        ? (normalizedShippingDate || order.shippingDate || this.nowFactory())
        : (normalizedShippingDate || order.shippingDate || null);

      if (nextStatus === FULFILLMENT_STATUS.SHIPPED) {
        if (!normalizedTrackingNumber || !normalizedShipmentCourier || !normalizedShipmentService) {
          throw new OrderError({
            message: 'Tracking Number, Shipment Courier, and Shipment Service are required when marking an order as shipped.',
            statusCode: 400,
            code: 'ORDER_SHIPMENT_INFORMATION_REQUIRED',
          });
        }
      }

      const shipmentUpdates = {};
      if (isShipmentInformationStage(nextStatus) || isShipmentInformationStage(previousStatus)) {
        shipmentUpdates.shipmentCourier = normalizedShipmentCourier || order.shipmentCourier || order.courier || '';
        shipmentUpdates.shipmentService = normalizedShipmentService || order.shipmentService || order.courierService || '';
        shipmentUpdates.trackingNumber = normalizedTrackingNumber || order.trackingNumber || '';
        shipmentUpdates.shippingDate = resolvedShippingDate;
      }

      const timelineEntries = [];
      if (previousStatus !== nextStatus) {
        const timelineBaseTimestamp = this.nowFactory();

        const timelineEventName = getFulfillmentTimelineEventName(nextStatus);
        const timelineNotes = nextStatus === FULFILLMENT_STATUS.SHIPPED
          ? buildShipmentDispatchedTimelineNotes({
              shipmentCourier: shipmentUpdates.shipmentCourier,
              shipmentService: shipmentUpdates.shipmentService,
              trackingNumber: shipmentUpdates.trackingNumber,
              shippingDate: shipmentUpdates.shippingDate,
              notes: normalizedNotes,
            })
          : nextStatus === FULFILLMENT_STATUS.DELIVERED
            ? buildDeliveredTimelineNotes({ notes: normalizedNotes })
            : normalizedNotes;

        timelineEntries.push(buildTimelineEntry({
          id: this.idGenerator(),
          orderId: order.id,
          eventName: timelineEventName,
          updatedBy: normalizedUpdatedBy,
          notes: timelineNotes,
          createdAt: timelineBaseTimestamp,
        }));

        if (previousBusinessStatus !== nextBusinessStatus) {
          timelineEntries.push(buildTimelineEntry({
            id: this.idGenerator(),
            orderId: order.id,
            eventName: getOrderStatusTimelineEventName(nextBusinessStatus),
            updatedBy: normalizedUpdatedBy,
            notes: buildOrderStatusSynchronizationNotes({
              previousStatus: previousBusinessStatus,
              newStatus: nextBusinessStatus,
              fulfillmentStatus: nextStatus,
            }),
            createdAt: new Date(timelineBaseTimestamp.getTime() + 1),
          }));
        }
      }

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        const savedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: nextBusinessStatus,
            fulfillmentStatus: nextStatus,
            ...shipmentUpdates,
          },
          include: ORDER_DETAIL_INCLUDE,
        });

        if (timelineEntries.length > 0) {
          await tx.orderTimeline.createMany({
            data: timelineEntries,
          });

          return tx.order.findUnique({
            where: { id: order.id },
            include: ORDER_DETAIL_INCLUDE,
          });
        }

        return savedOrder;
      });

      if (nextStatus === FULFILLMENT_STATUS.DELIVERED) {
        await this.notificationService.dispatch({
          type: NOTIFICATION_EVENT_TYPE.ORDER_DELIVERED,
          payload: {
            orderNumber: updatedOrder.orderNumber,
            publicOrderNumber: updatedOrder.publicOrderNumber,
          },
          prismaClient: this.prisma,
        });
      }

      if (nextStatus === FULFILLMENT_STATUS.SHIPPED || nextStatus === FULFILLMENT_STATUS.DELIVERED) {
        try {
          await this.sendOrderStatusUpdateEmailIfNeeded(updatedOrder, nextStatus);
        } catch (error) {
          logOrderEmailEvent({
            eventName: 'ORDER_CONFIRMATION_EMAIL_FAILED',
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            publicOrderNumber: updatedOrder.publicOrderNumber,
            customerEmail: updatedOrder.customerEmail,
            customerName: updatedOrder.customerName,
            reason: error instanceof Error ? error.message : 'Unknown shipment email delivery error.',
            status: ORDER_CONFIRMATION_EMAIL_FAILED,
          });
        }
      }

      logFulfillmentUpdate({
        orderNumber,
        previousStatus: getFulfillmentStatusLabel(previousStatus),
        newStatus: getFulfillmentStatusLabel(nextStatus),
        updatedBy: normalizedUpdatedBy,
        validationResult: previousStatus === nextStatus ? 'UPDATED' : 'TRANSITIONED',
        durationMs: Date.now() - startedAt,
      });

      return this.buildOrderResponse(updatedOrder);
    } catch (error) {
      logFulfillmentUpdate({
        orderNumber,
        previousStatus: getFulfillmentStatusLabel(previousStatus),
        newStatus: getFulfillmentStatusLabel(nextStatus),
        updatedBy: String(updatedBy || '').trim(),
        validationResult: 'FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

export const orderService = new OrderService();
