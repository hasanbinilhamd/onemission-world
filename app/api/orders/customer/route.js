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

export async function GET(request) {
  const url = new URL(request.url);

  let authenticatedCustomer;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: false });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  try {
    const queryEmail = String(url.searchParams.get('email') || '').trim().toLowerCase();
    const authenticatedEmail = String(authenticatedCustomer?.customer?.email || '').trim().toLowerCase();

    if (queryEmail && authenticatedEmail !== queryEmail) {
      return NextResponse.json({ error: 'You are not allowed to access another customer order history.' }, { status: 403 });
    }

    const response = await orderService.listOrdersByCustomerEmail({
      email: authenticatedEmail,
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 10,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
