import { NextResponse } from 'next/server';
import { normalizeCustomerAuthError } from '@/lib/customer-auth';
import { authenticateCustomerWithGoogle } from '@/lib/customer-auth/providers/google';

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
    const response = await authenticateCustomerWithGoogle({
      idToken: payload.idToken,
      device: payload.device,
      request,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }
}
