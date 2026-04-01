# Module 3 执行检查清单

## 交付物检查清单
- [x] 播放状态机（play/pause/seek/setSpeed）实现。
- [x] Socket 事件契约实现：UpdateFrame, SimState, ControlCamera, PlanCommand, Ack。
- [x] 统一 Envelope 输出（含 requestId 与 sentAt）。
- [x] 时间推进公式实现（deltaT * playbackSpeed）。
- [x] 乱序过滤实现（simTime/frameIndex）。
- [x] 断线/重连订阅后补发当前帧与 SimState。
- [x] 模块三最小验收测试用例。

## 事件与输入输出契约

### subscribe（内部扩展事件）
- 输入：{ simulationId, requestId? }
- 输出：
  - Ack（订阅成功/失败）
  - UpdateFrame（当前帧）
  - SimState（当前状态）

### play
- 输入事件名：play
- 输入 Envelope.messageType：ControlCommand
- 输入 payload：{ action: "play" }
- 输出：Ack + SimState

### pause
- 输入事件名：pause
- 输入 payload：{ action: "pause" }
- 输出：Ack + SimState

### seek
- 输入事件名：seek
- 输入 payload：{ action: "seek", targetTime }
- 输出：Ack + UpdateFrame + SimState

### setSpeed
- 输入事件名：setSpeed
- 输入 payload：{ action: "setSpeed", speed }
- 输出：Ack + SimState

### ControlCamera
- 输入事件名：ControlCamera
- 输入 Envelope.messageType：ControlCommand
- 输出：ControlCamera（房间广播） + Ack

### PlanCommand
- 输入事件名：PlanCommand
- 输入 Envelope.messageType：PlanCommand
- 输出：PlanCommand（房间广播） + Ack

## 状态机定义
- 状态：paused | playing
- 事件：play, pause, seek, setSpeed
- 转移规则：
  - paused + play -> playing
  - playing + pause -> paused
  - playing/paused + seek -> 保持原状态，仅更新 currentTime
  - playing/paused + setSpeed -> 保持原状态，仅更新 playbackSpeed
  - reaching maxSimTime -> paused

## 非功能检查
- Tick 周期可配置：SOCKET_TICK_MS（默认 1000ms）。
- 速度校验：speed 必须为非负有限数值。
- seek 校验：targetTime 必须为有限数值。
- 失败退化：Tick 异常时自动切换为 paused 并广播 Ack warning。

## 最小验收用例
1. 2x 倍速 + 1s Tick 时，仿真时间推进约 2s。
2. seek 后 1 个 Tick 内收到目标附近帧。
3. pause 后 currentTime 不再增长。
