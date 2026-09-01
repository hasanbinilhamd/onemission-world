import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import { cache } from '@/lib/cache';

/**
 * Movement Home CMS — content only (no design controls).
 *
 * Stores the approved Home page content (hero + Join The Mission cards) and
 * serves it to the ecommerce frontend. Defaults mirror the currently
 * approved frontend content so the website stays equivalent after CMS
 * integration.
 */

export const MOVEMENT_HOME_CACHE_KEY = 'movement:home';
const MOVEMENT_HOME_CACHE_TTL_SECONDS = 30 * 60;

export const HOME_DESTINATIONS = ['mission', 'impact', 'shop', 'donate'];
export const HOME_DESTINATION_DEFAULT = 'mission';

const DEFAULT_HOME_PAGE = {
  id: 'home',
  headline: 'We Build. We Move. We Serve.',
  description:
    'A movement of Muslims who train their body, strengthen their faith, and build a better ummah.',
  ctaLabel: 'Join The Mission',
  ctaDestination: 'mission',
  socialProofNumber: '12K+',
  socialProofText: 'Muslims are moving together',
  desktopImage: '',
  mobileImage: '',
};

const DEFAULT_HOME_CARDS = [
  {
    title: 'Vote Now',
    description: 'What should we do next?',
    image: 'https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/7.png?updatedAt=1786440345021',
    destination: 'mission',
    displayOrder: 1,
  },
  {
    title: 'Real Impact',
    description: "See what we're building together.",
    image: 'https://ik.imagekit.io/qqulvbiww/Products/Pro%20Sport/5.png?updatedAt=1786440344975',
    destination: 'impact',
    displayOrder: 2,
  },
  {
    title: 'Performance',
    description: 'Gear that moves with you.',
    image: 'https://ik.imagekit.io/qqulvbiww/Products/Awrah%20Fit%20Ultra%20Stretch/7.png?updatedAt=1786411154528',
    destination: 'shop',
    displayOrder: 3,
  },
  {
    title: 'Donate Now',
    description: 'Help someone move forward.',
    image: 'https://ik.imagekit.io/qqulvbiww/Products/Core%20Flex%20Sport%20Shirt/7.png?updatedAt=1786411266413',
    destination: 'donate',
    displayOrder: 4,
  },
];

export class MovementHomeContentError extends Error {
  constructor({ message, statusCode = 400, code = 'MOVEMENT_HOME_CONTENT_ERROR' }) {
    super(message);
    this.name = 'MovementHomeContentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '', maxLength = 500) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function normalizeDestination(value) {
  const normalized = String(value || HOME_DESTINATION_DEFAULT).trim().toLowerCase();
  return HOME_DESTINATIONS.includes(normalized) ? normalized : HOME_DESTINATION_DEFAULT;
}

function normalizeHomePageInput(input = {}) {
  return {
    headline: normalizeText(input.headline, '', 240),
    description: normalizeText(input.description, '', 500),
    ctaLabel: normalizeText(input.ctaLabel, '', 80),
    ctaDestination: normalizeDestination(input.ctaDestination),
    socialProofNumber: normalizeText(input.socialProofNumber, '', 40),
    socialProofText: normalizeText(input.socialProofText, '', 160),
    desktopImage: normalizeText(input.desktopImage, '', 2000),
    mobileImage: normalizeText(input.mobileImage, '', 2000),
  };
}

function normalizeCardInput(card = {}, index = 0) {
  return {
    id: normalizeText(card.id, `temp-card-${Date.now()}-${index}`, 64),
    title: normalizeText(card.title, '', 120),
    description: normalizeText(card.description, '', 240),
    image: normalizeText(card.image, '', 2000),
    destination: normalizeDestination(card.destination),
    displayOrder: Number.isFinite(Number(card.displayOrder)) ? Number(card.displayOrder) : index + 1,
    isActive: card.isActive !== false,
  };
}

function toPublicHomePage(homePage) {
  return {
    headline: homePage.headline,
    description: homePage.description,
    ctaLabel: homePage.ctaLabel,
    ctaDestination: homePage.ctaDestination,
    socialProofNumber: homePage.socialProofNumber,
    socialProofText: homePage.socialProofText,
    desktopImage: homePage.desktopImage,
    mobileImage: homePage.mobileImage,
  };
}

function toPublicCard(card) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    image: card.image,
    destination: card.destination,
    displayOrder: card.displayOrder,
    isActive: card.isActive,
  };
}

async function seedMovementHomeDefaults(prismaClient = prisma) {
  const [homeCount, cardCount] = await prismaClient.$transaction([
    prismaClient.homePage.count(),
    prismaClient.homePageCard.count(),
  ]);

  if (homeCount === 0) {
    await prismaClient.homePage.create({
      data: { ...DEFAULT_HOME_PAGE },
    });
  }

  if (cardCount === 0) {
    await prismaClient.homePageCard.createMany({
      data: DEFAULT_HOME_CARDS.map((card) => ({
        id: crypto.randomUUID(),
        ...card,
      })),
    });
  }
}

let movementHomeDefaultsPromise = null;

export async function ensureMovementHomeDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedMovementHomeDefaults(prismaClient);
    return;
  }

  if (!movementHomeDefaultsPromise) {
    movementHomeDefaultsPromise = seedMovementHomeDefaults(prismaClient).catch((error) => {
      movementHomeDefaultsPromise = null;
      throw error;
    });
  }

  await movementHomeDefaultsPromise;
}

async function invalidateMovementHomeCache() {
  await cache.del(MOVEMENT_HOME_CACHE_KEY);
}

export const movementHomeContentService = {
  async getPublicHomeContent() {
    const cached = await cache.get(MOVEMENT_HOME_CACHE_KEY);
    if (cached) return cached;

    const [homePage, cards] = await Promise.all([
      prisma.homePage.findUnique({ where: { id: 'home' } }),
      prisma.homePageCard.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    // CMS is the single source of truth — an empty database returns an
    // empty structure, never default/dummy content.
    const payload = {
      home: homePage ? toPublicHomePage(homePage) : null,
      cards: cards.map(toPublicCard),
    };

    await cache.set(MOVEMENT_HOME_CACHE_KEY, payload, { ttl: MOVEMENT_HOME_CACHE_TTL_SECONDS });
    return payload;
  },

  async getAdminHomeContent() {
    const [homePage, cards] = await Promise.all([
      prisma.homePage.findUnique({ where: { id: 'home' } }),
      prisma.homePageCard.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    return {
      home: homePage ? toPublicHomePage(homePage) : null,
      cards: cards.map(toPublicCard),
    };
  },

  async updateHomePage({ home, user = null } = {}) {
    const normalized = normalizeHomePageInput(home);

    await prisma.homePage.upsert({
      where: { id: 'home' },
      create: { id: 'home', ...normalized },
      update: { ...normalized },
    });

    await invalidateMovementHomeCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_HOME_UPDATED',
      description: 'Movement Home CMS hero content was updated.',
      metadata: {
        ctaDestination: normalized.ctaDestination,
        hasDesktopImage: Boolean(normalized.desktopImage),
        hasMobileImage: Boolean(normalized.mobileImage),
      },
    });

    return this.getAdminHomeContent();
  },

  async updateHomeCards({ cards = [], user = null } = {}) {
    const normalizedCards = cards.map((card, index) => normalizeCardInput(card, index));
    const tempIdPattern = /^temp-card-/;

    await prisma.$transaction(async (tx) => {
      // Replace the whole card set with the submitted list, mirroring the
      // existing Website CMS hero-items replace pattern.
      await tx.homePageCard.deleteMany({});
      await tx.homePageCard.createMany({
        data: normalizedCards.map((card) => ({
          id: tempIdPattern.test(card.id) ? crypto.randomUUID() : card.id,
          title: card.title,
          description: card.description,
          image: card.image,
          destination: card.destination,
          displayOrder: card.displayOrder,
          isActive: card.isActive,
        })),
      });
    });

    await invalidateMovementHomeCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_HOME_CARDS_UPDATED',
      description: 'Movement Home CMS cards were updated.',
      metadata: {
        totalCards: normalizedCards.length,
        activeCards: normalizedCards.filter((card) => card.isActive).length,
      },
    });

    return this.getAdminHomeContent();
  },
};
