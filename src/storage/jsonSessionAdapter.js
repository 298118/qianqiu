const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { setTimeout: delay } = require("timers/promises");
const { ensureWorldCalendarState, normalizeTenDayPeriod } = require("../game/time");

const CURRENT_STORAGE_SCHEMA_VERSION = 1;
const SESSIONS_DIR = path.join(__dirname, "..", "..", "data", "sessions");
const SAFE_SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/i;
const JSON_SESSION_FILE_PATTERN = /^([a-f0-9-]{36})\.json$/i;
const SESSION_FILE_LOCK_STALE_MS = 30000;
const SESSION_FILE_LOCK_WAIT_MS = 5000;
const SESSION_FILE_LOCK_RETRY_MS = 25;
const ATOMIC_SESSION_TEMP_FILE_PATTERN = /^([a-f0-9-]{36})\.json\..+\.tmp$/i;

const sessionQueues = new Map();

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

function sessionPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function sessionLockPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.lock`);
}

async function ensureSessionDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
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

async function readSessionFile(sessionId) {
  const filePath = sessionPath(sessionId);
  try {
    const [raw, stats] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath).catch(() => null)
    ]);
    return { raw, fileTime: stats?.mtime };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createStoreError(404, "Session not found");
    }
    throw error;
  }
}

function parseSessionJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createStoreError(500, "Session file is corrupt");
  }
}

async function readSessionRecordUnlocked(sessionId) {
  const { raw, fileTime } = await readSessionFile(sessionId);
  return normalizeSessionRecord(parseSessionJson(raw), sessionId, { fileTime });
}

async function readSessionRecord(sessionId) {
  return withSessionLock(sessionId, async () => {
    const migrated = await readSessionRecordUnlocked(sessionId);
    if (migrated.appliedMigrations.length) {
      await writeSessionUnlocked(migrated.record.worldState, {
        previousRecord: migrated.record,
        expectedRevision: migrated.record.revision
      });
      return readSessionRecordUnlocked(sessionId);
    }
    return migrated;
  });
}

async function readSession(sessionId) {
  const { record } = await readSessionRecord(sessionId);
  return record.worldState;
}

async function fsyncDirectory(dirPath) {
  let handle;
  try {
    handle = await fs.open(dirPath, "r");
    await handle.sync();
  } catch (error) {
    // Directory fsync is best-effort and is not supported on every platform.
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function sessionIdFromTempFileName(fileName) {
  const match = fileName.match(ATOMIC_SESSION_TEMP_FILE_PATTERN);
  return match ? match[1] : null;
}

async function hasFreshSessionFileLock(sessionId, now = Date.now()) {
  try {
    const stats = await fs.stat(sessionLockPath(sessionId));
    return now - stats.mtimeMs <= SESSION_FILE_LOCK_STALE_MS;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    // If the lock cannot be inspected, keep cleanup conservative and avoid
    // deleting a temp file that may belong to an in-flight atomic write.
    return true;
  }
}

async function writeFileAtomic(filePath, content) {
  const dirPath = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const tmpPath = path.join(dirPath, `${fileName}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
  let handle;

  try {
    handle = await fs.open(tmpPath, "w");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tmpPath, filePath);
    await fsyncDirectory(dirPath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function acquireSessionFileLock(sessionId) {
  const filePath = sessionLockPath(sessionId);
  const deadline = Date.now() + SESSION_FILE_LOCK_WAIT_MS;

  while (true) {
    let handle = null;
    let createdLock = false;

    try {
      handle = await fs.open(filePath, "wx");
      createdLock = true;
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8"
      );
      await handle.close();
      handle = null;
      return async () => {
        await fs.rm(filePath, { force: true });
      };
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (createdLock) await fs.rm(filePath, { force: true }).catch(() => {});

      if (error.code !== "EEXIST") throw error;

      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats || Date.now() - stats.mtimeMs > SESSION_FILE_LOCK_STALE_MS) {
        await fs.rm(filePath, { force: true }).catch(() => {});
        continue;
      }

      if (Date.now() >= deadline) {
        throw createStoreError(409, "Session file is locked");
      }

      await delay(SESSION_FILE_LOCK_RETRY_MS);
    }
  }
}

async function withSessionFileLock(sessionId, task) {
  await ensureSessionDir();
  const release = await acquireSessionFileLock(sessionId);
  try {
    return await task();
  } finally {
    await release();
  }
}

async function writeSessionRecordUnlocked(worldState, options = {}) {
  let previousRecord = options.previousRecord || null;
  if (options.expectedRevision !== undefined) {
    try {
      previousRecord = (await readSessionRecordUnlocked(worldState.sessionId)).record;
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      previousRecord = null;
    }
  } else if (!previousRecord) {
    try {
      previousRecord = (await readSessionRecordUnlocked(worldState.sessionId)).record;
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }

  if (
    options.expectedRevision !== undefined &&
    (!previousRecord || previousRecord.revision !== options.expectedRevision)
  ) {
    throw createStoreError(409, "Session revision conflict");
  }

  const now = new Date().toISOString();
  const record = createSessionRecord(worldState, {
    createdAt: previousRecord?.createdAt || now,
    updatedAt: now,
    revision: (previousRecord?.revision || 0) + 1
  });

  await writeFileAtomic(sessionPath(worldState.sessionId), `${JSON.stringify(record, null, 2)}\n`);
  return worldState;
}

async function writeSessionUnlocked(worldState, options = {}) {
  validateWorldStateSessionId(worldState, worldState.sessionId);
  return withSessionFileLock(worldState.sessionId, () => writeSessionRecordUnlocked(worldState, options));
}

async function withSessionLock(sessionId, task) {
  assertSafeSessionId(sessionId);
  const previous = sessionQueues.get(sessionId) || Promise.resolve();
  let settleQueue;
  const queueTail = new Promise((resolve) => {
    settleQueue = resolve;
  });
  const next = previous.catch(() => {}).then(() => queueTail);
  sessionQueues.set(sessionId, next);

  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    settleQueue();
    if (sessionQueues.get(sessionId) === next) {
      sessionQueues.delete(sessionId);
    }
  }
}

async function writeSession(worldState, options = {}) {
  validateWorldStateSessionId(worldState, worldState?.sessionId);
  return withSessionLock(worldState.sessionId, () => writeSessionUnlocked(worldState, options));
}

async function mutateSession(sessionId, mutator) {
  return withSessionLock(sessionId, async () => {
    const { record } = await readSessionRecordUnlocked(sessionId);
    const context = {
      record,
      skipWrite: false,
      errorAfterWrite: null
    };
    const result = await mutator(record.worldState, context);
    if (!context.skipWrite) {
      await writeSessionUnlocked(record.worldState, {
        previousRecord: record,
        expectedRevision: record.revision
      });
    }
    if (context.errorAfterWrite) throw context.errorAfterWrite;
    return result === undefined ? record.worldState : result;
  });
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

async function listSessions() {
  await ensureSessionDir();
  const files = await fs.readdir(SESSIONS_DIR);
  const saves = [];
  const skipped = [];

  for (const fileName of files) {
    const match = fileName.match(JSON_SESSION_FILE_PATTERN);
    if (!match) continue;

    try {
      const { record } = await readSessionRecordUnlocked(match[1]);
      saves.push(toSaveListEntry(record));
    } catch (error) {
      skipped.push({
        fileName,
        reason: toPublicSkippedReason(error)
      });
    }
  }

  saves.sort(compareSaveEntries);
  return { saves, skipped };
}

async function deleteSession(sessionId) {
  await fs.rm(sessionPath(sessionId), { force: true });
}

async function cleanupSessionTempFiles(options = {}) {
  await ensureSessionDir();
  const olderThanMs = Number.isFinite(Number(options.olderThanMs))
    ? Math.max(0, Number(options.olderThanMs))
    : 24 * 60 * 60 * 1000;
  const now = Date.now();
  const files = await fs.readdir(SESSIONS_DIR);
  const removed = [];

  for (const fileName of files) {
    if (!fileName.endsWith(".tmp")) continue;
    const tempSessionId = sessionIdFromTempFileName(fileName);
    if (tempSessionId && (await hasFreshSessionFileLock(tempSessionId, now))) continue;
    const filePath = path.join(SESSIONS_DIR, fileName);
    const stats = await fs.stat(filePath).catch(() => null);
    if (!stats || (olderThanMs > 0 && now - stats.mtimeMs < olderThanMs)) continue;
    await fs.rm(filePath, { force: true });
    removed.push(fileName);
  }

  return { removed };
}

function createJsonSessionAdapter() {
  return {
    name: "json",
    CURRENT_STORAGE_SCHEMA_VERSION,
    SESSIONS_DIR,
    readSession,
    readSessionRecord,
    writeSession,
    mutateSession,
    listSessions,
    deleteSession,
    cleanupSessionTempFiles,
    buildSessionMetadata,
    normalizeSessionRecord
  };
}

module.exports = {
  createJsonSessionAdapter,
  ...createJsonSessionAdapter()
};
