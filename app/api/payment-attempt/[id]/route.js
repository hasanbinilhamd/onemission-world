import { NextResponse } from 'next/server';
import { paymentAttemptService, normalizePaymentAttemptError } from '@/lib/payment-attempt';

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 }
  );
}

export async function GET(_request, { params }) {
  try {
    const attempt = await paymentAttemptService.getPaymentAttemptById(params.id);
    return NextResponse.json(paymentAttemptService.buildPaymentAttemptResponse(attempt));
  } catch (error) {
    return buildPaymentAttemptErrorResponse(error);
  }
}
