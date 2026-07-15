import { NextResponse } from 'next/server';
import { normalizePaymentAttemptError, paymentAttemptService } from '@/lib/payment-attempt';

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(_request, { params }) {
  try {
    const attempt = await paymentAttemptService.cancelPaymentAttempt({
      paymentAttemptId: params.id,
    });
    return NextResponse.json(attempt);
  } catch (error) {
    return buildPaymentAttemptErrorResponse(error);
  }
}
