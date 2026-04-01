# Module 5 运行手册

## 1) 范围
- 目标：方案配置与接力（apply -> dispatch 两阶段）。
- 依赖：模块一 Repository（plans/plan_runs）、模块三 Dispatcher（PlanCommand）。
- 不变更：Envelope 固定字段、既有 /api/plans 与 /api/plans/:planId/apply 契约。

## 2) 启动
1. 进入 PROJECT/MIDDLEWARE/server
2. 运行 npm install
3. 运行 npm start

## 3) 新增接口

### POST /api/plans/:planId/dispatch
- 请求体：
```json
{
  "simulationId": "sim_20260310_002"
}
```
或
```json
{
  "newSimulationId": "sim_20260310_002"
}
```
- 响应（成功 Ack）：
```json
{
  "version": "1.0",
  "requestId": "req-xxx",
  "simulationId": "sim_20260310_002",
  "messageType": "Ack",
  "sentAt": 1773091200123,
  "payload": {
    "status": "ok",
    "planId": "plan_20260310_a",
    "simulationId": "sim_20260310_002",
    "compiledActionCount": 12,
    "acceptedActionCount": 10,
    "dedupedActionCount": 2
  }
}
```
- 响应（失败转 pending）：HTTP 202 + Ack，payload.status=pending，并写入 retryQueue。

### 兼容路由 POST /api/plan/dispatch（过渡期）
- 入参：body.planId 或 query.planId + simulationId/newSimulationId
- 行为：与主路由一致，附带 Deprecation Header。

## 4) 两阶段语义
1. apply：仅负责创建 newSimulationId + 写 plan_run。
2. dispatch：仅负责向模块三投递 PlanCommand。
- apply 与 dispatch 均按 requestId 幂等（POST 请求）。

## 5) 失败与补偿
- plan_run 写入失败：记录 orphan_pending_cleanup 任务到 retryQueue。
- dispatch 失败：返回 202 pending，记录 plan_dispatch 任务到 retryQueue。
- dispatcher 不可用：同 dispatch 失败处理。

## 6) 验证命令
- 全量测试：npm test
- 模块五测试：node --test tests/module5.test.js
