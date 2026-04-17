# 模拟服务联调测试证据（2026-04-17）

更新时间：2026-04-17
测试范围：前端 + 中台 + Mock Backend + Mock LLM

## 1. 测试环境

1. 中台：`http://127.0.0.1:3100`
2. Mock Backend：`http://127.0.0.1:3200`
3. Mock LLM：`http://127.0.0.1:3300`
4. 前端信令：`http://127.0.0.1:8080`

## 2. 关键步骤与结果

### 2.1 创建仿真并触发模拟后端

- 创建仿真返回示例：
  - `SIM_ID=sim_1776418517429_273715`

- 触发模拟后端返回示例：
  - `START_STATUS=accepted`
  - `UPSTREAM_INTERVAL_MS=500`

结论：中台可接收仿真并成功调用 mock backend。

### 2.2 帧回写与完成态验证

- 查询时间范围返回示例：
  - `RANGE_MIN=0`
  - `RANGE_MAX=5.5`

- 最后一帧查询示例：
  - `LAST_FRAME_INDEX=11`
  - `LAST_STATUS=completed`

结论：mock backend 可定速回写帧，且可回送完成态。

### 2.3 历史查询与时间顺序样例

按 `time` 采样查询返回示例：

1. `T=0 => simTime=0, frameIndex=0`
2. `T=1 => simTime=1, frameIndex=2`
3. `T=2 => simTime=2, frameIndex=4`
4. `T=3 => simTime=3, frameIndex=6`
5. `T=4 => simTime=4, frameIndex=8`
6. `T=5 => simTime=5, frameIndex=10`

结论：历史查询链路可用，数据时间单调递增，满足历史页排序展示要求。

### 2.4 模拟 LLM 预案链路

- 触发模拟 LLM 返回示例：
  - `PLAN_STATUS=ok`
  - `PLAN_ID=plan_mock_1776418556651`

- 应用预案返回示例：
  - `APPLY_NEW_SIM_ID=sim_1776418556682_801629`

结论：mock llm 生成预案后可在中台完成落库与应用。

## 3. Mock 后端日志佐证

示例日志：

1. `[MockBackend] accepted simulationId=sim_1776418592065_659439, scenarioId=metro_mock_observe_20260417, mapLevel=Station_A_Platform, fps=2, totalFrames=4, randomMode=false`
2. `[MockBackend] simulation completed: simulationId=sim_1776418592065_659439, frameIndex=3, simTime=1.5`

结论：可观察到中台已提交仿真配置并完成回写全过程。

## 4. 当前判定

本轮联调结论为“通过”。

已覆盖：

1. 创建仿真 -> 中台触发 mock backend
2. mock backend 定速回写帧 -> 完成态回送
3. 前端可据完成态提示仿真完成
4. 历史查询可按时间顺序展示
5. 中台触发 mock llm 并成功 apply

未覆盖（后续建议）：

1. 大帧数压测
2. 异常回写重试场景
3. 权限令牌开启场景
