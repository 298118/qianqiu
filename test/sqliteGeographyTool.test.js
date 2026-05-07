const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const {
  parseArgs: parseImportArgs,
  runImportJsonSessionsToSqlite
} = require("../scripts/importJsonSessionsToSqlite");
const {
  parseArgs,
  runSqliteGeographyTool
} = require("../scripts/sqliteGeographyTool");

const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(dataDir, "sessions");
const auditDir = path.join(dataDir, "audit");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true, recursive: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true, recursive: true });
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync(dbPath);
  try {
    return task(database);
  } finally {
    database.close();
  }
}

function buildToolWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "地理工具"
  });
  Object.assign(worldState, {
    turnCount: 9,
    borderThreat: 88,
    corruption: 72
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  worldState.worldGeography.routes.push({
    id: "route-hidden-tool",
    type: "road",
    name: "SEALED_TOOL_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-shanhaiguan",
    visibility: "hidden",
    publicSummary: "SEALED_TOOL_ROUTE_SUMMARY",
    hiddenNotes: ["SEALED_TOOL_ROUTE_NOTE"]
  });
  worldState.worldGeography.recentNotes.push("SEALED_TOOL_RECENT_NOTE");
  return worldState;
}

test("SQLite geography tooling parses commands and validates arguments", () => {
  assert.deepEqual(parseArgs(["status", "--db", "data/demo.sqlite", "--json"]), {
    command: "status",
    databasePath: "data/demo.sqlite",
    dryRun: false,
    json: true,
    outPath: null,
    overwrite: false,
    sessionId: null
  });
  assert.equal(parseArgs(["repair", "--dry-run"]).dryRun, true);
  assert.throws(() => parseArgs(["status", "--db"]), /--db requires a value/);
  assert.throws(() => parseArgs(["status", "--session", "unsafe"]), /Invalid session id/);

  assert.equal(parseImportArgs(["--session", randomUUID()]).sessionId.length, 36);
  assert.throws(() => parseImportArgs(["--session", "unsafe"]), /Invalid session id/);
});

test("SQLite geography import dry-run does not create a database", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const jsonAdapter = createJsonSessionAdapter();
  const worldState = buildToolWorldState();
  const dbPath = path.join(dataDir, `test-geography-tool-dry-${randomUUID()}.sqlite`);
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await removeSqliteArtifacts(dbPath);
  });

  await jsonAdapter.writeSession(clone(worldState));
  const result = await runImportJsonSessionsToSqlite({
    databasePath: dbPath,
    dryRun: true,
    sessionId: worldState.sessionId
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.imported, 1);
  assert.equal(result.syncedGeographyTables, false);
  await assert.rejects(() => fs.stat(dbPath), /ENOENT/);
});

test("SQLite geography tool imports, reports, repairs, and exports redacted geography", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const jsonAdapter = createJsonSessionAdapter();
  const worldState = buildToolWorldState();
  const dbPath = path.join(dataDir, `test-geography-tool-${randomUUID()}.sqlite`);
  const outPath = path.join(dataDir, `test-geography-tool-${randomUUID()}.json`);
  t.after(async () => {
    await removeSessionArtifacts(worldState.sessionId);
    await removeSqliteArtifacts(dbPath);
    await fs.rm(outPath, { force: true });
  });

  await jsonAdapter.writeSession(clone(worldState));
  const importResult = await runSqliteGeographyTool({
    command: "import",
    databasePath: dbPath,
    overwrite: true,
    sessionId: worldState.sessionId
  });

  assert.equal(importResult.imported, 1);
  assert.ok(await fs.stat(path.join(sessionsDir, `${worldState.sessionId}.json`)));
  withSqliteDatabase(dbPath, (database) => {
    const session = database.prepare("SELECT COUNT(*) AS count FROM world_sessions WHERE session_id = ?").get(worldState.sessionId);
    const routes = database.prepare("SELECT COUNT(*) AS count FROM geo_routes WHERE session_id = ?").get(worldState.sessionId);
    assert.equal(session.count, 1);
    assert.ok(routes.count > 0);
    database.prepare("DELETE FROM geo_routes WHERE session_id = ?").run(worldState.sessionId);
  });

  const dryRepair = await runSqliteGeographyTool({
    command: "repair",
    databasePath: dbPath,
    dryRun: true,
    sessionId: worldState.sessionId
  });
  assert.equal(dryRepair.repaired, 0);
  assert.equal(dryRepair.sessions[0].repairStatus.needsRepair, true);
  withSqliteDatabase(dbPath, (database) => {
    const routes = database.prepare("SELECT COUNT(*) AS count FROM geo_routes WHERE session_id = ?").get(worldState.sessionId);
    assert.equal(routes.count, 0);
  });

  const repair = await runSqliteGeographyTool({
    command: "repair",
    databasePath: dbPath,
    sessionId: worldState.sessionId
  });
  assert.equal(repair.repaired, 1);
  withSqliteDatabase(dbPath, (database) => {
    const routes = database.prepare("SELECT COUNT(*) AS count FROM geo_routes WHERE session_id = ?").get(worldState.sessionId);
    assert.ok(routes.count > 0);
  });

  const status = await runSqliteGeographyTool({
    command: "status",
    databasePath: dbPath,
    sessionId: worldState.sessionId
  });
  assert.equal(status.sessions[0].repairStatus.needsRepair, false);

  const exported = await runSqliteGeographyTool({
    command: "export",
    databasePath: dbPath,
    outPath,
    sessionId: worldState.sessionId
  });
  const serialized = JSON.stringify(exported);
  const fileSerialized = await fs.readFile(outPath, "utf8");

  assert.equal(exported.wroteFile, true);
  assert.match(serialized, /北京|山海关|京杭漕运|户部/);
  for (const hiddenToken of [
    "SEALED_TOOL_ROUTE",
    "SEALED_TOOL_ROUTE_NOTE",
    "SEALED_TOOL_RECENT_NOTE",
    "hidden_notes_json",
    dbPath,
    "SQLITE_DATABASE_PATH",
    "OPENAI_API_KEY"
  ]) {
    assert.equal(serialized.includes(hiddenToken), false, `${hiddenToken} should stay out of export output`);
    assert.equal(fileSerialized.includes(hiddenToken), false, `${hiddenToken} should stay out of export file`);
  }
});
