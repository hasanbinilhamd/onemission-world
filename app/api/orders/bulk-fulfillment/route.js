import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

const BULK_OPERATION = {
  FULFILLMENT_STATUS: 'FULFILLMENT_STATUS',
  TRACKING: 'TRACKING',
};

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

function buildBulkSummary(results) {
  return {
    total: results.length,
    successful: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
}

function normalizeOrderIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

async function getOrderReference(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      publicOrderNumber: true,
      status: true,
      fulfillmentStatus: true,
      courier: true,
      courierService: true,
      shipmentCourier: true,
      shipmentService: true,
      trackingNumber: true,
      shippingDate: true,
      actualShippingCost: true,
    },
  });
  return order;
}

function buildResultFromError({ orderId, order = null, error }) {
  const normalized = normalizeOrderError(error);
  const resultStatus = normalized.code === 'ORDER_SHIPMENT_LOCKED' ? 'skipped' : 'failed';
  return {
    orderId,
    orderNumber: order?.orderNumber || order?.publicOrderNumber || orderId,
    status: resultStatus,
    reason: normalized.message,
    code: normalized.code,
  };
}

async function processFulfillmentStatusBulk({ orderIds, payload, authContext }) {
  const results = [];

  for (const orderId of orderIds) {
    const order = await getOrderReference(orderId);
    if (!order) {
      results.push({ orderId, orderNumber: orderId, status: 'failed', reason: 'Order was not found.', code: 'ORDER_NOT_FOUND' });
      continue;
    }

    try {
      const response = await orderService.updateFulfillmentStatus({
        orderId,
        fulfillmentStatus: payload.fulfillmentStatus,
        updatedBy: authContext.user.email || authContext.user.name,
        notes: payload.notes,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'ORDER_STATUS_CHANGED',
        description: `Bulk updated order ${response.orderNumber || orderId} to ${response.fulfillmentStatus || payload.fulfillmentStatus}.`,
        metadata: {
          orderId,
          fulfillmentStatus: payload.fulfillmentStatus,
          bulkOperation: BULK_OPERATION.FULFILLMENT_STATUS,
        },
      });

      results.push({
        orderId,
        orderNumber: response.orderNumber || order.orderNumber,
        status: 'success',
        fulfillmentStatus: response.fulfillmentStatus,
      });
    } catch (error) {
      results.push(buildResultFromError({ orderId, order, error }));
    }
  }

  return results;
}

async function processTrackingBulk({ entries, payload, authContext }) {
  const results = [];

  for (const entry of entries) {
    const orderId = String(entry?.orderId || '').trim();
    if (!orderId) continue;

    const order = await getOrderReference(orderId);
    if (!order) {
      results.push({ orderId, orderNumber: orderId, status: 'failed', reason: 'Order was not found.', code: 'ORDER_NOT_FOUND' });
      continue;
    }

    const nextFulfillmentStatus = getSynchronizedFulfillmentStatus({
      orderStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
    });

    if (nextFulfillmentStatus === FULFILLMENT_STATUS.SHIPPED || nextFulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) {
      results.push({
        orderId,
        orderNumber: order.orderNumber || order.publicOrderNumber || orderId,
        status: 'skipped',
        reason: 'Shipment information is locked after dispatch.',
        code: 'ORDER_SHIPMENT_LOCKED',
      });
      continue;
    }

    if (nextFulfillmentStatus !== FULFILLMENT_STATUS.READY_TO_SHIP) {
      results.push({
        orderId,
        orderNumber: order.orderNumber || order.publicOrderNumber || orderId,
        status: 'failed',
        reason: 'Order must be Ready To Ship before tracking information can be updated.',
        code: 'ORDER_FULFILLMENT_TRANSITION_INVALID',
      });
      continue;
    }

    try {
      const response = await orderService.updateFulfillmentStatus({
        orderId,
        fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED,
        updatedBy: authContext.user.email || authContext.user.name,
        notes: payload.notes,
        shipmentCourier: entry.shipmentCourier || payload.shipmentCourier || order.shipmentCourier || order.courier || '',
        shipmentService: entry.shipmentService || payload.shipmentService || order.shipmentService || order.courierService || '',
        trackingNumber: entry.trackingNumber,
        shippingDate: entry.shippingDate || payload.shippingDate || order.shippingDate || null,
        actualShippingCost: entry.actualShippingCost ?? payload.actualShippingCost ?? order.actualShippingCost ?? undefined,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'ORDER_TRACKING_UPDATED',
        description: `Bulk updated tracking information for order ${response.orderNumber || orderId}.`,
        metadata: {
          orderId,
          trackingNumber: entry.trackingNumber,
          actualShippingCost: entry.actualShippingCost ?? payload.actualShippingCost ?? null,
          bulkOperation: BULK_OPERATION.TRACKING,
        },
      });

      results.push({
        orderId,
        orderNumber: response.orderNumber || order.orderNumber,
        status: 'success',
        fulfillmentStatus: response.fulfillmentStatus,
        trackingNumber: response.shipment?.trackingNumber || entry.trackingNumber,
        actualShippingCost: response.shipment?.actualShippingCost ?? entry.actualShippingCost ?? payload.actualShippingCost ?? null,
      });
    } catch (error) {
      results.push(buildResultFromError({ orderId, order, error }));
    }
  }

  return results;
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    const payload = await request.json().catch(() => ({}));

    let authContext;
    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const operation = String(payload.operation || '').trim().toUpperCase();
      let results = [];

      if (operation === BULK_OPERATION.FULFILLMENT_STATUS) {
        const orderIds = normalizeOrderIds(payload.orderIds);
        if (orderIds.length === 0) {
          return NextResponse.json({ error: 'At least one order is required.' }, { status: 400 });
        }
        if (!payload.fulfillmentStatus) {
          return NextResponse.json({ error: 'fulfillmentStatus is required.' }, { status: 400 });
        }
        results = await processFulfillmentStatusBulk({ orderIds, payload, authContext });
      } else if (operation === BULK_OPERATION.TRACKING) {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const normalizedEntries = entries.filter((entry) => String(entry?.orderId || '').trim());
        if (normalizedEntries.length === 0) {
          return NextResponse.json({ error: 'At least one tracking entry is required.' }, { status: 400 });
        }
        results = await processTrackingBulk({ entries: normalizedEntries, payload, authContext });
      } else {
        return NextResponse.json({ error: 'Bulk operation is invalid.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        summary: buildBulkSummary(results),
        results,
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
