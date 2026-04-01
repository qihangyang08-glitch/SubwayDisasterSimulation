const test = require('node:test');
const assert = require('node:assert/strict');

const { getPool, closePool } = require('../src/db/mysqlPool');
const { SimulationRepository } = require('../src/repositories/simulationRepository');
const { PlanRepository } = require('../src/repositories/planRepository');
const { validateInitConfig } = require('../src/validators');

const integrationEnabled = process.env.MODULE1_DB_TEST === '1';

const runOrSkip = integrationEnabled ? test : test.skip;

function buildInitConfig() {
  return {
    scenarioId: 'metro_fire_water_01',
    mapLevel: 'Station_A_Platform',
    seed: 1024,
    totalPeople: 500,
    disasters: {
      water: {
        enabled: true,
        inlets: []
      },
      fire: {
        enabled: true,
        sources: []
      }
    },
    specialEntities: [],
    ext: {}
  };
}

function buildFrame(simulationId, frameIndex, simTime) {
  return {
    frameId: `${simulationId}_${String(frameIndex).padStart(6, '0')}`,
    simulationId,
    simTime,
    frameIndex,
    status: 'running',
    environment: { zones: [] },
    agents: [],
    specialEntities: [],
    events: [],
    statistics: {
      totalEvacuated: 0,
      inWaterDeep: 0,
      avgExposureTime: 0,
      casualtyCount: 0
    },
    ext: {}
  };
}

runOrSkip('case1: createSimulation then empty time range', async () => {
  const simRepo = new SimulationRepository({ pool: getPool() });
  const { simulationId } = await simRepo.createSimulation(buildInitConfig());
  const range = await simRepo.getSimulationTimeRange(simulationId);
  assert.equal(range.minSimTime, null);
  assert.equal(range.maxSimTime, null);
});

runOrSkip('case2: batchInsertFrames then nearest historical frame by time', async () => {
  const simRepo = new SimulationRepository({ pool: getPool() });
  const { simulationId } = await simRepo.createSimulation(buildInitConfig());

  await simRepo.batchInsertFrames(simulationId, [
    buildFrame(simulationId, 1, 1.0),
    buildFrame(simulationId, 2, 2.0),
    buildFrame(simulationId, 3, 3.0)
  ]);

  const frame = await simRepo.getFrameByTime(simulationId, 2.4);
  assert.equal(frame.frameIndex, 2);
  assert.equal(frame.simTime, 2.0);
});

runOrSkip('case3: createPlan + createPlanRun then query relation', async () => {
  const simRepo = new SimulationRepository({ pool: getPool() });
  const planRepo = new PlanRepository({ pool: getPool() });

  const { simulationId: baseSimulationId } = await simRepo.createSimulation(buildInitConfig());
  const { simulationId: newSimulationId } = await simRepo.createSimulation(buildInitConfig());

  const planConfig = {
    fromSimulationId: baseSimulationId,
    fromSimTime: 1.0,
    planSource: 'manual',
    objective: 'smoke reduction',
    initConfigLike: {
      scenarioId: 'metro_fire_water_01',
      mapLevel: 'Station_A_Platform',
      totalPeople: 500,
      disasters: {
        water: { enabled: true, inlets: [] },
        fire: { enabled: true, sources: [] }
      },
      specialEntities: []
    },
    planRuntime: {
      actions: [
        {
          actionId: 'act_01',
          startAt: 1.2,
          targetId: 'device_warning_01',
          action: 'setBlink',
          params: { blink: true }
        }
      ]
    },
    expectedMetrics: {
      evacuationRateImprove: 0.1,
      avgExposureTimeReduce: 0.1
    },
    ext: {}
  };

  const { planId } = await planRepo.createPlan(planConfig);
  await planRepo.createPlanRun({
    baseSimulationId,
    planId,
    newSimulationId
  });

  const runs = await planRepo.getPlanRuns(baseSimulationId);
  assert.ok(runs.length >= 1);
  assert.equal(runs[0].baseSimulationId, baseSimulationId);
});

test('patch case: InitConfig specialEntities.triggerAt is required', () => {
  const invalidInitConfig = {
    ...buildInitConfig(),
    specialEntities: [
      {
        entityId: 'device_warning_01',
        entityType: 'warningLight',
        position: [900, -300, 260],
        config: {
          blink: true,
          guideBoostProb: 0.12
        }
      }
    ]
  };

  assert.throws(
    () => validateInitConfig(invalidInitConfig),
    /triggerAt/
  );
});

test.after(async () => {
  await closePool();
});
