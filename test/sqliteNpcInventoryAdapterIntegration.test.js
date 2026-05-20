const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const { createNpcActiveRequest } = require("../src/game/npcActiveRequests");
const { recordNpcInteraction } = require("../src/game/npcInteractions");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const {
  exportSafeSqliteDiagnostics
} = require("../src/storage/sqliteMaintenance");

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
  const database = new DatabaseSync(dbPath);
  try {
    return task(database);
  } finally {
    database.close();
  }
}

function countRows(database, tableName, sessionId) {
  return database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`)
    .get(sessionId).count;
}

function buildWorldState() {
  const worldState = createInitialState({
    role: "magistrate",
    playerName: "派生表知县"
  });
  worldState.player.localTreasury = 80;
  const delegated = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩。",
    budget: 24
  });
  assert.equal(delegated.ok, true);
  recordNpcInteraction(worldState, {
    npcId: "npc:magistrate:registrar-lu",
    actionType: "talk",
    utterance: "先核东乡鱼鳞册。"
  }, {
    npcId: "npc:magistrate:registrar-lu",
    dialogueText: "陆知事拱手回禀，称须带册下乡复核。",
    mood: "谨慎",
    followUpSuggestions: ["给票帖", "拨经费"]
  });
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:adapter:test",
    silverDelta: 0,
    offerSummary: "议买纸张与粮价消息。"
  }, {
    tradeId: "trade:adapter:test",
    npcResponse: "韩员外称可按市价再议。",
    proposal: {
      status: "countered",
      publicSummary: "暂作还价记录。",
      riskTags: ["需核价"]
    }
  });
  createNpcActiveRequest(worldState, "bribe");
  return worldState;
}

test("S81.4 SQLite adapter syncs, repairs, deletes and reports NPC/inventory derived tables", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const dbPath = path.join(dataDir, `test-sqlite-npc-inventory-adapter-${randomUUID()}.sqlite`);
  const adapter = createSqliteSessionAdapter({ databasePath: dbPath });
  const worldState = buildWorldState();
  t.after(async () => {
    adapter.close();
    await removeSqliteArtifacts(dbPath);
  });

  await adapter.writeSession(JSON.parse(JSON.stringify(worldState)));

  withSqliteDatabase(dbPath, (database) => {
    assert.ok(countRows(database, "asset_resource_accounts", worldState.sessionId) > 0);
    assert.ok(countRows(database, "asset_long_term_assets", worldState.sessionId) > 0);
    assert.ok(countRows(database, "inventory_containers", worldState.sessionId) > 0);
    assert.ok(countRows(database, "inventory_items", worldState.sessionId) > 0);
    assert.ok(countRows(database, "npc_roster_profiles", worldState.sessionId) > 0);
    assert.ok(countRows(database, "npc_interaction_events", worldState.sessionId) > 0);
    assert.ok(countRows(database, "npc_active_requests", worldState.sessionId) > 0);
    assert.ok(countRows(database, "delegated_tasks", worldState.sessionId) > 0);
    assert.ok(countRows(database, "trade_ledger_records", worldState.sessionId) > 0);
    const diagnostics = exportSafeSqliteDiagnostics(database, { sessionId: worldState.sessionId });
    assert.equal(diagnostics.indexHealth.ok, true);
    const domains = diagnostics.derivedTableDrift.sessions[0].domains;
    assert.equal(domains.assetLedger.needsRepair, false);
    assert.equal(domains.inventoryLedger.needsRepair, false);
    assert.equal(domains.npcInteractions.needsRepair, false);
  });

  withSqliteDatabase(dbPath, (database) => {
    database.prepare("DELETE FROM inventory_items WHERE session_id = ?").run(worldState.sessionId);
    assert.equal(countRows(database, "inventory_items", worldState.sessionId), 0);
  });

  await adapter.readSessionRecord(worldState.sessionId);
  withSqliteDatabase(dbPath, (database) => {
    assert.ok(countRows(database, "inventory_items", worldState.sessionId) > 0);
  });

  await adapter.deleteSession(worldState.sessionId);
  withSqliteDatabase(dbPath, (database) => {
    for (const tableName of [
      "asset_resource_accounts",
      "asset_long_term_assets",
      "inventory_containers",
      "inventory_items",
      "npc_roster_profiles",
      "npc_interaction_events",
      "npc_active_requests",
      "delegated_tasks",
      "trade_ledger_records"
    ]) {
      assert.equal(countRows(database, tableName, worldState.sessionId), 0, `${tableName} should be deleted`);
    }
  });
});
