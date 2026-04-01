const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/http/createApp');

class MockSimulationRepository {
  constructor() {
    this.simulations = new Map();
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

function buildPlanConfig(fromSimulationId) {
  return {
    fromSimulationId,
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
}

async function withServer(handler, options = {}) {
  const simRepo = new MockSimulationRepository();
  const planRepo = new MockPlanRepository();
  const { app, retryQueue } = createApp({
    simulationRepo: simRepo,
    planRepo,
    planDispatcher: options.planDispatcher,
    authEnabled: false,
    corsEnabled: false
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await handler({ baseUrl, retryQueue });
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

test('module5 case1: submit PlanConfig persists and returns Ack', async () => {
  await withServer(async ({ baseUrl }) => {
    const createSimResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createSimResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPlanConfig(baseSimulationId))
    });

    assert.equal(planResp.status, 200);
    const planBody = await planResp.json();
    assert.equal(planBody.messageType, 'Ack');
    assert.equal(typeof planBody.payload.planId, 'string');
  });
});

test('module5 case2: apply records plan_run and returns newSimulationId', async () => {
  await withServer(async ({ baseUrl }) => {
    const createSimResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createSimResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPlanConfig(baseSimulationId))
    });
    const planBody = await planResp.json();

    const applyResp = await fetch(`${baseUrl}/api/plans/${planBody.payload.planId}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromSimTime: 2.0 })
    });

    assert.equal(applyResp.status, 200);
    const applyBody = await applyResp.json();
    assert.equal(applyBody.messageType, 'Ack');
    assert.equal(typeof applyBody.payload.planRunId, 'string');
    assert.equal(typeof applyBody.payload.newSimulationId, 'string');
  });
});

test('module5 case3: dispatch sends PlanCommand and returns dispatch Ack', async () => {
  const dispatched = [];
  await withServer(async ({ baseUrl }) => {
    const createSimResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createSimResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPlanConfig(baseSimulationId))
    });
    const planBody = await planResp.json();

    const applyResp = await fetch(`${baseUrl}/api/plans/${planBody.payload.planId}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    const applyBody = await applyResp.json();

    const dispatchResp = await fetch(`${baseUrl}/api/plans/${planBody.payload.planId}/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: applyBody.payload.newSimulationId })
    });

    assert.equal(dispatchResp.status, 200);
    const dispatchBody = await dispatchResp.json();
    assert.equal(dispatchBody.messageType, 'Ack');
    assert.equal(dispatchBody.payload.status, 'ok');
    assert.equal(dispatchBody.payload.planId, planBody.payload.planId);
    assert.equal(dispatchBody.payload.compiledActionCount, 2);
    assert.equal(dispatchBody.payload.acceptedActionCount, 1);
    assert.equal(dispatchBody.payload.dedupedActionCount, 1);

    assert.equal(dispatched.length, 1);
  }, {
    planDispatcher: {
      async dispatchPlanCommand(input) {
        dispatched.push(input);
        return {
          status: 'ok',
          compiledActionCount: 2,
          acceptedActionCount: 1,
          dedupedActionCount: 1
        };
      }
    }
  });
});

test('module5 patch: dispatch failure returns pending and enqueues retry', async () => {
  await withServer(async ({ baseUrl, retryQueue }) => {
    const createSimResp = await fetch(`${baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildInitConfig())
    });
    const created = await createSimResp.json();
    const baseSimulationId = created.payload.simulationId;

    const planResp = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPlanConfig(baseSimulationId))
    });
    const planBody = await planResp.json();

    const applyResp = await fetch(`${baseUrl}/api/plans/${planBody.payload.planId}/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    const applyBody = await applyResp.json();

    const dispatchResp = await fetch(`${baseUrl}/api/plans/${planBody.payload.planId}/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newSimulationId: applyBody.payload.newSimulationId })
    });

    assert.equal(dispatchResp.status, 202);
    const envelope = await dispatchResp.json();
    assert.equal(envelope.messageType, 'Ack');
    assert.equal(envelope.payload.status, 'pending');

    assert.ok(retryQueue.length >= 1);
    assert.equal(retryQueue[retryQueue.length - 1].taskType, 'plan_dispatch');
  }, {
    planDispatcher: {
      async dispatchPlanCommand() {
        const err = new Error('dispatcher unavailable');
        err.code = 'DISPATCHER_UNAVAILABLE';
        throw err;
      }
    }
  });
});
