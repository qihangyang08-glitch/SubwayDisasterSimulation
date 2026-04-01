#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 用途：在服务启动前执行数据库检查和初始化
 * 
 * 使用方法：
 *   node scripts/init-db.js
 * 
 * 或在 package.json 中添加：
 *   "scripts": {
 *     "db:init": "node scripts/init-db.js"
 *   }
 */

const { initializeDatabase, checkConnection } = require('../src/db/dbInitializer');

/**
 * 主函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Metro Simulation - Database Initialization Tool          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // 步骤1: 检查数据库连接（可选，如果数据库不存在会失败）
    // 这一步主要检查MySQL服务是否可访问
    console.log('Step 1: Checking MySQL server accessibility...');
    // 注意：这里不检查具体数据库，因为数据库可能还不存在
    
    // 步骤2: 执行数据库初始化
    console.log('Step 2: Initializing database...');
    const result = await initializeDatabase();

    // 步骤3: 输出结果
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Initialization Result                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (result.success) {
      console.log('✅ SUCCESS:', result.message);
      console.log('');
      
      if (result.databaseCreated) {
        console.log('  📦 Database created: YES');
      } else {
        console.log('  📦 Database created: NO (already exists)');
      }
      
      if (result.tablesCreated) {
        console.log('  📋 Tables created: YES');
      } else {
        console.log('  📋 Tables created: NO (already exist)');
      }
      
      console.log('');
      console.log('  Existing tables:', result.details.existingTables.join(', ') || 'none');
      if (result.details.missingTables.length > 0) {
        console.log('  Created tables:', result.details.missingTables.join(', '));
      }
      
      console.log('');
      console.log('🎉 Database is ready for use!');
      process.exit(0);
    } else {
      console.log('❌ FAILED:', result.message);
      if (result.error) {
        console.log('');
        console.log('Error details:');
        console.log(result.error);
      }
      process.exit(1);
    }

  } catch (error) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Initialization Failed                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('❌ Error:', error.message);
    console.log('');
    console.log('Please check:');
    console.log('  1. MySQL server is running');
    console.log('  2. Database credentials are correct (check .env file)');
    console.log('  3. User has sufficient permissions to create databases and tables');
    console.log('');
    
    if (process.env.DEBUG === 'true') {
      console.log('Full error stack:');
      console.log(error);
    }
    
    process.exit(1);
  }
}

// 运行主函数
main();
