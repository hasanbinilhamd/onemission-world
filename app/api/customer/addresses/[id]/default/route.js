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

export async function POST(request, { params }) {
  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const address = await customerAccountService.setDefaultAddress({
      customerId: authenticatedCustomer.customer.id,
      addressId: params.id,
    });
    return NextResponse.json(address);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}
