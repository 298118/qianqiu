// @ts-check

const {
  assertPublicAiProviderEnvelope,
  describeAiProviderError,
  redactAiProviderText
} = require("../providerSafety");

const AI_TASK_TRACE_SCHEMA_VERSION = "s92.2-ai-task-trace.v1";
const MAX_TRACE_EVENTS = 16;
const PUBLIC_DETAIL_ALLOWLIST = Object.freeze([
  "allowed",
  "attempt",
  "budget",
  "estimated",
  "fallbackProvider",
  "fallbackReason",
  "inputTokens",
  "latencyMs",
  "maxOutputTokens",
  "mayRequestAdjudication",
  "mayUseTools",
  "model",
  "ok",
  "outputTokens",
  "provider",
  "reason",
  "schemaName",
  "status",
  "temperature",
  "timeoutMs",
  "toolBudget",
  "totalTokens",
  "used"
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nowIso() {
  return new Date().toISOString();
}

function cleanPublicString(value, fallback = "", maxLength = 120) {
  const redacted = redactAiProviderText(value, { maxLength });
  if (!redacted) return fallback;
  if (/^server\./i.test(redacted) || /\bserver\.[A-Za-z0-9_.-]+/.test(redacted)) {
    return "[redacted-internal-ref]";
  }
  return redacted;
}

function cleanPublicNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function cleanPublicBoolean(value) {
  return Boolean(value);
}

function pickAllowedDetails(details = {}) {
  if (!isPlainObject(details)) return {};
  const picked = {};
  for (const key of PUBLIC_DETAIL_ALLOWLIST) {
    if (!(key in details)) continue;
    const value = details[key];
    if (typeof value === "number") {
      picked[key] = cleanPublicNumber(value);
    } else if (typeof value === "boolean") {
      picked[key] = cleanPublicBoolean(value);
    } else if (typeof value === "string") {
      picked[key] = cleanPublicString(value, "", key.includes("Reason") || key === "reason" ? 180 : 120);
    }
  }
  return picked;
}

function summarizeRoute(route = {}) {
  return {
    taskType: cleanPublicString(route.taskType, "narrator", 64),
    provider: cleanPublicString(route.provider, "mock", 64),
    model: cleanPublicString(route.model, "mock", 96)
  };
}

function summarizeBudget(budget = {}) {
  return {
    maxOutputTokens: cleanPublicNumber(budget.maxOutputTokens, 0),
    timeoutMs: cleanPublicNumber(budget.timeoutMs, 0),
    temperature: Number.isFinite(Number(budget.temperature))
      ? Math.max(0, Math.min(1, Number(budget.temperature)))
      : 0,
    toolBudget: cleanPublicNumber(budget.toolBudget, 0),
    mayUseTools: cleanPublicBoolean(budget.mayUseTools),
    mayRequestAdjudication: cleanPublicBoolean(budget.mayRequestAdjudication)
  };
}

function summarizeUsage(usage = {}) {
  return {
    inputTokens: cleanPublicNumber(usage.inputTokens, 0),
    outputTokens: cleanPublicNumber(usage.outputTokens, 0),
    totalTokens: cleanPublicNumber(usage.totalTokens, 0),
    estimated: cleanPublicBoolean(usage.estimated)
  };
}

function summarizeValidation(validation = {}) {
  return {
    ok: cleanPublicBoolean(validation.ok),
    schemaName: cleanPublicString(validation.schemaName, "", 64)
  };
}

function summarizeToolCounts(toolCounts = {}) {
  return {
    allowed: cleanPublicNumber(toolCounts.allowed, 0),
    used: cleanPublicNumber(toolCounts.used, 0)
  };
}

function createAiTaskTrace(envelope = {}, options = {}) {
  const routeSummary = summarizeRoute(options.route || {});
  const adapterProvider = options.adapter?.providerName || routeSummary.provider || "mock";
  const adapterModel = options.adapter?.model || routeSummary.model || "mock";

  return {
    schemaVersion: AI_TASK_TRACE_SCHEMA_VERSION,
    traceId: cleanPublicString(options.traceId || `${envelope.taskId || envelope.taskKind || "task"}:${Date.now().toString(36)}`, "trace", 120),
    taskId: cleanPublicString(envelope.taskId, "task", 120),
    taskKind: cleanPublicString(envelope.taskKind, "unknown", 64),
    taskType: cleanPublicString(envelope.taskType || routeSummary.taskType, routeSummary.taskType, 64),
    schemaName: cleanPublicString(envelope.schemaName, "", 64),
    promptPackId: cleanPublicString(envelope.promptPackId, "", 64),
    provider: cleanPublicString(adapterProvider, "mock", 64),
    model: cleanPublicString(adapterModel, "mock", 96),
    route: routeSummary,
    budget: summarizeBudget(options.budget || {}),
    startedAt: nowIso(),
    status: "running",
    events: []
  };
}

function recordAiTaskTraceEvent(trace, eventType, details = {}) {
  if (!isPlainObject(trace)) {
    throw new Error("AI task trace must be an object.");
  }
  if (!Array.isArray(trace.events)) trace.events = [];
  if (trace.events.length >= MAX_TRACE_EVENTS) return trace;

  trace.events.push({
    at: nowIso(),
    type: cleanPublicString(eventType, "event", 64),
    details: pickAllowedDetails(details)
  });
  return trace;
}

function summarizeAiTaskTrace(trace = {}) {
  const summary = {
    schemaVersion: AI_TASK_TRACE_SCHEMA_VERSION,
    traceId: cleanPublicString(trace.traceId, "trace", 120),
    taskId: cleanPublicString(trace.taskId, "task", 120),
    taskKind: cleanPublicString(trace.taskKind, "unknown", 64),
    taskType: cleanPublicString(trace.taskType, "narrator", 64),
    schemaName: cleanPublicString(trace.schemaName, "", 64),
    promptPackId: cleanPublicString(trace.promptPackId, "", 64),
    provider: cleanPublicString(trace.provider, "mock", 64),
    model: cleanPublicString(trace.model, "mock", 96),
    status: cleanPublicString(trace.status, "running", 32),
    startedAt: cleanPublicString(trace.startedAt, "", 40),
    finishedAt: cleanPublicString(trace.finishedAt, "", 40),
    latencyMs: cleanPublicNumber(trace.latencyMs, 0),
    route: summarizeRoute(trace.route || {}),
    budget: summarizeBudget(trace.budget || {}),
    validation: summarizeValidation(trace.validation || {}),
    toolCounts: summarizeToolCounts(trace.toolCounts || {}),
    usage: summarizeUsage(trace.usage || {}),
    fallbackProvider: cleanPublicString(trace.fallbackProvider, "", 64),
    fallbackReason: cleanPublicString(trace.fallbackReason, "", 180),
    events: Array.isArray(trace.events)
      ? trace.events.slice(0, MAX_TRACE_EVENTS).map((event) => ({
        at: cleanPublicString(event.at, "", 40),
        type: cleanPublicString(event.type, "event", 64),
        details: pickAllowedDetails(event.details)
      }))
      : []
  };
  assertPublicAiTaskTrace(summary);
  return summary;
}

function finishAiTaskTrace(trace, status, details = {}) {
  if (!isPlainObject(trace)) {
    throw new Error("AI task trace must be an object.");
  }
  trace.status = cleanPublicString(status, "failed", 32);
  trace.finishedAt = nowIso();
  trace.latencyMs = cleanPublicNumber(details.latencyMs, 0);
  trace.validation = summarizeValidation(details.validation || {});
  trace.toolCounts = summarizeToolCounts(details.toolCounts || {});
  trace.usage = summarizeUsage(details.usage || {});
  trace.fallbackProvider = cleanPublicString(details.fallbackProvider, "", 64);
  trace.fallbackReason = cleanPublicString(details.fallbackReason, "", 180);

  if (details.error) {
    recordAiTaskTraceEvent(trace, "error", {
      reason: describeAiProviderError(details.error)
    });
  }

  return summarizeAiTaskTrace(trace);
}

function assertPublicAiTaskTrace(summary) {
  assertPublicAiProviderEnvelope(summary);
  const serialized = JSON.stringify(summary);
  if (/\b(rawPrompt|providerPayload|rawProviderPayload|worldState|statePatch|apiKey|baseUrl|baseURL|localPath)\b/i.test(serialized)) {
    throw new Error("Public AI task trace contains forbidden raw diagnostic content.");
  }
  if (/\b(?:prompt|input|instructions|request|response|headers|apiKey|api[-_\s]?key|key|token|baseURL|baseUrl|localPath|worldState|statePatch)\s*[:=]/i.test(serialized)) {
    throw new Error("Public AI task trace contains forbidden sensitive assignment.");
  }
  if (/\bserver\.[A-Za-z0-9_.-]+/.test(serialized)) {
    throw new Error("Public AI task trace contains forbidden server internal reference.");
  }
  return summary;
}

module.exports = {
  AI_TASK_TRACE_SCHEMA_VERSION,
  assertPublicAiTaskTrace,
  createAiTaskTrace,
  finishAiTaskTrace,
  recordAiTaskTraceEvent,
  summarizeAiTaskTrace
};
