const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDefaultModelRoutePolicy } = require("../src/ai/modelRoutePolicy");
const {
  createProviderFacadeAdapter,
  createRuntimeTaskEnvelope
} = require("../src/ai/providers/adapterContract");
const mockProvider = require("../src/ai/providers/mock");
const {
  assertAiTaskBudget,
  buildAiTaskBudget
} = require("../src/ai/runtime/aiBudgetManager");
const { buildAiFallbackPayload } = require("../src/ai/runtime/aiFallbackPolicy");
const {
  createAiTaskRuntime,
  runAiTask
} = require("../src/ai/runtime/aiTaskRuntime");
const { validatePayload } = require("../src/ai/schemas");

test("S92.2 AI task runtime runs mock opening through structured adapter", async () => {
  const runtime = createAiTaskRuntime();
  const result = await runtime.run("opening", {
    dynasty: "明",
    year: 1,
    player: { name: "顾慎", role: "scholar", roleLabel: "书生" },
    setup: {}
  }, {
    taskId: "opening-test"
  });

  assert.equal(result.status, "ok");
  assert.equal(result.fallback, false);
  assert.equal(validatePayload("opening", result.payload), result.payload);
  assert.equal(result.trace.taskKind, "opening");
  assert.equal(result.trace.provider, "mock");
  assert.equal(result.trace.validationFlags.schemaOk, true);
});

test("S92.2 AI task runtime supports mock quick_action and topic_draft schemas", async () => {
  const runtime = createAiTaskRuntime();
  const quick = await runtime.run("quick_action", {
    player: { role: "scholar" },
    evidenceRefs: [{ refId: "eventArchiveView:event-1", label: "县学札记" }]
  }, {
    taskId: "quick-test"
  });
  const topic = await runtime.run("topic_draft", {
    surfaceId: "court-debate",
    draftKind: "balanced_debate",
    draftLabel: "廷议草稿",
    evidenceRefs: [{ refId: "eventArchiveView:event-1", label: "粮价旁证" }]
  }, {
    taskId: "topic-test"
  });

  assert.equal(validatePayload("quickAction", quick.payload), quick.payload);
  assert.equal(validatePayload("topicDraft", topic.payload), topic.payload);
  assert.equal(quick.trace.toolCounts.allowed, 0);
  assert.equal(topic.trace.toolCounts.allowed, 0);
});

test("S92.2 AI task runtime falls back to schema-valid mock payload on adapter failure", async () => {
  const envelope = createRuntimeTaskEnvelope("quick_action", {
    player: { role: "official" },
    evidenceRefs: []
  }, {
    taskId: "fallback-test"
  });
  const adapter = {
    providerName: "mock",
    model: "mock",
    async generateStructured() {
      throw new Error("prompt=SECRET key=abc123 token=tok123 rawProviderPayload apiKey=sk-test-secret C:\\Users\\ZZZ\\Downloads\\payload.json");
    }
  };

  const result = await runAiTask(envelope, { adapter });
  const serializedTrace = JSON.stringify(result.trace);

  assert.equal(result.status, "fallback");
  assert.equal(result.fallback, true);
  assert.equal(validatePayload("quickAction", result.payload), result.payload);
  assert.doesNotMatch(serializedTrace, /SECRET|abc123|tok123|sk-test-secret|payload\.json|rawProviderPayload|apiKey|prompt=|key=|token=/);
});

test("S92.2 AI task runtime refuses non-mock route and non-mock adapter by default", async () => {
  const envelope = createRuntimeTaskEnvelope("opening", {
    dynasty: "明",
    year: 1,
    player: { name: "顾慎", role: "scholar", roleLabel: "书生" },
    setup: {}
  }, {
    taskId: "non-mock-test"
  });
  const routePolicy = buildDefaultModelRoutePolicy({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key"
  });
  let adapterTouched = false;
  const adapter = {
    providerName: "openai",
    model: "gpt-test",
    async generateStructured() {
      adapterTouched = true;
      return { payload: { narrative: "bad", events: [] } };
    }
  };

  const result = await runAiTask(envelope, { routePolicy, adapter });

  assert.equal(result.status, "fallback");
  assert.equal(adapterTouched, false);
  assert.equal(validatePayload("opening", result.payload), result.payload);
  assert.equal(result.fallbackReason, "safety_reject");
});

test("S92.2 provider facade adapter keeps old mock facade compatible without replacing getProvider", async () => {
  const adapter = createProviderFacadeAdapter(mockProvider, { providerName: "mock", model: "mock" });
  const envelope = createRuntimeTaskEnvelope("topic_draft", {
    surfaceId: "memorial-review",
    draftKind: "memorial_note",
    draftLabel: "奏报札记",
    evidenceRefs: []
  }, {
    taskId: "adapter-test"
  });
  const result = await adapter.generateStructured(envelope);

  assert.equal(validatePayload("topicDraft", result.payload), result.payload);
  assert.equal(result.provider, "mock");
  assert.equal(result.usage.estimated, true);
});

test("S92.2 AI task budget clamps tool-disabled routes to zero tool use", () => {
  const budget = buildAiTaskBudget({
    maxOutputTokens: 99999,
    timeoutMs: 10,
    temperature: 1.5,
    mayUseTools: true,
    toolBudget: 9,
    mayRequestAdjudication: true
  }, {
    mayUseTools: false
  });

  assert.equal(budget.maxOutputTokens, 16000);
  assert.equal(budget.timeoutMs, 1000);
  assert.equal(budget.temperature, 1);
  assert.equal(budget.toolBudget, 0);
  assert.equal(budget.mayUseTools, false);
});

test("S92.2 AI task budget assertion rejects adjudication when tools are disabled", () => {
  assert.throws(
    () => assertAiTaskBudget({
      schemaVersion: "test",
      maxOutputTokens: 900,
      timeoutMs: 30000,
      temperature: 0.35,
      mayUseTools: false,
      toolBudget: 0,
      mayRequestAdjudication: true,
      mayWriteState: false,
      mayCallServerResolvers: false
    }),
    /may not request adjudication/
  );
});

test("S92.2 fallback payloads are schema-valid for supported runtime tasks", () => {
  const opening = buildAiFallbackPayload(createRuntimeTaskEnvelope("opening", {
    dynasty: "明",
    year: 1,
    player: { name: "顾慎", roleLabel: "书生" }
  }));
  assert.equal(validatePayload("opening", opening), opening);
  assert.equal(validatePayload("quickAction", buildAiFallbackPayload(createRuntimeTaskEnvelope("quick_action", {
    player: { role: "scholar" },
    evidenceRefs: []
  }))).quickActionSuggestions.length, 1);
  assert.equal(validatePayload("topicDraft", buildAiFallbackPayload(createRuntimeTaskEnvelope("topic_draft", {
    surfaceId: "court-debate",
    evidenceRefs: []
  }))).surfaceId, "court-debate");
});
