const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { setTimeout: delay } = require("timers/promises");
const {
  CURRENT_STORAGE_SCHEMA_VERSION,
  SAFE_SESSION_ID_PATTERN,
  assertSafeSessionId,
  buildSessionMetadata,
  compareSaveEntries,
  createSessionRecord,
  createStoreError,
  normalizeSessionRecord,
  toPublicSkippedReason,
  toSaveListEntry,
  validateWorldStateSessionId
} = require("./sessionRecord");
const {
  createAiProposalRecord,
  createAuditContext,
  createAuditEventRecord,
  normalizeAuditBatch
} = require("./sessionAudit");

const SESSIONS_DIR = path.join(__dirname, "..", "..", "data", "sessions");
const AUDIT_DIR = path.join(__dirname, "..", "..", "data", "audit");
const JSON_SESSION_FILE_PATTERN = /^([a-f0-9-]{36})\.json$/i;
const SESSION_FILE_LOCK_STALE_MS = 30000;
const SESSION_FILE_LOCK_WAIT_MS = 5000;
const SESSION_FILE_LOCK_RETRY_MS = 25;
const SESSION_FILE_RENAME_RETRY_MS = 250;
const ATOMIC_SESSION_TEMP_FILE_PATTERN = /^([a-f0-9-]{36})\.json\..+\.tmp$/i;

const sessionQueues = new Map();

function sessionPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function sessionLockPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.lock`);
}

function auditEventPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(AUDIT_DIR, `${sessionId}.event-log.jsonl`);
}

function aiProposalPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(AUDIT_DIR, `${sessionId}.ai-proposals.jsonl`);
}

async function ensureSessionDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

async function ensureAuditDir() {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
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
    await renameSessionFileWithRetry(tmpPath, filePath);
    await fsyncDirectory(dirPath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

function auditDefaultsFromRecord(record) {
  return {
    revision: record.revision,
    turnCount: record.metadata.turnCount,
    year: record.metadata.year,
    month: record.metadata.month,
    tenDayPeriod: record.metadata.tenDayPeriod
  };
}

async function appendJsonLines(filePath, records) {
  if (!records.length) return;
  await ensureAuditDir();
  await fs.appendFile(filePath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
}

async function appendAuditBatch(sessionId, batch = {}, defaults = {}) {
  const normalized = normalizeAuditBatch(sessionId, batch, defaults);
  await Promise.all([
    appendJsonLines(auditEventPath(sessionId), normalized.auditEvents),
    appendJsonLines(aiProposalPath(sessionId), normalized.aiProposals)
  ]);
  return normalized;
}

async function appendAuditBatchBestEffort(sessionId, batch = {}, defaults = {}) {
  try {
    return await appendAuditBatch(sessionId, batch, defaults);
  } catch (error) {
    // JSON audit sidecars are diagnostic. Once the session JSON has been
    // committed, do not surface a sidecar append failure as a route failure.
    return null;
  }
}

function parseAuditLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw createStoreError(500, "Audit log is corrupt");
  }
}

function normalizeListLimit(value) {
  if (value === undefined || value === null) return 1000;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 10000) : 1000;
}

async function readAuditJsonLines(filePath, options = {}) {
  const limit = normalizeListLimit(options.limit);
  let raw = "";
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const records = raw
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseAuditLine);
  return limit === 0 ? [] : records.slice(-limit);
}

async function renameSessionFileWithRetry(sourcePath, targetPath) {
  const deadline = Date.now() + SESSION_FILE_RENAME_RETRY_MS;
  let delayMs = 10;

  while (true) {
    try {
      await fs.rename(sourcePath, targetPath);
      return;
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error.code) || Date.now() >= deadline) {
        throw error;
      }
      // Windows can briefly hold the target file after another local reader or
      // indexer sees it; keep the same atomic protocol and retry only briefly.
      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, 50);
    }
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
  await appendAuditBatchBestEffort(worldState.sessionId, {
    auditEvents: options.auditEvents,
    aiProposals: options.aiProposals
  }, auditDefaultsFromRecord(record));
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
    const context = createAuditContext(record);
    const result = await mutator(record.worldState, context);
    if (!context.skipWrite) {
      await writeSessionUnlocked(record.worldState, {
        previousRecord: record,
        expectedRevision: record.revision,
        auditEvents: context.auditEvents,
        aiProposals: context.aiProposals
      });
    }
    if (context.errorAfterWrite) throw context.errorAfterWrite;
    return result === undefined ? record.worldState : result;
  });
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

async function appendAuditEvent(sessionId, event, options = {}) {
  const record = createAuditEventRecord(sessionId, event, options);
  await appendJsonLines(auditEventPath(sessionId), [record]);
  return record;
}

async function appendAiProposal(sessionId, proposal, options = {}) {
  const record = createAiProposalRecord(sessionId, proposal, options);
  await appendJsonLines(aiProposalPath(sessionId), [record]);
  return record;
}

async function listAuditEvents(sessionId, options = {}) {
  return readAuditJsonLines(auditEventPath(sessionId), options);
}

async function listAiProposals(sessionId, options = {}) {
  return readAuditJsonLines(aiProposalPath(sessionId), options);
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
    appendAuditEvent,
    appendAiProposal,
    listAuditEvents,
    listAiProposals,
    cleanupSessionTempFiles,
    buildSessionMetadata,
    normalizeSessionRecord
  };
}

module.exports = {
  createJsonSessionAdapter,
  ...createJsonSessionAdapter()
};
