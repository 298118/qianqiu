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

async function postJson(url, body, headers = { "Content-Type": "application/json" }) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test("POST /api/game/turn runs role-world coupling before the monthly tick", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "waterworks along the canal"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.roleWorldCoupling.outcome.kind, "magistrate_waterworks");
  assert.equal(payload.roleWorldCouplingView.recentImpacts.at(-1).kind, "magistrate_waterworks");
  assert.ok(payload.attributeChanges.some((change) => change.reason === "角色世界联动"));
  assert.ok(payload.relationshipChanges.some((change) => change.targetId === "C01"));
  assert.ok(payload.worldState.roleWorldCoupling.recentImpacts.at(-1).kind === "magistrate_waterworks");

  const history = payload.worldState.eventHistory;
  const providerIndex = history.findIndex((event) => event.includes("waterworks"));
  const roleWorldIndex = history.indexOf(payload.roleWorldCoupling.events[0]);
  const tickIndex = history.indexOf(payload.worldTick.events[0]);

  assert.equal(providerIndex >= 0, true);
  assert.equal(roleWorldIndex > providerIndex, true);
  assert.equal(tickIndex > roleWorldIndex, true);
});

test("POST /api/game/turn ignores provider attempts to forge role-world coupling state", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          roleWorldCoupling: {
            recentImpacts: [{ kind: "provider-forged" }]
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
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "ordinary study"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 22);
  assert.equal(JSON.stringify(payload.worldState.roleWorldCoupling).includes("provider-forged"), false);
  assert.equal(payload.roleWorldCoupling.outcome, null);
});

test("SSE turn preview and final payload include role-world coupling feedback", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "general" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "campaign at the border"
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /event: state_preview/);
  assert.match(body, /event: final_state/);
  assert.match(body, /roleWorldCouplingView/);
  assert.match(body, /roleWorldCoupling/);
  assert.match(body, /general_campaign/);
});
