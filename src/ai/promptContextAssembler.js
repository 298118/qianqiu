const { summarizeExamCalendarForPrompt } = require("../game/examCalendar");
const { buildEventArchiveIndexItems } = require("../game/eventArchive");
const {
  buildLongTermEventView,
  summarizeLongTermEventsForPrompt
} = require("../game/longTermEvents");
const {
  buildLocalAffairsDocketView,
  summarizeLocalAffairsDocketsForPrompt
} = require("../game/localAffairsDockets");
const {
  buildMilitaryDiplomacyRetrievalRows,
  summarizeMilitaryDiplomacyForPrompt
} = require("../game/militaryDiplomacy");
const { summarizeMapContextForPrompt } = require("../game/mapContext");
const {
  buildEconomicFiscalRetrievalRows,
  summarizeEconomicFiscalForPrompt
} = require("../game/economicFiscal");
const { summarizeExamProcedureForPrompt } = require("../game/examProcedure");
const { summarizeExamHonorsForPrompt } = require("../game/examHonors");
const { summarizeExamNetworkForPrompt } = require("../game/examNetworks");
const { summarizeAppointmentTrackForPrompt } = require("../game/appointmentTracks");
const { buildHistoricalEventRetrievalRows } = require("../game/historicalEventArchive");
const {
  buildIntelligenceRumorRetrievalRows,
  summarizeIntelligenceRumorsForPrompt
} = require("../game/intelligenceRumors");
const { summarizeStudyProfileForPrompt } = require("../game/studyProfile");
const { summarizeOfficialCareerForPrompt } = require("../game/officialCareer");
const {
  buildOfficialPostingsView,
  summarizeOfficialPostingsForPrompt
} = require("../game/officialPostings");
const { summarizeRelationshipLedger } = require("../game/relationships");
const { summarizeRoleWorldCouplingForPrompt } = require("../game/roleWorldCoupling");
const { summarizeRoleCycleForPrompt } = require("../game/roleCycleView");
const { formatYearMonthPeriod } = require("../game/time");
const {
  buildWorldEntityView,
  summarizeWorldEntitiesForPrompt
} = require("../game/worldEntities");
const {
  buildWorldGeographyView,
  summarizeWorldGeographyForPrompt
} = require("../game/worldGeography");
const {
  buildWorldPeopleView,
  summarizeWorldPeopleForPrompt
} = require("../game/worldPeople");
const {
  buildWorldThreadView,
  summarizeWorldThreadsForPrompt
} = require("../game/worldThreads");
const { summarizeActorMemoryForPrompt } = require("../game/actorMemoryLedger");
const { summarizeRecentPlayerHistory } = require("../game/sessionSummary");
const { getPromptRetrievalSource } = require("./promptContextSource");

const RETRIEVAL_CONTEXT_SCHEMA_VERSION = 1;
const RETRIEVAL_STRATEGY_SCHEMA_VERSION = 1;
const MAX_TEXT_LENGTH = 180;
const MAX_QUERY_TEXT_LENGTH = 240;

const LIMITS = Object.freeze({
  countries: 4,
  cities: 6,
  routes: 4,
  frontierZones: 4,
  npcs: 6,
  relationships: 8,
  bureaus: 4,
  offices: 6,
  cityJurisdictions: 5,
  postings: 4,
  assessmentRecords: 3,
  transferRecords: 3,
  worldThreads: 6,
  longTermEvents: 4,
  resolvedEvents: 3,
  localDockets: 3,
  militaryReports: 4,
  economicReports: 4,
  eventChains: 4,
  recentEvents: 6,
  rumors: 4,
  entities: 5,
  actorMemories: 6,
  sessionSummaries: 3
});

const ORDINARY_TURN_LIMITS = Object.freeze({
  countries: 3,
  cities: 6,
  routes: 2,
  frontierZones: 1,
  npcs: 6,
  relationships: 6,
  bureaus: 3,
  offices: 4,
  cityJurisdictions: 3,
  postings: 2,
  assessmentRecords: 1,
  transferRecords: 1,
  worldThreads: 3,
  longTermEvents: 1,
  resolvedEvents: 1,
  localDockets: 1,
  militaryReports: 1,
  economicReports: 1,
  eventChains: 1,
  recentEvents: 4,
  rumors: 1,
  entities: 1,
  actorMemories: 3,
  sessionSummaries: 2
});

const PROMPT_BUDGET_PROFILES = Object.freeze({
  ordinary: Object.freeze({
    maxChars: 20000,
    maxRows: 48,
    limits: ORDINARY_TURN_LIMITS
  }),
  high: Object.freeze({
    maxChars: 30000,
    maxRows: 72,
    limits: LIMITS
  })
});

const RETRIEVAL_ROW_PATHS = Object.freeze([
  ["geography", "countries"],
  ["geography", "cities"],
  ["geography", "routes"],
  ["geography", "frontierZones"],
  ["people", "npcs"],
  ["people", "relationships"],
  ["offices", "bureaus"],
  ["offices", "offices"],
  ["offices", "cityJurisdictions"],
  ["offices", "postings"],
  ["offices", "assessmentRecords"],
  ["offices", "transferRecords"],
  ["intel", "rumors"],
  ["events", "recentEvents"],
  ["events", "worldThreads"],
  ["events", "longTermEvents"],
  ["events", "resolvedEvents"],
  ["events", "localDockets"],
  ["events", "militaryReports"],
  ["events", "economicReports"],
  ["events", "eventChains"],
  ["entities", "highlights"],
  ["memory", "actorMemories"],
  ["memory", "sessionSummaries"]
]);

const UNSAFE_RETRIEVAL_TEXT_PATTERNS = Object.freeze([
  /S60_PRIVATE_/i,
  /SEALED_[A-Z0-9_]+/i,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent/i,
  /event_log|ai_change_proposals|prompt_retrieval_index|event_archive_index|world_state_json/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/i,
  /sk-[a-z0-9_-]{6,}/i,
  /data\/sessions|data_sessions|\/mnt\/|[A-Z]:\\/i
]);

const SOURCE_TYPE_COLLECTION_PATHS = Object.freeze({
  "worldGeography.country": ["geography", "countries"],
  "worldGeography.city": ["geography", "cities"],
  "worldGeography.route": ["geography", "routes"],
  "worldGeography.frontierZone": ["geography", "frontierZones"],
  "worldPeople.npc": ["people", "npcs"],
  "worldPeople.relationship": ["people", "relationships"],
  "officialPostings.bureau": ["offices", "bureaus"],
  "officialPostings.office": ["offices", "offices"],
  "officialPostings.cityJurisdiction": ["offices", "cityJurisdictions"],
  "officialPostings.posting": ["offices", "postings"],
  "officialPostings.assessmentRecord": ["offices", "assessmentRecords"],
  "officialPostings.transferRecord": ["offices", "transferRecords"],
  "worldThreads.activeThread": ["events", "worldThreads"],
  "longTermEvents.activeEvent": ["events", "longTermEvents"],
  "worldThreads.recentResolved": ["events", "resolvedEvents"],
  "longTermEvents.recentResolved": ["events", "resolvedEvents"],
  "localAffairsDocketView.docket": ["events", "localDockets"],
  "militaryDiplomacyView.report": ["events", "militaryReports"],
  "economicFiscalView.report": ["events", "economicReports"],
  "historicalEventArchiveView.chain": ["events", "eventChains"],
  eventArchiveView: ["events", "recentEvents"],
  "intelligenceRumorView.rumor": ["intel", "rumors"],
  "worldEntities.highlight": ["entities", "highlights"],
  "actorMemoryView.memory": ["memory", "actorMemories"],
  "sessionSummaryView.summary": ["memory", "sessionSummaries"]
});

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function normalizeForSearch(value) {
  return cleanText(value, "", 1000).toLowerCase();
}

function unique(values, limit = 12) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value, "", 96);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cjkNgrams(term) {
  const grams = [];
  const chunks = String(term).match(/[\u4e00-\u9fff]{2,}/gu) || [];
  for (const chunk of chunks) {
    for (const size of [2, 3, 4]) {
      if (chunk.length < size) continue;
      for (let index = 0; index <= chunk.length - size; index += 1) {
        grams.push(chunk.slice(index, index + size));
      }
    }
  }
  return grams;
}

function extractQueryTerms(text) {
  const rawTerms = normalizeForSearch(text)
    .split(/[^\w\u4e00-\u9fff.:-]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return unique(rawTerms.flatMap((term) => [term, ...cjkNgrams(term)]), 24);
}

function buildQuery(worldState = {}, options = {}) {
  const player = worldState.player || {};
  const action = cleanText(options.playerAction, "", MAX_QUERY_TEXT_LENGTH);
  const task = cleanText(options.task, "", 80);
  const role = cleanText(player.role, "scholar", 32);
  const roleLabel = cleanText(player.roleLabel, role, 32);
  const worldHints = [
    action,
    task,
    role,
    roleLabel,
    player.name,
    player.officeTitle,
    player.position,
    player.countyName,
    worldState.dynasty
  ].filter(Boolean).join(" ");

  return {
    task,
    playerAction: action,
    text: normalizeForSearch(worldHints),
    terms: extractQueryTerms(worldHints)
  };
}

function stringifySearchFields(row, fields) {
  return normalizeForSearch(
    fields
      .flatMap((field) => {
        const value = row?.[field];
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") return Object.values(value);
        return value;
      })
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
  );
}

function labelFor(row = {}) {
  return cleanText(row.name || row.title || row.officeTitle || row.familyName || row.id || "", "", 80);
}

function textRelevance(row, query, fields) {
  const haystack = stringifySearchFields(row, fields);
  const label = normalizeForSearch(labelFor(row));
  let score = 0;

  if (label && query.text.includes(label)) score += 120;
  for (const alias of Array.isArray(row.aliases) ? row.aliases : []) {
    const normalizedAlias = normalizeForSearch(alias);
    if (normalizedAlias && query.text.includes(normalizedAlias)) score += 70;
  }
  for (const term of query.terms) {
    if (term.length >= 2 && haystack.includes(term)) score += 24;
  }

  return score;
}

function pressureScore(row = {}) {
  return Math.max(
    clampNumber(row.pressure, 0, 100, 0),
    clampNumber(row.risk, 0, 100, 0),
    clampNumber(row.grainStress, 0, 100, 0),
    clampNumber(100 - (row.stability ?? 100), 0, 100, 0)
  );
}

function relationshipPressure(row = {}) {
  return Math.max(
    Math.abs(clampNumber(row.relationship, -100, 100, 0)),
    clampNumber(row.resentment, 0, 100, 0),
    clampNumber(row.relationshipRisk, 0, 100, 0),
    clampNumber(row.influence, 0, 100, 0)
  );
}

function compareRanked(first, second) {
  if (second.score !== first.score) return second.score - first.score;
  return first.stableId.localeCompare(second.stableId);
}

function candidateMeta(sourceType, candidateCount, limit) {
  const path = SOURCE_TYPE_COLLECTION_PATHS[sourceType] || [];
  return {
    domain: path[0] || "",
    collection: path[1] || sourceType,
    sourceView: sourceType,
    candidateCount: clampNumber(candidateCount, 0, Number.MAX_SAFE_INTEGER, 0),
    selectedCount: 0,
    droppedCount: 0,
    limit: clampNumber(limit, 0, Number.MAX_SAFE_INTEGER, 0),
    maxPriority: 0,
    minPriority: 0
  };
}

function attachRetrievalMeta(rows, meta) {
  if (!Array.isArray(rows)) return rows;
  Object.defineProperty(rows, "__retrievalMeta", {
    value: meta,
    enumerable: false
  });
  return rows;
}

function sliceRankedRows(rows, limit) {
  if (!Array.isArray(rows)) return [];
  return attachRetrievalMeta(rows.slice(0, limit), rows.__retrievalMeta);
}

function mapRankedRows(rows, mapper) {
  if (!Array.isArray(rows)) return [];
  return attachRetrievalMeta(rows.map(mapper), rows.__retrievalMeta);
}

function rankRows(rows, options) {
  const {
    query,
    limit,
    sourceType,
    textFields = ["name", "title", "officeTitle", "publicSummary", "summary"],
    baseScore = () => 0,
    mapRow
  } = options;

  const sourceRows = Array.isArray(rows) ? rows : [];
  const ranked = sourceRows
    .map((row) => {
      const score = baseScore(row) + textRelevance(row, query, textFields);
      return {
        row,
        score,
        stableId: cleanText(row?.id || row?.sourceId || labelFor(row), sourceType, 96)
      };
    })
    .sort(compareRanked)
    .slice(0, limit)
    .map(({ row, score }) => ({
      sourceView: sourceType,
      priority: score,
      ...mapRow(row)
    }));
  const meta = candidateMeta(sourceType, sourceRows.length, limit);
  meta.selectedCount = ranked.length;
  meta.droppedCount = Math.max(0, sourceRows.length - ranked.length);
  meta.maxPriority = ranked.length ? ranked[0].priority : 0;
  meta.minPriority = ranked.length ? ranked[ranked.length - 1].priority : 0;
  return attachRetrievalMeta(ranked, meta);
}

function compactCountry(country) {
  return {
    id: country.id,
    name: country.name,
    kind: country.kind,
    statusLabel: country.statusLabel,
    pressure: country.pressure,
    stability: country.stability,
    intelConfidence: country.intelConfidence,
    fiscalPressure: country.fiscalPressure,
    militaryReadiness: country.militaryReadiness,
    nationalPrestige: country.nationalPrestige,
    legitimacy: country.legitimacy,
    successionRisk: country.successionRisk,
    diplomaticTension: country.diplomaticTension,
    tributeTradeActivity: country.tributeTradeActivity,
    intelligenceReliability: country.intelligenceReliability,
    policyPressureTags: country.policyPressureTags,
    diplomaticPosture: country.diplomaticPosture,
    intelligenceSummary: country.intelligenceSummary,
    publicSummary: country.publicSummary
  };
}

function compactCity(city) {
  return {
    id: city.id,
    name: city.name,
    countryId: city.countryId,
    regionId: city.regionId,
    jurisdictionLevel: city.jurisdictionLevel,
    statusLabel: city.statusLabel,
    pressure: city.pressure,
    localOrder: city.localOrder,
    grainStress: city.grainStress,
    populationScale: city.populationScale,
    taxBase: city.taxBase,
    grainStock: city.grainStock,
    marketPriceStress: city.marketPriceStress,
    gentryInfluence: city.gentryInfluence,
    lawsuitPressure: city.lawsuitPressure,
    corveeBurden: city.corveeBurden,
    waterworksIntegrity: city.waterworksIntegrity,
    disasterRisk: city.disasterRisk,
    trafficLoad: city.trafficLoad,
    garrisonStrength: city.garrisonStrength,
    academyLevel: city.academyLevel,
    localIssueTags: city.localIssueTags,
    cityIntelligenceSummary: city.cityIntelligenceSummary,
    publicSummary: city.publicSummary
  };
}

function compactRoute(route) {
  return {
    id: route.id,
    name: route.name,
    type: route.type,
    statusLabel: route.statusLabel,
    risk: route.risk,
    cityIds: unique([route.fromCityId, route.toCityId, ...(route.viaCityIds || [])], 6),
    publicSummary: route.publicSummary
  };
}

function compactFrontier(frontier) {
  return {
    id: frontier.id,
    name: frontier.name,
    statusLabel: frontier.statusLabel,
    pressure: frontier.pressure,
    pressureMetric: frontier.pressureMetric,
    cityIds: unique(frontier.cityIds, 6),
    routeIds: unique(frontier.routeIds, 6),
    publicSummary: frontier.publicSummary
  };
}

function safeRetrievalCollection(source, domain, collection) {
  const rows = source?.[domain]?.[collection];
  if (!Array.isArray(rows)) return null;
  return rows.filter((row) => !hasUnsafeRetrievalText(row));
}

function hasUnsafeRetrievalText(value) {
  const text = JSON.stringify(value || {});
  return UNSAFE_RETRIEVAL_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function callRetrievalSource(source, worldState, options) {
  if (typeof source === "function") {
    try {
      const result = source({ worldState, options });
      return result && typeof result === "object" ? result : null;
    } catch (error) {
      return null;
    }
  }
  return source && typeof source === "object" ? source : null;
}

function resolveRetrievalSource(worldState, options = {}) {
  if (options.promptRetrievalSource === false || options.retrievalSource === false) return null;
  const explicitSource = options.promptRetrievalSource || options.retrievalSource;
  return callRetrievalSource(explicitSource || getPromptRetrievalSource(worldState), worldState, options);
}

function buildGeographyContext(worldState, query, retrievalSource = null) {
  const sourceCountries = safeRetrievalCollection(retrievalSource, "geography", "countries");
  const sourceCities = safeRetrievalCollection(retrievalSource, "geography", "cities");
  const sourceRoutes = safeRetrievalCollection(retrievalSource, "geography", "routes");
  const sourceFrontierZones = safeRetrievalCollection(retrievalSource, "geography", "frontierZones");
  const view = sourceCountries || sourceCities || sourceRoutes || sourceFrontierZones
    ? {
      countries: sourceCountries || [],
      cities: sourceCities || [],
      routes: sourceRoutes || [],
      frontierZones: sourceFrontierZones || []
    }
    : buildWorldGeographyView(worldState);
  return {
    countries: rankRows(view.countries, {
      query,
      limit: LIMITS.countries,
      sourceType: "worldGeography.country",
      textFields: ["name", "shortName", "kind", "polityType", "publicSummary", "statusLabel", "policyPressureTags", "diplomaticPosture", "intelligenceSummary"],
      baseScore: (country) => pressureScore(country) + (country.kind === "player_realm" ? 10 : 0),
      mapRow: compactCountry
    }),
    cities: rankRows(view.cities, {
      query,
      limit: LIMITS.cities,
      sourceType: "worldGeography.city",
      textFields: ["name", "jurisdictionLevel", "terrain", "riverOrCoast", "strategicTags", "localIssueTags", "cityIntelligenceSummary", "publicSummary", "statusLabel"],
      baseScore: (city) => pressureScore(city),
      mapRow: compactCity
    }),
    routes: rankRows(view.routes, {
      query,
      limit: LIMITS.routes,
      sourceType: "worldGeography.route",
      textFields: ["name", "type", "seasonalRisk", "strategicTags", "publicSummary", "statusLabel"],
      baseScore: (route) => pressureScore(route),
      mapRow: compactRoute
    }),
    frontierZones: rankRows(view.frontierZones, {
      query,
      limit: LIMITS.frontierZones,
      sourceType: "worldGeography.frontierZone",
      textFields: ["name", "statusLabel", "pressureMetric", "publicSummary"],
      baseScore: (frontier) => pressureScore(frontier) + 8,
      mapRow: compactFrontier
    })
  };
}

function compactNpc(npc) {
  return {
    id: npc.id,
    name: npc.name,
    currentCityId: npc.currentCityId,
    currentOfficeId: npc.currentOfficeId,
    currentPostingId: npc.currentPostingId,
    bureauId: npc.bureauId,
    rankLabel: npc.rankLabel,
    reputation: npc.reputation,
    influence: npc.influence,
    relationshipRisk: Math.max(npc.resentmentRisk || 0, npc.legalRisk || 0, npc.impeachmentRisk || 0),
    publicSummary: npc.publicSummary
  };
}

function compactRelationship(relationship) {
  return {
    id: relationship.id,
    sourceType: relationship.sourceType,
    sourceId: relationship.sourceId,
    targetType: relationship.targetType,
    targetId: relationship.targetId,
    relationship: relationship.relationship,
    trust: relationship.trust,
    resentment: relationship.resentment,
    obligation: relationship.obligation,
    stance: relationship.stance,
    recentNotes: relationship.recentNotes,
    publicSummary: relationship.publicSummary
  };
}

function buildPeopleContext(worldState, query, retrievalSource = null) {
  const sourceNpcs = safeRetrievalCollection(retrievalSource, "people", "npcs");
  const sourceRelationships = safeRetrievalCollection(retrievalSource, "people", "relationships");
  const view = sourceNpcs || sourceRelationships
    ? {
      npcs: sourceNpcs || [],
      relationships: sourceRelationships || []
    }
    : buildWorldPeopleView(worldState);
  return {
    npcs: rankRows(view.npcs, {
      query,
      limit: LIMITS.npcs,
      sourceType: "worldPeople.npc",
      textFields: ["name", "courtesyName", "rankLabel", "bureauId", "currentGoal", "publicSummary"],
      baseScore: (npc) => Math.max(npc.influence || 0, npc.reputation || 0, npc.resentmentRisk || 0),
      mapRow: compactNpc
    }),
    relationships: rankRows(view.relationships, {
      query,
      limit: LIMITS.relationships,
      sourceType: "worldPeople.relationship",
      textFields: ["sourceId", "targetId", "stance", "recentIntent", "recentNotes", "publicSummary"],
      baseScore: relationshipPressure,
      mapRow: compactRelationship
    })
  };
}

function compactBureau(bureau) {
  return {
    id: bureau.id,
    name: bureau.name,
    level: bureau.level,
    duties: (bureau.duties || []).slice(0, 4),
    authorityMetrics: (bureau.authorityMetrics || []).slice(0, 4),
    publicSummary: bureau.publicSummary
  };
}

function compactOffice(office) {
  return {
    id: office.id,
    title: office.title,
    bureauId: office.bureauId,
    rankBand: office.rankBand,
    jurisdictionScope: office.jurisdictionScope,
    typicalCityIds: (office.typicalCityIds || []).slice(0, 4),
    duties: (office.duties || []).slice(0, 4),
    publicSummary: office.publicSummary
  };
}

function compactJurisdiction(jurisdiction) {
  return {
    id: jurisdiction.id,
    name: jurisdiction.name,
    bureauId: jurisdiction.bureauId,
    cityId: jurisdiction.cityId,
    regionId: jurisdiction.regionId,
    countryId: jurisdiction.countryId,
    jurisdictionScope: jurisdiction.jurisdictionScope,
    localMetrics: jurisdiction.localMetrics,
    publicSummary: jurisdiction.publicSummary
  };
}

function compactPosting(posting) {
  return {
    id: posting.id,
    officeId: posting.officeId,
    officeTitle: posting.officeTitle,
    bureauId: posting.bureauId,
    holderType: posting.holderType,
    status: posting.status,
    cityId: posting.cityId,
    performanceScore: posting.performanceScore,
    impeachmentRisk: posting.impeachmentRisk,
    publicReputation: posting.publicReputation,
    assignmentIds: unique(posting.assignmentIds, 12),
    publicSummary: posting.publicSummary
  };
}

function compactAssessment(record) {
  return {
    id: record.id,
    postingId: record.postingId,
    officeId: record.officeId,
    bureauId: record.bureauId,
    status: record.status,
    meritScore: record.meritScore,
    riskScore: record.riskScore,
    recommendation: record.recommendation,
    publicFinding: record.publicFinding,
    publicSummary: record.publicSummary
  };
}

function compactTransfer(record) {
  return {
    id: record.id,
    holderType: record.holderType,
    fromOfficeId: record.fromOfficeId,
    toOfficeId: record.toOfficeId,
    fromCityId: record.fromCityId,
    toCityId: record.toCityId,
    type: record.type,
    status: record.status,
    publicReason: record.publicReason,
    publicSummary: record.publicSummary
  };
}

function currentOfficeBoost(row, worldState = {}) {
  const career = worldState.officialCareer || {};
  const player = worldState.player || {};
  const title = cleanText(player.officeTitle || player.position || career.currentPosting, "", 80);
  let score = 0;
  if (row.holderType === "player") score += 100;
  if (row.officeTitle && row.officeTitle === title) score += 70;
  if (row.title && row.title === title) score += 60;
  if (row.bureauId && career.bureauId && row.bureauId === career.bureauId) score += 30;
  return score;
}

function buildOfficeContext(worldState, query, retrievalSource = null) {
  const sourceBureaus = safeRetrievalCollection(retrievalSource, "offices", "bureaus");
  const sourceOffices = safeRetrievalCollection(retrievalSource, "offices", "offices");
  const sourceCityJurisdictions = safeRetrievalCollection(retrievalSource, "offices", "cityJurisdictions");
  const sourcePostings = safeRetrievalCollection(retrievalSource, "offices", "postings");
  const sourceAssessments = safeRetrievalCollection(retrievalSource, "offices", "assessmentRecords");
  const sourceTransfers = safeRetrievalCollection(retrievalSource, "offices", "transferRecords");
  const view = sourceBureaus || sourceOffices || sourceCityJurisdictions || sourcePostings || sourceAssessments || sourceTransfers
    ? {
      bureaus: sourceBureaus || [],
      offices: sourceOffices || [],
      cityJurisdictions: sourceCityJurisdictions || [],
      postings: sourcePostings || [],
      assessmentRecords: sourceAssessments || [],
      transferRecords: sourceTransfers || []
    }
    : buildOfficialPostingsView(worldState);
  return {
    bureaus: rankRows(view.bureaus, {
      query,
      limit: LIMITS.bureaus,
      sourceType: "officialPostings.bureau",
      textFields: ["name", "aliases", "level", "duties", "authorityMetrics", "publicSummary"],
      baseScore: (bureau) => currentOfficeBoost(bureau, worldState),
      mapRow: compactBureau
    }),
    offices: rankRows(view.offices, {
      query,
      limit: LIMITS.offices,
      sourceType: "officialPostings.office",
      textFields: ["title", "aliases", "bureauId", "rankBand", "jurisdictionScope", "duties", "publicSummary"],
      baseScore: (office) => currentOfficeBoost(office, worldState),
      mapRow: compactOffice
    }),
    cityJurisdictions: rankRows(view.cityJurisdictions, {
      query,
      limit: LIMITS.cityJurisdictions,
      sourceType: "officialPostings.cityJurisdiction",
      textFields: ["name", "bureauId", "cityId", "regionId", "countryId", "jurisdictionScope", "publicSummary"],
      baseScore: (jurisdiction) =>
        currentOfficeBoost(jurisdiction, worldState) + pressureScore(jurisdiction.localMetrics || {}),
      mapRow: compactJurisdiction
    }),
    postings: rankRows(view.postings, {
      query,
      limit: LIMITS.postings,
      sourceType: "officialPostings.posting",
      textFields: ["officeTitle", "bureauId", "holderType", "status", "cityId", "publicSummary"],
      baseScore: (posting) =>
        currentOfficeBoost(posting, worldState) + Math.max(posting.impeachmentRisk || 0, 100 - (posting.performanceScore || 100)),
      mapRow: compactPosting
    }),
    assessmentRecords: rankRows(view.assessmentRecords, {
      query,
      limit: LIMITS.assessmentRecords,
      sourceType: "officialPostings.assessmentRecord",
      textFields: ["status", "recommendation", "publicFinding", "publicSummary"],
      baseScore: (record) => currentOfficeBoost(record, worldState) + Math.max(record.riskScore || 0, record.meritScore || 0),
      mapRow: compactAssessment
    }),
    transferRecords: rankRows(view.transferRecords, {
      query,
      limit: LIMITS.transferRecords,
      sourceType: "officialPostings.transferRecord",
      textFields: ["type", "status", "publicReason", "publicSummary"],
      baseScore: (record) => currentOfficeBoost(record, worldState),
      mapRow: compactTransfer
    })
  };
}

function compactWorldThread(thread) {
  return {
    id: thread.id,
    kind: thread.kind,
    status: thread.status,
    sourceType: thread.sourceType,
    sourceLabel: thread.sourceLabel,
    title: thread.title,
    summary: thread.summary,
    severity: thread.severity,
    riskLabel: thread.riskLabel,
    deadlineLabel: thread.deadlineLabel,
    goal: thread.goal,
    interventionHints: (thread.interventionHints || []).slice(0, 4),
    followUpHint: thread.followUpHint
  };
}

function compactLongTermEvent(event) {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    summary: event.summary,
    severity: event.severity,
    remainingMonths: event.remainingMonths,
    durationMonths: event.durationMonths
  };
}

function compactResolvedEvent(event) {
  const compact = {
    id: event.id,
    type: event.type || event.kind,
    title: event.title,
    resolvedTurn: event.resolvedTurn,
    outcome: event.outcome
  };
  if (event.sourceType) compact.threadSourceType = event.sourceType;
  return compact;
}

function compactRecentEvent(event, index) {
  return {
    sourceView: "eventArchiveView",
    priority: LIMITS.recentEvents - index,
    id: event.id,
    sourceType: event.sourceType,
    title: event.title || `近事${index + 1}`,
    summary: cleanText(event.summary, "", MAX_TEXT_LENGTH),
    status: event.status,
    dateLabel: event.dateLabel,
    turn: event.turn
  };
}

function compactLocalDocket(docket) {
  const hint = docket.assessmentHint || {};
  return {
    id: docket.id,
    domain: docket.domain,
    domainLabel: docket.domainLabel,
    title: docket.title,
    cityId: docket.cityId,
    jurisdictionId: docket.jurisdictionId,
    bureauId: docket.bureauId,
    postingId: docket.postingId,
    severity: docket.severity,
    statusLabel: docket.statusLabel,
    pressureScore: docket.pressureScore,
    metricRefs: (docket.metricRefs || []).slice(0, 2).map((ref) => ({
      key: ref.key,
      label: ref.label,
      value: ref.value,
      pressure: ref.pressure
    })),
    assessmentHint: {
      meritDirection: hint.meritDirection,
      riskDirection: hint.riskDirection,
      maxMeritDelta: hint.maxMeritDelta,
      maxRiskDelta: hint.maxRiskDelta,
      tags: Array.isArray(hint.tags) ? hint.tags.slice(0, 4) : []
    },
    publicSummary: docket.publicSummary
  };
}

function compactMilitaryReport(report) {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    statusLabel: report.statusLabel,
    threatScore: report.threatScore,
    supplyRisk: report.supplyRisk,
    readinessScore: report.readinessScore,
    diplomaticTension: report.diplomaticTension,
    intelConfidence: report.intelConfidence,
    countryId: report.countryId,
    neighborCountryId: report.neighborCountryId,
    cityId: report.cityId,
    cityIds: (report.cityIds || []).slice(0, 4),
    routeId: report.routeId,
    routeIds: (report.routeIds || []).slice(0, 4),
    frontierZoneId: report.frontierZoneId,
    publicSummary: report.publicSummary,
    authorityBoundary: report.authorityBoundary
  };
}

function compactEconomicReport(report) {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    statusLabel: report.statusLabel,
    pressureScore: report.pressureScore,
    fiscalPressure: report.fiscalPressure,
    deficitPressure: report.deficitPressure,
    marketPressure: report.marketPressure,
    tradeRisk: report.tradeRisk,
    debtPressure: report.debtPressure,
    corruptionRisk: report.corruptionRisk,
    grainStress: report.grainStress,
    marketPriceStress: report.marketPriceStress,
    countryId: report.countryId,
    cityId: report.cityId,
    cityIds: (report.cityIds || []).length ? report.cityIds.slice(0, 4) : undefined,
    routeId: report.routeId,
    routeIds: (report.routeIds || []).length ? report.routeIds.slice(0, 4) : undefined,
    jurisdictionId: report.jurisdictionId,
    bureauId: report.bureauId,
    sourceId: report.sourceId,
    publicSummary: cleanText(report.publicSummary, "", 80),
    authorityBoundary: "服务器裁决。"
  };
}

function compactEventChain(chain) {
  const relatedLabels = chain.relatedLabels ||
    (chain.relatedRefs || []).map((ref) => ref.label || ref.id || ref.type);
  const followUpHints = chain.followUpHints ||
    (chain.followUpTriggers || []).map((trigger) => trigger.label);
  return {
    id: cleanText(chain.id, "", 80),
    templateId: chain.templateId,
    domain: chain.domain,
    domainLabel: chain.domainLabel,
    title: chain.title,
    statusLabel: chain.statusLabel,
    pressureScore: chain.pressureScore,
    severity: chain.severity,
    relatedLabels: unique(relatedLabels, 3),
    followUpHints: unique(followUpHints, 2),
    publicSummary: cleanText(chain.publicSummary, "", 80),
    authorityBoundary: "事件模板只读公共卷宗；服务器裁决状态与落库。"
  };
}

function compactOrdinaryEventChain(chain) {
  return {
    sourceView: chain.sourceView,
    priority: chain.priority,
    title: chain.title,
    publicSummary: cleanText(chain.publicSummary, "", 36),
    authorityBoundary: "事件模板公共卷宗；服务器裁决。"
  };
}

function compactRumor(rumor) {
  return {
    id: rumor.id,
    kind: rumor.kind,
    channel: rumor.channel,
    title: rumor.title,
    credibilityLabel: rumor.credibilityLabel,
    sourceTypes: unique((rumor.sourceAttributions || []).map((source) => source.sourceType), 2),
    relatedLabels: unique((rumor.relatedRefs || []).map((ref) => ref.label || ref.id || ref.type), 2),
    publicSummary: cleanText(rumor.publicSummary, "", 60),
    authorityBoundary: "传闻线索；真伪与裁决归服务器。"
  };
}

function compactOrdinaryRumor(rumor) {
  return {
    sourceView: rumor.sourceView,
    channel: rumor.channel,
    title: rumor.title,
    credibilityLabel: rumor.credibilityLabel,
    publicSummary: cleanText(rumor.publicSummary, "", 24),
    authorityBoundary: "服务器裁决。"
  };
}

function compactEntity(entity) {
  return {
    id: entity.id,
    category: entity.category,
    kind: entity.kind,
    name: entity.name,
    statusLabel: entity.statusLabel,
    riskLabel: entity.riskLabel,
    metrics: entity.metrics,
    publicSummary: entity.publicSummary,
    relatedLabels: entity.relatedLabels?.summary || [],
    interventionHints: entity.interventionHints
  };
}

function compactActorMemory(row = {}) {
  return {
    id: row.id,
    actorId: row.actorId,
    actorLabel: row.actorLabel,
    type: row.type,
    typeLabel: row.typeLabel,
    summary: cleanText(row.summary, "", 120),
    salience: row.salience,
    confidence: row.confidence,
    sourceType: row.sourceType,
    tags: unique(row.tags || [], 4)
  };
}

function compactSessionSummary(row = {}) {
  return {
    id: row.id,
    periodKey: row.periodKey,
    periodLabel: row.periodLabel,
    publicSummary: cleanText(row.publicSummary, "", 120),
    highlights: unique(row.highlights || [], 4),
    sourceRefs: (row.sourceRefs || []).slice(0, 3)
  };
}

function flattenActorMemoryRows(worldState = {}) {
  const summary = summarizeActorMemoryForPrompt(worldState);
  const rows = [];
  for (const actor of summary.actors || []) {
    for (const [index, memory] of (actor.memories || []).entries()) {
      rows.push({
        id: `${actor.actorId}:${memory.type}:${index}`,
        actorId: actor.actorId,
        actorLabel: actor.actorLabel,
        ...memory
      });
    }
  }
  return rows;
}

function buildMemoryContext(worldState, query) {
  const playerHistory = summarizeRecentPlayerHistory(worldState);
  const actorMemories = flattenActorMemoryRows(worldState);
  const sessionSummaries = Array.isArray(playerHistory.recentMonthlySummaries)
    ? playerHistory.recentMonthlySummaries
    : [];
  return {
    actorMemories: rankRows(actorMemories, {
      query,
      limit: LIMITS.actorMemories,
      sourceType: "actorMemoryView.memory",
      textFields: ["actorId", "actorLabel", "type", "summary", "tags", "sourceType"],
      baseScore: (row) => clampNumber(row.salience, 0, 100, 0),
      mapRow: compactActorMemory
    }),
    sessionSummaries: rankRows(sessionSummaries, {
      query,
      limit: LIMITS.sessionSummaries,
      sourceType: "sessionSummaryView.summary",
      textFields: ["periodKey", "periodLabel", "publicSummary", "highlights"],
      baseScore: () => 20,
      mapRow: compactSessionSummary
    })
  };
}

function buildEventContext(worldState, query, retrievalSource = null) {
  const threadView = buildWorldThreadView(worldState);
  const longTermView = buildLongTermEventView(worldState);
  const eventArchiveItems = safeRetrievalCollection(retrievalSource, "events", "recentEvents") ||
    buildEventArchiveIndexItems(worldState);
  const sourceLocalDockets = safeRetrievalCollection(retrievalSource, "events", "localDockets");
  const sourceMilitaryReports = safeRetrievalCollection(retrievalSource, "events", "militaryReports");
  const sourceEconomicReports = safeRetrievalCollection(retrievalSource, "events", "economicReports");
  const sourceEventChains = safeRetrievalCollection(retrievalSource, "events", "eventChains");
  const localDockets = sourceLocalDockets || buildLocalAffairsDocketView(worldState).dockets;
  const militaryReports = sourceMilitaryReports || buildMilitaryDiplomacyRetrievalRows(worldState);
  const economicReports = sourceEconomicReports || buildEconomicFiscalRetrievalRows(worldState);
  const eventChains = sourceEventChains || buildHistoricalEventRetrievalRows(worldState);
  const recentEvents = eventArchiveItems
    .filter((event) => event.sourceType === "event_history")
    .slice(0, LIMITS.recentEvents)
    .map(compactRecentEvent);

  return {
    worldThreads: rankRows(threadView.activeThreads, {
      query,
      limit: LIMITS.worldThreads,
      sourceType: "worldThreads.activeThread",
      textFields: ["kind", "status", "sourceLabel", "title", "summary", "riskLabel", "deadlineLabel", "goal", "interventionHints", "followUpHint"],
      baseScore: (thread) => (thread.severity || 0) * 28 + (thread.turnsRemaining !== null && thread.turnsRemaining <= 1 ? 20 : 0),
      mapRow: compactWorldThread
    }),
    longTermEvents: rankRows(longTermView.activeEvents, {
      query,
      limit: LIMITS.longTermEvents,
      sourceType: "longTermEvents.activeEvent",
      textFields: ["type", "title", "summary"],
      baseScore: (event) => (event.severity || 0) * 24,
      mapRow: compactLongTermEvent
    }),
    resolvedEvents: [
      ...rankRows(threadView.recentResolved, {
        query,
        limit: LIMITS.resolvedEvents,
        sourceType: "worldThreads.recentResolved",
        textFields: ["kind", "sourceType", "title", "outcome"],
        baseScore: () => 6,
        mapRow: compactResolvedEvent
      }),
      ...rankRows(longTermView.recentResolved, {
        query,
        limit: LIMITS.resolvedEvents,
        sourceType: "longTermEvents.recentResolved",
        textFields: ["type", "title", "outcome"],
        baseScore: () => 5,
        mapRow: compactResolvedEvent
      })
    ].slice(0, LIMITS.resolvedEvents),
    localDockets: rankRows(localDockets, {
      query,
      limit: LIMITS.localDockets,
      sourceType: "localAffairsDocketView.docket",
      textFields: ["domain", "domainLabel", "title", "cityId", "jurisdictionId", "bureauId", "statusLabel", "metricRefs", "assessmentHint", "publicSummary"],
      baseScore: (docket) => (docket.severity || 0) * 32 + clampNumber(docket.pressureScore, 0, 100, 0),
      mapRow: compactLocalDocket
    }),
    militaryReports: rankRows(militaryReports, {
      query,
      limit: LIMITS.militaryReports,
      sourceType: "militaryDiplomacyView.report",
      textFields: ["type", "title", "statusLabel", "countryId", "neighborCountryId", "cityIds", "routeIds", "frontierZoneId", "publicSummary", "authorityBoundary"],
      baseScore: (report) => Math.max(
        clampNumber(report.threatScore, 0, 100, 0),
        clampNumber(report.supplyRisk, 0, 100, 0),
        clampNumber(report.diplomaticTension, 0, 100, 0)
      ),
      mapRow: compactMilitaryReport
    }),
    economicReports: rankRows(economicReports, {
      query,
      limit: LIMITS.economicReports,
      sourceType: "economicFiscalView.report",
      textFields: ["type", "title", "statusLabel", "countryId", "cityId", "cityIds", "routeId", "routeIds", "jurisdictionId", "bureauId", "publicSummary", "authorityBoundary"],
      baseScore: (report) => Math.max(
        clampNumber(report.pressureScore, 0, 100, 0),
        clampNumber(report.fiscalPressure, 0, 100, 0),
        clampNumber(report.marketPressure, 0, 100, 0),
        clampNumber(report.tradeRisk, 0, 100, 0),
        clampNumber(report.debtPressure, 0, 100, 0),
        clampNumber(report.corruptionRisk, 0, 100, 0)
      ),
      mapRow: compactEconomicReport
    }),
    eventChains: rankRows(eventChains, {
      query,
      limit: LIMITS.eventChains,
      sourceType: "historicalEventArchiveView.chain",
      textFields: ["domain", "domainLabel", "title", "publicSummary", "relatedRefs", "followUpTriggers", "authorityBoundary"],
      baseScore: (chain) => Math.max(
        clampNumber(chain.pressureScore, 0, 100, 0),
        (chain.severity || 0) * 22
      ),
      mapRow: compactEventChain
    }),
    recentEvents
  };
}

function buildIntelContext(worldState, query, retrievalSource = null) {
  const sourceRumors = safeRetrievalCollection(retrievalSource, "intel", "rumors");
  const rumors = sourceRumors || buildIntelligenceRumorRetrievalRows(worldState);

  return {
    rumors: rankRows(rumors, {
      query,
      limit: LIMITS.rumors,
      sourceType: "intelligenceRumorView.rumor",
      textFields: [
        "kind",
        "kindLabel",
        "channel",
        "title",
        "publicSummary",
        "credibilityLabel",
        "sourceAttributions",
        "relatedRefs",
        "authorityBoundary"
      ],
      baseScore: (rumor) =>
        clampNumber(rumor.priorityScore, 0, 300, 0) +
        clampNumber(rumor.credibilityScore, 0, 100, 0),
      mapRow: compactRumor
    })
  };
}

function buildEntityContext(worldState, query) {
  const view = buildWorldEntityView(worldState);
  return {
    highlights: rankRows(view.highlights, {
      query,
      limit: LIMITS.entities,
      sourceType: "worldEntities.highlight",
      textFields: ["name", "categoryLabel", "kindLabel", "statusLabel", "riskLabel", "publicSummary", "relatedLabels", "interventionHints"],
      baseScore: (entity) => pressureScore(entity.metrics || {}) + (entity.riskTone === "high" ? 30 : 0),
      mapRow: compactEntity
    })
  };
}

function cloneRetrievalContext(context) {
  return {
    ...context,
    geography: { ...context.geography },
    people: { ...context.people },
    offices: { ...context.offices },
    events: { ...context.events },
    intel: { ...context.intel },
    entities: { ...context.entities },
    memory: { ...context.memory }
  };
}

function countRetrievalRows(context = {}) {
  return RETRIEVAL_ROW_PATHS.reduce((total, [domain, collection]) => {
    const rows = context[domain]?.[collection];
    return total + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}

function getRetrievalCollectionRows(context = {}, domain, collection) {
  const rows = context[domain]?.[collection];
  return Array.isArray(rows) ? rows : [];
}

function collectRetrievalStats(context = {}) {
  const collections = {};
  const candidates = {};
  const domains = {};

  for (const [domain, collection] of RETRIEVAL_ROW_PATHS) {
    const rows = getRetrievalCollectionRows(context, domain, collection);
    const key = `${domain}.${collection}`;
    const meta = rows.__retrievalMeta || {};
    const selectedCount = rows.length;
    const candidateCount = Math.max(
      clampNumber(meta.candidateCount, 0, Number.MAX_SAFE_INTEGER, selectedCount),
      selectedCount
    );
    const droppedCount = Math.max(0, candidateCount - selectedCount);
    collections[key] = selectedCount;
    candidates[key] = {
      candidateCount,
      droppedCount,
      selectedCount
    };
    domains[domain] = {
      candidateCount: (domains[domain]?.candidateCount || 0) + candidateCount,
      droppedCount: (domains[domain]?.droppedCount || 0) + droppedCount,
      selectedCount: (domains[domain]?.selectedCount || 0) + selectedCount
    };
  }

  return {
    candidates,
    collections,
    domains,
    totalRows: countRetrievalRows(context)
  };
}

function trimRowsFromEnd(rows, amount) {
  if (!Array.isArray(rows) || amount <= 0) return rows;
  return sliceRankedRows(rows, Math.max(0, rows.length - amount));
}

function serializedRetrievalChars(context = {}) {
  return JSON.stringify(context).length;
}

function trimRowsForCharacterBudget(context, maxChars) {
  const result = {
    trimmedRows: 0,
    serializedChars: serializedRetrievalChars(context)
  };
  if (!Number.isFinite(maxChars) || maxChars <= 0) return result;

  while (result.serializedChars > maxChars) {
    let trimmed = false;
    for (const [domain, collection] of [...RETRIEVAL_ROW_PATHS].reverse()) {
      const rows = context[domain]?.[collection];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      context[domain][collection] = trimRowsFromEnd(rows, 1);
      result.trimmedRows += 1;
      trimmed = true;
      break;
    }
    if (!trimmed) break;
    result.serializedChars = serializedRetrievalChars(context);
  }

  return result;
}

function applyPromptBudget(context, options = {}) {
  const hasExplicitBudgetProfile = Boolean(
    options.promptBudgetProfile || options.retrievalBudgetProfile || options.retrievalBudget
  );
  const requestedProfile = cleanText(
    options.promptBudgetProfile || options.retrievalBudgetProfile || options.retrievalBudget,
    "high",
    24
  );
  const profile = PROMPT_BUDGET_PROFILES[requestedProfile] || PROMPT_BUDGET_PROFILES.high;
  const next = cloneRetrievalContext(context);
  const limits = profile.limits;

  next.geography.countries = sliceRankedRows(next.geography.countries, limits.countries);
  next.geography.cities = sliceRankedRows(next.geography.cities, limits.cities);
  next.geography.routes = sliceRankedRows(next.geography.routes, limits.routes);
  next.geography.frontierZones = sliceRankedRows(next.geography.frontierZones, limits.frontierZones);
  next.people.npcs = sliceRankedRows(next.people.npcs, limits.npcs);
  next.people.relationships = sliceRankedRows(next.people.relationships, limits.relationships);
  next.offices.bureaus = sliceRankedRows(next.offices.bureaus, limits.bureaus);
  next.offices.offices = sliceRankedRows(next.offices.offices, limits.offices);
  next.offices.cityJurisdictions = sliceRankedRows(next.offices.cityJurisdictions, limits.cityJurisdictions);
  next.offices.postings = sliceRankedRows(next.offices.postings, limits.postings);
  next.offices.assessmentRecords = sliceRankedRows(next.offices.assessmentRecords, limits.assessmentRecords);
  next.offices.transferRecords = sliceRankedRows(next.offices.transferRecords, limits.transferRecords);
  next.events.worldThreads = sliceRankedRows(next.events.worldThreads, limits.worldThreads);
  next.events.longTermEvents = sliceRankedRows(next.events.longTermEvents, limits.longTermEvents);
  next.events.resolvedEvents = sliceRankedRows(next.events.resolvedEvents, limits.resolvedEvents);
  next.events.localDockets = sliceRankedRows(next.events.localDockets, limits.localDockets);
  next.events.militaryReports = sliceRankedRows(next.events.militaryReports, limits.militaryReports);
  next.events.economicReports = sliceRankedRows(next.events.economicReports, limits.economicReports);
  next.events.eventChains = sliceRankedRows(next.events.eventChains, limits.eventChains);
  if (profile === PROMPT_BUDGET_PROFILES.ordinary) {
    next.events.eventChains = mapRankedRows(next.events.eventChains, compactOrdinaryEventChain);
  }
  next.events.recentEvents = sliceRankedRows(next.events.recentEvents, limits.recentEvents);
  next.intel.rumors = sliceRankedRows(next.intel.rumors, limits.rumors);
  if (profile === PROMPT_BUDGET_PROFILES.ordinary) {
    next.intel.rumors = mapRankedRows(next.intel.rumors, compactOrdinaryRumor);
  }
  next.entities.highlights = sliceRankedRows(next.entities.highlights, limits.entities);
  next.memory.actorMemories = sliceRankedRows(next.memory.actorMemories, limits.actorMemories);
  next.memory.sessionSummaries = sliceRankedRows(next.memory.sessionSummaries, limits.sessionSummaries);

  const beforeOverflowRows = countRetrievalRows(next);
  let overflow = countRetrievalRows(next) - profile.maxRows;
  let globalTrimmedRows = 0;
  for (const [domain, collection] of [...RETRIEVAL_ROW_PATHS].reverse()) {
    if (overflow <= 0) break;
    const rows = next[domain]?.[collection];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const before = rows.length;
    next[domain][collection] = trimRowsFromEnd(rows, overflow);
    const trimmed = before - next[domain][collection].length;
    globalTrimmedRows += trimmed;
    overflow -= trimmed;
  }

  let stats = collectRetrievalStats(next);
  let charsBeforeCharBudget = serializedRetrievalChars(next);
  let charBudget = { serializedChars: charsBeforeCharBudget, trimmedRows: 0 };
  if (hasExplicitBudgetProfile || requestedProfile === "ordinary") {
    charBudget = trimRowsForCharacterBudget(next, Math.max(1000, profile.maxChars - 1200));
    charsBeforeCharBudget = charBudget.serializedChars;
  }
  stats = collectRetrievalStats(next);
  next.strategy = {
    schemaVersion: RETRIEVAL_STRATEGY_SCHEMA_VERSION,
    profile: PROMPT_BUDGET_PROFILES[requestedProfile] ? requestedProfile : "high",
    maxRows: profile.maxRows,
    maxChars: profile.maxChars,
    selectedRows: stats.totalRows,
    preGlobalTrimRows: beforeOverflowRows,
    globalTrimmedRows,
    preCharBudgetChars: charsBeforeCharBudget,
    serializedChars: charBudget.serializedChars,
    charBudgetTrimmedRows: charBudget.trimmedRows,
    domainSelectedRows: Object.fromEntries(
      Object.entries(stats.domains).map(([domain, meta]) => [domain, meta.selectedCount])
    ),
    candidateRows: Object.fromEntries(
      Object.entries(stats.domains).map(([domain, meta]) => [domain, meta.candidateCount])
    ),
    droppedRows: Object.fromEntries(
      Object.entries(stats.domains).map(([domain, meta]) => [domain, meta.droppedCount])
    ),
    ordering: [
      "玩家输入/任务文本命中",
      "压力、风险、可信度与事件新鲜度",
      "当前身份、任所、官署和地理相关性",
      "稳定 id 兜底排序"
    ],
    visibility: "只读服务器可见 projection；不读取原始 SQLite、原始审计、模型建议原文、完整提示词、隐藏札记或本地路径。",
    pagination: {
      source: "按 collection 截断并记录候选、入选、丢弃；浏览器分页另走 route view 或 fixture page。",
      totalCandidateRows: Object.values(stats.candidates).reduce((total, meta) => total + meta.candidateCount, 0),
      droppedRows: Object.values(stats.candidates).reduce((total, meta) => total + meta.droppedCount, 0)
    }
  };
  if (hasExplicitBudgetProfile || requestedProfile === "ordinary") {
    charBudget = trimRowsForCharacterBudget(next, profile.maxChars);
    next.strategy.charBudgetTrimmedRows += charBudget.trimmedRows;
    const finalStats = collectRetrievalStats(next);
    next.strategy.selectedRows = finalStats.totalRows;
    next.strategy.domainSelectedRows = Object.fromEntries(
      Object.entries(finalStats.domains).map(([domain, meta]) => [domain, meta.selectedCount])
    );
    next.strategy.serializedChars = charBudget.serializedChars;
  } else {
    next.strategy.serializedChars = serializedRetrievalChars(next);
  }

  return next;
}

function buildRankedRetrievalContext(worldState = {}, options = {}) {
  const query = buildQuery(worldState, options);
  const player = worldState.player || {};
  const retrievalSource = resolveRetrievalSource(worldState, options);

  const context = {
    schemaVersion: RETRIEVAL_CONTEXT_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    role: {
      id: cleanText(player.role, "scholar", 32),
      label: cleanText(player.roleLabel, player.role || "书生", 32),
      name: cleanText(player.name, "未定", 48)
    },
    retrievalMode: "server_visible_ranked_projection",
    sourceViews: [
      "worldGeographyView",
      "worldPeopleView",
      "officialPostingsView",
      "worldThreadView",
      "longTermEventView",
      "localAffairsDocketView",
      "militaryDiplomacyView",
      "economicFiscalView",
      "mapContextView",
      "historicalEventArchiveView",
      "intelligenceRumorView",
      "worldEntityView",
      "eventArchiveView",
      "actorMemoryView",
      "sessionSummaryView",
      "roleCycleView"
    ],
    query: {
      task: query.task,
      playerAction: query.playerAction,
      terms: query.terms
    },
    roleVisibility: {
      roleId: cleanText(player.role, "scholar", 32),
      profile: player.role === "scholar" ? "public_rumor" : "role_visible_official",
      boundary: "检索只使用各 view builder 对当前身份返回的可见行；隐藏私档、封存事件链和 raw table 不进入候选集。"
    },
    geography: buildGeographyContext(worldState, query, retrievalSource),
    people: buildPeopleContext(worldState, query, retrievalSource),
    offices: buildOfficeContext(worldState, query, retrievalSource),
    events: buildEventContext(worldState, query, retrievalSource),
    intel: buildIntelContext(worldState, query, retrievalSource),
    entities: buildEntityContext(worldState, query),
    memory: buildMemoryContext(worldState, query),
    safety: {
      visibility: "Only server-built player-visible projections are assembled here.",
      authority: "This context is read-only for model adapters; appointments, transfers, events, ledgers, and database writes remain server-owned."
    }
  };

  return applyPromptBudget(context, options);
}

function assemblePromptContext(worldState = {}, options = {}) {
  return {
    relationshipLedger: summarizeRelationshipLedger(worldState.relationshipLedger, worldState, { visibleOnly: true }),
    studyProfile: summarizeStudyProfileForPrompt(worldState),
    examProcedure: summarizeExamProcedureForPrompt(worldState),
    examHonors: summarizeExamHonorsForPrompt(worldState),
    examNetwork: summarizeExamNetworkForPrompt(worldState),
    appointmentTrack: summarizeAppointmentTrackForPrompt(worldState),
    examCalendar: summarizeExamCalendarForPrompt(worldState),
    longTermEvents: summarizeLongTermEventsForPrompt(worldState),
    worldGeography: summarizeWorldGeographyForPrompt(worldState),
    worldEntities: summarizeWorldEntitiesForPrompt(worldState),
    worldPeople: summarizeWorldPeopleForPrompt(worldState),
    worldThreads: summarizeWorldThreadsForPrompt(worldState),
    localAffairsDockets: summarizeLocalAffairsDocketsForPrompt(worldState),
    militaryDiplomacy: summarizeMilitaryDiplomacyForPrompt(worldState),
    economicFiscal: summarizeEconomicFiscalForPrompt(worldState),
    mapContext: summarizeMapContextForPrompt(worldState, options),
    intelligenceRumors: summarizeIntelligenceRumorsForPrompt(worldState, options),
    officialCareer: summarizeOfficialCareerForPrompt(worldState),
    officialPostings: summarizeOfficialPostingsForPrompt(worldState),
    roleWorldCoupling: summarizeRoleWorldCouplingForPrompt(worldState),
    roleCycle: summarizeRoleCycleForPrompt(worldState),
    actorMemory: summarizeActorMemoryForPrompt(worldState, null, options),
    recentPlayerHistory: summarizeRecentPlayerHistory(worldState, options),
    retrievalContext: buildRankedRetrievalContext(worldState, options)
  };
}

module.exports = {
  RETRIEVAL_CONTEXT_SCHEMA_VERSION,
  assemblePromptContext,
  buildRankedRetrievalContext
};
