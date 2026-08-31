import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { authenticateCustomerRequest } from '@/lib/customer-auth';
import { createMemoryRateLimiter } from '@/lib/customer-auth/rate-limit';
import { missionContentService, MissionContentError } from '@/lib/mission/service';
import {
  ANONYMOUS_VOTER_COOKIE_NAME,
  ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/mission/rules';

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

function getClientIp(request) {
  return String(
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown',
  );
}

// Minimal abuse protection for public voting (reuses the project's existing
// in-memory rate limiter): 20 vote attempts per IP per hour.
const voteRateLimiter = createMemoryRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many vote attempts. Please try again later.',
  code: 'MISSION_VOTE_RATE_LIMITED',
});

/**
 * Public voting endpoint — authentication is OPTIONAL.
 *
 * Identity resolution is fully server-side:
 *  - authenticated customer → customerId from the session
 *  - anonymous visitor      → anonymousVoterId from a secure HttpOnly cookie
 *    (generated server-side when missing, never from client input)
 *
 * The server determines the open mission, option validity, and duplicate
 * votes. The client only ever sends { missionOptionId }.
 */
export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      voteRateLimiter.consume(`vote:${getClientIp(request)}`);
    } catch (error) {
      return NextResponse.json(
        { error: error.message, code: error.code || 'MISSION_VOTE_RATE_LIMITED' },
        { status: error.statusCode || 429 },
      );
    }

    // Optional authentication: a logged-in user votes with their account;
    // an invalid/stale token is treated as anonymous (voting never blocks).
    let customerId = null;
    try {
      const authenticated = await authenticateCustomerRequest(request, { optional: true });
      customerId = authenticated?.customer?.id || null;
    } catch {
      customerId = null;
    }

    // Anonymous identity: existing cookie or a new cryptographically secure id.
    let anonymousVoterId = null;
    let shouldSetCookie = false;
    if (!customerId) {
      anonymousVoterId = request.cookies.get(ANONYMOUS_VOTER_COOKIE_NAME)?.value || '';
      if (!anonymousVoterId) {
        anonymousVoterId = crypto.randomUUID();
        shouldSetCookie = true;
      }
    }

    try {
      const payload = await readRequestBody(request);
      const response = await missionContentService.recordVote({
        missionOptionId: String(payload.missionOptionId || ''),
        customerId,
        anonymousVoterId,
      });

      const nextResponse = NextResponse.json(response);

      if (shouldSetCookie) {
        nextResponse.cookies.set(ANONYMOUS_VOTER_COOKIE_NAME, anonymousVoterId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS,
        });
      }

      return nextResponse;
    } catch (error) {
      return buildVoteErrorResponse(error, 'MISSION_VOTE_RECORD_FAILED');
    }
  });
}
