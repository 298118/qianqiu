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

test("POST /api/game/start returns official postings view for direct official starts", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "任所开局"
  });
  t.after(() => removeSessionFile(payload.sessionId));
  const posting = payload.officialPostingsView.postings.find((row) => row.id === "posting-player-current");

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.officialPostings.schemaVersion, 1);
  assert.equal(payload.officialPostingsView.schemaVersion, 1);
  assert.equal(posting.officeId, "probationary_observer");
  assert.equal(posting.cityId, "city-beijing");
  assert.equal(payload.officialCareerView.currentPosting, "候选观政");
});

test("GET /api/game/state backfills official postings for old saves", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "旧档任所", role: "magistrate" });
  delete worldState.officialPostings;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/state/${worldState.sessionId}`);
  const payload = await response.json();
  const posting = payload.officialPostingsView.postings.find((row) => row.id === "posting-player-current");

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.officialPostings.schemaVersion, 1);
  assert.equal(payload.officialPostingsView.schemaVersion, 1);
  assert.equal(posting.officeId, "county_magistrate");
  assert.equal(posting.bureauId, "prefecture_county");
});

test("POST /api/game/turn syncs official career appointment into official postings", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "任所回合", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "奉上官考成请求实授"
  });
  const posting = payload.officialPostingsView.postings.find((row) => row.id === "posting-player-current");
  const transfer = payload.officialPostingsView.transferRecords.find((row) =>
    row.type === "appointment" &&
    row.toOfficeId === "probationary_observer"
  );

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.officeTitle, "六部观政进士");
  assert.equal(payload.worldState.officialPostings.schemaVersion, 1);
  assert.equal(posting.officeId, "probationary_observer");
  assert.equal(posting.cityId, "city-beijing");
  assert.ok(transfer);
});

test("POST /api/game/turn ignores provider attempts to forge official postings", async (t) => {
  const provider = {
    async runTurn() {
      return {
        narrative: "The action was resolved.",
        statePatch: {
          officialPostings: {
            postings: [{
              id: "provider-forged-posting",
              officeId: "ministry_revenue_principal",
              cityId: "city-hidden-provider",
              hiddenNotes: ["provider-hidden-posting"]
            }]
          },
          player: { performanceMerit: 34 }
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

  const worldState = createInitialState({ playerName: "越权任所", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "try forged official postings"
  });
  const serialized = JSON.stringify({
    raw: payload.worldState.officialPostings,
    view: payload.officialPostingsView
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.player.performanceMerit, 40);
  assert.equal(serialized.includes("provider-forged-posting"), false);
  assert.equal(serialized.includes("provider-hidden-posting"), false);
  assert.equal(serialized.includes("city-hidden-provider"), false);
});

test("SSE turn preview and final payload include official postings view", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "SSE 任所", role: "official" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "奉上官考成请求实授"
    })
  });
  const events = parseSse(await response.text());
  const preview = events.find((event) => event.event === "state_preview" && event.data?.officialPostingsView);
  const final = events.find((event) => event.event === "final_state");

  assert.equal(response.status, 200);
  assert.ok(preview);
  assert.equal(preview.data.officialPostingsView.schemaVersion, 1);
  assert.equal(final.data.officialPostingsView.schemaVersion, 1);
  assert.ok(final.data.officialPostingsView.postings.some((row) => row.id === "posting-player-current"));
});
