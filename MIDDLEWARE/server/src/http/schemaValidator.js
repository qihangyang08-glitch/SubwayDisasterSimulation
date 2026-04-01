const Ajv = require('ajv');
const { validateInitConfig, validateFrameSnapshot, validatePlanConfig } = require('../validators');
const { HttpError } = require('./errors');

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  removeAdditional: false
});

const createSimulationSchema = {
  type: 'object',
  required: ['scenarioId', 'mapLevel', 'totalPeople'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    mapLevel: { type: 'string', minLength: 1 },
    totalPeople: { type: 'number', exclusiveMinimum: 0 },
    disasters: { type: 'object' },
    specialEntities: { type: 'array' },
    ext: { type: 'object' }
  }
};

const insertFramesSchema = {
  type: 'object',
  required: ['frames'],
  properties: {
    frames: {
      type: 'array',
      minItems: 1,
      items: { type: 'object' }
    }
  }
};

const createPlanSchema = {
  type: 'object',
  required: ['fromSimulationId', 'fromSimTime', 'planSource'],
  properties: {
    planId: { type: 'string' },
    fromSimulationId: { type: 'string', minLength: 1 },
    fromSimTime: { type: 'number', minimum: 0 },
    planSource: { type: 'string', minLength: 1 },
    initConfigLike: { type: 'object' },
    planRuntime: { type: 'object' },
    expectedMetrics: { type: 'object' },
    ext: { type: 'object' }
  }
};

const applyPlanSchema = {
  type: 'object',
  properties: {
    fromSimTime: { type: 'number', minimum: 0 }
  },
  additionalProperties: false
};

const dispatchPlanSchema = {
  type: 'object',
  properties: {
    simulationId: { type: 'string', minLength: 1 },
    newSimulationId: { type: 'string', minLength: 1 }
  },
  additionalProperties: false,
  anyOf: [
    { required: ['simulationId'] },
    { required: ['newSimulationId'] }
  ]
};

const validators = {
  createSimulation: ajv.compile(createSimulationSchema),
  insertFrames: ajv.compile(insertFramesSchema),
  createPlan: ajv.compile(createPlanSchema),
  applyPlan: ajv.compile(applyPlanSchema),
  dispatchPlan: ajv.compile(dispatchPlanSchema)
};

function formatAjvErrors(errors) {
  return (errors || []).map((item) => {
    const path = item.instancePath || '/';
    return `${path} ${item.message}`.trim();
  });
}

function assertBySchema(name, payload) {
  const validate = validators[name];
  if (!validate(payload)) {
    throw new HttpError(400, 'BAD_REQUEST', `invalid request body for ${name}`, {
      errors: formatAjvErrors(validate.errors)
    });
  }
}

function validateCreateSimulationBody(body) {
  assertBySchema('createSimulation', body);
  validateInitConfig(body);
}

function validateInsertFramesBody(body) {
  assertBySchema('insertFrames', body);
  body.frames.forEach(validateFrameSnapshot);
}

function validateCreatePlanBody(body) {
  assertBySchema('createPlan', body);
  validatePlanConfig(body);
}

function validateApplyPlanBody(body) {
  const safeBody = body || {};
  assertBySchema('applyPlan', safeBody);
  return safeBody;
}

function validateDispatchPlanBody(body) {
  const safeBody = body || {};
  assertBySchema('dispatchPlan', safeBody);
  return safeBody;
}

module.exports = {
  validateCreateSimulationBody,
  validateInsertFramesBody,
  validateCreatePlanBody,
  validateApplyPlanBody,
  validateDispatchPlanBody
};
