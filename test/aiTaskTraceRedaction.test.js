const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPublicAiTaskTrace,
  createAiTaskTrace,
  finishAiTaskTrace,
  summarizeAiTaskTrace
} = require("../src/ai/runtime/aiTaskTrace");

test("S92.8 public trace summary keeps prompt/provider/world state details out", () => {
  const trace = createAiTaskTrace({
    traceId: "trace-safe-1",
    taskKind: "topic_draft",
    taskType: "topic_draft",
    promptPackId: "topic_draft",
    promptVersion: "v2.1",
    rawPrompt: "完整提示词",
    providerPayload: { hidden: true },
    worldState: { treasury: 999 }
  }, {
    route: {
      taskType: "topic_draft",
      provider: "mock",
      model: "mock"
    },
    retrievalCounts: {
      selectedRows: 6,
      droppedRows: 4,
      evidenceRefs: 3,
      domains: {
        archive: 2,
        economy: 1,
        "private.rawSql": 8
      }
    }
  });

  const summary = finishAiTaskTrace(trace, "ok", {
    latencyMs: 12,
    validationFlags: { schemaOk: true, guardrailOk: true, redactionOk: true },
    toolCounts: {
      allowed: 0,
      callCount: 0,
      accepted: 0,
      pending: 0,
      rejected: 0
    }
  });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.traceId, "trace-safe-1");
  assert.equal(summary.promptPackId, "topic_draft");
  assert.equal(summary.promptVersion, "v2.1");
  assert.equal(summary.latencyMs, 12);
  assert.equal(summary.retrievalCounts.domains.archive, 2);
  assert.equal(summary.retrievalCounts.domains.other, 8);
  assert.doesNotMatch(serialized, /rawPrompt|providerPayload|worldState|treasury|完整提示词|private\.rawSql/);
  assertPublicAiTaskTrace(summary);
});

test("S92.8 public trace summary fails closed on manual unsafe summaries", () => {
  const unsafe = summarizeAiTaskTrace({
    traceId: "trace-safe-2",
    taskKind: "opening",
    taskType: "narrator",
    promptPackId: "opening",
    promptVersion: "legacy",
    provider: "mock",
    model: "mock",
    latencyMs: 1,
    status: "ok",
    fallbackReason: "",
    retrievalCounts: { selectedRows: 0, droppedRows: 0, evidenceRefs: 0, domains: {} },
    toolCounts: { allowed: 0, callCount: 0, accepted: 0, pending: 0, rejected: 0, attempted: 0, used: 0 },
    validationFlags: { schemaOk: true, guardrailOk: true, redactionOk: true }
  });

  assertPublicAiTaskTrace(unsafe);
  assert.throws(
    () => assertPublicAiTaskTrace({
      ...unsafe,
      fallbackReason: "baseURL=https://provider.invalid/v1"
    }),
    /forbidden raw diagnostic content|sensitive assignment/
  );
  assert.throws(
    () => assertPublicAiTaskTrace({
      ...unsafe,
      retrievalCounts: {
        ...unsafe.retrievalCounts,
        rawSqlRows: 1
      }
    }),
    /forbidden retrievalCounts field/
  );
});
