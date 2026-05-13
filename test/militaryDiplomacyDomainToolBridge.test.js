const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runProposalTool } = require("../src/ai/gameAiToolRunner");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  collectVisibleDomainEvidenceRefs,
  resolveDomainTool
} = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const {
  applyMilitaryDiplomacyOutcome,
  resolveMilitaryDiplomacyFromDomainTool
} = require("../src/game/militaryDiplomacyResolver");

function evidence(worldState, actorProfile, domain, count = 1) {
  const rows = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((entry) => entry.domain === domain)
    .slice(0, count);
  assert.equal(rows.length, count, `缺少 ${domain} 可见证据`);
  return rows;
}

function baseArgs(toolDefinition, actorProfile, evidenceRows, actionKind) {
  const actionProperty = toolDefinition.inputSchema.properties.orderKind ? "orderKind" : "moveKind";
  return {
    [actionProperty]: actionKind,
    publicSummary: "按可见军务外交材料提交服务器裁决。",
    evidenceRefs: evidenceRows.map((entry) => entry.ref),
    targetRefs: [evidenceRows[0].ref],
    jurisdictionRef: "",
    visibility: "actor_visible",
    confidence: 0.72,
    riskLevel: 2,
    cooldownKey: `s71-7:${toolDefinition.name}:${evidenceRows[0].ref}`,
    expectedBenefits: ["补充服务器裁决材料"],
    counterCosts: ["需复核证据、资源和制度路径"],
    riskDisclosure: "当前仅为待裁决意图，服务器裁决前不得形成军令或外交事实。",
    privateResultRefs: [],
    riskTags: ["s71_7_military_diplomacy"]
  };
}

test("S71.7 military bridge adjudicates military.propose_order without exposing server tools", async () => {
  const worldState = createInitialState({ role: "general", playerName: "桥接将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const toolDefinition = registry.getTool("military.propose_order");
  const evidenceRows = [
    evidence(worldState, actorProfile, "market")[0],
    evidence(worldState, actorProfile, "military")[0]
  ];
  const before = JSON.parse(JSON.stringify(worldState));

  assert.ok(toolDefinition.inputSchema.properties.orderKind.enum.includes("decisive_battle"));
  assert.equal(registry.getTool("server.resolve_battle"), null);
  assert.equal(registry.getTool("server.apply_diplomacy"), null);
  assert.equal(Object.keys(registry.buildProviderNameMap()).some((name) => name.includes("server_resolve_battle")), false);

  const args = baseArgs(toolDefinition, actorProfile, evidenceRows, "resupply");
  const pending = await runProposalTool({
    id: "call-military-resupply",
    name: "military.propose_order",
    arguments: args
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords: []
  });

  assert.equal(pending.status, "pending");
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), before);

  const serverProposal = resolveDomainTool(worldState, args, { actorProfile, toolDefinition });
  const outcome = resolveMilitaryDiplomacyFromDomainTool(worldState, serverProposal, { actorProfile });
  assert.equal(outcome.status, "accepted");
  assert.equal(outcome.actionKind, "resupply");

  applyMilitaryDiplomacyOutcome(worldState, outcome);

  assert.equal(worldState.grainReserve, before.grainReserve - 40);
  assert.equal(worldState.militaryDiplomacyLedger.records[0].actionKind, "resupply");
  assert.doesNotMatch(JSON.stringify(outcome), /server\.resolve_battle|server\.apply_diplomacy|worldState|statePatch|rawSql/);
});

test("S71.7 diplomacy bridge accepts treaty actions and rejects wrong tool payloads", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "桥接御前" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const diplomacyTool = registry.getTool("diplomacy.propose_move");
  const cityTool = registry.getTool("city.propose_policy");
  const evidenceRows = [
    evidence(worldState, actorProfile, "diplomacy")[0],
    evidence(worldState, actorProfile, "market")[0]
  ];
  const args = baseArgs(diplomacyTool, actorProfile, evidenceRows, "negotiate_trade");

  assert.ok(diplomacyTool.inputSchema.properties.moveKind.enum.includes("detain_envoy"));

  const serverProposal = resolveDomainTool(worldState, args, { actorProfile, toolDefinition: diplomacyTool });
  const accepted = resolveMilitaryDiplomacyFromDomainTool(worldState, serverProposal, { actorProfile });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.actionKind, "negotiate_trade");

  const wrongTool = resolveMilitaryDiplomacyFromDomainTool(worldState, {
    normalizedProposal: {
      toolName: "city.propose_policy",
      actionKind: "relief",
      evidenceRefs: evidenceRows.map((entry) => entry.ref),
      publicSummary: "错误工具进入军务外交 resolver。",
      actorRef: { actorId: actorProfile.actorId }
    }
  }, { actorProfile });

  assert.equal(wrongTool.status, "rejected");
  assert.match(wrongTool.rejectionReasons.join(" "), /非对应军务\/外交工具/);
  assert.equal(cityTool.name, "city.propose_policy");
});
