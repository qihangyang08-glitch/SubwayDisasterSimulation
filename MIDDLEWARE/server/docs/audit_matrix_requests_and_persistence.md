# 中台审计矩阵：请求与持久化动作（模块1-3）

更新日期：2026-03-30
范围：中台模块1-3（数据库层、HTTP 层、Socket 调度层）

## A. 数据库创建/写入动作审计

| 动作名称 | 功能 | 直接落库对象 | 触发入口 | 设计期建议发起方 | 当前代码实际可发起方 | 数据结构 | 与 DataStruction 对齐 |
|---|---|---|---|---|---|---|---|
| createSimulation | 新建仿真记录并保存 initConfig | simulations | POST /api/simulations；兼容 POST /api/init；apply 时内部调用 | 前端（发起仿真）；后端（批处理） | 任意 HTTP 调用方（鉴权默认关闭） | InitConfig | 一致，对齐 InitConfig |
| batchInsertFrames | 批量写入帧，支持幂等 upsert/ignore | simulation_frames | POST /api/simulations/:simId/frames | 后端仿真引擎（主）；前端通常不应写帧 | 任意 HTTP 调用方（鉴权默认关闭） | body.frames: FrameSnapshot[] | 一致，对齐 FrameSnapshot |
| createPlan | 新建预案配置 | plans | POST /api/plans；兼容 POST /api/plan | 前端（策略提交）；后端（自动策略） | 任意 HTTP 调用方（鉴权默认关闭） | PlanConfig | 一致，对齐 PlanConfig |
| createPlanRun | 记录预案接力关系 | plan_runs | POST /api/plans/:planId/apply；兼容 POST /api/plan/apply | 前端（应用预案） | 任意 HTTP 调用方（鉴权默认关闭） | {baseSimulationId, planId, newSimulationId} | 基本一致，属于 PlanRun 关系对象 |
| createPlanWithRun | 同事务创建 plan + run | plans + plan_runs | 仅 Repository 内部方法（当前未被 HTTP 路由调用） | 后端内部流程 | 仅服务端代码路径可触发 | PlanConfig + runInput | 与 PlanConfig/PlanRun 语义一致 |

## B. 中台可接收请求审计

### B1. HTTP 请求

| 请求 | 功能 | 设计期建议来源 | 当前代码实际来源 | 数据结构 | 响应结构 |
|---|---|---|---|---|---|
| POST /api/simulations | 创建 simulation | 前端/后端 | 任意 HTTP 方 | InitConfig | Envelope(Ack, payload.simulationId) |
| POST /api/simulations/:simId/frames | 注入帧数据 | 后端主导 | 任意 HTTP 方 | {frames: FrameSnapshot[]} | Envelope(Ack, frameCount 等) |
| GET /api/simulations | 查询仿真列表 | 前端/运维 | 任意 HTTP 方 | 无 | Envelope(Ack, payload.simulations[]) |
| GET /api/simulations/:simId/info | 查询范围与状态 | 前端 | 任意 HTTP 方 | path simId | Envelope(Ack, minSimTime/maxSimTime/status) |
| GET /api/simulations/:simId/frame?time=t | 按时间取最近历史帧 | 前端/UE 联调工具 | 任意 HTTP 方 | path simId + query time | Envelope(FrameSnapshot) |
| GET /api/simulations/:simId/frame/:frameIndex | 按帧索引取帧 | 前端/UE 联调工具 | 任意 HTTP 方 | path simId/frameIndex | Envelope(FrameSnapshot) |
| POST /api/plans | 创建计划 | 前端 | 任意 HTTP 方 | PlanConfig | Envelope(Ack, payload.planId) |
| POST /api/plans/:planId/apply | 应用计划并生成接力仿真 | 前端 | 任意 HTTP 方 | {fromSimTime?} | Envelope(Ack, planRunId/newSimulationId) |
| 兼容别名 /api/init /api/plan 等 | 兼容旧协议 | 迁移期调用方 | 任意 HTTP 方 | 同主接口 | Envelope + Deprecation 头 |

### B2. Socket 请求

| 事件名 | 功能 | 设计期建议来源 | 当前代码实际来源 | 数据结构 | 下行事件 |
|---|---|---|---|---|---|
| subscribe | 订阅 simulation 房间并补发状态/帧 | 前端、UE | 任意 Socket 客户端 | {simulationId, requestId} | Ack + SimState + UpdateFrame |
| play | 播放 | 前端 | 任意 Socket 客户端 | Envelope(ControlCommand, payload.action=play) | Ack + SimState |
| pause | 暂停 | 前端 | 任意 Socket 客户端 | Envelope(ControlCommand, payload.action=pause) | Ack + SimState |
| seek | 跳转 | 前端 | 任意 Socket 客户端 | Envelope(ControlCommand, payload.action=seek,targetTime) | Ack + UpdateFrame + SimState |
| setSpeed | 倍速 | 前端 | 任意 Socket 客户端 | Envelope(ControlCommand, payload.action=setSpeed,speed) | Ack + SimState |
| ControlCamera | 摄像机控制转发 | 前端 | 任意 Socket 客户端 | Envelope(推荐 ControlCommand) | ControlCamera 广播 + Ack |
| PlanCommand | 预案动作转发 | 前端/策略端 | 任意 Socket 客户端 | Envelope(messageType=PlanCommand) | PlanCommand 广播 + Ack |

## C. 关键一致性与风险结论

### C1. 功能完整性

- 模块1-3核心功能已具备：持久化、HTTP 协同、Socket 调度均可工作。
- 满足离线计算后按需回放和交互控制主链路。

### C2. 权限严谨性

- 当前权限边界偏松：
  - HTTP 鉴权为可选且默认关闭。
  - Socket 事件未做客户端角色隔离。
- 结果：理论上前端/后端/UE 任一客户端都可发起大多数动作。

### C3. 数据结构设计一致性

- 与 DataStruction 核心对象对齐：InitConfig、FrameSnapshot、PlanConfig、ControlCommand、SimState、Ack。
- DB 使用 snake_case，服务输出 camelCase，映射清晰。
- 时间语义一致：createdAt 对应 BIGINT 毫秒时间戳。

### C4. 设计合理性评估

- 合理项：统一 Envelope、幂等写入策略、时间推进公式、乱序过滤。
- 待改进项：
  1. 角色隔离（frontend/ue/backend）与最小权限控制。
  2. plan_run 幂等冲突时返回值一致性。
  3. 幂等与重试队列外部化（多实例一致性）。

## D. 证据定位（代码行）

1. Repository 写入动作：
- createSimulation: src/repositories/simulationRepository.js:26
- batchInsertFrames: src/repositories/simulationRepository.js:52
- createPlan: src/repositories/planRepository.js:17
- createPlanRun: src/repositories/planRepository.js:46
- createPlanWithRun: src/repositories/planRepository.js:84

2. HTTP 路由：
- 主版本与兼容路由: src/http/createApp.js:161,173,198,203,220,243,262,280,314,327,347,369,388

3. Socket 事件入口：
- subscribe/play/pause/seek/setSpeed/ControlCamera/PlanCommand: src/socket/dispatcher.js:318,332,336,340,344,348,374

4. 校验规则：
- schema 入口: src/http/schemaValidator.js:82,87,92,97
- 语义规则: src/validators.js:13,19,39,83,98,123

5. 映射与时间语义：
- snake_case -> camelCase: src/mappers/rowMappers.js:11,17,28,38
- created_at BIGINT: db/sql/module1_schema.sql:13,24,41,57
