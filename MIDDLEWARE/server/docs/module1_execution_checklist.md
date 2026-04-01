# Module 1 执行检查清单

## 交付物检查清单
- [x] 包含表结构与索引的 DDL。
- [x] DAL/Repository 接口实现。
- [x] DB snake_case -> 上层 camelCase 映射。
- [x] 连接池与事务封装。
- [x] 帧批量写入的幂等策略。
- [x] 最小验收与回滚测试清单。

## Repository 接口 I/O 定义

### createSimulation(initConfig: InitConfig)
- 输入：
  - `initConfig`（DataStruction InitConfig）
- 输出：
  - `{ simulationId }`

### batchInsertFrames(simulationId: string, frames: FrameSnapshot[], options?)
- 输入：
  - `simulationId`
  - `frames[]`
  - `options.idempotencyMode`：`ignore | upsert`（默认 `upsert`）
- 输出：
  - `{ insertedOrAffectedRows, frameCount, idempotencyMode }`

### createPlan(planConfig: PlanConfig)
- 输入：
  - `planConfig`（DataStruction PlanConfig）
- 输出：
  - `{ planId }`

### createPlanRun({baseSimulationId, planId, newSimulationId})
- 输入：
  - `baseSimulationId`
  - `planId`
  - `newSimulationId`
- 输出：
  - `{ planRunId, baseSimulationId, planId, newSimulationId }`

### getFrameByTime(simulationId, targetTime)
- 输出：
  - 满足 `simTime <= targetTime` 的最近历史 `FrameSnapshot`，或 `null`

### getFrameByIndex(simulationId, frameIndex)
- 输出：
  - 精确匹配的 `FrameSnapshot`，或 `null`

### getSimulationTimeRange(simulationId)
- 输出：
  - `{ minSimTime, maxSimTime }`（无帧时可为 null）

### getPlanRuns(baseSimulationId)
- 输出：
  - 按 `createdAt DESC` 排序的列表

### listSimulations()
- 输出：
  - `[{ simulationId, scenarioId, mapLevel, status, createdAt, minSimTime, maxSimTime }]`

## 幂等性与事务边界

### 帧批量插入幂等性
- `ignore` 模式：
  - 重复的 `(sim_id, frame_index)` 行会被忽略。
- `upsert` 模式：
  - 重复键会更新 `sim_time`、`frame_snapshot`、`created_at`。
- 两种模式都可保证查询正确性并防止重复数据污染。

### 事务边界
- `batchInsertFrames` 在一个事务中执行。
- `createPlanWithRun` 在一个事务中执行 `plans + plan_runs`。
- 死锁/锁超时错误采用有界退避重试。

## 最小验收用例

1. createSimulation 后查询时间范围：
   - 操作：使用有效 InitConfig 创建一个 simulation。
   - 断言：`getSimulationTimeRange(simulationId)` 返回 `{minSimTime:null,maxSimTime:null}`。

2. batchInsertFrames 后调用 getFrameByTime：
   - 操作：插入多帧，并使用中间时间点 targetTime 查询。
   - 断言：返回最近历史帧（`simTime <= targetTime`）。

3. createPlan + createPlanRun 关联：
   - 操作：创建一个 plan 和一个绑定 `baseSimulationId` 的 plan run。
   - 断言：`getPlanRuns(baseSimulationId)` 返回按 `createdAt` 降序排列的关联记录。

## 失败与回滚用例

1. 批量写入中断：
   - 预期：整个事务回滚；不存在部分帧写入。

2. 连接池不可用：
   - 预期：携带明确 DB 错误快速向上层失败返回。
   - 可选扩展：在更高服务层入队重试。

3. 重复帧插入：
   - 预期：按模式被忽略或 upsert；查询结果保持稳定。
