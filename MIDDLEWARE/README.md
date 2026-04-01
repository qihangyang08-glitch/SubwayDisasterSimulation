# 控制与数据中台服务

## 📖 简介

本服务是数字孪生地铁灾害应急仿真系统的核心中台，负责：
- 仿真数据的持久化存储
- 实时帧数据的推送和播放控制
- 应急计划的编译和执行
- 前端与UE之间的通信协调

## 🏗️ 架构

```
HTTP API Layer          Socket.IO Layer
     ↓                       ↓
Route Handlers        Dispatcher
     ↓                       ↓
Repository Layer      Session Manager
     ↓                       ↓
  Database            Frame Broadcaster
```

## 🚀 快速开始

### 1. 安装依赖
```bash
cd server
npm install
```

### 2. 配置环境变量

复制配置示例并编辑：
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

编辑 `.env` 文件，主要配置数据库密码：
```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password    # 修改为你的MySQL密码
DB_NAME=metro_sim

# 其他配置使用默认值即可
```

### 3. 启动服务（自动初始化数据库）

```bash
npm start
```

**✨ 新功能**: 服务启动时会自动检查数据库状态：
- 如果数据库不存在，自动创建
- 如果表不存在，自动创建
- 验证表结构完整性

预期输出：
```
[Server] Initializing database...
[DBInitializer] Database ready
╔════════════════════════════════════════════════════════════╗
║  Metro Simulation Middleware Server                       ║
╚════════════════════════════════════════════════════════════╝

  HTTP API:    http://0.0.0.0:3000
  Socket.IO:   ws://0.0.0.0:3000
  
  Database Status:
    ✅ Database exists
    ✅ Tables exist
```

### 数据库初始化与检查（测试阶段）

测试阶段不再依赖额外初始化脚本。直接启动服务即可自动完成数据库与表结构就绪检查。

```bash
npm start
```

如需检查数据库健康状态，使用服务内置接口：

```bash
curl http://localhost:3000/healthz
```

### 服务访问地址
- HTTP API: http://localhost:3000
- Socket.IO: ws://localhost:3000

### 📖 数据库初始化详细文档
- **快速开始**: [db/QUICK_START.md](db/QUICK_START.md)
- **完整文档**: [db/README_DB_INIT.md](db/README_DB_INIT.md)
- **文档索引**: [db/INDEX.md](db/INDEX.md)

## 📊 数据库表结构

### simulations
存储仿真配置信息
```sql
- sim_id (PRIMARY KEY) : 仿真ID
- init_config (JSON)    : 初始化配置
- created_at (BIGINT)   : 创建时间戳
```

### simulation_frames
存储仿真帧数据
```sql
- sim_id (INDEX)        : 仿真ID  
- frame_index (INDEX)   : 帧索引
- sim_time (INDEX)      : 仿真时间
- frame_snapshot (JSON) : 帧快照数据
- created_at (BIGINT)   : 创建时间戳
```

### plans
存储应急计划
```sql
- plan_id (PRIMARY KEY)     : 计划ID
- from_simulation_id (FK)   : 基准仿真ID
- from_sim_time (DECIMAL)   : 应用起始时间
- plan_source (VARCHAR)     : 计划来源
- plan_config (JSON)        : 计划配置
- created_at (BIGINT)       : 创建时间戳
```

### plan_runs
存储计划执行记录
```sql
- plan_run_id (PRIMARY KEY)  : 执行ID
- base_simulation_id (FK)    : 基准仿真ID
- plan_id (FK)               : 计划ID
- new_simulation_id (FK)     : 新生成仿真ID
- created_at (BIGINT)        : 创建时间戳
```

## 🔌 API接口

### 仿真管理

#### 创建仿真
```http
POST /api/simulations
Content-Type: application/json
X-Request-Id: req-xxx (optional, for idempotency)

{
  "version": "1.0",
  "messageType": "InitConfig",
  "payload": {
    "scenarioId": "scenario_001",
    "totalPeople": 500,
    "disasters": { ... },
    "specialEntities": [ ... ]
  }
}

Response: 200 OK
{
  "version": "1.0",
  "simulationId": "sim_xxx",
  "messageType": "Ack",
  "payload": {
    "simulationId": "sim_xxx",
    "createdAt": 1711784400000
  }
}
```

#### 插入帧数据
```http
POST /api/simulations/:simId/frames
Content-Type: application/json

{
  "version": "1.0",
  "messageType": "FrameData",
  "payload": {
    "frames": [
      {
        "frameIndex": 0,
        "simTime": 0.0,
        "agents": [ ... ],
        "environment": { ... }
      }
    ]
  }
}

Response: 200 OK
{
  "payload": {
    "frameCount": 1,
    "insertedCount": 1
  }
}
```

#### 查询帧快照
```http
GET /api/simulations/:simId/frame?time=5.5

Response: 200 OK
{
  "version": "1.0",
  "messageType": "FrameSnapshot",
  "payload": {
    "frameIndex": 55,
    "simTime": 5.5,
    "agents": [ ... ],
    "environment": { ... }
  }
}
```

### 计划管理

#### 创建计划
```http
POST /api/plans
Content-Type: application/json

{
  "version": "1.0",
  "messageType": "PlanConfig",
  "payload": {
    "fromSimulationId": "sim_xxx",
    "fromSimTime": 5.0,
    "planRuntime": {
      "actions": [ ... ]
    }
  }
}
```

#### 应用计划
```http
POST /api/plans/:planId/apply
Content-Type: application/json

{
  "version": "1.0",
  "messageType": "ApplyPlan",
  "payload": {
    "fromSimTime": 5.0
  }
}

Response: 200 OK
{
  "payload": {
    "planRunId": "planrun_xxx",
    "newSimulationId": "sim_yyy"
  }
}
```

## 🔄 Socket.IO事件

### 客户端 → 服务器

#### subscribe - 订阅仿真
```javascript
socket.emit('subscribe', {
  simulationId: 'sim_xxx',
  clientRole: 'frontend',  // 或 'ue'
  requestId: 'req-xxx'
});
```

#### play - 开始播放
```javascript
socket.emit('play', {
  simulationId: 'sim_xxx',
  requestId: 'req-xxx'
});
```

#### pause - 暂停播放
```javascript
socket.emit('pause', {
  simulationId: 'sim_xxx',
  requestId: 'req-xxx'
});
```

#### seek - 跳转时间
```javascript
socket.emit('seek', {
  simulationId: 'sim_xxx',
  requestId: 'req-xxx',
  payload: {
    targetTime: 10.5
  }
});
```

#### setSpeed - 设置播放速度
```javascript
socket.emit('setSpeed', {
  simulationId: 'sim_xxx',
  requestId: 'req-xxx',
  payload: {
    speed: 2.0  // 2倍速
  }
});
```

#### ControlCamera - 摄像机控制（前端 → UE）
```javascript
socket.emit('ControlCamera', {
  simulationId: 'sim_xxx',
  requestId: 'req-xxx',
  payload: {
    command: 'rotate',
    angle: 90
  }
});
```

### 服务器 → 客户端

#### Ack - 确认响应
```javascript
socket.on('Ack', (data) => {
  // data.payload.status: 'ok' | 'error'
  // data.payload.action: 操作类型
});
```

#### SimState - 播放状态
```javascript
socket.on('SimState', (data) => {
  // data.payload.state: 'playing' | 'paused'
  // data.payload.currentTime: 当前时间
  // data.payload.playbackSpeed: 播放速度
});
```

#### UpdateFrame - 帧更新
```javascript
socket.on('UpdateFrame', (data) => {
  // data.payload: FrameSnapshot
  // data.payload.simTime
  // data.payload.agents[]
  // data.payload.environment
});
```

#### ControlCamera - 摄像机控制（仅UE接收）
```javascript
socket.on('ControlCamera', (data) => {
  // 仅 clientRole='ue' 的客户端会收到
  // data.payload: camera command
});
```

## 🔧 核心组件

### Repository Layer

#### SimulationRepository
- `createSimulation(initConfig)` - 创建仿真
- `insertFramesBatch(simId, frames)` - 批量插入帧
- `getFrameByTime(simId, time)` - 查询最近帧
- `getSimulationTimeRange(simId)` - 获取时间范围

#### PlanRepository
- `createPlan(planConfig)` - 创建计划
- `createPlanRun(input)` - 创建执行记录
- `applyPlan(planId, fromSimTime)` - 应用计划

### Socket.IO Dispatcher

#### 核心功能
- Session管理（按simulationId分组）
- 播放状态机（paused ↔ playing）
- 时间推进（基于tickMs）
- 帧广播（UpdateFrame事件）
- 客户端角色隔离（frontend vs ue）

#### Session生命周期
```
1. 客户端订阅 → 创建/加入session
2. Session跟踪连接数（connectedSockets Set）
3. 客户端断开 → 从session移除
4. 连接数为0 → 清理session（BUG-002修复）
```

### Idempotency Store

#### 内存存储（单实例）
```javascript
const { IdempotencyStore } = require('./idempotencyStore');
const store = new IdempotencyStore({
  ttlMs: 10 * 60 * 1000,  // 10分钟
  maxEntries: 2000
});
```

#### 数据库存储（多实例）
```javascript
const { DatabaseIdempotencyStore } = require('./databaseIdempotencyStore');
const store = new DatabaseIdempotencyStore();
await store.ensureTable();
store.startCleanupInterval();
```

## 🐛 已修复的缺陷

### BUG-001: planRepository返回值一致性
- **问题**: 幂等冲突时返回的planRunId与数据库不一致
- **修复**: 冲突时查询数据库获取实际ID
- **位置**: `src/repositories/planRepository.js:76-91`

### BUG-002: Socket session内存泄漏
- **问题**: 客户端断开后session永不清理
- **修复**: 跟踪连接数，零连接时自动清理
- **位置**: `src/socket/dispatcher.js:76-89, 520-542`

### BUG-003: 客户端角色隔离缺失
- **问题**: ControlCamera会广播给所有客户端
- **修复**: 添加clientRole标识，仅转发给UE客户端
- **位置**: `src/socket/dispatcher.js:469-501`

### BUG-004: 幂等存储本地化
- **问题**: 多实例部署时幂等缓存不共享
- **修复**: 实现DatabaseIdempotencyStore
- **位置**: `src/http/databaseIdempotencyStore.js`

## 🧪 测试

### 单元测试
```bash
npm test
```

### 集成测试
```bash
npm run test:integration
```

### 手动测试
参见项目根目录的 [TEST_GUIDE.md](../../TEST_GUIDE.md)

## 📝 调试日志

启用调试模式：
```bash
DEBUG=true npm start
```

关键日志：
```
[PlanRepository] Created new plan_run: planrun_xxx
[PlanRepository] Duplicate key conflict detected, querying actual plan_run_id
[Dispatcher] Socket abc123 subscribed to sim_xxx (role: frontend, total clients: 2)
[Dispatcher] Session sim_xxx state changed: paused → playing
[Dispatcher] ControlCamera forwarded to 1 UE clients (filtered 1 non-UE clients)
[Dispatcher] Socket abc123 disconnected from sim_xxx (1 client remaining)
[Dispatcher] Session sim_xxx cleaned up (no more clients)
[Idempotency] Cache hit: req-xxx
[Idempotency] Cache miss: req-yyy
```

## 🔐 安全配置

### 启用认证
```bash
# .env
AUTH_ENABLED=1
AUTH_SECRET=your_secret_key
```

### CORS配置
```bash
CORS_ENABLED=1
CORS_ORIGIN=https://yourdomain.com
```

## 📈 性能优化

### 数据库连接池
```bash
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### Socket.IO Tick间隔
```bash
SOCKET_TICK_MS=1000  # 每秒推送1次（调小会更流畅但占用更多资源）
```

### 幂等缓存
```bash
IDEMPOTENCY_TTL_MS=600000  # 10分钟
```

## 🚀 部署

### 单实例部署
```bash
npm start
```

### 多实例部署
1. 使用DatabaseIdempotencyStore
2. 配置负载均衡器
3. 确保所有实例连接同一数据库

```javascript
// server.js
const { DatabaseIdempotencyStore } = require('./src/http/databaseIdempotencyStore');
const idempotencyStore = new DatabaseIdempotencyStore();
await idempotencyStore.ensureTable();
idempotencyStore.startCleanupInterval();

const app = createApp({ idempotencyStore });
```

### Docker部署
```bash
docker build -t subway-middleware .
docker run -p 3000:3000 --env-file .env subway-middleware
```

## 📖 相关文档

- [项目总览](../../README.md)
- [测试指南](../../TEST_GUIDE.md)
- [数据结构规范](../../DOCS/01_DESIGN/DataStruction.md)
- [审计报告](../../DOCS/03_AUDIT/)

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

[许可证类型]
