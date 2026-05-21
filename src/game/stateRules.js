// @ts-check

const MAX_EVENT_HISTORY = 20;
const FACTION_SCORE_RANGE = [0, 100];

const NUMERIC_RANGES = {
  "year": [1, 9999],
  "month": [1, 12],
  "tenDayPeriod": [1, 3],
  "health": [0, 100],
  "gold": [0, 100000],
  "academia": [0, 100],
  "literaryTalent": [0, 100],
  "adaptability": [0, 100],
  "mentality": [0, 100],
  "reputation": [0, 100],
  "personalPower": [0, 100],
  "courtControl": [0, 100],
  "mandate": [0, 100],
  "influence": [0, 100],
  "integrity": [0, 100],
  "superiorFavor": [0, 100],
  "peerNetwork": [0, 100],
  "performanceMerit": [0, 100],
  "promotionProspect": [0, 100],
  "impeachmentRisk": [0, 100],
  "cleanReputation": [0, 100],
  "command": [0, 100],
  "troops": [0, 1000000],
  "supply": [0, 1000000],
  "battleReputation": [0, 100],
  "scouting": [0, 100],
  "campaignRisk": [0, 100],
  "localTreasury": [0, 100000],
  "localOrder": [0, 100],
  "gentryRelations": [0, 100],
  "banditPressure": [0, 100],
  "pendingLawsuits": [0, 100],
  "corveeBurden": [0, 100],
  "waterworks": [0, 100],
  "treasury": [0, 10000000],
  "grainReserve": [0, 10000000],
  "population": [0, 100000000],
  "publicOrder": [0, 100],
  "taxRate": [0, 100],
  "corruption": [0, 100],
  "armySize": [0, 1000000],
  "armyMorale": [0, 100],
  "borderThreat": [0, 100]
};

const PROVIDER_PLAYER_PATCH_KEYS = new Set([
  "health", "gold", "academia", "literaryTalent",
  "adaptability", "mentality", "reputation",
  "studiedBooks", "connections", "personalPower",
  "courtControl", "mandate", "faction", "influence",
  "integrity", "superiorFavor", "peerNetwork", "performanceMerit",
  "promotionProspect", "impeachmentRisk", "cleanReputation",
  "command", "troops", "supply", "battleReputation",
  "scouting", "campaignRisk", "countyName", "localTreasury",
  "localOrder", "gentryRelations", "banditPressure",
  "pendingLawsuits", "corveeBurden", "waterworks"
]);

const SERVER_OWNED_PLAYER_PATCH_KEYS = new Set([
  "role", "roleLabel", "examRank", "palaceRank", "officeTitle", "position", "examHistory"
]);

const SERVER_PLAYER_PATCH_KEYS = new Set([
  ...PROVIDER_PLAYER_PATCH_KEYS,
  ...SERVER_OWNED_PLAYER_PATCH_KEYS
]);

const PROVIDER_TOP_LEVEL_PATCH_KEYS = new Set([
  "treasury", "grainReserve", "population", "publicOrder",
  "taxRate", "corruption", "armySize", "armyMorale", "borderThreat",
  "factions"
]);

const SERVER_OWNED_TOP_LEVEL_PATCH_KEYS = new Set([
  "characters", "eventHistory", "activeExam", "examCalendar", "examProcedure", "examHonorLedger", "appointmentTrack", "studyProfile", "activeNpcRequest", "npcActiveRequestLedger", "longTermEvents", "officialCareer", "officialCourtConsequences", "officialCourtResponses", "officialPostings", "roleWorldCoupling", "worldGeography", "worldEntities", "worldPeople", "worldThreads", "actorMemoryLedger", "sessionSummary", "year", "month", "tenDayPeriod"
]);

const SERVER_TOP_LEVEL_PATCH_KEYS = new Set([
  ...PROVIDER_TOP_LEVEL_PATCH_KEYS,
  ...SERVER_OWNED_TOP_LEVEL_PATCH_KEYS
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyNumericClamps(obj) {
  for (const [key, [min, max]] of Object.entries(NUMERIC_RANGES)) {
    if (key in obj && typeof obj[key] === "number") {
      obj[key] = clamp(obj[key], min, max);
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function applyStatePatch(worldState, statePatch, options = {}) {
  if (!isPlainObject(statePatch)) {
    return worldState;
  }

  const { incrementTurnCount = true, allowServerOwnedPatchKeys = false } = options;
  const allowedTopLevelPatchKeys = allowServerOwnedPatchKeys
    ? SERVER_TOP_LEVEL_PATCH_KEYS
    : PROVIDER_TOP_LEVEL_PATCH_KEYS;
  const allowedPlayerPatchKeys = allowServerOwnedPatchKeys
    ? SERVER_PLAYER_PATCH_KEYS
    : PROVIDER_PLAYER_PATCH_KEYS;

  // Apply top-level patches. Factions are merged below so unknown faction keys cannot replace the object.
  for (const key of allowedTopLevelPatchKeys) {
    if (key === "factions") continue;
    if (key in statePatch) {
      worldState[key] = statePatch[key];
    }
  }

  // Apply player patches
  if (isPlainObject(statePatch.player)) {
    if (!worldState.player) worldState.player = {};
    for (const key of allowedPlayerPatchKeys) {
      if (key in statePatch.player) {
        worldState.player[key] = statePatch.player[key];
      }
    }
  }

  // Apply faction patches
  if (isPlainObject(statePatch.factions)) {
    if (!worldState.factions) worldState.factions = {};
    const [minFactionScore, maxFactionScore] = FACTION_SCORE_RANGE;
    for (const key of Object.keys(statePatch.factions)) {
      if (typeof worldState.factions[key] === "number" && typeof statePatch.factions[key] === "number") {
        worldState.factions[key] = clamp(statePatch.factions[key], minFactionScore, maxFactionScore);
      }
    }
  }

  // Apply numeric clamps after merge
  applyNumericClamps(worldState);
  if (worldState.player) {
    applyNumericClamps(worldState.player);
  }

  // Trim event history
  if (Array.isArray(worldState.eventHistory)) {
    if (worldState.eventHistory.length > MAX_EVENT_HISTORY) {
      worldState.eventHistory = worldState.eventHistory.slice(-MAX_EVENT_HISTORY);
    }
  }

  // Player turns increment once; server-owned follow-up patches can opt out.
  if (incrementTurnCount) {
    worldState.turnCount = (worldState.turnCount || 0) + 1;
  }

  return worldState;
}

function appendEvents(worldState, events) {
  if (!Array.isArray(events)) return worldState;
  worldState.eventHistory = worldState.eventHistory || [];
  for (const event of events) {
    if (typeof event === "string" && event.trim()) {
      worldState.eventHistory.push(event.trim());
    }
  }
  // Trim after appending
  if (worldState.eventHistory.length > MAX_EVENT_HISTORY) {
    worldState.eventHistory = worldState.eventHistory.slice(-MAX_EVENT_HISTORY);
  }
  return worldState;
}

module.exports = {
  applyStatePatch,
  appendEvents,
  clamp,
  FACTION_SCORE_RANGE,
  PROVIDER_PLAYER_PATCH_KEYS,
  PROVIDER_TOP_LEVEL_PATCH_KEYS,
  NUMERIC_RANGES,
  MAX_EVENT_HISTORY
};
