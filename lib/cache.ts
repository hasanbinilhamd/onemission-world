import 'server-only';
import { getRedisClient, initializeRedis } from '@/lib/redis';

export interface CacheSetOptions {
  ttl?: number;
}

function logCacheFailure(action: string, key: string, error: unknown) {
  console.warn(`Cache ${action} failed for key "${key}".`, error);
}

export async function initializeCache(): Promise<boolean> {
  return initializeRedis();
}

export const cache = {
  async ready(): Promise<boolean> {
    return initializeCache();
  },

  async get<T>(key: string): Promise<T | null> {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get<T>(key);
      return value ?? null;
    } catch (error) {
      logCacheFailure('get', key, error);
      return null;
    }
  },

  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      if (typeof options.ttl === 'number' && options.ttl > 0) {
        await client.set(key, value, { ex: options.ttl });
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      logCacheFailure('set', key, error);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      await client.del(key);
      return true;
    } catch (error) {
      logCacheFailure('del', key, error);
      return false;
    }
  },

  async exists(key: string): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      const result = await client.exists(key);
      return Number(result) > 0;
    } catch (error) {
      logCacheFailure('exists', key, error);
      return false;
    }
  },

  async expire(key: string, ttl: number): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      await client.expire(key, ttl);
      return true;
    } catch (error) {
      logCacheFailure('expire', key, error);
      return false;
    }
  },

  async flush(): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    try {
      await client.flushdb();
      return true;
    } catch (error) {
      console.warn('Cache flush failed.', error);
      return false;
    }
  },
};
