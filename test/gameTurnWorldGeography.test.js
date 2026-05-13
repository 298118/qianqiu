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
    if (originalGameRouteModule) require.cache[gameRoutePath] = originalGameRouteModule;

    if (originalAiModule) require.cache[aiPath] = originalAiModule;
    else delete require.cache[aiPath];
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

function parseSse(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");

      return {
        event: eventLine ? eventLine.slice(6).trim() : "message",
        data: data ? JSON.parse(data) : null
      };
    });
}

test("POST /api/game/start returns visible world geography view without hidden rows", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "Geo Starter"
  });
  t.after(() => removeSessionFile(payload.sessionId));
  const serializedView = JSON.stringify(payload.worldGeographyView);

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.worldGeography.schemaVersion, 1);
  assert.equal(payload.worldGeographyView.schemaVersion, 1);
  assert.equal(payload.mapContextView.schemaVersion, 1);
  assert.ok(payload.worldGeographyView.cities.some((city) => city.id === "city-beijing"));
  assert.ok(payload.mapContextView.mapEntityRefs.some((ref) => ref.refId === "map:geography:city:city-beijing"));
  assert.equal(serializedView.includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(JSON.stringify(payload.mapContextView).includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(serializedView.includes("frontier-hidden-palace-intel"), false);
  assert.equal(serializedView.includes("city-hanseong"), false);
});

test("GET /api/game/state backfills world geography view for old saves", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Legacy Route Geo" });
  delete worldState.worldGeography;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/state/${worldState.sessionId}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.worldGeography.schemaVersion, 1);
  assert.equal(payload.worldGeographyView.schemaVersion, 1);
  assert.equal(payload.mapContextView.schemaVersion, 1);
  assert.ok(payload.worldGeographyView.frontierZones.some((frontier) =>
    frontier.id === "frontier-shanhai-liaodong"
  ));
});

test("POST /api/game/turn ignores provider attempts to forge world geography", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          worldGeography: {
            countries: [{
              id: "country-provider-forged",
              name: "伪造地理",
              visibility: "public",
              hiddenNotes: ["provider-hidden-geography"]
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

  const worldState = createInitialState({ playerName: "Turn Geo Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "study with forged geography"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 22);
  assert.equal(JSON.stringify(payload.worldState.worldGeography).includes("country-provider-forged"), false);
  assert.equal(JSON.stringify(payload.worldGeographyView).includes("provider-hidden-geography"), false);
});

test("SSE turn preview and final payload include world geography view", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "SSE Geo Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "休整一日，听山海关与漕运消息"
    })
  });
  const body = await response.text();
  const events = parseSse(body);
  const preview = events.find((event) => event.event === "state_preview" && event.data?.worldGeographyView);
  const final = events.find((event) => event.event === "final_state");

  assert.equal(response.status, 200);
  assert.match(body, /event: state_preview/);
  assert.match(body, /event: final_state/);
  assert.ok(preview);
  assert.equal(preview.data.worldGeographyView.schemaVersion, 1);
  assert.equal(final.data.worldGeographyView.schemaVersion, 1);
  assert.match(JSON.stringify(preview.data.worldGeographyView), /北京|山海关|京杭漕运/);
  assert.doesNotMatch(JSON.stringify(preview.data.worldGeographyView), /SEALED_ROUTE_NOTE/);
  assert.doesNotMatch(JSON.stringify(final.data.worldGeographyView), /SEALED_ROUTE_NOTE/);
});
