const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const {
  assertSafeSessionId,
  normalizeSessionRecord
} = require("./sessionRecord");
const {
  getGeographyRepairStatus
} = require("./sqliteGeographyTables");
const {
  getPeopleRepairStatus
} = require("./sqlitePeopleTables");
const {
  getOfficialPostingRepairStatus
} = require("./sqliteOfficialPostingTables");
const {
  getEventArchiveRepairStatus
} = require("./sqliteEventArchiveTables");
const {
  getPromptRetrievalRepairStatus
} = require("./sqlitePromptRetrievalTables");
const {
  assertMigrationIntegrity,
  listAppliedMigrations,
  schemaMigrationsTableExists
} = require("./sqliteMigrations");

const EXPECTED_SQLITE_TABLES = Object.freeze([
  "schema_migrations",
  "world_sessions",
  "event_log",
  "ai_change_proposals",
  "geo_countries",
  "geo_regions",
  "geo_cities",
  "geo_routes",
  "geo_frontier_zones",
  "geo_office_jurisdictions",
  "people_npcs",
  "people_households",
  "people_assets",
  "people_estates",
  "people_relationships",
  "office_bureaus",
  "office_catalog",
  "office_city_jurisdictions",
  "office_postings",
  "office_assessments",
  "office_transfers",
  "event_archive_index",
  "prompt_retrieval_index"
]);

const EXPECTED_SQLITE_INDEXES = Object.freeze([
  "idx_schema_migrations_version",
  "idx_world_sessions_updated",
  "idx_event_log_session_created",
  "idx_ai_change_proposals_session_created",
  "idx_geo_countries_session_visibility",
  "idx_geo_regions_session_visibility",
  "idx_geo_cities_session_visibility",
  "idx_geo_routes_session_visibility",
  "idx_geo_frontier_zones_session_visibility",
  "idx_geo_office_jurisdictions_session_visibility",
  "idx_people_npcs_session_visibility",
  "idx_people_npcs_household",
  "idx_people_households_session_visibility",
  "idx_people_households_seat_city",
  "idx_people_assets_session_visibility",
  "idx_people_assets_owner",
  "idx_people_estates_session_visibility",
  "idx_people_estates_owner",
  "idx_people_relationships_session_visibility",
  "idx_people_relationships_source",
  "idx_people_relationships_target",
  "idx_office_bureaus_session_visibility",
  "idx_office_catalog_session_visibility",
  "idx_office_catalog_bureau",
  "idx_office_city_jurisdictions_session_visibility",
  "idx_office_city_jurisdictions_city",
  "idx_office_postings_session_visibility",
  "idx_office_postings_holder",
  "idx_office_postings_review",
  "idx_office_assessments_session_visibility",
  "idx_office_assessments_posting",
  "idx_office_transfers_session_visibility",
  "idx_office_transfers_holder",
  "idx_event_archive_index_session_sort",
  "idx_event_archive_index_session_source",
  "idx_prompt_retrieval_session_domain",
  "idx_prompt_retrieval_session_revision"
]);

const DERIVED_TABLE_GROUPS = Object.freeze({
  geography: [
    "geo_countries",
    "geo_regions",
    "geo_cities",
    "geo_routes",
    "geo_frontier_zones",
    "geo_office_jurisdictions"
  ],
  people: [
    "people_npcs",
    "people_households",
    "people_assets",
    "people_estates",
    "people_relationships"
  ],
  officialPostings: [
    "office_bureaus",
    "office_catalog",
    "office_city_jurisdictions",
    "office_postings",
    "office_assessments",
    "office_transfers"
  ],
  eventArchive: ["event_archive_index"],
  promptRetrieval: ["prompt_retrieval_index"]
});

function loadDatabaseSync() {
  if (typeof isBuiltin === "function" && !isBuiltin("node:sqlite")) {
    throw new Error("SQLite maintenance tooling requires a Node.js runtime with node:sqlite support");
  }
  try {
    return require("node:sqlite").DatabaseSync;
  } catch (error) {
    throw new Error("SQLite maintenance tooling requires a Node.js runtime with node:sqlite support");
  }
}

function resolveDatabasePath(databasePath) {
  if (databasePath === ":memory:") return databasePath;
  return path.isAbsolute(databasePath) ? databasePath : path.resolve(databasePath);
}

async function databaseFileExists(databasePath) {
  if (databasePath === ":memory:") return true;
  try {
    await fs.access(databasePath);
    return true;
  } catch (error) {
    return false;
  }
}

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  );
}

function indexExists(database, indexName) {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(indexName)
  );
}

function readPragmaValue(database, pragmaName) {
  const row = database.prepare(`PRAGMA ${pragmaName}`).get();
  if (!row) return null;
  const [firstKey] = Object.keys(row);
  return row[firstKey];
}

function countRows(database, tableName) {
  if (!tableExists(database, tableName)) return 0;
  return database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function readStoredJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`SQLite ${label} JSON is corrupt`);
  }
}

function rowToSessionRecord(row) {
  return normalizeSessionRecord(
    {
      storageSchemaVersion: row.storage_schema_version,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
      metadata: readStoredJson(row.metadata_json, "metadata"),
      worldState: readStoredJson(row.world_state_json, "world_state")
    },
    row.session_id
  ).record;
}

function selectSessionRows(database, sessionId = null) {
  if (!tableExists(database, "world_sessions")) return [];
  if (sessionId) {
    assertSafeSessionId(sessionId);
    return database
      .prepare("SELECT * FROM world_sessions WHERE session_id = ? ORDER BY updated_at DESC, session_id ASC")
      .all(sessionId);
  }
  return database
    .prepare("SELECT * FROM world_sessions ORDER BY updated_at DESC, session_id ASC")
    .all();
}

function getSqliteDatabaseStatus(database) {
  const pageCount = Number(readPragmaValue(database, "page_count")) || 0;
  const pageSize = Number(readPragmaValue(database, "page_size")) || 0;
  const freelistCount = Number(readPragmaValue(database, "freelist_count")) || 0;
  const appliedMigrations = listAppliedMigrations(database);
  let migrationIntegrity = {
    ok: false,
    reason: "schema_migrations table is missing"
  };

  if (schemaMigrationsTableExists(database)) {
    try {
      migrationIntegrity = assertMigrationIntegrity(database);
    } catch (error) {
      migrationIntegrity = {
        ok: false,
        reason: redactUnsafeText(error.message)
      };
    }
  }

  const approximateBytes = pageCount * pageSize;
  const freeBytes = freelistCount * pageSize;

  return sanitizeDiagnosticValue({
    databasePathRedacted: true,
    journalMode: String(readPragmaValue(database, "journal_mode") || "unknown"),
    size: {
      approximateBytes,
      freeBytes,
      freelistCount,
      needsVacuum: freeBytes > Math.max(1024 * 1024, approximateBytes * 0.1),
      pageCount,
      pageSize
    },
    counts: {
      aiChangeProposals: countRows(database, "ai_change_proposals"),
      auditEvents: countRows(database, "event_log"),
      sessions: countRows(database, "world_sessions"),
      sqliteIndexes: database
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index'")
        .get().count,
      sqliteTables: database
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'")
        .get().count
    },
    migrations: {
      appliedCount: appliedMigrations.filter((row) => row.status === "applied").length,
      highestSchemaVersion: appliedMigrations.reduce(
        (highest, row) => Math.max(highest, Number(row.schemaVersion) || 0),
        0
      ),
      integrity: migrationIntegrity,
      tableExists: schemaMigrationsTableExists(database)
    }
  });
}

function getSqliteIndexHealth(database) {
  const missingTables = EXPECTED_SQLITE_TABLES.filter((tableName) => !tableExists(database, tableName));
  const missingIndexes = EXPECTED_SQLITE_INDEXES.filter((indexName) => !indexExists(database, indexName));

  return sanitizeDiagnosticValue({
    ok: missingTables.length === 0 && missingIndexes.length === 0,
    checkedTables: EXPECTED_SQLITE_TABLES.length,
    checkedIndexes: EXPECTED_SQLITE_INDEXES.length,
    missingTables,
    missingIndexes,
    presentTableCount: EXPECTED_SQLITE_TABLES.length - missingTables.length,
    presentIndexCount: EXPECTED_SQLITE_INDEXES.length - missingIndexes.length
  });
}

function missingTables(database, tableNames) {
  return tableNames.filter((tableName) => !tableExists(database, tableName));
}

function toPublicDriftStatus(status) {
  return sanitizeDiagnosticValue({
    count: status.count,
    counts: status.counts,
    contentMismatches: Boolean(status.contentMismatches),
    expectedCount: status.expectedCount,
    expectedCounts: status.expectedCounts,
    missingOrMismatched: Boolean(status.missingOrMismatched),
    mismatchedRowIds: Boolean(status.mismatchedRowIds),
    needsRepair: Boolean(status.needsRepair),
    staleRows: Boolean(status.staleRows),
    tableNeedsRepair: Boolean(status.tableNeedsRepair),
    worldStateChanged: Boolean(status.worldStateChanged)
  });
}

function getDomainDriftStatus(database, record, domainKey, statusBuilder) {
  const missing = missingTables(database, DERIVED_TABLE_GROUPS[domainKey]);
  if (missing.length) {
    return {
      missingTables: missing,
      needsRepair: true,
      tableNeedsRepair: true
    };
  }
  return toPublicDriftStatus(statusBuilder(database, record));
}

function getSessionDerivedDriftStatus(database, record) {
  const domains = {
    geography: getDomainDriftStatus(database, record, "geography", getGeographyRepairStatus),
    people: getDomainDriftStatus(database, record, "people", getPeopleRepairStatus),
    officialPostings: getDomainDriftStatus(database, record, "officialPostings", getOfficialPostingRepairStatus),
    eventArchive: getDomainDriftStatus(database, record, "eventArchive", getEventArchiveRepairStatus),
    promptRetrieval: getDomainDriftStatus(database, record, "promptRetrieval", getPromptRetrievalRepairStatus)
  };

  return {
    sessionId: record.sessionId,
    revision: record.revision,
    domains,
    needsRepair: Object.values(domains).some((domain) => domain.needsRepair)
  };
}

function getDerivedTableDriftStatus(database, sessionId = null) {
  const rows = selectSessionRows(database, sessionId);
  const sessions = [];
  const skipped = [];

  for (const row of rows) {
    try {
      sessions.push(getSessionDerivedDriftStatus(database, rowToSessionRecord(row)));
    } catch (error) {
      skipped.push({
        sessionId: row.session_id,
        reason: redactUnsafeText(error.message)
      });
    }
  }

  return sanitizeDiagnosticValue({
    checked: sessions.length,
    missingWorldSessionsTable: !tableExists(database, "world_sessions"),
    needsRepair: sessions.some((session) => session.needsRepair),
    sessions,
    skipped
  });
}

function quoteSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function resolveBackupPath(databasePath, options = {}) {
  if (options.backupPath) return resolveDatabasePath(options.backupPath);
  const timestamp = String(options.timestamp || new Date().toISOString())
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  return `${databasePath}.backup-${timestamp}`;
}

async function backupSqliteDatabase(databasePath, options = {}) {
  const resolvedPath = resolveDatabasePath(databasePath);
  if (resolvedPath === ":memory:") {
    throw new Error("SQLite backup requires a file-backed database");
  }
  const exists = await databaseFileExists(resolvedPath);
  const result = {
    backupPathRedacted: true,
    command: "backup",
    databaseExists: exists,
    databasePathRedacted: true,
    dryRun: Boolean(options.dryRun)
  };

  if (!exists) {
    return sanitizeDiagnosticValue({
      ...result,
      backupCreated: false,
      wouldWriteBackup: false
    });
  }

  const sourceStat = await fs.stat(resolvedPath);
  const backupPath = resolveBackupPath(resolvedPath, options);
  if (backupPath === resolvedPath) {
    throw new Error("SQLite backup destination must differ from the source database");
  }

  if (options.dryRun) {
    return sanitizeDiagnosticValue({
      ...result,
      backupCreated: false,
      sourceSizeBytes: sourceStat.size,
      wouldWriteBackup: true
    });
  }

  const backupExists = await databaseFileExists(backupPath);
  if (backupExists && !options.overwrite) {
    throw new Error("SQLite backup destination already exists; pass overwrite to replace it");
  }
  if (backupExists && options.overwrite) {
    await fs.rm(backupPath, { force: true });
  }

  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  const DatabaseSync = loadDatabaseSync();
  const database = new DatabaseSync(resolvedPath);
  try {
    database.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`);
  } finally {
    database.close();
  }
  const backupStat = await fs.stat(backupPath);

  return sanitizeDiagnosticValue({
    ...result,
    backupCreated: true,
    backupSizeBytes: backupStat.size,
    sourceSizeBytes: sourceStat.size,
    wouldWriteBackup: false
  });
}

async function vacuumSqliteDatabase(databasePath, options = {}) {
  const resolvedPath = resolveDatabasePath(databasePath);
  if (resolvedPath === ":memory:") {
    throw new Error("SQLite VACUUM requires a file-backed database");
  }
  const exists = await databaseFileExists(resolvedPath);
  const result = {
    command: "vacuum",
    databaseExists: exists,
    databasePathRedacted: true,
    dryRun: Boolean(options.dryRun)
  };

  if (!exists) {
    return sanitizeDiagnosticValue({
      ...result,
      vacuumed: false,
      wouldVacuum: false
    });
  }

  const before = await fs.stat(resolvedPath);
  if (options.dryRun) {
    return sanitizeDiagnosticValue({
      ...result,
      beforeBytes: before.size,
      vacuumed: false,
      wouldVacuum: true
    });
  }

  const DatabaseSync = loadDatabaseSync();
  const database = new DatabaseSync(resolvedPath);
  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    database.exec("VACUUM");
    database.exec("PRAGMA optimize");
  } finally {
    database.close();
  }
  const after = await fs.stat(resolvedPath);

  return sanitizeDiagnosticValue({
    ...result,
    afterBytes: after.size,
    beforeBytes: before.size,
    vacuumed: true,
    wouldVacuum: false
  });
}

function exportSafeSqliteDiagnostics(database, options = {}) {
  return sanitizeDiagnosticValue({
    command: "export-safe",
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: getSqliteDatabaseStatus(database),
    indexHealth: getSqliteIndexHealth(database),
    derivedTableDrift: getDerivedTableDriftStatus(database, options.sessionId || null)
  });
}

function redactUnsafeText(value) {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted-key]")
    .replace(/tp-[A-Za-z0-9_-]{8,}/g, "[redacted-key]")
    .replace(/file:\/\/[^\s"',}]+/g, "[redacted-path]")
    .replace(/[A-Za-z]:\\[^\s"',}]+/g, "[redacted-path]")
    .replace(/[A-Za-z]:\/[^\s"',}]+/g, "[redacted-path]")
    .replace(/(^|[\s"'(:=])\/(?!\/)[^\s"',)}]+/g, "$1[redacted-path]")
    .replace(/\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|SQLITE_DATABASE_PATH|SQLITE_DB_PATH)\b/g, "[redacted-env]")
    .replace(/\b(?:world_state_json|proposal_json|accepted_json|related_json|applied_changes_json)\b/g, "[redacted-raw-json]")
    .replace(/\b(?:event_log|ai_change_proposals)\b/g, "[redacted-raw-table]")
    .replace(/\b(?:hiddenNotes|hiddenIntent|hidden_notes_json|private)\b/g, "[redacted-private-field]")
    .replace(/SEALED_[A-Z0-9_]+/g, "[redacted]");
}

function sanitizeDiagnosticValue(value) {
  if (typeof value === "string") return redactUnsafeText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeDiagnosticValue(entry));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).reduce((sanitized, key) => {
    sanitized[key] = sanitizeDiagnosticValue(value[key]);
    return sanitized;
  }, {});
}

module.exports = {
  EXPECTED_SQLITE_INDEXES,
  EXPECTED_SQLITE_TABLES,
  backupSqliteDatabase,
  databaseFileExists,
  exportSafeSqliteDiagnostics,
  getDerivedTableDriftStatus,
  getSqliteDatabaseStatus,
  getSqliteIndexHealth,
  loadDatabaseSync,
  redactUnsafeText,
  resolveDatabasePath,
  sanitizeDiagnosticValue,
  vacuumSqliteDatabase
};
