import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

function buildSummary(results) {
  return {
    total: results.length,
    successful: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => String(row?.orderNumber || '').trim() && String(row?.trackingNumber || '').trim());
}

function buildDuplicateSet(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return duplicates;
}

async function findOrder(orderNumber) {
  const normalizedOrderNumber = String(orderNumber || '').trim();
  if (!normalizedOrderNumber) return null;
  return prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: normalizedOrderNumber },
        { publicOrderNumber: normalizedOrderNumber },
      ],
    },
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
    },
  });
}

function buildErrorResult(row, order, error) {
  const normalized = normalizeOrderError(error);
  return {
    orderId: order?.id || row.orderId || '',
    orderNumber: order?.publicOrderNumber || order?.orderNumber || row.orderNumber,
    trackingNumber: row.trackingNumber,
    status: normalized.code === 'ORDER_SHIPMENT_LOCKED' ? 'skipped' : 'failed',
    reason: normalized.message,
    code: normalized.code,
  };
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const rows = normalizeRows(payload.rows);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid tracking rows were provided.' }, { status: 400 });
    }

    const results = [];
    const duplicateOrderNumbers = buildDuplicateSet(rows.map((row) => String(row.orderNumber || '').trim()));
    const duplicateTrackingNumbers = buildDuplicateSet(rows.map((row) => String(row.trackingNumber || '').trim()));

    for (const row of rows) {
      if (duplicateOrderNumbers.has(String(row.orderNumber || '').trim())) {
        results.push({ orderId: row.orderId || '', orderNumber: row.orderNumber, trackingNumber: row.trackingNumber, status: 'failed', reason: 'Duplicate Order Number in import file.', code: 'ORDER_IMPORT_DUPLICATE_ORDER_NUMBER' });
        continue;
      }
      if (duplicateTrackingNumbers.has(String(row.trackingNumber || '').trim())) {
        results.push({ orderId: row.orderId || '', orderNumber: row.orderNumber, trackingNumber: row.trackingNumber, status: 'failed', reason: 'Duplicate tracking number in import file.', code: 'ORDER_IMPORT_DUPLICATE_TRACKING_NUMBER' });
        continue;
      }

      const order = await findOrder(row.orderNumber);
      if (!order) {
        results.push({ orderId: row.orderId || '', orderNumber: row.orderNumber, trackingNumber: row.trackingNumber, status: 'failed', reason: 'Order not found.', code: 'ORDER_NOT_FOUND' });
        continue;
      }

      const fulfillmentStatus = getSynchronizedFulfillmentStatus({
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
      });

      if (fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED || fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) {
        results.push({
          orderId: order.id,
          orderNumber: order.publicOrderNumber || order.orderNumber,
          trackingNumber: row.trackingNumber,
          status: 'skipped',
          reason: 'Shipment information is locked after dispatch.',
          code: 'ORDER_SHIPMENT_LOCKED',
        });
        continue;
      }

      if (fulfillmentStatus !== FULFILLMENT_STATUS.READY_TO_SHIP) {
        results.push({
          orderId: order.id,
          orderNumber: order.publicOrderNumber || order.orderNumber,
          trackingNumber: row.trackingNumber,
          status: 'failed',
          reason: 'Order must be Ready To Ship before tracking information can be updated.',
          code: 'ORDER_FULFILLMENT_TRANSITION_INVALID',
        });
        continue;
      }

      try {
        const response = await orderService.updateFulfillmentStatus({
          orderId: order.id,
          fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED,
          updatedBy: authContext.user.email || authContext.user.name,
          notes: payload.notes || 'Tracking number imported from template.',
          shipmentCourier: row.courier || order.shipmentCourier || order.courier || '',
          shipmentService: row.service || order.shipmentService || order.courierService || '',
          trackingNumber: row.trackingNumber,
          shippingDate: row.shippingDate || order.shippingDate || null,
        });

        await writeAuditLog({
          user: authContext.user,
          module: 'SALES',
          action: 'ORDER_TRACKING_IMPORTED',
          description: `Imported tracking information for order ${response.orderNumber || order.orderNumber}.`,
          metadata: {
            orderId: order.id,
            orderNumber: order.publicOrderNumber || order.orderNumber,
            trackingNumber: row.trackingNumber,
          },
        });

        results.push({
          orderId: order.id,
          orderNumber: response.publicOrderNumber || response.orderNumber || order.publicOrderNumber || order.orderNumber,
          trackingNumber: response.shipment?.trackingNumber || row.trackingNumber,
          fulfillmentStatus: response.fulfillmentStatus,
          status: 'success',
        });
      } catch (error) {
        results.push(buildErrorResult(row, order, error));
      }
    }

    return NextResponse.json({
      success: true,
      summary: buildSummary(results),
      results,
    });
  });
}
