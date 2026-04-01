# 地铁灾害模拟仿真平台数据结构设计（V1.1）

## 1. 文档目标与适用范围
本文档定义项目设计阶段的统一数据结构，用于支撑以下三类能力：

1. 系统各模块通信信息单元（Web <-> 中台 <-> 仿真后端 <-> UE）。
2. UE 画面绘制的数据化描述（UE 按帧无状态渲染）。
3. 仿真全局信息按时间线存储与按需回放（数据库 Time-Slice）。

说明：
- 本版灾害类型限定为 `water`（水灾）和 `fire`（火灾）。
- 本版新增约定：`specialEntities` 在初始化与预案中均需显式声明触发时间，避免默认“开局立即执行”。

### 1.1 文档定位声明
本文件是基于当前项目目标、预期效果与技术可行性分析形成的设计稿（Design Draft）。

1. 本文档用于统一跨组沟通接口与字段语义，不等同于最终实现标准。
2. 各小组（前端、中台、UE、仿真算法）应结合实际性能与工程复杂度进行可行性复核。
3. 若出现更优替代方案，可在不破坏核心语义（帧可回放、UE无状态渲染、方案可复跑）的前提下调整实现。


---

## 2. 设计原则

1. 解耦：UE 仅消费“当前帧快照”，不依赖连续物理状态。
2. 可回放：任何时刻 `t` 的全局状态都可独立查询与渲染。
3. 可扩展：字段分层，预留 `ext` 扩展区，后续可加新灾种/新角色。
4. 稳定通信：统一消息包封装，便于 HTTP 和 Socket.IO 复用。
5. 面向方案对比：支持“基线仿真”和“方案接力仿真”两种数据链路。

---

## 3. 命名与通用约定

- 编码：UTF-8
- 时间：秒（`simTime`），毫秒时间戳（`createdAt`）
- 坐标：UE 世界坐标，数组 `[x, y, z]`
- 角度：度，`yaw` 为主
- 字段命名：`camelCase`
- ID 命名建议：
  - 仿真：`sim_20260310_001`
  - 帧：`sim_20260310_001_000155`
  - 区域：`zone_platform_center`
  - 人员：`agent_0001`
  - 特殊实体：`device_warning_01`、`staff_fire_01`

### 3.1 统一消息包（Envelope）
```json
{
  "version": "1.0",
  "requestId": "req-8f3c2b",
  "simulationId": "sim_20260310_001",
  "messageType": "InitConfig",
  "sentAt": 1773091200123,
  "payload": {}
}
```

`messageType` 枚举建议：
- `InitConfig`
- `FrameSnapshot`
- `PlanConfig`
- `ControlCommand`
- `SimState`
- `Ack`
- `Error`

---

## 4. 核心数据对象定义

## 4.1 初始化配置帧 `InitConfig`
用途：启动一次仿真或启动一次“方案接力仿真”。

与其他帧的区别：
1. 相比 `FrameSnapshot`，本帧强调“初始条件定义”，不包含逐帧运行态字段（如 `frameIndex`、`statistics`）。
2. 相比 `PlanConfig`，本帧不包含方案来源、目标指标、动态动作编排（`planRuntime.actions`）。
3. 本帧允许预先编排特殊实体动作（手工预案），通过 `specialEntities[].triggerAt` 指定动作生效时刻。

```jsonc
{
  "scenarioId": "metro_fire_water_01", // 场景编号
  "mapLevel": "Station_A_Platform", // 地图关卡名
  "seed": 1024, // 随机种子（便于结果复现）
  "totalPeople": 500, // 初始乘客总数
  "disasters": {
    "water": {
      "enabled": true, // 是否启用水灾
      "inlets": [
        {
          "inletId": "water_inlet_01", // 进水点ID
          "zoneId": "zone_entrance_02", // 所在区域ID
          "position": [1200, -500, 20], // 进水点坐标
          "inflowRate": 50.0, // 进水速度
          "totalVolume": 12000.0, // 总进水量上限
          "startAt": 0.0, // 起始时间（秒）
          "duration": 240.0 // 持续时间（秒）
        }
      ]
    },
    "fire": {
      "enabled": true, // 是否启用火灾
      "sources": [
        {
          "fireId": "fire_src_01", // 起火源ID
          "position": [1080, -460, 100], // 起火点坐标
          "spreadSpeed": 1.2, // 火势扩散速度
          "fireType": "electric", // 火灾类型
          "gasType": "toxicSmoke", // 产生气体类型
          "gasSpreadSpeed": 1.8, // 气体扩散速度
          "initialConcentration": 0.35, // 初始浓度（0~1）
          "startAt": 0.0 // 起始时间（秒）
        }
      ]
    }
  },
  "specialEntities": [
    {
      "entityId": "device_warning_01", // 警示灯ID
      "entityType": "warningLight", // 实体类型
      "position": [900, -300, 260], // 固定位置
      "triggerAt": 60.0, // 动作触发时刻（仿真秒）
      "config": {
        "blink": true, // 是否闪烁
        "effectRadius": 20.0, // 生效半径
        "guideBoostProb": 0.12 // 提高逃生路线选择概率
      }
    },
    {
      "entityId": "device_broadcast_01",
      "entityType": "broadcast",
      "position": [960, -280, 280],
      "triggerAt": 75.0,
      "config": {
        "enabled": true,
        "messageTemplate": "请沿A出口有序疏散",
        "effectRadius": 35.0,
        "guideBoostProb": 0.18
      }
    },
    {
      "entityId": "staff_guide_01",
      "entityType": "staffGuide",
      "position": [820, -180, 10],
      "triggerAt": 90.0,
      "config": {
        "moveTarget": [1000, -250, 10],
        "onArriveAction": "evacuate",
        "guideBoostProb": 0.2
      }
    },
    {
      "entityId": "staff_fire_01",
      "entityType": "staffFire",
      "position": [780, -210, 10],
      "triggerAt": 105.0,
      "config": {
        "moveTarget": [1080, -460, 10],
        "onArriveAction": "extinguish",
        "fireSpreadReduce": 0.25,
        "gasSpreadReduce": 0.2
      }
    }
  ],
  "ext": {}
}
```

### 4.1.1 灾害字段说明
- `water.inlets[]`：支持多进水点（数量和位置可配置）。
- `inflowRate`：进水速度。
- `totalVolume`：总进水量上限。
- `fire.sources[]`：支持多起火点。
- `fireType`：`electric | gas | flammable`
- `gasType`：`normalSmoke | toxicSmoke | irritantSmoke`
- `initialConcentration`：0~1，初始浓度。

### 4.1.2 特殊实体触发语义
- `specialEntities[].triggerAt`：必填，单位秒，表示该实体动作开始生效的仿真时刻。
- 若同一实体存在多个动作，建议拆分为多条动作记录（可在 `ext.actions[]` 扩展）。
- 初始化阶段实体默认处于待命态；到达 `triggerAt` 后进入生效态。

---

## 4.2 实时帧快照 `FrameSnapshot`
用途：UE 绘制依据，数据库按时间片存储与检索。

与其他帧的区别：
1. 相比 `InitConfig`，本帧新增时序和运行态字段（`frameIndex`、`simTime`、`status`、`statistics`）。
2. 相比 `PlanConfig`，本帧是“结果快照”，不描述方案意图与动作计划。
3. 本帧可直接用于 UE 当前画面渲染，是最核心的数据消费单元。
4. 本帧不携带触发时间定义，仅描述当前时刻实体是否已生效及其运行状态。

```jsonc
{
  "frameId": "sim_20260310_001_000155", // 帧唯一ID
  "simulationId": "sim_20260310_001", // 所属仿真ID
  "simTime": 15.5, // 仿真时刻（秒）
  "frameIndex": 155, // 帧序号
  "status": "running", // 当前状态
  "environment": {
    "zones": [
      {
        "zoneId": "zone_staircase_01", // 区域ID
        "waterLevel": 0.5, // 当前水位
        "waterFlowSpeed": 0.7, // 当前水流速度
        "fireIntensity": 0.4, // 火势强度（0~1）
        "smokeType": "toxicSmoke", // 烟气类型
        "smokeDensity": 0.8, // 烟雾浓度（0~1）
        "gasConcentration": 0.62 // 有害气体浓度（0~1）
      },
      {
        "zoneId": "zone_platform_center",
        "waterLevel": 0.1,
        "waterFlowSpeed": 0.2,
        "fireIntensity": 0.0,
        "smokeType": "normalSmoke",
        "smokeDensity": 0.12,
        "gasConcentration": 0.1
      }
    ]
  },
  "agents": [
    {
      "agentId": "agent_0101", // 人群实体ID
      "role": "passenger", // 角色类型
      "pos": [1250, -400, 10], // 当前坐标
      "yaw": 90.0, // 朝向角
      "state": "fallen", // 状态
      "health": 80, // 健康值
      "targetExit": "exit_a", // 目标出口
      "panicLevel": 0.72 // 恐慌值（0~1）
    },
    {
      "agentId": "staff_guide_01",
      "role": "staffGuide",
      "pos": [980, -240, 10],
      "yaw": 135.0,
      "state": "guiding",
      "health": 100,
      "task": "evacuate"
    }
  ],
  "specialEntities": [
    {
      "entityId": "device_warning_01",
      "entityType": "warningLight",
      "state": "active",
      "runtime": {
        "blink": true,
        "effectRadius": 20.0,
        "guideBoostProb": 0.12
      }
    },
    {
      "entityId": "device_broadcast_01",
      "entityType": "broadcast",
      "state": "active",
      "runtime": {
        "currentMessage": "请沿A出口有序疏散",
        "guideBoostProb": 0.18
      }
    }
  ],
  "events": [
    {
      "eventId": "evt_001",
      "type": "staffAction",
      "targetId": "staff_fire_01",
      "action": "extinguish",
      "params": {
        "fireSpreadReduce": 0.25,
        "gasSpreadReduce": 0.2
      }
    }
  ],
  "statistics": {
    "totalEvacuated": 50, // 已疏散人数
    "inWaterDeep": 12, // 深水区人数
    "avgExposureTime": 4.5, // 平均暴露时长
    "casualtyCount": 2 // 伤亡人数
  },
  "ext": {}
}
```

### 4.2.1 状态枚举建议
- `status`：`running | paused | finished | error`
- `agent.state`：
  - 乘客：`idle | walking | running | fallen | halfSubmerged | submerged`
  - 工作人员：`moving | guiding | extinguishing | waiting`
- `specialEntities.state`：`active | inactive | damaged`

### 4.2.2 增量传输建议
为降低带宽，Socket.IO 可采用增量帧：

```json
{
  "baseFrameIndex": 154,
  "frameIndex": 155,
  "changed": {
    "zones": ["zone_staircase_01"],
    "agents": ["agent_0101", "staff_fire_01"],
    "entities": ["device_warning_01"]
  }
}
```

数据库仍建议落全量快照，便于随机跳转和容错恢复。

---

## 4.3 应对方案配置帧 `PlanConfig`
用途：
1. LLM 自动生成的方案参数。
2. 用户在前端手动编辑方案参数。
3. 作为“接力仿真”的新初始化配置输入。

设计规则：与 `InitConfig` 同主结构，新增动态控制区 `planRuntime`。

与其他帧的区别：
1. 相比 `InitConfig`，本帧新增方案来源、方案目标和动作编排（`planSource`、`objective`、`planRuntime`）。
2. 相比 `FrameSnapshot`，本帧描述“应对策略”，不是某一时刻的运行结果。
3. 本帧可省略灾害配置并继承 `fromSimulationId` 对应基线仿真的灾害参数。
4. `fromSimTime` 保留，用于约束方案动作触发时刻下界（动作不应早于该时刻）。

```jsonc
{
  "planId": "plan_20260310_a", // 方案ID
  "fromSimulationId": "sim_20260310_001", // 基线仿真ID
  "fromSimTime": 120.0, // 方案介入时刻（特殊实体动作触发下界）
  "planSource": "llm", // 方案来源
  "objective": "提高5分钟内疏散率并降低烟气暴露", // 目标描述
  "initConfigLike": {
    "scenarioId": "metro_fire_water_01",
    "mapLevel": "Station_A_Platform",
    "totalPeople": 500,
    "specialEntities": [
      {
        "entityId": "staff_fire_01",
        "entityType": "staffFire",
        "position": [780, -210, 10],
        "triggerAt": 122.5,
        "config": {
          "moveTarget": [1080, -460, 10],
          "onArriveAction": "extinguish",
          "fireSpreadReduce": 0.3,
          "gasSpreadReduce": 0.25
        }
      }
    ]
  },
  "planRuntime": {
    "actions": [
      {
        "actionId": "act_01", // 动作ID
        "startAt": 121.0, // 开始时刻
        "targetId": "device_warning_01", // 作用对象
        "action": "setBlink", // 动作名
        "params": { "blink": true, "guideBoostProb": 0.2 } // 动作参数
      },
      {
        "actionId": "act_02",
        "startAt": 122.5,
        "targetId": "staff_fire_01",
        "action": "dispatchTo",
        "params": {
          "moveTarget": [1080, -460, 10],
          "onArriveAction": "extinguish",
          "fireSpreadReduce": 0.3,
          "gasSpreadReduce": 0.25
        }
      }
    ]
  },
  "expectedMetrics": {
    "evacuationRateImprove": 0.15,
    "avgExposureTimeReduce": 0.2
  },
  "ext": {}
}
```

`planSource` 枚举：`llm | manual | mixed`

### 4.3.1 预案帧补充约束
- `initConfigLike.disasters`：可选。缺失时按 `fromSimulationId` 查询基线仿真并继承其灾害配置。
- `initConfigLike.specialEntities[].triggerAt`：建议必填，且应满足 `triggerAt >= fromSimTime`。
- `planRuntime.actions[].startAt`：若使用，语义与 `triggerAt` 一致，且应满足 `startAt >= fromSimTime`。
- 优先级建议：`planRuntime.actions` 用于多动作编排；`specialEntities[].triggerAt` 用于实体级单动作编排。

---

## 5. 通信接口与事件映射（建议）

### 5.0 通信方式选型说明（现阶段）
目前 UE 与中台通信方式尚未最终定版，以下是简要对比：

1. HTTP 轮询（Polling）
- 优点：实现简单、调试直观、基础设施要求低。
- 缺点：实时性较弱；高频轮询会增加请求开销。
- 适用：原型早期、低频演示、先打通链路。

2. Socket.IO（事件驱动）
- 优点：双向实时通信、自动重连、心跳保活，适合连续帧推送。
- 缺点：状态管理复杂度高于轮询；需要处理事件顺序与幂等。
- 适用：中后期联调、播放/暂停/拖拽等高交互场景。

3. 原生 WebSocket
- 优点：协议轻、延迟低、可精细控制。
- 缺点：需自行处理更多连接管理与重连逻辑。
- 适用：性能优化阶段，团队具备较强网络编程能力时。

建议：
1. 初期可采用 `HTTP + 低频轮询` 快速验证。
2. 稳定后切换到 `Socket.IO` 作为主链路。
3. 若后续性能瓶颈明显，再评估迁移 `WebSocket`。

## 5.1 HTTP 接口
- `POST /api/init`：提交 `InitConfig`，返回 `simulationId`
- `GET /api/sim/:simulationId/state`：获取状态与进度
- `GET /api/frame/:simulationId/:frameIndex`：按帧取 `FrameSnapshot`
- `POST /api/plan`：提交 `PlanConfig`
- `POST /api/plan/apply`：以 `PlanConfig` 触发接力仿真

## 5.2 Socket.IO 事件
- `UpdateFrame`：中台 -> UE，`FrameSnapshot`
- `ControlCamera`：前端 -> UE，摄像机控制指令
- `SimState`：中台 -> 前端，状态同步
- `PlanCommand`：前端/中台 -> 后端，方案动作下发
- `Ack`：双向确认（可带 `requestId`）

---

## 6. 数据库存储模型（回放优先）

## 6.1 表/集合建议
1. `simulations`
- `simulationId`（主键）
- `scenarioId`, `mapLevel`, `status`
- `createdAt`, `finishedAt`
- `initConfig`（JSON）

2. `simulationFrames`
- `simulationId` + `frameIndex`（联合主键）
- `simTime`
- `frameSnapshot`（JSON）
- `createdAt`

3. `plans`
- `planId`（主键）
- `fromSimulationId`, `fromSimTime`
- `planSource`
- `planConfig`（JSON）
- `createdAt`

4. `planRuns`
- `planRunId`（主键）
- `baseSimulationId`, `planId`, `newSimulationId`
- `createdAt`

## 6.2 索引建议
- `simulationFrames(simulationId, frameIndex)`：随机跳帧检索。
- `simulationFrames(simulationId, simTime)`：按时间轴检索。
- `plans(fromSimulationId)`：历史方案复用。

---

## 7. 校验规则（最小集）

1. 概率值统一 `0~1`：如 `guideBoostProb`。
2. 速度与流量必须非负：`inflowRate`, `spreadSpeed`, `gasSpreadSpeed`。
3. `totalPeople` > 0 且与初始乘客实体数一致。
4. 同一帧中 `agentId`、`entityId` 必须唯一。
5. 若 `onArriveAction=extinguish`，则需提供灭火效果参数。
6. 火灾关闭时（`fire.enabled=false`），`fire.sources` 必须为空。
7. `InitConfig.specialEntities[].triggerAt` 必须存在且 `>= 0`。
8. `PlanConfig` 中动作触发时刻（`triggerAt` 或 `startAt`）必须 `>= fromSimTime`。
9. `PlanConfig.initConfigLike.disasters` 缺失时，必须可通过 `fromSimulationId` 成功继承基线灾害配置。



---

## 8. 后续可扩展方向

1. 人群行为参数：群体拥挤系数、从众概率、恐慌传播系数。
2. 设备状态退化：广播损坏、警示灯失效。
3. 多方案并行 A/B 对比：同起点同时生成多条 `planRuns`。
4. 帧压缩与关键帧机制：降低长期存储成本。