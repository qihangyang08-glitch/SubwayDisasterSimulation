const mysql = require('mysql2/promise');

const DEFAULT_DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metro_sim',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 16),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 0),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 8000),
  decimalNumbers: true,
  namedPlaceholders: false,
  timezone: 'Z'
};

let pool = null;

function getPool(config = {}) {
  if (!pool) {
    pool = mysql.createPool({
      ...DEFAULT_DB_CONFIG,
      ...config
    });
  }
  return pool;
}

async function query(sql, params = [], options = {}) {
  const activePool = getPool(options.poolConfig);
  const timeoutMs = options.timeoutMs || 0;
  const [rows] = await activePool.query({ sql, timeout: timeoutMs }, params);
  return rows;
}

async function withConnection(handler, options = {}) {
  const activePool = getPool(options.poolConfig);
  const conn = await activePool.getConnection();
  try {
    return await handler(conn);
  } finally {
    conn.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  withConnection,
  closePool
};
