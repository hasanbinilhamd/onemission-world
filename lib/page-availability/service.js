import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';

/**
 * Page Availability — CMS-controlled public visibility for movement
 * sections (mission, impact, donate).
 *
 * This is a PAGE-LEVEL setting and is completely independent from content
 * statuses (Mission OPEN/DRAFT, Impact DRAFT/COMING_SOON/NOW_LIVE/CLOSED,
 * Donation campaign DRAFT/ACTIVE/CLOSED).
 *
 * Single source of truth: HQ CMS → database → public API → ecommerce.
 * No row yet → AVAILABLE (backward-compatible default).
 */

export const PAGE_AVAILABILITY = {
  AVAILABLE: 'AVAILABLE',
  COMING_SOON: 'COMING_SOON',
};

export const PAGE_AVAILABILITY_PAGES = ['mission', 'impact', 'donate'];

export class PageAvailabilityError extends Error {
  constructor({ message, statusCode = 400, code = 'PAGE_AVAILABILITY_ERROR' }) {
    super(message);
    this.name = 'PageAvailabilityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isValidPage(page) {
  return PAGE_AVAILABILITY_PAGES.includes(String(page || '').trim().toLowerCase());
}

function normalizeAvailability(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(PAGE_AVAILABILITY).includes(normalized)
    ? normalized
    : null;
}

export const pageAvailabilityService = {
  /**
   * Public + admin read. Missing row → AVAILABLE (safest default so
   * previously working sections keep working after the migration).
   */
  async getPageAvailability(page) {
    const pageId = String(page || '').trim().toLowerCase();
    if (!isValidPage(pageId)) {
      throw new PageAvailabilityError({
        message: 'Unknown page.',
        statusCode: 400,
        code: 'PAGE_AVAILABILITY_UNKNOWN_PAGE',
      });
    }

    const setting = await prisma.pageAvailabilitySetting.findUnique({
      where: { id: pageId },
    });

    return {
      page: pageId,
      availability: setting?.availability || PAGE_AVAILABILITY.AVAILABLE,
    };
  },

  async setPageAvailability({ page, availability, user = null } = {}) {
    const pageId = String(page || '').trim().toLowerCase();
    if (!isValidPage(pageId)) {
      throw new PageAvailabilityError({
        message: 'Unknown page.',
        statusCode: 400,
        code: 'PAGE_AVAILABILITY_UNKNOWN_PAGE',
      });
    }

    const normalized = normalizeAvailability(availability);
    if (!normalized) {
      throw new PageAvailabilityError({
        message: 'Invalid availability value. Use AVAILABLE or COMING_SOON.',
        statusCode: 400,
        code: 'PAGE_AVAILABILITY_INVALID_VALUE',
      });
    }

    await prisma.pageAvailabilitySetting.upsert({
      where: { id: pageId },
      create: { id: pageId, availability: normalized },
      update: { availability: normalized },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_PAGE_AVAILABILITY_CHANGED',
      description: `Page availability for "${pageId}" changed to ${normalized}.`,
      metadata: { page: pageId, availability: normalized },
    });

    return this.getPageAvailability(pageId);
  },
};
