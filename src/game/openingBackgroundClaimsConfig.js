const OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION = "s82.opening-background-claims.v1";

const CLAIM_DECISION_TYPES = Object.freeze([
  "accepted",
  "scaled",
  "converted_to_risk",
  "rejected"
]);

const CLAIM_TYPE_TO_RESOURCE = Object.freeze({
  wealth: "silver_liang",
  debt: "human_debt",
  reputation: "academic_prestige"
});

const OPENING_BACKGROUND_CLAIMS_CONFIG = Object.freeze({
  maxClaims: 12,
  maxVisibleClaims: 12,
  maxOpeningSilverLiang: 500,
  maxOpeningGoldLiang: 10,
  maxOpeningGrainShi: 30,
  maxOpeningEstateCount: 3,
  maxOpeningFarmlandMu: 120,
  maxOpeningRetainers: 3,
  safeTextLimit: 160,
  forbiddenAuthorityClaimTypes: Object.freeze(["office", "military", "artifact"]),
  claimDecisionTypes: CLAIM_DECISION_TYPES,
  claimTypeToResource: CLAIM_TYPE_TO_RESOURCE
});

module.exports = {
  CLAIM_DECISION_TYPES,
  CLAIM_TYPE_TO_RESOURCE,
  OPENING_BACKGROUND_CLAIMS_CONFIG,
  OPENING_BACKGROUND_CLAIMS_SCHEMA_VERSION
};
