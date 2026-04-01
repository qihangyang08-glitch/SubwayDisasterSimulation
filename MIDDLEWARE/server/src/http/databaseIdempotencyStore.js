const { getPool } = require('../db/mysqlPool');

/**
 * Database-backed idempotency store for multi-instance deployments
 * BUG-004 FIX: Replaces memory-only storage with persistent database storage
 */
class DatabaseIdempotencyStore {
  constructor(options = {}) {
    this.pool = options.pool || getPool(options.poolConfig);
    this.ttlMs = Number(options.ttlMs || 10 * 60 * 1000);
    this.tableName = options.tableName || 'idempotency_cache';
  }

  async ensureTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        idempotency_key VARCHAR(256) PRIMARY KEY,
        response_data JSON NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await this.pool.execute(sql);
  }

  async get(key) {
    try {
      const now = Date.now();
      const [rows] = await this.pool.execute(
        `SELECT response_data FROM ${this.tableName} 
         WHERE idempotency_key = ? AND expires_at > ?`,
        [key, now]
      );

      if (rows && rows.length > 0) {
        return rows[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('[DatabaseIdempotencyStore] Get error:', error.message);
      return null;
    }
  }

  async set(key, value) {
    try {
      const now = Date.now();
      const expiresAt = now + this.ttlMs;

      await this.pool.execute(
        `INSERT INTO ${this.tableName} 
         (idempotency_key, response_data, created_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           response_data = VALUES(response_data),
           created_at = VALUES(created_at),
           expires_at = VALUES(expires_at)`,
        [key, JSON.stringify(value), now, expiresAt]
      );
    } catch (error) {
      console.error('[DatabaseIdempotencyStore] Set error:', error.message);
    }
  }

  async cleanup() {
    try {
      const now = Date.now();
      await this.pool.execute(
        `DELETE FROM ${this.tableName} WHERE expires_at < ?`,
        [now]
      );
    } catch (error) {
      console.error('[DatabaseIdempotencyStore] Cleanup error:', error.message);
    }
  }

  async startCleanupInterval(intervalMs = 5 * 60 * 1000) {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(() => {});
    }, intervalMs);
  }

  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = {
  DatabaseIdempotencyStore
};
