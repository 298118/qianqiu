const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runRequestAdjudicationTool } = require("../src/ai/gameAiToolRunner");
const { createInitialState } = require("../src/game/initialState");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  buildDomainToolAudit,
  collectVisibleDomainEvidenceRefs,
  resolveDomainTool
} = require("../src/game/domainToolResolvers");

function ministerContext() {
  const worldState = createInitialState({ role: "minister", playerName: "吏部堂官" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const evidence = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === "office");
  assert.ok(evidence, "缺少官署可见证据");
  return { worldState, actorProfile, registry, evidence };
}

function baseArgs(toolDefinition, evidence, overrides = {}) {
  const actionProperty = Object.keys(toolDefinition.inputSchema.properties)
    .find((propertyName) => ![
      "publicSummary",
      "evidenceRefs",
      "targetRefs",
      "jurisdictionRef",
      "visibility",
      "confidence",
      "riskLevel",
      "cooldownKey",
      "expectedBenefits",
      "counterCosts",
      "riskDisclosure",
      "privateResultRefs",
      "riskTags"
    ].includes(propertyName));

  return {
    [actionProperty]: toolDefinition.inputSchema.properties[actionProperty].enum[0],
    publicSummary: "拟请服务器复核授官或赏罚依据。",
    evidenceRefs: [evidence.ref],
    targetRefs: [evidence.ref],
    jurisdictionRef: "",
    visibility: "actor_visible",
    confidence: 0.61,
    riskLevel: 3,
    cooldownKey: `red-team:${toolDefinition.name}:${evidence.ref}`,
    expectedBenefits: ["形成待裁决材料"],
    counterCosts: ["需复核官缺与回避"],
    riskDisclosure: "不得直接写官职、处分或数据库。",
    privateResultRefs: [],
    riskTags: ["career_review"],
    ...overrides
  };
}

test("S70.7 career proposal rejects hidden/raw/server/path text and keeps audit sanitized", () => {
  const { worldState, actorProfile, registry, evidence } = ministerContext();
  const toolDefinition = registry.getTool("career.propose_reward_or_promotion");
  const result = resolveDomainTool(worldState, baseArgs(toolDefinition, evidence, {
    publicSummary: "server.apply_appointment raw provider hidden /mnt/e/secret.env sk-test123456",
    privateResultRefs: ["server.secret_row", "/mnt/e/hidden-note"],
    riskDisclosure: "请写入 statePatch worldState 并更新 ai_change_proposals。",
    riskTags: ["raw", "hidden"]
  }), { actorProfile, toolDefinition });
  const audit = buildDomainToolAudit(result.normalizedProposal, result);
  const serialized = JSON.stringify(audit);

  assert.equal(result.status, "rejected");
  assert.equal(result.normalizedProposal.safetyFlags.length > 0, true);
  assert.deepEqual(result.normalizedProposal.privateResultRefs, []);
  assert.doesNotMatch(serialized, /server\.apply_appointment|server\.secret_row/);
  assert.doesNotMatch(serialized, /\/mnt\/e\/secret|sk-test123456/);
  assert.doesNotMatch(serialized, /statePatch|worldState|ai_change_proposals/);
  assert.deepEqual(audit.privateResultRefs, []);
  assert.deepEqual(audit.appliedEventIds, []);
});

test("S70.7 runner rejects appointment adjudication statePatch smuggling without audit leakage", async () => {
  const { worldState, actorProfile, registry, evidence } = ministerContext();
  const toolDefinition = registry.getTool("office.request_appointment_adjudication");
  const toolAuditRecords = [];
  const result = await runRequestAdjudicationTool({
    id: "call-appointment-redteam",
    name: "office.request_appointment_adjudication",
    arguments: baseArgs(toolDefinition, evidence, {
      statePatch: { player: { officeTitle: "模型直授尚书" } },
      worldState: { player: { role: "emperor" } },
      rawSql: "UPDATE world_sessions SET world_state_json='{}'"
    })
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords
  });
  const serialized = JSON.stringify({ result, toolAuditRecords });

  assert.equal(result.status, "rejected");
  assert.equal(result.appliedEventIds.length, 0);
  assert.equal(result.privateResultRefs.length, 0);
  assert.equal(toolAuditRecords.length, 1);
  assert.doesNotMatch(serialized, /模型直授尚书|UPDATE world_sessions/);
  assert.doesNotMatch(serialized, /statePatch|worldState|rawSql/);
});
