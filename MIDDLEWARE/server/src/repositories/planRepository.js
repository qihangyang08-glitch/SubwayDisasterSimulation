const { getPool } = require('../db/mysqlPool');
const { withTransaction } = require('../db/transaction');
const { mapPlanRunRow, mapPlanRow } = require('../mappers/rowMappers');
const { validatePlanConfig, createValidationError } = require('../validators');
const { generateId } = require('./simulationRepository');

function nowMs() {
  return Date.now();
}

class PlanRepository {
  constructor(options = {}) {
    this.pool = options.pool || getPool(options.poolConfig);
    this.poolConfig = options.poolConfig;
  }

  async createPlan(planConfig, options = {}) {
    validatePlanConfig(planConfig);

    const planId = options.planId || planConfig.planId || generateId('plan');
    const createdAt = options.createdAt || nowMs();

    const normalizedPlanConfig = {
      ...planConfig,
      planId
    };

    const sql = `
      INSERT INTO plans
        (plan_id, from_simulation_id, from_sim_time, plan_source, plan_config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.pool.execute(sql, [
      planId,
      planConfig.fromSimulationId,
      Number(planConfig.fromSimTime),
      planConfig.planSource,
      JSON.stringify(normalizedPlanConfig),
      createdAt
    ]);

    return { planId };
  }

  async createPlanRun(input, options = {}) {
    const baseSimulationId = input.baseSimulationId;
    const planId = input.planId;
    const newSimulationId = input.newSimulationId;

    if (!baseSimulationId || !planId || !newSimulationId) {
      throw createValidationError(
        'createPlanRun requires baseSimulationId, planId and newSimulationId'
      );
    }

    const planRunId = options.planRunId || generateId('planrun');
    const createdAt = options.createdAt || nowMs();

    const sql = `
      INSERT INTO plan_runs
        (plan_run_id, base_simulation_id, plan_id, new_simulation_id, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        plan_run_id = plan_run_id
    `;

    const [result] = await this.pool.execute(sql, [
      planRunId,
      baseSimulationId,
      planId,
      newSimulationId,
      createdAt
    ]);

    // BUG-001 FIX: If duplicate key conflict occurred (affectedRows=0 or 1 with no insert),
    // query the actual plan_run_id from database to ensure consistency
    let actualPlanRunId = planRunId;
    if (result.affectedRows === 0 || (result.affectedRows === 1 && result.insertId === 0)) {
      console.log(`[PlanRepository] Duplicate key conflict detected, querying actual plan_run_id`);
      const [rows] = await this.pool.execute(
        `SELECT plan_run_id FROM plan_runs 
         WHERE base_simulation_id = ? AND plan_id = ? AND new_simulation_id = ?`,
        [baseSimulationId, planId, newSimulationId]
      );
      if (rows && rows.length > 0) {
        actualPlanRunId = rows[0].plan_run_id;
        console.log(`[PlanRepository] Using actual plan_run_id from DB: ${actualPlanRunId}`);
      }
    } else {
      console.log(`[PlanRepository] Created new plan_run: ${actualPlanRunId}`);
    }

    return {
      planRunId: actualPlanRunId,
      baseSimulationId,
      planId,
      newSimulationId
    };
  }

  async createPlanWithRun(planConfig, runInput, options = {}) {
    validatePlanConfig(planConfig);

    const txOptions = {
      maxRetries: options.maxRetries,
      baseRetryDelayMs: options.baseRetryDelayMs,
      poolConfig: this.poolConfig
    };

    return withTransaction(async (conn) => {
      const planId = options.planId || planConfig.planId || generateId('plan');
      const planRunId = options.planRunId || generateId('planrun');
      const createdAt = options.createdAt || nowMs();

      const normalizedPlanConfig = {
        ...planConfig,
        planId
      };

      const planSql = `
        INSERT INTO plans
          (plan_id, from_simulation_id, from_sim_time, plan_source, plan_config, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await conn.execute(planSql, [
        planId,
        planConfig.fromSimulationId,
        Number(planConfig.fromSimTime),
        planConfig.planSource,
        JSON.stringify(normalizedPlanConfig),
        createdAt
      ]);

      const baseSimulationId = runInput.baseSimulationId || planConfig.fromSimulationId;
      const newSimulationId = runInput.newSimulationId;
      if (!newSimulationId) {
        throw createValidationError('createPlanWithRun requires runInput.newSimulationId');
      }

      const runSql = `
        INSERT INTO plan_runs
          (plan_run_id, base_simulation_id, plan_id, new_simulation_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `;

      await conn.execute(runSql, [
        planRunId,
        baseSimulationId,
        planId,
        newSimulationId,
        createdAt
      ]);

      return {
        planId,
        planRunId,
        baseSimulationId,
        newSimulationId
      };
    }, txOptions);
  }

  async getPlanRuns(baseSimulationId) {
    const sql = `
      SELECT
        plan_run_id,
        base_simulation_id,
        plan_id,
        new_simulation_id,
        created_at
      FROM plan_runs
      WHERE base_simulation_id = ?
      ORDER BY created_at DESC
    `;

    const [rows] = await this.pool.execute(sql, [baseSimulationId]);
    return rows.map(mapPlanRunRow);
  }

  async getPlanById(planId) {
    const sql = `
      SELECT
        plan_id,
        from_simulation_id,
        from_sim_time,
        plan_source,
        plan_config,
        created_at
      FROM plans
      WHERE plan_id = ?
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(sql, [planId]);
    if (!rows.length) {
      return null;
    }
    return mapPlanRow(rows[0]);
  }
}

module.exports = {
  PlanRepository
};
