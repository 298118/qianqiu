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
  buildRoleWorldCouplingView,
  ensureRoleWorldCouplingState,
  runRoleWorldCouplingStep
} = require("../game/roleWorldCoupling");
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
const { canEnterExam, getExam } = require("../game/exams");
const { applyStatePatch, appendEvents } = require("../game/stateRules");
const { runWorldTick } = require("../game/worldTick");
const { getProvider } = require("../ai");
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
  return mutateSession(sessionId, async (worldState) => {
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldThreadState(worldState);
    const provider = getProvider();
    const result = await provider.runTurn(worldState, input);
    return finalizeTurn(worldState, result, input);
  });
}

async function processStreamingTurn(sessionId, input, streamHandlers = {}) {
  return mutateSession(sessionId, async (worldState) => {
    ensureRelationshipLedger(worldState);
    ensureExamCalendarState(worldState);
    ensureLongTermEventState(worldState);
    ensureOfficialCareerState(worldState);
    ensureRoleWorldCouplingState(worldState);
    ensureWorldThreadState(worldState);
    const provider = getProvider();
    const canStream = provider.supportsStreaming && typeof provider.streamTurn === "function";
    const result = canStream
      ? await provider.streamTurn(worldState, input, streamHandlers)
      : await provider.runTurn(worldState, input);

    return finalizeTurn(worldState, result, input);
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

  return {
    shouldStart: true,
    level: exam.level,
    reason
  };
}

async function finalizeTurn(worldState, result, input) {
  const providerAttributeChanges = Array.isArray(result.attributeChanges) ? result.attributeChanges : [];

  // All model-suggested state changes pass through server-side boundaries.
  applyStatePatch(worldState, result.statePatch);
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

  const longTermEvents = runLongTermEventStep(worldState);
  applyStatePatch(worldState, longTermEvents.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const longTermRelationshipChanges = applyRelationshipChanges(worldState, longTermEvents.relationshipChanges);

  const officialCareer = runOfficialCareerStep(worldState, input);
  applyStatePatch(worldState, officialCareer.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const officialCareerRelationshipChanges = applyRelationshipChanges(worldState, officialCareer.relationshipChanges);

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
  ensureWorldThreadState(worldState);

  const worldTickFeedback = {
    summary: worldTick.summary,
    events: Array.isArray(worldTick.events) ? worldTick.events : [],
    attributeChanges: Array.isArray(worldTick.attributeChanges) ? worldTick.attributeChanges : []
  };

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
    relationshipChanges: [
      ...relationshipChanges,
      ...activeNpcRequest.relationshipChanges,
      ...roleWorldCouplingRelationshipChanges,
      ...longTermRelationshipChanges,
      ...officialCareerRelationshipChanges
    ],
    examCalendarView: buildExamCalendarView(worldState),
    examRivalView: buildExamRivalView(worldState),
    relationshipView: buildRelationshipInspectionView(worldState),
    activeNpcRequestView: buildActiveNpcRequestView(worldState),
    activeNpcRequestEvents: activeNpcRequest.events,
    roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
    worldThreadView: buildWorldThreadView(worldState),
    roleWorldCoupling: {
      summary: roleWorldCoupling.summary,
      events: Array.isArray(roleWorldCoupling.events) ? roleWorldCoupling.events : [],
      attributeChanges: Array.isArray(roleWorldCoupling.attributeChanges) ? roleWorldCoupling.attributeChanges : [],
      outcome: roleWorldCoupling.outcome
    },
    longTermEventView: buildLongTermEventView(worldState),
    longTermEvents: {
      summary: longTermEvents.summary,
      events: Array.isArray(longTermEvents.events) ? longTermEvents.events : [],
      attributeChanges: Array.isArray(longTermEvents.attributeChanges) ? longTermEvents.attributeChanges : [],
      scheduled: Array.isArray(longTermEvents.scheduled) ? longTermEvents.scheduled : [],
      resolved: Array.isArray(longTermEvents.resolved) ? longTermEvents.resolved : []
    },
    officialCareerView: buildOfficialCareerView(worldState),
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
      worldThreadView: payload.worldThreadView,
      roleWorldCoupling: payload.roleWorldCoupling,
      longTermEventView: payload.longTermEventView,
      longTermEvents: payload.longTermEvents,
      officialCareerView: payload.officialCareerView,
      officialCareer: payload.officialCareer,
      examTrigger: payload.examTrigger,
      worldTick: payload.worldTick
    });
    sendSseEvent(res, "final_state", payload);
  } catch (error) {
    sendSseEvent(res, "error", {
      error: error.message || "Internal server error",
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
    await writeSession(worldState);

    res.status(201).json({
      sessionId: worldState.sessionId,
      worldState,
      examCalendarView: buildExamCalendarView(worldState),
      examRivalView: buildExamRivalView(worldState),
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
      worldThreadView: buildWorldThreadView(worldState),
      longTermEventView: buildLongTermEventView(worldState),
      officialCareerView: buildOfficialCareerView(worldState),
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
    ensureWorldThreadState(worldState);
    res.json({
      sessionId: worldState.sessionId,
      worldState,
      examCalendarView: buildExamCalendarView(worldState),
      examRivalView: buildExamRivalView(worldState),
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      roleWorldCouplingView: buildRoleWorldCouplingView(worldState),
      worldThreadView: buildWorldThreadView(worldState),
      longTermEventView: buildLongTermEventView(worldState),
      officialCareerView: buildOfficialCareerView(worldState)
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
