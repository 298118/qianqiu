// @ts-check

const OpenAI = /** @type {any} */ (require("openai"));
const { redactAiProviderText } = require("../providerSafety");
const { getModelSchema } = require("../schemas");
const { readTimeoutMs, requireEnv } = require("./remoteHelpers");
const { normalizeProviderStructuredResult } = require("./providerResponseNormalizer");

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

function applyRouteTokenBudget(taskMaxOutputTokens, routeMaxOutputTokens) {
  const routeValue = Number(routeMaxOutputTokens);
  if (Number.isFinite(routeValue) && routeValue > 0) return Math.trunc(routeValue);

  const taskValue = Number(taskMaxOutputTokens);
  return Number.isFinite(taskValue) && taskValue > 0 ? Math.trunc(taskValue) : undefined;
}

function applyRouteTemperature(params, routeTemperature) {
  if (routeTemperature === undefined || routeTemperature === null || routeTemperature === "") {
    return params;
  }
  const temperature = Number(routeTemperature);
  return Number.isFinite(temperature) ? { ...params, temperature } : params;
}

function sanitizeSchemaName(schemaName) {
  return String(schemaName || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 64);
}

function resolveTaskPrompt(task) {
  if (typeof task.instructions !== "string" || !task.instructions.trim()) {
    throw new Error("OpenAI ProviderAdapter requires prompt instructions.");
  }
  if (typeof task.input !== "string" || !task.input.trim()) {
    throw new Error("OpenAI ProviderAdapter requires prompt input.");
  }
  return {
    instructions: task.instructions,
    input: task.input
  };
}

function shouldUseStrictSchema(route, supportsStrictStructuredOutput) {
  return route.allowStrictSchema === true && supportsStrictStructuredOutput === true;
}

/**
 * @param {Record<string, any>} task
 * @param {{ route?: Record<string, any>, model?: string, supportsStrictStructuredOutput?: boolean }} [options]
 */
function buildOpenAiStructuredRequest(task, options = {}) {
  const route = options.route || task.route || {};
  const schemaName = sanitizeSchemaName(task.schemaName);
  if (!schemaName) throw new Error("OpenAI ProviderAdapter requires schemaName.");

  const schema = task.schema || getModelSchema(schemaName);
  const model = String(options.model || route.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const { instructions, input } = resolveTaskPrompt(task);
  const strict = shouldUseStrictSchema(route, options.supportsStrictStructuredOutput !== false);
  const maxOutputTokens = applyRouteTokenBudget(
    task.maxOutputTokens || task.budget?.maxOutputTokens,
    route.maxOutputTokens
  );

  const params = {
    model,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name: `qianqiu_${schemaName}`,
        schema,
        strict
      }
    }
  };

  if (maxOutputTokens) params.max_output_tokens = maxOutputTokens;

  return applyRouteTemperature(params, route.temperature);
}

function buildOpenAiChatStructuredRequest(responseParams) {
  const format = responseParams.text?.format || {};
  const params = {
    model: responseParams.model,
    messages: [
      { role: "system", content: responseParams.instructions },
      { role: "user", content: responseParams.input }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: format.name,
        schema: format.schema,
        strict: Boolean(format.strict)
      }
    }
  };

  if (responseParams.max_output_tokens) params.max_tokens = responseParams.max_output_tokens;
  if (responseParams.temperature !== undefined) params.temperature = responseParams.temperature;
  return params;
}

function createDefaultOpenAiClient(route, options = {}) {
  const apiKey = options.apiKey || requireEnv("OPENAI_API_KEY", "OpenAI");
  return new OpenAI({
    apiKey,
    baseURL: options.baseURL || process.env.OPENAI_BASE_URL || undefined,
    maxRetries: 0,
    timeout: route.timeoutMs || readTimeoutMs()
  });
}

function isStrictSchemaUnsupportedError(error) {
  const message = String(error?.message || error || "");
  return /strict|schema|response_format|json_schema/i.test(message) &&
    /unsupported|not supported|invalid|400|bad request/i.test(message);
}

async function requestStructuredResponse(client, responseParams, requestJson) {
  if (client?.responses?.create) {
    return client.responses.create(responseParams);
  }
  if (client?.chat?.completions?.create) {
    return client.chat.completions.create(buildOpenAiChatStructuredRequest(responseParams));
  }
  if (typeof requestJson === "function") {
    return requestJson(responseParams);
  }
  throw new Error("OpenAI ProviderAdapter requires a Responses or Chat Completions client.");
}

function createOpenAiAdapter(options = {}) {
  const route = options.route || {};
  const model = String(options.model || route.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const supportsStrictStructuredOutput = options.supportsStrictStructuredOutput !== false;
  const client = options.client || (
    typeof options.requestJson === "function" ? null : createDefaultOpenAiClient(route, options)
  );

  return {
    providerName: "openai",
    model,
    capabilities: {
      structuredOutput: true,
      strictStructuredOutput: supportsStrictStructuredOutput,
      sourceFacade: false
    },

    async generateStructured(task) {
      const taskRoute = task.route || route;
      const responseParams = buildOpenAiStructuredRequest(task, {
        route: taskRoute,
        model,
        supportsStrictStructuredOutput
      });
      let raw;

      try {
        raw = await requestStructuredResponse(client, responseParams, options.requestJson);
      } catch (error) {
        if (responseParams.text.format.strict && options.retryWithoutStrict !== false && isStrictSchemaUnsupportedError(error)) {
          const relaxedParams = {
            ...responseParams,
            text: {
              format: {
                ...responseParams.text.format,
                strict: false
              }
            }
          };
          try {
            raw = await requestStructuredResponse(client, relaxedParams, options.requestJson);
            return normalizeProviderStructuredResult({
              schemaName: task.schemaName,
              raw,
              provider: "openai",
              model,
              strictStructuredOutput: false
            });
          } catch (retryError) {
            throw new Error(`OpenAI structured request failed after strict downgrade: ${redactAiProviderText(retryError, { maxLength: 180 })}`);
          }
        }
        throw new Error(`OpenAI structured request failed: ${redactAiProviderText(error, { maxLength: 180 })}`);
      }

      return normalizeProviderStructuredResult({
        schemaName: task.schemaName,
        raw,
        provider: "openai",
        model,
        strictStructuredOutput: Boolean(responseParams.text.format.strict)
      });
    }
  };
}

module.exports = {
  buildOpenAiChatStructuredRequest,
  buildOpenAiStructuredRequest,
  createOpenAiAdapter
};
