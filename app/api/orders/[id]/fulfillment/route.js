import { NextResponse } from 'next/server';
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

  try {
    const response = await orderService.updateFulfillmentStatus({
      orderId: params.id,
      fulfillmentStatus: payload.fulfillmentStatus,
      updatedBy: payload.updatedBy,
      notes: payload.notes,
      shipmentCourier: payload.shipmentCourier,
      shipmentService: payload.shipmentService,
      trackingNumber: payload.trackingNumber,
      shippingDate: payload.shippingDate,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
