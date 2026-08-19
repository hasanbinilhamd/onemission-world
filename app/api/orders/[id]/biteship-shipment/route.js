import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';
import { FULFILLMENT_STATUS } from '@/lib/order/lifecycle';
import { biteshipShipmentService } from '@/lib/shipping/biteship';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    const payload = await request.json().catch(() => ({}));

    let authContext;
    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const actor = authContext.user.email || authContext.user.name || 'HQ Admin';
      const creation = await biteshipShipmentService.createShipment({
        orderId: params.id,
        courierCompany: payload.courierCompany,
        courierType: payload.courierType,
        updatedBy: actor,
      });

      const shipment = creation.shipment;
      const updatedOrder = await orderService.updateFulfillmentStatus({
        orderId: params.id,
        fulfillmentStatus: FULFILLMENT_STATUS.READY_TO_SHIP,
        updatedBy: actor,
        notes: `Biteship shipment created. Package is ready to ship.\nProvider Order ID: ${shipment.providerOrderId}\nAWB: ${shipment.waybillId || 'Pending'}`,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'BITESHIP_SHIPMENT_CREATED',
        description: `Created Biteship shipment for order ${updatedOrder.publicOrderNumber || updatedOrder.orderNumber || params.id}.`,
        metadata: {
          orderId: params.id,
          providerOrderId: shipment.providerOrderId,
          providerTrackingId: shipment.providerTrackingId,
          trackingNumber: shipment.waybillId || '',
          courier: shipment.courierCompany || '',
          service: shipment.courierType || '',
          actualShippingCost: shipment.actualShippingCost ?? null,
          shippingLabelUrl: shipment.labelUrl || '',
        },
      });

      return NextResponse.json({
        success: true,
        action: creation.action,
        shipment,
        order: updatedOrder,
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
