const { formatYearMonthPeriod } = require("./time");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const {
  LOCAL_AFFAIRS_DOCKET_CONFIG,
  LOCAL_AFFAIRS_DOCKET_SCHEMA_VERSION
} = require("./localAffairsDocketConfig");

const ADMIN_DOCKET_ROLES = new Set(["magistrate", "official", "minister", "emperor", "general"]);
const MAX_TEXT_LENGTH = 180;
const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const STATUS_LABELS = Object.freeze({
  routine: "例行",
  watch: "留察",
  strained: "吃紧",
  urgent: "急办",
  critical: "急重"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
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

function roleCanReadDockets(worldState = {}) {
  return ADMIN_DOCKET_ROLES.has(worldState.player?.role || "scholar");
}

function sourceForMetric(context, sourceName) {
  if (sourceName === "localMetrics") return context.jurisdiction?.localMetrics || {};
  if (sourceName === "city") return context.city || {};
  if (sourceName === "posting") return context.postingMetrics || {};
  return {};
}

function pressureFromMetric(value, direction) {
  const metric = clampMetric(value, 50);
  return direction === "inverse" ? 100 - metric : metric;
}

function buildMetricRefs(template, context) {
  return (template.metricRefs || []).map((ref) => {
    const source = sourceForMetric(context, ref.source);
    const value = clampMetric(source?.[ref.key], 50);
    return {
      key: cleanId(ref.key, ""),
      label: cleanText(ref.label, ref.key, 40),
      value,
      pressure: pressureFromMetric(value, ref.direction),
      direction: ref.direction === "inverse" ? "inverse" : "direct",
      weight: Number.isFinite(Number(ref.weight)) ? Number(ref.weight) : 1
    };
  });
}

function pressureScore(metricRefs = []) {
  const totalWeight = metricRefs.reduce((total, ref) => total + Math.max(0, ref.weight || 0), 0);
  if (totalWeight <= 0) return 0;
  const weighted = metricRefs.reduce((total, ref) => total + ref.pressure * Math.max(0, ref.weight || 0), 0);
  return clampMetric(Math.round(weighted / totalWeight), 0);
}

function severityFromPressure(pressure) {
  const thresholds = LOCAL_AFFAIRS_DOCKET_CONFIG.severityThresholds;
  if (pressure >= thresholds.critical) return { severity: 4, status: "critical" };
  if (pressure >= thresholds.urgent) return { severity: 4, status: "urgent" };
  if (pressure >= thresholds.strained) return { severity: 3, status: "strained" };
  if (pressure >= thresholds.watch) return { severity: 2, status: "watch" };
  return { severity: 1, status: "routine" };
}

function pressureTone(status) {
  if (status === "critical" || status === "urgent") return "急案";
  if (status === "strained") return "重案";
  if (status === "watch") return "留案";
  return "常案";
}

function metricSummary(metricRefs = []) {
  return metricRefs
    .slice()
    .sort((first, second) => second.pressure * second.weight - first.pressure * first.weight)
    .slice(0, 3)
    .map((ref) => `${ref.label}${ref.value}`)
    .join("、");
}

function assessmentHintFor(template, pressure, status) {
  const maxDelta = LOCAL_AFFAIRS_DOCKET_CONFIG.maxAssessmentDelta;
  const highPressure = status === "urgent" || status === "critical" || pressure >= 72;
  const watchPressure = status === "strained" || status === "watch";
  return {
    kind: "official_assessment_signal",
    meritDirection: highPressure ? "down" : pressure <= 35 ? "up" : "neutral",
    riskDirection: highPressure || watchPressure ? "up" : "neutral",
    maxMeritDelta: Math.min(
      template.maxMeritDelta || maxDelta.minorMerit,
      highPressure ? maxDelta.majorMerit : maxDelta.minorMerit
    ),
    maxRiskDelta: Math.min(
      template.maxRiskDelta || maxDelta.minorRisk,
      highPressure ? maxDelta.majorRisk : maxDelta.minorRisk
    ),
    tags: (template.assessmentTags || []).slice(0, 6),
    boundary: "仅作后续服务器考成候选线索；不得由 AI 直接改动考成、任免、城市指标或数据库。"
  };
}

function visibleOfficeIds(context) {
  return [
    context.currentPosting?.officeId,
    ...(Array.isArray(context.jurisdiction?.availableOfficeIds) ? context.jurisdiction.availableOfficeIds : [])
  ].filter(Boolean).slice(0, 6);
}

function buildBaseDocket(worldState, template, context, options = {}) {
  const metricRefs = buildMetricRefs(template, context);
  const pressure = pressureScore(metricRefs);
  const severity = severityFromPressure(pressure);
  const cityName = cleanText(context.city?.name, cleanText(context.jurisdiction?.name, "本地", 60), 60);
  const title = cleanText(`${cityName}${template.title}`, template.title, 80);
  const docketTone = pressureTone(severity.status);
  const metricsText = metricSummary(metricRefs);
  const summary = `${title}列为${docketTone}：${template.actionLabel}；指标为${metricsText || "暂无异常"}。`;
  const visibility = options.current ? "office_visible" : "role_visible";

  return {
    id: cleanId(`local-docket-${context.jurisdiction?.id || context.city?.id || "city"}-${template.id}`),
    templateId: template.id,
    domain: template.domain,
    domainLabel: template.domainLabel,
    title,
    cityId: cleanId(context.city?.id || context.jurisdiction?.cityId, ""),
    cityName,
    regionId: cleanId(context.city?.regionId || context.jurisdiction?.regionId, ""),
    countryId: cleanId(context.city?.countryId || context.jurisdiction?.countryId, ""),
    jurisdictionId: cleanId(context.jurisdiction?.id, ""),
    bureauId: cleanId(context.jurisdiction?.bureauId, ""),
    postingId: cleanId(context.currentPosting?.id, ""),
    officeId: cleanId(context.currentPosting?.officeId, ""),
    relatedOfficeIds: visibleOfficeIds(context),
    severity: severity.severity,
    severityLabel: STATUS_LABELS[severity.status],
    pressureScore: pressure,
    status: severity.status,
    statusLabel: STATUS_LABELS[severity.status],
    metricRefs: metricRefs.map(({ weight, ...ref }) => ref),
    assessmentHint: assessmentHintFor(template, pressure, severity.status),
    publicSummary: cleanText(summary, ""),
    publicDocket: cleanText(`${summary} AI 只能据此写叙事或提出有界建议，成案与结算仍归服务器。`, ""),
    authorityBoundary: "AI 可读取本案牍、撰写叙事和提出受限建议；服务器裁决钱粮、刑名、赈济、缉捕、徭役、疫病、考成和持久化。",
    visibility,
    knownToPlayer: visibility === "office_visible",
    intelConfidence: visibility === "office_visible" ? 82 : 64,
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function reviewDuePressure(posting = {}, worldState = {}) {
  const remainingTurns = clampNumber(posting.expectedReviewTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState) + 36) -
    currentTurn(worldState);
  if (remainingTurns <= 0) return 100;
  if (remainingTurns <= 3) return 88;
  if (remainingTurns <= 9) return 72;
  if (remainingTurns <= 18) return 55;
  return 35;
}

function buildTermClosureDocket(worldState, context) {
  const posting = context.currentPosting;
  if (!posting) return null;
  const assignmentCount = Array.isArray(posting.assignmentIds) ? posting.assignmentIds.length : 0;
  const postingMetrics = {
    reviewDuePressure: reviewDuePressure(posting, worldState),
    impeachmentRisk: clampMetric(posting.impeachmentRisk, 0),
    performanceScore: clampMetric(posting.performanceScore, 50),
    activeAssignments: clampMetric(assignmentCount * 18, 0)
  };
  const template = LOCAL_AFFAIRS_DOCKET_CONFIG.termClosure;
  const docket = buildBaseDocket(worldState, template, {
    ...context,
    postingMetrics
  }, { current: true });
  const remaining = clampNumber(posting.expectedReviewTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)) -
    currentTurn(worldState);
  const reviewText = remaining <= 0 ? "已到复核期" : `距复核约${remaining}回`;
  return {
    ...docket,
    id: cleanId(`local-docket-${posting.id}-${template.id}`),
    title: cleanText(`${posting.officeTitle || "本任"}任所收束`, docket.title, 80),
    publicSummary: cleanText(
      `${posting.officeTitle || "本任"}任所收束列为${pressureTone(docket.status)}：${reviewText}，尚有${assignmentCount}件差事线索需清结。`,
      docket.publicSummary
    ),
    publicDocket: cleanText(
      `${posting.officeTitle || "本任"}任所收束：${reviewText}，考成风险${posting.impeachmentRisk ?? 0}，绩效${posting.performanceScore ?? 50}；服务器后续考成可读取该线索，但 AI 不得直接结算升降。`,
      docket.publicDocket
    )
  };
}

function jurisdictionPressureScore(jurisdiction = {}) {
  const metrics = jurisdiction.localMetrics || {};
  return Math.max(
    100 - clampMetric(metrics.publicOrder, 50),
    100 - clampMetric(metrics.taxCapacity, 50),
    clampMetric(metrics.lawsuits, 20),
    100 - clampMetric(metrics.waterworks, 50),
    clampMetric(metrics.gentryInfluence, 50),
    clampMetric(metrics.disasterRisk, 20),
    clampMetric(metrics.militaryPressure, 20)
  );
}

function focusJurisdictions(worldState, officialView, geoView) {
  const role = worldState.player?.role || "scholar";
  const limit = LOCAL_AFFAIRS_DOCKET_CONFIG.focusJurisdictionLimits[role] || 0;
  if (!limit) return [];
  const cityById = new Map((geoView.cities || []).map((city) => [city.id, city]));
  const currentPosting = (officialView.postings || []).find((posting) => posting.holderType === "player") || null;
  const currentJurisdictionId = cleanId(currentPosting?.jurisdictionId, "");
  const rows = (officialView.cityJurisdictions || [])
    .filter((jurisdiction) => jurisdiction.cityId && cityById.has(jurisdiction.cityId))
    .map((jurisdiction) => {
      const current = currentJurisdictionId && jurisdiction.id === currentJurisdictionId;
      return {
        jurisdiction,
        city: cityById.get(jurisdiction.cityId),
        current,
        currentPosting: current ? currentPosting : null,
        score: jurisdictionPressureScore(jurisdiction) + (current ? 200 : 0)
      };
    })
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return first.jurisdiction.id.localeCompare(second.jurisdiction.id);
    });

  return rows.slice(0, limit);
}

function buildAllDockets(worldState = {}) {
  if (!roleCanReadDockets(worldState)) return [];
  const officialView = buildOfficialPostingsView(worldState);
  const geoView = buildWorldGeographyView(worldState);
  const dockets = [];

  for (const context of focusJurisdictions(worldState, officialView, geoView)) {
    for (const template of LOCAL_AFFAIRS_DOCKET_CONFIG.templates) {
      dockets.push(buildBaseDocket(worldState, template, context, { current: context.current }));
    }
    const termClosure = buildTermClosureDocket(worldState, context);
    if (termClosure) dockets.push(termClosure);
  }

  return dockets
    .filter((docket) => docket.publicSummary)
    .sort((first, second) => {
      if (second.severity !== first.severity) return second.severity - first.severity;
      if (second.pressureScore !== first.pressureScore) return second.pressureScore - first.pressureScore;
      return first.id.localeCompare(second.id);
    })
    .slice(0, LOCAL_AFFAIRS_DOCKET_CONFIG.maxDockets);
}

function countByDomain(dockets = []) {
  return dockets.reduce((counts, docket) => {
    counts[docket.domain] = (counts[docket.domain] || 0) + 1;
    return counts;
  }, {});
}

function buildLocalAffairsDocketView(worldState = {}) {
  const dockets = buildAllDockets(worldState);
  const canRead = roleCanReadDockets(worldState);
  return {
    schemaVersion: LOCAL_AFFAIRS_DOCKET_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    dockets,
    counts: {
      total: dockets.length,
      ...countByDomain(dockets)
    },
    hiddenNotice: canRead
      ? "地方案牍只含服务器由可见城市和任所指标整理的投影；AI 可读但不得直接改库或裁决结局。"
      : "地方官署案牍只在行政身份视野内开放；书生默认不读取完整案牍。"
  };
}

function summarizeLocalAffairsDocketsForPrompt(worldState = {}) {
  const view = buildLocalAffairsDocketView(worldState);
  return {
    generatedAtTurn: view.generatedAtTurn,
    dockets: view.dockets.slice(0, LOCAL_AFFAIRS_DOCKET_CONFIG.maxPromptDockets).map((docket) => ({
      id: docket.id,
      domain: docket.domain,
      domainLabel: docket.domainLabel,
      title: docket.title,
      cityId: docket.cityId,
      jurisdictionId: docket.jurisdictionId,
      bureauId: docket.bureauId,
      severity: docket.severity,
      statusLabel: docket.statusLabel,
      pressureScore: docket.pressureScore,
      metricRefs: docket.metricRefs,
      assessmentHint: docket.assessmentHint,
      publicSummary: docket.publicSummary
    })),
    safety: {
      source: "server_visible_local_affairs_projection",
      authority: "AI 只能读取和叙述；服务器裁决地方事务、考成影响和持久化。"
    }
  };
}

module.exports = {
  LOCAL_AFFAIRS_DOCKET_SCHEMA_VERSION,
  buildLocalAffairsDocketView,
  summarizeLocalAffairsDocketsForPrompt
};
