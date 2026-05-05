const express = require("express");
const { createInitialState } = require("../game/initialState");
const { applyStatePatch, appendEvents } = require("../game/stateRules");
const { getProvider } = require("../ai");
const { readSession, writeSession } = require("../storage/sessionStore");

const router = express.Router();

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
      narrative: opening.narrative
    });
  } catch (error) {
    next(error);
  }
});

router.get("/state/:sessionId", async (req, res, next) => {
  try {
    const worldState = await readSession(req.params.sessionId);
    res.json({ sessionId: worldState.sessionId, worldState });
  } catch (error) {
    next(error);
  }
});

router.post("/turn", async (req, res, next) => {
  try {
    const { sessionId, input } = req.body;

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

    const worldState = await readSession(sessionId);
    const provider = getProvider();
    const result = await provider.runTurn(worldState, input.trim());

    // Apply state patch through server-side rules
    applyStatePatch(worldState, result.statePatch);

    // Append events
    appendEvents(worldState, result.events);

    // Apply exam trigger
    if (result.examTrigger && result.examTrigger.shouldStart) {
      worldState.activeExam = {
        level: result.examTrigger.level,
        reason: result.examTrigger.reason,
        requestedAt: new Date().toISOString()
      };
    }

    await writeSession(worldState);

    res.json({
      sessionId: worldState.sessionId,
      narrative: result.narrative,
      attributeChanges: result.attributeChanges || [],
      examTrigger: result.examTrigger || { shouldStart: false, level: null, reason: "" },
      worldState
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
