const express = require("express");
const { createInitialState } = require("../game/initialState");
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

module.exports = router;
