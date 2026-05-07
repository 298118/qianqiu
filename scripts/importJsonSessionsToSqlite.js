const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const {
  DEFAULT_SQLITE_DATABASE_PATH,
  createSqliteSessionAdapter
} = require("../src/storage/sqliteSessionAdapter");

function parseArgs(argv) {
  const options = {
    databasePath: process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    overwrite: false,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--db" || arg === "--database") {
      options.databasePath = argv[index + 1];
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

function printHelp() {
  console.log(`
Usage: node scripts/importJsonSessionsToSqlite.js [--db data/qianqiu.sqlite] [--overwrite] [--dry-run]

从默认 data/sessions/*.json 读取 JSON 存档，写入本地 SQLite session 表。
默认跳过已存在的 session；加 --overwrite 可覆盖 SQLite 中同 id 的行。
`.trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const jsonStore = createJsonSessionAdapter();
  const sqliteStore = createSqliteSessionAdapter({ databasePath: options.databasePath });

  try {
    const { saves, skipped: skippedJson } = await jsonStore.listSessions();
    const imported = [];
    const skipped = [...skippedJson];

    for (const save of saves) {
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

    console.log(
      JSON.stringify(
        {
          databasePath: options.databasePath,
          dryRun: options.dryRun,
          overwrite: options.overwrite,
          imported: imported.length,
          skipped
        },
        null,
        2
      )
    );
  } finally {
    sqliteStore.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
