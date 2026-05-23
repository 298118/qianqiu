const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const { buildOfficialPostingsView } = require("../src/game/officialPostings");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
const { buildWorldPeopleView } = require("../src/game/worldPeople");
const {
  buildWorldPeopleEventBatch,
  snapshotWorldPeopleForEvents
} = require("../src/game/worldPeopleEvents");
const { applyWorldEntityInfluences } = require("../src/game/worldEntities");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");
const dataDir = path.join(__dirname, "..", "data");

function buildWorldState(overrides = {}) {
  const worldState = createInitialState({
    playerName: overrides.playerName || "Adapter Tester",
    year: overrides.year || 1601,
    role: overrides.role || "scholar"
  });

  Object.assign(worldState, overrides.worldState);
  Object.assign(worldState.player, overrides.player);
  if (overrides.sessionId) worldState.sessionId = overrides.sessionId;
  if (overrides.month) worldState.month = overrides.month;
  if (overrides.tenDayPeriod !== undefined) worldState.tenDayPeriod = overrides.tenDayPeriod;
  if (overrides.turnCount !== undefined) worldState.turnCount = overrides.turnCount;
  return worldState;
}

function addVisiblePeopleRows(worldState) {
  worldState.worldPeople ||= {};
  worldState.worldPeople.npcs ||= [];
  worldState.worldPeople.households ||= [];
  worldState.worldPeople.assets ||= [];
  worldState.worldPeople.estates ||= [];
  worldState.worldPeople.relationships ||= [];

  worldState.worldPeople.npcs.push({
    id: "npc-visible-gu",
    name: "顾衡",
    courtesyName: "子平",
    genderLabel: "男",
    age: 41,
    currentCityId: "city-beijing",
    householdId: "hh-visible-gu",
    rankLabel: "候补主簿",
    influence: 36,
    reputation: 48,
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾衡常在京师替乡党通递消息。",
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.households.push({
    id: "hh-visible-gu",
    familyName: "顾",
    seatCityId: "city-beijing",
    wealthScore: 46,
    landMu: 230,
    prestige: 42,
    memberNpcIds: ["npc-visible-gu"],
    estateIds: ["estate-visible-gu"],
    assetIds: ["asset-visible-gu"],
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾氏在京师有几处分号和近郊薄田。",
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.assets.push({
    id: "asset-visible-gu",
    kind: "shop",
    name: "顾氏纸铺",
    ownerType: "household",
    ownerId: "hh-visible-gu",
    cityId: "city-beijing",
    valueEstimate: 180,
    annualIncomeEstimate: 24,
    statusLabel: "照常营生",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾氏纸铺供应考棚常用纸墨。",
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.estates.push({
    id: "estate-visible-gu",
    name: "顾氏京郊薄田",
    ownerType: "household",
    ownerId: "hh-visible-gu",
    cityId: "city-beijing",
    regionId: "region-north-zhili",
    landMu: 230,
    tenantHouseholds: 9,
    rentGrainEstimate: 36,
    status: "held",
    statusLabel: "自有",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾氏京郊薄田收成平稳。",
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.relationships.push({
    id: "rel-npc-visible-gu-household-visible-gu",
    sourceType: "npc",
    sourceId: "npc-visible-gu",
    targetType: "household",
    targetId: "hh-visible-gu",
    relationship: 72,
    trust: 70,
    resentment: 4,
    stance: "家门支柱",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾衡被顾氏族中倚为京师支点。",
    lastUpdatedTurn: worldState.turnCount
  });
}

function addHiddenPeopleRows(worldState) {
  worldState.worldPeople ||= {};
  worldState.worldPeople.npcs ||= [];
  worldState.worldPeople.assets ||= [];
  worldState.worldPeople.relationships ||= [];

  worldState.worldPeople.npcs.push({
    id: "npc-hidden-storage",
    name: "SEALED_PEOPLE_NPC_TOKEN",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_PEOPLE_INTENT_TOKEN",
    hiddenNotes: ["SEALED_PEOPLE_NOTE_TOKEN"]
  });
  worldState.worldPeople.assets.push({
    id: "asset-hidden-storage",
    kind: "cash",
    name: "SEALED_PEOPLE_ASSET_TOKEN",
    ownerType: "npc",
    ownerId: "npc-hidden-storage",
    visibility: "hidden",
    knownToPlayer: false
  });
  worldState.worldPeople.relationships.push({
    id: "rel-hidden-storage",
    sourceType: "npc",
    sourceId: "npc-hidden-storage",
    targetType: "player",
    targetId: "P1",
    relationship: -80,
    resentment: 95,
    visibility: "hidden",
    knownToPlayer: false,
    recentNotes: ["SEALED_PEOPLE_RELATION_TOKEN"]
  });
  worldState.worldPeople.relationships.push({
    id: "rel-player-npc-C01",
    sourceType: "player",
    sourceId: "P1",
    targetType: "npc",
    targetId: "C01",
    relationship: -80,
    resentment: 95,
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_PEOPLE_SAME_ID_PUBLIC",
    recentNotes: ["SEALED_PEOPLE_SAME_ID_RELATION_TOKEN"]
  });
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true, recursive: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true, recursive: true });
  const entries = await fs.readdir(sessionsDir).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(`${sessionId}.`) && entry.endsWith(".tmp"))
      .map((entry) => fs.rm(path.join(sessionsDir, entry), { force: true }))
  );
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

async function readJsonRecord(sessionId) {
  const raw = await fs.readFile(path.join(sessionsDir, `${sessionId}.json`), "utf8");
  return JSON.parse(raw);
}

async function writeJsonRecord(sessionId, value) {
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionsDir, `${sessionId}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function buildEnvelope(adapter, worldState, overrides = {}) {
  return {
    storageSchemaVersion: adapter.CURRENT_STORAGE_SCHEMA_VERSION,
    sessionId: worldState.sessionId,
    createdAt: overrides.createdAt || "2026-05-07T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-05-07T00:01:00.000Z",
    revision: overrides.revision || 1,
    metadata: {
      ...adapter.buildSessionMetadata(worldState),
      ...overrides.metadata
    },
    worldState
  };
}

function createJsonHarness(t) {
  const trackedSessionIds = new Set();
  t.after(async () => {
    await Promise.all([...trackedSessionIds].map((sessionId) => removeSessionArtifacts(sessionId)));
  });
  return {
    name: "JSON",
    adapter: createJsonSessionAdapter(),
    trackSession(sessionId) {
      trackedSessionIds.add(sessionId);
    }
  };
}

function createSqliteHarness(t) {
  const dbPath = path.join(dataDir, `test-session-store-${randomUUID()}.sqlite`);
  const adapter = createSqliteSessionAdapter({ databasePath: dbPath });
  t.after(async () => {
    adapter.close();
    await removeSqliteArtifacts(dbPath);
  });
  return {
    name: "SQLite",
    adapter,
    dbPath,
    trackSession() {}
  };
}

const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");
const harnesses = [
  ["JSON", createJsonHarness, false],
  [
    "SQLite",
    createSqliteHarness,
    hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
  ]
];

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return task(db);
  } finally {
    db.close();
  }
}

function readSqliteGeographyCounts(db, sessionId) {
  return {
    countries: db.prepare("SELECT COUNT(*) AS count FROM geo_countries WHERE session_id = ?").get(sessionId).count,
    regions: db.prepare("SELECT COUNT(*) AS count FROM geo_regions WHERE session_id = ?").get(sessionId).count,
    cities: db.prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ?").get(sessionId).count,
    routes: db.prepare("SELECT COUNT(*) AS count FROM geo_routes WHERE session_id = ?").get(sessionId).count,
    frontierZones: db.prepare("SELECT COUNT(*) AS count FROM geo_frontier_zones WHERE session_id = ?").get(sessionId).count,
    officeJurisdictions: db.prepare("SELECT COUNT(*) AS count FROM geo_office_jurisdictions WHERE session_id = ?").get(sessionId).count
  };
}

function readSqlitePeopleCounts(db, sessionId) {
  return {
    npcs: db.prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ?").get(sessionId).count,
    households: db.prepare("SELECT COUNT(*) AS count FROM people_households WHERE session_id = ?").get(sessionId).count,
    assets: db.prepare("SELECT COUNT(*) AS count FROM people_assets WHERE session_id = ?").get(sessionId).count,
    estates: db.prepare("SELECT COUNT(*) AS count FROM people_estates WHERE session_id = ?").get(sessionId).count,
    relationships: db.prepare("SELECT COUNT(*) AS count FROM people_relationships WHERE session_id = ?").get(sessionId).count
  };
}

function readSqliteOfficialPostingCounts(db, sessionId) {
  return {
    bureaus: db.prepare("SELECT COUNT(*) AS count FROM office_bureaus WHERE session_id = ?").get(sessionId).count,
    offices: db.prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ?").get(sessionId).count,
    cityJurisdictions: db.prepare("SELECT COUNT(*) AS count FROM office_city_jurisdictions WHERE session_id = ?").get(sessionId).count,
    postings: db.prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ?").get(sessionId).count,
    assessmentRecords: db.prepare("SELECT COUNT(*) AS count FROM office_assessments WHERE session_id = ?").get(sessionId).count,
    transferRecords: db.prepare("SELECT COUNT(*) AS count FROM office_transfers WHERE session_id = ?").get(sessionId).count
  };
}

function readSqliteEventArchiveCount(db, sessionId) {
  return db.prepare("SELECT COUNT(*) AS count FROM event_archive_index WHERE session_id = ?").get(sessionId).count;
}

function normalizeForStableJson(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeForStableJson(entry));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = normalizeForStableJson(value[key]);
      return normalized;
    }, {});
}

function hashSqliteEventArchiveRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(JSON.stringify(normalizeForStableJson(comparable))).digest("hex");
}

function sumSqliteGeographyCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function sumSqlitePeopleCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function sumSqliteOfficialPostingCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function cloneSqliteRow(db, tableName, sessionId, patch) {
  const base = db.prepare(`SELECT * FROM ${tableName} WHERE session_id = ? LIMIT 1`).get(sessionId);
  assert.ok(base, `${tableName} should have a source row to clone`);
  const row = { ...base, ...patch };
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  db
    .prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...columns.map((column) => row[column]));
}

function clonePeopleRow(db, tableName, sessionId, patch) {
  cloneSqliteRow(db, tableName, sessionId, patch);
}

for (const [adapterName, createHarness, skip] of harnesses) {
  test(`${adapterName} storage adapter exposes the session-store contract surface`, { skip }, (t) => {
    const { adapter } = createHarness(t);
    const methods = [
      "readSession",
      "readSessionRecord",
      "writeSession",
      "mutateSession",
      "listSessions",
      "deleteSession",
      "cleanupSessionTempFiles",
      "appendAuditEvent",
      "appendAiProposal",
      "listAuditEvents",
      "listAiProposals",
      "buildSessionMetadata",
      "normalizeSessionRecord"
    ];

    assert.equal(adapter.name, adapterName.toLowerCase());
    for (const method of methods) {
      assert.equal(typeof adapter[method], "function", `${method} should be implemented`);
    }
  });

  test(`${adapterName} storage adapter contract: write/read keeps routes on worldState only`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "契约读写",
      year: 1602,
      month: 5,
      tenDayPeriod: 2,
      turnCount: 6,
      player: { gold: 33 }
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);
    const loaded = await adapter.readSession(worldState.sessionId);
    const { record } = await adapter.readSessionRecord(worldState.sessionId);

    assert.deepEqual(loaded, worldState);
    assert.equal(loaded.storageSchemaVersion, undefined);
    assert.equal(loaded.revision, undefined);
    assert.equal(loaded.metadata, undefined);
    assert.equal(record.storageSchemaVersion, adapter.CURRENT_STORAGE_SCHEMA_VERSION);
    assert.equal(record.sessionId, worldState.sessionId);
    assert.equal(record.metadata.playerName, "契约读写");
    assert.equal(record.metadata.tenDayPeriod, 2);
    assert.ok(record.revision >= 1);
  });

  test(`${adapterName} storage adapter contract: missing tenDayPeriod is normalized`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "旧档时间",
      year: 1603,
      month: 8,
      turnCount: 4
    });
    delete worldState.tenDayPeriod;
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);
    const loaded = await adapter.readSession(worldState.sessionId);
    const { record } = await adapter.readSessionRecord(worldState.sessionId);

    assert.equal(loaded.tenDayPeriod, 1);
    assert.equal(record.metadata.tenDayPeriod, 1);
  });

  test(`${adapterName} storage adapter contract: worldPeople view and prompt stay player-visible`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "人物视图一致",
      role: "official",
      turnCount: 8
    });
    addVisiblePeopleRows(worldState);
    addHiddenPeopleRows(worldState);
    trackSession(worldState.sessionId);

    const expectedView = buildWorldPeopleView(worldState);
    const expectedPrompt = assemblePromptContext(worldState, {
      playerAction: "拜访顾氏纸铺，探听京师人情",
      task: "turn"
    }).worldPeople;

    await adapter.writeSession(worldState);
    const loaded = await adapter.readSession(worldState.sessionId);
    const loadedView = buildWorldPeopleView(loaded);
    const loadedPrompt = assemblePromptContext(loaded, {
      playerAction: "拜访顾氏纸铺，探听京师人情",
      task: "turn"
    }).worldPeople;
    const serialized = JSON.stringify({ loadedView, loadedPrompt });

    assert.deepEqual(loadedView, expectedView);
    assert.deepEqual(loadedPrompt, expectedPrompt);
    assert.match(serialized, /顾衡/);
    assert.doesNotMatch(serialized, /SEALED_PEOPLE_/);
  });

  test(`${adapterName} storage adapter contract: officialPostings view and prompt stay player-visible`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "任所视图一致",
      role: "official",
      turnCount: 8
    });
    worldState.officialPostings.postings.push({
      id: "posting-hidden-storage",
      officeId: "ministry_revenue_principal",
      officeTitle: "SEALED_OFFICE_POSTING_TITLE",
      bureauId: "ministry_revenue",
      holderType: "npc",
      holderId: "npc-hidden-storage",
      status: "active",
      visibility: "hidden",
      knownToPlayer: false,
      publicSummary: "SEALED_OFFICE_POSTING_PUBLIC",
      hiddenNotes: ["SEALED_OFFICE_POSTING_NOTE"]
    });
    trackSession(worldState.sessionId);

    const expectedView = buildOfficialPostingsView(worldState);
    const expectedPrompt = assemblePromptContext(worldState, {
      playerAction: "查阅本任考成与官署职责",
      task: "official_career"
    }).officialPostings;

    await adapter.writeSession(worldState);
    const loaded = await adapter.readSession(worldState.sessionId);
    const loadedView = buildOfficialPostingsView(loaded);
    const loadedPrompt = assemblePromptContext(loaded, {
      playerAction: "查阅本任考成与官署职责",
      task: "official_career"
    }).officialPostings;
    const serialized = JSON.stringify({
      loadedView,
      loadedPrompt,
      retrievalOffices: assemblePromptContext(loaded, {
        playerAction: "查阅本任考成与官署职责",
        task: "official_career"
      }).retrievalContext.offices
    });

    assert.deepEqual(loadedView, expectedView);
    assert.deepEqual(loadedPrompt, expectedPrompt);
    assert.match(serialized, /吏部|六部观政进士|任免/);
    assert.doesNotMatch(serialized, /SEALED_OFFICE_POSTING/);
    assert.doesNotMatch(serialized, /npc-hidden-storage/);
  });

  test(`${adapterName} storage adapter contract: listSessions redacts metadata`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const visible = buildWorldState({
      playerName: "可见存档",
      year: 1604,
      month: 9,
      tenDayPeriod: 3,
      turnCount: 12,
      player: {
        role: "official",
        roleLabel: "入仕官员",
        examRank: "进士",
        officeTitle: "县令"
      }
    });
    visible.relationshipLedger = {
      schemaVersion: 1,
      contacts: {
        "C-hidden-contract": {
          id: "C-hidden-contract",
          name: "密线人物",
          visibility: "hidden"
        }
      }
    };
    trackSession(visible.sessionId);

    await adapter.writeSession(visible);

    const result = await adapter.listSessions();
    const save = result.saves.find((entry) => entry.sessionId === visible.sessionId);

    assert.ok(save);
    assert.equal(save.playerName, "可见存档");
    assert.equal(save.role, "official");
    assert.equal(save.tenDayPeriod, 3);
    assert.equal(save.examRank, "进士");
    assert.equal(save.officeTitle, "县令");
    assert.equal(save.worldState, undefined);
    assert.equal(save.relationshipLedger, undefined);
    assert.equal(save.hiddenRelationshipId, undefined);
    assert.ok(!JSON.stringify(save).includes("C-hidden-contract"));
    assert.ok(!JSON.stringify(save).includes("密线人物"));
  });

  test(`${adapterName} storage adapter contract: expectedRevision rejects stale writes`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "版本冲突",
      player: { gold: 10 }
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);
    const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);

    const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
    staleWorldState.player.gold = 77;
    const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
    latestWorldState.player.gold = 88;
    await adapter.writeSession(latestWorldState);

    await assert.rejects(
      () =>
        adapter.writeSession(staleWorldState, {
          previousRecord: staleRecord,
          expectedRevision: staleRecord.revision
        }),
      (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
    );

    const loaded = await adapter.readSession(worldState.sessionId);
    assert.equal(loaded.player.gold, 88);
  });

  test(`${adapterName} storage adapter contract: mutateSession serializes overlapping writes`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "并发写入",
      player: { gold: 10 }
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);

    await Promise.all(
      [1, 2, 3].map((amount) =>
        adapter.mutateSession(worldState.sessionId, async (draft) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          draft.player.gold += amount;
          draft.eventHistory.push(`adapter mutation +${amount}`);
          return draft;
        })
      )
    );

    const loaded = await adapter.readSession(worldState.sessionId);
    const { record } = await adapter.readSessionRecord(worldState.sessionId);

    assert.equal(loaded.player.gold, 16);
    assert.deepEqual(
      loaded.eventHistory.slice(-3),
      ["adapter mutation +1", "adapter mutation +2", "adapter mutation +3"]
    );
    assert.ok(record.revision >= 4);
  });

  test(`${adapterName} storage adapter contract: mutateSession skipWrite preserves the stored revision`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "跳过写入",
      player: { gold: 10 }
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);
    const { record: before } = await adapter.readSessionRecord(worldState.sessionId);

    const result = await adapter.mutateSession(worldState.sessionId, async (draft, context) => {
      draft.player.gold = 99;
      context.appendAuditEvent({
        sourceSystem: "contract_test",
        eventType: "skip_write",
        summary: "skipWrite 不应写审计"
      });
      context.appendAiProposal({
        provider: "mock",
        proposalKind: "skip_write",
        status: "accepted",
        proposal: { note: "skipWrite 不应写 proposal" }
      });
      context.skipWrite = true;
      return { goldSeenByRoute: draft.player.gold };
    });
    const { record: after } = await adapter.readSessionRecord(worldState.sessionId);
    const events = await adapter.listAuditEvents(worldState.sessionId);
    const proposals = await adapter.listAiProposals(worldState.sessionId);

    assert.deepEqual(result, { goldSeenByRoute: 99 });
    assert.equal(after.revision, before.revision);
    assert.equal(after.worldState.player.gold, 10);
    assert.equal(events.length, 0);
    assert.equal(proposals.length, 0);
  });

  test(`${adapterName} storage adapter contract: mutateSession can write before surfacing a route error`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "写后报错",
      player: { gold: 10 }
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);

    await assert.rejects(
      () =>
        adapter.mutateSession(worldState.sessionId, async (draft, context) => {
          draft.eventHistory.push("已记录错过考期");
          context.errorAfterWrite = Object.assign(new Error("考期已过"), { statusCode: 409 });
          return null;
        }),
      (error) => error.statusCode === 409 && error.message === "考期已过"
    );

    const loaded = await adapter.readSession(worldState.sessionId);
    assert.ok(loaded.eventHistory.includes("已记录错过考期"));
  });

  test(`${adapterName} storage adapter contract: audit logs append redacted events and proposals`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-proj-audit-secret-123456";
    t.after(() => {
      if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAiKey;
    });
    const worldState = buildWorldState({
      playerName: "审计契约",
      turnCount: 3
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState, {
      auditEvents: [{
        sourceSystem: "contract_test",
        eventType: "state_changed",
        visibility: "developer",
        summary: `写入 E:\\LSMNQ\\data\\sessions\\${worldState.sessionId}.json，密钥 sk-proj-audit-secret-123456`,
        related: {
          publicNote: "可见摘要",
          hiddenNotes: "密线人物不应露出"
        },
        appliedChanges: {
          player: { academia: { before: 10, after: 12 } },
          worldState: { relationshipLedger: "不应落盘" }
        }
      }],
      aiProposals: [{
        provider: "mock",
        promptPack: "world_turn",
        proposalKind: "turn",
        status: "rejected",
        proposal: {
          statePatch: {
            player: {
              examRank: "进士",
              hiddenToken: "SEALED_PLAYER_AUDIT_TOKEN"
            },
            worldState: { hiddenToken: "SEALED_AUDIT_TOKEN" }
          }
        },
        accepted: {},
        rejectedReasons: ["statePatch.player.examRank 由服务器拒绝。"]
      }]
    });

    const events = await adapter.listAuditEvents(worldState.sessionId);
    const proposals = await adapter.listAiProposals(worldState.sessionId);
    const serialized = JSON.stringify({ events, proposals });

    assert.equal(events.length, 1);
    assert.equal(proposals.length, 1);
    assert.equal(events[0].revision, 1);
    assert.equal(events[0].turnCount, 3);
    assert.equal(events[0].tenDayPeriod, 1);
    assert.equal(events[0].visibility, "developer");
    assert.equal(proposals[0].status, "rejected");
    assert.equal(proposals[0].proposal.statePatch.player.examRank, "进士");
    assert.equal(serialized.includes("sk-proj-audit-secret-123456"), false);
    assert.equal(serialized.includes("audit-secret"), false);
    assert.equal(serialized.includes("E:\\LSMNQ"), false);
    assert.equal(serialized.includes("SEALED_AUDIT_TOKEN"), false);
    assert.equal(serialized.includes("SEALED_PLAYER_AUDIT_TOKEN"), false);
    assert.equal(serialized.includes("密线人物"), false);
    assert.equal(proposals[0].proposal.statePatch.player.hiddenToken, "[redacted]");
    assert.equal(proposals[0].proposal.statePatch.worldState, "[redacted]");
  });

  test(`${adapterName} storage adapter contract: deleteSession removes a saved session`, { skip }, async (t) => {
    const { adapter, trackSession } = createHarness(t);
    const worldState = buildWorldState({
      playerName: "删除存档"
    });
    trackSession(worldState.sessionId);

    await adapter.writeSession(worldState);
    await adapter.deleteSession(worldState.sessionId);

    await assert.rejects(
      () => adapter.readSession(worldState.sessionId),
      (error) => error.statusCode === 404 && /not found/i.test(error.message)
    );
  });
}

test("SQLite storage adapter syncs geography business tables with the session row", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理业务表",
    year: 1644,
    month: 2,
    tenDayPeriod: 2,
    turnCount: 5,
    worldState: {
      borderThreat: 88
    }
  });

  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteGeographyCounts(db, worldState.sessionId);
    const ming = db
      .prepare("SELECT source, seed_row_id, revision, row_revision, last_updated_turn, metadata_json FROM geo_countries WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "country-ming");
    const beijing = db
      .prepare("SELECT metadata_json FROM geo_cities WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "city-beijing");
    const hiddenRoute = db
      .prepare("SELECT visibility, hidden_notes_json FROM geo_routes WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "route-hidden-liaodong-smuggling");
    const mingMetadata = JSON.parse(ming.metadata_json);
    const beijingMetadata = JSON.parse(beijing.metadata_json);

    assert.equal(counts.countries, worldState.worldGeography.countries.length);
    assert.equal(counts.regions, worldState.worldGeography.regions.length);
    assert.equal(counts.cities, worldState.worldGeography.cities.length);
    assert.equal(counts.routes, worldState.worldGeography.routes.length);
    assert.equal(counts.frontierZones, worldState.worldGeography.frontierZones.length);
    assert.equal(counts.officeJurisdictions, worldState.worldGeography.officeJurisdictions.length);
    assert.equal(ming.source, "seed");
    assert.equal(ming.seed_row_id, "country-ming");
    assert.equal(ming.revision, 1);
    assert.equal(ming.row_revision, 1);
    assert.equal(ming.last_updated_turn, 5);
    assert.equal(typeof mingMetadata.s61CountryDepth.fiscalPressure, "number");
    assert.equal(typeof mingMetadata.s61CountryDepth.militaryReadiness, "number");
    assert.equal(typeof beijingMetadata.s61CityDepth.taxBase, "number");
    assert.equal(typeof beijingMetadata.s61CityDepth.waterworksIntegrity, "number");
    assert.equal(hiddenRoute.visibility, "hidden");
    assert.match(hiddenRoute.hidden_notes_json, /SEALED_ROUTE_NOTE/);
  });
});

test("SQLite storage adapter repairs missing geography business rows from world_state_json on read", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理修复",
    turnCount: 2
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    const sessionRow = db
      .prepare("SELECT world_state_json FROM world_sessions WHERE session_id = ?")
      .get(worldState.sessionId);
    const storedWorldState = JSON.parse(sessionRow.world_state_json);
    delete storedWorldState.worldGeography;
    db
      .prepare("UPDATE world_sessions SET world_state_json = ? WHERE session_id = ?")
      .run(JSON.stringify(storedWorldState), worldState.sessionId);
    db.prepare("DELETE FROM geo_cities WHERE session_id = ?").run(worldState.sessionId);
    const afterDelete = db.prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ?").get(worldState.sessionId);
    assert.equal(afterDelete.count, 0);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const repaired = db.prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ?").get(worldState.sessionId);
    const sessionRow = db
      .prepare("SELECT world_state_json FROM world_sessions WHERE session_id = ?")
      .get(worldState.sessionId);
    const repairedWorldState = JSON.parse(sessionRow.world_state_json);

    assert.equal(repaired.count, record.worldState.worldGeography.cities.length);
    assert.equal(repairedWorldState.worldGeography.cities.length, record.worldState.worldGeography.cities.length);
  });
});

test("SQLite storage adapter repairs mismatched geography row ids when counts still match", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理错行修复",
    turnCount: 3
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare("UPDATE geo_cities SET row_id = ? WHERE session_id = ? AND row_id = ?")
      .run("city-corrupt-extra", worldState.sessionId, "city-beijing");
    const counts = readSqliteGeographyCounts(db, worldState.sessionId);
    const expectedCount = worldState.worldGeography.cities.length;
    const oldRow = db
      .prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "city-beijing");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "city-corrupt-extra");

    assert.equal(counts.cities, expectedCount);
    assert.equal(oldRow.count, 0);
    assert.equal(corruptRow.count, 1);
  });

  await adapter.readSessionRecord(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteGeographyCounts(db, worldState.sessionId);
    const repairedRow = db
      .prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "city-beijing");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "city-corrupt-extra");

    assert.equal(counts.cities, worldState.worldGeography.cities.length);
    assert.equal(repairedRow.count, 1);
    assert.equal(corruptRow.count, 0);
  });
});

test("SQLite storage adapter advances geography row revisions during mutateSession", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理变更",
    turnCount: 1,
    worldState: {
      borderThreat: 58
    }
  });
  await adapter.writeSession(worldState);
  const { record: before } = await adapter.readSessionRecord(worldState.sessionId);

  await adapter.mutateSession(worldState.sessionId, (draft) => {
    draft.turnCount = 9;
    draft.borderThreat = 96;
    delete draft.worldGeography;
  });

  const { record: after } = await adapter.readSessionRecord(worldState.sessionId);
  assert.equal(after.revision, before.revision + 1);

  withSqliteDatabase(dbPath, (db) => {
    const frontier = db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, pressure, status
        FROM geo_frontier_zones
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "frontier-shanhai-liaodong");

    assert.equal(frontier.revision, after.revision);
    assert.equal(frontier.row_revision, after.revision);
    assert.equal(frontier.last_updated_turn, 9);
    assert.equal(frontier.pressure, 96);
    assert.equal(frontier.status, "contested");
  });
});

test("SQLite storage adapter does not rewrite geography rows after stale expectedRevision rejection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理版本冲突",
    turnCount: 2,
    worldState: {
      borderThreat: 60
    }
  });
  await adapter.writeSession(worldState);
  const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);

  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.turnCount = 7;
  latestWorldState.borderThreat = 91;
  delete latestWorldState.worldGeography;
  await adapter.writeSession(latestWorldState);

  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.turnCount = 12;
  staleWorldState.borderThreat = 20;
  delete staleWorldState.worldGeography;

  const beforeReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, pressure
        FROM geo_frontier_zones
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "frontier-shanhai-liaodong")
  );

  await assert.rejects(
    () =>
      adapter.writeSession(staleWorldState, {
        previousRecord: staleRecord,
        expectedRevision: staleRecord.revision
      }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const afterReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, pressure
        FROM geo_frontier_zones
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "frontier-shanhai-liaodong")
  );

  assert.deepEqual(afterReject, beforeReject);
});

test("SQLite storage adapter syncs geography rows on import and delete", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理导入",
    turnCount: 4
  });
  const envelope = buildEnvelope(adapter, worldState, { revision: 6 });

  const imported = await adapter.importSessionRecord(envelope, { overwrite: true });
  assert.equal(imported.revision, 6);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteGeographyCounts(db, worldState.sessionId);
    const ming = db
      .prepare("SELECT revision, row_revision FROM geo_countries WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "country-ming");

    assert.equal(counts.countries, imported.worldState.worldGeography.countries.length);
    assert.ok(sumSqliteGeographyCounts(counts) > 0);
    assert.equal(ming.revision, 6);
    assert.equal(ming.row_revision, 6);
  });

  await adapter.deleteSession(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const session = db.prepare("SELECT COUNT(*) AS count FROM world_sessions WHERE session_id = ?").get(worldState.sessionId);
    const counts = readSqliteGeographyCounts(db, worldState.sessionId);

    assert.equal(session.count, 0);
    assert.equal(sumSqliteGeographyCounts(counts), 0);
  });
});

test("SQLite storage adapter keeps worldGeographyView parity with the normalized world state", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "地理视图一致",
    role: "official",
    worldState: {
      borderThreat: 95,
      corruption: 80
    }
  });
  await adapter.writeSession(worldState);

  const loaded = await adapter.readSession(worldState.sessionId);
  const expectedView = buildWorldGeographyView(worldState);
  const sqliteView = buildWorldGeographyView(loaded);
  const serializedView = JSON.stringify(sqliteView);

  assert.deepEqual(sqliteView, expectedView);
  assert.doesNotMatch(serializedView, /SEALED_ROUTE_NOTE/);
  assert.doesNotMatch(serializedView, /frontier-hidden-palace-intel/);
});

test("SQLite storage adapter syncs official posting business tables with the session row", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职业务表",
    role: "official",
    turnCount: 5
  });
  addVisiblePeopleRows(worldState);
  worldState.officialPostings.postings.push({
    id: "posting-visible-npc-gu",
    officeId: "ministry_revenue_principal",
    officeTitle: "户部主事",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-visible-gu",
    status: "active",
    cityId: "city-beijing",
    regionId: "region-north-zhili",
    visibility: "role_visible",
    knownToPlayer: true,
    publicSummary: "顾衡暂署户部文案。",
    lastUpdatedTurn: 5
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-sqlite-source",
    officeId: "ministry_revenue_principal",
    officeTitle: "SEALED_OFFICE_SQLITE_TITLE",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-hidden-storage",
    status: "active",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_OFFICE_SQLITE_PUBLIC",
    hiddenNotes: ["SEALED_OFFICE_SQLITE_NOTE"]
  });

  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const bureau = db
      .prepare(`
        SELECT source, catalog_row_id, revision, row_revision, last_updated_turn, visibility
        FROM office_bureaus
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "ministry_personnel");
    const office = db
      .prepare(`
        SELECT source, bureau_row_id, title, normal_term_months
        FROM office_catalog
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "probationary_observer");
    const playerPosting = db
      .prepare(`
        SELECT source, holder_type, holder_id, holder_people_row_id, office_row_id, office_title, bureau_row_id, city_row_id
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current");
    const npcPosting = db
      .prepare(`
        SELECT holder_type, holder_id, holder_people_row_id, office_row_id
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-visible-npc-gu");
    const hiddenRows = db
      .prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ? AND office_title LIKE ?")
      .get(worldState.sessionId, "SEALED_OFFICE_SQLITE_%");

    assert.equal(counts.bureaus, worldState.officialPostings.bureaus.length);
    assert.equal(counts.offices, worldState.officialPostings.offices.length);
    assert.equal(counts.cityJurisdictions, worldState.officialPostings.cityJurisdictions.length);
    assert.equal(counts.postings, worldState.officialPostings.postings.length);
    assert.equal(counts.assessmentRecords, worldState.officialPostings.assessmentRecords.length);
    assert.equal(counts.transferRecords, worldState.officialPostings.transferRecords.length);
    assert.equal(bureau.source, "official_catalog");
    assert.equal(bureau.catalog_row_id, "ministry_personnel");
    assert.equal(bureau.revision, 1);
    assert.equal(bureau.row_revision, 1);
    assert.equal(bureau.last_updated_turn, 5);
    assert.equal(bureau.visibility, "public");
    assert.equal(office.source, "official_catalog");
    assert.equal(office.bureau_row_id, "ministry_personnel");
    assert.equal(office.title, "六部观政进士");
    assert.equal(office.normal_term_months, 0);
    assert.equal(playerPosting.source, "official_career");
    assert.equal(playerPosting.holder_type, "player");
    assert.equal(playerPosting.holder_id, "P1");
    assert.equal(playerPosting.holder_people_row_id, null);
    assert.equal(playerPosting.office_row_id, "probationary_observer");
    assert.equal(playerPosting.office_title, "六部观政进士");
    assert.equal(playerPosting.bureau_row_id, "ministry_personnel");
    assert.equal(playerPosting.city_row_id, "city-beijing");
    assert.equal(npcPosting.holder_type, "npc");
    assert.equal(npcPosting.holder_id, "npc-visible-gu");
    assert.equal(npcPosting.holder_people_row_id, "npc-visible-gu");
    assert.equal(npcPosting.office_row_id, "ministry_revenue_principal");
    assert.equal(hiddenRows.count, 0);
  });
});

test("SQLite storage adapter repairs hidden raw office rows and missing visible bridge rows from world_state_json on read", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职修复",
    role: "official",
    turnCount: 2
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    cloneSqliteRow(db, "office_postings", worldState.sessionId, {
      row_id: "posting-hidden-raw-sqlite",
      catalog_row_id: "ministry_revenue_principal",
      source: "raw_hidden_test",
      visibility: "hidden",
      known_to_player: 0,
      office_title: "SEALED_SQLITE_OFFICE_RAW",
      holder_type: "npc",
      holder_id: "npc-hidden-storage",
      holder_people_row_id: "npc-hidden-storage",
      public_summary: "SEALED_SQLITE_OFFICE_PUBLIC",
      hidden_notes_json: "[\"SEALED_SQLITE_OFFICE_NOTE\"]"
    });
    db.prepare("DELETE FROM office_postings WHERE session_id = ? AND row_id = ?")
      .run(worldState.sessionId, "posting-player-current");

    const hidden = db
      .prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-hidden-raw-sqlite");
    const missingPosting = db
      .prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");

    assert.equal(hidden.count, 1);
    assert.equal(missingPosting.count, 0);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const promptContext = assemblePromptContext(record.worldState, {
    playerAction: "查阅本任官职簿",
    task: "official_career"
  });
  const serialized = JSON.stringify({
    officialPostings: record.worldState.officialPostings,
    officialPostingsView: buildOfficialPostingsView(record.worldState),
    promptOfficialPostings: promptContext.officialPostings,
    retrievalOffices: promptContext.retrievalContext.offices
  });

  assert.doesNotMatch(serialized, /SEALED_SQLITE_OFFICE_/);
  assert.doesNotMatch(serialized, /npc-hidden-storage/);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const hidden = db
      .prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-hidden-raw-sqlite");
    const repairedPosting = db
      .prepare("SELECT holder_type, holder_id, office_row_id FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");

    assert.equal(counts.postings, record.worldState.officialPostings.postings.length);
    assert.equal(hidden.count, 0);
    assert.equal(repairedPosting.holder_type, "player");
    assert.equal(repairedPosting.holder_id, "P1");
    assert.equal(repairedPosting.office_row_id, "probationary_observer");
  });
});

test("SQLite storage adapter repairs mismatched office row ids when counts still match", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职错行修复",
    role: "official",
    turnCount: 3
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare("UPDATE office_catalog SET row_id = ? WHERE session_id = ? AND row_id = ?")
      .run("office-corrupt-extra", worldState.sessionId, "probationary_observer");
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const oldRow = db
      .prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "probationary_observer");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "office-corrupt-extra");

    assert.equal(counts.offices, worldState.officialPostings.offices.length);
    assert.equal(oldRow.count, 0);
    assert.equal(corruptRow.count, 1);
  });

  await adapter.readSessionRecord(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const repairedRow = db
      .prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "probationary_observer");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "office-corrupt-extra");

    assert.equal(counts.offices, worldState.officialPostings.offices.length);
    assert.equal(repairedRow.count, 1);
    assert.equal(corruptRow.count, 0);
  });
});

test("SQLite storage adapter repairs tampered official posting contents when ids and revisions still match", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职内容修复",
    role: "official",
    turnCount: 4
  });
  addHiddenPeopleRows(worldState);
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE office_postings
        SET office_title = ?,
            holder_type = ?,
            holder_id = ?,
            holder_people_row_id = ?,
            city_row_id = ?,
            region_row_id = ?,
            jurisdiction_row_id = ?,
            public_summary = ?
        WHERE session_id = ? AND row_id = ?
      `)
      .run(
        "SEALED_SQLITE_OFFICE_TAMPER_TITLE",
        "npc",
        "npc-hidden-storage",
        "npc-hidden-storage",
        "city-hidden-posting",
        "region-north-zhili",
        "jurisdiction-hidden-posting-city",
        "SEALED_SQLITE_OFFICE_TAMPER_PUBLIC",
        worldState.sessionId,
        "posting-player-current"
      );
    db
      .prepare(`
        UPDATE office_city_jurisdictions
        SET city_row_id = ?,
            route_row_ids_json = ?,
            frontier_zone_row_ids_json = ?,
            public_summary = ?
        WHERE session_id = ? AND row_id = ?
      `)
      .run(
        "city-hidden-posting",
        "[\"route-hidden-liaodong-smuggling\"]",
        "[\"frontier-hidden-palace-intel\"]",
        "SEALED_SQLITE_JURISDICTION_TAMPER_PUBLIC",
        worldState.sessionId,
        "jurisdiction-ministry-personnel-capital-city-beijing"
      );

    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const posting = db
      .prepare(`
        SELECT revision, row_revision, office_title, holder_id, holder_people_row_id
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current");
    const jurisdiction = db
      .prepare(`
        SELECT city_row_id, route_row_ids_json, frontier_zone_row_ids_json
        FROM office_city_jurisdictions
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "jurisdiction-ministry-personnel-capital-city-beijing");

    assert.equal(counts.postings, worldState.officialPostings.postings.length);
    assert.equal(counts.cityJurisdictions, worldState.officialPostings.cityJurisdictions.length);
    assert.equal(posting.revision, 1);
    assert.equal(posting.row_revision, 1);
    assert.equal(posting.office_title, "SEALED_SQLITE_OFFICE_TAMPER_TITLE");
    assert.equal(posting.holder_id, "npc-hidden-storage");
    assert.equal(posting.holder_people_row_id, "npc-hidden-storage");
    assert.equal(jurisdiction.city_row_id, "city-hidden-posting");
    assert.match(jurisdiction.route_row_ids_json, /route-hidden-liaodong-smuggling/);
    assert.match(jurisdiction.frontier_zone_row_ids_json, /frontier-hidden-palace-intel/);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const promptContext = assemblePromptContext(record.worldState, {
    playerAction: "核对官职任所",
    task: "official_career"
  });
  const serialized = JSON.stringify({
    officialPostings: record.worldState.officialPostings,
    officialPostingsView: buildOfficialPostingsView(record.worldState),
    promptOfficialPostings: promptContext.officialPostings,
    retrievalOffices: promptContext.retrievalContext.offices
  });

  assert.doesNotMatch(serialized, /SEALED_SQLITE_/);
  assert.doesNotMatch(serialized, /npc-hidden-storage/);
  assert.doesNotMatch(serialized, /city-hidden-posting/);
  assert.doesNotMatch(serialized, /route-hidden-liaodong-smuggling/);
  assert.doesNotMatch(serialized, /frontier-hidden-palace-intel/);

  withSqliteDatabase(dbPath, (db) => {
    const posting = db
      .prepare(`
        SELECT office_title, holder_type, holder_id, holder_people_row_id, city_row_id, jurisdiction_row_id, public_summary, metadata_json
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current");
    const jurisdiction = db
      .prepare(`
        SELECT city_row_id, route_row_ids_json, frontier_zone_row_ids_json, public_summary, metadata_json
        FROM office_city_jurisdictions
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "jurisdiction-ministry-personnel-capital-city-beijing");
    const postingMetadata = JSON.parse(posting.metadata_json);
    const jurisdictionMetadata = JSON.parse(jurisdiction.metadata_json);

    assert.equal(posting.office_title, "六部观政进士");
    assert.equal(posting.holder_type, "player");
    assert.equal(posting.holder_id, "P1");
    assert.equal(posting.holder_people_row_id, null);
    assert.equal(posting.city_row_id, "city-beijing");
    assert.equal(posting.jurisdiction_row_id, "jurisdiction-ministry-personnel-capital-city-beijing");
    assert.doesNotMatch(posting.public_summary, /SEALED_SQLITE_/);
    assert.equal(jurisdiction.city_row_id, "city-beijing");
    assert.equal(jurisdiction.route_row_ids_json, "[]");
    assert.equal(jurisdiction.frontier_zone_row_ids_json, "[]");
    assert.doesNotMatch(jurisdiction.public_summary, /SEALED_SQLITE_/);
    assert.match(postingMetadata.contentHash, /^[a-f0-9]{64}$/);
    assert.match(jurisdictionMetadata.contentHash, /^[a-f0-9]{64}$/);
  });
});

test("SQLite storage adapter upgrades old official posting rows without content hashes on read", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职旧行升级",
    role: "official",
    turnCount: 4
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    const posting = db
      .prepare("SELECT metadata_json FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");
    const metadata = JSON.parse(posting.metadata_json);
    delete metadata.contentHash;
    db
      .prepare("UPDATE office_postings SET metadata_json = ? WHERE session_id = ? AND row_id = ?")
      .run(JSON.stringify(metadata), worldState.sessionId, "posting-player-current");

    const oldRow = db
      .prepare("SELECT metadata_json FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");
    assert.equal(JSON.parse(oldRow.metadata_json).contentHash, undefined);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  assert.deepEqual(
    buildOfficialPostingsView(record.worldState),
    buildOfficialPostingsView(worldState)
  );

  withSqliteDatabase(dbPath, (db) => {
    const posting = db
      .prepare("SELECT office_title, holder_type, holder_id, metadata_json FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");
    const metadata = JSON.parse(posting.metadata_json);

    assert.equal(posting.office_title, "六部观政进士");
    assert.equal(posting.holder_type, "player");
    assert.equal(posting.holder_id, "P1");
    assert.match(metadata.contentHash, /^[a-f0-9]{64}$/);
  });
});

test("SQLite storage adapter advances official posting row revisions during mutateSession", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职变更",
    role: "official",
    turnCount: 1
  });
  await adapter.writeSession(worldState);
  const { record: before } = await adapter.readSessionRecord(worldState.sessionId);

  await adapter.mutateSession(worldState.sessionId, (draft) => {
    draft.turnCount = 9;
    draft.player.officeTitle = "户部主事";
    draft.player.position = "户部主事";
    draft.officialCareer.currentPosting = "户部主事";
    draft.officialCareer.bureauId = "ministry_revenue";
    draft.officialCareer.tenureMonths = 3;
    draft.officialCareer.assessmentDossier.meritScore = 72;
    draft.officialCareer.assessmentDossier.riskScore = 21;
  });

  const { record: after } = await adapter.readSessionRecord(worldState.sessionId);
  assert.equal(after.revision, before.revision + 1);

  withSqliteDatabase(dbPath, (db) => {
    const posting = db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, office_row_id, office_title, bureau_row_id, term_months
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current");
    const assessment = db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, office_row_id, bureau_row_id, merit_score, risk_score
        FROM office_assessments
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "assessment-player-current");

    assert.equal(posting.revision, after.revision);
    assert.equal(posting.row_revision, after.revision);
    assert.equal(posting.last_updated_turn, 9);
    assert.equal(posting.office_row_id, "ministry_revenue_principal");
    assert.equal(posting.office_title, "户部主事");
    assert.equal(posting.bureau_row_id, "ministry_revenue");
    assert.equal(posting.term_months, 3);
    assert.equal(assessment.revision, after.revision);
    assert.equal(assessment.row_revision, after.revision);
    assert.equal(assessment.last_updated_turn, 9);
    assert.equal(assessment.office_row_id, "ministry_revenue_principal");
    assert.equal(assessment.bureau_row_id, "ministry_revenue");
    assert.equal(assessment.merit_score, 72);
    assert.equal(assessment.risk_score, 21);
  });
});

test("SQLite storage adapter does not rewrite official posting rows after stale expectedRevision rejection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职版本冲突",
    role: "official",
    turnCount: 2
  });
  await adapter.writeSession(worldState);
  const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);

  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.turnCount = 7;
  latestWorldState.player.officeTitle = "户部主事";
  latestWorldState.player.position = "户部主事";
  latestWorldState.officialCareer.currentPosting = "户部主事";
  latestWorldState.officialCareer.bureauId = "ministry_revenue";
  latestWorldState.officialCareer.tenureMonths = 2;
  await adapter.writeSession(latestWorldState);

  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.turnCount = 12;
  staleWorldState.player.officeTitle = "兵部主事";
  staleWorldState.player.position = "兵部主事";
  staleWorldState.officialCareer.currentPosting = "兵部主事";
  staleWorldState.officialCareer.bureauId = "ministry_war";
  staleWorldState.officialCareer.tenureMonths = 8;

  const beforeReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, office_row_id, office_title, bureau_row_id, term_months
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current")
  );

  await assert.rejects(
    () =>
      adapter.writeSession(staleWorldState, {
        previousRecord: staleRecord,
        expectedRevision: staleRecord.revision
      }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const afterReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, office_row_id, office_title, bureau_row_id, term_months
        FROM office_postings
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "posting-player-current")
  );

  assert.deepEqual(afterReject, beforeReject);
});

test("SQLite storage adapter syncs official posting rows on import and delete", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "官职导入",
    role: "official",
    turnCount: 4
  });
  const envelope = buildEnvelope(adapter, worldState, { revision: 6 });

  const imported = await adapter.importSessionRecord(envelope, { overwrite: true });
  assert.equal(imported.revision, 6);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);
    const posting = db
      .prepare("SELECT revision, row_revision FROM office_postings WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "posting-player-current");

    assert.equal(counts.postings, imported.worldState.officialPostings.postings.length);
    assert.ok(sumSqliteOfficialPostingCounts(counts) > 0);
    assert.equal(posting.revision, 6);
    assert.equal(posting.row_revision, 6);
  });

  await adapter.deleteSession(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const session = db.prepare("SELECT COUNT(*) AS count FROM world_sessions WHERE session_id = ?").get(worldState.sessionId);
    const counts = readSqliteOfficialPostingCounts(db, worldState.sessionId);

    assert.equal(session.count, 0);
    assert.equal(sumSqliteOfficialPostingCounts(counts), 0);
  });
});

test("SQLite storage adapter syncs people business tables with the session row", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物业务表",
    role: "official",
    turnCount: 5
  });
  addVisiblePeopleRows(worldState);
  addHiddenPeopleRows(worldState);

  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);
    const customNpc = db
      .prepare(`
        SELECT source, revision, row_revision, last_updated_turn, visibility, hidden_intent, hidden_notes_json
        FROM people_npcs
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "npc-visible-gu");
    const asset = db
      .prepare(`
        SELECT owner_type, owner_row_id, value_estimate, annual_income_estimate
        FROM people_assets
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "asset-visible-gu");
    const legacyRelationship = db
      .prepare("SELECT recent_notes_json FROM people_relationships WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "rel-player-npc-C01");
    const hiddenRows = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND name LIKE ?")
      .get(worldState.sessionId, "SEALED_PEOPLE_%");

    assert.equal(counts.npcs, worldState.worldPeople.npcs.length);
    assert.equal(counts.households, worldState.worldPeople.households.length);
    assert.equal(counts.assets, worldState.worldPeople.assets.length);
    assert.equal(counts.estates, worldState.worldPeople.estates.length);
    assert.equal(counts.relationships, worldState.worldPeople.relationships.length);
    assert.equal(customNpc.source, "world_people_bridge");
    assert.equal(customNpc.revision, 1);
    assert.equal(customNpc.row_revision, 1);
    assert.equal(customNpc.last_updated_turn, 5);
    assert.equal(customNpc.visibility, "public");
    assert.equal(customNpc.hidden_intent, "");
    assert.equal(customNpc.hidden_notes_json, "[]");
    assert.equal(asset.owner_type, "household");
    assert.equal(asset.owner_row_id, "hh-visible-gu");
    assert.equal(asset.value_estimate, 180);
    assert.equal(asset.annual_income_estimate, 24);
    assert.doesNotMatch(legacyRelationship.recent_notes_json, /SEALED_PEOPLE_/);
    assert.equal(hiddenRows.count, 0);
  });
});

test("SQLite storage adapter repairs hidden raw people rows and missing visible bridge rows from world_state_json on read", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物修复",
    turnCount: 2
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    clonePeopleRow(db, "people_npcs", worldState.sessionId, {
      row_id: "npc-hidden-raw-sqlite",
      legacy_row_id: "npc-hidden-raw-sqlite",
      source: "raw_hidden_test",
      visibility: "hidden",
      known_to_player: 0,
      name: "SEALED_SQLITE_PEOPLE_RAW",
      public_summary: "SEALED_SQLITE_PEOPLE_PUBLIC",
      hidden_intent: "SEALED_SQLITE_PEOPLE_INTENT",
      hidden_notes_json: "[\"SEALED_SQLITE_PEOPLE_NOTE\"]"
    });
    db.prepare("DELETE FROM people_npcs WHERE session_id = ? AND row_id = ?").run(worldState.sessionId, "C01");
    db.prepare("DELETE FROM people_relationships WHERE session_id = ? AND row_id = ?").run(worldState.sessionId, "rel-player-npc-C01");

    const hidden = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "npc-hidden-raw-sqlite");
    const missingNpc = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01");

    assert.equal(hidden.count, 1);
    assert.equal(missingNpc.count, 0);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const promptContext = assemblePromptContext(record.worldState, {
    playerAction: "查访塾师近况",
    task: "turn"
  });
  const serialized = JSON.stringify({
    worldPeople: record.worldState.worldPeople,
    worldPeopleView: buildWorldPeopleView(record.worldState),
    promptPeople: promptContext.worldPeople,
    retrievalPeople: promptContext.retrievalContext.people
  });

  assert.doesNotMatch(serialized, /SEALED_SQLITE_PEOPLE_/);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);
    const hidden = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "npc-hidden-raw-sqlite");
    const repairedNpc = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01");
    const repairedRelationship = db
      .prepare("SELECT COUNT(*) AS count FROM people_relationships WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "rel-player-npc-C01");

    assert.equal(counts.npcs, record.worldState.worldPeople.npcs.length);
    assert.equal(counts.relationships, record.worldState.worldPeople.relationships.length);
    assert.equal(hidden.count, 0);
    assert.equal(repairedNpc.count, 1);
    assert.equal(repairedRelationship.count, 1);
  });
});

test("SQLite storage adapter repairs mismatched people row ids when counts still match", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物错行修复",
    turnCount: 3
  });
  await adapter.writeSession(worldState);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare("UPDATE people_npcs SET row_id = ? WHERE session_id = ? AND row_id = ?")
      .run("npc-corrupt-extra", worldState.sessionId, "C01");
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);
    const oldRow = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "npc-corrupt-extra");

    assert.equal(counts.npcs, worldState.worldPeople.npcs.length);
    assert.equal(oldRow.count, 0);
    assert.equal(corruptRow.count, 1);
  });

  await adapter.readSessionRecord(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);
    const repairedRow = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01");
    const corruptRow = db
      .prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "npc-corrupt-extra");

    assert.equal(counts.npcs, worldState.worldPeople.npcs.length);
    assert.equal(repairedRow.count, 1);
    assert.equal(corruptRow.count, 0);
  });
});

test("SQLite storage adapter advances people row revisions during mutateSession", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物变更",
    turnCount: 1
  });
  await adapter.writeSession(worldState);
  const { record: before } = await adapter.readSessionRecord(worldState.sessionId);

  await adapter.mutateSession(worldState.sessionId, (draft) => {
    draft.turnCount = 9;
    applyRelationshipChanges(draft, [{
      targetType: "character",
      targetId: "C01",
      relationshipDelta: 7,
      resentmentDelta: 3,
      reason: "同窗为其解围，情分略进。"
    }]);
  });

  const { record: after } = await adapter.readSessionRecord(worldState.sessionId);
  assert.equal(after.revision, before.revision + 1);

  withSqliteDatabase(dbPath, (db) => {
    const relationship = db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, relationship, resentment, recent_notes_json
        FROM people_relationships
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "rel-player-npc-C01");

    assert.equal(relationship.revision, after.revision);
    assert.equal(relationship.row_revision, after.revision);
    assert.equal(relationship.last_updated_turn, 9);
    assert.equal(relationship.relationship, 19);
    assert.equal(relationship.resentment, 3);
    assert.match(relationship.recent_notes_json, /同窗为其解围/);
  });
});

test("SQLite storage adapter links visible people rows to server people audit events", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物事件索引",
    turnCount: 2
  });
  await adapter.writeSession(worldState);

  await adapter.mutateSession(worldState.sessionId, (draft, context) => {
    draft.turnCount = 6;
    const previousPeople = snapshotWorldPeopleForEvents(draft);
    applyRelationshipChanges(draft, [{
      targetType: "character",
      targetId: "C01",
      relationshipDelta: 6,
      resentmentDelta: -1,
      stance: "愿意引荐",
      reason: "服务器已应用的人情变化。"
    }]);
    const peopleEvents = buildWorldPeopleEventBatch(draft, { previousPeople });
    for (const event of peopleEvents.auditEvents) context.appendAuditEvent(event);
    for (const link of peopleEvents.rowEventLinks) context.appendPeopleEventLink(link);
  });

  const events = await adapter.listAuditEvents(worldState.sessionId);
  const peopleEvent = events.find((event) =>
    event.sourceSystem === "world_people" &&
    event.eventType === "relationship_changed"
  );
  assert.ok(peopleEvent);

  let rows = withSqliteDatabase(dbPath, (db) => ({
    relationship: db
      .prepare(`
        SELECT last_event_id, last_updated_turn
        FROM people_relationships
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "rel-player-npc-C01"),
    npc: db
      .prepare(`
        SELECT last_event_id, last_updated_turn
        FROM people_npcs
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "C01")
  }));

  assert.equal(rows.relationship.last_event_id, peopleEvent.eventId);
  assert.equal(rows.relationship.last_updated_turn, 6);
  assert.equal(rows.npc.last_event_id, peopleEvent.eventId);
  assert.equal(rows.npc.last_updated_turn, 6);

  const loaded = await adapter.readSession(worldState.sessionId);
  const promptContext = assemblePromptContext(loaded);
  const serializedVisible = JSON.stringify({
    worldPeopleView: buildWorldPeopleView(loaded),
    promptPeople: promptContext.worldPeople,
    retrievalPeople: promptContext.retrievalContext?.people
  });
  assert.equal(serializedVisible.includes(peopleEvent.eventId), false);

  await adapter.mutateSession(worldState.sessionId, (draft) => {
    draft.player.gold = (draft.player.gold || 0) + 1;
  });
  rows = withSqliteDatabase(dbPath, (db) => ({
    relationship: db
      .prepare("SELECT last_event_id FROM people_relationships WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "rel-player-npc-C01"),
    npc: db
      .prepare("SELECT last_event_id FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01")
  }));
  assert.equal(rows.relationship.last_event_id, peopleEvent.eventId);
  assert.equal(rows.npc.last_event_id, peopleEvent.eventId);

  withSqliteDatabase(dbPath, (db) => {
    db.prepare("DELETE FROM people_relationships WHERE session_id = ? AND row_id = ?")
      .run(worldState.sessionId, "rel-player-npc-C01");
    db.prepare("DELETE FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .run(worldState.sessionId, "C01");
  });
  await adapter.readSession(worldState.sessionId);
  rows = withSqliteDatabase(dbPath, (db) => ({
    relationship: db
      .prepare("SELECT last_event_id FROM people_relationships WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "rel-player-npc-C01"),
    npc: db
      .prepare("SELECT last_event_id FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "C01")
  }));
  assert.equal(rows.relationship.last_event_id, peopleEvent.eventId);
  assert.equal(rows.npc.last_event_id, peopleEvent.eventId);
});

test("SQLite storage adapter does not rewrite people rows after stale expectedRevision rejection", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物版本冲突",
    turnCount: 2
  });
  await adapter.writeSession(worldState);
  const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);

  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.turnCount = 7;
  applyRelationshipChanges(latestWorldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: 5,
    resentmentDelta: 2,
    reason: "新近投帖，往来稍密。"
  }]);
  await adapter.writeSession(latestWorldState);

  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.turnCount = 12;
  applyRelationshipChanges(staleWorldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: -8,
    resentmentDelta: 8,
    reason: "旧案牵连。"
  }]);

  const beforeReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, relationship, resentment, recent_notes_json
        FROM people_relationships
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "rel-player-npc-C01")
  );

  await assert.rejects(
    () =>
      adapter.writeSession(staleWorldState, {
        previousRecord: staleRecord,
        expectedRevision: staleRecord.revision
      }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const afterReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT revision, row_revision, last_updated_turn, relationship, resentment, recent_notes_json
        FROM people_relationships
        WHERE session_id = ? AND row_id = ?
      `)
      .get(worldState.sessionId, "rel-player-npc-C01")
  );

  assert.deepEqual(afterReject, beforeReject);
});

test("SQLite storage adapter syncs people rows on import and delete", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "人物导入",
    role: "official",
    turnCount: 4
  });
  addVisiblePeopleRows(worldState);
  const envelope = buildEnvelope(adapter, worldState, { revision: 6 });

  const imported = await adapter.importSessionRecord(envelope, { overwrite: true });
  assert.equal(imported.revision, 6);

  withSqliteDatabase(dbPath, (db) => {
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);
    const customNpc = db
      .prepare("SELECT revision, row_revision FROM people_npcs WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "npc-visible-gu");

    assert.equal(counts.npcs, imported.worldState.worldPeople.npcs.length);
    assert.ok(sumSqlitePeopleCounts(counts) > 0);
    assert.equal(customNpc.revision, 6);
    assert.equal(customNpc.row_revision, 6);
  });

  await adapter.deleteSession(worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const session = db.prepare("SELECT COUNT(*) AS count FROM world_sessions WHERE session_id = ?").get(worldState.sessionId);
    const counts = readSqlitePeopleCounts(db, worldState.sessionId);

    assert.equal(session.count, 0);
    assert.equal(sumSqlitePeopleCounts(counts), 0);
  });
});

test("SQLite storage adapter syncs and repairs the safe event archive index", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "事件索引",
    turnCount: 5
  });
  worldState.eventHistory = [
    "县学讲席入档。",
    "prompt provider proposal event_log data/audit sk-proj-event-index-secret-123456",
    "秋粮申报公开入档。"
  ];
  applyWorldEntityInfluences(worldState, [{
    entityId: "academy-same-year-circle",
    sourceType: "npc_relationship_action",
    sourceId: "npc-relationship-resolution:sqlite-secret-source",
    metricsDelta: { trust: 1, pressure: 1 },
    publicNote: "论道余波进入同年文社"
  }]);
  worldState.worldEntities.recentImpacts.push({
    id: "world-entity-impact:sqlite-polluted",
    sourceType: "npc_relationship_action",
    sourceLabel: "provider payload",
    entityId: "academy-same-year-circle",
    entityName: "同年文社",
    title: "hiddenNotes raw prompt C:\\bad\\sqlite.json",
    publicSummary: "OPENAI_API_KEY data/sessions provider payload safe_search_index",
    affectedMetricLabels: ["privateSignalTags"],
    relatedRefs: ["rawLedger:sqlite"],
    scopeRefs: ["world_sessions:sqlite"],
    generatedAtTurn: 6
  });
  await adapter.writeSession(worldState);

  const expectedArchive = buildEventArchiveView(worldState, { pageSize: 50 });
  withSqliteDatabase(dbPath, (db) => {
    const count = readSqliteEventArchiveCount(db, worldState.sessionId);
    const rows = db
      .prepare(`
        SELECT row_id, source, visibility, source_type, title, summary, related_labels_json, metadata_json
        FROM event_archive_index
        WHERE session_id = ?
        ORDER BY sort_turn DESC, sort_sequence ASC
      `)
      .all(worldState.sessionId);
    const serializedRows = JSON.stringify(rows);

    const eventHistoryRows = rows.filter((row) => row.source_type === "event_history");
    const entityImpactRows = rows.filter((row) => row.source_type === "world_entity_impact");

    assert.equal(count, expectedArchive.pagination.totalItems);
    assert.equal(rows.length, expectedArchive.pagination.totalItems);
    assert.equal(eventHistoryRows.length, 2);
    assert.ok(entityImpactRows.length > 0);
    assert.ok(entityImpactRows.some((row) => /同年文社|论道余波/.test(`${row.title}${row.summary}${row.related_labels_json}`)));
    assert.ok(rows.every((row) => row.source === "event_archive_view"));
    assert.ok(rows.every((row) => row.visibility === "public"));
    assert.ok(rows.every((row) => JSON.parse(row.metadata_json).contentHash));
    assert.equal(serializedRows.includes("sk-proj-event-index-secret"), false);
    assert.equal(serializedRows.includes("event_log"), false);
    assert.equal(serializedRows.includes("provider"), false);
    assert.equal(serializedRows.includes("npc-relationship-resolution:sqlite-secret-source"), false);
    assert.equal(serializedRows.includes("sourceRef"), false);
    assert.equal(serializedRows.includes("relatedRefs"), false);
    assert.equal(serializedRows.includes("scopeRefs"), false);

    db
      .prepare("UPDATE event_archive_index SET summary = ? WHERE session_id = ? AND row_id = ?")
      .run("SEALED_EVENT_INDEX_RAW prompt event_log", worldState.sessionId, rows[0].row_id);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  assert.equal(record.worldState.eventHistory.includes("秋粮申报公开入档。"), true);

  withSqliteDatabase(dbPath, (db) => {
    const rows = db
      .prepare(`
        SELECT row_id, summary, metadata_json
        FROM event_archive_index
        WHERE session_id = ?
        ORDER BY sort_turn DESC, sort_sequence ASC
      `)
      .all(worldState.sessionId);
    const serializedRows = JSON.stringify(rows);

    assert.equal(rows.length, expectedArchive.pagination.totalItems);
    assert.equal(serializedRows.includes("SEALED_EVENT_INDEX_RAW"), false);
    assert.equal(serializedRows.includes("prompt"), false);
    assert.equal(serializedRows.includes("event_log"), false);
    assert.ok(rows.every((row) => JSON.parse(row.metadata_json).contentHash));
  });
});

test("SQLite storage adapter repairs S61 official assessment event archive rows from visible views", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    role: "official",
    playerName: "考成索引",
    turnCount: 8,
    player: {
      officeTitle: "户部主事",
      position: "户部主事"
    }
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue"
  });
  const beijing = worldState.worldGeography.cities.find((city) => city.id === "city-beijing");
  Object.assign(beijing, {
    taxBase: 34,
    grainStock: 36,
    marketPriceStress: 70,
    lawsuitPressure: 72,
    waterworksIntegrity: 28,
    disasterRisk: 66
  });

  await adapter.writeSession(worldState);
  withSqliteDatabase(dbPath, (db) => {
    const row = db
      .prepare(`
        SELECT *
        FROM event_archive_index
        WHERE session_id = ?
          AND source_type = 'official_assessment'
        LIMIT 1
      `)
      .get(worldState.sessionId);

    assert.ok(row);
    assert.equal(row.source_type, "official_assessment");
    assert.match(row.summary, /任所奏报/);
    assert.ok(JSON.parse(row.metadata_json).contentHash);

    const pollutedRow = {
      ...row,
      summary: "SEALED_EVENT_ASSESSMENT_INDEX prompt event_log sk-test-assessment-index"
    };
    const metadata = JSON.parse(row.metadata_json);
    metadata.contentHash = hashSqliteEventArchiveRow(pollutedRow);
    db
      .prepare("UPDATE event_archive_index SET summary = ?, metadata_json = ? WHERE session_id = ? AND row_id = ?")
      .run(pollutedRow.summary, JSON.stringify(metadata), worldState.sessionId, row.row_id);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const eventArchive = buildEventArchiveView(record.worldState, { pageSize: 50 });
  const serializedArchive = JSON.stringify(eventArchive);

  assert.match(serializedArchive, /official_assessment/);
  assert.match(serializedArchive, /任所奏报/);
  assert.doesNotMatch(serializedArchive, /SEALED_EVENT_ASSESSMENT_INDEX/);

  withSqliteDatabase(dbPath, (db) => {
    const row = db
      .prepare(`
        SELECT summary, metadata_json
        FROM event_archive_index
        WHERE session_id = ?
          AND source_type = 'official_assessment'
        LIMIT 1
      `)
      .get(worldState.sessionId);

    assert.match(row.summary, /任所奏报/);
    assert.doesNotMatch(row.summary, /SEALED_EVENT_ASSESSMENT_INDEX/);
    assert.ok(JSON.parse(row.metadata_json).contentHash);
  });
});

test("SQLite storage adapter repairs S65 historical event chain archive rows from visible views", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    role: "official",
    playerName: "事件链索引",
    turnCount: 11,
    player: {
      officeTitle: "户部主事",
      position: "户部主事"
    }
  });
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 26
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue"
  });
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-index-visible",
    postingId: "posting-player-current",
    officeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    holderType: "player",
    status: "pending",
    meritScore: 42,
    riskScore: 82,
    recommendation: "watch",
    publicFinding: "任所奏报牵连户部钱粮与弹劾风险。",
    publicSummary: "户部钱粮考成吃紧，需复核漕册。",
    visibility: "office_visible",
    knownToPlayer: true,
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 11 },
    lastUpdatedTurn: 11
  });

  await adapter.writeSession(worldState);
  withSqliteDatabase(dbPath, (db) => {
    const row = db
      .prepare(`
        SELECT *
        FROM event_archive_index
        WHERE session_id = ?
          AND source_type = 'historical_event_chain'
        LIMIT 1
      `)
      .get(worldState.sessionId);

    assert.ok(row);
    assert.equal(row.source_type, "historical_event_chain");
    assert.match(row.summary, /事件链|公共卷宗|服务器/);

    const pollutedRow = {
      ...row,
      summary: "SEALED_EVENT_CHAIN_INDEX prompt provider event_log sk-test-event-chain-index"
    };
    const metadata = JSON.parse(row.metadata_json);
    metadata.contentHash = hashSqliteEventArchiveRow(pollutedRow);
    db
      .prepare("UPDATE event_archive_index SET summary = ?, metadata_json = ? WHERE session_id = ? AND row_id = ?")
      .run(pollutedRow.summary, JSON.stringify(metadata), worldState.sessionId, row.row_id);
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const eventArchive = buildEventArchiveView(record.worldState, { pageSize: 50 });
  const serializedArchive = JSON.stringify(eventArchive);

  assert.match(serializedArchive, /historical_event_chain/);
  assert.match(serializedArchive, /事件链|公共卷宗|服务器/);
  assert.doesNotMatch(serializedArchive, /SEALED_EVENT_CHAIN_INDEX/);

  withSqliteDatabase(dbPath, (db) => {
    const row = db
      .prepare(`
        SELECT summary, metadata_json
        FROM event_archive_index
        WHERE session_id = ?
          AND source_type = 'historical_event_chain'
        LIMIT 1
      `)
      .get(worldState.sessionId);

    assert.match(row.summary, /事件链|公共卷宗|服务器/);
    assert.doesNotMatch(row.summary, /SEALED_EVENT_CHAIN_INDEX/);
    assert.ok(JSON.parse(row.metadata_json).contentHash);
  });
});

test("SQLite storage adapter keeps event archive index in import, delete, and stale-write paths", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createSqliteHarness(t);
  const worldState = buildWorldState({
    playerName: "事件索引导入",
    turnCount: 3
  });
  worldState.eventHistory = ["公开卷宗一。", "公开卷宗二。"];
  const envelope = buildEnvelope(adapter, worldState, { revision: 4 });
  const expectedArchive = buildEventArchiveView(worldState, { pageSize: 50 });

  await adapter.importSessionRecord(envelope, { overwrite: true });
  withSqliteDatabase(dbPath, (db) => {
    assert.equal(readSqliteEventArchiveCount(db, worldState.sessionId), expectedArchive.pagination.totalItems);
    const row = db
      .prepare("SELECT revision, row_revision FROM event_archive_index WHERE session_id = ? LIMIT 1")
      .get(worldState.sessionId);
    assert.equal(row.revision, 4);
    assert.equal(row.row_revision, 4);
  });

  const { record: staleRecord } = await adapter.readSessionRecord(worldState.sessionId);
  const latestWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  latestWorldState.turnCount = 9;
  latestWorldState.eventHistory.push("新近公开卷宗。");
  await adapter.writeSession(latestWorldState);
  const beforeReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT COUNT(*) AS count, MAX(revision) AS max_revision FROM event_archive_index WHERE session_id = ?")
      .get(worldState.sessionId)
  );

  const staleWorldState = JSON.parse(JSON.stringify(staleRecord.worldState));
  staleWorldState.eventHistory.push("过期写入不得落索引。");
  await assert.rejects(
    () =>
      adapter.writeSession(staleWorldState, {
        previousRecord: staleRecord,
        expectedRevision: staleRecord.revision
      }),
    (error) => error.statusCode === 409 && /revision conflict/i.test(error.message)
  );

  const afterReject = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT COUNT(*) AS count, MAX(revision) AS max_revision FROM event_archive_index WHERE session_id = ?")
      .get(worldState.sessionId)
  );
  assert.deepEqual(afterReject, beforeReject);

  await adapter.deleteSession(worldState.sessionId);
  withSqliteDatabase(dbPath, (db) => {
    assert.equal(readSqliteEventArchiveCount(db, worldState.sessionId), 0);
  });
});

test("JSON storage adapter contract: audit sidecar append failure does not fail committed session", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "审计失败仍保留存档",
    player: { gold: 12 }
  });
  const eventLogPath = path.join(auditDir, `${worldState.sessionId}.event-log.jsonl`);
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await fs.rm(eventLogPath, { force: true, recursive: true });
  await fs.mkdir(eventLogPath, { recursive: true });

  await adapter.writeSession(worldState, {
    auditEvents: [{
      sourceSystem: "contract_test",
      eventType: "sidecar_failure",
      summary: "这个目录会让 JSONL append 失败"
    }]
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);

  assert.equal(record.revision, 1);
  assert.equal(record.worldState.player.name, "审计失败仍保留存档");
  assert.equal(record.worldState.player.gold, 12);
});

test("JSON storage adapter contract: legacy raw saves migrate through the adapter", async (t) => {
  const adapter = createJsonSessionAdapter();
  const worldState = buildWorldState({
    playerName: "旧档迁移",
    year: 1603,
    month: 8,
    turnCount: 4
  });
  delete worldState.tenDayPeriod;
  t.after(() => removeSessionArtifacts(worldState.sessionId));

  await writeJsonRecord(worldState.sessionId, worldState);

  const loaded = await adapter.readSession(worldState.sessionId);
  const migrated = await readJsonRecord(worldState.sessionId);

  assert.equal(loaded.tenDayPeriod, 1);
  assert.equal(migrated.storageSchemaVersion, adapter.CURRENT_STORAGE_SCHEMA_VERSION);
  assert.equal(migrated.worldState.tenDayPeriod, 1);
  assert.equal(migrated.metadata.tenDayPeriod, 1);
});

test("JSON storage adapter contract: listSessions skips corrupt files without leaking paths", async (t) => {
  const adapter = createJsonSessionAdapter();
  const visible = buildWorldState({ playerName: "正常存档" });
  const corruptSessionId = randomUUID();
  const corruptFile = path.join(sessionsDir, `${corruptSessionId}.json`);
  t.after(() => removeSessionArtifacts(visible.sessionId));
  t.after(() => removeSessionArtifacts(corruptSessionId));

  await writeJsonRecord(
    visible.sessionId,
    buildEnvelope(adapter, visible, {
      updatedAt: "2026-05-07T00:03:00.000Z",
      metadata: { hiddenRelationshipId: "C-hidden-contract" }
    })
  );
  await fs.writeFile(corruptFile, "{ not json", "utf8");

  const result = await adapter.listSessions();
  const skipped = result.skipped.find((entry) => entry.fileName === `${corruptSessionId}.json`);

  assert.ok(result.saves.find((entry) => entry.sessionId === visible.sessionId));
  assert.ok(skipped);
  assert.equal(skipped.reason, "Session file is corrupt");
  assert.ok(!skipped.reason.includes(sessionsDir));
  assert.ok(!skipped.reason.includes(corruptSessionId));
});
