# Module 3 运行手册

## 1) 安装依赖
1. 进入 PROJECT/MIDDLEWARE/server
2. 运行 npm install

## 2) 启动服务（HTTP + Socket.IO）
- 命令：npm start
- 默认地址：http://0.0.0.0:3000
- Socket 地址：与 HTTP 同源，默认路径 /socket.io

## 3) 环境变量
- PORT：监听端口（默认 3000）
- HOST：监听地址（默认 0.0.0.0）
- API_VERSION：Envelope.version（默认 1.0）
- SOCKET_TICK_MS：调度 Tick 毫秒间隔（默认 1000）
- CORS_ORIGIN：Socket/HTTP 允许跨域来源（默认 *）
- DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME：数据库连接配置

## 4) 客户端接入顺序
1. 建立 Socket 连接
2. 发送 subscribe：
```json
{
  "simulationId": "sim_20260310_001",
  "requestId": "req-sub-001"
}
```
3. 服务端会依次返回：
- Ack（订阅确认）
- UpdateFrame（当前帧，若有）
- SimState（当前播放状态）

## 5) 控制命令示例（Envelope）

### play
```json
{
  "version": "1.0",
  "requestId": "req-play-01",
  "simulationId": "sim_20260310_001",
  "messageType": "ControlCommand",
  "sentAt": 1773091200123,
  "payload": { "action": "play" }
}
```

### seek
```json
{
  "version": "1.0",
  "requestId": "req-seek-01",
  "simulationId": "sim_20260310_001",
  "messageType": "ControlCommand",
  "sentAt": 1773091200456,
  "payload": { "action": "seek", "targetTime": 12.5 }
}
```

### setSpeed
```json
{
  "version": "1.0",
  "requestId": "req-speed-01",
  "simulationId": "sim_20260310_001",
  "messageType": "ControlCommand",
  "sentAt": 1773091200789,
  "payload": { "action": "setSpeed", "speed": 2 }
}
```

## 6) 调度行为说明
- 时间推进：t_next = t_current + deltaT * playbackSpeed
- 帧检索：每次 Tick 使用 getFrameByTime(simulationId, currentTime)
- 乱序保护：若候选帧比最近已发送帧更旧，则丢弃
- 到达 maxSimTime：自动切换为 paused 并广播 SimState

## 7) 验证命令
- 运行全部测试：npm test
- 仅模块三：node --test tests/module3.test.js

## 8) 失败处理
- FRAME_NOT_FOUND：发送 Ack warning，保持当前状态
- BAD_COMMAND：发送 Ack error（参数或 messageType 非法）
- TICK_ERROR：调度异常后自动 pause，广播 Ack warning + SimState
