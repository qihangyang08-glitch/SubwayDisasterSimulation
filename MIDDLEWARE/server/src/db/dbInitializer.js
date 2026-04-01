/**
 * 数据库初始化器
 * 功能：
 * 1. 检查数据库是否存在
 * 2. 如果不存在，自动创建数据库
 * 3. 检查表结构是否存在
 * 4. 如果表不存在，自动创建表结构
 * 5. 验证表结构完整性
 */

require('dotenv').config();

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

/**
 * 数据库初始化配置
 */
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metro_sim',
  multipleStatements: true, // 允许执行多条SQL语句
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)
};

/**
 * 必需的表列表
 */
const REQUIRED_TABLES = [
  'simulations',
  'simulation_frames',
  'plans',
  'plan_runs'
];

/**
 * 检查数据库是否存在
 * @param {object} connection - MySQL连接对象
 * @param {string} dbName - 数据库名称
 * @returns {Promise<boolean>} 数据库是否存在
 */
async function checkDatabaseExists(connection, dbName) {
  try {
    const [rows] = await connection.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('[DBInitializer] Error checking database existence:', error.message);
    throw error;
  }
}

/**
 * 创建数据库
 * @param {object} connection - MySQL连接对象
 * @param {string} dbName - 数据库名称
 */
async function createDatabase(connection, dbName) {
  try {
    console.log(`[DBInitializer] Creating database: ${dbName}`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    );
    console.log(`[DBInitializer] Database created successfully: ${dbName}`);
  } catch (error) {
    console.error('[DBInitializer] Error creating database:', error.message);
    throw error;
  }
}

/**
 * 检查表是否存在
 * @param {object} connection - MySQL连接对象
 * @param {string} dbName - 数据库名称
 * @param {string} tableName - 表名称
 * @returns {Promise<boolean>} 表是否存在
 */
async function checkTableExists(connection, dbName, tableName) {
  try {
    const [rows] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, tableName]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`[DBInitializer] Error checking table existence (${tableName}):`, error.message);
    throw error;
  }
}

/**
 * 检查所有必需的表是否存在
 * @param {object} connection - MySQL连接对象
 * @param {string} dbName - 数据库名称
 * @returns {Promise<object>} 包含缺失表列表的对象
 */
async function checkAllTables(connection, dbName) {
  const missingTables = [];
  const existingTables = [];

  for (const tableName of REQUIRED_TABLES) {
    const exists = await checkTableExists(connection, dbName, tableName);
    if (exists) {
      existingTables.push(tableName);
    } else {
      missingTables.push(tableName);
    }
  }

  return { missingTables, existingTables };
}

/**
 * 读取并执行SQL脚本文件
 * @param {object} connection - MySQL连接对象
 * @param {string} sqlFilePath - SQL文件路径
 */
async function executeSqlFile(connection, sqlFilePath) {
  try {
    console.log(`[DBInitializer] Reading SQL file: ${sqlFilePath}`);
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    // 按分号分割SQL语句，过滤空行和注释
    let statements = sqlContent
      .split(';')
      .map(stmt => {
        // 移除每行的注释和多余空白
        return stmt
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(stmt => stmt.length > 0);
    
    console.log(`[DBInitializer] Found ${statements.length} SQL statements`);
    
    // 过滤掉只有注释和空白的语句
    statements = statements.filter(stmt => {
      const lines = stmt.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('--'));
      return lines.length > 0;
    });
    
    console.log(`[DBInitializer] After filtering: ${statements.length} SQL statements`);
    console.log('[DBInitializer] Executing SQL script...');
    
    // 逐个执行每个SQL语句
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt.length > 0) {
        try {
          // 输出第一个关键词以识别语句类型
          const keyword = stmt.substring(0, 50);
          console.log(`[DBInitializer] Executing statement ${i + 1}/${statements.length}: ${keyword}...`);
          await connection.query(stmt);
          console.log(`[DBInitializer] ✓ Statement ${i + 1} executed successfully`);
        } catch (err) {
          console.error(`[DBInitializer] ✗ Error in statement ${i + 1}: ${err.message}`);
          throw err;
        }
      }
    }
    
    console.log('[DBInitializer] SQL script executed successfully');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`[DBInitializer] SQL file not found: ${sqlFilePath}`);
    } else {
      console.error('[DBInitializer] Error executing SQL file:', error.message);
    }
    throw error;
  }
}

/**
 * 创建表结构
 * @param {object} connection - MySQL连接对象
 */
async function createTables(connection) {
  // SQL脚本文件路径 (从 src/db 向上 3 级到 MIDDLEWARE, 再进入 db/sql)
  const schemaFilePath = path.join(__dirname, '../../../db/sql/module1_schema.sql');
  
  try {
    await executeSqlFile(connection, schemaFilePath);
    console.log('[DBInitializer] All tables created successfully');
  } catch (error) {
    console.error('[DBInitializer] Error creating tables:', error.message);
    throw error;
  }
}

/**
 * 验证表结构完整性
 * 检查每个表的关键字段是否存在
 * @param {object} connection - MySQL连接对象
 * @param {string} dbName - 数据库名称
 * @returns {Promise<boolean>} 表结构是否完整
 */
async function validateTableStructure(connection, dbName) {
  try {
    // 定义每个表的关键字段
    const tableStructures = {
      simulations: ['sim_id', 'scenario_id', 'map_level', 'status', 'init_config', 'created_at'],
      simulation_frames: ['sim_id', 'frame_index', 'sim_time', 'frame_snapshot', 'created_at'],
      plans: ['plan_id', 'from_simulation_id', 'from_sim_time', 'plan_source', 'plan_config', 'created_at'],
      plan_runs: ['plan_run_id', 'base_simulation_id', 'plan_id', 'new_simulation_id', 'created_at']
    };

    for (const [tableName, expectedColumns] of Object.entries(tableStructures)) {
      const [columns] = await connection.query(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [dbName, tableName]
      );

      const actualColumns = columns.map(row => row.COLUMN_NAME);
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

      if (missingColumns.length > 0) {
        console.warn(`[DBInitializer] Table ${tableName} is missing columns: ${missingColumns.join(', ')}`);
        return false;
      }
    }

    console.log('[DBInitializer] Table structure validation passed');
    return true;
  } catch (error) {
    console.error('[DBInitializer] Error validating table structure:', error.message);
    return false;
  }
}

/**
 * 初始化数据库
 * 主函数：检查并创建数据库和表结构
 * @param {object} options - 配置选项
 * @returns {Promise<object>} 初始化结果
 */
async function initializeDatabase(options = {}) {
  const config = { ...DB_CONFIG, ...options };
  const dbName = config.database;
  
  // 第一次连接：不指定数据库，用于检查和创建数据库
  const connectionConfigWithoutDB = { ...config };
  delete connectionConfigWithoutDB.database;
  delete connectionConfigWithoutDB.multipleStatements;
  
  let connection;
  const result = {
    success: false,
    databaseCreated: false,
    tablesCreated: false,
    message: '',
    details: {}
  };

  try {
    console.log('[DBInitializer] ========== Database Initialization Started ==========');
    console.log(`[DBInitializer] Target database: ${dbName}`);
    console.log(`[DBInitializer] Host: ${config.host}:${config.port}`);
    
    // 步骤1: 连接MySQL服务器（不指定数据库）
    console.log('[DBInitializer] Connecting to MySQL server...');
    connection = await mysql.createConnection(connectionConfigWithoutDB);
    console.log('[DBInitializer] Connected to MySQL server successfully');

    // 步骤2: 检查数据库是否存在
    console.log(`[DBInitializer] Checking if database '${dbName}' exists...`);
    const dbExists = await checkDatabaseExists(connection, dbName);
    
    if (!dbExists) {
      console.log(`[DBInitializer] Database '${dbName}' does not exist`);
      await createDatabase(connection, dbName);
      result.databaseCreated = true;
    } else {
      console.log(`[DBInitializer] Database '${dbName}' already exists`);
    }

    // 步骤3: 切换到目标数据库
    console.log(`[DBInitializer] Switching to database '${dbName}'...`);
    await connection.query(`USE \`${dbName}\``);

    // 步骤4: 检查表是否存在
    console.log('[DBInitializer] Checking tables...');
    const { missingTables, existingTables } = await checkAllTables(connection, dbName);
    
    result.details.existingTables = existingTables;
    result.details.missingTables = missingTables;

    if (existingTables.length > 0) {
      console.log(`[DBInitializer] Existing tables: ${existingTables.join(', ')}`);
    }

    // 步骤5: 如果有缺失的表，创建表结构
    if (missingTables.length > 0) {
      console.log(`[DBInitializer] Missing tables: ${missingTables.join(', ')}`);
      console.log('[DBInitializer] Creating tables...');
      await createTables(connection);
      result.tablesCreated = true;
    } else {
      console.log('[DBInitializer] All required tables exist');
    }

    // 步骤6: 验证表结构
    console.log('[DBInitializer] Validating table structure...');
    const isValid = await validateTableStructure(connection, dbName);
    
    if (!isValid) {
      result.success = false;
      result.message = 'Table structure validation failed. Some columns may be missing.';
      console.warn('[DBInitializer] ' + result.message);
    } else {
      result.success = true;
      result.message = 'Database initialized successfully';
      console.log('[DBInitializer] ========== Database Initialization Completed Successfully ==========');
    }

  } catch (error) {
    result.success = false;
    result.message = `Database initialization failed: ${error.message}`;
    result.error = error;
    console.error('[DBInitializer] ========== Database Initialization Failed ==========');
    console.error('[DBInitializer] Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('[DBInitializer] Connection closed');
    }
  }

  return result;
}

/**
 * 检查数据库连接
 * @param {object} options - 配置选项
 * @returns {Promise<boolean>} 连接是否成功
 */
async function checkConnection(options = {}) {
  const config = { ...DB_CONFIG, ...options };
  let connection;

  try {
    console.log('[DBInitializer] Testing database connection...');
    connection = await mysql.createConnection(config);
    await connection.ping();
    console.log('[DBInitializer] Database connection test passed');
    return true;
  } catch (error) {
    console.error('[DBInitializer] Database connection test failed:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = {
  initializeDatabase,
  checkConnection,
  checkDatabaseExists,
  checkTableExists,
  checkAllTables,
  validateTableStructure,
  DB_CONFIG,
  REQUIRED_TABLES
};
