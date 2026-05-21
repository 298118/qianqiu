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
  buildOfficialCourtConsequenceView,
  ensureOfficialCourtConsequenceState,
  runOfficialCourtConsequenceStep
} = require("../game/officialCourtConsequences");
const {
  buildOfficialCourtResponseView,
  ensureOfficialCourtResponseState,
  runOfficialCourtResponseStep
} = require("../game/officialCourtResponse");
const { buildDomainConsequenceView } = require("../game/domainConsequenceTrace");
const {
  buildOfficialPostingsView,
  ensureOfficialPostingsState
} = require("../game/officialPostings");
const {
  buildRoleWorldCouplingView,
  ensureRoleWorldCouplingState,
  runRoleWorldCouplingStep
} = require("../game/roleWorldCoupling");
const { runRoleCycleDomainAdjudicationStep } = require("../game/roleCycleDomainAdjudication");
const { buildRoleCycleView } = require("../game/roleCycleView");
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
const { buildMapRuntimeView } = require("../game/mapRuntimeView");
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
const { buildLatestExamAftermathView } = require("../game/examAftermath");
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
  updateAiSettings,
  validateAiSettingsPatch
} = require("../game/aiSettings");
const { buildAiControlAuditView } = require("../game/aiControlAudit");
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
const {
  buildAssetLedgerView,
  buildResourceLedgerView,
  ensureAssetLedgerState
} = require("../game/assetLedger");
const {
  buildInventoryView,
  ensureInventoryLedgerState,
  transferItem,
  writeInventoryLedgerState
} = require("../game/inventoryLedger");
const {
  buildNpcDetailView,
  buildNpcRosterView,
  ensureNpcRoster
} = require("../game/npcRoster");
const {
  attachRelationshipActionEligibilityToDetail,
  resolveNpcRelationshipAction,
  NPC_RELATIONSHIP_ACTION_TYPES
} = require("../game/npcRelationshipActions");
const {
  buildNpcActiveRequestView,
  buildNpcPrivatePlannerContext,
  ensureNpcActiveRequestLedgerState,
  runNpcActiveRequestStep,
  sanitizeNpcPrivateIntentProposal
} = require("../game/npcActiveRequests");
const {
  buildDelegatedTaskLedgerView,
  createDelegatedTask,
  createLandSurveyDelegatedTask,
  ensureDelegatedTaskLedger,
  sanitizeDelegatedTaskPlan,
  validateDelegatedTaskRequest
} = require("../game/delegatedTasks");
const {
  buildBackgroundClaimParserContext,
  adjudicateOpeningBackgroundClaims,
  buildOpeningBackgroundClaimsView,
  ensureOpeningBackgroundClaimsState
} = require("../game/openingBackgroundClaims");
const {
  buildNpcDialogueContext,
  buildNpcInteractionLedgerView,
  ensureNpcInteractionLedger,
  recordNpcInteraction,
  validateNpcInteractionRequest
} = require("../game/npcInteractions");
const {
  buildTradeLedgerView,
  buildTradeNegotiationContext,
  ensureTradeLedger,
  resolveTradeRequest,
  validateTradeRequest
} = require("../game/tradeLedger");
const {
  buildMarketPriceView,
  buildNpcEconomyView,
  ensureMarketPriceLedgerState,
  ensureNpcEconomyLedgerState,
  runNpcEconomyTickStep
} = require("../game/npcEconomy");
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
const { buildTopicSurfaceView } = require("../game/topicSurfaceView");
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
const {
  defineCommonTurnViews,
  defineGameStartResponse,
  defineGameStateResponse,
  defineGameTurnResponse,
  defineGameTurnSseStatePreviewResponse,
  defineInventoryResponse,
  defineInventoryTransferResponse,
  defineNpcCommandResponse,
  defineNpcDetailResponse,
  defineNpcInteractionResponse,
  defineNpcListResponse,
  definePlayerStateResponse,
  defineSafeWorldSearchResponse,
  defineSavesResponse,
  defineTopicSurfaceResponse,
  defineTradeResponse
} = require("./routeResponses");

const router = express.Router();

function isAiSettingsValidationError(error) {
  return /AI 设置|AI 路由|不支持字段|禁止|hidden|raw|server|provider|model|任务|服务器维护/.test(error.message || "");
}

function createRouteError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
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
    ensureAssetLedgerState(worldState);
    ensureInventoryLedgerState(worldState);
    ensureNpcRoster(worldState);
    ensureDelegatedTaskLedger(worldState);
    ensureNpcInteractionLedger(worldState);
    ensureTradeLedger(worldState);
    ensureMarketPriceLedgerState(worldState);
    ensureNpcEconomyLedgerState(worldState);
    ensureOpeningBackgroundClaimsState(worldState);
    const timeSkipIntent = detectTimeSkipIntent(input, { worldState });
    if (timeSkipIntent?.detected) {
      return processTimeSkipTurn(worldState, input, { context, intent: timeSkipIntent });
    }
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
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
    ensureAssetLedgerState(worldState);
    ensureInventoryLedgerState(worldState);
    ensureNpcRoster(worldState);
    ensureDelegatedTaskLedger(worldState);
    ensureNpcInteractionLedger(worldState);
    ensureTradeLedger(worldState);
    ensureMarketPriceLedgerState(worldState);
    ensureNpcEconomyLedgerState(worldState);
    ensureOpeningBackgroundClaimsState(worldState);
    const timeSkipIntent = detectTimeSkipIntent(input, { worldState });
    if (timeSkipIntent?.detected) {
      return processTimeSkipTurn(worldState, input, { context, intent: timeSkipIntent });
    }
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
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
  if (!activeExam || activeExam.status === "completed") return false;
  return Boolean(activeExam.examQuestion || activeExam.sceneTime || activeExam.scenePhase || activeExam.status === "writing");
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
  ensureOfficialCourtConsequenceState(worldState);
  ensureOfficialCourtResponseState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  ensurePlayerMonthlyBriefingState(worldState);
  ensureActorMemoryLedgerState(worldState);
  ensureSessionSummaryState(worldState);
  ensureAssetLedgerState(worldState);
  ensureInventoryLedgerState(worldState);
  ensureNpcRoster(worldState);
  ensureDelegatedTaskLedger(worldState);
  ensureNpcInteractionLedger(worldState);
  ensureTradeLedger(worldState);
  ensureMarketPriceLedgerState(worldState);
  ensureNpcEconomyLedgerState(worldState);
  ensureNpcActiveRequestLedgerState(worldState);
  ensureOpeningBackgroundClaimsState(worldState);
}

function buildCommonTurnViews(worldState, options = {}) {
  const worldGeographyView = buildWorldGeographyView(worldState);
  const worldPeopleView = buildWorldPeopleView(worldState);
  const officialPostingsView = buildOfficialPostingsView(worldState);
  const mapContextView = buildMapContextView(worldState);
  const domainConsequenceView = buildDomainConsequenceView(worldState);
  const { settings, routePolicy } = resolveAiSettingsForSession(worldState);
  const aiInvocationSummaryView = buildAiInvocationSummaryView(worldState, routePolicy);
  return defineCommonTurnViews({
    aiSettingsView: redactAiSettingsForClient({ ...settings, routePolicy }),
    aiInvocationSummaryView,
    aiControlAuditView: buildAiControlAuditView(worldState, {
      routePolicy,
      aiInvocationSummaryView
    }),
    examCalendarView: buildExamCalendarView(worldState),
    examRivalView: buildExamRivalView(worldState),
    examProcedureView: buildExamProcedureView(worldState),
    examinerPanelView: buildExaminerPanelView(worldState.player?.examHistory?.at?.(-1)?.examinerPanel),
    examHonorView: buildExamHonorView(worldState),
    examAftermathView: buildLatestExamAftermathView(worldState),
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
    courtConsequenceView: buildOfficialCourtConsequenceView(worldState),
    courtResponseView: buildOfficialCourtResponseView(worldState),
    domainConsequenceView,
    officialPostingsView,
    localAffairsDocketView: buildLocalAffairsDocketView(worldState),
    militaryDiplomacyView: buildMilitaryDiplomacyView(worldState),
    economicFiscalView: buildEconomicFiscalView(worldState),
    mapContextView,
    mapRuntimeView: buildMapRuntimeView(worldState, { mapContextView, domainConsequenceView }),
    historicalEventArchiveView: buildHistoricalEventArchiveView(worldState),
    intelligenceRumorView: buildIntelligenceRumorView(worldState),
    playerMonthlyBriefingView: buildPlayerMonthlyBriefingView(worldState),
    actorMemoryView: buildActorMemoryView(worldState),
    sessionSummaryView: buildSessionSummaryView(worldState),
    openingBackgroundClaimsView: buildOpeningBackgroundClaimsView(worldState),
    assetLedgerView: buildAssetLedgerView(worldState, {
      viewerActorId: worldState.player?.id || "player",
      includeRoleLimited: true
    }),
    resourceLedgerView: buildResourceLedgerView(worldState, {
      viewerActorId: worldState.player?.id || "player"
    }),
    inventoryView: buildInventoryView(worldState, {
      viewerActorId: worldState.player?.id || "player",
      includeRoleLimited: true
    }),
    npcRosterView: buildNpcRosterView(worldState),
    npcInteractionView: buildNpcInteractionLedgerView(worldState),
    tradeLedgerView: buildTradeLedgerView(worldState),
    delegatedTaskView: buildDelegatedTaskLedgerView(worldState),
    marketPriceView: buildMarketPriceView(worldState),
    npcEconomyView: buildNpcEconomyView(worldState),
    npcActiveRequestView: buildNpcActiveRequestView(worldState),
    roleCycleView: buildRoleCycleView(worldState),
    eventArchiveView: buildEventArchiveView(worldState, options.eventArchive),
    informationPanelPageView: buildInformationPanelPageViews(worldState, options.informationPanel || {}, {
      worldGeographyView,
      worldPeopleView,
      officialPostingsView
    })
  });
}

async function runNpcPrivatePlannerForTurn(worldState, routePolicy) {
  const roster = ensureNpcRoster(worldState);
  const candidate = roster.npcs.find((npc) => npc.tier === "active") || roster.npcs[0];
  const context = candidate ? buildNpcPrivatePlannerContext(worldState, candidate.npcId) : null;
  if (!context) return null;

  const route = resolveModelForTask("npc_private_planner", routePolicy);
  const provider = getProvider({ routePolicy });
  const startedAt = Date.now();
  try {
    const rawProposal = await provider.planNpcPrivateIntent(context);
    recordAiInvocation(worldState, {
      taskType: "npc_private_planner",
      route,
      status: "completed",
      durationMs: Date.now() - startedAt,
      maxOutputTokens: route.maxOutputTokens
    });
    const proposal = sanitizeNpcPrivateIntentProposal(rawProposal, { npcId: context.npcId });
    return proposal.ok ? proposal : null;
  } catch (error) {
    recordAiInvocation(worldState, {
      taskType: "npc_private_planner",
      route,
      status: "failed",
      durationMs: Date.now() - startedAt,
      maxOutputTokens: route.maxOutputTokens
    });
    return null;
  }
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
  return defineGameTurnResponse({
    ...lastPayload,
    narrative: timeSkip.summary,
    timeSkip,
    attributeChanges: aggregatePayloadList(payloads, "attributeChanges", 40),
    relationshipChanges: aggregatePayloadList(payloads, "relationshipChanges", 40),
    activeNpcRequestEvents: aggregatePayloadList(payloads, "activeNpcRequestEvents", 20),
    npcActiveRequestEvents: aggregatePayloadList(payloads, "npcActiveRequestEvents", 20),
    worldEntityImpacts: aggregatePayloadList(payloads, "worldEntityImpacts", 30)
  });
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
  return defineGameTurnResponse({
    sessionId: worldState.sessionId,
    narrative: timeSkip.summary,
    attributeChanges: [],
    relationshipChanges: [],
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: [],
    npcActiveRequestEvents: [],
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
  });
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
  ensureAssetLedgerState(worldState);
  ensureInventoryLedgerState(worldState);
  ensureNpcRoster(worldState);
  ensureDelegatedTaskLedger(worldState);
  ensureNpcInteractionLedger(worldState);
  ensureTradeLedger(worldState);
  ensureMarketPriceLedgerState(worldState);
  ensureNpcEconomyLedgerState(worldState);
  ensureNpcActiveRequestLedgerState(worldState);
  ensureOpeningBackgroundClaimsState(worldState);
  const worldTick = buildExamSceneFeedback(worldState, scene.sceneTime, scene.event);
  enqueueAuditRecords(context, createExamProgressAuditRecords(worldState, scene));

  return defineGameTurnResponse({
    sessionId: worldState.sessionId,
    narrative: scene.narrative,
    attributeChanges: [],
    relationshipChanges: [],
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: [],
    npcActiveRequestEvents: [],
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
  });
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
  const officialCourtResponse = runOfficialCourtResponseStep(worldState, input);
  applyStatePatch(worldState, officialCourtResponse.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  const roleWorldCoupling = runRoleWorldCouplingStep(worldState, input);
  applyStatePatch(worldState, roleWorldCoupling.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const roleWorldCouplingRelationshipChanges = applyRelationshipChanges(
    worldState,
    roleWorldCoupling.relationshipChanges
  );
  const roleCycleDomainAdjudication = runRoleCycleDomainAdjudicationStep(worldState, input);

  const beforeWorldTickState = JSON.parse(JSON.stringify(worldState));
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const npcEconomy = runNpcEconomyTickStep(worldState, {
    worldTick,
    previousState: beforeWorldTickState,
    input
  });
  const { routePolicy: npcPrivateRoutePolicy } = resolveAiSettingsForSession(worldState);
  const npcPrivateProposal = await runNpcPrivatePlannerForTurn(worldState, npcPrivateRoutePolicy);
  const npcActiveRequests = runNpcActiveRequestStep(worldState, input, {
    aiProposal: npcPrivateProposal
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
  const officialCourtConsequence = runOfficialCourtConsequenceStep(worldState, input, {
    isMonthEnd: worldTick.completedMonth
  });
  applyStatePatch(worldState, officialCourtConsequence.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
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
    ...(Array.isArray(officialCourtResponse.relationshipChanges) ? officialCourtResponse.relationshipChanges : []),
    ...(Array.isArray(officialCourtConsequence.relationshipChanges) ? officialCourtConsequence.relationshipChanges : []),
    ...(Array.isArray(npcActiveRequests.relationshipChanges) ? npcActiveRequests.relationshipChanges : []),
    ...roleWorldCouplingRelationshipChanges,
    ...(Array.isArray(npcEconomy.relationshipChanges) ? npcEconomy.relationshipChanges : []),
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
    npcActiveRequests,
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
  appendEvents(worldState, officialCourtResponse.events);
  appendEvents(worldState, npcActiveRequests.events);
  appendEvents(worldState, roleWorldCoupling.events);
  appendEvents(worldState, worldTick.events);
  appendEvents(worldState, longTermEvents.events);
  appendEvents(worldState, officialCareer.events);
  appendEvents(worldState, officialCourtConsequence.events);
  appendEvents(worldState, worldPeopleLifecycle.events);
  appendEvents(worldState, playerMonthlyBriefing.events);
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureStudyProfileState(worldState);
  ensureExamHonorLedgerState(worldState);
  ensureAppointmentTrackState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureOfficialCourtConsequenceState(worldState);
  ensureOfficialCourtResponseState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  ensurePlayerMonthlyBriefingState(worldState);
  ensureActorMemoryLedgerState(worldState);
  ensureSessionSummaryState(worldState);
  ensureAssetLedgerState(worldState);
  ensureInventoryLedgerState(worldState);
  ensureNpcRoster(worldState);
  ensureDelegatedTaskLedger(worldState);
  ensureNpcInteractionLedger(worldState);
  ensureTradeLedger(worldState);
  ensureMarketPriceLedgerState(worldState);
  ensureNpcEconomyLedgerState(worldState);
  ensureNpcActiveRequestLedgerState(worldState);
  ensureOpeningBackgroundClaimsState(worldState);

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
    npcActiveRequests,
    teacherFeedbackProposal,
    studyInteraction,
    officialCourtResponse,
    officialCourtConsequence,
    roleWorldCoupling,
    roleCycleDomainAdjudication,
    worldTick,
    npcEconomy,
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

  return defineGameTurnResponse({
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
      ...(Array.isArray(officialCourtConsequence.attributeChanges) ? officialCourtConsequence.attributeChanges : []),
      ...(Array.isArray(officialCourtResponse.attributeChanges) ? officialCourtResponse.attributeChanges : []),
      ...(Array.isArray(roleCycleDomainAdjudication.attributeChanges) ? roleCycleDomainAdjudication.attributeChanges : []),
      ...roleWorldCoupling.attributeChanges,
      ...worldTickFeedback.attributeChanges,
      ...(Array.isArray(npcEconomy.attributeChanges) ? npcEconomy.attributeChanges : []),
      ...(Array.isArray(npcActiveRequests.attributeChanges) ? npcActiveRequests.attributeChanges : []),
      ...longTermEvents.attributeChanges,
      ...officialCareer.attributeChanges
    ],
    relationshipChanges: allRelationshipChanges,
    ...buildCommonTurnViews(worldState),
    activeNpcRequestEvents: activeNpcRequest.events,
    officialCourtResponse: {
      schemaVersion: officialCourtResponse.schemaVersion,
      summary: officialCourtResponse.summary,
      events: Array.isArray(officialCourtResponse.events) ? officialCourtResponse.events : [],
      attributeChanges: Array.isArray(officialCourtResponse.attributeChanges) ? officialCourtResponse.attributeChanges : [],
      outcome: officialCourtResponse.outcome
    },
    officialCourtConsequence: {
      schemaVersion: officialCourtConsequence.schemaVersion,
      summary: officialCourtConsequence.summary,
      events: Array.isArray(officialCourtConsequence.events) ? officialCourtConsequence.events : [],
      attributeChanges: Array.isArray(officialCourtConsequence.attributeChanges) ? officialCourtConsequence.attributeChanges : [],
      outcome: officialCourtConsequence.outcome
    },
    npcActiveRequestEvents: npcActiveRequests.events,
    worldEntityImpacts,
    npcActiveRequests: {
      schemaVersion: npcActiveRequests.schemaVersion,
      summary: npcActiveRequests.summary,
      events: Array.isArray(npcActiveRequests.events) ? npcActiveRequests.events : [],
      attributeChanges: Array.isArray(npcActiveRequests.attributeChanges) ? npcActiveRequests.attributeChanges : [],
      outcome: npcActiveRequests.outcome
    },
    npcEconomy: {
      schemaVersion: npcEconomy.schemaVersion,
      cadence: npcEconomy.cadence,
      summary: npcEconomy.summary,
      events: Array.isArray(npcEconomy.events) ? npcEconomy.events : [],
      attributeChanges: Array.isArray(npcEconomy.attributeChanges) ? npcEconomy.attributeChanges : [],
      outcome: npcEconomy.outcome
    },
    roleWorldCoupling: {
      summary: roleWorldCoupling.summary,
      events: Array.isArray(roleWorldCoupling.events) ? roleWorldCoupling.events : [],
      attributeChanges: Array.isArray(roleWorldCoupling.attributeChanges) ? roleWorldCoupling.attributeChanges : [],
      outcome: roleWorldCoupling.outcome
    },
    roleCycleDomainAdjudication: {
      schemaVersion: roleCycleDomainAdjudication.schemaVersion,
      summary: roleCycleDomainAdjudication.summary,
      events: Array.isArray(roleCycleDomainAdjudication.events) ? roleCycleDomainAdjudication.events : [],
      attributeChanges: Array.isArray(roleCycleDomainAdjudication.attributeChanges)
        ? roleCycleDomainAdjudication.attributeChanges
        : [],
      outcome: roleCycleDomainAdjudication.outcome
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
  });
}

async function streamTurn(res, sessionId, input) {
  writeSseHeaders(res);
  sendSseEvent(res, "state_preview", defineGameTurnSseStatePreviewResponse({ sessionId, status: "accepted" }));
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

    sendSseEvent(res, "state_preview", defineGameTurnSseStatePreviewResponse({
      sessionId: payload.sessionId,
      attributeChanges: payload.attributeChanges,
      relationshipChanges: payload.relationshipChanges,
      aiSettingsView: payload.aiSettingsView,
      aiInvocationSummaryView: payload.aiInvocationSummaryView,
      aiControlAuditView: payload.aiControlAuditView,
      examCalendarView: payload.examCalendarView,
      examRivalView: payload.examRivalView,
      examProcedureView: payload.examProcedureView,
      examinerPanelView: payload.examinerPanelView,
      examHonorView: payload.examHonorView,
      appointmentTrackView: payload.appointmentTrackView,
      studyProfileView: payload.studyProfileView,
      activeNpcRequestView: payload.activeNpcRequestView,
      activeNpcRequestEvents: payload.activeNpcRequestEvents,
      npcActiveRequestView: payload.npcActiveRequestView,
      npcActiveRequestEvents: payload.npcActiveRequestEvents,
      roleWorldCouplingView: payload.roleWorldCouplingView,
      worldGeographyView: payload.worldGeographyView,
      worldEntityView: payload.worldEntityView,
      worldEntityImpacts: payload.worldEntityImpacts,
      worldPeopleView: payload.worldPeopleView,
      worldThreadView: payload.worldThreadView,
      roleWorldCoupling: payload.roleWorldCoupling,
      roleCycleDomainAdjudication: payload.roleCycleDomainAdjudication,
      longTermEventView: payload.longTermEventView,
      longTermEvents: payload.longTermEvents,
      officialCareerView: payload.officialCareerView,
      officialPostingsView: payload.officialPostingsView,
      localAffairsDocketView: payload.localAffairsDocketView,
      militaryDiplomacyView: payload.militaryDiplomacyView,
      economicFiscalView: payload.economicFiscalView,
      mapContextView: payload.mapContextView,
      mapRuntimeView: payload.mapRuntimeView,
      historicalEventArchiveView: payload.historicalEventArchiveView,
      intelligenceRumorView: payload.intelligenceRumorView,
      playerMonthlyBriefingView: payload.playerMonthlyBriefingView,
      actorMemoryView: payload.actorMemoryView,
      sessionSummaryView: payload.sessionSummaryView,
      openingBackgroundClaimsView: payload.openingBackgroundClaimsView,
      assetLedgerView: payload.assetLedgerView,
      resourceLedgerView: payload.resourceLedgerView,
      inventoryView: payload.inventoryView,
      npcRosterView: payload.npcRosterView,
      npcInteractionView: payload.npcInteractionView,
      tradeLedgerView: payload.tradeLedgerView,
      delegatedTaskView: payload.delegatedTaskView,
      marketPriceView: payload.marketPriceView,
      npcEconomyView: payload.npcEconomyView,
      npcActiveRequests: payload.npcActiveRequests,
      eventArchiveView: payload.eventArchiveView,
      informationPanelPageView: payload.informationPanelPageView,
      npcEconomy: payload.npcEconomy,
      officialCareer: payload.officialCareer,
      playerMonthlyBriefing: payload.playerMonthlyBriefing,
      actorMemory: payload.actorMemory,
      sessionSummary: payload.sessionSummary,
      timeSkip: payload.timeSkip || null,
      examTrigger: payload.examTrigger,
      examScene: payload.examScene || null,
      worldTick: payload.worldTick
    }));
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
    if (aiSettingsPatch && typeof aiSettingsPatch === "object") {
      validateAiSettingsPatch(aiSettingsPatch);
    }
    const resolvedRuntime = resolveAiSettingsForSession(worldState);
    const aiRuntime = aiSettingsPatch && typeof aiSettingsPatch === "object" && !resolvedRuntime.globalSettingsExists
      ? updateAiSettings(worldState, aiSettingsPatch)
      : resolvedRuntime;
    const backgroundRoute = resolveModelForTask("background_claim_parser", aiRuntime.routePolicy);
    const provider = getProvider({ routePolicy: aiRuntime.routePolicy });
    const backgroundStartedAt = Date.now();
    const backgroundParserPayload = await provider.parseBackgroundClaims(
      buildBackgroundClaimParserContext(req.body, worldState)
    );
    recordAiInvocation(worldState, {
      taskType: "background_claim_parser",
      route: backgroundRoute,
      status: "completed",
      durationMs: Date.now() - backgroundStartedAt,
      maxOutputTokens: backgroundRoute.maxOutputTokens
    });
    const backgroundClaims = adjudicateOpeningBackgroundClaims(worldState, backgroundParserPayload, {
      input: req.body,
      providerName: provider.auditName || provider.name || process.env.AI_PROVIDER || "mock"
    });
    if (backgroundClaims.events.length) {
      worldState.eventHistory.push(...backgroundClaims.events);
    }

    const route = resolveModelForTask("narrator", aiRuntime.routePolicy);
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
    const openingAuditRecords = createOpeningAuditRecords(worldState, opening, provider);
    await writeSession(worldState, {
      auditEvents: [
        ...(backgroundClaims.auditRecords.auditEvents || []),
        ...(openingAuditRecords.auditEvents || [])
      ],
      aiProposals: [
        ...(backgroundClaims.auditRecords.aiProposals || []),
        ...(openingAuditRecords.aiProposals || [])
      ]
    });

    res.status(201).json(defineGameStartResponse({
      sessionId: worldState.sessionId,
      worldState: buildClientWorldState(worldState),
      ...buildCommonTurnViews(worldState),
      narrative: opening.narrative
    }));
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
    res.json(defineGameStateResponse({
      sessionId: worldState.sessionId,
      worldState: buildClientWorldState(worldState),
      ...buildCommonTurnViews(worldState, {
        eventArchive: eventArchiveOptionsFromQuery(req.query),
        informationPanel: informationPanelOptionsFromQuery(req.query)
      })
    }));
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
    res.json(definePlayerStateResponse({
      ...buildPlayerStateEnvelope(record),
      ...routeViews
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/topic-surface/:sessionId/:surfaceId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json(defineTopicSurfaceResponse({
      sessionId: worldState.sessionId,
      topicSurfaceView: buildTopicSurfaceView(worldState, { surfaceId: req.params.surfaceId })
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/search/:sessionId", async (req, res, next) => {
  try {
    const options = safeSearchOptionsFromQuery(req.query);
    const adapter = getSessionStorageAdapter();
    if (typeof adapter.searchSafeSearchIndex === "function") {
      res.json(defineSafeWorldSearchResponse({
        sessionId: req.params.sessionId,
        safeWorldSearchView: await adapter.searchSafeSearchIndex(req.params.sessionId, options)
      }));
      return;
    }

    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json(defineSafeWorldSearchResponse({
      sessionId: worldState.sessionId,
      safeWorldSearchView: searchSafeWorldIndex(worldState, options)
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json(defineInventoryResponse({
      sessionId: worldState.sessionId,
      resourceLedgerView: buildResourceLedgerView(worldState, {
        viewerActorId: worldState.player?.id || "player"
      }),
      assetLedgerView: buildAssetLedgerView(worldState, {
        viewerActorId: worldState.player?.id || "player",
        includeRoleLimited: true
      }),
      inventoryView: buildInventoryView(worldState, {
        viewerActorId: worldState.player?.id || "player",
        includeRoleLimited: true
      })
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/inventory-transfer/:sessionId", async (req, res, next) => {
  try {
    const payload = await mutateSession(req.params.sessionId, async (worldState) => {
      ensureRouteProjectionState(worldState);
      const transfer = transferItem(worldState, {
        ...req.body,
        actorId: worldState.player?.id || "player",
        ownerActorId: worldState.player?.id || "player",
        turn: worldState.turnCount || 0
      });
      if (transfer.accepted) {
        writeInventoryLedgerState(worldState, transfer.ledger, {
          ownerActorId: worldState.player?.id || "player"
        });
      }
      return defineInventoryTransferResponse({
        sessionId: worldState.sessionId,
        accepted: transfer.accepted,
        reason: transfer.reason,
        fromContainerId: transfer.fromContainerId || null,
        toContainerId: transfer.toContainerId || null,
        inventoryView: buildInventoryView(worldState, {
          viewerActorId: worldState.player?.id || "player",
          includeRoleLimited: true
        })
      });
    });
    res.status(payload.accepted ? 200 : 400).json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/npcs/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    res.json(defineNpcListResponse({
      sessionId: worldState.sessionId,
      npcRosterView: buildNpcRosterView(worldState, {
        page: req.query.page,
        pageSize: req.query.pageSize,
        roleTag: req.query.roleTag || req.query.group,
        interaction: req.query.interaction
      }),
      npcInteractionView: buildNpcInteractionLedgerView(worldState),
      delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/npc/:sessionId/:npcId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRouteProjectionState(worldState);
    const npcDetailView = attachRelationshipActionEligibilityToDetail(
      worldState,
      buildNpcDetailView(worldState, req.params.npcId)
    );
    if (!npcDetailView) {
      throw createRouteError(404, "NPC not found");
    }
    res.json(defineNpcDetailResponse({
      sessionId: worldState.sessionId,
      npcDetailView,
      npcInteractionView: buildNpcInteractionLedgerView(worldState, { npcId: req.params.npcId }),
      tradeLedgerView: buildTradeLedgerView(worldState, { npcId: req.params.npcId }),
      delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/npc-interaction/:sessionId", async (req, res, next) => {
  try {
    const payload = await mutateSession(req.params.sessionId, async (worldState) => {
      ensureRouteProjectionState(worldState);
      const validation = validateNpcInteractionRequest(worldState, req.body);
      if (!validation.ok) {
        const recorded = recordNpcInteraction(worldState, req.body, {});
        return defineNpcInteractionResponse({
          sessionId: worldState.sessionId,
          accepted: false,
          errors: validation.errors,
          npcInteractionView: recorded.npcInteractionView
        });
      }

      const { routePolicy } = resolveAiSettingsForSession(worldState);
      const route = resolveModelForTask("npc_dialogue", routePolicy);
      const provider = getProvider({ routePolicy });
      const startedAt = Date.now();
      const dialogue = await provider.runNpcDialogue(buildNpcDialogueContext(worldState, req.body));
      recordAiInvocation(worldState, {
        taskType: "npc_dialogue",
        route,
        status: "completed",
        durationMs: Date.now() - startedAt,
        maxOutputTokens: route.maxOutputTokens
      });
      const relationshipAction = NPC_RELATIONSHIP_ACTION_TYPES.includes(validation.normalized.actionType)
        ? resolveNpcRelationshipAction(worldState, req.body, dialogue)
        : null;
      const recorded = recordNpcInteraction(worldState, req.body, dialogue, relationshipAction
        ? { resolutionView: relationshipAction.resolutionView }
        : {});
      const responseErrors = [
        ...recorded.errors,
        ...(relationshipAction && !relationshipAction.ok ? relationshipAction.errors : [])
      ];
      return defineNpcInteractionResponse({
        sessionId: worldState.sessionId,
        accepted: recorded.ok && (!relationshipAction || relationshipAction.ok),
        errors: responseErrors,
        npcDialogueView: {
          npcId: recorded.record.npcId,
          dialogueText: recorded.record.dialogueText,
          mood: recorded.record.mood,
          followUpSuggestions: recorded.record.followUpSuggestions || []
        },
        npcActionResolutionView: relationshipAction?.resolutionView || null,
        npcInteractionView: recorded.npcInteractionView,
        npcDetailView: attachRelationshipActionEligibilityToDetail(
          worldState,
          buildNpcDetailView(worldState, validation.normalized.npcId)
        )
      });
    });
    res.status(payload.accepted ? 200 : 400).json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/trade/:sessionId", async (req, res, next) => {
  try {
    const payload = await mutateSession(req.params.sessionId, async (worldState) => {
      ensureRouteProjectionState(worldState);
      const validation = validateTradeRequest(worldState, req.body);
      if (!validation.ok) {
        const resolved = resolveTradeRequest(worldState, req.body, {
          npcResponse: "",
          proposal: {
            status: "rejected",
            publicSummary: "交易被服务器规则挡下。",
            riskTags: []
          }
        });
        return defineTradeResponse({
          sessionId: worldState.sessionId,
          accepted: false,
          errors: resolved.errors,
          tradeRecord: resolved.record,
          tradeLedgerView: resolved.tradeLedgerView,
          resourceLedgerView: buildResourceLedgerView(worldState, {
            viewerActorId: worldState.player?.id || "player"
          }),
          inventoryView: buildInventoryView(worldState, {
            viewerActorId: worldState.player?.id || "player",
            includeRoleLimited: true
          })
        });
      }
      const { routePolicy } = resolveAiSettingsForSession(worldState);
      const route = resolveModelForTask("trade_negotiator", routePolicy);
      const provider = getProvider({ routePolicy });
      const startedAt = Date.now();
      const negotiation = await provider.negotiateTrade(buildTradeNegotiationContext(worldState, req.body));
      recordAiInvocation(worldState, {
        taskType: "trade_negotiator",
        route,
        status: "completed",
        durationMs: Date.now() - startedAt,
        maxOutputTokens: route.maxOutputTokens
      });
      const resolved = resolveTradeRequest(worldState, req.body, negotiation);
      return defineTradeResponse({
        sessionId: worldState.sessionId,
        accepted: resolved.ok,
        errors: resolved.errors,
        tradeRecord: resolved.record,
        tradeLedgerView: resolved.tradeLedgerView,
        resourceLedgerView: buildResourceLedgerView(worldState, {
          viewerActorId: worldState.player?.id || "player"
        }),
        inventoryView: buildInventoryView(worldState, {
          viewerActorId: worldState.player?.id || "player",
          includeRoleLimited: true
        })
      });
    });
    res.status(payload.accepted ? 200 : 400).json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/npc-command/:sessionId", async (req, res, next) => {
  try {
    const payload = await mutateSession(req.params.sessionId, async (worldState) => {
      ensureRouteProjectionState(worldState);
      const validation = validateDelegatedTaskRequest(worldState, {
        ...req.body,
        issuerActorId: worldState.player?.id || "player"
      });
      if (!validation.ok) {
        return defineNpcCommandResponse({
          sessionId: worldState.sessionId,
          accepted: false,
          errors: validation.errors,
          delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
        });
      }

      const { routePolicy } = resolveAiSettingsForSession(worldState);
      const route = resolveModelForTask("delegated_task_planner", routePolicy);
      const provider = getProvider({ routePolicy });
      const startedAt = Date.now();
      const plan = await provider.planDelegatedTask({
        taskType: validation.normalized.taskType,
        npcId: validation.normalized.assigneeActorId,
        commandText: validation.normalized.commandText,
        targetRef: validation.normalized.targetRef,
        budget: validation.normalized.budget,
        npcDetailView: attachRelationshipActionEligibilityToDetail(
          worldState,
          buildNpcDetailView(worldState, validation.normalized.assigneeActorId)
        ),
        serverBoundaries: [
          "AI 只给出委派计划建议，资源、权限、期限和任务结果由服务器裁决。",
          "不得读取或输出 hiddenDossier、raw prompt、provider payload、本地路径或密钥。"
        ]
      });
      recordAiInvocation(worldState, {
        taskType: "delegated_task_planner",
        route,
        status: "completed",
        durationMs: Date.now() - startedAt,
        maxOutputTokens: route.maxOutputTokens
      });
      const safePlan = sanitizeDelegatedTaskPlan(plan);
      if (!safePlan.ok) {
        return defineNpcCommandResponse({
          sessionId: worldState.sessionId,
          accepted: false,
          errors: safePlan.errors,
          delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
        });
      }

      const request = {
        ...req.body,
        issuerActorId: worldState.player?.id || "player",
        riskFactors: safePlan.riskTags,
        successFactors: safePlan.successFactors
      };
      const created = validation.normalized.taskType === "land_survey"
        ? createLandSurveyDelegatedTask(worldState, request)
        : createDelegatedTask(worldState, request);
      const safeTask = created.delegatedTaskView.items.find((task) => task.taskId === created.task?.taskId) || null;
      return defineNpcCommandResponse({
        sessionId: worldState.sessionId,
        accepted: created.ok,
        errors: created.errors,
        delegatedTaskPlanView: {
          taskType: safePlan.taskType,
          planSummary: safePlan.planSummary,
          riskTags: safePlan.riskTags,
          successFactors: safePlan.successFactors,
          suggestedDueTurns: safePlan.suggestedDueTurns
        },
        delegatedTask: safeTask,
        delegatedTaskView: created.delegatedTaskView
      });
    });
    res.status(payload.accepted ? 200 : 400).json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/saves", async (req, res, next) => {
  try {
    res.json(defineSavesResponse(await listSessions()));
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

    res.json(defineGameTurnResponse(await processTurn(sessionId, input)));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
