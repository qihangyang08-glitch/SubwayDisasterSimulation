const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/http/createApp');

class MockSimulationRepository {
  constructor() {
    this.simulations = new Map();
    this.frames = new Map();
    this.simCounter = 0;
  }

  async createSimulation(initConfig, options = {}) {
    const simulationId = options.simulationId || `sim_mock_${++this.simCounter}`;
    this.simulations.set(simulationId, {
      simulationId,
      scenarioId: initConfig.scenarioId,
      mapLevel: initConfig.mapLevel,
      status: options.status || 'running',
      createdAt: Date.now(),
      initConfig
    });
    return { simulationId };
  }

  async getSimulationById(simulationId) {
    return this.simulations.get(simulationId) || null;
  }

  async getSimulationInitConfig(simulationId) {
    const simulation = this.simulations.get(simulationId);
    return simulation ? simulation.initConfig : null;
  }

  async batchInsertFrames(simulationId, frames) {
    const current = this.frames.get(simulationId) || [];
    const merged = [...current];

    for (const frame of frames) {
      const index = merged.findIndex((f) => f.frameIndex === frame.frameIndex);
      const normalized = {
        ...frame,
        simulationId
      };
      if (index >= 0) {
        merged[index] = normalized;
      } else {
        merged.push(normalized);
      }
    }

    merged.sort((a, b) => a.frameIndex - b.frameIndex);
    this.frames.set(simulationId, merged);

    return {
      insertedOrAffectedRows: frames.length,
      frameCount: frames.length,
      idempotencyMode: 'upsert'
    };
  }

  async getFrameByTime(simulationId, targetTime) {
    const list = this.frames.get(simulationId) || [];
    const cands = list.filter((f) => f.simTime <= targetTime);
    if (!cands.length) {
      return null;
    }
    cands.sort((a, b) => b.simTime - a.simTime || b.frameIndex - a.frameIndex);
    return cands[0];
  }

  async getFrameByIndex(simulationId, frameIndex) {
    const list = this.frames.get(simulationId) || [];
    return list.find((f) => f.frameIndex === frameIndex) || null;
  }

  async getSimulationTimeRange(simulationId) {
    const list = this.frames.get(simulationId) || [];
    if (!list.length) {
      return { minSimTime: null, maxSimTime: null };
    }
    const simTimes = list.map((f) => f.simTime);
    return {
      minSimTime: Math.min(...simTimes),
      maxSimTime: Math.max(...simTimes)
    };
  }

  async listSimulations() {
    return Array.from(this.simulations.values());
  }
}

class MockPlanRepository {
  constructor() {
    this.plans = new Map();
    this.planRuns = [];
    this.planCounter = 0;
    this.runCounter = 0;
  }

  async createPlan(planConfig, options = {}) {
    const planId = options.planId || planConfig.planId || `plan_mock_${++this.planCounter}`;
    this.plans.set(planId, {
      planId,
      fromSimulationId: planConfig.fromSimulationId,
      fromSimTime: planConfig.fromSimTime,
      planSource: planConfig.planSource,
      planConfig: {
        ...planConfig,
        planId
      },
      createdAt: Date.now()
    });
    return { planId };
  }

  async getPlanById(planId) {
    return this.plans.get(planId) || null;
  }

  async createPlanRun(input, options = {}) {
    const planRunId = options.planRunId || `planrun_mock_${++this.runCounter}`;
    const run = {
      planRunId,
      baseSimulationId: input.baseSimulationId,
      planId: input.planId,
      newSimulationId: input.newSimulationId,
      createdAt: Date.now()
    };
    this.planRuns.push(run);
    return run;
  }
}

function buildInitConfig() {
  return {
    scenarioId: 'metro_fire_water_01',
    mapLevel: 'Station_A_Platform',
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

async function withServer(handler) {
  const simRepo = new MockSimulationRepository();
  const planRepo = new MockPlanRepository();
  const { app } = createApp({
    simulationRepo: simRepo,
    planRepo,
    authEnabled: false,
    corsEnabled: false
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await handler({ baseUrl });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test('module2 case1: create simulation + frames then info has maxSimTime', async () => {
  await withServer(async ({ baseUrl }) => {
    const createResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    assert.equal(createResp.status, 200);
    const created = await createResp.json();
    const simulationId = created.payload.simulationId;

    const framesResp = await fetch(`${baseUrl}/api/simulations/${simulationId}/frames`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frames: [
          buildFrame(simulationId, 1, 1.0),
          buildFrame(simulationId, 2, 3.0)
        ]
      })
    });
    assert.equal(framesResp.status, 200);

    const infoResp = await fetch(`${baseUrl}/api/simulations/${simulationId}/info`);
    assert.equal(infoResp.status, 200);
    const info = await infoResp.json();
    assert.equal(info.messageType, 'Ack');
    assert.equal(info.payload.maxSimTime, 3.0);
  });
});

test('module2 case2: frame by time returns nearest historical frame', async () => {
  await withServer(async ({ baseUrl }) => {
    const createResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createResp.json();
    const simulationId = created.payload.simulationId;

    await fetch(`${baseUrl}/api/simulations/${simulationId}/frames`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frames: [
          buildFrame(simulationId, 10, 10.0),
          buildFrame(simulationId, 20, 20.0),
          buildFrame(simulationId, 30, 30.0)
        ]
      })
    });

    const frameResp = await fetch(`${baseUrl}/api/simulations/${simulationId}/frame?time=25`);
    assert.equal(frameResp.status, 200);
    const frameEnvelope = await frameResp.json();
    assert.equal(frameEnvelope.messageType, 'FrameSnapshot');
    assert.equal(frameEnvelope.payload.frameIndex, 20);
    assert.equal(frameEnvelope.payload.simTime, 20.0);
  });
});

test('module2 case3: create plan + apply returns Ack placeholder result', async () => {
  await withServer(async ({ baseUrl }) => {
    const createResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planConfig = {
      fromSimulationId: baseSimulationId,
      fromSimTime: 2.0,
      planSource: 'manual',
      objective: 'smoke reduction',
      initConfigLike: buildInitConfig(),
      planRuntime: {
        actions: [
          {
            actionId: 'act_01',
            startAt: 2.5,
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

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(planConfig)
    });
    assert.equal(planResp.status, 200);
    const plan = await planResp.json();
    const planId = plan.payload.planId;
    assert.equal(plan.payload.inheritanceUsed, false);
    assert.equal(typeof plan.payload.compiledActionCount, 'number');

    const applyResp = await fetch(`${baseUrl}/api/plans/${planId}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromSimTime: 3.0 })
    });

    assert.equal(applyResp.status, 200);
    const applied = await applyResp.json();
    assert.equal(applied.messageType, 'Ack');
    assert.equal(typeof applied.payload.planRunId, 'string');
    assert.equal(typeof applied.payload.newSimulationId, 'string');
    assert.equal(typeof applied.payload.compiledActionCount, 'number');
    assert.equal(applied.simulationId, applied.payload.newSimulationId);
  });
});

test('module2 patch case1: InitConfig special entity missing triggerAt returns 400', async () => {
  await withServer(async ({ baseUrl }) => {
    const invalidBody = {
      ...buildInitConfig(),
      specialEntities: [
        {
          entityId: 'device_warning_01',
          entityType: 'warningLight',
          position: [0, 0, 0],
          config: { blink: true }
        }
      ]
    };

    const resp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invalidBody)
    });

    assert.equal(resp.status, 400);
    const envelope = await resp.json();
    assert.equal(envelope.messageType, 'Error');
  });
});

test('module2 patch case2: PlanConfig without disasters inherits baseline and returns inheritanceUsed=true', async () => {
  await withServer(async ({ baseUrl }) => {
    const createResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planConfig = {
      fromSimulationId: baseSimulationId,
      fromSimTime: 2.0,
      planSource: 'manual',
      objective: 'inherit disasters',
      initConfigLike: {
        scenarioId: 'metro_fire_water_01',
        mapLevel: 'Station_A_Platform',
        totalPeople: 500,
        specialEntities: []
      },
      planRuntime: {
        actions: [
          {
            actionId: 'act_01',
            startAt: 2.1,
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

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(planConfig)
    });

    assert.equal(planResp.status, 200);
    const plan = await planResp.json();
    assert.equal(plan.messageType, 'Ack');
    assert.equal(plan.payload.inheritanceUsed, true);
    assert.equal(typeof plan.payload.compiledActionCount, 'number');
  });
});
