const test = require("node:test");
const assert = require("node:assert/strict");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createDeterministicInitialAssetLedger, writeAssetLedgerState } = require("../src/game/assetLedger");
const { createItemFromTemplate, createDeterministicInitialInventoryLedger, writeInventoryLedgerState } = require("../src/game/inventoryLedger");
const { ensureNpcRoster } = require("../src/game/npcRoster");
const { createLandSurveyDelegatedTask, updateDelegatedTaskStatus } = require("../src/game/delegatedTasks");
const { createSessionRecord } = require("../src/storage/sessionRecord");
const {
  buildAssetRows,
  deleteAssetRows,
  ensureAssetTablesForRecord,
  getAssetRepairStatus,
  initializeAssetTables,
  syncAssetTables
} = require("../src/storage/sqliteAssetTables");
const {
  buildInventoryRows,
  deleteInventoryRows,
  ensureInventoryTablesForRecord,
  getInventoryRepairStatus,
  initializeInventoryTables,
  syncInventoryTables
} = require("../src/storage/sqliteInventoryTables");
const {
  buildNpcInteractionRows,
  deleteNpcInteractionRows,
  ensureNpcInteractionTablesForRecord,
  getNpcInteractionRepairStatus,
  initializeNpcInteractionTables,
  syncNpcInteractionTables
} = require("../src/storage/sqliteNpcInteractionTables");

const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

function withMemoryDatabase(task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    return task(db);
  } finally {
    db.close();
  }
}

function allDerivedRows(db, sessionId) {
  const tables = [
    "asset_resource_accounts",
    "asset_long_term_assets",
    "inventory_containers",
    "inventory_items",
    "npc_roster_profiles",
    "npc_interaction_events",
    "delegated_tasks",
    "trade_ledger_records"
  ];
  return tables.flatMap((table) => db.prepare(`SELECT '${table}' AS table_name, * FROM ${table} WHERE session_id = ?`).all(sessionId));
}

function createWorldState() {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  worldState.turnCount = 6;
  worldState.year = 1644;
  worldState.month = 3;
  worldState.tenDayPeriod = 2;
  worldState.player.localTreasury = 80;

  const assetLedger = createDeterministicInitialAssetLedger({ role: "magistrate", playerActorId: "player" });
  assetLedger.assets.push({
    assetId: "asset:player:hidden-vault",
    assetType: "estate",
    name: "SEALED_SQLITE_ASSET_HIDDEN",
    ownerActorId: "player",
    visibility: "hidden",
    hiddenDossier: "SEALED_SQLITE_ASSET_DOSSIER",
    provenance: [{ ref: "/mnt/e/secret-assets.json", label: "sk-test-sqlite-assets", turn: 0 }]
  });
  assetLedger.assets.push({
    assetId: "asset:player:polluted-shop",
    assetType: "shop",
    name: "raw_ledger world_sessions /mnt/e/asset sk-test-sqlite-assets",
    ownerActorId: "player",
    locationRef: "prompt_retrieval_index provider proposal"
  });
  writeAssetLedgerState(worldState, assetLedger, { ownerActorId: "player" });

  const inventoryLedger = createDeterministicInitialInventoryLedger({ role: "magistrate", playerActorId: "player" });
  inventoryLedger.items.push(createItemFromTemplate("book_law_code", {
    ownerActorId: "player",
    itemId: "item:player:law-code",
    containerId: "container:player:personal",
    provenance: [{ ref: "visible:law-code", label: "县署书库", turn: 1 }]
  }).item);
  inventoryLedger.items.push(createItemFromTemplate("forged_seal", {
    ownerActorId: "player",
    itemId: "item:player:hidden-forged-seal",
    containerId: "container:player:home_storage",
    provenance: [{ ref: "hidden/private/raw/path/key/token", label: "hiddenDossier sk-test-sqlite-item", turn: 1 }]
  }).item);
  writeInventoryLedgerState(worldState, inventoryLedger, { ownerActorId: "player" });

  ensureNpcRoster(worldState);
  const task = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩。",
    budget: 24
  });
  assert.equal(task.ok, true);
  updateDelegatedTaskStatus(worldState, task.task.taskId, "completed", {
    result: {
      summary: "东乡丈量初清，册实差额待复核。",
      outcome: "completed",
      followUpActionRefs: ["followup:review-land-register"]
    },
    aiNarrativeProposal: "raw provider proposal hiddenDossier sk-test-sqlite-task",
    auditRefs: ["audit:delegated-task:1"]
  });
  worldState.npcInteractionLedger = {
    events: [{
      eventId: "npc-interaction:registrar-lu:talk-1",
      npcId: "npc:magistrate:registrar-lu",
      actionType: "talk",
      outcome: "recorded",
      summary: "陆知事回禀东乡丈量需补查鱼鳞册。",
      refs: ["delegated-task:1"],
      rawProviderPayload: "SEALED_SQLITE_RAW_PROVIDER"
    }, {
      eventId: "npc-interaction:hidden",
      npcId: "npc:magistrate:registrar-lu",
      actionType: "talk",
      summary: "hiddenDossier private raw path sk-test-sqlite-npc"
    }]
  };
  worldState.tradeLedger = {
    records: [{
      tradeId: "trade:book-gift:1",
      status: "settled",
      actorAId: "player",
      actorBId: "npc:magistrate:registrar-lu",
      tradeType: "gift",
      summary: "赠予书吏纸张，登记为人情往来。",
      itemRefs: ["item:player:paper"],
      rawLedger: "SEALED_SQLITE_RAW_TRADE"
    }, {
      tradeId: "trade:hidden",
      status: "settled",
      actorAId: "player",
      actorBId: "npc:magistrate:registrar-lu",
      tradeType: "gift",
      summary: "prompt provider /mnt/e/secret sk-test-sqlite-trade"
    }]
  };

  return worldState;
}

test("S81.4 SQLite NPC/inventory derived table modules initialize, sync, and delete safe rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, () => withMemoryDatabase((db) => {
  const worldState = createWorldState();
  const record = createSessionRecord(worldState, {
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    revision: 7
  });

  initializeAssetTables(db);
  initializeInventoryTables(db);
  initializeNpcInteractionTables(db);
  syncAssetTables(db, record);
  syncInventoryTables(db, record);
  syncNpcInteractionTables(db, record);

  const expectedCount = buildAssetRows(record).resourceAccounts.length +
    buildAssetRows(record).longTermAssets.length +
    buildInventoryRows(record).containers.length +
    buildInventoryRows(record).items.length +
    buildNpcInteractionRows(record).npcProfiles.length +
    buildNpcInteractionRows(record).npcInteractionEvents.length +
    buildNpcInteractionRows(record).delegatedTasks.length +
    buildNpcInteractionRows(record).tradeLedgerRecords.length;
  const rows = allDerivedRows(db, record.sessionId);
  const serialized = JSON.stringify(rows);

  assert.equal(rows.length, expectedCount);
  assert.ok(rows.length > 0);
  assert.match(serialized, /清丈知县|寒窗书斋|县印|陆知事|东乡丈量|赠予书吏纸张/);
  assert.ok(rows.some((row) =>
    row.table_name === "trade_ledger_records" &&
    row.actor_a_id === "player" &&
    row.actor_b_id === "npc:magistrate:registrar-lu"
  ));
  assert.doesNotMatch(serialized, /SEALED_SQLITE|hiddenDossier|privateSignalTags|rawProviderPayload|rawLedger|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|ai_change_proposals|event_log|provider|proposal|prompt|\/mnt\/e|sk-test|token|api[_ -]?key/i);
  assert.ok(rows.every((row) => JSON.parse(row.metadata_json).contentHash));

  assert.equal(getAssetRepairStatus(db, record).needsRepair, false);
  assert.equal(getInventoryRepairStatus(db, record).needsRepair, false);
  assert.equal(getNpcInteractionRepairStatus(db, record).needsRepair, false);

  deleteNpcInteractionRows(db, record.sessionId);
  deleteInventoryRows(db, record.sessionId);
  deleteAssetRows(db, record.sessionId);
  assert.equal(allDerivedRows(db, record.sessionId).length, 0);
}));

test("S81.4 SQLite derived table repair status detects count, stale revision, row id, and content hash drift", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, () => withMemoryDatabase((db) => {
  const record = createSessionRecord(createWorldState(), {
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    revision: 3
  });

  initializeAssetTables(db);
  initializeInventoryTables(db);
  initializeNpcInteractionTables(db);
  syncAssetTables(db, record);
  syncInventoryTables(db, record);
  syncNpcInteractionTables(db, record);

  db.prepare(`
    DELETE FROM inventory_items
    WHERE rowid = (
      SELECT rowid FROM inventory_items WHERE session_id = ? LIMIT 1
    )
  `).run(record.sessionId);
  assert.equal(getInventoryRepairStatus(db, record).missingOrMismatched, true);
  assert.equal(ensureInventoryTablesForRecord(db, record), true);
  assert.equal(getInventoryRepairStatus(db, record).needsRepair, false);

  db.prepare("UPDATE asset_resource_accounts SET revision = ? WHERE session_id = ?").run(2, record.sessionId);
  assert.equal(getAssetRepairStatus(db, record).staleRows, true);
  assert.equal(ensureAssetTablesForRecord(db, record), true);
  assert.equal(getAssetRepairStatus(db, record).needsRepair, false);

  const firstNpc = db.prepare("SELECT row_id FROM npc_roster_profiles WHERE session_id = ? LIMIT 1").get(record.sessionId);
  db.prepare("UPDATE npc_roster_profiles SET row_id = ? WHERE session_id = ? AND row_id = ?")
    .run("npc:tampered-row-id", record.sessionId, firstNpc.row_id);
  assert.equal(getNpcInteractionRepairStatus(db, record).mismatchedRowIds, true);
  assert.equal(ensureNpcInteractionTablesForRecord(db, record), true);
  assert.equal(getNpcInteractionRepairStatus(db, record).needsRepair, false);

  db.prepare("UPDATE inventory_containers SET summary = ? WHERE session_id = ?")
    .run("篡改后的容器摘要", record.sessionId);
  const status = getInventoryRepairStatus(db, record);
  assert.equal(status.contentMismatches, true);
  assert.equal(ensureInventoryTablesForRecord(db, record), true);
  assert.equal(getInventoryRepairStatus(db, record).needsRepair, false);
}));
