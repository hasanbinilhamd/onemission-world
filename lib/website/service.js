import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import { getCachedValue, invalidateCacheByPrefix } from '@/lib/server-cache';

export const WEBSITE_MEDIA_TYPE = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
};

const WEBSITE_CACHE_TTL_MS = 300_000;
const WEBSITE_CACHE_PREFIX = 'website-cms';

const DEFAULT_WEBSITE_HERO_ITEMS = [
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/OKOWW.png?updatedAt=1782468174527',
    mobileUrl: '',
    displayOrder: 1,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/WEEE.png?updatedAt=1782468174345',
    mobileUrl: '',
    displayOrder: 2,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/kmkmksss.png?updatedAt=1782468173729',
    mobileUrl: '',
    displayOrder: 3,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/QW.png?updatedAt=1782468169304',
    mobileUrl: '',
    displayOrder: 4,
    isActive: true,
  },
];

const DEFAULT_WEBSITE_BRAND_VIDEO = {
  videoUrl: 'https://ik.imagekit.io/fkoy34ckk/onemission-dev/WhatsApp%20Video%202026-07-26%20at%2016.17.17.mp4?updatedAt=1785057842262',
  posterUrl: 'https://ik.imagekit.io/fkoy34ckk/onemission-dev/Screenshot%202026-07-26%20163038.png?updatedAt=1785058280647',
  isActive: true,
};

const DEFAULT_WEBSITE_PRODUCT_STORY_ITEMS = [
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    mediaUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/OKOWW.png?updatedAt=1782468174527',
    description: 'Performance silhouettes shaped to move freely while keeping a clean, confident presence in every setting.',
    displayOrder: 1,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    mediaUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/WEEE.png?updatedAt=1782468174345',
    description: 'Soft structure, elevated finishes, and durable comfort create a premium layer that holds up from commute to workout.',
    displayOrder: 2,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.VIDEO,
    mediaUrl: 'https://ik.imagekit.io/fkoy34ckk/onemission-dev/WhatsApp%20Video%202026-07-26%20at%2016.17.17.mp4?updatedAt=1785057842262',
    description: 'A quiet visual story of pace, discipline, and intention expressed through motion-driven product presentation.',
    displayOrder: 3,
    isActive: true,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    mediaUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/kmkmksss.png?updatedAt=1782468173729',
    description: 'Every visual cue is meant to feel purposeful, understated, and ready for a global Muslim lifestyle.',
    displayOrder: 4,
    isActive: true,
  },
];

let websiteDefaultsPromise = null;

export class WebsiteContentError extends Error {
  constructor({ message, statusCode = 400, code = 'WEBSITE_CONTENT_ERROR' }) {
    super(message);
    this.name = 'WebsiteContentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildCacheKey(segment) {
  return `${WEBSITE_CACHE_PREFIX}:${segment}`;
}

export function invalidateWebsiteContentCache() {
  invalidateCacheByPrefix(`${WEBSITE_CACHE_PREFIX}:`);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function normalizeMediaType(value, fieldLabel = 'Media Type') {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) {
    throw new WebsiteContentError({
      message: `${fieldLabel} is required.`,
      statusCode: 400,
      code: 'WEBSITE_MEDIA_TYPE_REQUIRED',
    });
  }

  if (!Object.values(WEBSITE_MEDIA_TYPE).includes(normalized)) {
    throw new WebsiteContentError({
      message: `${fieldLabel} must be either Image or Video.`,
      statusCode: 400,
      code: 'WEBSITE_MEDIA_TYPE_INVALID',
    });
  }

  return normalized;
}

function normalizeUrl(value, fieldLabel, { required = true } = {}) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    if (!required) {
      return '';
    }

    throw new WebsiteContentError({
      message: `${fieldLabel} is required.`,
      statusCode: 400,
      code: 'WEBSITE_URL_REQUIRED',
    });
  }

  if (!/^https?:\/\//i.test(normalized)) {
    throw new WebsiteContentError({
      message: `${fieldLabel} must be a valid URL.`,
      statusCode: 400,
      code: 'WEBSITE_URL_INVALID',
    });
  }

  return normalized;
}

function normalizeDisplayOrder(value, fallback, fieldLabel = 'Display Order') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new WebsiteContentError({
      message: `${fieldLabel} must be a valid number.`,
      statusCode: 400,
      code: 'WEBSITE_DISPLAY_ORDER_INVALID',
    });
  }

  return Math.trunc(parsed || fallback);
}

function normalizeDescription(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new WebsiteContentError({
      message: 'Description is required.',
      statusCode: 400,
      code: 'WEBSITE_DESCRIPTION_REQUIRED',
    });
  }

  return normalized;
}

function serializeHeroItem(item) {
  return {
    id: item.id,
    mediaType: String(item.mediaType || '').toLowerCase(),
    desktopUrl: item.desktopUrl,
    mobileUrl: item.mobileUrl || '',
    displayOrder: item.displayOrder,
    active: Boolean(item.isActive),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeBrandVideo(item) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    videoUrl: item.videoUrl,
    posterUrl: item.posterUrl,
    active: Boolean(item.isActive),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeProductStoryItem(item) {
  return {
    id: item.id,
    mediaType: String(item.mediaType || '').toLowerCase(),
    mediaUrl: item.mediaUrl,
    description: item.description,
    displayOrder: item.displayOrder,
    active: Boolean(item.isActive),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function normalizeHeroItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new WebsiteContentError({
      message: 'At least one hero item is required.',
      statusCode: 400,
      code: 'WEBSITE_HERO_ITEMS_REQUIRED',
    });
  }

  const normalizedItems = items.map((item, index) => ({
    id: String(item?.id || crypto.randomUUID()),
    mediaType: normalizeMediaType(item?.mediaType),
    desktopUrl: normalizeUrl(item?.desktopUrl, 'Desktop URL'),
    mobileUrl: normalizeUrl(item?.mobileUrl, 'Mobile URL', { required: false }),
    displayOrder: normalizeDisplayOrder(item?.displayOrder, index + 1),
    isActive: normalizeBoolean(item?.active, true),
  }));

  const activeCount = normalizedItems.filter((item) => item.isActive).length;
  if (activeCount === 0) {
    throw new WebsiteContentError({
      message: 'At least one hero item must be active.',
      statusCode: 400,
      code: 'WEBSITE_HERO_ACTIVE_REQUIRED',
    });
  }

  if (activeCount > 4) {
    throw new WebsiteContentError({
      message: 'Hero supports a maximum of 4 active items.',
      statusCode: 400,
      code: 'WEBSITE_HERO_ACTIVE_LIMIT',
    });
  }

  return normalizedItems.sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

function normalizeBrandVideo(record = {}) {
  return {
    id: String(record?.id || crypto.randomUUID()),
    videoUrl: normalizeUrl(record?.videoUrl, 'Video URL'),
    posterUrl: normalizeUrl(record?.posterUrl, 'Poster URL'),
    isActive: normalizeBoolean(record?.active, true),
  };
}

function normalizeProductStoryItems(items = []) {
  if (!Array.isArray(items)) {
    throw new WebsiteContentError({
      message: 'Product Story items must be an array.',
      statusCode: 400,
      code: 'WEBSITE_PRODUCT_STORY_ITEMS_INVALID',
    });
  }

  return items
    .map((item, index) => ({
      id: String(item?.id || crypto.randomUUID()),
      mediaType: normalizeMediaType(item?.mediaType),
      mediaUrl: normalizeUrl(item?.mediaUrl, 'Media URL'),
      description: normalizeDescription(item?.description),
      displayOrder: normalizeDisplayOrder(item?.displayOrder, index + 1),
      isActive: normalizeBoolean(item?.active, true),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

async function seedWebsiteDefaults(prismaClient = prisma) {
  const [heroCount, brandVideoCount, productStoryCount] = await prismaClient.$transaction([
    prismaClient.websiteHero.count(),
    prismaClient.websiteBrandVideo.count(),
    prismaClient.websiteProductStory.count(),
  ]);

  if (heroCount === 0) {
    await prismaClient.websiteHero.createMany({
      data: DEFAULT_WEBSITE_HERO_ITEMS.map((item) => ({
        id: crypto.randomUUID(),
        mediaType: item.mediaType,
        desktopUrl: item.desktopUrl,
        mobileUrl: item.mobileUrl,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      })),
    });
  }

  if (brandVideoCount === 0) {
    await prismaClient.websiteBrandVideo.create({
      data: {
        id: crypto.randomUUID(),
        videoUrl: DEFAULT_WEBSITE_BRAND_VIDEO.videoUrl,
        posterUrl: DEFAULT_WEBSITE_BRAND_VIDEO.posterUrl,
        isActive: DEFAULT_WEBSITE_BRAND_VIDEO.isActive,
      },
    });
  }

  if (productStoryCount === 0) {
    await prismaClient.websiteProductStory.createMany({
      data: DEFAULT_WEBSITE_PRODUCT_STORY_ITEMS.map((item) => ({
        id: crypto.randomUUID(),
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        description: item.description,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      })),
    });
  }
}

export async function ensureWebsiteContentDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedWebsiteDefaults(prismaClient);
    return;
  }

  if (!websiteDefaultsPromise) {
    websiteDefaultsPromise = seedWebsiteDefaults(prismaClient).catch((error) => {
      websiteDefaultsPromise = null;
      throw error;
    });
  }

  await websiteDefaultsPromise;
}

async function listAdminHeroItems(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  const items = await prismaClient.websiteHero.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return items.map(serializeHeroItem);
}

async function getAdminBrandVideo(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  const item = await prismaClient.websiteBrandVideo.findFirst({
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return serializeBrandVideo(item);
}

async function listAdminProductStoryItems(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  const items = await prismaClient.websiteProductStory.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return items.map(serializeProductStoryItem);
}

async function listPublicHeroItems(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  return getCachedValue(buildCacheKey('public-hero'), WEBSITE_CACHE_TTL_MS, async () => {
    const items = await prismaClient.websiteHero.findMany({
      where: { isActive: true },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 4,
    });

    return items.map(serializeHeroItem);
  });
}

async function getPublicBrandVideo(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  return getCachedValue(buildCacheKey('public-brand-video'), WEBSITE_CACHE_TTL_MS, async () => {
    const item = await prismaClient.websiteBrandVideo.findFirst({
      where: { isActive: true },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return serializeBrandVideo(item);
  });
}

async function listPublicProductStoryItems(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  return getCachedValue(buildCacheKey('public-product-story'), WEBSITE_CACHE_TTL_MS, async () => {
    const items = await prismaClient.websiteProductStory.findMany({
      where: { isActive: true },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return items.map(serializeProductStoryItem);
  });
}

export const websiteContentService = {
  async getAdminWebsiteContent() {
    const [heroItems, brandVideo, productStoryItems] = await Promise.all([
      listAdminHeroItems(prisma),
      getAdminBrandVideo(prisma),
      listAdminProductStoryItems(prisma),
    ]);

    return {
      heroItems,
      brandVideo,
      productStoryItems,
    };
  },

  async listAdminHeroItems() {
    return listAdminHeroItems(prisma);
  },

  async updateHeroItems({ items, user = null } = {}) {
    const normalizedItems = normalizeHeroItems(items);

    await prisma.$transaction(async (tx) => {
      await tx.websiteHero.deleteMany({});
      await tx.websiteHero.createMany({
        data: normalizedItems.map((item) => ({
          id: item.id,
          mediaType: item.mediaType,
          desktopUrl: item.desktopUrl,
          mobileUrl: item.mobileUrl,
          displayOrder: item.displayOrder,
          isActive: item.isActive,
        })),
      });
    });

    invalidateWebsiteContentCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'WEBSITE_HERO_UPDATED',
      description: 'Website CMS hero content was updated.',
      metadata: {
        totalItems: normalizedItems.length,
        activeItems: normalizedItems.filter((item) => item.isActive).length,
      },
    });

    return listAdminHeroItems(prisma);
  },

  async getAdminBrandVideo() {
    return getAdminBrandVideo(prisma);
  },

  async updateBrandVideo({ data, user = null } = {}) {
    const normalizedData = normalizeBrandVideo(data);

    await prisma.$transaction(async (tx) => {
      await tx.websiteBrandVideo.deleteMany({});
      await tx.websiteBrandVideo.create({
        data: {
          id: normalizedData.id,
          videoUrl: normalizedData.videoUrl,
          posterUrl: normalizedData.posterUrl,
          isActive: normalizedData.isActive,
        },
      });
    });

    invalidateWebsiteContentCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'WEBSITE_BRAND_VIDEO_UPDATED',
      description: 'Website CMS brand video was updated.',
      metadata: {
        active: normalizedData.isActive,
      },
    });

    return getAdminBrandVideo(prisma);
  },

  async listAdminProductStoryItems() {
    return listAdminProductStoryItems(prisma);
  },

  async updateProductStoryItems({ items, user = null } = {}) {
    const normalizedItems = normalizeProductStoryItems(items);

    await prisma.$transaction(async (tx) => {
      await tx.websiteProductStory.deleteMany({});
      if (normalizedItems.length > 0) {
        await tx.websiteProductStory.createMany({
          data: normalizedItems.map((item) => ({
            id: item.id,
            mediaType: item.mediaType,
            mediaUrl: item.mediaUrl,
            description: item.description,
            displayOrder: item.displayOrder,
            isActive: item.isActive,
          })),
        });
      }
    });

    invalidateWebsiteContentCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'WEBSITE_PRODUCT_STORY_UPDATED',
      description: 'Website CMS product story content was updated.',
      metadata: {
        totalItems: normalizedItems.length,
        activeItems: normalizedItems.filter((item) => item.isActive).length,
      },
    });

    return listAdminProductStoryItems(prisma);
  },

  async getPublicWebsiteContent() {
    const [heroItems, brandVideo, productStoryItems] = await Promise.all([
      listPublicHeroItems(prisma),
      getPublicBrandVideo(prisma),
      listPublicProductStoryItems(prisma),
    ]);

    return {
      heroItems,
      brandVideo,
      productStoryItems,
    };
  },

  async listPublicHeroItems() {
    return listPublicHeroItems(prisma);
  },

  async getPublicBrandVideo() {
    return getPublicBrandVideo(prisma);
  },

  async listPublicProductStoryItems() {
    return listPublicProductStoryItems(prisma);
  },
};
