# Module 1 运行手册

## 1) 应用 Schema
1. 按需创建数据库：
  - `CREATE DATABASE metro_sim CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
2. 应用 DDL：
  - 执行文件 `PROJECT/MIDDLEWARE/db/sql/module1_schema.sql`

## 2) 安装依赖
1. 进入 `PROJECT/MIDDLEWARE/server`
2. 运行 `npm install`

## 3) 配置环境变量
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_CONNECTION_LIMIT`（可选）
- `DB_CONNECT_TIMEOUT_MS`（可选）

## 4) 使用示例

```js
const { SimulationRepository, PlanRepository } = require('./src/repositories');

const simRepo = new SimulationRepository();
const planRepo = new PlanRepository();

async function demo(initConfig, frames, planConfig, newSimulationId) {
  const { simulationId } = await simRepo.createSimulation(initConfig);
  await simRepo.batchInsertFrames(simulationId, frames, { idempotencyMode: 'upsert' });

  const nearestFrame = await simRepo.getFrameByTime(simulationId, 12.5);
  const timeRange = await simRepo.getSimulationTimeRange(simulationId);

  const { planId } = await planRepo.createPlan(planConfig);
  const planRun = await planRepo.createPlanRun({
    baseSimulationId: planConfig.fromSimulationId,
    planId,
    newSimulationId
  });

  return { simulationId, nearestFrame, timeRange, planRun };
}
```

## 5) 运行验收模板
- 可选集成运行：
  - 设置 `MODULE1_DB_TEST=1`
  - 运行 `npm test`
- 未设置该环境变量时的默认行为：
  - 为避免 DB 缺失导致 CI 失败，测试将被跳过。

## 6) triggerAt 审计追溯
1. 执行 `PROJECT/MIDDLEWARE/db/sql/module1_trigger_trace_queries.sql`。
2. 通过 SQL 参数传入 `sim_id` 或 `plan_id` 查询：
  - InitConfig 内 `specialEntities[].triggerAt`
  - PlanConfig 内 `specialEntities[].triggerAt` 与 `planRuntime.actions[].startAt`
