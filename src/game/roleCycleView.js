const { buildExamCalendarView } = require("./examCalendar");
const { buildExamProcedureView } = require("./examProcedure");
const { buildStudyProfileView } = require("./studyProfile");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildOfficialCareerView } = require("./officialCareer");
const { buildOfficialCourtConsequenceView } = require("./officialCourtConsequences");
const { buildOfficialCourtResponseView } = require("./officialCourtResponse");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildPlayerMonthlyBriefingView } = require("./playerMonthlyBriefing");
const { buildWorldThreadView } = require("./worldThreads");
const { formatYearMonthPeriod } = require("./time");
const {
  ROLE_CYCLE_AI_READ_SCOPE,
  ROLE_CYCLE_LIMITS,
  ROLE_CYCLE_PROPOSAL_BOUNDARIES,
  ROLE_CYCLE_ROLE_CONFIGS,
  ROLE_CYCLE_ROLES,
  ROLE_CYCLE_SCHEMA_VERSION,
  ROLE_CYCLE_SERVER_ADJUDICATION,
  ROLE_CYCLE_TOOL_PERMISSIONS
} = require("./roleCycleConfig");

const ROLE_CYCLE_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|\b(?:provider|prompt|statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const ROLE_CYCLE_TERMINAL_DECISION_PATTERN =
  /(已(?:任免|处分|赏罚|采纳|拨款|拨饷)|已经(?:任免|处分|赏罚|采纳|生效)|采纳奏折|准奏|照准|题准|奉旨(?:准行|已行)|弹劾成案|已成弹劾|成弹劾|圣旨已生效|官缺已定|革职|罢黜|黜免|升迁|降调|赏银|罚俸|拨(?:给|付|发)?(?:钱粮|银两|粮饷|饷银|款项)|定罪|定赏|定罚|问罪|处分(?:成案|已定)|奖惩(?:成案|已定))/;

const ROLE_CYCLE_SOURCE_VIEW_BUILDERS = Object.freeze({
  studyProfileView: buildStudyProfileView,
  examCalendarView: buildExamCalendarView,
  examProcedureView: buildExamProcedureView,
  localAffairsDocketView: buildLocalAffairsDocketView,
  economicFiscalView: buildEconomicFiscalView,
  militaryDiplomacyView: buildMilitaryDiplomacyView,
  officialCareerView: buildOfficialCareerView,
  courtConsequenceView: buildOfficialCourtConsequenceView,
  courtResponseView: buildOfficialCourtResponseView,
  officialPostingsView: buildOfficialPostingsView,
  playerMonthlyBriefingView: buildPlayerMonthlyBriefingView,
  worldThreadView: buildWorldThreadView
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

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function cleanText(value, fallback = "", maxLength = ROLE_CYCLE_LIMITS.maxTextLength) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (ROLE_CYCLE_SENSITIVE_PATTERN.test(text)) return fallback;
  if (ROLE_CYCLE_TERMINAL_DECISION_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, ROLE_CYCLE_LIMITS.maxIdLength);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function unique(values = [], limit = 12) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = cleanText(value, "", ROLE_CYCLE_LIMITS.maxShortTextLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function cleanRole(value) {
  const role = cleanId(value, "scholar");
  return ROLE_CYCLE_ROLES.includes(role) ? role : "scholar";
}

function cloneForSourceViews(worldState = {}) {
  try {
    if (typeof structuredClone === "function") return structuredClone(worldState);
  } catch (error) {
    // Fall back to JSON cloning below for legacy-compatible session state.
  }
  try {
    return JSON.parse(JSON.stringify(worldState || {}));
  } catch (error) {
    return {};
  }
}

function statusFromPressure(score) {
  const value = clampNumber(score, 0, 100, 0);
  if (value >= 78) return { band: "urgent", label: "急办" };
  if (value >= 58) return { band: "strained", label: "吃紧" };
  if (value >= 36) return { band: "watch", label: "留意" };
  return { band: "routine", label: "平稳" };
}

function roleConfig(role) {
  return ROLE_CYCLE_ROLE_CONFIGS[role] || ROLE_CYCLE_ROLE_CONFIGS.scholar;
}

function buildSourceViews(worldState = {}, options = {}, role = "scholar") {
  if (isPlainObject(options.views)) return options.views;
  const sourceState = cloneForSourceViews(worldState);
  return roleConfig(role).sourceViews.reduce((views, sourceView) => {
    const builder = ROLE_CYCLE_SOURCE_VIEW_BUILDERS[sourceView];
    if (typeof builder === "function") views[sourceView] = builder(sourceState);
    return views;
  }, {});
}

function makeCycleItem(input = {}) {
  const sourceView = cleanId(input.sourceView, "");
  const title = cleanText(input.title, "", ROLE_CYCLE_LIMITS.maxShortTextLength);
  const publicSummary = cleanText(input.publicSummary || input.summary || input.body, "", ROLE_CYCLE_LIMITS.maxTextLength);
  if (!sourceView || (!title && !publicSummary)) return null;
  const riskScore = clampNumber(
    input.riskScore ?? input.pressureScore ?? input.risk ?? input.severity,
    0,
    100,
    0
  );
  const status = statusFromPressure(riskScore);
  const sourceId = cleanId(input.sourceId || input.id, `${sourceView}:item`);
  return {
    id: cleanId(input.id, `role-cycle-item:${sourceId}`),
    title: title || publicSummary,
    meta: cleanText(input.meta, "", ROLE_CYCLE_LIMITS.maxShortTextLength),
    publicSummary: publicSummary || title,
    sourceView,
    sourceId,
    domainLabel: cleanText(input.domainLabel, "", 40),
    statusLabel: cleanText(input.statusLabel, status.label, 32),
    riskScore,
    riskBand: status.band,
    targetSurfaceId: cleanId(input.targetSurfaceId, ""),
    visibility: "player_visible"
  };
}

function makeRiskSignal(input = {}) {
  const label = cleanText(input.label, "", ROLE_CYCLE_LIMITS.maxShortTextLength);
  if (!label) return null;
  const value = clampNumber(input.value ?? input.riskScore ?? input.pressureScore ?? input.risk, 0, 100, 0);
  const status = statusFromPressure(value);
  return {
    id: cleanId(input.id, `role-cycle-risk:${label}`),
    label,
    value,
    band: cleanText(input.band, status.band, 24),
    bandLabel: cleanText(input.bandLabel, status.label, 24),
    summary: cleanText(input.summary, "", ROLE_CYCLE_LIMITS.maxTextLength),
    sourceView: cleanId(input.sourceView, "roleCycleView")
  };
}

function makeMetric(input = {}) {
  const label = cleanText(input.label, "", 40);
  if (!label) return null;
  const value = clampNumber(input.value, 0, 100, 0);
  return {
    id: cleanId(input.id, `role-cycle-metric:${label}`),
    label,
    value,
    statusLabel: cleanText(input.statusLabel, statusFromPressure(value).label, 28),
    sourceView: cleanId(input.sourceView, "roleCycleView")
  };
}

function makeNextAction(input = {}) {
  const label = cleanText(input.label, "", 40);
  const text = cleanText(input.text || input.actionText, "", ROLE_CYCLE_LIMITS.maxTextLength);
  if (!label || !text) return null;
  return {
    id: cleanId(input.id, `role-cycle-action:${label}`),
    label,
    text,
    sourceView: cleanId(input.sourceView, "roleCycleView"),
    targetSurfaceId: cleanId(input.targetSurfaceId, "")
  };
}

function pushUnique(target, rows, key = "id", limit = ROLE_CYCLE_LIMITS.maxItemsPerRole) {
  const seen = new Set(target.map((item) => item[key]).filter(Boolean));
  for (const row of rows) {
    if (!row) continue;
    const value = row[key] || JSON.stringify(row);
    if (seen.has(value)) continue;
    seen.add(value);
    target.push(row);
    if (target.length >= limit) break;
  }
  return target;
}

function sortByRisk(rows = []) {
  return rows.slice().sort((first, second) => {
    const risk = (second.riskScore || 0) - (first.riskScore || 0);
    if (risk !== 0) return risk;
    return String(first.id || "").localeCompare(String(second.id || ""));
  });
}

function averagePressure(items = [], fallback = 0) {
  const values = items.map((item) => Number(item.riskScore)).filter((value) => Number.isFinite(value));
  if (!values.length) return fallback;
  return clampNumber(Math.max(...values), 0, 100, fallback);
}

function rowSummary(row = {}) {
  return row.publicSummary ||
    row.publicDocket ||
    row.visibleSummary ||
    row.summary ||
    row.publicFinding ||
    row.description ||
    row.nextStep ||
    "";
}

function rowTitle(row = {}, fallback = "事务") {
  return row.title ||
    row.label ||
    row.officeTitle ||
    row.actorLabel ||
    row.eventTitle ||
    row.domainLabel ||
    row.kindLabel ||
    row.name ||
    fallback;
}

function buildItemsFromRows(rows = [], sourceView, prefix, limit) {
  return asArray(rows)
    .map((entry, index) => {
      if (!isPlainObject(entry)) {
        return makeCycleItem({
          id: `${prefix}-${index}`,
          sourceView,
          sourceId: `${prefix}-${index}`,
          title: entry,
          publicSummary: entry
        });
      }
      return makeCycleItem({
        id: entry.id || entry.sourceId || `${prefix}-${index}`,
        sourceView,
        sourceId: entry.sourceId || entry.id || `${prefix}-${index}`,
        title: rowTitle(entry, prefix),
        meta: [
          entry.domainLabel,
          entry.kindLabel,
          entry.statusLabel || entry.status,
          entry.deadlineLabel
        ].filter(Boolean).join(" · "),
        publicSummary: rowSummary(entry),
        statusLabel: entry.statusLabel || entry.status,
        riskScore: entry.riskScore ?? entry.pressureScore ?? entry.risk ?? entry.threatScore ?? entry.supplyRisk ?? entry.severity,
        domainLabel: entry.domainLabel || entry.kindLabel,
        targetSurfaceId: entry.targetSurfaceId
      });
    })
    .filter(Boolean)
    .slice(0, limit);
}

function collectActions(rows = [], sourceView, limit = ROLE_CYCLE_LIMITS.maxNextActions) {
  return asArray(rows)
    .map((entry, index) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return makeNextAction({
          id: `${sourceView}-action-${index}`,
          sourceView,
          label: index === 0 ? "拟行动" : `拟行动${index + 1}`,
          text: entry
        });
      }
      if (!isPlainObject(entry)) return null;
      return makeNextAction({
        id: entry.id || `${sourceView}-action-${index}`,
        sourceView,
        label: entry.label || entry.title || `拟行动${index + 1}`,
        text: entry.text || entry.actionText || entry.publicSummary || entry.summary,
        targetSurfaceId: entry.targetSurfaceId
      });
    })
    .filter(Boolean)
    .slice(0, limit);
}

function buildFallbackCycle(role, pressureScore = 22) {
  const config = roleConfig(role);
  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: config.statusLabel,
    summary: config.defaultSummary,
    pressureScore,
    sourceViews: [...config.sourceViews],
    metrics: [],
    items: [
      makeCycleItem({
        id: `role-cycle-${role}-fallback`,
        sourceView: "roleCycleView",
        sourceId: `role-cycle-${role}`,
        title: config.loopLabel,
        publicSummary: config.defaultSummary,
        statusLabel: config.statusLabel,
        riskScore: pressureScore
      })
    ].filter(Boolean),
    riskSignals: [],
    nextActions: [
      makeNextAction({
        id: `role-cycle-${role}-default-action`,
        label: "拟本旬行动",
        text: config.defaultAction
      })
    ].filter(Boolean)
  };
}

function buildScholarCycle(worldState, views) {
  const role = "scholar";
  const config = roleConfig(role);
  const study = isPlainObject(views.studyProfileView) ? views.studyProfileView : {};
  const examCalendar = isPlainObject(views.examCalendarView) ? views.examCalendarView : {};
  const plan = isPlainObject(study.nextPlan) ? study.nextPlan : {};
  const intensity = isPlainObject(plan.intensity) ? plan.intensity : {};
  const examPreparation = isPlainObject(study.examPreparation) ? study.examPreparation : null;
  const nextExam = isPlainObject(examCalendar.nextExam) ? examCalendar.nextExam : null;
  const items = [];

  pushUnique(items, buildItemsFromRows(asArray(plan.items).map((item, index) => ({
    id: `study-plan-item-${index}`,
    title: item,
    publicSummary: `${cleanText(plan.focus, "经义根柢", 40)}：${cleanText(item, "温书", 80)}`,
    statusLabel: cleanText(intensity.label, "稳进", 24),
    pressureScore: 100 - clampNumber(intensity.currentScore, 0, 100, 55)
  })), "studyProfileView", "study-plan", 3));

  if (examPreparation) {
    const preparationItem = makeCycleItem({
      id: "study-exam-preparation",
      sourceView: "studyProfileView",
      sourceId: `${examPreparation.level || "exam"}:preparation`,
      title: `${cleanText(examPreparation.examName, "科考", 40)}备考`,
      meta: `${cleanText(examPreparation.label, "从容", 24)} · ${clampNumber(examPreparation.score, 0, 100, 0)}/100`,
      publicSummary: examPreparation.summary,
      statusLabel: examPreparation.label,
      riskScore: examPreparation.score
    });
    if (preparationItem) items.unshift(preparationItem);
  }

  if (nextExam) {
    pushUnique(items, [makeCycleItem({
      id: "study-next-exam",
      sourceView: "examCalendarView",
      sourceId: nextExam.level || "next-exam",
      title: cleanText(nextExam.examName, "下一科", 48),
      meta: cleanText(nextExam.windowLabel || nextExam.nextWindowLabel || nextExam.status, "科期待核", 64),
      publicSummary: nextExam.teacherRecommendation || nextExam.funding || nextExam.localQuota,
      statusLabel: nextExam.status || "候期",
      riskScore: examPreparation?.score || 36
    })]);
  }

  const dimensions = isPlainObject(study.dimensions) ? study.dimensions : {};
  const labels = isPlainObject(study.dimensionLabels) ? study.dimensionLabels : {};
  const metrics = Object.entries(dimensions)
    .map(([key, value]) => makeMetric({
      id: `study-dimension-${key}`,
      label: labels[key] || key,
      value,
      statusLabel: clampNumber(value, 0, 100, 50) < 55 ? "待补" : "可用",
      sourceView: "studyProfileView"
    }))
    .filter(Boolean)
    .sort((first, second) => first.value - second.value)
    .slice(0, ROLE_CYCLE_LIMITS.maxMetrics);

  const riskSignals = [
    ...(examPreparation ? [makeRiskSignal({
      id: "study-preparation-pressure",
      label: `${cleanText(examPreparation.examName, "科考", 32)}压力`,
      value: examPreparation.score,
      summary: examPreparation.summary,
      sourceView: "studyProfileView"
    })] : []),
    ...asArray(plan.riskNotes).map((note, index) => makeRiskSignal({
      id: `study-plan-risk-${index}`,
      label: "读书风险",
      value: 100 - clampNumber(intensity.currentScore, 0, 100, 55),
      summary: note,
      sourceView: "studyProfileView"
    })),
    ...metrics.slice(0, 2).map((metric) => makeRiskSignal({
      id: `study-weak-${metric.id}`,
      label: `${metric.label}短板`,
      value: 100 - metric.value,
      summary: `${metric.label}当前${metric.value}，本旬宜补弱。`,
      sourceView: "studyProfileView"
    }))
  ].filter(Boolean).slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals);

  const nextActions = collectActions([
    ...asArray(plan.nextActions),
    ...asArray(examPreparation?.suggestedActions)
  ], "studyProfileView");

  if (!nextActions.length) {
    nextActions.push(...buildFallbackCycle(role).nextActions);
  }

  const pressureScore = Math.max(
    averagePressure(items, 24),
    ...riskSignals.map((risk) => risk.value),
    0
  );

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(pressureScore).label,
    summary: cleanText(study.summary, config.defaultSummary, ROLE_CYCLE_LIMITS.maxTextLength),
    pressureScore,
    sourceViews: [...config.sourceViews],
    metrics,
    items: sortByRisk(items).slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions: nextActions.slice(0, ROLE_CYCLE_LIMITS.maxNextActions)
  };
}

function buildMagistrateCycle(worldState, views) {
  const role = "magistrate";
  const config = roleConfig(role);
  const local = isPlainObject(views.localAffairsDocketView) ? views.localAffairsDocketView : {};
  const fiscal = isPlainObject(views.economicFiscalView) ? views.economicFiscalView : {};
  const dockets = sortByRisk(buildItemsFromRows(asArray(local.dockets), "localAffairsDocketView", "local-docket", 4));
  const fiscalItems = sortByRisk(buildItemsFromRows([
    ...asArray(fiscal.localTreasuryReports),
    ...asArray(fiscal.grainMarketReports),
    ...asArray(fiscal.marketIncidents)
  ], "economicFiscalView", "local-fiscal", 3));
  const items = [];
  pushUnique(items, dockets);
  pushUnique(items, fiscalItems);
  if (!items.length) return buildFallbackCycle(role);

  const metrics = dockets.slice(0, ROLE_CYCLE_LIMITS.maxMetrics).map((item) => makeMetric({
    id: `magistrate-${item.id}`,
    label: item.domainLabel || item.title,
    value: item.riskScore,
    statusLabel: item.statusLabel,
    sourceView: item.sourceView
  })).filter(Boolean);
  const riskSignals = items.slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals).map((item) => makeRiskSignal({
    id: `magistrate-risk-${item.id}`,
    label: item.title,
    value: item.riskScore,
    summary: item.publicSummary,
    sourceView: item.sourceView
  })).filter(Boolean);
  const nextActions = items.slice(0, 3).map((item) => makeNextAction({
    id: `magistrate-action-${item.id}`,
    label: item.domainLabel ? `处置${item.domainLabel}` : "处置案牍",
    text: `本旬先处置${item.title}：核公开材料、经手人、期限和需回报事项。`,
    sourceView: item.sourceView,
    targetSurfaceId: item.domainLabel === "刑名" ? "trial" : ""
  })).filter(Boolean);
  nextActions.push(...collectActions([], "localAffairsDocketView"));

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(averagePressure(items, 30)).label,
    summary: cleanText(local.summary || config.defaultSummary, config.defaultSummary, ROLE_CYCLE_LIMITS.maxTextLength),
    pressureScore: averagePressure(items, 30),
    sourceViews: [...config.sourceViews],
    metrics,
    items: items.slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions: nextActions.length ? nextActions.slice(0, ROLE_CYCLE_LIMITS.maxNextActions) : buildFallbackCycle(role).nextActions
  };
}

function buildOfficialCycle(worldState, views) {
  const role = "official";
  const config = roleConfig(role);
  const career = isPlainObject(views.officialCareerView) ? views.officialCareerView : {};
  const courtResponse = isPlainObject(views.courtResponseView) ? views.courtResponseView : {};
  const consequence = isPlainObject(views.courtConsequenceView) ? views.courtConsequenceView : {};
  const firstMonth = isPlainObject(career.firstMonthExperience) ? career.firstMonthExperience : {};
  const courtEntry = isPlainObject(career.courtEntry) ? career.courtEntry : {};
  const items = [];

  if (isPlainObject(firstMonth.assignment)) {
    pushUnique(items, [makeCycleItem({
      id: firstMonth.assignment.id || "official-first-month",
      sourceView: "officialCareerView",
      sourceId: firstMonth.assignment.id || "official-first-month",
      title: firstMonth.assignment.title,
      meta: [firstMonth.assignment.phaseLabel, firstMonth.assignment.deadlineLabel].filter(Boolean).join(" · "),
      publicSummary: firstMonth.assignment.visibleSummary || firstMonth.receipt?.publicSummary,
      statusLabel: firstMonth.assignment.phaseLabel || firstMonth.assignment.riskLabel,
      riskScore: firstMonth.assignment.risk
    })]);
  }

  pushUnique(items, buildItemsFromRows(asArray(career.assignments), "officialCareerView", "official-assignment", 3));
  if (courtEntry.active) {
    pushUnique(items, [makeCycleItem({
      id: courtEntry.id || "official-court-entry",
      sourceView: "officialCareerView",
      sourceId: courtEntry.id || "official-court-entry",
      title: courtEntry.title,
      meta: "奏折朝议",
      publicSummary: courtEntry.publicSummary || courtEntry.latestResolution?.publicSummary || courtEntry.latestFollowUp?.publicSummary,
      statusLabel: courtEntry.latestFollowUp?.statusLabel || courtEntry.latestResolution?.statusLabel,
      riskScore: courtEntry.assessmentTrace?.riskScore,
      targetSurfaceId: "memorial-review"
    })]);
  }
  pushUnique(items, buildItemsFromRows([
    ...asArray(courtResponse.chainItems),
    ...asArray(courtResponse.responseItems)
  ], "courtResponseView", "official-court-response", 2));
  pushUnique(items, buildItemsFromRows([
    ...asArray(consequence.pendingSources),
    ...asArray(consequence.recentSignals)
  ], "courtConsequenceView", "official-court-consequence", 2));
  if (!items.length) return buildFallbackCycle(role);

  const metrics = [
    makeMetric({ id: "official-career-score", label: "考成", value: career.careerScore, statusLabel: "功绩", sourceView: "officialCareerView" }),
    makeMetric({ id: "official-risk-score", label: "弹劾风险", value: career.riskScore, statusLabel: "风险", sourceView: "officialCareerView" }),
    makeMetric({ id: "official-active-assignments", label: "在办差使", value: clampNumber(career.assignmentSummary?.activeCount, 0, 10, 0) * 10, statusLabel: `${clampNumber(career.assignmentSummary?.activeCount, 0, 10, 0)}件`, sourceView: "officialCareerView" }),
    makeMetric({ id: "official-urgent-assignments", label: "急件", value: clampNumber(career.assignmentSummary?.urgentCount, 0, 10, 0) * 15, statusLabel: `${clampNumber(career.assignmentSummary?.urgentCount, 0, 10, 0)}件`, sourceView: "officialCareerView" })
  ].filter(Boolean).slice(0, ROLE_CYCLE_LIMITS.maxMetrics);
  const riskSignals = [
    makeRiskSignal({ id: "official-impeachment-risk", label: "弹劾风险", value: career.riskScore, summary: career.procedureSummary?.visibleNotice, sourceView: "officialCareerView" }),
    ...items.slice(0, 3).map((item) => makeRiskSignal({
      id: `official-risk-${item.id}`,
      label: item.title,
      value: item.riskScore,
      summary: item.publicSummary,
      sourceView: item.sourceView
    }))
  ].filter(Boolean).slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals);
  const nextActions = [
    ...collectActions(firstMonth.nextActions, "officialCareerView"),
    ...collectActions(courtEntry.nextActions, "officialCareerView"),
    ...collectActions(courtEntry.followUpNextActions, "officialCareerView"),
    ...collectActions(courtResponse.nextActions, "courtResponseView"),
    ...collectActions(consequence.nextActions, "courtConsequenceView")
  ].slice(0, ROLE_CYCLE_LIMITS.maxNextActions);

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(Math.max(clampNumber(career.riskScore, 0, 100, 0), averagePressure(items, 30))).label,
    summary: cleanText(
      career.bureau?.summary || courtEntry.publicSummary || config.defaultSummary,
      config.defaultSummary,
      ROLE_CYCLE_LIMITS.maxTextLength
    ),
    pressureScore: Math.max(clampNumber(career.riskScore, 0, 100, 0), averagePressure(items, 30)),
    sourceViews: [...config.sourceViews],
    metrics,
    items: items.slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions: nextActions.length ? nextActions : buildFallbackCycle(role).nextActions
  };
}

function buildMinisterCycle(worldState, views) {
  const role = "minister";
  const config = roleConfig(role);
  const courtResponse = isPlainObject(views.courtResponseView) ? views.courtResponseView : {};
  const consequence = isPlainObject(views.courtConsequenceView) ? views.courtConsequenceView : {};
  const fiscal = isPlainObject(views.economicFiscalView) ? views.economicFiscalView : {};
  const threads = isPlainObject(views.worldThreadView) ? views.worldThreadView : {};
  const items = [];
  pushUnique(items, buildItemsFromRows([
    ...asArray(courtResponse.chainItems),
    ...asArray(courtResponse.responseItems),
    ...asArray(courtResponse.recentResponses)
  ], "courtResponseView", "minister-court-response", 3));
  pushUnique(items, buildItemsFromRows([
    ...asArray(consequence.pendingSources),
    ...asArray(consequence.recentSignals)
  ], "courtConsequenceView", "minister-court-consequence", 2));
  pushUnique(items, buildItemsFromRows([
    ...asArray(fiscal.fiscalLedgers),
    ...asArray(fiscal.marketIncidents)
  ], "economicFiscalView", "minister-fiscal", 2));
  pushUnique(items, buildItemsFromRows(asArray(threads.activeThreads), "worldThreadView", "minister-thread", 2));
  if (!items.length) return buildFallbackCycle(role);

  const metrics = items.slice(0, ROLE_CYCLE_LIMITS.maxMetrics).map((item) => makeMetric({
    id: `minister-${item.id}`,
    label: item.domainLabel || item.title,
    value: item.riskScore,
    statusLabel: item.statusLabel,
    sourceView: item.sourceView
  })).filter(Boolean);
  const riskSignals = items.slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals).map((item) => makeRiskSignal({
    id: `minister-risk-${item.id}`,
    label: item.title,
    value: item.riskScore,
    summary: item.publicSummary,
    sourceView: item.sourceView
  })).filter(Boolean);
  const nextActions = [
    ...collectActions(courtResponse.nextActions, "courtResponseView"),
    ...collectActions(consequence.nextActions, "courtConsequenceView"),
    makeNextAction({
      id: "minister-bureau-draft",
      label: "拟部院票拟",
      text: config.defaultAction,
      sourceView: "roleCycleView",
      targetSurfaceId: "court-debate"
    })
  ].filter(Boolean).slice(0, ROLE_CYCLE_LIMITS.maxNextActions);

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(averagePressure(items, 36)).label,
    summary: cleanText(courtResponse.summary || consequence.summary || config.defaultSummary, config.defaultSummary),
    pressureScore: averagePressure(items, 36),
    sourceViews: [...config.sourceViews],
    metrics,
    items: items.slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions
  };
}

function buildGeneralCycle(worldState, views) {
  const role = "general";
  const config = roleConfig(role);
  const military = isPlainObject(views.militaryDiplomacyView) ? views.militaryDiplomacyView : {};
  const items = [];
  pushUnique(items, buildItemsFromRows(asArray(military.frontierIncidents), "militaryDiplomacyView", "general-incident", 3));
  pushUnique(items, buildItemsFromRows(asArray(military.theaters), "militaryDiplomacyView", "general-theater", 2));
  pushUnique(items, buildItemsFromRows(asArray(military.supplyLines), "militaryDiplomacyView", "general-supply", 2));
  pushUnique(items, buildItemsFromRows(asArray(military.garrisons), "militaryDiplomacyView", "general-garrison", 2));
  if (!items.length) return buildFallbackCycle(role);

  const firstTheater = asArray(military.theaters).find(isPlainObject) || {};
  const metrics = [
    makeMetric({ id: "general-threat", label: "边患", value: firstTheater.threatScore ?? worldState.borderThreat, statusLabel: firstTheater.statusLabel, sourceView: "militaryDiplomacyView" }),
    makeMetric({ id: "general-supply", label: "粮道", value: firstTheater.supplyRisk, statusLabel: "粮秣", sourceView: "militaryDiplomacyView" }),
    makeMetric({ id: "general-readiness", label: "战备", value: firstTheater.readinessScore, statusLabel: "战备", sourceView: "militaryDiplomacyView" }),
    makeMetric({ id: "general-intel", label: "情报", value: firstTheater.intelConfidence, statusLabel: "斥候", sourceView: "militaryDiplomacyView" })
  ].filter(Boolean);
  const riskSignals = items.slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals).map((item) => makeRiskSignal({
    id: `general-risk-${item.id}`,
    label: item.title,
    value: item.riskScore,
    summary: item.publicSummary,
    sourceView: item.sourceView
  })).filter(Boolean);
  const nextActions = items.slice(0, 3).map((item) => makeNextAction({
    id: `general-action-${item.id}`,
    label: /粮|供|饷/.test(`${item.title}${item.publicSummary}`) ? "核粮道" : "拟军报",
    text: `据${item.title}拟军前回报：列明公开情报、粮道、军心和需待裁决的处置。`,
    sourceView: item.sourceView,
    targetSurfaceId: "war-council"
  })).filter(Boolean);

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(averagePressure(items, 40)).label,
    summary: cleanText(items[0]?.publicSummary || config.defaultSummary, config.defaultSummary),
    pressureScore: averagePressure(items, 40),
    sourceViews: [...config.sourceViews],
    metrics,
    items: items.slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions: nextActions.length ? nextActions : buildFallbackCycle(role).nextActions
  };
}

function buildEmperorCycle(worldState, views) {
  const role = "emperor";
  const config = roleConfig(role);
  const courtResponse = isPlainObject(views.courtResponseView) ? views.courtResponseView : {};
  const consequence = isPlainObject(views.courtConsequenceView) ? views.courtConsequenceView : {};
  const postings = isPlainObject(views.officialPostingsView) ? views.officialPostingsView : {};
  const threads = isPlainObject(views.worldThreadView) ? views.worldThreadView : {};
  const fiscal = isPlainObject(views.economicFiscalView) ? views.economicFiscalView : {};
  const military = isPlainObject(views.militaryDiplomacyView) ? views.militaryDiplomacyView : {};
  const items = [];
  pushUnique(items, buildItemsFromRows([
    ...asArray(courtResponse.chainItems),
    ...asArray(courtResponse.responseItems)
  ], "courtResponseView", "emperor-court-response", 3));
  pushUnique(items, buildItemsFromRows([
    ...asArray(consequence.pendingSources),
    ...asArray(consequence.recentSignals)
  ], "courtConsequenceView", "emperor-court-consequence", 2));
  pushUnique(items, buildItemsFromRows([
    ...asArray(postings.appointmentCandidates),
    ...asArray(postings.assessmentRecords),
    ...asArray(postings.transferRecords)
  ], "officialPostingsView", "emperor-postings", 2));
  pushUnique(items, buildItemsFromRows(asArray(threads.activeThreads), "worldThreadView", "emperor-thread", 2));
  pushUnique(items, buildItemsFromRows([
    ...asArray(fiscal.fiscalLedgers),
    ...asArray(fiscal.marketIncidents),
    ...asArray(military.frontierIncidents)
  ], "roleCycleView", "emperor-realm-pressure", 2));
  if (!items.length) return buildFallbackCycle(role);

  const metrics = [
    makeMetric({ id: "emperor-treasury", label: "国用", value: worldState.treasury ? Math.min(100, Math.round(Number(worldState.treasury) / 10)) : fiscal.fiscalLedgers?.[0]?.deficitPressure, statusLabel: "财赋", sourceView: "economicFiscalView" }),
    makeMetric({ id: "emperor-order", label: "民情", value: 100 - clampNumber(worldState.publicOrder, 0, 100, 60), statusLabel: "秩序风险", sourceView: "worldThreadView" }),
    makeMetric({ id: "emperor-border", label: "边患", value: worldState.borderThreat ?? military.frontierIncidents?.[0]?.threatScore, statusLabel: "军务", sourceView: "militaryDiplomacyView" }),
    makeMetric({ id: "emperor-court", label: "朝局", value: averagePressure(items, 36), statusLabel: "议题", sourceView: "courtResponseView" })
  ].filter(Boolean);
  const riskSignals = items.slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals).map((item) => makeRiskSignal({
    id: `emperor-risk-${item.id}`,
    label: item.title,
    value: item.riskScore,
    summary: item.publicSummary,
    sourceView: item.sourceView
  })).filter(Boolean);
  const nextActions = [
    ...collectActions(courtResponse.nextActions, "courtResponseView"),
    ...collectActions(consequence.nextActions, "courtConsequenceView"),
    makeNextAction({
      id: "emperor-edict-review",
      label: "拟御前批示",
      text: config.defaultAction,
      sourceView: "roleCycleView",
      targetSurfaceId: "edict-draft"
    })
  ].filter(Boolean).slice(0, ROLE_CYCLE_LIMITS.maxNextActions);

  return {
    role,
    roleLabel: config.roleLabel,
    authorityTier: config.authorityTier,
    loopLabel: config.loopLabel,
    statusLabel: statusFromPressure(averagePressure(items, 38)).label,
    summary: cleanText(courtResponse.summary || consequence.summary || postings.courtSummary?.publicSummary || config.defaultSummary, config.defaultSummary),
    pressureScore: averagePressure(items, 38),
    sourceViews: [...config.sourceViews],
    metrics,
    items: items.slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
    riskSignals,
    nextActions
  };
}

function buildCycleForRole(role, worldState, views) {
  if (role === "scholar") return buildScholarCycle(worldState, views);
  if (role === "magistrate") return buildMagistrateCycle(worldState, views);
  if (role === "official") return buildOfficialCycle(worldState, views);
  if (role === "minister") return buildMinisterCycle(worldState, views);
  if (role === "general") return buildGeneralCycle(worldState, views);
  if (role === "emperor") return buildEmperorCycle(worldState, views);
  return buildFallbackCycle(role);
}

function buildRoleMatrix(activeRole, currentRole) {
  return ROLE_CYCLE_ROLES.slice(0, ROLE_CYCLE_LIMITS.maxMatrixRoles).map((role) => {
    const config = roleConfig(role);
    const active = role === activeRole;
    return {
      role,
      roleLabel: config.roleLabel,
      authorityTier: config.authorityTier,
      loopLabel: config.loopLabel,
      statusLabel: active ? currentRole.statusLabel : "待任后展开",
      pressureScore: active ? currentRole.pressureScore : 0,
      itemCount: active ? currentRole.items.length : 0,
      enabled: active,
      summary: active
        ? currentRole.summary
        : `${config.roleLabel}循环已列入矩阵；详细案源只在对应身份的安全视野中展开。`,
      sourceViews: [...config.sourceViews].slice(0, ROLE_CYCLE_LIMITS.maxSourceViews)
    };
  });
}

function buildRoleCycleView(worldState = {}, options = {}) {
  const role = cleanRole(worldState.player?.role);
  const views = buildSourceViews(worldState, options, role);
  const currentRole = buildCycleForRole(role, worldState, views);
  const matrix = buildRoleMatrix(role, currentRole);
  const config = roleConfig(role);
  return {
    schemaVersion: ROLE_CYCLE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    activeRole: role,
    activeRoleLabel: config.roleLabel,
    summary: cleanText(
      `${config.roleLabel}本旬循环：${currentRole.loopLabel}，${currentRole.items.length}项可见事务，${currentRole.riskSignals.length}条风险信号。`,
      config.defaultSummary
    ),
    currentRole,
    roleMatrix: matrix,
    aiReadScope: {
      allowedFields: [...ROLE_CYCLE_AI_READ_SCOPE],
      allowedSourceViews: currentRole.sourceViews,
      visibilityProfile: role === "scholar" ? "player_study_visible" : "role_visible_public_projection"
    },
    toolPermissions: ROLE_CYCLE_TOOL_PERMISSIONS,
    proposalBoundaries: [...ROLE_CYCLE_PROPOSAL_BOUNDARIES],
    serverAdjudication: ROLE_CYCLE_SERVER_ADJUDICATION,
    authorityBoundary: ROLE_CYCLE_SERVER_ADJUDICATION,
    safety: {
      readOnlyView: true,
      draftOnlyFrontend: true,
      derivedFromSafeViews: true,
      serverAdjudicatedOutcomes: true,
      internalMaterialExcluded: true
    }
  };
}

function summarizeRoleCycleForPrompt(worldState = {}, options = {}) {
  const view = buildRoleCycleView(worldState, options);
  return {
    schemaVersion: view.schemaVersion,
    generatedAtTurn: view.generatedAtTurn,
    activeRole: view.activeRole,
    activeRoleLabel: view.activeRoleLabel,
    summary: view.summary,
    currentRole: {
      loopLabel: view.currentRole.loopLabel,
      statusLabel: view.currentRole.statusLabel,
      pressureScore: view.currentRole.pressureScore,
      items: view.currentRole.items.map((item) => ({
        title: item.title,
        statusLabel: item.statusLabel,
        publicSummary: item.publicSummary,
        sourceView: item.sourceView
      })).slice(0, ROLE_CYCLE_LIMITS.maxItemsPerRole),
      riskSignals: view.currentRole.riskSignals.map((risk) => ({
        label: risk.label,
        value: risk.value,
        bandLabel: risk.bandLabel,
        summary: risk.summary,
        sourceView: risk.sourceView
      })).slice(0, ROLE_CYCLE_LIMITS.maxRiskSignals),
      nextActions: view.currentRole.nextActions.map((action) => ({
        label: action.label,
        text: action.text,
        targetSurfaceId: action.targetSurfaceId
      })).slice(0, ROLE_CYCLE_LIMITS.maxNextActions)
    },
    roleMatrix: view.roleMatrix.map((entry) => ({
      role: entry.role,
      roleLabel: entry.roleLabel,
      loopLabel: entry.loopLabel,
      enabled: entry.enabled,
      itemCount: entry.itemCount
    }))
  };
}

module.exports = {
  buildRoleCycleView,
  summarizeRoleCycleForPrompt
};
