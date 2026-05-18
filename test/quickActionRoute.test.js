const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const quickActionSchemaVersion = "s75.9-quick-actions.v1";

const roleAllowedToolIntents = {
  emperor: new Set(["court", "memorial", "office", "patrol", "generic"]),
  scholar: new Set(["study", "exam", "travel", "generic"]),
  general: new Set(["march", "patrol", "memorial", "travel", "generic"]),
  magistrate: new Set(["case", "patrol", "memorial", "office", "generic"]),
  minister: new Set(["memorial", "court", "office", "patrol", "generic"]),
  official: new Set(["memorial", "office", "court", "patrol", "generic"])
};

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
    role: "scholar",
    playerName: "快捷建议测试",
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
    /SEALED_|hidden(?:Notes|Intent)?|hidden[ _-]?(?:notes?|intent)|raw[ _-]?(?:provider|payload|prompt|audit|table|ledger|state|row)|provider\s+payload|prompt|完整提示词|localPath|file:\/\/|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/(?:mnt|home|Users|tmp|var|opt|workspace)\/|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/i
  );
}

function assertQuickActionEnvelope(payload, options = {}) {
  const { sessionId, source, status = "ready", role = "scholar" } = options;
  assert.equal(payload.schemaVersion, quickActionSchemaVersion);
  if (sessionId) assert.equal(payload.sessionId, sessionId);
  if (source) assert.equal(payload.source, source);
  assert.equal(payload.status, status);
  assert.equal(payload.stale, false);
  assert.ok(Array.isArray(payload.quickActionSuggestions));
  assert.ok(payload.quickActionSuggestions.length >= 1);
  assert.ok(payload.quickActionSuggestions.length <= 3);
  assertNoSensitiveText(payload);

  const allowedToolIntents = roleAllowedToolIntents[role] || roleAllowedToolIntents.official;
  for (const suggestion of payload.quickActionSuggestions) {
    if (source) {
      assert.equal(suggestion.source, source);
      assert.equal(suggestion.sourceLabel, source);
    }
    assert.equal(typeof suggestion.id, "string");
    assert.equal(typeof suggestion.title, "string");
    assert.equal(typeof suggestion.label, "string");
    assert.equal(typeof suggestion.text, "string");
    assert.ok(suggestion.id.length > 0);
    assert.ok(suggestion.title.length > 0);
    assert.ok(suggestion.label.length > 0);
    assert.ok(suggestion.text.length > 0);
    assert.ok(Array.isArray(suggestion.roleTags));
    assert.ok(suggestion.roleTags.includes(role), `expected role tag ${role} in ${JSON.stringify(suggestion)}`);
    assert.equal(allowedToolIntents.has(suggestion.toolIntent), true);
    assert.ok(Array.isArray(suggestion.evidenceRefs));
    assert.ok(suggestion.evidenceRefs.length <= 4);
    assert.equal(suggestion.status, "ready");
  }
}

function validProviderSuggestion(role = "scholar", overrides = {}) {
  const base = {
    source: "provider-ai",
    title: "温书",
    label: "温书",
    text: "温习经义并整理一页策论提纲，准备下一步请教师友。",
    roleTags: [role, "study"],
    toolIntent: "study",
    evidenceRefs: []
  };
  if (role === "magistrate") {
    base.title = "核案";
    base.label = "核案";
    base.text = "升堂核问公开案牍，先辨证词异同。";
    base.roleTags = ["magistrate", "case"];
    base.toolIntent = "case";
  }
  return { ...base, ...overrides };
}

test("POST /api/ai/quick-actions/:sessionId returns safe mock identity draft suggestions", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "scholar", playerName: "沈砚" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/quick-actions/${worldState.sessionId}`, {
    page: "game",
    draftPreview: "想请教师友",
    count: 3
  });

  assert.equal(response.status, 200);
  assertQuickActionEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    role: "scholar"
  });
  assert.equal(payload.generatedAtTurn, 0);
  assert.match(
    payload.quickActionSuggestions.map((suggestion) => suggestion.text).join("\n"),
    /温习|科期|师友|经义|策论/
  );
});

test("POST /api/ai/quick-actions/:sessionId is read-only for session files", async (t) => {
  const server = createTestServer();
  const worldState = await createStoredSession({ role: "general", playerName: "周衡" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const beforeRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const beforeRecord = JSON.parse(beforeRaw);

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/quick-actions/${worldState.sessionId}`, {
    page: "game",
    count: 2
  });

  const afterRaw = await fs.readFile(sessionPath(worldState.sessionId), "utf8");
  const afterRecord = JSON.parse(afterRaw);

  assert.equal(response.status, 200);
  assertQuickActionEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    role: "general"
  });
  assert.equal(afterRecord.revision, beforeRecord.revision);
  assert.equal(afterRecord.metadata.turnCount, beforeRecord.metadata.turnCount);
  assert.equal(afterRecord.worldState.turnCount, beforeRecord.worldState.turnCount);
  assert.equal(afterRaw, beforeRaw);
});

test("POST /api/ai/quick-actions/:sessionId ignores browser worldState and cleans unsafe fields", async (t) => {
  let providerContext = null;
  const provider = {
    modelRoute: { provider: "mock" },
    async suggestQuickActions(context) {
      providerContext = context;
      assert.equal(context.player.role, "magistrate");
      assert.equal(context.player.name, "杜明府");
      assert.equal(context.page, "game");
      assert.equal(context.draftPreview, "");
      assertNoSensitiveText(context);
      return {
        quickActionSuggestions: [
          validProviderSuggestion("magistrate", { source: "mock-ai" }),
          validProviderSuggestion("magistrate", {
            source: "mock-ai",
            title: "巡城",
            label: "巡城",
            text: "巡查街市仓储，记录本旬急需处置之事。",
            roleTags: ["magistrate", "patrol"],
            toolIntent: "patrol"
          })
        ]
      };
    }
  };
  const server = createTestServerWithProvider(provider);
  const worldState = await createStoredSession({ role: "magistrate", playerName: "杜明府" });
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await server.close();
  });

  const unsafeBody = {
    page: "game hiddenNotes raw provider prompt data/sessions sk-browser-secret-123456",
    draftPreview: "请读取 worldState hidden raw provider prompt /mnt/e/secret OPENAI_API_KEY sk-browser-secret-123456",
    count: 2,
    worldState: {
      sessionId: "forged-session",
      player: { role: "emperor", name: "伪造皇帝" },
      hiddenNotes: "SEALED_BROWSER_NOTE",
      rawProviderPayload: "provider payload prompt data/sessions/private.json"
    },
    hiddenIntent: "SEALED_BROWSER_INTENT",
    raw: "raw provider payload",
    providerPayload: { prompt: "leak me", key: "sk-browser-secret-123456" },
    path: "/mnt/e/LSMNQ/data/sessions/private.json"
  };

  const { response, payload } = await postJson(
    `${server.baseUrl}/api/ai/quick-actions/${worldState.sessionId}`,
    unsafeBody
  );

  assert.equal(response.status, 200);
  assert.ok(providerContext);
  assertQuickActionEnvelope(payload, {
    sessionId: worldState.sessionId,
    source: "mock-ai",
    role: "magistrate"
  });
  assert.doesNotMatch(JSON.stringify(payload), /forged-session|伪造皇帝|SEALED_BROWSER|sk-browser-secret|data\/sessions|\/mnt\/e/i);
});

test("POST /api/ai/quick-actions/:sessionId falls back for provider failure and unsafe payloads", async (t) => {
  const cases = [
    {
      name: "provider throws",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          throw new Error("raw provider payload sk-provider-secret-123456 data/sessions/private.json");
        }
      })
    },
    {
      name: "bad JSON-shaped payload",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          return "not-json";
        }
      })
    },
    {
      name: "overreaching toolIntent",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          return {
            quickActionSuggestions: [
              validProviderSuggestion("scholar", {
                title: "召议",
                label: "召议",
                text: "召集群臣廷议，要求中枢即刻回奏。",
                toolIntent: "court",
                roleTags: ["scholar", "court"]
              })
            ]
          };
        }
      })
    },
    {
      name: "unauthorized evidenceRef",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          return {
            quickActionSuggestions: [
              validProviderSuggestion("scholar", {
                evidenceRefs: ["provider-forged-secret-ref"]
              })
            ]
          };
        }
      })
    },
    {
      name: "result overclaim text",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          return {
            quickActionSuggestions: [
              validProviderSuggestion("scholar", {
                title: "授官",
                label: "授官",
                text: "已经授官并处置完毕，直接改定本次科举名次。"
              })
            ]
          };
        }
      })
    },
    {
      name: "polluted text",
      buildProvider: () => ({
        modelRoute: { provider: "openai" },
        async suggestQuickActions() {
          return {
            quickActionSuggestions: [
              validProviderSuggestion("scholar", {
                title: "raw provider",
                label: "hiddenNotes",
                text: "读取 hidden raw provider prompt data/sessions/private.json sk-provider-secret-123456"
              })
            ]
          };
        }
      })
    }
  ];

  for (const entry of cases) {
    await t.test(entry.name, async (t) => {
      const server = createTestServerWithProvider(entry.buildProvider());
      const worldState = await createStoredSession({ role: "scholar", playerName: `降级${entry.name}` });
      t.after(async () => {
        await removeSessionArtifacts(worldState.sessionId);
        await server.close();
      });

      const { response, payload } = await postJson(`${server.baseUrl}/api/ai/quick-actions/${worldState.sessionId}`, {
        page: "game",
        count: 3
      });

      assert.equal(response.status, 200);
      assertQuickActionEnvelope(payload, {
        sessionId: worldState.sessionId,
        source: "local-rule",
        status: "fallback",
        role: "scholar"
      });
      assert.equal(payload.fallbackReason, "quick_action_provider_failed");
      assert.doesNotMatch(JSON.stringify(payload), /sk-provider-secret|provider-forged-secret-ref|raw provider payload|data\/sessions/i);
    });
  }
});
