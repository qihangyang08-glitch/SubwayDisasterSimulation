# Module 5 一致性报告

## 核对范围
- 清单：模块五 方案配置与接力。
- 语义：DataStruction V1.1 PlanConfig/PlanRun 与 Envelope 统一约束。

## 一致项
1. 两阶段链路一致：
- apply（入库+接力）与 dispatch（动作投递）已分离。

2. 字段契约一致：
- PlanConfig 使用 fromSimulationId/fromSimTime/planSource/initConfigLike/planRuntime。
- Ack 返回支持 compiledActionCount。

3. 幂等与重试一致：
- apply/dispatch 均基于 requestId 幂等。
- dispatch 失败返回 pending，并进入重试队列。

4. 兼容策略一致：
- 主路由 /api/plans/:planId/dispatch。
- 兼容路由 /api/plan/dispatch 保留并附弃用标记。

## 冲突与修正建议
1. 当前 dispatch 仅支持 HTTP 触发到中台 Dispatcher。
- 这与“可复用 Socket PlanCommand 事件”不冲突，但建议后续补充一个显式内部服务接口文档，避免调用方误解为必须走 Socket 客户端。

2. apply 阶段无法在跨仓储失败时做单事务回滚（createSimulation 与 createPlanRun 不在同一 DB 事务）。
- 已采用补偿策略：orphan_pending_cleanup。
- 建议后续引入跨步骤状态表（如 plan_run_status）增强可观测性。

## 不变更声明
- 未改动既有字段命名与已确认契约。
- 未修改模块一~四对外路径与消息结构。
