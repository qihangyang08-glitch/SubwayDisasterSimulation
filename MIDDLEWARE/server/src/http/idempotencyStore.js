/**
 * In-memory idempotency store for single-instance deployments
 * For multi-instance deployments, use DatabaseIdempotencyStore instead
 */
class IdempotencyStore {
  constructor(options = {}) {
    this.ttlMs = Number(options.ttlMs || 10 * 60 * 1000);
    this.maxEntries = Number(options.maxEntries || 2000);
    this.cache = new Map();
  }

  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      console.log(`[Idempotency] Cache miss: ${key}`);
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      console.log(`[Idempotency] Cache expired: ${key}`);
      return null;
    }
    console.log(`[Idempotency] Cache hit: ${key}`);
    return entry.value;
  }

  async set(key, value) {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        console.log(`[Idempotency] Cache full, evicted oldest entry`);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
    console.log(`[Idempotency] Cache set: ${key} (TTL: ${this.ttlMs}ms)`);
  }

  async cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`[Idempotency] Cleaned up ${cleanedCount} expired entries`);
    }
  }
}

module.exports = {
  IdempotencyStore
};
