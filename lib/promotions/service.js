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
  AUTOMATIC_DISCOUNT: 'AUTOMATIC_DISCOUNT',
  FREE_SHIPPING: 'FREE_SHIPPING',
};

const LEGACY_PROMOTION_TYPE_MAP = {
  DISCOUNT_CAMPAIGN: PROMOTION_TYPE.AUTOMATIC_DISCOUNT,
  FREE_SHIPPING_CAMPAIGN: PROMOTION_TYPE.FREE_SHIPPING,
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

export const PROMOTION_TARGET_SCOPE = {
  ENTIRE_STORE: 'ENTIRE_STORE',
  SPECIFIC_PRODUCT: 'SPECIFIC_PRODUCT',
  SPECIFIC_CATEGORY: 'SPECIFIC_CATEGORY',
  SELECTED_PRODUCTS: 'SELECTED_PRODUCTS',
};

export class PromotionError extends Error {
  constructor({ message, statusCode = 400, code = 'PROMOTION_ERROR' }) {
    super(message);
    this.name = 'PromotionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeCode(value, { required = true, prefix = 'PROMO' } = {}) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized && required) {
    throw new PromotionError({
      message: 'Voucher Code is required.',
      statusCode: 400,
      code: 'PROMOTION_CODE_REQUIRED',
    });
  }
  return normalized || `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeTitle(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new PromotionError({
      message: 'Internal Name is required.',
      statusCode: 400,
      code: 'PROMOTION_TITLE_REQUIRED',
    });
  }
  return normalized;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
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
  const mapped = LEGACY_PROMOTION_TYPE_MAP[normalized] || normalized;
  return Object.values(PROMOTION_TYPE).includes(mapped) ? mapped : PROMOTION_TYPE.VOUCHER;
}

function normalizeDiscountType(value, promotionType = PROMOTION_TYPE.VOUCHER) {
  if (promotionType === PROMOTION_TYPE.FREE_SHIPPING) {
    return PROMOTION_DISCOUNT_TYPE.FREE_SHIPPING;
  }

  const normalized = String(value || '').trim().toUpperCase();
  if (!Object.values(PROMOTION_DISCOUNT_TYPE).includes(normalized)) {
    throw new PromotionError({
      message: 'Discount Type is invalid.',
      statusCode: 400,
      code: 'PROMOTION_DISCOUNT_TYPE_INVALID',
    });
  }

  if (promotionType === PROMOTION_TYPE.AUTOMATIC_DISCOUNT && normalized === PROMOTION_DISCOUNT_TYPE.FREE_SHIPPING) {
    throw new PromotionError({
      message: 'Automatic Discount supports Percentage or Fixed Amount only.',
      statusCode: 400,
      code: 'PROMOTION_DISCOUNT_TYPE_INVALID',
    });
  }

  return normalized;
}

function normalizeTargetScope(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(PROMOTION_TARGET_SCOPE).includes(normalized)
    ? normalized
    : PROMOTION_TARGET_SCOPE.ENTIRE_STORE;
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

function buildValidateCacheKey(input) {
  return `${PROMOTION_CACHE_PREFIX}:validate:${buildHash(JSON.stringify(input || {}))}`;
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

function normalizePromotionRecord(promotion = {}) {
  return {
    ...promotion,
    promotionType: normalizePromotionType(promotion.promotionType),
    targetScope: normalizeTargetScope(promotion.targetScope),
    targetProductIds: normalizeStringArray(promotion.targetProductIds),
    targetCategories: normalizeStringArray(promotion.targetCategories),
    courierRestrictions: normalizeStringArray(promotion.courierRestrictions),
    usageLimitPerCustomer: Number(promotion.usageLimitPerCustomer || 0),
    maximumShippingSubsidy: Number(promotion.maximumShippingSubsidy || 0),
  };
}

function toPromotionResponse(promotion, usedCount = 0) {
  const normalized = normalizePromotionRecord(promotion);
  return {
    id: normalized.id,
    code: normalized.code,
    title: normalized.title,
    description: normalized.description || '',
    promotionType: normalized.promotionType,
    discountType: normalized.discountType,
    percentageValue: Number(normalized.percentageValue || 0),
    fixedAmount: Number(normalized.fixedAmount || 0),
    minimumPurchase: Number(normalized.minimumPurchase || 0),
    maximumDiscount: Number(normalized.maximumDiscount || 0),
    maximumShippingSubsidy: Number(normalized.maximumShippingSubsidy || 0),
    quota: Number(normalized.quota || 0),
    usedCount: Number(usedCount || 0),
    usageLimitPerCustomer: Number(normalized.usageLimitPerCustomer || 0),
    targetScope: normalized.targetScope,
    targetProductIds: normalized.targetProductIds,
    targetCategories: normalized.targetCategories,
    courierRestrictions: normalized.courierRestrictions,
    status: normalized.status,
    isPublic: Boolean(normalized.isPublic),
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    deletedAt: normalized.deletedAt,
  };
}

function ensurePromotionEligibility(promotion) {
  if (!promotion || promotion.deletedAt) {
    throw new PromotionError({
      message: 'Promotion was not found.',
      statusCode: 404,
      code: 'PROMOTION_NOT_FOUND',
    });
  }

  if (promotion.status !== PROMOTION_STATUS.ACTIVE) {
    throw new PromotionError({
      message: 'Promotion is inactive.',
      statusCode: 400,
      code: 'PROMOTION_INACTIVE',
    });
  }

  const now = Date.now();
  if (promotion.startDate && new Date(promotion.startDate).getTime() > now) {
    throw new PromotionError({
      message: 'Promotion is not active yet.',
      statusCode: 400,
      code: 'PROMOTION_NOT_STARTED',
    });
  }
  if (promotion.endDate && new Date(promotion.endDate).getTime() < now) {
    throw new PromotionError({
      message: 'Promotion has expired.',
      statusCode: 400,
      code: 'PROMOTION_EXPIRED',
    });
  }
}

function validatePromotionAmounts({ promotionType, discountType, percentageValue, fixedAmount }) {
  if (discountType === PROMOTION_DISCOUNT_TYPE.PERCENTAGE && (percentageValue < 1 || percentageValue > 100)) {
    throw new PromotionError({
      message: 'Percentage must be between 1 and 100.',
      statusCode: 400,
      code: 'PROMOTION_PERCENTAGE_INVALID',
    });
  }

  if (discountType === PROMOTION_DISCOUNT_TYPE.FIXED && fixedAmount <= 0) {
    throw new PromotionError({
      message: 'Fixed Amount must be greater than 0.',
      statusCode: 400,
      code: 'PROMOTION_FIXED_AMOUNT_INVALID',
    });
  }

  if (promotionType === PROMOTION_TYPE.FREE_SHIPPING && discountType !== PROMOTION_DISCOUNT_TYPE.FREE_SHIPPING) {
    throw new PromotionError({
      message: 'Free Shipping promotions must use Free Shipping discount type.',
      statusCode: 400,
      code: 'PROMOTION_DISCOUNT_TYPE_INVALID',
    });
  }
}

async function findPromotionByCode(code) {
  const normalizedCode = normalizeCode(code);
  return getCachedPromotionValue(buildCodeCacheKey(normalizedCode), PROMOTION_DETAIL_TTL_SECONDS, async () => (
    prisma.promotion.findFirst({
      where: {
        code: normalizedCode,
        deletedAt: null,
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

async function loadPromotionItems(items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  if (normalizedItems.length === 0) return [];

  const productIds = [...new Set(normalizedItems.map((item) => String(item.productId || '').trim()).filter(Boolean))];
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: true, sellingPrice: true },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  return normalizedItems.map((item) => {
    const productId = String(item.productId || '').trim();
    const product = productMap.get(productId) || null;
    const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
    const trustedSubtotal = Number(item.subtotal);
    const subtotal = Number.isFinite(trustedSubtotal) && trustedSubtotal >= 0
      ? trustedSubtotal
      : (Number(product?.sellingPrice || item.price || 0) * qty);
    return {
      productId,
      category: String(item.category || product?.category || '').trim(),
      qty,
      subtotal,
    };
  });
}

function getTargetSubtotal(promotion, items, fallbackSubtotal) {
  const normalizedPromotion = normalizePromotionRecord(promotion);
  const normalizedSubtotal = Number(fallbackSubtotal || 0);
  const normalizedItems = Array.isArray(items) ? items : [];

  if (normalizedPromotion.targetScope === PROMOTION_TARGET_SCOPE.ENTIRE_STORE || normalizedItems.length === 0) {
    return normalizedSubtotal;
  }

  if (normalizedPromotion.targetScope === PROMOTION_TARGET_SCOPE.SPECIFIC_PRODUCT) {
    const targetProductId = normalizedPromotion.targetProductIds[0] || '';
    return normalizedItems
      .filter((item) => item.productId === targetProductId)
      .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  }

  if (normalizedPromotion.targetScope === PROMOTION_TARGET_SCOPE.SELECTED_PRODUCTS) {
    const targetProductIds = new Set(normalizedPromotion.targetProductIds);
    return normalizedItems
      .filter((item) => targetProductIds.has(item.productId))
      .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  }

  if (normalizedPromotion.targetScope === PROMOTION_TARGET_SCOPE.SPECIFIC_CATEGORY) {
    const targetCategories = new Set(normalizedPromotion.targetCategories.map((entry) => entry.toLowerCase()));
    return normalizedItems
      .filter((item) => targetCategories.has(String(item.category || '').toLowerCase()))
      .reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  }

  return normalizedSubtotal;
}

function promotionTargetsCart(promotion, items, subtotal) {
  return getTargetSubtotal(promotion, items, subtotal) > 0;
}

async function assertPromotionUsageAvailable({ promotion, customer }) {
  const usedCount = await prisma.promotionUsage.count({ where: { promotionId: promotion.id } });
  if (Number(promotion.quota || 0) > 0 && usedCount >= Number(promotion.quota || 0)) {
    throw new PromotionError({
      message: 'Promotion quota has been reached.',
      statusCode: 400,
      code: 'PROMOTION_QUOTA_EXCEEDED',
    });
  }

  if (customer?.id && Number(promotion.usageLimitPerCustomer || 0) > 0) {
    const customerUsedCount = await prisma.promotionUsage.count({
      where: {
        promotionId: promotion.id,
        customerId: customer.id,
      },
    });
    if (customerUsedCount >= Number(promotion.usageLimitPerCustomer || 0)) {
      throw new PromotionError({
        message: 'This promotion usage limit has been reached for this customer.',
        statusCode: 400,
        code: 'PROMOTION_USAGE_LIMIT_REACHED',
      });
    }
  }

  return usedCount;
}

function calculateDiscountForPromotion({ promotion, amount }) {
  const eligibleAmount = Math.max(0, Number(amount || 0));
  if (eligibleAmount <= 0) return 0;

  if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.PERCENTAGE) {
    let discountAmount = eligibleAmount * (Number(promotion.percentageValue || 0) / 100);
    if (Number(promotion.maximumDiscount || 0) > 0) {
      discountAmount = Math.min(discountAmount, Number(promotion.maximumDiscount || 0));
    }
    return Math.min(discountAmount, eligibleAmount);
  }

  if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.FIXED) {
    return Math.min(Number(promotion.fixedAmount || 0), eligibleAmount);
  }

  return 0;
}

function calculateShippingDiscountForPromotion({ promotion, shippingCost }) {
  const normalizedShippingCost = Math.max(0, Number(shippingCost || 0));
  const maximumShippingSubsidy = Number(promotion.maximumShippingSubsidy || 0);
  return maximumShippingSubsidy > 0
    ? Math.min(normalizedShippingCost, maximumShippingSubsidy)
    : normalizedShippingCost;
}

function buildAppliedPromotion({ promotion, amount = 0, shippingAmount = 0, voucherCode = '' }) {
  return {
    id: promotion.id,
    code: promotion.code,
    title: promotion.title,
    description: promotion.description || '',
    promotionType: promotion.promotionType,
    discountType: promotion.discountType,
    discountAmount: Number(amount || 0),
    shippingDiscountAmount: Number(shippingAmount || 0),
    voucherCode: voucherCode || (promotion.promotionType === PROMOTION_TYPE.VOUCHER ? promotion.code : ''),
  };
}

function buildPricing({ subtotal, shippingCost, automaticDiscountAmount, voucherDiscountAmount, shippingDiscountAmount }) {
  const discountAmount = Number(automaticDiscountAmount || 0) + Number(voucherDiscountAmount || 0);
  const finalShippingCost = Math.max(0, Number(shippingCost || 0) - Number(shippingDiscountAmount || 0));
  const grandTotal = Math.max(0, Number(subtotal || 0) - discountAmount + finalShippingCost);
  return {
    subtotal: Number(subtotal || 0),
    originalShippingCost: Number(shippingCost || 0),
    shippingCost: finalShippingCost,
    automaticDiscountAmount: Number(automaticDiscountAmount || 0),
    voucherDiscountAmount: Number(voucherDiscountAmount || 0),
    discountAmount,
    shippingDiscountAmount: Number(shippingDiscountAmount || 0),
    totalSavings: discountAmount + Number(shippingDiscountAmount || 0),
    grandTotal,
  };
}

function buildPromotionSnapshot({ appliedPromotions, pricing }) {
  const applied = Array.isArray(appliedPromotions) ? appliedPromotions : [];
  const primary = applied.find((entry) => entry.promotionType === PROMOTION_TYPE.VOUCHER) || applied[0] || null;
  const voucher = applied.find((entry) => entry.promotionType === PROMOTION_TYPE.VOUCHER) || null;
  return {
    id: primary?.id || '',
    code: primary?.code || '',
    title: primary?.title || '',
    description: primary?.description || '',
    promotionName: primary?.title || '',
    promotionType: primary?.promotionType || '',
    discountType: primary?.discountType || '',
    voucherCode: voucher?.voucherCode || '',
    discountAmount: Number(pricing.discountAmount || 0),
    freeShippingAmount: Number(pricing.shippingDiscountAmount || 0),
    appliedPromotions: applied,
    pricing,
    appliedAt: new Date().toISOString(),
  };
}

function buildEmptyPricing({ subtotal, shippingCost }) {
  return buildPricing({
    subtotal,
    shippingCost,
    automaticDiscountAmount: 0,
    voucherDiscountAmount: 0,
    shippingDiscountAmount: 0,
  });
}

function normalizePromotionPayload(input = {}) {
  const promotionType = normalizePromotionType(input.promotionType);
  const discountType = normalizeDiscountType(input.discountType, promotionType);
  const codePrefix = promotionType === PROMOTION_TYPE.FREE_SHIPPING ? 'SHIP' : 'AUTO';
  const code = normalizeCode(input.code, { required: promotionType === PROMOTION_TYPE.VOUCHER, prefix: codePrefix });
  const title = normalizeTitle(input.title || input.name);
  const description = normalizeString(input.description);
  const percentageValue = normalizeNonNegativeNumber(input.percentageValue, 'Percentage');
  const fixedAmount = normalizeNonNegativeNumber(input.fixedAmount, 'Fixed Amount');
  const minimumPurchase = normalizeNonNegativeNumber(input.minimumPurchase, 'Minimum Purchase');
  const maximumDiscount = normalizeNonNegativeNumber(input.maximumDiscount, 'Maximum Discount');
  const maximumShippingSubsidy = normalizeNonNegativeNumber(input.maximumShippingSubsidy ?? input.maximumShippingCovered, 'Maximum Shipping Covered');
  const quota = Math.trunc(normalizeNonNegativeNumber(input.quota, 'Quota'));
  const usageLimitPerCustomer = Math.trunc(normalizeNonNegativeNumber(input.usageLimitPerCustomer, 'Usage Limit Per Customer'));
  const targetScope = promotionType === PROMOTION_TYPE.VOUCHER
    ? PROMOTION_TARGET_SCOPE.ENTIRE_STORE
    : normalizeTargetScope(input.targetScope || input.applyTo);
  const targetProductIds = normalizeStringArray(input.targetProductIds || input.selectedProductIds || input.productIds);
  const targetCategories = normalizeStringArray(input.targetCategories || input.category || input.categories);
  const courierRestrictions = normalizeStringArray(input.courierRestrictions || input.courierRestriction);
  const status = normalizeStatus(input.status);
  const isPublic = normalizeBoolean(input.isPublic, promotionType !== PROMOTION_TYPE.VOUCHER);
  const startDate = normalizeOptionalDate(input.startDate);
  const endDate = normalizeOptionalDate(input.endDate);

  validatePromotionAmounts({ promotionType, discountType, percentageValue, fixedAmount });

  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new PromotionError({ message: 'End Date must be later than Start Date.', statusCode: 400, code: 'PROMOTION_DATE_RANGE_INVALID' });
  }

  return {
    code,
    title,
    description,
    promotionType,
    discountType,
    percentageValue,
    fixedAmount,
    minimumPurchase,
    maximumDiscount,
    maximumShippingSubsidy,
    quota,
    usageLimitPerCustomer,
    targetScope,
    targetProductIds,
    targetCategories,
    courierRestrictions,
    isPublic,
    status,
    startDate,
    endDate,
  };
}

async function getEligiblePromotions({ promotionType, customer, subtotal, shippingCost, items, courier }) {
  const promotions = await prisma.promotion.findMany({
    where: {
      promotionType,
      status: PROMOTION_STATUS.ACTIVE,
      deletedAt: null,
    },
    include: {
      _count: { select: { usages: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  const eligible = [];
  for (const promotionRecord of promotions) {
    const promotion = normalizePromotionRecord(promotionRecord);
    try {
      ensurePromotionEligibility(promotion);
      const usedCount = await assertPromotionUsageAvailable({ promotion, customer });
      const minimumBasis = promotionType === PROMOTION_TYPE.FREE_SHIPPING ? Math.max(0, subtotal) : subtotal;
      if (minimumBasis < Number(promotion.minimumPurchase || 0)) {
        continue;
      }
      if (promotionType !== PROMOTION_TYPE.FREE_SHIPPING && !promotionTargetsCart(promotion, items, subtotal)) {
        continue;
      }
      if (promotionType === PROMOTION_TYPE.FREE_SHIPPING) {
        const restrictions = normalizeStringArray(promotion.courierRestrictions).map((entry) => entry.toLowerCase());
        if (restrictions.length > 0 && !restrictions.includes(String(courier || '').trim().toLowerCase())) {
          continue;
        }
        if (shippingCost <= 0) {
          continue;
        }
      }
      eligible.push({ ...promotion, usedCount });
    } catch {
      // Skip ineligible automatic promotions. Manual voucher validation returns explicit errors elsewhere.
    }
  }

  return eligible;
}

async function calculatePromotionEnginePricing({ code = '', customerId = '', customerEmail = '', subtotal = 0, shippingCost = 0, items = [], courier = '' } = {}) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedSubtotal = normalizeNonNegativeNumber(subtotal, 'Subtotal');
  const normalizedShippingCost = normalizeNonNegativeNumber(shippingCost, 'Shipping Cost');
  const customer = await resolveCustomerForPromotionValidation({ customerId, customerEmail });
  const loadedItems = await loadPromotionItems(items);
  const appliedPromotions = [];

  let automaticDiscountAmount = 0;
  let voucherDiscountAmount = 0;
  let shippingDiscountAmount = 0;

  const automaticPromotions = await getEligiblePromotions({
    promotionType: PROMOTION_TYPE.AUTOMATIC_DISCOUNT,
    customer,
    subtotal: normalizedSubtotal,
    shippingCost: normalizedShippingCost,
    items: loadedItems,
    courier,
  });

  let bestAutomatic = null;
  for (const promotion of automaticPromotions) {
    const targetSubtotal = getTargetSubtotal(promotion, loadedItems, normalizedSubtotal);
    const amount = calculateDiscountForPromotion({ promotion, amount: targetSubtotal });
    if (!bestAutomatic || amount > bestAutomatic.amount) {
      bestAutomatic = { promotion, amount };
    }
  }

  if (bestAutomatic?.amount > 0) {
    automaticDiscountAmount = bestAutomatic.amount;
    appliedPromotions.push(buildAppliedPromotion({
      promotion: bestAutomatic.promotion,
      amount: automaticDiscountAmount,
    }));
  }

  if (normalizedCode) {
    const voucherRecord = await findPromotionByCode(normalizedCode);
    ensurePromotionEligibility(voucherRecord);
    const voucher = normalizePromotionRecord(voucherRecord);
    if (voucher.promotionType !== PROMOTION_TYPE.VOUCHER) {
      throw new PromotionError({
        message: 'Invalid voucher code.',
        statusCode: 400,
        code: 'PROMOTION_INVALID_CODE',
      });
    }
    const usedCount = await assertPromotionUsageAvailable({ promotion: voucher, customer });
    const voucherBasis = Math.max(0, normalizedSubtotal - automaticDiscountAmount);
    if (voucherBasis < Number(voucher.minimumPurchase || 0)) {
      throw new PromotionError({
        message: `Minimum purchase is ${Number(voucher.minimumPurchase || 0).toLocaleString('id-ID')}.`,
        statusCode: 400,
        code: 'PROMOTION_MINIMUM_PURCHASE_NOT_MET',
      });
    }

    if (voucher.discountType === PROMOTION_DISCOUNT_TYPE.FREE_SHIPPING) {
      shippingDiscountAmount = calculateShippingDiscountForPromotion({ promotion: voucher, shippingCost: normalizedShippingCost });
      appliedPromotions.push(buildAppliedPromotion({
        promotion: { ...voucher, usedCount },
        shippingAmount: shippingDiscountAmount,
        voucherCode: normalizedCode,
      }));
    } else {
      voucherDiscountAmount = calculateDiscountForPromotion({ promotion: voucher, amount: voucherBasis });
      appliedPromotions.push(buildAppliedPromotion({
        promotion: { ...voucher, usedCount },
        amount: voucherDiscountAmount,
        voucherCode: normalizedCode,
      }));
    }
  }

  const discountedSubtotal = Math.max(0, normalizedSubtotal - automaticDiscountAmount - voucherDiscountAmount);
  const freeShippingPromotions = await getEligiblePromotions({
    promotionType: PROMOTION_TYPE.FREE_SHIPPING,
    customer,
    subtotal: discountedSubtotal,
    shippingCost: normalizedShippingCost,
    items: loadedItems,
    courier,
  });

  let bestFreeShipping = null;
  for (const promotion of freeShippingPromotions) {
    if (discountedSubtotal < Number(promotion.minimumPurchase || 0)) {
      continue;
    }
    const amount = calculateShippingDiscountForPromotion({ promotion, shippingCost: normalizedShippingCost });
    if (!bestFreeShipping || amount > bestFreeShipping.amount) {
      bestFreeShipping = { promotion, amount };
    }
  }

  if (bestFreeShipping?.amount > shippingDiscountAmount) {
    // A free-shipping voucher should not stack with an automatic free-shipping promo. Keep the best shipping subsidy.
    shippingDiscountAmount = bestFreeShipping.amount;
    appliedPromotions.push(buildAppliedPromotion({
      promotion: bestFreeShipping.promotion,
      shippingAmount: bestFreeShipping.amount,
    }));
  }

  const pricing = buildPricing({
    subtotal: normalizedSubtotal,
    shippingCost: normalizedShippingCost,
    automaticDiscountAmount,
    voucherDiscountAmount,
    shippingDiscountAmount,
  });

  return {
    appliedPromotions,
    pricing,
  };
}

export const promotionService = {
  async listAdminPromotions({ query = {} } = {}) {
    const page = normalizePositiveInteger(query.page, 1, 1000);
    const limit = normalizePositiveInteger(query.limit, DEFAULT_ADMIN_PROMOTION_LIMIT, MAX_ADMIN_PROMOTION_LIMIT);
    const search = String(query.search || '').trim();
    const status = String(query.status || 'all').trim().toUpperCase();
    const promotionType = normalizePromotionType(query.promotionType || 'all');
    const rawPromotionType = String(query.promotionType || 'all').trim().toUpperCase();
    const sortBy = ['updatedAt', 'createdAt', 'title', 'code', 'startDate', 'endDate'].includes(String(query.sortBy || '').trim())
      ? String(query.sortBy || '').trim()
      : 'updatedAt';
    const sortOrder = String(query.sortOrder || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = {
      deletedAt: null,
    };

    if (status !== 'ALL' && status) {
      where.status = status;
    }
    if (rawPromotionType !== 'ALL' && rawPromotionType) {
      where.promotionType = promotionType;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = buildListCacheKey({ page, limit, search, status, promotionType: rawPromotionType, sortBy, sortOrder });
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
    const payload = normalizePromotionPayload(input);
    const existing = await prisma.promotion.findFirst({ where: { code: payload.code } });
    if (existing && !existing.deletedAt) {
      throw new PromotionError({ message: 'Voucher Code already exists.', statusCode: 409, code: 'PROMOTION_CODE_EXISTS' });
    }

    const promotion = await prisma.promotion.create({
      data: {
        id: crypto.randomUUID(),
        ...payload,
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

    const payload = normalizePromotionPayload(input);
    const duplicate = await prisma.promotion.findFirst({
      where: {
        id: { not: promotionId },
        code: payload.code,
        deletedAt: null,
      },
    });
    if (duplicate) {
      throw new PromotionError({ message: 'Voucher Code already exists.', statusCode: 409, code: 'PROMOTION_CODE_EXISTS' });
    }

    const promotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: payload,
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
        promotionType: normalizePromotionType(source.promotionType),
        discountType: source.discountType,
        percentageValue: source.percentageValue,
        fixedAmount: source.fixedAmount,
        minimumPurchase: source.minimumPurchase,
        maximumDiscount: source.maximumDiscount,
        maximumShippingSubsidy: source.maximumShippingSubsidy || 0,
        quota: source.quota,
        usageLimitPerCustomer: source.usageLimitPerCustomer || 0,
        targetScope: source.targetScope || PROMOTION_TARGET_SCOPE.ENTIRE_STORE,
        targetProductIds: source.targetProductIds || [],
        targetCategories: source.targetCategories || [],
        courierRestrictions: source.courierRestrictions || [],
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

  async validatePromotionPreview({ code = '', customerId = '', customerEmail = '', subtotal = 0, shippingCost = 0, items = [], courier = '' } = {}) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const normalizedSubtotal = normalizeNonNegativeNumber(subtotal, 'Subtotal');
    const normalizedShippingCost = normalizeNonNegativeNumber(shippingCost, 'Shipping Cost');
    const customer = await resolveCustomerForPromotionValidation({ customerId, customerEmail });
    const customerKey = String(customer?.id || customerEmail || 'guest').trim().toLowerCase() || 'guest';
    const cacheKey = buildValidateCacheKey({
      code: normalizedCode,
      customerKey,
      subtotal: normalizedSubtotal,
      shippingCost: normalizedShippingCost,
      items: (items || []).map((item) => ({
        productId: item.productId,
        qty: item.qty ?? item.quantity,
        subtotal: item.subtotal,
        category: item.category,
      })),
      courier,
    });

    return getCachedPromotionValue(cacheKey, PROMOTION_VALIDATE_TTL_SECONDS, async () => {
      const result = await calculatePromotionEnginePricing({
        code: normalizedCode,
        customerId: customer?.id || '',
        customerEmail,
        subtotal: normalizedSubtotal,
        shippingCost: normalizedShippingCost,
        items,
        courier,
      });

      const primary = result.appliedPromotions.find((entry) => entry.promotionType === PROMOTION_TYPE.VOUCHER)
        || result.appliedPromotions[0]
        || null;

      if (normalizedCode && !primary) {
        throw new PromotionError({ message: 'Invalid voucher code.', statusCode: 404, code: 'PROMOTION_NOT_FOUND' });
      }

      return {
        promotion: primary,
        promotions: result.appliedPromotions,
        pricing: result.pricing,
      };
    });
  },

  async buildPromotionSnapshotForCheckout({ code = '', customerId = '', customerEmail = '', subtotal = 0, shippingCost = 0, items = [], courier = '' } = {}) {
    const result = await calculatePromotionEnginePricing({
      code,
      customerId,
      customerEmail,
      subtotal,
      shippingCost,
      items,
      courier,
    });

    if (result.appliedPromotions.length === 0) {
      return null;
    }

    return buildPromotionSnapshot({
      appliedPromotions: result.appliedPromotions,
      pricing: result.pricing,
    });
  },

  async registerPromotionUsage({ promotionSnapshot = null, customerId = '', orderId = '' } = {}) {
    const normalizedCustomerId = String(customerId || '').trim();
    const normalizedOrderId = String(orderId || '').trim();
    const appliedPromotions = Array.isArray(promotionSnapshot?.appliedPromotions)
      ? promotionSnapshot.appliedPromotions
      : (promotionSnapshot?.id ? [promotionSnapshot] : []);

    if (!normalizedCustomerId || !normalizedOrderId || appliedPromotions.length === 0) {
      return null;
    }

    const usages = [];
    for (const appliedPromotion of appliedPromotions) {
      const promotionId = String(appliedPromotion?.id || '').trim();
      if (!promotionId) continue;

      const existingUsage = await prisma.promotionUsage.findFirst({
        where: {
          promotionId,
          customerId: normalizedCustomerId,
          orderId: normalizedOrderId,
        },
      });

      if (existingUsage) {
        usages.push(existingUsage);
        continue;
      }

      const usage = await prisma.promotionUsage.create({
        data: {
          id: crypto.randomUUID(),
          promotionId,
          customerId: normalizedCustomerId,
          orderId: normalizedOrderId,
        },
      });
      usages.push(usage);
    }

    if (usages.length > 0) {
      await invalidatePromotionCache();
    }
    return usages;
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
