const MAX_LEDGER_NOTES = 12;
const MAX_TEXT_LENGTH = 120;
const MAX_RELATIONSHIP_CHANGES = 5;
const MAX_RELATIONSHIP_DELTA = 12;
const MAX_RESENTMENT_DELTA = 10;
const RELATIONSHIP_MIN = -100;
const RELATIONSHIP_MAX = 100;
const RESENTMENT_MIN = 0;
const RESENTMENT_MAX = 100;

const FACTION_LABELS = {
  eunuchs: "Eunuch faction",
  scholarOfficials: "Scholar-official faction",
  militaryLords: "Military faction"
};

const ROLE_CHARACTER_DEFAULTS = {
  scholar: {
    stance: "mentor",
    relationship: 12,
    resentment: 0,
    networkSource: "county_school",
    recentIntent: "Test the player's diligence and recommend steady study."
  },
  emperor: {
    stance: "courtier",
    relationship: 0,
    resentment: 8,
    networkSource: "court_audience",
    recentIntent: "Read imperial favor and avoid being blamed for disorder."
  },
  minister: {
    stance: "colleague",
    relationship: 4,
    resentment: 5,
    networkSource: "ministry_office",
    recentIntent: "Watch whether the player can deliver policy results."
  },
  official: {
    stance: "superior_or_peer",
    relationship: 6,
    resentment: 3,
    networkSource: "bureaucratic_posting",
    recentIntent: "Estimate the player's usefulness in local administration."
  },
  general: {
    stance: "camp_contact",
    relationship: 2,
    resentment: 5,
    networkSource: "military_camp",
    recentIntent: "Judge the player's reliability with soldiers and supplies."
  },
  magistrate: {
    stance: "local_contact",
    relationship: 4,
    resentment: 4,
    networkSource: "county_yamen",
    recentIntent: "See whether the player can settle local pressure."
  }
};

const FACTION_DEFAULTS = {
  eunuchs: {
    stance: "palace_network",
    relationship: -4,
    resentment: 14,
    networkSource: "inner_court_whispers",
    recentIntent: "Protect palace channels and test whether the player threatens them."
  },
  scholarOfficials: {
    stance: "orthodox_bureaucracy",
    relationship: 8,
    resentment: 3,
    networkSource: "examination_and_memorial_network",
    recentIntent: "Reward classical legitimacy and watch for factional recklessness."
  },
  militaryLords: {
    stance: "armed_interest",
    relationship: 0,
    resentment: 8,
    networkSource: "border_and_garrison_reports",
    recentIntent: "Seek resources while resisting civilian overreach."
  }
};

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function playerRole(worldState) {
  return worldState?.player?.role || "scholar";
}

function turnCount(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function characterDefault(character, worldState) {
  const defaults = ROLE_CHARACTER_DEFAULTS[playerRole(worldState)] || ROLE_CHARACTER_DEFAULTS.scholar;
  return {
    id: cleanText(character?.id, "unknown_character", 48),
    name: cleanText(character?.name, "Unnamed character"),
    role: cleanText(character?.role, "unknown"),
    stance: defaults.stance,
    relationship: defaults.relationship,
    resentment: defaults.resentment,
    networkSource: defaults.networkSource,
    recentIntent: defaults.recentIntent,
    visible: true,
    lastUpdatedTurn: turnCount(worldState)
  };
}

function factionDefault(factionKey, worldState) {
  const defaults = FACTION_DEFAULTS[factionKey] || {
    stance: "unknown_interest",
    relationship: 0,
    resentment: 0,
    networkSource: "unclassified_reports",
    recentIntent: "No stable intent has been recorded yet."
  };

  return {
    id: factionKey,
    name: FACTION_LABELS[factionKey] || factionKey,
    stance: defaults.stance,
    relationship: defaults.relationship,
    resentment: defaults.resentment,
    networkSource: defaults.networkSource,
    recentIntent: defaults.recentIntent,
    visible: playerRole(worldState) !== "scholar" || factionKey === "scholarOfficials",
    lastUpdatedTurn: turnCount(worldState)
  };
}

function normalizeEntry(entry, defaults) {
  const source = isPlainObject(entry) ? entry : {};
  return {
    id: defaults.id,
    name: cleanText(source.name, defaults.name),
    role: cleanText(source.role, defaults.role || ""),
    stance: cleanText(source.stance, defaults.stance),
    relationship: clampNumber(
      source.relationship,
      RELATIONSHIP_MIN,
      RELATIONSHIP_MAX,
      defaults.relationship
    ),
    resentment: clampNumber(
      source.resentment,
      RESENTMENT_MIN,
      RESENTMENT_MAX,
      defaults.resentment
    ),
    networkSource: cleanText(source.networkSource, defaults.networkSource),
    recentIntent: cleanText(source.recentIntent, defaults.recentIntent),
    visible: typeof source.visible === "boolean" ? source.visible : defaults.visible,
    lastUpdatedTurn: clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, defaults.lastUpdatedTurn)
  };
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .filter((note) => typeof note === "string" && note.trim())
    .map((note) => note.trim().slice(0, MAX_TEXT_LENGTH))
    .slice(-MAX_LEDGER_NOTES);
}

function normalizeTargetType(value) {
  return value === "character" || value === "faction" ? value : null;
}

function applyRelationshipDelta(entry, suggestion, worldState) {
  const relationshipBefore = entry.relationship;
  const resentmentBefore = entry.resentment;
  const relationshipDelta = clampNumber(
    suggestion.relationshipDelta,
    -MAX_RELATIONSHIP_DELTA,
    MAX_RELATIONSHIP_DELTA,
    0
  );
  const resentmentDelta = clampNumber(
    suggestion.resentmentDelta,
    -MAX_RESENTMENT_DELTA,
    MAX_RESENTMENT_DELTA,
    0
  );
  const stance = cleanText(suggestion.stance, "");
  const recentIntent = cleanText(suggestion.recentIntent, "");

  entry.relationship = clampNumber(
    relationshipBefore + relationshipDelta,
    RELATIONSHIP_MIN,
    RELATIONSHIP_MAX,
    relationshipBefore
  );
  entry.resentment = clampNumber(
    resentmentBefore + resentmentDelta,
    RESENTMENT_MIN,
    RESENTMENT_MAX,
    resentmentBefore
  );

  if (stance) entry.stance = stance;
  if (recentIntent) entry.recentIntent = recentIntent;

  const changed = entry.relationship !== relationshipBefore ||
    entry.resentment !== resentmentBefore ||
    Boolean(stance) ||
    Boolean(recentIntent);

  if (changed) {
    entry.lastUpdatedTurn = turnCount(worldState);
  }

  return {
    changed,
    relationshipBefore,
    resentmentBefore,
    relationshipDelta,
    resentmentDelta
  };
}

function appendRelationshipNote(ledger, entry, suggestion) {
  const reason = cleanText(suggestion.reason, "");
  const note = cleanText(suggestion.note, reason);
  if (!note) return null;

  const storedNote = cleanText(`${entry.name}: ${note}`, "", MAX_TEXT_LENGTH);
  ledger.recentNotes = normalizeNotes([...(ledger.recentNotes || []), storedNote]);
  return storedNote;
}

function normalizeRelationshipLedger(ledger, worldState = {}) {
  const source = isPlainObject(ledger) ? ledger : {};
  const sourceCharacters = isPlainObject(source.characters) ? source.characters : {};
  const sourceFactions = isPlainObject(source.factions) ? source.factions : {};
  const normalizedCharacters = {};
  const normalizedFactions = {};
  const characters = Array.isArray(worldState.characters) ? worldState.characters : [];

  for (const character of characters) {
    const id = cleanText(character?.id, "", 48);
    if (!id) continue;
    normalizedCharacters[id] = normalizeEntry(sourceCharacters[id], characterDefault(character, worldState));
  }

  for (const factionKey of Object.keys(worldState.factions || {})) {
    if (typeof worldState.factions[factionKey] !== "number") continue;
    normalizedFactions[factionKey] = normalizeEntry(sourceFactions[factionKey], factionDefault(factionKey, worldState));
  }

  return {
    characters: normalizedCharacters,
    factions: normalizedFactions,
    recentNotes: normalizeNotes(source.recentNotes)
  };
}

function createInitialRelationshipLedger(worldState) {
  return normalizeRelationshipLedger({}, worldState);
}

function ensureRelationshipLedger(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.relationshipLedger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  return worldState;
}

function applyRelationshipChanges(worldState, suggestions, options = {}) {
  if (!isPlainObject(worldState) || !Array.isArray(suggestions)) return [];

  const { allowHidden = false } = options;
  ensureRelationshipLedger(worldState);
  const ledger = worldState.relationshipLedger;
  const applied = [];

  for (const suggestion of suggestions.slice(0, MAX_RELATIONSHIP_CHANGES)) {
    if (!isPlainObject(suggestion)) continue;

    const targetType = normalizeTargetType(suggestion.targetType);
    const targetId = cleanText(suggestion.targetId, "", 48);
    if (!targetType || !targetId) continue;

    const bucket = targetType === "character" ? ledger.characters : ledger.factions;
    const entry = bucket[targetId];
    if (!entry || (!allowHidden && entry.visible === false)) continue;

    const deltaResult = applyRelationshipDelta(entry, suggestion, worldState);
    const note = appendRelationshipNote(ledger, entry, suggestion);

    if (!deltaResult.changed && !note) continue;
    if (!deltaResult.changed && note) {
      entry.lastUpdatedTurn = turnCount(worldState);
    }

    applied.push({
      targetType,
      targetId,
      name: entry.name,
      relationship: {
        before: deltaResult.relationshipBefore,
        after: entry.relationship,
        delta: entry.relationship - deltaResult.relationshipBefore
      },
      resentment: {
        before: deltaResult.resentmentBefore,
        after: entry.resentment,
        delta: entry.resentment - deltaResult.resentmentBefore
      },
      stance: entry.stance,
      recentIntent: entry.recentIntent,
      note
    });
  }

  worldState.relationshipLedger = normalizeRelationshipLedger(ledger, worldState);
  return applied;
}

function summarizeRelationshipLedger(ledger, worldState = {}, options = {}) {
  const normalized = normalizeRelationshipLedger(ledger, worldState);
  const { visibleOnly = false } = options;
  const summarizeEntry = (entry) => ({
    id: entry.id,
    name: entry.name,
    stance: entry.stance,
    relationship: entry.relationship,
    resentment: entry.resentment,
    networkSource: entry.networkSource,
    recentIntent: entry.recentIntent,
    visible: entry.visible
  });
  const isVisible = (entry) => !visibleOnly || entry.visible;

  return {
    characters: Object.values(normalized.characters).filter(isVisible).map(summarizeEntry),
    factions: Object.values(normalized.factions).filter(isVisible).map(summarizeEntry),
    recentNotes: normalized.recentNotes
  };
}

module.exports = {
  applyRelationshipChanges,
  createInitialRelationshipLedger,
  ensureRelationshipLedger,
  normalizeRelationshipLedger,
  summarizeRelationshipLedger
};
