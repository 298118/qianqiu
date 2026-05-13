const MAP_CONTEXT_SCHEMA_VERSION = 1;
const MAP_ENTITY_REF_SCHEMA_VERSION = 1;
const MAP_MOVEMENT_PROPOSAL_SCHEMA_VERSION = 1;

const MAP_ENTITY_TYPES = Object.freeze({
  country: Object.freeze({ label: "国家", sourceView: "worldGeographyView.countries" }),
  region: Object.freeze({ label: "地域", sourceView: "worldGeographyView.regions" }),
  city: Object.freeze({ label: "城邑", sourceView: "worldGeographyView.cities" }),
  route: Object.freeze({ label: "路线", sourceView: "worldGeographyView.routes" }),
  frontier_zone: Object.freeze({ label: "边面", sourceView: "worldGeographyView.frontierZones" }),
  jurisdiction: Object.freeze({ label: "辖区", sourceView: "worldGeographyView.officeJurisdictions" }),
  posting: Object.freeze({ label: "任所", sourceView: "officialPostingsView.postings" }),
  transfer: Object.freeze({ label: "迁转", sourceView: "officialPostingsView.transferRecords" }),
  docket: Object.freeze({ label: "案牍", sourceView: "localAffairsDocketView.dockets" }),
  military_report: Object.freeze({ label: "军务", sourceView: "militaryDiplomacyView.reports" }),
  economic_report: Object.freeze({ label: "财赋市场", sourceView: "economicFiscalView.reports" }),
  exam_travel: Object.freeze({ label: "赶考行程", sourceView: "examCalendarView.nextExam" })
});

const MAP_VISIBILITY_VALUES = Object.freeze([
  "public",
  "rumor",
  "player_visible",
  "actor_visible",
  "role_visible",
  "office_visible",
  "military_visible",
  "market_visible",
  "exam_visible"
]);

const MAP_CONTEXT_LIMITS = Object.freeze({
  maxEntityRefs: 80,
  maxRefsPerType: 16,
  maxEventHooks: 24,
  maxPromptPlaces: 10,
  maxPromptRoutes: 5,
  maxPromptFrontiers: 5,
  maxPromptHooks: 8,
  maxRelatedRefs: 8,
  maxSummaryLength: 180
});

const MAP_DISTANCE_BUDGETS = Object.freeze({
  local: Object.freeze({ label: "本地", turnBudget: 1, summary: "县城、书院、衙署或近郊一日内可达。" }),
  county: Object.freeze({ label: "县境", turnBudget: 1, summary: "县境巡查、案牍传唤或近村保甲。" }),
  provincial: Object.freeze({ label: "赴省", turnBudget: 3, summary: "赴省城、贡院或省级衙门，需盘费与路引。" }),
  capital: Object.freeze({ label: "入京", turnBudget: 6, summary: "长途入京，受驿路、漕路、天气与盘缠约束。" }),
  frontier: Object.freeze({ label: "边面", turnBudget: 6, summary: "边镇、关隘、军粮与情报可信度共同约束。" }),
  sea: Object.freeze({ label: "海道", turnBudget: 8, summary: "海道受风汛、贡舶、海防和商税秩序约束。" })
});

const MAP_JURISDICTION_BUDGETS = Object.freeze({
  public: Object.freeze({ label: "公开地理", maxRefs: 24 }),
  scholar: Object.freeze({ label: "书生视野", maxRefs: 24 }),
  local_office: Object.freeze({ label: "本辖官署", maxRefs: 36 }),
  court_domain: Object.freeze({ label: "部院军政", maxRefs: 56 }),
  imperial_broad: Object.freeze({ label: "御前广域", maxRefs: 72 })
});

const MAP_MOVEMENT_TYPES = Object.freeze({
  exam_travel: Object.freeze({
    label: "赶考",
    allowedActorTypes: ["scholar", "gentry", "examiner", "minister", "emperor"],
    readDomains: ["exam", "geography"],
    distanceBudgets: ["local", "provincial", "capital"],
    riskTags: ["exam", "travel", "server_adjudication_required"]
  }),
  office_transfer: Object.freeze({
    label: "赴任",
    allowedActorTypes: ["magistrate", "minister", "censor", "emperor"],
    readDomains: ["office", "career", "geography"],
    distanceBudgets: ["county", "provincial", "capital"],
    riskTags: ["office", "career", "server_adjudication_required"]
  }),
  inspection: Object.freeze({
    label: "巡查",
    allowedActorTypes: ["magistrate", "minister", "censor", "general", "emperor"],
    readDomains: ["office", "local_docket", "geography", "market", "military"],
    distanceBudgets: ["county", "provincial", "frontier"],
    riskTags: ["inspection", "jurisdiction", "server_adjudication_required"]
  }),
  military_march: Object.freeze({
    label: "行军",
    allowedActorTypes: ["general", "minister", "emperor", "foreign_ruler"],
    readDomains: ["military", "diplomacy", "geography", "market"],
    distanceBudgets: ["frontier", "capital"],
    riskTags: ["military", "supply", "server_adjudication_required"]
  }),
  escort: Object.freeze({
    label: "押解",
    allowedActorTypes: ["clerk", "magistrate", "minister", "general", "emperor"],
    readDomains: ["local_docket", "office", "geography"],
    distanceBudgets: ["county", "provincial", "capital"],
    riskTags: ["judicial", "escort", "server_adjudication_required"]
  }),
  envoy_travel: Object.freeze({
    label: "使节出行",
    allowedActorTypes: ["minister", "general", "emperor", "foreign_ruler"],
    readDomains: ["diplomacy", "military", "geography"],
    distanceBudgets: ["capital", "frontier", "sea"],
    riskTags: ["diplomacy", "envoy", "server_adjudication_required"]
  }),
  trade_route_activity: Object.freeze({
    label: "商路活动",
    allowedActorTypes: ["gentry", "magistrate", "minister", "emperor"],
    readDomains: ["market", "geography", "local_docket"],
    distanceBudgets: ["county", "provincial", "capital", "sea"],
    riskTags: ["market", "trade_route", "server_adjudication_required"]
  })
});

const MAP_MOVEMENT_TYPE_IDS = Object.freeze(Object.keys(MAP_MOVEMENT_TYPES));

module.exports = {
  MAP_CONTEXT_LIMITS,
  MAP_CONTEXT_SCHEMA_VERSION,
  MAP_DISTANCE_BUDGETS,
  MAP_ENTITY_REF_SCHEMA_VERSION,
  MAP_ENTITY_TYPES,
  MAP_JURISDICTION_BUDGETS,
  MAP_MOVEMENT_PROPOSAL_SCHEMA_VERSION,
  MAP_MOVEMENT_TYPE_IDS,
  MAP_MOVEMENT_TYPES,
  MAP_VISIBILITY_VALUES
};
