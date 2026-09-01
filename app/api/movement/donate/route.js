import { NextResponse } from 'next/server';
import { donationService, DonationError } from '@/lib/donate/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDonationErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Donation content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public Donate payload: the single ACTIVE campaign (with computed totals),
 * recent donation highlights, partners, and past (CLOSED) campaigns.
 * Never exposes private donor information.
 */
export async function GET() {
  try {
    const response = await donationService.getPublicDonatePayload();
    return NextResponse.json(response);
  } catch (error) {
    return buildDonationErrorResponse(error, 'DONATION_PUBLIC_FETCH_FAILED');
  }
}
