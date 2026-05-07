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

test("POST /api/game/turn exposes scheduled long-term events as world threads", async (t) => {
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
  assert.equal(payload.longTermEvents.scheduled[0].key, "seasonal_harvest_audit");
  assert.ok(payload.worldThreadView.activeThreads.some((thread) =>
    thread.sourceType === "long_term_event" &&
    thread.sourceId === payload.longTermEvents.scheduled[0].id &&
    thread.title === "秋粮核验"
  ));
  assert.ok(payload.worldState.worldThreads.threads.some((thread) => thread.title === "秋粮核验"));
});

test("POST /api/game/turn exposes official assignments as world threads without hidden notes", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "official" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    performanceMerit: 44,
    promotionProspect: 20,
    impeachmentRisk: 18
  });
  worldState.officialCareer.currentPosting = "户部主事";
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "督办赈灾，核销赈银账册"
  });

  assert.equal(response.status, 200);
  const assignment = payload.officialCareerView.assignments.find((entry) => entry.kind === "relief");
  assert.ok(assignment);
  assert.ok(payload.worldThreadView.activeThreads.some((thread) =>
    thread.sourceType === "official_assignment" &&
    thread.sourceId === assignment.id &&
    thread.title === assignment.title
  ));
  assert.equal(JSON.stringify(payload.worldThreadView).includes("hiddenNotes"), false);
});

test("POST /api/game/turn ignores provider attempts to forge world threads", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          worldThreads: {
            threads: [{ id: "WT-provider-forged", title: "伪议题", hiddenNotes: ["leak"] }]
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
    input: "study with forged world threads"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.academia, 22);
  assert.equal(JSON.stringify(payload.worldState.worldThreads).includes("WT-provider-forged"), false);
  assert.equal(JSON.stringify(payload.worldThreadView).includes("leak"), false);
});

test("SSE turn preview and final payload include world thread view", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 7;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "休整一日，听地方钱粮消息"
    })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /event: state_preview/);
  assert.match(body, /event: final_state/);
  assert.match(body, /worldThreadView/);
  assert.match(body, /秋粮核验/);
});
