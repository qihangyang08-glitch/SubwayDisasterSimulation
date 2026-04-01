# Module 5 执行检查清单

## 交付物检查
- [x] PlanConfig 入库链路可用（POST /api/plans）。
- [x] apply 与 dispatch 两阶段解耦。
- [x] 新增 dispatch 主路由：POST /api/plans/:planId/dispatch。
- [x] 兼容路由：POST /api/plan/dispatch（带弃用头）。
- [x] dispatch 失败转 pending 并写入 retryQueue。
- [x] apply 阶段 plan_run 失败补偿标记：orphan_pending_cleanup。
- [x] 幂等：apply/dispatch 均使用 requestId（POST 重放）。

## 输入输出契约检查
- [x] dispatch 输入支持 simulationId/newSimulationId 二选一。
- [x] Ack 输出包含 compiledActionCount/acceptedActionCount/dedupedActionCount。
- [x] Envelope 固定字段不变：version/requestId/simulationId/messageType/sentAt/payload。

## 约束检查
- [x] PlanConfig 字段不改名（camelCase）。
- [x] 不引入新中间件。
- [x] 不破坏模块一~四已有接口。

## 最小验收用例
1. 提交 PlanConfig 成功入库。
2. apply 成功记录 plan_run。
3. dispatch PlanCommand 成功并返回 Ack（含 compiledActionCount）。

## 失败场景检查
- [x] planId 不存在：404 + Error Envelope。
- [x] simulationId/newSimulationId 不存在：404 + Error Envelope。
- [x] dispatch 失败：202 pending + retryQueue 入队。
