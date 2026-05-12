function stringArraySchema(maxItems) {
  return {
    type: "array",
    items: { type: "string" },
    maxItems
  };
}

function domainToolInputSchema(actionProperty, actionEnum) {
  return {
    type: "object",
    required: [
      actionProperty,
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
    ],
    additionalProperties: false,
    properties: {
      [actionProperty]: { type: "string", enum: actionEnum },
      publicSummary: { type: "string" },
      evidenceRefs: stringArraySchema(8),
      targetRefs: stringArraySchema(8),
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

const DOMAIN_TOOL_CONFIGS = Object.freeze([
  Object.freeze({
    name: "judicial.propose_case_resolution",
    description: "提交刑名案牍处置 proposal；服务器复核证据、辖区、士绅压力和法度后才可形成判决或归档。",
    actionProperty: "caseAction",
    actionEnum: ["mediate", "fine", "detain", "dismiss", "escalate", "defer"],
    toolType: "proposal",
    authorityTiers: ["T2", "T3", "T4", "T5"],
    actorTypes: ["clerk", "magistrate", "minister", "censor", "emperor"],
    toolGroups: ["judicial"],
    readScope: ["localAffairsDocketView", "officialPostingsView", "eventArchiveView"],
    proposalScope: ["case_resolution_candidate"],
    resolverName: "server.resolve_domain_tool_proposal",
    auditEventType: "ai_tool_judicial_case_proposal",
    mockFixtureId: "judicial_case_resolution_pending",
    mockMode: "pending",
    requiresJurisdiction: true,
    requiresEvidence: true,
    riskTags: ["judicial", "server_adjudication_required", "hidden_redaction"]
  }),
  Object.freeze({
    name: "city.propose_policy",
    description: "提交地方钱粮、水利、赈济或治安政策 proposal；服务器裁决财政、民情、执行链和持久化。",
    actionProperty: "policyKind",
    actionEnum: ["relief", "grain_price_stabilization", "tax_collection", "waterworks", "public_order", "market_regulation"],
    toolType: "proposal",
    authorityTiers: ["T3", "T4", "T5"],
    actorTypes: ["magistrate", "minister", "emperor"],
    toolGroups: ["city_policy"],
    readScope: ["localAffairsDocketView", "economicFiscalView", "worldGeographyView", "eventArchiveView"],
    proposalScope: ["city_policy_candidate"],
    resolverName: "server.resolve_domain_tool_proposal",
    auditEventType: "ai_tool_city_policy_proposal",
    mockFixtureId: "city_policy_pending",
    mockMode: "pending",
    requiresJurisdiction: true,
    requiresEvidence: true,
    riskTags: ["city_policy", "fiscal_risk", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "military.propose_order",
    description: "提交军令、边防、调粮或战役行动 proposal；服务器裁决军心、粮道、兵力、战果和审计。",
    actionProperty: "orderKind",
    actionEnum: ["defend", "train", "scout", "resupply", "mobilize", "engage", "withdraw"],
    toolType: "proposal",
    authorityTiers: ["T4", "T5"],
    actorTypes: ["general", "minister", "emperor", "foreign_ruler"],
    toolGroups: ["military"],
    readScope: ["militaryDiplomacyView", "worldGeographyView", "intelligenceRumorView", "eventArchiveView"],
    proposalScope: ["military_order_candidate"],
    resolverName: "server.resolve_domain_tool_proposal",
    auditEventType: "ai_tool_military_order_proposal",
    mockFixtureId: "military_order_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["military", "battle_risk", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "diplomacy.propose_move",
    description: "提交互市、遣使、和议、警告或宣战请求 proposal；服务器裁决礼法、边情、财政和战和后果。",
    actionProperty: "moveKind",
    actionEnum: ["envoy", "negotiate_trade", "seek_truce", "demand_tribute", "warn_border", "declare_war_request", "alliance"],
    toolType: "proposal",
    authorityTiers: ["T4", "T5"],
    actorTypes: ["general", "minister", "emperor", "foreign_ruler"],
    toolGroups: ["diplomacy"],
    readScope: ["militaryDiplomacyView", "worldGeographyView", "intelligenceRumorView", "eventArchiveView"],
    proposalScope: ["diplomacy_move_candidate"],
    resolverName: "server.resolve_domain_tool_proposal",
    auditEventType: "ai_tool_diplomacy_move_proposal",
    mockFixtureId: "diplomacy_move_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["diplomacy", "war_peace_risk", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "exam.request_ranking_adjudication",
    description: "请求服务器复核科场名次、阅卷疑点或荣誉确认；模型不能直接改榜、授功名或处罚考生。",
    actionProperty: "rankingConcern",
    actionEnum: ["review_score", "check_procedure", "fraud_risk", "ranking_adjustment_request", "honor_confirmation"],
    toolType: "request_adjudication",
    authorityTiers: ["T3", "T4", "T5"],
    actorTypes: ["examiner", "minister", "emperor"],
    toolGroups: ["exam"],
    readScope: ["examProcedureView", "examinerPanelView", "examHonorView", "eventArchiveView"],
    proposalScope: ["exam_ranking_adjudication_request"],
    resolverName: "server.request_domain_tool_adjudication",
    auditEventType: "ai_tool_exam_ranking_adjudication_request",
    mockFixtureId: "exam_ranking_adjudication_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["exam", "ranking", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "office.request_appointment_adjudication",
    description: "请求服务器复核初授、迁转、官缺或回避；吏部、御史和皇帝 proposal 不能直接写官职事实。",
    actionProperty: "appointmentConcern",
    actionEnum: ["initial_assignment", "avoidance_review", "vacancy_match", "transfer_review", "imperial_review"],
    toolType: "request_adjudication",
    authorityTiers: ["T4", "T5"],
    actorTypes: ["minister", "censor", "emperor"],
    toolGroups: ["career"],
    readScope: ["officialPostingsView", "appointmentTrackView", "examHonorView", "eventArchiveView"],
    proposalScope: ["appointment_adjudication_request"],
    resolverName: "server.request_domain_tool_adjudication",
    auditEventType: "ai_tool_office_appointment_adjudication_request",
    mockFixtureId: "office_appointment_adjudication_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["office", "career", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "career.propose_reward_or_promotion",
    description: "提交赏赐、保举、升迁或褒奖 proposal；服务器按官制、考成、名次、回避和派系风险裁决。",
    actionProperty: "careerAction",
    actionEnum: ["reward", "promotion", "commendation", "title_grant", "appointment_recommendation"],
    toolType: "proposal",
    authorityTiers: ["T4", "T5"],
    actorTypes: ["minister", "censor", "emperor"],
    toolGroups: ["career"],
    readScope: ["officialPostingsView", "appointmentTrackView", "examHonorView", "eventArchiveView"],
    proposalScope: ["career_reward_promotion_candidate"],
    resolverName: "server.resolve_domain_tool_proposal",
    auditEventType: "ai_tool_career_reward_promotion_proposal",
    mockFixtureId: "career_reward_promotion_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["career", "promotion", "server_adjudication_required"]
  }),
  Object.freeze({
    name: "career.request_discipline_adjudication",
    description: "请求服务器复核弹劾、处分、降调或罢黜；模型不能直接惩罚角色、清空官职或写审计表。",
    actionProperty: "disciplineConcern",
    actionEnum: ["impeachment", "demotion", "fine", "dismissal", "criminal_referral", "warning"],
    toolType: "request_adjudication",
    authorityTiers: ["T4", "T5"],
    actorTypes: ["minister", "censor", "emperor"],
    toolGroups: ["career"],
    readScope: ["officialPostingsView", "localAffairsDocketView", "eventArchiveView"],
    proposalScope: ["career_discipline_adjudication_request"],
    resolverName: "server.request_domain_tool_adjudication",
    auditEventType: "ai_tool_career_discipline_adjudication_request",
    mockFixtureId: "career_discipline_adjudication_pending",
    mockMode: "pending",
    requiresJurisdiction: false,
    requiresEvidence: true,
    riskTags: ["career", "discipline", "server_adjudication_required"]
  })
]);

function resolverKindFor(toolType) {
  return toolType === "request_adjudication" ? "adjudication_resolver" : "proposal_resolver";
}

function createDomainToolDefinition(config) {
  return {
    name: config.name,
    description: config.description,
    inputSchema: domainToolInputSchema(config.actionProperty, config.actionEnum),
    permission: {
      toolType: config.toolType,
      authorityTiers: [...config.authorityTiers],
      actorTypes: [...config.actorTypes],
      toolGroups: [...config.toolGroups],
      readScope: [...config.readScope],
      proposalScope: [...config.proposalScope],
      visibilityBoundary: "只可引用 actor 当前可见的服务器 projection evidenceRefs；不得读取 raw table、hidden 私档、provider payload、本地路径、key 或内部 server.* resolver。",
      forbiddenScopes: ["sql", "raw_table", "raw_world_state_patch", "raw_audit", "hidden_notes", "provider_config", "local_path", "server_resolver"],
      requiresJurisdiction: config.requiresJurisdiction === true,
      requiresEvidence: config.requiresEvidence !== false
    },
    resolver: {
      kind: resolverKindFor(config.toolType),
      name: config.resolverName,
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    audit: {
      eventType: config.auditEventType,
      summaryFields: ["actorRef.actorId", config.actionProperty, "evidenceRefs", "visibility", "confidence"],
      redactFields: ["rawPrompt", "providerConfig", "localPath", "hiddenNotes", "privateResultRefs"],
      recordRejected: true,
      publicProjection: "tool name, actor, action kind, safe evidence refs, status, rejection reason"
    },
    cooldown: {
      scope: "actor",
      turns: 1,
      cooldownKeyFields: ["actorRef.actorId", "cooldownKey"]
    },
    mockFallback: {
      mode: config.mockMode,
      fixtureId: config.mockFixtureId,
      publicSummary: "Mock 模式只返回服务器待裁决，不直接形成领域后果。"
    },
    riskTags: [...config.riskTags],
    providerCompatibility: {
      openAiChat: "needs_probe",
      anthropic: "needs_probe",
      mcp: "compatible",
      notes: "S70.7 固定领域工具 schema 与 pending/rejected 语义；真实领域结算留给后续服务器 resolver。"
    }
  };
}

function createDomainToolDefinitions() {
  return DOMAIN_TOOL_CONFIGS.map(createDomainToolDefinition);
}

module.exports = {
  DOMAIN_TOOL_CONFIGS,
  createDomainToolDefinition,
  createDomainToolDefinitions,
  domainToolInputSchema
};
