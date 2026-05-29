const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPublicAiTaskTrace,
  createAiTaskTrace,
  finishAiTaskTrace,
  recordAiTaskTraceEvent,
  summarizeAiTaskTrace
} = require("../src/ai/runtime/aiTaskTrace");

test("S92.8 AI task trace publishes only the fixed public summary fields", () => {
  const trace = createAiTaskTrace({
    taskId: "quick-action-1",
    taskKind: "quick_action",
    taskType: "quick_action",
    schemaName: "quickAction",
    promptPackId: "quick_action",
    promptVersion: "2026-05-29",
    context: {
      worldState: { hidden: true },
      rawPrompt: "do not expose"
    }
  }, {
    route: { taskType: "quick_action", provider: "mock", model: "mock" },
    budget: { maxOutputTokens: 900, timeoutMs: 30000, temperature: 0.35, toolBudget: 0 },
    retrievalCounts: {
      selectedRows: 3,
      droppedRows: 1,
      evidenceRefs: 2,
      domains: {
        geography: 2,
        "server.hidden": 9
      }
    }
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

  assert.deepEqual(Object.keys(summary).sort(), [
    "fallbackReason",
    "latencyMs",
    "model",
    "promptPackId",
    "promptVersion",
    "provider",
    "retrievalCounts",
    "schemaVersion",
    "status",
    "taskKind",
    "taskType",
    "toolCounts",
    "traceId",
    "validationFlags"
  ].sort());
  assert.equal(summary.taskKind, "quick_action");
  assert.equal(summary.provider, "mock");
  assert.equal(summary.promptVersion, "2026-05-29");
  assert.equal(summary.retrievalCounts.selectedRows, 3);
  assert.equal(summary.retrievalCounts.domains.geography, 2);
  assert.equal(summary.retrievalCounts.domains.other, 9);
  assert.equal(summary.validationFlags.redactionOk, true);
  assert.doesNotMatch(serialized, /worldState|rawPrompt|rawProviderPayload|apiKey|secret\.json|sk-test-secret|events|budget|route|taskId|schemaName/);
  assertPublicAiTaskTrace(summary);
});

test("S92.8 AI task trace redacts provider errors before publication", () => {
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
    validation: { ok: false, guardrailOk: true, redactionOk: true },
    error: new Error("OpenAI API request failed with 500: prompt=SECRET key=abc123 token=tok123 Authorization: Bearer abcdef123456 rawProviderPayload apiKey=sk-test-abcdef C:\\Users\\ZZZ\\Downloads\\secret.json")
  });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.status, "failed");
  assert.equal(summary.validationFlags.schemaOk, false);
  assert.match(serialized, /redacted|failed/);
  assert.doesNotMatch(serialized, /SECRET|abc123|tok123|abcdef123456|sk-test-abcdef|secret\.json|rawProviderPayload|apiKey|prompt=|key=|token=|Authorization/);
  assertPublicAiTaskTrace(summary);
});

test("S92.8 AI task trace rejects extra fields and public server internal references", () => {
  assert.throws(
    () => assertPublicAiTaskTrace({
      schemaVersion: "test",
      traceId: "trace",
      taskKind: "opening",
      taskType: "narrator",
      promptPackId: "opening",
      promptVersion: "legacy",
      provider: "mock",
      model: "mock",
      latencyMs: 0,
      status: "ok",
      fallbackReason: "called server.resolveHiddenLedger",
      retrievalCounts: { selectedRows: 0, droppedRows: 0, evidenceRefs: 0, domains: {} },
      toolCounts: { allowed: 0, callCount: 0, accepted: 0, pending: 0, rejected: 0, attempted: 0, used: 0 },
      validationFlags: { schemaOk: true, guardrailOk: true, redactionOk: true }
    }),
    /server internal reference/
  );

  assert.throws(
    () => assertPublicAiTaskTrace({
      schemaVersion: "test",
      traceId: "trace",
      taskKind: "opening",
      taskType: "narrator",
      promptPackId: "opening",
      promptVersion: "legacy",
      provider: "mock",
      model: "mock",
      latencyMs: 0,
      status: "ok",
      fallbackReason: "",
      retrievalCounts: { selectedRows: 0, droppedRows: 0, evidenceRefs: 0, domains: {} },
      toolCounts: { allowed: 0, callCount: 0, accepted: 0, pending: 0, rejected: 0, attempted: 0, used: 0 },
      validationFlags: { schemaOk: true, guardrailOk: true, redactionOk: true },
      rawPrompt: "leak"
    }),
    /forbidden field/
  );
});
