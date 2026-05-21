const { buildLongTermEventView } = require("./longTermEvents");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildEconomicFiscalView } = require("./economicFiscal");
const {
  buildHistoricalEventArchiveView
} = require("./historicalEventArchive");
const { buildIntelligenceRumorView } = require("./intelligenceRumors");
const { buildOfficialCareerView } = require("./officialCareer");
const { buildOfficialPostingsView } = require("./officialPostings");
const { formatYearMonthPeriod, normalizeMonth, normalizeTenDayPeriod, normalizeYear } = require("./time");
const { buildWorldThreadView } = require("./worldThreads");
const { isVisibleActorId } = require("./actorMemoryLedger");

const EVENT_ARCHIVE_SCHEMA_VERSION = 1;
const MAX_ARCHIVE_ITEMS = 24;
const MAX_HISTORY_ITEMS = 8;
const MAX_THREADS = 6;
const MAX_LONG_TERM_EVENTS = 5;
const MAX_OFFICIAL_OUTCOMES = 5;
const MAX_OFFICIAL_COURT_ENTRY_RESOLUTIONS = 5;
const MAX_OFFICIAL_COURT_ENTRY_FOLLOW_UPS = 5;
const MAX_MONTHLY_BRIEFINGS = 4;
const MAX_OFFICIAL_ASSESSMENTS = 4;
const MAX_LOCAL_DOCKETS = 6;
const MAX_MILITARY_INCIDENTS = 5;
const MAX_ECONOMIC_INCIDENTS = 5;
const MAX_HISTORICAL_EVENT_CHAINS = 6;
const MAX_INTELLIGENCE_RUMORS = 6;
const MAX_EXAM_RECORDS = 5;
const MAX_EXAM_NETWORK_RECORDS = 5;
const MAX_ACTOR_MEMORY_RECORDS = 6;
const MAX_SESSION_SUMMARIES = 4;
const MAX_TEXT_LENGTH = 180;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_ARCHIVE_TEXT_PATTERN =
  /(hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|relationshipLedger|actorMemoryLedger|sessionSummary|retrievalContext|sealedMapping|sealed_mapping|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const SOURCE_LABELS = {
  event_history: "近事",
  world_thread: "议程",
  long_term_event: "长期",
  official_career: "官场",
  official_court_entry: "奏议",
  official_court_follow_up: "批复",
  monthly_briefing: "月报",
  official_assessment: "考成",
  local_docket: "案牍",
  military_diplomacy: "军务",
  economic_fiscal: "财赋",
  historical_event_chain: "事件链",
  intelligence_rumor: "情报",
  exam_record: "科场",
  exam_network: "科场人脉",
  appointment_result: "授官",
  actor_memory: "记忆",
  session_summary: "经历"
};

const STATUS_LABELS = {
  recorded: "已记",
  active: "观察",
  watch: "留察",
  resolved: "归档",
  submitted: "交卷"
};

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

function redactArchiveText(value) {
  let text = String(value ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const raw = String(secret);
    const variants = new Set([raw, raw.slice(0, 8), raw.slice(0, 12), raw.slice(-8), raw.slice(-12)]);
    for (const variant of variants) {
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

function cleanArchiveText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw || SENSITIVE_ARCHIVE_TEXT_PATTERN.test(raw)) return fallback;
  const redacted = redactArchiveText(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_ARCHIVE_TEXT_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function normalizeDateSource(worldState = {}, source = {}) {
  const candidate = isPlainObject(source) ? source : {};
  const year = normalizeYear(candidate.year ?? candidate.currentYear ?? worldState.year);
  const month = normalizeMonth(candidate.month ?? candidate.currentMonth ?? worldState.month);
  const tenDayPeriod = normalizeTenDayPeriod(
    candidate.tenDayPeriod ?? candidate.currentTenDayPeriod ?? worldState.tenDayPeriod
  );
  const dynasty = candidate.dynasty || worldState.dynasty || "";
  return {
    dynasty,
    year,
    month,
    tenDayPeriod,
    dateLabel: candidate.label || formatYearMonthPeriod({ dynasty, year, month, tenDayPeriod })
  };
}

function makeArchiveItem(worldState, index, fields = {}) {
  const date = normalizeDateSource(worldState, fields.date || fields);
  const sourceType = SOURCE_LABELS[fields.sourceType] ? fields.sourceType : "event_history";
  const status = STATUS_LABELS[fields.status] ? fields.status : "recorded";
  const title = cleanArchiveText(fields.title, SOURCE_LABELS[sourceType] || "事件");
  const summary = cleanArchiveText(fields.summary, "");
  if (!summary) return null;
  const turn = clampNumber(fields.turn ?? fields.resolvedTurn ?? fields.createdTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const relatedLabels = Array.isArray(fields.relatedLabels)
    ? fields.relatedLabels.map((label) => cleanArchiveText(label, "", 60)).filter(Boolean).slice(0, 6)
    : [];

  return {
    id: `EA-${String(index).padStart(3, "0")}-${sourceType}`,
    sourceType,
    sourceLabel: SOURCE_LABELS[sourceType],
    kind: cleanArchiveText(fields.kind || sourceType, sourceType, 60),
    title,
    summary,
    year: date.year,
    month: date.month,
    tenDayPeriod: date.tenDayPeriod,
    dateLabel: date.dateLabel,
    turn,
    visibility: "public",
    status,
    statusLabel: STATUS_LABELS[status],
    riskLabel: cleanArchiveText(fields.riskLabel, "", 40),
    relatedLabels
  };
}

function addItem(items, worldState, fields) {
  const item = makeArchiveItem(worldState, items.length + 1, fields);
  if (item) items.push(item);
}

function collectHistoryItems(worldState, items) {
  const history = Array.isArray(worldState.eventHistory) ? worldState.eventHistory : [];
  const visibleHistory = history.slice(-MAX_HISTORY_ITEMS);
  const firstTurn = Math.max(0, currentTurn(worldState) - visibleHistory.length + 1);
  visibleHistory.forEach((entry, index) => {
    addItem(items, worldState, {
      sourceType: "event_history",
      kind: "event",
      title: "近事入档",
      summary: entry,
      turn: firstTurn + index,
      status: "recorded"
    });
  });
}

function collectWorldThreadItems(worldState, items, worldThreadView) {
  const activeThreads = Array.isArray(worldThreadView?.activeThreads) ? worldThreadView.activeThreads : [];
  activeThreads.slice(0, MAX_THREADS).forEach((thread) => {
    addItem(items, worldState, {
      sourceType: "world_thread",
      kind: thread.kind,
      title: thread.title,
      summary: thread.summary || thread.goal,
      turn: thread.lastUpdatedTurn ?? thread.createdTurn,
      status: thread.status === "watch" ? "watch" : "active",
      riskLabel: thread.riskLabel,
      relatedLabels: thread.relatedLabels?.summary || []
    });
  });

  const resolvedThreads = Array.isArray(worldThreadView?.recentResolved) ? worldThreadView.recentResolved : [];
  resolvedThreads.slice(-3).forEach((thread) => {
    addItem(items, worldState, {
      sourceType: "world_thread",
      kind: thread.kind,
      title: thread.title,
      summary: thread.outcome,
      turn: thread.resolvedTurn,
      status: "resolved"
    });
  });
}

function collectLongTermItems(worldState, items, longTermEventView) {
  const activeEvents = Array.isArray(longTermEventView?.activeEvents) ? longTermEventView.activeEvents : [];
  activeEvents.slice(0, MAX_LONG_TERM_EVENTS).forEach((event) => {
    addItem(items, worldState, {
      sourceType: "long_term_event",
      kind: event.type,
      title: event.title,
      summary: event.summary,
      date: {
        year: event.startedYear,
        month: event.startedMonth,
        tenDayPeriod: 1
      },
      status: "active",
      riskLabel: event.severity >= 3 ? "急重" : event.severity >= 2 ? "有牵连" : "可观察"
    });
  });

  const resolved = Array.isArray(longTermEventView?.recentResolved) ? longTermEventView.recentResolved : [];
  resolved.slice(-3).forEach((event) => {
    addItem(items, worldState, {
      sourceType: "long_term_event",
      kind: event.type,
      title: event.title,
      summary: event.outcome,
      turn: event.resolvedTurn,
      status: "resolved"
    });
  });
}

function collectOfficialItems(worldState, items, officialCareerView) {
  const outcomes = Array.isArray(officialCareerView?.recentOutcomes) ? officialCareerView.recentOutcomes : [];
  outcomes.slice(-MAX_OFFICIAL_OUTCOMES).forEach((outcome) => {
    const from = cleanArchiveText(outcome.officeTitleBefore, "", 80);
    const to = cleanArchiveText(outcome.officeTitleAfter, "", 80);
    addItem(items, worldState, {
      sourceType: "official_career",
      kind: outcome.type,
      title: outcome.label,
      summary: [outcome.reason, from || to ? `职名：${from || "未授"} -> ${to || "未授"}` : ""]
        .filter(Boolean)
        .join("；"),
      date: outcome,
      turn: outcome.turn,
      status: outcome.status === "pending" ? "watch" : "resolved"
    });
  });

  const resolutions = Array.isArray(officialCareerView?.courtEntryResolutions)
    ? officialCareerView.courtEntryResolutions
    : [];
  resolutions.slice(-MAX_OFFICIAL_COURT_ENTRY_RESOLUTIONS).forEach((resolution) => {
    addItem(items, worldState, {
      sourceType: "official_court_entry",
      kind: resolution.submissionKind || "official_first_month",
      title: resolution.title || resolution.statusLabel || "首月奏议裁决",
      summary: resolution.publicSummary,
      date: resolution,
      turn: resolution.generatedAtTurn,
      status: resolution.status === "returned_for_evidence" || resolution.status === "held_for_inquiry" ? "watch" : "recorded",
      riskLabel: resolution.riskDelta > 0 ? "须补查" : resolution.meritDelta > 0 ? "入考成" : "",
      relatedLabels: Array.isArray(resolution.sourceRefs) ? resolution.sourceRefs : []
    });
  });

  const followUps = Array.isArray(officialCareerView?.courtEntryFollowUps)
    ? officialCareerView.courtEntryFollowUps
    : Array.isArray(officialCareerView?.courtEntry?.followUpHistory)
      ? officialCareerView.courtEntry.followUpHistory
      : [];
  followUps.slice(-MAX_OFFICIAL_COURT_ENTRY_FOLLOW_UPS).forEach((followUp) => {
    addItem(items, worldState, {
      sourceType: "official_court_follow_up",
      kind: followUp.stage || "official_court_follow_up",
      title: followUp.title || followUp.statusLabel || "奏议后续批复",
      summary: followUp.publicSummary,
      date: followUp,
      turn: followUp.generatedAtTurn,
      status: followUp.status === "returned_for_evidence" ? "watch" : "recorded",
      riskLabel: followUp.riskDelta > 0 ? "须补查" : followUp.meritDelta > 0 ? "入考成" : "",
      relatedLabels: [
        ...(Array.isArray(followUp.sourceRefs) ? followUp.sourceRefs : []),
        ...(Array.isArray(followUp.consequenceRefs) ? followUp.consequenceRefs : [])
      ]
    });
  });
}

function collectMonthlyBriefingItems(worldState, items) {
  const reports = Array.isArray(worldState.playerMonthlyBriefing?.reports)
    ? worldState.playerMonthlyBriefing.reports
    : [];
  reports.slice(-MAX_MONTHLY_BRIEFINGS).forEach((report) => {
    addItem(items, worldState, {
      sourceType: "monthly_briefing",
      kind: report.role || "official",
      title: report.title || "官职月报",
      summary: report.publicSummary,
      date: report.generatedAt || report,
      turn: report.generatedAtTurn,
      status: "recorded",
      riskLabel: Array.isArray(report.riskItems) && report.riskItems.length ? "月报风险" : "",
      relatedLabels: Array.isArray(report.sourceRefs)
        ? report.sourceRefs.map((ref) => ref.label || ref.id || ref.source)
        : []
    });
  });
}

function collectOfficialAssessmentItems(worldState, items, officialPostingsView) {
  const assessments = Array.isArray(officialPostingsView?.assessmentRecords)
    ? officialPostingsView.assessmentRecords
    : [];
  assessments
    .filter((record) => !isAppointmentPoolAssessment(record))
    .slice(-MAX_OFFICIAL_ASSESSMENTS)
    .forEach((record) => {
      addItem(items, worldState, {
        sourceType: "official_assessment",
        kind: "assessment",
        title: "任所考成",
        summary: record.publicFinding || record.publicSummary,
        date: record.date,
        turn: record.date?.turn ?? record.lastUpdatedTurn,
        status: record.status === "resolved" || record.status === "archived" ? "resolved" : "watch",
        riskLabel: record.riskScore >= 60 ? "考成风险" : record.meritScore >= 70 ? "考成向好" : "",
        relatedLabels: [record.officeId, record.bureauId].filter(Boolean)
      });
    });
}

function isAppointmentPoolAssessment(record = {}) {
  const id = typeof record.id === "string" ? record.id : "";
  const postingId = typeof record.postingId === "string" ? record.postingId : "";
  // S63 任命池考成是可见案牍压力 projection，不是已经发生的公开历史事件。
  return id.startsWith("assessment-s63-") || postingId.startsWith("posting-s63-");
}

function collectLocalDocketItems(worldState, items, localAffairsDocketView) {
  const dockets = Array.isArray(localAffairsDocketView?.dockets)
    ? localAffairsDocketView.dockets
    : [];
  dockets.slice(0, MAX_LOCAL_DOCKETS).forEach((docket) => {
    const relatedLabels = [
      docket.domainLabel,
      docket.cityName,
      docket.bureauId,
      ...(Array.isArray(docket.assessmentHint?.tags) ? docket.assessmentHint.tags : [])
    ].filter(Boolean);
    addItem(items, worldState, {
      sourceType: "local_docket",
      kind: docket.domain,
      title: docket.title,
      summary: docket.publicDocket || docket.publicSummary,
      date: docket.date,
      turn: docket.lastUpdatedTurn,
      status: docket.status === "routine" ? "recorded" : "watch",
      riskLabel: docket.statusLabel,
      relatedLabels
    });
  });
}

function collectMilitaryDiplomacyItems(worldState, items, militaryDiplomacyView) {
  const incidents = Array.isArray(militaryDiplomacyView?.frontierIncidents)
    ? militaryDiplomacyView.frontierIncidents
    : [];
  incidents.slice(0, MAX_MILITARY_INCIDENTS).forEach((incident) => {
    addItem(items, worldState, {
      sourceType: "military_diplomacy",
      kind: incident.kind,
      title: incident.title,
      summary: incident.publicSummary,
      date: incident.date,
      turn: incident.lastUpdatedTurn,
      status: incident.status === "routine" ? "recorded" : "watch",
      riskLabel: incident.statusLabel,
      relatedLabels: [
        incident.kindLabel,
        incident.frontierZoneId,
        incident.neighborCountryId,
        ...(Array.isArray(incident.relatedCityIds) ? incident.relatedCityIds : [])
      ].filter(Boolean)
    });
  });
}

function collectEconomicFiscalItems(worldState, items, economicFiscalView) {
  const incidents = Array.isArray(economicFiscalView?.marketIncidents)
    ? economicFiscalView.marketIncidents
    : [];
  incidents.slice(0, MAX_ECONOMIC_INCIDENTS).forEach((incident) => {
    addItem(items, worldState, {
      sourceType: "economic_fiscal",
      kind: incident.kind,
      title: incident.title,
      summary: incident.publicSummary,
      date: incident.date,
      turn: incident.lastUpdatedTurn,
      status: incident.status === "routine" ? "recorded" : "watch",
      riskLabel: incident.statusLabel,
      relatedLabels: [
        incident.kindLabel,
        incident.countryId,
        incident.cityId,
        incident.routeId,
        incident.bureauId
      ].filter(Boolean)
    });
  });
}

function collectHistoricalEventItems(worldState, items, historicalEventArchiveView) {
  const chains = Array.isArray(historicalEventArchiveView?.publicChains)
    ? historicalEventArchiveView.publicChains
    : [];
  chains.slice(0, MAX_HISTORICAL_EVENT_CHAINS).forEach((chain) => {
    addItem(items, worldState, {
      sourceType: "historical_event_chain",
      kind: chain.domain,
      title: chain.title,
      summary: chain.publicSummary,
      date: chain.date,
      turn: chain.lastUpdatedTurn,
      status: chain.status === "recorded" ? "recorded" : "watch",
      riskLabel: chain.statusLabel,
      relatedLabels: [
        chain.domainLabel,
        ...(Array.isArray(chain.relatedRefs) ? chain.relatedRefs.map((ref) => ref.label || ref.id) : [])
      ].filter(Boolean)
    });
  });
}

function collectIntelligenceRumorItems(worldState, items, intelligenceRumorView) {
  const rumors = Array.isArray(intelligenceRumorView?.publicRumors)
    ? intelligenceRumorView.publicRumors
    : [];
  rumors.slice(0, MAX_INTELLIGENCE_RUMORS).forEach((rumor) => {
    addItem(items, worldState, {
      sourceType: "intelligence_rumor",
      kind: rumor.kind,
      title: rumor.title || rumor.kindLabel,
      summary: rumor.publicSummary,
      date: rumor.date,
      turn: rumor.lastUpdatedTurn,
      status: rumor.credibilityTier === "unverified" ? "watch" : "recorded",
      riskLabel: rumor.credibilityLabel,
      relatedLabels: [
        rumor.channel,
        rumor.kindLabel,
        ...(Array.isArray(rumor.relatedRefs) ? rumor.relatedRefs.map((ref) => ref.label || ref.id) : [])
      ].filter(Boolean)
    });
  });
}

function examDateSource(entry = {}) {
  return entry.sceneTime?.updatedAt ||
    entry.examSubmittedAt ||
    entry.sceneTime?.startedAt ||
    entry.examStartedAt ||
    entry.examCalendar ||
    entry.entryPreparation?.examCalendar ||
    null;
}

function collectExamItems(worldState, items) {
  const history = Array.isArray(worldState.player?.examHistory) ? worldState.player.examHistory : [];
  history.slice(-MAX_EXAM_RECORDS).forEach((entry) => {
    const score = entry.score?.overall_score ?? null;
    const rank = cleanArchiveText(entry.score?.rank || entry.promotionResult?.rank, "", 60);
    const passed = entry.promotionResult?.passed ? "取中" : "未中";
    const honor = entry.examHonor?.currentHonor || (Array.isArray(entry.examHonor?.awards) ? entry.examHonor.awards.at(-1) : null);
    const achievement = entry.examHonor?.currentAchievement || null;
    const honorText = achievement?.title || honor?.title || "";
    addItem(items, worldState, {
      sourceType: "exam_record",
      kind: entry.level || "exam",
      title: entry.examName || "科场",
      summary: `${entry.examName || "科场"}交卷，得${score ?? "-"}分，${rank || passed}${honorText ? `，${cleanArchiveText(honorText, "", 60)}` : ""}。`,
      date: examDateSource(entry) || worldState,
      turn: entry.sceneTime?.updatedAt?.turnCount ?? entry.sceneTime?.startedAt?.turnCount ?? currentTurn(worldState),
      status: "submitted",
      riskLabel: entry.authenticityCheck?.severeCheat ? "监试风险" : ""
    });
  });
}

function collectExamNetworkItems(worldState, items) {
  const history = Array.isArray(worldState.player?.examHistory) ? worldState.player.examHistory : [];
  history
    .filter((entry) => entry.examNetwork)
    .slice(-MAX_EXAM_NETWORK_RECORDS)
    .forEach((entry) => {
      const network = entry.examNetwork || {};
      const sameYearCount = Array.isArray(network.sameYearContacts) ? network.sameYearContacts.length : 0;
      const examinerCount = Array.isArray(network.examinerContacts) ? network.examinerContacts.length : 0;
      addItem(items, worldState, {
        sourceType: "exam_network",
        kind: entry.level || network.level || "exam_network",
        title: `${entry.examName || network.examName || "科场"}人脉`,
        summary: network.publicSummary ||
          `${entry.examName || "科场"}归档同年${sameYearCount}人、座师考官${examinerCount}人。`,
        date: network.date || examDateSource(entry) || worldState,
        turn: network.date?.turnCount ??
          entry.sceneTime?.updatedAt?.turnCount ??
          entry.sceneTime?.startedAt?.turnCount ??
          currentTurn(worldState),
        status: "recorded",
        relatedLabels: [
          `同年${sameYearCount}人`,
          `座师考官${examinerCount}人`,
          ...(Array.isArray(network.examinerContacts) ? network.examinerContacts.map((contact) => contact.role) : [])
        ].filter(Boolean)
      });
    });
}

function collectAppointmentTrackItems(worldState, items) {
  const records = Array.isArray(worldState.appointmentTrack?.records)
    ? worldState.appointmentTrack.records
    : [];
  records
    .slice(-MAX_EXAM_RECORDS)
    .forEach((record) => {
      const decision = record.serverDecision || {};
      addItem(items, worldState, {
        sourceType: "appointment_result",
        kind: decision.trackKey || record.palaceRank || "appointment_track",
        title: decision.officeTitle ? `初授${decision.officeTitle}` : "殿试授官",
        summary: record.publicSummary ||
          `${record.examName || "殿试"}后，服务器归档授官路径。`,
        date: record.date || worldState,
        turn: record.date?.turnCount ?? currentTurn(worldState),
        status: "recorded",
        riskLabel: record.avoidanceChecks?.some?.((check) => check.status === "blocked")
          ? "回避改拟"
          : "",
        relatedLabels: [
          record.palaceRank,
          record.honorTitle,
          decision.trackLabel,
          decision.bureauId,
          ...(Array.isArray(record.avoidanceChecks)
            ? record.avoidanceChecks.map((check) => check.status === "blocked" ? "籍贯回避" : "")
            : [])
        ].filter(Boolean)
      });
    });
}

function collectActorMemoryItems(worldState, items) {
  const ledger = worldState.actorMemoryLedger || {};
  const visible = [];
  const memoriesByActor = ledger.memoriesByActor && typeof ledger.memoriesByActor === "object"
    ? ledger.memoriesByActor
    : {};
  for (const [actorId, rows] of Object.entries(memoriesByActor)) {
    if (!isVisibleActorId(worldState, actorId)) continue;
    for (const memory of Array.isArray(rows) ? rows : []) {
      if (!["public", "player_visible", "relationship_visible"].includes(memory.visibility)) continue;
      const summary = cleanArchiveText(memory.summary, "");
      if (!summary) continue;
      visible.push({
        actorId,
        memory,
        summary,
        salience: clampNumber(memory.salience, 0, 100, 0),
        turn: clampNumber(memory.lastTouchedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
      });
    }
  }
  visible
    .sort((first, second) => second.salience - first.salience || second.turn - first.turn)
    .slice(0, MAX_ACTOR_MEMORY_RECORDS)
    .forEach(({ actorId, memory, summary, turn }) => {
      addItem(items, worldState, {
        sourceType: "actor_memory",
        kind: memory.type || "memory",
        title: memory.typeLabel ? `可见记忆：${memory.typeLabel}` : "可见记忆",
        summary,
        date: memory.createdAt || worldState,
        turn,
        status: "recorded",
        relatedLabels: [
          actorId,
          ...(Array.isArray(memory.tags) ? memory.tags : [])
        ].filter(Boolean)
      });
    });
}

function collectSessionSummaryItems(worldState, items) {
  const summaries = Array.isArray(worldState.sessionSummary?.monthlySummaries)
    ? worldState.sessionSummary.monthlySummaries
    : [];
  summaries.slice(-MAX_SESSION_SUMMARIES).forEach((summary) => {
    addItem(items, worldState, {
      sourceType: "session_summary",
      kind: "monthly_summary",
      title: summary.periodLabel || "月度经历",
      summary: summary.publicSummary,
      date: summary.generatedAt || worldState,
      turn: summary.generatedAtTurn,
      status: "recorded",
      relatedLabels: Array.isArray(summary.highlights) ? summary.highlights.slice(0, 3) : []
    });
  });
}

function sortArchiveItems(first, second) {
  if (second.turn !== first.turn) return second.turn - first.turn;
  if (second.year !== first.year) return second.year - first.year;
  if (second.month !== first.month) return second.month - first.month;
  if (second.tenDayPeriod !== first.tenDayPeriod) return second.tenDayPeriod - first.tenDayPeriod;
  return first.id.localeCompare(second.id);
}

function countSources(items) {
  return items.reduce((counts, item) => {
    counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
    return counts;
  }, {});
}

function normalizePage(value) {
  return clampNumber(value, 1, Number.MAX_SAFE_INTEGER, 1);
}

function normalizePageSize(value) {
  return clampNumber(value, MIN_PAGE_SIZE, MAX_PAGE_SIZE, MAX_ARCHIVE_ITEMS);
}

function buildEventArchiveIndexItems(worldState = {}) {
  const worldThreadView = buildWorldThreadView(worldState);
  const longTermEventView = buildLongTermEventView(worldState);
  const officialCareerView = buildOfficialCareerView(worldState);
  const officialPostingsView = buildOfficialPostingsView(worldState);
  const localAffairsDocketView = buildLocalAffairsDocketView(worldState);
  const militaryDiplomacyView = buildMilitaryDiplomacyView(worldState);
  const economicFiscalView = buildEconomicFiscalView(worldState);
  const historicalEventArchiveView = buildHistoricalEventArchiveView(worldState);
  const intelligenceRumorView = buildIntelligenceRumorView(worldState);
  const items = [];

  collectHistoryItems(worldState, items);
  collectWorldThreadItems(worldState, items, worldThreadView);
  collectLongTermItems(worldState, items, longTermEventView);
  collectOfficialItems(worldState, items, officialCareerView);
  collectMonthlyBriefingItems(worldState, items);
  collectAppointmentTrackItems(worldState, items);
  collectOfficialAssessmentItems(worldState, items, officialPostingsView);
  collectLocalDocketItems(worldState, items, localAffairsDocketView);
  collectMilitaryDiplomacyItems(worldState, items, militaryDiplomacyView);
  collectEconomicFiscalItems(worldState, items, economicFiscalView);
  collectHistoricalEventItems(worldState, items, historicalEventArchiveView);
  collectIntelligenceRumorItems(worldState, items, intelligenceRumorView);
  collectExamItems(worldState, items);
  collectExamNetworkItems(worldState, items);
  collectActorMemoryItems(worldState, items);
  collectSessionSummaryItems(worldState, items);

  return items.sort(sortArchiveItems);
}

function buildPagination(totalItems, options = {}) {
  const pageSize = normalizePageSize(options.pageSize ?? options.limit ?? MAX_ARCHIVE_ITEMS);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(normalizePage(options.page), totalPages);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    offset
  };
}

function buildEventArchiveView(worldState = {}, options = {}) {
  const sortedItems = buildEventArchiveIndexItems(worldState);
  const pagination = buildPagination(sortedItems.length, options);
  const pageItems = sortedItems.slice(pagination.offset, pagination.offset + pagination.pageSize);
  return {
    schemaVersion: EVENT_ARCHIVE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    items: pageItems,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: pagination.hasNextPage
    },
    counts: {
      total: sortedItems.length,
      ...countSources(sortedItems)
    },
    pageCounts: {
      total: pageItems.length,
      ...countSources(pageItems)
    },
    hiddenNotice: "事件档案只收录服务器整理后的公开卷宗；本地诊断、提示词、密钥路径和模型提案均已过滤。"
  };
}

module.exports = {
  EVENT_ARCHIVE_SCHEMA_VERSION,
  buildEventArchiveIndexItems,
  buildEventArchiveView,
  cleanArchiveText
};
