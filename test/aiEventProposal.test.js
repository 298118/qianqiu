const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const {
  runProposalTool,
  runRequestAdjudicationTool
} = require("../src/ai/gameAiToolRunner");
const { validateToolDefinition } = require("../src/ai/toolSchemas");
const { createEventToolDefinitions } = require("../src/ai/eventToolDefinitions");
const {
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile
} = require("../src/game/aiActorProfiles");
const {
  buildEventProposalAudit,
  buildMockEventProposals,
  collectVisiblePressureRefs,
  resolveEventProposal
} = require("../src/game/aiEventProposal");
const { createInitialState } = require("../src/game/initialState");

function firstPressureEntry(worldState, actorProfile, incidentKind = "") {
  const entries = [...collectVisiblePressureRefs(worldState, actorProfile).values()];
  const entry = entries.find((item) => !incidentKind || item.incidentKind === incidentKind);
  assert.ok(entry, `缺少可见压力源：${incidentKind || "any"}`);
  return entry;
}

function incidentArgs(entry, overrides = {}) {
  return {
    incidentKind: entry.incidentKind,
    publicSummary: `${entry.title || "可见压力"}已有成案苗头，交服务器复核。`,
    sourcePressureRefs: [entry.ref],
    visibility: "actor_visible",
    confidence: 0.64,
    severity: entry.severity,
    cooldownKey: `s70-6:${entry.incidentKind}:${entry.ref}`,
    affectedRefs: [entry.ref],
    privateResultRefs: [],
    riskTags: entry.riskTags || [],
    ...overrides
  };
}

test("S70.6 event tool definitions are strict and registry-visible by actor only", () => {
  const definitions = createEventToolDefinitions();
  for (const definition of definitions) {
    assert.equal(validateToolDefinition(definition), definition);
    assert.equal(definition.inputSchema.additionalProperties, false);
    assert.deepEqual(
      [...definition.inputSchema.required].sort(),
      Object.keys(definition.inputSchema.properties).sort()
    );
    assert.equal(definition.resolver.serverOwned, true);
    assert.equal(definition.resolver.appliesState, false);
    assert.equal(definition.resolver.writesStorage, false);
    assert.equal(definition.inputSchema.properties.privateResultRefs.maxItems, 0);
  }

  const registry = createGameAiToolRegistry();
  assert.ok(registry.getTool("event.propose_incident"));
  assert.ok(registry.getTool("event.request_incident_adjudication"));

  const scholar = buildPlayerAiActorProfile(createInitialState({ role: "scholar", playerName: "寒窗士子" }));
  const magistrate = buildPlayerAiActorProfile(createInitialState({ role: "magistrate", playerName: "清河县令" }));
  const system = buildSystemEngineActorProfile(createInitialState({ role: "minister", playerName: "部院官" }), "pressure_events");
  const scholarTools = registry.listToolsForActor(scholar).map((tool) => tool.name);
  const magistrateTools = registry.listToolsForActor(magistrate).map((tool) => tool.name);
  const systemTools = registry.listToolsForActor(system).map((tool) => tool.name);

  assert.equal(scholarTools.includes("event.propose_incident"), false);
  assert.equal(scholarTools.includes("event.request_incident_adjudication"), false);
  assert.equal(magistrateTools.includes("event.propose_incident"), true);
  assert.equal(magistrateTools.includes("event.request_incident_adjudication"), true);
  assert.equal(systemTools.includes("event.propose_incident"), true);
  assert.equal(systemTools.includes("event.request_incident_adjudication"), true);
  assert.throws(() => validateToolDefinition({
    ...definitions[0],
    name: "server.resolve_event_proposal"
  }), /server\.\*/);
});

test("S70.6 direct resolver records accepted event candidates as pending without mutating state", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const entry = firstPressureEntry(worldState, actorProfile, "city_pressure");
  const before = JSON.stringify(worldState);

  const result = resolveEventProposal(worldState, incidentArgs(entry), { actorProfile });
  const audit = buildEventProposalAudit(result.normalizedProposal, result);

  assert.equal(result.status, "pending");
  assert.equal(result.normalizedProposal.accepted, true);
  assert.equal(result.privateResultRefs.length, 0);
  assert.equal(result.appliedEventIds.length, 0);
  assert.match(result.publicResult.summary, /待裁决/);
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), JSON.parse(before));
  assert.equal(audit.status, "pending");
  assert.deepEqual(audit.privateResultRefs, []);
  assert.deepEqual(audit.appliedEventIds, []);
});

test("S70.6 runner routes event proposal and adjudication tools through server pending semantics and cooldown", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const toolAuditRecords = [];
  const toolCooldowns = {};
  const entry = firstPressureEntry(worldState, actorProfile, "local_docket");
  const args = incidentArgs(entry, { cooldownKey: "s70-6-local-docket" });
  const context = {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords,
    toolCooldowns
  };

  const proposalResult = await runProposalTool({
    id: "call-event-proposal",
    name: "event.propose_incident",
    arguments: args
  }, context);
  const cooldownResult = await runProposalTool({
    id: "call-event-proposal-again",
    name: "event.propose_incident",
    arguments: args
  }, context);
  const adjudicationResult = await runRequestAdjudicationTool({
    id: "call-event-adjudication",
    name: "event.request_incident_adjudication",
    arguments: incidentArgs(entry, { cooldownKey: "s70-6-local-docket-adjudication" })
  }, context);

  assert.equal(proposalResult.status, "pending");
  assert.equal(proposalResult.toolName, "event.propose_incident");
  assert.equal(proposalResult.appliedEventIds.length, 0);
  assert.equal(cooldownResult.status, "rejected");
  assert.match(cooldownResult.rejectionReasons.join(" "), /冷却/);
  assert.equal(adjudicationResult.status, "pending");
  assert.equal(adjudicationResult.toolName, "event.request_incident_adjudication");
  assert.equal(adjudicationResult.appliedEventIds.length, 0);
  assert.equal(toolAuditRecords.length, 3);
});

test("S70.6 mock event proposals cover visible pressure domains including academy, court and NPC resentment", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  worldState.relationshipLedger.characters.C01.visible = true;
  worldState.relationshipLedger.characters.C01.relationship = -40;
  worldState.relationshipLedger.characters.C01.resentment = 85;
  worldState.relationshipLedger.characters.C01.recentIntent = "公开怨望，等待地方官调停。";
  const actorProfile = buildPlayerAiActorProfile(worldState);

  const proposals = buildMockEventProposals(worldState, actorProfile, { limit: 8 });
  const kinds = proposals.map((proposal) => proposal.incidentKind);

  for (const expected of ["city_pressure", "frontier_alert", "academy_pressure", "court_pressure", "npc_resentment"]) {
    assert.equal(kinds.includes(expected), true, `缺少 Mock 事件候选：${expected}`);
  }
  assert.equal(proposals.every((proposal) => proposal.privateResultRefs.length === 0), true);
  assert.equal(proposals.every((proposal) => proposal.accepted === false), true);
});
