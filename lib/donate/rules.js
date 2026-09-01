/**
 * Donate — pure business rules.
 *
 * Kept free of Prisma/DB imports so amount validation, total computation,
 * donation sorting, and public-name resolution can be unit-tested directly
 * and reused by the service layer.
 */

export const DONATION_CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

export const DONATION_TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

/** Only successful payments count toward campaign progress. */
export const DONATION_COUNTED_STATUSES = new Set([DONATION_TRANSACTION_STATUS.PAID]);

export const DONATION_MIN_AMOUNT = 1000;
export const DONATION_MAX_AMOUNT = 100_000_000;

export const DONATION_TRANSACTION_NUMBER_PREFIX = 'DON-';

/** Server-side amount validation — the client amount is never trusted. */
export function validateDonationAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return { ok: false, reason: 'Donation amount must be a valid number.', code: 'DONATION_AMOUNT_INVALID' };
  }
  if (amount < DONATION_MIN_AMOUNT) {
    return {
      ok: false,
      reason: `Minimum donation is ${DONATION_MIN_AMOUNT.toLocaleString('id-ID')}.`,
      code: 'DONATION_AMOUNT_TOO_SMALL',
    };
  }
  if (amount > DONATION_MAX_AMOUNT) {
    return {
      ok: false,
      reason: `Maximum donation is ${DONATION_MAX_AMOUNT.toLocaleString('id-ID')}.`,
      code: 'DONATION_AMOUNT_TOO_LARGE',
    };
  }
  if (Math.round(amount) !== amount) {
    return { ok: false, reason: 'Donation amount must be a whole number.', code: 'DONATION_AMOUNT_FRACTIONAL' };
  }
  return { ok: true, reason: '', code: null, amount };
}

/**
 * Campaign totals are computed ONLY from counted (successful) transactions —
 * pending/failed/expired/cancelled never inflate the numbers. Because totals
 * are derived (not stored), webhook replays are naturally idempotent.
 */
export function computeCampaignTotals(donations = []) {
  let raised = 0;
  let donorCount = 0;

  for (const donation of donations) {
    if (!DONATION_COUNTED_STATUSES.has(donation?.status)) continue;
    raised += Math.max(0, Number(donation.amount) || 0);
    donorCount += 1;
  }

  return { raised, donorCount };
}

export function computeCampaignProgress(raised, targetAmount) {
  const target = Math.max(0, Number(targetAmount) || 0);
  if (target === 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

/**
 * Public donation list sorting:
 *  - LATEST  → newest successful donations first (default)
 *  - LARGEST → largest successful donations first
 */
export function sortDonationsForPublic(donations = [], sort = 'LATEST') {
  const mode = String(sort || 'LATEST').trim().toUpperCase();
  const counted = donations.filter((donation) => DONATION_COUNTED_STATUSES.has(donation?.status));

  return [...counted].sort((left, right) => {
    if (mode === 'LARGEST') {
      const diff = (Number(right.amount) || 0) - (Number(left.amount) || 0);
      if (diff !== 0) return diff;
    }
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

/**
 * Public donor display name: anonymous donors always render as "Anonymous".
 * Private fields (email/phone) are never part of public payloads.
 */
export function resolvePublicDonor(transaction = {}) {
  if (transaction?.anonymous) return 'Anonymous';
  const name = String(transaction?.donorName || '').trim();
  return name || 'Anonymous';
}
