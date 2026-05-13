const WORLD_PRESSURE_EVENT_SCHEMA_VERSION = "s71.worldPressureEvent.v1";

const WORLD_PRESSURE_EVENT_RECORD_LIMIT = 24;
const WORLD_PRESSURE_EVENT_SIGNAL_LIMIT = 36;
const WORLD_PRESSURE_EVENT_DEFAULT_MAX_CANDIDATES = 6;
const WORLD_PRESSURE_EVENT_DEFAULT_MAX_EVENTS = 2;

const WORLD_PRESSURE_EVENT_ALLOWED_STATE_KEYS = Object.freeze([
  "treasury",
  "grainReserve",
  "population",
  "publicOrder",
  "taxRate",
  "corruption",
  "armyMorale",
  "borderThreat"
]);

const WORLD_PRESSURE_EVENT_RULES = Object.freeze([
  Object.freeze({
    ruleId: "city_unrest",
    label: "民生扰动",
    incidentKind: "city_pressure",
    primaryDomains: Object.freeze(["geography", "world_entity"]),
    supportDomains: Object.freeze(["market", "local_docket", "events"]),
    incidentKinds: Object.freeze(["city_pressure", "fiscal_market", "local_docket"]),
    minimumSources: 2,
    minimumScore: 58,
    probabilityThreshold: 0.55,
    priority: 96,
    cooldownPrefix: "city-unrest",
    cooldownTurns: 3,
    maxSources: 5,
    stateDelta: Object.freeze({ grainReserve: -20, publicOrder: -4, corruption: 1 }),
    riskTags: Object.freeze(["city_pressure", "grain_price", "public_order"]),
    publicSummaryPrefix: "粮价、水利、钱粮或案牍压力彼此牵连，地方民情出现扰动。"
  }),
  Object.freeze({
    ruleId: "frontier_probe",
    label: "边面试探",
    incidentKind: "frontier_alert",
    primaryDomains: Object.freeze(["military", "geography"]),
    supportDomains: Object.freeze(["intel", "market", "events"]),
    incidentKinds: Object.freeze(["frontier_alert", "rumor_pressure", "fiscal_market"]),
    minimumSources: 2,
    minimumScore: 60,
    probabilityThreshold: 0.56,
    priority: 94,
    cooldownPrefix: "frontier-probe",
    cooldownTurns: 3,
    maxSources: 5,
    stateDelta: Object.freeze({ grainReserve: -12, armyMorale: -1, borderThreat: 4 }),
    riskTags: Object.freeze(["frontier_alert", "supply_route", "border_tension"]),
    publicSummaryPrefix: "边防、粮道与传闻压力相互印证，边面出现试探或急报。"
  }),
  Object.freeze({
    ruleId: "npc_petition",
    label: "人物怨望",
    incidentKind: "npc_resentment",
    primaryDomains: Object.freeze(["people"]),
    supportDomains: Object.freeze(["events", "local_docket", "world_entity"]),
    incidentKinds: Object.freeze(["npc_resentment", "local_docket", "generic_incident"]),
    minimumSources: 1,
    minimumScore: 50,
    probabilityThreshold: 0.5,
    priority: 78,
    cooldownPrefix: "npc-petition",
    cooldownTurns: 2,
    maxSources: 4,
    stateDelta: Object.freeze({ publicOrder: -1, corruption: 1 }),
    riskTags: Object.freeze(["npc_resentment", "petition", "relationship_pressure"]),
    publicSummaryPrefix: "可见人物怨望积累，可能转成控告、请托或报复性动作。"
  }),
  Object.freeze({
    ruleId: "academy_public_opinion",
    label: "士论科场",
    incidentKind: "academy_pressure",
    primaryDomains: Object.freeze(["world_entity", "events", "people"]),
    supportDomains: Object.freeze(["intel", "events", "offices"]),
    incidentKinds: Object.freeze(["academy_pressure", "rumor_pressure", "court_pressure"]),
    minimumSources: 1,
    minimumScore: 52,
    probabilityThreshold: 0.5,
    priority: 74,
    cooldownPrefix: "academy-opinion",
    cooldownTurns: 3,
    maxSources: 4,
    stateDelta: Object.freeze({ publicOrder: -1 }),
    riskTags: Object.freeze(["academy_pressure", "public_opinion", "exam_fairness"]),
    publicSummaryPrefix: "士林、书院或科场舆论有聚集迹象，可能形成公论或联名呈递。"
  }),
  Object.freeze({
    ruleId: "court_impeachment",
    label: "台谏风闻",
    incidentKind: "court_pressure",
    primaryDomains: Object.freeze(["world_entity", "offices", "events"]),
    supportDomains: Object.freeze(["intel", "people", "market"]),
    incidentKinds: Object.freeze(["court_pressure", "rumor_pressure", "fiscal_market"]),
    minimumSources: 1,
    minimumScore: 54,
    probabilityThreshold: 0.52,
    priority: 76,
    cooldownPrefix: "court-impeachment",
    cooldownTurns: 3,
    maxSources: 4,
    stateDelta: Object.freeze({ publicOrder: -1, corruption: -1 }),
    riskTags: Object.freeze(["court_pressure", "impeachment", "official_review"]),
    publicSummaryPrefix: "官场风闻或财赋疑点进入台谏视野，可能引出弹劾或部院复核。"
  }),
  Object.freeze({
    ruleId: "market_shock",
    label: "财赋市价",
    incidentKind: "fiscal_market",
    primaryDomains: Object.freeze(["market", "world_entity"]),
    supportDomains: Object.freeze(["geography", "local_docket", "events"]),
    incidentKinds: Object.freeze(["fiscal_market", "city_pressure", "local_docket"]),
    minimumSources: 1,
    minimumScore: 55,
    probabilityThreshold: 0.52,
    priority: 84,
    cooldownPrefix: "market-shock",
    cooldownTurns: 2,
    maxSources: 4,
    stateDelta: Object.freeze({ treasury: -18, grainReserve: -10, publicOrder: -1 }),
    riskTags: Object.freeze(["fiscal_market", "grain_price", "treasury_pressure"]),
    publicSummaryPrefix: "粮价、盐漕或库银压力升高，市场与府库出现连锁震动。"
  }),
  Object.freeze({
    ruleId: "docket_escalation",
    label: "案牍升温",
    incidentKind: "local_docket",
    primaryDomains: Object.freeze(["local_docket", "events"]),
    supportDomains: Object.freeze(["people", "market", "offices"]),
    incidentKinds: Object.freeze(["local_docket", "npc_resentment", "fiscal_market"]),
    minimumSources: 1,
    minimumScore: 52,
    probabilityThreshold: 0.5,
    priority: 80,
    cooldownPrefix: "docket-escalation",
    cooldownTurns: 2,
    maxSources: 4,
    stateDelta: Object.freeze({ publicOrder: -2, corruption: 1 }),
    riskTags: Object.freeze(["local_docket", "lawsuit_pressure", "public_order"]),
    publicSummaryPrefix: "地方案牍与人情压力升温，可能转成公堂争执或上控。"
  }),
  Object.freeze({
    ruleId: "rumor_wave",
    label: "传闻流动",
    incidentKind: "rumor_pressure",
    primaryDomains: Object.freeze(["intel"]),
    supportDomains: Object.freeze(["events", "military", "market", "people"]),
    incidentKinds: Object.freeze(["rumor_pressure", "frontier_alert", "fiscal_market", "npc_resentment"]),
    minimumSources: 1,
    minimumScore: 50,
    probabilityThreshold: 0.5,
    priority: 70,
    cooldownPrefix: "rumor-wave",
    cooldownTurns: 2,
    maxSources: 4,
    stateDelta: Object.freeze({ publicOrder: -1, borderThreat: 1 }),
    riskTags: Object.freeze(["rumor_pressure", "intel", "public_opinion"]),
    publicSummaryPrefix: "公开传闻被多方转述，形成可观察的舆情或边情线索。"
  })
]);

const WORLD_PRESSURE_EVENT_RULES_BY_ID = Object.freeze(
  Object.fromEntries(WORLD_PRESSURE_EVENT_RULES.map((rule) => [rule.ruleId, rule]))
);

module.exports = {
  WORLD_PRESSURE_EVENT_ALLOWED_STATE_KEYS,
  WORLD_PRESSURE_EVENT_DEFAULT_MAX_CANDIDATES,
  WORLD_PRESSURE_EVENT_DEFAULT_MAX_EVENTS,
  WORLD_PRESSURE_EVENT_RECORD_LIMIT,
  WORLD_PRESSURE_EVENT_RULES,
  WORLD_PRESSURE_EVENT_RULES_BY_ID,
  WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
  WORLD_PRESSURE_EVENT_SIGNAL_LIMIT
};
