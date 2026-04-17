# 模拟服务接入变更记录（2026-04-17）

更新时间：2026-04-17
范围：前端 + 中台 + 模拟服务 + 运行文档

## 1. 目标与背景

为满足测试需求，在真实仿真算法与真实大模型未完成前，新增模拟后端与模拟大模型链路，确保可执行以下闭环：

1. 前端创建仿真。
2. 中台触发模拟后端产帧并落库。
3. 模拟后端回送完成态，前端可显示完成提示。
4. 中台触发模拟 LLM 生成预案并应用。
5. 历史页可查询并按时间顺序展示帧数据。

## 2. 变更清单

### 2.1 前端

1. 新增中台客户端接口：
- `startIntegrationBackend(simulationId, options)`
- `requestIntegrationPlan(body)`

2. 主页面新增按钮：
- “启动模拟仿真”

3. 交互流程调整：
- 触发模拟仿真：调用中台 `POST /api/integration/backend/start`
- 预案生成：调用中台 `POST /api/integration/llm/plan` 后再 `apply`

4. 完成态提示增强：
- 收到 `frame.status=completed` 时提示“仿真计算完成”
- 播放状态从 `playing` 到 `paused` 且到达末尾时也提示完成

### 2.2 模拟后端（MOCK_SERVICES）

1. 参数校验增强：
- `options.fps > 0`
- `options.totalFrames` 为正整数

2. 帧回写增强：
- 最后一帧强制设置 `status=completed`
- 附加完成事件 `simulation_completed`

3. 可观测性增强：
- 记录触发入参摘要（simulationId、scenarioId、fps、totalFrames）
- 记录完成日志（frameIndex、simTime）

### 2.3 中台配置

1. `.env` 增加外部服务地址：
- `SIM_ENGINE_BASE_URL=http://127.0.0.1:3200`
- `LLM_BASE_URL=http://127.0.0.1:3300`
- `EXTERNAL_HTTP_TIMEOUT_MS=15000`

2. 触发接口沿用现有集成设计：
- `POST /api/integration/backend/start`
- `POST /api/integration/llm/plan`

### 2.4 运行文档

1. `VISUAL_TEST_RUNBOOK.md` 已新增：
- 模拟后端与模拟LLM启动步骤
- 3200/3300 端口连通性检查
- 前端触发模拟仿真与模拟LLM预案操作说明

2. 根目录主文档已同步纳入模拟服务现状。

## 3. 风险与后续

1. 当前 mock 仅用于联调，不可替代真实算法性能结果。
2. 历史页分析仍为交互占位，未接入真实绘图引擎。
3. 建议下一步补充权限场景与高帧数压测（含 `FRAME_INGEST_TOKEN` 开启场景）。

## 4. 关联文档

1. `PROJECT/VISUAL_TEST_RUNBOOK.md`
2. `PROJECT/README.md`
3. `PROJECT/SYSTEM_DETAIL.md`
4. `PROJECT/NOTES_AND_DECISIONS.md`
5. `PROJECT/PROJECT_ARCHITECTURE.md`
