# 下一阶段执行方案（模拟仿真后端联调）

更新时间：2026-04-01

## 1. 目标

在不依赖真实仿真算法的前提下，建立可验证的端到端链路：

前端创建仿真 -> 中台受理 -> 模拟后端批量产帧 -> 中台落库 -> 前端收到完成状态 -> 历史页可回看。

## 2. 范围与边界

1. 本阶段不实现真实灾害仿真算法。
2. 模拟后端仅负责按 DataStruction 生成合法帧数据。
3. 数据格式必须严格匹配 DataStruction，便于未来替换为真实引擎输出。

## 3. 角色分工

1. 前端
- 提交 InitConfig。
- 监听仿真状态与完成通知。
- 历史页展示时序数据和分析配置。

2. 中台
- 创建 simulation 记录并分配 sim_id。
- 调度模拟后端开始产帧。
- 批量写入 simulation_frames。
- 结束后发送完成事件。

3. 模拟仿真后端（新）
- 输入：sim_id + InitConfig。
- 输出：一批 FrameSnapshot（严格 schema）。
- 结束后回执 done。

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

### 4.2 中台对模拟后端（可先 HTTP）

1. POST /mock-sim/run
- body: simId + initConfig + frameCount。

2. 回调（或轮询）
- POST /api/internal/simulations/:simId/frames/batch
- POST /api/internal/simulations/:simId/finish

## 5. 验收标准

1. 前端创建一次仿真后，simulations 表出现新记录。
2. 30 秒内 simulation_frames 表新增 >= N 条记录。
3. 历史页可读取该 simId 并展示按 simTime 升序的时序数据。
4. 中台日志存在“开始产帧 / 批量入库 / 结束回执”完整轨迹。
5. 前端收到仿真完成提示，无未处理异常。

## 6. 建议测试脚本序列

1. 启动中台、信令服务、UE。
2. 前端提交新建仿真。
3. 触发中台调用模拟后端产帧。
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

5. 在历史页校验读取链路。

## 7. 风险与控制

1. 风险：DataStruction 字段偏差导致前端无法渲染。
- 控制：中台入库前做 schema 校验并记录具体字段错误。

2. 风险：批量入库性能不稳定。
- 控制：按批次大小分段提交并统计耗时。

3. 风险：状态事件丢失导致前端卡在运行中。
- 控制：HTTP 查询状态兜底，Socket 仅做实时加速。
