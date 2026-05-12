const { buildAppointmentTrackView } = require("./appointmentTracks");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildEventArchiveView } = require("./eventArchive");
const { buildExamCalendarView } = require("./examCalendar");
const { buildExamHonorView } = require("./examHonors");
const { buildExamProcedureView } = require("./examProcedure");
const { buildHistoricalEventArchiveView } = require("./historicalEventArchive");
const { buildIntelligenceRumorView } = require("./intelligenceRumors");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildStudyProfileView } = require("./studyProfile");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");

const MAX_ITEM_TEXT_LENGTH = 140;
const SENSITIVE_TOOL_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|provider proposal|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function cleanText(value, fallback = "", maxLength = MAX_ITEM_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_TOOL_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function pushItem(items, value) {
  const text = cleanText(value, "");
  if (text) items.push(text);
}

function visibleContextItemsForDomain(domain, worldState = {}) {
  const items = [];
  if (domain === "geography") {
    const view = buildWorldGeographyView(worldState);
    for (const city of (view.cities || []).slice(0, 6)) {
      pushItem(items, `${city.name || city.id}：${city.publicSummary || city.regionName || ""}`);
    }
    for (const route of (view.routes || []).slice(0, 3)) {
      pushItem(items, `${route.name || route.id}：${route.publicSummary || route.riskLabel || ""}`);
    }
  }

  if (domain === "people") {
    const view = buildWorldPeopleView(worldState);
    for (const npc of (view.npcs || []).slice(0, 6)) {
      pushItem(items, `${npc.name || npc.id}：${npc.publicSummary || npc.rankLabel || ""}`);
    }
    for (const relationship of (view.relationships || []).slice(0, 4)) {
      pushItem(items, relationship.publicSummary || relationship.recentIntent || relationship.id);
    }
  }

  if (domain === "office") {
    const view = buildOfficialPostingsView(worldState);
    for (const posting of (view.postings || []).slice(0, 5)) {
      pushItem(items, `${posting.officeTitle || posting.id}：${posting.publicSummary || posting.statusLabel || ""}`);
    }
    for (const assessment of (view.assessmentRecords || []).slice(0, 3)) {
      pushItem(items, assessment.publicSummary || assessment.publicFinding || assessment.id);
    }
  }

  if (domain === "events") {
    const eventArchive = buildEventArchiveView(worldState, { pageSize: 8 });
    for (const item of (eventArchive.items || []).slice(0, 8)) {
      pushItem(items, `${item.title || item.kind}：${item.summary || item.statusLabel || ""}`);
    }
    const historical = buildHistoricalEventArchiveView(worldState);
    for (const chain of (historical.publicChains || []).slice(0, 3)) {
      pushItem(items, `${chain.title || chain.kind}：${chain.publicSummary || chain.summary || ""}`);
    }
  }

  if (domain === "intel") {
    const view = buildIntelligenceRumorView(worldState);
    for (const rumor of (view.publicRumors || []).slice(0, 5)) {
      pushItem(items, `${rumor.sourceLabel || rumor.channelLabel || "传闻"}：${rumor.publicSummary || rumor.summary || ""}`);
    }
    const military = buildMilitaryDiplomacyView(worldState);
    for (const report of (military.frontierIncidents || []).slice(0, 3)) {
      pushItem(items, `${report.title || report.kind}：${report.publicSummary || report.summary || ""}`);
    }
  }

  if (domain === "study") {
    const view = buildStudyProfileView(worldState);
    pushItem(items, view.summary || view.currentPlan || view.teacherFeedback?.focus || "");
    const advice = Array.isArray(view.teacherFeedback?.advice) ? view.teacherFeedback.advice : [];
    for (const item of advice.slice(0, 3)) pushItem(items, item);
  }

  if (domain === "exam") {
    const calendar = buildExamCalendarView(worldState);
    const procedure = buildExamProcedureView(worldState);
    const honors = buildExamHonorView(worldState);
    const appointment = buildAppointmentTrackView(worldState);
    pushItem(items, calendar.summary || calendar.nextExamLabel || "");
    pushItem(items, procedure?.phaseLabel || procedure?.publicSummary || "");
    pushItem(items, honors?.summary || honors?.currentHonorLabel || "");
    pushItem(items, appointment?.summary || appointment?.currentTrackLabel || "");
  }

  if (domain === "market") {
    const view = buildEconomicFiscalView(worldState);
    for (const row of (view.marketIncidents || []).slice(0, 5)) {
      pushItem(items, `${row.title || row.kind}：${row.publicSummary || row.summary || ""}`);
    }
  }

  if (domain === "local_docket") {
    const view = buildLocalAffairsDocketView(worldState);
    for (const row of (view.dockets || []).slice(0, 5)) {
      pushItem(items, `${row.title || row.kind}：${row.publicSummary || row.summary || ""}`);
    }
  }

  return items;
}

function resolveVisibleContextTool({ worldState = {}, arguments: args = {} }) {
  const maxItems = clampNumber(args.maxItems, 1, 12, 4);
  const domains = Array.isArray(args.domains) ? args.domains : [];
  const items = [];

  for (const domain of domains) {
    for (const item of visibleContextItemsForDomain(domain, worldState)) {
      if (items.length >= maxItems) break;
      items.push(item);
    }
    if (items.length >= maxItems) break;
  }

  return {
    status: "accepted",
    publicResult: {
      summary: items.length
        ? `已返回 ${items.length} 条服务器可见摘要。`
        : "当前 actor 没有可返回的服务器可见摘要。",
      visibleChanges: items
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: [],
    counterCosts: [],
    followUpHooks: []
  };
}

function resolvePendingProposalTool({ toolDefinition }) {
  return {
    status: "pending",
    publicResult: {
      summary: `${toolDefinition.name} 已进入服务器待裁决队列；当前步骤只记录意图，不改写世界状态。`,
      visibleChanges: []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: [],
    counterCosts: ["服务器尚未接入该领域完整 resolver。"],
    followUpHooks: []
  };
}

const DEFAULT_AI_TOOL_RESOLVERS = Object.freeze({
  "server.read_visible_context": resolveVisibleContextTool,
  "server.pending_proposal": resolvePendingProposalTool,
  "server.pending_adjudication": resolvePendingProposalTool
});

module.exports = {
  DEFAULT_AI_TOOL_RESOLVERS,
  resolvePendingProposalTool,
  resolveVisibleContextTool
};
