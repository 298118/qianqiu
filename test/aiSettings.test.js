const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildAiInvocationSummaryView,
  buildDefaultAiSettings,
  recordAiInvocation,
  redactAiSettingsForClient,
  resolveAiSettingsForSession,
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
