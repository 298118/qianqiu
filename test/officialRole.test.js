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

test("official sessions start with career state", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "official" });

  assert.equal(worldState.player.role, "official");
  assert.equal(worldState.player.position, "候选观政");
  assert.equal(worldState.player.faction, "新科进士");
  assert.equal(worldState.player.superiorFavor, 42);
  assert.equal(worldState.player.peerNetwork, 35);
  assert.equal(worldState.player.performanceMerit, 30);
  assert.equal(worldState.player.promotionProspect, 24);
  assert.equal(worldState.player.impeachmentRisk, 18);
  assert.equal(worldState.player.cleanReputation, 70);
  assert.equal(worldState.characters[0].role, "署中上官");
});

test("official career fields pass through schema and state clamps", () => {
  const payload = {
    narrative: "Office affairs moved.",
    statePatch: {
      player: {
        superiorFavor: 46,
        peerNetwork: 40,
        performanceMerit: 38,
        promotionProspect: 30,
        impeachmentRisk: 20,
        cleanReputation: 74
      }
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["event"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
  const worldState = createInitialState({ playerName: "Tester", role: "official" });

  assert.equal(validatePayload("turn", payload), payload);

  applyStatePatch(worldState, {
    player: {
      superiorFavor: 150,
      peerNetwork: -5,
      performanceMerit: 120,
      promotionProspect: -20,
      impeachmentRisk: 130,
      cleanReputation: -10
    }
  });

  assert.equal(worldState.player.superiorFavor, 100);
  assert.equal(worldState.player.peerNetwork, 0);
  assert.equal(worldState.player.performanceMerit, 100);
  assert.equal(worldState.player.promotionProspect, 0);
  assert.equal(worldState.player.impeachmentRisk, 100);
  assert.equal(worldState.player.cleanReputation, 0);
});

test("Mock official assessment improves merit and creates reactions", async () => {
  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  const result = await mockProvider.runTurn(worldState, "奉上官考成请求荐举升迁");

  assert.ok(result.statePatch.player.superiorFavor > worldState.player.superiorFavor);
  assert.ok(result.statePatch.player.performanceMerit > worldState.player.performanceMerit);
  assert.ok(result.statePatch.player.promotionProspect > worldState.player.promotionProspect);
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "scholarOfficials"));
});

test("POST /api/game/turn applies official impeachment through state and relationship ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "弹劾贪墨官员"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.month, 2);
  assert.ok(payload.worldState.player.cleanReputation > worldState.player.cleanReputation);
  assert.ok(payload.worldState.player.impeachmentRisk > worldState.player.impeachmentRisk);
  assert.ok(payload.worldState.corruption < worldState.corruption);
  assert.ok(payload.relationshipChanges.some((change) => change.targetId === "eunuchs"));
  assert.ok(payload.worldState.relationshipLedger.factions.eunuchs.resentment > worldState.relationshipLedger.factions.eunuchs.resentment);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("Impeachment threatens")));
});
