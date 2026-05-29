// @ts-check

const { AI_TASK_LABELS } = require("./aiSettingsConfig");
const {
  ensureAiSettingsState,
  buildAiInvocationSummaryView,
  resolveAiSettingsForSession
} = require("./aiSettings");
const {
  AI_TASK_TRACE_SCHEMA_VERSION,
  assertPublicAiTaskTrace,
  summarizeAiTaskTrace,
  summarizeRetrievalCounts,
  summarizeToolCounts,
  summarizeValidationFlags
} = require("../ai/runtime/aiTaskTrace");
const {
  assertPublicAiProviderEnvelope,
  redactAiProviderText
} = require("../ai/providerSafety");

const AI_TRACE_DEBUG_SCHEMA_VERSION = "s92.9-ai-trace-debug-view.v1";
const AI_TRACE_FEEDBACK_SCHEMA_VERSION = "s92.9-ai-trace-feedback.v1";

const AI_TRACE_DEBUG_LIMITS = Object.freeze({
  maxTraces: 8,
  maxFeedbackLog: 24,
  maxRecentFeedback: 8,
  maxTextLength: 96
});

const AI_TRACE_FEEDBACK_OPTIONS = Object.freeze([
  Object.freeze({ id: "useful", label: "有用" }),
  Object.freeze({ id: "off_tone", label: "出戏" }),
  Object.freeze({ id: "forgot_context", label: "忘记前情" }),
  Object.freeze({ id: "too_short", label: "太短" }),
  Object.freeze({ id: "too_long", label: "太长" }),
  Object.freeze({ id: "role_mismatch", label: "不符合身份" })
]);

const AI_TRACE_DEBUG_VIEW_KEYS = Object.freeze([
  "schemaVersion",
  "sessionId",
  "generatedAtTurn",
  "traceCount",
  "traces",
  "feedbackOptions",
  "recentFeedback",
  "safety"
]);
const AI_TRACE_FEEDBACK_OPTION_KEYS = Object.freeze(["id", "label"]);
const AI_TRACE_FEEDBACK_ENTRY_KEYS = Object.freeze([
  "schemaVersion",
  "feedbackRecordId",
  "traceId",
  "taskType",
  "taskLabel",
  "feedbackId",
  "label",
  "recordedTurn",
  "createdAt",
  "changesGameState"
]);
const AI_TRACE_SAFETY_KEYS = Object.freeze([
  "publicSummaryOnly",
  "providerTextIncluded",
  "localFilesIncluded",
  "secretValuesIncluded",
  "browserAdjudication",
  "feedbackChangesGameState"
]);
const AI_TRACE_FEEDBACK_REQUEST_KEYS = Object.freeze(["traceId", "feedbackId", "feedback"]);
const PUBLIC_TRACE_TEXT_FORBIDDEN_PATTERN =
  /\b(rawPrompt|providerPayload|rawProviderPayload|rawPayload|fullPrompt|worldState|statePatch|rawSql|sqlite|world_sessions|safe_search_index|apiKey|baseUrl|baseURL|base_url|localPath|hiddenNotes|privateResultRefs|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY)\b/i;
const PUBLIC_TRACE_SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(?:prompt|instructions|input|request|response|headers|apiKey|api[-_\s]?key|key|token|baseURL|baseUrl|base_url|localPath|worldState|statePatch)\s*[:=]/i;
const PUBLIC_TRACE_INTERNAL_REF_PATTERN = /\bserver\.[A-Za-z0-9_.-]+/;
const PUBLIC_TRACE_SECRET_TOKEN_PATTERN = /\b(?:sk|tp)-[A-Za-z0-9_-]{6,}\b/i;
const PUBLIC_TRACE_LOCAL_PATH_PATTERN =
  /(?:data[\\/](?:sessions|audit)|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

const TRACE_STATUS_MAP = Object.freeze({
  completed: "ok",
  streamed: "ok",
  ok: "ok",
  fallback: "fallback",
  failed: "failed",
  error: "failed",
  rejected: "rejected",
  running: "running"
});

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampInteger(value, min, max, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @param {number} [maxLength]
 */
function cleanText(value, fallback = "", maxLength = AI_TRACE_DEBUG_LIMITS.maxTextLength) {
  const redacted = redactAiProviderText(value, { maxLength });
  const text = String(redacted || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @param {number} [maxLength]
 */
function cleanToken(value, fallback = "", maxLength = 80) {
  const text = cleanText(value, fallback, maxLength)
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || fallback;
}

/**
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error & { statusCode: number }}
 */
function createTraceError(statusCode, message) {
  const error = /** @type {Error & { statusCode: number }} */ (new Error(message));
  error.statusCode = statusCode;
  return error;
}

function cleanTraceId(value, fallback) {
  return cleanToken(value, fallback, 120);
}

function normalizeTraceStatus(value) {
  const status = cleanToken(value, "failed", 32);
  return TRACE_STATUS_MAP[status] || "failed";
}

function feedbackOptionById(feedbackId) {
  const id = cleanToken(feedbackId, "", 64);
  return AI_TRACE_FEEDBACK_OPTIONS.find((option) => option.id === id) || null;
}

function assertAllowedKeys(value, allowedKeys, label) {
  if (!isPlainObject(value)) {
    throw new Error(`AI 回声公开视图 ${label} 必须是对象。`);
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`AI 回声公开视图含有禁止字段：${label}.${key}`);
    }
  }
}

function assertPublicTraceText(value, label) {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPublicTraceText(entry, `${label}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertPublicTraceText(entry, `${label}.${key}`);
    }
    return;
  }
  const rawText = String(value || "").replace(/\s+/g, " ").trim();
  if (
    PUBLIC_TRACE_TEXT_FORBIDDEN_PATTERN.test(rawText) ||
    PUBLIC_TRACE_SENSITIVE_ASSIGNMENT_PATTERN.test(rawText) ||
    PUBLIC_TRACE_INTERNAL_REF_PATTERN.test(rawText) ||
    PUBLIC_TRACE_SECRET_TOKEN_PATTERN.test(rawText) ||
    PUBLIC_TRACE_LOCAL_PATH_PATTERN.test(rawText)
  ) {
    throw new Error(`AI 回声公开视图含有禁止文本：${label}`);
  }
  const text = cleanText(value, "", 240);
  if (
    PUBLIC_TRACE_TEXT_FORBIDDEN_PATTERN.test(text) ||
    PUBLIC_TRACE_SENSITIVE_ASSIGNMENT_PATTERN.test(text) ||
    PUBLIC_TRACE_INTERNAL_REF_PATTERN.test(text) ||
    PUBLIC_TRACE_SECRET_TOKEN_PATTERN.test(text) ||
    PUBLIC_TRACE_LOCAL_PATH_PATTERN.test(text)
  ) {
    throw new Error(`AI 回声公开视图含有禁止文本：${label}`);
  }
}

function assertFeedbackRequestShape(request) {
  assertAllowedKeys(request, AI_TRACE_FEEDBACK_REQUEST_KEYS, "feedbackRequest");
}

function inferValidationFlags(item = {}, status = "ok") {
  const source = isPlainObject(item.validationFlags) ? item.validationFlags : {};
  return summarizeValidationFlags({
    schemaOk: source.schemaOk ?? status !== "failed",
    guardrailOk: source.guardrailOk ?? status !== "rejected",
    redactionOk: source.redactionOk ?? true
  });
}

function publicTraceFromInvocation(item = {}, index = 0) {
  if (isPlainObject(item.publicTraceSummary)) {
    const summary = summarizeAiTaskTrace(item.publicTraceSummary);
    assertPublicAiTaskTrace(summary);
    return summary;
  }

  const taskType = cleanToken(item.taskType, "narrator", 64);
  const status = normalizeTraceStatus(item.status);
  const trace = summarizeAiTaskTrace({
    schemaVersion: AI_TASK_TRACE_SCHEMA_VERSION,
    traceId: cleanTraceId(item.traceId, `ai-trace:${clampInteger(item.recordedTurn, 0, Number.MAX_SAFE_INTEGER, 0)}:${taskType}:${index}`),
    taskKind: cleanToken(item.taskKind || item.taskType, taskType, 64),
    taskType,
    promptPackId: cleanToken(item.promptPackId || item.taskType, taskType, 64),
    promptVersion: cleanToken(item.promptVersion, "legacy", 64),
    provider: cleanToken(item.provider, "mock", 64),
    model: cleanText(item.model, "mock", 96),
    latencyMs: clampInteger(item.latencyMs ?? item.durationMs, 0, 300000, 0),
    status,
    fallbackReason: status === "fallback" ? cleanToken(item.fallbackReason, "provider_fallback", 80) : cleanToken(item.fallbackReason, "", 80),
    retrievalCounts: summarizeRetrievalCounts(item.retrievalCounts),
    toolCounts: summarizeToolCounts({
      ...item.toolCounts,
      allowed: item.toolCounts?.allowed ?? item.maxToolCalls ?? item.toolBudget ?? 0,
      callCount: item.toolCounts?.callCount ?? item.toolCallCount ?? 0,
      rejected: item.toolCounts?.rejected ?? item.rejectedToolCallCount ?? 0,
      used: item.toolCounts?.used ?? item.toolCallCount ?? 0
    }),
    validationFlags: inferValidationFlags(item, status)
  });
  assertPublicAiTaskTrace(trace);
  return trace;
}

function readPublicTraces(worldState = {}, options = {}) {
  const { routePolicy } = resolveAiSettingsForSession(worldState, options.env || process.env);
  const invocationSummary = buildAiInvocationSummaryView(worldState, routePolicy, options.env || process.env);
  return asArray(invocationSummary.recentInvocations)
    .slice(-AI_TRACE_DEBUG_LIMITS.maxTraces)
    .map(publicTraceFromInvocation);
}

function normalizeFeedbackEntry(entry = {}) {
  const feedbackOption = feedbackOptionById(entry.feedbackId || entry.feedback);
  if (!feedbackOption) return null;
  const taskType = cleanToken(entry.taskType, "narrator", 64);
  const traceId = cleanTraceId(entry.traceId, "");
  if (!traceId) return null;
  return {
    schemaVersion: AI_TRACE_FEEDBACK_SCHEMA_VERSION,
    feedbackRecordId: cleanTraceId(entry.feedbackRecordId || entry.id, `ai-feedback:${traceId}:${feedbackOption.id}`),
    traceId,
    taskType,
    taskLabel: cleanText(entry.taskLabel || AI_TASK_LABELS[taskType], AI_TASK_LABELS[taskType] || "推演调动", 40),
    feedbackId: feedbackOption.id,
    label: feedbackOption.label,
    recordedTurn: clampInteger(entry.recordedTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    createdAt: cleanText(entry.createdAt, new Date().toISOString(), 64),
    changesGameState: false
  };
}

function readFeedbackLog(worldState = {}) {
  const settings = ensureAiSettingsState(worldState);
  const feedbackLog = asArray(settings.observability?.traceFeedback)
    .map(normalizeFeedbackEntry)
    .filter(Boolean);
  settings.observability.traceFeedback = feedbackLog.slice(-AI_TRACE_DEBUG_LIMITS.maxFeedbackLog);
  return settings.observability.traceFeedback;
}

function buildAiTraceDebugView(worldState = {}, options = {}) {
  const traces = readPublicTraces(worldState, options);
  const traceIds = new Set(traces.map((trace) => trace.traceId));
  const feedbackLog = readFeedbackLog(worldState)
    .filter((entry) => traceIds.has(entry.traceId) || !traceIds.size)
    .slice(-AI_TRACE_DEBUG_LIMITS.maxRecentFeedback);
  const view = {
    schemaVersion: AI_TRACE_DEBUG_SCHEMA_VERSION,
    sessionId: cleanToken(worldState.sessionId, "", 120),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    traceCount: traces.length,
    traces,
    feedbackOptions: AI_TRACE_FEEDBACK_OPTIONS.map((option) => ({ ...option })),
    recentFeedback: feedbackLog,
    safety: {
      publicSummaryOnly: true,
      providerTextIncluded: false,
      localFilesIncluded: false,
      secretValuesIncluded: false,
      browserAdjudication: false,
      feedbackChangesGameState: false
    }
  };
  assertPublicAiTraceDebugView(view);
  return view;
}

function appendAiTraceFeedback(worldState = {}, request = {}, options = {}) {
  if (!isPlainObject(request)) {
    throw createTraceError(400, "AI 回声反馈必须是对象。");
  }
  try {
    assertFeedbackRequestShape(request);
  } catch (cause) {
    throw createTraceError(400, "AI 回声反馈含有禁止字段。");
  }
  try {
    assertPublicAiProviderEnvelope(request);
  } catch (cause) {
    throw createTraceError(400, "AI 回声反馈含有禁止字段。");
  }
  const traces = readPublicTraces(worldState, options);
  const traceId = cleanTraceId(request.traceId, "");
  const feedbackOption = feedbackOptionById(request.feedbackId || request.feedback);
  if (!traceId || !feedbackOption) {
    throw createTraceError(400, "AI 回声反馈缺少可识别的条目或选项。");
  }
  const trace = traces.find((item) => item.traceId === traceId);
  if (!trace) {
    throw createTraceError(404, "AI 回声条目已过期，请先刷新。");
  }

  const entry = normalizeFeedbackEntry({
    feedbackRecordId: `ai-feedback:${Date.now().toString(36)}:${feedbackOption.id}`,
    traceId,
    taskType: trace.taskType,
    taskLabel: AI_TASK_LABELS[trace.taskType] || trace.taskType,
    feedbackId: feedbackOption.id,
    recordedTurn: worldState.turnCount || 0,
    createdAt: new Date().toISOString()
  });
  const feedbackLog = readFeedbackLog(worldState);
  const settings = ensureAiSettingsState(worldState);
  settings.observability.traceFeedback = [
    ...feedbackLog,
    entry
  ].slice(-AI_TRACE_DEBUG_LIMITS.maxFeedbackLog);
  assertPublicAiProviderEnvelope(entry);

  return {
    entry,
    view: buildAiTraceDebugView(worldState, options)
  };
}

function assertPublicAiTraceDebugView(view) {
  assertPublicAiProviderEnvelope(view);
  assertAllowedKeys(view, AI_TRACE_DEBUG_VIEW_KEYS, "aiTraceDebugView");
  for (const trace of asArray(view.traces)) {
    assertPublicAiTaskTrace(trace);
  }
  for (const option of asArray(view.feedbackOptions)) {
    assertAllowedKeys(option, AI_TRACE_FEEDBACK_OPTION_KEYS, "feedbackOptions");
    if (!feedbackOptionById(option.id) || cleanText(option.label, "", 40) !== option.label) {
      throw new Error("AI 回声公开视图含有无效反馈选项。");
    }
    assertPublicTraceText(option, "feedbackOptions");
  }
  for (const entry of asArray(view.recentFeedback)) {
    assertAllowedKeys(entry, AI_TRACE_FEEDBACK_ENTRY_KEYS, "recentFeedback");
    if (!normalizeFeedbackEntry(entry)) {
      throw new Error("AI 回声公开视图含有无效反馈记录。");
    }
    assertPublicTraceText(entry, "recentFeedback");
  }
  assertAllowedKeys(view.safety, AI_TRACE_SAFETY_KEYS, "safety");
  assertPublicTraceText(view.safety, "safety");
  return view;
}

module.exports = {
  AI_TRACE_DEBUG_SCHEMA_VERSION,
  AI_TRACE_FEEDBACK_OPTIONS,
  AI_TRACE_FEEDBACK_SCHEMA_VERSION,
  appendAiTraceFeedback,
  assertPublicAiTraceDebugView,
  buildAiTraceDebugView,
  readPublicTraces
};
