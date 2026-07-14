import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
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

export async function POST(request, { params }) {
  let authenticatedCustomer;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: false });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  const payload = await request.json().catch(() => ({}));

  try {
    const order = await orderService.requestReturnByCustomer({
      orderId: params.id,
      customerEmail: authenticatedCustomer?.customer?.email || '',
      reason: payload.reason,
      description: payload.description,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    });

    return NextResponse.json(order);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
