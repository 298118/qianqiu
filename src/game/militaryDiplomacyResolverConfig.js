const MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION = 1;

const MILITARY_DIPLOMACY_RECORD_LIMIT = 16;

const MILITARY_DIPLOMACY_ALLOWED_TIERS = Object.freeze(["T4", "T5"]);
const MILITARY_DIPLOMACY_TIER_ORDER = Object.freeze(["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);

const MILITARY_DIPLOMACY_EVIDENCE_DOMAINS = Object.freeze([
  "military",
  "diplomacy",
  "geography",
  "intel",
  "events",
  "economy",
  "market"
]);

const MILITARY_DIPLOMACY_EVIDENCE_CREDIBILITY = Object.freeze({
  military: 0.86,
  diplomacy: 0.82,
  geography: 0.7,
  intel: 0.58,
  events: 0.62,
  economy: 0.78,
  market: 0.74
});

const MILITARY_DIPLOMACY_INSTITUTIONAL_PATHS = Object.freeze([
  "frontier_command",
  "ministry_war_review",
  "grand_council_review",
  "imperial_edict",
  "envoy_protocol",
  "tribute_mission",
  "treaty_review",
  "war_council"
]);

const MILITARY_ORDER_ALIASES = Object.freeze({
  defend: "defend",
  hold: "defend",
  fortify: "defend",
  train: "train",
  drill: "train",
  scout: "scout",
  recon: "scout",
  resupply: "resupply",
  supply: "resupply",
  mobilize: "mobilize",
  attack: "engage",
  engage: "engage",
  battle: "engage",
  decisive_battle: "decisive_battle",
  withdraw: "withdraw",
  retreat: "withdraw"
});

const DIPLOMACY_MOVE_ALIASES = Object.freeze({
  envoy: "envoy",
  send_envoy: "envoy",
  negotiate_trade: "negotiate_trade",
  trade: "negotiate_trade",
  seek_truce: "seek_truce",
  truce: "seek_truce",
  demand_tribute: "demand_tribute",
  tribute: "demand_tribute",
  warn_border: "warn_border",
  deterrence: "warn_border",
  declare_war_request: "declare_war_request",
  war_request: "declare_war_request",
  alliance: "alliance",
  detain_envoy: "detain_envoy"
});

const MILITARY_ORDER_ACTIONS = Object.freeze({
  scout: Object.freeze({
    label: "侦察",
    summaryVerb: "遣哨侦察",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    minimumIntelConfidence: 0.4,
    stateDelta: Object.freeze({ borderThreat: -1 }),
    playerDelta: Object.freeze({ scouting: 4, campaignRisk: -1 }),
    resourceCost: Object.freeze({ treasury: 5, grainReserve: 5, playerSupply: 5 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["scouting", "intel"])
  }),
  defend: Object.freeze({
    label: "固守",
    summaryVerb: "整饬守备",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.5,
    minimumIntelConfidence: 0.45,
    stateDelta: Object.freeze({ armyMorale: 1, borderThreat: -2, grainReserve: -20 }),
    playerDelta: Object.freeze({ command: 1, campaignRisk: -2, supply: -10 }),
    resourceCost: Object.freeze({ grainReserve: 20, playerSupply: 10 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["defense", "frontier"])
  }),
  train: Object.freeze({
    label: "练兵",
    summaryVerb: "操练军伍",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    minimumIntelConfidence: 0.4,
    stateDelta: Object.freeze({ treasury: -20, grainReserve: -15, armyMorale: 3 }),
    playerDelta: Object.freeze({ command: 1, battleReputation: 1, campaignRisk: -1 }),
    resourceCost: Object.freeze({ treasury: 20, grainReserve: 15 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["training", "readiness"])
  }),
  resupply: Object.freeze({
    label: "调粮",
    summaryVerb: "调拨粮饷",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.55,
    minimumIntelConfidence: 0.45,
    stateDelta: Object.freeze({ grainReserve: -40, armyMorale: 2, borderThreat: -1 }),
    playerDelta: Object.freeze({ supply: 40, campaignRisk: -1 }),
    resourceCost: Object.freeze({ grainReserve: 40 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresEconomicEvidence: true,
    riskTags: Object.freeze(["supply", "grain"])
  }),
  mobilize: Object.freeze({
    label: "出击",
    summaryVerb: "整军出击",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.95,
    minimumIntelConfidence: 0.55,
    stateDelta: Object.freeze({ treasury: -45, grainReserve: -45, armyMorale: -1, borderThreat: -3 }),
    playerDelta: Object.freeze({ troops: 60, command: 2, campaignRisk: 3, supply: -25 }),
    resourceCost: Object.freeze({ treasury: 45, grainReserve: 45, playerSupply: 25 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresMilitaryEvidence: true,
    requiresInstitutionalPath: true,
    riskTags: Object.freeze(["offensive", "campaign"])
  }),
  engage: Object.freeze({
    label: "会战",
    summaryVerb: "接战会剿",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 1,
    minimumIntelConfidence: 0.58,
    stateDelta: Object.freeze({ grainReserve: -60, armyMorale: 2, borderThreat: -5 }),
    playerDelta: Object.freeze({ battleReputation: 3, command: 2, campaignRisk: 5, supply: -35 }),
    resourceCost: Object.freeze({ grainReserve: 60, playerSupply: 35, playerTroops: 80 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresMilitaryEvidence: true,
    requiresInstitutionalPath: true,
    highStakes: true,
    riskTags: Object.freeze(["battle", "high_stakes"])
  }),
  decisive_battle: Object.freeze({
    label: "大会战",
    summaryVerb: "请决大会战",
    minimumAuthorityTier: "T5",
    minimumEvidenceRefs: 3,
    minimumEvidenceScore: 1.35,
    minimumIntelConfidence: 0.65,
    stateDelta: Object.freeze({ treasury: -80, grainReserve: -90, armyMorale: 3, borderThreat: -7 }),
    playerDelta: Object.freeze({ battleReputation: 5, command: 3, campaignRisk: 8, supply: -60 }),
    resourceCost: Object.freeze({ treasury: 80, grainReserve: 90, playerSupply: 60, playerTroops: 120 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresMilitaryEvidence: true,
    requiresInstitutionalPath: true,
    highStakes: true,
    riskTags: Object.freeze(["decisive_battle", "imperial_authorization"])
  }),
  withdraw: Object.freeze({
    label: "撤军",
    summaryVerb: "收束军伍",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.55,
    minimumIntelConfidence: 0.45,
    stateDelta: Object.freeze({ armyMorale: -2, borderThreat: 2, grainReserve: 10 }),
    playerDelta: Object.freeze({ campaignRisk: -4, battleReputation: -1, supply: 10 }),
    resourceCost: Object.freeze({ treasury: 5 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["withdraw", "risk_reduction"])
  })
});

const DIPLOMACY_MOVE_ACTIONS = Object.freeze({
  envoy: Object.freeze({
    label: "遣使",
    summaryVerb: "遣使通问",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    minimumIntelConfidence: 0.4,
    stateDelta: Object.freeze({ treasury: -10, borderThreat: -1 }),
    playerDelta: Object.freeze({ influence: 1 }),
    resourceCost: Object.freeze({ treasury: 10 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["envoy", "protocol"])
  }),
  negotiate_trade: Object.freeze({
    label: "互市",
    summaryVerb: "议开互市",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.55,
    minimumIntelConfidence: 0.45,
    stateDelta: Object.freeze({ treasury: 30, publicOrder: 1, borderThreat: -1 }),
    playerDelta: Object.freeze({ influence: 1, reputation: 1 }),
    resourceCost: Object.freeze({ treasury: 5 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresEconomicEvidence: true,
    riskTags: Object.freeze(["trade", "diplomacy"])
  }),
  seek_truce: Object.freeze({
    label: "和议",
    summaryVerb: "求议边和",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.9,
    minimumIntelConfidence: 0.55,
    stateDelta: Object.freeze({ treasury: -20, armyMorale: -1, borderThreat: -4 }),
    playerDelta: Object.freeze({ influence: 1, reputation: -1, campaignRisk: -3 }),
    resourceCost: Object.freeze({ treasury: 20 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresDiplomacyEvidence: true,
    requiresInstitutionalPath: true,
    riskTags: Object.freeze(["truce", "war_peace"])
  }),
  demand_tribute: Object.freeze({
    label: "朝贡",
    summaryVerb: "责令贡使",
    minimumAuthorityTier: "T5",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.9,
    minimumIntelConfidence: 0.55,
    stateDelta: Object.freeze({ treasury: 25, borderThreat: 1 }),
    playerDelta: Object.freeze({ influence: 2, campaignRisk: 1 }),
    resourceCost: Object.freeze({ treasury: 10 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresDiplomacyEvidence: true,
    requiresEconomicEvidence: true,
    requiresInstitutionalPath: true,
    riskTags: Object.freeze(["tribute", "protocol"])
  }),
  warn_border: Object.freeze({
    label: "威慑",
    summaryVerb: "边檄示威",
    minimumAuthorityTier: "T4",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.65,
    minimumIntelConfidence: 0.5,
    stateDelta: Object.freeze({ armyMorale: 1, borderThreat: -2 }),
    playerDelta: Object.freeze({ influence: 1, battleReputation: 1, campaignRisk: 1 }),
    resourceCost: Object.freeze({ treasury: 10, grainReserve: 10 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    riskTags: Object.freeze(["deterrence", "border"])
  }),
  declare_war_request: Object.freeze({
    label: "请战",
    summaryVerb: "请议宣战",
    minimumAuthorityTier: "T5",
    minimumEvidenceRefs: 3,
    minimumEvidenceScore: 1.35,
    minimumIntelConfidence: 0.65,
    stateDelta: Object.freeze({ treasury: -90, grainReserve: -90, armyMorale: 3, borderThreat: 5 }),
    playerDelta: Object.freeze({ influence: 3, battleReputation: 2, campaignRisk: 9 }),
    resourceCost: Object.freeze({ treasury: 90, grainReserve: 90 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresMilitaryEvidence: true,
    requiresDiplomacyEvidence: true,
    requiresInstitutionalPath: true,
    highStakes: true,
    riskTags: Object.freeze(["declare_war_request", "imperial_authorization"])
  }),
  alliance: Object.freeze({
    label: "会盟",
    summaryVerb: "议结会盟",
    minimumAuthorityTier: "T5",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.9,
    minimumIntelConfidence: 0.55,
    stateDelta: Object.freeze({ treasury: -25, borderThreat: -3 }),
    playerDelta: Object.freeze({ influence: 2, campaignRisk: -2 }),
    resourceCost: Object.freeze({ treasury: 25 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresDiplomacyEvidence: true,
    requiresInstitutionalPath: true,
    riskTags: Object.freeze(["alliance", "treaty"])
  }),
  detain_envoy: Object.freeze({
    label: "扣使",
    summaryVerb: "扣留使节",
    minimumAuthorityTier: "T5",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 1,
    minimumIntelConfidence: 0.6,
    stateDelta: Object.freeze({ armyMorale: 1, borderThreat: 5 }),
    playerDelta: Object.freeze({ influence: -1, campaignRisk: 6, reputation: -2 }),
    resourceCost: Object.freeze({ treasury: 5 }),
    evidenceDomains: MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
    requiresDiplomacyEvidence: true,
    requiresInstitutionalPath: true,
    highStakes: true,
    riskTags: Object.freeze(["detain_envoy", "diplomatic_crisis"])
  })
});

module.exports = {
  DIPLOMACY_MOVE_ACTIONS,
  DIPLOMACY_MOVE_ALIASES,
  MILITARY_DIPLOMACY_ALLOWED_TIERS,
  MILITARY_DIPLOMACY_EVIDENCE_CREDIBILITY,
  MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
  MILITARY_DIPLOMACY_INSTITUTIONAL_PATHS,
  MILITARY_DIPLOMACY_RECORD_LIMIT,
  MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
  MILITARY_DIPLOMACY_TIER_ORDER,
  MILITARY_ORDER_ACTIONS,
  MILITARY_ORDER_ALIASES
};
