const { withConnection } = require('./mysqlPool');

const RETRYABLE_MYSQL_ERROR_CODES = new Set([
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT'
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTransaction(work, options = {}) {
  const maxRetries = Number(options.maxRetries || 2);
  const baseRetryDelayMs = Number(options.baseRetryDelayMs || 100);

  let attempt = 0;
  while (true) {
    try {
      return await withConnection(async (conn) => {
        await conn.beginTransaction();
        try {
          const result = await work(conn);
          await conn.commit();
          return result;
        } catch (error) {
          await conn.rollback();
          throw error;
        }
      }, options);
    } catch (error) {
      if (attempt >= maxRetries || !RETRYABLE_MYSQL_ERROR_CODES.has(error.code)) {
        throw error;
      }

      const waitMs = baseRetryDelayMs * (attempt + 1);
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

module.exports = {
  withTransaction
};
