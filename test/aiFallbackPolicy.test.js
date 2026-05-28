const test = require("node:test");
const assert = require("node:assert/strict");

const { createRuntimeTaskEnvelope } = require("../src/ai/providers/adapterContract");
const {
  buildAiFallbackPayload,
  summarizeFallbackDecision
} = require("../src/ai/runtime/aiFallbackPolicy");
const { validatePayload } = require("../src/ai/schemas");

test("S92.2 fallback policy creates schema-valid opening fallback", () => {
  const envelope = createRuntimeTaskEnvelope("opening", {
    dynasty: "明",
    year: 1,
    player: { name: "顾慎", roleLabel: "书生" }
  });
  const payload = buildAiFallbackPayload(envelope, new Error("provider failed"));

  assert.equal(validatePayload("opening", payload), payload);
  assert.match(JSON.stringify(payload), /服务器/);
});

test("S92.2 fallback policy creates schema-valid quick action and topic draft fallbacks", () => {
  const quick = buildAiFallbackPayload(createRuntimeTaskEnvelope("quick_action", {
    player: { role: "scholar" },
    evidenceRefs: [{ refId: "eventArchiveView:event-1" }]
  }));
  const topic = buildAiFallbackPayload(createRuntimeTaskEnvelope("topic_draft", {
    surfaceId: "court-debate",
    draftKind: "balanced_debate",
    evidenceRefs: [{ refId: "eventArchiveView:event-1" }]
  }));

  assert.equal(validatePayload("quickAction", quick), quick);
  assert.equal(validatePayload("topicDraft", topic), topic);
  assert.deepEqual(quick.quickActionSuggestions[0].evidenceRefs, ["eventArchiveView:event-1"]);
  assert.equal(topic.surfaceId, "court-debate");
  assert.equal(topic.source, "mock-ai");
});

test("S92.2 fallback policy redacts failure reasons", () => {
  const decision = summarizeFallbackDecision(
    createRuntimeTaskEnvelope("quick_action", {}),
    new Error("prompt=SECRET key=abc123 token=tok123 rawProviderPayload apiKey=sk-test-secret C:\\Users\\ZZZ\\Downloads\\payload.json")
  );
  const serialized = JSON.stringify(decision);

  assert.equal(decision.fallbackProvider, "mock");
  assert.doesNotMatch(serialized, /SECRET|abc123|tok123|sk-test-secret|payload\.json|rawProviderPayload|apiKey|prompt=|key=|token=/);
});
