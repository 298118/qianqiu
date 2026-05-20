const { redactSecrets } = require("../ai/diagnostics");
const { buildAiInvocationSummaryView, resolveAiSettingsForSession } = require("./aiSettings");
const { buildActorMemoryView } = require("./actorMemoryLedger");
const { buildEventArchiveView } = require("./eventArchive");
const { buildPlayerMonthlyBriefingView } = require("./playerMonthlyBriefing");
const { buildSessionSummaryView } = require("./sessionSummary");

const AI_CONTROL_AUDIT_SCHEMA_VERSION = "s71.11-ai-control-audit.v1";

const AI_CONTROL_AUDIT_LIMITS = Object.freeze({
  maxPublicResults: 8,
  maxRecentInvocations: 8,
  maxMemoryUpdates: 4,
  maxRejectedReasons: 8,
  maxTextLength: 180
});

const SENSITIVE_AI_AUDIT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|actorMemoryLedger|sessionSummary|relationshipLedger|retrievalContext|sealedMapping|sealed_mapping|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row)|provider\s+proposal|prompt[_ -]?(?:text|pack|payload)?|\b(?:statePatch|rawSql)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|(?:^|[\s"'(<:=,;：])\/(?:[A-Za-z0-9._-]+\/)+[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = AI_CONTROL_AUDIT_LIMITS.maxTextLength) {
  const source = String(value ?? "");
  if (!source || SENSITIVE_AI_AUDIT_PATTERN.test(source)) return fallback;
  const text = redactSecrets(source)
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/\btp-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/\bfile:\/\/\/?[^\s"'<>]+/gi, "[redacted-path]")
    .replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]")
    .replace(/(^|[\s"'(<:=,;：])\/(?:[A-Za-z0-9._-]+\/)+[^\s"'<>]+/g, "$1[redacted-path]")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || SENSITIVE_AI_AUDIT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanToken(value, fallback = "", maxLength = 80) {
  const text = cleanText(value, fallback, maxLength);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanStrictToken(value, fallback = "", maxLength = 80) {
  const source = String(value ?? "");
  if (!source || SENSITIVE_AI_AUDIT_PATTERN.test(source)) return fallback;
  return cleanToken(redactSecrets(source), fallback, maxLength);
}

function summarizePublicResult(source, fallbackKind = "public_result") {
  if (!isPlainObject(source)) return null;
  const title = cleanText(source.title || source.sourceLabel || source.typeLabel, "", 80);
  const summary = cleanText(source.summary || source.publicSummary || source.body, "", 160);
  if (!title && !summary) return null;
  return {
    kind: cleanToken(source.sourceType || source.type || fallbackKind, fallbackKind, 48),
    title: title || summary,
    summary: summary || title,
    status: cleanToken(source.status || "recorded", "recorded", 40),
    statusLabel: cleanText(source.statusLabel || source.status || "已记录", "已记录", 40),
    visibility: cleanToken(source.visibility || "public", "public", 40),
    dateLabel: cleanText(source.dateLabel, "", 40),
    turn: clampInteger(source.turn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function buildPublicResults(worldState = {}) {
  const eventArchive = buildEventArchiveView(worldState, {
    pageSize: AI_CONTROL_AUDIT_LIMITS.maxPublicResults
  });
  const eventResults = asArray(eventArchive.items)
    .map((item) => summarizePublicResult(item, "event_archive"))
    .filter(Boolean);
  const memoryView = buildActorMemoryView(worldState);
  const memoryResults = asArray(memoryView.recentUpdates)
    .slice(-AI_CONTROL_AUDIT_LIMITS.maxMemoryUpdates)
    .map((item) => summarizePublicResult({
      sourceType: "actor_memory",
      title: [item.actorLabel, item.type].filter(Boolean).join(" · "),
      summary: item.summary,
      status: item.status,
      visibility: "player_visible",
      turn: item.turn
    }, "actor_memory"))
    .filter(Boolean);
  const monthly = buildPlayerMonthlyBriefingView(worldState).latest;
  const monthlyResult = monthly ? summarizePublicResult({
    sourceType: "monthly_briefing",
    title: monthly.title || "官职月报",
    summary: monthly.publicSummary,
    status: "recorded",
    visibility: "player_visible",
    turn: monthly.generatedAtTurn
  }, "monthly_briefing") : null;
  const sessionSummary = buildSessionSummaryView(worldState).latest;
  const sessionSummaryResult = sessionSummary ? summarizePublicResult({
    sourceType: "session_summary",
    title: sessionSummary.periodLabel || "经历摘要",
    summary: sessionSummary.publicSummary,
    status: "recorded",
    visibility: "player_visible",
    turn: sessionSummary.generatedAt?.turn
  }, "session_summary") : null;

  return [
    ...eventResults,
    ...memoryResults,
    monthlyResult,
    sessionSummaryResult
  ].filter(Boolean).slice(0, AI_CONTROL_AUDIT_LIMITS.maxPublicResults);
}

function summarizeInvocation(item = {}) {
  return {
    taskType: cleanToken(item.taskType, "narrator", 40),
    label: cleanText(item.label || item.taskType, "AI 调动", 40),
    provider: cleanStrictToken(item.provider, "mock", 40),
    model: cleanText(item.model, "mock", 96),
    status: cleanToken(item.status, "completed", 32),
    durationMs: clampInteger(item.durationMs, 0, 300000, 0),
    maxOutputTokens: clampInteger(item.maxOutputTokens, 0, 16000, 0),
    toolCallCount: clampInteger(item.toolCallCount, 0, 100, 0),
    rejectedToolCallCount: clampInteger(item.rejectedToolCallCount, 0, 100, 0),
    recordedTurn: clampInteger(item.recordedTurn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function summarizeRejectedReasons(reasons = []) {
  return [...new Set(asArray(reasons)
    .map((reason) => cleanText(reason, "已脱敏拒绝原因。", 100))
    .filter(Boolean))]
    .slice(0, AI_CONTROL_AUDIT_LIMITS.maxRejectedReasons);
}

function buildAiControlAuditView(worldState = {}, options = {}) {
  const routePolicy = options.routePolicy || resolveAiSettingsForSession(worldState).routePolicy;
  const invocationSummary = options.aiInvocationSummaryView || buildAiInvocationSummaryView(worldState, routePolicy);
  const publicResults = buildPublicResults(worldState);
  const recentInvocations = asArray(invocationSummary.recentInvocations)
    .slice(-AI_CONTROL_AUDIT_LIMITS.maxRecentInvocations)
    .map(summarizeInvocation);
  const toolCallSummary = invocationSummary.toolCallSummary || {};
  const routeCostSummary = invocationSummary.routeCostSummary || {};
  const rejectedReasons = summarizeRejectedReasons(toolCallSummary.rejectionReasons);
  const publicResultCount = publicResults.length;
  const invocationCount = recentInvocations.length;
  const rejectedToolCount = clampInteger(toolCallSummary.recentRejectedToolCalls, 0, 1000, 0);

  return {
    schemaVersion: AI_CONTROL_AUDIT_SCHEMA_VERSION,
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    publicPanel: {
      title: "AI 调动审计",
      summary: `近次可见调动 ${invocationCount} 条，公开结果 ${publicResultCount} 条，工具拒绝 ${rejectedToolCount} 条。`,
      publicResultCount,
      rejectedToolCallCount: rejectedToolCount,
      publicResults
    },
    developerPanel: {
      localOnly: true,
      routeCostSummary: {
        taskCount: clampInteger(routeCostSummary.taskCount, 0, 100, 0),
        maxOutputTokens: clampInteger(routeCostSummary.maxOutputTokens, 0, 100000, 0),
        maxToolCalls: clampInteger(routeCostSummary.maxToolCalls, 0, 1000, 0),
        providers: asArray(routeCostSummary.providers).map((provider) => cleanStrictToken(provider, "", 40)).filter(Boolean).slice(0, 8),
        unavailableProviders: asArray(routeCostSummary.unavailableProviders).map((provider) => cleanStrictToken(provider, "", 40)).filter(Boolean).slice(0, 8),
        reviewerOnlyTasks: asArray(routeCostSummary.reviewerOnlyTasks).map((task) => cleanToken(task, "", 40)).filter(Boolean).slice(0, 8)
      },
      toolCallSummary: {
        recentToolCalls: clampInteger(toolCallSummary.recentToolCalls, 0, 1000, 0),
        recentRejectedToolCalls: rejectedToolCount,
        rejectionReasons: rejectedReasons
      },
      recentInvocations,
      proposalBoundaries: [
        {
          label: "模型只能提交建议",
          status: "server_adjudicated",
          summary: "状态推进、任免、判案、战和、数据库写入和记忆落账仍由服务器裁决。"
        },
        {
          label: "玩家只见公开结果",
          status: "player_visible",
          summary: "面板只汇总 route view、公开事件、可见记忆和脱敏调动统计。"
        }
      ],
      safety: {
        promptTextIncluded: false,
        modelOriginalTextIncluded: false,
        databaseRowsIncluded: false,
        hiddenLedgersIncluded: false,
        localPathsIncluded: false,
        secretValuesIncluded: false
      }
    },
    hiddenNotice: "本面板只展示服务器清洗后的调动摘要、公开结果和本机安全诊断；原始提示、模型原文、隐藏账本、数据库行、本地路径和密钥不会展示。"
  };
}

function buildAiControlAuditDiagnostics(worldState = {}, options = {}) {
  const view = buildAiControlAuditView(worldState, options);
  return {
    schemaVersion: view.schemaVersion,
    generatedAtTurn: view.generatedAtTurn,
    publicResultCount: view.publicPanel.publicResultCount,
    rejectedToolCallCount: view.publicPanel.rejectedToolCallCount,
    routeCostSummary: view.developerPanel.routeCostSummary,
    toolCallSummary: view.developerPanel.toolCallSummary,
    recentInvocations: view.developerPanel.recentInvocations,
    safety: view.developerPanel.safety
  };
}

module.exports = {
  AI_CONTROL_AUDIT_SCHEMA_VERSION,
  buildAiControlAuditDiagnostics,
  buildAiControlAuditView
};
