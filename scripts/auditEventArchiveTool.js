const fs = require("node:fs/promises");
const path = require("node:path");

const {
  buildPublicAuditProjectionView
} = require("../src/game/auditPublicProjection");
const { cleanArchiveText } = require("../src/game/eventArchive");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const {
  DEFAULT_SQLITE_DATABASE_PATH,
  createSqliteSessionAdapter
} = require("../src/storage/sqliteSessionAdapter");
const {
  assertSafeSessionId,
  toPublicSkippedReason
} = require("../src/storage/sessionRecord");
const { redactAuditText } = require("../src/storage/sessionAudit");

const DEFAULT_AUDIT_LIMIT = 200;
const UNSAFE_PUBLIC_TEXT_PATTERN = /(\[redacted|SEALED_|hiddenNotes|hiddenIntent)/i;

function parseArgs(argv = []) {
  const [rawCommand = "export", ...rest] = argv;
  const command = rawCommand === "--help" || rawCommand === "-h" ? "help" : rawCommand;
  const options = {
    command,
    databasePath: process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    json: false,
    limit: DEFAULT_AUDIT_LIMIT,
    outPath: null,
    sessionId: null,
    storageAdapter: process.env.STORAGE_ADAPTER || "json"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--adapter" || arg === "--storage" || arg === "--storage-adapter") {
      options.storageAdapter = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--db" || arg === "--database") {
      options.databasePath = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--session") {
      options.sessionId = readArgValue(rest, index, arg);
      assertSafeSessionId(options.sessionId);
      index += 1;
    } else if (arg === "--limit") {
      options.limit = normalizeLimit(readArgValue(rest, index, arg));
      index += 1;
    } else if (arg === "--out") {
      options.outPath = readArgValue(rest, index, arg);
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.storageAdapter = normalizeStorageAdapter(options.storageAdapter);
  return options;
}

function readArgValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("--limit must be a non-negative integer");
  }
  return Math.min(parsed, 1000);
}

function normalizeStorageAdapter(value) {
  const normalized = String(value || "json").trim().toLowerCase();
  if (normalized === "json" || normalized === "sqlite") return normalized;
  throw new Error(`Unsupported audit projection adapter: ${value}`);
}

function normalizeMetadataNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function cleanMetadataString(value, maxLength = 80) {
  const cleaned = cleanArchiveText(value, "", maxLength);
  if (!cleaned || UNSAFE_PUBLIC_TEXT_PATTERN.test(cleaned)) return null;
  return cleaned;
}

function buildPublicSessionMetadata(metadata = {}) {
  return {
    playerName: cleanMetadataString(metadata.playerName, 80),
    role: cleanMetadataString(metadata.role, 40),
    roleLabel: cleanMetadataString(metadata.roleLabel, 40),
    dynasty: cleanMetadataString(metadata.dynasty, 20),
    year: normalizeMetadataNumber(metadata.year),
    month: normalizeMetadataNumber(metadata.month),
    tenDayPeriod: normalizeMetadataNumber(metadata.tenDayPeriod),
    turnCount: normalizeMetadataNumber(metadata.turnCount),
    examRank: cleanMetadataString(metadata.examRank, 60),
    palaceRank: cleanMetadataString(metadata.palaceRank, 60),
    officeTitle: cleanMetadataString(metadata.officeTitle, 80),
    summary: cleanMetadataString(metadata.summary, 80)
  };
}

function printHelp(io = console) {
  io.log(`
Usage: node scripts/auditEventArchiveTool.js <command> [options]

Commands:
  status   Report audit projection counts without raw audit text.
  export   Export a safe public audit-event projection.

Options:
  --adapter <json|sqlite>  Audit source adapter. Defaults to STORAGE_ADAPTER or json.
  --db <path>             SQLite database path when --adapter sqlite is used.
  --session <id>          Limit the command to one session id.
  --limit <n>             Maximum audit rows to read and public items to return. Default 200.
  --out <path>            For export, write the JSON dump to this file.
  --json                  Kept for shell clarity; output is JSON by default.
`.trim());
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

function createAdapter(options = {}) {
  if (options.storageAdapter === "sqlite") {
    return createSqliteSessionAdapter({ databasePath: options.databasePath });
  }
  return createJsonSessionAdapter();
}

async function selectSessionRecords(adapter, options = {}) {
  if (options.sessionId) {
    try {
      const { record } = await adapter.readSessionRecord(options.sessionId);
      return {
        records: [record],
        skipped: []
      };
    } catch (error) {
      return {
        records: [],
        skipped: [{ sessionId: options.sessionId, reason: toPublicSkippedReason(error) }]
      };
    }
  }

  const listed = await adapter.listSessions();
  const records = [];
  const skipped = [...(listed.skipped || [])];

  for (const save of listed.saves || []) {
    try {
      const { record } = await adapter.readSessionRecord(save.sessionId);
      records.push(record);
    } catch (error) {
      skipped.push({ sessionId: save.sessionId, reason: toPublicSkippedReason(error) });
    }
  }

  return { records, skipped };
}

async function buildSessionProjection(adapter, record, options = {}) {
  const [auditEvents, aiProposals] = await Promise.all([
    adapter.listAuditEvents(record.sessionId, { limit: options.limit }),
    adapter.listAiProposals(record.sessionId, { limit: options.limit })
  ]);
  const view = buildPublicAuditProjectionView({
    aiProposalCount: aiProposals.length,
    auditEvents,
    limit: options.limit,
    metadata: record.metadata,
    sessionId: record.sessionId
  });

  return {
    sessionId: record.sessionId,
    revision: record.revision,
    metadata: buildPublicSessionMetadata(record.metadata),
    projection: view
  };
}

function publicSkipped(skipped = []) {
  return skipped.map((entry) => ({
    sessionId: entry.sessionId || null,
    reason: redactAuditText(entry.reason || "Unable to read session")
  }));
}

async function withAuditAdapter(options = {}, task) {
  const normalizedOptions = {
    ...options,
    databasePath: resolveDatabasePath(options.databasePath),
    storageAdapter: normalizeStorageAdapter(options.storageAdapter)
  };

  if (
    normalizedOptions.storageAdapter === "sqlite" &&
    !(await databaseFileExists(normalizedOptions.databasePath))
  ) {
    return {
      databaseExists: false,
      sessions: [],
      skipped: []
    };
  }

  const adapter = createAdapter(normalizedOptions);
  try {
    return {
      databaseExists: normalizedOptions.storageAdapter === "sqlite" ? true : undefined,
      ...(await task(adapter, normalizedOptions))
    };
  } finally {
    if (typeof adapter.close === "function") adapter.close();
  }
}

async function runExport(options = {}) {
  const result = await withAuditAdapter(options, async (adapter, normalizedOptions) => {
    const { records, skipped } = await selectSessionRecords(adapter, normalizedOptions);
    const sessions = [];
    const exportSkipped = publicSkipped(skipped);

    for (const record of records) {
      try {
        sessions.push(await buildSessionProjection(adapter, record, normalizedOptions));
      } catch (error) {
        exportSkipped.push({ sessionId: record.sessionId, reason: redactAuditText(error.message) });
      }
    }

    return {
      command: "export",
      exported: sessions.length,
      sessions,
      skipped: exportSkipped
    };
  });
  const normalizedResult = {
    command: "export",
    storageAdapter: options.storageAdapter,
    exported: 0,
    sessions: [],
    skipped: [],
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

async function runStatus(options = {}) {
  const exported = await runExport({ ...options, outPath: null });
  return {
    command: "status",
    storageAdapter: exported.storageAdapter,
    databaseExists: exported.databaseExists,
    checked: exported.sessions.length,
    sessions: exported.sessions.map((session) => ({
      sessionId: session.sessionId,
      revision: session.revision,
      counts: session.projection.counts
    })),
    skipped: exported.skipped || []
  };
}

async function runAuditEventArchiveTool(options = {}) {
  const command = options.command || "export";
  const normalizedOptions = {
    ...options,
    databasePath: options.databasePath || process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DATABASE_PATH,
    limit: normalizeLimit(options.limit ?? DEFAULT_AUDIT_LIMIT),
    storageAdapter: normalizeStorageAdapter(options.storageAdapter)
  };
  if (command === "help") return { command: "help" };
  if (command === "status") return runStatus(normalizedOptions);
  if (command === "export" || command === "dump") return runExport({ ...normalizedOptions, command: "export" });
  throw new Error(`Unknown command: ${command}`);
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.command === "help") {
    printHelp(io);
    return null;
  }
  const result = await runAuditEventArchiveTool(options);
  io.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(redactAuditText(error.message));
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseArgs,
  runAuditEventArchiveTool
};
