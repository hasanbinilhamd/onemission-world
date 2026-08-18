import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';
import { prisma } from '@/lib/prisma';
import {
  FULFILLMENT_STATUS,
  getFulfillmentStatusQueryValues,
} from '@/lib/order/lifecycle';
import {
  SCAN_MODE_AUDIT_ACTION,
  SCAN_MODE_SOURCE,
  assertValidScanModeShipment,
  buildScanModeReadyOrder,
  getScanModeFulfillmentStatus,
  normalizeScanTrackingNumber,
} from '@/lib/order/scan-mode';

const SCAN_MODE_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  publicOrderNumber: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  recipientName: true,
  recipientPhone: true,
  status: true,
  fulfillmentStatus: true,
  courier: true,
  courierService: true,
  shipmentCourier: true,
  shipmentService: true,
  trackingNumber: true,
  shippingDate: true,
  shippingCost: true,
  actualShippingCost: true,
  createdAt: true,
  _count: {
    select: {
      items: true,
    },
  },
};

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

function normalizeLimit(value) {
  const numeric = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(numeric) || numeric < 1) return 50;
  return Math.min(numeric, 100);
}

function normalizePage(value) {
  const numeric = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return numeric;
}

function normalizeShippingDateInput(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function findDuplicateTrackingOrder(orders, selectedOrderId, normalizedTrackingNumber) {
  return orders.find((order) => (
    order.id !== selectedOrderId
    && normalizeScanTrackingNumber(order.trackingNumber) === normalizedTrackingNumber
  )) || null;
}

async function findTrackingDuplicate({ trackingNumber, selectedOrderId }) {
  const normalizedTrackingNumber = normalizeScanTrackingNumber(trackingNumber);
  if (!normalizedTrackingNumber) return null;

  const candidates = await prisma.order.findMany({
    where: {
      trackingNumber: {
        equals: normalizedTrackingNumber,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      orderNumber: true,
      publicOrderNumber: true,
      trackingNumber: true,
    },
    take: 10,
  });

  return findDuplicateTrackingOrder(candidates, selectedOrderId, normalizedTrackingNumber);
}

function buildScanModeNote(notes) {
  const normalizedNotes = String(notes || '').trim();
  return normalizedNotes ? `Shipped via Scan Mode.\n${normalizedNotes}` : 'Shipped via Scan Mode.';
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    const url = new URL(request.url);

    let authContext;
    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const page = normalizePage(url.searchParams.get('page'));
      const limit = normalizeLimit(url.searchParams.get('limit'));
      const where = {
        status: {
          not: 'CANCELLED',
        },
        fulfillmentStatus: {
          in: getFulfillmentStatusQueryValues(FULFILLMENT_STATUS.READY_TO_SHIP),
        },
      };

      const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          select: SCAN_MODE_ORDER_SELECT,
          orderBy: [
            { createdAt: 'asc' },
            { orderNumber: 'asc' },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const readyOrders = orders
        .filter((order) => getScanModeFulfillmentStatus(order) === FULFILLMENT_STATUS.READY_TO_SHIP)
        .map(buildScanModeReadyOrder);

      return NextResponse.json({
        success: true,
        source: SCAN_MODE_SOURCE,
        data: readyOrders,
        summary: {
          readyToShip: total,
          returned: readyOrders.length,
        },
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        operator: authContext.user?.name || authContext.user?.email || 'HQ Admin',
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
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
      const orderId = String(payload.orderId || '').trim();
      const trackingNumber = normalizeScanTrackingNumber(payload.trackingNumber || payload.scanResult);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: SCAN_MODE_ORDER_SELECT,
      });

      const duplicateOrder = await findTrackingDuplicate({
        trackingNumber,
        selectedOrderId: orderId,
      });

      const validation = assertValidScanModeShipment({
        order,
        trackingNumber,
        duplicateOrder,
      });

      const response = await orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED,
        updatedBy: authContext.user.email || authContext.user.name,
        notes: buildScanModeNote(payload.notes),
        shipmentCourier: validation.shipmentCourier,
        shipmentService: validation.shipmentService,
        trackingNumber: validation.trackingNumber,
        shippingDate: normalizeShippingDateInput(payload.shippingDate),
        actualShippingCost: payload.actualShippingCost ?? order.actualShippingCost ?? undefined,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: SCAN_MODE_AUDIT_ACTION,
        description: `Order ${response.orderNumber || response.publicOrderNumber || order.orderNumber} shipped via Scan Mode.`,
        metadata: {
          orderId: order.id,
          orderNumber: response.publicOrderNumber || response.orderNumber || order.publicOrderNumber || order.orderNumber,
          trackingNumber: validation.trackingNumber,
          shipmentCourier: validation.shipmentCourier,
          shipmentService: validation.shipmentService,
          actualShippingCost: response.shipment?.actualShippingCost ?? payload.actualShippingCost ?? null,
          source: SCAN_MODE_SOURCE,
        },
      });

      return NextResponse.json({
        success: true,
        source: SCAN_MODE_SOURCE,
        message: 'Shipment confirmed via Scan Mode.',
        order: response,
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
