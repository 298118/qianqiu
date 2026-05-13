const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { runProposalTool } = require("../src/ai/gameAiToolRunner");
const { validateToolDefinition } = require("../src/ai/toolSchemas");
const { createMapToolDefinitions } = require("../src/ai/mapToolDefinitions");
const { createInitialState } = require("../src/game/initialState");
const {
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile
} = require("../src/game/aiActorProfiles");
const { buildMapContextView } = require("../src/game/mapContext");
const { resolveMapMovementProposal } = require("../src/game/mapToolResolvers");

function baseArgs(refs, overrides = {}) {
  const cityRef = refs.find((ref) => ref.entityType === "city")?.refId || "";
  const examRef = refs.find((ref) => ref.entityType === "exam_travel")?.refId || cityRef;
  return {
    moveType: "exam_travel",
    publicSummary: "按公开科期与盘费，拟先整理赶考路线并候服务器复核。",
    originRef: cityRef,
    destinationRefs: [examRef],
    routeRefs: [],
    affectedMapRefs: [cityRef, examRef].filter(Boolean),
    evidenceRefs: [examRef],
    jurisdictionRef: "",
    visibility: "actor_visible",
    confidence: 0.62,
    riskLevel: 2,
    cooldownKey: "s70-13-map-exam-travel",
    expectedBenefits: ["保留赶考路线证据"],
    counterCosts: ["盘费与入场仍需服务器裁决"],
    riskDisclosure: "当前只是地图移动意图，不决定开考或路费。",
    privateResultRefs: [],
    riskTags: ["exam", "travel"],
    ...overrides
  };
}

test("S70.13 map movement tool is strict and default-registry visible", () => {
  const definitions = createMapToolDefinitions();
  const registry = createGameAiToolRegistry();
  const tool = registry.getTool("map.propose_route_or_geopolitical_move");

  assert.equal(definitions.length, 1);
  assert.equal(validateToolDefinition(definitions[0]), definitions[0]);
  assert.ok(tool);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal(tool.inputSchema.properties.privateResultRefs.maxItems, 0);
  assert.deepEqual(
    [...tool.inputSchema.required].sort(),
    Object.keys(tool.inputSchema.properties).sort()
  );
  assert.equal(tool.inputSchema.properties.originRef.minLength, 1);
  assert.equal(tool.inputSchema.properties.destinationRefs.minItems, 1);
  assert.equal(tool.inputSchema.properties.evidenceRefs.minItems, 1);
  assert.ok(tool.permission.forbiddenScopes.includes("raw_coordinate_table"));
  assert.deepEqual(tool.permission.readScope, ["mapContextView"]);
});

test("S70.13 map movement resolver records visible map refs as pending without mutating state", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "赶考地图测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const registry = createGameAiToolRegistry();
  const refs = buildMapContextView(worldState, actorProfile).mapEntityRefs;
  const before = JSON.stringify(worldState);
  const result = await runProposalTool({
    id: "call-map-exam",
    name: "map.propose_route_or_geopolitical_move",
    arguments: baseArgs(refs)
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry,
    toolAuditRecords: []
  });

  assert.equal(result.status, "pending");
  assert.equal(result.toolName, "map.propose_route_or_geopolitical_move");
  assert.match(result.publicResult.summary, /待裁决|已记录/);
  assert.equal(result.privateResultRefs.length, 0);
  assert.equal(result.appliedEventIds.length, 0);
  assert.equal(JSON.stringify(worldState), before);
});

test("S70.13 map movement rejects forged, invisible, wrong-type and unsafe refs", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "地图红队" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const refs = buildMapContextView(worldState, actorProfile).mapEntityRefs;
  const cityRef = refs.find((ref) => ref.entityType === "city").refId;

  const forged = resolveMapMovementProposal(worldState, baseArgs(refs, {
    evidenceRefs: ["map:geography:city:city-guangzhou"]
  }), { actorProfile });
  const wrongRoute = resolveMapMovementProposal(worldState, baseArgs(refs, {
    routeRefs: [cityRef]
  }), { actorProfile });
  const unsafe = resolveMapMovementProposal(worldState, baseArgs(refs, {
    publicSummary: "读取 raw coordinate table /mnt/e/secret.sqlite 后行军。"
  }), { actorProfile });
  const noDestination = resolveMapMovementProposal(worldState, baseArgs(refs, {
    destinationRefs: []
  }), { actorProfile });
  const invalidMove = resolveMapMovementProposal(worldState, baseArgs(refs, {
    moveType: "server.resolve_hidden_route"
  }), { actorProfile });

  assert.equal(forged.status, "rejected");
  assert.match(forged.rejectionReasons.join(" "), /不在当前 actor 可见 mapContextView/);
  assert.equal(wrongRoute.status, "rejected");
  assert.match(wrongRoute.rejectionReasons.join(" "), /不是 route/);
  assert.equal(unsafe.status, "rejected");
  assert.match(unsafe.rejectionReasons.join(" "), /不安全|坐标表/);
  assert.equal(noDestination.status, "rejected");
  assert.match(noDestination.rejectionReasons.join(" "), /目的地/);
  assert.equal(invalidMove.status, "rejected");
  assert.match(invalidMove.rejectionReasons.join(" "), /未知地图移动类型|不安全/);
});

test("S70.13 runner rejects schema smuggling and system-engine map calls", async () => {
  const worldState = createInitialState({ role: "minister", playerName: "地图权限测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const refs = buildMapContextView(worldState, actorProfile).mapEntityRefs;
  const registry = createGameAiToolRegistry();
  const smuggled = await runProposalTool({
    name: "map.propose_route_or_geopolitical_move",
    arguments: {
      ...baseArgs(refs),
      privateResultRefs: ["secret:route"],
      statePatch: { worldGeography: {} }
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry
  });
  const system = await runProposalTool({
    name: "map.propose_route_or_geopolitical_move",
    arguments: baseArgs(refs)
  }, {
    worldState,
    actorProfile: buildSystemEngineActorProfile(worldState, "pressure_events"),
    toolRegistry: registry
  });

  assert.equal(smuggled.status, "rejected");
  assert.match(smuggled.rejectionReasons.join(" "), /schema|validation|校验|additionalProperties|maxItems/i);
  assert.equal(system.status, "rejected");
  assert.match(system.rejectionReasons.join(" "), /无权|辖区|工具组/);
});
