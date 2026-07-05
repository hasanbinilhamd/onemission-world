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
    const response = await orderService.listOrders({
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 10,
      search: url.searchParams.get('search') || '',
      sortBy: url.searchParams.get('sortBy') || 'createdAt',
      sortOrder: url.searchParams.get('sortOrder') || 'desc',
      paymentStatus: url.searchParams.get('paymentStatus') || '',
      fulfillmentStatus: url.searchParams.get('fulfillmentStatus') || '',
      startDate: url.searchParams.get('startDate') || '',
      endDate: url.searchParams.get('endDate') || '',
      courier: url.searchParams.get('courier') || '',
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
