const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const {
  DEFAULT_SQLITE_DATABASE_PATH,
  createSqliteSessionAdapter
} = require("../src/storage/sqliteSessionAdapter");
const { assertSafeSessionId } = require("../src/storage/sessionRecord");

function parseArgs(argv) {
  const options = {
    databasePath: process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    overwrite: false,
    dryRun: false,
    sessionId: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db" || arg === "--database") {
      options.databasePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--session") {
      options.sessionId = readArgValue(argv, index, arg);
      assertSafeSessionId(options.sessionId);
      index += 1;
    } else if (arg === "--overwrite") {
      options.overwrite = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
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

function printHelp() {
  console.log(`
Usage: node scripts/importJsonSessionsToSqlite.js [--db data/qianqiu.sqlite] [--session <sessionId>] [--overwrite] [--dry-run]

从默认 data/sessions/*.json 读取 JSON 存档，写入本地 SQLite session 表。
默认跳过已存在的 session；加 --overwrite 可覆盖 SQLite 中同 id 的行。
写入 SQLite 时会通过 SQLite adapter 同步 geo_*、people_*、office_*、event_archive_index 和 prompt_retrieval_index 等本地派生表；--dry-run 只读取 JSON 存档，不打开或修改 SQLite 数据库。
`.trim());
}

async function runImportJsonSessionsToSqlite(options = {}) {
  const jsonStore = options.jsonStore || createJsonSessionAdapter();
  const sqliteStore = options.dryRun
    ? null
    : options.sqliteStore || createSqliteSessionAdapter({ databasePath: options.databasePath });

  try {
    const { saves, skipped: skippedJson } = await jsonStore.listSessions();
    const imported = [];
    const skipped = [...skippedJson];

    for (const save of saves) {
      if (options.sessionId && save.sessionId !== options.sessionId) continue;

      try {
        const { record } = await jsonStore.readSessionRecord(save.sessionId);
        if (!options.dryRun) {
          await sqliteStore.importSessionRecord(record, { overwrite: options.overwrite });
        }
        imported.push(save.sessionId);
      } catch (error) {
        skipped.push({
          sessionId: save.sessionId,
          reason: error.statusCode === 409 ? "SQLite row already exists" : error.message
        });
      }
    }

    return {
      dryRun: options.dryRun,
      imported: imported.length,
      selectedSessionId: options.sessionId,
      skipped,
      syncedDerivedTables: !options.dryRun,
      syncedGeographyTables: !options.dryRun,
      overwrite: options.overwrite
    };
  } finally {
    if (!options.dryRun && !options.sqliteStore) sqliteStore.close();
  }
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return null;
  }

  const result = await runImportJsonSessionsToSqlite(options);
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
  main,
  parseArgs,
  runImportJsonSessionsToSqlite
};
