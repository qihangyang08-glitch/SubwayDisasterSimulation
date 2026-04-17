require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const { createApp } = require('./createApp');
const { SimulationRepository } = require('../repositories/simulationRepository');
const { PlanRepository } = require('../repositories/planRepository');
const { createDispatcher } = require('../socket/dispatcher');
const { createExternalClients } = require('../integration/externalClients');
const { initializeDatabase, checkConnection, DB_CONFIG } = require('../db/dbInitializer');
const { closePool } = require('../db/mysqlPool');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const version = process.env.API_VERSION || '1.0';
const dbHealthCheckIntervalMs = Number(process.env.DB_HEALTH_CHECK_INTERVAL_MS || 30000);

const dbHealth = {
  status: 'unknown',
  checkedAt: null,
  error: null,
  config: {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    user: DB_CONFIG.user
  }
};

async function checkDbHealth(reason) {
  const checkedAt = Date.now();
  try {
    const connected = await checkConnection();
    dbHealth.status = connected ? 'ok' : 'error';
    dbHealth.checkedAt = checkedAt;
    dbHealth.error = connected ? null : 'database ping failed';

    if (connected) {
      console.log(`[Server][DB] ${reason}: healthy`);
    } else {
      console.error(`[Server][DB] ${reason}: ping failed`);
    }
  } catch (error) {
    dbHealth.status = 'error';
    dbHealth.checkedAt = checkedAt;
    dbHealth.error = error.message;
    console.error(`[Server][DB] ${reason}: ${error.message}`);
  }
}

function getDbHealthSnapshot() {
  return {
    status: dbHealth.status,
    checkedAt: dbHealth.checkedAt,
    error: dbHealth.error,
    config: dbHealth.config
  };
}

/**
 * 启动服务器
 */
async function startServer() {
  let dbMonitorTimer = null;
  try {
    // 步骤1: 数据库初始化检查
    console.log('[Server] Initializing database...');
    const dbInitResult = await initializeDatabase();
    
    if (!dbInitResult.success) {
      console.error('[Server] Database initialization failed:', dbInitResult.message);
      console.error('[Server] Server startup aborted');
      process.exit(1);
    }
    
    console.log('[Server] Database ready');
    await checkDbHealth('startup');
    
    // 步骤2: 创建Repository实例
    const simulationRepo = new SimulationRepository();
    const planRepo = new PlanRepository();
    const { simulationGateway, llmGateway } = createExternalClients();
    let dispatcherApi = null;

    // 步骤3: 创建Express应用
    const { app } = createApp({
      simulationRepo,
      planRepo,
      version,
      getDbHealth: getDbHealthSnapshot,
      simulationGateway,
      llmGateway,
      planDispatcher: {
        async dispatchPlanCommand(input) {
          if (!dispatcherApi || typeof dispatcherApi.dispatchPlanCommand !== 'function') {
            const error = new Error('dispatcher is not ready');
            error.code = 'DISPATCHER_UNAVAILABLE';
            throw error;
          }
          return dispatcherApi.dispatchPlanCommand(input);
        }
      }
    });

    // 步骤4: 创建HTTP服务器和Socket.IO
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*'
      }
    });

    // 步骤5: 创建Dispatcher
    dispatcherApi = createDispatcher({
      io,
      simulationRepo,
      version
    });

    // 步骤6: 启动HTTP服务器
    httpServer.listen(port, host, () => {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  Metro Simulation Middleware Server                       ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`  HTTP API:    http://${host}:${port}`);
      console.log(`  Socket.IO:   ws://${host}:${port}`);
      console.log(`  Version:     ${version}`);
      console.log('');
      console.log('  Database Status:');
      if (dbInitResult.databaseCreated) {
        console.log('    ✅ Database created');
      } else {
        console.log('    ✅ Database exists');
      }
      if (dbInitResult.tablesCreated) {
        console.log('    ✅ Tables created');
      } else {
        console.log('    ✅ Tables exist');
      }
      console.log('');
      console.log('  Server is ready to accept connections');
      console.log(`  DB HealthCheck interval: ${dbHealthCheckIntervalMs}ms`);
      console.log('');
    });

    dbMonitorTimer = setInterval(() => {
      checkDbHealth('periodic').catch((error) => {
        console.error('[Server][DB] periodic check crashed:', error.message);
      });
    }, dbHealthCheckIntervalMs);
    dbMonitorTimer.unref();

    const gracefulShutdown = async (signal) => {
      console.log(`[Server] ${signal} received, shutting down gracefully...`);
      if (dbMonitorTimer) {
        clearInterval(dbMonitorTimer);
        dbMonitorTimer = null;
      }
      httpServer.close(async () => {
        await closePool();
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    };

    // 优雅关闭处理
    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM').catch((error) => {
        console.error('[Server] Error during SIGTERM shutdown:', error);
        process.exit(1);
      });
    });

    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT').catch((error) => {
        console.error('[Server] Error during SIGINT shutdown:', error);
        process.exit(1);
      });
    });

  } catch (error) {
    console.error('[Server] Fatal error during startup:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
