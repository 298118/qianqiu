// @ts-check

const {
  assertPublicAiProviderEnvelope,
  describeAiProviderError,
  redactAiProviderText
} = require("../providerSafety");

const AI_TASK_TRACE_SCHEMA_VERSION = "s92.8-ai-task-trace-public-summary.v1";
const MAX_TRACE_EVENTS = 16;

const PUBLIC_TRACE_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "traceId",
  "taskKind",
  "taskType",
  "promptPackId",
  "promptVersion",
  "provider",
  "model",
  "latencyMs",
  "status",
  "fallbackReason",
  "retrievalCounts",
  "toolCounts",
  "validationFlags"
]);

const RETRIEVAL_COUNT_KEYS = Object.freeze([
  "selectedRows",
  "droppedRows",
  "evidenceRefs",
  "domains"
]);

const TOOL_COUNT_KEYS = Object.freeze([
  "allowed",
  "callCount",
  "accepted",
  "pending",
  "rejected",
  "attempted",
  "used"
]);

const VALIDATION_FLAG_KEYS = Object.freeze([
  "schemaOk",
  "guardrailOk",
  "redactionOk"
]);

const PUBLIC_DETAIL_ALLOWLIST = Object.freeze([
  "accepted",
  "allowed",
  "attempt",
  "attempted",
  "budget",
  "callCount",
  "droppedRows",
  "estimated",
  "evidenceRefs",
  "fallbackProvider",
  "fallbackReason",
  "guardrailOk",
  "inputTokens",
  "latencyMs",
  "maxOutputTokens",
  "mayRequestAdjudication",
  "mayUseTools",
  "model",
  "ok",
  "outputTokens",
  "pending",
  "promptVersion",
  "provider",
  "reason",
  "redactionOk",
  "rejected",
  "schemaName",
  "schemaOk",
  "selectedRows",
  "status",
  "temperature",
  "timeoutMs",
  "toolBudget",
  "totalTokens",
  "used"
]);

const FORBIDDEN_PUBLIC_TEXT_PATTERN =
  /\b(rawPrompt|providerPayload|rawProviderPayload|rawPayload|fullPrompt|worldState|statePatch|rawSql|sqlite|world_sessions|safe_search_index|apiKey|baseUrl|baseURL|base_url|localPath|hiddenNotes|privateResultRefs|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY)\b/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(?:prompt|instructions|input|request|response|headers|apiKey|api[-_\s]?key|key|token|baseURL|baseUrl|base_url|localPath|worldState|statePatch)\s*[:=]/i;
const INTERNAL_REF_PATTERN = /\bserver\.[A-Za-z0-9_.-]+/;
const UNSAFE_DOMAIN_PATTERN = /\b(?:hidden|private|raw|payload|sqlite|world_sessions|safe_search_index|server)\b/i;
const PUBLIC_STATUS_VALUES = Object.freeze(["running", "ok", "fallback", "failed", "rejected"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nowIso() {
  return new Date().toISOString();
}

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function containsUnsafePublicText(value) {
  const text = compactWhitespace(value);
  return Boolean(
    text &&
    (
      FORBIDDEN_PUBLIC_TEXT_PATTERN.test(text) ||
      SENSITIVE_ASSIGNMENT_PATTERN.test(text) ||
      INTERNAL_REF_PATTERN.test(text)
    )
  );
}

function cleanPublicString(value, fallback = "", maxLength = 120) {
  const redacted = redactAiProviderText(value, { maxLength });
  if (!redacted) return fallback;
  if (containsUnsafePublicText(redacted)) return fallback || "[redacted]";
  return redacted;
}

function cleanPublicReason(value, fallback = "") {
  const reason = cleanPublicString(value, fallback, 180);
  if (!reason) return "";
  return reason;
}

function cleanPublicNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function cleanPublicBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readFirstNumber(source, keys, fallback = 0) {
  for (const key of keys) {
    if (source && source[key] !== undefined) {
      return cleanPublicNumber(source[key], fallback);
    }
  }
  return fallback;
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
    mayUseTools: Boolean(budget.mayUseTools),
    mayRequestAdjudication: Boolean(budget.mayRequestAdjudication)
  };
}

function cleanRetrievalDomain(value) {
  const raw = cleanPublicString(value, "other", 64)
    .replace(/[^A-Za-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!raw || UNSAFE_DOMAIN_PATTERN.test(raw) || INTERNAL_REF_PATTERN.test(raw)) {
    return "other";
  }
  return raw;
}

function addDomainCount(domains, key, value) {
  const domain = cleanRetrievalDomain(key);
  const count = cleanPublicNumber(value, 0);
  if (!count) return;
  domains[domain] = cleanPublicNumber((domains[domain] || 0) + count, 0);
}

function summarizeRetrievalCounts(retrievalCounts = {}) {
  const source = isPlainObject(retrievalCounts) ? retrievalCounts : {};
  const domains = {};
  const domainSource = isPlainObject(source.domains) ? source.domains : {};
  for (const [key, value] of Object.entries(domainSource)) {
    addDomainCount(domains, key, value);
  }

  return {
    selectedRows: readFirstNumber(source, ["selectedRows", "selected", "includedRows", "usedRows"], 0),
    droppedRows: readFirstNumber(source, ["droppedRows", "dropped", "rejectedRows"], 0),
    evidenceRefs: readFirstNumber(source, ["evidenceRefs", "evidenceRefCount", "refs"], 0),
    domains
  };
}

function summarizeToolCounts(toolCounts = {}) {
  const source = isPlainObject(toolCounts) ? toolCounts : {};
  const accepted = readFirstNumber(source, ["accepted"], 0);
  const pending = readFirstNumber(source, ["pending"], 0);
  const used = readFirstNumber(source, ["used"], accepted + pending);
  const rejected = readFirstNumber(source, ["rejected"], 0);
  const attempted = readFirstNumber(source, ["attempted"], used + rejected);
  const callCount = readFirstNumber(source, ["callCount"], attempted);

  return {
    allowed: readFirstNumber(source, ["allowed", "toolBudget"], 0),
    callCount,
    accepted,
    pending,
    rejected,
    attempted,
    used
  };
}

function summarizeValidationFlags(validation = {}) {
  const source = isPlainObject(validation) ? validation : {};
  const schemaOk = cleanPublicBoolean(source.schemaOk, cleanPublicBoolean(source.schemaValid, cleanPublicBoolean(source.ok, false)));
  return {
    schemaOk,
    guardrailOk: cleanPublicBoolean(source.guardrailOk, true),
    redactionOk: cleanPublicBoolean(source.redactionOk, true)
  };
}

function createAiTaskTrace(envelope = {}, options = {}) {
  const routeSummary = summarizeRoute(options.route || {});
  const adapterProvider = options.adapter?.providerName || routeSummary.provider || "mock";
  const adapterModel = options.adapter?.model || routeSummary.model || "mock";

  return {
    schemaVersion: AI_TASK_TRACE_SCHEMA_VERSION,
    traceId: cleanPublicString(options.traceId || envelope.traceId || `${envelope.taskId || envelope.taskKind || "task"}:${Date.now().toString(36)}`, "trace", 120),
    taskId: cleanPublicString(envelope.taskId, "task", 120),
    taskKind: cleanPublicString(envelope.taskKind, "unknown", 64),
    taskType: cleanPublicString(envelope.taskType || routeSummary.taskType, routeSummary.taskType, 64),
    schemaName: cleanPublicString(envelope.schemaName, "", 64),
    promptPackId: cleanPublicString(envelope.promptPackId, "", 64),
    promptVersion: cleanPublicString(envelope.promptVersion || options.promptVersion, "legacy", 64),
    provider: cleanPublicString(adapterProvider, "mock", 64),
    model: cleanPublicString(adapterModel, "mock", 96),
    route: routeSummary,
    budget: summarizeBudget(options.budget || {}),
    retrievalCounts: summarizeRetrievalCounts(options.retrievalCounts || envelope.retrievalCounts || {}),
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

function cleanStatus(status) {
  const cleaned = cleanPublicString(status, "failed", 32);
  return PUBLIC_STATUS_VALUES.includes(cleaned) ? cleaned : "failed";
}

function summarizeAiTaskTrace(trace = {}) {
  const summary = {
    schemaVersion: AI_TASK_TRACE_SCHEMA_VERSION,
    traceId: cleanPublicString(trace.traceId, "trace", 120),
    taskKind: cleanPublicString(trace.taskKind, "unknown", 64),
    taskType: cleanPublicString(trace.taskType, "narrator", 64),
    promptPackId: cleanPublicString(trace.promptPackId, "", 64),
    promptVersion: cleanPublicString(trace.promptVersion, "legacy", 64),
    provider: cleanPublicString(trace.provider, "mock", 64),
    model: cleanPublicString(trace.model, "mock", 96),
    latencyMs: cleanPublicNumber(trace.latencyMs, 0),
    status: cleanStatus(trace.status || "running"),
    fallbackReason: cleanPublicReason(trace.fallbackReason, ""),
    retrievalCounts: summarizeRetrievalCounts(trace.retrievalCounts || trace.retrieval || {}),
    toolCounts: summarizeToolCounts(trace.toolCounts || trace.tool || {}),
    validationFlags: summarizeValidationFlags(trace.validationFlags || trace.validation || {})
  };
  assertPublicAiTaskTrace(summary);
  return summary;
}

function finishAiTaskTrace(trace, status, details = {}) {
  if (!isPlainObject(trace)) {
    throw new Error("AI task trace must be an object.");
  }
  trace.status = cleanStatus(status);
  trace.finishedAt = nowIso();
  trace.latencyMs = cleanPublicNumber(details.latencyMs, 0);
  trace.validationFlags = summarizeValidationFlags(details.validationFlags || details.validation || {});
  trace.toolCounts = summarizeToolCounts(details.toolCounts || {});
  trace.retrievalCounts = summarizeRetrievalCounts(details.retrievalCounts || trace.retrievalCounts || {});
  trace.fallbackProvider = cleanPublicString(details.fallbackProvider, "", 64);
  trace.fallbackReason = cleanPublicReason(
    details.fallbackReason || (details.error ? describeAiProviderError(details.error) : ""),
    ""
  );

  if (details.error) {
    recordAiTaskTraceEvent(trace, "error", {
      reason: describeAiProviderError(details.error)
    });
  }

  return summarizeAiTaskTrace(trace);
}

function assertAllowedObjectKeys(value, allowedKeys, label) {
  if (!isPlainObject(value)) {
    throw new Error(`Public AI task trace ${label} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Public AI task trace contains forbidden ${label} field: ${key}`);
    }
  }
}

function assertPublicAiTaskTrace(summary) {
  assertPublicAiProviderEnvelope(summary);
  assertAllowedObjectKeys(summary, PUBLIC_TRACE_TOP_LEVEL_KEYS, "top-level");
  assertAllowedObjectKeys(summary.retrievalCounts, RETRIEVAL_COUNT_KEYS, "retrievalCounts");
  assertAllowedObjectKeys(summary.toolCounts, TOOL_COUNT_KEYS, "toolCounts");
  assertAllowedObjectKeys(summary.validationFlags, VALIDATION_FLAG_KEYS, "validationFlags");

  for (const [domain, count] of Object.entries(summary.retrievalCounts.domains || {})) {
    if (cleanRetrievalDomain(domain) !== domain || !Number.isFinite(Number(count)) || Number(count) < 0) {
      throw new Error("Public AI task trace contains unsafe retrieval domain counts.");
    }
  }

  const serialized = JSON.stringify(summary);
  if (FORBIDDEN_PUBLIC_TEXT_PATTERN.test(serialized)) {
    throw new Error("Public AI task trace contains forbidden raw diagnostic content.");
  }
  if (SENSITIVE_ASSIGNMENT_PATTERN.test(serialized)) {
    throw new Error("Public AI task trace contains forbidden sensitive assignment.");
  }
  if (INTERNAL_REF_PATTERN.test(serialized)) {
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
  summarizeAiTaskTrace,
  summarizeRetrievalCounts,
  summarizeToolCounts,
  summarizeValidationFlags
};
