# 模块四实施方案与检查清单（基于 FRONT_UE 模板增量改造）

## 1. 接口与数据一致性确认

### 1.1 对齐结论
- DataStruction 统一 Envelope 字段：version/requestId/simulationId/messageType/sentAt/payload。
- 模块二 HTTP 主版本路径已存在：
  - POST /api/simulations
  - POST /api/simulations/:simId/frames
  - GET /api/simulations
  - GET /api/simulations/:simId/info
  - GET /api/simulations/:simId/frame?time=...
  - GET /api/simulations/:simId/frame/:frameIndex
  - POST /api/plans
  - POST /api/plans/:planId/apply
- 模块三 Socket 事件与 messageType 映射已存在：UpdateFrame、SimState、ControlCamera、PlanCommand、Ack。
- 中期补丁要求的 inheritanceUsed、compiledActionCount 已在 /api/plans 响应中可返回。

### 1.2 前端侧字段约束执行点
- InitConfig.specialEntities[].triggerAt：前端表单必填且 >= 0。
- PlanConfig 时序约束：
  - actions[].startAt >= fromSimTime
  - specialEntities[].triggerAt >= fromSimTime
- 继承开关：initConfigLike.disasters 允许缺失；缺失时以 inheritanceUsed 语义处理。

### 1.3 发现的冲突与修正建议
- 冲突 A：旧 player.htm 仅单页播放器，无法承载三子页面与统一状态条。
  - 修正：将 player.htm 升级为壳页面，保留 #player 与 legacy 控件 ID，避免破坏 webRtcPlayer.js/app.js 主链路。
- 冲突 B：legacy app.js 会按整窗重排播放器，和新壳布局冲突。
  - 修正：在 app.js 增加嵌入式容器判断（player-ui-wrap）并在容器内计算尺寸。
- 冲突 C：业务交互与 Pixel Streaming 事件耦合过重。
  - 修正：新增前端事件总线 bus.js，业务按钮统一走 MiddlewareClient + Envelope 组包。

## 2. 模块四可执行实现方案

### 2.1 文件落位
- 页面入口：SignallingWebServer/player.htm（已升级壳页面）
- 样式：
  - public/player.css（保留底层播放器相关样式）
  - public/app-shell.css（新增业务壳层样式）
- 脚本：
  - scripts/app.js（保留底层播放逻辑，补充嵌入式尺寸适配）
  - scripts/bus.js（新增事件总线）
  - scripts/middleware-client.js（新增 HTTP + Socket 封装）
  - scripts/app-shell.js（新增三子页业务编排层）
- 备份：
  - player_legacy.htm
  - public/player_legacy.css
  - scripts/app_legacy.js

### 2.2 三子页面实现点
- 初始配置（InitConfig Studio）
  - 场景参数输入、water/fire 列表、特殊实体时间线。
  - triggerAt 直接可编辑，支持 +5s/+10s 平移。
  - 创建仿真调用 POST /api/simulations。
- 历史查看（Replay & Inspect）
  - 播放器区复用 #player 与 app.js/webrtc 主链路。
  - 控制条按钮发送 play/pause/seek/setSpeed Envelope。
  - 时间轴 input 事件做 100ms 节流 seek。
  - Ack 徽标显示 pending/ok/error，更新 requestId。
- 大模型预案生成（LLM Plan Workbench）
  - 手工/LLM 模式切换与继承开关（默认开启）。
  - 动作编译预览显示 compiledActionCount 与去重后数量。
  - 应用预案：POST /api/plans -> POST /api/plans/:planId/apply。

### 2.3 事件流与状态流
- HTTP 链路：创建仿真、拉取列表/信息、创建与应用预案。
- Socket 链路：subscribe 后接收 UpdateFrame/SimState/Ack；发送控制命令与 ControlCamera。
- Pixel Streaming 链路：继续由 app.js + webRtcPlayer.js 处理视频与基础输入回传。
- 时钟策略：UI 以 SimState.currentTime 为主时钟；本地时钟仅用于辅助展示。

## 3. 开发检查清单（执行）

### 3.1 架构与约束
- [x] 基于 SignallingWebServer 增量改造，不重写底层播放器协议。
- [x] 旧文件已备份为 legacy。
- [x] 保留 #player 节点与关键 legacy 控件 ID。
- [x] 新增 app-shell.css 承载业务样式。

### 3.2 契约一致性
- [x] Envelope 统一字段用于 Socket 发送。
- [x] 控制命令统一 payload.action（play/pause/seek/setSpeed）。
- [x] InitConfig triggerAt 前端必填校验。
- [x] PlanConfig 时序下界校验（fromSimTime）。

### 3.3 交互与可用性
- [x] 三页面可切换。
- [x] 顶栏显示 simulationId/连接灯/simTime。
- [x] 右抽屉承载系统设置与诊断区。
- [x] Ack 状态徽标与 requestId 追踪展示。

### 3.4 冒烟回归清单（待联调验证）
- [ ] UE 视频可播放，键鼠输入仍可回传。
- [ ] Socket 断线重连后能恢复 subscribe。
- [ ] 拖动时间轴 seek 后 1 tick 内收到目标附近帧。
- [ ] ControlCamera 发送后可收到 Ack。
- [ ] apply 返回可展示 inheritanceUsed 与 compiledActionCount。

## 4. 后续细化建议（不改契约）
- 将 ECharts 占位替换为真实图表并按 currentTime 联动。
- 将 LLM 生成动作替换为真实大模型接口调用。
- 为 app-shell.js 增加模块化拆分（init/replay/plan 三个子模块）与单元测试。
