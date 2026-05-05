const MAX_EVENT_HISTORY = 20;

const NUMERIC_RANGES = {
  "health": [0, 100],
  "gold": [0, 100000],
  "academia": [0, 100],
  "literaryTalent": [0, 100],
  "adaptability": [0, 100],
  "mentality": [0, 100],
  "reputation": [0, 100],
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

const ALLOWED_PLAYER_PATCH_KEYS = new Set([
  "health", "gold", "examRank", "academia", "literaryTalent",
  "adaptability", "mentality", "reputation", "teacher",
  "studiedBooks", "connections", "examHistory"
]);

const ALLOWED_TOP_LEVEL_PATCH_KEYS = new Set([
  "treasury", "grainReserve", "population", "publicOrder",
  "taxRate", "corruption", "armySize", "armyMorale", "borderThreat",
  "factions", "characters", "eventHistory", "activeExam", "year"
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

function applyStatePatch(worldState, statePatch) {
  if (!isPlainObject(statePatch)) {
    return worldState;
  }

  // Apply top-level numeric patches
  for (const key of ALLOWED_TOP_LEVEL_PATCH_KEYS) {
    if (key in statePatch) {
      worldState[key] = statePatch[key];
    }
  }

  // Apply player patches
  if (isPlainObject(statePatch.player)) {
    if (!worldState.player) worldState.player = {};
    for (const key of ALLOWED_PLAYER_PATCH_KEYS) {
      if (key in statePatch.player) {
        worldState.player[key] = statePatch.player[key];
      }
    }
  }

  // Apply faction patches
  if (isPlainObject(statePatch.factions)) {
    if (!worldState.factions) worldState.factions = {};
    for (const key of Object.keys(statePatch.factions)) {
      if (typeof worldState.factions[key] === "number" && typeof statePatch.factions[key] === "number") {
        worldState.factions[key] = statePatch.factions[key];
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

  // Increment turn count
  worldState.turnCount = (worldState.turnCount || 0) + 1;

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
  NUMERIC_RANGES,
  MAX_EVENT_HISTORY
};
