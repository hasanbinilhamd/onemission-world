import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

function buildCustomerAuthErrorResponse(error) {
  const normalized = normalizeCustomerAuthError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request, { params }) {
  let authenticatedCustomer;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: false });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  try {
    const order = await orderService.getOrderByNumber(params.orderNumber);

    if (String(authenticatedCustomer.customer.email || '').trim().toLowerCase() !== String(order.customerEmail || '').trim().toLowerCase()) {
      return NextResponse.json({ error: 'Order was not found.' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
