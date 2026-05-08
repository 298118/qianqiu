const { inferOfficeByTitle } = require("./officialCatalog");

const OFFICIAL_POSTING_SCHEMA_VERSION = 1;

const MAX_BUREAUS = 48;
const MAX_OFFICES = 160;
const MAX_CITY_JURISDICTIONS = 160;
const MAX_POSTINGS = 256;
const MAX_ASSESSMENT_RECORDS = 256;
const MAX_TRANSFER_RECORDS = 160;
const MAX_TEXT_LENGTH = 160;
const MAX_NOTES = 8;

const ADMIN_ROLES = new Set(["official", "minister", "emperor", "magistrate", "general"]);
const VISIBILITY_VALUES = new Set(["public", "role_visible", "office_visible", "relationship_visible", "rumor", "hidden"]);
const BUREAU_LEVELS = new Set(["court", "provincial", "prefecture", "county", "frontier", "temporary", "academy", "censorate", "military"]);
const JURISDICTION_SCOPES = new Set(["court", "province", "prefecture", "county", "frontier", "temporary", "academy", "censorate", "military"]);
const HOLDER_TYPES = new Set(["player", "npc", "vacant", "unknown"]);
const POSTING_STATUSES = new Set(["active", "acting", "suspended", "vacant", "transferred", "dismissed", "mourning_leave", "restoration_pending"]);
const ASSESSMENT_STATUSES = new Set(["draft", "pending", "resolved", "archived"]);
const ASSESSMENT_RECOMMENDATIONS = new Set(["none", "retention", "promotion", "transfer", "outpost", "demotion", "impeachment", "punishment"]);
const TRANSFER_TYPES = new Set(["appointment", "transfer", "promotion", "outpost", "demotion", "punishment", "mourning_leave", "restoration", "retention"]);
const TRANSFER_STATUSES = new Set(["proposed", "approved", "applied", "rejected", "cancelled"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function normalizeStringList(value, limit = 8, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const text = cleanText(entry, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeIdList(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const id = cleanId(entry, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeNotes(value) {
  return normalizeStringList(value, MAX_NOTES, MAX_TEXT_LENGTH);
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeVisibility(value, fallback = "public") {
  return VISIBILITY_VALUES.has(value) ? value : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDate(worldState = {}, source = {}) {
  const dateSource = isPlainObject(source.date) ? source.date : source;
  return {
    year: clampNumber(dateSource.year, 1, 9999, clampNumber(worldState.year, 1, 9999, 1644)),
    month: clampNumber(dateSource.month, 1, 12, clampNumber(worldState.month, 1, 12, 1)),
    tenDayPeriod: clampNumber(dateSource.tenDayPeriod, 1, 3, clampNumber(worldState.tenDayPeriod, 1, 3, 1)),
    turn: clampNumber(dateSource.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function normalizeKnownToPlayer(raw, visibility) {
  if (visibility === "public" || visibility === "rumor") return true;
  return normalizeBoolean(raw.knownToPlayer, false);
}

function normalizeSharedFields(raw, worldState, defaultVisibility = "public") {
  const visibility = normalizeVisibility(raw.visibility, defaultVisibility);
  return {
    visibility,
    knownToPlayer: normalizeKnownToPlayer(raw, visibility),
    intelConfidence: clampNumber(raw.intelConfidence, 0, 100, visibility === "public" ? 80 : 35),
    publicSummary: cleanText(raw.publicSummary, ""),
    hiddenNotes: normalizeNotes(raw.hiddenNotes),
    lastUpdatedTurn: clampNumber(raw.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function currentOfficeContext(worldState = {}) {
  const player = worldState.player || {};
  const career = worldState.officialCareer || {};
  const office = inferOfficeByTitle(player.officeTitle || career.currentPosting || player.position || "");
  const officeIds = new Set([
    cleanId(career.currentOfficeId, ""),
    cleanId(player.currentOfficeId, ""),
    cleanId(office?.id, "")
  ].filter(Boolean));
  const bureauIds = new Set([
    cleanId(career.bureauId, ""),
    cleanId(player.bureauId, ""),
    cleanId(office?.bureauId, "")
  ].filter(Boolean));
  return {
    playerId: cleanId(player.id, "P1"),
    role: player.role || "scholar",
    officeIds,
    bureauIds
  };
}

function rowMatchesCurrentOffice(row, worldState = {}) {
  const context = currentOfficeContext(worldState);
  if (row.holderType === "player" && (!row.holderId || row.holderId === context.playerId)) return true;
  if (row.id && (context.officeIds.has(row.id) || context.bureauIds.has(row.id))) return true;
  if (row.officeId && context.officeIds.has(row.officeId)) return true;
  if (row.bureauId && context.bureauIds.has(row.bureauId)) return true;
  return false;
}

function canSeeOfficialPostingRow(row, worldState = {}) {
  if (!row || row.visibility === "hidden") return false;
  if (row.visibility === "public" || row.visibility === "rumor") return true;
  if (row.visibility === "relationship_visible") return row.knownToPlayer === true;
  if (row.visibility === "role_visible") {
    const role = worldState.player?.role || "scholar";
    return ADMIN_ROLES.has(role) || row.knownToPlayer === true;
  }
  if (row.visibility === "office_visible") {
    return row.knownToPlayer === true || rowMatchesCurrentOffice(row, worldState);
  }
  return false;
}

function normalizeBureau(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const name = cleanText(source.name, "", 60);
  if (!id || !name) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    name,
    aliases: normalizeStringList(source.aliases, 8, 40),
    level: normalizeEnum(source.level, BUREAU_LEVELS, "court"),
    parentBureauId: cleanId(source.parentBureauId, ""),
    capitalCityId: cleanId(source.capitalCityId, ""),
    jurisdictionIds: normalizeIdList(source.jurisdictionIds, 24),
    officeIds: normalizeIdList(source.officeIds, 48),
    duties: normalizeStringList(source.duties, 12, 40),
    authorityMetrics: normalizeStringList(source.authorityMetrics, 12, 40),
    riskTags: normalizeStringList(source.riskTags, 12, 40),
    ...shared,
    publicSummary: shared.publicSummary || cleanText(source.summary, "") || `${name}为可追踪官署。`
  };
}

function normalizeOffice(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const inferred = inferOfficeByTitle(source.title || source.officeTitle || "");
  const id = cleanId(source.id, inferred?.id || "");
  const title = cleanText(source.title || source.officeTitle || inferred?.title, "", 80);
  if (!id || !title) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    title,
    aliases: normalizeStringList(source.aliases, 8, 40),
    rankLabel: cleanText(source.rankLabel, "", 32),
    rankBand: cleanText(source.rankBand || inferred?.rankBand, "unranked", 40),
    bureauId: cleanId(source.bureauId, inferred?.bureauId || ""),
    track: cleanText(source.track || inferred?.track, "", 40),
    jurisdictionScope: normalizeEnum(source.jurisdictionScope || source.scope, JURISDICTION_SCOPES, inferred?.outpost ? "prefecture" : "court"),
    typicalCityIds: normalizeIdList(source.typicalCityIds || source.cityIds, 12),
    requiredRankOrExam: normalizeStringList(source.requiredRankOrExam || source.eligibleFrom || inferred?.eligibleFrom, 12, 60),
    appointmentMethods: normalizeStringList(source.appointmentMethods || source.appointmentMethod, 8, 50),
    normalTermMonths: clampNumber(source.normalTermMonths, 0, 120, inferred?.outpost ? 36 : 0),
    duties: normalizeStringList(source.duties || inferred?.duties, 12, 40),
    authorityMetrics: normalizeStringList(source.authorityMetrics, 12, 40),
    promotionPathIds: normalizeIdList(source.promotionPathIds, 12),
    riskTags: normalizeStringList(source.riskTags, 12, 40),
    outpost: normalizeBoolean(source.outpost, Boolean(inferred?.outpost)),
    ...shared,
    publicSummary: shared.publicSummary || `${title}为可追踪官职，任免仍由服务器裁决。`
  };
}

function normalizeCityJurisdiction(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const name = cleanText(source.name, "", 80);
  if (!id || !name) return null;
  const shared = normalizeSharedFields(source, worldState, "role_visible");

  return {
    id,
    name,
    bureauId: cleanId(source.bureauId, ""),
    supervisingBureauId: cleanId(source.supervisingBureauId, ""),
    cityId: cleanId(source.cityId, ""),
    regionId: cleanId(source.regionId, ""),
    countryId: cleanId(source.countryId, ""),
    jurisdictionScope: normalizeEnum(source.jurisdictionScope || source.scope, JURISDICTION_SCOPES, "prefecture"),
    availableOfficeIds: normalizeIdList(source.availableOfficeIds, 24),
    routeIds: normalizeIdList(source.routeIds, 12),
    frontierZoneIds: normalizeIdList(source.frontierZoneIds, 12),
    localMetrics: {
      publicOrder: clampMetric(source.localMetrics?.publicOrder ?? source.publicOrder, 50),
      taxCapacity: clampMetric(source.localMetrics?.taxCapacity ?? source.taxCapacity, 50),
      lawsuits: clampMetric(source.localMetrics?.lawsuits ?? source.lawsuits, 20),
      waterworks: clampMetric(source.localMetrics?.waterworks ?? source.waterworks, 50),
      gentryInfluence: clampMetric(source.localMetrics?.gentryInfluence ?? source.gentryInfluence, 50),
      disasterRisk: clampMetric(source.localMetrics?.disasterRisk ?? source.disasterRisk, 20),
      militaryPressure: clampMetric(source.localMetrics?.militaryPressure ?? source.militaryPressure, 20),
      academyLevel: clampMetric(source.localMetrics?.academyLevel ?? source.academyLevel, 40)
    },
    ...shared,
    publicSummary: shared.publicSummary || `${name}为可追踪任所辖区。`
  };
}

function normalizeHolderType(value) {
  return HOLDER_TYPES.has(value) ? value : "unknown";
}

function normalizePosting(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const inferred = inferOfficeByTitle(source.officeTitle || source.title || "");
  const id = cleanId(source.id, "");
  const officeId = cleanId(source.officeId, inferred?.id || "");
  if (!id || !officeId) return null;
  const holderType = normalizeHolderType(source.holderType || (source.holderId ? "npc" : "vacant"));
  const shared = normalizeSharedFields(source, worldState, holderType === "player" ? "office_visible" : "role_visible");

  return {
    id,
    officeId,
    officeTitle: cleanText(source.officeTitle || inferred?.title, "", 80),
    bureauId: cleanId(source.bureauId, inferred?.bureauId || ""),
    holderType,
    holderId: cleanId(source.holderId, holderType === "player" ? currentOfficeContext(worldState).playerId : ""),
    status: normalizeEnum(source.status, POSTING_STATUSES, "active"),
    cityId: cleanId(source.cityId, ""),
    regionId: cleanId(source.regionId, ""),
    jurisdictionId: cleanId(source.jurisdictionId, ""),
    superiorPostingId: cleanId(source.superiorPostingId, ""),
    startedAt: currentDate(worldState, source.startedAt || {
      year: source.startedYear,
      month: source.startedMonth,
      tenDayPeriod: source.startedTenDayPeriod,
      turn: source.startedTurn
    }),
    endedAt: source.endedAt || source.endedYear || source.endedTurn
      ? currentDate(worldState, source.endedAt || {
        year: source.endedYear,
        month: source.endedMonth,
        tenDayPeriod: source.endedTenDayPeriod,
        turn: source.endedTurn
      })
      : null,
    expectedReviewTurn: clampNumber(source.expectedReviewTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    termMonths: clampNumber(source.termMonths, 0, 120, 0),
    performanceScore: clampMetric(source.performanceScore, 50),
    impeachmentRisk: clampMetric(source.impeachmentRisk, 0),
    publicReputation: clampMetric(source.publicReputation, 50),
    assignmentIds: normalizeIdList(source.assignmentIds, 12),
    ...shared,
    publicSummary: shared.publicSummary || `${source.officeTitle || inferred?.title || "此任"}为可追踪任命记录。`
  };
}

function normalizeAssessmentRecord(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  if (!id) return null;
  const shared = normalizeSharedFields(source, worldState, "role_visible");

  return {
    id,
    postingId: cleanId(source.postingId, ""),
    officeId: cleanId(source.officeId, ""),
    bureauId: cleanId(source.bureauId, ""),
    holderType: normalizeHolderType(source.holderType || "unknown"),
    holderId: cleanId(source.holderId, ""),
    cycleId: cleanId(source.cycleId, ""),
    date: currentDate(worldState, source),
    status: normalizeEnum(source.status, ASSESSMENT_STATUSES, "pending"),
    meritScore: clampMetric(source.meritScore, 50),
    riskScore: clampMetric(source.riskScore, 0),
    recommendation: normalizeEnum(source.recommendation, ASSESSMENT_RECOMMENDATIONS, "none"),
    publicFinding: cleanText(source.publicFinding, "", MAX_TEXT_LENGTH),
    evidenceEventIds: normalizeIdList(source.evidenceEventIds, 12),
    assignmentIds: normalizeIdList(source.assignmentIds, 12),
    ...shared,
    publicSummary: shared.publicSummary || source.publicFinding || "一条可追踪考成记录。"
  };
}

function normalizeTransferRecord(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  if (!id) return null;
  const fromOffice = inferOfficeByTitle(source.fromOfficeTitle || "");
  const toOffice = inferOfficeByTitle(source.toOfficeTitle || "");
  const shared = normalizeSharedFields(source, worldState, "role_visible");

  return {
    id,
    holderType: normalizeHolderType(source.holderType || "unknown"),
    holderId: cleanId(source.holderId, ""),
    fromPostingId: cleanId(source.fromPostingId, ""),
    toPostingId: cleanId(source.toPostingId, ""),
    fromOfficeId: cleanId(source.fromOfficeId, fromOffice?.id || ""),
    toOfficeId: cleanId(source.toOfficeId, toOffice?.id || ""),
    fromCityId: cleanId(source.fromCityId, ""),
    toCityId: cleanId(source.toCityId, ""),
    relatedAssessmentId: cleanId(source.relatedAssessmentId, ""),
    date: currentDate(worldState, source),
    type: normalizeEnum(source.type || source.reasonType, TRANSFER_TYPES, "transfer"),
    status: normalizeEnum(source.status, TRANSFER_STATUSES, "proposed"),
    publicReason: cleanText(source.publicReason, "", MAX_TEXT_LENGTH),
    relatedEventIds: normalizeIdList(source.relatedEventIds, 12),
    ...shared,
    publicSummary: shared.publicSummary || source.publicReason || "一条可追踪迁转记录。"
  };
}

function normalizeRows(rows, normalizer, limit, worldState) {
  if (!Array.isArray(rows)) return [];
  const normalized = [];
  const seen = new Set();
  for (const row of rows) {
    const entry = normalizer(row, worldState);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    normalized.push(entry);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

function normalizeOfficialPostingSchemaBundle(input = {}, worldState = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    schemaVersion: OFFICIAL_POSTING_SCHEMA_VERSION,
    generatedAtTurn: clampNumber(source.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    bureaus: normalizeRows(source.bureaus, normalizeBureau, MAX_BUREAUS, worldState),
    offices: normalizeRows(source.offices, normalizeOffice, MAX_OFFICES, worldState),
    cityJurisdictions: normalizeRows(source.cityJurisdictions, normalizeCityJurisdiction, MAX_CITY_JURISDICTIONS, worldState),
    postings: normalizeRows(source.postings, normalizePosting, MAX_POSTINGS, worldState),
    assessmentRecords: normalizeRows(source.assessmentRecords, normalizeAssessmentRecord, MAX_ASSESSMENT_RECORDS, worldState),
    transferRecords: normalizeRows(source.transferRecords, normalizeTransferRecord, MAX_TRANSFER_RECORDS, worldState),
    recentNotes: normalizeNotes(source.recentNotes)
  };
}

function nullableVisibleId(id, visibleIds) {
  return id && visibleIds.has(id) ? id : null;
}

function filterVisibleIds(values, visibleIds) {
  return values.filter((id) => visibleIds.has(id));
}

function visibleIfEmpty(id, visibleIds) {
  return !id || visibleIds.has(id);
}

function viewBureau(bureau, visibleIds) {
  return {
    id: bureau.id,
    name: bureau.name,
    aliases: bureau.aliases,
    level: bureau.level,
    parentBureauId: nullableVisibleId(bureau.parentBureauId, visibleIds.bureaus),
    capitalCityId: bureau.capitalCityId,
    jurisdictionIds: filterVisibleIds(bureau.jurisdictionIds, visibleIds.cityJurisdictions),
    officeIds: filterVisibleIds(bureau.officeIds, visibleIds.offices),
    duties: bureau.duties,
    authorityMetrics: bureau.authorityMetrics,
    riskTags: bureau.riskTags,
    visibility: bureau.visibility,
    knownToPlayer: bureau.knownToPlayer,
    intelConfidence: bureau.intelConfidence,
    publicSummary: bureau.publicSummary,
    lastUpdatedTurn: bureau.lastUpdatedTurn
  };
}

function viewOffice(office, visibleIds) {
  return {
    id: office.id,
    title: office.title,
    aliases: office.aliases,
    rankLabel: office.rankLabel,
    rankBand: office.rankBand,
    bureauId: nullableVisibleId(office.bureauId, visibleIds.bureaus),
    track: office.track,
    jurisdictionScope: office.jurisdictionScope,
    typicalCityIds: office.typicalCityIds,
    requiredRankOrExam: office.requiredRankOrExam,
    appointmentMethods: office.appointmentMethods,
    normalTermMonths: office.normalTermMonths,
    duties: office.duties,
    authorityMetrics: office.authorityMetrics,
    promotionPathIds: filterVisibleIds(office.promotionPathIds, visibleIds.offices),
    riskTags: office.riskTags,
    outpost: office.outpost,
    visibility: office.visibility,
    knownToPlayer: office.knownToPlayer,
    intelConfidence: office.intelConfidence,
    publicSummary: office.publicSummary,
    lastUpdatedTurn: office.lastUpdatedTurn
  };
}

function viewCityJurisdiction(row, visibleIds) {
  return {
    id: row.id,
    name: row.name,
    bureauId: nullableVisibleId(row.bureauId, visibleIds.bureaus),
    supervisingBureauId: nullableVisibleId(row.supervisingBureauId, visibleIds.bureaus),
    cityId: row.cityId,
    regionId: row.regionId,
    countryId: row.countryId,
    jurisdictionScope: row.jurisdictionScope,
    availableOfficeIds: filterVisibleIds(row.availableOfficeIds, visibleIds.offices),
    routeIds: row.routeIds,
    frontierZoneIds: row.frontierZoneIds,
    localMetrics: row.localMetrics,
    visibility: row.visibility,
    knownToPlayer: row.knownToPlayer,
    intelConfidence: row.intelConfidence,
    publicSummary: row.publicSummary,
    lastUpdatedTurn: row.lastUpdatedTurn
  };
}

function viewPosting(posting, visibleIds) {
  return {
    id: posting.id,
    officeId: nullableVisibleId(posting.officeId, visibleIds.offices),
    officeTitle: posting.officeTitle,
    bureauId: nullableVisibleId(posting.bureauId, visibleIds.bureaus),
    holderType: posting.holderType,
    holderId: posting.holderType === "vacant" ? "" : posting.holderId,
    status: posting.status,
    cityId: posting.cityId,
    regionId: posting.regionId,
    jurisdictionId: nullableVisibleId(posting.jurisdictionId, visibleIds.cityJurisdictions),
    superiorPostingId: nullableVisibleId(posting.superiorPostingId, visibleIds.postings),
    startedAt: posting.startedAt,
    endedAt: posting.endedAt,
    expectedReviewTurn: posting.expectedReviewTurn,
    termMonths: posting.termMonths,
    performanceScore: posting.performanceScore,
    impeachmentRisk: posting.impeachmentRisk,
    publicReputation: posting.publicReputation,
    assignmentIds: posting.assignmentIds,
    visibility: posting.visibility,
    knownToPlayer: posting.knownToPlayer,
    intelConfidence: posting.intelConfidence,
    publicSummary: posting.publicSummary,
    lastUpdatedTurn: posting.lastUpdatedTurn
  };
}

function viewAssessmentRecord(record, visibleIds) {
  return {
    id: record.id,
    postingId: nullableVisibleId(record.postingId, visibleIds.postings),
    officeId: nullableVisibleId(record.officeId, visibleIds.offices),
    bureauId: nullableVisibleId(record.bureauId, visibleIds.bureaus),
    holderType: record.holderType,
    holderId: record.holderId,
    cycleId: record.cycleId,
    date: record.date,
    status: record.status,
    meritScore: record.meritScore,
    riskScore: record.riskScore,
    recommendation: record.recommendation,
    publicFinding: record.publicFinding,
    evidenceEventIds: record.evidenceEventIds,
    assignmentIds: record.assignmentIds,
    visibility: record.visibility,
    knownToPlayer: record.knownToPlayer,
    intelConfidence: record.intelConfidence,
    publicSummary: record.publicSummary,
    lastUpdatedTurn: record.lastUpdatedTurn
  };
}

function viewTransferRecord(record, visibleIds) {
  return {
    id: record.id,
    holderType: record.holderType,
    holderId: record.holderId,
    fromPostingId: nullableVisibleId(record.fromPostingId, visibleIds.postings),
    toPostingId: nullableVisibleId(record.toPostingId, visibleIds.postings),
    fromOfficeId: nullableVisibleId(record.fromOfficeId, visibleIds.offices),
    toOfficeId: nullableVisibleId(record.toOfficeId, visibleIds.offices),
    fromCityId: record.fromCityId,
    toCityId: record.toCityId,
    relatedAssessmentId: nullableVisibleId(record.relatedAssessmentId, visibleIds.assessmentRecords),
    date: record.date,
    type: record.type,
    status: record.status,
    publicReason: record.publicReason,
    relatedEventIds: record.relatedEventIds,
    visibility: record.visibility,
    knownToPlayer: record.knownToPlayer,
    intelConfidence: record.intelConfidence,
    publicSummary: record.publicSummary,
    lastUpdatedTurn: record.lastUpdatedTurn
  };
}

function buildOfficialPostingSchemaView(input = {}, worldState = {}) {
  const state = normalizeOfficialPostingSchemaBundle(input, worldState);
  const visibleBureaus = state.bureaus.filter((row) => canSeeOfficialPostingRow(row, worldState));
  const visibleIds = {
    bureaus: new Set(visibleBureaus.map((row) => row.id)),
    offices: new Set(),
    cityJurisdictions: new Set(),
    postings: new Set(),
    assessmentRecords: new Set(),
    transferRecords: new Set()
  };

  const visibleOffices = state.offices.filter((row) =>
    canSeeOfficialPostingRow(row, worldState) && visibleIfEmpty(row.bureauId, visibleIds.bureaus)
  );
  visibleIds.offices = new Set(visibleOffices.map((row) => row.id));

  const visibleCityJurisdictions = state.cityJurisdictions.filter((row) =>
    canSeeOfficialPostingRow(row, worldState) &&
    visibleIfEmpty(row.bureauId, visibleIds.bureaus) &&
    visibleIfEmpty(row.supervisingBureauId, visibleIds.bureaus)
  );
  visibleIds.cityJurisdictions = new Set(visibleCityJurisdictions.map((row) => row.id));

  const visiblePostings = state.postings.filter((row) =>
    canSeeOfficialPostingRow(row, worldState) &&
    visibleIfEmpty(row.officeId, visibleIds.offices) &&
    visibleIfEmpty(row.bureauId, visibleIds.bureaus) &&
    visibleIfEmpty(row.jurisdictionId, visibleIds.cityJurisdictions)
  );
  visibleIds.postings = new Set(visiblePostings.map((row) => row.id));

  const visibleAssessmentRecords = state.assessmentRecords.filter((row) =>
    canSeeOfficialPostingRow(row, worldState) &&
    visibleIfEmpty(row.postingId, visibleIds.postings) &&
    visibleIfEmpty(row.officeId, visibleIds.offices) &&
    visibleIfEmpty(row.bureauId, visibleIds.bureaus)
  );
  visibleIds.assessmentRecords = new Set(visibleAssessmentRecords.map((row) => row.id));

  const visibleTransferRecords = state.transferRecords.filter((row) =>
    canSeeOfficialPostingRow(row, worldState) &&
    visibleIfEmpty(row.fromPostingId, visibleIds.postings) &&
    visibleIfEmpty(row.toPostingId, visibleIds.postings) &&
    visibleIfEmpty(row.fromOfficeId, visibleIds.offices) &&
    visibleIfEmpty(row.toOfficeId, visibleIds.offices) &&
    visibleIfEmpty(row.relatedAssessmentId, visibleIds.assessmentRecords)
  );
  visibleIds.transferRecords = new Set(visibleTransferRecords.map((row) => row.id));

  return {
    schemaVersion: OFFICIAL_POSTING_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    bureaus: visibleBureaus.map((row) => viewBureau(row, visibleIds)),
    offices: visibleOffices.map((row) => viewOffice(row, visibleIds)),
    cityJurisdictions: visibleCityJurisdictions.map((row) => viewCityJurisdiction(row, visibleIds)),
    postings: visiblePostings.map((row) => viewPosting(row, visibleIds)),
    assessmentRecords: visibleAssessmentRecords.map((row) => viewAssessmentRecord(row, visibleIds)),
    transferRecords: visibleTransferRecords.map((row) => viewTransferRecord(row, visibleIds)),
    hiddenNotice: state.bureaus.length !== visibleBureaus.length ||
      state.offices.length !== visibleOffices.length ||
      state.cityJurisdictions.length !== visibleCityJurisdictions.length ||
      state.postings.length !== visiblePostings.length ||
      state.assessmentRecords.length !== visibleAssessmentRecords.length ||
      state.transferRecords.length !== visibleTransferRecords.length
      ? "部分官署、任所、考成或迁转记录仍在玩家当前视野之外。"
      : ""
  };
}

function summarizeOfficialPostingSchemaForPrompt(input = {}, worldState = {}) {
  const view = buildOfficialPostingSchemaView(input, worldState);
  return {
    generatedAtTurn: view.generatedAtTurn,
    bureaus: view.bureaus.slice(0, 6).map((bureau) => ({
      id: bureau.id,
      name: bureau.name,
      level: bureau.level,
      duties: bureau.duties.slice(0, 4),
      publicSummary: bureau.publicSummary
    })),
    offices: view.offices.slice(0, 8).map((office) => ({
      id: office.id,
      title: office.title,
      bureauId: office.bureauId,
      rankBand: office.rankBand,
      jurisdictionScope: office.jurisdictionScope,
      duties: office.duties.slice(0, 4),
      publicSummary: office.publicSummary
    })),
    cityJurisdictions: view.cityJurisdictions.slice(0, 8).map((row) => ({
      id: row.id,
      name: row.name,
      bureauId: row.bureauId,
      cityId: row.cityId,
      regionId: row.regionId,
      localMetrics: row.localMetrics,
      publicSummary: row.publicSummary
    })),
    postings: view.postings.slice(0, 8).map((posting) => ({
      id: posting.id,
      officeId: posting.officeId,
      bureauId: posting.bureauId,
      holderType: posting.holderType,
      status: posting.status,
      cityId: posting.cityId,
      performanceScore: posting.performanceScore,
      impeachmentRisk: posting.impeachmentRisk,
      publicReputation: posting.publicReputation,
      assignmentIds: posting.assignmentIds,
      publicSummary: posting.publicSummary
    })),
    assessmentRecords: view.assessmentRecords.slice(0, 6).map((record) => ({
      id: record.id,
      postingId: record.postingId,
      status: record.status,
      meritScore: record.meritScore,
      riskScore: record.riskScore,
      recommendation: record.recommendation,
      publicFinding: record.publicFinding,
      publicSummary: record.publicSummary
    })),
    transferRecords: view.transferRecords.slice(0, 6).map((record) => ({
      id: record.id,
      holderType: record.holderType,
      fromPostingId: record.fromPostingId,
      toPostingId: record.toPostingId,
      type: record.type,
      status: record.status,
      publicReason: record.publicReason,
      publicSummary: record.publicSummary
    }))
  };
}

module.exports = {
  OFFICIAL_POSTING_SCHEMA_VERSION,
  buildOfficialPostingSchemaView,
  canSeeOfficialPostingRow,
  normalizeOfficialPostingSchemaBundle,
  summarizeOfficialPostingSchemaForPrompt
};
