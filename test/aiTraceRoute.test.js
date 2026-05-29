const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const aiRoutes = require("../src/routes/ai");
const gameRoutes = require("../src/routes/game");
const { assertPublicAiTaskTrace } = require("../src/ai/runtime/aiTaskTrace");
const { defineAiTraceDebugResponse } = require("../src/routes/routeResponses");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use("/api/ai", aiRoutes);
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

async function useTempGlobalAiSettings(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "qianqiu-ai-trace-route-"));
  const previous = process.env.AI_GLOBAL_SETTINGS_PATH;
  process.env.AI_GLOBAL_SETTINGS_PATH = path.join(dir, "ai-global-settings.json");
  t.after(async () => {
    if (previous === undefined) delete process.env.AI_GLOBAL_SETTINGS_PATH;
    else process.env.AI_GLOBAL_SETTINGS_PATH = previous;
    await fs.rm(dir, { recursive: true, force: true });
  });
}

function assertTracePayloadSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /rawPrompt|fullPrompt|providerPayload|rawProviderPayload|worldState|statePatch|baseURL|baseUrl|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/]sessions|rawSql|world_sessions|server\./i);
}

function buildEmptyTraceDebugResponse(overrides = {}) {
  return {
    sessionId: "s92-9-helper",
    aiTraceDebugView: {
      schemaVersion: "s92.9-ai-trace-debug-view.v1",
      sessionId: "s92-9-helper",
      generatedAtTurn: 1,
      traceCount: 0,
      traces: [],
      feedbackOptions: [
        { id: "useful", label: "有用" },
        { id: "off_tone", label: "出戏" },
        { id: "forgot_context", label: "忘记前情" },
        { id: "too_short", label: "太短" },
        { id: "too_long", label: "太长" },
        { id: "role_mismatch", label: "不符合身份" }
      ],
      recentFeedback: [],
      safety: {
        publicSummaryOnly: true,
        providerTextIncluded: false,
        localFilesIncluded: false,
        secretValuesIncluded: false,
        browserAdjudication: false,
        feedbackChangesGameState: false
      },
      ...overrides
    }
  };
}

test("S92.9 public trace endpoint returns bounded summaries and records feedback", async (t) => {
  await useTempGlobalAiSettings(t);
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "回声面板"
  });
  sessionId = started.payload.sessionId;
  assert.equal(started.response.status, 201);

  const turned = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId,
    input: "温习经义，请塾师讲解一段。"
  });
  assert.equal(turned.response.status, 200);

  const traceResponse = await fetch(`${server.baseUrl}/api/ai/public-traces/${sessionId}`);
  const tracePayload = await traceResponse.json();
  assert.equal(traceResponse.status, 200);
  assert.equal(tracePayload.sessionId, sessionId);
  assert.equal(tracePayload.aiTraceDebugView.schemaVersion, "s92.9-ai-trace-debug-view.v1");
  assert.ok(tracePayload.aiTraceDebugView.traces.length >= 1);
  assert.deepEqual(
    tracePayload.aiTraceDebugView.feedbackOptions.map((option) => option.label),
    ["有用", "出戏", "忘记前情", "太短", "太长", "不符合身份"]
  );
  for (const trace of tracePayload.aiTraceDebugView.traces) {
    assertPublicAiTaskTrace(trace);
  }
  assertTracePayloadSafe(tracePayload);

  const traceId = tracePayload.aiTraceDebugView.traces.at(-1).traceId;
  const feedback = await postJson(`${server.baseUrl}/api/ai/public-traces/${sessionId}/feedback`, {
    traceId,
    feedbackId: "useful"
  });
  assert.equal(feedback.response.status, 200);
  assert.equal(feedback.payload.accepted, true);
  assert.equal(feedback.payload.feedback.traceId, traceId);
  assert.equal(feedback.payload.feedback.feedbackId, "useful");
  assert.equal(feedback.payload.feedback.changesGameState, false);
  assert.ok(feedback.payload.aiTraceDebugView.recentFeedback.some((entry) => (
    entry.traceId === traceId && entry.feedbackId === "useful"
  )));
  assertTracePayloadSafe(feedback.payload);

  const afterResponse = await fetch(`${server.baseUrl}/api/ai/public-traces/${sessionId}`);
  const afterPayload = await afterResponse.json();
  assert.equal(afterResponse.status, 200);
  assert.ok(afterPayload.aiTraceDebugView.recentFeedback.some((entry) => (
    entry.traceId === traceId && entry.feedbackId === "useful"
  )));
});

test("S92.9 trace feedback rejects unsafe fields and stale trace ids", async (t) => {
  await useTempGlobalAiSettings(t);
  const server = createTestServer();
  let sessionId = "";
  t.after(async () => {
    await removeSession(sessionId);
    await server.close();
  });

  const started = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "回声红队"
  });
  sessionId = started.payload.sessionId;

  const unsafe = await postJson(`${server.baseUrl}/api/ai/public-traces/${sessionId}/feedback`, {
    traceId: "ai-trace:0:narrator:0",
    feedbackId: "useful",
    rawPrompt: "完整提示词"
  });
  assert.equal(unsafe.response.status, 400);
  assert.match(unsafe.payload.error, /禁止字段|回声反馈/);
  assertTracePayloadSafe(unsafe.payload);

  const unsafeExtra = await postJson(`${server.baseUrl}/api/ai/public-traces/${sessionId}/feedback`, {
    traceId: "ai-trace:0:narrator:0",
    feedbackId: "useful",
    note: "server.rawSql world_sessions"
  });
  assert.equal(unsafeExtra.response.status, 400);
  assert.match(unsafeExtra.payload.error, /禁止字段|回声反馈/);
  assertTracePayloadSafe(unsafeExtra.payload);

  const stale = await postJson(`${server.baseUrl}/api/ai/public-traces/${sessionId}/feedback`, {
    traceId: "trace:not-current",
    feedbackId: "useful"
  });
  assert.equal(stale.response.status, 404);
  assert.match(stale.payload.error, /过期|刷新/);
  assertTracePayloadSafe(stale.payload);
});

test("S92.9 route response helper rejects unsafe debug view fields", () => {
  assert.throws(
    () => defineAiTraceDebugResponse(buildEmptyTraceDebugResponse({ rawRows: [] })),
    /禁止字段|forbidden/i
  );

  assert.throws(
    () => defineAiTraceDebugResponse(buildEmptyTraceDebugResponse({
      recentFeedback: [
        {
          schemaVersion: "s92.9-ai-trace-feedback.v1",
          feedbackRecordId: "feedback:1",
          traceId: "trace:1",
          taskType: "narrator",
          taskLabel: "叙事",
          feedbackId: "useful",
          label: "server.rawSql world_sessions",
          recordedTurn: 1,
          createdAt: "2026-05-29T12:00:00.000Z",
          changesGameState: false
        }
      ]
    })),
    /禁止文本|forbidden/i
  );

  for (const label of [
    "rawPrompt=完整提示词 SECRET",
    "providerPayload={}",
    "worldState={}",
    "baseURL=https://example.invalid"
  ]) {
    assert.throws(
      () => defineAiTraceDebugResponse(buildEmptyTraceDebugResponse({
        recentFeedback: [
          {
            schemaVersion: "s92.9-ai-trace-feedback.v1",
            feedbackRecordId: "feedback:1",
            traceId: "trace:1",
            taskType: "narrator",
            taskLabel: "叙事",
            feedbackId: "useful",
            label,
            recordedTurn: 1,
            createdAt: "2026-05-29T12:00:00.000Z",
            changesGameState: false
          }
        ]
      })),
      /禁止文本|forbidden/i
    );
  }
});
