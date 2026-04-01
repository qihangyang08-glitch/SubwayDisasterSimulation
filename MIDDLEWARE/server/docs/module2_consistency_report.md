# Module 2 一致性报告

## 范围
- 目标：HTTP API 协同层（Express）。
- 核对来源：前端任务清单 V1.4 与 DataStruction V1.0。

## 已确认一致
1. 路由主版本完整覆盖：
   - POST /api/simulations
   - POST /api/simulations/:simId/frames
   - GET /api/simulations
   - GET /api/simulations/:simId/info
   - GET /api/simulations/:simId/frame?time=...
   - GET /api/simulations/:simId/frame/:frameIndex
   - POST /api/plans
   - POST /api/plans/:planId/apply
2. 统一 Envelope 固定字段：version, requestId, simulationId, messageType, sentAt, payload。
3. messageType 对齐规则：
   - frame 查询返回 FrameSnapshot
   - 其余管理类接口返回 Ack
   - 错误统一 Error
4. 对模块一依赖边界符合要求：
   - 仅调用 SimulationRepository 与 PlanRepository。
   - 不暴露 Socket 与 UE 直接链路。
5. 字段语义保持 camelCase：
   - API 输出均为 camelCase。
   - DB 命名转换仍由模块一 mapper 完成。

## 冲突与修正建议
1. 兼容别名路由缺少 path 参数：
   - 旧路由 POST /api/plan/apply 没有 planId 路径段。
   - 修正策略：兼容支持 body.planId 或 query.planId，且返回 Deprecation 头引导迁移。
2. /plans/:planId/apply 的输入只给出 fromSimTime，可执行化缺少 newSimulationId：
   - 修正策略：HTTP 层按 PlanConfig.initConfigLike 自动创建 newSimulationId 对应 simulation，再写入 plan_run。
   - 不改动原字段契约，只补全服务端流程。

## 无合同变更
- 未改动已确定字段名称与核心输入输出契约。
- 所有补充仅在服务端实现细节层。