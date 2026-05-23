const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { createInitialState } = require("../src/game/initialState");
const { createLandSurveyDelegatedTask } = require("../src/game/delegatedTasks");
const {
  createNpcActiveRequest,
  resolveNpcActiveRequest,
  runNpcActiveRequestStep
} = require("../src/game/npcActiveRequests");
const { applyWorldEntityInfluences } = require("../src/game/worldEntities");
const { resolveTradeRequest } = require("../src/game/tradeLedger");
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
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "sqlite-safe-search:market:grain:SEALED_SOURCE",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "县中平抑米价，粮商愿照牌价出售。",
      publicSourceId: "market:grain:sqlite-public-source",
      stateDelta: { publicOrder: 3, treasury: -20 },
      playerDelta: { performanceMerit: 1 },
      evidenceRefs: ["market:grain:SEALED_SOURCE"],
      auditRecord: { rawSql: "select * from hidden_table" },
      appliedAtTurn: worldState.turnCount
    }]
  };
  return worldState;
}

function addEconomyTraceFixtures(worldState) {
  worldState.player.role = "magistrate";
  worldState.player.localTreasury = 120;
  worldState.npcEconomyLedger.recentEvents = [
    "人情债月账：韩员外为修桥垫付，公开人情债略增。"
  ];
  resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:stored:economy",
    silverDelta: 0,
    offerSummary: "询问纸张与粟米行价。"
  }, {
    npcResponse: "可再议。",
    proposal: {
      status: "countered",
      publicSummary: "韩员外交易议价：纸张与粮价消息尚待服务器确认。",
      riskTags: ["议价"]
    }
  });
  createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });
  return worldState;
}

function makeHighVolumeDomainRecord(sourceType, index, turnBase) {
  const titlePrefix = {
    city_policy: "地方索引后果",
    military_diplomacy: "军务索引后果",
    judicial_case: "刑名索引后果"
  }[sourceType];
  const title = `${titlePrefix}${index}`;
  return {
    outcomeId: `${sourceType}-sqlite-cap-${index}`,
    policyType: "market_regulation",
    policyLabel: title,
    resolverKind: sourceType === "military_diplomacy" ? "military" : undefined,
    actionKind: sourceType === "military_diplomacy" ? "resupply" : undefined,
    actionLabel: title,
    caseAction: sourceType === "judicial_case" ? "mediate" : undefined,
    status: "accepted",
    publicSummary: `${title}进入安全检索 cap 回归。`,
    stateDelta: sourceType === "military_diplomacy"
      ? { armyMorale: index % 2, borderThreat: -1 }
      : { publicOrder: index % 3 },
    playerDelta: sourceType === "military_diplomacy"
      ? { supply: 1 }
      : { performanceMerit: 1 },
    appliedAtTurn: turnBase + index
  };
}

function createHighVolumeDomainSearchWorldState() {
  const worldState = createSearchWorldState();
  worldState.turnCount = 120;
  worldState.cityPolicyLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeDomainRecord("city_policy", index + 1, 70)
    )
  };
  worldState.militaryDiplomacyLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeDomainRecord("military_diplomacy", index + 1, 80)
    )
  };
  worldState.judicialCaseLedger = {
    records: Array.from({ length: 6 }, (_, index) =>
      makeHighVolumeDomainRecord("judicial_case", index + 1, 90)
    )
  };
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

test("S88.6 SQLite safe search syncs public domain consequence rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  await adapter.writeSession(clone(worldState));

  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "平抑米价",
    domain: "events",
    pageSize: 5
  });
  const serialized = JSON.stringify(result);

  assert.ok(result.results.some((item) =>
    item.sourceView === "domainConsequenceView.recentConsequences" && /平抑米价/.test(`${item.title}${item.snippet}`)
  ));
  assert.doesNotMatch(
    serialized,
    /SEALED_|cityPolicyLedger|evidenceRefs|stateDelta|playerDelta|auditRecord|rawSql|market:grain|safe_search_index|safe_search_fts|world_sessions/
  );

  const storedRows = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT source_view, source_id, title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_view = ?")
      .all(worldState.sessionId, "domainConsequenceView.recentConsequences")
  );
  assert.equal(storedRows.length >= 1, true);
  assert.doesNotMatch(
    JSON.stringify(storedRows),
    /SEALED_|cityPolicyLedger|evidenceRefs|stateDelta|playerDelta|auditRecord|rawSql|market:grain|world_sessions/
  );
});

test("S88.7 SQLite safe search syncs NPC follow-up evidence rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  worldState.turnCount = 14;
  const bribe = createNpcActiveRequest(worldState, "bribe");
  const introduction = createNpcActiveRequest(worldState, "introduction");
  assert.equal(bribe.ok, true);
  assert.equal(introduction.ok, true);
  resolveNpcActiveRequest(worldState, bribe.request.requestId, "report");
  resolveNpcActiveRequest(worldState, introduction.request.requestId, "accept");
  worldState.turnCount = 15;
  runNpcActiveRequestStep(worldState, "续办廉政线索：拒收留痕并呈报，不收财物。");
  await adapter.writeSession(clone(worldState));

  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "廉政 watchlist",
    domain: "events",
    pageSize: 5
  });
  const storedRows = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT source_view, source_id, title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_view = ?")
      .all(worldState.sessionId, "npcActiveRequestView.followUpEvidence")
  );

  assert.ok(result.results.some((item) =>
    item.sourceView === "npcActiveRequestView.followUpEvidence" && /廉政|watchlist/.test(`${item.title}${item.snippet}`)
  ));
  assert.ok(storedRows.some((row) => /廉政|watchlist/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.ok(storedRows.some((row) => /引荐|拜会/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.doesNotMatch(
    JSON.stringify({ result, storedRows }),
    /SEALED_|npcActiveRequestLedger|hiddenDossier|privateSignalTags|providerPayload|provider_payload|safe_search_index|safe_search_fts|state_patch|world_sessions|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.7 SQLite safe search syncs world entity impact rows from safe projection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createSearchWorldState();
  worldState.turnCount = 27;
  applyWorldEntityInfluences(worldState, [
    {
      entityId: "academy-same-year-circle",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:debate:27",
      metricsDelta: { trust: 2, pressure: -1 },
      publicNote: "论道余波进入同年文社"
    },
    {
      entityId: "court-censorate",
      sourceType: "active_npc_request",
      sourceId: "data/sessions/rawLedger-providerPayload-safe_search_index",
      metricsDelta: { pressure: 2 },
      publicNote: "来函后续已登记为风宪证据观察"
    }
  ]);
  await adapter.writeSession(clone(worldState));

  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "论道 同年文社",
    domain: "events",
    pageSize: 5
  });
  const storedRows = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT source_view, source_id, title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_view = ?")
      .all(worldState.sessionId, "worldEntityView.recentImpacts")
  );

  assert.ok(result.results.some((item) =>
    item.sourceView === "worldEntityView.recentImpacts" && /论道余波|同年文社/.test(`${item.title}${item.snippet}`)
  ));
  assert.ok(storedRows.some((row) => /论道余波|同年文社/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.ok(storedRows.some((row) => /风宪|证据观察/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.doesNotMatch(
    JSON.stringify({ result, storedRows }),
    /SEALED_|data\/sessions|rawLedger|providerPayload|provider_payload|hiddenDossier|privateSignalTags|safe_search_index|safe_search_fts|state_patch|world_sessions|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.8 SQLite safe search syncs economy trace rows from world state projection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = addEconomyTraceFixtures(createInitialState({
    role: "magistrate",
    playerName: "经济检索库"
  }));
  worldState.turnCount = 24;
  await adapter.writeSession(clone(worldState));

  const trade = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "韩员外 交易议价",
    domain: "reports",
    pageSize: 5
  });
  const debt = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "人情债 月账",
    domain: "reports",
    pageSize: 5
  });
  const storedRows = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT source_view, source_id, title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_view = ?")
      .all(worldState.sessionId, "economyTraceView.traceItems")
  );

  assert.ok(trade.results.some((item) =>
    item.sourceView === "economyTraceView.traceItems" && /交易议价|韩员外/.test(`${item.title}${item.snippet}`)
  ));
  assert.ok(debt.results.some((item) =>
    item.sourceView === "economyTraceView.traceItems" && /人情债|月账/.test(`${item.title}${item.snippet}`)
  ));
  assert.ok(storedRows.some((row) => /交易议价|韩员外/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.ok(storedRows.some((row) => /东乡清丈|委派预算/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.ok(storedRows.some((row) => /粟米|市价/.test(`${row.title}${row.summary}${row.search_text}`)));
  assert.doesNotMatch(
    JSON.stringify({ trade, debt, storedRows }),
    /SEALED_|assetLedger|resourceLedger|inventoryLedger|tradeLedger|delegatedTaskLedger|marketPriceLedger|npcEconomyLedger|evidenceRefs|resourceDelta|relationshipSignals|safe_search_index|safe_search_fts|world_sessions|sqlite|SQLite|SQL|sk-[A-Za-z0-9_-]{6,}|\/mnt\/e/
  );
});

test("S88.6 SQLite safe search stores only capped public domain consequence rows under high volume", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createHighVolumeDomainSearchWorldState();
  await adapter.writeSession(clone(worldState));

  const result = await adapter.searchSafeSearchIndex(worldState.sessionId, {
    query: "刑名索引后果6",
    domain: "events",
    pageSize: 5
  });
  const serialized = JSON.stringify(result);

  assert.ok(result.results.some((item) =>
    item.sourceView === "domainConsequenceView.recentConsequences" && /刑名索引后果6/.test(`${item.title}${item.snippet}`)
  ));

  const storedRows = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT source_view, source_id, title, summary, search_text FROM safe_search_index WHERE session_id = ? AND source_view = ?")
      .all(worldState.sessionId, "domainConsequenceView.recentConsequences")
  );
  assert.equal(storedRows.length, 8);
  assert.equal(storedRows.some((row) => /地方索引后果/.test(`${row.title}${row.summary}${row.search_text}`)), false);
  assert.equal(storedRows.some((row) => /军务索引后果[12]|刑名索引后果[12]/.test(`${row.title}${row.summary}${row.search_text}`)), false);
  assert.doesNotMatch(
    JSON.stringify({ result, storedRows }),
    /SEALED_|cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|evidenceRefs|stateDelta|playerDelta|auditRecord|rawSql|sqlite-cap|safe_search_index|safe_search_fts|world_sessions/
  );
  assert.doesNotMatch(serialized, /地方索引后果|军务索引后果[12]|刑名索引后果[12]/);
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
