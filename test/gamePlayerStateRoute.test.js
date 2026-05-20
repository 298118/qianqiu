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
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
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

function createPollutedWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "玩家状态巡按",
    year: 1606
  });

  worldState.turnCount = 7;
  worldState.player.officeTitle = "巡按御史";
  worldState.player.hiddenIntent = "SEALED_PLAYER_INTENT";
  worldState.eventHistory.push(
    "巡按公开查核河工。",
    "SEALED_ROUTE_EVENT event_log ai_change_proposals world_state_json sk-redacted-route-secret"
  );
  worldState.hiddenNotes = "SEALED_TOP_LEVEL";
  worldState.rawProviderPayload = {
    prompt: "prompt_retrieval_index",
    provider: "sk-redacted-route-secret"
  };
  worldState.characters.push({
    id: "hidden-character",
    name: "SEALED_CHARACTER",
    hiddenIntent: "SEALED_CHARACTER_INTENT"
  });
  worldState.relationshipLedger.privateNotes = ["SEALED_RELATIONSHIP_NOTE"];
  worldState.actorMemoryLedger = {
    actors: {
      npc: {
        hiddenNotes: "SEALED_MEMORY_NOTE"
      }
    }
  };
  worldState.sessionSummary = {
    privateSummary: "SEALED_SESSION_SUMMARY"
  };

  return worldState;
}

test("S71.4 GET /api/game/player-state returns redacted player state and safe route views", async (t) => {
  const worldState = createPollutedWorldState();
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(
    `${server.baseUrl}/api/game/player-state/${worldState.sessionId}?eventArchivePageSize=2&informationTab=world-people&informationPageSize=4`
  );
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.source, "server_player_visible_state_projection");
  assert.equal(payload.sessionId, worldState.sessionId);
  assert.equal(payload.worldState.player.name, "玩家状态巡按");
  assert.equal(payload.worldState.player.officeTitle, "巡按御史");
  assert.equal(payload.worldState.characters, undefined);
  assert.equal(payload.worldState.relationshipLedger, undefined);
  assert.equal(payload.worldState.actorMemoryLedger, undefined);
  assert.equal(payload.worldState.sessionSummary, undefined);
  assert.equal(payload.eventArchiveView.schemaVersion, 1);
  assert.equal(payload.informationPanelPageView.schemaVersion, 1);
  assert.equal(payload.informationPanelPageView.activeTabId, "world-people");
  assert.equal(payload.aiSettingsView.taskRoutes.find((route) => route.taskType === "narrator").maxOutputTokens > 0, true);
  assert.equal(payload.aiSettingsView.providerOptions.find((option) => option.provider === "mock").requiresKey, false);
  assert.doesNotMatch(
    serialized,
    /SEALED_|event_log|ai_change_proposals|world_state_json|prompt_retrieval_index|safe_search_index|"rawProviderPayload"|"hiddenIntent"|"relationshipLedger"|"actorMemoryLedger"|"sessionSummary"|sk-redacted-route-secret/
  );
});

test("S71.4 GET /api/game/state remains available as a short-term compatibility route", async (t) => {
  const worldState = createPollutedWorldState();
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/state/${worldState.sessionId}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.sessionId, worldState.sessionId);
  assert.ok(payload.worldState);
  assert.equal(payload.worldState.actorMemoryLedger, undefined);
  assert.equal(payload.worldState.sessionSummary, undefined);
  assert.equal(payload.source, undefined);
});

test("S71.4 GET /api/game/player-state reports missing sessions through the route error boundary", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/player-state/00000000-0000-4000-8000-000000000000`);
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.match(payload.error, /Session not found|not found/i);
});
