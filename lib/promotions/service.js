import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';

const PROMOTION_CACHE_PREFIX = 'promotions';
const PROMOTION_CACHE_SCAN_COUNT = 200;
const PROMOTION_LIST_TTL_SECONDS = 10 * 60;
const PROMOTION_DETAIL_TTL_SECONDS = 10 * 60;
const PROMOTION_VALIDATE_TTL_SECONDS = 5 * 60;
const DEFAULT_ADMIN_PROMOTION_LIMIT = 20;
const MAX_ADMIN_PROMOTION_LIMIT = 100;

const globalPromotionCacheState = globalThis.__onemissionPromotionCacheState ?? {
  inFlight: new Map(),
};

globalThis.__onemissionPromotionCacheState = globalPromotionCacheState;

export const PROMOTION_TYPE = {
  VOUCHER: 'VOUCHER',
  DISCOUNT_CAMPAIGN: 'DISCOUNT_CAMPAIGN',
  FREE_SHIPPING_CAMPAIGN: 'FREE_SHIPPING_CAMPAIGN',
};

export const PROMOTION_DISCOUNT_TYPE = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
  FREE_SHIPPING: 'FREE_SHIPPING',
};

export const PROMOTION_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export class PromotionError extends Error {
  constructor({ message, statusCode = 400, code = 'PROMOTION_ERROR' }) {
    super(message);
    this.name = 'PromotionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) {
    throw new PromotionError({
      message: 'Voucher Code is required.',
      statusCode: 400,
      code: 'PROMOTION_CODE_REQUIRED',
    });
  }
  return normalized;
}

function normalizeTitle(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new PromotionError({
      message: 'Title is required.',
      statusCode: 400,
      code: 'PROMOTION_TITLE_REQUIRED',
    });
  }
  return normalized;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeNonNegativeNumber(value, fieldLabel) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PromotionError({
      message: `${fieldLabel} must be a valid number.`,
      statusCode: 400,
      code: 'PROMOTION_NUMBER_INVALID',
    });
  }
  return parsed;
}

function normalizePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeOptionalDate(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new PromotionError({
      message: 'Date is invalid.',
      statusCode: 400,
      code: 'PROMOTION_DATE_INVALID',
    });
  }
  return parsed;
}

function normalizePromotionType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(PROMOTION_TYPE).includes(normalized) ? normalized : PROMOTION_TYPE.VOUCHER;
}

function normalizeDiscountType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!Object.values(PROMOTION_DISCOUNT_TYPE).includes(normalized)) {
    throw new PromotionError({
      message: 'Discount Type is invalid.',
      statusCode: 400,
      code: 'PROMOTION_DISCOUNT_TYPE_INVALID',
    });
  }
  return normalized;
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === PROMOTION_STATUS.INACTIVE ? PROMOTION_STATUS.INACTIVE : PROMOTION_STATUS.ACTIVE;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function buildHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function buildListCacheKey(query = {}) {
  return `${PROMOTION_CACHE_PREFIX}:list:${buildHash(JSON.stringify(query || {}))}`;
}

function buildDetailCacheKey(id) {
  return `${PROMOTION_CACHE_PREFIX}:detail:${id}`;
}

function buildCodeCacheKey(code) {
  return `${PROMOTION_CACHE_PREFIX}:code:${code}`;
}

function buildValidateCacheKey({ code, customerKey, subtotal, shippingCost }) {
  return `${PROMOTION_CACHE_PREFIX}:validate:${code}:${customerKey}:${subtotal}:${shippingCost}`;
}

async function getCachedPromotionValue(key, ttl, loader) {
  const cachedValue = await cache.get(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  if (globalPromotionCacheState.inFlight.has(key)) {
    return globalPromotionCacheState.inFlight.get(key);
  }

  const request = (async () => {
    try {
      const value = await loader();
      await cache.set(key, value, { ttl });
      return value;
    } finally {
      globalPromotionCacheState.inFlight.delete(key);
    }
  })();

  globalPromotionCacheState.inFlight.set(key, request);
  return request;
}

async function listCachedKeys(match) {
  const client = await getRedisClient();
  if (!client) return [];

  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await client.scan(cursor, {
      match,
      count: PROMOTION_CACHE_SCAN_COUNT,
    });
    cursor = String(nextCursor || '0');
    if (Array.isArray(batch) && batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');

  return keys;
}

export async function invalidatePromotionCache() {
  for (const key of globalPromotionCacheState.inFlight.keys()) {
    if (String(key).startsWith(`${PROMOTION_CACHE_PREFIX}:`)) {
      globalPromotionCacheState.inFlight.delete(key);
    }
  }

  const client = await getRedisClient();
  if (!client) return false;

  try {
    const keys = await listCachedKeys(`${PROMOTION_CACHE_PREFIX}:*`);
    for (let index = 0; index < keys.length; index += PROMOTION_CACHE_SCAN_COUNT) {
      const batch = keys.slice(index, index + PROMOTION_CACHE_SCAN_COUNT);
      if (batch.length > 0) {
        await client.del(...batch);
      }
    }
    return true;
  } catch (error) {
    console.warn('Promotion cache invalidation failed.', error);
    return false;
  }
}

function toPromotionResponse(promotion, usedCount = 0) {
  return {
    id: promotion.id,
    code: promotion.code,
    title: promotion.title,
    description: promotion.description || '',
    promotionType: promotion.promotionType,
    discountType: promotion.discountType,
    percentageValue: Number(promotion.percentageValue || 0),
    fixedAmount: Number(promotion.fixedAmount || 0),
    minimumPurchase: Number(promotion.minimumPurchase || 0),
    maximumDiscount: Number(promotion.maximumDiscount || 0),
    quota: Number(promotion.quota || 0),
    usedCount: Number(usedCount || 0),
    status: promotion.status,
    isPublic: Boolean(promotion.isPublic),
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
    deletedAt: promotion.deletedAt,
  };
}

function ensurePromotionEligibility(promotion) {
  if (!promotion || promotion.deletedAt) {
    throw new PromotionError({
      message: 'Voucher was not found.',
      statusCode: 404,
      code: 'PROMOTION_NOT_FOUND',
    });
  }

  if (promotion.status !== PROMOTION_STATUS.ACTIVE) {
    throw new PromotionError({
      message: 'Voucher is inactive.',
      statusCode: 400,
      code: 'PROMOTION_INACTIVE',
    });
  }

  const now = Date.now();
  if (promotion.startDate && new Date(promotion.startDate).getTime() > now) {
    throw new PromotionError({
      message: 'Voucher is not active yet.',
      statusCode: 400,
      code: 'PROMOTION_NOT_STARTED',
    });
  }
  if (promotion.endDate && new Date(promotion.endDate).getTime() < now) {
    throw new PromotionError({
      message: 'Voucher has expired.',
      statusCode: 400,
      code: 'PROMOTION_EXPIRED',
    });
  }
}

async function findPromotionByCode(code) {
  const normalizedCode = normalizeCode(code);
  return getCachedPromotionValue(buildCodeCacheKey(normalizedCode), PROMOTION_DETAIL_TTL_SECONDS, async () => (
    prisma.promotion.findFirst({
      where: {
        code: normalizedCode,
      },
    })
  ));
}

async function resolveCustomerForPromotionValidation({ customerId = '', customerEmail = '' } = {}) {
  const normalizedCustomerId = String(customerId || '').trim();
  if (normalizedCustomerId) {
    const customer = await prisma.customer.findUnique({ where: { id: normalizedCustomerId } });
    return customer || null;
  }

  const normalizedEmail = String(customerEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  return prisma.customer.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });
}

async function calculatePromotionPricing({ promotion, subtotal, shippingCost }) {
  const normalizedSubtotal = normalizeNonNegativeNumber(subtotal, 'Subtotal');
  const normalizedShippingCost = normalizeNonNegativeNumber(shippingCost, 'Shipping Cost');

  if (normalizedSubtotal < Number(promotion.minimumPurchase || 0)) {
    throw new PromotionError({
      message: `Minimum purchase is ${Number(promotion.minimumPurchase || 0).toLocaleString('id-ID')}.`,
      statusCode: 400,
      code: 'PROMOTION_MINIMUM_PURCHASE_NOT_MET',
    });
  }

  let discountAmount = 0;
  let shippingDiscountAmount = 0;

  if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.PERCENTAGE) {
    discountAmount = normalizedSubtotal * (Number(promotion.percentageValue || 0) / 100);
    if (Number(promotion.maximumDiscount || 0) > 0) {
      discountAmount = Math.min(discountAmount, Number(promotion.maximumDiscount || 0));
    }
  } else if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.FIXED) {
    discountAmount = Math.min(Number(promotion.fixedAmount || 0), normalizedSubtotal);
  } else if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.FREE_SHIPPING) {
    shippingDiscountAmount = normalizedShippingCost;
  }

  const finalShippingCost = Math.max(0, normalizedShippingCost - shippingDiscountAmount);
  const grandTotal = Math.max(0, normalizedSubtotal - discountAmount + finalShippingCost);
  const totalSavings = discountAmount + shippingDiscountAmount;

  return {
    subtotal: normalizedSubtotal,
    originalShippingCost: normalizedShippingCost,
    shippingCost: finalShippingCost,
    discountAmount,
    shippingDiscountAmount,
    totalSavings,
    grandTotal,
  };
}

function buildPromotionSnapshot({ promotion, pricing }) {
  return {
    id: promotion.id,
    code: promotion.code,
    title: promotion.title,
    description: promotion.description || '',
    promotionType: promotion.promotionType,
    discountType: promotion.discountType,
    percentageValue: Number(promotion.percentageValue || 0),
    fixedAmount: Number(promotion.fixedAmount || 0),
    minimumPurchase: Number(promotion.minimumPurchase || 0),
    maximumDiscount: Number(promotion.maximumDiscount || 0),
    isPublic: Boolean(promotion.isPublic),
    pricing,
    appliedAt: new Date().toISOString(),
  };
}

export const promotionService = {
  async listAdminPromotions({ query = {} } = {}) {
    const page = normalizePositiveInteger(query.page, 1, 1000);
    const limit = normalizePositiveInteger(query.limit, DEFAULT_ADMIN_PROMOTION_LIMIT, MAX_ADMIN_PROMOTION_LIMIT);
    const search = String(query.search || '').trim();
    const status = String(query.status || 'all').trim().toUpperCase();
    const promotionType = String(query.promotionType || 'all').trim().toUpperCase();
    const sortBy = String(query.sortBy || 'updatedAt').trim();
    const sortOrder = String(query.sortOrder || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = {
      deletedAt: null,
    };

    if (status !== 'ALL' && status) {
      where.status = status;
    }
    if (promotionType !== 'ALL' && promotionType) {
      where.promotionType = promotionType;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = buildListCacheKey({ page, limit, search, status, promotionType, sortBy, sortOrder });
    return getCachedPromotionValue(cacheKey, PROMOTION_LIST_TTL_SECONDS, async () => {
      const [totalItems, promotions] = await Promise.all([
        prisma.promotion.count({ where }),
        prisma.promotion.findMany({
          where,
          include: {
            _count: {
              select: { usages: true },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return {
        data: promotions.map((promotion) => toPromotionResponse(promotion, promotion._count?.usages || 0)),
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
          hasNextPage: (page * limit) < totalItems,
          hasPreviousPage: page > 1,
        },
      };
    });
  },

  async getAdminPromotionById(id) {
    const promotionId = String(id || '').trim();
    if (!promotionId) {
      throw new PromotionError({ message: 'Promotion id is required.', statusCode: 400, code: 'PROMOTION_ID_REQUIRED' });
    }

    return getCachedPromotionValue(buildDetailCacheKey(promotionId), PROMOTION_DETAIL_TTL_SECONDS, async () => {
      const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId },
        include: {
          _count: {
            select: { usages: true },
          },
        },
      });
      if (!promotion || promotion.deletedAt) {
        throw new PromotionError({ message: 'Promotion was not found.', statusCode: 404, code: 'PROMOTION_NOT_FOUND' });
      }
      return toPromotionResponse(promotion, promotion._count?.usages || 0);
    });
  },

  async createPromotion({ input } = {}) {
    const normalizedPromotionType = normalizePromotionType(input?.promotionType);
    const normalizedDiscountType = normalizeDiscountType(input?.discountType);
    const code = normalizeCode(input?.code);
    const title = normalizeTitle(input?.title);
    const description = normalizeString(input?.description);
    const percentageValue = normalizeNonNegativeNumber(input?.percentageValue, 'Percentage');
    const fixedAmount = normalizeNonNegativeNumber(input?.fixedAmount, 'Fixed Amount');
    const minimumPurchase = normalizeNonNegativeNumber(input?.minimumPurchase, 'Minimum Purchase');
    const maximumDiscount = normalizeNonNegativeNumber(input?.maximumDiscount, 'Maximum Discount');
    const quota = Math.trunc(normalizeNonNegativeNumber(input?.quota, 'Quota'));
    const status = normalizeStatus(input?.status);
    const isPublic = normalizeBoolean(input?.isPublic, true);
    const startDate = normalizeOptionalDate(input?.startDate);
    const endDate = normalizeOptionalDate(input?.endDate);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new PromotionError({ message: 'End Date must be later than Start Date.', statusCode: 400, code: 'PROMOTION_DATE_RANGE_INVALID' });
    }

    const existing = await prisma.promotion.findFirst({ where: { code } });
    if (existing && !existing.deletedAt) {
      throw new PromotionError({ message: 'Voucher Code already exists.', statusCode: 409, code: 'PROMOTION_CODE_EXISTS' });
    }

    const promotion = await prisma.promotion.create({
      data: {
        id: crypto.randomUUID(),
        code,
        title,
        description,
        promotionType: normalizedPromotionType,
        discountType: normalizedDiscountType,
        percentageValue,
        fixedAmount,
        minimumPurchase,
        maximumDiscount,
        quota,
        isPublic,
        status,
        startDate,
        endDate,
      },
      include: {
        _count: { select: { usages: true } },
      },
    });

    await invalidatePromotionCache();
    return toPromotionResponse(promotion, promotion._count?.usages || 0);
  },

  async updatePromotion({ id, input } = {}) {
    const promotionId = String(id || '').trim();
    if (!promotionId) {
      throw new PromotionError({ message: 'Promotion id is required.', statusCode: 400, code: 'PROMOTION_ID_REQUIRED' });
    }

    const normalizedPromotionType = normalizePromotionType(input?.promotionType);
    const normalizedDiscountType = normalizeDiscountType(input?.discountType);
    const code = normalizeCode(input?.code);
    const title = normalizeTitle(input?.title);
    const description = normalizeString(input?.description);
    const percentageValue = normalizeNonNegativeNumber(input?.percentageValue, 'Percentage');
    const fixedAmount = normalizeNonNegativeNumber(input?.fixedAmount, 'Fixed Amount');
    const minimumPurchase = normalizeNonNegativeNumber(input?.minimumPurchase, 'Minimum Purchase');
    const maximumDiscount = normalizeNonNegativeNumber(input?.maximumDiscount, 'Maximum Discount');
    const quota = Math.trunc(normalizeNonNegativeNumber(input?.quota, 'Quota'));
    const status = normalizeStatus(input?.status);
    const isPublic = normalizeBoolean(input?.isPublic, true);
    const startDate = normalizeOptionalDate(input?.startDate);
    const endDate = normalizeOptionalDate(input?.endDate);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new PromotionError({ message: 'End Date must be later than Start Date.', statusCode: 400, code: 'PROMOTION_DATE_RANGE_INVALID' });
    }

    const duplicate = await prisma.promotion.findFirst({
      where: {
        id: { not: promotionId },
        code,
      },
    });
    if (duplicate && !duplicate.deletedAt) {
      throw new PromotionError({ message: 'Voucher Code already exists.', statusCode: 409, code: 'PROMOTION_CODE_EXISTS' });
    }

    const promotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: {
        code,
        title,
        description,
        promotionType: normalizedPromotionType,
        discountType: normalizedDiscountType,
        percentageValue,
        fixedAmount,
        minimumPurchase,
        maximumDiscount,
        quota,
        isPublic,
        status,
        startDate,
        endDate,
      },
      include: {
        _count: { select: { usages: true } },
      },
    });

    await invalidatePromotionCache();
    return toPromotionResponse(promotion, promotion._count?.usages || 0);
  },

  async deactivatePromotion(id) {
    const promotionId = String(id || '').trim();
    if (!promotionId) {
      throw new PromotionError({ message: 'Promotion id is required.', statusCode: 400, code: 'PROMOTION_ID_REQUIRED' });
    }

    const promotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: { status: PROMOTION_STATUS.INACTIVE },
      include: {
        _count: { select: { usages: true } },
      },
    });
    await invalidatePromotionCache();
    return toPromotionResponse(promotion, promotion._count?.usages || 0);
  },

  async duplicatePromotion(id) {
    const promotionId = String(id || '').trim();
    if (!promotionId) {
      throw new PromotionError({ message: 'Promotion id is required.', statusCode: 400, code: 'PROMOTION_ID_REQUIRED' });
    }

    const source = await prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!source || source.deletedAt) {
      throw new PromotionError({ message: 'Promotion was not found.', statusCode: 404, code: 'PROMOTION_NOT_FOUND' });
    }

    let duplicateCode = `${source.code}-COPY`;
    let suffix = 1;
    while (await prisma.promotion.findFirst({ where: { code: duplicateCode } })) {
      suffix += 1;
      duplicateCode = `${source.code}-COPY-${suffix}`;
    }

    const promotion = await prisma.promotion.create({
      data: {
        id: crypto.randomUUID(),
        code: duplicateCode,
        title: `${source.title} (Copy)`,
        description: source.description,
        promotionType: source.promotionType,
        discountType: source.discountType,
        percentageValue: source.percentageValue,
        fixedAmount: source.fixedAmount,
        minimumPurchase: source.minimumPurchase,
        maximumDiscount: source.maximumDiscount,
        quota: source.quota,
        isPublic: source.isPublic,
        status: PROMOTION_STATUS.INACTIVE,
        startDate: source.startDate,
        endDate: source.endDate,
      },
      include: {
        _count: { select: { usages: true } },
      },
    });

    await invalidatePromotionCache();
    return toPromotionResponse(promotion, promotion._count?.usages || 0);
  },

  async deletePromotion(id) {
    const promotionId = String(id || '').trim();
    if (!promotionId) {
      throw new PromotionError({ message: 'Promotion id is required.', statusCode: 400, code: 'PROMOTION_ID_REQUIRED' });
    }

    const promotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: {
        status: PROMOTION_STATUS.INACTIVE,
        deletedAt: new Date(),
      },
      include: {
        _count: { select: { usages: true } },
      },
    });
    await invalidatePromotionCache();
    return toPromotionResponse(promotion, promotion._count?.usages || 0);
  },

  async validatePromotionPreview({ code, customerId = '', customerEmail = '', subtotal = 0, shippingCost = 0 } = {}) {
    const normalizedCode = normalizeCode(code);
    const normalizedSubtotal = normalizeNonNegativeNumber(subtotal, 'Subtotal');
    const normalizedShippingCost = normalizeNonNegativeNumber(shippingCost, 'Shipping Cost');
    const customer = await resolveCustomerForPromotionValidation({ customerId, customerEmail });
    const customerKey = String(customer?.id || customerEmail || 'guest').trim().toLowerCase() || 'guest';
    const cacheKey = buildValidateCacheKey({
      code: normalizedCode,
      customerKey,
      subtotal: normalizedSubtotal,
      shippingCost: normalizedShippingCost,
    });

    return getCachedPromotionValue(cacheKey, PROMOTION_VALIDATE_TTL_SECONDS, async () => {
      const promotion = await findPromotionByCode(normalizedCode);
      ensurePromotionEligibility(promotion);

      const usedCount = await prisma.promotionUsage.count({ where: { promotionId: promotion.id } });
      if (Number(promotion.quota || 0) > 0 && usedCount >= Number(promotion.quota || 0)) {
        throw new PromotionError({
          message: 'Voucher quota has been reached.',
          statusCode: 400,
          code: 'PROMOTION_QUOTA_EXCEEDED',
        });
      }

      if (customer?.id) {
        const existingUsage = await prisma.promotionUsage.findFirst({
          where: {
            promotionId: promotion.id,
            customerId: customer.id,
          },
          select: { id: true },
        });
        if (existingUsage) {
          throw new PromotionError({
            message: 'This voucher has already been used by this customer.',
            statusCode: 400,
            code: 'PROMOTION_ALREADY_USED',
          });
        }
      }

      const pricing = await calculatePromotionPricing({
        promotion,
        subtotal: normalizedSubtotal,
        shippingCost: normalizedShippingCost,
      });

      return {
        promotion: toPromotionResponse(promotion, usedCount),
        pricing,
      };
    });
  },

  async buildPromotionSnapshotForCheckout({ code = '', customerId = '', customerEmail = '', subtotal = 0, shippingCost = 0 } = {}) {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) {
      return null;
    }

    const validation = await this.validatePromotionPreview({
      code: normalizedCode,
      customerId,
      customerEmail,
      subtotal,
      shippingCost,
    });

    return buildPromotionSnapshot({
      promotion: validation.promotion,
      pricing: validation.pricing,
    });
  },

  async registerPromotionUsage({ promotionSnapshot = null, customerId = '', orderId = '' } = {}) {
    const promotionId = String(promotionSnapshot?.id || '').trim();
    const normalizedCustomerId = String(customerId || '').trim();
    const normalizedOrderId = String(orderId || '').trim();

    if (!promotionId || !normalizedCustomerId || !normalizedOrderId) {
      return null;
    }

    const existingUsage = await prisma.promotionUsage.findFirst({
      where: {
        promotionId,
        customerId: normalizedCustomerId,
      },
    });

    if (existingUsage) {
      return existingUsage;
    }

    const usage = await prisma.promotionUsage.create({
      data: {
        id: crypto.randomUUID(),
        promotionId,
        customerId: normalizedCustomerId,
        orderId: normalizedOrderId,
      },
    });

    await invalidatePromotionCache();
    return usage;
  },
};

export function normalizePromotionError(error) {
  if (error instanceof PromotionError) {
    return error;
  }

  return new PromotionError({
    message: 'Promotion request could not be completed.',
    statusCode: 500,
    code: 'PROMOTION_INTERNAL_ERROR',
  });
}
