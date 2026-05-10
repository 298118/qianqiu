const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const {
  assemblePromptContext,
  buildRankedRetrievalContext
} = require("../src/ai/promptContextAssembler");
const { createInitialState } = require("../src/game/initialState");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const {
  getPromptRetrievalTableCount
} = require("../src/storage/sqlitePromptRetrievalTables");

const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");
const dataDir = path.join(__dirname, "..", "data");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function stableStringify(value) {
  return JSON.stringify(normalizeForStableJson(value));
}

function hashPromptRetrievalRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

function buildPromptSearchText(payload = {}) {
  return JSON.stringify(payload)
    .replace(/[{}[\]",:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

async function removeSqliteArtifacts(dbPath) {
  await Promise.all(
    [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
}

function createHarness(t) {
  const dbPath = path.join(dataDir, `test-prompt-retrieval-${randomUUID()}.sqlite`);
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

function createPromptWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "检索索引"
  });
  Object.assign(worldState, {
    year: 1644,
    month: 8,
    tenDayPeriod: 2,
    turnCount: 9
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  worldState.eventHistory = [
    "户部催核京杭漕运北段账册，命本任先查北京仓储。",
    "山海关边报称辽东商路风声趋紧。"
  ];

  worldState.worldGeography.cities.push({
    id: "city-hidden-prompt-retrieval",
    countryId: "country-ming",
    regionId: "region-north-zhili",
    name: "SEALED_SQLITE_PROMPT_CITY",
    jurisdictionLevel: "secret",
    visibility: "hidden",
    publicSummary: "SEALED_SQLITE_PROMPT_CITY_SUMMARY",
    hiddenNotes: ["SEALED_SQLITE_PROMPT_CITY_NOTE"]
  });
  worldState.worldPeople.npcs.push({
    id: "npc-visible-prompt-gu",
    name: "顾衡",
    currentCityId: "city-beijing",
    rankLabel: "候补主簿",
    reputation: 50,
    influence: 44,
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾衡常在京师替乡党通递消息。",
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-prompt-retrieval",
    name: "SEALED_SQLITE_PROMPT_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    hiddenIntent: "SEALED_SQLITE_PROMPT_INTENT",
    hiddenNotes: ["SEALED_SQLITE_PROMPT_NPC_NOTE"]
  });
  worldState.worldPeople.relationships.push({
    id: "rel-player-npc-visible-prompt-gu",
    sourceType: "player",
    sourceId: "P1",
    targetType: "npc",
    targetId: "npc-visible-prompt-gu",
    relationship: 54,
    trust: 50,
    resentment: 8,
    stance: "可托乡谊",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾衡愿意递送公开人情消息。",
    recentNotes: ["顾衡: 愿帮忙打听京师书办。"],
    lastUpdatedTurn: worldState.turnCount
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-prompt-retrieval",
    officeId: "ministry_revenue_principal",
    officeTitle: "SEALED_SQLITE_PROMPT_POSTING",
    bureauId: "ministry_revenue",
    holderType: "npc",
    holderId: "npc-hidden-prompt-retrieval",
    status: "active",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_SQLITE_PROMPT_POSTING_SUMMARY",
    hiddenNotes: ["SEALED_SQLITE_PROMPT_POSTING_NOTE"]
  });

  return worldState;
}

test("SQLite prompt retrieval index matches server-visible fallback without changing JSON behavior", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const options = {
    task: "official_career",
    playerAction: "核查户部、北京与京杭漕运北段"
  };
  const sqliteContext = assemblePromptContext(record.worldState, options).retrievalContext;
  const fallbackContext = buildRankedRetrievalContext(record.worldState, {
    ...options,
    promptRetrievalSource: false
  });
  const serialized = JSON.stringify(sqliteContext);

  assert.equal(sqliteContext.retrievalMode, "server_visible_ranked_projection");
  assert.deepEqual(sqliteContext.geography, fallbackContext.geography);
  assert.deepEqual(sqliteContext.people, fallbackContext.people);
  assert.deepEqual(sqliteContext.offices, fallbackContext.offices);
  assert.deepEqual(sqliteContext.events.recentEvents, fallbackContext.events.recentEvents);
  assert.match(serialized, /户部|北京|京杭漕运|顾衡/);
  assert.match(serialized, /fiscalPressure|taxBase|waterworksIntegrity/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_PROMPT_/);
  assert.equal(JSON.stringify(record.worldState).includes("promptRetrieval"), false);

  const rowCount = withSqliteDatabase(dbPath, (db) =>
    getPromptRetrievalTableCount(db, worldState.sessionId)
  );
  assert.ok(rowCount > 0);
});

test("SQLite prompt retrieval indexes and repairs S63 local docket rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  const docketRowId = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT row_id
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND domain = 'events'
          AND collection = 'localDockets'
        ORDER BY row_id
        LIMIT 1
      `)
      .get(worldState.sessionId).row_id
  );

  assert.match(docketRowId, /^events\.localDockets:/);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "local-docket-polluted",
          title: "SEALED_SQLITE_LOCAL_DOCKET prompt provider event_log sk-test-local-docket"
        }),
        "SEALED_SQLITE_LOCAL_DOCKET prompt provider event_log sk-test-local-docket",
        worldState.sessionId,
        docketRowId
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查户部钱粮案牍与北京水利"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /localAffairsDocketView|钱粮|水利|案牍/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_LOCAL_DOCKET/);
  assert.doesNotMatch(serialized, /sk-test-local-docket/);
  assert.doesNotMatch(serialized, /event_log/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, docketRowId).payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_LOCAL_DOCKET/);
  assert.match(repairedPayload, /钱粮|水利|案牍|盗匪|刑名/);
});

test("SQLite prompt retrieval indexes and repairs S64 military diplomacy rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  Object.assign(worldState, {
    borderThreat: 88,
    armyMorale: 34,
    grainReserve: 240,
    population: 7200
  });
  await adapter.writeSession(clone(worldState));

  const reportRowId = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT row_id
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND domain = 'events'
          AND collection = 'militaryReports'
        ORDER BY row_id
        LIMIT 1
      `)
      .get(worldState.sessionId).row_id
  );

  assert.match(reportRowId, /^events\.militaryReports:/);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "military-report-polluted",
          title: "SEALED_SQLITE_MILITARY_REPORT prompt provider event_log sk-test-military"
        }),
        "SEALED_SQLITE_MILITARY_REPORT prompt provider event_log sk-test-military",
        worldState.sessionId,
        reportRowId
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查山海关、辽东粮道与边报"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /militaryDiplomacyView|粮道|军务|服务器裁决/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_MILITARY_REPORT/);
  assert.doesNotMatch(serialized, /sk-test-military/);
  assert.doesNotMatch(serialized, /event_log/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, reportRowId).payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_MILITARY_REPORT/);
  assert.match(repairedPayload, /粮道|军务|边|服务器/);
});

test("SQLite prompt retrieval indexes and repairs S64.2 economic fiscal rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88
  });
  await adapter.writeSession(clone(worldState));

  const reportRowId = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT row_id
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND domain = 'events'
          AND collection = 'economicReports'
        ORDER BY row_id
        LIMIT 1
      `)
      .get(worldState.sessionId).row_id
  );

  assert.match(reportRowId, /^events\.economicReports:/);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "economic-report-polluted",
          title: "SEALED_SQLITE_ECONOMIC_REPORT prompt provider event_log sk-test-economic"
        }),
        "SEALED_SQLITE_ECONOMIC_REPORT prompt provider event_log sk-test-economic",
        worldState.sessionId,
        reportRowId
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查户部钱粮、北京粮价、盐漕与地方库银"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /economicFiscalView|粮储|盐漕|库银|财赋|服务器裁决/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_ECONOMIC_REPORT/);
  assert.doesNotMatch(serialized, /sk-test-economic/);
  assert.doesNotMatch(serialized, /event_log/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, reportRowId).payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_ECONOMIC_REPORT/);
  assert.match(repairedPayload, /粮储|盐漕|库银|财赋|服务器/);
});

test("SQLite prompt retrieval indexes and repairs S65 historical event chain rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 26
  });
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-sqlite-visible",
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
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 9 },
    lastUpdatedTurn: 9
  });
  await adapter.writeSession(clone(worldState));

  const chainRowId = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT row_id
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND domain = 'events'
          AND collection = 'eventChains'
        ORDER BY row_id
        LIMIT 1
      `)
      .get(worldState.sessionId).row_id
  );

  assert.match(chainRowId, /^events\.eventChains:/);

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "event-chain-polluted",
          title: "SEALED_SQLITE_EVENT_CHAIN prompt provider event_log sk-test-event-chain"
        }),
        "SEALED_SQLITE_EVENT_CHAIN prompt provider event_log sk-test-event-chain",
        worldState.sessionId,
        chainRowId
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查户部钱粮、事件链与漕册因果"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /historicalEventArchiveView|事件链|公共卷宗|服务器/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_EVENT_CHAIN/);
  assert.doesNotMatch(serialized, /sk-test-event-chain/);
  assert.doesNotMatch(serialized, /event_log|provider/);
  assert.doesNotMatch(serialized, /sealedProjection|server_only/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, chainRowId).payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_EVENT_CHAIN/);
  assert.match(repairedPayload, /事件链|公共卷宗|服务器/);
});

test("SQLite prompt retrieval index repairs same-row content pollution before prompt assembly", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "city-beijing",
          name: "SEALED_SQLITE_PROMPT_TAMPER",
          publicSummary: "SEALED_SQLITE_PROMPT_TAMPER prompt event_log sk-test-hidden"
        }),
        "SEALED_SQLITE_PROMPT_TAMPER prompt event_log sk-test-hidden",
        worldState.sessionId,
        "geography.cities:city-beijing"
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查北京账册"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.doesNotMatch(serialized, /SEALED_SQLITE_PROMPT_TAMPER/);
  assert.doesNotMatch(serialized, /sk-test-hidden/);
  assert.match(serialized, /北京/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, "geography.cities:city-beijing").payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_PROMPT_TAMPER/);
});

test("SQLite prompt retrieval index upgrades self-consistent legacy geography payloads", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    const row = db
      .prepare(`
        SELECT *
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, "geography.cities:city-beijing");
    const legacyPayload = JSON.parse(row.payload_json);
    for (const key of [
      "populationScale",
      "taxBase",
      "grainStock",
      "marketPriceStress",
      "gentryInfluence",
      "lawsuitPressure",
      "corveeBurden",
      "waterworksIntegrity",
      "disasterRisk",
      "trafficLoad",
      "garrisonStrength",
      "academyLevel",
      "localIssueTags",
      "cityIntelligenceSummary"
    ]) {
      delete legacyPayload[key];
    }

    const legacyRow = {
      ...row,
      payload_json: JSON.stringify(legacyPayload),
      search_text: buildPromptSearchText(legacyPayload)
    };
    const metadata = JSON.parse(row.metadata_json);
    metadata.contentHash = hashPromptRetrievalRow(legacyRow);
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?,
            metadata_json = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        legacyRow.payload_json,
        legacyRow.search_text,
        JSON.stringify(metadata),
        worldState.sessionId,
        "geography.cities:city-beijing"
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查北京税粮、水利与驻军"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /taxBase|waterworksIntegrity|garrisonStrength/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, "geography.cities:city-beijing").payload_json
  );
  assert.match(repairedPayload, /taxBase|waterworksIntegrity|garrisonStrength/);
});

test("SQLite prompt retrieval repairs polluted S61 official assessment rows before prompt assembly", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare(`
        UPDATE prompt_retrieval_index
        SET payload_json = ?,
            search_text = ?
        WHERE session_id = ?
          AND row_id = ?
      `)
      .run(
        JSON.stringify({
          id: "assessment-player-current",
          publicFinding: "SEALED_SQLITE_ASSESSMENT_PROMPT prompt event_log provider sk-test-assessment"
        }),
        "SEALED_SQLITE_ASSESSMENT_PROMPT prompt event_log provider sk-test-assessment",
        worldState.sessionId,
        "offices.assessmentRecords:assessment-player-current"
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "核查任所考成与任所奏报"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.doesNotMatch(serialized, /SEALED_SQLITE_ASSESSMENT_PROMPT/);
  assert.doesNotMatch(serialized, /sk-test-assessment/);
  assert.match(serialized, /任所奏报|考成/);

  const repairedPayload = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare(`
        SELECT payload_json
        FROM prompt_retrieval_index
        WHERE session_id = ?
          AND row_id = ?
      `)
      .get(worldState.sessionId, "offices.assessmentRecords:assessment-player-current").payload_json
  );
  assert.doesNotMatch(repairedPayload, /SEALED_SQLITE_ASSESSMENT_PROMPT/);
  assert.match(repairedPayload, /任所奏报|考成/);
});

test("SQLite prompt retrieval ignores raw business tables and raw audit while repairing missing index rows", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const { adapter, dbPath } = createHarness(t);
  const worldState = createPromptWorldState();
  await adapter.writeSession(clone(worldState));

  withSqliteDatabase(dbPath, (db) => {
    db
      .prepare("UPDATE geo_cities SET public_summary = ? WHERE session_id = ? AND row_id = ?")
      .run("SEALED_SQLITE_RAW_GEO prompt event_log", worldState.sessionId, "city-beijing");
    db
      .prepare("UPDATE geo_cities SET metadata_json = ? WHERE session_id = ? AND row_id = ?")
      .run(
        JSON.stringify({ s61CityDepth: { cityIntelligenceSummary: "SEALED_SQLITE_RAW_S61_CITY" } }),
        worldState.sessionId,
        "city-beijing"
      );
    db
      .prepare("UPDATE people_npcs SET public_summary = ? WHERE session_id = ? AND row_id = ?")
      .run("SEALED_SQLITE_RAW_PEOPLE provider proposal", worldState.sessionId, "npc-visible-prompt-gu");
    db
      .prepare("DELETE FROM prompt_retrieval_index WHERE session_id = ? AND row_id = ?")
      .run(worldState.sessionId, "geography.cities:city-beijing");
    db
      .prepare("DELETE FROM prompt_retrieval_index WHERE session_id = ? AND row_id = ?")
      .run(worldState.sessionId, "people.npcs:npc-visible-prompt-gu");
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
        "SEALED_AUDIT_PROMPT provider proposal prompt",
        "{}",
        "{}",
        "2026-05-08T00:00:00.000Z"
      );
    db
      .prepare(`
        INSERT INTO ai_change_proposals (
          proposal_id, session_id, audit_schema_version, revision, turn_count, year, month,
          ten_day_period, scene_cadence, provider, prompt_pack, proposal_kind, status,
          proposal_json, accepted_json, rejected_reasons_json, applied_event_ids_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        `proposal-${randomUUID()}`,
        worldState.sessionId,
        1,
        1,
        worldState.turnCount,
        worldState.year,
        worldState.month,
        worldState.tenDayPeriod,
        "global_turn",
        "test-provider",
        "world_turn",
        "state_patch",
        "rejected",
        "{\"raw\":\"SEALED_AI_PROPOSAL_PROMPT\"}",
        "{}",
        "[]",
        "[]",
        "2026-05-08T00:00:01.000Z"
      );
  });

  const { record } = await adapter.readSessionRecord(worldState.sessionId);
  const context = assemblePromptContext(record.worldState, {
    task: "official_career",
    playerAction: "查访顾衡并核查北京账册"
  });
  const serialized = JSON.stringify(context.retrievalContext);

  assert.match(serialized, /顾衡|北京/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_RAW_/);
  assert.doesNotMatch(serialized, /SEALED_SQLITE_RAW_S61_CITY/);
  assert.doesNotMatch(serialized, /SEALED_AUDIT_PROMPT/);
  assert.doesNotMatch(serialized, /SEALED_AI_PROPOSAL_PROMPT/);

  const repairedCount = withSqliteDatabase(dbPath, (db) =>
    db
      .prepare("SELECT COUNT(*) AS count FROM prompt_retrieval_index WHERE session_id = ? AND row_id = ?")
      .get(worldState.sessionId, "people.npcs:npc-visible-prompt-gu").count
  );
  assert.equal(repairedCount, 1);
});
