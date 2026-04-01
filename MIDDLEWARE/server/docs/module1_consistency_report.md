# Module 1 一致性报告

## 范围
- 目标：模块 1 的数据库持久化与模型层。
- 核对来源：任务清单需求与 DataStruction V1.0 语义定义。

## 一致性检查结果

### 已确认一致
1. 核心对象均以原始 JSON 形式持久化：
   - `InitConfig` -> `simulations.init_config`
   - `FrameSnapshot` -> `simulation_frames.frame_snapshot`
   - `PlanConfig` -> `plans.plan_config`
2. 必需主键与索引保持一致：
   - 主键：`simulation_frames(sim_id, frame_index)`
   - 二级索引：`simulation_frames(sim_id, sim_time)`
   - 二级索引：`plans(from_simulation_id)`
3. Repository 合同覆盖完整：
   - createSimulation
   - batchInsertFrames
   - createPlan
   - createPlanRun
   - getFrameByTime
   - getFrameByIndex
   - getSimulationTimeRange
   - getPlanRuns
   - listSimulations
4. 字段映射规则已明确实现：
   - DB 层使用 snake_case。
   - service 输出仅使用 camelCase。

### 发现冲突与修复建议
1. 时间表示方式不一致：
   - DataStruction 规定 `createdAt` 为毫秒时间戳。
   - 任务文本中的许多 SQL 示例暗示 `created_at` 为 datetime 风格。
   - 已实施修复：保留 `created_at` 列名，但在 BIGINT 中存储毫秒 epoch。
   - 原因：保持 DataStruction 语义并避免精度损失。

2. 文档示例命名风格不一致：
   - DataStruction 的表示例使用 camelCase（`simulationFrames`）。
   - 模块 1 要求允许表字段使用 snake_case。
   - 已实施修复：schema 使用 snake_case，由 mapper 转换为 camelCase。

### 无合同变更
- 未修改 DataStruction 既有字段或 payload 合同。
- 仅将持久化层内部命名统一规范为 snake_case。
