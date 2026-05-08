const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const { buildOfficialPostingsView } = require("../src/game/officialPostings");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
const { buildWorldPeopleView } = require("../src/game/worldPeople");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const { runAuditEventArchiveTool } = require("./auditEventArchiveTool");
const { runBrowserSmoke, runInformationPanelParitySmoke } = require("./browserSmoke");
const { runImportJsonSessionsToSqlite } = require("./importJsonSessionsToSqlite");
const { runSqliteGeographyTool } = require("./sqliteGeographyTool");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const sessionsDir = path.join(dataDir, "sessions");
const auditDir = path.join(dataDir, "audit");

const BLOCKED_TOKENS = Object.freeze([
  "SEALED_S59_",
  "hiddenNotes",
  "hiddenIntent",
  "provider proposal",
  "statePatch",
  "world_state_json",
  "event_log",
  "ai_change_proposals",
  "prompt_retrieval_index",
  "event_archive_index",
  "SQLITE_DATABASE_PATH",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY",
  "sk-proj-s59",
  "E:\\LSMNQ"
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    browserPath: null,
    headed: false,
    help: false,
    screenshotsDir: null,
    skipBrowser: false,
    sqliteDatabasePath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--browser") {
      options.browserPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--screenshots") {
      options.screenshotsDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--skip-browser" || arg === "--storage-only") {
      options.skipBrowser = true;
    } else if (arg === "--sqlite-db" || arg === "--sqlite-database" || arg === "--db") {
      options.sqliteDatabasePath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown dual-mode acceptance argument: ${arg}`);
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
Usage: node scripts/dualModeAcceptance.js [options]

Runs the S59.1 JSON/SQLite dual-mode acceptance:
  1. Full Mock browser journey in JSON mode.
  2. Full Mock browser journey in SQLite mode.
  3. Focused JSON/SQLite information-panel parity smoke.
  4. Storage maintenance acceptance for JSON -> SQLite import, geography repair/export,
     audit public projection, derived table counts, and hidden-token checks.

Options:
  --storage-only       Skip browser journeys and run only storage/tooling acceptance.
  --sqlite-db <path>   SQLite database path. Defaults to a temporary data/s59-*.sqlite file.
  --browser <path>     Browser executable path for browser smoke.
  --screenshots <dir>  Save browser acceptance screenshots.
  --headed             Show browser windows while running.
  --help               Show this message.
`.trim());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveSqlitePlan(sqliteDatabasePath) {
  const ownsDatabase = !sqliteDatabasePath;
  const selected = sqliteDatabasePath || path.join(dataDir, `s59-dual-mode-${randomUUID()}.sqlite`);
  return {
    ownsDatabase,
    sqliteDatabasePath: selected === ":memory:" ? selected : path.resolve(selected)
  };
}

async function removeSqliteArtifacts(dbPath) {
  if (!dbPath || dbPath === ":memory:") return;
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return task(db);
  } finally {
    db.close();
  }
}

function tableCount(db, tableName, sessionId) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!table) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get(sessionId).count;
}

function readDerivedTableCounts(dbPath, sessionId) {
  return withSqliteDatabase(dbPath, (db) => ({
    worldSessions: tableCount(db, "world_sessions", sessionId),
    geography: {
      countries: tableCount(db, "geo_countries", sessionId),
      regions: tableCount(db, "geo_regions", sessionId),
      cities: tableCount(db, "geo_cities", sessionId),
      routes: tableCount(db, "geo_routes", sessionId),
      frontierZones: tableCount(db, "geo_frontier_zones", sessionId),
      officeJurisdictions: tableCount(db, "geo_office_jurisdictions", sessionId)
    },
    people: {
      npcs: tableCount(db, "people_npcs", sessionId),
      households: tableCount(db, "people_households", sessionId),
      assets: tableCount(db, "people_assets", sessionId),
      estates: tableCount(db, "people_estates", sessionId),
      relationships: tableCount(db, "people_relationships", sessionId)
    },
    offices: {
      bureaus: tableCount(db, "office_bureaus", sessionId),
      officeCatalog: tableCount(db, "office_catalog", sessionId),
      cityJurisdictions: tableCount(db, "office_city_jurisdictions", sessionId),
      postings: tableCount(db, "office_postings", sessionId),
      assessments: tableCount(db, "office_assessments", sessionId),
      transfers: tableCount(db, "office_transfers", sessionId)
    },
    eventArchiveIndex: tableCount(db, "event_archive_index", sessionId),
    promptRetrievalIndex: tableCount(db, "prompt_retrieval_index", sessionId),
    auditEvents: tableCount(db, "event_log", sessionId),
    aiProposals: tableCount(db, "ai_change_proposals", sessionId)
  }));
}

function countSum(values = {}) {
  return Object.values(values).reduce((total, value) => total + Number(value || 0), 0);
}

function assertDerivedCounts(counts = {}) {
  const failures = [];
  if (counts.worldSessions !== 1) failures.push("world_sessions did not contain the imported session.");
  if (countSum(counts.geography) <= 0) failures.push("geo_* derived rows were not synced.");
  if (countSum(counts.people) <= 0) failures.push("people_* derived rows were not synced.");
  if (countSum(counts.offices) <= 0) failures.push("office_* derived rows were not synced.");
  if (counts.eventArchiveIndex <= 0) failures.push("event_archive_index rows were not synced.");
  if (counts.promptRetrievalIndex <= 0) failures.push("prompt_retrieval_index rows were not synced.");
  if (counts.auditEvents <= 0) failures.push("SQLite event_log rows were not written.");
  if (counts.aiProposals <= 0) failures.push("SQLite ai_change_proposals rows were not written.");
  if (failures.length) throw new Error(failures.join(" "));
}

function assertNoBlockedTokens(label, value, blockedTokens = BLOCKED_TOKENS) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const leaked = blockedTokens.filter((token) => token && serialized.includes(token));
  if (leaked.length) {
    throw new Error(`${label} leaked hidden tokens: ${leaked.join(", ")}`);
  }
}

function buildS59WorldState() {
  const worldState = createInitialState({
    dynasty: "明",
    role: "official",
    playerName: "S59双模验收",
    year: 1644
  });
  Object.assign(worldState, {
    month: 8,
    tenDayPeriod: 2,
    turnCount: 18,
    borderThreat: 62,
    corruption: 58,
    grainReserve: 760,
    publicOrder: 73
  });
  Object.assign(worldState.player, {
    examRank: "进士",
    officeTitle: "户部主事",
    palaceRank: "二甲第七名",
    position: "户部主事",
    role: "official",
    roleLabel: "入仕官员"
  });
  Object.assign(worldState.officialCareer, {
    bureauId: "ministry_revenue",
    currentPosting: "户部主事",
    tenureMonths: 4
  });
  worldState.player.examHistory = [
    ["child_exam", "童试", "秀才"],
    ["provincial_exam", "乡试", "举人"],
    ["metropolitan_exam", "会试", "贡士"],
    ["palace_exam", "殿试", "进士"]
  ].map(([level, examName, rank], index) => ({
    examId: `s59-${level}`,
    level,
    examName,
    score: { overall_score: 82 + index, authenticity_penalty: 0 },
    promotionResult: { passed: true, rank },
    sceneTime: {
      startedAt: { year: 1644, month: index + 1, tenDayPeriod: 1, turnCount: index },
      updatedAt: { year: 1644, month: index + 1, tenDayPeriod: 1, turnCount: index + 1 }
    }
  }));
  worldState.eventHistory = [
    "S59公开主线：书生连捷四场，殿试后入户部观政。",
    "S59公开任所：户部查核漕粮账册，牵连京杭漕运。",
    "prompt provider proposal statePatch event_log ai_change_proposals sk-proj-s59-secret"
  ];
  worldState.worldGeography.routes.push({
    id: "route-hidden-s59",
    type: "road",
    name: "SEALED_S59_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-shanhaiguan",
    visibility: "hidden",
    publicSummary: "SEALED_S59_ROUTE_SUMMARY",
    hiddenNotes: ["SEALED_S59_ROUTE_NOTE"]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-s59",
    name: "SEALED_S59_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_S59_INTENT",
    hiddenNotes: ["SEALED_S59_NPC_NOTE"]
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-s59",
    officeId: "ministry_revenue_principal",
    officeTitle: "SEALED_S59_OFFICE",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-hidden-s59",
    status: "active",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_S59_OFFICE_SUMMARY",
    hiddenNotes: ["SEALED_S59_OFFICE_NOTE"]
  });
  return worldState;
}

async function seedAudit(adapter, worldState) {
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "turn_completed",
    visibility: "public",
    summary: "S59公开审计：双模式验收记录已入档。",
    related: {
      eventHistoryCount: worldState.eventHistory.length,
      hiddenNotes: "SEALED_S59_AUDIT_NOTE",
      localPath: "E:\\LSMNQ\\data\\audit\\sealed.jsonl"
    },
    appliedChanges: {
      turnCount: worldState.turnCount,
      statePatch: { hidden: "SEALED_S59_STATE_PATCH" }
    },
    createdAt: "2026-05-08T13:00:00.000Z"
  }, {
    revision: 2,
    turnCount: worldState.turnCount,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod
  });
  await adapter.appendAuditEvent(worldState.sessionId, {
    eventType: "provider_turn_applied",
    visibility: "developer",
    summary: "SEALED_S59_DEVELOPER_AUDIT"
  });
  await adapter.appendAiProposal(worldState.sessionId, {
    proposalKind: "turn",
    status: "recorded",
    proposal: {
      promptText: "SEALED_S59_PROMPT",
      providerProposal: "SEALED_S59_PROVIDER_PROPOSAL",
      statePatch: { key: "sk-proj-s59-secret" }
    },
    accepted: { stateDelta: { publicOrder: 73 } }
  });
}

function buildVisiblePayload(worldState) {
  const prompt = assemblePromptContext(worldState, {
    task: "official_career",
    playerAction: "核验 S59 双模式存储、任所地理与近事档案"
  });
  return {
    worldGeographyView: buildWorldGeographyView(worldState),
    worldPeopleView: buildWorldPeopleView(worldState),
    officialPostingsView: buildOfficialPostingsView(worldState),
    eventArchiveView: buildEventArchiveView(worldState, { pageSize: 5 }),
    prompt: {
      worldGeography: prompt.worldGeography,
      worldPeople: prompt.worldPeople,
      officialPostings: prompt.officialPostings,
      retrievalContext: prompt.retrievalContext
    }
  };
}

function normalizePayloadForParity(payload = {}) {
  return {
    worldGeographyView: payload.worldGeographyView,
    worldPeopleView: payload.worldPeopleView,
    officialPostingsView: payload.officialPostingsView,
    eventArchiveView: payload.eventArchiveView,
    prompt: payload.prompt
  };
}

function assertVisibleParity(jsonWorldState, sqliteWorldState) {
  const jsonPayload = buildVisiblePayload(jsonWorldState);
  const sqlitePayload = buildVisiblePayload(sqliteWorldState);
  assertNoBlockedTokens("JSON visible payload", jsonPayload);
  assertNoBlockedTokens("SQLite visible payload", sqlitePayload);
  if (JSON.stringify(normalizePayloadForParity(jsonPayload)) !== JSON.stringify(normalizePayloadForParity(sqlitePayload))) {
    throw new Error("JSON/SQLite visible route and prompt payloads differ after import.");
  }
}

function tamperGeographyRows(dbPath, sessionId) {
  withSqliteDatabase(dbPath, (db) => {
    db.prepare("DELETE FROM geo_routes WHERE session_id = ?").run(sessionId);
  });
}

async function runStorageMaintenanceAcceptance(options = {}) {
  if (!(typeof isBuiltin === "function" && isBuiltin("node:sqlite"))) {
    throw new Error("S59 dual-mode storage acceptance requires a Node.js runtime with node:sqlite support");
  }

  const { ownsDatabase, sqliteDatabasePath } = resolveSqlitePlan(options.sqliteDatabasePath);
  const jsonAdapter = createJsonSessionAdapter();
  const worldState = buildS59WorldState();
  const geographyOutPath = path.join(dataDir, `s59-geography-export-${randomUUID()}.json`);
  let sqliteAdapter = null;

  try {
    await jsonAdapter.writeSession(clone(worldState));
    await seedAudit(jsonAdapter, worldState);

    const dryRun = await runImportJsonSessionsToSqlite({
      databasePath: sqliteDatabasePath,
      dryRun: true,
      sessionId: worldState.sessionId
    });
    if (dryRun.imported !== 1 || dryRun.syncedDerivedTables !== false) {
      throw new Error("JSON -> SQLite dry-run did not report the selected session without syncing derived tables.");
    }

    const imported = await runSqliteGeographyTool({
      command: "import",
      databasePath: sqliteDatabasePath,
      overwrite: true,
      sessionId: worldState.sessionId
    });
    if (imported.imported !== 1 || imported.syncedDerivedTables !== true) {
      throw new Error("JSON -> SQLite import did not sync the selected session and derived tables.");
    }

    sqliteAdapter = createSqliteSessionAdapter({ databasePath: sqliteDatabasePath });
    await seedAudit(sqliteAdapter, worldState);
    const { record: jsonRecord } = await jsonAdapter.readSessionRecord(worldState.sessionId);
    const { record: sqliteRecord } = await sqliteAdapter.readSessionRecord(worldState.sessionId);
    assertVisibleParity(jsonRecord.worldState, sqliteRecord.worldState);

    let counts = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    assertDerivedCounts(counts);

    tamperGeographyRows(sqliteDatabasePath, worldState.sessionId);
    const dryRepair = await runSqliteGeographyTool({
      command: "repair",
      databasePath: sqliteDatabasePath,
      dryRun: true,
      sessionId: worldState.sessionId
    });
    if (dryRepair.repaired !== 0 || dryRepair.sessions[0]?.repairStatus?.needsRepair !== true) {
      throw new Error("geography repair dry-run did not detect the deleted route rows.");
    }

    const repair = await runSqliteGeographyTool({
      command: "repair",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId
    });
    if (repair.repaired !== 1) {
      throw new Error("geography repair did not restore deleted route rows.");
    }

    const status = await runSqliteGeographyTool({
      command: "status",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId
    });
    if (status.sessions[0]?.repairStatus?.needsRepair !== false) {
      throw new Error("geography status still reports drift after repair.");
    }

    const geographyExport = await runSqliteGeographyTool({
      command: "export",
      databasePath: sqliteDatabasePath,
      outPath: geographyOutPath,
      sessionId: worldState.sessionId
    });
    const geographyExportFile = await fs.readFile(geographyOutPath, "utf8");
    assertNoBlockedTokens("geography export", geographyExport);
    assertNoBlockedTokens("geography export file", geographyExportFile);

    const auditJson = await runAuditEventArchiveTool({
      command: "export",
      storageAdapter: "json",
      sessionId: worldState.sessionId,
      limit: 20
    });
    const auditSqlite = await runAuditEventArchiveTool({
      command: "export",
      storageAdapter: "sqlite",
      databasePath: sqliteDatabasePath,
      sessionId: worldState.sessionId,
      limit: 20
    });
    assertNoBlockedTokens("JSON audit projection", auditJson);
    assertNoBlockedTokens("SQLite audit projection", auditSqlite);
    if (auditJson.exported !== 1 || auditSqlite.exported !== 1) {
      throw new Error("audit projection export did not read both JSON and SQLite sessions.");
    }

    counts = readDerivedTableCounts(sqliteDatabasePath, worldState.sessionId);
    assertDerivedCounts(counts);

    return {
      sessionId: worldState.sessionId,
      imported: imported.imported,
      dryRunImported: dryRun.imported,
      geographyRepair: {
        dryRunNeedsRepair: dryRepair.sessions[0].repairStatus.needsRepair,
        repaired: repair.repaired,
        cleanAfterRepair: status.sessions[0].repairStatus.needsRepair === false,
        exported: geographyExport.exported,
        wroteFile: Boolean(geographyExport.wroteFile)
      },
      auditProjection: {
        jsonProjectedItems: auditJson.sessions[0].projection.counts.projectedItems,
        sqliteProjectedItems: auditSqlite.sessions[0].projection.counts.projectedItems
      },
      derivedCounts: counts,
      sqliteDatabase: ownsDatabase ? "temporary" : "provided"
    };
  } finally {
    if (sqliteAdapter) {
      try {
        await sqliteAdapter.deleteSession(worldState.sessionId);
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      } finally {
        sqliteAdapter.close();
      }
    }
    await removeSessionArtifacts(worldState.sessionId);
    await fs.rm(geographyOutPath, { force: true });
    if (ownsDatabase) await removeSqliteArtifacts(sqliteDatabasePath);
  }
}

async function runBrowserDualModeAcceptance(options = {}) {
  const common = {
    browserPath: options.browserPath,
    headed: options.headed,
    screenshotsDir: options.screenshotsDir
  };
  const sqlitePlan = resolveSqlitePlan(options.sqliteDatabasePath);
  try {
    const json = await runBrowserSmoke({
      ...common,
      storageAdapter: "json"
    });
    const sqlite = await runBrowserSmoke({
      ...common,
      storageAdapter: "sqlite",
      sqliteDatabasePath: sqlitePlan.sqliteDatabasePath
    });
    const informationParity = await runInformationPanelParitySmoke({
      ...common,
      sqliteDatabasePath: sqlitePlan.sqliteDatabasePath
    });
    return {
      json: {
        identityTurns: json.identityTurns,
        viewports: json.uiAcceptance.viewports
      },
      sqlite: {
        identityTurns: sqlite.identityTurns,
        viewports: sqlite.uiAcceptance.viewports
      },
      informationParity: {
        viewports: informationParity.uiAcceptance.viewports
      }
    };
  } finally {
    if (sqlitePlan.ownsDatabase) await removeSqliteArtifacts(sqlitePlan.sqliteDatabasePath);
  }
}

async function runDualModeAcceptance(options = {}) {
  const storage = await runStorageMaintenanceAcceptance(options);
  const browser = options.skipBrowser ? { skipped: true } : await runBrowserDualModeAcceptance(options);
  return {
    ok: true,
    storage,
    browser
  };
}

async function main(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp(io);
    return null;
  }
  const result = await runDualModeAcceptance(options);
  io.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`S59 dual-mode acceptance failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertNoBlockedTokens,
  buildS59WorldState,
  parseArgs,
  resolveSqlitePlan,
  runBrowserDualModeAcceptance,
  runDualModeAcceptance,
  runStorageMaintenanceAcceptance
};
