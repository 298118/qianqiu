function eventIncidentInputSchema() {
  return {
    type: "object",
    required: [
      "incidentKind",
      "publicSummary",
      "sourcePressureRefs",
      "visibility",
      "confidence",
      "severity",
      "cooldownKey",
      "affectedRefs",
      "privateResultRefs",
      "riskTags"
    ],
    additionalProperties: false,
    properties: {
      incidentKind: {
        type: "string",
        enum: [
          "city_pressure",
          "frontier_alert",
          "academy_pressure",
          "court_pressure",
          "npc_resentment",
          "fiscal_market",
          "local_docket",
          "rumor_pressure",
          "generic_incident"
        ]
      },
      publicSummary: { type: "string" },
      sourcePressureRefs: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      visibility: {
        type: "string",
        enum: ["player_visible", "actor_visible"]
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      severity: { type: "integer", minimum: 0, maximum: 5 },
      cooldownKey: { type: "string" },
      affectedRefs: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      privateResultRefs: {
        type: "array",
        items: { type: "string" },
        maxItems: 0
      },
      riskTags: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      }
    }
  };
}

function createEventProposalToolDefinition() {
  return {
    name: "event.propose_incident",
    description: "提交一个压力事件候选 proposal；服务器只记录待裁决意图，不直接改写世界事实、事件档案或数据库。",
    inputSchema: eventIncidentInputSchema(),
    permission: {
      toolType: "proposal",
      authorityTiers: ["T2", "T3", "T4", "T5", "T6"],
      actorTypes: ["gentry", "clerk", "examiner", "magistrate", "minister", "censor", "general", "emperor", "foreign_ruler", "system_engine"],
      toolGroups: ["event"],
      readScope: ["server_visible_pressure_views"],
      proposalScope: ["incident_candidate"],
      visibilityBoundary: "只可引用 actor 可见的城市、案牍、财赋、军务、情报、人物或实体压力摘要；不得读取 raw table、hidden 私档、本地路径或 key。",
      forbiddenScopes: ["sql", "raw_table", "raw_world_state_patch", "raw_audit", "hidden_notes", "provider_config", "local_path", "server_resolver"],
      requiresJurisdiction: false,
      requiresEvidence: true
    },
    resolver: {
      kind: "proposal_resolver",
      name: "server.resolve_event_proposal",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    audit: {
      eventType: "ai_tool_event_proposal",
      summaryFields: ["actorRef.actorId", "incidentKind", "sourcePressureRefs", "visibility", "confidence"],
      redactFields: ["rawPrompt", "providerConfig", "localPath", "hiddenNotes", "privateResultRefs"],
      recordRejected: true,
      publicProjection: "tool name, actor, incident kind, safe pressure refs, status, rejection reason"
    },
    cooldown: {
      scope: "actor",
      turns: 1,
      cooldownKeyFields: ["actorRef.actorId", "cooldownKey"]
    },
    mockFallback: {
      mode: "deterministic",
      fixtureId: "event_pressure_candidate_minimal",
      publicSummary: "Mock 模式按可见压力摘要生成待裁决事件候选。"
    },
    riskTags: ["event_candidate", "server_adjudication_required", "hidden_redaction"],
    providerCompatibility: {
      openAiChat: "needs_probe",
      anthropic: "needs_probe",
      mcp: "compatible",
      notes: "S70.6 固定 schema 与 pending 语义；真实 provider 兼容在后续 smoke 扩展。"
    }
  };
}

function createEventIncidentAdjudicationToolDefinition() {
  const base = createEventProposalToolDefinition();
  return {
    ...base,
    name: "event.request_incident_adjudication",
    description: "请求服务器审阅压力事件候选是否成案；模型不能直接写公开事件、状态、审计表或数据库。",
    permission: {
      ...base.permission,
      toolType: "request_adjudication",
      authorityTiers: ["T3", "T4", "T5", "T6"],
      actorTypes: ["examiner", "magistrate", "minister", "censor", "general", "emperor", "foreign_ruler", "system_engine"],
      proposalScope: ["incident_adjudication_request"]
    },
    resolver: {
      kind: "adjudication_resolver",
      name: "server.request_event_incident_adjudication",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    audit: {
      eventType: "ai_tool_event_adjudication_request",
      summaryFields: ["actorRef.actorId", "incidentKind", "sourcePressureRefs", "visibility", "confidence"],
      redactFields: ["rawPrompt", "providerConfig", "localPath", "hiddenNotes", "privateResultRefs"],
      recordRejected: true,
      publicProjection: "tool name, actor, incident kind, safe pressure refs, status, rejection reason"
    },
    mockFallback: {
      mode: "pending",
      fixtureId: "event_incident_adjudication_pending",
      publicSummary: "Mock 模式只返回待服务器裁决，不让事件直接成案。"
    },
    riskTags: ["event_candidate", "request_adjudication", "server_adjudication_required", "hidden_redaction"]
  };
}

function createEventToolDefinitions() {
  return [
    createEventProposalToolDefinition(),
    createEventIncidentAdjudicationToolDefinition()
  ];
}

module.exports = {
  createEventIncidentAdjudicationToolDefinition,
  createEventProposalToolDefinition,
  createEventToolDefinitions,
  eventIncidentInputSchema
};
