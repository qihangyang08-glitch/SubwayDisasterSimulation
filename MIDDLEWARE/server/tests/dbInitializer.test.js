/**
 * 数据库初始化功能测试
 * 
 * 运行方式：
 *   node --test tests/dbInitializer.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const {
  initializeDatabase,
  checkConnection,
  checkDatabaseExists,
  checkTableExists,
  checkAllTables,
  validateTableStructure,
  REQUIRED_TABLES
} = require('../src/db/dbInitializer');
const mysql = require('mysql2/promise');

const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metro_sim'
};

describe('Database Initializer Tests', () => {
  
  describe('checkConnection', () => {
    it('should successfully connect to MySQL server', async () => {
      const result = await checkConnection(TEST_DB_CONFIG);
      assert.strictEqual(result, true, 'Should connect to database');
    });

    it('should fail to connect with invalid credentials', async () => {
      const invalidConfig = {
        ...TEST_DB_CONFIG,
        password: 'invalid_password_12345'
      };
      const result = await checkConnection(invalidConfig);
      assert.strictEqual(result, false, 'Should fail with invalid password');
    });
  });

  describe('checkDatabaseExists', () => {
    let connection;

    before(async () => {
      const configWithoutDB = { ...TEST_DB_CONFIG };
      delete configWithoutDB.database;
      connection = await mysql.createConnection(configWithoutDB);
    });

    after(async () => {
      if (connection) {
        await connection.end();
      }
    });

    it('should check if database exists', async () => {
      const exists = await checkDatabaseExists(connection, TEST_DB_CONFIG.database);
      // 不强制要求存在或不存在，只测试函数返回布尔值
      assert.strictEqual(typeof exists, 'boolean', 'Should return boolean');
    });

    it('should return false for non-existent database', async () => {
      const exists = await checkDatabaseExists(connection, 'non_existent_db_12345');
      assert.strictEqual(exists, false, 'Should return false for non-existent database');
    });
  });

  describe('checkTableExists', () => {
    let connection;

    before(async () => {
      connection = await mysql.createConnection(TEST_DB_CONFIG);
    });

    after(async () => {
      if (connection) {
        await connection.end();
      }
    });

    it('should check if table exists', async () => {
      const exists = await checkTableExists(
        connection,
        TEST_DB_CONFIG.database,
        'simulations'
      );
      assert.strictEqual(typeof exists, 'boolean', 'Should return boolean');
    });

    it('should return false for non-existent table', async () => {
      const exists = await checkTableExists(
        connection,
        TEST_DB_CONFIG.database,
        'non_existent_table_12345'
      );
      assert.strictEqual(exists, false, 'Should return false for non-existent table');
    });
  });

  describe('checkAllTables', () => {
    let connection;

    before(async () => {
      connection = await mysql.createConnection(TEST_DB_CONFIG);
    });

    after(async () => {
      if (connection) {
        await connection.end();
      }
    });

    it('should return object with existingTables and missingTables arrays', async () => {
      const result = await checkAllTables(connection, TEST_DB_CONFIG.database);
      
      assert.ok(Array.isArray(result.existingTables), 'existingTables should be array');
      assert.ok(Array.isArray(result.missingTables), 'missingTables should be array');
      
      // 所有表应该要么存在要么缺失
      const totalTables = result.existingTables.length + result.missingTables.length;
      assert.strictEqual(
        totalTables,
        REQUIRED_TABLES.length,
        'Total should equal required tables count'
      );
    });
  });

  describe('validateTableStructure', () => {
    let connection;

    before(async () => {
      connection = await mysql.createConnection(TEST_DB_CONFIG);
    });

    after(async () => {
      if (connection) {
        await connection.end();
      }
    });

    it('should validate table structure', async () => {
      const result = await validateTableStructure(connection, TEST_DB_CONFIG.database);
      assert.strictEqual(typeof result, 'boolean', 'Should return boolean');
    });
  });

  describe('initializeDatabase', () => {
    it('should successfully initialize database', async () => {
      const result = await initializeDatabase(TEST_DB_CONFIG);
      
      assert.strictEqual(typeof result, 'object', 'Should return object');
      assert.strictEqual(typeof result.success, 'boolean', 'Should have success field');
      assert.strictEqual(typeof result.databaseCreated, 'boolean', 'Should have databaseCreated field');
      assert.strictEqual(typeof result.tablesCreated, 'boolean', 'Should have tablesCreated field');
      assert.strictEqual(typeof result.message, 'string', 'Should have message field');
      assert.ok(result.details, 'Should have details object');
      
      if (result.success) {
        console.log('✅ Database initialization succeeded');
        console.log('  - Database created:', result.databaseCreated);
        console.log('  - Tables created:', result.tablesCreated);
        console.log('  - Message:', result.message);
      } else {
        console.log('❌ Database initialization failed');
        console.log('  - Message:', result.message);
      }
    });

    it('should be idempotent (running twice should succeed)', async () => {
      const result1 = await initializeDatabase(TEST_DB_CONFIG);
      const result2 = await initializeDatabase(TEST_DB_CONFIG);
      
      assert.strictEqual(result1.success, true, 'First run should succeed');
      assert.strictEqual(result2.success, true, 'Second run should succeed');
      
      // 第二次运行不应该创建新的数据库或表
      assert.strictEqual(result2.databaseCreated, false, 'Should not create database again');
      assert.strictEqual(result2.tablesCreated, false, 'Should not create tables again');
    });
  });

  describe('REQUIRED_TABLES constant', () => {
    it('should have all required tables defined', () => {
      assert.ok(Array.isArray(REQUIRED_TABLES), 'Should be an array');
      assert.strictEqual(REQUIRED_TABLES.length, 4, 'Should have 4 tables');
      
      const expectedTables = ['simulations', 'simulation_frames', 'plans', 'plan_runs'];
      for (const table of expectedTables) {
        assert.ok(
          REQUIRED_TABLES.includes(table),
          `Should include ${table}`
        );
      }
    });
  });
});
