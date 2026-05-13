const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runProposalTool } = require("../src/ai/gameAiToolRunner");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyJudicialCaseOutcome,
  resolveJudicialCaseFromDomainTool
} = require("../src/game/judicialCaseResolver");
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

test("S71.6 judicial bridge adjudicates judicial.propose_case_resolution without exposing server tool", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "息讼知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const judicialTool = registry.getTool("judicial.propose_case_resolution");
  const evidence = localDocketEvidence(worldState, actorProfile);
  const before = JSON.parse(JSON.stringify(worldState));

  assert.ok(judicialTool.inputSchema.properties.caseAction.enum.includes("judge"));
  assert.equal(registry.getTool("server.resolve_case"), null);
  assert.equal(Object.keys(registry.buildProviderNameMap()).some((name) => name.includes("server_resolve_case")), false);

  const args = {
    caseAction: "mediate",
    publicSummary: "按辖区词讼案牍调解息讼。",
    evidenceRefs: [evidence.ref],
    targetRefs: [evidence.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    visibility: "actor_visible",
    confidence: 0.72,
    riskLevel: 2,
    cooldownKey: `s71-6-judicial:${evidence.ref}`,
    expectedBenefits: ["清理积案"],
    counterCosts: ["需防人情反噬"],
    riskDisclosure: "仅为刑名处置建议，服务器裁决前不得改写状态。",
    privateResultRefs: [],
    riskTags: ["s71_6_judicial_case"]
  };
  const pending = await runProposalTool({
    id: "call-judicial-mediate",
    name: "judicial.propose_case_resolution",
    arguments: args
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords: []
  });

  assert.equal(pending.status, "pending");
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), before);

  const serverProposal = resolveDomainTool(worldState, args, { actorProfile, toolDefinition: judicialTool });
  const outcome = resolveJudicialCaseFromDomainTool(worldState, serverProposal, { actorProfile });
  assert.equal(outcome.status, "accepted");
  assert.equal(outcome.caseAction, "mediate");

  applyJudicialCaseOutcome(worldState, outcome);

  assert.equal(worldState.publicOrder, before.publicOrder + 3);
  assert.equal(worldState.judicialCaseLedger.records[0].caseAction, "mediate");
  assert.doesNotMatch(JSON.stringify(outcome), /server\.resolve_case|worldState|statePatch|rawSql/);
});

test("S71.6 judicial bridge rejects non-judicial domain tool payloads", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "守界知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = localDocketEvidence(worldState, actorProfile);

  const outcome = resolveJudicialCaseFromDomainTool(worldState, {
    normalizedProposal: {
      toolName: "city.propose_policy",
      actionKind: "relief",
      evidenceRefs: [evidence.ref],
      jurisdictionRef: actorProfile.jurisdictionRefs[0],
      publicSummary: "试图把城市政策 payload 送进司法裁决。"
    }
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /非刑名工具/);
});
