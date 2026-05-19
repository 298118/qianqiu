const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const { createInitialState } = require("../src/game/initialState");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

function sessionPath(sessionId) {
  return path.join(sessionsDir, `${sessionId}.json`);
}

async function removeSessionArtifacts(sessionId) {
  if (!sessionId) return;
  await Promise.all([
    fs.rm(sessionPath(sessionId), { force: true }),
    fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true }),
    fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true })
  ]);
}

async function createStoredSession(input = {}) {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "专题拟稿测试",
    ...input
  });
  await writeSession(worldState);
  return worldState;
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", require("../src/routes/ai"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

function createTestServerWithProvider(provider) {
  const aiPath = require.resolve("../src/ai");
  const aiRoutePath = require.resolve("../src/routes/ai");
  const originalAiModule = require.cache[aiPath];
  const originalAiRouteModule = require.cache[aiRoutePath];

  delete require.cache[aiRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const app = express();
  app.use(express.json());
  app.use("/api/ai", require("../src/routes/ai"));
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  const testServer = createFetchSafeServer(app);

  return {
    baseUrl: testServer.baseUrl,
    async close() {
      await testServer.close();
      delete require.cache[aiRoutePath];
      if (originalAiRouteModule) require.cache[aiRoutePath] = originalAiRouteModule;
      if (originalAiModule) require.cache[aiPath] = originalAiModule;
      else delete require.cache[aiPath];
    }
  };
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function assertNoSensitiveText(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hidden[ _-]?(?:notes?|intent)?|raw[ _-]?(?:provider|payload|prompt|audit|table|ledger|state|row)|provider\s+payload|prompt|完整提示词|localPath|file:\/\/|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|opt|workspace)\/|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i
  );
}

function assertTopicDraftEnvelope(payload, options = {}) {
  const { sessionId, source, status = "ready", surfaceId = "court-debate" } = options;
  assert.equal(payload.schemaVersion, "s78.topicDraft.v1");
  if (sessionId) assert.equal(payload.sessionId, sessionId);
  assert.equal(payload.surfaceId, surfaceId);
  if (source) assert.equal(payload.source, source);
  assert.equal(payload.status, status);
  assert.equal(payload.topicDraft.surfaceId, surfaceId);
  if (source) assert.equal(payload.topicDraft.source, source);
  assert.equal(typeof payload.topicDraft.draftTitle, "string");
  assert.equal(typeof payload.topicDraft.draftText, "string");
  assert.ok(payload.topicDraft.draftTitle.length > 0);
  assert.ok(payload.topicDraft.draftText.length > 0);
  assert.ok(Array.isArray(payload.topicDraft.evidenceRefs));
  assert.ok(payload.topicDraft.evidenceRefs.length <= 5);
  assertNoSensitiveText(payload);
}

test("POST /api/ai/topic-draft/:sessionId returns safe mock topic draft", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "emperor", playerName: "朱批测试" });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "edict-draft" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "edict-draft",
    draftKind: view.draftSlots[0].draftKind,
    selectedEvidenceRefs: view.evidenceRefs.slice(0, 2).map((ref) => ref.refId),
    playerNote: "措辞宜缓。"
  });

  assert.equal(response.status, 200);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    surfaceId: "edict-draft"
  });
  assert.match(payload.topicDraft.draftText, /所据|公开材料|裁决/);
});

test("POST /api/ai/topic-draft/:sessionId is read-only for session files", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "general", playerName: "军议测试" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const beforeRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "war-council"
  });
  const afterRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");

  assert.equal(response.status, 200);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    surfaceId: "war-council"
  });
  assert.equal(afterRaw, beforeRaw);
});

test("POST /api/ai/topic-draft/:sessionId sends only safe surface context to provider", async (t) => {
  let providerContext = null;
  const provider = {
    modelRoute: { provider: "openai" },
    async draftTopicSurface(context) {
      providerContext = context;
      assert.equal(context.surfaceId, "trial");
      assert.equal(context.player.role, "magistrate");
      assert.ok(context.evidenceRefs.length >= 1);
      assertNoSensitiveText(context);
      return {
        source: "provider-ai",
        surfaceId: "trial",
        draftKind: context.draftKind,
        draftTitle: "复核证据",
        draftText: "本官拟据公开案牍升堂复核，先问原告、保甲与书吏，再请上司按例裁示。",
        evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
        riskNote: "若证据互相抵牾，宜先缓审。",
        nextStep: "写入底部奏折后再呈上。"
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "杜明府" });
  const view = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
    surfaceId: "trial",
    selectedEvidenceRefs: [view.evidenceRefs[0].refId],
    worldState: { player: { role: "emperor" }, hiddenNotes: "SEALED_BROWSER" },
    providerPayload: "raw provider prompt sk-browser-secret-123456"
  });

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  assertTopicDraftEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "provider-ai",
    surfaceId: "trial"
  });
  assert.doesNotMatch(JSON.stringify(payload), /SEALED_BROWSER|sk-browser-secret|emperor/i);
});

test("POST /api/ai/topic-draft/:sessionId falls back for provider failure and unsafe drafts", async (t) => {
  const cases = [
    {
      name: "provider throws",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface() {
          throw new Error("raw provider payload sk-provider-secret-123456 data/sessions/private.json");
        }
      })
    },
    {
      name: "bad JSON-shaped payload",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface() {
          return "not-json";
        }
      })
    },
    {
      name: "forged evidence",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "伪造证据",
            draftText: "据公开材料拟成草稿，仍候主卷裁决。",
            evidenceRefs: ["provider-forged-secret-ref"],
            riskNote: "无",
            nextStep: "写入草稿。"
          };
        }
      })
    },
    {
      name: "resolved outcome claim",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "已裁决",
            draftText: "已经结案并任命官员，军令已经生效。",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "无",
            nextStep: "无"
          };
        }
      })
    },
    {
      name: "polluted text",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "raw provider",
            draftText: "读取 hidden raw provider prompt data/sessions/private.json sk-provider-secret-123456",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "raw",
            nextStep: "prompt"
          };
        }
      })
    },
    {
      name: "bare provider prompt terms",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async draftTopicSurface(context) {
          return {
            source: "provider-ai",
            surfaceId: context.surfaceId,
            draftKind: context.draftKind,
            draftTitle: "疑似外部词",
            draftText: "此稿提及 provider prompt，但没有进入 raw 词组。",
            evidenceRefs: context.selectedEvidenceRefs.slice(0, 1),
            riskNote: "provider",
            nextStep: "prompt"
          };
        }
      })
    }
  ];

  for (const entry of cases) {
    await t.test(entry.name, async (t) => {
      const server = createTestServerWithProvider(entry.buildProvider());
      const worldState = await createStoredSession({ role: "official", playerName: `降级${entry.name}` });
      t.after(async () => {
        await removeSessionArtifacts(worldState.sessionId);
        await server.close();
      });

      const { response, payload } = await postJson(`${server.baseUrl}/api/ai/topic-draft/${worldState.sessionId}`, {
        surfaceId: "court-debate"
      });

      assert.equal(response.status, 200);
      assertTopicDraftEnvelope(payload, {
        sessionId: worldState.sessionId,
        source: "local-rule",
        status: "fallback",
        surfaceId: "court-debate"
      });
      assert.equal(payload.fallbackReason, "topic_draft_provider_failed");
      assert.doesNotMatch(JSON.stringify(payload), /sk-provider-secret|provider-forged-secret-ref|raw provider payload|provider prompt|data\/sessions/i);
    });
  }
});
