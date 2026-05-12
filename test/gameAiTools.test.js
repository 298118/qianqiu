const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createGameAiToolRegistry,
  listToolsForActor,
  registerGameAiTool
} = require("../src/ai/gameAiTools");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");

function proposalToolDefinition() {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name: "event.propose_incident",
    description: "提交一个安全事件候选 proposal；服务器只记录待裁决意图，不让模型直接写状态或数据库。",
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

test("S70.3 game AI tool registry validates, stores and maps tool definitions", () => {
  const registry = createGameAiToolRegistry([]);
  const readTool = createVisibleContextReadToolDefinition();
  const eventTool = proposalToolDefinition();

  registerGameAiTool(registry, readTool);
  registerGameAiTool(registry, eventTool);

  assert.equal(registry.getTool("world.read_visible_context").name, "world.read_visible_context");
  assert.equal(registry.getTool("event.propose_incident").name, "event.propose_incident");
  assert.deepEqual(registry.buildProviderNameMap(), {
    world_read_visible_context: "world.read_visible_context",
    event_propose_incident: "event.propose_incident"
  });
  assert.ok(registry.getTool("world.read_visible_context").inputSchema.properties.domains.items.enum.includes("market"));
  assert.ok(registry.getTool("world.read_visible_context").inputSchema.properties.domains.items.enum.includes("local_docket"));
  assert.throws(() => registerGameAiTool(registry, eventTool), /already registered/);
  assert.throws(() => registerGameAiTool(registry, { ...readTool, name: "server.resolve_case" }), /server\.\*/);
});

test("S70.3 registry lists only actor-visible tools", () => {
  const registry = createGameAiToolRegistry([
    createVisibleContextReadToolDefinition(),
    proposalToolDefinition()
  ]);
  const scholar = buildPlayerAiActorProfile(createInitialState({ role: "scholar", playerName: "寒窗士子" }));
  const magistrate = buildPlayerAiActorProfile(createInitialState({ role: "magistrate", playerName: "清河县令" }));
  const scholarTools = listToolsForActor(scholar, registry).map((tool) => tool.name);
  const magistrateTools = listToolsForActor(magistrate, registry).map((tool) => tool.name);

  assert.deepEqual(scholarTools, ["world.read_visible_context"]);
  assert.equal(magistrateTools.includes("world.read_visible_context"), true);
  assert.equal(magistrateTools.includes("event.propose_incident"), true);
});
