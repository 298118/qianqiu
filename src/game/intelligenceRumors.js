const { buildEconomicFiscalRetrievalRows } = require("./economicFiscal");
const { buildHistoricalEventRetrievalRows } = require("./historicalEventArchive");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyRetrievalRows } = require("./militaryDiplomacy");
const { formatYearMonthPeriod } = require("./time");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  INTELLIGENCE_RUMOR_CONFIG,
  INTELLIGENCE_RUMOR_SCHEMA_VERSION
} = require("./intelligenceRumorsConfig");

const SOURCE_LABELS = Object.freeze({
  geography_country: "国情风声",
  geography_city: "地方风声",
  local_docket: "案牍线索",
  military_report: "军情边报",
  economic_report: "财赋风声",
  relationship: "人情传闻",
  event_chain: "事件链摘报"
});

const CREDIBILITY_LABELS = Object.freeze({
  unverified: "未核",
  plausible: "可疑",
  credible: "可采",
  confirmed: "可信"
});

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|sealedProjection|sealedChains|server_only|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = INTELLIGENCE_RUMOR_CONFIG.textLimit) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SECRET_LIKE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turn: currentTurn(worldState)
  };
}

function roleId(worldState = {}) {
  return cleanText(worldState.player?.role, "scholar", 32);
}

function roleProfile(worldState = {}) {
  const role = roleId(worldState);
  return INTELLIGENCE_RUMOR_CONFIG.roleAccess[role] ||
    INTELLIGENCE_RUMOR_CONFIG.roleAccess.scholar;
}

function unique(values, limit = 8) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value, "", 96);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function avg(values, fallback = 50) {
  const metrics = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!metrics.length) return fallback;
  const total = metrics.reduce((sum, value) => sum + value, 0);
  return clampMetric(Math.round(total / metrics.length), fallback);
}

function credibilityTier(score) {
  const thresholds = INTELLIGENCE_RUMOR_CONFIG.thresholds;
  if (score >= thresholds.confirmed) return "confirmed";
  if (score >= thresholds.credible) return "credible";
  if (score >= thresholds.plausible) return "plausible";
  return "unverified";
}

function sourceCredibility(kind, source = {}, profile = {}) {
  const base = INTELLIGENCE_RUMOR_CONFIG.sourceBaseCredibility[kind] || 50;
  const sourceMetric = avg([
    source.credibilityScore,
    source.intelConfidence,
    source.intelligenceReliability,
    source.confidence,
    source.sourceConfidence
  ], base);
  return clampNumber(
    Math.round(base * 0.55 + sourceMetric * 0.45 + (profile.confidenceBonus || 0)),
    0,
    profile.confidenceCap || 75,
    base
  );
}

function pressureScore(source = {}) {
  return Math.max(
    clampMetric(source.pressureScore, 0),
    clampMetric(source.pressure, 0),
    clampMetric(source.risk, 0),
    clampMetric(source.threatScore, 0),
    clampMetric(source.supplyRisk, 0),
    clampMetric(source.diplomaticTension, 0),
    clampMetric(source.fiscalPressure, 0),
    clampMetric(source.marketPressure, 0),
    clampMetric(source.tradeRisk, 0),
    clampMetric(source.debtPressure, 0),
    clampMetric(source.corruptionRisk, 0),
    clampMetric(source.riskScore, 0),
    Math.abs(clampNumber(source.relationship, -100, 100, 0))
  );
}

function priorityBoost(role, kind) {
  return INTELLIGENCE_RUMOR_CONFIG.sourcePriorityBoost[role]?.[kind] || 0;
}

function channelFor(role, kind) {
  if (role === "emperor") return "御前摘报";
  if (role === "minister") return kind === "relationship" ? "御史风闻" : "部院奏报";
  if (role === "general") {
    if (kind === "military_report") return "军中侦报";
    if (kind === "economic_report") return "粮道风声";
    return "边吏转报";
  }
  if (role === "official") {
    if (kind === "relationship") return "同僚私信";
    if (kind === "local_docket" || kind === "economic_report" || kind === "event_chain") return "官署奏报";
    return "公开转报";
  }
  if (role === "magistrate") {
    if (kind === "local_docket") return "衙门案牍";
    if (kind === "relationship") return "乡绅耳语";
    return "地方风声";
  }
  return "坊间传闻";
}

function visibilityFor(role, kind) {
  if (role === "scholar") return "public";
  if (kind === "local_docket" && (role === "magistrate" || role === "official")) return "office_visible";
  if (kind === "military_report" || kind === "economic_report" || kind === "event_chain") return "role_visible";
  return "public";
}

function sourceViewFor(kind) {
  if (kind === "geography_country" || kind === "geography_city") return "worldGeographyView";
  if (kind === "local_docket") return "localAffairsDocketView";
  if (kind === "military_report") return "militaryDiplomacyView";
  if (kind === "economic_report") return "economicFiscalView";
  if (kind === "relationship") return "worldPeopleView.relationships";
  if (kind === "event_chain") return "historicalEventArchiveView.publicChains";
  return "server_visible_projection";
}

function sourceSummary(source = {}) {
  if (Array.isArray(source.recentNotes) && source.recentNotes.length) {
    const note = cleanText(source.recentNotes.join("；"), "", 120);
    if (note) return note;
  }
  return cleanText(
    source.publicSummary ||
      source.publicDocket ||
      source.publicFinding ||
      source.intelligenceSummary ||
      source.cityIntelligenceSummary ||
      source.summary ||
      source.outcome ||
      "",
    "",
    140
  );
}

function sourceTitle(kind, source = {}) {
  return cleanText(
    source.title ||
      source.name ||
      source.domainLabel ||
      source.kindLabel ||
      source.sourceLabel ||
      SOURCE_LABELS[kind],
    SOURCE_LABELS[kind],
    80
  );
}

function sourceIdFor(kind, source = {}, index = 0) {
  return cleanId(
    source.id ||
      source.sourceId ||
      source.cityId ||
      source.countryId ||
      source.routeId ||
      source.frontierZoneId ||
      source.templateId ||
      `${kind}-${index}`,
    `${kind}-${index}`
  );
}

function ref(type, id, label) {
  const safeType = cleanId(type, "");
  const safeId = cleanId(id, "");
  const safeLabel = cleanText(label || id, safeId, 64);
  if (!safeType || !safeId) return null;
  return { type: safeType, id: safeId, label: safeLabel || safeId };
}

function relatedRefsFor(source = {}) {
  const refs = [
    ref("country", source.countryId, source.countryName || source.countryId),
    ref("city", source.cityId, source.cityName || source.name || source.cityId),
    ref("route", source.routeId, source.routeName || source.routeId),
    ref("frontier_zone", source.frontierZoneId, source.frontierZoneId),
    ref("neighbor_country", source.neighborCountryId, source.neighborCountryId),
    ref("jurisdiction", source.jurisdictionId, source.jurisdictionId),
    ref("bureau", source.bureauId, source.bureauId),
    ref("posting", source.postingId, source.postingId),
    ref("relationship_source", source.sourceId, source.sourceId),
    ref("relationship_target", source.targetId, source.targetId),
    ref("event_chain", source.chainId || source.id, source.title || source.chainId || source.id)
  ];
  for (const cityId of source.cityIds || source.relatedCityIds || []) refs.push(ref("city", cityId, cityId));
  for (const routeId of source.routeIds || source.relatedRouteIds || []) refs.push(ref("route", routeId, routeId));
  return refs
    .filter(Boolean)
    .filter((entry, index, rows) => rows.findIndex((row) => `${row.type}:${row.id}` === `${entry.type}:${entry.id}`) === index)
    .slice(0, INTELLIGENCE_RUMOR_CONFIG.maxRelatedRefs);
}

function makeAttribution(kind, source, sourceId, credibility) {
  return {
    sourceView: sourceViewFor(kind),
    sourceType: kind,
    sourceId,
    sourceLabel: SOURCE_LABELS[kind] || "情报来源",
    credibilityScore: credibility,
    note: "由服务器可见投影派生；不读取原始表、审计原文、模型提案、密札或隐藏私档。"
  };
}

function dateFrom(source = {}, worldState = {}) {
  const date = isPlainObject(source.date)
    ? source.date
    : source.examSubmittedAt || source.sceneTime?.updatedAt || null;
  return {
    ...currentDate(worldState),
    ...(isPlainObject(date) ? {
      year: clampNumber(date.year ?? date.currentYear, 1, 9999, worldState.year || 1644),
      month: clampNumber(date.month ?? date.currentMonth, 1, 12, worldState.month || 1),
      tenDayPeriod: clampNumber(date.tenDayPeriod ?? date.currentTenDayPeriod, 1, 3, worldState.tenDayPeriod || 1),
      turn: clampNumber(date.turn ?? date.turnCount, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
    } : {})
  };
}

function makeRumor(worldState, kind, source = {}, index = 0) {
  const role = roleId(worldState);
  const profile = roleProfile(worldState);
  const summary = sourceSummary(source);
  if (!summary) return null;
  const sourceId = sourceIdFor(kind, source, index);
  const channel = channelFor(role, kind);
  const credibility = sourceCredibility(kind, source, profile);
  const tier = credibilityTier(credibility);
  const title = sourceTitle(kind, source);
  const publicSummary = cleanText(`${channel}：${title}，${summary}`, "");
  if (!publicSummary) return null;

  return {
    id: cleanId(`intel-rumor-${kind}-${sourceId}`),
    schemaVersion: INTELLIGENCE_RUMOR_SCHEMA_VERSION,
    kind,
    kindLabel: SOURCE_LABELS[kind] || "情报",
    channel,
    title,
    publicSummary,
    visibility: visibilityFor(role, kind),
    knownToPlayer: true,
    credibilityScore: credibility,
    credibilityTier: tier,
    credibilityLabel: CREDIBILITY_LABELS[tier],
    sourceAttributions: [makeAttribution(kind, source, sourceId, credibility)]
      .slice(0, INTELLIGENCE_RUMOR_CONFIG.maxSourceAttributions),
    relatedRefs: relatedRefsFor(source),
    sourceView: sourceViewFor(kind),
    sourceId,
    priorityScore: pressureScore(source) + credibility + priorityBoost(role, kind),
    contextBoundary: "模型上下文只可读取玩家视野内的情报摘要和可信度，不得把传闻当作隐藏真值。",
    authorityBoundary: "情报传闻只提供线索、可信度和来源归因；是否成案、公开密情、任免、战和、刑赏、财政结算和落库均由服务器裁决。",
    date: dateFrom(source, worldState),
    lastUpdatedTurn: clampNumber(
      source.lastUpdatedTurn ?? source.resolvedTurn ?? source.createdTurn ?? source.turn,
      0,
      Number.MAX_SAFE_INTEGER,
      currentTurn(worldState)
    )
  };
}

function geographySources(worldState = {}) {
  const view = buildWorldGeographyView(worldState);
  const countries = (view.countries || [])
    .filter((country) => country.publicSummary || country.intelligenceSummary)
    .map((country) => ({ kind: "geography_country", source: country }));
  const cities = (view.highlights?.cities || view.cities || [])
    .filter((city) => city.publicSummary || city.cityIntelligenceSummary)
    .map((city) => ({ kind: "geography_city", source: city }));
  return [...countries, ...cities];
}

function localDocketSources(worldState = {}) {
  return (buildLocalAffairsDocketView(worldState).dockets || [])
    .map((source) => ({ kind: "local_docket", source }));
}

function militarySources(worldState = {}) {
  return buildMilitaryDiplomacyRetrievalRows(worldState)
    .map((source) => ({ kind: "military_report", source }));
}

function economicSources(worldState = {}) {
  return buildEconomicFiscalRetrievalRows(worldState)
    .map((source) => ({ kind: "economic_report", source }));
}

function relationshipSources(worldState = {}) {
  return (buildWorldPeopleView(worldState).relationships || [])
    .filter((relationship) => relationship.publicSummary || (relationship.recentNotes || []).length)
    .map((source) => ({ kind: "relationship", source }));
}

function eventChainSources(worldState = {}) {
  return buildHistoricalEventRetrievalRows(worldState)
    .map((source) => ({ kind: "event_chain", source }));
}

function compareRumors(first, second) {
  if (second.priorityScore !== first.priorityScore) return second.priorityScore - first.priorityScore;
  if (second.lastUpdatedTurn !== first.lastUpdatedTurn) return second.lastUpdatedTurn - first.lastUpdatedTurn;
  return first.id.localeCompare(second.id);
}

function uniqueById(rows = []) {
  const result = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
  }
  return result;
}

function buildIntelligenceRumorRows(worldState = {}) {
  const profile = roleProfile(worldState);
  const candidates = [
    ...geographySources(worldState),
    ...localDocketSources(worldState),
    ...militarySources(worldState),
    ...economicSources(worldState),
    ...relationshipSources(worldState),
    ...eventChainSources(worldState)
  ];
  return uniqueById(
    candidates
      .map((candidate, index) => makeRumor(worldState, candidate.kind, candidate.source, index))
      .filter(Boolean)
      .sort(compareRumors)
  ).slice(0, Math.min(profile.rumorLimit || 0, INTELLIGENCE_RUMOR_CONFIG.maxRumors));
}

function countByKind(rows = []) {
  return rows.reduce((counts, row) => {
    counts[row.kind] = (counts[row.kind] || 0) + 1;
    return counts;
  }, {});
}

function buildIntelligenceRumorView(worldState = {}) {
  const profile = roleProfile(worldState);
  const publicRumors = buildIntelligenceRumorRows(worldState);
  return {
    schemaVersion: INTELLIGENCE_RUMOR_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    visibilityScope: profile.scopeLabel,
    publicRumors,
    counts: {
      total: publicRumors.length,
      ...countByKind(publicRumors)
    },
    hiddenNotice: `${profile.notice} 本视图只含服务器由已可见投影改写的传闻、奏报、私信或侦报；不会公开密档链、隐藏札记、原始表、审计原文、提示内容、密钥或本地路径。`
  };
}

function buildIntelligenceRumorRetrievalRows(worldState = {}) {
  return buildIntelligenceRumorRows(worldState)
    .filter((row) => row.id && row.publicSummary)
    .slice(0, INTELLIGENCE_RUMOR_CONFIG.maxRetrievalRumors);
}

function promptSummaryProfile(options = {}) {
  const requested = cleanText(
    options.promptBudgetProfile || options.retrievalBudgetProfile || options.retrievalBudget,
    "high",
    24
  );
  return INTELLIGENCE_RUMOR_CONFIG.promptSummaryProfiles[requested] ||
    INTELLIGENCE_RUMOR_CONFIG.promptSummaryProfiles.high;
}

function summarizeIntelligenceRumorsForPrompt(worldState = {}, options = {}) {
  const view = buildIntelligenceRumorView(worldState);
  const profile = promptSummaryProfile(options);
  return {
    generatedAtTurn: view.generatedAtTurn,
    visibilityScope: view.visibilityScope,
    rumors: buildIntelligenceRumorRetrievalRows(worldState)
      .slice(0, Math.min(profile.maxRumors, INTELLIGENCE_RUMOR_CONFIG.maxPromptRumors))
      .map((rumor) => ({
        id: rumor.id,
        kind: rumor.kind,
        channel: rumor.channel,
        title: rumor.title,
        credibilityScore: rumor.credibilityScore,
        credibilityLabel: rumor.credibilityLabel,
        ...(profile.includeSourceAttributions ? { sourceAttributions: rumor.sourceAttributions } : {}),
        publicSummary: cleanText(rumor.publicSummary, "", profile.textLimit),
        authorityBoundary: rumor.authorityBoundary
      })),
    safety: {
      source: "server_visible_intelligence_rumor_projection",
      authority: "AI 只能读取和叙述玩家视野内情报；传闻真伪、密情公开、裁决和持久化由服务器处理。"
    }
  };
}

module.exports = {
  INTELLIGENCE_RUMOR_SCHEMA_VERSION,
  buildIntelligenceRumorRetrievalRows,
  buildIntelligenceRumorRows,
  buildIntelligenceRumorView,
  summarizeIntelligenceRumorsForPrompt
};
