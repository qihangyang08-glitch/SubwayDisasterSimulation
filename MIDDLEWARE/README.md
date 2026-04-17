# 控制与数据中台服务

更新时间：2026-04-17

## 1. 模块定位

`MIDDLEWARE` 是前端、UE、后端算法和大模型之间的业务编排中心，负责：

1. 仿真、帧数据、预案数据持久化（MySQL）。
2. HTTP 查询与操作接口。
3. Socket 实时状态和播放事件推送。
4. 上游集成（Mock/真实后端、Mock/真实LLM）的统一入口。

## 2. 目录说明

- `server/`：Node.js 中台服务。
- `db/`：数据库脚本和数据库文档。

## 3. 启动方式

目录：`PROJECT/MIDDLEWARE/server`

```powershell
npm install
npm start
```

健康检查：

```powershell
Invoke-WebRequest -Uri http://localhost:3100/healthz -Method GET
```

说明：实际端口取 `.env` 的 `PORT`，当前仓库默认配置为 `3100`（代码默认值可为 `3000`）。

## 4. 对外能力

1. 仿真管理：创建、查询、按时间取帧。
2. 播放控制：play/pause/seek/speed 的状态管理和广播。
3. 预案管理：创建、应用、运行记录。
4. 集成入口：
- `POST /api/integration/backend/start`
- `POST /api/integration/llm/plan`

## 5. 下一阶段重点

1. 对接真实后端：保证 `FrameSnapshot` 校验与批量落库稳定。
2. 对接真实LLM：保证 `PlanConfig` 校验、落库、apply 闭环稳定。
3. 输出可审计证据：日志、数据库结果、异常处理记录。

## 6. 参考文档

1. `../README.md`（项目总入口）
2. `../SYSTEM_DETAIL.md`（系统职责与接口口径）
3. `../VISUAL_TEST_RUNBOOK.md`（联调与排障）
4. `../DOCS/PROCESS/NEXT_PHASE_EXECUTION_PLAN.md`（下一阶段任务拆分）
5. `./db/INDEX.md`（数据库文档索引）
6. `./db/QUICK_START.md`（数据库快速开始）
7. `./server/docs/module5_runbook.md`（中台联调执行参考）
