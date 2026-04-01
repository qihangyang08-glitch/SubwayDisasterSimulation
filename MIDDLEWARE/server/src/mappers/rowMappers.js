function parseJson(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  return JSON.parse(value);
}

function mapSimulationRow(row) {
  return {
    simulationId: row.sim_id,
    scenarioId: row.scenario_id,
    mapLevel: row.map_level,
    status: row.status,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    minSimTime: row.min_sim_time ?? null,
    maxSimTime: row.max_sim_time ?? null
  };
}

function mapFrameRow(row) {
  return parseJson(row.frame_snapshot);
}

function mapPlanRunRow(row) {
  return {
    planRunId: row.plan_run_id,
    baseSimulationId: row.base_simulation_id,
    planId: row.plan_id,
    newSimulationId: row.new_simulation_id,
    createdAt: row.created_at
  };
}

function mapPlanRow(row) {
  return {
    planId: row.plan_id,
    fromSimulationId: row.from_simulation_id,
    fromSimTime: row.from_sim_time,
    planSource: row.plan_source,
    planConfig: parseJson(row.plan_config),
    createdAt: row.created_at
  };
}

module.exports = {
  mapSimulationRow,
  mapFrameRow,
  mapPlanRunRow,
  mapPlanRow,
  parseJson
};
