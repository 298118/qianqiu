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
const {
  createAiProposalRecord,
  createAuditContext,
  createAuditEventRecord,
  normalizeAuditBatch
} = require("./sessionAudit");
const {
  deleteGeographyRows,
  ensureGeographyTablesForRecord,
  initializeGeographyTables,
  normalizeRecordWorldGeography,
  syncGeographyTables
} = require("./sqliteGeographyTables");
const {
  deletePeopleRows,
  ensurePeopleTablesForRecord,
  initializePeopleTables,
  normalizeRecordWorldPeople,
  syncPeopleTables
} = require("./sqlitePeopleTables");
const {
  deleteOfficialPostingRows,
  ensureOfficialPostingTablesForRecord,
  initializeOfficialPostingTables,
  normalizeRecordOfficialPostings,
  syncOfficialPostingTables
} = require("./sqliteOfficialPostingTables");
const {
  deleteEventArchiveRows,
  ensureEventArchiveTablesForRecord,
  initializeEventArchiveTables,
  syncEventArchiveTables
} = require("./sqliteEventArchiveTables");

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

function parseStoredAuditJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw createStoreError(500, "Audit log is corrupt");
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

      CREATE TABLE IF NOT EXISTS event_log (
        event_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        audit_schema_version INTEGER NOT NULL,
        revision INTEGER,
        turn_count INTEGER,
        year INTEGER,
        month INTEGER,
        ten_day_period INTEGER,
        scene_cadence TEXT,
        source_system TEXT NOT NULL,
        event_type TEXT NOT NULL,
        visibility TEXT NOT NULL,
        summary TEXT NOT NULL,
        related_json TEXT NOT NULL,
        applied_changes_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_event_log_session_created
        ON event_log(session_id, created_at, event_id);

      CREATE TABLE IF NOT EXISTS ai_change_proposals (
        proposal_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        audit_schema_version INTEGER NOT NULL,
        revision INTEGER,
        turn_count INTEGER,
        year INTEGER,
        month INTEGER,
        ten_day_period INTEGER,
        scene_cadence TEXT,
        provider TEXT NOT NULL,
        prompt_pack TEXT,
        proposal_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        proposal_json TEXT NOT NULL,
        accepted_json TEXT NOT NULL,
        rejected_reasons_json TEXT NOT NULL,
        applied_event_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_ai_change_proposals_session_created
        ON ai_change_proposals(session_id, created_at, proposal_id);
    `);
    initializeGeographyTables(database);
    initializePeopleTables(database);
    initializeOfficialPostingTables(database);
    initializeEventArchiveTables(database);

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

  function persistSessionRecord(record, options = {}) {
    normalizeRecordWorldGeography(record);
    normalizeRecordWorldPeople(record);
    normalizeRecordOfficialPostings(record);
    const metadata = record.metadata;
    getDatabase()
      .prepare(`
        INSERT INTO world_sessions (
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
        ON CONFLICT(session_id) DO UPDATE SET
          storage_schema_version = excluded.storage_schema_version,
          revision = excluded.revision,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          player_name = excluded.player_name,
          role = excluded.role,
          role_label = excluded.role_label,
          dynasty = excluded.dynasty,
          year = excluded.year,
          month = excluded.month,
          ten_day_period = excluded.ten_day_period,
          turn_count = excluded.turn_count,
          exam_rank = excluded.exam_rank,
          palace_rank = excluded.palace_rank,
          office_title = excluded.office_title,
          summary = excluded.summary,
          metadata_json = excluded.metadata_json,
          world_state_json = excluded.world_state_json
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
    syncGeographyTables(getDatabase(), record);
    syncPeopleTables(getDatabase(), record, options.peopleEventLinks);
    syncOfficialPostingTables(getDatabase(), record);
    syncEventArchiveTables(getDatabase(), record);
  }

  function updateSessionRecordPayload(record) {
    getDatabase()
      .prepare(`
        UPDATE world_sessions
        SET metadata_json = ?,
            world_state_json = ?
        WHERE session_id = ?
      `)
      .run(
        JSON.stringify(record.metadata),
        JSON.stringify(record.worldState),
        record.sessionId
      );
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

  function insertAuditEvents(records) {
    if (!records.length) return;
    const statement = getDatabase().prepare(`
      INSERT INTO event_log (
        event_id,
        session_id,
        audit_schema_version,
        revision,
        turn_count,
        year,
        month,
        ten_day_period,
        scene_cadence,
        source_system,
        event_type,
        visibility,
        summary,
        related_json,
        applied_changes_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const record of records) {
      statement.run(
        record.eventId,
        record.sessionId,
        record.auditSchemaVersion,
        record.revision,
        record.turnCount,
        record.year,
        record.month,
        record.tenDayPeriod,
        record.sceneCadence,
        record.sourceSystem,
        record.eventType,
        record.visibility,
        record.summary,
        JSON.stringify(record.related),
        JSON.stringify(record.appliedChanges),
        record.createdAt
      );
    }
  }

  function insertAiProposals(records) {
    if (!records.length) return;
    const statement = getDatabase().prepare(`
      INSERT INTO ai_change_proposals (
        proposal_id,
        session_id,
        audit_schema_version,
        revision,
        turn_count,
        year,
        month,
        ten_day_period,
        scene_cadence,
        provider,
        prompt_pack,
        proposal_kind,
        status,
        proposal_json,
        accepted_json,
        rejected_reasons_json,
        applied_event_ids_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const record of records) {
      statement.run(
        record.proposalId,
        record.sessionId,
        record.auditSchemaVersion,
        record.revision,
        record.turnCount,
        record.year,
        record.month,
        record.tenDayPeriod,
        record.sceneCadence,
        record.provider,
        record.promptPack,
        record.proposalKind,
        record.status,
        JSON.stringify(record.proposal),
        JSON.stringify(record.accepted),
        JSON.stringify(record.rejectedReasons),
        JSON.stringify(record.appliedEventIds),
        record.createdAt
      );
    }
  }

  function insertAuditBatch(sessionId, batch = {}, defaults = {}) {
    const normalized = normalizeAuditBatch(sessionId, batch, defaults);
    insertAuditEvents(normalized.auditEvents);
    insertAiProposals(normalized.aiProposals);
    return normalized;
  }

  function rowToAuditEvent(row) {
    return {
      auditSchemaVersion: row.audit_schema_version,
      eventId: row.event_id,
      sessionId: row.session_id,
      revision: row.revision,
      turnCount: row.turn_count,
      year: row.year,
      month: row.month,
      tenDayPeriod: row.ten_day_period,
      sceneCadence: row.scene_cadence,
      sourceSystem: row.source_system,
      eventType: row.event_type,
      visibility: row.visibility,
      summary: row.summary,
      related: parseStoredAuditJson(row.related_json),
      appliedChanges: parseStoredAuditJson(row.applied_changes_json),
      createdAt: row.created_at
    };
  }

  function rowToAiProposal(row) {
    return {
      auditSchemaVersion: row.audit_schema_version,
      proposalId: row.proposal_id,
      sessionId: row.session_id,
      revision: row.revision,
      turnCount: row.turn_count,
      year: row.year,
      month: row.month,
      tenDayPeriod: row.ten_day_period,
      sceneCadence: row.scene_cadence,
      provider: row.provider,
      promptPack: row.prompt_pack,
      proposalKind: row.proposal_kind,
      status: row.status,
      proposal: parseStoredAuditJson(row.proposal_json),
      accepted: parseStoredAuditJson(row.accepted_json),
      rejectedReasons: parseStoredAuditJson(row.rejected_reasons_json),
      appliedEventIds: parseStoredAuditJson(row.applied_event_ids_json),
      createdAt: row.created_at
    };
  }

  function normalizeListLimit(value) {
    if (value === undefined || value === null) return 1000;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 10000) : 1000;
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
    return runInTransaction(getDatabase(), () => {
      const migrated = selectSessionRecord(sessionId);
      if (!migrated) {
        throw createStoreError(404, "Session not found");
      }
      const repairedGeography = ensureGeographyTablesForRecord(getDatabase(), migrated.record);
      const repairedPeople = ensurePeopleTablesForRecord(getDatabase(), migrated.record);
      const repaired = repairedGeography || repairedPeople;
      const repairedOfficialPostings = ensureOfficialPostingTablesForRecord(getDatabase(), migrated.record);
      ensureEventArchiveTablesForRecord(getDatabase(), migrated.record);
      if (repaired || repairedOfficialPostings) updateSessionRecordPayload(migrated.record);
      return migrated;
    });
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

      persistSessionRecord(record, {
        peopleEventLinks: writeOptions.peopleEventLinks
      });
      insertAuditBatch(worldState.sessionId, {
        auditEvents: writeOptions.auditEvents,
        aiProposals: writeOptions.aiProposals
      }, auditDefaultsFromRecord(record));
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
      const context = createAuditContext(record);
      const result = await mutator(record.worldState, context);
      if (!context.skipWrite) {
      await writeSessionUnlocked(record.worldState, {
        previousRecord: record,
        expectedRevision: record.revision,
        auditEvents: context.auditEvents,
        aiProposals: context.aiProposals,
        peopleEventLinks: context.peopleEventLinks
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
    runInTransaction(getDatabase(), () => {
      deleteGeographyRows(getDatabase(), sessionId);
      deletePeopleRows(getDatabase(), sessionId);
      deleteOfficialPostingRows(getDatabase(), sessionId);
      deleteEventArchiveRows(getDatabase(), sessionId);
      getDatabase().prepare("DELETE FROM world_sessions WHERE session_id = ?").run(sessionId);
    });
  }

  async function appendAuditEvent(sessionId, event, options = {}) {
    await ensureDatabase();
    const record = createAuditEventRecord(sessionId, event, options);
    runInTransaction(getDatabase(), () => insertAuditEvents([record]));
    return record;
  }

  async function appendAiProposal(sessionId, proposal, options = {}) {
    await ensureDatabase();
    const record = createAiProposalRecord(sessionId, proposal, options);
    runInTransaction(getDatabase(), () => insertAiProposals([record]));
    return record;
  }

  async function listAuditEvents(sessionId, options = {}) {
    await ensureDatabase();
    assertSafeSessionId(sessionId);
    const limit = normalizeListLimit(options.limit);
    if (limit === 0) return [];
    const rows = getDatabase()
      .prepare(`
        SELECT *
        FROM event_log
        WHERE session_id = ?
        ORDER BY created_at DESC, event_id DESC
        LIMIT ?
      `)
      .all(sessionId, limit);
    return rows.reverse().map(rowToAuditEvent);
  }

  async function listAiProposals(sessionId, options = {}) {
    await ensureDatabase();
    assertSafeSessionId(sessionId);
    const limit = normalizeListLimit(options.limit);
    if (limit === 0) return [];
    const rows = getDatabase()
      .prepare(`
        SELECT *
        FROM ai_change_proposals
        WHERE session_id = ?
        ORDER BY created_at DESC, proposal_id DESC
        LIMIT ?
      `)
      .all(sessionId, limit);
    return rows.reverse().map(rowToAiProposal);
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
    appendAuditEvent,
    appendAiProposal,
    listAuditEvents,
    listAiProposals,
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
