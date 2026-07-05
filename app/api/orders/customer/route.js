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
    const response = await orderService.listOrdersByCustomerEmail({
      email: url.searchParams.get('email') || '',
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 10,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
