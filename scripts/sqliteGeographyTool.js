const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const {
  buildWorldGeographyView,
  normalizeWorldGeographyState
} = require("../src/game/worldGeography");
const {
  DEFAULT_SQLITE_DATABASE_PATH
} = require("../src/storage/sqliteSessionAdapter");
const {
  assertSafeSessionId,
  normalizeSessionRecord
} = require("../src/storage/sessionRecord");
const {
  getGeographyRepairStatus,
  initializeGeographyTables,
  syncGeographyTables
} = require("../src/storage/sqliteGeographyTables");
const {
  runImportJsonSessionsToSqlite
} = require("./importJsonSessionsToSqlite");

const GEOGRAPHY_TABLES = Object.freeze({
  countries: "geo_countries",
  regions: "geo_regions",
  cities: "geo_cities",
  routes: "geo_routes",
  frontierZones: "geo_frontier_zones",
  officeJurisdictions: "geo_office_jurisdictions"
});

function parseArgs(argv = []) {
  const [command = "help", ...rest] = argv;
  const options = {
    command,
    databasePath: process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    dryRun: false,
    overwrite: false,
    outPath: null,
    sessionId: null
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--db" || arg === "--database") {
      options.databasePath = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--session") {
      options.sessionId = readArgValue(rest, index, arg);
      assertSafeSessionId(options.sessionId);
      index += 1;
    } else if (arg === "--out") {
      options.outPath = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--overwrite") {
      options.overwrite = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(io = console) {
  io.log(`
Usage: node scripts/sqliteGeographyTool.js <command> [options]

Commands:
  import   Import JSON saves into SQLite and sync geo_* rows.
  status   Report geography row drift without modifying SQLite.
  repair   Repair geo_* rows from world_sessions.world_state_json.
  export   Write a redacted geography debug dump.

Options:
  --db <path>          SQLite database path. Defaults to SQLITE_DATABASE_PATH or data/qianqiu.sqlite.
  --session <id>       Limit the command to one session id.
  --dry-run            For import/repair, report intended work without opening or modifying SQLite.
  --overwrite          For import, replace existing SQLite session rows.
  --out <path>         For export, write the JSON dump to this file.
  --json               Kept for shell clarity; output is JSON by default.
`.trim());
}

function resolveDatabasePath(databasePath) {
  if (databasePath === ":memory:") return databasePath;
  return path.isAbsolute(databasePath) ? databasePath : path.resolve(databasePath);
}

function loadDatabaseSync() {
  if (typeof isBuiltin === "function" && !isBuiltin("node:sqlite")) {
    throw new Error("SQLite geography tooling requires a Node.js runtime with node:sqlite support");
  }
  try {
    return require("node:sqlite").DatabaseSync;
  } catch (error) {
    throw new Error("SQLite geography tooling requires a Node.js runtime with node:sqlite support");
  }
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

function openDatabase(databasePath) {
  const DatabaseSync = loadDatabaseSync();
  return new DatabaseSync(databasePath);
}

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  );
}

function hasWorldSessionsTable(database) {
  return tableExists(database, "world_sessions");
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
  if (!hasWorldSessionsTable(database)) return [];
  if (sessionId) {
    return database
      .prepare("SELECT * FROM world_sessions WHERE session_id = ? ORDER BY updated_at DESC, session_id ASC")
      .all(sessionId);
  }
  return database
    .prepare("SELECT * FROM world_sessions ORDER BY updated_at DESC, session_id ASC")
    .all();
}

function getExpectedCounts(geography) {
  return {
    countries: geography.countries.length,
    regions: geography.regions.length,
    cities: geography.cities.length,
    routes: geography.routes.length,
    frontierZones: geography.frontierZones.length,
    officeJurisdictions: geography.officeJurisdictions.length
  };
}

function getExistingGeographyTableCounts(database, sessionId) {
  const counts = {};
  for (const [key, tableName] of Object.entries(GEOGRAPHY_TABLES)) {
    counts[key] = tableExists(database, tableName)
      ? database.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get(sessionId).count
      : 0;
  }
  return counts;
}

function getSafeGeographyRepairStatus(database, record) {
  const missingTables = Object.values(GEOGRAPHY_TABLES).filter((tableName) => !tableExists(database, tableName));
  if (!missingTables.length) {
    return getGeographyRepairStatus(database, record);
  }

  const before = JSON.stringify(record.worldState?.worldGeography || null);
  const expected = normalizeWorldGeographyState(record.worldState);
  const counts = getExistingGeographyTableCounts(database, record.sessionId);
  const expectedCounts = getExpectedCounts(expected);

  return {
    counts,
    expected,
    expectedCounts,
    missingOrMismatched: true,
    mismatchedRowIds: false,
    missingTables,
    needsRepair: true,
    staleRows: false,
    tableNeedsRepair: true,
    worldStateChanged: JSON.stringify(expected) !== before
  };
}

function toPublicRepairStatus(status) {
  return {
    counts: status.counts,
    expectedCounts: status.expectedCounts,
    missingOrMismatched: status.missingOrMismatched,
    mismatchedRowIds: status.mismatchedRowIds,
    missingTables: status.missingTables || [],
    needsRepair: status.needsRepair,
    staleRows: status.staleRows,
    tableNeedsRepair: status.tableNeedsRepair,
    worldStateChanged: status.worldStateChanged
  };
}

function runInTransaction(database, task) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = task();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  }
}

function updateStoredWorldState(database, record) {
  database
    .prepare("UPDATE world_sessions SET metadata_json = ?, world_state_json = ? WHERE session_id = ?")
    .run(JSON.stringify(record.metadata), JSON.stringify(record.worldState), record.sessionId);
}

function buildRedactedGeographyDump(database, record, status) {
  record.worldState.worldGeography = status.expected;
  const context = assemblePromptContext(record.worldState, {
    task: "world_turn",
    playerAction: "巡看天下格局与任所地理"
  });

  return {
    sessionId: record.sessionId,
    revision: record.revision,
    metadata: record.metadata,
    geographyCounts: getExistingGeographyTableCounts(database, record.sessionId),
    repairStatus: toPublicRepairStatus(status),
    worldGeographyView: buildWorldGeographyView(record.worldState),
    promptWorldGeography: context.worldGeography,
    retrievalGeography: context.retrievalContext.geography
  };
}

async function withExistingDatabase(databasePath, task) {
  const resolvedPath = resolveDatabasePath(databasePath);
  const exists = await databaseFileExists(resolvedPath);
  if (!exists) {
    return {
      databaseExists: false,
      sessions: [],
      skipped: []
    };
  }

  const database = openDatabase(resolvedPath);
  try {
    return {
      databaseExists: true,
      ...(await task(database))
    };
  } finally {
    database.close();
  }
}

async function runStatus(options) {
  const result = await withExistingDatabase(options.databasePath, async (database) => {
    const rows = selectSessionRows(database, options.sessionId);
    const sessions = [];
    const skipped = [];

    for (const row of rows) {
      try {
        const record = rowToSessionRecord(row);
        const status = getSafeGeographyRepairStatus(database, record);
        sessions.push({
          sessionId: record.sessionId,
          revision: record.revision,
          repairStatus: toPublicRepairStatus(status)
        });
      } catch (error) {
        skipped.push({ sessionId: row.session_id, reason: error.message });
      }
    }

    return {
      command: "status",
      checked: sessions.length,
      sessions,
      skipped
    };
  });
  return {
    command: "status",
    checked: 0,
    ...result
  };
}

async function runRepair(options) {
  const result = await withExistingDatabase(options.databasePath, async (database) => {
    if (!options.dryRun) initializeGeographyTables(database);
    const rows = selectSessionRows(database, options.sessionId);
    const sessions = [];
    const skipped = [];
    let repaired = 0;

    for (const row of rows) {
      try {
        const record = rowToSessionRecord(row);
        const status = getSafeGeographyRepairStatus(database, record);
        if (!options.dryRun && status.needsRepair) {
          runInTransaction(database, () => {
            record.worldState.worldGeography = status.expected;
            syncGeographyTables(database, record);
            if (status.worldStateChanged) updateStoredWorldState(database, record);
          });
          repaired += 1;
        }
        sessions.push({
          sessionId: record.sessionId,
          revision: record.revision,
          repairStatus: toPublicRepairStatus(status)
        });
      } catch (error) {
        skipped.push({ sessionId: row.session_id, reason: error.message });
      }
    }

    return {
      command: "repair",
      checked: sessions.length,
      dryRun: options.dryRun,
      repaired,
      sessions,
      skipped
    };
  });
  return {
    command: "repair",
    checked: 0,
    dryRun: options.dryRun,
    repaired: 0,
    ...result
  };
}

async function runExport(options) {
  const result = await withExistingDatabase(options.databasePath, async (database) => {
    const rows = selectSessionRows(database, options.sessionId);
    const sessions = [];
    const skipped = [];

    for (const row of rows) {
      try {
        const record = rowToSessionRecord(row);
        const status = getSafeGeographyRepairStatus(database, record);
        sessions.push(buildRedactedGeographyDump(database, record, status));
      } catch (error) {
        skipped.push({ sessionId: row.session_id, reason: error.message });
      }
    }

    return {
      command: "export",
      exported: sessions.length,
      sessions,
      skipped
    };
  });
  const normalizedResult = {
    command: "export",
    exported: 0,
    ...result
  };

  if (options.outPath) {
    await fs.mkdir(path.dirname(path.resolve(options.outPath)), { recursive: true });
    await fs.writeFile(options.outPath, `${JSON.stringify(normalizedResult, null, 2)}\n`, "utf8");
    return {
      ...normalizedResult,
      wroteFile: true
    };
  }

  return normalizedResult;
}

async function runImport(options) {
  const result = await runImportJsonSessionsToSqlite({
    databasePath: options.databasePath,
    dryRun: options.dryRun,
    overwrite: options.overwrite,
    sessionId: options.sessionId
  });

  return {
    command: "import",
    ...result
  };
}

async function runSqliteGeographyTool(options = {}) {
  const command = options.command || "help";
  if (command === "help") return { command: "help" };
  if (command === "import") return runImport(options);
  if (command === "status") return runStatus(options);
  if (command === "repair") return runRepair(options);
  if (command === "export" || command === "dump") return runExport({ ...options, command: "export" });
  throw new Error(`Unknown command: ${command}`);
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    printHelp(io);
    return null;
  }
  const result = await runSqliteGeographyTool(options);
  io.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  getSafeGeographyRepairStatus,
  main,
  parseArgs,
  runSqliteGeographyTool,
  toPublicRepairStatus
};
