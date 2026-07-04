import { NextResponse } from 'next/server';
import '@/lib/order';
import { normalizePaymentAttemptError, paymentAttemptService } from '@/lib/payment-attempt';

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const attempt = await paymentAttemptService.handleMidtransNotification(payload);
    return NextResponse.json(attempt);
  } catch (error) {
    return buildPaymentAttemptErrorResponse(error);
  }
}
