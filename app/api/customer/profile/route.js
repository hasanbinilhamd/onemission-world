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
    const profile = await customerAccountService.getProfile({
      customerId: authenticatedCustomer.customer.id,
    });
    return NextResponse.json(profile);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}

export async function PUT(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const authenticatedCustomer = await requireAuthenticatedCustomer(request);
    const profile = await customerAccountService.updateProfile({
      customerId: authenticatedCustomer.customer.id,
      customerName: payload.customerName,
      phone: payload.phone,
    });
    return NextResponse.json(profile);
  } catch (error) {
    return buildCustomerAccountErrorResponse(error);
  }
}
