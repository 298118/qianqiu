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
  createExamProgressAuditRecords,
  createOpeningAuditRecords,
  createTurnAuditRecords,
  enqueueAuditRecords
} = require("../game/audit");
const { buildEventArchiveView } = require("../game/eventArchive");
const { canEnterExam, getExam } = require("../game/exams");
const {
  advanceExamScenePhase,
  attachExamSceneTime,
  buildExamSceneFeedback
} = require("../game/examSceneTime");
const { applyStatePatch, appendEvents } = require("../game/stateRules");
const { runWorldTick } = require("../game/worldTick");
const { getProvider } = require("../ai");
const { redactSecrets } = require("../ai/diagnostics");
const { listSessions, mutateSession, readSession, writeSession } = require("../storage/sessionStore");
const { chunkTextForSse, closeSse, sendSseEvent, writeSseHeaders } = require("../utils/sse");
const { createJsonStringFieldExtractor } = require("../utils/streamingJson");

const router = express.Router();

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
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldGeographyState(worldState);
    ensureOfficialPostingsState(worldState);
    ensureWorldEntityState(worldState);
    ensureWorldPeopleState(worldState);
    ensureWorldThreadState(worldState);
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
    }
    const provider = getProvider();
    const result = await provider.runTurn(worldState, input);
    return finalizeTurn(worldState, result, input, { context, provider });
  });
}

async function processStreamingTurn(sessionId, input, streamHandlers = {}) {
  return mutateSession(sessionId, async (worldState, context) => {
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldGeographyState(worldState);
    ensureOfficialPostingsState(worldState);
    ensureWorldEntityState(worldState);
    ensureWorldPeopleState(worldState);
    ensureWorldThreadState(worldState);
    if (isWritingExam(worldState.activeExam)) {
      return finalizeExamSceneTurn(worldState, input, context);
    }
    const provider = getProvider();
    const canStream = provider.supportsStreaming && typeof provider.streamTurn === "function";
    const result = canStream
      ? await provider.streamTurn(worldState, input, streamHandlers)
      : await provider.runTurn(worldState, input);

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

function buildCommonTurnViews(worldState) {
  return {
    examCalendarView: buildExamCalendarView(worldState),
    examRivalView: buildExamRivalView(worldState),
    relationshipView: buildRelationshipInspectionView(worldState),
    activeNpcRequestView: buildActiveNpcRequestView(worldState),
    roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
    worldGeographyView: buildWorldGeographyView(worldState),
    worldEntityView: buildWorldEntityView(worldState),
    worldPeopleView: buildWorldPeopleView(worldState),
    worldThreadView: buildWorldThreadView(worldState),
    longTermEventView: buildLongTermEventView(worldState),
    officialCareerView: buildOfficialCareerView(worldState),
    officialPostingsView: buildOfficialPostingsView(worldState),
    eventArchiveView: buildEventArchiveView(worldState)
  };
}

async function finalizeExamSceneTurn(worldState, input, context = null) {
  const scene = advanceExamScenePhase(worldState.activeExam, worldState, input);
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
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
    worldState
  };
}

async function finalizeTurn(worldState, result, input, auditOptions = {}) {
  const { context = null, provider = null } = auditOptions;
  const providerAttributeChanges = Array.isArray(result.attributeChanges) ? result.attributeChanges : [];

  // All model-suggested state changes pass through server-side boundaries.
  const providerStateBefore = JSON.parse(JSON.stringify(worldState));
  applyStatePatch(worldState, result.statePatch);
  const providerStateAfter = JSON.parse(JSON.stringify(worldState));
  const relationshipChanges = applyRelationshipChanges(worldState, result.relationshipChanges);
  const examTrigger = applyExamTrigger(worldState, result.examTrigger);

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

  const allRelationshipChanges = [
    ...relationshipChanges,
    ...activeNpcRequest.relationshipChanges,
    ...roleWorldCouplingRelationshipChanges,
    ...longTermRelationshipChanges,
    ...officialCareerRelationshipChanges
  ];
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

  appendEvents(worldState, result.events);
  appendEvents(worldState, activeNpcRequest.events);
  appendEvents(worldState, roleWorldCoupling.events);
  appendEvents(worldState, worldTick.events);
  appendEvents(worldState, longTermEvents.events);
  appendEvents(worldState, officialCareer.events);
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);

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
    roleWorldCoupling,
    worldTick,
    longTermEvents,
    officialCareer,
    worldEntityImpacts
  }));

  return {
    sessionId: worldState.sessionId,
    narrative: result.narrative,
    attributeChanges: [
      ...providerAttributeChanges,
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
    examTrigger,
    worldTick: worldTickFeedback,
    worldState
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
      examCalendarView: payload.examCalendarView,
      examRivalView: payload.examRivalView,
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
      eventArchiveView: payload.eventArchiveView,
      officialCareer: payload.officialCareer,
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
    const provider = getProvider();
    const opening = await provider.startGame(worldState);

    worldState.eventHistory.push(...opening.events);
    await writeSession(worldState, createOpeningAuditRecords(worldState, opening, provider));

    res.status(201).json({
      sessionId: worldState.sessionId,
      worldState,
      examCalendarView: buildExamCalendarView(worldState),
      examRivalView: buildExamRivalView(worldState),
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
      worldGeographyView: buildWorldGeographyView(worldState),
      worldEntityView: buildWorldEntityView(worldState),
      worldPeopleView: buildWorldPeopleView(worldState),
      worldThreadView: buildWorldThreadView(worldState),
      longTermEventView: buildLongTermEventView(worldState),
      officialCareerView: buildOfficialCareerView(worldState),
      officialPostingsView: buildOfficialPostingsView(worldState),
      eventArchiveView: buildEventArchiveView(worldState),
      narrative: opening.narrative
    });
  } catch (error) {
    next(error);
  }
});

router.get("/state/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldGeographyState(worldState);
    ensureOfficialPostingsState(worldState);
    ensureWorldEntityState(worldState);
    ensureWorldPeopleState(worldState);
    ensureWorldThreadState(worldState);
    res.json({
      sessionId: worldState.sessionId,
      worldState,
      examCalendarView: buildExamCalendarView(worldState),
      examRivalView: buildExamRivalView(worldState),
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
      worldGeographyView: buildWorldGeographyView(worldState),
      worldEntityView: buildWorldEntityView(worldState),
      worldPeopleView: buildWorldPeopleView(worldState),
      worldThreadView: buildWorldThreadView(worldState),
      longTermEventView: buildLongTermEventView(worldState),
      officialCareerView: buildOfficialCareerView(worldState),
      officialPostingsView: buildOfficialPostingsView(worldState),
      eventArchiveView: buildEventArchiveView(worldState)
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
