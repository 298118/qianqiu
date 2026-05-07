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

test("general sessions start with military command state", () => {
  const worldState = createInitialState({ playerName: "Tester", role: "general" });

  assert.equal(worldState.player.role, "general");
  assert.equal(worldState.player.position, "游击将军");
  assert.equal(worldState.player.faction, "边镇武臣");
  assert.equal(worldState.player.command, 48);
  assert.equal(worldState.player.troops, 420);
  assert.equal(worldState.player.supply, 360);
  assert.equal(worldState.player.battleReputation, 18);
  assert.equal(worldState.player.scouting, 35);
  assert.equal(worldState.player.campaignRisk, 32);
  assert.equal(worldState.characters[0].role, "中军参将");
});

test("general military fields pass through schema and state clamps", () => {
  const payload = {
    narrative: "Camp affairs moved.",
    statePatch: {
      player: {
        command: 52,
        troops: 510,
        supply: 430,
        battleReputation: 24,
        scouting: 44,
        campaignRisk: 28
      }
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["event"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
  const worldState = createInitialState({ playerName: "Tester", role: "general" });

  assert.equal(validatePayload("turn", payload), payload);

  applyStatePatch(worldState, {
    player: {
      command: 150,
      troops: 2000000,
      supply: 2000000,
      battleReputation: -10,
      scouting: 130,
      campaignRisk: -4
    }
  });

  assert.equal(worldState.player.command, 100);
  assert.equal(worldState.player.troops, 1000000);
  assert.equal(worldState.player.supply, 1000000);
  assert.equal(worldState.player.battleReputation, 0);
  assert.equal(worldState.player.scouting, 100);
  assert.equal(worldState.player.campaignRisk, 0);
});

test("Mock general scouting lowers campaign risk and creates reactions", async () => {
  const worldState = createInitialState({ playerName: "Tester", role: "general" });
  const result = await mockProvider.runTurn(worldState, "遣斥候巡边侦察敌情");

  assert.ok(result.statePatch.player.scouting > worldState.player.scouting);
  assert.ok(result.statePatch.player.campaignRisk < worldState.player.campaignRisk);
  assert.ok(result.statePatch.borderThreat < worldState.borderThreat);
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "militaryLords"));
});

test("POST /api/game/turn applies general campaign through state and relationship ledgers", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "general" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "率营出战进剿边寇"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 2);
  assert.ok(payload.worldState.player.troops < worldState.player.troops);
  assert.ok(payload.worldState.player.supply < worldState.player.supply);
  assert.ok(payload.worldState.player.battleReputation > worldState.player.battleReputation);
  assert.ok(payload.worldState.borderThreat < worldState.borderThreat);
  assert.ok(payload.relationshipChanges.some((change) => change.targetId === "militaryLords"));
  assert.ok(payload.worldState.relationshipLedger.factions.militaryLords.relationship > 0);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("Battlefield action")));
});
