const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const examRoutes = require("../src/routes/exam");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const PASSING_ESSAY = "govern with rites, study the classics, preserve order, and care for the people. ".repeat(80);

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use("/api/exam", examRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return createFetchSafeServer(app);
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

function assertSafeMapRuntimePayload(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hiddenNotes|hiddenIntent|raw provider|raw coordinate|coordinateTable|latitude|longitude|world_sessions|prompt_retrieval_index|event_log|E:\\LSMNQ|data\/sessions|file:\/\/|OPENAI_API_KEY|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+/i
  );
}

function assertRenderableMapRuntimeView(view) {
  const refIds = new Set((view.refs || []).map((ref) => ref.mapEntityRef));
  assert.equal(view.schemaVersion, 1);
  assert.equal(view.layoutVersion, "ink-layout-v1");
  assert.equal(view.assetSetId, "ink-map-v1");
  assert.ok(view.refs.length > 0);
  assert.ok(refIds.has(view.viewportHint.centerRef));
  assert.ok(view.refs.every((ref) => ref.layout.x >= 0 && ref.layout.x <= 1));
  assert.ok(view.refs.every((ref) => ref.layout.y >= 0 && ref.layout.y <= 1));
  assertSafeMapRuntimePayload(view);
}

function makeReadyScholar() {
  const worldState = createInitialState({ playerName: "Map Runtime Exam Tester" });
  Object.assign(worldState.player, {
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100,
    gold: 100000
  });
  worldState.month = 1;
  return worldState;
}

test("S72.2 game start and player-state routes return redacted mapRuntimeView", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "Map Runtime Starter"
  });
  t.after(() => removeSessionFile(payload.sessionId));

  assert.equal(response.status, 201);
  assertRenderableMapRuntimeView(payload.mapRuntimeView);
  assert.ok(payload.mapRuntimeView.routes.some((route) => route.mapEntityRef === "map:geography:route:route-grand-canal-north"));

  const playerStateResponse = await fetch(`${server.baseUrl}/api/game/player-state/${payload.sessionId}`);
  const playerState = await playerStateResponse.json();
  assert.equal(playerStateResponse.status, 200);
  assert.equal(playerState.redaction.rawStateIncluded, false);
  assertRenderableMapRuntimeView(playerState.mapRuntimeView);
  assert.equal(JSON.stringify(playerState.worldState).includes("actorMemoryLedger"), false);
});

test("S72.2 SSE turn preview and final payload include mapRuntimeView", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "SSE Map Runtime Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "查看漕运与京师近况"
    })
  });
  const events = parseSse(await response.text());
  const preview = events.find((event) => event.event === "state_preview" && event.data?.mapRuntimeView);
  const final = events.find((event) => event.event === "final_state");

  assert.equal(response.status, 200);
  assert.ok(preview);
  assertRenderableMapRuntimeView(preview.data.mapRuntimeView);
  assertRenderableMapRuntimeView(final.data.mapRuntimeView);
});

test("S72.2 exam question, progress and submit routes keep mapRuntimeView available", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar();
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 201);
  assertRenderableMapRuntimeView(question.payload.mapRuntimeView);
  assert.ok(question.payload.mapRuntimeView.refs.some((ref) => ref.entityType === "exam_travel"));

  const progress = await postJson(`${server.baseUrl}/api/exam/progress`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    action: "拟纲定章法"
  });
  assert.equal(progress.response.status, 200);
  assertRenderableMapRuntimeView(progress.payload.mapRuntimeView);

  const submit = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });
  assert.equal(submit.response.status, 200);
  assertRenderableMapRuntimeView(submit.payload.mapRuntimeView);
  assert.equal(submit.payload.worldState.activeExam, null);
});
