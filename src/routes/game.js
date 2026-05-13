const express = require("express");
const { createInitialState } = require("../game/initialState");
const {
  applyRelationshipChanges,
  buildRelationshipInspectionView,
  ensureRelationshipLedger
} = require("../game/relationships");
const {
  buildActiveNpcRequestView,
  runActiveNpcRequestStep
} = require("../game/activeRequests");
const {
  buildLongTermEventView,
  ensureLongTermEventState,
  runLongTermEventStep
} = require("../game/longTermEvents");
const {
  buildOfficialCareerView,
  ensureOfficialCareerState,
  runOfficialCareerStep
} = require("../game/officialCareer");
const {
  buildOfficialPostingsView,
  ensureOfficialPostingsState
} = require("../game/officialPostings");
const {
  buildRoleWorldCouplingView,
  ensureRoleWorldCouplingState,
  runRoleWorldCouplingStep
} = require("../game/roleWorldCoupling");
const {
  buildWorldGeographyView,
  ensureWorldGeographyState
} = require("../game/worldGeography");
const {
  applyWorldEntityInfluences,
  buildWorldEntityView,
  deriveWorldEntityInfluences,
  ensureWorldEntityState
} = require("../game/worldEntities");
const {
  buildWorldPeopleView,
  ensureWorldPeopleState
} = require("../game/worldPeople");
const { runWorldPeopleLifecycleStep } = require("../game/worldPeopleLifecycle");
const {
  appendPeopleEventLinks,
  buildWorldPeopleEventBatch,
  snapshotWorldPeopleForEvents
} = require("../game/worldPeopleEvents");
const {
  buildWorldThreadView,
  ensureWorldThreadState
} = require("../game/worldThreads");
const {
  buildExamCalendarView,
  buildExamRivalView,
  canOpenExamInCalendar,
  ensureExamCalendarState
} = require("../game/examCalendar");
const {
  applyTeacherFeedbackProposal,
  applyStudyAction,
  buildStudyProfileView,
  ensureStudyProfileState,
  runStudyInteractionStep
} = require("../game/studyProfile");
const {
  createExamProgressAuditRecords,
  createOpeningAuditRecords,
  createTurnAuditRecords,
  enqueueAuditRecords
} = require("../game/audit");
const { buildEventArchiveView } = require("../game/eventArchive");
const {
  buildInformationPanelPageViews,
  informationPanelOptionsFromQuery
} = require("../game/informationPanelPage");
const { searchSafeWorldIndex } = require("../game/safeWorldSearch");
const { buildEconomicFiscalView } = require("../game/economicFiscal");
const { buildHistoricalEventArchiveView } = require("../game/historicalEventArchive");
const { buildIntelligenceRumorView } = require("../game/intelligenceRumors");
const { buildLocalAffairsDocketView } = require("../game/localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("../game/militaryDiplomacy");
const { buildMapContextView } = require("../game/mapContext");
const { canEnterExam, getExam } = require("../game/exams");
const {
  advanceExamScenePhase,
  attachExamSceneTime,
  buildExamSceneFeedback
} = require("../game/examSceneTime");
const {
  advanceExamProcedurePhase,
  buildExamProcedureView,
  initializeExamProcedure
} = require("../game/examProcedure");
const { buildExaminerPanelView } = require("../game/examReview");
const {
  buildExamHonorView,
  ensureExamHonorLedgerState
} = require("../game/examHonors");
const {
  buildAppointmentTrackView,
  ensureAppointmentTrackState
} = require("../game/appointmentTracks");
const { applyStatePatch, appendEvents } = require("../game/stateRules");
const { runWorldTick } = require("../game/worldTick");
const { getProvider } = require("../ai");
const { resolveModelForTask } = require("../ai/modelRoutePolicy");
const {
  buildAiInvocationSummaryView,
  recordAiInvocation,
  redactAiSettingsForClient,
  resolveAiSettingsForSession,
  updateAiSettings
} = require("../game/aiSettings");
const {
  buildPlayerMonthlyBriefingView,
  ensurePlayerMonthlyBriefingState,
  runPlayerMonthlyBriefingStep
} = require("../game/playerMonthlyBriefing");
const {
  applyTurnActorMemoryUpdates,
  buildActorMemoryView,
  decayActorMemoryLedger,
  ensureActorMemoryLedgerState
} = require("../game/actorMemoryLedger");
const {
  buildSessionSummaryView,
  ensureSessionSummaryState,
  updateMonthlySessionSummary
} = require("../game/sessionSummary");
const { buildClientWorldState } = require("../game/clientWorldState");
const {
  buildPlayerStateEnvelope,
  redactPlayerRouteViews
} = require("../game/redactedState");
const {
  buildTimeSkipPlan,
  buildTimeSkipSummary,
  detectTimeSkipIntent,
  runTimeSkipTicks,
  validateTimeSkipPlan
} = require("../game/timeSkip");
const { TIME_SKIP_ACTIONS } = require("../game/timeSkipConfig");
const { redactSecrets } = require("../ai/diagnostics");
const {
  getSessionStorageAdapter,
  listSessions,
  mutateSession,
  readSession,
  writeSession
} = require("../storage/sessionStore");
const { chunkTextForSse, closeSse, sendSseEvent, writeSseHeaders } = require("../utils/sse");
const { createJsonStringFieldExtractor } = require("../utils/streamingJson");

const router = express.Router();

function isAiSettingsValidationError(error) {
  return /AI 设置|AI 路由|不支持字段|禁止|hidden|raw|server|provider|model|任务|服务器维护/.test(error.message || "");
}

function validateTurnInput(body) {
  const { sessionId, input } = body;

  if (!sessionId || typeof sessionId !== "string") {
    const err = new Error("Missing sessionId");
    err.statusCode = 400;
    throw err;
  }
  if (!input || typeof input !== "string" || !input.trim()) {
    const err = new Error("Missing or empty input");
    err.statusCode = 400;
    throw err;
  }

  return { sessionId, input: input.trim() };
}

function wantsSse(req) {
  return req.query.stream === "1" || (req.get("accept") || "").includes("text/event-stream");
}

async function processTurn(sessionId, input) {
  return mutateSession(sessionId, async (worldState, context) => {
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureStudyProfileState(worldState);
    ensureExamHonorLedgerState(worldState);
    ensureAppointmentTrackState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldGeographyState(worldState);
    ensureOfficialPostingsState(worldState);
    ensureWorldEntityState(worldState);
    ensureWorldPeopleState(worldState);
    ensureWorldThreadState(worldState);
    ensurePlayerMonthlyBriefingState(worldState);
    ensureActorMemoryLedgerState(worldState);
    ensureSessionSummaryState(worldState);
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
    }
    const timeSkipIntent = detectTimeSkipIntent(input, { worldState });
    if (timeSkipIntent?.detected) {
      return processTimeSkipTurn(worldState, input, { context, intent: timeSkipIntent });
    }
    const { routePolicy } = resolveAiSettingsForSession(worldState);
    const route = resolveModelForTask("narrator", routePolicy);
    const provider = getProvider({ routePolicy });
    const startedAt = Date.now();
    const result = await provider.runTurn(worldState, input);
    recordAiInvocation(worldState, {
      taskType: "narrator",
      route,
      status: "completed",
      durationMs: Date.now() - startedAt,
      maxOutputTokens: route.maxOutputTokens
    });
    return finalizeTurn(worldState, result, input, { context, provider });
  });
}

async function processStreamingTurn(sessionId, input, streamHandlers = {}) {
  return mutateSession(sessionId, async (worldState, context) => {
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureStudyProfileState(worldState);
    ensureExamHonorLedgerState(worldState);
    ensureAppointmentTrackState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldGeographyState(worldState);
    ensureOfficialPostingsState(worldState);
    ensureWorldEntityState(worldState);
    ensureWorldPeopleState(worldState);
    ensureWorldThreadState(worldState);
    ensurePlayerMonthlyBriefingState(worldState);
    ensureActorMemoryLedgerState(worldState);
    ensureSessionSummaryState(worldState);
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
    }
    const timeSkipIntent = detectTimeSkipIntent(input, { worldState });
    if (timeSkipIntent?.detected) {
      return processTimeSkipTurn(worldState, input, { context, intent: timeSkipIntent });
    }
    const { routePolicy } = resolveAiSettingsForSession(worldState);
    const route = resolveModelForTask("narrator", routePolicy);
    const provider = getProvider({ routePolicy });
    const canStream = provider.supportsStreaming && typeof provider.streamTurn === "function";
    const startedAt = Date.now();
    const result = canStream
      ? await provider.streamTurn(worldState, input, streamHandlers)
      : await provider.runTurn(worldState, input);
    recordAiInvocation(worldState, {
      taskType: "narrator",
      route,
      status: canStream ? "streamed" : "completed",
      durationMs: Date.now() - startedAt,
      maxOutputTokens: route.maxOutputTokens
    });

    return finalizeTurn(worldState, result, input, { context, provider });
  });
}

function normalizeExamTrigger(trigger) {
  if (!trigger || trigger.shouldStart !== true) {
    return { shouldStart: false, level: null, reason: "" };
  }

  return {
    shouldStart: true,
    level: typeof trigger.level === "string" ? trigger.level : null,
    reason: typeof trigger.reason === "string" ? trigger.reason : ""
  };
}

function isWritingExam(activeExam) {
  return Boolean(activeExam && (activeExam.examQuestion || activeExam.status === "writing"));
}

function rejectExamTrigger(trigger, reason) {
  return {
    shouldStart: false,
    level: trigger.level || null,
    reason
  };
}

function applyExamTrigger(worldState, trigger) {
  const examTrigger = normalizeExamTrigger(trigger);
  if (!examTrigger.shouldStart) return examTrigger;

  if (isWritingExam(worldState.activeExam)) {
    return rejectExamTrigger(examTrigger, "已有未完成考试，请先完成当前考试。");
  }

  const exam = getExam(examTrigger.level);
  if (!exam) {
    return rejectExamTrigger(examTrigger, "未知考试等级。");
  }

  const entryGate = canEnterExam(worldState.player, exam.level);
  if (!entryGate.ok) {
    return rejectExamTrigger({ ...examTrigger, level: exam.level }, entryGate.reason);
  }

  const calendarGate = canOpenExamInCalendar(worldState, exam);
  if (!calendarGate.ok) {
    return rejectExamTrigger({ ...examTrigger, level: exam.level }, calendarGate.reason);
  }

  const reason = examTrigger.reason || "玩家主动请求赶考";
  worldState.activeExam = {
    level: exam.level,
    reason,
    examCalendar: calendarGate.snapshot,
    requestedAt: new Date().toISOString()
  };
  attachExamSceneTime(worldState.activeExam, worldState, "entry");
  initializeExamProcedure(worldState.activeExam);

  return {
    shouldStart: true,
    level: exam.level,
    reason
  };
}

function emptySystemFeedback() {
  return {
    summary: "",
    events: [],
    attributeChanges: [],
    outcome: null
  };
}

function eventArchiveOptionsFromQuery(query = {}) {
  return {
    page: query.eventArchivePage ?? query.archivePage,
    pageSize: query.eventArchivePageSize ?? query.archivePageSize
  };
}

function safeSearchOptionsFromQuery(query = {}) {
  return {
    query: query.q ?? query.query,
    domain: query.domain,
    page: query.page,
    pageSize: query.pageSize
  };
}

function ensureRouteProjectionState(worldState) {
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureStudyProfileState(worldState);
  ensureExamHonorLedgerState(worldState);
  ensureAppointmentTrackState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  ensurePlayerMonthlyBriefingState(worldState);
  ensureActorMemoryLedgerState(worldState);
  ensureSessionSummaryState(worldState);
}

function buildCommonTurnViews(worldState, options = {}) {
  const worldGeographyView = buildWorldGeographyView(worldState);
  const worldPeopleView = buildWorldPeopleView(worldState);
  const officialPostingsView = buildOfficialPostingsView(worldState);
  const { settings, routePolicy } = resolveAiSettingsForSession(worldState);
  return {
    aiSettingsView: redactAiSettingsForClient({ ...settings, routePolicy }),
    aiInvocationSummaryView: buildAiInvocationSummaryView(worldState, routePolicy),
    examCalendarView: buildExamCalendarView(worldState),
    examRivalView: buildExamRivalView(worldState),
    examProcedureView: buildExamProcedureView(worldState),
    examinerPanelView: buildExaminerPanelView(worldState.player?.examHistory?.at?.(-1)?.examinerPanel),
    examHonorView: buildExamHonorView(worldState),
    appointmentTrackView: buildAppointmentTrackView(worldState),
    studyProfileView: buildStudyProfileView(worldState),
    relationshipView: buildRelationshipInspectionView(worldState),
    activeNpcRequestView: buildActiveNpcRequestView(worldState),
    roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
    worldGeographyView,
    worldEntityView: buildWorldEntityView(worldState),
    worldPeopleView,
    worldThreadView: buildWorldThreadView(worldState),
    longTermEventView: buildLongTermEventView(worldState),
    officialCareerView: buildOfficialCareerView(worldState),
    officialPostingsView,
    localAffairsDocketView: buildLocalAffairsDocketView(worldState),
    militaryDiplomacyView: buildMilitaryDiplomacyView(worldState),
    economicFiscalView: buildEconomicFiscalView(worldState),
    mapContextView: buildMapContextView(worldState),
    historicalEventArchiveView: buildHistoricalEventArchiveView(worldState),
    intelligenceRumorView: buildIntelligenceRumorView(worldState),
    playerMonthlyBriefingView: buildPlayerMonthlyBriefingView(worldState),
    actorMemoryView: buildActorMemoryView(worldState),
    sessionSummaryView: buildSessionSummaryView(worldState),
    eventArchiveView: buildEventArchiveView(worldState, options.eventArchive),
    informationPanelPageView: buildInformationPanelPageViews(worldState, options.informationPanel || {}, {
      worldGeographyView,
      worldPeopleView,
      officialPostingsView
    })
  };
}

function clampPlayerMetric(value, min = 0, max = 100) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : min;
  return Math.max(min, Math.min(max, Math.round(base)));
}

function buildTimeSkipPlayerPatch(worldState, actionType) {
  const player = worldState.player || {};
  const role = player.role || "scholar";
  const patch = {};
  const setDelta = (key, delta, min = 0, max = 100) => {
    const before = clampPlayerMetric(player[key], min, max);
    const after = clampPlayerMetric(before + delta, min, max);
    if (after !== before) patch[key] = after;
  };

  if (actionType === "official_routine") {
    if (role === "magistrate") {
      setDelta("localOrder", 1);
      setDelta("pendingLawsuits", -1);
    } else if (role === "general") {
      setDelta("command", 1);
      setDelta("scouting", 1);
    } else if (role === "minister" || role === "emperor") {
      setDelta("influence", 1);
    } else {
      setDelta("performanceMerit", 1);
    }
    return patch;
  }

  const action = TIME_SKIP_ACTIONS[actionType] || TIME_SKIP_ACTIONS.routine;
  for (const [key, delta] of Object.entries(action.playerPatch || {})) {
    setDelta(key, delta);
  }
  return patch;
}

const TIME_SKIP_ATTRIBUTE_LABELS = {
  academia: "学识",
  literaryTalent: "文采",
  mentality: "心态",
  health: "体力",
  performanceMerit: "考成",
  localOrder: "地方秩序",
  pendingLawsuits: "积案",
  command: "统御",
  scouting: "侦察",
  influence: "影响"
};

function buildTimeSkipAttributeChanges(worldState, playerPatch, reason) {
  const player = worldState.player || {};
  return Object.entries(playerPatch)
    .map(([key, after]) => {
      const before = Number.isFinite(Number(player[key])) ? Math.round(Number(player[key])) : 0;
      if (before === after) return null;
      return {
        path: `player.${key}`,
        label: TIME_SKIP_ATTRIBUTE_LABELS[key] || key,
        before,
        after,
        reason
      };
    })
    .filter(Boolean);
}

function buildTimeSkipSyntheticResult(worldState, plan, tick) {
  const action = TIME_SKIP_ACTIONS[tick.actionType] || TIME_SKIP_ACTIONS.routine;
  const playerPatch = buildTimeSkipPlayerPatch(worldState, tick.actionType);
  const reason = `自然语言跳时：${tick.actionLabel}`;
  return {
    narrative: `${action.narrative}（第${tick.index}旬）`,
    statePatch: Object.keys(playerPatch).length ? { player: playerPatch } : {},
    attributeChanges: buildTimeSkipAttributeChanges(worldState, playerPatch, reason),
    relationshipChanges: [],
    events: [`[跳时] ${worldState.player?.name || "玩家"}${tick.actionLabel}，第${tick.index}旬按服务器规则结算。`],
    examTrigger: { shouldStart: false, level: null, reason: "跳时逐旬结算不直接开启考试。" }
  };
}

function openExamSnapshot(worldState) {
  const nextExam = buildExamCalendarView(worldState).nextExam;
  if (!nextExam?.isOpen) return null;
  return {
    level: nextExam.level,
    examName: nextExam.examName,
    year: nextExam.currentYear,
    month: nextExam.currentMonth,
    dateLabel: nextExam.currentDateLabel
  };
}

function detectTimeSkipRouteInterruption({ beforeOpenExam, afterOpenExam, payload, plan, tick }) {
  if (payload.worldState?.activeExam) {
    return {
      type: "active_exam",
      label: "考试中断",
      reason: "跳时期间出现考试场景或待取题考试，服务器已停止继续快进。",
      todo: "请先完成当前考试流程，再决定是否继续跳时。",
      tickIndex: tick.index
    };
  }

  if (afterOpenExam && !beforeOpenExam) {
    return {
      type: "exam_window",
      label: "科期开场",
      reason: `${afterOpenExam.examName || "科场"}已在${afterOpenExam.dateLabel || "本旬"}开场，跳时停在此旬。`,
      todo: "若要应考，请输入赶考或报名；若暂不应考，可再输入跳时行动。",
      tickIndex: tick.index
    };
  }

  const urgentLongTerm = (payload.longTermEvents?.scheduled || []).find((event) =>
    ["disaster", "border", "court", "local_case"].includes(event.type)
  );
  if (urgentLongTerm) {
    return {
      type: urgentLongTerm.type === "border" ? "war" : urgentLongTerm.type,
      label: urgentLongTerm.title || "大势急报",
      reason: `${urgentLongTerm.title || "大势急报"}已成跨月议题，跳时停在本旬待玩家裁量。`,
      todo: "请先查看世界议程或输入处置方向，再决定是否继续跳时。",
      tickIndex: tick.index
    };
  }

  const officialUrgentCount = payload.officialCareerView?.assignmentSummary?.urgentCount || 0;
  if (officialUrgentCount > 0 && plan.actionType !== "official_routine") {
    return {
      type: "urgent_assignment",
      label: "署中急件",
      reason: "本署已有临近期限的差事，跳时停在本旬。",
      todo: "请先处理急件，或明确输入照旧办差类跳时。",
      tickIndex: tick.index
    };
  }

  return null;
}

function aggregatePayloadList(payloads, key, limit = 40) {
  return payloads.flatMap((payload) => Array.isArray(payload[key]) ? payload[key] : []).slice(-limit);
}

function mergeTimeSkipPayloads(lastPayload, tickResults, timeSkip) {
  const payloads = tickResults.map((result) => result.payload).filter(Boolean);
  return {
    ...lastPayload,
    narrative: timeSkip.summary,
    timeSkip,
    attributeChanges: aggregatePayloadList(payloads, "attributeChanges", 40),
    relationshipChanges: aggregatePayloadList(payloads, "relationshipChanges", 40),
    activeNpcRequestEvents: aggregatePayloadList(payloads, "activeNpcRequestEvents", 20),
    worldEntityImpacts: aggregatePayloadList(payloads, "worldEntityImpacts", 30)
  };
}

function buildTimeSkipBlockedPayload(worldState, plan, validation, route) {
  const timeSkip = buildTimeSkipSummary({
    executed: false,
    blocked: true,
    plan,
    validation,
    requestedTicks: Number(plan?.ticks) || 0,
    completedTicks: 0,
    tickResults: []
  }, {}, { route });
  return {
    sessionId: worldState.sessionId,
    narrative: timeSkip.summary,
    attributeChanges: [],
    relationshipChanges: [],
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: [],
    worldEntityImpacts: [],
    roleWorldCoupling: emptySystemFeedback(),
    longTermEvents: {
      ...emptySystemFeedback(),
      scheduled: [],
      resolved: []
    },
    officialCareer: emptySystemFeedback(),
    playerMonthlyBriefing: {
      generated: false,
      summary: "",
      events: [],
      reportId: null
    },
    timeSkip,
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: "跳时计划未执行。"
    },
    worldTick: null,
    worldState: buildClientWorldState(worldState)
  };
}

async function processTimeSkipTurn(worldState, input, options = {}) {
  const { context = null, intent = null } = options;
  const { routePolicy } = resolveAiSettingsForSession(worldState);
  const route = resolveModelForTask("time_skip_planner", routePolicy);
  const startedAt = Date.now();
  const plan = buildTimeSkipPlan(input, { routePolicy }, { worldState, intent });
  const validation = validateTimeSkipPlan(plan, worldState);

  recordAiInvocation(worldState, {
    taskType: "time_skip_planner",
    route,
    status: validation.ok ? "completed" : "rejected",
    durationMs: Date.now() - startedAt,
    maxOutputTokens: route.maxOutputTokens
  });

  if (!validation.ok) {
    return buildTimeSkipBlockedPayload(worldState, plan, validation, route);
  }

  const plannerProvider = { auditName: "time_skip_planner" };
  const results = await runTimeSkipTicks(worldState, plan, {
    async runTick({ tick }) {
      const beforeOpenExam = openExamSnapshot(worldState);
      const syntheticResult = buildTimeSkipSyntheticResult(worldState, plan, tick);
      const payload = await finalizeTurn(worldState, syntheticResult, tick.input, {
        context,
        provider: plannerProvider
      });
      const afterOpenExam = openExamSnapshot(worldState);
      return {
        payload,
        interruption: detectTimeSkipRouteInterruption({
          beforeOpenExam,
          afterOpenExam,
          payload,
          plan,
          tick
        })
      };
    }
  });
  const timeSkip = buildTimeSkipSummary(results, {}, { route });
  const lastPayload = results.tickResults.at(-1)?.payload || buildTimeSkipBlockedPayload(worldState, plan, validation, route);
  return mergeTimeSkipPayloads(lastPayload, results.tickResults, timeSkip);
}

async function finalizeExamSceneTurn(worldState, input, context = null) {
  const scene = advanceExamScenePhase(worldState.activeExam, worldState, input);
  advanceExamProcedurePhase(worldState.activeExam);
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureStudyProfileState(worldState);
  ensureExamHonorLedgerState(worldState);
  ensureAppointmentTrackState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  ensurePlayerMonthlyBriefingState(worldState);
  ensureActorMemoryLedgerState(worldState);
  ensureSessionSummaryState(worldState);
  const worldTick = buildExamSceneFeedback(worldState, scene.sceneTime, scene.event);
  enqueueAuditRecords(context, createExamProgressAuditRecords(worldState, scene));

  return {
    sessionId: worldState.sessionId,
    narrative: scene.narrative,
    attributeChanges: [],
    relationshipChanges: [],
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: [],
    worldEntityImpacts: [],
    roleWorldCoupling: emptySystemFeedback(),
    longTermEvents: {
      ...emptySystemFeedback(),
      scheduled: [],
      resolved: []
    },
    officialCareer: emptySystemFeedback(),
    examTrigger: {
      shouldStart: false,
      level: worldState.activeExam?.level || null,
      reason: "当前正在考试场景中，本次行动只推进科场局部阶段。"
    },
    examScene: scene.sceneTime,
    worldTick,
    worldState: buildClientWorldState(worldState)
  };
}

async function finalizeTurn(worldState, result, input, auditOptions = {}) {
  const { context = null, provider = null } = auditOptions;
  const providerAttributeChanges = Array.isArray(result.attributeChanges) ? result.attributeChanges : [];

  // All model-suggested state changes pass through server-side boundaries.
  const providerStateBefore = JSON.parse(JSON.stringify(worldState));
  applyStatePatch(worldState, result.statePatch);
  const providerStateAfter = JSON.parse(JSON.stringify(worldState));
  const worldPeopleBefore = snapshotWorldPeopleForEvents(worldState);
  const relationshipChanges = applyRelationshipChanges(worldState, result.relationshipChanges);
  const examTrigger = applyExamTrigger(worldState, result.examTrigger);
  const studyProfile = applyStudyAction(worldState, input, result, {
    playerBefore: providerStateBefore.player
  });
  const teacherFeedbackProposal = applyTeacherFeedbackProposal(worldState, result.teacherFeedbackProposal);
  const studyInteraction = runStudyInteractionStep(worldState, input, {
    previousSponsorshipScore: providerStateBefore.studyProfile?.academyNetwork?.sponsorship?.score ?? null
  });

  const activeNpcRequest = runActiveNpcRequestStep(worldState, input);

  const roleWorldCoupling = runRoleWorldCouplingStep(worldState, input);
  applyStatePatch(worldState, roleWorldCoupling.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const roleWorldCouplingRelationshipChanges = applyRelationshipChanges(
    worldState,
    roleWorldCoupling.relationshipChanges
  );

  const beforeWorldTickState = JSON.parse(JSON.stringify(worldState));
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  const longTermEvents = worldTick.completedMonth
    ? runLongTermEventStep(worldState)
    : {
      statePatch: {},
      attributeChanges: [],
      relationshipChanges: [],
      events: [],
      scheduled: [],
      resolved: [],
      summary: ""
    };
  applyStatePatch(worldState, longTermEvents.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const longTermRelationshipChanges = applyRelationshipChanges(worldState, longTermEvents.relationshipChanges);

  const officialCareer = runOfficialCareerStep(worldState, input, {
    isMonthEnd: worldTick.completedMonth
  });
  applyStatePatch(worldState, officialCareer.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const officialCareerRelationshipChanges = applyRelationshipChanges(worldState, officialCareer.relationshipChanges);
  const worldPeopleLifecycle = runWorldPeopleLifecycleStep(worldState, {
    isMonthEnd: worldTick.completedMonth,
    worldTick,
    longTermEvents,
    officialCareer
  });
  const playerMonthlyBriefing = runPlayerMonthlyBriefingStep(worldState, {
    previousState: beforeWorldTickState,
    worldTick,
    officialCareer
  });
  if (playerMonthlyBriefing.generated) {
    const { routePolicy: briefingRoutePolicy } = resolveAiSettingsForSession(worldState);
    const monthlyRoute = resolveModelForTask("monthly_briefing", briefingRoutePolicy);
    recordAiInvocation(worldState, {
      taskType: "monthly_briefing",
      route: monthlyRoute,
      status: "completed",
      durationMs: playerMonthlyBriefing.durationMs,
      maxOutputTokens: monthlyRoute.maxOutputTokens
    });
  }

  const allRelationshipChanges = [
    ...relationshipChanges,
    ...studyInteraction.relationshipChanges,
    ...activeNpcRequest.relationshipChanges,
    ...roleWorldCouplingRelationshipChanges,
    ...longTermRelationshipChanges,
    ...officialCareerRelationshipChanges
  ];
  const actorMemoryDecay = worldTick.completedMonth
    ? decayActorMemoryLedger(worldState, { months: 1 })
    : { decayed: 0, removed: 0 };
  const actorMemoryAuditContext = { actorMemoryRecords: [] };
  const actorMemory = applyTurnActorMemoryUpdates(worldState, {
    providerMemoryProposals: result.memoryProposals,
    providerMemoryProposalRejections: result.memoryProposalRejections,
    relationshipChanges: allRelationshipChanges,
    activeNpcRequest,
    playerMonthlyBriefing,
    npcMemory: { includeBackground: true }
  }, actorMemoryAuditContext);
  const sessionSummary = updateMonthlySessionSummary(worldState, {
    worldTick,
    playerMonthlyBriefing,
    officialCareer,
    longTermEvents,
    relationshipChanges: allRelationshipChanges
  }, null);
  if (sessionSummary.updated) {
    const { routePolicy: memoryRoutePolicy } = resolveAiSettingsForSession(worldState);
    const memoryRoute = resolveModelForTask("memory_summarizer", memoryRoutePolicy);
    recordAiInvocation(worldState, {
      taskType: "memory_summarizer",
      route: memoryRoute,
      status: "completed",
      durationMs: sessionSummary.durationMs,
      maxOutputTokens: memoryRoute.maxOutputTokens
    });
  }
  const worldEntityInfluences = deriveWorldEntityInfluences(worldState, {
    stateDeltas: [{
      before: providerStateBefore,
      after: providerStateAfter,
      sourceType: "provider_state",
      reason: "AI 叙事落到服务器允许的世界指标"
    }],
    relationshipChanges: allRelationshipChanges,
    activeNpcRequest,
    roleWorldCoupling,
    worldTick,
    longTermEvents,
    officialCareer
  });
  const worldEntityImpacts = applyWorldEntityInfluences(worldState, worldEntityInfluences);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  const worldPeopleEvents = buildWorldPeopleEventBatch(worldState, {
    previousPeople: worldPeopleBefore,
    activeNpcRequest
  });

  appendEvents(worldState, result.events);
  appendEvents(worldState, studyProfile.events);
  appendEvents(worldState, studyInteraction.events);
  appendEvents(worldState, activeNpcRequest.events);
  appendEvents(worldState, roleWorldCoupling.events);
  appendEvents(worldState, worldTick.events);
  appendEvents(worldState, longTermEvents.events);
  appendEvents(worldState, officialCareer.events);
  appendEvents(worldState, worldPeopleLifecycle.events);
  appendEvents(worldState, playerMonthlyBriefing.events);
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureStudyProfileState(worldState);
  ensureExamHonorLedgerState(worldState);
  ensureAppointmentTrackState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  ensurePlayerMonthlyBriefingState(worldState);
  ensureActorMemoryLedgerState(worldState);
  ensureSessionSummaryState(worldState);

  const worldTickFeedback = {
    cadence: worldTick.cadence,
    label: worldTick.label,
    completedMonth: worldTick.completedMonth,
    timeAdvance: worldTick.timeAdvance,
    summary: worldTick.summary,
    events: Array.isArray(worldTick.events) ? worldTick.events : [],
    attributeChanges: Array.isArray(worldTick.attributeChanges) ? worldTick.attributeChanges : []
  };

  enqueueAuditRecords(context, createTurnAuditRecords({
    worldState,
    provider,
    result,
    input,
    providerStateBefore,
    providerStateAfter,
    relationshipChanges,
    examTrigger,
    activeNpcRequest,
    teacherFeedbackProposal,
    studyInteraction,
    roleWorldCoupling,
    worldTick,
    longTermEvents,
    officialCareer,
    playerMonthlyBriefing,
    actorMemory: {
      summary: actorMemory.appliedCount
        ? `本旬写入${actorMemory.appliedCount}条可见记忆，强化${actorMemory.reinforcedCount}条。`
        : actorMemory.rejectedCount
          ? `本旬拒绝${actorMemory.rejectedCount}条越权或不可见记忆提案。`
          : "",
      events: [],
      attributeChanges: [],
      outcome: {
        appliedCount: actorMemory.appliedCount,
        reinforcedCount: actorMemory.reinforcedCount,
        rejectedCount: actorMemory.rejectedCount,
        rejectedReasons: actorMemory.rejectedReasons,
        decayed: actorMemoryDecay.decayed,
        removed: actorMemoryDecay.removed
      }
    },
    sessionSummary: {
      summary: sessionSummary.updated ? sessionSummary.summary?.publicSummary : "",
      events: [],
      attributeChanges: [],
      outcome: {
        updated: sessionSummary.updated,
        reason: sessionSummary.reason,
        summaryId: sessionSummary.summary?.id || null
      }
    },
    worldEntityImpacts,
    worldPeopleAuditEvents: worldPeopleEvents.auditEvents
  }));
  appendPeopleEventLinks(context, worldPeopleEvents.rowEventLinks);

  return {
    sessionId: worldState.sessionId,
    narrative: result.narrative,
    attributeChanges: [
      ...providerAttributeChanges,
      ...studyProfile.attributeChanges,
      ...(teacherFeedbackProposal.accepted ? [{
        path: "studyProfile.teacherFeedback",
        label: "老师点评",
        before: null,
        after: teacherFeedbackProposal.feedback?.focus || "老师点评",
        reason: "AI 老师 proposal 经服务器采纳为文本点评"
      }] : []),
      ...studyInteraction.attributeChanges,
      ...roleWorldCoupling.attributeChanges,
      ...worldTickFeedback.attributeChanges,
      ...longTermEvents.attributeChanges,
      ...officialCareer.attributeChanges
    ],
    relationshipChanges: allRelationshipChanges,
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: activeNpcRequest.events,
    worldEntityImpacts,
    roleWorldCoupling: {
      summary: roleWorldCoupling.summary,
      events: Array.isArray(roleWorldCoupling.events) ? roleWorldCoupling.events : [],
      attributeChanges: Array.isArray(roleWorldCoupling.attributeChanges) ? roleWorldCoupling.attributeChanges : [],
      outcome: roleWorldCoupling.outcome
    },
    longTermEvents: {
      summary: longTermEvents.summary,
      events: Array.isArray(longTermEvents.events) ? longTermEvents.events : [],
      attributeChanges: Array.isArray(longTermEvents.attributeChanges) ? longTermEvents.attributeChanges : [],
      scheduled: Array.isArray(longTermEvents.scheduled) ? longTermEvents.scheduled : [],
      resolved: Array.isArray(longTermEvents.resolved) ? longTermEvents.resolved : []
    },
    officialCareer: {
      summary: officialCareer.summary,
      events: Array.isArray(officialCareer.events) ? officialCareer.events : [],
      attributeChanges: Array.isArray(officialCareer.attributeChanges) ? officialCareer.attributeChanges : [],
      outcome: officialCareer.outcome
    },
    playerMonthlyBriefing: {
      generated: Boolean(playerMonthlyBriefing.generated),
      summary: playerMonthlyBriefing.summary || "",
      events: Array.isArray(playerMonthlyBriefing.events) ? playerMonthlyBriefing.events : [],
      reportId: playerMonthlyBriefing.reportId || null
    },
    actorMemory: {
      appliedCount: actorMemory.appliedCount,
      reinforcedCount: actorMemory.reinforcedCount,
      rejectedCount: actorMemory.rejectedCount,
      rejectedReasons: actorMemory.rejectedReasons,
      decayed: actorMemoryDecay.decayed,
      removed: actorMemoryDecay.removed
    },
    sessionSummary: {
      updated: sessionSummary.updated,
      reason: sessionSummary.reason,
      summaryId: sessionSummary.summary?.id || null,
      publicSummary: sessionSummary.summary?.publicSummary || ""
    },
    examTrigger,
    worldTick: worldTickFeedback,
    worldState: buildClientWorldState(worldState)
  };
}

async function streamTurn(res, sessionId, input) {
  writeSseHeaders(res);
  sendSseEvent(res, "state_preview", { sessionId, status: "accepted" });
  let streamedNarrative = false;
  const narrativeExtractor = createJsonStringFieldExtractor("narrative", (text) => {
    streamedNarrative = true;
    sendSseEvent(res, "narrative_chunk", { text });
  });

  try {
    let payload;
    try {
      payload = await processStreamingTurn(sessionId, input, {
        onTextDelta(delta) {
          narrativeExtractor.push(delta);
        }
      });
    } catch (error) {
      if (streamedNarrative) {
        throw error;
      }
      payload = await processTurn(sessionId, input);
    }

    if (!streamedNarrative) {
      for (const chunk of chunkTextForSse(payload.narrative)) {
        sendSseEvent(res, "narrative_chunk", { text: chunk });
      }
    }

    sendSseEvent(res, "state_preview", {
      sessionId: payload.sessionId,
      attributeChanges: payload.attributeChanges,
      relationshipChanges: payload.relationshipChanges,
      aiSettingsView: payload.aiSettingsView,
      aiInvocationSummaryView: payload.aiInvocationSummaryView,
      examCalendarView: payload.examCalendarView,
      examRivalView: payload.examRivalView,
      examProcedureView: payload.examProcedureView,
      examinerPanelView: payload.examinerPanelView,
      examHonorView: payload.examHonorView,
      appointmentTrackView: payload.appointmentTrackView,
      studyProfileView: payload.studyProfileView,
      activeNpcRequestView: payload.activeNpcRequestView,
      activeNpcRequestEvents: payload.activeNpcRequestEvents,
      roleWorldCouplingView: payload.roleWorldCouplingView,
      worldGeographyView: payload.worldGeographyView,
      worldEntityView: payload.worldEntityView,
      worldEntityImpacts: payload.worldEntityImpacts,
      worldPeopleView: payload.worldPeopleView,
      worldThreadView: payload.worldThreadView,
      roleWorldCoupling: payload.roleWorldCoupling,
      longTermEventView: payload.longTermEventView,
      longTermEvents: payload.longTermEvents,
      officialCareerView: payload.officialCareerView,
      officialPostingsView: payload.officialPostingsView,
      localAffairsDocketView: payload.localAffairsDocketView,
      militaryDiplomacyView: payload.militaryDiplomacyView,
      economicFiscalView: payload.economicFiscalView,
      mapContextView: payload.mapContextView,
      historicalEventArchiveView: payload.historicalEventArchiveView,
      intelligenceRumorView: payload.intelligenceRumorView,
      playerMonthlyBriefingView: payload.playerMonthlyBriefingView,
      actorMemoryView: payload.actorMemoryView,
      sessionSummaryView: payload.sessionSummaryView,
      eventArchiveView: payload.eventArchiveView,
      informationPanelPageView: payload.informationPanelPageView,
      officialCareer: payload.officialCareer,
      playerMonthlyBriefing: payload.playerMonthlyBriefing,
      actorMemory: payload.actorMemory,
      sessionSummary: payload.sessionSummary,
      timeSkip: payload.timeSkip || null,
      examTrigger: payload.examTrigger,
      examScene: payload.examScene || null,
      worldTick: payload.worldTick
    });
    sendSseEvent(res, "final_state", payload);
  } catch (error) {
    sendSseEvent(res, "error", {
      error: redactSecrets(error.message || "Internal server error"),
      statusCode: error.statusCode || 500
    });
  } finally {
    closeSse(res);
  }
}

router.post("/start", async (req, res, next) => {
  try {
    const worldState = createInitialState(req.body);
    const aiSettingsPatch = req.body?.aiSettings;
    const aiRuntime = aiSettingsPatch && typeof aiSettingsPatch === "object"
      ? updateAiSettings(worldState, aiSettingsPatch)
      : resolveAiSettingsForSession(worldState);
    const route = resolveModelForTask("narrator", aiRuntime.routePolicy);
    const provider = getProvider({ routePolicy: aiRuntime.routePolicy });
    const startedAt = Date.now();
    const opening = await provider.startGame(worldState);
    recordAiInvocation(worldState, {
      taskType: "narrator",
      route,
      status: "completed",
      durationMs: Date.now() - startedAt,
      maxOutputTokens: route.maxOutputTokens
    });

    worldState.eventHistory.push(...opening.events);
    await writeSession(worldState, createOpeningAuditRecords(worldState, opening, provider));

    res.status(201).json({
      sessionId: worldState.sessionId,
      worldState: buildClientWorldState(worldState),
      ...buildCommonTurnViews(worldState),
      narrative: opening.narrative
    });
  } catch (error) {
    if (!error.statusCode && isAiSettingsValidationError(error)) {
      error.statusCode = 400;
    }
    next(error);
  }
});

router.get("/state/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json({
      sessionId: worldState.sessionId,
      worldState: buildClientWorldState(worldState),
      ...buildCommonTurnViews(worldState, {
        eventArchive: eventArchiveOptionsFromQuery(req.query),
        informationPanel: informationPanelOptionsFromQuery(req.query)
      })
    });
  } catch (error) {
    next(error);
  }
});

router.get("/player-state/:sessionId", async (req, res, next) => {
  try {
    const adapter = getSessionStorageAdapter();
    const { record } = await adapter.readSessionRecord(req.params.sessionId);
    ensureRouteProjectionState(record.worldState);
    const routeViews = redactPlayerRouteViews(buildCommonTurnViews(record.worldState, {
      eventArchive: eventArchiveOptionsFromQuery(req.query),
      informationPanel: informationPanelOptionsFromQuery(req.query)
    }));
    res.json({
      ...buildPlayerStateEnvelope(record),
      ...routeViews
    });
  } catch (error) {
    next(error);
  }
});

router.get("/search/:sessionId", async (req, res, next) => {
  try {
    const options = safeSearchOptionsFromQuery(req.query);
    const adapter = getSessionStorageAdapter();
    if (typeof adapter.searchSafeSearchIndex === "function") {
      res.json({
        sessionId: req.params.sessionId,
        safeWorldSearchView: await adapter.searchSafeSearchIndex(req.params.sessionId, options)
      });
      return;
    }

    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json({
      sessionId: worldState.sessionId,
      safeWorldSearchView: searchSafeWorldIndex(worldState, options)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/saves", async (req, res, next) => {
  try {
    res.json(await listSessions());
  } catch (error) {
    next(error);
  }
});

router.post("/turn", async (req, res, next) => {
  try {
    const { sessionId, input } = validateTurnInput(req.body);

    if (wantsSse(req)) {
      await streamTurn(res, sessionId, input);
      return;
    }

    res.json(await processTurn(sessionId, input));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
