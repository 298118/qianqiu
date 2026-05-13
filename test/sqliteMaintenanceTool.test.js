const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const packageJson = require("../package.json");
const {
  sanitizeDiagnosticValue
} = require("../src/storage/sqliteMaintenance");
const {
  parseArgs,
  runSqliteMaintenanceTool
} = require("../scripts/sqliteMaintenanceTool");

const dataDir = path.join(__dirname, "..", "data");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function buildMaintenanceWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "维护巡检 E:\\LSMNQ\\data\\hidden.json sk-proj-maint-secret-123456"
  });
  Object.assign(worldState, {
    turnCount: 12,
    borderThreat: 81,
    corruption: 66
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.worldGeography.routes.push({
    id: "route-maint-hidden",
    type: "road",
    name: "SEALED_SQLITE_MAINT_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-shanhaiguan",
    visibility: "hidden",
    publicSummary: "SEALED_SQLITE_MAINT_ROUTE_SUMMARY",
    hiddenNotes: ["SEALED_SQLITE_MAINT_ROUTE_NOTE"]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-maint-hidden",
    name: "SEALED_SQLITE_MAINT_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_SQLITE_MAINT_INTENT",
    hiddenNotes: ["SEALED_SQLITE_MAINT_NPC_NOTE"]
  });
  return worldState;
}

function assertNoMaintenanceLeaks(value, blockedTokens) {
  const serialized = JSON.stringify(value);
  for (const blocked of blockedTokens) {
    assert.equal(serialized.includes(blocked), false, `${blocked} should stay out of maintenance output`);
  }
}

test("SQLite maintenance tooling parses commands and validates safe arguments", () => {
  const sessionId = randomUUID();
  assert.deepEqual(parseArgs(["status", "--db", "data/demo.sqlite", "--session", sessionId, "--json"]), {
    backupPath: null,
    command: "status",
    databasePath: "data/demo.sqlite",
    dryRun: false,
    json: true,
    outPath: null,
    overwrite: false,
    sessionId
  });
  assert.equal(parseArgs(["backup", "--dry-run", "--backup", "data/demo.bak"]).dryRun, true);
  assert.throws(() => parseArgs(["status", "--db"]), /--db requires a value/);
  assert.throws(() => parseArgs(["status", "--session", "unsafe"]), /Invalid session id/);

  for (const scriptName of [
    "storage:sqlite:status",
    "storage:sqlite:health",
    "storage:sqlite:backup",
    "storage:sqlite:vacuum",
    "storage:sqlite:export-safe"
  ]) {
    assert.match(packageJson.scripts[scriptName], /sqliteMaintenanceTool\.js/);
  }

  const redacted = sanitizeDiagnosticValue({
    message: "open /tmp/qianqiu/db.sqlite /var/tmp/db.sqlite /workspace/qianqiu/db.sqlite file:///tmp/db.sqlite C:/LSMNQ/db.sqlite E:\\LSMNQ\\db.sqlite sk-proj-maint-secret-123456 tp-maint-secret-123456 SQLITE_DATABASE_PATH world_state_json hiddenNotes"
  });
  const serialized = JSON.stringify(redacted);
  for (const blocked of [
    "/tmp/qianqiu",
    "/var/tmp",
    "/workspace/qianqiu",
    "file:///tmp",
    "C:/LSMNQ",
    "E:\\LSMNQ",
    "sk-proj-maint-secret",
    "tp-maint-secret",
    "SQLITE_DATABASE_PATH",
    "world_state_json",
    "hiddenNotes"
  ]) {
    assert.equal(serialized.includes(blocked), false, `${blocked} should be redacted`);
  }
});

test("SQLite maintenance dry-run and status do not create a missing database", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-sqlite-maint-missing-${randomUUID()}.sqlite`);
  const backupPath = path.join(dataDir, `test-sqlite-maint-missing-${randomUUID()}.bak`);
  t.after(async () => {
    await removeSqliteArtifacts(dbPath);
    await fs.rm(backupPath, { force: true });
  });

  const status = await runSqliteMaintenanceTool({
    command: "status",
    databasePath: dbPath
  });
  const backupDryRun = await runSqliteMaintenanceTool({
    backupPath,
    command: "backup",
    databasePath: dbPath,
    dryRun: true
  });
  const vacuumDryRun = await runSqliteMaintenanceTool({
    command: "vacuum",
    databasePath: dbPath,
    dryRun: true
  });

  assert.equal(status.databaseExists, false);
  assert.equal(backupDryRun.databaseExists, false);
  assert.equal(backupDryRun.backupCreated, false);
  assert.equal(vacuumDryRun.databaseExists, false);
  assert.equal(vacuumDryRun.vacuumed, false);
  await assert.rejects(() => fs.stat(dbPath), /ENOENT/);
  await assert.rejects(() => fs.stat(backupPath), /ENOENT/);
  assertNoMaintenanceLeaks([status, backupDryRun, vacuumDryRun], [dbPath, backupPath]);
});

test("SQLite maintenance reports status, health, drift, backup, vacuum, and safe export", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-sqlite-maint-${randomUUID()}.sqlite`);
  const backupPath = path.join(dataDir, `test-sqlite-maint-${randomUUID()}.bak`);
  const outPath = path.join(dataDir, `test-sqlite-maint-${randomUUID()}.json`);
  const adapter = createSqliteSessionAdapter({ databasePath: dbPath });
  const worldState = buildMaintenanceWorldState();

  t.after(async () => {
    adapter.close();
    await removeSqliteArtifacts(dbPath);
    await fs.rm(backupPath, { force: true });
    await fs.rm(outPath, { force: true });
  });

  await adapter.writeSession(clone(worldState));
  adapter.close();

  withSqliteDatabase(dbPath, (database) => {
    database
      .prepare("DELETE FROM geo_routes WHERE session_id = ?")
      .run(worldState.sessionId);
  });

  const status = await runSqliteMaintenanceTool({
    command: "status",
    databasePath: dbPath,
    sessionId: worldState.sessionId
  });
  const health = await runSqliteMaintenanceTool({
    command: "health",
    databasePath: dbPath
  });
  const backupDryRun = await runSqliteMaintenanceTool({
    backupPath,
    command: "backup",
    databasePath: dbPath,
    dryRun: true
  });
  await fs.writeFile(backupPath, "stale-backup", "utf8");
  const backup = await runSqliteMaintenanceTool({
    backupPath,
    command: "backup",
    databasePath: dbPath,
    overwrite: true
  });
  const vacuumDryRun = await runSqliteMaintenanceTool({
    command: "vacuum",
    databasePath: dbPath,
    dryRun: true
  });
  const exported = await runSqliteMaintenanceTool({
    command: "export-safe",
    databasePath: dbPath,
    outPath,
    sessionId: worldState.sessionId
  });
  const fileSerialized = await fs.readFile(outPath, "utf8");

  assert.equal(status.databaseExists, true);
  assert.equal(status.status.migrations.tableExists, true);
  assert.equal(status.derivedTableDrift.needsRepair, true);
  assert.equal(status.derivedTableDrift.sessions[0].domains.geography.needsRepair, true);
  assert.equal(health.indexHealth.ok, true);
  assert.equal(backupDryRun.backupCreated, false);
  assert.equal(backupDryRun.wouldWriteBackup, true);
  assert.equal(backup.backupCreated, true);
  assert.ok((await fs.stat(backupPath)).size > 0);
  assert.equal(vacuumDryRun.vacuumed, false);
  assert.equal(vacuumDryRun.wouldVacuum, true);
  assert.equal(exported.wroteFile, true);
  assert.equal(exported.diagnostics.derivedTableDrift.needsRepair, true);

  const blocked = [
    dbPath,
    backupPath,
    outPath,
    "E:\\LSMNQ",
    "sk-proj-maint-secret",
    "SEALED_SQLITE_MAINT_",
    "hiddenNotes",
    "hiddenIntent",
    "SQLITE_DATABASE_PATH",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "promptText",
    "world_state_json"
  ];
  assertNoMaintenanceLeaks([
    status,
    health,
    backupDryRun,
    backup,
    vacuumDryRun,
    exported,
    fileSerialized
  ], blocked);
});
