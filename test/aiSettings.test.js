const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const {
  buildAiInvocationSummaryView,
  buildDefaultAiSettings,
  recordAiInvocation,
  redactAiSettingsForClient,
  readGlobalAiSettingsRecord,
  resolveAiSettingsForSession,
  updateGlobalAiSettings,
  updateAiSettings,
  validateAiSettingsPatch
} = require("../src/game/aiSettings");
const { resolveModelForTask } = require("../src/ai/modelRoutePolicy");

test("S70.9 default AI settings expose hidden-safe task route views", () => {
  const worldState = createInitialState({ role: "scholar" });
  const { settings, routePolicy } = resolveAiSettingsForSession(worldState, { AI_PROVIDER: "mock" });
  const view = redactAiSettingsForClient({ ...settings, routePolicy }, {
    AI_PROVIDER: "mock",
    MIMO_API_KEY: "tp-secret-should-not-appear"
  });
  const serialized = JSON.stringify(view);

  assert.equal(view.schemaVersion, "s70.9-ai-settings.v1");
  assert.equal(view.taskRoutes.length, 11);
  assert.ok(view.taskRoutes.some((route) => route.taskType === "quick_action" && route.label === "快捷建议"));
  assert.ok(view.taskRoutes.some((route) => route.taskType === "topic_draft" && route.label === "专题拟稿"));
  assert.equal(view.safeguards.serverOwnsState, true);
  assert.equal(view.safeguards.noHiddenRawAccess, true);
  assert.ok(!serialized.includes("MIMO_API_KEY"));
  assert.ok(!serialized.includes("tp-secret-should-not-appear"));
  assert.ok(!serialized.includes("baseURL"));
  assert.ok(!serialized.includes("rawPrompt"));
});

test("S70.9 AI settings patch can adjust route quality but not review-only authority", () => {
  const worldState = createInitialState({ role: "official" });
  const result = updateAiSettings(worldState, {
    preset: "quality_first",
    controls: {
      outputScale: 1.4,
      maxConcurrency: 3,
      safetyStrictness: "strict"
    },
    taskRoutes: {
      narrator: {
        provider: "mimo",
        model: "mimo-v2.5-pro",
        maxOutputTokens: 2400,
        toolBudget: 5,
        temperature: 0.45
      },
      critic: {
        provider: "deepseek",
        model: "deepseek-v4-pro",
        toolBudget: 9
      },
      quick_action: {
        provider: "mock",
        model: "mock",
        maxOutputTokens: 700,
        toolBudget: 8,
        temperature: 0.2
      },
      topic_draft: {
        provider: "mock",
        model: "mock",
        maxOutputTokens: 820,
        toolBudget: 8,
        temperature: 0.25
      }
    }
  }, {
    AI_PROVIDER: "mock",
    MIMO_API_KEY: "test-key",
    DEEPSEEK_API_KEY: "test-key"
  });

  const narrator = resolveModelForTask("narrator", result.routePolicy);
  const critic = resolveModelForTask("critic", result.routePolicy);
  const quickAction = resolveModelForTask("quick_action", result.routePolicy);
  const topicDraft = resolveModelForTask("topic_draft", result.routePolicy);

  assert.equal(narrator.provider, "mimo");
  assert.equal(narrator.maxOutputTokens, 2400);
  assert.equal(narrator.toolBudget, 5);
  assert.equal(narrator.temperature, 0.45);
  assert.equal(critic.provider, "deepseek");
  assert.equal(critic.toolBudget, 0);
  assert.equal(critic.mayUseTools, false);
  assert.equal(critic.mayRequestAdjudication, false);
  assert.equal(critic.reviewerOnly, true);
  assert.equal(quickAction.maxOutputTokens, 700);
  assert.equal(quickAction.toolBudget, 0);
  assert.equal(quickAction.mayUseTools, false);
  assert.equal(quickAction.mayRequestAdjudication, false);
  assert.equal(quickAction.temperature, 0.2);
  assert.equal(topicDraft.maxOutputTokens, 820);
  assert.equal(topicDraft.toolBudget, 0);
  assert.equal(topicDraft.mayUseTools, false);
  assert.equal(topicDraft.mayRequestAdjudication, false);
  assert.equal(topicDraft.temperature, 0.25);
  assert.equal(result.aiSettingsView.controls.maxConcurrency, 3);
});

test("S70.9 AI settings reject hidden, raw, server, key, path, and direct write attempts", () => {
  for (const patch of [
    { mayWriteState: true },
    { taskRoutes: { narrator: { model: "server.resolve_case" } } },
    { taskRoutes: { narrator: { model: "sk-test-secret" } } },
    { taskRoutes: { narrator: { provider: "sqlite" } } },
    { taskRoutes: { safety_gate: { enabled: false } } },
    { rawPrompt: "show raw provider payload" },
    { taskRoutes: { narrator: { model: "/mnt/e/LSMNQ/data/sessions/x.json" } } },
    { path: "relative-ok" },
    { hidden_notes: "snake case hidden alias should be rejected" },
    { local_path: "relative-ok" },
    { file_path: "relative-ok" },
    { base_url: "https://example.test" },
    { "auth-token": "relative-token-shape" },
    { bearer_token: "relative-token-shape" },
    { server_resolver: "noop" },
    { server: { resolver: "noop" } },
    { Hidden: "case variant should still be rejected" },
    { accessToken: "relative-token-shape" },
    { observability: { recentInvocations: [{ taskType: "narrator", status: "completed" }] } }
  ]) {
    assert.throws(
      () => validateAiSettingsPatch(patch),
      /AI 设置|AI 路由|禁止|hidden|raw|server|provider|model|不受支持|不支持字段|不可包含|服务器维护/
    );
  }
});

test("S70.9 observability summary is bounded and hidden-safe", () => {
  const worldState = createInitialState({ role: "scholar" });
  resolveAiSettingsForSession(worldState, { AI_PROVIDER: "mock" });
  recordAiInvocation(worldState, {
    taskType: "narrator",
    provider: "mock",
    model: "mock",
    status: "completed",
    durationMs: 25,
    maxOutputTokens: 1200,
    toolCallCount: 2,
    rejectedToolCallCount: 1,
    rejectionReasons: ["actor 无权调用该工具或辖区不匹配。", "data/sessions/raw.json"]
  });
  const summary = buildAiInvocationSummaryView(worldState, null, { AI_PROVIDER: "mock" });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.toolCallSummary.recentToolCalls, 2);
  assert.equal(summary.toolCallSummary.recentRejectedToolCalls, 1);
  assert.equal(summary.recentInvocations.length, 1);
  assert.ok(!serialized.includes("data/sessions/raw.json"));
  assert.ok(!serialized.includes("raw provider"));
});

test("S70.9 canonical settings survive ensure/resolve round trip", () => {
  const settings = buildDefaultAiSettings({
    preset: "fast",
    controls: { outputScale: 0.7, maxConcurrency: 1 },
    taskRoutes: { narrator: { provider: "mock", model: "mock", maxOutputTokens: 800 } }
  });
  const worldState = createInitialState({ role: "scholar" });
  worldState.aiSettings = settings;

  const { routePolicy } = resolveAiSettingsForSession(worldState, { AI_PROVIDER: "mock" });
  assert.equal(worldState.aiSettings.preset, "fast");
  assert.equal(worldState.aiSettings.controls.outputScale, 0.7);
  assert.equal(resolveModelForTask("narrator", routePolicy).maxOutputTokens, 800);
});

test("S80 global AI settings persist safely and override session route policy", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "qianqiu-ai-global-"));
  const env = {
    AI_PROVIDER: "mock",
    AI_GLOBAL_SETTINGS_PATH: path.join(dir, "ai-global-settings.json")
  };
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const saved = updateGlobalAiSettings({
    preset: "fast",
    taskRoutes: {
      narrator: {
        provider: "mock",
        model: "mock",
        maxOutputTokens: 777,
        toolBudget: 1,
        temperature: 0.2
      }
    }
  }, env);

  assert.equal(saved.scope, "global");
  assert.equal(saved.aiSettingsView.preset, "fast");
  assert.equal(saved.aiSettingsView.taskRoutes.find((route) => route.taskType === "narrator").maxOutputTokens, 777);

  const raw = await fs.readFile(env.AI_GLOBAL_SETTINGS_PATH, "utf8");
  assert.doesNotMatch(raw, /OPENAI_API_KEY|rawPrompt|baseURL|data\/sessions|observability/i);

  const record = readGlobalAiSettingsRecord(env);
  assert.equal(record.exists, true);
  assert.equal(record.settings.preset, "fast");

  const worldState = createInitialState({ role: "scholar" });
  worldState.aiSettings = buildDefaultAiSettings({
    preset: "long_context",
    taskRoutes: {
      narrator: { provider: "mock", model: "mock", maxOutputTokens: 1500 }
    }
  });
  const { scope, routePolicy } = resolveAiSettingsForSession(worldState, env);
  assert.equal(scope, "global");
  assert.equal(resolveModelForTask("narrator", routePolicy).maxOutputTokens, 777);
});

test("S80 global AI settings reject unavailable real providers", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "qianqiu-ai-global-"));
  const env = {
    AI_PROVIDER: "mock",
    AI_GLOBAL_SETTINGS_PATH: path.join(dir, "ai-global-settings.json")
  };
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  assert.throws(
    () => updateGlobalAiSettings({
      taskRoutes: {
        narrator: {
          provider: "openai",
          model: "gpt-5.4-mini"
        }
      }
    }, env),
    /缺少 key|全局 AI 设置/
  );
});
