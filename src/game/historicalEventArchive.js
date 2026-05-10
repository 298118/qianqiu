const { formatYearMonthPeriod } = require("./time");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  HISTORICAL_EVENT_ARCHIVE_CONFIG,
  HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION
} = require("./historicalEventArchiveConfig");

const STATUS_LABELS = Object.freeze({
  recorded: "已记",
  watch: "留察",
  strained: "吃紧",
  urgent: "急办",
  critical: "急重"
});

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const TEMPLATE_BY_ID = new Map(
  HISTORICAL_EVENT_ARCHIVE_CONFIG.templates.map((template) => [template.id, template])
);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = HISTORICAL_EVENT_ARCHIVE_CONFIG.textLimit) {
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

function dateFrom(source = {}, worldState = {}) {
  const date = isPlainObject(source.date)
    ? source.date
    : source.sceneTime?.updatedAt || source.examSubmittedAt || source.sceneTime?.startedAt || source.examStartedAt;
  return {
    ...currentDate(worldState),
    ...(isPlainObject(date) ? {
      year: clampNumber(date.year ?? date.currentYear, 1, 9999, worldState.year || 1644),
      month: clampNumber(date.month ?? date.currentMonth, 1, 12, worldState.month || 1),
      tenDayPeriod: clampNumber(
        date.tenDayPeriod ?? date.currentTenDayPeriod,
        1,
        3,
        worldState.tenDayPeriod || 1
      ),
      turn: clampNumber(date.turn ?? date.turnCount, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
    } : {})
  };
}

function statusFromPressure(pressure) {
  const thresholds = HISTORICAL_EVENT_ARCHIVE_CONFIG.thresholds;
  if (pressure >= thresholds.critical) return "critical";
  if (pressure >= thresholds.urgent) return "urgent";
  if (pressure >= thresholds.strained) return "strained";
  if (pressure >= thresholds.watch) return "watch";
  return "recorded";
}

function severityFromStatus(status) {
  if (status === "critical" || status === "urgent") return 4;
  if (status === "strained") return 3;
  if (status === "watch") return 2;
  return 1;
}

function pressureFor(source = {}) {
  return Math.max(
    clampMetric(source.pressureScore, 0),
    clampMetric(source.threatScore, 0),
    clampMetric(source.supplyRisk, 0),
    clampMetric(source.readinessScore === undefined ? 0 : 100 - source.readinessScore, 0),
    clampMetric(source.diplomaticTension, 0),
    clampMetric(source.fiscalPressure, 0),
    clampMetric(source.marketPressure, 0),
    clampMetric(source.tradeRisk, 0),
    clampMetric(source.debtPressure, 0),
    clampMetric(source.corruptionRisk, 0),
    clampMetric(source.riskScore, 0),
    clampMetric(source.resentment, 0),
    Math.abs(clampNumber(source.relationship, -100, 100, 0))
  );
}

function uniqueBy(items, keyFn, limit) {
  const result = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function ref(type, id, label) {
  const safeType = cleanId(type, "");
  const safeId = cleanId(id, "");
  const safeLabel = cleanText(label || id, safeId, 64);
  if (!safeType || !safeId) return null;
  return { type: safeType, id: safeId, label: safeLabel || safeId };
}

function refsForSource(source = {}) {
  const refs = [
    ref("city", source.cityId, source.cityName || source.cityId),
    ref("country", source.countryId, source.countryId),
    ref("route", source.routeId, source.routeName || source.routeId),
    ref("frontier_zone", source.frontierZoneId, source.frontierZoneId),
    ref("neighbor_country", source.neighborCountryId, source.neighborCountryId),
    ref("jurisdiction", source.jurisdictionId, source.jurisdictionId),
    ref("bureau", source.bureauId, source.bureauId),
    ref("posting", source.postingId, source.postingId),
    ref("office", source.officeId, source.officeTitle || source.officeId),
    ref("source", source.sourceId, source.sourceLabel || source.sourceId),
    ref("relationship_source", source.sourceId, source.sourceId),
    ref("relationship_target", source.targetId, source.targetId),
    ref("exam", source.examId || source.level, source.examName || source.level)
  ];

  for (const cityId of source.cityIds || source.relatedCityIds || []) refs.push(ref("city", cityId, cityId));
  for (const routeId of source.routeIds || []) refs.push(ref("route", routeId, routeId));
  for (const officeId of source.relatedOfficeIds || []) refs.push(ref("office", officeId, officeId));

  return uniqueBy(refs.filter(Boolean), (entry) => `${entry.type}:${entry.id}`, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxRelatedRefs);
}

function sourceSummary(source = {}) {
  return cleanText(
    source.publicDocket ||
      source.publicSummary ||
      source.publicFinding ||
      source.summary ||
      source.outcome ||
      source.reason ||
      "",
    "",
    130
  );
}

function titleFor(template, source = {}) {
  return cleanText(source.title || source.examName || template.title, template.title, 80);
}

function appliedChangesFor(template, source = {}) {
  return [
    {
      scope: "projection_only",
      field: "eventArchiveView",
      summary: `${template.domainLabel}只作为历史事件链 projection 入档，不直接改动 canonical 状态。`
    },
    {
      scope: "server_owned",
      field: "futureResolver",
      summary: "后续触发条件只供服务器 resolver、审计和 Mock fallback 使用；AI 不能据此直接结案或落库。"
    },
    source.assessmentHint ? {
      scope: "candidate_signal",
      field: "officialAssessment",
      summary: "案牍考成线索仅是候选信号，实际考成仍由服务器裁决。"
    } : null
  ].filter(Boolean).slice(0, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxAppliedChanges);
}

function auditLinksFor(template, source = {}, sourceView = "") {
  return [
    {
      kind: "source_view",
      sourceView: cleanText(sourceView, "server_visible_view", 80),
      sourceId: cleanId(source.id || source.examId || source.sourceId || template.id, template.id),
      note: "由服务器可见 projection 派生，不读取原始审计、模型建议原文或 SQLite 原始表。"
    },
    {
      kind: "archive_projection",
      sourceView: "historicalEventArchiveView",
      sourceId: cleanId(template.id, "historical-template"),
      note: "公共卷宗可进入 eventArchiveView；密档 projection 默认不进玩家路由、提示上下文或浏览器。"
    }
  ].slice(0, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxAuditLinks);
}

function followUpTriggersFor(template, source = {}) {
  const pressure = pressureFor(source);
  return template.followUps.map((label, index) => ({
    kind: index === 0 ? "pressure_watch" : "server_adjudication",
    label: cleanText(label, "", 80),
    threshold: index === 0 ? Math.max(45, pressure) : null,
    resolver: "server_owned_future_resolver"
  })).filter((trigger) => trigger.label)
    .slice(0, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxFollowUpTriggers);
}

function makeRecord(worldState, templateId, source, sourceView, options = {}) {
  const template = TEMPLATE_BY_ID.get(templateId);
  if (!template) return null;
  const summary = sourceSummary(source);
  if (!summary) return null;
  const date = dateFrom(source, worldState);
  const pressure = Math.max(pressureFor(source), clampMetric(source.severity, 0) * 20);
  const status = source.status === "resolved" || source.status === "submitted"
    ? "recorded"
    : statusFromPressure(pressure);
  const sourceId = cleanId(source.id || source.examId || source.sourceId || source.title, template.id);
  const refs = refsForSource(source);
  const publicSummary = cleanText(`${template.publicLead}：${summary} 服务器只将其作为因果线索和公共卷宗。`, "");
  const sealedSummary = cleanText(
    `${template.sealedLead}：${summary}；密档只保留可见 projection 的因果、触发条件、审计链接和建议边界。`,
    ""
  );

  return {
    id: cleanId(`historical-event-${template.id}-${sourceId}`),
    schemaVersion: HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION,
    templateId: template.id,
    chainId: cleanId(`event-chain-${template.domain}-${sourceId}`),
    domain: template.domain,
    domainLabel: template.domainLabel,
    sourceLabel: template.sourceLabel,
    title: titleFor(template, source),
    publicSummary,
    publicProjection: {
      visibility: "public",
      summary: publicSummary,
      sourceView: cleanText(sourceView, "server_visible_view", 80)
    },
    sealedProjection: options.includeSealed ? {
      visibility: "server_only",
      summary: sealedSummary,
      proposalBoundary: "模型只能把密档 projection 当作 request-adjudication 线索；服务器拥有结局、写库和审计裁决。",
      rawDataPolicy: "不含隐藏札记、原始表、模型建议原文、提示词、密钥或本地路径。"
    } : undefined,
    relatedRefs: refs,
    appliedChanges: appliedChangesFor(template, source),
    auditLinks: auditLinksFor(template, source, sourceView),
    followUpTriggers: followUpTriggersFor(template, source),
    pressureScore: pressure,
    severity: severityFromStatus(status),
    status,
    statusLabel: STATUS_LABELS[status],
    date,
    lastUpdatedTurn: clampNumber(source.lastUpdatedTurn ?? date.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    visibility: "public",
    authorityBoundary: "事件模板只组合服务器可见 projection；AI 可读公共摘要、可提出受限建议，但不得直接写状态、审计或数据库。",
    hiddenNotice: "密档 projection 默认不会进入玩家路由、提示上下文、浏览器或 SQLite 检索索引。"
  };
}

function isAppointmentPoolAssessment(record = {}) {
  const id = typeof record.id === "string" ? record.id : "";
  const postingId = typeof record.postingId === "string" ? record.postingId : "";
  return id.startsWith("assessment-s63-") || postingId.startsWith("posting-s63-");
}

function localTemplateFor(docket = {}) {
  if (docket.domain === "relief" || docket.domain === "waterworks" || docket.domain === "epidemic") {
    return "natural_disaster_relief";
  }
  return "local_assignment_chain";
}

function buildLocalRecords(worldState, includeSealed) {
  const view = buildLocalAffairsDocketView(worldState);
  return (view.dockets || [])
    .filter((docket) => docket.publicSummary || docket.publicDocket)
    .slice(0, 5)
    .map((docket) => makeRecord(worldState, localTemplateFor(docket), docket, "localAffairsDocketView", { includeSealed }));
}

function buildMilitaryRecords(worldState, includeSealed) {
  const view = buildMilitaryDiplomacyView(worldState);
  return (view.frontierIncidents || [])
    .slice(0, 3)
    .map((incident) => makeRecord(worldState, "frontier_military_alarm", incident, "militaryDiplomacyView", { includeSealed }));
}

function buildEconomicRecords(worldState, includeSealed) {
  const view = buildEconomicFiscalView(worldState);
  return (view.marketIncidents || [])
    .slice(0, 4)
    .map((incident) => makeRecord(worldState, "market_tax_chain", incident, "economicFiscalView", { includeSealed }));
}

function buildCourtRecords(worldState, includeSealed) {
  const view = buildOfficialPostingsView(worldState);
  return (view.assessmentRecords || [])
    .filter((record) => !isAppointmentPoolAssessment(record))
    .filter((record) => record.publicFinding || record.publicSummary)
    .slice(0, 2)
    .map((record) => makeRecord(worldState, "court_faction_conflict", record, "officialPostingsView.assessmentRecords", { includeSealed }));
}

function relationshipScore(relationship = {}) {
  return Math.max(
    Math.abs(clampNumber(relationship.relationship, -100, 100, 0)),
    clampMetric(relationship.resentment, 0),
    clampMetric(relationship.obligation, 0),
    clampMetric(relationship.trust, 0) > 75 ? clampMetric(relationship.trust, 0) - 20 : 0
  );
}

function buildRelationshipRecords(worldState, includeSealed) {
  const view = buildWorldPeopleView(worldState);
  return (view.relationships || [])
    .filter((relationship) => relationship.publicSummary && relationshipScore(relationship) >= 45)
    .sort((first, second) => relationshipScore(second) - relationshipScore(first))
    .slice(0, 2)
    .map((relationship) => makeRecord(worldState, "relationship_memory_chain", relationship, "worldPeopleView.relationships", { includeSealed }));
}

function buildExamRecords(worldState, includeSealed) {
  const history = Array.isArray(worldState.player?.examHistory) ? worldState.player.examHistory : [];
  return history.slice(-3).map((entry) => {
    const score = entry.score?.overall_score ?? null;
    const rank = cleanText(entry.score?.rank || entry.promotionResult?.rank, "未定", 60);
    return makeRecord(worldState, "imperial_exam_chain", {
      ...entry,
      id: entry.examId || entry.level,
      publicSummary: `${entry.examName || "科场"}交卷，得${score ?? "-"}分，${rank}。`,
      status: "submitted"
    }, "player.examHistory", { includeSealed });
  });
}

function compareRecords(first, second) {
  if (second.pressureScore !== first.pressureScore) return second.pressureScore - first.pressureScore;
  if (second.lastUpdatedTurn !== first.lastUpdatedTurn) return second.lastUpdatedTurn - first.lastUpdatedTurn;
  return first.id.localeCompare(second.id);
}

function buildHistoricalEventArchiveRows(worldState = {}, options = {}) {
  const includeSealed = options.includeSealed === true;
  const rows = [
    ...buildLocalRecords(worldState, includeSealed),
    ...buildMilitaryRecords(worldState, includeSealed),
    ...buildEconomicRecords(worldState, includeSealed),
    ...buildCourtRecords(worldState, includeSealed),
    ...buildRelationshipRecords(worldState, includeSealed),
    ...buildExamRecords(worldState, includeSealed)
  ].filter(Boolean);

  return uniqueBy(rows.sort(compareRecords), (row) => row.id, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxPublicChains);
}

function countByDomain(rows = []) {
  return rows.reduce((counts, row) => {
    counts[row.domain] = (counts[row.domain] || 0) + 1;
    return counts;
  }, {});
}

function publicRow(row = {}) {
  const { sealedProjection, hiddenNotice, ...safeRow } = row;
  return safeRow;
}

function buildHistoricalEventArchiveView(worldState = {}, options = {}) {
  const includeSealed = options.includeSealed === true;
  const rows = buildHistoricalEventArchiveRows(worldState, { includeSealed });
  const publicChains = rows.map(publicRow);
  const sealedChains = includeSealed
    ? rows
      .filter((row) => row.sealedProjection)
      .map((row) => ({
        id: row.id,
        templateId: row.templateId,
        chainId: row.chainId,
        domain: row.domain,
        domainLabel: row.domainLabel,
        title: row.title,
        relatedRefs: row.relatedRefs,
        sealedProjection: row.sealedProjection,
        auditLinks: row.auditLinks,
        followUpTriggers: row.followUpTriggers
      }))
    : [];

  const view = {
    schemaVersion: HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    publicChains,
    counts: {
      total: publicChains.length,
      ...countByDomain(publicChains)
    },
    hiddenNotice: "S65.1 历史事件链只由服务器可见 projection 组合；公共链可入事件档案，密档链仅在服务器显式 includeSealed 时返回。"
  };
  if (includeSealed) {
    view.sealedChains = sealedChains;
  }
  return view;
}

function buildHistoricalEventRetrievalRows(worldState = {}) {
  return buildHistoricalEventArchiveRows(worldState)
    .map(publicRow)
    .filter((row) => row.id && row.publicSummary)
    .slice(0, HISTORICAL_EVENT_ARCHIVE_CONFIG.maxPublicChains);
}

module.exports = {
  HISTORICAL_EVENT_ARCHIVE_SCHEMA_VERSION,
  buildHistoricalEventArchiveRows,
  buildHistoricalEventArchiveView,
  buildHistoricalEventRetrievalRows
};
