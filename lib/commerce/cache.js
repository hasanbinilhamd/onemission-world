import crypto from 'node:crypto';
import { cache } from '@/lib/cache';
import { getRedisClient } from '@/lib/redis';

const PRODUCT_CACHE_PREFIX = 'products:';
const PRODUCT_CACHE_SCAN_MATCH = `${PRODUCT_CACHE_PREFIX}*`;
const PRODUCT_CACHE_SCAN_COUNT = 200;

export const PRODUCT_CACHE_TTL_SECONDS = {
  FEATURED: 15 * 60,
  COLLECTION: 15 * 60,
  DETAIL: 15 * 60,
  SEARCH: 10 * 60,
  CATEGORIES: 15 * 60,
};

const globalProductCacheState = globalThis.__onemissionProductCacheState ?? {
  inFlight: new Map(),
};

globalThis.__onemissionProductCacheState = globalProductCacheState;

function logProductCacheEvent(message) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message);
  }
}

function buildHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 12);
}

function normalizeBaseUrl(baseUrl = '') {
  return String(baseUrl || '').trim().replace(/\/$/, '').toLowerCase() || 'default';
}

function toKeySegment(value, fallback = 'default') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildOriginKey(baseUrl) {
  return buildHash(normalizeBaseUrl(baseUrl));
}

function buildSignature(value) {
  return buildHash(JSON.stringify(value || {}));
}

export function buildCollectionCacheKey({ baseUrl, filters }) {
  return `products:collection:${buildOriginKey(baseUrl)}:${buildSignature(filters)}`;
}

export function buildFeaturedCacheKey({ baseUrl, filters }) {
  return `products:featured:${buildOriginKey(baseUrl)}:${buildSignature(filters)}`;
}

export function buildProductDetailCacheKey({ baseUrl, slug }) {
  return `products:detail:${toKeySegment(slug)}:${buildOriginKey(baseUrl)}`;
}

export function buildProductSearchCacheKey({ baseUrl, search, filters }) {
  return `products:search:${toKeySegment(search)}:${buildOriginKey(baseUrl)}:${buildSignature(filters)}`;
}

export function buildProductCategoriesCacheKey({ baseUrl }) {
  return `products:categories:${buildOriginKey(baseUrl)}`;
}

export async function getProductCacheValue(key, ttl, loader) {
  const cachedValue = await cache.get(key);
  if (cachedValue !== null) {
    logProductCacheEvent('Product Cache HIT');
    return cachedValue;
  }

  if (globalProductCacheState.inFlight.has(key)) {
    return globalProductCacheState.inFlight.get(key);
  }

  logProductCacheEvent('Product Cache MISS');

  const request = (async () => {
    try {
      const value = await loader();
      await cache.set(key, value, { ttl });
      return value;
    } finally {
      globalProductCacheState.inFlight.delete(key);
    }
  })();

  globalProductCacheState.inFlight.set(key, request);
  return request;
}

async function listProductCacheKeys(client) {
  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await client.scan(cursor, {
      match: PRODUCT_CACHE_SCAN_MATCH,
      count: PRODUCT_CACHE_SCAN_COUNT,
    });

    cursor = String(nextCursor || '0');
    if (Array.isArray(batch) && batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');

  return keys;
}

export async function invalidateCommerceProductCache() {
  for (const key of globalProductCacheState.inFlight.keys()) {
    if (String(key).startsWith(PRODUCT_CACHE_PREFIX)) {
      globalProductCacheState.inFlight.delete(key);
    }
  }

  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    const keys = await listProductCacheKeys(client);
    for (let index = 0; index < keys.length; index += PRODUCT_CACHE_SCAN_COUNT) {
      const batch = keys.slice(index, index + PRODUCT_CACHE_SCAN_COUNT);
      if (batch.length > 0) {
        await client.del(...batch);
      }
    }

    logProductCacheEvent('Product Cache INVALIDATED');
    return true;
  } catch (error) {
    console.warn('Product cache invalidation failed.', error);
    return false;
  }
}
