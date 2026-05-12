const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const {
  buildToolResultForModel,
  normalizeProviderToolCall,
  runGameAiTool,
  runProposalTool,
  runReadTool,
  runRequestAdjudicationTool
} = require("../src/ai/gameAiToolRunner");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const {
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile
} = require("../src/game/aiActorProfiles");

function edictToolDefinition() {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name: "ruler.propose_edict",
    description: "高位 actor 提交诏令 request-adjudication；服务器检查法度、证据、财政、军心和执行链后才可落地。",
    inputSchema: {
      type: "object",
      required: ["edictSummary", "evidenceRefs", "riskDisclosure"],
      additionalProperties: false,
      properties: {
        edictSummary: { type: "string" },
        evidenceRefs: {
          type: "array",
          items: { type: "string" }
        },
        riskDisclosure: { type: "string" }
      }
    },
    permission: {
      ...base.permission,
      toolType: "request_adjudication",
      authorityTiers: ["T5"],
      actorTypes: ["emperor"],
      toolGroups: ["ruler"],
      proposalScope: ["edict_candidate"]
    },
    resolver: {
      kind: "adjudication_resolver",
      name: "server.pending_adjudication",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    }
  };
}

function eventToolDefinition() {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name: "event.propose_incident",
    description: "提交一个压力事件候选 proposal；服务器只记录待裁决意图，不直接改写世界事实。",
    inputSchema: {
      type: "object",
      required: ["publicSummary", "sourcePressureRefs", "confidence"],
      additionalProperties: false,
      properties: {
        publicSummary: { type: "string" },
        sourcePressureRefs: {
          type: "array",
          items: { type: "string" }
        },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    permission: {
      ...base.permission,
      toolType: "proposal",
      authorityTiers: ["T3", "T4", "T5", "T6"],
      actorTypes: ["magistrate", "minister", "general", "emperor", "system_engine"],
      toolGroups: ["event"],
      proposalScope: ["incident_candidate"]
    },
    resolver: {
      kind: "proposal_resolver",
      name: "server.pending_proposal",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    }
  };
}

function registry() {
  return createGameAiToolRegistry([
    createVisibleContextReadToolDefinition(),
    edictToolDefinition(),
    eventToolDefinition()
  ]);
}

test("S70.3 normalizes provider tool calls across OpenAI-style and direct shapes", () => {
  assert.deepEqual(normalizeProviderToolCall({
    id: "call-1",
    function: {
      name: "world_read_visible_context",
      arguments: "{\"domains\":[\"people\"],\"query\":\"同年\",\"maxItems\":2}"
    }
  }, {
    providerToolNameMap: {
      world_read_visible_context: "world.read_visible_context"
    }
  }), {
    id: "call-1",
    name: "world.read_visible_context",
    arguments: {
      domains: ["people"],
      query: "同年",
      maxItems: 2
    }
  });

  assert.deepEqual(normalizeProviderToolCall({
    id: "call-2",
    name: "event.propose_incident",
    arguments: {
      publicSummary: "粮价风波",
      sourcePressureRefs: ["economicFiscalView:grain"],
      confidence: 0.5
    }
  }).arguments.sourcePressureRefs, ["economicFiscalView:grain"]);
});

test("S70.3 read runner returns safe visible context without exposing hidden rows", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "读书人" });
  worldState.characters.push({
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    alive: true,
    skill: 50,
    loyalty: 50,
    ambition: 50
  });
  worldState.relationshipLedger.characters.C99 = {
    id: "C99",
    name: "密札中人",
    visible: false,
    relationship: 0,
    resentment: 0,
    recentIntent: "SEALED_TOOL_CONTEXT hiddenNotes provider proposal /mnt/e/secret",
    lastUpdatedTurn: 0
  };
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const toolAuditRecords = [];

  const result = await runReadTool({
    id: "call-visible-context",
    name: "world.read_visible_context",
    arguments: {
      domains: ["people", "study", "exam"],
      query: "师友与科举",
      maxItems: 6
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry(),
    toolAuditRecords
  });
  const serialized = JSON.stringify({ result, toolAuditRecords });

  assert.equal(result.status, "accepted");
  assert.equal(result.modelFollowUpHint, "call-visible-context");
  assert.equal(result.publicResult.visibleChanges.length > 0, true);
  assert.equal(serialized.includes("SEALED_TOOL_CONTEXT"), false);
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("provider proposal"), false);
  assert.equal(serialized.includes("/mnt/e/secret"), false);
  assert.equal(toolAuditRecords.length, 1);
});

test("S70.3 runner rejects unauthorized or mismatched tool calls before resolver effects", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "越权书生" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const toolAuditRecords = [];

  const result = await runRequestAdjudicationTool({
    id: "call-edict",
    name: "ruler.propose_edict",
    arguments: {
      edictSummary: "自授尚书",
      evidenceRefs: ["player_input"],
      riskDisclosure: "无制度依据。"
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry(),
    toolAuditRecords
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.modelFollowUpHint, "call-edict");
  assert.match(result.rejectionReasons.join(" "), /无权|辖区/);
  assert.equal(worldState.player.officeTitle, null);
  assert.equal(toolAuditRecords[0].status, "rejected");

  const mismatch = await runProposalTool({
    name: "world.read_visible_context",
    arguments: {
      domains: ["events"],
      query: "近事",
      maxItems: 1
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry()
  });
  assert.equal(mismatch.status, "rejected");
  assert.match(mismatch.rejectionReasons.join(" "), /类型/);
});

test("S70.3 proposal runner returns pending server result and model-safe payload", async () => {
  const worldState = createInitialState({ role: "minister", playerName: "部院官" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const result = await runProposalTool({
    id: "call-event-proposal",
    name: "event.propose_incident",
    arguments: {
      publicSummary: "粮价高企，士绅请愿。",
      sourcePressureRefs: ["economicFiscalView:grain"],
      confidence: 0.62
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry()
  });
  const modelPayload = buildToolResultForModel(result, { id: "call-event-proposal" });

  assert.equal(result.status, "pending");
  assert.match(result.publicResult.summary, /待裁决/);
  assert.equal(result.appliedEventIds.length, 0);
  assert.equal(modelPayload.role, "tool");
  assert.equal(modelPayload.tool_call_id, "call-event-proposal");
  assert.equal(JSON.parse(modelPayload.content).status, "pending");
});

test("S70.3 read runner filters domains outside actor visibility", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "视野测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const result = await runReadTool({
    id: "call-domain-filter",
    name: "world.read_visible_context",
    arguments: {
      domains: ["people", "office", "intel", "market", "local_docket"],
      query: "越界读取",
      maxItems: 8
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry()
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "accepted");
  assert.match(result.counterCosts.join(" "), /office|intel|market|local_docket/);
  assert.equal(serialized.includes("户部"), false);
  assert.equal(serialized.includes("奏报"), false);
});

test("S70.3 generic runner applies cooldown in local context", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "冷却测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const toolRegistry = registry();
  const context = {
    worldState,
    actorProfile,
    toolRegistry,
    toolCooldowns: {}
  };
  const call = {
    name: "world.read_visible_context",
    arguments: {
      domains: ["events"],
      query: "近事",
      maxItems: 1
    }
  };
  toolRegistry.registerGameAiTool({
    ...createVisibleContextReadToolDefinition(),
    cooldown: {
      scope: "actor",
      turns: 2,
      cooldownKeyFields: ["actorRef.actorId"]
    }
  }, { replace: true });

  const first = await runGameAiTool(call, context);
  const second = await runGameAiTool(call, context);

  assert.equal(first.status, "accepted");
  assert.equal(second.status, "rejected");
  assert.match(second.rejectionReasons.join(" "), /冷却/);
});

test("S70.3 system engine can propose incidents but not time, memory or map tools", async () => {
  const worldState = createInitialState({ role: "minister", playerName: "部院官" });
  const actorProfile = buildSystemEngineActorProfile(worldState, "pressure_events");
  const result = await runProposalTool({
    name: "event.propose_incident",
    arguments: {
      publicSummary: "河工压力积累。",
      sourcePressureRefs: ["localAffairsDocketView:water"],
      confidence: 0.5
    }
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry()
  });

  assert.equal(result.status, "pending");
  assert.equal(result.appliedEventIds.length, 0);
});

test("S70.3 unknown and internal tool attempts still produce audit records", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "探针测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const toolAuditRecords = [];
  const unknown = await runGameAiTool({
    id: "call-unknown",
    name: "unknown.raw_state_patch",
    arguments: {}
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry(),
    toolAuditRecords
  });
  const internal = await runGameAiTool({
    id: "call-server",
    name: "server.resolve_case",
    arguments: {}
  }, {
    worldState,
    actorProfile,
    toolRegistry: registry(),
    toolAuditRecords
  });

  assert.equal(unknown.status, "rejected");
  assert.equal(internal.status, "rejected");
  assert.equal(toolAuditRecords.length, 2);
  assert.equal(toolAuditRecords[0].rejectedReason, "unknown_tool");
  assert.equal(toolAuditRecords[1].rejectedReason, "internal_tool_denied");
  assert.equal(toolAuditRecords.some((record) => record.toolName.startsWith("server.")), true);
});
