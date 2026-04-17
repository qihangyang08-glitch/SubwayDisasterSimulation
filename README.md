# 数字孪生地铁灾害应急仿真系统（UE4.26）

更新时间：2026-04-17

本项目当前联调形态为四部分：

1. UE 客户端（Pixel Streaming 推流端）
2. 前端信令服务（Cirrus，端口 8080/8888）
3. 中台服务（Node.js + MySQL，端口 3100）
4. 模拟服务（Mock Backend 3200 + Mock LLM 3300）

如果你是新接手同学，请先看下方文档索引，再按运行手册执行。

## 一、推荐阅读顺序

1. [系统详细讲解](./SYSTEM_DETAIL.md)
2. [环境配置与安装](./ENV_SETUP.md)
3. [联调测试运行手册](./VISUAL_TEST_RUNBOOK.md)
4. [事项说明与待办决策](./NOTES_AND_DECISIONS.md)
5. [过程文档总索引](./DOCS/PROCESS/INDEX.md)

## 二、快速启动（用于已配置完成环境）

1. 启动中台服务（PROJECT/MIDDLEWARE/server）

```powershell
npm install
npm start
```

2. 启动前端信令服务（PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer）

```powershell
npm install
npm start
```

3. 启动 UE（PROJECT/UE_PROJECT）

```powershell
Start-Process ".\PixelDemo.exe - 快捷方式.lnk"
```

4. 打开页面

- http://localhost:8080/

5. 启动模拟服务（PROJECT/MOCK_SERVICES）

```powershell
npm install
npm run start:backend
```

另开终端：

```powershell
npm run start:llm
```

完整步骤、连通性快检和故障排查请见 [VISUAL_TEST_RUNBOOK.md](./VISUAL_TEST_RUNBOOK.md)。

## 三、目录说明（交接视角）

- PROJECT/UE_PROJECT: UE 可执行程序启动入口（当前仓库以快捷方式方式保留启动点）
- PROJECT/FRONT_UE: 前端 UI 与 SignallingWebServer
- PROJECT/MIDDLEWARE: 中台服务与数据库脚本
- PROJECT/MOCK_SERVICES: 模拟后端与模拟大模型服务
- PROJECT/DOCS/PROCESS: 过程性资料集中索引（会议纪要、阶段报告、执行清单、审计过程）
- PROJECT/_backup: 历史脚本与旧启动方案备份

## 四、当前阶段状态

- 已完成：四部分（UE/前端/中台/模拟服务）可联调；前端可直接触发模拟后端产帧与模拟LLM预案；历史页可读取并按时间展示帧数据。
- 未完全闭环：
    - 端到端“操作即落库”证据链已形成基础版本，仍需在更大数据量与异常场景下补充测试证据。
    - 历史页数据分析目前为交互占位，尚未接入真实绘图与计算。
    - 特殊实体固定位置编号等配置能力尚未沉淀为中台统一下发机制。

## 五、下一阶段（真实后端 + 真实大模型 + 历史可视化）

1. 后端仿真侧
- 输出符合 DataStruction 的 `FrameSnapshot`（含环境、人群、统计、事件）。
- 支持“全量回放”和“按时间抽样查询”两类读链路。
- 提供批量产帧性能基线与异常重试策略。

2. 大模型侧
- 输出符合 DataStruction 的 `PlanConfig`，并可被中台直接落库和 `apply`。
- 提供失败兜底（超时、空响应、字段缺失）与可审计日志。

3. 前端侧
- 将历史页分析区从占位升级为真实绘图（曲线图/柱状图/热力图）。
- 统一图表数据口径：以 `statistics.*`、`environment.zones.*`、`agents.*` 为主，避免硬编码。
- 补齐“大数据量历史记录”的分页/采样策略。

4. 中台侧
- 作为唯一业务编排入口：前端不直连真实后端与真实LLM。
- 保持 HTTP + Socket 双通道：查询走 HTTP，状态推送走 Socket。
- 持续补齐联调证据链（日志、SQL 结果、异常闭环）。

详细拆分见 `DOCS/PROCESS/NEXT_PHASE_EXECUTION_PLAN.md`。

## 六、文档治理约定

- 根目录保留对外使用文档：系统说明、环境配置、测试步骤、事项说明。
- 过程性文档统一通过 [DOCS/PROCESS/INDEX.md](./DOCS/PROCESS/INDEX.md) 收口管理。
- 2026-04-17 模拟服务接入与联调记录已归档至 DOCS/PROCESS。
- 新阶段补充报告请优先放入 DOCS/PROCESS，并在索引中登记。
