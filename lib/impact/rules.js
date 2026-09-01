/**
 * Impact — pure business rules.
 *
 * Kept free of Prisma/DB imports so ordering, validation, and reading-time
 * rules can be unit-tested directly and reused by the service layer.
 */

export const IMPACT_STATUS = {
  DRAFT: 'DRAFT',
  COMING_SOON: 'COMING_SOON',
  NOW_LIVE: 'NOW_LIVE',
  CLOSED: 'CLOSED',
};

export const IMPACT_CATEGORIES = ['PEOPLE', 'COMMUNITY', 'PHILOSOPHY', 'JOURNEY'];

/**
 * Public display priority — a hard rule. CLOSED never appears above
 * NOW_LIVE regardless of date. DRAFT never appears publicly.
 */
export const IMPACT_STATUS_PRIORITY = {
  NOW_LIVE: 0,
  COMING_SOON: 1,
  CLOSED: 2,
};

/**
 * Sort public stories: status priority first, then featured within the same
 * status, then most recently published first.
 *
 * sortMode:
 *  - 'latest'   (default): newest publishedAt first within each status group
 *  - 'oldest'   : oldest publishedAt first within each status group
 *  - 'upcoming' : nearest publishedAt first within each status group
 *                 (meaningful primarily for COMING SOON content)
 */
export function sortImpactStoriesForPublic(items = [], sortMode = 'latest') {
  const mode = String(sortMode || 'latest').toLowerCase();
  const priorityOrder = ['NOW_LIVE', 'COMING_SOON', 'CLOSED'];

  return [...items].sort((left, right) => {
    const leftPriority = priorityOrder.indexOf(left.status);
    const rightPriority = priorityOrder.indexOf(right.status);
    const leftGroup = leftPriority === -1 ? 99 : leftPriority;
    const rightGroup = rightPriority === -1 ? 99 : rightPriority;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;

    if (mode === 'latest' && Boolean(left.featured) !== Boolean(right.featured)) {
      return left.featured ? -1 : 1;
    }

    const leftDate = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
    const rightDate = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    if (leftDate !== rightDate) {
      return mode === 'oldest' || mode === 'upcoming' ? leftDate - rightDate : rightDate - leftDate;
    }

    return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
  });
}

/** Filter to a single status ('ALL' or empty keeps every public item). */
export function filterImpactStoriesByStatus(items = [], status = 'ALL') {
  const normalized = String(status || 'ALL').trim().toUpperCase();
  if (normalized === 'ALL') return items;
  return items.filter((item) => item.status === normalized);
}

/** Slugify a title the same way the CMS does by default. */
export function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function normalizeImpactCategory(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return IMPACT_CATEGORIES.includes(normalized) ? normalized : 'JOURNEY';
}

export function normalizeImpactStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(IMPACT_STATUS).includes(normalized) ? normalized : IMPACT_STATUS.DRAFT;
}

/**
 * Reading time is derived from TEXT content only. Image-heavy stories with
 * very little text do not get an artificial reading-time value.
 */
export function computeImpactReadingMinutes(textBlocks = []) {
  const words = textBlocks.reduce((total, block) => {
    const wordsInBlock = String(block?.text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return total + wordsInBlock;
  }, 0);

  if (words < 50) return null;
  return Math.max(1, Math.round(words / 180));
}

/**
 * Validate a single content block payload.
 * Returns { ok, reason } — never throws.
 */
export function validateImpactBlock(block = {}) {
  const type = String(block?.type || '').toUpperCase();

  if (type === 'TEXT') {
    if (!String(block?.text || '').trim()) {
      return { ok: false, reason: 'Text blocks require text content.' };
    }
    return { ok: true, reason: '' };
  }

  if (type === 'IMAGE') {
    if (!String(block?.imageUrl || '').trim()) {
      return { ok: false, reason: 'Image blocks require an image.' };
    }
    if (!String(block?.altText || '').trim()) {
      return { ok: false, reason: 'Image blocks require alt text.' };
    }
    return { ok: true, reason: '' };
  }

  return { ok: false, reason: `Unknown block type: ${type || 'empty'}.` };
}
