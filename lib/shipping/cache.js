function createCacheStore() {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value, ttlMs) {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },
    clear(key) {
      if (typeof key === 'string') {
        store.delete(key);
        return;
      }
      store.clear();
    },
  };
}

export const provinceCache = createCacheStore();
export const cityCache = createCacheStore();
export const districtCache = createCacheStore();
