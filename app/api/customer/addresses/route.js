import { NextResponse } from 'next/server';
import { requireAuthenticatedCustomer } from '@/lib/customer-auth';
import { customerAccountService, normalizeCustomerAccountError } from '@/lib/customer-account';

function buildCustomerAccountErrorResponse(error) {
  const normalized = normalizeCustomerAccountError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request) {
  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const addresses = await customerAccountService.listAddresses({
      customerId: authenticatedCustomer.customer.id,
    });
    return NextResponse.json(addresses);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const address = await customerAccountService.createAddress({
      customerId: authenticatedCustomer.customer.id,
      input: payload,
    });
    return NextResponse.json(address);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}
