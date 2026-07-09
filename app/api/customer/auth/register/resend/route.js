import { NextResponse } from 'next/server';
import { customerAuthService, normalizeCustomerAuthError } from '@/lib/customer-auth';

function buildCustomerAuthErrorResponse(error) {
  const normalized = normalizeCustomerAuthError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const response = await customerAuthService.resendRegistrationOtp({
      email: payload.email,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }
}
