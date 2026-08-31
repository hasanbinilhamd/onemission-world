import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { missionContentService, MissionContentError } from '@/lib/mission/service';

export const dynamic = 'force-dynamic';

function buildVoteErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MissionContentError
    ? error
    : new MissionContentError({
        message: 'Your vote could not be recorded. Please try again.',
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
 * Public voting endpoint. The server — never the client — determines the
 * current open mission, option validity, and duplicate-vote protection.
 */
export async function POST(request) {
  return withDevTiming(request, async () => {
    let authenticatedCustomer;
    try {
      authenticatedCustomer = await authenticateCustomerRequest(request, { optional: true });
    } catch (error) {
      const normalized = normalizeCustomerAuthError(error);
      return NextResponse.json(
        { error: normalized.message, code: normalized.code || 'MISSION_VOTE_AUTH_REQUIRED' },
        { status: normalized.statusCode || 401 },
      );
    }

    if (!authenticatedCustomer?.customer?.id) {
      return NextResponse.json(
        { error: 'Sign in is required to vote.', code: 'MISSION_VOTE_AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    try {
      const payload = await readRequestBody(request);
      const response = await missionContentService.recordVote({
        missionOptionId: String(payload.missionOptionId || ''),
        customerId: String(authenticatedCustomer.customer.id),
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildVoteErrorResponse(error, 'MISSION_VOTE_RECORD_FAILED');
    }
  });
}
