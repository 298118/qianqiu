const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const {
  assertNoBlockedTokens,
  buildS59WorldState,
  parseArgs,
  resolveSqlitePlan,
  runStorageMaintenanceAcceptance
} = require("../scripts/dualModeAcceptance");

const dataDir = path.join(__dirname, "..", "data");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

test("dual-mode acceptance parses storage and browser options", () => {
  assert.deepEqual(parseArgs(["--storage-only", "--sqlite-db", "data/s59.sqlite", "--browser", "C:\\Chrome\\chrome.exe", "--screenshots", "tmp/screens", "--headed"]), {
    browserPath: "C:\\Chrome\\chrome.exe",
    headed: true,
    help: false,
    screenshotsDir: "tmp/screens",
    skipBrowser: true,
    sqliteDatabasePath: "data/s59.sqlite"
  });
  assert.equal(parseArgs(["--skip-browser"]).skipBrowser, true);
  assert.equal(parseArgs(["--help"]).help, true);
  assert.throws(() => parseArgs(["--sqlite-db"]), /requires a value/);
  assert.throws(() => parseArgs(["--unknown"]), /Unknown dual-mode acceptance argument/);
});

test("dual-mode acceptance resolves temporary and provided SQLite plans", () => {
  const temporary = resolveSqlitePlan(null);
  assert.equal(temporary.ownsDatabase, true);
  assert.match(temporary.sqliteDatabasePath, /s59-dual-mode-/);

  const provided = resolveSqlitePlan("data/provided-s59.sqlite");
  assert.equal(provided.ownsDatabase, false);
  assert.equal(path.isAbsolute(provided.sqliteDatabasePath), true);
});

test("dual-mode acceptance hidden-token guard blocks raw storage and prompt text", () => {
  assert.doesNotThrow(() => assertNoBlockedTokens("safe payload", { summary: "公开摘要" }));
  assert.throws(
    () => assertNoBlockedTokens("unsafe payload", { summary: "SEALED_S59_PROMPT world_state_json" }),
    /SEALED_S59_|world_state_json/
  );
});

test("dual-mode acceptance fixture keeps visible official mainline shape", () => {
  const worldState = buildS59WorldState();
  assert.equal(worldState.player.role, "official");
  assert.equal(worldState.player.examRank, "进士");
  assert.equal(worldState.player.examHistory.length, 4);
  assert.ok(worldState.eventHistory.some((entry) => entry.includes("书生连捷四场")));
});

test("dual-mode storage maintenance acceptance imports, repairs, exports, and redacts", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-s59-dual-mode-${randomUUID()}.sqlite`);
  t.after(() => removeSqliteArtifacts(dbPath));

  const result = await runStorageMaintenanceAcceptance({ sqliteDatabasePath: dbPath });
  const serialized = JSON.stringify(result);

  assert.equal(result.imported, 1);
  assert.equal(result.dryRunImported, 1);
  assert.equal(result.geographyRepair.dryRunNeedsRepair, true);
  assert.equal(result.geographyRepair.repaired, 1);
  assert.equal(result.geographyRepair.cleanAfterRepair, true);
  assert.equal(result.geographyRepair.exported, 1);
  assert.equal(result.geographyRepair.wroteFile, true);
  assert.equal(result.auditProjection.jsonProjectedItems, 1);
  assert.equal(result.auditProjection.sqliteProjectedItems, 1);
  assert.equal(result.derivedCounts.worldSessions, 1);
  assert.ok(result.derivedCounts.eventArchiveIndex > 0);
  assert.ok(result.derivedCounts.promptRetrievalIndex > 0);
  assert.ok(result.derivedCounts.auditEvents > 0);
  assert.ok(result.derivedCounts.aiProposals > 0);
  assert.equal(serialized.includes(dbPath), false);
  assert.equal(serialized.includes("SEALED_S59_"), false);
});
