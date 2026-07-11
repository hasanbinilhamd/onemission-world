const globalCache = globalThis.__onemissionServerCache ?? new Map();
const globalInFlight = globalThis.__onemissionServerCacheInFlight ?? new Map();

globalThis.__onemissionServerCache = globalCache;
globalThis.__onemissionServerCacheInFlight = globalInFlight;

export async function getCachedValue(key, ttlMs, loader) {
  const now = Date.now();
  const cached = globalCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (globalInFlight.has(key)) {
    return globalInFlight.get(key);
  }

  const request = (async () => {
    try {
      const value = await loader();
      globalCache.set(key, {
        value,
        expiresAt: now + ttlMs,
      });
      return value;
    } finally {
      globalInFlight.delete(key);
    }
  })();

  globalInFlight.set(key, request);
  return request;
}

export function invalidateCacheKey(key) {
  globalCache.delete(key);
  globalInFlight.delete(key);
}

export function invalidateCacheByPrefix(prefix) {
  for (const key of globalCache.keys()) {
    if (String(key).startsWith(prefix)) {
      globalCache.delete(key);
    }
  }

  for (const key of globalInFlight.keys()) {
    if (String(key).startsWith(prefix)) {
      globalInFlight.delete(key);
    }
  }
}
