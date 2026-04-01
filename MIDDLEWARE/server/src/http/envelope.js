function createEnvelope({
  version = '1.0',
  requestId,
  simulationId = '',
  messageType,
  payload
}) {
  return {
    version,
    requestId,
    simulationId,
    messageType,
    sentAt: Date.now(),
    payload
  };
}

module.exports = {
  createEnvelope
};
