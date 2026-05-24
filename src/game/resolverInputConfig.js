const RESOLVER_INPUT_SCHEMA_VERSION = "s71.resolverInputContext.v1";

const RESOLVER_INPUT_DOMAINS = Object.freeze([
  "geography",
  "people",
  "offices",
  "economy",
  "military",
  "events",
  "intel",
  "player",
  "map",
  "memory"
]);

const RESOLVER_INPUT_DOMAIN_CONFIG = Object.freeze({
  geography: Object.freeze({ maxItems: 12, maxCharacters: 160, defaultConfidence: 0.72, priority: 90 }),
  people: Object.freeze({ maxItems: 12, maxCharacters: 160, defaultConfidence: 0.68, priority: 78 }),
  offices: Object.freeze({ maxItems: 12, maxCharacters: 170, defaultConfidence: 0.74, priority: 82 }),
  economy: Object.freeze({ maxItems: 10, maxCharacters: 170, defaultConfidence: 0.7, priority: 84 }),
  military: Object.freeze({ maxItems: 10, maxCharacters: 170, defaultConfidence: 0.68, priority: 84 }),
  events: Object.freeze({ maxItems: 14, maxCharacters: 180, defaultConfidence: 0.66, priority: 76 }),
  intel: Object.freeze({ maxItems: 10, maxCharacters: 160, defaultConfidence: 0.58, priority: 72 }),
  player: Object.freeze({ maxItems: 8, maxCharacters: 160, defaultConfidence: 0.82, priority: 88 }),
  map: Object.freeze({ maxItems: 12, maxCharacters: 150, defaultConfidence: 0.72, priority: 80 }),
  memory: Object.freeze({ maxItems: 10, maxCharacters: 160, defaultConfidence: 0.64, priority: 70 })
});

const RESOLVER_INPUT_GLOBAL_CAPS = Object.freeze({
  maxItems: 96,
  maxTotalCharacters: 14000
});

const RESOLVER_INPUT_FORBIDDEN_SOURCE_CATEGORIES = Object.freeze([
  "sqliteBusinessTables",
  "sessionAuditTables",
  "providerPayloads",
  "promptMaterial",
  "localPathsAndKeys",
  "hiddenLedgers",
  "serverOnlyInternals"
]);

const RESOLVER_INPUT_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|(?:outcome[_ -]?id|evidence[_ -]?refs?|state[_ -]?delta|player[_ -]?delta|resource[_ -]?(?:use|cost)|relationship[_ -]?signals?|audit[_ -]?record)|\b(?:cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const RESOLVER_INPUT_SOURCE_COLLECTIONS = Object.freeze([
  Object.freeze({
    sourceView: "worldGeographyView",
    domain: "geography",
    collections: Object.freeze(["countries", "regions", "cities", "routes", "frontierZones", "officeJurisdictions"])
  }),
  Object.freeze({
    sourceView: "worldPeopleView",
    domain: "people",
    collections: Object.freeze(["npcs", "households", "assets", "estates", "relationships"])
  }),
  Object.freeze({
    sourceView: "relationshipView",
    domain: "people",
    collections: Object.freeze(["relationships", "notablePeople", "activeRequests"])
  }),
  Object.freeze({
    sourceView: "npcActiveRequestView",
    domain: "people",
    collections: Object.freeze(["followUpEvidence.people"])
  }),
  Object.freeze({
    sourceView: "npcActiveRequestView",
    domain: "events",
    collections: Object.freeze(["followUpEvidence.events"])
  }),
  Object.freeze({
    sourceView: "npcActiveRequestView",
    domain: "economy",
    collections: Object.freeze(["followUpEvidence.economy"])
  }),
  Object.freeze({
    sourceView: "npcInteractionView",
    domain: "events",
    collections: Object.freeze(["relationshipActionEvidence"])
  }),
  Object.freeze({
    sourceView: "economyTraceView",
    domain: "economy",
    collections: Object.freeze(["traceItems"])
  }),
  Object.freeze({
    sourceView: "officialCareerView",
    domain: "player",
    collections: Object.freeze(["careerHistory", "recentAssignments", "activeDuties", "courtEntries", "courtEntryFollowUps"])
  }),
  Object.freeze({
    sourceView: "courtResponseView",
    domain: "events",
    collections: Object.freeze(["chainItems", "responseItems", "recentResponses", "nextActions"])
  }),
  Object.freeze({
    sourceView: "courtConsequenceView",
    domain: "events",
    collections: Object.freeze(["pendingSources", "recentSignals", "nextActions"])
  }),
  Object.freeze({
    sourceView: "domainConsequenceView",
    domain: "events",
    collections: Object.freeze(["recentConsequences"])
  }),
  Object.freeze({
    sourceView: "worldEntityView",
    domain: "events",
    collections: Object.freeze(["recentImpacts"])
  }),
  Object.freeze({
    sourceView: "officialPostingsView",
    domain: "offices",
    collections: Object.freeze(["bureaus", "offices", "cityJurisdictions", "postings", "assessmentRecords", "transferRecords"])
  }),
  Object.freeze({
    sourceView: "localAffairsDocketView",
    domain: "events",
    collections: Object.freeze(["dockets"])
  }),
  Object.freeze({
    sourceView: "economicFiscalView",
    domain: "economy",
    collections: Object.freeze(["fiscalLedgers", "grainMarketReports", "tradeSaltCanalRoutes", "localTreasuryReports", "debtCorruptionRisks", "marketIncidents"])
  }),
  Object.freeze({
    sourceView: "militaryDiplomacyView",
    domain: "military",
    collections: Object.freeze(["theaters", "garrisons", "supplyLines", "diplomaticContacts", "frontierIncidents"])
  }),
  Object.freeze({
    sourceView: "historicalEventArchiveView",
    domain: "events",
    collections: Object.freeze(["publicChains"])
  }),
  Object.freeze({
    sourceView: "intelligenceRumorView",
    domain: "intel",
    collections: Object.freeze(["publicRumors"])
  }),
  Object.freeze({
    sourceView: "eventArchiveView",
    domain: "events",
    collections: Object.freeze(["items"])
  }),
  Object.freeze({
    sourceView: "worldThreadView",
    domain: "events",
    collections: Object.freeze(["activeThreads", "recentResolved"])
  }),
  Object.freeze({
    sourceView: "mapContextView",
    domain: "map",
    collections: Object.freeze(["mapEntityRefs", "mapEventHooks"])
  }),
  Object.freeze({
    sourceView: "playerMonthlyBriefingView",
    domain: "player",
    collections: Object.freeze(["sections", "risks", "nextActions"])
  }),
  Object.freeze({
    sourceView: "roleCycleView",
    domain: "player",
    collections: Object.freeze(["currentRole.items"])
  })
]);

const RESOLVER_INPUT_VISIBILITY_ALIASES = Object.freeze({
  public: "public",
  player_visible: "player_visible",
  role_visible: "role_visible",
  office_visible: "role_visible",
  rumor: "role_visible",
  relationship_visible: "player_visible",
  hidden: "hidden",
  private: "hidden",
  actor_private: "hidden",
  sealed: "hidden",
  server_hidden: "hidden",
  gm_only: "hidden",
  server_only: "hidden",
  internal: "hidden"
});

const ACTOR_READ_DOMAIN_ALIASES = Object.freeze({
  geography: Object.freeze(["geography", "map"]),
  people: Object.freeze(["people", "memory"]),
  events: Object.freeze(["events", "memory"]),
  office: Object.freeze(["offices", "player"]),
  local_docket: Object.freeze(["events", "offices", "economy"]),
  market: Object.freeze(["economy"]),
  intel: Object.freeze(["intel"]),
  military: Object.freeze(["military", "map"]),
  diplomacy: Object.freeze(["military", "intel", "map"]),
  career: Object.freeze(["player", "offices"]),
  report: Object.freeze(["player", "offices", "economy", "military"]),
  exam: Object.freeze(["player", "people", "events"]),
  study: Object.freeze(["player", "people", "memory"])
});

module.exports = {
  ACTOR_READ_DOMAIN_ALIASES,
  RESOLVER_INPUT_DOMAIN_CONFIG,
  RESOLVER_INPUT_DOMAINS,
  RESOLVER_INPUT_FORBIDDEN_SOURCE_CATEGORIES,
  RESOLVER_INPUT_GLOBAL_CAPS,
  RESOLVER_INPUT_SCHEMA_VERSION,
  RESOLVER_INPUT_SENSITIVE_TEXT_PATTERN,
  RESOLVER_INPUT_SOURCE_COLLECTIONS,
  RESOLVER_INPUT_VISIBILITY_ALIASES
};
