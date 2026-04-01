-- Module 1 audit patch helper: triggerAt traceability queries
-- MySQL 8.0+

SET NAMES utf8mb4;

-- 1) Trace InitConfig specialEntities.triggerAt by simulation.
SELECT
  s.sim_id,
  se.entity_id,
  se.entity_type,
  se.trigger_at
FROM simulations s,
JSON_TABLE(
  s.init_config,
  '$.specialEntities[*]'
  COLUMNS (
    entity_id VARCHAR(128) PATH '$.entityId',
    entity_type VARCHAR(64) PATH '$.entityType',
    trigger_at DECIMAL(12,3) PATH '$.triggerAt'
  )
) AS se
WHERE s.sim_id = ?
ORDER BY se.trigger_at ASC, se.entity_id ASC;

-- 2) Trace PlanConfig specialEntities.triggerAt and action startAt in one view.
SELECT
  p.plan_id,
  'specialEntity' AS source_type,
  se.entity_id AS target_id,
  se.trigger_at AS trigger_time,
  NULL AS action_name
FROM plans p,
JSON_TABLE(
  p.plan_config,
  '$.initConfigLike.specialEntities[*]'
  COLUMNS (
    entity_id VARCHAR(128) PATH '$.entityId',
    trigger_at DECIMAL(12,3) PATH '$.triggerAt'
  )
) AS se
WHERE p.plan_id = ?
UNION ALL
SELECT
  p.plan_id,
  'planRuntime' AS source_type,
  pa.target_id,
  pa.start_at AS trigger_time,
  pa.action_name
FROM plans p,
JSON_TABLE(
  p.plan_config,
  '$.planRuntime.actions[*]'
  COLUMNS (
    target_id VARCHAR(128) PATH '$.targetId',
    start_at DECIMAL(12,3) PATH '$.startAt',
    action_name VARCHAR(128) PATH '$.action'
  )
) AS pa
WHERE p.plan_id = ?
ORDER BY trigger_time ASC, target_id ASC;
