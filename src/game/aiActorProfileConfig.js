const AI_ACTOR_PROFILE_SCHEMA_VERSION = 1;

const AUTHORITY_TIER_ORDER = Object.freeze(["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);

const AUTHORITY_TIERS = Object.freeze({
  T0: Object.freeze({
    label: "背景民人",
    summary: "只能提出自身行动、传闻和低影响事件材料，不直接改世界指标。",
    defaultToolGroups: ["personal_action", "relationship", "memory"],
    forbiddenToolGroups: ["city_policy", "judicial", "military", "diplomacy", "ruler", "career"],
    visibilityPreset: "public_micro",
    budgetPreset: "background"
  }),
  T1: Object.freeze({
    label: "书生/亲友",
    summary: "影响自身学业、文章、关系、名声和局部微事件。",
    defaultToolGroups: ["world_read", "law", "personal_action", "relationship", "study", "exam", "memory", "time", "map"],
    forbiddenToolGroups: ["city_policy", "judicial", "military", "diplomacy", "ruler", "career"],
    visibilityPreset: "relationship_local",
    budgetPreset: "low"
  }),
  T2: Object.freeze({
    label: "士绅/商贾/吏员",
    summary: "可提出赞助、拖延、告发、市场与地方舆情 proposal。",
    defaultToolGroups: ["world_read", "law", "office_read", "intel", "market", "personal_action", "relationship", "event", "memory", "map"],
    forbiddenToolGroups: ["military", "diplomacy", "ruler", "career"],
    visibilityPreset: "local_society",
    budgetPreset: "low"
  }),
  T3: Object.freeze({
    label: "地方官/低阶军官",
    summary: "可处理辖区案牍、钱粮、水利、拘捕、地方奏报和局部兵备 proposal。",
    defaultToolGroups: ["world_read", "law", "office_read", "intel", "market", "personal_action", "relationship", "event", "city_policy", "judicial", "report", "memory", "time", "map"],
    forbiddenToolGroups: ["ruler"],
    visibilityPreset: "local_office",
    budgetPreset: "medium"
  }),
  T4: Object.freeze({
    label: "部院/御史/总督/将领",
    summary: "可提出弹劾、任命建议、调粮、军令、跨区域差遣和领域审查 proposal。",
    defaultToolGroups: ["world_read", "law", "office_read", "intel", "market", "personal_action", "relationship", "event", "city_policy", "judicial", "military", "diplomacy", "career", "report", "memory", "time", "map"],
    forbiddenToolGroups: ["ruler"],
    visibilityPreset: "court_domain",
    budgetPreset: "high"
  }),
  T5: Object.freeze({
    label: "皇帝/摄政/外邦君主",
    summary: "可提出诏令、任免、赦免、诛罚、宣战、和议、税制和国家战略请求，但仍受服务器执行链裁决。",
    defaultToolGroups: ["world_read", "law", "office_read", "intel", "market", "personal_action", "relationship", "event", "city_policy", "judicial", "military", "diplomacy", "ruler", "career", "report", "memory", "time", "map"],
    forbiddenToolGroups: [],
    visibilityPreset: "imperial_broad",
    budgetPreset: "imperial"
  }),
  T6: Object.freeze({
    label: "系统世界引擎",
    summary: "自然、市场、边患、事件链和长期压力演化的服务器调度 actor，不代表任何角色。",
    defaultToolGroups: ["world_read", "event", "market", "intel", "report"],
    forbiddenToolGroups: ["ruler", "career", "judicial", "diplomacy", "military", "memory", "time", "map"],
    visibilityPreset: "system_safe",
    budgetPreset: "system"
  })
});

const TOOL_GROUPS = Object.freeze({
  world_read: Object.freeze({ label: "可见世界读取", toolType: "read" }),
  law: Object.freeze({ label: "礼法官制读取", toolType: "read" }),
  office_read: Object.freeze({ label: "官署案牍读取", toolType: "read" }),
  intel: Object.freeze({ label: "情报奏报读取", toolType: "read" }),
  market: Object.freeze({ label: "市价财赋读取", toolType: "read" }),
  personal_action: Object.freeze({ label: "个人行动建议", toolType: "proposal" }),
  relationship: Object.freeze({ label: "关系变化建议", toolType: "proposal" }),
  event: Object.freeze({ label: "事件候选建议", toolType: "proposal" }),
  study: Object.freeze({ label: "读书与老师建议", toolType: "proposal" }),
  exam: Object.freeze({ label: "科举题评建议", toolType: "proposal" }),
  city_policy: Object.freeze({ label: "地方政策建议", toolType: "proposal" }),
  judicial: Object.freeze({ label: "刑名案件建议", toolType: "proposal" }),
  military: Object.freeze({ label: "军令战役建议", toolType: "proposal" }),
  diplomacy: Object.freeze({ label: "外交会盟建议", toolType: "proposal" }),
  ruler: Object.freeze({ label: "诏令国家战略建议", toolType: "request_adjudication" }),
  career: Object.freeze({ label: "赏罚升迁建议", toolType: "request_adjudication" }),
  report: Object.freeze({ label: "职位化报告", toolType: "read" }),
  ai_settings: Object.freeze({ label: "AI 设置策略", toolType: "proposal" }),
  memory: Object.freeze({ label: "记忆读取与提炼", toolType: "proposal" }),
  time: Object.freeze({ label: "跳时计划", toolType: "request_adjudication" }),
  map: Object.freeze({ label: "地图上下文与移动建议", toolType: "proposal" })
});

const VISIBILITY_PRESETS = Object.freeze({
  public_micro: Object.freeze({
    label: "公开微观视野",
    readDomains: ["people", "events"],
    maxRows: 8,
    maxChars: 2400,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "provider_proposal", "local_path"]
  }),
  relationship_local: Object.freeze({
    label: "书生与关系视野",
    readDomains: ["study", "exam", "people", "events", "geography"],
    maxRows: 18,
    maxChars: 6000,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "hidden_intent", "provider_proposal", "local_path"]
  }),
  local_society: Object.freeze({
    label: "地方社会视野",
    readDomains: ["people", "events", "geography", "market", "intel"],
    maxRows: 22,
    maxChars: 7200,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "provider_proposal", "local_path"]
  }),
  local_office: Object.freeze({
    label: "辖区官署视野",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market"],
    maxRows: 30,
    maxChars: 10000,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "provider_proposal", "local_path"]
  }),
  court_domain: Object.freeze({
    label: "部院军政视野",
    readDomains: ["office", "geography", "people", "events", "intel", "market", "military", "diplomacy"],
    maxRows: 42,
    maxChars: 16000,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "hidden_intent", "provider_proposal", "local_path"]
  }),
  imperial_broad: Object.freeze({
    label: "御前综合视野",
    readDomains: ["office", "geography", "people", "events", "intel", "market", "military", "diplomacy", "career"],
    maxRows: 56,
    maxChars: 22000,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "hidden_intent", "provider_proposal", "local_path", "api_key"]
  }),
  system_safe: Object.freeze({
    label: "系统安全视野",
    readDomains: ["events", "geography", "market", "intel"],
    maxRows: 48,
    maxChars: 18000,
    forbiddenSources: ["raw_table", "raw_audit", "hidden_notes", "hidden_intent", "provider_proposal", "local_path", "api_key"]
  })
});

const BUDGET_PRESETS = Object.freeze({
  background: Object.freeze({
    maxCallsPerTenDay: 0,
    maxToolCallsPerScene: 1,
    maxInputChars: 1800,
    maxOutputChars: 400,
    allowStreaming: false,
    fallbackMode: "heuristic"
  }),
  low: Object.freeze({
    maxCallsPerTenDay: 1,
    maxToolCallsPerScene: 3,
    maxInputChars: 6000,
    maxOutputChars: 1200,
    allowStreaming: false,
    fallbackMode: "mock"
  }),
  medium: Object.freeze({
    maxCallsPerTenDay: 2,
    maxToolCallsPerScene: 5,
    maxInputChars: 10000,
    maxOutputChars: 2000,
    allowStreaming: true,
    fallbackMode: "mock"
  }),
  high: Object.freeze({
    maxCallsPerTenDay: 3,
    maxToolCallsPerScene: 7,
    maxInputChars: 16000,
    maxOutputChars: 3200,
    allowStreaming: true,
    fallbackMode: "mock"
  }),
  imperial: Object.freeze({
    maxCallsPerTenDay: 4,
    maxToolCallsPerScene: 9,
    maxInputChars: 22000,
    maxOutputChars: 4200,
    allowStreaming: true,
    fallbackMode: "mock"
  }),
  system: Object.freeze({
    maxCallsPerTenDay: 2,
    maxToolCallsPerScene: 6,
    maxInputChars: 18000,
    maxOutputChars: 2600,
    allowStreaming: false,
    fallbackMode: "heuristic"
  })
});

const ACTOR_TYPE_TEMPLATES = Object.freeze({
  scholar: Object.freeze({
    label: "书生",
    authorityTier: "T1",
    modelPolicy: "small_model_or_mock",
    defaultGoals: ["修业", "应试", "经营师友关系"]
  }),
  teacher: Object.freeze({
    label: "老师/山长",
    authorityTier: "T1",
    modelPolicy: "small_model_or_mock",
    defaultGoals: ["训诲门生", "评点文卷", "维护书院名声"],
    allowedToolGroups: ["world_read", "law", "relationship", "study", "exam", "memory"]
  }),
  examiner: Object.freeze({
    label: "考官",
    authorityTier: "T3",
    modelPolicy: "domain_specialist",
    defaultGoals: ["批阅文卷", "提出复核疑点", "维护科场公信"],
    allowedToolGroups: ["world_read", "law", "office_read", "exam", "event", "memory"]
  }),
  gentry: Object.freeze({
    label: "士绅/商贾",
    authorityTier: "T2",
    modelPolicy: "small_model_or_mock",
    defaultGoals: ["经营乡望", "维护家业", "影响地方舆情"]
  }),
  clerk: Object.freeze({
    label: "胥吏/书办",
    authorityTier: "T2",
    modelPolicy: "heuristic_or_small_model",
    defaultGoals: ["经办案牍", "保存衙门人情", "规避风险"],
    allowedToolGroups: ["world_read", "law", "office_read", "relationship", "event", "judicial", "memory"]
  }),
  magistrate: Object.freeze({
    label: "地方官",
    authorityTier: "T3",
    modelPolicy: "full_llm_or_mock",
    defaultGoals: ["理讼", "钱粮", "治安", "考成"]
  }),
  minister: Object.freeze({
    label: "部院大臣",
    authorityTier: "T4",
    modelPolicy: "full_llm",
    defaultGoals: ["部务", "奏议", "考成", "派系制衡"]
  }),
  censor: Object.freeze({
    label: "御史/谏官",
    authorityTier: "T4",
    modelPolicy: "critic",
    defaultGoals: ["弹劾纠违", "审查法度", "维护士论"],
    allowedToolGroups: ["world_read", "law", "office_read", "intel", "relationship", "event", "judicial", "career", "report", "memory"]
  }),
  general: Object.freeze({
    label: "将领",
    authorityTier: "T4",
    modelPolicy: "domain_specialist",
    defaultGoals: ["整军", "守边", "筹粮", "研判敌情"],
    allowedToolGroups: ["world_read", "law", "office_read", "intel", "market", "relationship", "event", "military", "diplomacy", "report", "memory", "map"]
  }),
  emperor: Object.freeze({
    label: "皇帝/摄政",
    authorityTier: "T5",
    modelPolicy: "full_llm_with_critic",
    defaultGoals: ["稳固朝局", "平衡财政军政", "维持法统"]
  }),
  foreign_ruler: Object.freeze({
    label: "外邦君主",
    authorityTier: "T5",
    modelPolicy: "full_llm_with_critic",
    defaultGoals: ["维护国利", "试探边境", "经营外交"],
    allowedToolGroups: ["world_read", "law", "intel", "market", "relationship", "event", "military", "diplomacy", "ruler", "memory", "map"]
  }),
  system_engine: Object.freeze({
    label: "系统世界引擎",
    authorityTier: "T6",
    modelPolicy: "heuristic_or_mock",
    defaultGoals: ["压力传播", "长期因果", "安全事件候选"],
    allowedToolGroups: ["world_read", "event", "market", "intel", "report"]
  })
});

function getTierRank(tier) {
  return AUTHORITY_TIER_ORDER.indexOf(tier);
}

function getActorTypeTemplate(actorType) {
  return ACTOR_TYPE_TEMPLATES[actorType] || ACTOR_TYPE_TEMPLATES.gentry;
}

module.exports = {
  ACTOR_TYPE_TEMPLATES,
  AI_ACTOR_PROFILE_SCHEMA_VERSION,
  AUTHORITY_TIERS,
  AUTHORITY_TIER_ORDER,
  BUDGET_PRESETS,
  TOOL_GROUPS,
  VISIBILITY_PRESETS,
  getActorTypeTemplate,
  getTierRank
};
