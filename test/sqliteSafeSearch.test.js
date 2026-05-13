const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { SAFE_WORLD_SEARCH_SOURCE } = require("../src/game/safeWorldSearch");
const { createSessionRecord } = require("../src/storage/sessionRecord");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const {
  detectSqliteFts5Support,
  getSafeSearchRepairStatus,
  getSafeSearchTableCount,
  hasSafeSearchFtsTable,
  initializeSafeSearchTables,
  searchSafeSearchTables,
  syncSafeSearchTables
} = require("../src/storage/sqliteSafeSearchTables");

const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");
const dataDir = path.join(__dirname, "..", "data");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

function createHarness(t) {
  const dbPath = path.join(dataDir, `test-safe-search-${randomUUID()}.sqlite`);
  const adapter = createSqliteSessionAdapter({ databasePath: dbPath });
  t.after(async () => {
    adapter.close();
    await removeSqliteArtifacts(dbPath);
  });
  return { adapter, dbPath };
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

function createSearchWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "检索御史"
  });
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    taxRate: 68,
    corruption: 88,
    borderThreat: 88,
    armyMorale: 34,
    publicOrder: 26,
    turnCount: 7
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.eventHistory = [
    "户部催核京杭漕运北段账册，命本任先查北京仓储。",
    "山海关边报称辽东粮道风声趋紧。"
  ];
  worldState.worldPeople.npcs.push({
    id: "npc-safe-search-gu",
    name: "顾衡",
    visibility: "public",
    knownToPlayer: true,
    rankLabel: "候补主簿",
    publicSummary: "顾衡在北京递送户部钱粮消息。",
    reputation: 50,
    influence: 40,
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.npcs.push({
    id: "npc-safe-search-hidden",
    name: "SEALED_SQLITE_SAFE_SEARCH_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_SQLITE_SAFE_SEARCH_INTENT",
    hiddenNotes: ["SEALED_SQLITE_SAFE_SEARCH_NOTE"]
  });
  return worldState;
}

test("S71.3 SQLite safe search syncs searchable snippets and uses FTS5 when available", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  await adapter.writeSession(clone(worldState));

  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "顾衡",
    domain: "people",
    pageSize: 5
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.query, "顾衡");
  assert.equal(result.source, SAFE_WORLD_SEARCH_SOURCE);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].sourceId, "npc-safe-search-gu");
  assert.equal(result.storage.ftsAvailable, withSqliteDatabase(dbPath, (db) => hasSafeSearchFtsTable(db)));
  assert.doesNotMatch(serialized, /SEALED_SQLITE_SAFE_SEARCH|event_log|ai_change_proposals|world_sessions|prompt_retrieval_index|safe_search_index|safe_search_fts|sk-/);

  const rowCount = withSqliteDatabase(dbPath, (db) =>
    getSafeSearchTableCount(db, worldState.sessionId)
  );
  assert.ok(rowCount > 0);
});

test("S71.3 SQLite safe search fallback works when FTS5 mirror is disabled", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, () => {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    const ftsSupported = detectSqliteFts5Support(db);
    const ftsEnabled = initializeSafeSearchTables(db, { forceFts5Disabled: true });
    const worldState = createSearchWorldState();
    const record = createSessionRecord(worldState, {
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
      revision: 1
    });
    syncSafeSearchTables(db, record);

    const result = searchSafeSearchTables(db, worldState.sessionId, "北京", {
      domain: "geography",
      pageSize: 3
    });

    assert.equal(ftsEnabled, false);
    assert.equal(hasSafeSearchFtsTable(db), false);
    assert.equal(result.storage.ftsAvailable, false);
    assert.equal(result.storage.engine, "like");
    assert.ok(result.results.some((item) => item.sourceId === "city-beijing"));
    assert.doesNotMatch(JSON.stringify(result), /safe_search_index|safe_search_fts/);
    assert.equal(typeof ftsSupported, "boolean");
  } finally {
    db.close();
  }
});

test("S71.3 SQLite safe search repairs same-row pollution before search", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE safe_search_index
        SET title = ?,
            summary = ?,
            search_text = ?
        WHERE session_id = ?
          AND source_id = ?
      `)
      .run(
        "SEALED_SQLITE_SAFE_SEARCH_TAMPER",
        "SEALED_SQLITE_SAFE_SEARCH_TAMPER prompt_retrieval_index event_log sk-test-safe-search",
        "SEALED_SQLITE_SAFE_SEARCH_TAMPER prompt_retrieval_index event_log sk-test-safe-search",
        worldState.sessionId,
        "npc-safe-search-gu"
      );
    if (hasSafeSearchFtsTable(db)) {
      db
        .prepare("UPDATE safe_search_fts SET search_text = ? WHERE session_id = ? AND row_id LIKE ?")
        .run(
          "SEALED_SQLITE_SAFE_SEARCH_TAMPER prompt_retrieval_index event_log sk-test-safe-search",
          worldState.sessionId,
          "%npc-safe-search-gu"
        );
    }
  });

  await adapter.readSessionRecord(worldState.sessionId);
  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "顾衡",
    domain: "people",
    pageSize: 5
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.results.length, 1);
  assert.match(serialized, /顾衡/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_SAFE_SEARCH_TAMPER|sk-test-safe-search|event_log|prompt_retrieval_index/);

  const stored = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_id = ?")
      .get(worldState.sessionId, "npc-safe-search-gu")
  );
  assert.doesNotMatch(JSON.stringify(stored), /SEALED_SQLITE_SAFE_SEARCH_TAMPER/);
});

test("S71.3 SQLite safe search repairs missing rows from world_state_json, not raw tables or audit rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare("UPDATE geo_cities SET public_summary = ? WHERE session_id = ? AND row_id = ?")
      .run(
        "SEALED_SQLITE_RAW_SAFE_SEARCH_CITY event_log prompt_retrieval_index",
        worldState.sessionId,
        "city-beijing"
      );
    db
      .prepare("DELETE FROM safe_search_index WHERE session_id = ? AND source_id = ?")
      .run(worldState.sessionId, "city-beijing");
    if (hasSafeSearchFtsTable(db)) {
      db
        .prepare("DELETE FROM safe_search_fts WHERE session_id = ? AND row_id LIKE ?")
        .run(worldState.sessionId, "%city-beijing");
    }
    db
      .prepare(`
        INSERT INTO event_log (
          event_id, session_id, audit_schema_version, revision, turn_count, year, month,
          ten_day_period, scene_cadence, source_system, event_type, visibility, summary,
          related_json, applied_changes_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        `audit-${randomUUID()}`,
        worldState.sessionId,
        1,
        1,
        worldState.turnCount,
        worldState.year,
        worldState.month,
        worldState.tenDayPeriod,
        "global_turn",
        "manual_probe",
        "probe",
        "public",
        "SEALED_SQLITE_AUDIT_SAFE_SEARCH provider proposal prompt",
        "{}",
        "{}",
        "2026-05-13T00:00:00.000Z"
      );
  });

  await adapter.readSessionRecord(worldState.sessionId);
  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "北京",
    domain: "geography",
    pageSize: 5
  });
  const serialized = JSON.stringify(result);

  assert.ok(result.results.some((item) => item.sourceId === "city-beijing"));
  assert.doesNotMatch(serialized, /SEALED_SQLITE_RAW_SAFE_SEARCH_CITY|SEALED_SQLITE_AUDIT_SAFE_SEARCH|event_log|prompt_retrieval_index|provider proposal/);

  const status = withSqliteDatabase(dbPath, (db) => {
    const record = createSessionRecord(worldState, {
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
      revision: 1
    });
    return getSafeSearchRepairStatus(db, record);
  });
  assert.equal(status.needsRepair, false);
});
