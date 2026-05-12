const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const {
  buildToolAuditRecord,
  runReadTool,
  safeArgumentSummary
} = require("../src/ai/gameAiToolRunner");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");

test("S70.3 tool audit summaries redact key, path and raw prompt shaped arguments", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "审计测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const toolAuditRecords = [];

  const result = await runReadTool({
    name: "world.read_visible_context",
    arguments: {
      domains: ["events"],
      query: "请读取 /mnt/e/secret/.env 和 sk-testSECRET rawPrompt",
      maxItems: 1
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: createGameAiToolRegistry([createVisibleContextReadToolDefinition()]),
    toolAuditRecords
  });
  const serialized = JSON.stringify({ result, toolAuditRecords });

  assert.equal(result.status, "accepted");
  assert.equal(toolAuditRecords.length, 1);
  assert.equal(serialized.includes("/mnt/e/secret"), false);
  assert.equal(serialized.includes("sk-testSECRET"), false);
  assert.equal(serialized.includes("rawPrompt"), false);
  assert.equal(serialized.includes("apiKey"), false);
});

test("S70.3 standalone audit records expose only hidden-safe public summary", () => {
  const toolDefinition = createVisibleContextReadToolDefinition();
  const result = {
    status: "rejected",
    toolName: toolDefinition.name,
    actorRef: {
      actorId: "player:P1",
      actorType: "scholar",
      authorityTier: "T1",
      jurisdictionRefs: []
    },
    publicResult: {
      summary: "工具请求未被服务器接受。",
      visibleChanges: []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: ["actor 无权调用该工具或辖区不匹配。"],
    counterCosts: [],
    followUpHooks: [],
    auditRef: "ai-tool-audit:test"
  };
  const record = buildToolAuditRecord({
    toolDefinition,
    actorProfile: {
      actorId: "player:P1",
      actorType: "scholar",
      authorityTier: "T1"
    },
    args: {
      query: "hiddenNotes provider proposal data/sessions/secret.json",
      maxItems: 3
    },
    result,
    durationMs: 3,
    rejectedReason: "permission_denied"
  });
  const serialized = JSON.stringify(record);

  assert.equal(record.status, "rejected");
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("provider proposal"), false);
  assert.equal(serialized.includes("data/sessions"), false);
  assert.equal(record.rejectedReason, "permission_denied");
});

test("S70.3 safeArgumentSummary drops sensitive scalar and list entries", () => {
  const summary = safeArgumentSummary({
    query: "prompt_retrieval_index /home/user/secret tp-secretTOKEN",
    domains: ["events", "raw_table", "people"],
    maxItems: 2
  });
  const serialized = JSON.stringify(summary);

  assert.equal(serialized.includes("prompt_retrieval_index"), false);
  assert.equal(serialized.includes("/home/user/secret"), false);
  assert.equal(serialized.includes("tp-secretTOKEN"), false);
  assert.equal(serialized.includes("raw_table"), false);
  assert.equal(summary.maxItems, "2");
});
