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

test("POST /api/game/turn returns world entity view without hidden notes", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "magistrate" });
  worldState.worldEntities.entities.push({
    id: "hidden-gentry-book",
    category: "local",
    kind: "local_gentry",
    name: "Hidden Gentry Book",
    status: "critical",
    visibility: "hidden",
    metrics: { influence: 80, pressure: 90, capacity: 20, trust: 10, deficit: 80 },
    publicSummary: "SEALED_GENTRY_SUMMARY",
    hiddenNotes: ["SEALED_GENTRY_NOTE"]
  });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "查问县中乡绅与赈务账册"
  });
  const serializedView = JSON.stringify(payload.worldEntityView);

  assert.equal(response.status, 200);
  assert.equal(payload.worldEntityView.schemaVersion, 1);
  assert.ok(payload.worldEntityView.groups.some((group) => group.category === "local"));
  assert.ok(payload.worldEntityView.groups.some((group) => group.category === "relief"));
  assert.equal(serializedView.includes("Hidden Gentry Book"), false);
  assert.equal(serializedView.includes("SEALED_GENTRY_SUMMARY"), false);
  assert.equal(serializedView.includes("SEALED_GENTRY_NOTE"), false);
});

test("POST /api/game/turn ignores provider attempts to forge world entities", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          worldEntities: {
            entities: [{
              id: "provider-forged-entity",
              category: "court",
              kind: "court_office",
              name: "伪实体",
              hiddenNotes: ["provider-hidden-entity"]
            }]
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
    input: "study with forged world entities"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 22);
  assert.equal(JSON.stringify(payload.worldState.worldEntities).includes("provider-forged-entity"), false);
  assert.equal(JSON.stringify(payload.worldEntityView).includes("provider-hidden-entity"), false);
});

test("POST /api/game/turn derives server-owned entity impacts from allowed state and system sources", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The court heard urgent frontier reports.",
        statePatch: {
          borderThreat: 88,
          publicOrder: 42,
          player: {
            reputation: 24
          }
        },
        attributeChanges: [],
        relationshipChanges: [{
          targetType: "faction",
          targetId: "militaryLords",
          relationshipDelta: 6,
          resentmentDelta: 1,
          stance: "pressing for border funds",
          recentIntent: "Ask for money and honors.",
          reason: "Visible frontier pressure."
        }],
        events: ["provider event"],
        examTrigger: { shouldStart: false, level: null, reason: "" }
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "general" });
  const beforeGarrison = worldState.worldEntities.entities.find((entity) => entity.id === "military-frontier-garrison");
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "查问边镇与军饷"
  });
  const afterGarrison = payload.worldState.worldEntities.entities.find((entity) => entity.id === "military-frontier-garrison");
  const entityThread = payload.worldThreadView.activeThreads.find((thread) => thread.sourceType === "world_entity");

  assert.equal(response.status, 200);
  assert.ok(payload.worldEntityImpacts.some((impact) => impact.sourceType === "provider_state"));
  assert.ok(payload.worldEntityImpacts.some((impact) => impact.sourceType === "relationship"));
  assert.ok(afterGarrison.metrics.pressure > beforeGarrison.metrics.pressure);
  assert.equal(
    payload.worldEntityView.groups.some((group) =>
      group.entities.some((entity) => entity.id === "military-frontier-garrison")
    ),
    true
  );
  assert.ok(entityThread);
  assert.equal(entityThread.relatedEntitySummaries.some((entity) => entity.id === entityThread.sourceId), true);
});

test("SSE turn preview and final payload include world entity view", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "休整一日，听户部钱粮消息"
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /event: state_preview/);
  assert.match(body, /event: final_state/);
  assert.match(body, /worldEntityView/);
  assert.match(body, /worldEntityImpacts/);
  assert.match(body, /户部/);
});
