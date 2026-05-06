const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServerWithProvider(provider) {
  const aiPath = require.resolve("../src/ai");
  const gameRoutePath = require.resolve("../src/routes/game");
  const originalAiModule = require.cache[aiPath];
  const originalGameRouteModule = require.cache[gameRoutePath];

  delete require.cache[gameRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const gameRoutes = require("../src/routes/game");
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);

  const testServer = createFetchSafeServer(app);

  async function close() {
    await testServer.close();

    delete require.cache[gameRoutePath];
    if (originalGameRouteModule) {
      require.cache[gameRoutePath] = originalGameRouteModule;
    }

    if (originalAiModule) {
      require.cache[aiPath] = originalAiModule;
    } else {
      delete require.cache[aiPath];
    }
  }

  return {
    baseUrl: testServer.baseUrl,
    close
  };
}

test("POST /api/game/turn applies provider relationship suggestions through server merge", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          player: {
            reputation: 14
          }
        },
        attributeChanges: [],
        relationshipChanges: [
          {
            targetType: "character",
            targetId: "C01",
            relationshipDelta: 20,
            resentmentDelta: 12,
            stance: "warmer mentor",
            recentIntent: "Offer a cautious recommendation.",
            reason: "Respectful study impressed the mentor."
          },
          {
            targetType: "faction",
            targetId: "eunuchs",
            relationshipDelta: 8,
            resentmentDelta: -3,
            reason: "Hidden faction suggestions are ignored for a scholar."
          },
          {
            targetType: "character",
            targetId: "invented",
            relationshipDelta: 8,
            resentmentDelta: 1,
            reason: "Invented ids are ignored."
          }
        ],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "study with respect"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.player.reputation, 14);
  assert.equal(payload.relationshipChanges.length, 1);
  assert.equal(payload.relationshipChanges[0].targetId, "C01");
  assert.deepEqual(payload.relationshipChanges[0].relationship, { before: 12, after: 24, delta: 12 });
  assert.deepEqual(payload.relationshipChanges[0].resentment, { before: 0, after: 10, delta: 10 });
  assert.ok(payload.relationshipView.contacts.some((entry) => entry.id === "C01" && entry.lastUpdatedTurn === 1));
  assert.ok(payload.relationshipView.factions.some((entry) => entry.id === "scholarOfficials"));
  assert.ok(!payload.relationshipView.factions.some((entry) => entry.id === "eunuchs"));
  assert.equal(JSON.stringify(payload.relationshipView).includes("Eunuch faction"), false);
  assert.equal(payload.worldState.relationshipLedger.characters.C01.stance, "warmer mentor");
  assert.equal(payload.worldState.relationshipLedger.characters.C01.lastUpdatedTurn, 1);
  assert.equal(payload.worldState.relationshipLedger.factions.eunuchs.relationship, -4);
  assert.ok(payload.worldState.relationshipLedger.recentNotes.some((note) => note.includes("mentor")));
});

test("POST /api/game/turn ignores provider attempts to patch server-owned ordinary-turn fields", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          activeExam: null,
          characters: [{ id: "C99", name: "Invented patron", role: "patron" }],
          eventHistory: ["provider replacement"],
          player: {
            academia: 22,
            examRank: "model-rank",
            examHistory: [{ level: "palace_exam", score: 100 }]
          }
        },
        attributeChanges: [],
        relationshipChanges: [],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.activeExam = { level: "child_exam", reason: "server-created" };
  worldState.characters = [{ id: "C01", name: "Original mentor", role: "teacher" }];
  worldState.eventHistory = ["existing history"];
  worldState.player.examRank = "server-rank";
  worldState.player.examHistory = [{ level: "child_exam", score: 80 }];
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "study with an unsafe provider patch"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.deepEqual(payload.worldState.activeExam, { level: "child_exam", reason: "server-created" });
  assert.deepEqual(payload.worldState.characters, [{ id: "C01", name: "Original mentor", role: "teacher" }]);
  assert.equal(payload.worldState.eventHistory[0], "existing history");
  assert.ok(payload.worldState.eventHistory.includes("provider event"));
  assert.ok(!payload.worldState.eventHistory.includes("provider replacement"));
  assert.equal(payload.worldState.player.examRank, "server-rank");
  assert.deepEqual(payload.worldState.player.examHistory, [{ level: "child_exam", score: 80 }]);
  assert.equal(payload.worldState.player.academia, 22);
});
