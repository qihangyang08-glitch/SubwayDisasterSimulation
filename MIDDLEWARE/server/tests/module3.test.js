const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');

const { createDispatcher } = require('../src/socket/dispatcher');

class MockSimulationRepository {
  constructor() {
    this.frames = new Map();
  }

  putFrames(simulationId, frames) {
    const sorted = [...frames].sort((a, b) => a.simTime - b.simTime || a.frameIndex - b.frameIndex);
    this.frames.set(simulationId, sorted);
  }

  async getSimulationTimeRange(simulationId) {
    const list = this.frames.get(simulationId) || [];
    if (!list.length) {
      return { minSimTime: null, maxSimTime: null };
    }

    return {
      minSimTime: list[0].simTime,
      maxSimTime: list[list.length - 1].simTime
    };
  }

  async getFrameByTime(simulationId, targetTime) {
    const list = this.frames.get(simulationId) || [];
    let found = null;
    for (const frame of list) {
      if (frame.simTime <= targetTime) {
        found = frame;
      } else {
        break;
      }
    }
    return found;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceEvent(socket, eventName, timeoutMs = 2000, filter = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`timeout waiting ${eventName}`));
    }, timeoutMs);

    function onEvent(payload) {
      if (filter && !filter(payload)) {
        return;
      }
      socket.off(eventName, onEvent);
      clearTimeout(timer);
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

async function withSocketServer(handler) {
  const simulationId = 'sim_mod3_001';
  const repo = new MockSimulationRepository();

  repo.putFrames(simulationId, [
    { frameId: 'f0', simulationId, frameIndex: 0, simTime: 0, status: 'running', environment: { zones: [] }, agents: [], specialEntities: [], events: [], statistics: { totalEvacuated: 0, inWaterDeep: 0, avgExposureTime: 0, casualtyCount: 0 }, ext: {} },
    { frameId: 'f1', simulationId, frameIndex: 1, simTime: 1, status: 'running', environment: { zones: [] }, agents: [], specialEntities: [], events: [], statistics: { totalEvacuated: 0, inWaterDeep: 0, avgExposureTime: 0, casualtyCount: 0 }, ext: {} },
    { frameId: 'f2', simulationId, frameIndex: 2, simTime: 2, status: 'running', environment: { zones: [] }, agents: [], specialEntities: [], events: [], statistics: { totalEvacuated: 0, inWaterDeep: 0, avgExposureTime: 0, casualtyCount: 0 }, ext: {} },
    { frameId: 'f3', simulationId, frameIndex: 3, simTime: 3, status: 'running', environment: { zones: [] }, agents: [], specialEntities: [], events: [], statistics: { totalEvacuated: 0, inWaterDeep: 0, avgExposureTime: 0, casualtyCount: 0 }, ext: {} }
  ]);

  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  const dispatcher = createDispatcher({
    io,
    simulationRepo: repo,
    tickMs: 250,
    version: '1.0'
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;

  const client = createClient(url, {
    transports: ['websocket'],
    reconnection: false
  });

  await onceEvent(client, 'connect');
  const subscribeAck = onceEvent(client, 'Ack', 2000, (payload) => payload.requestId === 'req-sub');
  const subscribeState = onceEvent(client, 'SimState', 2000, (payload) => payload.requestId === 'req-sub');
  client.emit('subscribe', { simulationId, requestId: 'req-sub' });
  await subscribeAck;
  await subscribeState;

  try {
    await handler({ client, simulationId, url });
  } finally {
    client.close();
    dispatcher.stop();
    await new Promise((resolve) => io.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  }
}

async function subscribeClient(client, simulationId, requestId, clientRole = 'frontend') {
  const subscribeAck = onceEvent(client, 'Ack', 2000, (payload) => payload.requestId === requestId);
  const subscribeState = onceEvent(client, 'SimState', 2000, (payload) => payload.requestId === requestId);
  client.emit('subscribe', { simulationId, requestId, clientRole });
  await subscribeAck;
  await subscribeState;
}

function controlEnvelope(simulationId, requestId, action, extraPayload = {}) {
  return {
    version: '1.0',
    requestId,
    simulationId,
    messageType: 'ControlCommand',
    sentAt: Date.now(),
    payload: {
      action,
      ...extraPayload
    }
  };
}

test('module3 case1: 2x speed with 1s approx progress in 1s wall time', async () => {
  await withSocketServer(async ({ client, simulationId }) => {
    let latestState = null;
    client.on('SimState', (payload) => {
      latestState = payload;
    });

    const setSpeedAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-speed');
    client.emit('setSpeed', controlEnvelope(simulationId, 'req-speed', 'setSpeed', { speed: 2 }));
    await setSpeedAck;

    const playAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-play');
    client.emit('play', controlEnvelope(simulationId, 'req-play', 'play'));
    await playAck;

    await wait(1200);

    const state = latestState;
    assert.equal(state.messageType, 'SimState');
    assert.equal(state.payload.playbackSpeed, 2);
    assert.ok(state.payload.currentTime >= 1.75);
  });
});

test('module3 case2: seek receives nearby frame within one tick', async () => {
  await withSocketServer(async ({ client, simulationId }) => {
    const framePromise = onceEvent(client, 'UpdateFrame', 1500, (payload) => payload.requestId === 'req-seek');
    client.emit('seek', controlEnvelope(simulationId, 'req-seek', 'seek', { targetTime: 2.6 }));

    const frameEnvelope = await framePromise;
    assert.equal(frameEnvelope.messageType, 'FrameSnapshot');
    assert.equal(frameEnvelope.payload.frameIndex, 2);
    assert.equal(frameEnvelope.payload.simTime, 2);
  });
});

test('module3 case3: pause stops currentTime growth', async () => {
  await withSocketServer(async ({ client, simulationId }) => {
    let latestState = null;
    client.on('SimState', (payload) => {
      latestState = payload;
    });

    const playAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-play-2');
    client.emit('play', controlEnvelope(simulationId, 'req-play-2', 'play'));
    await playAck;

    await wait(700);
    const beforePause = latestState && latestState.payload && latestState.payload.currentTime;

    const pauseAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-pause');
    client.emit('pause', controlEnvelope(simulationId, 'req-pause', 'pause'));
    await pauseAck;

    await wait(700);
    const state = latestState;
    const afterPause = state && state.payload && state.payload.currentTime;

    assert.equal(state.payload.state, 'paused');
    assert.ok(afterPause <= beforePause);
  });
});

test('module3 patch case: duplicate actions are compiled once and executed once', async () => {
  await withSocketServer(async ({ client, simulationId }) => {
    const executed = [];
    client.on('PlanCommand', (payload) => {
      if (payload && payload.payload && payload.payload.sourceType) {
        executed.push(payload.payload);
      }
    });

    const planCommandAck = onceEvent(
      client,
      'Ack',
      2000,
      (payload) => payload.requestId === 'req-plan'
    );

    client.emit('PlanCommand', {
      version: '1.0',
      requestId: 'req-plan',
      simulationId,
      messageType: 'PlanCommand',
      sentAt: Date.now(),
      payload: {
        planConfig: {
          fromSimTime: 0,
          initConfigLike: {
            specialEntities: [
              {
                entityId: 'staff_fire_01',
                entityType: 'staffFire',
                triggerAt: 1,
                config: {
                  moveTarget: [1080, -460, 10],
                  onArriveAction: 'extinguish'
                }
              }
            ]
          },
          planRuntime: {
            actions: [
              {
                actionId: 'act_01',
                startAt: 1,
                targetId: 'staff_fire_01',
                action: 'dispatchTo',
                params: {
                  moveTarget: [1080, -460, 10]
                }
              },
              {
                actionId: 'act_02',
                startAt: 1,
                targetId: 'staff_fire_01',
                action: 'dispatchTo',
                params: {
                  moveTarget: [1080, -460, 10]
                }
              }
            ]
          }
        }
      }
    });

    const ack = await planCommandAck;
    assert.equal(ack.payload.compiledActionCount, 1);
    assert.equal(ack.payload.acceptedActionCount, 1);
    assert.equal(ack.payload.dedupedActionCount, 0);

    const playAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-play-3');
    client.emit('play', controlEnvelope(simulationId, 'req-play-3', 'play'));
    await playAck;

    await wait(1400);
    assert.equal(executed.length, 1);
    assert.equal(executed[0].targetId, 'staff_fire_01');
    assert.equal(executed[0].action, 'dispatchTo');
  });
});

test('module3 patch case: ControlCamera is routed only to ue role client', async () => {
  await withSocketServer(async ({ client, simulationId, url }) => {
    const ueClient = createClient(url, {
      transports: ['websocket'],
      reconnection: false,
      query: {
        simulationId,
        clientRole: 'ue'
      }
    });

    const frontendPeer = createClient(url, {
      transports: ['websocket'],
      reconnection: false
    });

    await onceEvent(ueClient, 'connect');
    await onceEvent(frontendPeer, 'connect');

    await subscribeClient(ueClient, simulationId, 'req-sub-ue', 'ue');
    await subscribeClient(frontendPeer, simulationId, 'req-sub-fe', 'frontend');

    let frontendReceivedControlCamera = false;
    frontendPeer.on('ControlCamera', () => {
      frontendReceivedControlCamera = true;
    });

    try {
      const ueCommand = onceEvent(ueClient, 'ControlCamera', 1500, (payload) => payload.requestId === 'req-camera');
      const senderAck = onceEvent(client, 'Ack', 1500, (payload) => payload.requestId === 'req-camera');

      client.emit('ControlCamera', {
        version: '1.0',
        requestId: 'req-camera',
        simulationId,
        messageType: 'ControlCommand',
        sentAt: Date.now(),
        payload: {
          cameraCommand: {
            action: 'orbit',
            yawDelta: 5
          }
        }
      });

      const [ueEnvelope] = await Promise.all([ueCommand, senderAck]);
      assert.equal(ueEnvelope.messageType, 'ControlCommand');
      assert.equal(ueEnvelope.payload.cameraCommand.action, 'orbit');

      await wait(200);
      assert.equal(frontendReceivedControlCamera, false);
    } finally {
      ueClient.close();
      frontendPeer.close();
    }
  });
});
