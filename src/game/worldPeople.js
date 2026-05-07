const {
  WORLD_PEOPLE_SCHEMA_VERSION,
  buildWorldPeopleSchemaView,
  normalizeWorldPeopleSchemaBundle,
  summarizeWorldPeopleSchemaForPrompt
} = require("./worldPeopleSchemas");
const { buildActiveNpcRequestView } = require("./activeRequests");
const { normalizeRelationshipLedger } = require("./relationships");

const MAX_TEXT_LENGTH = 140;
const MAX_RECENT_NOTES = 8;

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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function playerId(worldState = {}) {
  return cleanId(worldState.player?.id, "P1");
}

function relationshipLabel(value) {
  if (value >= 60) return "笃厚";
  if (value >= 20) return "亲近";
  if (value > -20) return "平常";
  if (value > -60) return "疏离";
  return "敌视";
}

function resentmentLabel(value) {
  if (value >= 70) return "深重";
  if (value >= 40) return "警惕";
  if (value >= 15) return "微结";
  return "不显";
}

function trustFromRelationship(entry) {
  return clampMetric(50 + (entry.relationship || 0) * 0.45 - (entry.resentment || 0) * 0.35, 45);
}

function characterNpcRow(character, ledgerEntry, worldState) {
  const id = cleanId(character?.id, "");
  const name = cleanText(character?.name, "");
  if (!id || !name) return null;

  const roleLabel = cleanText(character.role, "可追踪人物", 60);
  const visible = ledgerEntry?.visible !== false;
  const skill = clampMetric(character.skill, 45);
  const loyalty = clampMetric(character.loyalty, 50);
  const ambition = clampMetric(character.ambition, 45);
  const relationship = clampNumber(ledgerEntry?.relationship, -100, 100, 0);
  const resentment = clampMetric(ledgerEntry?.resentment, 0);
  if (!visible) return null;
  const publicSummary = `${name}为${roleLabel}，与玩家情分${relationshipLabel(relationship)}，怨望${resentmentLabel(resentment)}。`;

  return {
    id,
    name,
    genderLabel: cleanText(character.genderLabel, "未详", 24),
    alive: typeof character.alive === "boolean" ? character.alive : true,
    rankLabel: roleLabel,
    skills: {
      literarySkill: skill,
      administration: skill,
      legalJudgment: Math.max(30, skill - 8),
      militaryCommand: Math.max(20, skill - 18),
      diplomacy: Math.max(30, Math.round((skill + loyalty) / 2)),
      learning: skill
    },
    temperament: {
      ambition,
      loyalty,
      integrity: loyalty,
      caution: Math.max(25, 100 - Math.round(ambition / 2)),
      temper: clampMetric(50 + Math.round((ambition - loyalty) / 3), 40)
    },
    currentGoal: cleanText(ledgerEntry?.recentIntent, ""),
    reputation: clampMetric(Math.round((skill + loyalty) / 2), 35),
    influence: clampMetric(Math.max(15, Math.round(skill * 0.45 + Math.max(relationship, 0) * 0.25)), 20),
    peerNetwork: clampMetric(Math.max(15, Math.round(skill * 0.35 + Math.max(relationship, 0) * 0.35)), 20),
    resentmentRisk: resentment,
    visibility: "relationship_visible",
    knownToPlayer: visible,
    intelConfidence: visible ? 75 : 30,
    publicSummary,
    lastUpdatedTurn: clampNumber(ledgerEntry?.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function activeRequestFor(worldState, targetType, targetId) {
  const request = buildActiveNpcRequestView(worldState);
  if (!request || request.targetType !== targetType || request.targetId !== targetId) return "";
  return `当前请托：${request.title}；${request.ask}；限第${request.dueTurn}回合前回应。`;
}

function notesForEntry(notes, entryName) {
  const prefix = `${entryName}:`;
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => typeof note === "string" && note.trim().startsWith(prefix))
    .map((note) => cleanText(note, "", MAX_TEXT_LENGTH))
    .filter(Boolean)
    .slice(-MAX_RECENT_NOTES);
}

function relationshipRowForLedgerEntry(entry, legacyTargetType, worldState, extraNotes = []) {
  if (!entry) return null;
  const id = cleanId(entry.id, "");
  if (!id) return null;
  const visible = entry.visible !== false;
  if (!visible) return null;
  const targetType = legacyTargetType === "character" ? "npc" : "faction";
  const recentNotes = [
    ...notesForEntry(worldState.relationshipLedger?.recentNotes, entry.name),
    ...extraNotes
  ].filter(Boolean).slice(-MAX_RECENT_NOTES);

  return {
    id: `rel-player-${targetType}-${id}`,
    sourceType: "player",
    sourceId: playerId(worldState),
    targetType,
    targetId: id,
    relationship: entry.relationship,
    trust: trustFromRelationship(entry),
    resentment: entry.resentment,
    rivalry: Math.max(0, Math.round(entry.resentment * 0.65)),
    stance: cleanText(entry.stance, ""),
    recentIntent: cleanText(entry.recentIntent, ""),
    recentNotes,
    visibility: "relationship_visible",
    knownToPlayer: visible,
    intelConfidence: visible ? 75 : 25,
    publicSummary: `${entry.name}对玩家情分${relationshipLabel(entry.relationship)}，怨望${resentmentLabel(entry.resentment)}。`,
    lastUpdatedTurn: clampNumber(entry.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function canReuseExistingBridgeFields(row) {
  if (!isPlainObject(row)) return false;
  if (row.visibility === "hidden") return false;
  if (
    (row.visibility === "relationship_visible" || row.visibility === "role_visible") &&
    row.knownToPlayer !== true
  ) {
    return false;
  }
  return true;
}

function mergeRows(existingRows, bridgeRows) {
  const byId = new Map();

  for (const row of Array.isArray(existingRows) ? existingRows : []) {
    const id = cleanId(row?.id, "");
    if (!id) continue;
    byId.set(id, row);
  }

  for (const row of bridgeRows) {
    const id = cleanId(row?.id, "");
    if (!id) continue;
    const existing = byId.get(id) || {};
    const existingForMerge = canReuseExistingBridgeFields(existing) ? existing : {};
    const merged = { ...existingForMerge, ...row };
    if (Array.isArray(existing.recentNotes) || Array.isArray(row.recentNotes)) {
      merged.recentNotes = [
        ...(Array.isArray(existingForMerge.recentNotes) ? existingForMerge.recentNotes : []),
        ...(Array.isArray(row.recentNotes) ? row.recentNotes : [])
      ].map((note) => cleanText(note, "", MAX_TEXT_LENGTH)).filter(Boolean).slice(-MAX_RECENT_NOTES);
    }
    byId.set(id, merged);
  }

  return [...byId.values()];
}

function buildLegacyWorldPeopleBridge(worldState = {}) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const characters = Array.isArray(worldState.characters) ? worldState.characters : [];
  const npcs = characters
    .map((character) => characterNpcRow(character, ledger.characters[cleanId(character?.id, "")], worldState))
    .filter(Boolean);
  const relationships = [];

  for (const entry of Object.values(ledger.characters)) {
    const note = activeRequestFor(worldState, "character", entry.id);
    const row = relationshipRowForLedgerEntry(entry, "character", worldState, note ? [note] : []);
    if (row) relationships.push(row);
  }

  for (const entry of Object.values(ledger.factions)) {
    const note = activeRequestFor(worldState, "faction", entry.id);
    const row = relationshipRowForLedgerEntry(entry, "faction", worldState, note ? [note] : []);
    if (row) relationships.push(row);
  }

  return {
    npcs,
    households: [],
    assets: [],
    estates: [],
    relationships,
    recentNotes: []
  };
}

function normalizeWorldPeopleState(worldState = {}) {
  const source = isPlainObject(worldState.worldPeople) ? worldState.worldPeople : {};
  const bridge = buildLegacyWorldPeopleBridge(worldState);
  const candidate = normalizeWorldPeopleSchemaBundle({
    schemaVersion: WORLD_PEOPLE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    npcs: mergeRows(source.npcs, bridge.npcs),
    households: mergeRows(source.households, bridge.households),
    assets: mergeRows(source.assets, bridge.assets),
    estates: mergeRows(source.estates, bridge.estates),
    relationships: mergeRows(source.relationships, bridge.relationships),
    recentNotes: Array.isArray(source.recentNotes) ? source.recentNotes : []
  }, worldState);
  const visible = buildWorldPeopleSchemaView(candidate, worldState);

  // S51.2 stores only the safe legacy bridge projection because route payloads still
  // carry the local raw worldState for development compatibility.
  return normalizeWorldPeopleSchemaBundle({
    schemaVersion: WORLD_PEOPLE_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    npcs: visible.npcs,
    households: visible.households,
    assets: visible.assets,
    estates: visible.estates,
    relationships: visible.relationships,
    recentNotes: []
  }, worldState);
}

function createInitialWorldPeopleState(worldState = {}) {
  return normalizeWorldPeopleState({
    ...worldState,
    worldPeople: {
      schemaVersion: WORLD_PEOPLE_SCHEMA_VERSION
    }
  });
}

function ensureWorldPeopleState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.worldPeople = normalizeWorldPeopleState(worldState);
  return worldState;
}

function buildWorldPeopleView(worldState = {}) {
  return buildWorldPeopleSchemaView(normalizeWorldPeopleState(worldState), worldState);
}

function summarizeWorldPeopleForPrompt(worldState = {}) {
  return summarizeWorldPeopleSchemaForPrompt(normalizeWorldPeopleState(worldState), worldState);
}

module.exports = {
  buildWorldPeopleView,
  createInitialWorldPeopleState,
  ensureWorldPeopleState,
  normalizeWorldPeopleState,
  summarizeWorldPeopleForPrompt
};
