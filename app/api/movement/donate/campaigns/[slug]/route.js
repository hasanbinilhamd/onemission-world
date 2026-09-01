import { NextResponse } from 'next/server';
import { donationService, DonationError } from '@/lib/donate/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDonationErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Campaign could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public campaign detail — usable for both the ACTIVE campaign and
 * historical (CLOSED) campaigns. DRAFT is rejected server-side.
 */
export async function GET(request, { params }) {
  const slug = String(params?.slug || '');
  try {
    const response = await donationService.getPublicCampaignDetail(slug);
    return NextResponse.json(response);
  } catch (error) {
    return buildDonationErrorResponse(error, 'DONATION_CAMPAIGN_DETAIL_FAILED');
  }
}
