const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const mockProvider = require("../src/ai/providers/mock");
const { validatePayload } = require("../src/ai/schemas");
const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch } = require("../src/game/stateRules");
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

test("magistrate sessions start with local county state", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });

  assert.equal(worldState.player.role, "magistrate");
  assert.equal(worldState.player.position, "知县");
  assert.equal(worldState.player.countyName, "清河县");
  assert.equal(worldState.player.localTreasury, 320);
  assert.equal(worldState.player.localOrder, 62);
  assert.equal(worldState.player.gentryRelations, 45);
  assert.equal(worldState.player.banditPressure, 38);
  assert.equal(worldState.player.pendingLawsuits, 12);
  assert.equal(worldState.player.corveeBurden, 30);
  assert.equal(worldState.player.waterworks, 42);
  assert.equal(worldState.characters[0].role, "县丞");
});

test("magistrate local fields pass through schema and state clamps", () => {
  const payload = {
    narrative: "County affairs moved.",
    statePatch: {
      player: {
        countyName: "清河县",
        localTreasury: 500,
        localOrder: 66,
        gentryRelations: 48,
        banditPressure: 31,
        pendingLawsuits: 9,
        corveeBurden: 34,
        waterworks: 50
      }
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["event"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });

  assert.equal(validatePayload("turn", payload), payload);

  applyStatePatch(worldState, {
    player: {
      localTreasury: 999999,
      localOrder: -10,
      gentryRelations: 130,
      banditPressure: 105,
      pendingLawsuits: -4,
      corveeBurden: 120,
      waterworks: 101
    }
  });

  assert.equal(worldState.player.localTreasury, 100000);
  assert.equal(worldState.player.localOrder, 0);
  assert.equal(worldState.player.gentryRelations, 100);
  assert.equal(worldState.player.banditPressure, 100);
  assert.equal(worldState.player.pendingLawsuits, 0);
  assert.equal(worldState.player.corveeBurden, 100);
  assert.equal(worldState.player.waterworks, 100);
});

test("Mock magistrate money and grain work changes local pressure and reactions", async () => {
  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });
  const result = await mockProvider.runTurn(worldState, "清查县库钱粮");

  assert.ok(result.statePatch.player.localTreasury > worldState.player.localTreasury);
  assert.ok(result.statePatch.player.gentryRelations < worldState.player.gentryRelations);
  assert.ok(result.statePatch.player.localOrder < worldState.player.localOrder);
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "scholarOfficials"));
});

test("POST /api/game/turn applies magistrate casework through state and relationship ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "审理乡民词讼"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 2);
  assert.ok(payload.worldState.player.localOrder > worldState.player.localOrder);
  assert.ok(payload.worldState.player.pendingLawsuits < worldState.player.pendingLawsuits);
  assert.ok(payload.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.ok(payload.worldState.relationshipLedger.characters.C01.relationship > 4);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("county office")));
});
