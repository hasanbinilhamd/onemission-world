import { NextResponse } from 'next/server';
import { customerAuthService, normalizeCustomerAuthError } from '@/lib/customer-auth';

function buildCustomerAuthErrorResponse(error) {
  const normalized = normalizeCustomerAuthError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

function extractAccessToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const response = await customerAuthService.changePassword({
      accessToken: extractAccessToken(request),
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }
}
