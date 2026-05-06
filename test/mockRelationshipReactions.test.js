const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const mockProvider = require("../src/ai/providers/mock");
const { createInitialState } = require("../src/game/initialState");
const { summarizeRelationshipLedger } = require("../src/game/relationships");
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

  return createFetchSafeServer(app);
}

test("Mock scholar study produces visible character and faction relationship suggestions", async () => {
  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  const result = await mockProvider.runTurn(worldState, "研读《论语》三日");
  const visible = summarizeRelationshipLedger(
    worldState.relationshipLedger,
    worldState,
    { visibleOnly: true }
  );
  const visibleTargetIds = new Set([
    ...visible.characters.map((entry) => entry.id),
    ...visible.factions.map((entry) => entry.id)
  ]);

  assert.ok(result.relationshipChanges.length >= 2);
  assert.ok(result.relationshipChanges.some((change) => change.targetType === "character" && change.targetId === "C01"));
  assert.ok(result.relationshipChanges.some((change) => change.targetType === "faction" && change.targetId === "scholarOfficials"));
  assert.ok(!result.relationshipChanges.some((change) => change.targetId === "eunuchs"));
  assert.ok(result.relationshipChanges.every((change) => visibleTargetIds.has(change.targetId)));
});

test("POST /api/game/turn applies Mock relationship reactions through the server ledger", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "rest"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.ok(payload.relationshipChanges.length >= 1);
  assert.equal(payload.relationshipChanges[0].targetType, "character");
  assert.equal(payload.relationshipChanges[0].targetId, "C01");
  assert.deepEqual(payload.relationshipChanges[0].relationship, { before: 12, after: 13, delta: 1 });
  assert.equal(payload.worldState.relationshipLedger.characters.C01.relationship, 13);
  assert.equal(payload.worldState.relationshipLedger.characters.C01.lastUpdatedTurn, 1);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("mentor")));
});
