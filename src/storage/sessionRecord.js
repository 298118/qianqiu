const { ensureWorldCalendarState, normalizeTenDayPeriod } = require("../game/time");

const CURRENT_STORAGE_SCHEMA_VERSION = 1;
const SAFE_SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/i;

function createStoreError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertSafeSessionId(sessionId) {
  if (!SAFE_SESSION_ID_PATTERN.test(sessionId)) {
    throw createStoreError(400, "Invalid session id");
  }
}

function isIsoString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function toIsoString(value, fallback) {
  if (isIsoString(value)) return new Date(value).toISOString();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return fallback;
}

function toNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildSessionSummary(worldState) {
  const player = worldState?.player || {};
  return (
    player.officeTitle ||
    player.position ||
    player.examRank ||
    player.roleLabel ||
    player.role ||
    "未定"
  );
}

function buildSessionMetadata(worldState) {
  const player = worldState?.player || {};
  return {
    playerName: player.name || "未定",
    role: player.role || "scholar",
    roleLabel: player.roleLabel || player.role || "书生",
    dynasty: worldState?.dynasty || "明",
    year: toNonNegativeInteger(worldState?.year, 1644),
    month: toNonNegativeInteger(worldState?.month, 1),
    tenDayPeriod: normalizeTenDayPeriod(worldState?.tenDayPeriod),
    turnCount: toNonNegativeInteger(worldState?.turnCount, 0),
    examRank: player.examRank || null,
    palaceRank: player.palaceRank || null,
    officeTitle: player.officeTitle || null,
    summary: buildSessionSummary(worldState)
  };
}

function validateWorldStateSessionId(worldState, expectedSessionId) {
  if (!worldState || typeof worldState !== "object" || Array.isArray(worldState)) {
    throw createStoreError(500, "Session file does not contain a valid world state");
  }
  assertSafeSessionId(worldState.sessionId);
  if (expectedSessionId && worldState.sessionId !== expectedSessionId) {
    throw createStoreError(409, "Session id mismatch");
  }
}

function createSessionRecord(worldState, options = {}) {
  const now = new Date().toISOString();
  const createdAt = toIsoString(options.createdAt, now);
  const updatedAt = toIsoString(options.updatedAt, now);
  const revision = toNonNegativeInteger(options.revision, 1);

  validateWorldStateSessionId(worldState, worldState.sessionId);
  ensureWorldCalendarState(worldState);

  return {
    storageSchemaVersion: CURRENT_STORAGE_SCHEMA_VERSION,
    sessionId: worldState.sessionId,
    createdAt,
    updatedAt,
    revision,
    metadata: buildSessionMetadata(worldState),
    worldState
  };
}

function normalizeSessionRecord(parsed, expectedSessionId, options = {}) {
  const fileTime = toIsoString(options.fileTime, new Date().toISOString());

  if (parsed?.storageSchemaVersion === undefined) {
    validateWorldStateSessionId(parsed, expectedSessionId);
    return {
      record: createSessionRecord(parsed, {
        createdAt: fileTime,
        updatedAt: fileTime,
        revision: 0
      }),
      appliedMigrations: ["legacy_raw_world_state"]
    };
  }

  if (parsed.storageSchemaVersion > CURRENT_STORAGE_SCHEMA_VERSION) {
    throw createStoreError(400, "Unsupported session storage schema version");
  }

  if (parsed.storageSchemaVersion !== CURRENT_STORAGE_SCHEMA_VERSION) {
    throw createStoreError(400, "Unsupported session storage schema version");
  }

  assertSafeSessionId(parsed.sessionId);
  if (expectedSessionId && parsed.sessionId !== expectedSessionId) {
    throw createStoreError(409, "Session id mismatch");
  }

  const worldState = parsed.worldState;
  validateWorldStateSessionId(worldState, parsed.sessionId);

  const createdAt = toIsoString(parsed.createdAt, fileTime);
  const updatedAt = toIsoString(parsed.updatedAt, createdAt);
  const revision = Math.max(1, toNonNegativeInteger(parsed.revision, 1));

  return {
    record: createSessionRecord(worldState, {
      createdAt,
      updatedAt,
      revision
    }),
    appliedMigrations: []
  };
}

function toSaveListEntry(record) {
  return {
    sessionId: record.sessionId,
    storageSchemaVersion: record.storageSchemaVersion,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...record.metadata
  };
}

function compareSaveEntries(a, b) {
  const updatedDiff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  const createdDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return a.sessionId.localeCompare(b.sessionId);
}

function toPublicSkippedReason(error) {
  if (error.statusCode === 400) return "Invalid session file";
  if (error.statusCode === 409) return "Unsupported or mismatched session file";
  if (error.statusCode === 500) return "Session file is corrupt";
  return "Unable to read session";
}

module.exports = {
  CURRENT_STORAGE_SCHEMA_VERSION,
  SAFE_SESSION_ID_PATTERN,
  assertSafeSessionId,
  buildSessionMetadata,
  compareSaveEntries,
  createSessionRecord,
  createStoreError,
  normalizeSessionRecord,
  toIsoString,
  toNonNegativeInteger,
  toPublicSkippedReason,
  toSaveListEntry,
  validateWorldStateSessionId
};
