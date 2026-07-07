import { NextResponse } from 'next/server';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(_request, { params }) {
  try {
    const order = await orderService.getOrderByCheckoutSessionId(params.checkoutSessionId);
    return NextResponse.json(order);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
