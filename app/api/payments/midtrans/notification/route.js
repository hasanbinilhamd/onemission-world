import { NextResponse } from 'next/server';
import '@/lib/order';
import { normalizePaymentAttemptError, paymentAttemptService } from '@/lib/payment-attempt';
import { donationService, DonationError } from '@/lib/donate/service';
import { DONATION_TRANSACTION_NUMBER_PREFIX } from '@/lib/donate/rules';

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

function buildDonationErrorResponse(error) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Donation notification could not be processed.',
        statusCode: 500,
        code: 'DONATION_NOTIFICATION_FAILED',
      });

  return NextResponse.json(
    { error: normalizedError.message },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Shared Midtrans webhook.
 *
 * Shop transactions and donation transactions share the SAME Midtrans
 * account, so this single endpoint dispatches by the order_id prefix:
 *   DON-*  → donation flow (guest donations, computed campaign totals)
 *   other  → existing PaymentAttempt checkout flow (unchanged)
 */
export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  const orderId = String(payload?.order_id || '');
  if (orderId.startsWith(DONATION_TRANSACTION_NUMBER_PREFIX)) {
    try {
      const donation = await donationService.handleMidtransNotification(payload);
      return NextResponse.json(donation);
    } catch (error) {
      return buildDonationErrorResponse(error);
    }
  }

  try {
    const attempt = await paymentAttemptService.handleMidtransNotification(payload);
    return NextResponse.json(attempt);
  } catch (error) {
    return buildPaymentAttemptErrorResponse(error);
  }
}
