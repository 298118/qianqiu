const {
  SESSION_SUMMARY_LIMITS,
  SESSION_SUMMARY_SCHEMA_VERSION
} = require("./actorMemoryConfig");
const { buildEventArchiveIndexItems } = require("./eventArchive");
const { formatYearMonthPeriod, normalizeMonth, normalizeTenDayPeriod, normalizeYear } = require("./time");

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_SESSION_SUMMARY_PATTERN =
  /(hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|actorMemoryLedger|sessionSummary|sealedMapping|sealed_mapping|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:provider|prompt|proposal|statePatch|worldState|rawSql)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function redactSecrets(value) {
  let text = String(value ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const raw = String(secret);
    for (const variant of [raw, raw.slice(0, 8), raw.slice(0, 12), raw.slice(-8), raw.slice(-12)]) {
      if (variant && variant.length >= 8) text = text.split(variant).join("[redacted]");
    }
  }

  text = text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/\btp-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/\bfile:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+/gi, "[redacted-path]");
  text = text.replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]");
  text = text.replace(/(^|\s)(?:\.{0,2}[\\/])?data[\\/][^\s"'<>]+/g, "$1[redacted-path]");
  text = text.replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/g, "[redacted-path]");
  return text;
}

function cleanText(value, fallback = "", maxLength = SESSION_SUMMARY_LIMITS.maxSummaryLength) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw || SENSITIVE_SESSION_SUMMARY_PATTERN.test(raw)) return fallback;
  const redacted = redactSecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_SESSION_SUMMARY_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanList(values, limit, maxLength = SESSION_SUMMARY_LIMITS.maxHighlightLength) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = isPlainObject(value)
      ? cleanText(value.summary || value.publicSummary || value.title || value.label, "", maxLength)
      : cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function createInitialSessionSummaryState() {
  return {
    schemaVersion: SESSION_SUMMARY_SCHEMA_VERSION,
    lastPeriodKey: null,
    monthlySummaries: []
  };
}

function normalizeDate(worldState = {}, source = {}) {
  const candidate = isPlainObject(source) ? source : {};
  const date = {
    dynasty: candidate.dynasty || worldState.dynasty || "",
    year: normalizeYear(candidate.year ?? worldState.year),
    month: normalizeMonth(candidate.month ?? worldState.month),
    tenDayPeriod: normalizeTenDayPeriod(candidate.tenDayPeriod ?? worldState.tenDayPeriod),
    turn: clampNumber(candidate.turn ?? candidate.turnCount ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
  return {
    ...date,
    dateLabel: cleanText(candidate.dateLabel || candidate.label, formatYearMonthPeriod(date), 80)
  };
}

function normalizeSourceRefs(sourceRefs = []) {
  const normalized = [];
  const seen = new Set();
  for (const ref of Array.isArray(sourceRefs) ? sourceRefs : []) {
    if (!isPlainObject(ref)) continue;
    const id = cleanId(ref.id || ref.sourceId || ref.refId, "");
    const sourceView = cleanText(ref.sourceView || ref.sourceType || ref.source, "server_projection", 80);
    const label = cleanText(ref.label || ref.title || id, id || sourceView, 80);
    const key = `${sourceView}:${id || label}`;
    if (!label || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ id, sourceView, label });
    if (normalized.length >= SESSION_SUMMARY_LIMITS.maxSourceRefs) break;
  }
  return normalized;
}

function normalizeMonthlySummary(summary = {}, worldState = {}) {
  if (!isPlainObject(summary)) return null;
  const periodKey = cleanId(summary.periodKey, "");
  const publicSummary = cleanText(summary.publicSummary || summary.summary, "", SESSION_SUMMARY_LIMITS.maxSummaryLength);
  if (!periodKey || !publicSummary) return null;
  const generatedAt = normalizeDate(worldState, summary.generatedAt);
  return {
    id: cleanId(summary.id, `SS-${periodKey}-${String(generatedAt.turn).padStart(4, "0")}`),
    schemaVersion: SESSION_SUMMARY_SCHEMA_VERSION,
    periodKey,
    periodLabel: cleanText(summary.periodLabel, periodKey, 60),
    generatedAtTurn: clampNumber(summary.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, generatedAt.turn),
    generatedAt,
    publicSummary,
    highlights: cleanList(summary.highlights, SESSION_SUMMARY_LIMITS.maxHighlights),
    sourceRefs: normalizeSourceRefs(summary.sourceRefs),
    aiReadScope: cleanList(summary.aiReadScope, 8, 80),
    authorityBoundary: cleanText(
      summary.authorityBoundary,
      "sessionSummary 只保存服务器清洗后的玩家可见月度摘要；模型不能写隐藏事实、原始提案或数据库记录。",
      160
    )
  };
}

function normalizeSessionSummaryState(rawState, worldState = {}) {
  const normalized = createInitialSessionSummaryState();
  const source = isPlainObject(rawState) ? rawState : {};
  normalized.monthlySummaries = (Array.isArray(source.monthlySummaries) ? source.monthlySummaries : [])
    .map((summary) => normalizeMonthlySummary(summary, worldState))
    .filter(Boolean)
    .slice(-SESSION_SUMMARY_LIMITS.maxMonthlySummaries);
  normalized.lastPeriodKey = cleanId(source.lastPeriodKey, "") ||
    normalized.monthlySummaries.at(-1)?.periodKey ||
    null;
  return normalized;
}

function ensureSessionSummaryState(worldState = {}) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.sessionSummary = normalizeSessionSummaryState(worldState.sessionSummary, worldState);
  return worldState;
}

function periodFromMonthResult(worldState = {}, monthResult = {}) {
  const from = monthResult.worldTick?.timeAdvance?.from || monthResult.period || worldState;
  const year = normalizeYear(from.year ?? worldState.year);
  const month = normalizeMonth(from.month ?? worldState.month);
  const date = {
    dynasty: worldState.dynasty || "",
    year,
    month,
    tenDayPeriod: normalizeTenDayPeriod(from.tenDayPeriod ?? 3, 3)
  };
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${worldState.dynasty || ""}${year}年${month}月`,
    date: {
      ...date,
      dateLabel: formatYearMonthPeriod(date),
      turn: currentTurn(worldState)
    }
  };
}

function summarizeRecentEvents(worldState = {}) {
  return buildEventArchiveIndexItems(worldState)
    .filter((item) => item.sourceType === "event_history" || item.sourceType === "monthly_briefing")
    .slice(0, 6)
    .map((item) => item.summary || item.title);
}

function sourceRef(sourceView, row = {}, fallbackLabel = "") {
  const id = cleanId(row.id || row.reportId || row.sourceId, "");
  const label = cleanText(row.label || row.title || row.publicSummary || row.summary, fallbackLabel || sourceView, 80);
  return label ? { id, sourceView, label } : null;
}

function buildMonthlySummary(worldState = {}, monthResult = {}, options = {}) {
  const period = periodFromMonthResult(worldState, monthResult);
  const briefing = monthResult.playerMonthlyBriefing || {};
  const relationshipHighlights = (Array.isArray(monthResult.relationshipChanges) ? monthResult.relationshipChanges : [])
    .map((change) => `${change.name || change.targetId || "人物"}：情分${change.relationship?.delta ?? 0}，怨望${change.resentment?.delta ?? 0}`);
  const eventHighlights = summarizeRecentEvents(worldState);
  const officialHighlights = cleanList([
    monthResult.officialCareer?.summary,
    ...(Array.isArray(monthResult.officialCareer?.events) ? monthResult.officialCareer.events : [])
  ], 3);
  const briefingHighlights = cleanList([
    briefing.summary,
    ...(Array.isArray(briefing.events) ? briefing.events : [])
  ], 3);
  const highlights = cleanList([
    ...briefingHighlights,
    ...officialHighlights,
    ...relationshipHighlights,
    ...eventHighlights
  ], SESSION_SUMMARY_LIMITS.maxHighlights);
  const roleLabel = cleanText(worldState.player?.roleLabel || worldState.player?.role, "玩家", 40);
  const publicSummary = cleanText(
    briefing.summary ||
      highlights[0] ||
      `${period.label}，${roleLabel}经历按近事、关系、人脉和本职差事压缩为月度摘要。`,
    `${period.label}，本月经历已压缩为玩家可见摘要。`,
    SESSION_SUMMARY_LIMITS.maxSummaryLength
  );
  const generatedAt = normalizeDate(worldState, worldState);
  return normalizeMonthlySummary({
    id: `SS-${period.key}-${String(generatedAt.turn).padStart(4, "0")}`,
    periodKey: period.key,
    periodLabel: period.label,
    generatedAtTurn: generatedAt.turn,
    generatedAt,
    publicSummary,
    highlights,
    sourceRefs: [
      sourceRef("playerMonthlyBriefingView", { id: briefing.reportId, publicSummary: briefing.summary }, "官职月报"),
      sourceRef("eventArchiveView", { id: `EA-${period.key}`, publicSummary: eventHighlights[0] }, "近事入档")
    ].filter(Boolean),
    aiReadScope: [
      "eventArchiveView",
      "relationshipView",
      "playerMonthlyBriefingView",
      "officialCareerView",
      "actorMemoryView"
    ],
    authorityBoundary: options.authorityBoundary
  }, worldState);
}

function updateMonthlySessionSummary(worldState = {}, monthResult = {}, aiRuntime = null, options = {}) {
  ensureSessionSummaryState(worldState);
  if (!monthResult.worldTick?.completedMonth && options.force !== true) {
    return { updated: false, reason: "not_month_end", summary: null, durationMs: 0 };
  }
  const startedAt = Date.now();
  const period = periodFromMonthResult(worldState, monthResult);
  if (!options.allowDuplicate && worldState.sessionSummary.lastPeriodKey === period.key) {
    return {
      updated: false,
      reason: "period_already_recorded",
      summary: null,
      durationMs: Date.now() - startedAt
    };
  }
  const summary = buildMonthlySummary(worldState, monthResult, options);
  worldState.sessionSummary.monthlySummaries.push(summary);
  worldState.sessionSummary.monthlySummaries = worldState.sessionSummary.monthlySummaries
    .slice(-SESSION_SUMMARY_LIMITS.maxMonthlySummaries);
  worldState.sessionSummary.lastPeriodKey = summary.periodKey;
  return {
    updated: true,
    reason: "monthly_session_summary_recorded",
    summary,
    durationMs: Date.now() - startedAt,
    aiRuntime: aiRuntime ? { taskType: "memory_summarizer" } : null
  };
}

function summarizeRecentPlayerHistory(worldState = {}, options = {}) {
  const state = normalizeSessionSummaryState(worldState.sessionSummary, worldState);
  const summaries = state.monthlySummaries
    .slice(-(options.limit || SESSION_SUMMARY_LIMITS.maxPromptSummaries))
    .map((summary) => ({
      periodKey: summary.periodKey,
      periodLabel: summary.periodLabel,
      publicSummary: summary.publicSummary,
      highlights: summary.highlights.slice(0, SESSION_SUMMARY_LIMITS.maxHighlights),
      sourceRefs: summary.sourceRefs
    }));
  return {
    schemaVersion: SESSION_SUMMARY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    recentMonthlySummaries: summaries,
    authorityBoundary: "recentPlayerHistory 只读服务器清洗后的玩家可见月度摘要；不得从原始状态、原始审计、模型原始提案、完整提示词或 SQLite raw table 推断隐藏事实。"
  };
}

function buildSessionSummaryView(worldState = {}) {
  const state = normalizeSessionSummaryState(worldState.sessionSummary, worldState);
  return {
    schemaVersion: SESSION_SUMMARY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    latest: state.monthlySummaries.at(-1) || null,
    recentMonthlySummaries: state.monthlySummaries.slice(-SESSION_SUMMARY_LIMITS.maxViewSummaries),
    hiddenNotice: "经历摘要只展示服务器清洗后的玩家可见月度压缩；隐藏事实、原始提示词、模型原始提案、本地路径和密钥不会暴露。"
  };
}

module.exports = {
  buildSessionSummaryView,
  createInitialSessionSummaryState,
  ensureSessionSummaryState,
  normalizeSessionSummaryState,
  summarizeRecentPlayerHistory,
  updateMonthlySessionSummary
};
