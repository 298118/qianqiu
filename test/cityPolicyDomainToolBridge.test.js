const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runProposalTool } = require("../src/ai/gameAiToolRunner");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyCityPolicyOutcome,
  resolveCityPolicyFromDomainTool
} = require("../src/game/cityPolicyResolver");
const {
  collectVisibleDomainEvidenceRefs,
  resolveDomainTool
} = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");

function localDocketEvidence(worldState, actorProfile) {
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  const evidence = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()].find((entry) =>
    entry.domain === "local_docket" &&
    (entry.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );
  assert.ok(evidence, "缺少辖区案牍证据");
  return evidence;
}

test("S71.5 city policy bridge adjudicates city.propose_policy without exposing server tool", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const cityTool = registry.getTool("city.propose_policy");
  const evidence = localDocketEvidence(worldState, actorProfile);
  const before = JSON.parse(JSON.stringify(worldState));

  assert.ok(cityTool.inputSchema.properties.policyKind.enum.includes("land_survey"));
  assert.equal(registry.getTool("server.adjudicate_policy"), null);
  assert.equal(Object.keys(registry.buildProviderNameMap()).some((name) => name.includes("server_adjudicate_policy")), false);

  const args = {
    policyKind: "land_survey",
    publicSummary: "按辖区案牍清丈田亩，补足旧册。",
    evidenceRefs: [evidence.ref],
    targetRefs: [evidence.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    visibility: "actor_visible",
    confidence: 0.72,
    riskLevel: 1,
    cooldownKey: `s71-5-city-policy:${evidence.ref}`,
    expectedBenefits: ["补足税粮底册"],
    counterCosts: ["士绅阻力上升"],
    riskDisclosure: "仅为政策建议，服务器裁决前不得改写状态。",
    privateResultRefs: [],
    riskTags: ["s71_5_city_policy"]
  };
  const pending = await runProposalTool({
    id: "call-city-policy-land-survey",
    name: "city.propose_policy",
    arguments: args
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords: []
  });

  assert.equal(pending.status, "pending");
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), before);

  const serverProposal = resolveDomainTool(worldState, args, { actorProfile, toolDefinition: cityTool });
  const outcome = resolveCityPolicyFromDomainTool(worldState, serverProposal, { actorProfile });
  assert.equal(outcome.status, "accepted");
  assert.equal(outcome.policyType, "land_survey");

  applyCityPolicyOutcome(worldState, outcome);

  assert.equal(worldState.treasury, before.treasury + 110);
  assert.equal(worldState.cityPolicyLedger.records[0].policyType, "land_survey");
  assert.doesNotMatch(JSON.stringify(outcome), /server\.adjudicate_policy|worldState|statePatch|rawSql/);
});
