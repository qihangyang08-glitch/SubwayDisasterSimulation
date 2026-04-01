/**
 * 数据库初始化器使用示例
 * 演示如何在代码中使用数据库初始化功能
 */

const { initializeDatabase, checkConnection } = require('../src/db/dbInitializer');

// 示例1: 基本使用 - 使用默认配置
async function example1_basicUsage() {
  console.log('========== Example 1: Basic Usage ==========\n');
  
  try {
    const result = await initializeDatabase();
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      console.log('   Database created:', result.databaseCreated);
      console.log('   Tables created:', result.tablesCreated);
    } else {
      console.log('❌ Failed:', result.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n');
}

// 示例2: 自定义配置
async function example2_customConfig() {
  console.log('========== Example 2: Custom Configuration ==========\n');
  
  const customConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'metro_sim_custom'
  };
  
  try {
    const result = await initializeDatabase(customConfig);
    
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n');
}

// 示例3: 连接测试
async function example3_connectionTest() {
  console.log('========== Example 3: Connection Test ==========\n');
  
  try {
    const isConnected = await checkConnection();
    
    if (isConnected) {
      console.log('✅ Database connection is OK');
    } else {
      console.log('❌ Cannot connect to database');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n');
}

// 示例4: 应用启动时的完整流程
async function example4_applicationStartup() {
  console.log('========== Example 4: Application Startup Flow ==========\n');
  
  try {
    // 步骤1: 初始化数据库
    console.log('[App] Step 1: Initializing database...');
    const dbResult = await initializeDatabase();
    
    if (!dbResult.success) {
      console.error('[App] Database initialization failed, aborting startup');
      process.exit(1);
    }
    
    console.log('[App] Database ready');
    
    // 步骤2: 创建应用实例
    console.log('[App] Step 2: Creating application...');
    // const app = createApp(...);
    
    // 步骤3: 启动服务器
    console.log('[App] Step 3: Starting server...');
    // server.listen(port, ...);
    
    console.log('[App] Application started successfully');
    
  } catch (error) {
    console.error('[App] Fatal error:', error.message);
    process.exit(1);
  }
  
  console.log('\n');
}

// 示例5: 错误处理
async function example5_errorHandling() {
  console.log('========== Example 5: Error Handling ==========\n');
  
  // 故意使用错误的配置
  const badConfig = {
    host: 'invalid_host',
    port: 9999,
    user: 'invalid_user',
    password: 'invalid_password',
    database: 'test_db'
  };
  
  try {
    const result = await initializeDatabase(badConfig);
    
    // 通常不会执行到这里
    console.log('Result:', result);
    
  } catch (error) {
    // 错误处理
    console.log('Caught error as expected:');
    console.log('  Error type:', error.code || 'UNKNOWN');
    console.log('  Error message:', error.message);
    
    // 根据错误类型采取不同的处理策略
    if (error.code === 'ECONNREFUSED') {
      console.log('\n  💡 Suggestion: Check if MySQL service is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n  💡 Suggestion: Check database credentials');
    } else {
      console.log('\n  💡 Suggestion: Check database configuration');
    }
  }
  
  console.log('\n');
}

// 主函数
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Database Initializer - Usage Examples                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // 运行示例（注释掉你不想运行的示例）
  
  // await example1_basicUsage();
  // await example2_customConfig();
  await example3_connectionTest();
  await example4_applicationStartup();
  // await example5_errorHandling();
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All examples completed                                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_basicUsage,
  example2_customConfig,
  example3_connectionTest,
  example4_applicationStartup,
  example5_errorHandling
};
