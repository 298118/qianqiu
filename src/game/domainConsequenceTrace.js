const { buildNpcEconomyView } = require("./npcEconomy");

const DOMAIN_CONSEQUENCE_SCHEMA_VERSION = 1;
const MAX_RECENT_CONSEQUENCES = 8;
const MAX_SOURCE_ROWS = 4;
const MAX_TEXT_LENGTH = 180;
const MAX_SHORT_TEXT_LENGTH = 80;
const MAX_AFFECTED_METRICS = 6;
const INTERNAL_DEDUPE_KEY = Symbol("domainConsequenceDedupeKey");
const SECRET_ENV_NAME_PATTERN = /(?:API|KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const PUBLIC_CONSEQUENCE_STATUSES = new Set(["accepted", "applied", "recorded"]);

const SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent|dossier)|hidden\s+(?:notes?|intent|dossier)|hiddenDossier|sealed[_ -]?mapping|sealedMapping|retrievalContext|actorMemoryLedger|sessionSummary|relationshipLedger|private[_ -]?(?:signal[_ -]?tags?|result[_ -]?refs?|intent|notes?|ledger)|privateSignalTags|privateResultRefs|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw(?:[_ -]?|(?=[A-Z]))(?:provider|evidence|audit|table|ledger|prompt|proposal|state|row)|rawEvidence|(?:outcome[_ -]?id|evidence[_ -]?refs?|state[_ -]?delta|player[_ -]?delta|resource[_ -]?(?:use|cost)|relationship[_ -]?signals?|audit[_ -]?record)|provider(?:Payload|Proposal|Response|Request|Raw)|\b(?:cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const SOURCE_LABELS = Object.freeze({
  city_policy: "地方政策",
  military_diplomacy: "军务外交",
  judicial_case: "刑名案件",
  npc_economy: "人物经济"
});

const SOURCE_KIND_LABELS = Object.freeze({
  city_policy: "政策后果",
  military_diplomacy: "军务后果",
  judicial_case: "刑名后果",
  npc_economy: "经济后果"
});

const METRIC_LABELS = Object.freeze({
  treasury: "府库",
  grainReserve: "粮储",
  publicOrder: "民心",
  taxRate: "税率",
  corruption: "贪腐",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.performanceMerit": "考成",
  "player.cleanReputation": "清望",
  "player.impeachmentRisk": "参劾风险",
  "player.superiorFavor": "上官眷注",
  "player.pendingLawsuits": "词讼",
  "player.banditPressure": "盗匪",
  "player.gentryRelations": "乡绅",
  "player.localOrder": "地方民心",
  "player.scouting": "斥候",
  "player.campaignRisk": "战险",
  "player.supply": "本部粮饷",
  "player.command": "统率",
  "player.battleReputation": "战名"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (containsConfiguredSecret(text)) return fallback;
  if (!text || SENSITIVE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function stablePublicSuffix(value) {
  const text = String(value ?? "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 31) + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36) || "0";
}

function containsConfiguredSecret(text) {
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret) continue;
    const value = String(secret);
    if (value.length < 8) continue;
    const variants = new Set([value, value.slice(0, 8), value.slice(0, 12), value.slice(-8), value.slice(-12)]);
    for (const variant of variants) {
      if (variant.length >= 8 && text.includes(variant)) return true;
    }
  }
  return false;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDateParts(worldState = {}, row = {}) {
  return {
    year: clampNumber(row.year ?? worldState.year, 1, 9999, 1644),
    month: clampNumber(row.month ?? worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(row.tenDayPeriod ?? worldState.tenDayPeriod, 1, 3, 1)
  };
}

function metricImpactFromDelta(path, delta) {
  const value = Number(delta);
  if (!Number.isFinite(value) || value === 0) return null;
  const safePath = cleanId(path, "");
  if (!safePath || !METRIC_LABELS[path]) return null;
  return {
    path: safePath,
    label: METRIC_LABELS[path],
    direction: value > 0 ? "up" : "down",
    magnitude: Math.abs(value) >= 5 ? "high" : Math.abs(value) >= 2 ? "medium" : "low"
  };
}

function buildAffectedMetrics(stateDelta = {}, playerDelta = {}) {
  const metrics = [];
  for (const [path, delta] of Object.entries(isPlainObject(stateDelta) ? stateDelta : {})) {
    const metric = metricImpactFromDelta(path, delta);
    if (metric) metrics.push(metric);
  }
  for (const [key, delta] of Object.entries(isPlainObject(playerDelta) ? playerDelta : {})) {
    const metric = metricImpactFromDelta(`player.${key}`, delta);
    if (metric) metrics.push(metric);
  }
  const seen = new Set();
  return metrics.filter((metric) => {
    if (seen.has(metric.path)) return false;
    seen.add(metric.path);
    return true;
  }).slice(0, MAX_AFFECTED_METRICS);
}

function severityFromMetrics(metrics = [], sourceType = "") {
  if (sourceType === "military_diplomacy" && metrics.some((metric) =>
    metric.path === "borderThreat" || metric.path === "player.campaignRisk"
  )) {
    return 2;
  }
  if (metrics.some((metric) =>
    metric.magnitude === "high" ||
    metric.path === "player.impeachmentRisk" ||
    metric.path === "player.pendingLawsuits"
  )) {
    return 2;
  }
  return 1;
}

function buildConsequenceRefs(sourceType, sourceId) {
  return [
    `domainConsequence:${sourceType}:${sourceId}`,
    `eventArchive:${sourceType}`,
    `worldThread:${sourceType}`,
    `monthlyBriefing:${sourceType}`
  ].map((ref) => cleanId(ref, "")).filter(Boolean);
}

function buildNextStep(sourceType, title) {
  const safeTitle = cleanText(title, SOURCE_KIND_LABELS[sourceType] || "后果", MAX_SHORT_TEXT_LENGTH);
  if (sourceType === "city_policy") return `把${safeTitle}列入月报、事件档案和后续案牍观察，财政民情仍由服务器逐旬结算。`;
  if (sourceType === "military_diplomacy") return `把${safeTitle}列入军务后果追踪，后续侦察、调粮、战险仍须普通回合裁决。`;
  if (sourceType === "judicial_case") return `把${safeTitle}列入刑名后果追踪，后续词讼、民心和关系变化仍由服务器裁决。`;
  return `把${safeTitle}列入人物经济追踪，资产、交易、委派和人情债仍由旬更或月结裁决。`;
}

function isPublicAppliedRecord(raw = {}) {
  if (!isPlainObject(raw)) return false;
  const status = cleanId(raw.status, "").toLowerCase();
  const hasAppliedTurn = raw.appliedAtTurn !== undefined || raw.generatedAtTurn !== undefined || raw.lastTickTurn !== undefined;
  return hasAppliedTurn && PUBLIC_CONSEQUENCE_STATUSES.has(status);
}

function normalizeConsequenceRow(worldState, sourceType, raw = {}) {
  if (!isPlainObject(raw)) return null;
  const generatedAtTurn = clampNumber(raw.appliedAtTurn ?? raw.generatedAtTurn ?? raw.lastTickTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const rawSourceId = raw.sourceId || raw.outcomeId || raw.caseId || raw.id || `${sourceType}-${generatedAtTurn}`;
  const sourceId = cleanId(
    `${sourceType}-${generatedAtTurn}-${stablePublicSuffix(rawSourceId)}`,
    `${sourceType}-${generatedAtTurn}`
  );
  const title = cleanText(raw.title || raw.policyLabel || raw.actionLabel || raw.statusLabel, SOURCE_KIND_LABELS[sourceType], MAX_SHORT_TEXT_LENGTH);
  const publicSummary = cleanText(
    raw.publicSummary || raw.summary || raw.publicResolution?.summary || raw.publicDocket?.summary,
    "",
    MAX_TEXT_LENGTH
  );
  if (!sourceId || !title || !publicSummary) return null;
  const affectedMetrics = buildAffectedMetrics(raw.stateDelta, raw.playerDelta);
  const date = currentDateParts(worldState, raw);
  const row = {
    schemaVersion: DOMAIN_CONSEQUENCE_SCHEMA_VERSION,
    id: cleanId(`DC-${sourceType}-${sourceId}`, "domain-consequence"),
    sourceType,
    sourceLabel: SOURCE_LABELS[sourceType] || "后果",
    sourceId,
    kind: cleanId(raw.kind || raw.policyType || raw.actionKind || raw.caseAction || sourceType, sourceType),
    kindLabel: cleanText(raw.kindLabel || raw.policyLabel || raw.actionLabel || SOURCE_KIND_LABELS[sourceType], SOURCE_KIND_LABELS[sourceType], 60),
    title,
    publicSummary,
    status: cleanId(raw.status, "recorded"),
    statusLabel: cleanText(raw.statusLabel, "已记入后果追踪", 40),
    generatedAtTurn,
    year: date.year,
    month: date.month,
    tenDayPeriod: date.tenDayPeriod,
    affectedMetricLabels: affectedMetrics.map((metric) => metric.label),
    severity: severityFromMetrics(affectedMetrics, sourceType),
    consequenceRefs: buildConsequenceRefs(sourceType, sourceId),
    nextStep: buildNextStep(sourceType, title)
  };
  const rawPublicSourceId = cleanText(raw.publicSourceId, "", 128);
  if (rawPublicSourceId) {
    row[INTERNAL_DEDUPE_KEY] = cleanId(`${sourceType}-public-${stablePublicSuffix(rawPublicSourceId)}`, "");
  }
  return row;
}

function rowsFromLedger(worldState, sourceType, records = []) {
  return asArray(records)
    .slice(-MAX_SOURCE_ROWS)
    .filter(isPublicAppliedRecord)
    .map((record) => normalizeConsequenceRow(worldState, sourceType, record))
    .filter(Boolean);
}

function npcEconomyConsequence(worldState = {}) {
  const view = buildNpcEconomyView(worldState);
  const recentEvents = asArray(view.recentEvents)
    .map((event) => cleanText(event, "", 100))
    .filter(Boolean)
    .slice(-3);
  if (!recentEvents.length) return null;
  const generatedAtTurn = clampNumber(view.lastTickTurn ?? view.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  return normalizeConsequenceRow(worldState, "npc_economy", {
    sourceId: `npc-economy-${generatedAtTurn}`,
    title: view.lastMonthlyPeriodKey ? "人物经济月账" : "人物经济旬更",
    publicSummary: recentEvents.join("；"),
    status: "recorded",
    generatedAtTurn,
    lastTickTurn: generatedAtTurn
  });
}

function consequenceDedupeKey(row = {}) {
  return row[INTERNAL_DEDUPE_KEY] || cleanId(
    [
      row.sourceType,
      row.title,
      row.publicSummary
    ].filter(Boolean).join(":"),
    row.id || ""
  );
}

function consequenceCompletenessScore(row = {}) {
  return [
    row.publicSummary,
    row.nextStep,
    row.statusLabel,
    ...(Array.isArray(row.affectedMetricLabels) ? row.affectedMetricLabels : []),
    ...(Array.isArray(row.consequenceRefs) ? row.consequenceRefs : [])
  ].filter(Boolean).length + clampNumber(row.severity, 0, 5, 0);
}

function chooseMoreCompleteConsequence(existing, candidate) {
  if (!existing) return candidate;
  if (candidate.generatedAtTurn !== existing.generatedAtTurn) {
    return candidate.generatedAtTurn > existing.generatedAtTurn ? candidate : existing;
  }
  if (consequenceCompletenessScore(candidate) !== consequenceCompletenessScore(existing)) {
    return consequenceCompletenessScore(candidate) > consequenceCompletenessScore(existing)
      ? candidate
      : existing;
  }
  return candidate.id.localeCompare(existing.id) > 0 ? candidate : existing;
}

function collectDomainConsequences(worldState = {}) {
  const rows = [
    ...rowsFromLedger(worldState, "city_policy", worldState.cityPolicyLedger?.records),
    ...rowsFromLedger(worldState, "military_diplomacy", worldState.militaryDiplomacyLedger?.records),
    ...rowsFromLedger(worldState, "judicial_case", worldState.judicialCaseLedger?.records),
    npcEconomyConsequence(worldState)
  ].filter(Boolean);
  const byPublicKey = new Map();
  for (const row of rows) {
    const key = consequenceDedupeKey(row);
    byPublicKey.set(key, chooseMoreCompleteConsequence(byPublicKey.get(key), row));
  }
  return [...byPublicKey.values()]
    .sort((first, second) => first.generatedAtTurn - second.generatedAtTurn || first.id.localeCompare(second.id))
    .slice(-MAX_RECENT_CONSEQUENCES);
}

function buildCounts(rows = []) {
  const counts = { total: rows.length };
  for (const sourceType of Object.keys(SOURCE_LABELS)) {
    counts[sourceType] = rows.filter((row) => row.sourceType === sourceType).length;
  }
  return counts;
}

function buildDomainConsequenceView(worldState = {}) {
  const recentConsequences = collectDomainConsequences(worldState);
  return {
    schemaVersion: DOMAIN_CONSEQUENCE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active: recentConsequences.length > 0,
    summary: recentConsequences.length
      ? `当前有${recentConsequences.length}条公开领域后果可追踪，已接入事件档案、世界议程和官职月报。`
      : "当前没有可公开追踪的领域后果；不得从内部账簿、隐藏证据或模型提案补造事实。",
    counts: buildCounts(recentConsequences),
    recentConsequences,
    nextActions: recentConsequences.slice(-3).map((row) => ({
      id: cleanId(`trace-${row.id}`, "trace-domain-consequence"),
      label: row.sourceLabel,
      text: row.nextStep
    })),
    aiReadScope: "AI 只能读取本 view 中的公开后果摘要、来源类型、受影响指标标签和下一步建议；不得读取内部裁决账本、证据链、审计原文、数值差额、数据库内部行、隐藏证据或模型原始提案。",
    actorIntelligence: "领域后果追踪只解释玩家可见的服务器裁决余波；不同身份仍受原裁决器、月报和 world thread 权限限制。",
    toolPermissions: "允许生成后续行动草稿、补证清单和月报摘录建议；禁止直接结案、调兵、拨款、定罪、成交交易、改 NPC 资产或写 canonical state。",
    proposalBoundaries: [
      "只能把已公开的服务器裁决结果整理为追踪线索。",
      "不得公开内部账本名称、证据链标识、隐藏案源、密档、完整提示词、本地路径、密钥或数据库表。"
    ],
    serverAdjudication: "该 view 不裁决新状态；真实财政、军务、刑名、NPC 经济和关系变化仍由既有裁决器、旬更/月结和服务器规则处理。",
    safety: {
      readOnlyView: true,
      publicConsequencesOnly: true,
      stripsInternalResolverRecords: true,
      noEvidenceRefExposure: true,
      noDirectStateMutation: true
    }
  };
}

module.exports = {
  DOMAIN_CONSEQUENCE_SCHEMA_VERSION,
  buildDomainConsequenceView,
  collectDomainConsequences
};
