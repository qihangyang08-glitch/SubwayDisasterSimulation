const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const { SimulationRepository } = require('../repositories/simulationRepository');
const { PlanRepository } = require('../repositories/planRepository');
const { createEnvelope } = require('./envelope');
const { HttpError, notFound } = require('./errors');
const { IdempotencyStore } = require('./idempotencyStore');
// BUG-004 FIX: For multi-instance deployments, use DatabaseIdempotencyStore
// const { DatabaseIdempotencyStore } = require('./databaseIdempotencyStore');
const { compileActionQueue } = require('../plan/actionCompiler');
const {
  validateCreateSimulationBody,
  validateInsertFramesBody,
  validateCreatePlanBody,
  validateApplyPlanBody,
  validateDispatchPlanBody
} = require('./schemaValidator');

function createRequestId() {
  return `req-${crypto.randomUUID()}`;
}

function parseNumberOrThrow(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be a finite number`);
  }
  return parsed;
}

function hasDisasters(planBody) {
  return Boolean(
    planBody
      && planBody.initConfigLike
      && typeof planBody.initConfigLike === 'object'
      && planBody.initConfigLike.disasters
      && typeof planBody.initConfigLike.disasters === 'object'
  );
}

function createApp(options = {}) {
  const app = express();
  const simulationRepo = options.simulationRepo || new SimulationRepository(options.repositoryOptions);
  const planRepo = options.planRepo || new PlanRepository(options.repositoryOptions);
  const version = options.version || process.env.API_VERSION || '1.0';
  const getDbHealth = typeof options.getDbHealth === 'function'
    ? options.getDbHealth
    : () => ({ status: 'unknown' });
  
  // BUG-004 FIX: Idempotency store can be injected via options
  // For single-instance: new IdempotencyStore()
  // For multi-instance: new DatabaseIdempotencyStore() (see databaseIdempotencyStore.js)
  const idempotencyStore = options.idempotencyStore || new IdempotencyStore(options.idempotency);
  const retryQueue = options.retryQueue || [];
  const planDispatcher = options.planDispatcher || null;
  const simulationGateway = options.simulationGateway || null;
  const llmGateway = options.llmGateway || null;

  app.use(express.json({ limit: '2mb' }));

  const corsEnabled = String(options.corsEnabled ?? process.env.CORS_ENABLED ?? '1') === '1';
  if (corsEnabled) {
    app.use(
      cors({
        origin: options.corsOrigin || process.env.CORS_ORIGIN || '*'
      })
    );
  }

  const authEnabled = String(options.authEnabled ?? process.env.AUTH_ENABLED ?? '0') === '1';
  const authToken = options.authToken || process.env.AUTH_TOKEN || '';
  const frameIngestToken = options.frameIngestToken || process.env.FRAME_INGEST_TOKEN || '';
  const integrationApiToken = options.integrationApiToken || process.env.INTEGRATION_API_TOKEN || '';
  const debugHttp = String(options.debugHttp ?? process.env.DEBUG_HTTP ?? process.env.DEBUG ?? 'false').toLowerCase() === 'true';

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || req.query.requestId || (req.body && req.body.requestId) || createRequestId();
    res.locals.requestId = String(requestId);
    next();
  });

  if (debugHttp) {
    app.use((req, res, next) => {
      const startMs = Date.now();
      res.on('finish', () => {
        const durationMs = Date.now() - startMs;
        console.log(
          `[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms) requestId=${res.locals.requestId || '-'}`
        );
      });
      next();
    });
  }

  if (authEnabled) {
    app.use((req, res, next) => {
      const header = req.header('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!authToken || token !== authToken) {
        return next(new HttpError(401, 'UNAUTHORIZED', 'invalid or missing bearer token'));
      }
      return next();
    });
  }

  function setRequestScope(req) {
    app.set('lastRequestId', req.res.locals.requestId);
  }

  function idempotencyKey(req) {
    return `${req.method}:${req.originalUrl}:${req.res.locals.requestId}`;
  }

  async function withIdempotency(req, res, buildResponse) {
    if (req.method !== 'POST') {
      return buildResponse();
    }

    const key = idempotencyKey(req);
    const hit = await idempotencyStore.get(key);
    if (hit) {
      res.setHeader('x-idempotent-replay', '1');
      if (hit.headers) {
        Object.entries(hit.headers).forEach(([headerName, headerValue]) => {
          res.setHeader(headerName, headerValue);
        });
      }
      return res.status(hit.status).json(hit.body);
    }

    const built = await buildResponse();
    const send = (result) => {
      idempotencyStore.set(key, result).catch((error) => {
        console.error(`[Idempotency] Failed to persist key ${key}:`, error.message);
      });
      if (result.headers) {
        Object.entries(result.headers).forEach(([headerName, headerValue]) => {
          res.setHeader(headerName, headerValue);
        });
      }
      return res.status(result.status).json(result.body);
    };

    return send(built);
  }

  function asyncRoute(handler) {
    return async (req, res, next) => {
      try {
        setRequestScope(req);
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }

  function createTokenGuard(expectedToken, errorCode, errorMessage) {
    return (req, res, next) => {
      if (!expectedToken) {
        return next();
      }

      const headerToken = req.header('x-internal-token') || '';
      const bearer = req.header('authorization') || '';
      const bearerToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      const providedToken = headerToken || bearerToken;

      if (providedToken !== expectedToken) {
        return next(new HttpError(403, errorCode, errorMessage));
      }

      return next();
    };
  }

  function deprecationHeaders(aliasOf) {
    return {
      Deprecation: 'true',
      Link: `<${aliasOf}>; rel="successor-version"`,
      Warning: `299 - "Deprecated API, migrate to ${aliasOf}"`
    };
  }

  function ackEnvelope(req, simulationId, payload) {
    return createEnvelope({
      version,
      requestId: req.res.locals.requestId,
      simulationId,
      messageType: 'Ack',
      payload
    });
  }

  function errorEnvelope(req, simulationId, error) {
    return createEnvelope({
      version,
      requestId: req.res.locals.requestId,
      simulationId,
      messageType: 'Error',
      payload: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        details: error.details || null
      }
    });
  }

  app.get('/healthz', (req, res) => {
    const db = getDbHealth();
    const apiStatus = db.status === 'error' ? 'degraded' : 'ok';
    res.status(200).json(
      ackEnvelope(req, '', {
        status: apiStatus,
        db
      })
    );
  });

  app.post('/api/simulations', asyncRoute(async (req, res) => {
    validateCreateSimulationBody(req.body);

    return withIdempotency(req, res, async () => {
      const { simulationId } = await simulationRepo.createSimulation(req.body);
      return {
        status: 200,
        body: ackEnvelope(req, simulationId, { simulationId })
      };
    });
  }));

  app.post(
    '/api/simulations/:simId/frames',
    createTokenGuard(
      frameIngestToken,
      'FORBIDDEN_FRAME_WRITE',
      'missing or invalid token for frame ingestion endpoint'
    ),
    asyncRoute(async (req, res) => {
    validateInsertFramesBody(req.body);

    const simulationId = req.params.simId;
    const simulation = await simulationRepo.getSimulationById(simulationId);
    if (!simulation) {
      throw notFound('simulationId', simulationId);
    }

    return withIdempotency(req, res, async () => {
      const result = await simulationRepo.batchInsertFrames(simulationId, req.body.frames, {
        idempotencyMode: 'upsert'
      });

      return {
        status: 200,
        body: ackEnvelope(req, simulationId, {
          frameCount: result.frameCount,
          insertedOrAffectedRows: result.insertedOrAffectedRows,
          idempotencyMode: result.idempotencyMode
        })
      };
    });
    })
  );

  app.get('/api/simulations', asyncRoute(async (req, res) => {
    const simulations = await simulationRepo.listSimulations();
    res.status(200).json(ackEnvelope(req, '', { simulations }));
  }));

  app.get('/api/simulations/:simId/info', asyncRoute(async (req, res) => {
    const simulationId = req.params.simId;
    const simulation = await simulationRepo.getSimulationById(simulationId);
    if (!simulation) {
      throw notFound('simulationId', simulationId);
    }

    const range = await simulationRepo.getSimulationTimeRange(simulationId);
    res.status(200).json(
      ackEnvelope(req, simulationId, {
        minSimTime: range.minSimTime,
        maxSimTime: range.maxSimTime,
        status: simulation.status
      })
    );
  }));

  app.get('/api/simulations/:simId/frame', asyncRoute(async (req, res) => {
    if (req.query.time === undefined) {
      throw new HttpError(400, 'BAD_REQUEST', 'time query is required');
    }

    const simulationId = req.params.simId;
    const targetTime = parseNumberOrThrow(req.query.time, 'time');
    const frame = await simulationRepo.getFrameByTime(simulationId, targetTime);
    if (!frame) {
      throw notFound('frameByTime', `${simulationId}@${targetTime}`);
    }

    res.status(200).json(
      createEnvelope({
        version,
        requestId: req.res.locals.requestId,
        simulationId,
        messageType: 'FrameSnapshot',
        payload: frame
      })
    );
  }));

  app.get('/api/simulations/:simId/frame/:frameIndex', asyncRoute(async (req, res) => {
    const simulationId = req.params.simId;
    const frameIndex = parseNumberOrThrow(req.params.frameIndex, 'frameIndex');
    const frame = await simulationRepo.getFrameByIndex(simulationId, frameIndex);
    if (!frame) {
      throw notFound('frameIndex', `${simulationId}#${frameIndex}`);
    }

    res.status(200).json(
      createEnvelope({
        version,
        requestId: req.res.locals.requestId,
        simulationId,
        messageType: 'FrameSnapshot',
        payload: frame
      })
    );
  }));

  app.post('/api/plans', asyncRoute(async (req, res) => {
    validateCreatePlanBody(req.body);

    const fromSimulationId = req.body.fromSimulationId;
    const simulation = await simulationRepo.getSimulationById(fromSimulationId);
    if (!simulation) {
      throw notFound('fromSimulationId', fromSimulationId);
    }

    let inheritanceUsed = false;
    const normalizedBody = {
      ...req.body,
      initConfigLike: {
        ...(req.body.initConfigLike || {})
      }
    };

    if (!hasDisasters(normalizedBody)) {
      const baseInitConfig = await simulationRepo.getSimulationInitConfig(fromSimulationId);
      const baselineDisasters = baseInitConfig && baseInitConfig.disasters;
      if (!baselineDisasters || typeof baselineDisasters !== 'object') {
        throw new HttpError(
          404,
          'BASELINE_INHERITANCE_FAILED',
          `cannot inherit disasters from simulation: ${fromSimulationId}`
        );
      }
      normalizedBody.initConfigLike.disasters = baselineDisasters;
      inheritanceUsed = true;
    }

    const compiledActionCount = compileActionQueue(normalizedBody).length;

    return withIdempotency(req, res, async () => {
      const { planId } = await planRepo.createPlan(normalizedBody);
      return {
        status: 200,
        body: ackEnvelope(req, '', {
          planId,
          inheritanceUsed,
          compiledActionCount
        })
      };
    });
  }));

  app.post('/api/plans/:planId/apply', asyncRoute(async (req, res) => {
    const body = validateApplyPlanBody(req.body || {});
    const planId = req.params.planId;

    return withIdempotency(req, res, async () => {
      const plan = await planRepo.getPlanById(planId);
      if (!plan) {
        throw notFound('planId', planId);
      }

      const planConfig = plan.planConfig || {};
      const initConfigLike = planConfig.initConfigLike;
      if (!initConfigLike || typeof initConfigLike !== 'object') {
        throw new HttpError(422, 'UNPROCESSABLE_PLAN', 'planConfig.initConfigLike is required for apply');
      }

      const { simulationId: newSimulationId } = await simulationRepo.createSimulation(initConfigLike);
      let planRun;
      try {
        planRun = await planRepo.createPlanRun({
          baseSimulationId: plan.fromSimulationId,
          planId,
          newSimulationId
        });
      } catch (error) {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: error.code || 'PLAN_RUN_WRITE_FAILED',
          taskType: 'orphan_pending_cleanup',
          payload: {
            planId,
            baseSimulationId: plan.fromSimulationId,
            newSimulationId
          },
          createdAt: Date.now()
        });
        throw error;
      }

      return {
        status: 200,
        body: ackEnvelope(req, newSimulationId, {
          planRunId: planRun.planRunId,
          newSimulationId,
          fromSimTime: body.fromSimTime ?? plan.fromSimTime,
          compiledActionCount: compileActionQueue(planConfig).length
        })
      };
    });
  }));

  app.post('/api/plans/:planId/dispatch', asyncRoute(async (req, res) => {
    const body = validateDispatchPlanBody(req.body || {});
    const planId = req.params.planId;

    return withIdempotency(req, res, async () => {
      const plan = await planRepo.getPlanById(planId);
      if (!plan) {
        throw notFound('planId', planId);
      }

      const simulationId = String(body.newSimulationId || body.simulationId || '');
      const targetSimulation = await simulationRepo.getSimulationById(simulationId);
      if (!targetSimulation) {
        throw notFound('simulationId', simulationId);
      }

      const planConfig = plan.planConfig || {};
      const compiledActionCount = compileActionQueue(planConfig).length;

      if (!planDispatcher || typeof planDispatcher.dispatchPlanCommand !== 'function') {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: 'DISPATCHER_UNAVAILABLE',
          taskType: 'plan_dispatch',
          payload: {
            planId,
            simulationId,
            requestId: req.res.locals.requestId
          },
          createdAt: Date.now()
        });

        return {
          status: 202,
          body: ackEnvelope(req, simulationId, {
            status: 'pending',
            planId,
            simulationId,
            compiledActionCount,
            acceptedActionCount: 0,
            dedupedActionCount: compiledActionCount
          })
        };
      }

      try {
        const dispatchResult = await planDispatcher.dispatchPlanCommand({
          simulationId,
          requestId: req.res.locals.requestId,
          payload: {
            planId,
            planConfig
          }
        });

        return {
          status: 200,
          body: ackEnvelope(req, simulationId, {
            status: dispatchResult.status,
            planId,
            simulationId,
            compiledActionCount: dispatchResult.compiledActionCount,
            acceptedActionCount: dispatchResult.acceptedActionCount,
            dedupedActionCount: dispatchResult.dedupedActionCount
          })
        };
      } catch (error) {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: error.code || 'PLAN_DISPATCH_FAILED',
          taskType: 'plan_dispatch',
          payload: {
            planId,
            simulationId,
            requestId: req.res.locals.requestId
          },
          createdAt: Date.now()
        });

        return {
          status: 202,
          body: ackEnvelope(req, simulationId, {
            status: 'pending',
            planId,
            simulationId,
            compiledActionCount,
            acceptedActionCount: 0,
            dedupedActionCount: compiledActionCount,
            errorCode: error.code || 'PLAN_DISPATCH_FAILED'
          })
        };
      }
    });
  }));

  app.post(
    '/api/integration/backend/start',
    createTokenGuard(
      integrationApiToken,
      'FORBIDDEN_INTEGRATION_TRIGGER',
      'missing or invalid token for integration trigger endpoint'
    ),
    asyncRoute(async (req, res) => {
    if (!simulationGateway || typeof simulationGateway.startSimulation !== 'function') {
      throw new HttpError(503, 'SIM_ENGINE_UNAVAILABLE', 'simulation gateway is not configured');
    }

    const body = req.body || {};
    const simulationId = String(body.simulationId || '');
    if (!simulationId) {
      throw new HttpError(400, 'BAD_REQUEST', 'simulationId is required');
    }

    const simulation = await simulationRepo.getSimulationById(simulationId);
    if (!simulation) {
      throw notFound('simulationId', simulationId);
    }

    const initConfig = body.initConfig || await simulationRepo.getSimulationInitConfig(simulationId);
    if (!initConfig || typeof initConfig !== 'object') {
      throw new HttpError(422, 'UNPROCESSABLE_INIT_CONFIG', 'initConfig is required and must be an object');
    }

    validateCreateSimulationBody(initConfig);

    const upstreamResponse = await simulationGateway.startSimulation({
      requestId: req.res.locals.requestId,
      simulationId,
      initConfig,
      options: body.options || {}
    });

    res.status(200).json(
      ackEnvelope(req, simulationId, {
        status: 'accepted',
        simulationId,
        upstreamResponse
      })
    );
    })
  );

  app.post(
    '/api/integration/llm/plan',
    createTokenGuard(
      integrationApiToken,
      'FORBIDDEN_INTEGRATION_TRIGGER',
      'missing or invalid token for integration trigger endpoint'
    ),
    asyncRoute(async (req, res) => {
    if (!llmGateway || typeof llmGateway.generatePlan !== 'function') {
      throw new HttpError(503, 'LLM_SERVICE_UNAVAILABLE', 'llm gateway is not configured');
    }

    const body = req.body || {};
    const fromSimulationId = String(body.fromSimulationId || '');
    if (!fromSimulationId) {
      throw new HttpError(400, 'BAD_REQUEST', 'fromSimulationId is required');
    }

    const fromSimTime = parseNumberOrThrow(body.fromSimTime, 'fromSimTime');
    if (fromSimTime < 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'fromSimTime must be >= 0');
    }

    const simulation = await simulationRepo.getSimulationById(fromSimulationId);
    if (!simulation) {
      throw notFound('fromSimulationId', fromSimulationId);
    }

    const baseInitConfig = await simulationRepo.getSimulationInitConfig(fromSimulationId);

    const upstreamResponse = await llmGateway.generatePlan({
      requestId: req.res.locals.requestId,
      fromSimulationId,
      fromSimTime,
      objective: body.objective || '',
      context: body.context || {},
      initConfigLike: body.initConfigLike || baseInitConfig || {}
    });

    const planConfig = (upstreamResponse && upstreamResponse.planConfig) || upstreamResponse;
    validateCreatePlanBody(planConfig);

    const { planId } = await planRepo.createPlan(planConfig);
    const compiledActionCount = compileActionQueue(planConfig).length;

    res.status(200).json(
      ackEnvelope(req, '', {
        status: 'ok',
        planId,
        compiledActionCount,
        planConfig
      })
    );
    })
  );

  app.post('/api/init', asyncRoute(async (req, res) => {
    validateCreateSimulationBody(req.body);

    return withIdempotency(req, res, async () => {
      const { simulationId } = await simulationRepo.createSimulation(req.body);
      return {
        status: 200,
        headers: deprecationHeaders('/api/simulations'),
        body: ackEnvelope(req, simulationId, { simulationId })
      };
    });
  }));

  app.get('/api/sim/:simulationId/state', asyncRoute(async (req, res) => {
    const simulationId = req.params.simulationId;
    const simulation = await simulationRepo.getSimulationById(simulationId);
    if (!simulation) {
      throw notFound('simulationId', simulationId);
    }

    const range = await simulationRepo.getSimulationTimeRange(simulationId);
    Object.entries(deprecationHeaders(`/api/simulations/${simulationId}/info`)).forEach(([k, v]) => {
      res.setHeader(k, v);
    });
    res.status(200).json(
      ackEnvelope(req, simulationId, {
        minSimTime: range.minSimTime,
        maxSimTime: range.maxSimTime,
        status: simulation.status
      })
    );
  }));

  app.get('/api/frame/:simulationId/:frameIndex', asyncRoute(async (req, res) => {
    const simulationId = req.params.simulationId;
    const frameIndex = parseNumberOrThrow(req.params.frameIndex, 'frameIndex');
    const frame = await simulationRepo.getFrameByIndex(simulationId, frameIndex);
    if (!frame) {
      throw notFound('frameIndex', `${simulationId}#${frameIndex}`);
    }

    Object.entries(deprecationHeaders(`/api/simulations/${simulationId}/frame/${frameIndex}`)).forEach(([k, v]) => {
      res.setHeader(k, v);
    });
    res.status(200).json(
      createEnvelope({
        version,
        requestId: req.res.locals.requestId,
        simulationId,
        messageType: 'FrameSnapshot',
        payload: frame
      })
    );
  }));

  app.post('/api/plan', asyncRoute(async (req, res) => {
    validateCreatePlanBody(req.body);

    const fromSimulationId = req.body.fromSimulationId;
    const simulation = await simulationRepo.getSimulationById(fromSimulationId);
    if (!simulation) {
      throw notFound('fromSimulationId', fromSimulationId);
    }

    let inheritanceUsed = false;
    const normalizedBody = {
      ...req.body,
      initConfigLike: {
        ...(req.body.initConfigLike || {})
      }
    };

    if (!hasDisasters(normalizedBody)) {
      const baseInitConfig = await simulationRepo.getSimulationInitConfig(fromSimulationId);
      const baselineDisasters = baseInitConfig && baseInitConfig.disasters;
      if (!baselineDisasters || typeof baselineDisasters !== 'object') {
        throw new HttpError(
          404,
          'BASELINE_INHERITANCE_FAILED',
          `cannot inherit disasters from simulation: ${fromSimulationId}`
        );
      }
      normalizedBody.initConfigLike.disasters = baselineDisasters;
      inheritanceUsed = true;
    }

    const compiledActionCount = compileActionQueue(normalizedBody).length;

    return withIdempotency(req, res, async () => {
      const { planId } = await planRepo.createPlan(normalizedBody);
      return {
        status: 200,
        headers: deprecationHeaders('/api/plans'),
        body: ackEnvelope(req, '', {
          planId,
          inheritanceUsed,
          compiledActionCount
        })
      };
    });
  }));

  app.post('/api/plan/apply', asyncRoute(async (req, res) => {
    const input = validateApplyPlanBody(req.body || {});
    const planId = (req.body && req.body.planId) || req.query.planId;
    if (!planId) {
      throw new HttpError(400, 'BAD_REQUEST', 'planId is required in body.planId or query.planId for deprecated route');
    }

    return withIdempotency(req, res, async () => {
      const plan = await planRepo.getPlanById(String(planId));
      if (!plan) {
        throw notFound('planId', String(planId));
      }

      const planConfig = plan.planConfig || {};
      const initConfigLike = planConfig.initConfigLike;
      if (!initConfigLike || typeof initConfigLike !== 'object') {
        throw new HttpError(422, 'UNPROCESSABLE_PLAN', 'planConfig.initConfigLike is required for apply');
      }

      const { simulationId: newSimulationId } = await simulationRepo.createSimulation(initConfigLike);
      let planRun;
      try {
        planRun = await planRepo.createPlanRun({
          baseSimulationId: plan.fromSimulationId,
          planId: String(planId),
          newSimulationId
        });
      } catch (error) {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: error.code || 'PLAN_RUN_WRITE_FAILED',
          taskType: 'orphan_pending_cleanup',
          payload: {
            planId: String(planId),
            baseSimulationId: plan.fromSimulationId,
            newSimulationId
          },
          createdAt: Date.now()
        });
        throw error;
      }

      return {
        status: 200,
        headers: deprecationHeaders(`/api/plans/${planId}/apply`),
        body: ackEnvelope(req, newSimulationId, {
          planRunId: planRun.planRunId,
          newSimulationId,
          fromSimTime: input.fromSimTime ?? plan.fromSimTime,
          compiledActionCount: compileActionQueue(planConfig).length
        })
      };
    });
  }));

  app.post('/api/plan/dispatch', asyncRoute(async (req, res) => {
    const body = validateDispatchPlanBody(req.body || {});
    const planId = (req.body && req.body.planId) || req.query.planId;
    if (!planId) {
      throw new HttpError(400, 'BAD_REQUEST', 'planId is required in body.planId or query.planId for deprecated route');
    }

    return withIdempotency(req, res, async () => {
      const plan = await planRepo.getPlanById(String(planId));
      if (!plan) {
        throw notFound('planId', String(planId));
      }

      const simulationId = String(body.newSimulationId || body.simulationId || '');
      const targetSimulation = await simulationRepo.getSimulationById(simulationId);
      if (!targetSimulation) {
        throw notFound('simulationId', simulationId);
      }

      const planConfig = plan.planConfig || {};
      const compiledActionCount = compileActionQueue(planConfig).length;

      if (!planDispatcher || typeof planDispatcher.dispatchPlanCommand !== 'function') {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: 'DISPATCHER_UNAVAILABLE',
          taskType: 'plan_dispatch',
          payload: {
            planId: String(planId),
            simulationId,
            requestId: req.res.locals.requestId
          },
          createdAt: Date.now()
        });

        return {
          status: 202,
          headers: deprecationHeaders(`/api/plans/${planId}/dispatch`),
          body: ackEnvelope(req, simulationId, {
            status: 'pending',
            planId: String(planId),
            simulationId,
            compiledActionCount,
            acceptedActionCount: 0,
            dedupedActionCount: compiledActionCount
          })
        };
      }

      try {
        const dispatchResult = await planDispatcher.dispatchPlanCommand({
          simulationId,
          requestId: req.res.locals.requestId,
          payload: {
            planId: String(planId),
            planConfig
          }
        });

        return {
          status: 200,
          headers: deprecationHeaders(`/api/plans/${planId}/dispatch`),
          body: ackEnvelope(req, simulationId, {
            status: dispatchResult.status,
            planId: String(planId),
            simulationId,
            compiledActionCount: dispatchResult.compiledActionCount,
            acceptedActionCount: dispatchResult.acceptedActionCount,
            dedupedActionCount: dispatchResult.dedupedActionCount
          })
        };
      } catch (error) {
        retryQueue.push({
          requestId: req.res.locals.requestId,
          path: req.path,
          method: req.method,
          errorCode: error.code || 'PLAN_DISPATCH_FAILED',
          taskType: 'plan_dispatch',
          payload: {
            planId: String(planId),
            simulationId,
            requestId: req.res.locals.requestId
          },
          createdAt: Date.now()
        });

        return {
          status: 202,
          headers: deprecationHeaders(`/api/plans/${planId}/dispatch`),
          body: ackEnvelope(req, simulationId, {
            status: 'pending',
            planId: String(planId),
            simulationId,
            compiledActionCount,
            acceptedActionCount: 0,
            dedupedActionCount: compiledActionCount,
            errorCode: error.code || 'PLAN_DISPATCH_FAILED'
          })
        };
      }
    });
  }));

  app.use((req, res, next) => {
    next(new HttpError(404, 'NOT_FOUND', `route not found: ${req.method} ${req.path}`));
  });

  app.use((error, req, res, next) => {
    const statusCode = Number(error.statusCode || 500);
    const normalizedError =
      error instanceof HttpError
        ? error
        : new HttpError(
            error.code === 'VALIDATION_ERROR' ? 400 : 500,
            error.code || 'INTERNAL_ERROR',
            error.message || 'internal error'
          );

    if (statusCode >= 500) {
      const debugErrorPayload = {
        path: req.path,
        method: req.method,
        requestId: req.res.locals.requestId,
        code: normalizedError.code,
        message: normalizedError.message,
        statusCode: normalizedError.statusCode || statusCode,
        stack: error && error.stack ? error.stack : null
      };
      console.error('[HTTP][5xx]', JSON.stringify(debugErrorPayload));

      retryQueue.push({
        requestId: req.res.locals.requestId,
        path: req.path,
        method: req.method,
        errorCode: normalizedError.code,
        createdAt: Date.now()
      });
      if (retryQueue.length > 1000) {
        retryQueue.shift();
      }
    }

    const simulationId = req.params.simId || req.params.simulationId || '';
    res.status(Number(normalizedError.statusCode || statusCode)).json(
      errorEnvelope(req, simulationId, normalizedError)
    );
  });

  return {
    app,
    retryQueue,
    idempotencyStore
  };
}

module.exports = {
  createApp
};
