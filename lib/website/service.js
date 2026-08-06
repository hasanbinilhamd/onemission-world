import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import { cache } from '@/lib/cache';

export const WEBSITE_MEDIA_TYPE = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
};

const WEBSITE_HOMEPAGE_CACHE_KEY = 'website:homepage';
const WEBSITE_COLLECTION_CACHE_KEY = 'website:collection';
const WEBSITE_HOMEPAGE_CACHE_TTL_SECONDS = 30 * 60;
const WEBSITE_COLLECTION_CACHE_TTL_SECONDS = 30 * 60;

const DEFAULT_WEBSITE_HERO_ITEMS = [
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/OKOWW.png?updatedAt=1782468174527',
    mobileUrl: '',
    displayOrder: 1,
    isActive: true,
    scale: 1,
    verticalOffset: 0,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/WEEE.png?updatedAt=1782468174345',
    mobileUrl: '',
    displayOrder: 2,
    isActive: true,
    scale: 1,
    verticalOffset: 0,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/kmkmksss.png?updatedAt=1782468173729',
    mobileUrl: '',
    displayOrder: 3,
    isActive: true,
    scale: 1,
    verticalOffset: 0,
  },
  {
    mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
    desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/QW.png?updatedAt=1782468169304',
    mobileUrl: '',
    displayOrder: 4,
    isActive: true,
    scale: 1,
    verticalOffset: 0,
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

const WEBSITE_COLLECTION_HERO_TYPE = {
  IMAGE: 'IMAGE',
  SLIDESHOW: 'SLIDESHOW',
  VIDEO: 'VIDEO',
};

const DEFAULT_WEBSITE_COLLECTION_HERO = {
  heroType: WEBSITE_COLLECTION_HERO_TYPE.IMAGE,
  title: "MEN'S COLLECTION",
  description: 'Explore performance essentials designed with purpose.',
  overlayOpacity: 35,
  isActive: true,
  mediaItems: [
    {
      mediaType: WEBSITE_MEDIA_TYPE.IMAGE,
      desktopUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/Model/OKOWW.png?updatedAt=1782468174527',
      mobileUrl: '',
      displayOrder: 1,
      isActive: true,
    },
  ],
};

let websiteDefaultsPromise = null;

export class WebsiteContentError extends Error {
  constructor({ message, statusCode = 400, code = 'WEBSITE_CONTENT_ERROR' }) {
    super(message);
    this.name = 'WebsiteContentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function logHomepageCacheEvent(message) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message);
  }
}

export async function invalidateWebsiteContentCache() {
  const [homepageInvalidated, collectionInvalidated] = await Promise.all([
    cache.del(WEBSITE_HOMEPAGE_CACHE_KEY),
    cache.del(WEBSITE_COLLECTION_CACHE_KEY),
  ]);
  if (homepageInvalidated || collectionInvalidated) {
    logHomepageCacheEvent('Website Cache INVALIDATED');
  }
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

function normalizeFloatValue(value, fallback, fieldLabel, { min = Number.NEGATIVE_INFINITY } = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new WebsiteContentError({
      message: `${fieldLabel} must be a valid number.`,
      statusCode: 400,
      code: 'WEBSITE_FLOAT_VALUE_INVALID',
    });
  }

  return parsed;
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
    scale: Number.isFinite(Number(item.scale)) ? Number(item.scale) : 1,
    verticalOffset: Number.isFinite(Number(item.verticalOffset)) ? Number(item.verticalOffset) : 0,
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

function normalizeCollectionHeroType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!Object.values(WEBSITE_COLLECTION_HERO_TYPE).includes(normalized)) {
    throw new WebsiteContentError({
      message: 'Collection Hero Type must be Image, Slideshow, or Video.',
      statusCode: 400,
      code: 'WEBSITE_COLLECTION_HERO_TYPE_INVALID',
    });
  }
  return normalized;
}

function normalizeOverlayOpacity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new WebsiteContentError({
      message: 'Overlay Opacity must be between 0 and 100.',
      statusCode: 400,
      code: 'WEBSITE_COLLECTION_OVERLAY_INVALID',
    });
  }
  return parsed;
}

function normalizeCollectionTitle(value) {
  return String(value || '').trim();
}

function normalizeCollectionDescription(value) {
  return String(value || '').trim();
}

function serializeCollectionHeroMediaItem(item) {
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

function serializeCollectionHero(hero) {
  if (!hero) return null;
  return {
    id: hero.id,
    heroType: String(hero.heroType || WEBSITE_COLLECTION_HERO_TYPE.IMAGE).toLowerCase(),
    title: hero.title || '',
    description: hero.description || '',
    overlayOpacity: Number.isFinite(Number(hero.overlayOpacity)) ? Number(hero.overlayOpacity) : 35,
    active: Boolean(hero.isActive),
    mediaItems: Array.isArray(hero.mediaItems)
      ? hero.mediaItems.map(serializeCollectionHeroMediaItem).sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
      : [],
    createdAt: hero.createdAt,
    updatedAt: hero.updatedAt,
  };
}

function normalizeCollectionHeroMediaItems(heroType, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new WebsiteContentError({
      message: 'At least one Collection Hero media item is required.',
      statusCode: 400,
      code: 'WEBSITE_COLLECTION_MEDIA_REQUIRED',
    });
  }

  const maxItems = heroType === WEBSITE_COLLECTION_HERO_TYPE.SLIDESHOW ? items.length : 1;
  const limitedItems = items.slice(0, maxItems);

  return limitedItems
    .map((item, index) => ({
      id: String(item?.id || crypto.randomUUID()),
      mediaType: heroType === WEBSITE_COLLECTION_HERO_TYPE.VIDEO ? WEBSITE_MEDIA_TYPE.VIDEO : WEBSITE_MEDIA_TYPE.IMAGE,
      desktopUrl: normalizeUrl(item?.desktopUrl, heroType === WEBSITE_COLLECTION_HERO_TYPE.VIDEO ? 'Video URL' : 'Desktop URL'),
      mobileUrl: normalizeUrl(item?.mobileUrl, 'Mobile URL', { required: false }),
      displayOrder: normalizeDisplayOrder(item?.displayOrder, index + 1),
      isActive: normalizeBoolean(item?.active, true),
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

function normalizeCollectionHero(input = {}) {
  const heroType = normalizeCollectionHeroType(input.heroType || input.collectionHeroType || WEBSITE_COLLECTION_HERO_TYPE.IMAGE);
  const mediaItems = normalizeCollectionHeroMediaItems(heroType, input.mediaItems || []);
  if (mediaItems.filter((item) => item.isActive).length === 0) {
    throw new WebsiteContentError({
      message: 'At least one Collection Hero media item must be active.',
      statusCode: 400,
      code: 'WEBSITE_COLLECTION_MEDIA_ACTIVE_REQUIRED',
    });
  }
  return {
    heroType,
    title: normalizeCollectionTitle(input.title),
    description: normalizeCollectionDescription(input.description),
    overlayOpacity: normalizeOverlayOpacity(input.overlayOpacity ?? 35),
    isActive: normalizeBoolean(input.active, true),
    mediaItems,
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
    scale: normalizeFloatValue(item?.scale, 1, 'Scale', { min: 0.1 }),
    verticalOffset: normalizeFloatValue(item?.verticalOffset, 0, 'Vertical Offset'),
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
  const [heroCount, brandVideoCount, productStoryCount, collectionHeroCount] = await prismaClient.$transaction([
    prismaClient.websiteHero.count(),
    prismaClient.websiteBrandVideo.count(),
    prismaClient.websiteProductStory.count(),
    prismaClient.websiteCollectionHero.count(),
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
        scale: item.scale,
        verticalOffset: item.verticalOffset,
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

  if (collectionHeroCount === 0) {
    await prismaClient.websiteCollectionHero.create({
      data: {
        id: crypto.randomUUID(),
        heroType: DEFAULT_WEBSITE_COLLECTION_HERO.heroType,
        title: DEFAULT_WEBSITE_COLLECTION_HERO.title,
        description: DEFAULT_WEBSITE_COLLECTION_HERO.description,
        overlayOpacity: DEFAULT_WEBSITE_COLLECTION_HERO.overlayOpacity,
        isActive: DEFAULT_WEBSITE_COLLECTION_HERO.isActive,
        mediaItems: {
          create: DEFAULT_WEBSITE_COLLECTION_HERO.mediaItems.map((item) => ({
            id: crypto.randomUUID(),
            mediaType: item.mediaType,
            desktopUrl: item.desktopUrl,
            mobileUrl: item.mobileUrl,
            displayOrder: item.displayOrder,
            isActive: item.isActive,
          })),
        },
      },
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

async function getAdminCollectionHero(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  const hero = await prismaClient.websiteCollectionHero.findFirst({
    include: {
      mediaItems: {
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return serializeCollectionHero(hero);
}

async function listPublicHeroItemsFromDatabase(prismaClient = prisma) {
  const items = await prismaClient.websiteHero.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
    take: 4,
  });

  return items.map(serializeHeroItem);
}

async function getPublicBrandVideoFromDatabase(prismaClient = prisma) {
  const item = await prismaClient.websiteBrandVideo.findFirst({
    where: { isActive: true },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return serializeBrandVideo(item);
}

async function listPublicProductStoryItemsFromDatabase(prismaClient = prisma) {
  const items = await prismaClient.websiteProductStory.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return items.map(serializeProductStoryItem);
}

async function getPublicCollectionHeroFromDatabase(prismaClient = prisma) {
  const hero = await prismaClient.websiteCollectionHero.findFirst({
    where: { isActive: true },
    include: {
      mediaItems: {
        where: { isActive: true },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return serializeCollectionHero(hero);
}

function isWebsiteHomepageContentPayload(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Array.isArray(value.heroItems)
    && Array.isArray(value.productStoryItems)
    && (value.brandVideo === null || typeof value.brandVideo === 'object');
}

async function loadPublicWebsiteContentFromDatabase(prismaClient = prisma) {
  const [heroItems, brandVideo, productStoryItems] = await Promise.all([
    listPublicHeroItemsFromDatabase(prismaClient),
    getPublicBrandVideoFromDatabase(prismaClient),
    listPublicProductStoryItemsFromDatabase(prismaClient),
  ]);

  return {
    heroItems,
    brandVideo,
    productStoryItems,
  };
}

async function getPublicWebsiteContent(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);

  const cachedPayload = await cache.get(WEBSITE_HOMEPAGE_CACHE_KEY);
  if (isWebsiteHomepageContentPayload(cachedPayload)) {
    logHomepageCacheEvent('Homepage Cache HIT');
    return cachedPayload;
  }

  logHomepageCacheEvent('Homepage Cache MISS');

  const payload = await loadPublicWebsiteContentFromDatabase(prismaClient);
  await cache.set(WEBSITE_HOMEPAGE_CACHE_KEY, payload, {
    ttl: WEBSITE_HOMEPAGE_CACHE_TTL_SECONDS,
  });

  return payload;
}

async function listPublicHeroItems(prismaClient = prisma) {
  const homepageContent = await getPublicWebsiteContent(prismaClient);
  return homepageContent.heroItems;
}

async function getPublicBrandVideo(prismaClient = prisma) {
  const homepageContent = await getPublicWebsiteContent(prismaClient);
  return homepageContent.brandVideo;
}

async function listPublicProductStoryItems(prismaClient = prisma) {
  const homepageContent = await getPublicWebsiteContent(prismaClient);
  return homepageContent.productStoryItems;
}

function isWebsiteCollectionHeroPayload(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.mediaItems));
}

async function getPublicCollectionHero(prismaClient = prisma) {
  await ensureWebsiteContentDefaults(prismaClient);
  const cachedPayload = await cache.get(WEBSITE_COLLECTION_CACHE_KEY);
  if (isWebsiteCollectionHeroPayload(cachedPayload)) {
    logHomepageCacheEvent('Collection Cache HIT');
    return cachedPayload;
  }

  logHomepageCacheEvent('Collection Cache MISS');
  const payload = await getPublicCollectionHeroFromDatabase(prismaClient);
  await cache.set(WEBSITE_COLLECTION_CACHE_KEY, payload, {
    ttl: WEBSITE_COLLECTION_CACHE_TTL_SECONDS,
  });
  return payload;
}

export const websiteContentService = {
  async getAdminWebsiteContent() {
    const [heroItems, brandVideo, productStoryItems, collectionHero] = await Promise.all([
      listAdminHeroItems(prisma),
      getAdminBrandVideo(prisma),
      listAdminProductStoryItems(prisma),
      getAdminCollectionHero(prisma),
    ]);

    return {
      heroItems,
      brandVideo,
      productStoryItems,
      collectionHero,
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
          scale: item.scale,
          verticalOffset: item.verticalOffset,
        })),
      });
    });

    await invalidateWebsiteContentCache();

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

    await invalidateWebsiteContentCache();

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

    await invalidateWebsiteContentCache();

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

  async getAdminCollectionHero() {
    return getAdminCollectionHero(prisma);
  },

  async updateCollectionHero({ data, user = null } = {}) {
    const normalizedData = normalizeCollectionHero(data);

    const hero = await prisma.$transaction(async (tx) => {
      await tx.websiteCollectionHeroMedia.deleteMany({});
      await tx.websiteCollectionHero.deleteMany({});
      return tx.websiteCollectionHero.create({
        data: {
          id: crypto.randomUUID(),
          heroType: normalizedData.heroType,
          title: normalizedData.title,
          description: normalizedData.description,
          overlayOpacity: normalizedData.overlayOpacity,
          isActive: normalizedData.isActive,
          mediaItems: {
            create: normalizedData.mediaItems.map((item) => ({
              id: item.id,
              mediaType: item.mediaType,
              desktopUrl: item.desktopUrl,
              mobileUrl: item.mobileUrl,
              displayOrder: item.displayOrder,
              isActive: item.isActive,
            })),
          },
        },
        include: {
          mediaItems: {
            orderBy: [
              { displayOrder: 'asc' },
              { createdAt: 'asc' },
            ],
          },
        },
      });
    });

    await invalidateWebsiteContentCache();

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'WEBSITE_COLLECTION_HERO_UPDATED',
      description: 'Website CMS collection hero content was updated.',
      metadata: {
        heroType: normalizedData.heroType,
        totalItems: normalizedData.mediaItems.length,
        activeItems: normalizedData.mediaItems.filter((item) => item.isActive).length,
      },
    });

    return serializeCollectionHero(hero);
  },

  async getPublicCollectionHero() {
    return getPublicCollectionHero(prisma);
  },

  async getPublicWebsiteContent() {
    return getPublicWebsiteContent(prisma);
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
