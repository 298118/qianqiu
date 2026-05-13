const fs = require("node:fs/promises");
const path = require("node:path");

const {
  DEFAULT_SQLITE_DATABASE_PATH
} = require("../src/storage/sqliteSessionAdapter");
const {
  backupSqliteDatabase,
  databaseFileExists,
  exportSafeSqliteDiagnostics,
  getDerivedTableDriftStatus,
  getSqliteDatabaseStatus,
  getSqliteIndexHealth,
  loadDatabaseSync,
  redactUnsafeText,
  resolveDatabasePath,
  vacuumSqliteDatabase
} = require("../src/storage/sqliteMaintenance");
const {
  assertSafeSessionId
} = require("../src/storage/sessionRecord");

function parseArgs(argv = []) {
  const [command = "help", ...rest] = argv;
  const options = {
    backupPath: null,
    command,
    databasePath: process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    dryRun: false,
    json: true,
    outPath: null,
    overwrite: false,
    sessionId: null
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--db" || arg === "--database") {
      options.databasePath = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--backup" || arg === "--backup-path") {
      options.backupPath = readArgValue(rest, index, arg);
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
Usage: node scripts/sqliteMaintenanceTool.js <command> [options]

Commands:
  status       Report database size, migration state, and derived-table drift.
  health       Report expected SQLite tables and indexes.
  backup       Create a local SQLite backup with VACUUM INTO.
  vacuum       Run WAL checkpoint, VACUUM, and PRAGMA optimize.
  export-safe  Write a redacted diagnostic bundle.

Options:
  --db <path>            SQLite database path. Defaults to SQLITE_DATABASE_PATH or data/qianqiu.sqlite.
  --session <id>         Limit drift diagnostics to one session id.
  --dry-run              Report intended backup/vacuum work without creating or modifying files.
  --backup <path>        Backup output path for the backup command.
  --overwrite            Allow backup to replace an existing destination.
  --out <path>           For export-safe, write JSON diagnostics to this file.
  --json                 Kept for shell clarity; output is JSON by default.
`.trim());
}

async function withExistingDatabase(databasePath, task) {
  const resolvedPath = resolveDatabasePath(databasePath);
  const exists = await databaseFileExists(resolvedPath);
  if (!exists) {
    return {
      databaseExists: false,
      databasePathRedacted: true
    };
  }

  const DatabaseSync = loadDatabaseSync();
  const database = new DatabaseSync(resolvedPath);
  try {
    return {
      databaseExists: true,
      databasePathRedacted: true,
      ...(await task(database))
    };
  } finally {
    database.close();
  }
}

async function runStatus(options) {
  const result = await withExistingDatabase(options.databasePath, (database) => ({
    status: getSqliteDatabaseStatus(database),
    derivedTableDrift: getDerivedTableDriftStatus(database, options.sessionId)
  }));
  return {
    command: "status",
    ...result
  };
}

async function runHealth(options) {
  const result = await withExistingDatabase(options.databasePath, (database) => ({
    indexHealth: getSqliteIndexHealth(database)
  }));
  return {
    command: "health",
    ...result
  };
}

async function runExportSafe(options) {
  const result = await withExistingDatabase(options.databasePath, (database) => ({
    diagnostics: exportSafeSqliteDiagnostics(database, {
      sessionId: options.sessionId
    })
  }));
  const output = {
    command: "export-safe",
    ...result
  };

  if (options.outPath) {
    await fs.mkdir(path.dirname(path.resolve(options.outPath)), { recursive: true });
    await fs.writeFile(options.outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    return {
      ...output,
      wroteFile: true
    };
  }

  return output;
}

async function runSqliteMaintenanceTool(options = {}) {
  const command = options.command || "help";
  if (command === "help") return { command: "help" };
  if (command === "status") return runStatus(options);
  if (command === "health") return runHealth(options);
  if (command === "backup") {
    return backupSqliteDatabase(options.databasePath, {
      backupPath: options.backupPath,
      dryRun: options.dryRun,
      overwrite: options.overwrite
    });
  }
  if (command === "vacuum") {
    return vacuumSqliteDatabase(options.databasePath, {
      dryRun: options.dryRun
    });
  }
  if (command === "export-safe" || command === "export") {
    return runExportSafe(options);
  }
  throw new Error(`Unknown command: ${command}`);
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    printHelp(io);
    return null;
  }
  const result = await runSqliteMaintenanceTool(options);
  io.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(redactUnsafeText(error.message));
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseArgs,
  runSqliteMaintenanceTool
};
