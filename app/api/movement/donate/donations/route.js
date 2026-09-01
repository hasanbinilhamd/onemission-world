import { NextResponse } from 'next/server';
import { donationService, DonationError } from '@/lib/donate/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDonationErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Donations could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public donation list — successful donations only, LATEST (default) or
 * LARGEST. Display name + amount + date only; private fields never leave
 * the server.
 */
export async function GET(request) {
  const params = request.nextUrl?.searchParams;
  try {
    const response = await donationService.getPublicDonations({
      campaignId: params?.get('campaignId') || null,
      sort: params?.get('sort') || 'LATEST',
      offset: Number(params?.get('offset') || 0),
      limit: Number(params?.get('limit') || 10),
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildDonationErrorResponse(error, 'DONATION_PUBLIC_LIST_FAILED');
  }
}
