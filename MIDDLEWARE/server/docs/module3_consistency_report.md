# Module 3 一致性报告

## 范围
- 目标：中台高频调度器（Socket.IO Dispatcher，1~2s/帧）
- 核对来源：前端任务清单 V1.4 + DataStruction V1.0

## 已确认一致
1. 事件集与 messageType 映射对齐：
- UpdateFrame -> FrameSnapshot
- SimState -> SimState
- ControlCamera -> ControlCommand
- PlanCommand -> PlanCommand（扩展类型）
- Ack -> Ack

2. Envelope 固定字段完整：
- version, requestId, simulationId, messageType, sentAt, payload

3. 数据访问边界符合约束：
- 调度层仅依赖模块一查询接口 `getFrameByTime` 与 `getSimulationTimeRange`
- 未直接连接其他外部资源

4. 时间推进规则落实：
- t_next = t_current + deltaT * playbackSpeed

5. 乱序防护落实：
- UpdateFrame 发送前按 `simTime` + `frameIndex` 丢弃旧帧

6. 断线重连补发落实：
- 客户端订阅成功后立即补发当前帧与 SimState

## 发现的冲突与修正建议
1. 历史文档中的链路描述差异：
- DataStruction 的 5.2 文段写法容易被理解为 `ControlCamera` 可前端直达 UE。
- 全局统一约束明确唯一链路为：前端 -> 中台 Socket.IO -> UE。
- 修正建议：以任务清单全局约束为准，DataStruction 在后续修订中将该段措辞改为“前端通过中台转发至 UE”。

2. messageType 枚举扩展项：
- DataStruction 枚举建议未显式列出 PlanCommand。
- 任务清单明确“可扩展 PlanCommand”。
- 修正建议：不变更既有字段，仅在枚举说明追加“PlanCommand（扩展）”。

## 不变更声明
- 未改动已确定字段名称和输入/输出契约。
- 本模块新增仅为调度实现与事件转发能力，不改变模块一/二 API 契约。
