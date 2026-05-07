const fs = require("fs/promises");
const path = require("path");
const {
  CURRENT_STORAGE_SCHEMA_VERSION,
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

const DEFAULT_SQLITE_DATABASE_PATH = path.join(__dirname, "..", "..", "data", "qianqiu.sqlite");
const SQLITE_BUSY_TIMEOUT_MS = 5000;

function loadDatabaseSync() {
  try {
    return require("node:sqlite").DatabaseSync;
  } catch (error) {
    throw createStoreError(
      500,
      "SQLite session storage requires a Node.js runtime with node:sqlite support"
    );
  }
}

function resolveDatabasePath(databasePath) {
  const selected =
    databasePath ||
    process.env.SQLITE_DATABASE_PATH ||
    process.env.SQLITE_DB_PATH ||
    DEFAULT_SQLITE_DATABASE_PATH;
  if (selected === ":memory:") return selected;
  return path.isAbsolute(selected) ? selected : path.resolve(selected);
}

async function ensureDatabaseDir(databasePath) {
  if (databasePath === ":memory:") return;
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
}

function parseStoredJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw createStoreError(500, "Session file is corrupt");
  }
}

function rowToSessionRecord(row) {
  if (!row) return null;
  return normalizeSessionRecord(
    {
      storageSchemaVersion: row.storage_schema_version,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
      metadata: parseStoredJson(row.metadata_json),
      worldState: parseStoredJson(row.world_state_json)
    },
    row.session_id
  );
}

function runInTransaction(db, task) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = task();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

function createSqliteSessionAdapter(options = {}) {
  const databasePath = resolveDatabasePath(options.databasePath || options.dbPath);
  const sessionQueues = new Map();
  let db = null;
  let initialized = false;

  async function ensureDatabase() {
    await ensureDatabaseDir(databasePath);
    return getDatabase();
  }

  function getDatabase() {
    if (db?.isOpen) return db;

    const DatabaseSync = loadDatabaseSync();
    db = new DatabaseSync(databasePath, {
      timeout: Number(options.timeoutMs) || SQLITE_BUSY_TIMEOUT_MS
    });

    initializeDatabase(db);
    return db;
  }

  function initializeDatabase(database) {
    if (initialized) return;

    database.exec(`
      CREATE TABLE IF NOT EXISTS world_sessions (
        session_id TEXT PRIMARY KEY,
        storage_schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        player_name TEXT NOT NULL,
        role TEXT NOT NULL,
        role_label TEXT NOT NULL,
        dynasty TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        ten_day_period INTEGER NOT NULL,
        turn_count INTEGER NOT NULL,
        exam_rank TEXT,
        palace_rank TEXT,
        office_title TEXT,
        summary TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        world_state_json TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_world_sessions_updated
        ON world_sessions(updated_at DESC, created_at DESC, session_id ASC);
    `);

    if (databasePath !== ":memory:") {
      database.exec("PRAGMA journal_mode = WAL");
    }

    initialized = true;
  }

  function selectSessionRecord(sessionId) {
    const row = getDatabase()
      .prepare("SELECT * FROM world_sessions WHERE session_id = ?")
      .get(sessionId);
    if (!row) return null;
    return rowToSessionRecord(row);
  }

  function persistSessionRecord(record) {
    const metadata = record.metadata;
    getDatabase()
      .prepare(`
        INSERT OR REPLACE INTO world_sessions (
          session_id,
          storage_schema_version,
          revision,
          created_at,
          updated_at,
          player_name,
          role,
          role_label,
          dynasty,
          year,
          month,
          ten_day_period,
          turn_count,
          exam_rank,
          palace_rank,
          office_title,
          summary,
          metadata_json,
          world_state_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.sessionId,
        record.storageSchemaVersion,
        record.revision,
        record.createdAt,
        record.updatedAt,
        metadata.playerName,
        metadata.role,
        metadata.roleLabel,
        metadata.dynasty,
        metadata.year,
        metadata.month,
        metadata.tenDayPeriod,
        metadata.turnCount,
        metadata.examRank,
        metadata.palaceRank,
        metadata.officeTitle,
        metadata.summary,
        JSON.stringify(metadata),
        JSON.stringify(record.worldState)
      );
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

  async function readSessionRecordUnlocked(sessionId) {
    await ensureDatabase();
    assertSafeSessionId(sessionId);
    const migrated = selectSessionRecord(sessionId);
    if (!migrated) {
      throw createStoreError(404, "Session not found");
    }
    return migrated;
  }

  async function readSessionRecord(sessionId) {
    return withSessionLock(sessionId, () => readSessionRecordUnlocked(sessionId));
  }

  async function readSession(sessionId) {
    const { record } = await readSessionRecord(sessionId);
    return record.worldState;
  }

  async function writeSessionUnlocked(worldState, writeOptions = {}) {
    await ensureDatabase();
    validateWorldStateSessionId(worldState, worldState?.sessionId);

    return runInTransaction(getDatabase(), () => {
      let previousRecord = writeOptions.previousRecord || null;

      if (writeOptions.expectedRevision !== undefined || !previousRecord) {
        previousRecord = selectSessionRecord(worldState.sessionId)?.record || null;
      }

      if (
        writeOptions.expectedRevision !== undefined &&
        (!previousRecord || previousRecord.revision !== writeOptions.expectedRevision)
      ) {
        throw createStoreError(409, "Session revision conflict");
      }

      const now = new Date().toISOString();
      const record = createSessionRecord(worldState, {
        createdAt: previousRecord?.createdAt || now,
        updatedAt: now,
        revision: (previousRecord?.revision || 0) + 1
      });

      persistSessionRecord(record);
      return worldState;
    });
  }

  async function writeSession(worldState, writeOptions = {}) {
    validateWorldStateSessionId(worldState, worldState?.sessionId);
    return withSessionLock(worldState.sessionId, () => writeSessionUnlocked(worldState, writeOptions));
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

  async function listSessions() {
    await ensureDatabase();
    const rows = getDatabase()
      .prepare(
        `
          SELECT *
          FROM world_sessions
          ORDER BY updated_at DESC, created_at DESC, session_id ASC
        `
      )
      .all();
    const saves = [];
    const skipped = [];

    for (const row of rows) {
      try {
        const { record } = rowToSessionRecord(row);
        saves.push(toSaveListEntry(record));
      } catch (error) {
        skipped.push({
          sessionId: row.session_id,
          reason: toPublicSkippedReason(error)
        });
      }
    }

    saves.sort(compareSaveEntries);
    return { saves, skipped };
  }

  async function deleteSession(sessionId) {
    await ensureDatabase();
    assertSafeSessionId(sessionId);
    getDatabase().prepare("DELETE FROM world_sessions WHERE session_id = ?").run(sessionId);
  }

  async function importSessionRecord(inputRecord, importOptions = {}) {
    await ensureDatabase();
    const { record } = normalizeSessionRecord(inputRecord, inputRecord?.sessionId);

    return runInTransaction(getDatabase(), () => {
      const existing = selectSessionRecord(record.sessionId);
      if (existing && !importOptions.overwrite) {
        throw createStoreError(409, "Session already exists in SQLite storage");
      }
      persistSessionRecord(record);
      return record;
    });
  }

  async function cleanupSessionTempFiles() {
    return { removed: [] };
  }

  function close() {
    if (db?.isOpen) db.close();
    db = null;
    initialized = false;
  }

  return {
    name: "sqlite",
    CURRENT_STORAGE_SCHEMA_VERSION,
    SQLITE_DATABASE_PATH: databasePath,
    readSession,
    readSessionRecord,
    writeSession,
    mutateSession,
    listSessions,
    deleteSession,
    importSessionRecord,
    cleanupSessionTempFiles,
    buildSessionMetadata,
    normalizeSessionRecord,
    close
  };
}

module.exports = {
  DEFAULT_SQLITE_DATABASE_PATH,
  createSqliteSessionAdapter
};
