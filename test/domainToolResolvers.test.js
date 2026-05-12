const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const {
  runProposalTool,
  runRequestAdjudicationTool
} = require("../src/ai/gameAiToolRunner");
const { createInitialState } = require("../src/game/initialState");
const {
  buildNpcAiActorProfile,
  buildPlayerAiActorProfile
} = require("../src/game/aiActorProfiles");
const {
  collectVisibleDomainEvidenceRefs,
  resolveDomainTool
} = require("../src/game/domainToolResolvers");

const TOOL_CASES = [
  ["judicial.propose_case_resolution", "proposal", "magistrate", "local_docket"],
  ["city.propose_policy", "proposal", "magistrate", "local_docket"],
  ["military.propose_order", "proposal", "general", "military"],
  ["diplomacy.propose_move", "proposal", "general", "diplomacy"],
  ["exam.request_ranking_adjudication", "request_adjudication", "examiner", "office"],
  ["office.request_appointment_adjudication", "request_adjudication", "minister", "office"],
  ["career.propose_reward_or_promotion", "proposal", "minister", "office"],
  ["career.request_discipline_adjudication", "request_adjudication", "minister", "office"]
];

function actorContext(actorKind) {
  if (actorKind === "examiner") {
    const worldState = createInitialState({ role: "minister", playerName: "礼部堂官" });
    return {
      worldState,
      actorProfile: buildNpcAiActorProfile(worldState, { id: "examiner-visible" }, {
        allowUnknown: true,
        actorType: "examiner"
      })
    };
  }
  const worldState = createInitialState({ role: actorKind, playerName: `${actorKind}-actor` });
  return {
    worldState,
    actorProfile: buildPlayerAiActorProfile(worldState)
  };
}

function actionPropertyFor(toolDefinition) {
  return Object.keys(toolDefinition.inputSchema.properties)
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
}

function firstEvidence(worldState, actorProfile, domain) {
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === domain);
  assert.ok(entry, `缺少 ${domain} 可见证据`);
  return entry;
}

function argsFor(toolDefinition, actorProfile, evidence) {
  const actionProperty = actionPropertyFor(toolDefinition);
  return {
    [actionProperty]: toolDefinition.inputSchema.properties[actionProperty].enum[0],
    publicSummary: `${evidence.title || "可见材料"} 已形成领域工具意图，交服务器裁决。`,
    evidenceRefs: [evidence.ref],
    targetRefs: [evidence.ref],
    jurisdictionRef: toolDefinition.permission.requiresJurisdiction ? actorProfile.jurisdictionRefs[0] : "",
    visibility: "actor_visible",
    confidence: 0.63,
    riskLevel: 2,
    cooldownKey: `s70-7:${toolDefinition.name}:${evidence.ref}`,
    expectedBenefits: ["补充服务器裁决材料"],
    counterCosts: ["需复核证据与执行链"],
    riskDisclosure: "当前仅为待裁决意图，不能直接形成世界事实。",
    privateResultRefs: [],
    riskTags: ["s70_7_domain_tool"]
  };
}

test("S70.7 domain resolver records every domain tool as pending without mutating world state", async () => {
  const registry = createGameAiToolRegistry();

  for (const [toolName, toolType, actorKind, evidenceDomain] of TOOL_CASES) {
    const { worldState, actorProfile } = actorContext(actorKind);
    const toolDefinition = registry.getTool(toolName);
    const evidence = firstEvidence(worldState, actorProfile, evidenceDomain);
    const args = argsFor(toolDefinition, actorProfile, evidence);
    const before = JSON.stringify(worldState);
    const runner = toolType === "request_adjudication" ? runRequestAdjudicationTool : runProposalTool;
    const result = await runner({
      id: `call-${toolName}`,
      name: toolName,
      arguments: args
    }, {
      worldState,
      actorProfile,
      toolRegistry: registry,
      toolAuditRecords: []
    });

    assert.equal(result.status, "pending", `${toolName} 应为 pending`);
    assert.equal(result.toolName, toolName);
    assert.equal(result.privateResultRefs.length, 0);
    assert.equal(result.appliedEventIds.length, 0);
    assert.match(result.publicResult.summary, /待裁决/);
    assert.deepEqual(JSON.parse(JSON.stringify(worldState)), JSON.parse(before));
  }
});

test("S70.7 direct resolver rejects invisible or wrong-domain evidence", () => {
  const registry = createGameAiToolRegistry();
  const { worldState, actorProfile } = actorContext("general");
  const toolDefinition = registry.getTool("military.propose_order");
  const localDocketEvidence = firstEvidence(worldState, actorProfile, "local_docket");
  const direct = resolveDomainTool(worldState, argsFor(toolDefinition, actorProfile, localDocketEvidence), {
    actorProfile,
    toolDefinition
  });
  const forged = resolveDomainTool(worldState, {
    ...argsFor(toolDefinition, actorProfile, firstEvidence(worldState, actorProfile, "military")),
    evidenceRefs: ["office:forged-row"]
  }, {
    actorProfile,
    toolDefinition
  });

  assert.equal(direct.status, "rejected");
  assert.match(direct.rejectionReasons.join(" "), /领域不适用/);
  assert.equal(forged.status, "rejected");
  assert.match(forged.rejectionReasons.join(" "), /不在当前 actor 可见 projection/);
});

test("S70.7 jurisdiction tools reject out-of-jurisdiction or unscopeable evidence", () => {
  const registry = createGameAiToolRegistry();
  const narrowWorldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const broadWorldState = createInitialState({ role: "minister", playerName: "部院堂官" });
  const actorProfile = buildPlayerAiActorProfile(narrowWorldState);
  const actorScopes = new Set(actorProfile.jurisdictionRefs);
  const visibleEvidence = [...collectVisibleDomainEvidenceRefs(broadWorldState, actorProfile).values()];
  const foreignDocket = visibleEvidence.find((item) => (
    item.domain === "local_docket" &&
    !item.scopeRefs.some((scopeRef) => actorScopes.has(scopeRef))
  ));
  const unscopedEvent = visibleEvidence.find((item) => item.domain === "events" && item.scopeRefs.length === 0);
  const judicialTool = registry.getTool("judicial.propose_case_resolution");
  const cityTool = registry.getTool("city.propose_policy");

  assert.ok(foreignDocket, "缺少外辖案牍证据 fixture");
  assert.ok(unscopedEvent, "缺少无辖区范围的事件档案证据 fixture");

  const foreignResult = resolveDomainTool(
    broadWorldState,
    argsFor(judicialTool, actorProfile, foreignDocket),
    { actorProfile, toolDefinition: judicialTool }
  );
  const eventOnlyResult = resolveDomainTool(
    broadWorldState,
    argsFor(cityTool, actorProfile, unscopedEvent),
    { actorProfile, toolDefinition: cityTool }
  );

  assert.equal(foreignResult.status, "rejected");
  assert.match(foreignResult.rejectionReasons.join(" "), /不属于当前辖区/);
  assert.equal(eventOnlyResult.status, "rejected");
  assert.match(eventOnlyResult.rejectionReasons.join(" "), /不属于当前辖区/);
});
