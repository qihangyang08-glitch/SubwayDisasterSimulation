const { io } = require('socket.io-client');

const middlewareUrl = process.env.MIDDLEWARE_SOCKET_URL || 'http://127.0.0.1:3100';
const simulationId = process.env.SIMULATION_ID || '';
const autoPlay = String(process.env.MOCK_UE_AUTO_PLAY || '0') === '1';

if (!simulationId) {
  console.error('[MockUE] missing SIMULATION_ID');
  process.exit(1);
}

function getEnvelopePayload(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }
  return envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : null;
}

const socket = io(middlewareUrl, {
  transports: ['websocket'],
  query: {
    simulationId,
    clientRole: 'ue'
  }
});

socket.on('connect', () => {
  console.log(`[MockUE] connected to ${middlewareUrl}`);
  socket.emit('subscribe', {
    simulationId,
    requestId: `mock-ue-sub-${Date.now()}`,
    clientRole: 'ue'
  });

  if (autoPlay) {
    setTimeout(() => {
      socket.emit('play', {
        version: '1.0',
        requestId: `mock-ue-play-${Date.now()}`,
        simulationId,
        messageType: 'ControlCommand',
        sentAt: Date.now(),
        payload: {
          action: 'play'
        }
      });
    }, 200);
  }
});

socket.on('disconnect', (reason) => {
  console.log(`[MockUE] disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error('[MockUE] connect error:', error.message);
});

socket.on('Ack', (envelope) => {
  const payload = getEnvelopePayload(envelope);
  console.log(`[MockUE] Ack requestId=${envelope && envelope.requestId ? envelope.requestId : '-'} status=${payload && payload.status ? payload.status : 'unknown'}`);
});

socket.on('SimState', (envelope) => {
  const payload = getEnvelopePayload(envelope) || {};
  console.log(`[MockUE] SimState state=${payload.state || '-'} time=${payload.currentTime}`);
});

socket.on('UpdateFrame', (envelope) => {
  const frame = getEnvelopePayload(envelope) || {};
  console.log(`[MockUE] UpdateFrame frameIndex=${frame.frameIndex} simTime=${frame.simTime} status=${frame.status || '-'}`);
});

socket.on('ControlCamera', (envelope) => {
  const payload = getEnvelopePayload(envelope) || {};
  console.log(`[MockUE] ControlCamera payload=${JSON.stringify(payload)}`);
});

socket.on('PlanCommand', (envelope) => {
  const payload = getEnvelopePayload(envelope) || {};
  console.log(`[MockUE] PlanCommand actionId=${payload.actionId || '-'} targetId=${payload.targetId || '-'}`);
});
