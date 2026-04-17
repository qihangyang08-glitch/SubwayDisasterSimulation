const { HttpError } = require('../http/errors');

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function normalizePath(pathname, fallback) {
  const value = String(pathname || fallback || '').trim();
  if (!value) {
    return fallback;
  }
  return value.startsWith('/') ? value : `/${value}`;
}

async function postJson(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch (error) {
        throw new HttpError(502, 'UPSTREAM_INVALID_JSON', `upstream returned non-json response: ${url}`);
      }
    }

    if (!response.ok) {
      throw new HttpError(502, 'UPSTREAM_REQUEST_FAILED', `upstream request failed: ${response.status}`, {
        upstreamUrl: url,
        status: response.status,
        body
      });
    }

    return body || {};
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new HttpError(504, 'UPSTREAM_TIMEOUT', `upstream timeout after ${timeoutMs}ms`, {
        upstreamUrl: url,
        timeoutMs
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createExternalClients(options = {}) {
  const simBaseUrl = trimTrailingSlash(options.simBaseUrl || process.env.SIM_ENGINE_BASE_URL || '');
  const simPath = normalizePath(options.simPath || process.env.SIM_ENGINE_PATH, '/mock/backend/run');

  const llmBaseUrl = trimTrailingSlash(options.llmBaseUrl || process.env.LLM_BASE_URL || '');
  const llmPath = normalizePath(options.llmPath || process.env.LLM_PLAN_PATH, '/mock/llm/plan');

  const timeoutMs = Number(options.timeoutMs || process.env.EXTERNAL_HTTP_TIMEOUT_MS || 15000);

  const simulationGateway = simBaseUrl
    ? {
        async startSimulation(input) {
          const url = `${simBaseUrl}${simPath}`;
          return postJson(url, input, timeoutMs);
        }
      }
    : null;

  const llmGateway = llmBaseUrl
    ? {
        async generatePlan(input) {
          const url = `${llmBaseUrl}${llmPath}`;
          return postJson(url, input, timeoutMs);
        }
      }
    : null;

  return {
    simulationGateway,
    llmGateway
  };
}

module.exports = {
  createExternalClients
};
