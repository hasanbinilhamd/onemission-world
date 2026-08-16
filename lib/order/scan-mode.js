import { OrderError } from './errors.js';
import {
  FULFILLMENT_STATUS,
  ORDER_STATUS,
  getSynchronizedFulfillmentStatus,
  normalizeOrderStatusValue,
} from './lifecycle.js';

export const SCAN_MODE_SOURCE = 'SCAN_MODE';
export const SCAN_MODE_AUDIT_ACTION = 'ORDER_SHIPPED_VIA_SCAN';

export function normalizeScanTrackingNumber(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function getScanModeStatusLabel(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown';
}

export function resolveScanModeShipmentConfig(order = {}) {
  return {
    shipmentCourier: String(order.shipmentCourier || order.courier || '').trim(),
    shipmentService: String(order.shipmentService || order.courierService || '').trim(),
  };
}

export function getScanModeFulfillmentStatus(order = {}) {
  return getSynchronizedFulfillmentStatus({
    orderStatus: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
  });
}

function buildScanOrderReference(order = {}) {
  return order.publicOrderNumber || order.orderNumber || order.id || 'this order';
}

export function assertValidScanModeShipment({ order, trackingNumber, duplicateOrder = null } = {}) {
  if (!order?.id) {
    throw new OrderError({
      message: 'Order was not found.',
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  const normalizedTrackingNumber = normalizeScanTrackingNumber(trackingNumber);
  if (!normalizedTrackingNumber) {
    throw new OrderError({
      message: 'Tracking number is required before confirming a scanned shipment.',
      statusCode: 400,
      code: 'ORDER_SCAN_TRACKING_REQUIRED',
    });
  }

  const normalizedOrderStatus = normalizeOrderStatusValue(order.status);
  const currentFulfillmentStatus = getScanModeFulfillmentStatus(order);

  if (normalizedOrderStatus === ORDER_STATUS.CANCELLED || currentFulfillmentStatus === FULFILLMENT_STATUS.CANCELLED) {
    throw new OrderError({
      message: 'This order is cancelled and cannot be shipped.',
      statusCode: 409,
      code: 'ORDER_SCAN_CANCELLED',
    });
  }

  if ([FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED].includes(currentFulfillmentStatus)) {
    throw new OrderError({
      message: 'Shipment information is locked after dispatch.',
      statusCode: 409,
      code: 'ORDER_SHIPMENT_LOCKED',
    });
  }

  if (currentFulfillmentStatus !== FULFILLMENT_STATUS.READY_TO_SHIP) {
    throw new OrderError({
      message: `This order is currently ${getScanModeStatusLabel(currentFulfillmentStatus)}. It must be Ready To Ship before scanning.`,
      statusCode: 409,
      code: 'ORDER_SCAN_NOT_READY_TO_SHIP',
    });
  }

  const currentTrackingNumber = normalizeScanTrackingNumber(order.trackingNumber);
  if (currentTrackingNumber) {
    const sameTrackingNumber = currentTrackingNumber === normalizedTrackingNumber;
    throw new OrderError({
      message: sameTrackingNumber
        ? 'Tracking number is already assigned to the selected order. Use the manual fulfillment workflow for rescan or recovery cases.'
        : 'The selected order already has a different tracking number. Use the manual fulfillment workflow to correct it.',
      statusCode: 409,
      code: sameTrackingNumber ? 'ORDER_SCAN_TRACKING_ALREADY_ASSIGNED' : 'ORDER_SCAN_TRACKING_OVERWRITE_BLOCKED',
    });
  }

  if (duplicateOrder?.id && duplicateOrder.id !== order.id) {
    throw new OrderError({
      message: `Tracking number already belongs to another order (${buildScanOrderReference(duplicateOrder)}). Shipment was not updated.`,
      statusCode: 409,
      code: 'ORDER_SCAN_TRACKING_DUPLICATE',
    });
  }

  const shipmentConfig = resolveScanModeShipmentConfig(order);
  if (!shipmentConfig.shipmentCourier || !shipmentConfig.shipmentService) {
    throw new OrderError({
      message: 'Shipment courier and service must be configured on the order before Scan Mode can ship it.',
      statusCode: 400,
      code: 'ORDER_SCAN_SHIPMENT_CONFIG_REQUIRED',
    });
  }

  return {
    trackingNumber: normalizedTrackingNumber,
    fulfillmentStatus: currentFulfillmentStatus,
    ...shipmentConfig,
  };
}

export function buildScanModeReadyOrder(order = {}) {
  const shipmentConfig = resolveScanModeShipmentConfig(order);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    publicOrderNumber: order.publicOrderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    fulfillmentStatus: getScanModeFulfillmentStatus(order),
    orderStatus: order.status,
    shipmentCourier: shipmentConfig.shipmentCourier,
    shipmentService: shipmentConfig.shipmentService,
    trackingNumber: order.trackingNumber || '',
    shippingDate: order.shippingDate || null,
    customerShippingCost: order.shippingCost ?? null,
    actualShippingCost: order.actualShippingCost ?? null,
    totalItems: order._count?.items || order.items?.length || 0,
    createdAt: order.createdAt,
  };
}
