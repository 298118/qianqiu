const { buildEconomicFiscalRetrievalRows } = require("./economicFiscal");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyRetrievalRows } = require("./militaryDiplomacy");
const { buildOfficialCareerView } = require("./officialCareer");
const { buildOfficialPostingsView } = require("./officialPostings");
const {
  MONTHLY_BRIEFING_LIMITS,
  MONTHLY_BRIEFING_SECTION_CONFIG,
  PLAYER_MONTHLY_BRIEFING_ROLE_LABELS,
  PLAYER_MONTHLY_BRIEFING_ROLES,
  PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION
} = require("./playerMonthlyBriefingConfig");
const { formatYearMonthPeriod, normalizeMonth, normalizeTenDayPeriod, normalizeYear } = require("./time");
const { buildWorldPeopleView } = require("./worldPeople");

const ELIGIBLE_ROLES = new Set(PLAYER_MONTHLY_BRIEFING_ROLES);
const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

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

function cleanText(value, fallback = "", maxLength = MONTHLY_BRIEFING_LIMITS.maxTextLength) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw || SENSITIVE_TEXT_PATTERN.test(raw)) return fallback;
  const redacted = redactSecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_TEXT_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanTextList(values, limit, fallbackItems = []) {
  const source = Array.isArray(values) ? values : values ? [values] : fallbackItems;
  const result = [];
  const seen = new Set();
  for (const value of source) {
    const text = isPlainObject(value)
      ? cleanText(value.publicSummary || value.summary || value.title || value.label || value.detail, "")
      : cleanText(value, "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function readDateSource(worldState = {}, source = {}) {
  const candidate = isPlainObject(source) ? source : {};
  const calendar = {
    dynasty: candidate.dynasty || worldState.dynasty || "",
    year: normalizeYear(candidate.year ?? worldState.year),
    month: normalizeMonth(candidate.month ?? worldState.month),
    tenDayPeriod: normalizeTenDayPeriod(candidate.tenDayPeriod ?? worldState.tenDayPeriod)
  };
  return {
    ...calendar,
    turn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(calendar)
  };
}

function periodFromWorldTick(worldState = {}, worldTick = {}) {
  const from = worldTick?.timeAdvance?.from || worldState;
  const year = normalizeYear(from.year ?? worldState.year);
  const month = normalizeMonth(from.month ?? worldState.month);
  const calendar = {
    dynasty: worldState.dynasty || "",
    year,
    month,
    tenDayPeriod: normalizeTenDayPeriod(from.tenDayPeriod ?? 3, 3)
  };
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${worldState.dynasty || ""}${year}年${month}月`,
    date: {
      ...calendar,
      dateLabel: formatYearMonthPeriod(calendar),
      turn: currentTurn(worldState)
    }
  };
}

function roleCanReceiveMonthlyBriefing(worldState = {}) {
  return ELIGIBLE_ROLES.has(worldState.player?.role || "");
}

function createInitialPlayerMonthlyBriefingState() {
  return {
    schemaVersion: PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION,
    lastPeriodKey: null,
    reports: []
  };
}

function normalizeReport(report, worldState = {}) {
  if (!isPlainObject(report)) return null;
  const periodKey = cleanId(report.periodKey, "");
  const reportId = cleanId(report.id || report.reportId, periodKey ? `PMB-${periodKey}` : "");
  if (!periodKey || !reportId) return null;
  const role = cleanId(report.role || worldState.player?.role, worldState.player?.role || "official");
  const sections = normalizeSections(report.sections);

  return {
    id: reportId,
    reportId,
    schemaVersion: PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION,
    periodKey,
    periodLabel: cleanText(report.periodLabel, periodKey, 40),
    generatedAtTurn: clampNumber(report.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    generatedAt: readDateSource(worldState, report.generatedAt),
    role,
    roleLabel: cleanText(
      report.roleLabel,
      PLAYER_MONTHLY_BRIEFING_ROLE_LABELS[role] || worldState.player?.roleLabel || role,
      40
    ),
    title: cleanText(report.title, "官职月报", 80),
    publicSummary: cleanText(report.publicSummary || report.summary, "本月官务已由服务器整理成公开月报。"),
    sections,
    actionItems: cleanTextList(report.actionItems, MONTHLY_BRIEFING_LIMITS.maxActionItems),
    riskItems: cleanTextList(report.riskItems, MONTHLY_BRIEFING_LIMITS.maxRiskItems),
    sourceRefs: normalizeSourceRefs(report.sourceRefs),
    aiReadScope: cleanTextList(report.aiReadScope, 8, defaultAiReadScope()),
    actorIntelligence: cleanText(
      report.actorIntelligence,
      "月报只代表玩家当前官职视野，不循环读取所有 NPC 隐藏状态。",
      120
    ),
    toolPermissions: cleanText(
      report.toolPermissions,
      "AI 可读公开 projection 并生成建议文本；不得调用写库、任免、钱粮、刑案或军事裁决工具。",
      140
    ),
    serverAdjudication: cleanText(
      report.serverAdjudication,
      "服务器只保存脱敏月报与事件摘要；官职、资源、人物和持久化状态仍由既有规则裁决。",
      140
    )
  };
}

function normalizePlayerMonthlyBriefingState(rawState, worldState = {}) {
  const normalized = createInitialPlayerMonthlyBriefingState();
  const raw = isPlainObject(rawState) ? rawState : {};
  const reports = Array.isArray(raw.reports) ? raw.reports : [];
  normalized.reports = reports
    .map((report) => normalizeReport(report, worldState))
    .filter(Boolean)
    .slice(-MONTHLY_BRIEFING_LIMITS.maxReports);
  normalized.lastPeriodKey = cleanId(raw.lastPeriodKey, "") ||
    normalized.reports.at(-1)?.periodKey ||
    null;
  return normalized;
}

function ensurePlayerMonthlyBriefingState(worldState = {}) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.playerMonthlyBriefing = normalizePlayerMonthlyBriefingState(
    worldState.playerMonthlyBriefing,
    worldState
  );
  return worldState;
}

function normalizeSourceRefs(sourceRefs) {
  const refs = Array.isArray(sourceRefs) ? sourceRefs : [];
  const normalized = [];
  const seen = new Set();
  for (const ref of refs) {
    if (!isPlainObject(ref)) continue;
    const id = cleanId(ref.id, "");
    const label = cleanText(ref.label || ref.title || ref.source, id, 60);
    const source = cleanText(ref.source || ref.type, "server_projection", 60);
    const key = `${source}:${id || label}`;
    if (!label || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ id, label, source });
    if (normalized.length >= MONTHLY_BRIEFING_LIMITS.maxSourceRefs) break;
  }
  return normalized;
}

function normalizeSections(sections) {
  const rawSections = Array.isArray(sections) ? sections : [];
  const normalized = [];
  for (const config of MONTHLY_BRIEFING_SECTION_CONFIG) {
    const raw = rawSections.find((section) => section?.id === config.id || section?.title === config.label) || {};
    const summary = cleanText(raw.publicSummary || raw.summary, "", MONTHLY_BRIEFING_LIMITS.maxTextLength);
    const items = cleanTextList(
      raw.items || raw.points || raw.events,
      Math.min(config.maxItems, MONTHLY_BRIEFING_LIMITS.maxSectionItems)
    );
    if (!summary && !items.length) continue;
    normalized.push({
      id: config.id,
      title: cleanText(raw.title || raw.label, config.label, 40),
      publicSummary: summary,
      items
    });
  }
  return normalized;
}

function sourceRef(source, row = {}, fallbackLabel = "") {
  const id = cleanId(row.id || row.reportId || row.sourceId || row.officeId || row.bureauId, "");
  const label = cleanText(row.title || row.officeTitle || row.name || row.publicSummary, fallbackLabel || source, 60);
  return label ? { id, label, source } : null;
}

function topTexts(rows, field = "publicSummary", limit = 3) {
  return cleanTextList((Array.isArray(rows) ? rows : []).map((row) => row?.[field] || row?.title), limit);
}

function findPlayerPosting(officialPostingsView = {}) {
  return (officialPostingsView.postings || []).find((posting) => posting.holderType === "player") || null;
}

function buildCourtNetworkItems(worldPeopleView = {}, officialPostingsView = {}) {
  const superior = (officialPostingsView.postings || []).find((posting) =>
    posting.id === "s63-superior-posting" || /上级|堂官|督责/.test(posting.publicSummary || "")
  );
  const people = (worldPeopleView.npcs || [])
    .map((npc) => cleanText(npc.publicSummary || `${npc.name || "同僚"}在${npc.bureauId || "官署"}活动。`, "", 120))
    .filter(Boolean)
    .slice(0, 3);
  return [
    superior ? cleanText(superior.publicSummary, "", 120) : "",
    ...people
  ].filter(Boolean).slice(0, 4);
}

function defaultAiReadScope() {
  return [
    "officialCareerView",
    "officialPostingsView",
    "localAffairsDocketView",
    "economicFiscalView",
    "militaryDiplomacyView",
    "worldPeopleView"
  ];
}

function buildPlayerMonthlyBriefingContext(worldState = {}, options = {}) {
  const officialCareerView = buildOfficialCareerView(worldState);
  const officialPostingsView = buildOfficialPostingsView(worldState);
  const localAffairsDocketView = buildLocalAffairsDocketView(worldState);
  const worldPeopleView = buildWorldPeopleView(worldState);
  const economicReports = buildEconomicFiscalRetrievalRows(worldState);
  const militaryReports = buildMilitaryDiplomacyRetrievalRows(worldState);
  const period = options.period || periodFromWorldTick(worldState, options.worldTick);
  const playerPosting = findPlayerPosting(officialPostingsView);
  const role = cleanId(worldState.player?.role, "official");
  const roleLabel = PLAYER_MONTHLY_BRIEFING_ROLE_LABELS[role] || worldState.player?.roleLabel || role;
  const sourceRefs = [
    sourceRef("official_posting", playerPosting || officialCareerView, officialCareerView.currentPosting || "本职差事"),
    ...(localAffairsDocketView.dockets || []).slice(0, 2).map((docket) => sourceRef("local_docket", docket)),
    ...economicReports.slice(0, 2).map((report) => sourceRef("economic_fiscal", report)),
    ...militaryReports.slice(0, 2).map((report) => sourceRef("military_diplomacy", report))
  ].filter(Boolean);

  return {
    period,
    role,
    roleLabel: cleanText(roleLabel, role, 40),
    playerName: cleanText(worldState.player?.name, "玩家", 40),
    currentPosting: cleanText(
      officialCareerView.currentPosting || playerPosting?.officeTitle || worldState.player?.officeTitle || worldState.player?.position,
      "本职差事",
      80
    ),
    officialCareerView,
    officialPostingsView,
    localAffairsDocketView,
    worldPeopleView,
    economicReports,
    militaryReports,
    sourceRefs: normalizeSourceRefs(sourceRefs),
    aiReadScope: defaultAiReadScope(),
    actorIntelligence: "月报智能只按玩家当前身份读取公开 projection；不得扫描或暴露隐藏 NPC、原始提示词、诊断路径或数据库表。",
    toolPermissions: "允许生成月报草案和行动建议；禁止写库、调兵、改税、处分、任免、结案或直接持久化游戏状态。",
    serverAdjudication: "服务器清洗并归档月报文本；所有状态边界、官场结算、财政军务和后续事件仍由既有服务器规则处理。"
  };
}

function buildSection(id, publicSummary, items) {
  const config = MONTHLY_BRIEFING_SECTION_CONFIG.find((section) => section.id === id) || {};
  return {
    id,
    title: config.label || id,
    publicSummary,
    items: cleanTextList(items, config.maxItems || MONTHLY_BRIEFING_LIMITS.maxSectionItems)
  };
}

function generateMonthlyBriefingProposal(context = {}) {
  const official = context.officialCareerView || {};
  const localDockets = context.localAffairsDocketView?.dockets || [];
  const assignments = official.assignments || [];
  const activeAssignmentText = assignments.length
    ? assignments.slice(0, 3).map((assignment) => `${assignment.title}：${assignment.deadlineLabel || "限期未明"}，进度${assignment.progress ?? 0}。`)
    : [`${context.currentPosting || "本职差事"}本月以例行案牍、上官督责和公开差遣为主。`];
  const docketTexts = topTexts(localDockets, "publicDocket", 3);
  const fiscalTexts = topTexts(context.economicReports, "publicSummary", 3);
  const militaryTexts = topTexts(context.militaryReports, "publicSummary", 2);
  const networkItems = buildCourtNetworkItems(context.worldPeopleView, context.officialPostingsView);
  const careerRisk = clampNumber(official.riskScore ?? context.officialCareerView?.assessment?.riskScore, 0, 100, 0);
  const urgentAssignments = assignments.filter((assignment) => assignment.turnsRemaining !== null && assignment.turnsRemaining <= 1);
  const actionItems = cleanTextList([
    urgentAssignments[0] ? `先办${urgentAssignments[0].title}，免入逾期考成。` : "",
    docketTexts[0] ? `复核案牍：${docketTexts[0]}` : "",
    fiscalTexts[0] ? `留意钱粮：${fiscalTexts[0]}` : "",
    militaryTexts[0] ? `备查军务：${militaryTexts[0]}` : "",
    "下月行动仍须经服务器规则结算，月报建议不得直接改变状态。"
  ], MONTHLY_BRIEFING_LIMITS.maxActionItems);
  const riskItems = cleanTextList([
    careerRisk >= 70 ? `官场风险偏高，考成风险${careerRisk}。` : "",
    localDockets.find((docket) => docket.status !== "routine")?.publicSummary || "",
    context.economicReports.find((report) => (report.pressureScore || report.fiscalPressure || 0) >= 60)?.publicSummary || "",
    context.militaryReports.find((report) => (report.threatScore || 0) >= 60)?.publicSummary || ""
  ], MONTHLY_BRIEFING_LIMITS.maxRiskItems);

  return {
    title: `${context.period?.label || "本月"}${context.roleLabel || "官职"}月报`,
    publicSummary: `${context.currentPosting || context.roleLabel || "本职"}本月要点已按公开案牍、钱粮军务、上官同僚和下月行动整理。`,
    sections: [
      buildSection("official_duties", `${context.currentPosting || "本职差事"}：本月差遣、考成和上官督责已汇总。`, activeAssignmentText),
      buildSection("fiscal_local", "钱粮民情按当前可见案牍和财赋 projection 摘录。", [...docketTexts, ...fiscalTexts]),
      buildSection("military_diplomacy", "军务边情只列玩家身份可读的公开预警。", militaryTexts),
      buildSection("court_network", "上官、同僚和可见人物关系只按公开摘要呈现。", networkItems),
      buildSection("next_actions", "下月可行事仅作为建议，不直接触发裁决。", actionItems)
    ],
    actionItems,
    riskItems,
    sourceRefs: context.sourceRefs,
    aiReadScope: context.aiReadScope,
    actorIntelligence: context.actorIntelligence,
    toolPermissions: context.toolPermissions,
    serverAdjudication: context.serverAdjudication
  };
}

function reportExistsForPeriod(state, periodKey) {
  return state.lastPeriodKey === periodKey || state.reports.some((report) => report.periodKey === periodKey);
}

function shouldGeneratePlayerMonthlyBriefing(previousState = {}, worldState = {}, options = {}) {
  if (!options.worldTick?.completedMonth) {
    return { ok: false, reason: "not_month_end" };
  }
  if (!roleCanReceiveMonthlyBriefing(worldState)) {
    return { ok: false, reason: "role_not_supported" };
  }
  const state = normalizePlayerMonthlyBriefingState(worldState.playerMonthlyBriefing, worldState);
  const period = periodFromWorldTick(worldState, options.worldTick);
  if (reportExistsForPeriod(state, period.key)) {
    return { ok: false, reason: "period_already_recorded", period };
  }
  return { ok: true, period, previousTurn: currentTurn(previousState) };
}

function buildMonthlyReport(worldState, proposal, context) {
  const turn = currentTurn(worldState);
  const period = context.period || periodFromWorldTick(worldState);
  return normalizeReport({
    ...proposal,
    id: `PMB-${period.key}-${String(turn).padStart(4, "0")}`,
    reportId: `PMB-${period.key}-${String(turn).padStart(4, "0")}`,
    periodKey: period.key,
    periodLabel: period.label,
    generatedAtTurn: turn,
    generatedAt: readDateSource(worldState, worldState),
    role: context.role,
    roleLabel: context.roleLabel
  }, worldState);
}

function resolveMonthlyBriefing(worldState = {}, proposal = {}, options = {}) {
  ensurePlayerMonthlyBriefingState(worldState);
  if (!roleCanReceiveMonthlyBriefing(worldState)) {
    return {
      generated: false,
      reason: "role_not_supported",
      summary: "",
      events: [],
      reportId: null,
      report: null
    };
  }
  const context = options.context || buildPlayerMonthlyBriefingContext(worldState, options);
  const period = context.period || periodFromWorldTick(worldState, options.worldTick);
  if (!options.allowDuplicate && reportExistsForPeriod(worldState.playerMonthlyBriefing, period.key)) {
    return {
      generated: false,
      reason: "period_already_recorded",
      summary: "",
      events: [],
      reportId: null,
      report: null
    };
  }

  const report = buildMonthlyReport(worldState, proposal, context);
  worldState.playerMonthlyBriefing.reports.push(report);
  worldState.playerMonthlyBriefing.reports = worldState.playerMonthlyBriefing.reports
    .slice(-MONTHLY_BRIEFING_LIMITS.maxReports);
  worldState.playerMonthlyBriefing.lastPeriodKey = report.periodKey;
  const event = `${report.periodLabel}，${context.playerName}收到官职月报：${report.publicSummary}`;
  return {
    generated: true,
    reason: "monthly_briefing_recorded",
    summary: report.publicSummary,
    events: [event],
    reportId: report.id,
    report
  };
}

function runPlayerMonthlyBriefingStep(worldState = {}, options = {}) {
  const startedAt = Date.now();
  ensurePlayerMonthlyBriefingState(worldState);
  const gate = shouldGeneratePlayerMonthlyBriefing(options.previousState, worldState, options);
  if (!gate.ok) {
    return {
      generated: false,
      reason: gate.reason,
      summary: "",
      events: [],
      reportId: null,
      report: null,
      durationMs: Date.now() - startedAt
    };
  }
  const context = buildPlayerMonthlyBriefingContext(worldState, {
    ...options,
    period: gate.period
  });
  const proposal = generateMonthlyBriefingProposal(context, options.aiRuntime);
  const resolved = resolveMonthlyBriefing(worldState, proposal, {
    ...options,
    context
  });
  return {
    ...resolved,
    durationMs: Date.now() - startedAt
  };
}

function reportForView(report) {
  const normalized = normalizeReport(report);
  if (!normalized) return null;
  return {
    schemaVersion: normalized.schemaVersion,
    reportId: normalized.id,
    periodKey: normalized.periodKey,
    periodLabel: normalized.periodLabel,
    generatedAtTurn: normalized.generatedAtTurn,
    generatedAt: normalized.generatedAt,
    role: normalized.role,
    roleLabel: normalized.roleLabel,
    title: normalized.title,
    publicSummary: normalized.publicSummary,
    sections: normalized.sections,
    actionItems: normalized.actionItems,
    riskItems: normalized.riskItems,
    sourceRefs: normalized.sourceRefs,
    aiReadScope: normalized.aiReadScope,
    actorIntelligence: normalized.actorIntelligence,
    toolPermissions: normalized.toolPermissions,
    serverAdjudication: normalized.serverAdjudication
  };
}

function buildPlayerMonthlyBriefingView(worldState = {}) {
  const state = normalizePlayerMonthlyBriefingState(worldState.playerMonthlyBriefing, worldState);
  const reports = state.reports.map(reportForView).filter(Boolean);
  return {
    schemaVersion: PLAYER_MONTHLY_BRIEFING_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active: roleCanReceiveMonthlyBriefing(worldState),
    latest: reports.at(-1) || null,
    recentReports: reports.slice(-MONTHLY_BRIEFING_LIMITS.maxReports),
    hiddenNotice: "官职月报只展示服务器清洗后的玩家可见摘要；隐藏状态、原始提示词、密钥、诊断路径和模型原始提案不会暴露。"
  };
}

module.exports = {
  buildPlayerMonthlyBriefingContext,
  buildPlayerMonthlyBriefingView,
  createInitialPlayerMonthlyBriefingState,
  ensurePlayerMonthlyBriefingState,
  generateMonthlyBriefingProposal,
  normalizePlayerMonthlyBriefingState,
  resolveMonthlyBriefing,
  roleCanReceiveMonthlyBriefing,
  runPlayerMonthlyBriefingStep,
  shouldGeneratePlayerMonthlyBriefing
};
