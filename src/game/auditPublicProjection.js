const { cleanArchiveText } = require("./eventArchive");
const { formatYearMonthPeriod, normalizeMonth, normalizeTenDayPeriod, normalizeYear } = require("./time");

const AUDIT_PUBLIC_PROJECTION_SCHEMA_VERSION = 1;
const MAX_PUBLIC_AUDIT_ITEMS = 100;
const MAX_LABELS = 6;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const UNSAFE_PUBLIC_TEXT_PATTERN = /(\[redacted|SEALED_|hiddenNotes|hiddenIntent)/i;

const PUBLIC_EVENT_TYPE_LABELS = Object.freeze({
  active_request_resolved: "请托了结",
  active_request_expired: "请托逾期",
  exam_question_generated: "科场领题",
  exam_scene_progressed: "科场进程",
  exam_submitted: "科场交卷",
  household_changed: "家族变动",
  npc_lifecycle_changed: "人物履历",
  people_asset_changed: "资产变动",
  people_estate_changed: "田产变动",
  relationship_changed: "人情变动",
  session_started: "开局",
  turn_completed: "回合结算"
});

const RELATED_LABELS = Object.freeze({
  eventHistoryCount: "近事",
  examLevel: "科级",
  examName: "科名",
  openingEventCount: "开篇",
  phase: "阶段",
  phaseLabel: "阶段",
  preparationEventCount: "备考",
  rankingSize: "同场"
});

const APPLIED_LABELS = Object.freeze({
  activeExamStatus: "考试",
  cohortRecorded: "同场",
  finalScore: "得分",
  passed: "结果",
  promotionRank: "名次",
  sceneElapsedHours: "场内时辰",
  sceneTurnCount: "场内步数",
  turnCount: "回合",
  worldEntityImpactCount: "实体影响"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeDateSource(metadata = {}, event = {}) {
  const year = normalizeYear(event.year ?? metadata.year);
  const month = normalizeMonth(event.month ?? metadata.month);
  const tenDayPeriod = normalizeTenDayPeriod(event.tenDayPeriod ?? metadata.tenDayPeriod);
  const dynasty = cleanToken(metadata.dynasty, "", 20);
  return {
    dynasty,
    year,
    month,
    tenDayPeriod,
    dateLabel: formatYearMonthPeriod({ dynasty, year, month, tenDayPeriod })
  };
}

function cleanToken(value, fallback = "", maxLength = 80) {
  const cleaned = cleanArchiveText(value, fallback, maxLength);
  if (!cleaned || UNSAFE_PUBLIC_TEXT_PATTERN.test(cleaned)) return fallback;
  return cleaned;
}

function formatPublicValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  return "";
}

function collectLabels(source = {}, labelMap = {}) {
  if (!isPlainObject(source)) return [];
  const labels = [];
  for (const [key, label] of Object.entries(labelMap)) {
    const value = formatPublicValue(source[key]);
    if (!value) continue;
    const safeValue = cleanToken(value, "", 60);
    if (!safeValue) continue;
    labels.push(`${label}:${safeValue}`);
    if (labels.length >= MAX_LABELS) break;
  }
  return labels;
}

function normalizePublicTimestamp(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function eventTypeLabel(eventType) {
  return PUBLIC_EVENT_TYPE_LABELS[eventType] || cleanToken(eventType, "公开审计", 40);
}

function statusLabelForEvent(event = {}) {
  if (event.eventType === "exam_submitted") return "归档";
  if (event.eventType === "exam_question_generated" || event.eventType === "exam_scene_progressed") return "场中";
  return "已记";
}

function projectAuditEvent(event = {}, context = {}, index = 0) {
  if (event.visibility !== "public") {
    return { item: null, droppedReason: "non_public_visibility" };
  }

  const summary = cleanToken(event.summary, "", 180);
  if (!summary) {
    return { item: null, droppedReason: "sensitive_or_empty_summary" };
  }

  const kind = cleanToken(event.eventType, "audit_event", 60);
  const date = normalizeDateSource(context.metadata, event);
  const turn = clampNumber(event.turnCount, 0, Number.MAX_SAFE_INTEGER, context.metadata?.turnCount || 0);
  const relatedLabels = [
    ...collectLabels(event.related, RELATED_LABELS),
    ...collectLabels(event.appliedChanges, APPLIED_LABELS)
  ].slice(0, MAX_LABELS);

  return {
    item: {
      id: `PAE-${String(index + 1).padStart(3, "0")}`,
      sourceType: "audit_public_event",
      sourceLabel: "公开审计",
      kind,
      title: eventTypeLabel(kind),
      summary,
      year: date.year,
      month: date.month,
      tenDayPeriod: date.tenDayPeriod,
      dateLabel: date.dateLabel,
      turn,
      visibility: "public",
      status: "projected",
      statusLabel: statusLabelForEvent(event),
      riskLabel: "",
      relatedLabels,
      createdAt: normalizePublicTimestamp(event.createdAt)
    },
    droppedReason: ""
  };
}

function sortPublicAuditItems(first, second) {
  if (second.turn !== first.turn) return second.turn - first.turn;
  const secondTime = Date.parse(second.createdAt || "");
  const firstTime = Date.parse(first.createdAt || "");
  if (Number.isFinite(secondTime) && Number.isFinite(firstTime) && secondTime !== firstTime) {
    return secondTime - firstTime;
  }
  return first.id.localeCompare(second.id);
}

function buildPublicAuditProjectionItems(auditEvents = [], options = {}) {
  const context = {
    metadata: options.metadata || {}
  };
  const dropped = {
    nonPublicVisibility: 0,
    sensitiveOrEmptySummary: 0
  };
  const items = [];

  (Array.isArray(auditEvents) ? auditEvents : []).forEach((event, index) => {
    const result = projectAuditEvent(event, context, index);
    if (result.item) {
      items.push(result.item);
      return;
    }
    if (result.droppedReason === "non_public_visibility") dropped.nonPublicVisibility += 1;
    if (result.droppedReason === "sensitive_or_empty_summary") dropped.sensitiveOrEmptySummary += 1;
  });

  return {
    dropped,
    items: items.sort(sortPublicAuditItems)
  };
}

function buildPublicAuditProjectionView(options = {}) {
  const auditEvents = Array.isArray(options.auditEvents) ? options.auditEvents : [];
  const aiProposalCount = clampNumber(options.aiProposalCount, 0, Number.MAX_SAFE_INTEGER, 0);
  const limit = clampNumber(options.limit, 0, MAX_PUBLIC_AUDIT_ITEMS, MAX_PUBLIC_AUDIT_ITEMS);
  const { dropped, items } = buildPublicAuditProjectionItems(auditEvents, {
    metadata: options.metadata
  });
  const visibleItems = limit === 0 ? [] : items.slice(0, limit);

  return {
    schemaVersion: AUDIT_PUBLIC_PROJECTION_SCHEMA_VERSION,
    source: "audit_public_projection",
    sessionId: cleanToken(options.sessionId, "", 80),
    generatedAt: new Date().toISOString(),
    items: visibleItems,
    counts: {
      auditEvents: auditEvents.length,
      aiProposals: aiProposalCount,
      projectedItems: items.length,
      returnedItems: visibleItems.length,
      droppedNonPublic: dropped.nonPublicVisibility,
      droppedSensitiveOrEmpty: dropped.sensitiveOrEmptySummary
    },
    hiddenNotice: "本地审计公开投影只输出 allowlist 后的公开摘要；原始审计、模型原始建议、提示词、本地路径、密钥和隐藏备注均不输出。"
  };
}

module.exports = {
  AUDIT_PUBLIC_PROJECTION_SCHEMA_VERSION,
  buildPublicAuditProjectionItems,
  buildPublicAuditProjectionView
};
