import { NextResponse } from 'next/server';
import { customerAuthService, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { createMemoryRateLimiter } from '@/lib/customer-auth/rate-limit';

const forgotPasswordRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again later.',
  code: 'CUSTOMER_AUTH_FORGOT_PASSWORD_RATE_LIMITED',
});

function extractIpAddress(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const firstForwarded = forwardedFor.split(',').map((value) => value.trim()).filter(Boolean)[0];
  const realIp = request.headers.get('x-real-ip') || '';
  return firstForwarded || realIp || 'unknown';
}

function buildCustomerAuthErrorResponse(error) {
  const normalized = normalizeCustomerAuthError(error);
  return NextResponse.json(
    { error: normalized.message },
    {
      status: normalized.statusCode || 500,
      headers: normalized.retryAfterSeconds
        ? { 'Retry-After': String(normalized.retryAfterSeconds) }
        : undefined,
    },
  );
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    forgotPasswordRateLimiter.consume(`forgot-password:${extractIpAddress(request)}`);

    const response = await customerAuthService.forgotPassword({
      email: payload.email,
      request,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }
}
