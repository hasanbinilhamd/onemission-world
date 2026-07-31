import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';
import { ORDER_STATUS, getSynchronizedOrderStatus } from '@/lib/order/lifecycle';
import { writeAuditLog } from '@/lib/hq-security';

const PRODUCT_REVIEW_CACHE_PREFIX = 'product-reviews';
const PRODUCT_REVIEW_SUMMARY_CACHE_PREFIX = 'product-review-summary';
const PRODUCT_REVIEW_LIST_TTL_SECONDS = 10 * 60;
const PRODUCT_REVIEW_SUMMARY_TTL_SECONDS = 10 * 60;
const DEFAULT_REVIEW_PAGE = 1;
const DEFAULT_REVIEW_LIMIT = 10;
const MAX_REVIEW_LIMIT = 50;
const DEFAULT_ADMIN_REVIEW_LIMIT = 20;
const MAX_ADMIN_REVIEW_LIMIT = 100;

const globalProductReviewCacheState = globalThis.__onemissionProductReviewCacheState ?? {
  inFlight: new Map(),
};

globalThis.__onemissionProductReviewCacheState = globalProductReviewCacheState;

export class ProductReviewError extends Error {
  constructor({ message, statusCode = 400, code = 'PRODUCT_REVIEW_ERROR' }) {
    super(message);
    this.name = 'ProductReviewError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function normalizeReviewTitle(value) {
  return String(value || '').trim();
}

function normalizeReviewComment(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ProductReviewError({
      message: 'Comment is required.',
      statusCode: 400,
      code: 'PRODUCT_REVIEW_COMMENT_REQUIRED',
    });
  }

  return normalized;
}

function normalizeReviewRating(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new ProductReviewError({
      message: 'Rating must be between 1 and 5.',
      statusCode: 400,
      code: 'PRODUCT_REVIEW_RATING_INVALID',
    });
  }

  return parsed;
}

function normalizeReviewProductId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ProductReviewError({
      message: 'productId is required.',
      statusCode: 400,
      code: 'PRODUCT_REVIEW_PRODUCT_REQUIRED',
    });
  }

  return normalized;
}

function normalizeReviewOrderId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ProductReviewError({
      message: 'orderId is required.',
      statusCode: 400,
      code: 'PRODUCT_REVIEW_ORDER_REQUIRED',
    });
  }

  return normalized;
}

function normalizeReviewOrderItemId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new ProductReviewError({
      message: 'orderItemId is required.',
      statusCode: 400,
      code: 'PRODUCT_REVIEW_ORDER_ITEM_REQUIRED',
    });
  }

  return normalized;
}

function maskCustomerName(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'Verified Buyer';
  }

  if (parts.length === 1) {
    const firstName = parts[0];
    return firstName.length <= 1 ? firstName : `${firstName[0].toUpperCase()}${firstName.slice(1).toLowerCase()}`;
  }

  const firstName = `${parts[0][0].toUpperCase()}${parts[0].slice(1).toLowerCase()}`;
  const lastInitial = `${parts[1][0].toUpperCase()}.`;
  return `${firstName} ${lastInitial}`;
}

function buildProductReviewListCacheKey({ productId, page, limit }) {
  return `${PRODUCT_REVIEW_CACHE_PREFIX}:product:${productId}:page:${page}:limit:${limit}`;
}

function buildProductReviewSummaryCacheKey(productId) {
  return `${PRODUCT_REVIEW_SUMMARY_CACHE_PREFIX}:product:${productId}`;
}

async function invalidateProductReviewSummaryCache(productId = '') {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) {
    return false;
  }

  const cacheKey = buildProductReviewSummaryCacheKey(normalizedProductId);
  globalProductReviewCacheState.inFlight.delete(cacheKey);
  await cache.del(cacheKey);
  return true;
}


async function getCachedProductReviewValue(key, ttl, loader) {
  const cachedValue = await cache.get(key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  if (globalProductReviewCacheState.inFlight.has(key)) {
    return globalProductReviewCacheState.inFlight.get(key);
  }

  const request = (async () => {
    try {
      const value = await loader();
      await cache.set(key, value, { ttl });
      return value;
    } finally {
      globalProductReviewCacheState.inFlight.delete(key);
    }
  })();

  globalProductReviewCacheState.inFlight.set(key, request);
  return request;
}

async function scanKeys(match) {
  const client = await getRedisClient();
  if (!client) {
    return [];
  }

  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await client.scan(cursor, {
      match,
      count: 200,
    });

    cursor = String(nextCursor || '0');
    if (Array.isArray(batch) && batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');

  return keys;
}

export async function invalidateProductReviewCache(productId = '') {
  const cachePrefix = productId
    ? `${PRODUCT_REVIEW_CACHE_PREFIX}:product:${productId}:`
    : `${PRODUCT_REVIEW_CACHE_PREFIX}:`;

  for (const key of globalProductReviewCacheState.inFlight.keys()) {
    if (String(key).startsWith(cachePrefix)) {
      globalProductReviewCacheState.inFlight.delete(key);
    }
  }

  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    const match = productId
      ? `${PRODUCT_REVIEW_CACHE_PREFIX}:product:${productId}:*`
      : `${PRODUCT_REVIEW_CACHE_PREFIX}:*`;
    const keys = await scanKeys(match);
    for (let index = 0; index < keys.length; index += 200) {
      const batch = keys.slice(index, index + 200);
      if (batch.length > 0) {
        await client.del(...batch);
      }
    }
    return true;
  } catch (error) {
    console.warn('Product review cache invalidation failed.', error);
    return false;
  }
}

function buildPagination({ page, limit, totalItems }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function buildPublicReviewResponse(review) {
  return {
    id: review.id,
    productId: review.productId,
    orderId: review.orderId,
    orderItemId: review.orderItemId,
    customerId: review.customerId,
    rating: review.rating,
    title: review.title || '',
    comment: review.comment,
    isPublished: Boolean(review.isPublished),
    customerName: maskCustomerName(review.customer?.customerName || ''),
    verifiedPurchase: true,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function buildAdminReviewResponse(review) {
  return {
    id: review.id,
    productId: review.productId,
    productName: review.product?.name || '',
    customerId: review.customerId,
    customerName: review.customer?.customerName || '',
    orderId: review.orderId,
    orderNumber: review.order?.publicOrderNumber || review.order?.orderNumber || '',
    orderItemId: review.orderItemId,
    rating: review.rating,
    title: review.title || '',
    comment: review.comment,
    isPublished: Boolean(review.isPublished),
    status: review.isPublished ? 'PUBLISHED' : 'HIDDEN',
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export async function getPublishedProductReviewSummaryMap(prismaClient = prisma, productIds = []) {
  const normalizedProductIds = [...new Set((productIds || []).map((productId) => String(productId || '').trim()).filter(Boolean))];
  const summaryMap = new Map();

  if (normalizedProductIds.length === 0) {
    return summaryMap;
  }

  const missingProductIds = [];

  if (prismaClient === prisma) {
    const cachedSummaries = await Promise.all(normalizedProductIds.map(async (productId) => {
      const cacheKey = buildProductReviewSummaryCacheKey(productId);
      const cachedValue = await cache.get(cacheKey);
      return { productId, cachedValue };
    }));

    for (const entry of cachedSummaries) {
      if (entry.cachedValue && typeof entry.cachedValue === 'object') {
        summaryMap.set(entry.productId, {
          averageRating: Number(entry.cachedValue.averageRating || 0),
          reviewCount: Number(entry.cachedValue.reviewCount || 0),
        });
      } else {
        missingProductIds.push(entry.productId);
      }
    }
  } else {
    missingProductIds.push(...normalizedProductIds);
  }

  if (missingProductIds.length === 0) {
    return summaryMap;
  }

  const grouped = await prismaClient.productReview.groupBy({
    by: ['productId'],
    where: {
      productId: { in: missingProductIds },
      isPublished: true,
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  const groupedMap = new Map();
  for (const entry of grouped) {
    const averageRating = Number(entry._avg?.rating || 0);
    groupedMap.set(entry.productId, {
      averageRating: averageRating > 0 ? Number(averageRating.toFixed(1)) : 0,
      reviewCount: Number(entry._count?._all || 0),
    });
  }

  const cacheWrites = [];
  for (const productId of missingProductIds) {
    const summary = groupedMap.get(productId) || {
      averageRating: 0,
      reviewCount: 0,
    };
    summaryMap.set(productId, summary);

    if (prismaClient === prisma) {
      cacheWrites.push(cache.set(buildProductReviewSummaryCacheKey(productId), summary, {
        ttl: PRODUCT_REVIEW_SUMMARY_TTL_SECONDS,
      }));
    }
  }

  if (cacheWrites.length > 0) {
    await Promise.all(cacheWrites);
  }

  return summaryMap;
}

export const productReviewService = {
  async listPublicProductReviews({ productId, page = DEFAULT_REVIEW_PAGE, limit = DEFAULT_REVIEW_LIMIT } = {}) {
    const normalizedProductId = normalizeReviewProductId(productId);
    const normalizedPage = normalizePositiveInteger(page, DEFAULT_REVIEW_PAGE, 1000);
    const normalizedLimit = normalizePositiveInteger(limit, DEFAULT_REVIEW_LIMIT, MAX_REVIEW_LIMIT);
    const cacheKey = buildProductReviewListCacheKey({
      productId: normalizedProductId,
      page: normalizedPage,
      limit: normalizedLimit,
    });

    return getCachedProductReviewValue(cacheKey, PRODUCT_REVIEW_LIST_TTL_SECONDS, async () => {
      const [product, totalItems, reviews, summaryMap] = await Promise.all([
        prisma.product.findUnique({
          where: { id: normalizedProductId },
          select: { id: true },
        }),
        prisma.productReview.count({
          where: {
            productId: normalizedProductId,
            isPublished: true,
          },
        }),
        prisma.productReview.findMany({
          where: {
            productId: normalizedProductId,
            isPublished: true,
          },
          include: {
            customer: {
              select: {
                customerName: true,
              },
            },
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          skip: (normalizedPage - 1) * normalizedLimit,
          take: normalizedLimit,
        }),
        getPublishedProductReviewSummaryMap(prisma, [normalizedProductId]),
      ]);

      if (!product) {
        throw new ProductReviewError({
          message: 'Product was not found.',
          statusCode: 404,
          code: 'PRODUCT_REVIEW_PRODUCT_NOT_FOUND',
        });
      }

      const summary = summaryMap.get(normalizedProductId) || {
        averageRating: 0,
        reviewCount: 0,
      };

      return {
        data: reviews.map(buildPublicReviewResponse),
        pagination: buildPagination({
          page: normalizedPage,
          limit: normalizedLimit,
          totalItems,
        }),
        summary,
      };
    });
  },

  async createProductReview({ customer, input } = {}) {
    const productId = normalizeReviewProductId(input?.productId);
    const orderId = normalizeReviewOrderId(input?.orderId);
    const orderItemId = normalizeReviewOrderItemId(input?.orderItemId);
    const customerId = String(customer?.id || '').trim();
    const rating = normalizeReviewRating(input?.rating);
    const title = normalizeReviewTitle(input?.title);
    const comment = normalizeReviewComment(input?.comment);

    if (!customerId) {
      throw new ProductReviewError({
        message: 'Authentication is required.',
        statusCode: 401,
        code: 'PRODUCT_REVIEW_AUTH_REQUIRED',
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { id: orderItemId },
          select: {
            id: true,
            productId: true,
          },
        },
      },
    });

    if (!order || String(order.customerId || '').trim() !== customerId) {
      throw new ProductReviewError({
        message: 'You can only review products that you have purchased.',
        statusCode: 403,
        code: 'PRODUCT_REVIEW_PURCHASE_REQUIRED',
      });
    }

    const orderStatus = getSynchronizedOrderStatus({
      orderStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
    });
    if (orderStatus !== ORDER_STATUS.COMPLETED) {
      throw new ProductReviewError({
        message: 'Only completed orders can be reviewed.',
        statusCode: 409,
        code: 'PRODUCT_REVIEW_ORDER_NOT_COMPLETED',
      });
    }

    const orderItem = order.items?.[0] || null;
    if (!orderItem || String(orderItem.productId || '').trim() !== productId) {
      throw new ProductReviewError({
        message: 'The selected order item does not match this product.',
        statusCode: 400,
        code: 'PRODUCT_REVIEW_ORDER_ITEM_INVALID',
      });
    }

    const existingReview = await prisma.productReview.findUnique({
      where: { orderItemId },
      select: { id: true },
    });
    if (existingReview) {
      throw new ProductReviewError({
        message: 'This purchased item has already been reviewed.',
        statusCode: 409,
        code: 'PRODUCT_REVIEW_ALREADY_EXISTS',
      });
    }

    const review = await prisma.productReview.create({
      data: {
        id: crypto.randomUUID(),
        productId,
        orderId,
        orderItemId,
        customerId,
        rating,
        title,
        comment,
        isPublished: true,
      },
      include: {
        customer: {
          select: {
            customerName: true,
          },
        },
      },
    });

    await invalidateProductReviewCache(productId);
    await invalidateProductReviewSummaryCache(productId);
    const summaryMap = await getPublishedProductReviewSummaryMap(prisma, [productId]);

    return {
      review: buildPublicReviewResponse(review),
      summary: summaryMap.get(productId) || { averageRating: 0, reviewCount: 0 },
      message: 'Thank you. Your review has been submitted successfully.',
    };
  },

  async listAdminReviewedProducts() {
    const reviews = await prisma.productReview.findMany({
      select: {
        productId: true,
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const productMap = new Map();
    for (const entry of reviews) {
      if (!productMap.has(entry.productId)) {
        productMap.set(entry.productId, {
          id: entry.productId,
          name: entry.product?.name || entry.productId,
        });
      }
    }

    return Array.from(productMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  },

  async listAdminProductReviews({ query = {} } = {}) {
    const page = normalizePositiveInteger(query.page, 1, 1000);
    const limit = normalizePositiveInteger(query.limit, DEFAULT_ADMIN_REVIEW_LIMIT, MAX_ADMIN_REVIEW_LIMIT);
    const search = String(query.search || '').trim();
    const productId = String(query.productId || '').trim();
    const status = String(query.status || 'all').trim().toLowerCase();
    const rating = String(query.rating || '').trim();
    const dateFrom = String(query.dateFrom || '').trim();
    const dateTo = String(query.dateTo || '').trim();

    const where = {};

    if (productId && productId !== 'all') {
      where.productId = productId;
    }

    if (status === 'published') {
      where.isPublished = true;
    }
    if (status === 'hidden') {
      where.isPublished = false;
    }

    if (rating && rating !== 'all') {
      const parsedRating = Number.parseInt(rating, 10);
      if (Number.isFinite(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
        where.rating = parsedRating;
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { comment: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { customerName: { contains: search, mode: 'insensitive' } } },
        { order: { publicOrderNumber: { contains: search, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [totalItems, reviews] = await Promise.all([
      prisma.productReview.count({ where }),
      prisma.productReview.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true },
          },
          customer: {
            select: { id: true, customerName: true },
          },
          order: {
            select: { id: true, orderNumber: true, publicOrderNumber: true },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: reviews.map(buildAdminReviewResponse),
      pagination: buildPagination({ page, limit, totalItems }),
    };
  },

  async getAdminProductReviewById(id) {
    const reviewId = String(id || '').trim();
    if (!reviewId) {
      throw new ProductReviewError({
        message: 'Review id is required.',
        statusCode: 400,
        code: 'PRODUCT_REVIEW_ID_REQUIRED',
      });
    }

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      include: {
        product: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, customerName: true },
        },
        order: {
          select: { id: true, orderNumber: true, publicOrderNumber: true },
        },
      },
    });

    if (!review) {
      throw new ProductReviewError({
        message: 'Review was not found.',
        statusCode: 404,
        code: 'PRODUCT_REVIEW_NOT_FOUND',
      });
    }

    return buildAdminReviewResponse(review);
  },

  async updatePublishedState({ id, isPublished, user = null } = {}) {
    const reviewId = String(id || '').trim();
    if (!reviewId) {
      throw new ProductReviewError({
        message: 'Review id is required.',
        statusCode: 400,
        code: 'PRODUCT_REVIEW_ID_REQUIRED',
      });
    }

    const review = await prisma.productReview.update({
      where: { id: reviewId },
      data: {
        isPublished: Boolean(isPublished),
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, customerName: true },
        },
        order: {
          select: { id: true, orderNumber: true, publicOrderNumber: true },
        },
      },
    });

    await invalidateProductReviewCache(review.productId);
    await invalidateProductReviewSummaryCache(review.productId);
    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'MARKETING',
      action: review.isPublished ? 'PRODUCT_REVIEW_PUBLISHED' : 'PRODUCT_REVIEW_HIDDEN',
      description: `Product review ${review.id} was ${review.isPublished ? 'published' : 'hidden'}.`,
      metadata: {
        reviewId: review.id,
        productId: review.productId,
        orderId: review.orderId,
        customerId: review.customerId,
      },
    });

    return buildAdminReviewResponse(review);
  },

  async deleteProductReview({ id, user = null } = {}) {
    const reviewId = String(id || '').trim();
    if (!reviewId) {
      throw new ProductReviewError({
        message: 'Review id is required.',
        statusCode: 400,
        code: 'PRODUCT_REVIEW_ID_REQUIRED',
      });
    }

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        productId: true,
        orderId: true,
        customerId: true,
      },
    });

    if (!review) {
      throw new ProductReviewError({
        message: 'Review was not found.',
        statusCode: 404,
        code: 'PRODUCT_REVIEW_NOT_FOUND',
      });
    }

    await prisma.productReview.delete({
      where: { id: reviewId },
    });

    await invalidateProductReviewCache(review.productId);
    await invalidateProductReviewSummaryCache(review.productId);
    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'MARKETING',
      action: 'PRODUCT_REVIEW_DELETED',
      description: `Product review ${review.id} was deleted.`,
      metadata: {
        reviewId: review.id,
        productId: review.productId,
        orderId: review.orderId,
        customerId: review.customerId,
      },
    });

    return { ok: true };
  },
};

export { invalidateProductReviewSummaryCache };

export function normalizeProductReviewError(error) {
  if (error instanceof ProductReviewError) {
    return error;
  }

  return new ProductReviewError({
    message: 'Product review request could not be completed.',
    statusCode: 500,
    code: 'PRODUCT_REVIEW_INTERNAL_ERROR',
  });
}
