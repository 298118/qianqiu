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
const {
  buildEconomicFiscalRetrievalRows,
  summarizeEconomicFiscalForPrompt
} = require("../game/economicFiscal");
const { summarizeOfficialCareerForPrompt } = require("../game/officialCareer");
const {
  buildOfficialPostingsView,
  summarizeOfficialPostingsForPrompt
} = require("../game/officialPostings");
const { summarizeRelationshipLedger } = require("../game/relationships");
const { summarizeRoleWorldCouplingForPrompt } = require("../game/roleWorldCoupling");
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
const { getPromptRetrievalSource } = require("./promptContextSource");

const RETRIEVAL_CONTEXT_SCHEMA_VERSION = 1;
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
  recentEvents: 6,
  entities: 5
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
  recentEvents: 4,
  entities: 1
});

const PROMPT_BUDGET_PROFILES = Object.freeze({
  ordinary: Object.freeze({
    maxRows: 48,
    limits: ORDINARY_TURN_LIMITS
  }),
  high: Object.freeze({
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
  ["events", "worldThreads"],
  ["events", "longTermEvents"],
  ["events", "resolvedEvents"],
  ["events", "localDockets"],
  ["events", "militaryReports"],
  ["events", "economicReports"],
  ["events", "recentEvents"],
  ["entities", "highlights"]
]);

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

function rankRows(rows, options) {
  const {
    query,
    limit,
    sourceType,
    textFields = ["name", "title", "officeTitle", "publicSummary", "summary"],
    baseScore = () => 0,
    mapRow
  } = options;

  return (Array.isArray(rows) ? rows : [])
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
  return Array.isArray(rows) ? rows : null;
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

function buildEventContext(worldState, query, retrievalSource = null) {
  const threadView = buildWorldThreadView(worldState);
  const longTermView = buildLongTermEventView(worldState);
  const eventArchiveItems = safeRetrievalCollection(retrievalSource, "events", "recentEvents") ||
    buildEventArchiveIndexItems(worldState);
  const sourceLocalDockets = safeRetrievalCollection(retrievalSource, "events", "localDockets");
  const sourceMilitaryReports = safeRetrievalCollection(retrievalSource, "events", "militaryReports");
  const sourceEconomicReports = safeRetrievalCollection(retrievalSource, "events", "economicReports");
  const localDockets = sourceLocalDockets || buildLocalAffairsDocketView(worldState).dockets;
  const militaryReports = sourceMilitaryReports || buildMilitaryDiplomacyRetrievalRows(worldState);
  const economicReports = sourceEconomicReports || buildEconomicFiscalRetrievalRows(worldState);
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
    recentEvents
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
    entities: { ...context.entities }
  };
}

function countRetrievalRows(context = {}) {
  return RETRIEVAL_ROW_PATHS.reduce((total, [domain, collection]) => {
    const rows = context[domain]?.[collection];
    return total + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}

function trimRowsFromEnd(rows, amount) {
  if (!Array.isArray(rows) || amount <= 0) return rows;
  return rows.slice(0, Math.max(0, rows.length - amount));
}

function applyPromptBudget(context, options = {}) {
  const requestedProfile = cleanText(
    options.promptBudgetProfile || options.retrievalBudgetProfile || options.retrievalBudget,
    "high",
    24
  );
  const profile = PROMPT_BUDGET_PROFILES[requestedProfile] || PROMPT_BUDGET_PROFILES.high;
  const next = cloneRetrievalContext(context);
  const limits = profile.limits;

  next.geography.countries = next.geography.countries.slice(0, limits.countries);
  next.geography.cities = next.geography.cities.slice(0, limits.cities);
  next.geography.routes = next.geography.routes.slice(0, limits.routes);
  next.geography.frontierZones = next.geography.frontierZones.slice(0, limits.frontierZones);
  next.people.npcs = next.people.npcs.slice(0, limits.npcs);
  next.people.relationships = next.people.relationships.slice(0, limits.relationships);
  next.offices.bureaus = next.offices.bureaus.slice(0, limits.bureaus);
  next.offices.offices = next.offices.offices.slice(0, limits.offices);
  next.offices.cityJurisdictions = next.offices.cityJurisdictions.slice(0, limits.cityJurisdictions);
  next.offices.postings = next.offices.postings.slice(0, limits.postings);
  next.offices.assessmentRecords = next.offices.assessmentRecords.slice(0, limits.assessmentRecords);
  next.offices.transferRecords = next.offices.transferRecords.slice(0, limits.transferRecords);
  next.events.worldThreads = next.events.worldThreads.slice(0, limits.worldThreads);
  next.events.longTermEvents = next.events.longTermEvents.slice(0, limits.longTermEvents);
  next.events.resolvedEvents = next.events.resolvedEvents.slice(0, limits.resolvedEvents);
  next.events.localDockets = next.events.localDockets.slice(0, limits.localDockets);
  next.events.militaryReports = next.events.militaryReports.slice(0, limits.militaryReports);
  next.events.economicReports = next.events.economicReports.slice(0, limits.economicReports);
  next.events.recentEvents = next.events.recentEvents.slice(0, limits.recentEvents);
  next.entities.highlights = next.entities.highlights.slice(0, limits.entities);

  let overflow = countRetrievalRows(next) - profile.maxRows;
  for (const [domain, collection] of [...RETRIEVAL_ROW_PATHS].reverse()) {
    if (overflow <= 0) break;
    const rows = next[domain]?.[collection];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const before = rows.length;
    next[domain][collection] = trimRowsFromEnd(rows, overflow);
    overflow -= before - next[domain][collection].length;
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
      "worldEntityView",
      "eventArchiveView"
    ],
    query: {
      task: query.task,
      playerAction: query.playerAction,
      terms: query.terms
    },
    geography: buildGeographyContext(worldState, query, retrievalSource),
    people: buildPeopleContext(worldState, query, retrievalSource),
    offices: buildOfficeContext(worldState, query, retrievalSource),
    events: buildEventContext(worldState, query, retrievalSource),
    entities: buildEntityContext(worldState, query),
    safety: {
      visibility: "Only server-built player-visible projections are assembled here.",
      authority: "This context is read-only for providers; appointments, transfers, events, ledgers, and database writes remain server-owned."
    }
  };

  return applyPromptBudget(context, options);
}

function assemblePromptContext(worldState = {}, options = {}) {
  return {
    relationshipLedger: summarizeRelationshipLedger(worldState.relationshipLedger, worldState, { visibleOnly: true }),
    examCalendar: summarizeExamCalendarForPrompt(worldState),
    longTermEvents: summarizeLongTermEventsForPrompt(worldState),
    worldGeography: summarizeWorldGeographyForPrompt(worldState),
    worldEntities: summarizeWorldEntitiesForPrompt(worldState),
    worldPeople: summarizeWorldPeopleForPrompt(worldState),
    worldThreads: summarizeWorldThreadsForPrompt(worldState),
    localAffairsDockets: summarizeLocalAffairsDocketsForPrompt(worldState),
    militaryDiplomacy: summarizeMilitaryDiplomacyForPrompt(worldState),
    economicFiscal: summarizeEconomicFiscalForPrompt(worldState),
    officialCareer: summarizeOfficialCareerForPrompt(worldState),
    officialPostings: summarizeOfficialPostingsForPrompt(worldState),
    roleWorldCoupling: summarizeRoleWorldCouplingForPrompt(worldState),
    retrievalContext: buildRankedRetrievalContext(worldState, options)
  };
}

module.exports = {
  RETRIEVAL_CONTEXT_SCHEMA_VERSION,
  assemblePromptContext,
  buildRankedRetrievalContext
};
