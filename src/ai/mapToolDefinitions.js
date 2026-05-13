const {
  MAP_MOVEMENT_TYPE_IDS,
  MAP_MOVEMENT_TYPES
} = require("../game/mapContextConfig");

function stringArraySchema(maxItems, options = {}) {
  const schema = {
    type: "array",
    items: { type: "string" },
    maxItems
  };
  if (Number.isInteger(options.minItems)) schema.minItems = options.minItems;
  return schema;
}

function createMapMovementToolInputSchema() {
  return {
    type: "object",
    required: [
      "moveType",
      "publicSummary",
      "originRef",
      "destinationRefs",
      "routeRefs",
      "affectedMapRefs",
      "evidenceRefs",
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
    ],
    additionalProperties: false,
    properties: {
      moveType: { type: "string", enum: MAP_MOVEMENT_TYPE_IDS },
      publicSummary: { type: "string" },
      originRef: { type: "string", minLength: 1 },
      destinationRefs: stringArraySchema(5, { minItems: 1 }),
      routeRefs: stringArraySchema(5),
      affectedMapRefs: stringArraySchema(8),
      evidenceRefs: stringArraySchema(8, { minItems: 1 }),
      jurisdictionRef: { type: "string" },
      visibility: { type: "string", enum: ["player_visible", "actor_visible"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      riskLevel: { type: "integer", minimum: 0, maximum: 5 },
      cooldownKey: { type: "string" },
      expectedBenefits: stringArraySchema(5),
      counterCosts: stringArraySchema(5),
      riskDisclosure: { type: "string" },
      privateResultRefs: {
        type: "array",
        items: { type: "string" },
        maxItems: 0
      },
      riskTags: stringArraySchema(6)
    }
  };
}

function createMapMovementToolDefinition() {
  const labels = MAP_MOVEMENT_TYPE_IDS
    .map((type) => `${type}=${MAP_MOVEMENT_TYPES[type].label}`)
    .join("、");

  return {
    name: "map.propose_route_or_geopolitical_move",
    description: `提交赶考、赴任、巡查、行军、押解、使节出行或商路活动的地图移动 proposal；服务器复核可见地点、辖区、路线、消耗、战和与持久化。类型：${labels}。`,
    inputSchema: createMapMovementToolInputSchema(),
    permission: {
      toolType: "proposal",
      authorityTiers: ["T1", "T2", "T3", "T4", "T5"],
      actorTypes: ["scholar", "gentry", "clerk", "magistrate", "minister", "censor", "general", "emperor", "foreign_ruler", "examiner"],
      toolGroups: ["map"],
      readScope: ["mapContextView"],
      proposalScope: ["map_movement_candidate", "route_or_geopolitical_move_candidate"],
      visibilityBoundary: "只可引用 actor 当前可见的 mapContextView.mapEntityRefs；不得读取 raw coordinate table、hidden enemy truth、SQLite raw table、provider payload、本地路径、key 或内部 server.* resolver。",
      forbiddenScopes: ["sql", "raw_table", "raw_world_state_patch", "raw_audit", "hidden_notes", "hidden_enemy_truth", "raw_coordinate_table", "provider_config", "local_path", "server_resolver"],
      requiresJurisdiction: false,
      requiresEvidence: true
    },
    resolver: {
      kind: "proposal_resolver",
      name: "server.resolve_map_movement_proposal",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    audit: {
      eventType: "ai_tool_map_movement_proposal",
      summaryFields: ["actorRef.actorId", "moveType", "originRef", "destinationRefs", "routeRefs", "evidenceRefs", "visibility", "confidence"],
      redactFields: ["rawPrompt", "providerConfig", "localPath", "hiddenNotes", "privateResultRefs"],
      recordRejected: true,
      publicProjection: "tool name, actor, move type, safe map refs, status, rejection reason"
    },
    cooldown: {
      scope: "actor",
      turns: 1,
      cooldownKeyFields: ["actorRef.actorId", "cooldownKey"]
    },
    mockFallback: {
      mode: "pending",
      fixtureId: "map_movement_pending",
      publicSummary: "Mock 模式只记录地图移动意图，不直接改变地点、行军、赴任、赶考、外交或商路结果。"
    },
    riskTags: ["map", "movement", "server_adjudication_required", "hidden_redaction"],
    providerCompatibility: {
      openAiChat: "needs_probe",
      anthropic: "needs_probe",
      mcp: "compatible",
      notes: "S70.13 先固定地图 proposal schema 与 pending/rejected 语义；真实路线结算和地图 UI 留给后续步骤。"
    }
  };
}

function createMapToolDefinitions() {
  return [createMapMovementToolDefinition()];
}

module.exports = {
  createMapMovementToolDefinition,
  createMapToolDefinitions,
  createMapMovementToolInputSchema
};
