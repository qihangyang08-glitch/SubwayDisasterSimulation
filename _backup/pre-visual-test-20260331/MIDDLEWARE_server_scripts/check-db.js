#!/usr/bin/env node
/**
 * 数据库状态检查脚本
 * 用途：检查数据库和表的状态，不执行任何修改操作
 * 
 * 使用方法：
 *   node scripts/check-db.js
 */

const { 
  checkConnection,
  checkDatabaseExists,
  checkAllTables,
  validateTableStructure,
  DB_CONFIG,
  REQUIRED_TABLES
} = require('../src/db/dbInitializer');
const mysql = require('mysql2/promise');

/**
 * 主函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Metro Simulation - Database Status Check                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const dbName = DB_CONFIG.database;
  let connection;
  
  try {
    // 步骤1: 测试MySQL服务器连接
    console.log('Step 1: Testing MySQL server connection...');
    console.log(`  Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`  User: ${DB_CONFIG.user}`);
    console.log('');
    
    const connectionConfigWithoutDB = { ...DB_CONFIG };
    delete connectionConfigWithoutDB.database;
    delete connectionConfigWithoutDB.multipleStatements;
    
    try {
      connection = await mysql.createConnection(connectionConfigWithoutDB);
      console.log('  ✅ MySQL server is accessible');
    } catch (error) {
      console.log('  ❌ Cannot connect to MySQL server');
      console.log('  Error:', error.message);
      process.exit(1);
    }
    
    console.log('');
    
    // 步骤2: 检查数据库是否存在
    console.log('Step 2: Checking database...');
    console.log(`  Database name: ${dbName}`);
    
    const dbExists = await checkDatabaseExists(connection, dbName);
    
    if (dbExists) {
      console.log('  ✅ Database exists');
    } else {
      console.log('  ❌ Database does not exist');
      console.log('');
      console.log('To create the database, run:');
      console.log('  npm run db:init');
      await connection.end();
      process.exit(1);
    }
    
    console.log('');
    
    // 步骤3: 切换到目标数据库
    await connection.query(`USE \`${dbName}\``);
    
    // 步骤4: 检查表
    console.log('Step 3: Checking tables...');
    console.log(`  Required tables: ${REQUIRED_TABLES.length}`);
    
    const { existingTables, missingTables } = await checkAllTables(connection, dbName);
    
    console.log('');
    console.log('  Table Status:');
    for (const tableName of REQUIRED_TABLES) {
      if (existingTables.includes(tableName)) {
        console.log(`    ✅ ${tableName}`);
      } else {
        console.log(`    ❌ ${tableName} (missing)`);
      }
    }
    
    console.log('');
    
    if (missingTables.length > 0) {
      console.log(`  ⚠️  ${missingTables.length} table(s) missing`);
      console.log('');
      console.log('To create missing tables, run:');
      console.log('  npm run db:init');
      await connection.end();
      process.exit(1);
    } else {
      console.log('  ✅ All required tables exist');
    }
    
    console.log('');
    
    // 步骤5: 验证表结构
    console.log('Step 4: Validating table structure...');
    
    const isValid = await validateTableStructure(connection, dbName);
    
    if (isValid) {
      console.log('  ✅ Table structure is valid');
    } else {
      console.log('  ❌ Table structure validation failed');
      console.log('');
      console.log('Some columns may be missing. Consider recreating tables:');
      console.log('  1. Backup your data');
      console.log('  2. Drop existing tables');
      console.log('  3. Run: npm run db:init');
      await connection.end();
      process.exit(1);
    }
    
    console.log('');
    
    // 步骤6: 获取统计信息
    console.log('Step 5: Database statistics...');
    
    for (const tableName of REQUIRED_TABLES) {
      try {
        const [countResult] = await connection.query(
          `SELECT COUNT(*) as count FROM \`${tableName}\``
        );
        const count = countResult[0].count;
        console.log(`  📊 ${tableName}: ${count} rows`);
      } catch (error) {
        console.log(`  ⚠️  ${tableName}: Error getting count - ${error.message}`);
      }
    }
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Database Status: OK                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🎉 Database is ready for use!');
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Database Check Failed                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('❌ Error:', error.message);
    console.log('');
    
    if (process.env.DEBUG === 'true') {
      console.log('Full error stack:');
      console.log(error);
    }
    
    if (connection) {
      await connection.end();
    }
    
    process.exit(1);
  }
}

// 运行主函数
main();
