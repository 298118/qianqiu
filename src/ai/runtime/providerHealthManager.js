// @ts-check

const {
  assertPublicAiProviderEnvelope,
  redactAiProviderText
} = require("../providerSafety");

const PROVIDER_HEALTH_SCHEMA_VERSION = "s92.8-provider-health.v1";
const PROVIDER_HEALTH_FAILURE_REASONS = Object.freeze([
  "missing_key",
  "timeout",
  "schema_invalid",
  "rate_limit",
  "network_error",
  "tool_shape_mismatch",
  "safety_reject",
  "unknown"
]);

const DEFAULT_MAX_RECENT_EVENTS = 16;
const DEFAULT_CIRCUIT_BREAKER_FAILURES = 3;
const DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
const FAILURE_REASONS = new Set(PROVIDER_HEALTH_FAILURE_REASONS);
const PROVIDER_HEALTH_TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "checkedAt",
  "providers"
]);
const PROVIDER_HEALTH_RECORD_KEYS = Object.freeze([
  "schemaVersion",
  "provider",
  "model",
  "status",
  "recentSuccessCount",
  "recentFailureCount",
  "consecutiveFailures",
  "lastFailureReason",
  "lastPublicMessage",
  "lastFailureAt",
  "lastSuccessAt",
  "lastCheckedAt",
  "circuitOpen",
  "circuitOpenUntil",
  "failuresByReason"
]);

const FORBIDDEN_PUBLIC_HEALTH_TEXT_PATTERN =
  /\b(rawPrompt|providerPayload|rawProviderPayload|rawPayload|fullPrompt|worldState|statePatch|rawSql|sqlite|world_sessions|safe_search_index|apiKey|baseUrl|baseURL|base_url|localPath|hiddenNotes|privateResultRefs|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY)\b/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(?:prompt|instructions|input|request|response|headers|apiKey|api[-_\s]?key|key|token|baseURL|baseUrl|base_url|localPath|worldState|statePatch)\s*[:=]/i;
const INTERNAL_REF_PATTERN = /\bserver\.[A-Za-z0-9_.-]+/;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function cleanNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function compactText(value, fallback = "", maxLength = 160) {
  const text = redactAiProviderText(value, { maxLength }) || fallback;
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function containsUnsafePublicText(value) {
  const text = String(value || "");
  return Boolean(
    text &&
    (
      FORBIDDEN_PUBLIC_HEALTH_TEXT_PATTERN.test(text) ||
      SENSITIVE_ASSIGNMENT_PATTERN.test(text) ||
      INTERNAL_REF_PATTERN.test(text)
    )
  );
}

function cleanPublicText(value, fallback = "", maxLength = 160) {
  const text = compactText(value, fallback, maxLength);
  return containsUnsafePublicText(text) ? fallback : text;
}

function cleanProviderName(value, fallback = "mock") {
  const cleaned = cleanPublicText(value, fallback, 64)
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

function cleanModelName(value, fallback = "mock") {
  return cleanPublicText(value, fallback, 96) || fallback;
}

function readErrorNumber(error, keys) {
  if (!isPlainObject(error)) return 0;
  for (const key of keys) {
    const value = error[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  if (isPlainObject(error.response)) {
    return readErrorNumber(error.response, keys);
  }
  return 0;
}

function readErrorText(error, options = {}) {
  const parts = [];
  if (options.reason) parts.push(options.reason);
  if (typeof error === "string") parts.push(error);
  if (error && typeof error === "object") {
    const record = /** @type {Record<string, unknown>} */ (error);
    for (const key of ["name", "code", "type", "message", "cause"]) {
      if (record[key] !== undefined) parts.push(String(record[key]));
    }
  } else if (error !== undefined && error !== null) {
    parts.push(String(error));
  }
  return parts.join(" ").toLowerCase();
}

function normalizeFailureReason(reason) {
  const normalized = String(reason || "").trim().toLowerCase();
  return FAILURE_REASONS.has(normalized) ? normalized : "";
}

function hasKeySignal(text) {
  return Boolean(
    /\b(?:openai|deepseek|mimo|anthropic)_api_key\b.*\b(?:missing|required|not configured|invalid|unset)\b/.test(text) ||
    /\b(?:missing|required|not configured|invalid|unset)\b.*\b(?:openai|deepseek|mimo|anthropic)_api_key\b/.test(text) ||
    /\b(?:missing|no|unset|not configured|required|invalid)\s+(?:api[-_\s]?key|key|token)\b/.test(text) ||
    /\b(?:api[-_\s]?key|auth(?:entication)? token)\s+(?:missing|required|not configured|invalid)\b/.test(text)
  );
}

function hasSafetySignal(text) {
  return Boolean(
    /\b(?:safety|content policy|policy|guardrail|redaction|unsafe|hidden|private|forbidden|not allowed|blocked|violation|moderation|worldstate|statepatch|rawprompt|providerpayload)\b/.test(text) ||
    INTERNAL_REF_PATTERN.test(text)
  );
}

function classifyProviderFailure(error, options = {}) {
  const explicitReason = normalizeFailureReason(options.reason);
  const status = readErrorNumber(error, ["status", "statusCode", "httpStatus"]);
  const text = readErrorText(error, options);
  const keySignal = hasKeySignal(text);
  const safetySignal = hasSafetySignal(text);
  let reason = explicitReason;

  if (!reason) {
    if (status === 403 && safetySignal && !keySignal) {
      reason = "safety_reject";
    } else if (status === 401 || status === 403 || keySignal) {
      reason = "missing_key";
    } else if (status === 429 || /\b(?:rate[-_\s]?limit|too many requests|quota|429)\b/.test(text)) {
      reason = "rate_limit";
    } else if (/\b(?:timeout|timed out|etimedout|aborterror|deadline)\b/.test(text)) {
      reason = "timeout";
    } else if (/\b(?:schema|ajv|validation|invalid json|non-json|json parse|parse error|structured output)\b/.test(text)) {
      reason = "schema_invalid";
    } else if (/\b(?:tool[-_\s]?shape|tool call|tool_use|function call|malformed tool|unknown tool|invalid arguments)\b/.test(text)) {
      reason = "tool_shape_mismatch";
    } else if (
      safetySignal ||
      /\b(?:only allows|mock routes)\b/.test(text)
    ) {
      reason = "safety_reject";
    } else if (
      status >= 500 ||
      /\b(?:network|fetch failed|econnreset|econnrefused|enotfound|eai_again|socket|dns|tls|503|502|504|500)\b/.test(text)
    ) {
      reason = "network_error";
    } else {
      reason = "unknown";
    }
  }

  const retryable = ["timeout", "rate_limit", "network_error", "schema_invalid", "tool_shape_mismatch", "unknown"].includes(reason);
  const publicMessage = cleanPublicText(error, reason, 160) || reason;

  return {
    schemaVersion: PROVIDER_HEALTH_SCHEMA_VERSION,
    reason,
    retryable,
    publicMessage
  };
}

function createEmptyProviderRecord(provider, model, at) {
  const failuresByReason = {};
  for (const reason of PROVIDER_HEALTH_FAILURE_REASONS) {
    failuresByReason[reason] = 0;
  }
  return {
    provider,
    model,
    status: "unknown",
    recentEvents: [],
    recentSuccessCount: 0,
    recentFailureCount: 0,
    consecutiveFailures: 0,
    failuresByReason,
    lastFailureReason: "",
    lastPublicMessage: "",
    lastFailureAt: "",
    lastSuccessAt: "",
    lastCheckedAt: at,
    circuitOpenUntilMs: 0
  };
}

function providerRecordKey(provider, model) {
  return `${provider}::${model || "default"}`;
}

function summarizeProviderRecord(record, nowMs) {
  const summary = {
    schemaVersion: PROVIDER_HEALTH_SCHEMA_VERSION,
    provider: cleanProviderName(record.provider),
    model: cleanModelName(record.model),
    status: cleanPublicText(record.status, "unknown", 32) || "unknown",
    recentSuccessCount: cleanNumber(record.recentSuccessCount, 0),
    recentFailureCount: cleanNumber(record.recentFailureCount, 0),
    consecutiveFailures: cleanNumber(record.consecutiveFailures, 0),
    lastFailureReason: normalizeFailureReason(record.lastFailureReason) || "",
    lastPublicMessage: cleanPublicText(record.lastPublicMessage, "", 160),
    lastFailureAt: cleanPublicText(record.lastFailureAt, "", 40),
    lastSuccessAt: cleanPublicText(record.lastSuccessAt, "", 40),
    lastCheckedAt: cleanPublicText(record.lastCheckedAt, "", 40),
    circuitOpen: Number(record.circuitOpenUntilMs) > nowMs,
    circuitOpenUntil: Number(record.circuitOpenUntilMs) > nowMs ? nowIso(record.circuitOpenUntilMs) : "",
    failuresByReason: {}
  };

  for (const reason of PROVIDER_HEALTH_FAILURE_REASONS) {
    summary.failuresByReason[reason] = cleanNumber(record.failuresByReason?.[reason], 0);
  }

  assertPublicProviderHealthSummary(summary);
  return summary;
}

function summarizeProviderHealth(records, nowMs, checkedAt) {
  const summary = {
    schemaVersion: PROVIDER_HEALTH_SCHEMA_VERSION,
    checkedAt,
    providers: records.map((record) => summarizeProviderRecord(record, nowMs))
  };
  assertPublicProviderHealthSummary(summary);
  return summary;
}

function assertAllowedObjectKeys(value, allowedKeys, label) {
  if (!isPlainObject(value)) {
    throw new Error(`Public AI provider health ${label} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Public AI provider health contains forbidden ${label} field: ${key}`);
    }
  }
}

function assertProviderHealthRecordShape(record, label = "provider") {
  assertAllowedObjectKeys(record, PROVIDER_HEALTH_RECORD_KEYS, label);
  assertAllowedObjectKeys(record.failuresByReason, PROVIDER_HEALTH_FAILURE_REASONS, `${label}.failuresByReason`);
}

function createProviderHealthManager(options = {}) {
  const maxRecentEvents = cleanNumber(options.maxRecentEvents, DEFAULT_MAX_RECENT_EVENTS);
  const circuitBreakerFailures = cleanNumber(options.circuitBreakerFailures, DEFAULT_CIRCUIT_BREAKER_FAILURES);
  const circuitBreakerCooldownMs = cleanNumber(options.circuitBreakerCooldownMs, DEFAULT_CIRCUIT_BREAKER_COOLDOWN_MS);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const records = new Map();

  function getRecord(meta = {}) {
    const nowMs = now();
    const at = nowIso(nowMs);
    const provider = cleanProviderName(meta.provider || meta.providerName || "mock");
    const model = cleanModelName(meta.model || "mock");
    const key = providerRecordKey(provider, model);
    if (!records.has(key)) {
      records.set(key, createEmptyProviderRecord(provider, model, at));
    }
    const record = records.get(key);
    record.lastCheckedAt = at;
    return record;
  }

  function trimRecentEvents(record) {
    if (!Array.isArray(record.recentEvents)) record.recentEvents = [];
    while (record.recentEvents.length > maxRecentEvents) {
      record.recentEvents.shift();
    }
  }

  function recordSuccess(meta = {}) {
    const nowMs = now();
    const at = nowIso(nowMs);
    const record = getRecord(meta);
    record.status = "healthy";
    record.recentSuccessCount += 1;
    record.consecutiveFailures = 0;
    record.lastSuccessAt = at;
    record.lastCheckedAt = at;
    record.circuitOpenUntilMs = 0;
    record.recentEvents.push({
      at,
      status: "ok",
      latencyMs: cleanNumber(meta.latencyMs, 0)
    });
    trimRecentEvents(record);
    return summarizeProviderRecord(record, nowMs);
  }

  function recordFailure(error, meta = {}) {
    const nowMs = now();
    const at = nowIso(nowMs);
    const record = getRecord(meta);
    const classification = classifyProviderFailure(error, meta);
    record.status = classification.retryable ? "degraded" : "unavailable";
    record.recentFailureCount += 1;
    record.consecutiveFailures += 1;
    record.lastFailureReason = classification.reason;
    record.lastPublicMessage = classification.publicMessage;
    record.lastFailureAt = at;
    record.lastCheckedAt = at;
    record.failuresByReason[classification.reason] = cleanNumber(record.failuresByReason[classification.reason], 0) + 1;
    if (record.consecutiveFailures >= circuitBreakerFailures) {
      record.status = "unavailable";
      record.circuitOpenUntilMs = nowMs + circuitBreakerCooldownMs;
    }
    record.recentEvents.push({
      at,
      status: "failed",
      reason: classification.reason,
      latencyMs: cleanNumber(meta.latencyMs, 0)
    });
    trimRecentEvents(record);
    return summarizeProviderRecord(record, nowMs);
  }

  function shouldShortCircuit(meta = {}) {
    const nowMs = now();
    const record = getRecord(meta);
    return Number(record.circuitOpenUntilMs) > nowMs;
  }

  function getPublicSnapshot() {
    const nowMs = now();
    return summarizeProviderHealth([...records.values()], nowMs, nowIso(nowMs));
  }

  return {
    schemaVersion: PROVIDER_HEALTH_SCHEMA_VERSION,
    classifyProviderFailure,
    getPublicSnapshot,
    recordFailure,
    recordSuccess,
    shouldShortCircuit
  };
}

function assertPublicProviderHealthSummary(summary) {
  assertPublicAiProviderEnvelope(summary);
  if (isPlainObject(summary) && Array.isArray(summary.providers)) {
    assertAllowedObjectKeys(summary, PROVIDER_HEALTH_TOP_LEVEL_KEYS, "top-level");
    summary.providers.forEach((record, index) => {
      assertProviderHealthRecordShape(record, `providers.${index}`);
    });
  } else if (isPlainObject(summary) && "failuresByReason" in summary) {
    assertProviderHealthRecordShape(summary);
  }
  const serialized = JSON.stringify(summary);
  if (FORBIDDEN_PUBLIC_HEALTH_TEXT_PATTERN.test(serialized)) {
    throw new Error("Public AI provider health contains forbidden raw diagnostic content.");
  }
  if (SENSITIVE_ASSIGNMENT_PATTERN.test(serialized)) {
    throw new Error("Public AI provider health contains forbidden sensitive assignment.");
  }
  if (INTERNAL_REF_PATTERN.test(serialized)) {
    throw new Error("Public AI provider health contains forbidden server internal reference.");
  }
  return summary;
}

module.exports = {
  PROVIDER_HEALTH_FAILURE_REASONS,
  PROVIDER_HEALTH_SCHEMA_VERSION,
  assertPublicProviderHealthSummary,
  classifyProviderFailure,
  createProviderHealthManager,
  summarizeProviderHealth
};
