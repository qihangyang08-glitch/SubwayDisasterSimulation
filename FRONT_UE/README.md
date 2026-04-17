# 前端模块说明

更新时间：2026-04-17

## 1. 模块定位

`FRONT_UE` 负责两部分：

1. 浏览器侧交互页面（创建仿真、回放控制、历史数据与分析区）。
2. Pixel Streaming SignallingWebServer（Cirrus，默认 8080/8888）。

当前阶段前端已完成“可联调”能力，下一阶段重点是“历史数据真实可视化”。

## 2. 启动方式

目录：`PROJECT/FRONT_UE/frontend/WebServers/SignallingWebServer`

```powershell
npm install
npm start
```

期望日志：

- `Http listening on *: 8080`
- `WebSocket listening to Streamer connections on :8888`
- `WebSocket listening to Players connections on :8080`

页面入口：

- `http://localhost:8080/`
- `http://localhost:8080/player.html`
- `http://localhost:8080/history.html`

## 3. 当前实现状态

1. 已完成
- 创建仿真配置（按 DataStruction 主要字段）。
- 模拟仿真触发与完成态提示。
- 历史页独立页面与时序数据展示。

2. 待完成
- 历史页真实图表渲染（当前为交互占位）。
- 大数据量采样和分页策略。
- 与真实后端/真实LLM联调后的异常态展示优化。

## 4. 与其他模块接口边界

1. 前端仅调用中台，不直连真实后端或真实LLM。
2. 查询链路走 HTTP，实时状态走 Socket。
3. 数据结构以 `DOCS/ARCHIVE_PHASE1/DataStruction.md` 为基线，字段扩展走 `ext`。

## 5. 参考文档

1. `../README.md`（项目总入口）
2. `../SYSTEM_DETAIL.md`（系统职责与接口口径）
3. `../VISUAL_TEST_RUNBOOK.md`（联调与排障）
4. `../DOCS/PROCESS/NEXT_PHASE_EXECUTION_PLAN.md`（下一阶段任务拆分）
5. `./QUICK_START.md`（前端快速启动）
6. `./DATA_STRUCTURE_COMPLIANCE_CHECK.md`（数据结构一致性检查）
7. `./FRONTEND_REFACTOR_REPORT.md`（重构过程说明）
