# 数据库自检与初始化功能

## 概述

本项目实现了自动化的数据库检查和初始化功能，可以在服务启动时或手动执行时自动完成以下操作：

1. **检查数据库是否存在** - 如果不存在，自动创建
2. **检查表结构是否存在** - 如果不存在，自动创建所有必需的表
3. **验证表结构完整性** - 确保所有关键字段都存在
4. **提供详细的初始化日志** - 便于调试和问题定位

## 功能特点

✅ **自动化** - 服务启动时自动执行数据库检查  
✅ **幂等性** - 重复执行不会破坏现有数据  
✅ **安全性** - 只创建不存在的数据库和表，不修改已有数据  
✅ **详细日志** - 提供清晰的执行过程和结果反馈  
✅ **错误处理** - 完善的错误捕获和提示信息  

## 核心模块

### 1. dbInitializer.js

位置：`src/db/dbInitializer.js`

主要功能模块：

```javascript
const { 
  initializeDatabase,     // 完整的数据库初始化流程
  checkConnection,        // 检查数据库连接
  checkDatabaseExists,    // 检查数据库是否存在
  checkTableExists,       // 检查单个表是否存在
  checkAllTables,         // 检查所有必需的表
  validateTableStructure  // 验证表结构完整性
} = require('./src/db/dbInitializer');
```

#### initializeDatabase()

主初始化函数，执行完整的检查和创建流程：

```javascript
async function initializeDatabase(options = {}) {
  // 返回结果对象：
  // {
  //   success: boolean,           // 是否成功
  //   databaseCreated: boolean,   // 是否创建了数据库
  //   tablesCreated: boolean,     // 是否创建了表
  //   message: string,            // 结果消息
  //   details: {
  //     existingTables: [...],    // 已存在的表
  //     missingTables: [...]      // 缺失的表（已创建）
  //   }
  // }
}
```

#### checkConnection()

测试数据库连接是否可用：

```javascript
const isConnected = await checkConnection();
if (isConnected) {
  console.log('Database connection OK');
}
```

#### validateTableStructure()

验证表结构是否包含所有必需的字段：

```javascript
const isValid = await validateTableStructure(connection, dbName);
```

## 使用方法

### 方法1: 自动初始化（推荐）

服务启动时会自动执行数据库检查和初始化：

```bash
npm start
```

启动输出示例：

```
[Server] Initializing database...
[DBInitializer] ========== Database Initialization Started ==========
[DBInitializer] Target database: metro_sim
[DBInitializer] Host: localhost:3306
[DBInitializer] Connecting to MySQL server...
[DBInitializer] Connected to MySQL server successfully
[DBInitializer] Checking if database 'metro_sim' exists...
[DBInitializer] Database 'metro_sim' already exists
[DBInitializer] Switching to database 'metro_sim'...
[DBInitializer] Checking tables...
[DBInitializer] All required tables exist
[DBInitializer] Validating table structure...
[DBInitializer] Table structure validation passed
[DBInitializer] ========== Database Initialization Completed Successfully ==========
[Server] Database ready
╔════════════════════════════════════════════════════════════╗
║  Metro Simulation Middleware Server                       ║
╚════════════════════════════════════════════════════════════╝

  HTTP API:    http://0.0.0.0:3000
  Socket.IO:   ws://0.0.0.0:3000
  Version:     1.0

  Database Status:
    ✅ Database exists
    ✅ Tables exist

  Server is ready to accept connections
```

### 方法2: 手动初始化

独立执行数据库初始化，不启动服务：

```bash
npm run db:init
```

### 方法3: 检查数据库状态

只检查状态，不做任何修改：

```bash
npm run db:check
```

输出示例：

```
╔════════════════════════════════════════════════════════════╗
║  Metro Simulation - Database Status Check                 ║
╚════════════════════════════════════════════════════════════╝

Step 1: Testing MySQL server connection...
  Host: localhost:3306
  User: root

  ✅ MySQL server is accessible

Step 2: Checking database...
  Database name: metro_sim
  ✅ Database exists

Step 3: Checking tables...
  Required tables: 4

  Table Status:
    ✅ simulations
    ✅ simulation_frames
    ✅ plans
    ✅ plan_runs

  ✅ All required tables exist

Step 4: Validating table structure...
  ✅ Table structure is valid

Step 5: Database statistics...
  📊 simulations: 0 rows
  📊 simulation_frames: 0 rows
  📊 plans: 0 rows
  📊 plan_runs: 0 rows

╔════════════════════════════════════════════════════════════╗
║  Database Status: OK                                       ║
╚════════════════════════════════════════════════════════════╝

🎉 Database is ready for use!
```

## 配置

数据库配置通过环境变量设置，位于 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost           # MySQL服务器地址
DB_PORT=3306                # MySQL端口
DB_USER=root                # 数据库用户名
DB_PASSWORD=your_password   # 数据库密码
DB_NAME=metro_sim          # 数据库名称

# 连接池配置（可选）
DB_CONNECTION_LIMIT=16      # 最大连接数
DB_QUEUE_LIMIT=0            # 队列限制
DB_CONNECT_TIMEOUT_MS=10000 # 连接超时时间
```

## 数据库表结构

系统会自动创建以下4张表：

### 1. simulations
存储仿真配置信息

| 字段 | 类型 | 说明 |
|------|------|------|
| sim_id | VARCHAR(64) | 仿真ID（主键） |
| scenario_id | VARCHAR(128) | 场景ID |
| map_level | VARCHAR(128) | 地图关卡 |
| status | VARCHAR(32) | 状态 |
| init_config | JSON | 初始化配置 |
| created_at | BIGINT UNSIGNED | 创建时间戳（毫秒） |
| finished_at | BIGINT UNSIGNED | 完成时间戳（毫秒） |

### 2. simulation_frames
存储仿真帧数据

| 字段 | 类型 | 说明 |
|------|------|------|
| sim_id | VARCHAR(64) | 仿真ID |
| frame_index | INT UNSIGNED | 帧索引 |
| sim_time | DECIMAL(12,3) | 仿真时间（秒） |
| frame_snapshot | JSON | 帧快照数据 |
| created_at | BIGINT UNSIGNED | 创建时间戳（毫秒） |

主键：(sim_id, frame_index)  
索引：(sim_id, sim_time)

### 3. plans
存储应急计划

| 字段 | 类型 | 说明 |
|------|------|------|
| plan_id | VARCHAR(64) | 计划ID（主键） |
| from_simulation_id | VARCHAR(64) | 基准仿真ID |
| from_sim_time | DECIMAL(12,3) | 应用起始时间（秒） |
| plan_source | VARCHAR(16) | 计划来源 |
| plan_config | JSON | 计划配置 |
| created_at | BIGINT UNSIGNED | 创建时间戳（毫秒） |

索引：from_simulation_id

### 4. plan_runs
存储计划执行记录

| 字段 | 类型 | 说明 |
|------|------|------|
| plan_run_id | VARCHAR(64) | 执行ID（主键） |
| base_simulation_id | VARCHAR(64) | 基准仿真ID |
| plan_id | VARCHAR(64) | 计划ID |
| new_simulation_id | VARCHAR(64) | 新生成仿真ID |
| created_at | BIGINT UNSIGNED | 创建时间戳（毫秒） |

唯一键：(base_simulation_id, plan_id, new_simulation_id)  
索引：(base_simulation_id, created_at)

## 工作流程

### 初始化流程图

```
┌─────────────────────────┐
│   服务启动 / 手动执行    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  连接MySQL服务器         │
│  （不指定数据库）        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  检查数据库是否存在      │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
   不存在        存在
     │             │
     ▼             │
┌─────────┐        │
│创建数据库│        │
└────┬────┘        │
     │             │
     └──────┬──────┘
            │
            ▼
┌─────────────────────────┐
│  切换到目标数据库        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  检查所有必需的表        │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
  有缺失        全部存在
     │             │
     ▼             │
┌─────────┐        │
│创建缺失表│        │
└────┬────┘        │
     │             │
     └──────┬──────┘
            │
            ▼
┌─────────────────────────┐
│  验证表结构完整性        │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
   验证失败      验证通过
     │             │
     ▼             ▼
┌─────────┐  ┌─────────┐
│报告错误  │  │初始化完成│
└─────────┘  └─────────┘
```

## 错误处理

### 常见错误及解决方案

#### 1. MySQL服务器连接失败

```
❌ Cannot connect to MySQL server
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**解决方案：**
- 确认MySQL服务已启动
- 检查 `DB_HOST` 和 `DB_PORT` 配置是否正确
- 检查防火墙设置

#### 2. 权限不足

```
❌ Error: Access denied for user 'root'@'localhost' (using password: YES)
```

**解决方案：**
- 检查 `DB_USER` 和 `DB_PASSWORD` 是否正确
- 确认用户有创建数据库和表的权限

```sql
-- 授予权限（在MySQL中执行）
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. SQL文件未找到

```
❌ SQL file not found: /path/to/module1_schema.sql
```

**解决方案：**
- 确认 `db/sql/module1_schema.sql` 文件存在
- 检查文件路径是否正确

#### 4. 表结构验证失败

```
⚠️ Table simulations is missing columns: scenario_id, map_level
```

**解决方案：**
- 备份现有数据
- 删除并重新创建表结构
- 或手动添加缺失的列

## 开发集成

### 在代码中使用

```javascript
const { initializeDatabase } = require('./src/db/dbInitializer');

// 在应用启动时调用
async function startApp() {
  try {
    const result = await initializeDatabase();
    
    if (result.success) {
      console.log('Database ready');
      // 启动应用...
    } else {
      console.error('Database init failed:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
```

### 自定义配置

```javascript
// 使用自定义配置
const result = await initializeDatabase({
  host: 'custom-host',
  port: 3307,
  user: 'custom-user',
  password: 'custom-password',
  database: 'custom-db'
});
```

## 测试

运行测试验证数据库初始化功能：

```bash
npm test
```

## 最佳实践

1. **首次部署** - 在部署到新环境时，先运行 `npm run db:check` 检查状态
2. **开发环境** - 使用 `npm start` 自动初始化，无需手动操作
3. **生产环境** - 建议在服务启动前手动运行 `npm run db:init` 确保数据库就绪
4. **备份数据** - 在任何数据库操作前都应备份重要数据
5. **权限最小化** - 生产环境建议使用权限受限的数据库账号

## 维护

### 添加新表

1. 在 `db/sql/module1_schema.sql` 中添加新表的DDL
2. 在 `dbInitializer.js` 的 `REQUIRED_TABLES` 数组中添加表名
3. 在 `validateTableStructure` 函数中添加表结构验证规则

### 修改表结构

注意：dbInitializer只创建表，不修改已存在的表。如需修改表结构：

1. 创建迁移脚本（migration script）
2. 在应用中添加版本检查机制
3. 谨慎处理数据迁移

## 许可证

与主项目保持一致
