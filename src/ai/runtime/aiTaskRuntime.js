// @ts-check

const mockProvider = require("../providers/mock");
const { validatePayload } = require("../schemas");
const { describeAiProviderError } = require("../providerSafety");
const {
  buildDefaultModelRoutePolicy,
  normalizeProviderName,
  resolveModelForTask
} = require("../modelRoutePolicy");
const {
  assertProviderAdapter,
  createProviderFacadeAdapter,
  createRuntimeTaskEnvelope,
  getRuntimeTaskConfig
} = require("../providers/adapterContract");
const { buildAiTaskBudget, summarizeAiTaskBudget } = require("./aiBudgetManager");
const { buildAiFallbackPayload, summarizeFallbackDecision } = require("./aiFallbackPolicy");
const { classifyProviderFailure } = require("./providerHealthManager");
const {
  assertPublicAiTaskTrace,
  createAiTaskTrace,
  finishAiTaskTrace,
  recordAiTaskTraceEvent
} = require("./aiTaskTrace");

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildDefaultRuntimeRoutePolicy(options = {}) {
  return options.routePolicy || buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" }, options);
}

function sanitizeUsage(usage = {}) {
  const inputTokens = Number(usage.inputTokens);
  const outputTokens = Number(usage.outputTokens);
  const totalTokens = Number(usage.totalTokens);
  return {
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.trunc(inputTokens)) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.trunc(outputTokens)) : 0,
    totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.trunc(totalTokens)) : 0,
    estimated: Boolean(usage.estimated)
  };
}

function runWithTimeout(work, timeoutMs) {
  let timeoutId = null;
  return Promise.race([
    work().finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`AI runtime task timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    })
  ]);
}

function assertRuntimeEnvelope(envelope) {
  if (!isPlainObject(envelope)) {
    throw new Error("AI runtime task envelope must be an object.");
  }
  const config = getRuntimeTaskConfig(envelope.taskKind);
  if (envelope.taskType !== config.taskType || envelope.schemaName !== config.schemaName) {
    throw new Error(`AI runtime task envelope mismatch for ${config.taskKind}.`);
  }
  if (String(envelope.promptPackId || "").startsWith("server.")) {
    throw new Error("AI runtime task envelope may not expose server.* prompt packs.");
  }
  return config;
}

async function runAiTask(envelope, options = {}) {
  const config = assertRuntimeEnvelope(envelope);
  const routePolicy = buildDefaultRuntimeRoutePolicy(options);
  const route = resolveModelForTask(config.taskType, routePolicy);
  const budget = buildAiTaskBudget(route, {
    ...(options.budgetOverrides || {}),
    mayUseTools: Boolean(config.mayUseTools),
    toolBudget: config.mayUseTools ? (options.budgetOverrides?.toolBudget ?? route.toolBudget) : 0,
    mayRequestAdjudication: config.mayUseTools
      ? (options.budgetOverrides?.mayRequestAdjudication ?? route.mayRequestAdjudication)
      : false
  });
  const fallbackEnabled = options.fallback !== false;
  const adapter = options.adapter || createProviderFacadeAdapter(mockProvider, { providerName: "mock", model: "mock" });
  const startedAt = Date.now();

  let adapterMetadata = null;
  let trace = null;

  try {
    if (!options.allowNonMockRoute && normalizeProviderName(route.provider) !== "mock") {
      throw new Error(`AI runtime skeleton only allows mock routes, received ${route.provider}.`);
    }

    adapterMetadata = assertProviderAdapter(adapter, {
      allowNonMock: Boolean(options.allowNonMockAdapter)
    });
    trace = createAiTaskTrace(envelope, {
      route,
      adapter: adapterMetadata,
      budget: summarizeAiTaskBudget(budget)
    });
    recordAiTaskTraceEvent(trace, "provider_start", {
      provider: adapterMetadata.providerName,
      model: adapterMetadata.model
    });

    const providerResult = await runWithTimeout(
      () => adapter.generateStructured({
        ...envelope,
        route,
        budget
      }),
      budget.timeoutMs
    );
    const payload = isPlainObject(providerResult) && "payload" in providerResult
      ? providerResult.payload
      : providerResult;
    const validatedPayload = validatePayload(config.schemaName, payload);
    const usage = sanitizeUsage(isPlainObject(providerResult) ? providerResult.usage : {});
    const summary = finishAiTaskTrace(trace, "ok", {
      latencyMs: Date.now() - startedAt,
      validation: { ok: true, schemaName: config.schemaName },
      usage,
      toolCounts: { allowed: budget.toolBudget, used: 0 }
    });
    assertPublicAiTaskTrace(summary);

    return {
      status: "ok",
      payload: validatedPayload,
      trace: summary,
      fallback: false
    };
  } catch (error) {
    if (!fallbackEnabled) {
      throw new Error(describeAiProviderError(error) || "AI runtime task failed.");
    }

    const fallbackPayload = buildAiFallbackPayload(envelope, error);
    const fallbackDecision = summarizeFallbackDecision(envelope, error);
    const providerFailure = classifyProviderFailure(error);
    const fallbackTrace = trace || createAiTaskTrace(envelope, {
      route,
      adapter: adapterMetadata || { providerName: "mock", model: "mock" },
      budget: summarizeAiTaskBudget(budget)
    });
    recordAiTaskTraceEvent(fallbackTrace, "fallback", {
      fallbackProvider: fallbackDecision.fallbackProvider,
      fallbackReason: providerFailure.reason
    });
    const summary = finishAiTaskTrace(fallbackTrace, "fallback", {
      latencyMs: Date.now() - startedAt,
      fallbackReason: providerFailure.reason,
      fallbackProvider: fallbackDecision.fallbackProvider,
      validation: { ok: true, schemaName: config.schemaName },
      toolCounts: { allowed: budget.toolBudget, used: 0 }
    });
    assertPublicAiTaskTrace(summary);

    return {
      status: "fallback",
      payload: fallbackPayload,
      trace: summary,
      fallback: true,
      fallbackReason: providerFailure.reason
    };
  }
}

function createAiTaskRuntime(options = {}) {
  const routePolicy = buildDefaultRuntimeRoutePolicy(options);
  const adapter = options.adapter || createProviderFacadeAdapter(mockProvider, { providerName: "mock", model: "mock" });

  return {
    schemaVersion: "s92.2-ai-task-runtime.v1",
    routePolicy,
    adapter,
    async run(taskKind, context = {}, runOptions = {}) {
      const envelope = runOptions.envelope || createRuntimeTaskEnvelope(taskKind, context, runOptions);
      return runAiTask(envelope, {
        ...options,
        ...runOptions,
        adapter: runOptions.adapter || adapter,
        routePolicy: runOptions.routePolicy || routePolicy
      });
    }
  };
}

module.exports = {
  assertRuntimeEnvelope,
  createAiTaskRuntime,
  runAiTask
};
