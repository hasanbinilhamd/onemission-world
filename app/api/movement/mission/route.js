import { NextResponse } from 'next/server';
import { authenticateCustomerRequest } from '@/lib/customer-auth';
import { missionContentService, MissionContentError } from '@/lib/mission/service';
import { ANONYMOUS_VOTER_COOKIE_NAME } from '@/lib/mission/rules';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildMissionErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MissionContentError
    ? error
    : new MissionContentError({
        message: 'Mission content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public movement Mission content for the ecommerce frontend.
 * Exposes only published content, active options, computed results, and a
 * boolean hasVoted for the current voter identity — never voter identities
 * or admin-only data.
 */
export async function GET(request) {
  let customerId = null;
  try {
    const authenticated = await authenticateCustomerRequest(request, { optional: true });
    customerId = authenticated?.customer?.id || null;
  } catch {
    customerId = null;
  }

  const anonymousVoterId = customerId
    ? null
    : request.cookies.get(ANONYMOUS_VOTER_COOKIE_NAME)?.value || null;

  try {
    const response = await missionContentService.getPublicMissionContent({
      customerId,
      anonymousVoterId,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildMissionErrorResponse(error, 'MISSION_PUBLIC_FETCH_FAILED');
  }
}
