const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const aiRoutes = require("../src/routes/ai");
const gameRoutes = require("../src/routes/game");
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

function assertHiddenSafe(payload) {
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes("OPENAI_API_KEY"));
  assert.ok(!serialized.includes("MIMO_API_KEY"));
  assert.ok(!serialized.includes("rawPrompt"));
  assert.ok(!serialized.includes("raw provider"));
  assert.ok(!serialized.includes("baseURL"));
  assert.ok(!serialized.includes("data/sessions"));
}

test("S70.9 game start and state return AI settings and observability views", async (t) => {
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
    playerName: "AI 设置验收"
  });
  sessionId = started.payload.sessionId;

  assert.equal(started.response.status, 201);
  assert.equal(started.payload.aiSettingsView.schemaVersion, "s70.9-ai-settings.v1");
  assert.equal(started.payload.aiInvocationSummaryView.routeCostSummary.taskCount, 10);
  assert.equal(started.payload.aiControlAuditView.schemaVersion, "s71.11-ai-control-audit.v1");
  assert.equal(started.payload.aiControlAuditView.publicPanel.rejectedToolCallCount, 0);
  assert.ok(started.payload.aiInvocationSummaryView.recentInvocations.length >= 1);
  assertHiddenSafe(started.payload.aiSettingsView);
  assertHiddenSafe(started.payload.aiControlAuditView);

  const stateResponse = await fetch(`${server.baseUrl}/api/game/state/${sessionId}`);
  const statePayload = await stateResponse.json();
  assert.equal(stateResponse.status, 200);
  assert.equal(statePayload.aiSettingsView.preset, "balanced");
  assert.equal(statePayload.aiInvocationSummaryView.routeCostSummary.taskCount, 10);
  assert.equal(statePayload.aiControlAuditView.developerPanel.routeCostSummary.taskCount, 10);
  assertHiddenSafe(statePayload.aiInvocationSummaryView);
  assertHiddenSafe(statePayload.aiControlAuditView);

  const playerStateResponse = await fetch(`${server.baseUrl}/api/game/player-state/${sessionId}`);
  const playerStatePayload = await playerStateResponse.json();
  assert.equal(playerStateResponse.status, 200);
  assert.equal(playerStatePayload.aiControlAuditView.schemaVersion, "s71.11-ai-control-audit.v1");
  assertHiddenSafe(playerStatePayload.aiControlAuditView);
});

test("S70.9 settings route updates session route policy and rejects overreach", async (t) => {
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
    playerName: "AI 设置修改"
  });
  sessionId = started.payload.sessionId;

  const updated = await postJson(`${server.baseUrl}/api/ai/settings/${sessionId}`, {
    settings: {
      preset: "fast",
      controls: {
        outputScale: 0.7,
        maxConcurrency: 1,
        safetyStrictness: "strict",
        criticEnabled: false,
        safetyGateEnabled: true
      },
      taskRoutes: {
        narrator: {
          provider: "mock",
          model: "mock",
          maxOutputTokens: 888,
          toolBudget: 1,
          temperature: 0.2
        },
        safety_gate: {
          provider: "mock",
          model: "mock",
          toolBudget: 8
        }
      }
    }
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.aiSettingsView.preset, "fast");
  const narrator = updated.payload.aiSettingsView.taskRoutes.find((route) => route.taskType === "narrator");
  const safetyGate = updated.payload.aiSettingsView.taskRoutes.find((route) => route.taskType === "safety_gate");
  assert.equal(narrator.maxOutputTokens, 888);
  assert.equal(narrator.toolBudget, 1);
  assert.equal(safetyGate.toolBudget, 0);
  assert.equal(safetyGate.reviewerOnly, true);
  assert.equal(updated.payload.aiControlAuditView.schemaVersion, "s71.11-ai-control-audit.v1");
  assertHiddenSafe(updated.payload);

  const rejected = await postJson(`${server.baseUrl}/api/ai/settings/${sessionId}`, {
    settings: {
      mayWriteState: true,
      taskRoutes: {
        narrator: {
          provider: "mock",
          model: "server.resolve_case"
        }
      }
    }
  });

  assert.equal(rejected.response.status, 400);
  assert.match(rejected.payload.error, /禁止|server|AI 设置/);

  const rejectedDisabledRoute = await postJson(`${server.baseUrl}/api/ai/settings/${sessionId}`, {
    settings: {
      taskRoutes: {
        safety_gate: {
          enabled: false
        }
      }
    }
  });

  assert.equal(rejectedDisabledRoute.response.status, 400);
  assert.match(rejectedDisabledRoute.payload.error, /不支持字段|AI 路由|enabled/);
});

test("S70.9 game start rejects unsafe initial AI settings as bad request", async (t) => {
  const server = createTestServer();
  t.after(async () => {
    await server.close();
  });

  const rejected = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "AI 设置开局越权",
    aiSettings: {
      mayWriteState: true
    }
  });

  assert.equal(rejected.response.status, 400);
  assert.match(rejected.payload.error, /禁止|AI 设置/);
  assert.equal(rejected.payload.sessionId, undefined);
});

test("S70.9 turn payload includes updated AI settings and invocation summary", async (t) => {
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
    playerName: "AI 调动摘要"
  });
  sessionId = started.payload.sessionId;

  const turned = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId,
    input: "温习经义，向塾师请教。"
  });

  assert.equal(turned.response.status, 200);
  assert.equal(turned.payload.aiSettingsView.taskRoutes.length, 10);
  assert.ok(turned.payload.aiInvocationSummaryView.recentInvocations.length >= 2);
  assert.ok(turned.payload.aiInvocationSummaryView.routeCostSummary.maxOutputTokens > 0);
  assert.equal(turned.payload.aiControlAuditView.publicPanel.title, "AI 调动审计");
  assert.equal(turned.payload.aiControlAuditView.developerPanel.recentInvocations.length >= 2, true);
  assertHiddenSafe(turned.payload.aiInvocationSummaryView);
  assertHiddenSafe(turned.payload.aiControlAuditView);
});
