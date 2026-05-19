const WORLD_PEOPLE_SCHEMA_VERSION = 1;

const MAX_NPCS = 128;
const MAX_HOUSEHOLDS = 64;
const MAX_ASSETS = 128;
const MAX_ESTATES = 128;
const MAX_RELATIONSHIPS = 256;
const MAX_TEXT_LENGTH = 160;
const MAX_NOTES = 8;

const VISIBILITY_VALUES = new Set(["public", "role_visible", "relationship_visible", "rumor", "hidden"]);
const OWNER_TYPES = new Set(["player", "npc", "household", "faction", "bureau", "city", "country"]);
const RELATION_ENTITY_TYPES = new Set([
  "player",
  "npc",
  "household",
  "faction",
  "bureau",
  "office",
  "city",
  "country",
  "estate",
  "asset"
]);
const ASSET_KINDS = new Set(["cash", "shop", "mine", "granary", "debt", "stipend", "business", "other"]);
const ESTATE_STATUS_VALUES = new Set(["held", "leased", "disputed", "mortgaged", "lost", "unknown"]);
const PORTRAIT_REF_PATTERN = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const UNSAFE_PORTRAIT_REF_PATTERN = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

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
  return /^[a-z0-9][a-z0-9_-]*$/i.test(text) ? text : fallback;
}

function cleanPortraitRef(value) {
  const text = cleanText(value, "", 160);
  if (!text || !PORTRAIT_REF_PATTERN.test(text) || UNSAFE_PORTRAIT_REF_PATTERN.test(text)) return "";
  return text;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function clampSignedMetric(value, fallback = 0) {
  return clampNumber(value, -100, 100, fallback);
}

function normalizeVisibility(value, fallback = "public") {
  return VISIBILITY_VALUES.has(value) ? value : fallback;
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
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

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
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

function normalizeNpc(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const name = cleanText(source.name, "", 60);
  if (!id || !name) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    name,
    portraitRef: cleanPortraitRef(source.portraitRef) || null,
    courtesyName: cleanText(source.courtesyName, "", 40),
    genderLabel: cleanText(source.genderLabel, "未详", 24),
    age: clampNumber(source.age, 0, 120, 30),
    alive: normalizeBoolean(source.alive, true),
    homeCityId: cleanId(source.homeCityId, ""),
    currentCityId: cleanId(source.currentCityId, ""),
    householdId: cleanId(source.householdId, ""),
    currentOfficeId: cleanId(source.currentOfficeId, ""),
    currentPostingId: cleanId(source.currentPostingId, ""),
    rankLabel: cleanText(source.rankLabel, "", 32),
    bureauId: cleanId(source.bureauId, ""),
    factionId: cleanId(source.factionId, ""),
    skills: {
      literarySkill: clampMetric(source.skills?.literarySkill ?? source.literarySkill, 40),
      administration: clampMetric(source.skills?.administration ?? source.administration, 40),
      legalJudgment: clampMetric(source.skills?.legalJudgment ?? source.legalJudgment, 40),
      militaryCommand: clampMetric(source.skills?.militaryCommand ?? source.militaryCommand, 30),
      diplomacy: clampMetric(source.skills?.diplomacy ?? source.diplomacy, 40),
      learning: clampMetric(source.skills?.learning ?? source.learning, 45)
    },
    temperament: {
      ambition: clampMetric(source.temperament?.ambition ?? source.ambition, 45),
      loyalty: clampMetric(source.temperament?.loyalty ?? source.loyalty, 50),
      integrity: clampMetric(source.temperament?.integrity ?? source.integrity, 55),
      caution: clampMetric(source.temperament?.caution ?? source.caution, 50),
      temper: clampMetric(source.temperament?.temper ?? source.temper, 40)
    },
    ideologyTags: normalizeStringList(source.ideologyTags, 8),
    currentGoal: cleanText(source.currentGoal, "", 120),
    reputation: clampMetric(source.reputation, 30),
    influence: clampMetric(source.influence, 20),
    patronagePower: clampMetric(source.patronagePower, 10),
    peerNetwork: clampMetric(source.peerNetwork, 20),
    wealthCash: clampNumber(source.wealthCash, 0, 10000000, 0),
    landMu: clampNumber(source.landMu, 0, 10000000, 0),
    debts: clampNumber(source.debts, 0, 10000000, 0),
    annualIncomeEstimate: clampNumber(source.annualIncomeEstimate, 0, 10000000, 0),
    estateIds: normalizeIdList(source.estateIds, 12),
    assetIds: normalizeIdList(source.assetIds, 12),
    family: {
      fatherId: cleanId(source.family?.fatherId ?? source.fatherId, ""),
      motherId: cleanId(source.family?.motherId ?? source.motherId, ""),
      spouseIds: normalizeIdList(source.family?.spouseIds ?? source.spouseIds, 8),
      childrenIds: normalizeIdList(source.family?.childrenIds ?? source.childrenIds, 12),
      marriageAllianceTags: normalizeStringList(source.family?.marriageAllianceTags ?? source.marriageAllianceTags, 8)
    },
    health: clampMetric(source.health, 80),
    legalRisk: clampMetric(source.legalRisk, 0),
    impeachmentRisk: clampMetric(source.impeachmentRisk, 0),
    resentmentRisk: clampMetric(source.resentmentRisk, 0),
    hiddenIntent: cleanText(source.hiddenIntent, "", MAX_TEXT_LENGTH),
    ...shared,
    publicSummary: shared.publicSummary || `${name}为可追踪人物。`
  };
}

function normalizeHousehold(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const familyName = cleanText(source.familyName, "", 40);
  if (!id || !familyName) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    familyName,
    seatCityId: cleanId(source.seatCityId, ""),
    wealthScore: clampMetric(source.wealthScore, 30),
    landMu: clampNumber(source.landMu, 0, 10000000, 0),
    prestige: clampMetric(source.prestige, 20),
    gentryRank: cleanText(source.gentryRank, "未入品第", 40),
    marriageNetworkScore: clampMetric(source.marriageNetworkScore, 20),
    debtPressure: clampMetric(source.debtPressure, 0),
    politicalAlignment: cleanText(source.politicalAlignment, "", 80),
    familyRisk: clampMetric(source.familyRisk, 0),
    memberNpcIds: normalizeIdList(source.memberNpcIds, 32),
    estateIds: normalizeIdList(source.estateIds, 16),
    assetIds: normalizeIdList(source.assetIds, 16),
    ...shared,
    publicSummary: shared.publicSummary || `${familyName}氏为可追踪家族。`
  };
}

function normalizeOwnerType(value, fallback = "household") {
  return OWNER_TYPES.has(value) ? value : fallback;
}

function normalizeAssetKind(value) {
  return ASSET_KINDS.has(value) ? value : "other";
}

function normalizeAsset(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const name = cleanText(source.name, "", 80);
  if (!id || !name) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    kind: normalizeAssetKind(source.kind),
    name,
    ownerType: normalizeOwnerType(source.ownerType, "household"),
    ownerId: cleanId(source.ownerId, ""),
    cityId: cleanId(source.cityId, ""),
    valueEstimate: clampNumber(source.valueEstimate, 0, 10000000, 0),
    annualIncomeEstimate: clampNumber(source.annualIncomeEstimate, 0, 10000000, 0),
    debtValue: clampNumber(source.debtValue, 0, 10000000, 0),
    statusLabel: cleanText(source.statusLabel, "未详", 40),
    ...shared,
    publicSummary: shared.publicSummary || `${name}为可追踪资产。`
  };
}

function normalizeEstate(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = cleanId(source.id, "");
  const name = cleanText(source.name, "", 80);
  if (!id || !name) return null;
  const shared = normalizeSharedFields(source, worldState, "public");
  const status = ESTATE_STATUS_VALUES.has(source.status) ? source.status : "unknown";

  return {
    id,
    name,
    ownerType: normalizeOwnerType(source.ownerType, "household"),
    ownerId: cleanId(source.ownerId, ""),
    cityId: cleanId(source.cityId, ""),
    regionId: cleanId(source.regionId, ""),
    landMu: clampNumber(source.landMu, 0, 10000000, 0),
    tenantHouseholds: clampNumber(source.tenantHouseholds, 0, 1000000, 0),
    rentGrainEstimate: clampNumber(source.rentGrainEstimate, 0, 10000000, 0),
    taxBurden: clampMetric(source.taxBurden, 30),
    waterworks: clampMetric(source.waterworks, 50),
    disputeRisk: clampMetric(source.disputeRisk, 0),
    status,
    statusLabel: cleanText(source.statusLabel, status === "unknown" ? "未详" : source.statusLabel, 40),
    ...shared,
    publicSummary: shared.publicSummary || `${name}为可追踪田产。`
  };
}

function normalizeRelationEntityType(value, fallback = "npc") {
  return RELATION_ENTITY_TYPES.has(value) ? value : fallback;
}

function normalizeRelationship(raw, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const sourceType = normalizeRelationEntityType(source.sourceType, "npc");
  const targetType = normalizeRelationEntityType(source.targetType, "npc");
  const sourceId = cleanId(source.sourceId, "");
  const targetId = cleanId(source.targetId, "");
  const id = cleanId(source.id, `${sourceType}-${sourceId}-${targetType}-${targetId}`);
  if (!id || !sourceId || !targetId) return null;
  const shared = normalizeSharedFields(source, worldState, "public");

  return {
    id,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationship: clampSignedMetric(source.relationship, 0),
    trust: clampMetric(source.trust, 0),
    resentment: clampMetric(source.resentment, 0),
    obligation: clampSignedMetric(source.obligation, 0),
    patronage: clampSignedMetric(source.patronage, 0),
    fear: clampMetric(source.fear, 0),
    rivalry: clampMetric(source.rivalry, 0),
    stance: cleanText(source.stance, "", 80),
    recentIntent: cleanText(source.recentIntent, "", 120),
    recentNotes: normalizeNotes(source.recentNotes),
    ...shared,
    publicSummary: shared.publicSummary || "一条可追踪关系。"
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

function normalizeWorldPeopleSchemaBundle(input = {}, worldState = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    schemaVersion: WORLD_PEOPLE_SCHEMA_VERSION,
    generatedAtTurn: clampNumber(source.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    npcs: normalizeRows(source.npcs, normalizeNpc, MAX_NPCS, worldState),
    households: normalizeRows(source.households, normalizeHousehold, MAX_HOUSEHOLDS, worldState),
    assets: normalizeRows(source.assets, normalizeAsset, MAX_ASSETS, worldState),
    estates: normalizeRows(source.estates, normalizeEstate, MAX_ESTATES, worldState),
    relationships: normalizeRows(source.relationships, normalizeRelationship, MAX_RELATIONSHIPS, worldState),
    recentNotes: normalizeNotes(source.recentNotes)
  };
}

function canSeeWorldPeopleRow(row, worldState = {}) {
  if (!row || row.visibility === "hidden") return false;
  if (row.visibility === "public" || row.visibility === "rumor") return true;
  if (row.visibility === "relationship_visible") return row.knownToPlayer === true;
  if (row.visibility === "role_visible") {
    const role = worldState.player?.role || "scholar";
    return role !== "scholar" || row.knownToPlayer === true;
  }
  return false;
}

function nullableVisibleId(id, visibleIds) {
  return id && visibleIds.has(id) ? id : null;
}

function filterVisibleIds(values, visibleIds) {
  return values.filter((id) => visibleIds.has(id));
}

function isVisibleOwner(row, visibleIds) {
  if (row.ownerType === "npc") return visibleIds.npcs.has(row.ownerId);
  if (row.ownerType === "household") return visibleIds.households.has(row.ownerId);
  return true;
}

function isVisibleEndpoint(type, id, visibleIds) {
  if (type === "npc") return visibleIds.npcs.has(id);
  if (type === "household") return visibleIds.households.has(id);
  if (type === "estate") return visibleIds.estates.has(id);
  if (type === "asset") return visibleIds.assets.has(id);
  return Boolean(id);
}

function viewNpc(npc, visibleIds) {
  return {
    id: npc.id,
    name: npc.name,
    portraitRef: npc.portraitRef || null,
    courtesyName: npc.courtesyName,
    genderLabel: npc.genderLabel,
    age: npc.age,
    alive: npc.alive,
    homeCityId: npc.homeCityId,
    currentCityId: npc.currentCityId,
    householdId: nullableVisibleId(npc.householdId, visibleIds.households),
    currentOfficeId: npc.currentOfficeId,
    currentPostingId: npc.currentPostingId,
    rankLabel: npc.rankLabel,
    bureauId: npc.bureauId,
    factionId: npc.factionId,
    skills: npc.skills,
    temperament: npc.temperament,
    ideologyTags: npc.ideologyTags,
    currentGoal: npc.currentGoal,
    reputation: npc.reputation,
    influence: npc.influence,
    patronagePower: npc.patronagePower,
    peerNetwork: npc.peerNetwork,
    wealthCash: npc.wealthCash,
    landMu: npc.landMu,
    debts: npc.debts,
    annualIncomeEstimate: npc.annualIncomeEstimate,
    estateIds: filterVisibleIds(npc.estateIds, visibleIds.estates),
    assetIds: filterVisibleIds(npc.assetIds, visibleIds.assets),
    family: {
      fatherId: nullableVisibleId(npc.family.fatherId, visibleIds.npcs),
      motherId: nullableVisibleId(npc.family.motherId, visibleIds.npcs),
      spouseIds: filterVisibleIds(npc.family.spouseIds, visibleIds.npcs),
      childrenIds: filterVisibleIds(npc.family.childrenIds, visibleIds.npcs),
      marriageAllianceTags: npc.family.marriageAllianceTags
    },
    health: npc.health,
    legalRisk: npc.legalRisk,
    impeachmentRisk: npc.impeachmentRisk,
    resentmentRisk: npc.resentmentRisk,
    visibility: npc.visibility,
    knownToPlayer: npc.knownToPlayer,
    intelConfidence: npc.intelConfidence,
    publicSummary: npc.publicSummary,
    lastUpdatedTurn: npc.lastUpdatedTurn
  };
}

function viewHousehold(household, visibleIds) {
  return {
    id: household.id,
    familyName: household.familyName,
    seatCityId: household.seatCityId,
    wealthScore: household.wealthScore,
    landMu: household.landMu,
    prestige: household.prestige,
    gentryRank: household.gentryRank,
    marriageNetworkScore: household.marriageNetworkScore,
    debtPressure: household.debtPressure,
    politicalAlignment: household.politicalAlignment,
    familyRisk: household.familyRisk,
    memberNpcIds: filterVisibleIds(household.memberNpcIds, visibleIds.npcs),
    estateIds: filterVisibleIds(household.estateIds, visibleIds.estates),
    assetIds: filterVisibleIds(household.assetIds, visibleIds.assets),
    visibility: household.visibility,
    knownToPlayer: household.knownToPlayer,
    intelConfidence: household.intelConfidence,
    publicSummary: household.publicSummary,
    lastUpdatedTurn: household.lastUpdatedTurn
  };
}

function viewAsset(asset) {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    ownerType: asset.ownerType,
    ownerId: asset.ownerId,
    cityId: asset.cityId,
    valueEstimate: asset.valueEstimate,
    annualIncomeEstimate: asset.annualIncomeEstimate,
    debtValue: asset.debtValue,
    statusLabel: asset.statusLabel,
    visibility: asset.visibility,
    knownToPlayer: asset.knownToPlayer,
    intelConfidence: asset.intelConfidence,
    publicSummary: asset.publicSummary,
    lastUpdatedTurn: asset.lastUpdatedTurn
  };
}

function viewEstate(estate) {
  return {
    id: estate.id,
    name: estate.name,
    ownerType: estate.ownerType,
    ownerId: estate.ownerId,
    cityId: estate.cityId,
    regionId: estate.regionId,
    landMu: estate.landMu,
    tenantHouseholds: estate.tenantHouseholds,
    rentGrainEstimate: estate.rentGrainEstimate,
    taxBurden: estate.taxBurden,
    waterworks: estate.waterworks,
    disputeRisk: estate.disputeRisk,
    status: estate.status,
    statusLabel: estate.statusLabel,
    visibility: estate.visibility,
    knownToPlayer: estate.knownToPlayer,
    intelConfidence: estate.intelConfidence,
    publicSummary: estate.publicSummary,
    lastUpdatedTurn: estate.lastUpdatedTurn
  };
}

function viewRelationship(relationship) {
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
    patronage: relationship.patronage,
    fear: relationship.fear,
    rivalry: relationship.rivalry,
    stance: relationship.stance,
    recentIntent: relationship.recentIntent,
    recentNotes: relationship.recentNotes,
    visibility: relationship.visibility,
    knownToPlayer: relationship.knownToPlayer,
    intelConfidence: relationship.intelConfidence,
    publicSummary: relationship.publicSummary,
    lastUpdatedTurn: relationship.lastUpdatedTurn
  };
}

function buildWorldPeopleSchemaView(input = {}, worldState = {}) {
  const state = normalizeWorldPeopleSchemaBundle(input, worldState);
  const visibleNpcs = state.npcs.filter((row) => canSeeWorldPeopleRow(row, worldState));
  const visibleHouseholds = state.households.filter((row) => canSeeWorldPeopleRow(row, worldState));
  const visibleIds = {
    npcs: new Set(visibleNpcs.map((row) => row.id)),
    households: new Set(visibleHouseholds.map((row) => row.id)),
    assets: new Set(),
    estates: new Set()
  };
  const visibleEstates = state.estates
    .filter((row) => canSeeWorldPeopleRow(row, worldState) && isVisibleOwner(row, visibleIds));
  visibleIds.estates = new Set(visibleEstates.map((row) => row.id));
  const visibleAssets = state.assets
    .filter((row) => canSeeWorldPeopleRow(row, worldState) && isVisibleOwner(row, visibleIds));
  visibleIds.assets = new Set(visibleAssets.map((row) => row.id));
  const visibleRelationships = state.relationships.filter((row) =>
    canSeeWorldPeopleRow(row, worldState) &&
    isVisibleEndpoint(row.sourceType, row.sourceId, visibleIds) &&
    isVisibleEndpoint(row.targetType, row.targetId, visibleIds)
  );

  return {
    schemaVersion: WORLD_PEOPLE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    npcs: visibleNpcs.map((row) => viewNpc(row, visibleIds)),
    households: visibleHouseholds.map((row) => viewHousehold(row, visibleIds)),
    assets: visibleAssets.map(viewAsset),
    estates: visibleEstates.map(viewEstate),
    relationships: visibleRelationships.map(viewRelationship),
    hiddenNotice: state.npcs.length !== visibleNpcs.length ||
      state.households.length !== visibleHouseholds.length ||
      state.assets.length !== visibleAssets.length ||
      state.estates.length !== visibleEstates.length ||
      state.relationships.length !== visibleRelationships.length
      ? "部分人物、家产或关系仍在玩家当前视野之外。"
      : ""
  };
}

function summarizeWorldPeopleSchemaForPrompt(input = {}, worldState = {}) {
  const view = buildWorldPeopleSchemaView(input, worldState);
  return {
    generatedAtTurn: view.generatedAtTurn,
    npcs: view.npcs.slice(0, 8).map((npc) => ({
      id: npc.id,
      name: npc.name,
      currentCityId: npc.currentCityId,
      householdId: npc.householdId,
      bureauId: npc.bureauId,
      reputation: npc.reputation,
      influence: npc.influence,
      relationshipRisk: Math.max(npc.resentmentRisk, npc.legalRisk, npc.impeachmentRisk),
      publicSummary: npc.publicSummary
    })),
    households: view.households.slice(0, 6).map((household) => ({
      id: household.id,
      familyName: household.familyName,
      seatCityId: household.seatCityId,
      wealthScore: household.wealthScore,
      landMu: household.landMu,
      prestige: household.prestige,
      publicSummary: household.publicSummary
    })),
    assets: view.assets.slice(0, 6).map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      cityId: asset.cityId,
      valueEstimate: asset.valueEstimate,
      annualIncomeEstimate: asset.annualIncomeEstimate,
      debtValue: asset.debtValue,
      publicSummary: asset.publicSummary
    })),
    estates: view.estates.slice(0, 6).map((estate) => ({
      id: estate.id,
      name: estate.name,
      ownerType: estate.ownerType,
      ownerId: estate.ownerId,
      cityId: estate.cityId,
      landMu: estate.landMu,
      disputeRisk: estate.disputeRisk,
      publicSummary: estate.publicSummary
    })),
    relationships: view.relationships.slice(0, 10).map((relationship) => ({
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
    }))
  };
}

module.exports = {
  WORLD_PEOPLE_SCHEMA_VERSION,
  buildWorldPeopleSchemaView,
  canSeeWorldPeopleRow,
  normalizeWorldPeopleSchemaBundle,
  summarizeWorldPeopleSchemaForPrompt
};
