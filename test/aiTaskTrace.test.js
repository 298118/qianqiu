const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPublicAiTaskTrace,
  createAiTaskTrace,
  finishAiTaskTrace,
  recordAiTaskTraceEvent,
  summarizeAiTaskTrace
} = require("../src/ai/runtime/aiTaskTrace");

test("S92.2 AI task trace omits raw envelope and forbidden diagnostic fields", () => {
  const trace = createAiTaskTrace({
    taskId: "quick-action-1",
    taskKind: "quick_action",
    taskType: "quick_action",
    schemaName: "quickAction",
    promptPackId: "quick_action",
    context: {
      worldState: { hidden: true },
      rawPrompt: "do not expose"
    }
  }, {
    route: { taskType: "quick_action", provider: "mock", model: "mock" },
    budget: { maxOutputTokens: 900, timeoutMs: 30000, temperature: 0.35, toolBudget: 0 }
  });

  recordAiTaskTraceEvent(trace, "provider_start", {
    provider: "mock",
    model: "mock",
    rawProviderPayload: { secret: true },
    apiKey: "sk-test-secret",
    localPath: "C:\\Users\\ZZZ\\Downloads\\secret.json"
  });

  const summary = summarizeAiTaskTrace(trace);
  const serialized = JSON.stringify(summary);
  assert.equal(summary.taskKind, "quick_action");
  assert.equal(summary.provider, "mock");
  assert.doesNotMatch(serialized, /worldState|rawPrompt|rawProviderPayload|apiKey|secret\.json|sk-test-secret/);
  assertPublicAiTaskTrace(summary);
});

test("S92.2 AI task trace redacts provider errors before publication", () => {
  const trace = createAiTaskTrace({
    taskId: "opening-1",
    taskKind: "opening",
    taskType: "narrator",
    schemaName: "opening",
    promptPackId: "opening"
  }, {
    route: { taskType: "narrator", provider: "mock", model: "mock" },
    budget: { maxOutputTokens: 800, timeoutMs: 30000, temperature: 0.35, toolBudget: 0 }
  });

  const summary = finishAiTaskTrace(trace, "failed", {
    latencyMs: 5,
    validation: { ok: false, schemaName: "opening" },
    error: new Error("OpenAI API request failed with 500: prompt=SECRET key=abc123 token=tok123 rawProviderPayload apiKey=sk-test-abcdef C:\\Users\\ZZZ\\Downloads\\secret.json")
  });
  const serialized = JSON.stringify(summary);

  assert.match(serialized, /redacted-provider-body|redacted-provider-detail|redacted/);
  assert.doesNotMatch(serialized, /SECRET|abc123|tok123|sk-test-abcdef|secret\.json|rawProviderPayload|apiKey|prompt=|key=|token=/);
  assertPublicAiTaskTrace(summary);
});

test("S92.2 AI task trace rejects public server internal references", () => {
  assert.throws(
    () => assertPublicAiTaskTrace({
      taskKind: "opening",
      provider: "mock",
      model: "mock",
      reason: "called server.resolveHiddenLedger"
    }),
    /server internal reference/
  );
});
