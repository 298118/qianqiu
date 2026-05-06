const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { MAX_EVENT_HISTORY } = require("../src/game/stateRules");
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

  const patchedGameRoutes = require("../src/routes/game");
  const app = express();
  app.use(express.json());
  app.use("/api/game", patchedGameRoutes);

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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

test("POST /api/game/turn schedules long-term events after the monthly tick", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 7;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "休整一日，听地方钱粮消息"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.month, 8);
  assert.equal(payload.longTermEvents.scheduled[0].key, "seasonal_harvest_audit");
  assert.equal(payload.longTermEventView.activeEvents[0].title, "秋粮核验");
  assert.equal(payload.worldState.longTermEvents.queue[0].key, "seasonal_harvest_audit");
  assert.equal(payload.worldState.eventHistory.at(-1), payload.longTermEvents.events.at(-1));
  assert.ok(payload.worldTick.events.length >= 1);
});

test("POST /api/game/turn applies active long-term event results and trims history in order", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 2;
  worldState.month = 8;
  worldState.eventHistory = Array.from({ length: MAX_EVENT_HISTORY - 1 }, (_, index) => `old-${index}`);
  worldState.longTermEvents = {
    schemaVersion: 1,
    cooldowns: {},
    recentResolved: [],
    queue: [
      {
        schemaVersion: 1,
        id: "LTE-test-harvest",
        key: "seasonal_harvest_audit",
        type: "seasonal",
        status: "active",
        targetType: "world",
        targetId: "",
        title: "秋粮核验",
        summary: "秋粮入簿。",
        severity: 1,
        createdTurn: 2,
        startedYear: 1644,
        startedMonth: 8,
        durationMonths: 1,
        remainingMonths: 1,
        cooldownKey: "seasonal_harvest_audit",
        cooldownTurns: 10,
        visibility: "public"
      }
    ]
  };
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "继续休整"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 3);
  assert.equal(payload.worldState.longTermEvents.queue.length, 0);
  assert.ok(payload.longTermEvents.resolved.some((event) => event.key === "seasonal_harvest_audit"));
  assert.ok(payload.attributeChanges.some((change) => change.reason === "长期事件"));
  assert.equal(payload.worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.deepEqual(
    payload.worldState.eventHistory.slice(-payload.longTermEvents.events.length),
    payload.longTermEvents.events
  );
  assert.ok(payload.worldState.eventHistory.includes(payload.worldTick.events.at(-1)));
});

test("POST /api/game/turn ignores provider attempts to forge long-term scheduler state", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          longTermEvents: {
            queue: [{ key: "provider_forged", title: "Forged" }]
          },
          activeNpcRequest: {
            id: "provider-forged"
          },
          player: {
            academia: 22
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

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 1;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "study with forged scheduler state"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 22);
  assert.equal(JSON.stringify(payload.worldState.longTermEvents).includes("provider_forged"), false);
  assert.equal(JSON.stringify(payload.worldState.activeNpcRequest).includes("provider-forged"), false);
});
