const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const devRoutes = require("../src/routes/dev");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const ENV_KEYS = ["PORT", "CORS_ALLOWED_ORIGINS", "ENABLE_DEV_DIAGNOSTICS", "NODE_ENV"];

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

async function withEnv(env, callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      process.env[key] = env[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/dev", devRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error"
    });
  });

  return createFetchSafeServer(app);
}

function createPollutedWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "诊断巡按"
  });

  worldState.eventHistory.push(
    "公开奏报：巡按核验仓储。",
    "SEALED_DIAGNOSTIC_EVENT event_log ai_change_proposals world_state_json sk-redacted-route-secret"
  );
  worldState.hiddenNotes = "SEALED_DIAGNOSTIC_NOTE";
  worldState.rawProviderPayload = {
    prompt: "prompt_retrieval_index",
    localPath: "/mnt/e/LSMNQ/data/sessions/secret.json"
  };
  worldState.relationshipLedger.privateNotes = ["SEALED_RELATIONSHIP_NOTE"];
  worldState.actorMemoryLedger = {
    actors: {
      npc: {
        hiddenNotes: "SEALED_MEMORY_NOTE"
      }
    }
  };
  worldState.sessionSummary = {
    privateSummary: "SEALED_SESSION_SUMMARY"
  };

  return worldState;
}

test("S71.4 dev diagnostics route is disabled by default", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  await withEnv({ PORT: "3333" }, async () => {
    const response = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/missing-session`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /未启用/);
  });
});

test("S71.4 dev diagnostics route stays disabled in production", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  await withEnv({
    PORT: "3333",
    ENABLE_DEV_DIAGNOSTICS: "true",
    NODE_ENV: "production"
  }, async () => {
    const response = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/missing-session`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /未启用/);
  });
});

test("S71.4 dev diagnostics rejects hostile and non-local configured origins", async (t) => {
  const worldState = createPollutedWorldState();
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const server = createTestServer();
  t.after(server.close);

  await withEnv({
    PORT: "3333",
    CORS_ALLOWED_ORIGINS: "https://tools.example",
    ENABLE_DEV_DIAGNOSTICS: "true"
  }, async () => {
    const hostile = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/${worldState.sessionId}`, {
      headers: { Origin: "http://malicious.example" }
    });
    const configuredRemote = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/${worldState.sessionId}`, {
      headers: { Origin: "https://tools.example" }
    });

    assert.equal(hostile.status, 403);
    assert.equal(configuredRemote.status, 403);
  });
});

test("S71.4 dev diagnostics rejects no Origin requests from non-loopback clients", async () => {
  const req = {
    get: () => undefined,
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.10" }
  };

  assert.throws(
    () => devRoutes.assertDevDiagnosticsAccess(req, {
      PORT: "3333",
      ENABLE_DEV_DIAGNOSTICS: "true"
    }),
    (error) => error.statusCode === 403 && /仅允许本机/.test(error.message)
  );
});

test("S71.4 dev diagnostics allows no Origin and local app Origin without leaking raw state", async (t) => {
  const worldState = createPollutedWorldState();
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const server = createTestServer();
  t.after(server.close);

  await withEnv({
    PORT: "3333",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    ENABLE_DEV_DIAGNOSTICS: "true"
  }, async () => {
    const noOrigin = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/${worldState.sessionId}`);
    const noOriginPayload = await noOrigin.json();
    const localOrigin = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/${worldState.sessionId}`, {
      headers: { Origin: "http://localhost:5173" }
    });
    const localPayload = await localOrigin.json();
    const serialized = JSON.stringify([noOriginPayload, localPayload]);

    assert.equal(noOrigin.status, 200);
    assert.equal(localOrigin.status, 200);
    assert.equal(noOriginPayload.source, "server_hidden_safe_developer_diagnostics");
    assert.equal(localPayload.source, "server_hidden_safe_developer_diagnostics");
    assert.equal(noOriginPayload.storage.adapter, "json");
    assert.equal(noOriginPayload.counts.eventHistory, 2);
    assert.equal(noOriginPayload.safety.stateSnapshotIncluded, false);
    assert.equal(noOriginPayload.safety.auditRowsIncluded, false);
    assert.equal(noOriginPayload.safety.modelPayloadIncluded, false);
    assert.doesNotMatch(
      serialized,
      /SEALED_|event_log|ai_change_proposals|world_state_json|prompt_retrieval_index|safe_search_index|safe_search_fts|rawProviderPayload|relationshipLedger|actorMemoryLedger|sessionSummary|sk-redacted-route-secret|\/mnt\/e\/LSMNQ|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
    );
  });
});

test("S71.4 dev diagnostics reports missing sessions only after access gates pass", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  await withEnv({
    PORT: "3333",
    ENABLE_DEV_DIAGNOSTICS: "true"
  }, async () => {
    const response = await fetch(`${server.baseUrl}/api/dev/session-diagnostics/00000000-0000-4000-8000-000000000000`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /Session not found|not found/i);
  });
});
