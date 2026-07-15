import { NextResponse } from 'next/server';
import { checkoutService, normalizeCheckoutError } from '@/lib/checkout';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';

function buildCheckoutErrorResponse(error) {
  const normalized = normalizeCheckoutError(error);
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

export async function GET(request) {
  let authenticatedCustomer;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: false });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  const url = new URL(request.url);

  try {
    const response = await checkoutService.listCheckoutSessionsByCustomer({
      customerId: authenticatedCustomer?.customer?.id || '',
      email: authenticatedCustomer?.customer?.email || '',
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 20,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildCheckoutErrorResponse(error);
  }
}
