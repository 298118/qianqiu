const CITY_POLICY_SCHEMA_VERSION = 1;

const CITY_POLICY_RECORD_LIMIT = 12;

const CITY_POLICY_ALLOWED_TIERS = Object.freeze(["T3", "T4", "T5"]);
const CITY_POLICY_EVIDENCE_DOMAINS = Object.freeze(["economy", "events", "geography", "offices", "market", "local_docket"]);

const CITY_POLICY_ACTION_ALIASES = Object.freeze({
  relief: "relief",
  open_granary: "relief",
  grain_relief: "relief",
  grain_price_stabilization: "grain_price_stabilization",
  price_stabilization: "grain_price_stabilization",
  market_regulation: "market_regulation",
  tax_collection: "tax_collection",
  collect_grain: "tax_collection",
  waterworks: "waterworks",
  riverworks: "waterworks",
  land_survey: "land_survey",
  tax_remission: "tax_remission",
  asset_recovery: "asset_recovery",
  salt_canal_reform: "salt_canal_reform",
  corvee_adjustment: "corvee_adjustment",
  public_order: "public_order"
});

const CITY_POLICY_ACTIONS = Object.freeze({
  relief: Object.freeze({
    label: "开仓赈济",
    summaryVerb: "开仓拨赈",
    stateDelta: Object.freeze({ treasury: -90, grainReserve: -120, publicOrder: 8, corruption: -1 }),
    playerDelta: Object.freeze({ performanceMerit: 2, superiorFavor: 1, impeachmentRisk: 1 }),
    evidenceDomains: Object.freeze(["economy", "events", "geography", "market", "local_docket"]),
    riskTags: Object.freeze(["relief", "grain", "treasury_spend"])
  }),
  grain_price_stabilization: Object.freeze({
    label: "平粜稳价",
    summaryVerb: "平粜稳价",
    stateDelta: Object.freeze({ treasury: -55, grainReserve: -80, publicOrder: 6, taxRate: -1 }),
    playerDelta: Object.freeze({ performanceMerit: 2, cleanReputation: 1 }),
    evidenceDomains: Object.freeze(["economy", "geography", "events", "market"]),
    riskTags: Object.freeze(["grain_price", "market"])
  }),
  tax_collection: Object.freeze({
    label: "征粮催科",
    summaryVerb: "整饬征粮",
    stateDelta: Object.freeze({ treasury: 130, grainReserve: 90, publicOrder: -5, taxRate: 2, corruption: 1 }),
    playerDelta: Object.freeze({ performanceMerit: 1, impeachmentRisk: 2, cleanReputation: -1 }),
    evidenceDomains: Object.freeze(["economy", "events", "offices", "market", "local_docket"]),
    riskTags: Object.freeze(["tax_collection", "popular_pressure"])
  }),
  waterworks: Object.freeze({
    label: "修堤水利",
    summaryVerb: "修堤兴工",
    stateDelta: Object.freeze({ treasury: -120, publicOrder: 4 }),
    playerDelta: Object.freeze({ waterworks: 8, performanceMerit: 2, corveeBurden: 2 }),
    evidenceDomains: Object.freeze(["events", "geography", "economy", "local_docket"]),
    riskTags: Object.freeze(["waterworks", "corvee"])
  }),
  land_survey: Object.freeze({
    label: "清丈田亩",
    summaryVerb: "清丈田亩",
    stateDelta: Object.freeze({ treasury: 110, corruption: -3, publicOrder: -2 }),
    playerDelta: Object.freeze({ performanceMerit: 3, impeachmentRisk: 2, gentryRelations: -6, cleanReputation: 2 }),
    evidenceDomains: Object.freeze(["events", "offices", "economy", "local_docket"]),
    riskTags: Object.freeze(["land_survey", "gentry_resistance"])
  }),
  tax_remission: Object.freeze({
    label: "减免钱粮",
    summaryVerb: "减免钱粮",
    stateDelta: Object.freeze({ treasury: -90, publicOrder: 7, taxRate: -4 }),
    playerDelta: Object.freeze({ superiorFavor: -1, cleanReputation: 2, impeachmentRisk: 1 }),
    evidenceDomains: Object.freeze(["economy", "events", "geography", "market"]),
    riskTags: Object.freeze(["tax_remission", "treasury_spend"])
  }),
  asset_recovery: Object.freeze({
    label: "追赃清欠",
    summaryVerb: "追赃清欠",
    stateDelta: Object.freeze({ treasury: 130, corruption: -5, publicOrder: -2 }),
    playerDelta: Object.freeze({ performanceMerit: 2, cleanReputation: 3, impeachmentRisk: 3 }),
    evidenceDomains: Object.freeze(["economy", "events", "people", "market", "local_docket"]),
    riskTags: Object.freeze(["asset_recovery", "corruption"])
  }),
  salt_canal_reform: Object.freeze({
    label: "盐漕整顿",
    summaryVerb: "整顿盐漕",
    stateDelta: Object.freeze({ treasury: 70, grainReserve: 25, corruption: -2, publicOrder: 2 }),
    playerDelta: Object.freeze({ performanceMerit: 2, superiorFavor: 1, impeachmentRisk: 1 }),
    evidenceDomains: Object.freeze(["economy", "geography", "events", "market"]),
    riskTags: Object.freeze(["salt_canal", "market"])
  }),
  corvee_adjustment: Object.freeze({
    label: "徭役调整",
    summaryVerb: "均派徭役",
    stateDelta: Object.freeze({ treasury: -60, publicOrder: 5 }),
    playerDelta: Object.freeze({ corveeBurden: -8, gentryRelations: -2, cleanReputation: 1 }),
    evidenceDomains: Object.freeze(["events", "offices", "geography", "local_docket"]),
    riskTags: Object.freeze(["corvee", "local_order"])
  }),
  market_regulation: Object.freeze({
    label: "市价整肃",
    summaryVerb: "整肃市价",
    stateDelta: Object.freeze({ treasury: -45, publicOrder: 4, corruption: -1 }),
    playerDelta: Object.freeze({ performanceMerit: 1, cleanReputation: 1 }),
    evidenceDomains: Object.freeze(["economy", "geography", "events", "market"]),
    riskTags: Object.freeze(["market_regulation"])
  }),
  public_order: Object.freeze({
    label: "安民缉盗",
    summaryVerb: "安民缉盗",
    stateDelta: Object.freeze({ treasury: -45, publicOrder: 5, corruption: -1 }),
    playerDelta: Object.freeze({ banditPressure: -6, performanceMerit: 1, impeachmentRisk: -1 }),
    evidenceDomains: Object.freeze(["events", "geography", "offices", "local_docket"]),
    riskTags: Object.freeze(["public_order"])
  })
});

module.exports = {
  CITY_POLICY_ACTION_ALIASES,
  CITY_POLICY_ACTIONS,
  CITY_POLICY_ALLOWED_TIERS,
  CITY_POLICY_EVIDENCE_DOMAINS,
  CITY_POLICY_RECORD_LIMIT,
  CITY_POLICY_SCHEMA_VERSION
};
