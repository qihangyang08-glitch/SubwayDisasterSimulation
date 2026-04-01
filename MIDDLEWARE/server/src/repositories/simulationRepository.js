const { getPool } = require('../db/mysqlPool');
const { withTransaction } = require('../db/transaction');
const { mapSimulationRow, mapFrameRow, parseJson } = require('../mappers/rowMappers');
const { validateInitConfig, validateFrameSnapshot, createValidationError } = require('../validators');

function nowMs() {
  return Date.now();
}

function generateId(prefix) {
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}_${Date.now()}_${random}`;
}

function buildMultiRowPlaceholders(rowCount, colCount) {
  const row = `(${new Array(colCount).fill('?').join(',')})`;
  return new Array(rowCount).fill(row).join(',');
}

class SimulationRepository {
  constructor(options = {}) {
    this.pool = options.pool || getPool(options.poolConfig);
    this.poolConfig = options.poolConfig;
  }

  async createSimulation(initConfig, options = {}) {
    validateInitConfig(initConfig);

    const simulationId = options.simulationId || generateId('sim');
    const status = options.status || 'running';
    const createdAt = options.createdAt || nowMs();

    const sql = `
      INSERT INTO simulations
        (sim_id, scenario_id, map_level, status, init_config, created_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.pool.execute(sql, [
      simulationId,
      initConfig.scenarioId,
      initConfig.mapLevel,
      status,
      JSON.stringify(initConfig),
      createdAt,
      null
    ]);

    return { simulationId };
  }

  async batchInsertFrames(simulationId, frames, options = {}) {
    if (!simulationId) {
      throw createValidationError('simulationId is required');
    }
    if (!Array.isArray(frames) || frames.length === 0) {
      throw createValidationError('frames must be a non-empty array');
    }

    frames.forEach(validateFrameSnapshot);

    const idempotencyMode = options.idempotencyMode || 'upsert';
    const txOptions = {
      maxRetries: options.maxRetries,
      baseRetryDelayMs: options.baseRetryDelayMs,
      poolConfig: this.poolConfig
    };

    return withTransaction(async (conn) => {
      const colCount = 5;
      const placeholders = buildMultiRowPlaceholders(frames.length, colCount);
      const values = [];
      const createdAt = nowMs();

      frames.forEach((frame) => {
        const normalizedFrame = {
          ...frame,
          simulationId
        };
        values.push(
          simulationId,
          Number(frame.frameIndex),
          Number(frame.simTime),
          JSON.stringify(normalizedFrame),
          createdAt
        );
      });

      let sql = `
        INSERT INTO simulation_frames
          (sim_id, frame_index, sim_time, frame_snapshot, created_at)
        VALUES ${placeholders}
      `;

      if (idempotencyMode === 'ignore') {
        sql = sql.replace('INSERT INTO', 'INSERT IGNORE INTO');
      } else if (idempotencyMode === 'upsert') {
        sql += `
          ON DUPLICATE KEY UPDATE
            sim_time = VALUES(sim_time),
            frame_snapshot = VALUES(frame_snapshot),
            created_at = VALUES(created_at)
        `;
      } else {
        throw createValidationError('idempotencyMode must be "ignore" or "upsert"');
      }

      const [result] = await conn.query({ sql, timeout: options.timeoutMs || 0 }, values);
      return {
        insertedOrAffectedRows: result.affectedRows,
        frameCount: frames.length,
        idempotencyMode
      };
    }, txOptions);
  }

  async getFrameByTime(simulationId, targetTime) {
    const sql = `
      SELECT frame_snapshot
      FROM simulation_frames
      WHERE sim_id = ?
        AND sim_time <= ?
      ORDER BY sim_time DESC, frame_index DESC
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(sql, [simulationId, Number(targetTime)]);
    if (!rows.length) {
      return null;
    }
    return mapFrameRow(rows[0]);
  }

  async getFrameByIndex(simulationId, frameIndex) {
    const sql = `
      SELECT frame_snapshot
      FROM simulation_frames
      WHERE sim_id = ?
        AND frame_index = ?
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(sql, [simulationId, Number(frameIndex)]);
    if (!rows.length) {
      return null;
    }
    return mapFrameRow(rows[0]);
  }

  async getSimulationTimeRange(simulationId) {
    const sql = `
      SELECT MIN(sim_time) AS min_sim_time, MAX(sim_time) AS max_sim_time
      FROM simulation_frames
      WHERE sim_id = ?
    `;

    const [rows] = await this.pool.execute(sql, [simulationId]);
    const row = rows[0] || {};

    return {
      minSimTime: row.min_sim_time ?? null,
      maxSimTime: row.max_sim_time ?? null
    };
  }

  async listSimulations() {
    const sql = `
      SELECT
        s.sim_id,
        s.scenario_id,
        s.map_level,
        s.status,
        s.created_at,
        r.min_sim_time,
        r.max_sim_time
      FROM simulations s
      LEFT JOIN (
        SELECT
          sim_id,
          MIN(sim_time) AS min_sim_time,
          MAX(sim_time) AS max_sim_time
        FROM simulation_frames
        GROUP BY sim_id
      ) r ON r.sim_id = s.sim_id
      ORDER BY s.created_at DESC
    `;

    const [rows] = await this.pool.query(sql);
    return rows.map(mapSimulationRow);
  }

  async getSimulationById(simulationId) {
    const sql = `
      SELECT
        sim_id,
        scenario_id,
        map_level,
        status,
        created_at,
        finished_at
      FROM simulations
      WHERE sim_id = ?
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(sql, [simulationId]);
    if (!rows.length) {
      return null;
    }
    return mapSimulationRow(rows[0]);
  }

  async getSimulationInitConfig(simulationId) {
    const sql = `
      SELECT init_config
      FROM simulations
      WHERE sim_id = ?
      LIMIT 1
    `;

    const [rows] = await this.pool.execute(sql, [simulationId]);
    if (!rows.length) {
      return null;
    }
    return parseJson(rows[0].init_config);
  }
}

module.exports = {
  SimulationRepository,
  generateId
};
