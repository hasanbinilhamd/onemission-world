export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  READY_FOR_FULFILLMENT: 'READY_FOR_FULFILLMENT',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURN_APPROVED: 'RETURN_APPROVED',
  RETURN_REJECTED: 'RETURN_REJECTED',
  REFUND_PROCESSING: 'REFUND_PROCESSING',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  RETURNED: 'RETURNED',
};

export const RETURN_REQUEST_STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const RETURN_REFUND_STATUS = {
  NONE: 'NONE',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
};

export const FULFILLMENT_STATUS = {
  PENDING: 'PENDING',
  PICKING: 'PICKING',
  PACKING: 'PACKING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
};

/*
|--------------------------------------------------------------------------
| Picking Phase
|--------------------------------------------------------------------------
|
| Picking is intentionally disabled for the current warehouse operation.
|
| Current fulfillment is handled by one operator, therefore the workflow
| begins directly with Packing.
|
| Future warehouse scaling can simply restore:
|
| Pending
| ↓
| Picking
| ↓
| Packing
|
| No database migration is required.
|
*/
export const FULFILLMENT_STATUS_OPTIONS = [
  { value: FULFILLMENT_STATUS.PENDING, label: 'Pending' },
  // TEMPORARILY DISABLED
  // Picking is bypassed because current warehouse operation
  // is handled by a single operator.
  // Re-enable this option once warehouse workflow requires
  // separate Picking and Packing phases.
  // { value: FULFILLMENT_STATUS.PICKING, label: 'Picking' },
  { value: FULFILLMENT_STATUS.PACKING, label: 'Packing' },
  { value: FULFILLMENT_STATUS.READY_TO_SHIP, label: 'Ready To Ship' },
  { value: FULFILLMENT_STATUS.SHIPPED, label: 'Shipped' },
  { value: FULFILLMENT_STATUS.DELIVERED, label: 'Delivered' },
];

const LEGACY_FULFILLMENT_STATUS_MAP = {
  READY_FOR_FULFILLMENT: FULFILLMENT_STATUS.PENDING,
  PROCESSING: FULFILLMENT_STATUS.PICKING,
  PACKED: FULFILLMENT_STATUS.READY_TO_SHIP,
  COMPLETED: FULFILLMENT_STATUS.DELIVERED,
};

export const FULFILLMENT_TO_ORDER_STATUS = {
  [FULFILLMENT_STATUS.PENDING]: ORDER_STATUS.READY_FOR_FULFILLMENT,
  [FULFILLMENT_STATUS.PICKING]: ORDER_STATUS.PROCESSING,
  [FULFILLMENT_STATUS.PACKING]: ORDER_STATUS.PROCESSING,
  [FULFILLMENT_STATUS.READY_TO_SHIP]: ORDER_STATUS.PROCESSING,
  [FULFILLMENT_STATUS.SHIPPED]: ORDER_STATUS.SHIPPED,
  [FULFILLMENT_STATUS.DELIVERED]: ORDER_STATUS.COMPLETED,
};

export const FULFILLMENT_STATUS_TRANSITIONS = {
  // TEMPORARILY DISABLED
  // Picking is bypassed because current warehouse operation
  // is handled by a single operator.
  // Re-enable this section once warehouse workflow requires
  // separate Picking and Packing phases.
  [FULFILLMENT_STATUS.PENDING]: [FULFILLMENT_STATUS.PENDING, FULFILLMENT_STATUS.PACKING],
  [FULFILLMENT_STATUS.PICKING]: [FULFILLMENT_STATUS.PICKING, FULFILLMENT_STATUS.PACKING],
  [FULFILLMENT_STATUS.PACKING]: [FULFILLMENT_STATUS.PACKING, FULFILLMENT_STATUS.READY_TO_SHIP],
  [FULFILLMENT_STATUS.READY_TO_SHIP]: [FULFILLMENT_STATUS.READY_TO_SHIP, FULFILLMENT_STATUS.SHIPPED],
  [FULFILLMENT_STATUS.SHIPPED]: [FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED],
  [FULFILLMENT_STATUS.DELIVERED]: [FULFILLMENT_STATUS.DELIVERED],
};

export const FULFILLMENT_TIMELINE_EVENTS = {
  [FULFILLMENT_STATUS.PENDING]: 'READY_FOR_FULFILLMENT',
  [FULFILLMENT_STATUS.PICKING]: 'PICKING_STARTED',
  [FULFILLMENT_STATUS.PACKING]: 'PACKING_STARTED',
  [FULFILLMENT_STATUS.READY_TO_SHIP]: 'READY_TO_SHIP',
  [FULFILLMENT_STATUS.SHIPPED]: 'ORDER_SHIPPED',
  [FULFILLMENT_STATUS.DELIVERED]: 'ORDER_DELIVERED',
};

export const ORDER_STATUS_TIMELINE_EVENTS = {
  [ORDER_STATUS.READY_FOR_FULFILLMENT]: 'ORDER_STATUS_READY_FOR_FULFILLMENT',
  [ORDER_STATUS.PROCESSING]: 'ORDER_STATUS_PROCESSING',
  [ORDER_STATUS.SHIPPED]: 'ORDER_STATUS_SHIPPED',
  [ORDER_STATUS.COMPLETED]: 'ORDER_STATUS_COMPLETED',
};

const TERMINAL_ORDER_STATUSES = new Set([
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.RETURN_REQUESTED,
  ORDER_STATUS.RETURN_APPROVED,
  ORDER_STATUS.RETURN_REJECTED,
  ORDER_STATUS.REFUND_PROCESSING,
  ORDER_STATUS.REFUND_COMPLETED,
  ORDER_STATUS.RETURNED,
]);

const PRE_FULFILLMENT_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.PAID,
]);

export function normalizeOrderStatusValue(value) {
  return String(value || '').trim().toUpperCase();
}

export function normalizeFulfillmentStatusValue(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return LEGACY_FULFILLMENT_STATUS_MAP[normalized] || normalized;
}

export function getFulfillmentStatusLabel(status) {
  const normalized = normalizeFulfillmentStatusValue(status);
  return normalized || FULFILLMENT_STATUS.PENDING;
}

export function getOrderStatusForFulfillment(status) {
  const normalized = normalizeFulfillmentStatusValue(status);
  return FULFILLMENT_TO_ORDER_STATUS[normalized] || ORDER_STATUS.READY_FOR_FULFILLMENT;
}

export function getSynchronizedOrderStatus({ orderStatus = '', fulfillmentStatus = '' } = {}) {
  const normalizedOrderStatus = normalizeOrderStatusValue(orderStatus);

  if (TERMINAL_ORDER_STATUSES.has(normalizedOrderStatus) || PRE_FULFILLMENT_ORDER_STATUSES.has(normalizedOrderStatus)) {
    return normalizedOrderStatus;
  }

  return getOrderStatusForFulfillment(fulfillmentStatus);
}

export function isFulfillmentTransitionAllowed(currentStatus, nextStatus) {
  const normalizedCurrentStatus = normalizeFulfillmentStatusValue(currentStatus) || FULFILLMENT_STATUS.PENDING;
  const normalizedNextStatus = normalizeFulfillmentStatusValue(nextStatus);
  const allowedStatuses = FULFILLMENT_STATUS_TRANSITIONS[normalizedCurrentStatus] || [];
  return allowedStatuses.includes(normalizedNextStatus);
}

export function getFulfillmentTimelineEventName(status) {
  const normalized = normalizeFulfillmentStatusValue(status);
  return FULFILLMENT_TIMELINE_EVENTS[normalized] || normalized || FULFILLMENT_STATUS.PENDING;
}

export function getOrderStatusTimelineEventName(status) {
  const normalized = normalizeOrderStatusValue(status);
  return ORDER_STATUS_TIMELINE_EVENTS[normalized] || normalized || ORDER_STATUS.READY_FOR_FULFILLMENT;
}

export function isShipmentInformationStage(status) {
  const normalized = normalizeFulfillmentStatusValue(status);
  return normalized === FULFILLMENT_STATUS.SHIPPED || normalized === FULFILLMENT_STATUS.DELIVERED;
}

export function getFulfillmentStatusQueryValues(status) {
  const normalized = normalizeFulfillmentStatusValue(status);

  switch (normalized) {
    // TEMPORARILY DISABLED
    // Picking remains supported in source code for future warehouse scaling,
    // but HQ currently bypasses it and starts directly from Packing.
    case FULFILLMENT_STATUS.PICKING:
      return [FULFILLMENT_STATUS.PICKING, 'PROCESSING'];
    case FULFILLMENT_STATUS.READY_TO_SHIP:
      return [FULFILLMENT_STATUS.READY_TO_SHIP, 'PACKED'];
    case FULFILLMENT_STATUS.DELIVERED:
      return [FULFILLMENT_STATUS.DELIVERED, 'COMPLETED'];
    default:
      return normalized ? [normalized] : [];
  }
}
