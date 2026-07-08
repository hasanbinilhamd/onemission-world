import { CustomerAuthError } from './errors';

function pruneExpiredEntries(store, now) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function createMemoryRateLimiter({ windowMs, max, message, code }) {
  const store = new Map();

  return {
    consume(key) {
      const now = Date.now();
      pruneExpiredEntries(store, now);

      const current = store.get(key);
      const entry = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;

      entry.count += 1;
      store.set(key, entry);

      if (entry.count > max) {
        const error = new CustomerAuthError({
          message,
          statusCode: 429,
          code,
        });
        error.retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        throw error;
      }

      return {
        remaining: Math.max(0, max - entry.count),
        resetAt: new Date(entry.resetAt),
      };
    },
  };
}
