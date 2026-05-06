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
const { applyStatePatch, appendEvents } = require("../game/stateRules");
const { runWorldTick } = require("../game/worldTick");
const { getProvider } = require("../ai");
const { readSession, writeSession } = require("../storage/sessionStore");
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
  const worldState = await readSession(sessionId);
  ensureRelationshipLedger(worldState);
  ensureLongTermEventState(worldState);
  const provider = getProvider();
  const result = await provider.runTurn(worldState, input);
  return finalizeTurn(worldState, result, input);
}

async function processStreamingTurn(sessionId, input, streamHandlers = {}) {
  const worldState = await readSession(sessionId);
  ensureRelationshipLedger(worldState);
  ensureLongTermEventState(worldState);
  const provider = getProvider();
  const canStream = provider.supportsStreaming && typeof provider.streamTurn === "function";
  const result = canStream
    ? await provider.streamTurn(worldState, input, streamHandlers)
    : await provider.runTurn(worldState, input);

  return finalizeTurn(worldState, result, input);
}

async function finalizeTurn(worldState, result, input) {
  const providerAttributeChanges = Array.isArray(result.attributeChanges) ? result.attributeChanges : [];
  const examTrigger = result.examTrigger || { shouldStart: false, level: null, reason: "" };

  // All model-suggested state changes pass through server-side boundaries.
  applyStatePatch(worldState, result.statePatch);
  const relationshipChanges = applyRelationshipChanges(worldState, result.relationshipChanges);

  if (examTrigger.shouldStart) {
    worldState.activeExam = {
      level: examTrigger.level,
      reason: examTrigger.reason,
      requestedAt: new Date().toISOString()
    };
  }

  const activeNpcRequest = runActiveNpcRequestStep(worldState, input);

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

  appendEvents(worldState, result.events);
  appendEvents(worldState, activeNpcRequest.events);
  appendEvents(worldState, worldTick.events);
  appendEvents(worldState, longTermEvents.events);
  ensureRelationshipLedger(worldState);
  ensureLongTermEventState(worldState);

  await writeSession(worldState);

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
      ...worldTickFeedback.attributeChanges,
      ...longTermEvents.attributeChanges
    ],
    relationshipChanges: [...relationshipChanges, ...activeNpcRequest.relationshipChanges, ...longTermRelationshipChanges],
    relationshipView: buildRelationshipInspectionView(worldState),
    activeNpcRequestView: buildActiveNpcRequestView(worldState),
    activeNpcRequestEvents: activeNpcRequest.events,
    longTermEventView: buildLongTermEventView(worldState),
    longTermEvents: {
      summary: longTermEvents.summary,
      events: Array.isArray(longTermEvents.events) ? longTermEvents.events : [],
      attributeChanges: Array.isArray(longTermEvents.attributeChanges) ? longTermEvents.attributeChanges : [],
      scheduled: Array.isArray(longTermEvents.scheduled) ? longTermEvents.scheduled : [],
      resolved: Array.isArray(longTermEvents.resolved) ? longTermEvents.resolved : []
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
      activeNpcRequestView: payload.activeNpcRequestView,
      activeNpcRequestEvents: payload.activeNpcRequestEvents,
      longTermEventView: payload.longTermEventView,
      longTermEvents: payload.longTermEvents,
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
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      longTermEventView: buildLongTermEventView(worldState),
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
    ensureLongTermEventState(worldState);
    res.json({
      sessionId: worldState.sessionId,
      worldState,
      relationshipView: buildRelationshipInspectionView(worldState),
      activeNpcRequestView: buildActiveNpcRequestView(worldState),
      longTermEventView: buildLongTermEventView(worldState)
    });
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
