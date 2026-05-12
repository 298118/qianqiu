const AI_EVENT_PROPOSAL_SCHEMA_VERSION = 1;

const EVENT_INCIDENT_KINDS = Object.freeze([
  "city_pressure",
  "frontier_alert",
  "academy_pressure",
  "court_pressure",
  "npc_resentment",
  "fiscal_market",
  "local_docket",
  "rumor_pressure",
  "generic_incident"
]);

const EVENT_VISIBILITY_LEVELS = Object.freeze([
  "player_visible",
  "actor_visible"
]);

const EVENT_PROPOSAL_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxSourcePressureRefs: 6,
  maxAffectedRefs: 6,
  maxRiskTags: 6,
  maxMockProposals: 6,
  maxAuditRefs: 6
});

const SOURCE_PRESSURE_DOMAIN_ALIASES = Object.freeze({
  geography: Object.freeze(["geography"]),
  local_docket: Object.freeze(["local_docket", "office"]),
  market: Object.freeze(["market"]),
  military: Object.freeze(["military", "geography", "intel"]),
  intel: Object.freeze(["intel"]),
  people: Object.freeze(["people"]),
  events: Object.freeze(["events"]),
  world_entity: Object.freeze(["events", "geography", "office", "market", "people", "study", "intel"])
});

module.exports = {
  AI_EVENT_PROPOSAL_SCHEMA_VERSION,
  EVENT_INCIDENT_KINDS,
  EVENT_PROPOSAL_LIMITS,
  EVENT_VISIBILITY_LEVELS,
  SOURCE_PRESSURE_DOMAIN_ALIASES
};
