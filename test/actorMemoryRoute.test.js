const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

async function removeSession(sessionId) {
  if (!sessionId) return;
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
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

function assertHiddenSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /SEALED_|hiddenNotes|hiddenIntent|rawPrompt|provider proposal|prompt_retrieval_index|event_log|data\/sessions|file:\/\//i);
}

test("S70.12 game turn returns actor memory and session summary views", async (t) => {
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "记忆路由"
  });
  assert.equal(started.response.status, 201);
  sessionId = started.payload.sessionId;
  assert.equal(started.payload.actorMemoryView.schemaVersion, 1);
  assert.equal(started.payload.sessionSummaryView.schemaVersion, 1);
  assert.equal("actorMemoryLedger" in started.payload.worldState, false);
  assert.equal("sessionSummary" in started.payload.worldState, false);

  const worldState = await readSession(sessionId);
  worldState.month = 3;
  worldState.tenDayPeriod = 3;
  await writeSession(worldState);

  const turned = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId,
    input: "月末整理本署文书，顺带拜访赵给事。"
  });

  assert.equal(turned.response.status, 200);
  assert.equal(turned.payload.actorMemory.appliedCount > 0, true);
  assert.equal(turned.payload.sessionSummary.updated, true);
  assert.equal(turned.payload.sessionSummaryView.latest.periodKey, "1644-03");
  assert.ok(turned.payload.actorMemoryView.actors.length >= 1);
  assert.equal("actorMemoryLedger" in turned.payload.worldState, false);
  assert.equal("sessionSummary" in turned.payload.worldState, false);
  assert.equal(turned.payload.eventArchiveView.counts.actor_memory > 0, true);
  assert.equal(turned.payload.eventArchiveView.counts.session_summary > 0, true);
  assert.ok(turned.payload.aiInvocationSummaryView.recentInvocations.some((entry) =>
    entry.taskType === "memory_summarizer"
  ));
  assertHiddenSafe(turned.payload.actorMemoryView);
  assertHiddenSafe(turned.payload.sessionSummaryView);
});

test("S70.12 SSE preview includes memory and session summary views", async (t) => {
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "记忆流式"
  });
  sessionId = started.payload.sessionId;
  const worldState = await readSession(sessionId);
  worldState.month = 4;
  worldState.tenDayPeriod = 3;
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn?stream=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      sessionId,
      input: "月末办理本署旧案，并向上官回报。"
    })
  });

  assert.equal(response.status, 200);
  const events = parseSse(await response.text());
  const preview = events.find((event) => event.event === "state_preview" && event.data?.actorMemoryView);
  const finalState = events.find((event) => event.event === "final_state");

  assert.ok(preview);
  assert.ok(preview.data.sessionSummaryView.latest);
  assert.ok(finalState);
  assert.ok(finalState.data.actorMemoryView.actors.length >= 1);
  assert.equal(finalState.data.sessionSummary.updated, true);
  assert.equal("actorMemoryLedger" in finalState.data.worldState, false);
  assert.equal("sessionSummary" in finalState.data.worldState, false);
  assertHiddenSafe(preview.data.actorMemoryView);
});
