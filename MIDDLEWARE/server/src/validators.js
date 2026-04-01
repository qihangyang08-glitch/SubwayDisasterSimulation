function createValidationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  return error;
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertProbability(value, fieldPath) {
  if (!isNumber(value) || value < 0 || value > 1) {
    throw createValidationError(`${fieldPath} must be a number in [0,1]`);
  }
}

function assertNonNegative(value, fieldPath) {
  if (!isNumber(value) || value < 0) {
    throw createValidationError(`${fieldPath} must be a non-negative number`);
  }
}

function validateSpecialEntitiesTriggerAt(specialEntities, pathPrefix, lowerBound) {
  if (!Array.isArray(specialEntities)) {
    return;
  }

  for (let i = 0; i < specialEntities.length; i += 1) {
    const entity = specialEntities[i] || {};
    const triggerPath = `${pathPrefix}[${i}].triggerAt`;
    if (!isNumber(entity.triggerAt)) {
      throw createValidationError(`${triggerPath} is required and must be a non-negative number`);
    }
    if (entity.triggerAt < 0) {
      throw createValidationError(`${triggerPath} must be >= 0`);
    }
    if (isNumber(lowerBound) && entity.triggerAt < lowerBound) {
      throw createValidationError(`${triggerPath} must be >= fromSimTime`);
    }

    const config = entity.config || {};
    if (isNumber(config.guideBoostProb)) {
      assertProbability(config.guideBoostProb, `${pathPrefix}[${i}].config.guideBoostProb`);
    }
  }
}

function validateInitConfig(initConfig) {
  if (!initConfig || typeof initConfig !== 'object') {
    throw createValidationError('initConfig must be an object');
  }
  if (!initConfig.scenarioId || !initConfig.mapLevel) {
    throw createValidationError('initConfig.scenarioId and initConfig.mapLevel are required');
  }
  if (!isNumber(initConfig.totalPeople) || initConfig.totalPeople <= 0) {
    throw createValidationError('initConfig.totalPeople must be > 0');
  }

  const disasters = initConfig.disasters || {};
  const fire = disasters.fire || {};
  const water = disasters.water || {};

  if (fire.enabled === false && Array.isArray(fire.sources) && fire.sources.length > 0) {
    throw createValidationError('fire.enabled=false requires fire.sources to be empty');
  }

  if (Array.isArray(water.inlets)) {
    for (let i = 0; i < water.inlets.length; i += 1) {
      const inlet = water.inlets[i];
      assertNonNegative(inlet.inflowRate, `disasters.water.inlets[${i}].inflowRate`);
      assertNonNegative(inlet.totalVolume, `disasters.water.inlets[${i}].totalVolume`);
      assertNonNegative(inlet.startAt, `disasters.water.inlets[${i}].startAt`);
      assertNonNegative(inlet.duration, `disasters.water.inlets[${i}].duration`);
    }
  }

  if (Array.isArray(fire.sources)) {
    for (let i = 0; i < fire.sources.length; i += 1) {
      const src = fire.sources[i];
      assertNonNegative(src.spreadSpeed, `disasters.fire.sources[${i}].spreadSpeed`);
      assertNonNegative(src.gasSpreadSpeed, `disasters.fire.sources[${i}].gasSpreadSpeed`);
      assertProbability(src.initialConcentration, `disasters.fire.sources[${i}].initialConcentration`);
      assertNonNegative(src.startAt, `disasters.fire.sources[${i}].startAt`);
    }
  }

  validateSpecialEntitiesTriggerAt(initConfig.specialEntities, 'specialEntities');
}

function validateFrameSnapshot(frame) {
  if (!frame || typeof frame !== 'object') {
    throw createValidationError('frameSnapshot must be an object');
  }
  if (!isNumber(frame.frameIndex) || frame.frameIndex < 0) {
    throw createValidationError('frameSnapshot.frameIndex must be a non-negative number');
  }
  if (!isNumber(frame.simTime) || frame.simTime < 0) {
    throw createValidationError('frameSnapshot.simTime must be a non-negative number');
  }

  const agentIds = new Set();
  const entityIds = new Set();

  if (Array.isArray(frame.agents)) {
    frame.agents.forEach((agent, index) => {
      if (!agent.agentId) {
        throw createValidationError(`agents[${index}].agentId is required`);
      }
      if (agentIds.has(agent.agentId)) {
        throw createValidationError(`duplicate agentId in a frame: ${agent.agentId}`);
      }
      agentIds.add(agent.agentId);
      if (agent.panicLevel !== undefined) {
        assertProbability(agent.panicLevel, `agents[${index}].panicLevel`);
      }
    });
  }

  if (Array.isArray(frame.specialEntities)) {
    frame.specialEntities.forEach((entity, index) => {
      if (!entity.entityId) {
        throw createValidationError(`specialEntities[${index}].entityId is required`);
      }
      if (entityIds.has(entity.entityId)) {
        throw createValidationError(`duplicate entityId in a frame: ${entity.entityId}`);
      }
      entityIds.add(entity.entityId);
    });
  }
}

function validatePlanConfig(planConfig) {
  if (!planConfig || typeof planConfig !== 'object') {
    throw createValidationError('planConfig must be an object');
  }
  if (!planConfig.fromSimulationId) {
    throw createValidationError('planConfig.fromSimulationId is required');
  }
  if (!isNumber(planConfig.fromSimTime) || planConfig.fromSimTime < 0) {
    throw createValidationError('planConfig.fromSimTime must be a non-negative number');
  }
  if (!planConfig.planSource) {
    throw createValidationError('planConfig.planSource is required');
  }

  if (!planConfig.initConfigLike || typeof planConfig.initConfigLike !== 'object') {
    throw createValidationError('planConfig.initConfigLike is required');
  }

  validateSpecialEntitiesTriggerAt(
    planConfig.initConfigLike.specialEntities,
    'initConfigLike.specialEntities',
    planConfig.fromSimTime
  );

  const actions = (((planConfig.planRuntime || {}).actions) || []);
  actions.forEach((action, index) => {
    if (!isNumber(action.startAt) || action.startAt < planConfig.fromSimTime) {
      throw createValidationError(
        `planRuntime.actions[${index}].startAt must be >= fromSimTime`
      );
    }
  });
}

module.exports = {
  validateInitConfig,
  validateFrameSnapshot,
  validatePlanConfig,
  createValidationError
};
