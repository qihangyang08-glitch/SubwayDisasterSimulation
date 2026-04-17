# 下一阶段执行方案（真实后端 + 真实LLM + 历史可视化）

更新时间：2026-04-17

## 1. 目标

在当前 Mock 联调已跑通的基础上，完成“真实能力替换 + 可视化闭环”：

前端创建仿真 -> 中台受理 -> 真实后端批量产帧 -> 中台落库 -> 前端收到完成状态 -> 历史页可视化分析 -> 真实LLM预案生成与应用。

## 2. 范围与边界

1. 前端不得直连真实后端和真实LLM，统一通过中台集成入口编排。
2. 所有核心数据结构必须符合 `DataStruction`（尤其是 `FrameSnapshot` 和 `PlanConfig`）。
3. 历史页必须从“交互占位”升级为“真实图表渲染 + 采样策略”。

## 3. 角色分工

1. 前端
- 提交 `InitConfig` 并展示流程状态。
- 监听仿真状态与完成通知。
- 实现历史页真实图表（曲线图/柱状图/热力图）。
- 支持大数据量采样显示（分页或按时间窗拉取）。

2. 中台
- 创建 `simulation` 并分配 `sim_id`。
- 调度真实后端开始产帧，执行 schema 校验与批量落库。
- 调度真实LLM生成预案，执行校验、落库与 apply。
- 广播完成状态并提供查询接口兜底。

3. 真实仿真后端
- 输入：`sim_id + InitConfig`。
- 输出：一批 `FrameSnapshot`（严格 schema）。
- 结束后回执 `done`，异常时返回结构化错误。

4. 真实LLM服务
- 输入：仿真上下文与约束。
- 输出：`PlanConfig`。
- 保证字段合法并附带可审计标识（模型版本、请求追踪ID）。

## 4. 推荐接口草案

### 4.1 中台对前端

1. POST /api/simulations
- 创建仿真并返回 simId。

2. GET /api/simulations
- 查询仿真列表。

3. GET /api/simulations/:simId/info
- 查询仿真时间范围、统计信息。

4. GET /api/simulations/:simId/frame?time=...
- 按时间采样查询帧。

### 4.2 中台对真实后端（建议 HTTP 起步）

1. POST /backend/run
- body: simId + initConfig + frameCount。

2. 回调（或轮询）
- POST /api/internal/simulations/:simId/frames/batch
- POST /api/internal/simulations/:simId/finish

### 4.3 中台对真实LLM

1. POST /llm/plan
- body: simulationContext + constraints。

2. 返回
- `PlanConfig`（可直接入库并用于 apply）。

## 5. 验收标准

1. 前端创建一次仿真后，`simulations` 表出现新记录。
2. 30 秒内 `simulation_frames` 表新增 >= N 条记录。
3. 历史页可读取该 `simId` 并显示至少 2 类真实图表。
4. 中台日志存在“开始产帧 / 批量入库 / 结束回执 / 预案生成与应用”完整轨迹。
5. 前端收到仿真完成提示，无未处理异常。
6. `plans` 与 `plan_runs` 至少新增 1 条有效记录。

## 6. 建议测试脚本序列

1. 启动中台、信令服务、UE。
2. 前端提交新建仿真。
3. 触发中台调用真实后端产帧。
4. 在前端执行“生成并应用预案”。
4. 执行数据库查询：

```sql
SELECT sim_id, scenario_id, status, created_at
FROM simulations
ORDER BY created_at DESC
LIMIT 10;

SELECT sim_id, frame_index, sim_time, created_at
FROM simulation_frames
ORDER BY created_at DESC
LIMIT 20;
```

5. 在历史页校验读取链路与图表渲染。

## 7. 风险与控制

1. 风险：DataStruction 字段偏差导致前端无法渲染。
- 控制：中台入库前做 schema 校验并记录具体字段错误。

2. 风险：批量入库性能不稳定。
- 控制：按批次大小分段提交并统计耗时。

3. 风险：状态事件丢失导致前端卡在运行中。
- 控制：HTTP 查询状态兜底，Socket 仅做实时加速。

4. 风险：真实LLM返回结构不稳定。
- 控制：中台对 `PlanConfig` 做严格校验，失败则返回明确错误并保留审计日志。

## 8. 建议里程碑（两周节奏）

1. M1（第1周）：真实后端接入并稳定入库，历史页可读真实数据。
2. M2（第2周）：真实LLM预案接入，`apply` 跑通，历史页图表可用于对比分析。
3. M3（第2周末）：完成一轮联调证据归档（日志、SQL、页面录屏、异常闭环）。
