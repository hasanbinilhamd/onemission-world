import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { domainEventPublisher } from '@/lib/domain-events/publisher';
import { paymentAttemptService } from '@/lib/payment-attempt';
import {
  FULFILLMENT_STATUS,
  ORDER_STATUS,
  getFulfillmentStatusLabel,
  getFulfillmentStatusQueryValues,
  getFulfillmentTimelineEventName,
  getOrderStatusForFulfillment,
  getOrderStatusTimelineEventName,
  getSynchronizedOrderStatus,
  isFulfillmentTransitionAllowed,
  isShipmentInformationStage,
  normalizeFulfillmentStatusValue,
} from './lifecycle';
import { OrderError } from './errors';
import { OrderInventoryService, ORDER_INVENTORY_RESERVATION_RESULT } from './inventory-service';

const ORDER_TIMELINE_SYSTEM_USER = 'System';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  paymentAttempt: true,
  timelines: {
    orderBy: { createdAt: 'asc' },
  },
};

function logOrderCreation({ orderNumber = '', checkoutNumber = '', paymentAttemptNumber = '', durationMs, validationResult }) {
  const payload = {
    orderNumber,
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

function buildShipmentAddress(order) {
  return [
    order.streetAddress,
    order.districtName,
    order.cityName,
    order.provinceName,
    order.postalCode,
  ].filter(Boolean).join(', ');
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

export class OrderService {
  constructor({
    prismaClient = prisma,
    paymentAttempt = paymentAttemptService,
    eventPublisher = domainEventPublisher,
    inventoryReservationService = null,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.paymentAttemptService = paymentAttempt;
    this.eventPublisher = eventPublisher;
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
    const prefix = `ORD-${year}${month}-`;

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

  buildOrderResponse(order) {
    const normalizedFulfillmentStatus = normalizeFulfillmentStatusValue(order.fulfillmentStatus) || FULFILLMENT_STATUS.PENDING;
    const synchronizedStatus = getSynchronizedOrderStatus({
      orderStatus: order.status,
      fulfillmentStatus: normalizedFulfillmentStatus,
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
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
        paymentMethod: order.paymentAttempt.paymentType,
        issuer: order.paymentAttempt.issuer,
        acquirer: order.paymentAttempt.acquirer,
        transactionTime: order.paymentAttempt.transactionTime,
        settlementTime: order.paymentAttempt.settlementTime,
        grossAmount: order.paymentAttempt.grossAmount,
        currency: order.paymentAttempt.currency,
        status: order.paymentAttempt.status,
      } : null,
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
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  buildOrderListItem(order) {
    const normalizedFulfillmentStatus = normalizeFulfillmentStatusValue(order.fulfillmentStatus) || FULFILLMENT_STATUS.PENDING;
    const synchronizedStatus = getSynchronizedOrderStatus({
      orderStatus: order.status,
      fulfillmentStatus: normalizedFulfillmentStatus,
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customerName: order.customerName,
      totalAmount: order.grandTotal,
      paymentStatus: order.paymentAttempt?.status || 'UNKNOWN',
      status: synchronizedStatus,
      fulfillmentStatus: normalizedFulfillmentStatus,
      fulfillmentStatusLabel: getFulfillmentStatusLabel(normalizedFulfillmentStatus),
      courier: order.shipmentCourier || order.courier || '',
      totalItems: order._count?.items || order.items?.length || 0,
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
    const normalizedCourier = String(courier || '').trim();
    const startBoundary = normalizeDateRangeBoundary(startDate, 'start');
    const endBoundary = normalizeDateRangeBoundary(endDate, 'end');

    let where = {};

    if (normalizedSearch) {
      where = mergeWhereCondition(where, {
        OR: [
          { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } },
          { customerName: { contains: normalizedSearch, mode: 'insensitive' } },
          { customerEmail: { contains: normalizedSearch, mode: 'insensitive' } },
          { trackingNumber: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      });
    }

    if (normalizedPaymentStatus) {
      where = mergeWhereCondition(where, {
        paymentAttempt: {
          status: normalizedPaymentStatus,
        },
      });
    }

    if (normalizedFulfillmentStatus) {
      where = mergeWhereCondition(where, buildFulfillmentStatusWhere(normalizedFulfillmentStatus));
    }

    if (startBoundary || endBoundary) {
      where = mergeWhereCondition(where, {
        createdAt: {
          ...(startBoundary ? { gte: startBoundary } : {}),
          ...(endBoundary ? { lte: endBoundary } : {}),
        },
      });
    }

    if (normalizedCourier) {
      where = mergeWhereCondition(where, {
        OR: [
          { shipmentCourier: { contains: normalizedCourier, mode: 'insensitive' } },
          { courier: { contains: normalizedCourier, mode: 'insensitive' } },
        ],
      });
    }

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
        },
        orderBy: {
          [normalizedSortField]: normalizedSortOrder,
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
        sortBy: normalizedSortField,
        sortOrder: normalizedSortOrder,
      },
      filters: {
        search: normalizedSearch,
        paymentStatus: normalizedPaymentStatus,
        fulfillmentStatus: normalizedFulfillmentStatus,
        startDate: startDate || '',
        endDate: endDate || '',
        courier: normalizedCourier,
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
    const normalizedOrderNumber = normalizeOrderNumberValue(orderNumber);
    if (!normalizedOrderNumber) {
      throw new OrderError({
        message: 'orderNumber is required.',
        statusCode: 400,
        code: 'ORDER_NUMBER_REQUIRED',
      });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: {
          equals: normalizedOrderNumber,
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

  async trackOrder({ email = '', orderNumber = '' } = {}) {
    const normalizedEmail = normalizeCustomerEmailValue(email);
    if (!normalizedEmail) {
      throw new OrderError({
        message: 'email is required.',
        statusCode: 400,
        code: 'ORDER_CUSTOMER_EMAIL_REQUIRED',
      });
    }

    const normalizedOrderNumber = normalizeOrderNumberValue(orderNumber);
    if (!normalizedOrderNumber) {
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
        orderNumber: {
          equals: normalizedOrderNumber,
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

  async createOrderRecord({ paymentAttempt, checkoutSession }) {
    const startedAt = Date.now();
    const orderNumber = await this.generateOrderNumber();
    const createdAt = this.nowFactory();

    try {
      const order = await this.prisma.order.create({
        data: {
          id: this.idGenerator(),
          orderNumber,
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

  async createFromCheckoutSession({ paymentAttemptId }) {
    const startedAt = Date.now();
    let orderId = '';
    let orderNumber = '';
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

      orderId = existingOrder.id;
      orderNumber = existingOrder.orderNumber;

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
        checkoutNumber,
        paymentAttemptNumber,
        durationMs: Date.now() - startedAt,
        validationResult: 'FAILED',
      });
      throw error;
    }
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
      previousStatus = normalizeFulfillmentStatusValue(order.fulfillmentStatus) || FULFILLMENT_STATUS.PENDING;
      nextStatus = normalizedStatus;

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

      if (nextStatus === FULFILLMENT_STATUS.SHIPPED) {
        if (!normalizedTrackingNumber || !normalizedShipmentCourier || !normalizedShipmentService || !normalizedShippingDate) {
          throw new OrderError({
            message: 'Tracking Number, Shipment Courier, Shipment Service, and Shipping Date are required when marking an order as shipped.',
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
        shipmentUpdates.shippingDate = normalizedShippingDate || order.shippingDate || null;
      }

      const timelineEntries = [];
      if (previousStatus !== nextStatus) {
        const timelineBaseTimestamp = this.nowFactory();

        timelineEntries.push(buildTimelineEntry({
          id: this.idGenerator(),
          orderId: order.id,
          eventName: getFulfillmentTimelineEventName(nextStatus),
          updatedBy: normalizedUpdatedBy,
          notes: normalizedNotes,
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
