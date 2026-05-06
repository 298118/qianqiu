const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error"
    });
  });

  return createFetchSafeServer(app);
}

test("GET /api/game/saves returns redacted session metadata", async (t) => {
  const worldState = createInitialState({
    playerName: "Save Route Tester",
    role: "official",
    year: 1606
  });
  worldState.player.examRank = "进士";
  worldState.player.officeTitle = "县令";
  worldState.relationshipLedger.recentNotes = ["hidden route test note"];
  t.after(() => removeSessionFile(worldState.sessionId));

  await writeSession(worldState);

  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/saves`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.saves));
  assert.ok(Array.isArray(payload.skipped));

  const save = payload.saves.find((entry) => entry.sessionId === worldState.sessionId);
  assert.ok(save);
  assert.equal(save.playerName, "Save Route Tester");
  assert.equal(save.role, "official");
  assert.equal(save.examRank, "进士");
  assert.equal(save.officeTitle, "县令");
  assert.equal(save.worldState, undefined);
  assert.equal(save.relationshipLedger, undefined);
  assert.ok(!JSON.stringify(save).includes("hidden route test note"));
});
