# 阶段测试用例清单（模块1-3）

更新日期：2026-03-30

## 1. 已有自动化测试

执行命令：

```bash
cd PROJECT/MIDDLEWARE/server
npm test
```

最近一次结果：

- 总用例：9
- 通过：6
- 失败：0
- 跳过：3（全部为模块1，依赖真实 MySQL）

### 模块1（数据库与模型层）

文件：`tests/module1.test.js`

1. case1: `createSimulation` 后 `getSimulationTimeRange` 为空。
2. case2: `batchInsertFrames` 后，`getFrameByTime` 命中最近历史帧。
3. case3: `createPlan + createPlanRun` 后，`getPlanRuns` 可查关联。

说明：

- 需设置 `MODULE1_DB_TEST=1` 并配置可用 MySQL 才会执行。

### 模块2（HTTP API）

文件：`tests/module2.test.js`

1. 创建 simulation + 注入 frames 后，`/info` 返回 `maxSimTime`。
2. `/frame?time=t` 返回最近不超过 t 的帧。
3. 创建 plan + apply 返回 Ack 且包含 `planRunId/newSimulationId`。

### 模块3（Socket.IO Dispatcher）

文件：`tests/module3.test.js`

1. 2x 倍速下，约 1 秒墙钟时间推进约 2 秒仿真时间。
2. seek 后 1 tick 内收到目标附近帧。
3. pause 后 `currentTime` 不再增长。

## 2. 建议补充测试（高优先级）

### 2.1 模块1补充

1. 事务回滚：批量写入中途失败时，整批不落库。
2. 幂等重复写入：同 `(sim_id, frame_index)` 重试后数据一致。
3. `createPlanRun` 冲突场景：返回 `planRunId` 与数据库真实值一致。

### 2.2 模块2补充

1. 参数校验失败返回 400 + Error Envelope。
2. simulationId/planId 不存在返回 404 + Error Envelope。
3. 兼容路由必须返回 `Deprecation` 相关响应头。
4. 幂等重放：相同 requestId 返回 `x-idempotent-replay=1`。

### 2.3 模块3补充

1. 无效 `messageType` 或 action 返回 Ack error。
2. 断线重连后立即补发当前帧与 SimState。
3. 乱序帧过滤：旧帧不应覆盖新帧。
4. `ControlCamera` 与 `PlanCommand` 仅向 UE 客户端转发（完成角色隔离后启用）。

## 3. 联调最小回归脚本（人工）

1. 创建仿真：`POST /api/simulations`
2. 注入三帧：`POST /api/simulations/:simId/frames`
3. 查状态：`GET /api/simulations/:simId/info`
4. 查帧：`GET /api/simulations/:simId/frame?time=...`
5. Socket 订阅：`subscribe`
6. 发送 `play -> seek -> pause -> setSpeed`
7. 观察事件：`UpdateFrame/SimState/Ack`

验收标准：

- HTTP/Socket 所有响应均为统一 Envelope。
- `seek` 后一 tick 内画面可切换到目标附近帧。
- `pause` 后 `SimState.currentTime` 保持不变。
