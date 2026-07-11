import { NextResponse } from 'next/server';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function PUT(request, { params }) {
  const payload = await request.json().catch(() => ({}));

  let authContext;
  try {
    authContext = await requireHqPermission(request, 'sales', 'fulfillment');
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
  }

  try {
    const response = await orderService.updateFulfillmentStatus({
      orderId: params.id,
      fulfillmentStatus: payload.fulfillmentStatus,
      updatedBy: authContext.user.email || authContext.user.name,
      notes: payload.notes,
      shipmentCourier: payload.shipmentCourier,
      shipmentService: payload.shipmentService,
      trackingNumber: payload.trackingNumber,
      shippingDate: payload.shippingDate,
    });

    await writeAuditLog({
      user: authContext.user,
      module: 'SALES',
      action: 'ORDER_STATUS_CHANGED',
      description: `Updated order ${response.orderNumber || params.id} to ${response.fulfillmentStatus || payload.fulfillmentStatus}.`,
      metadata: {
        orderId: params.id,
        fulfillmentStatus: payload.fulfillmentStatus,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
