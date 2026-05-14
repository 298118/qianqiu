const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const {
  S67_SCALE_ACCEPTANCE_THRESHOLDS,
  assertNoBlockedTokens,
  buildS59WorldState,
  buildS70AiFirstParityWorldState,
  buildS70AiFirstVisiblePayload,
  parseArgs,
  resolveSqlitePlan,
  runS70AiFirstParityAcceptance,
  runScaleRegressionAcceptance,
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

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return task(db);
  } finally {
    db.close();
  }
}

function auditRowCount(db, tableName, sessionId) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!table) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get(sessionId).count;
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
  assert.match(temporary.sqliteDatabasePath, /s67-dual-mode-/);

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
  assert.throws(
    () => assertNoBlockedTokens("unsafe S67 payload", { summary: "S60_PRIVATE_PROMPT sk-s60-private-canary-token" }),
    /S60_PRIVATE_|sk-s60-private-canary-token/
  );
});

test("dual-mode acceptance fixture keeps visible official mainline shape", () => {
  const worldState = buildS59WorldState();
  assert.equal(worldState.player.role, "official");
  assert.equal(worldState.player.examRank, "进士");
  assert.equal(worldState.player.examHistory.length, 4);
  assert.ok(worldState.eventHistory.some((entry) => entry.includes("书生连捷四场")));
});

test("dual-mode S70 AI-first fixture exposes only route-view surfaces", () => {
  const { worldState, actorMemory } = buildS70AiFirstParityWorldState();
  const payload = buildS70AiFirstVisiblePayload(worldState);
  const serialized = JSON.stringify(payload);

  assert.equal(payload.aiSettingsView.schemaVersion, "s70.9-ai-settings.v1");
  assert.equal(payload.aiInvocationSummaryView.recentInvocations.length >= 1, true);
  assert.equal(payload.playerMonthlyBriefingView.active, true);
  assert.equal(Boolean(payload.playerMonthlyBriefingView.latest), true);
  assert.equal(payload.timeSkip.requestedTicks, 3);
  assert.equal(payload.actorMemoryView.actors.length >= 1, true);
  assert.equal(payload.sessionSummaryView.recentMonthlySummaries.length, 1);
  assert.equal(payload.mapContextView.schemaVersion, 1);
  assert.equal(payload.mapContextView.mapEntityRefs.length > 0, true);
  assert.equal(payload.mapRuntimeView.schemaVersion, 1);
  assert.equal(payload.mapRuntimeView.refs.length > 0, true);
  assert.equal(actorMemory.rejectedCount >= 1, true);
  assert.equal(serialized.includes("actorMemoryLedger"), false);
  assert.equal(serialized.includes("sessionSummary\""), false);
  assert.equal(serialized.includes("world_state_json"), false);
  assert.equal(serialized.includes("sk-proj-s70-secret"), false);
});

test("dual-mode S70 AI-first parity compares JSON and SQLite route views", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-s70-ai-first-${randomUUID()}.sqlite`);
  t.after(() => removeSqliteArtifacts(dbPath));

  const result = await runS70AiFirstParityAcceptance({ sqliteDatabasePath: dbPath });
  const serialized = JSON.stringify(result);

  assert.equal(result.views.aiRoutes >= 9, true);
  assert.equal(result.views.recentInvocations >= 1, true);
  assert.equal(result.views.monthlyBriefingActive, true);
  assert.ok(result.views.monthlyBriefingReportId);
  assert.equal(result.views.timeSkipDetected, true);
  assert.equal(result.views.actorMemoryActors >= 1, true);
  assert.equal(result.views.sessionSummaryCount, 1);
  assert.equal(result.views.mapRefs > 0, true);
  assert.equal(result.views.mapRuntimeRefs > 0, true);
  assert.equal(result.memory.appliedCount >= 1, true);
  assert.equal(result.memory.rejectedCount >= 1, true);
  assert.equal(serialized.includes(dbPath), false);
  assert.equal(serialized.includes("world_sessions"), false);
  assert.equal(serialized.includes("prompt_retrieval_index"), false);
  assert.equal(serialized.includes("sk-proj-s70-secret"), false);
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

  const leftoverAuditRows = withSqliteDatabase(dbPath, (db) => ({
    eventLog: auditRowCount(db, "event_log", result.sessionId),
    aiProposals: auditRowCount(db, "ai_change_proposals", result.sessionId)
  }));
  assert.deepEqual(leftoverAuditRows, { eventLog: 0, aiProposals: 0 });
});

test("dual-mode S67 scale regression records large fixture, prompt strategy, paging, repair and timing", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-s67-scale-${randomUUID()}.sqlite`);
  t.after(() => removeSqliteArtifacts(dbPath));

  const result = await runScaleRegressionAcceptance({ sqliteDatabasePath: dbPath });
  const serialized = JSON.stringify(result);

  assert.equal(result.fixture.size, "large");
  assert.equal(result.fixture.metrics.cities >= 300, true);
  assert.equal(result.fixture.metrics.npcs >= 2000, true);
  assert.equal(result.fixture.metrics.promptRetrievalRows >= 10000, true);
  assert.equal(result.fixture.metrics.hiddenCanaries >= 250, true);
  assert.equal(result.fixture.metrics.routeViewRows.cities < result.fixture.metrics.cities, true);
  assert.equal(result.promptStrategy.ordinary.profile, "ordinary");
  assert.equal(result.promptStrategy.ordinary.selectedRows <= result.promptStrategy.ordinary.maxRows, true);
  assert.equal(result.promptStrategy.ordinary.serializedChars <= result.promptStrategy.ordinary.maxChars, true);
  assert.equal(result.promptStrategy.high.profile, "high");
  assert.equal(result.promptStrategy.high.selectedRows <= result.promptStrategy.high.maxRows, true);
  assert.equal(result.promptStrategy.high.serializedChars <= result.promptStrategy.high.maxChars, true);
  assert.equal(result.informationPanel.source, "route_view_projection");
  assert.equal(result.informationPanel.pageCount, 5);
  assert.equal(result.informationPanel.activePageItems <= result.informationPanel.pageSize, true);
  assert.equal(result.fixturePages.promptRows.pageSize <= 50, true);
  assert.equal(result.fixturePages.hiddenQueryMatches, 0);
  assert.equal(result.sqliteRepair.skipped, false);
  assert.equal(result.sqliteRepair.beforeRepairPromptRows, 0);
  assert.equal(result.sqliteRepair.afterRepairPromptRows, result.sqliteRepair.expectedPromptRows);
  assert.equal(result.eventArchive.pageItems <= result.eventArchive.pageSize, true);

  for (const [key, threshold] of Object.entries(S67_SCALE_ACCEPTANCE_THRESHOLDS)) {
    assert.equal(Number.isFinite(result.performance[key]), true, key);
    assert.equal(result.performance[key] >= 0, true, key);
    if (Number.isFinite(threshold)) {
      assert.equal(result.performance[key] <= threshold, true, key);
    }
  }
  assert.equal(result.performance.fixtureBuildMs >= result.performance.rawFixtureGenerationMs, true);
  assert.equal(result.performance.fixtureGenerationMs, undefined);

  assert.equal(serialized.includes("S60_PRIVATE_"), false);
  assert.equal(serialized.includes("SEALED_S59_"), false);
  assert.equal(serialized.includes("prompt_retrieval_index"), false);
  assert.equal(serialized.includes("event_log"), false);
  assert.equal(serialized.includes("sk-s60-private-canary-token"), false);
});
