// @ts-check

const { createHash } = require("node:crypto");

const { buildEventArchiveIndexItems } = require("../game/eventArchive");
const { buildEconomicFiscalRetrievalRows } = require("../game/economicFiscal");
const { buildHistoricalEventRetrievalRows } = require("../game/historicalEventArchive");
const { buildIntelligenceRumorRetrievalRows } = require("../game/intelligenceRumors");
const { buildLocalAffairsDocketView } = require("../game/localAffairsDockets");
const { buildMilitaryDiplomacyRetrievalRows } = require("../game/militaryDiplomacy");
const { buildOfficialPostingsView } = require("../game/officialPostings");
const { buildWorldGeographyView } = require("../game/worldGeography");
const { buildWorldPeopleView } = require("../game/worldPeople");

const PROMPT_RETRIEVAL_DOMAIN_SCHEMA_VERSION = 1;
const PROMPT_RETRIEVAL_SOURCE = "server_visible_prompt_projection";

/**
 * @typedef {import("../contracts/serverContracts").JsonObject} JsonObject
 * @typedef {import("../contracts/serverContracts").SessionRecord} SessionRecord
 * @typedef {import("../contracts/serverContracts").SqlitePromptRetrievalRepairStatus} SqlitePromptRetrievalRepairStatus
 * @typedef {import("../contracts/serverContracts").SqlitePromptRetrievalRow} SqlitePromptRetrievalRow
 * @typedef {import("../contracts/serverContracts").SqlitePromptRetrievalSource} SqlitePromptRetrievalSource
 */

const COLLECTION_GROUPS = Object.freeze({
  "geography.countries": ["geography", "countries"],
  "geography.cities": ["geography", "cities"],
  "geography.routes": ["geography", "routes"],
  "geography.frontierZones": ["geography", "frontierZones"],
  "people.npcs": ["people", "npcs"],
  "people.relationships": ["people", "relationships"],
  "offices.bureaus": ["offices", "bureaus"],
  "offices.offices": ["offices", "offices"],
  "offices.cityJurisdictions": ["offices", "cityJurisdictions"],
  "offices.postings": ["offices", "postings"],
  "offices.assessmentRecords": ["offices", "assessmentRecords"],
  "offices.transferRecords": ["offices", "transferRecords"],
  "events.localDockets": ["events", "localDockets"],
  "events.militaryReports": ["events", "militaryReports"],
  "events.economicReports": ["events", "economicReports"],
  "events.eventChains": ["events", "eventChains"],
  "events.recentEvents": ["events", "recentEvents"],
  "intel.rumors": ["intel", "rumors"]
});

function stringifyJson(value, fallback) {
  const source = value === undefined ? fallback : value;
  return JSON.stringify(source);
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function normalizeForStableJson(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeForStableJson(entry));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = normalizeForStableJson(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalizeForStableJson(value));
}

/**
 * @param {SqlitePromptRetrievalRow} row
 */
function hashPromptRetrievalRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

/**
 * @param {SqlitePromptRetrievalRow} row
 * @returns {SqlitePromptRetrievalRow}
 */
function attachPromptRetrievalRowHash(row) {
  const metadata = parseJsonObject(row.metadata_json);
  return {
    ...row,
    metadata_json: stringifyJson({
      ...metadata,
      contentHash: hashPromptRetrievalRow(row)
    }, {})
  };
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function metadataValue(record, key, fallback = 0) {
  return toInteger(record.metadata?.[key] ?? record.worldState?.[key], fallback);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload || {}));
}

function unique(values, limit = 8) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const item = text(value).trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function compactCountry(country = {}) {
  return {
    id: country.id,
    name: country.name,
    shortName: country.shortName,
    kind: country.kind,
    polityType: country.polityType,
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
    policyPressureTags: unique(country.policyPressureTags, 8),
    diplomaticPosture: country.diplomaticPosture,
    intelligenceSummary: country.intelligenceSummary,
    publicSummary: country.publicSummary
  };
}

function compactCity(city = {}) {
  return {
    id: city.id,
    name: city.name,
    countryId: city.countryId,
    regionId: city.regionId,
    jurisdictionLevel: city.jurisdictionLevel,
    terrain: city.terrain,
    riverOrCoast: city.riverOrCoast,
    strategicTags: unique(city.strategicTags, 8),
    statusLabel: city.statusLabel,
    pressure: city.pressure,
    stability: city.stability,
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
    localIssueTags: unique(city.localIssueTags, 8),
    cityIntelligenceSummary: city.cityIntelligenceSummary,
    publicSummary: city.publicSummary
  };
}

function compactRoute(route = {}) {
  return {
    id: route.id,
    name: route.name,
    type: route.type,
    fromCityId: route.fromCityId,
    toCityId: route.toCityId,
    viaCityIds: unique(route.viaCityIds, 8),
    seasonalRisk: route.seasonalRisk,
    strategicTags: unique(route.strategicTags, 8),
    statusLabel: route.statusLabel,
    risk: route.risk,
    publicSummary: route.publicSummary
  };
}

function compactFrontierZone(frontier = {}) {
  return {
    id: frontier.id,
    name: frontier.name,
    countryId: frontier.countryId,
    neighborCountryId: frontier.neighborCountryId,
    cityIds: unique(frontier.cityIds, 8),
    routeIds: unique(frontier.routeIds, 8),
    statusLabel: frontier.statusLabel,
    pressureMetric: frontier.pressureMetric,
    pressure: frontier.pressure,
    publicSummary: frontier.publicSummary
  };
}

function compactNpc(npc = {}) {
  return {
    id: npc.id,
    name: npc.name,
    courtesyName: npc.courtesyName,
    currentCityId: npc.currentCityId,
    currentOfficeId: npc.currentOfficeId,
    currentPostingId: npc.currentPostingId,
    bureauId: npc.bureauId,
    rankLabel: npc.rankLabel,
    currentGoal: npc.currentGoal,
    reputation: npc.reputation,
    influence: npc.influence,
    resentmentRisk: npc.resentmentRisk,
    legalRisk: npc.legalRisk,
    impeachmentRisk: npc.impeachmentRisk,
    publicSummary: npc.publicSummary
  };
}

function compactRelationship(relationship = {}) {
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
    recentIntent: relationship.recentIntent,
    recentNotes: unique(relationship.recentNotes, 8),
    publicSummary: relationship.publicSummary
  };
}

function compactBureau(bureau = {}) {
  return {
    id: bureau.id,
    name: bureau.name,
    aliases: unique(bureau.aliases, 8),
    level: bureau.level,
    duties: unique(bureau.duties, 12),
    authorityMetrics: unique(bureau.authorityMetrics, 12),
    publicSummary: bureau.publicSummary
  };
}

function compactOffice(office = {}) {
  return {
    id: office.id,
    title: office.title,
    aliases: unique(office.aliases, 8),
    bureauId: office.bureauId,
    rankBand: office.rankBand,
    jurisdictionScope: office.jurisdictionScope,
    typicalCityIds: unique(office.typicalCityIds, 12),
    duties: unique(office.duties, 12),
    publicSummary: office.publicSummary
  };
}

function compactJurisdiction(jurisdiction = {}) {
  return {
    id: jurisdiction.id,
    name: jurisdiction.name,
    bureauId: jurisdiction.bureauId,
    cityId: jurisdiction.cityId,
    regionId: jurisdiction.regionId,
    countryId: jurisdiction.countryId,
    jurisdictionScope: jurisdiction.jurisdictionScope,
    localMetrics: clonePayload(jurisdiction.localMetrics || {}),
    publicSummary: jurisdiction.publicSummary
  };
}

function compactPosting(posting = {}) {
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

function compactAssessment(record = {}) {
  return {
    id: record.id,
    postingId: record.postingId,
    officeId: record.officeId,
    bureauId: record.bureauId,
    holderType: record.holderType,
    status: record.status,
    meritScore: record.meritScore,
    riskScore: record.riskScore,
    recommendation: record.recommendation,
    publicFinding: record.publicFinding,
    publicSummary: record.publicSummary
  };
}

function compactTransfer(record = {}) {
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

function compactEvent(item = {}) {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceLabel: item.sourceLabel,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    status: item.status,
    statusLabel: item.statusLabel,
    dateLabel: item.dateLabel,
    turn: item.turn,
    year: item.year,
    month: item.month,
    tenDayPeriod: item.tenDayPeriod
  };
}

function compactLocalDocket(docket = {}) {
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
    metricRefs: clonePayload(docket.metricRefs || []).slice(0, 2).map((ref) => ({
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
      tags: unique(hint.tags, 4)
    },
    publicSummary: docket.publicSummary
  };
}

function compactMilitaryReport(report = {}) {
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
    cityIds: unique(report.cityIds, 6),
    routeId: report.routeId,
    routeIds: unique(report.routeIds, 6),
    frontierZoneId: report.frontierZoneId,
    publicSummary: report.publicSummary,
    authorityBoundary: report.authorityBoundary
  };
}

function compactEconomicReport(report = {}) {
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
    reliefPressure: report.reliefPressure,
    treasuryCapacity: report.treasuryCapacity,
    localTreasuryCapacity: report.localTreasuryCapacity,
    grainStock: report.grainStock,
    grainStress: report.grainStress,
    marketPriceStress: report.marketPriceStress,
    taxCapacity: report.taxCapacity,
    taxRate: report.taxRate,
    countryId: report.countryId,
    cityId: report.cityId,
    cityIds: unique(report.cityIds, 6),
    routeId: report.routeId,
    routeIds: unique(report.routeIds, 6),
    jurisdictionId: report.jurisdictionId,
    bureauId: report.bureauId,
    sourceId: report.sourceId,
    publicSummary: report.publicSummary,
    authorityBoundary: report.authorityBoundary
  };
}

function compactEventChain(chain = {}) {
  return {
    id: chain.id,
    templateId: chain.templateId,
    domain: chain.domain,
    domainLabel: chain.domainLabel,
    title: chain.title,
    status: chain.status,
    statusLabel: chain.statusLabel,
    pressureScore: chain.pressureScore,
    severity: chain.severity,
    relatedLabels: clonePayload(chain.relatedRefs || [])
      .slice(0, 3)
      .map((ref) => ref.label || ref.id || ref.type)
      .filter(Boolean),
    followUpHints: clonePayload(chain.followUpTriggers || [])
      .slice(0, 2)
      .map((trigger) => trigger.label)
      .filter(Boolean),
    publicSummary: chain.publicSummary,
    authorityBoundary: "事件模板只读公共卷宗；服务器裁决状态与落库。"
  };
}

function compactRumor(rumor = {}) {
  return {
    id: rumor.id,
    kind: rumor.kind,
    kindLabel: rumor.kindLabel,
    channel: rumor.channel,
    title: rumor.title,
    visibility: rumor.visibility,
    credibilityScore: rumor.credibilityScore,
    credibilityTier: rumor.credibilityTier,
    credibilityLabel: rumor.credibilityLabel,
    priorityScore: rumor.priorityScore,
    sourceAttributions: clonePayload(rumor.sourceAttributions || [])
      .slice(0, 3)
      .map((source) => ({
        sourceView: source.sourceView,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceLabel: source.sourceLabel,
        credibilityScore: source.credibilityScore
      })),
    relatedRefs: clonePayload(rumor.relatedRefs || [])
      .slice(0, 4)
      .map((ref) => ({
        type: ref.type,
        id: ref.id,
        label: ref.label
      })),
    relatedLabels: clonePayload(rumor.relatedRefs || [])
      .slice(0, 4)
      .map((ref) => ref.label || ref.id || ref.type)
      .filter(Boolean),
    publicSummary: rumor.publicSummary,
    authorityBoundary: "情报传闻只作玩家视野内线索；服务器裁决真伪、公开和后果。"
  };
}

function buildSearchText(payload = {}) {
  return JSON.stringify(payload)
    .replace(/[{}[\]",:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function safeRowId(collectionKey, payload, index) {
  const id = text(payload.id || payload.sourceId || payload.title || index);
  return `${collectionKey}:${id || index}`;
}

/**
 * @param {SqlitePromptRetrievalRow[]} rows
 * @param {SessionRecord} record
 * @param {string} collectionKey
 * @param {string} sourceView
 * @param {unknown[] | undefined} items
 * @param {(item: any) => JsonObject} mapper
 */
function addRows(rows, record, collectionKey, sourceView, items, mapper) {
  const [domain, collection] = COLLECTION_GROUPS[collectionKey];
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const payload = mapper(item);
    rows.push({
      session_id: record.sessionId,
      row_id: safeRowId(collectionKey, payload, index),
      domain_schema_version: PROMPT_RETRIEVAL_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: PROMPT_RETRIEVAL_SOURCE,
      source_view: sourceView,
      domain,
      collection,
      visibility: "public",
      sort_priority: rows.length,
      payload_json: stringifyJson(payload, {}),
      search_text: buildSearchText(payload),
      metadata_json: stringifyJson({
        generatedAtTurn: metadataValue(record, "turnCount", 0),
        sourceView
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    });
  });
}

function initializePromptRetrievalTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompt_retrieval_index (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_view TEXT NOT NULL,
      domain TEXT NOT NULL,
      collection TEXT NOT NULL,
      visibility TEXT NOT NULL,
      sort_priority INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      search_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_prompt_retrieval_session_domain
      ON prompt_retrieval_index(session_id, domain, collection, sort_priority);
    CREATE INDEX IF NOT EXISTS idx_prompt_retrieval_session_revision
      ON prompt_retrieval_index(session_id, revision, row_id);
  `);
}

function deletePromptRetrievalRows(database, sessionId) {
  database.prepare("DELETE FROM prompt_retrieval_index WHERE session_id = ?").run(sessionId);
}

/**
 * @param {any} database
 * @param {SqlitePromptRetrievalRow} row
 */
function insertPromptRetrievalRow(database, row) {
  const safeRow = attachPromptRetrievalRowHash(row);
  const columns = Object.keys(safeRow);
  const placeholders = columns.map(() => "?").join(", ");
  database
    .prepare(`INSERT INTO prompt_retrieval_index (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...columns.map((column) => safeRow[column]));
}

/**
 * @param {SessionRecord} record
 * @returns {SqlitePromptRetrievalRow[]}
 */
function buildPromptRetrievalRows(record) {
  /** @type {SqlitePromptRetrievalRow[]} */
  const rows = [];
  const geographyView = buildWorldGeographyView(record.worldState);
  const peopleView = buildWorldPeopleView(record.worldState);
  const officialView = buildOfficialPostingsView(record.worldState);
  const localDocketView = buildLocalAffairsDocketView(record.worldState);
  const militaryReports = buildMilitaryDiplomacyRetrievalRows(record.worldState);
  const economicReports = buildEconomicFiscalRetrievalRows(record.worldState);
  const eventChains = buildHistoricalEventRetrievalRows(record.worldState);
  const rumors = buildIntelligenceRumorRetrievalRows(record.worldState);
  const eventItems = buildEventArchiveIndexItems(record.worldState);

  addRows(rows, record, "geography.countries", "worldGeographyView", geographyView.countries, compactCountry);
  addRows(rows, record, "geography.cities", "worldGeographyView", geographyView.cities, compactCity);
  addRows(rows, record, "geography.routes", "worldGeographyView", geographyView.routes, compactRoute);
  addRows(rows, record, "geography.frontierZones", "worldGeographyView", geographyView.frontierZones, compactFrontierZone);
  addRows(rows, record, "people.npcs", "worldPeopleView", peopleView.npcs, compactNpc);
  addRows(rows, record, "people.relationships", "worldPeopleView", peopleView.relationships, compactRelationship);
  addRows(rows, record, "offices.bureaus", "officialPostingsView", officialView.bureaus, compactBureau);
  addRows(rows, record, "offices.offices", "officialPostingsView", officialView.offices, compactOffice);
  addRows(rows, record, "offices.cityJurisdictions", "officialPostingsView", officialView.cityJurisdictions, compactJurisdiction);
  addRows(rows, record, "offices.postings", "officialPostingsView", officialView.postings, compactPosting);
  addRows(rows, record, "offices.assessmentRecords", "officialPostingsView", officialView.assessmentRecords, compactAssessment);
  addRows(rows, record, "offices.transferRecords", "officialPostingsView", officialView.transferRecords, compactTransfer);
  addRows(rows, record, "events.localDockets", "localAffairsDocketView", localDocketView.dockets, compactLocalDocket);
  addRows(rows, record, "events.militaryReports", "militaryDiplomacyView", militaryReports, compactMilitaryReport);
  addRows(rows, record, "events.economicReports", "economicFiscalView", economicReports, compactEconomicReport);
  addRows(rows, record, "events.eventChains", "historicalEventArchiveView", eventChains, compactEventChain);
  addRows(rows, record, "events.recentEvents", "eventArchiveView", eventItems, compactEvent);
  addRows(rows, record, "intel.rumors", "intelligenceRumorView", rumors, compactRumor);

  return rows;
}

function syncPromptRetrievalTables(database, record) {
  deletePromptRetrievalRows(database, record.sessionId);
  for (const row of buildPromptRetrievalRows(record)) {
    insertPromptRetrievalRow(database, row);
  }
}

function getPromptRetrievalTableCount(database, sessionId) {
  return database
    .prepare("SELECT COUNT(*) AS count FROM prompt_retrieval_index WHERE session_id = ?")
    .get(sessionId).count;
}

function hasStalePromptRetrievalRows(database, sessionId, revision) {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM prompt_retrieval_index WHERE session_id = ? AND revision <> ?")
    .get(sessionId, revision);
  return row.count > 0;
}

/**
 * @param {any} database
 * @param {string} sessionId
 * @param {SqlitePromptRetrievalRow[]} expectedRows
 */
function hasMismatchedPromptRetrievalRowIds(database, sessionId, expectedRows) {
  const expectedIds = new Set(expectedRows.map((row) => row.row_id));
  const storedRows = /** @type {Array<Pick<SqlitePromptRetrievalRow, "row_id">>} */ (
    database
      .prepare("SELECT row_id FROM prompt_retrieval_index WHERE session_id = ?")
      .all(sessionId)
  );

  if (storedRows.length !== expectedIds.size) return true;
  for (const row of storedRows) {
    if (!expectedIds.has(row.row_id)) return true;
  }
  return false;
}

/**
 * @param {any} database
 * @param {string} sessionId
 * @param {SqlitePromptRetrievalRow[]} expectedRows
 */
function hasMismatchedPromptRetrievalContentHashes(database, sessionId, expectedRows) {
  const expectedRowsById = new Map(expectedRows.map((row) => [row.row_id, row]));
  const storedRows = /** @type {SqlitePromptRetrievalRow[]} */ (
    database
      .prepare("SELECT * FROM prompt_retrieval_index WHERE session_id = ?")
      .all(sessionId)
  );

  for (const row of storedRows) {
    const expected = expectedRowsById.get(row.row_id);
    const metadata = parseJsonObject(row.metadata_json);
    if (!expected) return true;
    if (!metadata.contentHash) return true;
    if (metadata.contentHash !== hashPromptRetrievalRow(row)) return true;
    if (metadata.contentHash !== hashPromptRetrievalRow(expected)) return true;
  }
  return false;
}

/**
 * @param {any} database
 * @param {SessionRecord} record
 * @returns {SqlitePromptRetrievalRepairStatus}
 */
function getPromptRetrievalRepairStatus(database, record) {
  const expectedRows = buildPromptRetrievalRows(record);
  const count = getPromptRetrievalTableCount(database, record.sessionId);
  const missingOrMismatched = count !== expectedRows.length;
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedPromptRetrievalRowIds(database, record.sessionId, expectedRows);
  const staleRows = hasStalePromptRetrievalRows(database, record.sessionId, record.revision);
  const contentMismatches = !missingOrMismatched &&
    !mismatchedRowIds &&
    hasMismatchedPromptRetrievalContentHashes(database, record.sessionId, expectedRows);
  const tableNeedsRepair = missingOrMismatched || mismatchedRowIds || staleRows || contentMismatches;

  return {
    contentMismatches,
    count,
    expectedCount: expectedRows.length,
    missingOrMismatched,
    mismatchedRowIds,
    needsRepair: tableNeedsRepair,
    staleRows,
    tableNeedsRepair
  };
}

/**
 * @param {any} database
 * @param {SessionRecord} record
 */
function ensurePromptRetrievalTablesForRecord(database, record) {
  const status = getPromptRetrievalRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncPromptRetrievalTables(database, record);
    return true;
  }
  return false;
}

/**
 * @returns {SqlitePromptRetrievalSource}
 */
function emptyPromptRetrievalSource() {
  return {
    geography: {
      countries: [],
      cities: [],
      routes: [],
      frontierZones: []
    },
    people: {
      npcs: [],
      relationships: []
    },
    offices: {
      bureaus: [],
      offices: [],
      cityJurisdictions: [],
      postings: [],
      assessmentRecords: [],
      transferRecords: []
    },
    events: {
      localDockets: [],
      militaryReports: [],
      economicReports: [],
      eventChains: [],
      recentEvents: []
    },
    intel: {
      rumors: []
    }
  };
}

/**
 * @param {any} database
 * @param {string} sessionId
 * @returns {SqlitePromptRetrievalSource}
 */
function readPromptRetrievalSource(database, sessionId) {
  const rows = /** @type {Array<Pick<SqlitePromptRetrievalRow, "domain" | "collection" | "payload_json">>} */ (
    database
      .prepare(`
      SELECT domain, collection, payload_json
      FROM prompt_retrieval_index
      WHERE session_id = ?
        AND visibility = 'public'
      ORDER BY domain, collection, sort_priority, row_id
    `)
      .all(sessionId)
  );
  const source = /** @type {Record<string, Record<string, JsonObject[]>>} */ (emptyPromptRetrievalSource());

  for (const row of rows) {
    const target = source[row.domain]?.[row.collection];
    if (!Array.isArray(target)) continue;
    target.push(parseJsonObject(row.payload_json));
  }

  return source;
}

module.exports = {
  PROMPT_RETRIEVAL_DOMAIN_SCHEMA_VERSION,
  buildPromptRetrievalRows,
  deletePromptRetrievalRows,
  ensurePromptRetrievalTablesForRecord,
  getPromptRetrievalRepairStatus,
  getPromptRetrievalTableCount,
  initializePromptRetrievalTables,
  readPromptRetrievalSource,
  syncPromptRetrievalTables
};
