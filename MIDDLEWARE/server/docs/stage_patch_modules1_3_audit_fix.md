# 模块一~三中期审计改正补丁落地说明

## 1. 范围
本补丁仅改造模块一（DAL/模型层）、模块二（HTTP 协同层）、模块三（Socket 调度器），不改动已发布的主路由与 Envelope 主结构。

## 2. 模块一改造
- 在校验层强制 `InitConfig.specialEntities[].triggerAt` 必填且 `>=0`。
- 在校验层新增 `PlanConfig.initConfigLike.specialEntities[].triggerAt >= fromSimTime` 约束。
- 新增仓储接口 `getSimulationInitConfig(simulationId)`，支持基线灾害参数继承与审计追溯。
- 新增 SQL 脚本 `PROJECT/MIDDLEWARE/db/sql/module1_trigger_trace_queries.sql`：
  - 查询 InitConfig 中 special entity 的 triggerAt。
  - 查询 PlanConfig 中 triggerAt/startAt 的统一时序视图。

## 3. 模块二改造
- `/api/plans` 与兼容路由 `/api/plan` 增加灾害继承逻辑：
  - 当 `initConfigLike.disasters` 缺失时，从 `fromSimulationId` 的基线 init_config 继承。
  - 基线缺失或不可继承时返回 `404 + Error`，错误码 `BASELINE_INHERITANCE_FAILED`。
- `/api/plans` 与 `/api/plan` 的 Ack payload 新增：
  - `inheritanceUsed: boolean`
  - `compiledActionCount: number`
- `/api/plans/:planId/apply` 与 `/api/plan/apply` 的 Ack payload 新增：
  - `compiledActionCount: number`

## 4. 模块三改造
- 新增动作编译器 `src/plan/actionCompiler.js`：
  - 统一编译 `planRuntime.actions[].startAt` 与 `initConfigLike.specialEntities[].triggerAt`。
  - 兼容旧 PlanConfig（无 triggerAt 时仍可使用 startAt 编排）。
  - 统一排序并生成 `dedupeKey = targetId + action + triggerTime`。
- 调度器增加队列执行机制：
  - `PlanCommand` 进入时先编译并入队。
  - tick/seek 时执行到期动作并广播 `PlanCommand`。
  - 对重复动作做去重，确保“同 targetId + action + triggerTime 只执行一次”。
- `PlanCommand` Ack 新增统计字段：
  - `compiledActionCount`
  - `acceptedActionCount`
  - `dedupedActionCount`

## 5. 回归测试增量
- `tests/module1.test.js`
  - 新增：缺失 triggerAt 时校验失败。
- `tests/module2.test.js`
  - 新增：InitConfig 缺失 triggerAt 返回 400。
  - 新增：PlanConfig 未提供 disasters 时继承成功且 `inheritanceUsed=true`。
  - 既有用例增强：断言 `compiledActionCount` 返回。
- `tests/module3.test.js`
  - 新增：重复动作仅编译/执行一次（包含 specialEntities + actions 混合去重场景）。

## 6. 兼容策略
- 不移除旧 API 路由。
- 不变更 Envelope 固定字段。
- 不改变 DataStruction 既定字段名。
