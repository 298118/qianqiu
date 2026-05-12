const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const {
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile,
  filterActorTools,
  isToolAllowedForActor
} = require("../src/game/aiActorProfiles");

function tool(name, overrides = {}) {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name,
    description: `${name} 是 S70.2 权限测试用的模型可见工具定义，服务器仍负责裁决。`,
    permission: {
      ...base.permission,
      ...overrides.permission
    },
    resolver: {
      ...base.resolver,
      ...overrides.resolver
    },
    audit: {
      ...base.audit,
      eventType: `audit_${name.replace(/[^a-z0-9]+/gi, "_")}`
    },
    cooldown: {
      ...base.cooldown,
      ...(overrides.cooldown || {})
    },
    mockFallback: {
      ...base.mockFallback,
      fixtureId: name.replace(/[^a-z0-9]+/gi, "_")
    }
  };
}

const TOOL_SET = [
  tool("world.read_visible_context", {
    permission: {
      toolType: "read",
      authorityTiers: ["T1", "T2", "T3", "T4", "T5", "T6"],
      actorTypes: ["scholar", "magistrate", "minister", "general", "emperor", "system_engine"],
      toolGroups: ["world_read"],
      requiresJurisdiction: false
    }
  }),
  tool("judicial.propose_case_resolution", {
    permission: {
      toolType: "proposal",
      authorityTiers: ["T3", "T4", "T5"],
      actorTypes: ["magistrate", "minister", "emperor"],
      toolGroups: ["judicial"],
      requiresJurisdiction: true
    }
  }),
  tool("military.propose_order", {
    permission: {
      toolType: "proposal",
      authorityTiers: ["T4", "T5"],
      actorTypes: ["general", "emperor"],
      toolGroups: ["military"],
      requiresJurisdiction: false
    }
  }),
  tool("ruler.propose_edict", {
    permission: {
      toolType: "request_adjudication",
      authorityTiers: ["T5"],
      actorTypes: ["emperor"],
      toolGroups: ["ruler"],
      requiresJurisdiction: false
    }
  }),
  tool("event.propose_incident", {
    permission: {
      toolType: "proposal",
      authorityTiers: ["T2", "T3", "T4", "T5", "T6"],
      actorTypes: ["gentry", "magistrate", "minister", "general", "emperor", "system_engine"],
      toolGroups: ["event"],
      requiresJurisdiction: false
    }
  }),
  tool("memory.propose_actor_memory", {
    permission: {
      toolType: "proposal",
      authorityTiers: ["T1", "T2", "T3", "T4", "T5", "T6"],
      actorTypes: ["scholar", "magistrate", "minister", "general", "emperor", "system_engine"],
      toolGroups: ["memory"],
      requiresJurisdiction: false
    }
  }),
  tool("time.request_skip_period", {
    permission: {
      toolType: "request_adjudication",
      authorityTiers: ["T1", "T3", "T4", "T5", "T6"],
      actorTypes: ["scholar", "magistrate", "minister", "emperor", "system_engine"],
      toolGroups: ["time"],
      requiresJurisdiction: false
    }
  }),
  tool("map.propose_route_or_geopolitical_move", {
    permission: {
      toolType: "proposal",
      authorityTiers: ["T1", "T3", "T4", "T5", "T6"],
      actorTypes: ["scholar", "magistrate", "general", "emperor", "system_engine"],
      toolGroups: ["map"],
      requiresJurisdiction: false
    }
  }),
  tool("server.resolve_case", {
    permission: {
      toolType: "request_adjudication",
      authorityTiers: ["T5"],
      actorTypes: ["emperor"],
      toolGroups: ["ruler"],
      requiresJurisdiction: false
    }
  })
];

test("S70.2 filters scholar tools away from judicial, military and ruler groups", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗士子" });
  const profile = buildPlayerAiActorProfile(worldState);
  const tools = filterActorTools(profile, TOOL_SET).map((item) => item.name);

  assert.equal(tools.includes("world.read_visible_context"), true);
  assert.equal(tools.includes("judicial.propose_case_resolution"), false);
  assert.equal(tools.includes("military.propose_order"), false);
  assert.equal(tools.includes("ruler.propose_edict"), false);
  assert.equal(tools.some((name) => name.startsWith("server.")), false);
});

test("S70.2 requires magistrate jurisdiction for local judicial tools", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const profile = buildPlayerAiActorProfile(worldState);
  const localRef = profile.jurisdictionRefs.find((ref) => ref.includes("city-") || ref.includes("county:"));
  const localTools = filterActorTools(profile, TOOL_SET, { jurisdictionRef: localRef }).map((item) => item.name);
  const foreignTools = filterActorTools(profile, TOOL_SET, { jurisdictionRef: "city-outside-border" }).map((item) => item.name);

  assert.equal(localTools.includes("world.read_visible_context"), true);
  assert.equal(localTools.includes("judicial.propose_case_resolution"), true);
  assert.equal(localTools.includes("military.propose_order"), false);
  assert.equal(localTools.includes("ruler.propose_edict"), false);
  assert.equal(foreignTools.includes("judicial.propose_case_resolution"), false);
});

test("S70.2 lets emperor request strong tools but never model-visible server resolvers", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "天子" });
  const profile = buildPlayerAiActorProfile(worldState);
  const tools = filterActorTools(profile, TOOL_SET).map((item) => item.name);

  assert.equal(tools.includes("world.read_visible_context"), true);
  assert.equal(tools.includes("military.propose_order"), true);
  assert.equal(tools.includes("ruler.propose_edict"), true);
  assert.equal(tools.includes("server.resolve_case"), false);
  assert.equal(isToolAllowedForActor(profile, TOOL_SET.at(-1)), false);
});

test("S70.2 keeps system engine on event/read tools only", () => {
  const worldState = createInitialState({ role: "minister", playerName: "部院官" });
  const profile = buildSystemEngineActorProfile(worldState, "pressure_events");
  const tools = filterActorTools(profile, TOOL_SET).map((item) => item.name);

  assert.equal(tools.includes("world.read_visible_context"), true);
  assert.equal(tools.includes("event.propose_incident"), true);
  assert.equal(tools.includes("memory.propose_actor_memory"), false);
  assert.equal(tools.includes("time.request_skip_period"), false);
  assert.equal(tools.includes("map.propose_route_or_geopolitical_move"), false);
  assert.equal(tools.includes("judicial.propose_case_resolution"), false);
  assert.equal(tools.includes("military.propose_order"), false);
  assert.equal(tools.includes("ruler.propose_edict"), false);
});
