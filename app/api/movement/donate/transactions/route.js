import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { donationService, DonationError } from '@/lib/donate/service';

export const dynamic = 'force-dynamic';

function buildDonationErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Your donation could not be created. Please try again.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * Guest donation creation — NO login required.
 *
 * The server determines the ACTIVE campaign and validates the amount; the
 * client never supplies campaignId/status/identity as trusted values. A
 * PENDING transaction is created and a Midtrans Snap token is returned
 * using the SAME Midtrans integration as Shop.
 */
export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      const payload = await readRequestBody(request);
      const response = await donationService.createDonation({
        amount: payload.amount,
        donorName: payload.donorName,
        anonymous: Boolean(payload.anonymous),
        donorEmail: payload.donorEmail,
        donorPhone: payload.donorPhone,
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildDonationErrorResponse(error, 'DONATION_CREATE_FAILED');
    }
  });
}
