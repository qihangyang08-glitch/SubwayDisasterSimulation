const { createEnvelope } = require('../http/envelope');
const { compileActionQueue } = require('../plan/actionCompiler');

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareFrames(a, b) {
  const simTimeA = toFiniteNumber(a && a.simTime) ?? Number.NEGATIVE_INFINITY;
  const simTimeB = toFiniteNumber(b && b.simTime) ?? Number.NEGATIVE_INFINITY;
  if (simTimeA !== simTimeB) {
    return simTimeA - simTimeB;
  }

  const indexA = toFiniteNumber(a && a.frameIndex) ?? Number.NEGATIVE_INFINITY;
  const indexB = toFiniteNumber(b && b.frameIndex) ?? Number.NEGATIVE_INFINITY;
  return indexA - indexB;
}

function nowRequestId() {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createDispatcher(options = {}) {
  const io = options.io;
  const simulationRepo = options.simulationRepo;

  if (!io) {
    throw new Error('createDispatcher requires io');
  }
  if (!simulationRepo) {
    throw new Error('createDispatcher requires simulationRepo');
  }

  const version = options.version || process.env.API_VERSION || '1.0';
  const tickMs = Number(options.tickMs || process.env.SOCKET_TICK_MS || 1000);
  const sessions = new Map();

  function roomName(simulationId) {
    return `simulation:${simulationId}`;
  }

  function buildEnvelope(simulationId, messageType, payload, requestId) {
    return createEnvelope({
      version,
      requestId: requestId || nowRequestId(),
      simulationId,
      messageType,
      payload
    });
  }

  function emitAck(socket, simulationId, requestId, payload) {
    socket.emit('Ack', buildEnvelope(simulationId, 'Ack', payload, requestId));
  }

  function clampCurrentTime(session, value) {
    let clamped = value;
    if (isFiniteNumber(session.minSimTime)) {
      clamped = Math.max(clamped, session.minSimTime);
    }
    if (isFiniteNumber(session.maxSimTime)) {
      clamped = Math.min(clamped, session.maxSimTime);
    }
    return clamped;
  }

  async function ensureSession(simulationId) {
    let session = sessions.get(simulationId);
    if (!session) {
      session = {
        simulationId,
        state: 'paused',
        currentTime: 0,
        playbackSpeed: 1,
        minSimTime: null,
        maxSimTime: null,
        lastFrame: null,
        compiledActions: [],
        queuedActionKeys: new Set(),
        executedActionKeys: new Set(),
        initPromise: null,
        tickInFlight: false,
        connectedSockets: new Set()  // BUG-002 FIX: Track connected sockets
      };
      sessions.set(simulationId, session);
    }

    if (!session.initPromise) {
      session.initPromise = (async () => {
        const range = await simulationRepo.getSimulationTimeRange(simulationId);
        session.minSimTime = toFiniteNumber(range && range.minSimTime);
        session.maxSimTime = toFiniteNumber(range && range.maxSimTime);

        if (isFiniteNumber(session.minSimTime)) {
          session.currentTime = session.minSimTime;
        }
      })();
    }

    await session.initPromise;
    return session;
  }

  function emitSimState(session, requestId) {
    io.to(roomName(session.simulationId)).emit(
      'SimState',
      buildEnvelope(
        session.simulationId,
        'SimState',
        {
          state: session.state,
          currentTime: session.currentTime,
          playbackSpeed: session.playbackSpeed
        },
        requestId
      )
    );
  }

  function emitFrame(session, frame, requestId) {
    if (!frame) {
      return false;
    }

    if (session.lastFrame && compareFrames(frame, session.lastFrame) <= 0) {
      return false;
    }

    session.lastFrame = frame;
    const frameTime = toFiniteNumber(frame.simTime);
    if (isFiniteNumber(frameTime)) {
      session.currentTime = clampCurrentTime(session, frameTime);
    }

    io.to(roomName(session.simulationId)).emit(
      'UpdateFrame',
      buildEnvelope(session.simulationId, 'FrameSnapshot', frame, requestId)
    );
    return true;
  }

  async function publishNearestFrame(session, requestId, socketForWarning) {
    const frame = await simulationRepo.getFrameByTime(session.simulationId, session.currentTime);
    if (!frame) {
      if (socketForWarning) {
        emitAck(socketForWarning, session.simulationId, requestId, {
          status: 'warning',
          code: 'FRAME_NOT_FOUND',
          currentTime: session.currentTime
        });
      }
      return false;
    }

    return emitFrame(session, frame, requestId);
  }

  function enqueueCompiledActions(session, actions) {
    let acceptedCount = 0;
    actions.forEach((item) => {
      if (session.executedActionKeys.has(item.dedupeKey)) {
        return;
      }
      if (session.queuedActionKeys.has(item.dedupeKey)) {
        return;
      }

      session.compiledActions.push(item);
      session.queuedActionKeys.add(item.dedupeKey);
      acceptedCount += 1;
    });

    session.compiledActions.sort((a, b) => {
      if (a.triggerTime !== b.triggerTime) {
        return a.triggerTime - b.triggerTime;
      }
      return String(a.actionId).localeCompare(String(b.actionId));
    });

    return acceptedCount;
  }

  async function dispatchPlanCommand(input = {}) {
    const simulationId = String(input.simulationId || '');
    if (!simulationId) {
      const error = new Error('simulationId is required');
      error.code = 'BAD_COMMAND';
      throw error;
    }

    const requestId = input.requestId || nowRequestId();
    const session = await ensureSession(simulationId);

    let compiledActions;
    try {
      const compileSource = (input.payload && input.payload.planConfig) || input.payload || {};
      compiledActions = compileActionQueue(compileSource);
    } catch (error) {
      const compileError = new Error(error.message || 'plan action compile failed');
      compileError.code = 'COMPILE_FAILED';
      throw compileError;
    }

    const acceptedActionCount = enqueueCompiledActions(session, compiledActions);
    const dedupedActionCount = compiledActions.length - acceptedActionCount;

    io.to(roomName(simulationId)).emit(
      'PlanCommand',
      buildEnvelope(simulationId, 'PlanCommand', input.payload || {}, requestId)
    );

    return {
      status: 'ok',
      action: 'PlanCommand',
      requestId,
      simulationId,
      compiledActionCount: compiledActions.length,
      acceptedActionCount,
      dedupedActionCount
    };
  }

  function executeDueActions(session) {
    let executedCount = 0;

    while (session.compiledActions.length > 0) {
      const nextAction = session.compiledActions[0];
      if (nextAction.triggerTime > session.currentTime) {
        break;
      }

      session.compiledActions.shift();
      session.queuedActionKeys.delete(nextAction.dedupeKey);

      if (session.executedActionKeys.has(nextAction.dedupeKey)) {
        continue;
      }
      session.executedActionKeys.add(nextAction.dedupeKey);

      io.to(roomName(session.simulationId)).emit(
        'PlanCommand',
        buildEnvelope(
          session.simulationId,
          'PlanCommand',
          {
            actionId: nextAction.actionId,
            triggerTime: nextAction.triggerTime,
            targetId: nextAction.targetId,
            action: nextAction.action,
            params: nextAction.params,
            sourceType: nextAction.sourceType
          },
          nowRequestId()
        )
      );
      executedCount += 1;
    }

    return executedCount;
  }

  function resolveSimulationId(socket, envelope) {
    if (envelope && envelope.simulationId) {
      return String(envelope.simulationId);
    }
    if (socket.data && socket.data.simulationId) {
      return String(socket.data.simulationId);
    }
    return '';
  }

  async function subscribeSimulation(socket, simulationId, requestId, clientRole) {
    if (!simulationId) {
      emitAck(socket, '', requestId, {
        status: 'error',
        code: 'BAD_SUBSCRIBE',
        message: 'simulationId is required'
      });
      return;
    }

    const session = await ensureSession(simulationId);
    socket.data.simulationId = simulationId;
    // BUG-003 FIX: Store client role (frontend/ue) for command routing
    socket.data.clientRole = clientRole || 'frontend';
    socket.join(roomName(simulationId));

    // BUG-002 FIX: Track socket in session
    session.connectedSockets.add(socket.id);
    console.log(`[Dispatcher] Socket ${socket.id} subscribed to ${simulationId} (role: ${socket.data.clientRole}, total clients: ${session.connectedSockets.size})`);

    await publishNearestFrame(session, requestId, socket);
    emitSimState(session, requestId);
    emitAck(socket, simulationId, requestId, {
      status: 'ok',
      action: 'subscribe',
      clientRole: socket.data.clientRole
    });
  }

  async function onPlay(socket, envelope) {
    const requestId = (envelope && envelope.requestId) || nowRequestId();
    const simulationId = resolveSimulationId(socket, envelope);
    const session = await ensureSession(simulationId);

    session.state = 'playing';
    console.log(`[Dispatcher] Session ${simulationId} state changed: paused → playing (currentTime: ${session.currentTime}s)`);
    emitSimState(session, requestId);
    emitAck(socket, simulationId, requestId, {
      status: 'ok',
      action: 'play'
    });
  }

  async function onPause(socket, envelope) {
    const requestId = (envelope && envelope.requestId) || nowRequestId();
    const simulationId = resolveSimulationId(socket, envelope);
    const session = await ensureSession(simulationId);

    session.state = 'paused';
    console.log(`[Dispatcher] Session ${simulationId} state changed: playing → paused (currentTime: ${session.currentTime}s)`);
    emitSimState(session, requestId);
    emitAck(socket, simulationId, requestId, {
      status: 'ok',
      action: 'pause'
    });
  }

  async function onSeek(socket, envelope) {
    const requestId = (envelope && envelope.requestId) || nowRequestId();
    const simulationId = resolveSimulationId(socket, envelope);
    const session = await ensureSession(simulationId);

    const targetTime = toFiniteNumber(envelope && envelope.payload && envelope.payload.targetTime);
    if (!isFiniteNumber(targetTime)) {
      emitAck(socket, simulationId, requestId, {
        status: 'error',
        code: 'BAD_COMMAND',
        message: 'seek targetTime must be a finite number'
      });
      return;
    }

    session.currentTime = clampCurrentTime(session, targetTime);
    await publishNearestFrame(session, requestId, socket);
    executeDueActions(session);
    emitSimState(session, requestId);
    emitAck(socket, simulationId, requestId, {
      status: 'ok',
      action: 'seek',
      currentTime: session.currentTime
    });
  }

  async function onSetSpeed(socket, envelope) {
    const requestId = (envelope && envelope.requestId) || nowRequestId();
    const simulationId = resolveSimulationId(socket, envelope);
    const session = await ensureSession(simulationId);

    const speed = toFiniteNumber(envelope && envelope.payload && envelope.payload.speed);
    if (!isFiniteNumber(speed) || speed < 0) {
      emitAck(socket, simulationId, requestId, {
        status: 'error',
        code: 'BAD_COMMAND',
        message: 'setSpeed speed must be a non-negative finite number'
      });
      return;
    }

    session.playbackSpeed = speed;
    emitSimState(session, requestId);
    emitAck(socket, simulationId, requestId, {
      status: 'ok',
      action: 'setSpeed',
      playbackSpeed: speed
    });
  }

  async function withControlValidation(socket, envelope, expectedAction, handler) {
    const requestId = (envelope && envelope.requestId) || nowRequestId();

    if (!envelope || envelope.messageType !== 'ControlCommand') {
      emitAck(socket, resolveSimulationId(socket, envelope), requestId, {
        status: 'error',
        code: 'BAD_COMMAND',
        message: 'messageType must be ControlCommand'
      });
      return;
    }

    const action = envelope && envelope.payload && envelope.payload.action;
    if (expectedAction && action && action !== expectedAction) {
      emitAck(socket, resolveSimulationId(socket, envelope), requestId, {
        status: 'error',
        code: 'BAD_COMMAND',
        message: `payload.action must be ${expectedAction}`
      });
      return;
    }

    const simulationId = resolveSimulationId(socket, envelope);
    if (!simulationId) {
      emitAck(socket, '', requestId, {
        status: 'error',
        code: 'BAD_COMMAND',
        message: 'simulationId is required'
      });
      return;
    }

    socket.data.simulationId = simulationId;
    socket.join(roomName(simulationId));

    try {
      await handler(socket, envelope);
    } catch (error) {
      emitAck(socket, simulationId, requestId, {
        status: 'error',
        code: error.code || 'DISPATCH_ERROR',
        message: error.message || 'dispatcher error'
      });
    }
  }

  io.on('connection', (socket) => {
    const handshakeSimulationId = socket.handshake && socket.handshake.query && socket.handshake.query.simulationId;
    const handshakeClientRole = socket.handshake && socket.handshake.query && socket.handshake.query.clientRole;
    if (handshakeSimulationId) {
      subscribeSimulation(socket, String(handshakeSimulationId), nowRequestId(), handshakeClientRole).catch(() => {});
    }

    socket.on('subscribe', async (payload = {}) => {
      const simulationId = String(payload.simulationId || '');
      const requestId = String(payload.requestId || nowRequestId());
      const clientRole = String(payload.clientRole || 'frontend'); // BUG-003 FIX: Accept clientRole
      try {
        await subscribeSimulation(socket, simulationId, requestId, clientRole);
      } catch (error) {
        emitAck(socket, simulationId, requestId, {
          status: 'error',
          code: error.code || 'SUBSCRIBE_ERROR',
          message: error.message || 'subscribe error'
        });
      }
    });

    socket.on('play', async (envelope) => {
      await withControlValidation(socket, envelope, 'play', onPlay);
    });

    socket.on('pause', async (envelope) => {
      await withControlValidation(socket, envelope, 'pause', onPause);
    });

    socket.on('seek', async (envelope) => {
      await withControlValidation(socket, envelope, 'seek', onSeek);
    });

    socket.on('setSpeed', async (envelope) => {
      await withControlValidation(socket, envelope, 'setSpeed', onSetSpeed);
    });

    socket.on('ControlCamera', async (envelope = {}) => {
      const requestId = envelope.requestId || nowRequestId();
      const simulationId = resolveSimulationId(socket, envelope);
      if (!simulationId) {
        emitAck(socket, '', requestId, {
          status: 'error',
          code: 'BAD_COMMAND',
          message: 'simulationId is required'
        });
        return;
      }

      socket.data.simulationId = simulationId;
      socket.join(roomName(simulationId));

      // BUG-003 FIX: Only send to UE clients, not frontend
      const room = io.sockets.adapter.rooms.get(roomName(simulationId));
      if (room) {
        const commandEnvelope = buildEnvelope(simulationId, 'ControlCommand', envelope.payload || {}, requestId);
        let ueCount = 0;
        let totalCount = room.size;
        
        for (const socketId of room) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket && targetSocket.data.clientRole === 'ue') {
            targetSocket.emit('ControlCamera', commandEnvelope);
            ueCount++;
          }
        }
        
        console.log(`[Dispatcher] ControlCamera forwarded to ${ueCount} UE clients (filtered ${totalCount - ueCount} non-UE clients)`);
      }

      emitAck(socket, simulationId, requestId, {
        status: 'ok',
        action: 'ControlCamera'
      });
    });

    socket.on('PlanCommand', async (envelope = {}) => {
      const requestId = envelope.requestId || nowRequestId();
      const simulationId = resolveSimulationId(socket, envelope);
      if (!simulationId) {
        emitAck(socket, '', requestId, {
          status: 'error',
          code: 'BAD_COMMAND',
          message: 'simulationId is required'
        });
        return;
      }

      socket.data.simulationId = simulationId;
      socket.join(roomName(simulationId));
      try {
        const dispatchResult = await dispatchPlanCommand({
          simulationId,
          payload: envelope.payload || {},
          requestId
        });

        emitAck(socket, simulationId, requestId, {
          status: dispatchResult.status,
          action: dispatchResult.action,
          compiledActionCount: dispatchResult.compiledActionCount,
          acceptedActionCount: dispatchResult.acceptedActionCount,
          dedupedActionCount: dispatchResult.dedupedActionCount
        });
      } catch (error) {
        emitAck(socket, simulationId, requestId, {
          status: 'error',
          code: error.code || 'COMPILE_FAILED',
          message: error.message || 'plan action compile failed'
        });
      }
    });

    // BUG-002 FIX: Clean up session on disconnect to prevent memory leak
    socket.on('disconnect', () => {
      const simulationId = socket.data && socket.data.simulationId;
      if (simulationId) {
        const session = sessions.get(simulationId);
        if (session) {
          // Remove socket from session
          session.connectedSockets.delete(socket.id);
          
          // If no more clients connected to this simulation, clean up the session
          if (session.connectedSockets.size === 0) {
            // Pause playback
            if (session.state === 'playing') {
              session.state = 'paused';
            }
            
            // Clean up session data to free memory
            session.compiledActions = [];
            session.queuedActionKeys.clear();
            session.executedActionKeys.clear();
            session.lastFrame = null;
            
            // Remove from sessions map
            sessions.delete(simulationId);
            console.log(`[Dispatcher] Session ${simulationId} cleaned up (no more clients)`);
          } else {
            console.log(`[Dispatcher] Socket ${socket.id} disconnected from simulation ${simulationId} (${session.connectedSockets.size} clients remaining)`);
          }
        }
      }
    });
  });

  const timer = setInterval(async () => {
    const deltaT = tickMs / 1000;

    for (const session of sessions.values()) {
      if (session.state !== 'playing') {
        continue;
      }
      if (session.tickInFlight) {
        continue;
      }

      session.tickInFlight = true;
      try {
        session.currentTime = clampCurrentTime(
          session,
          session.currentTime + deltaT * session.playbackSpeed
        );

        await publishNearestFrame(session, nowRequestId());
        executeDueActions(session);

        if (isFiniteNumber(session.maxSimTime) && session.currentTime >= session.maxSimTime) {
          session.state = 'paused';
        }

        emitSimState(session, nowRequestId());
      } catch (error) {
        session.state = 'paused';
        io.to(roomName(session.simulationId)).emit(
          'Ack',
          buildEnvelope(session.simulationId, 'Ack', {
            status: 'warning',
            code: error.code || 'TICK_ERROR',
            message: error.message || 'tick dispatcher failed'
          })
        );
        emitSimState(session, nowRequestId());
      } finally {
        session.tickInFlight = false;
      }
    }
  }, tickMs);

  function stop() {
    clearInterval(timer);
  }

  return {
    stop,
    dispatchPlanCommand,
    getSessionSnapshot(simulationId) {
      const session = sessions.get(simulationId);
      if (!session) {
        return null;
      }

      return {
        simulationId: session.simulationId,
        state: session.state,
        currentTime: session.currentTime,
        playbackSpeed: session.playbackSpeed,
        minSimTime: session.minSimTime,
        maxSimTime: session.maxSimTime
      };
    }
  };
}

module.exports = {
  createDispatcher
};
