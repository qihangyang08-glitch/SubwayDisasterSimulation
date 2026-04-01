# Module 2 执行检查清单

## 交付物检查清单
- [x] HTTP 路由主版本清单与实现。
- [x] 响应 Envelope 统一封装（含 requestId 与 sentAt）。
- [x] Ajv 校验规则落地并联动 DataStruction 最小校验。
- [x] CORS 可开关。
- [x] Token 鉴权可开关。
- [x] 兼容别名路由与弃用提示头。
- [x] 请求幂等键（基于 requestId）实现。
- [x] 最小验收用例覆盖。

## 路由与响应契约

### POST /api/simulations
- 入参：InitConfig
- 出参：Ack
- payload：{ simulationId }

### POST /api/simulations/:simId/frames
- 入参：{ frames: FrameSnapshot[] }
- 出参：Ack
- payload：{ frameCount, insertedOrAffectedRows, idempotencyMode }

### GET /api/simulations
- 出参：Ack
- payload：{ simulations: [...] }

### GET /api/simulations/:simId/info
- 出参：Ack
- payload：{ minSimTime, maxSimTime, status }

### GET /api/simulations/:simId/frame?time=t
- 出参：FrameSnapshot
- payload：FrameSnapshot

### GET /api/simulations/:simId/frame/:frameIndex
- 出参：FrameSnapshot
- payload：FrameSnapshot

### POST /api/plans
- 入参：PlanConfig
- 出参：Ack
- payload：{ planId }

### POST /api/plans/:planId/apply
- 入参：{ fromSimTime? }
- 出参：Ack
- payload：{ planRunId, newSimulationId, fromSimTime }

## 兼容别名映射
- POST /api/init -> POST /api/simulations
- GET /api/sim/:simulationId/state -> GET /api/simulations/:simId/info
- GET /api/frame/:simulationId/:frameIndex -> GET /api/simulations/:simId/frame/:frameIndex
- POST /api/plan -> POST /api/plans
- POST /api/plan/apply -> POST /api/plans/:planId/apply

## 错误码与错误封装
- 400 BAD_REQUEST：参数校验失败。
- 401 UNAUTHORIZED：鉴权失败。
- 404 NOT_FOUND：simulationId 或 planId 不存在。
- 422 UNPROCESSABLE_PLAN：planConfig 缺少 initConfigLike，无法 apply。
- 500 INTERNAL_ERROR：DAL 或服务内部错误。

错误响应统一：
- messageType=Error
- payload={ code, message, details }

## 最小验收用例
1. 创建 simulation + 注入 frames 后，/info 返回 maxSimTime。
2. /frame?time=t 返回最近不超过 t 的帧。
3. create plan + apply 返回 Ack 占位确认。