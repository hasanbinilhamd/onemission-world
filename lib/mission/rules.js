/**
 * Mission voting — pure business rules.
 *
 * Kept free of Prisma/DB imports so these rules can be unit-tested directly
 * and reused by the service layer. The frontend never receives these limits
 * as CMS-editable values — they are fixed business rules.
 */

export const MAX_ACTIVE_MISSION_OPTIONS = 4;
export const MISSION_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

/**
 * Cookie carrying the server-generated anonymous voter identity.
 * HttpOnly + Secure (production) + SameSite=Lax + 1 year — the browser never
 * reads it and JS never sees it.
 */
export const ANONYMOUS_VOTER_COOKIE_NAME = 'om_voter_id';
export const ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Resolves the single valid voter identity for a vote.
 * Exactly one of customerId / anonymousVoterId must be present;
 * authenticated identity takes precedence. Never trusts client-provided ids
 * — callers derive them server-side.
 */
export function resolveVoterIdentity({ customerId = null, anonymousVoterId = null } = {}) {
  const hasCustomer = Boolean(customerId);
  const hasAnonymous = Boolean(anonymousVoterId);

  if (!hasCustomer && !hasAnonymous) {
    return {
      ok: false,
      code: 'MISSION_VOTE_IDENTITY_REQUIRED',
      identity: null,
    };
  }

  if (hasCustomer) {
    return {
      ok: true,
      code: null,
      identity: { customerId: String(customerId), anonymousVoterId: null },
    };
  }

  return {
    ok: true,
    code: null,
    identity: { customerId: null, anonymousVoterId: String(anonymousVoterId) },
  };
}

export function countActiveOptions(options = []) {
  return Array.isArray(options)
    ? options.filter((option) => option?.isActive !== false).length
    : 0;
}

/**
 * Validates whether a mission may be opened for voting.
 * Returns { ok, reason } — never throws.
 */
export function validateOpenableMission({ activeOptionCount = 0 }) {
  if (activeOptionCount < 1) {
    return {
      ok: false,
      reason: 'A voting mission needs at least one active option before it can be opened.',
      code: 'MISSION_OPEN_ACTIVE_OPTIONS_REQUIRED',
    };
  }

  if (activeOptionCount > MAX_ACTIVE_MISSION_OPTIONS) {
    return {
      ok: false,
      reason: `A voting mission can have at most ${MAX_ACTIVE_MISSION_OPTIONS} active options. Deactivate ${activeOptionCount - MAX_ACTIVE_MISSION_OPTIONS} option(s) before opening.`,
      code: 'MISSION_OPEN_ACTIVE_OPTIONS_EXCEEDED',
    };
  }

  return { ok: true, reason: '', code: null };
}

/**
 * Percentage allocation from raw vote counts (rounded to whole numbers).
 * Returns empty results when there are no votes.
 */
export function computeMissionResults({ countsByOptionId = {}, activeOptionIds = [] }) {
  const normalizedCounts = {};
  let totalVotes = 0;

  for (const optionId of activeOptionIds) {
    const votes = Math.max(0, Number(countsByOptionId[optionId] || 0));
    normalizedCounts[optionId] = votes;
    totalVotes += votes;
  }

  const results = activeOptionIds.map((optionId) => ({
    optionId,
    votes: normalizedCounts[optionId],
    percentage: totalVotes > 0
      ? Math.round((normalizedCounts[optionId] / totalVotes) * 100)
      : 0,
  }));

  return { totalVotes, results };
}
