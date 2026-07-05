import { NextResponse } from 'next/server';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request) {
  const url = new URL(request.url);

  try {
    const order = await orderService.trackOrder({
      email: url.searchParams.get('email') || '',
      orderNumber: url.searchParams.get('orderNumber') || '',
    });

    return NextResponse.json(order);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
