const { buildActiveNpcRequestView } = require("./activeRequests");
const { buildLongTermEventView } = require("./longTermEvents");
const { buildOfficialCareerView } = require("./officialCareer");
const { getBureau, getOffice } = require("./officialCatalog");
const { buildRoleWorldCouplingView } = require("./roleWorldCoupling");

const WORLD_THREAD_SCHEMA_VERSION = 1;
const MAX_THREADS = 12;
const MAX_RECENT_RESOLVED = 8;
const MAX_TEXT_LENGTH = 180;

const THREAD_STATUSES = new Set(["active", "watch", "resolved"]);
const THREAD_KINDS = new Set([
  "npc_request",
  "seasonal",
  "disaster",
  "border",
  "faction_conflict",
  "local_case",
  "consequence",
  "official_assignment",
  "official_outcome",
  "role_impact"
]);
const SOURCE_TYPES = new Set([
  "active_npc_request",
  "long_term_event",
  "official_assignment",
  "official_outcome",
  "role_world_coupling",
  "frontier_report",
  "faction_pressure",
  "local_case_pressure"
]);
const VISIBILITY_VALUES = new Set(["public", "relationship_visible", "hidden"]);

const SOURCE_LABELS = {
  active_npc_request: "人脉请托",
  long_term_event: "长期大势",
  official_assignment: "官场差遣",
  official_outcome: "官场结果",
  role_world_coupling: "身份联动",
  frontier_report: "边镇奏报",
  faction_pressure: "朝局派系",
  local_case_pressure: "地方案链"
};
const FACTION_LABELS = {
  eunuchs: "内廷宦官",
  scholarOfficials: "士大夫",
  militaryLords: "边镇武臣",
  "Eunuch faction": "内廷宦官",
  "Scholar-official faction": "士大夫",
  "Military faction": "边镇武臣"
};
const METRIC_LABELS = {
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  taxRate: "税率",
  corruption: "贪腐",
  armySize: "兵额",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.performanceMerit": "考成",
  "player.promotionProspect": "升迁",
  "player.impeachmentRisk": "弹劾",
  "player.pendingLawsuits": "词讼",
  "player.banditPressure": "盗匪",
  "player.gentryRelations": "乡绅",
  "player.localOrder": "地方民心",
  "factions.eunuchs": "内廷宦官",
  "factions.scholarOfficials": "士大夫",
  "factions.militaryLords": "边镇武臣"
};
const THREAD_KIND_DETAILS = {
  npc_request: {
    goal: "回应来函，权衡人情、名声与利害。",
    interventions: ["回信表态", "拜会相关人物", "暂缓也会留下余波"],
    followUp: "请托成败仍由主动 NPC 请托模块归档。"
  },
  seasonal: {
    goal: "顺着岁时处置钱粮、民生与例行公事。",
    interventions: ["查问地方报册", "筹粮安民", "观察岁时余波"],
    followUp: "岁时余波仍由长期事件模块推进。"
  },
  disaster: {
    goal: "压住灾伤，稳住粮储、民心与官场追责。",
    interventions: ["开仓赈济", "清查赈册", "安抚灾民与士绅"],
    followUp: "灾务结算仍由长期事件与相关身份规则处理。"
  },
  border: {
    goal: "辨明边报虚实，兼顾军心、饷银与边患。",
    interventions: ["遣人核边报", "筹饷稳军", "约束虚报军功"],
    followUp: "边事走向仍由长期事件、世界 tick 或身份联动结算。"
  },
  faction_conflict: {
    goal: "看清章疏、人情与派系牵连，降低朝局反噬。",
    interventions: ["上疏定调", "拜会关键同僚", "避开未明暗流"],
    followUp: "派系压力仍由关系、官场和世界状态模块裁决。"
  },
  local_case: {
    goal: "清理案牍与地方压力，避免盗讼、乡绅和民情互相牵连。",
    interventions: ["审理词讼", "缉捕盗匪", "安抚乡绅与里甲"],
    followUp: "地方案链仍由地方身份规则与长期事件结算。"
  },
  consequence: {
    goal: "追踪已发生行动的后续牵连。",
    interventions: ["查问后续", "补救公开影响", "记录可见证据"],
    followUp: "该议题只提示余波，实际变动仍回到来源系统。"
  },
  official_assignment: {
    goal: "办结差事，留下可用于考成的公开札记。",
    interventions: ["按差事名目行动", "向上官回禀进度", "先查账册或案卷"],
    followUp: "差事完成、失败和考成仍由官场模块结算。"
  },
  official_outcome: {
    goal: "观察任免升降后的官场余波与履历影响。",
    interventions: ["经营同年上官", "谨守清操", "顺势整理履历"],
    followUp: "官职、处分和履历仍由官场模块拥有。"
  },
  role_impact: {
    goal: "追踪本次身份行动转入世界状态后的余波。",
    interventions: ["继续沿身份职责推进", "观察相关指标", "用下一回合补救偏差"],
    followUp: "身份联动效果仍由 role/world coupling 模块结算。"
  }
};
const SOURCE_INTERVENTION_HINTS = {
  active_npc_request: ["回应或拒绝请托"],
  long_term_event: ["围绕大势连续行动"],
  official_assignment: ["把行动写成差事办理"],
  official_outcome: ["关注官场余波"],
  role_world_coupling: ["顺着身份职责补一回合"],
  frontier_report: ["查边报与军饷"],
  faction_pressure: ["谨慎处理章疏和人情"],
  local_case_pressure: ["先断案或安民"]
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function readNumber(source, key, fallback) {
  const value = Number(source?.[key]);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readPlayerNumber(worldState, key, fallback) {
  return readNumber(worldState?.player, key, fallback);
}

function normalizeIdList(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanText(entry, "", 80))
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueList(values, limit = 8) {
  const result = [];
  const seen = new Set();
  values.forEach((value) => {
    const text = cleanText(value, "", 80);
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result.slice(0, limit);
}

function normalizeRelated(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    characters: normalizeIdList(source.characters),
    factions: normalizeIdList(source.factions),
    offices: normalizeIdList(source.offices),
    metrics: normalizeIdList(source.metrics, 10)
  };
}

function normalizeThread(raw, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const id = cleanText(raw.id, "", 96);
  const title = cleanText(raw.title, "");
  if (!id || !title) return null;

  const sourceType = SOURCE_TYPES.has(raw.sourceType) ? raw.sourceType : "long_term_event";
  const kind = THREAD_KINDS.has(raw.kind) ? raw.kind : "consequence";
  const status = THREAD_STATUSES.has(raw.status) ? raw.status : "active";
  const turn = currentTurn(worldState);
  const dueTurn = raw.dueTurn === null || raw.dueTurn === undefined
    ? null
    : clampNumber(raw.dueTurn, 0, turn + 240, turn);
  const remainingMonths = raw.remainingMonths === null || raw.remainingMonths === undefined
    ? null
    : clampNumber(raw.remainingMonths, 0, 60, 0);

  return {
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    id,
    status,
    kind,
    sourceType,
    sourceId: cleanText(raw.sourceId, id, 96),
    sourceLabel: cleanText(raw.sourceLabel, SOURCE_LABELS[sourceType] || "世界议题", 40),
    title,
    summary: cleanText(raw.summary, title),
    severity: clampNumber(raw.severity, 1, 3, 1),
    createdTurn: clampNumber(raw.createdTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    lastUpdatedTurn: clampNumber(raw.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    dueTurn,
    startedYear: raw.startedYear === null || raw.startedYear === undefined
      ? null
      : clampNumber(raw.startedYear, 1, 9999, readNumber(worldState, "year", 1644)),
    startedMonth: raw.startedMonth === null || raw.startedMonth === undefined
      ? null
      : clampNumber(raw.startedMonth, 1, 12, readNumber(worldState, "month", 1)),
    remainingMonths,
    visibility: VISIBILITY_VALUES.has(raw.visibility) ? raw.visibility : "public",
    related: normalizeRelated(raw.related)
  };
}

function normalizeResolvedThread(raw, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const visibility = VISIBILITY_VALUES.has(raw.visibility) ? raw.visibility : "public";
  if (visibility === "hidden") return null;

  const id = cleanText(raw.id, "", 96);
  const title = cleanText(raw.title, "");
  if (!id || !title) return null;

  return {
    id,
    kind: THREAD_KINDS.has(raw.kind) ? raw.kind : "consequence",
    sourceType: SOURCE_TYPES.has(raw.sourceType) ? raw.sourceType : "long_term_event",
    sourceId: cleanText(raw.sourceId, id, 96),
    title,
    resolvedTurn: clampNumber(raw.resolvedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    outcome: cleanText(raw.outcome, "暂归档", 80)
  };
}

function createInitialWorldThreadState() {
  return {
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    threads: [],
    recentResolved: []
  };
}

function normalizeWorldThreadState(worldState = {}) {
  const source = isPlainObject(worldState.worldThreads) ? worldState.worldThreads : {};
  return {
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    threads: Array.isArray(source.threads)
      ? source.threads
        .map((thread) => normalizeThread(thread, worldState))
        .filter(Boolean)
        .sort(compareThreads)
        .slice(0, MAX_THREADS)
      : [],
    recentResolved: Array.isArray(source.recentResolved)
      ? source.recentResolved
        .map((thread) => normalizeResolvedThread(thread, worldState))
        .filter(Boolean)
        .slice(-MAX_RECENT_RESOLVED)
      : []
  };
}

function makeThread(worldState, config) {
  return normalizeThread({
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    createdTurn: currentTurn(worldState),
    lastUpdatedTurn: currentTurn(worldState),
    ...config
  }, worldState);
}

function eventKind(type) {
  if (type === "court") return "faction_conflict";
  if (THREAD_KINDS.has(type)) return type;
  return "consequence";
}

function eventRelated(event) {
  if (event.type === "disaster") {
    return { metrics: ["grainReserve", "publicOrder", "population"] };
  }
  if (event.type === "border") {
    return { factions: ["militaryLords"], metrics: ["borderThreat", "armyMorale", "treasury"] };
  }
  if (event.type === "court") {
    return {
      factions: ["eunuchs", "scholarOfficials", "militaryLords"],
      metrics: ["corruption", "publicOrder", "treasury"]
    };
  }
  if (event.type === "local_case") {
    return {
      metrics: ["player.pendingLawsuits", "player.banditPressure", "player.gentryRelations", "publicOrder"]
    };
  }
  if (event.type === "seasonal") {
    return { metrics: ["grainReserve", "publicOrder"] };
  }
  return { metrics: ["publicOrder"] };
}

function assignmentRelated(assignment) {
  const related = {
    offices: assignment.bureauId ? [assignment.bureauId] : [],
    metrics: ["player.performanceMerit", "player.impeachmentRisk"]
  };
  if (assignment.kind === "military_supply") {
    related.factions = ["militaryLords"];
    related.metrics.push("borderThreat", "treasury");
  } else if (assignment.kind === "audit" || assignment.kind === "personnel_review") {
    related.factions = ["scholarOfficials", "eunuchs"];
    related.metrics.push("corruption");
  } else if (assignment.kind === "relief" || assignment.kind === "land_survey" || assignment.kind === "salt_transport") {
    related.factions = ["scholarOfficials"];
    related.metrics.push("grainReserve", "publicOrder");
  } else if (assignment.kind === "case_review" || assignment.kind === "riverworks") {
    related.factions = ["scholarOfficials"];
    related.metrics.push("publicOrder");
  }
  return related;
}

function outcomeSeverity(type) {
  if (type === "punishment" || type === "impeachment" || type === "demotion") return 3;
  if (type === "promotion" || type === "outpost" || type === "transfer") return 2;
  return 1;
}

function impactKind(kind) {
  if (kind === "general_campaign") return "border";
  if (kind === "magistrate_waterworks") return "local_case";
  if (kind === "emperor_appointments" || kind === "minister_impeachment") return "faction_conflict";
  return "role_impact";
}

function impactRelated(impact) {
  const affectedPaths = normalizeIdList(impact.affectedPaths, 10);
  const factions = [];
  if (affectedPaths.some((path) => path.includes("militaryLords") || path === "borderThreat")) {
    factions.push("militaryLords");
  }
  if (affectedPaths.some((path) => path.includes("scholarOfficials") || path === "corruption")) {
    factions.push("scholarOfficials");
  }
  if (affectedPaths.some((path) => path.includes("eunuchs"))) {
    factions.push("eunuchs");
  }
  return {
    factions,
    metrics: affectedPaths
  };
}

function severityFromRisk(risk, publicStake) {
  const riskScore = Math.max(Number(risk) || 0, Number(publicStake) || 0);
  if (riskScore >= 75) return 3;
  if (riskScore >= 45) return 2;
  return 1;
}

function buildRiskInfo(severity) {
  if (severity >= 3) return { riskLabel: "急重", riskTone: "high" };
  if (severity >= 2) return { riskLabel: "有牵连", riskTone: "medium" };
  return { riskLabel: "可观察", riskTone: "low" };
}

function buildDeadlineLabel(thread, worldState = {}) {
  if (thread.dueTurn !== null && thread.dueTurn !== undefined) {
    const remainingTurns = Math.max(0, thread.dueTurn - currentTurn(worldState));
    if (remainingTurns === 0) return `第${thread.dueTurn}回，当回须办`;
    return `第${thread.dueTurn}回，尚余${remainingTurns}回`;
  }
  if (thread.remainingMonths !== null && thread.remainingMonths !== undefined) {
    if (thread.remainingMonths === 0) return "本月见分晓";
    return `约余${thread.remainingMonths}月`;
  }
  return "无明期，随大势观察";
}

function labelCharacter(id, worldState = {}) {
  const character = Array.isArray(worldState.characters)
    ? worldState.characters.find((entry) => entry?.id === id)
    : null;
  return character?.name || id;
}

function labelOffice(id) {
  const bureau = getBureau(id);
  if (bureau) return bureau.name;
  const office = getOffice(id);
  if (office) return office.title;
  return id;
}

function buildRelatedLabels(related = {}, worldState = {}) {
  const characters = uniqueList((related.characters || []).map((id) => labelCharacter(id, worldState)), 6);
  const factions = uniqueList((related.factions || []).map((id) => FACTION_LABELS[id] || id), 6);
  const offices = uniqueList((related.offices || []).map((id) => labelOffice(id)), 6);
  const metrics = uniqueList((related.metrics || []).map((id) => METRIC_LABELS[id] || id), 8);
  const summary = uniqueList([...characters, ...factions, ...offices, ...metrics], 8);
  return { characters, factions, offices, metrics, summary };
}

function buildInterventionHints(thread) {
  const kindDetails = THREAD_KIND_DETAILS[thread.kind] || THREAD_KIND_DETAILS.consequence;
  const sourceHints = SOURCE_INTERVENTION_HINTS[thread.sourceType] || [];
  return uniqueList([...kindDetails.interventions, ...sourceHints], 4);
}

function buildFollowUpHint(thread) {
  const kindDetails = THREAD_KIND_DETAILS[thread.kind] || THREAD_KIND_DETAILS.consequence;
  if (thread.status === "watch") {
    return `已转入观察：${kindDetails.followUp}`;
  }
  if (thread.dueTurn !== null && thread.dueTurn !== undefined) {
    return `临近期限时，${kindDetails.followUp}`;
  }
  return kindDetails.followUp;
}

function deriveActiveRequestThread(worldState) {
  const request = buildActiveNpcRequestView(worldState);
  if (!request) return null;
  return makeThread(worldState, {
    id: `WT-request-${request.id}`,
    sourceType: "active_npc_request",
    sourceId: request.id,
    kind: "npc_request",
    title: request.title,
    summary: `${request.ask} ${request.stakes}`,
    severity: request.kind === "pressure" || request.turnsRemaining <= 0 ? 2 : 1,
    dueTurn: request.dueTurn,
    createdTurn: request.createdTurn,
    lastUpdatedTurn: request.lastUpdatedTurn,
    related: {
      characters: request.targetType === "character" ? [request.targetId] : [],
      factions: request.targetType === "faction" ? [request.targetId] : []
    },
    visibility: "relationship_visible"
  });
}

function deriveLongTermEventThreads(worldState) {
  return buildLongTermEventView(worldState).activeEvents.map((event) => makeThread(worldState, {
    id: `WT-lte-${event.id}`,
    sourceType: "long_term_event",
    sourceId: event.id,
    kind: eventKind(event.type),
    title: event.title,
    summary: event.summary,
    severity: event.severity,
    createdTurn: currentTurn(worldState),
    startedYear: event.startedYear,
    startedMonth: event.startedMonth,
    remainingMonths: event.remainingMonths,
    related: eventRelated(event)
  })).filter(Boolean);
}

function deriveOfficialAssignmentThreads(worldState) {
  const view = buildOfficialCareerView(worldState);
  if (!view.active) return [];
  return (view.assignments || []).map((assignment) => makeThread(worldState, {
    id: `WT-official-assignment-${assignment.id}`,
    sourceType: "official_assignment",
    sourceId: assignment.id,
    kind: "official_assignment",
    status: assignment.status === "submitted" ? "watch" : "active",
    title: assignment.title,
    summary: assignment.visibleSummary,
    severity: severityFromRisk(assignment.risk, assignment.publicStake),
    dueTurn: assignment.dueTurn,
    related: assignmentRelated(assignment)
  })).filter(Boolean);
}

function deriveOfficialOutcomeThreads(worldState) {
  const view = buildOfficialCareerView(worldState);
  if (!view.active) return [];
  return (view.recentOutcomes || []).slice(-3).map((outcome) => makeThread(worldState, {
    id: `WT-official-outcome-${outcome.id}`,
    sourceType: "official_outcome",
    sourceId: outcome.id,
    kind: "official_outcome",
    status: "watch",
    title: outcome.label,
    summary: outcome.reason,
    severity: outcomeSeverity(outcome.type),
    createdTurn: outcome.turn,
    lastUpdatedTurn: outcome.turn,
    startedYear: outcome.year,
    startedMonth: outcome.month,
    related: {
      offices: [outcome.officeTitleBefore, outcome.officeTitleAfter].filter(Boolean),
      metrics: ["player.performanceMerit", "player.promotionProspect", "player.impeachmentRisk"]
    }
  })).filter(Boolean);
}

function deriveRoleImpactThreads(worldState) {
  const view = buildRoleWorldCouplingView(worldState);
  return (view.recentImpacts || []).slice(-4).map((impact) => makeThread(worldState, {
    id: `WT-role-impact-${impact.id}`,
    sourceType: "role_world_coupling",
    sourceId: impact.id,
    kind: impactKind(impact.kind),
    status: "watch",
    title: impact.title,
    summary: impact.summary,
    severity: impact.affectedPaths?.some((path) => path === "borderThreat" || path === "corruption") ? 2 : 1,
    createdTurn: impact.turn,
    lastUpdatedTurn: impact.turn,
    startedYear: impact.year,
    startedMonth: impact.month,
    related: impactRelated(impact)
  })).filter(Boolean);
}

function factionSpread(factions = {}) {
  const values = Object.values(factions).filter((value) => typeof value === "number");
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

function deriveFrontierPressureThread(worldState) {
  const threat = readNumber(worldState, "borderThreat", 40);
  if (threat < 65) return null;
  const morale = readNumber(worldState, "armyMorale", 65);
  return makeThread(worldState, {
    id: "WT-metric-frontier-pressure",
    sourceType: "frontier_report",
    sourceId: "borderThreat",
    kind: "border",
    title: "边镇军情未靖",
    summary: `边患约${threat}，军心约${morale}，兵部与军镇消息需要连续观察。`,
    severity: threat >= 85 ? 3 : threat >= 72 ? 2 : 1,
    related: {
      factions: ["militaryLords"],
      metrics: ["borderThreat", "armyMorale", "treasury"]
    }
  });
}

function deriveFactionPressureThread(worldState) {
  const corruption = readNumber(worldState, "corruption", 60);
  const spread = factionSpread(worldState.factions || {});
  if (corruption < 75 && spread < 40) return null;
  return makeThread(worldState, {
    id: "WT-metric-faction-pressure",
    sourceType: "faction_pressure",
    sourceId: "court_factions",
    kind: "faction_conflict",
    title: "朝局派系相轧",
    summary: `贪腐约${corruption}，派系强弱差约${spread}，章疏与人事情面可能互相牵连。`,
    severity: corruption >= 88 || spread >= 58 ? 3 : 2,
    related: {
      factions: ["eunuchs", "scholarOfficials", "militaryLords"],
      metrics: ["corruption", "publicOrder", "treasury"]
    }
  });
}

function deriveLocalCasePressureThread(worldState) {
  if (worldState.player?.role !== "magistrate") return null;
  const pending = readPlayerNumber(worldState, "pendingLawsuits", 0);
  const bandits = readPlayerNumber(worldState, "banditPressure", 0);
  if (pending < 25 && bandits < 55) return null;
  return makeThread(worldState, {
    id: "WT-metric-local-case-pressure",
    sourceType: "local_case_pressure",
    sourceId: worldState.player?.countyName || "local_case",
    kind: "local_case",
    title: `${worldState.player?.countyName || "本县"}案务未清`,
    summary: `词讼约${pending}，盗匪约${bandits}，乡绅、差役与民情可能继续牵连。`,
    severity: bandits >= 75 || pending >= 45 ? 3 : 2,
    related: {
      characters: ["C01"],
      metrics: ["player.pendingLawsuits", "player.banditPressure", "player.gentryRelations", "publicOrder"]
    }
  });
}

function deriveMetricPressureThreads(worldState, existingThreads) {
  const threads = [];
  const hasKindFromLongTerm = (kind) => existingThreads.some((thread) =>
    thread?.kind === kind && thread.sourceType === "long_term_event"
  );
  if (!hasKindFromLongTerm("border")) threads.push(deriveFrontierPressureThread(worldState));
  if (!hasKindFromLongTerm("faction_conflict")) threads.push(deriveFactionPressureThread(worldState));
  if (!hasKindFromLongTerm("local_case")) threads.push(deriveLocalCasePressureThread(worldState));
  return threads.filter(Boolean);
}

function deriveWorldThreads(worldState = {}) {
  const threads = [
    deriveActiveRequestThread(worldState),
    ...deriveLongTermEventThreads(worldState),
    ...deriveOfficialAssignmentThreads(worldState),
    ...deriveOfficialOutcomeThreads(worldState),
    ...deriveRoleImpactThreads(worldState)
  ].filter(Boolean);

  threads.push(...deriveMetricPressureThreads(worldState, threads));
  return threads.filter(Boolean);
}

function compareThreads(first, second) {
  const statusRank = { active: 0, watch: 1, resolved: 2 };
  const firstRank = statusRank[first.status] ?? 9;
  const secondRank = statusRank[second.status] ?? 9;
  if (firstRank !== secondRank) return firstRank - secondRank;
  if (second.severity !== first.severity) return second.severity - first.severity;
  if (first.dueTurn !== second.dueTurn) {
    if (first.dueTurn === null) return 1;
    if (second.dueTurn === null) return -1;
    return first.dueTurn - second.dueTurn;
  }
  if (second.lastUpdatedTurn !== first.lastUpdatedTurn) {
    return second.lastUpdatedTurn - first.lastUpdatedTurn;
  }
  return first.id.localeCompare(second.id);
}

function mergeDerivedThread(worldState, previousById, thread) {
  const previous = previousById.get(thread.id);
  return normalizeThread({
    ...thread,
    createdTurn: previous?.createdTurn ?? thread.createdTurn,
    lastUpdatedTurn: Math.max(previous?.lastUpdatedTurn ?? 0, thread.lastUpdatedTurn ?? currentTurn(worldState))
  }, worldState);
}

function collectResolvedThreads(previousThreads, nextThreads, worldState) {
  const nextIds = new Set(nextThreads.map((thread) => thread.id));
  return previousThreads
    .filter((thread) => thread.visibility !== "hidden" && thread.status !== "resolved" && !nextIds.has(thread.id))
    .map((thread) => normalizeResolvedThread({
      id: thread.id,
      kind: thread.kind,
      sourceType: thread.sourceType,
      sourceId: thread.sourceId,
      title: thread.title,
      resolvedTurn: currentTurn(worldState),
      outcome: "暂归档"
    }, worldState))
    .filter(Boolean);
}

function syncWorldThreadState(worldState) {
  if (!isPlainObject(worldState)) return createInitialWorldThreadState();
  const previous = normalizeWorldThreadState(worldState);
  const previousById = new Map(previous.threads.map((thread) => [thread.id, thread]));
  const derived = deriveWorldThreads(worldState);
  const threads = derived
    .map((thread) => mergeDerivedThread(worldState, previousById, thread))
    .filter(Boolean)
    .sort(compareThreads)
    .slice(0, MAX_THREADS);
  const resolved = collectResolvedThreads(previous.threads, derived.filter(Boolean), worldState);

  worldState.worldThreads = {
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    threads,
    recentResolved: [
      ...previous.recentResolved,
      ...resolved
    ].slice(-MAX_RECENT_RESOLVED)
  };
  return worldState.worldThreads;
}

function ensureWorldThreadState(worldState) {
  return syncWorldThreadState(worldState);
}

function viewThread(thread, worldState = {}) {
  const kindDetails = THREAD_KIND_DETAILS[thread.kind] || THREAD_KIND_DETAILS.consequence;
  const risk = buildRiskInfo(thread.severity);
  return {
    id: thread.id,
    status: thread.status,
    kind: thread.kind,
    sourceType: thread.sourceType,
    sourceId: thread.sourceId,
    sourceLabel: thread.sourceLabel,
    title: thread.title,
    summary: thread.summary,
    severity: thread.severity,
    createdTurn: thread.createdTurn,
    lastUpdatedTurn: thread.lastUpdatedTurn,
    dueTurn: thread.dueTurn,
    turnsRemaining: thread.dueTurn === null ? null : Math.max(0, thread.dueTurn - currentTurn(worldState)),
    deadlineLabel: buildDeadlineLabel(thread, worldState),
    startedYear: thread.startedYear,
    startedMonth: thread.startedMonth,
    remainingMonths: thread.remainingMonths,
    goal: kindDetails.goal,
    riskLabel: risk.riskLabel,
    riskTone: risk.riskTone,
    related: thread.related,
    relatedLabels: buildRelatedLabels(thread.related, worldState),
    interventionHints: buildInterventionHints(thread),
    followUpHint: buildFollowUpHint(thread)
  };
}

function buildWorldThreadView(worldState = {}) {
  const state = normalizeWorldThreadState(worldState);
  const visibleThreads = state.threads.filter((thread) => thread.visibility !== "hidden");
  return {
    schemaVersion: WORLD_THREAD_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    activeThreads: visibleThreads.map((thread) => viewThread(thread, worldState)),
    recentResolved: state.recentResolved.slice(-5).map((thread) => ({
      id: thread.id,
      kind: thread.kind,
      sourceType: thread.sourceType,
      sourceId: thread.sourceId,
      title: thread.title,
      resolvedTurn: thread.resolvedTurn,
      outcome: thread.outcome
    }))
  };
}

function summarizeWorldThreadsForPrompt(worldState = {}) {
  const view = buildWorldThreadView(worldState);
  return {
    activeThreads: view.activeThreads.slice(0, 8).map((thread) => ({
      kind: thread.kind,
      status: thread.status,
      sourceLabel: thread.sourceLabel,
      title: thread.title,
      summary: thread.summary,
      severity: thread.severity,
      riskLabel: thread.riskLabel,
      dueTurn: thread.dueTurn,
      deadlineLabel: thread.deadlineLabel,
      remainingMonths: thread.remainingMonths,
      goal: thread.goal,
      related: thread.related,
      relatedLabels: thread.relatedLabels,
      interventionHints: thread.interventionHints,
      followUpHint: thread.followUpHint
    })),
    recentResolved: view.recentResolved.slice(-3)
  };
}

module.exports = {
  WORLD_THREAD_SCHEMA_VERSION,
  buildWorldThreadView,
  createInitialWorldThreadState,
  deriveWorldThreads,
  ensureWorldThreadState,
  normalizeWorldThreadState,
  summarizeWorldThreadsForPrompt,
  syncWorldThreadState
};
