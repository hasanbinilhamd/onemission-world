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

export async function PUT(request, { params }) {
  const payload = await request.json().catch(() => ({}));

  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const address = await customerAccountService.updateAddress({
      customerId: authenticatedCustomer.customer.id,
      addressId: params.id,
      input: payload,
    });
    return NextResponse.json(address);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const response = await customerAccountService.deleteAddress({
      customerId: authenticatedCustomer.customer.id,
      addressId: params.id,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}
