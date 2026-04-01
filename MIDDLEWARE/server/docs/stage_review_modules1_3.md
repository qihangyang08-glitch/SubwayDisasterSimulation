# 阶段审阅报告（模块1-3）

更新日期：2026-03-30
审阅范围：`PROJECT/MIDDLEWARE/server/src`、`PROJECT/MIDDLEWARE/server/tests`、`PROJECT/MIDDLEWARE/db/sql/module1_schema.sql`
审阅目标：确认模块一至三实现状态、可执行操作、测试覆盖、以及是否满足《技术文档提案_前端》的架构交互需求。

## 1. 结论总览

- 模块一（数据库与模型层）：核心 DDL、Repository、snake_case -> camelCase 映射已落地，满足主流程。
- 模块二（HTTP API 协同层）：主版本路由、兼容别名、Envelope、参数校验、幂等缓存已落地。
- 模块三（Socket.IO 调度器）：播放状态机、时间推进、按 simulationId 房间广播、断线重连后补发已落地。
- 自动化测试：模块2与模块3通过；模块1为集成测试，当前默认跳过（需 MySQL）。
- 与《技术文档提案_前端》架构匹配度：中台核心链路可用（HTTP + Socket.IO + 数据持久化），但“UE 专用通道与角色隔离”仍需加强，建议进入下一阶段修正。

## 2. 架构交互需求对齐（基于《技术文档提案_前端》）

### 2.1 已满足项

1. 前端 <-> 中台 HTTP 协同：已提供创建仿真、写入帧、查询 info/frame、计划创建与应用。
2. 前端 <-> 中台 Socket.IO 控制：已支持 play/pause/seek/setSpeed/ControlCamera/PlanCommand。
3. 中台按需取帧并推送：dispatcher 基于 `getFrameByTime` 与 tick 推进广播 `UpdateFrame`。
4. 统一 Envelope：`version/requestId/simulationId/messageType/sentAt/payload` 全链路一致。
5. 数据语义：createdAt 毫秒时间戳（DB `created_at BIGINT`），符合 DataStruction 约束。

### 2.2 部分满足/待强化项

1. UE 与前端角色隔离不充分：当前 Socket 房间内广播，`ControlCamera` 与 `PlanCommand` 会发给同房间全部客户端。
2. “中台作为 UE 指令转发中枢”逻辑成立，但尚未区分 UE 客户端身份（如 `clientRole=ue`）与专用命名空间。
3. 文档中强调后端高速帧推送到中台（可 Socket 事件），当前工程主实现是 HTTP `POST /api/simulations/:simId/frames` 入库。

## 3. 模块实现详情

### 3.1 模块一：数据库持久化与模型层

已实现能力：

- DDL 表结构：`simulations`、`simulation_frames`、`plans`、`plan_runs`。
- 主键与索引：
  - `simulation_frames(sim_id, frame_index)` 主键
  - `simulation_frames(sim_id, sim_time)` 索引
  - `plans(from_simulation_id)` 索引
- Repository 接口：
  - `createSimulation`
  - `batchInsertFrames`（支持 `ignore/upsert` 幂等策略）
  - `getFrameByTime`
  - `getFrameByIndex`
  - `getSimulationTimeRange`
  - `listSimulations`
  - `createPlan`
  - `createPlanRun`
  - `getPlanRuns`
  - `getPlanById`
- 事务封装：`withTransaction` 支持死锁/锁等待重试。
- 映射：DB snake_case 输出统一转 camelCase。

### 3.2 模块二：HTTP API 协同层

已实现能力：

- 主版本路由：
  - `POST /api/simulations`
  - `POST /api/simulations/:simId/frames`
  - `GET /api/simulations`
  - `GET /api/simulations/:simId/info`
  - `GET /api/simulations/:simId/frame?time=...`
  - `GET /api/simulations/:simId/frame/:frameIndex`
  - `POST /api/plans`
  - `POST /api/plans/:planId/apply`
- 兼容路由：`/api/init`、`/api/sim/:simulationId/state`、`/api/frame/:simulationId/:frameIndex`、`/api/plan`、`/api/plan/apply`，含 `Deprecation` 头。
- 参数校验：Ajv + 业务校验（概率、非负、唯一性等）。
- 幂等：内存 `IdempotencyStore`，基于请求方法+URL+requestId。
- 鉴权/CORS：可开关。
- 错误处理：统一 Error Envelope，并维护 `retryQueue`（5xx）。

### 3.3 模块三：Socket.IO 调度器

已实现能力：

- 事件订阅与房间：按 `simulationId` 进入房间。
- 状态机：`playing/paused`，支持 `play/pause/seek/setSpeed`。
- 时间推进：`t_next = t_current + deltaT * playbackSpeed`。
- 广播事件：`UpdateFrame`、`SimState`、`Ack`、`ControlCamera`、`PlanCommand`。
- 乱序过滤：按 `simTime + frameIndex` 丢弃旧帧。
- 补发逻辑：`subscribe` 后尝试立即补发当前帧与 `SimState`。

## 4. 关键差距与风险（按优先级）

### P0（建议尽快修复）

1. `createPlanRun` 幂等冲突时返回值可能与真实入库不一致。
   - 现状：`ON DUPLICATE KEY UPDATE plan_run_id = plan_run_id`，若命中唯一键冲突，不会写入新 `plan_run_id`，但函数仍返回新生成的 `planRunId`。
   - 风险：上层拿到的 `planRunId` 可能不存在于库中，影响追踪与审计。

### P1（建议本迭代修复）

1. `ControlCamera/PlanCommand` 广播未区分 UE 与前端客户端。
   - 风险：前端也会收到本应给 UE 的控制指令，弱化“中台转发 UE”边界。
2. 模块1自动化测试默认跳过（缺 DB 环境），无法持续验证事务/回滚等关键能力。

### P2（建议后续增强）

1. `IdempotencyStore` 为内存实现，多实例部署下无法共享幂等状态。
2. `retryQueue` 为进程内数组，重启丢失。

## 5. 当前可执行操作清单（面向联调）

1. 通过 HTTP 创建仿真、注入帧、查询时间范围与任意时刻帧。
2. 通过 HTTP 创建计划并 apply，自动生成新仿真与 plan_run 关联。
3. 通过 Socket 发控制命令：`play/pause/seek/setSpeed`。
4. 通过 Socket 收状态与帧：`SimState`、`UpdateFrame`、`Ack`。
5. 通过 Socket 发 `ControlCamera`、`PlanCommand`（当前为房间广播）。

## 6. 对下一阶段（模块四前端）的接口建议

1. 前端先按主版本路由接入，不使用兼容别名。
2. 前端 Socket 接收白名单事件：`UpdateFrame`、`SimState`、`Ack`。
3. `ControlCamera` 仅作为上行命令发送，前端侧忽略同名下行广播（直到中台完成 UE 角色隔离）。
4. 时间轴主时钟使用 `SimState.currentTime`，`UpdateFrame.simTime` 仅做校准。

## 7. 修复建议（不改 DataStruction 契约）

1. `createPlanRun`：冲突时查询并返回真实 `plan_run_id`。
2. Socket 增加客户端角色：
   - 连接参数增加 `clientRole`（`frontend`/`ue`）。
   - `ControlCamera`、`PlanCommand` 仅投递到 UE 子房间。
3. 增加 module1 CI 集成测试作业（MySQL 服务容器）。
