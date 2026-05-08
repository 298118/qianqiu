const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { assemblePromptContext, buildRankedRetrievalContext } = require("../src/ai/promptContextAssembler");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { buildOfficialPostingsView } = require("../src/game/officialPostings");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
const { buildWorldPeopleView } = require("../src/game/worldPeople");
const {
  WORLD_CONTENT_FIXTURE_TARGETS,
  WORLD_CONTENT_PROMPT_BUDGET,
  buildPromptBudgetReport,
  createCanaryPollutedWorldState,
  createFixtureSessionRecord,
  createWorldContentFixture,
  flattenCanaries
} = require("../src/game/worldContentFixtures");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");
const {
  buildPromptRetrievalRows,
  getPromptRetrievalTableCount
} = require("../src/storage/sqlitePromptRetrievalTables");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const dataDir = path.join(__dirname, "..", "data");
const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(sessionsDir, `${sessionId}.lock`), { force: true });
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

function withSqliteDatabase(dbPath, task) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    return task(db);
  } finally {
    db.close();
  }
}

test("S60 small world content fixture reaches quantity gates without storing private canaries", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const metrics = fixture.fixtureSummary.metrics;
  const target = WORLD_CONTENT_FIXTURE_TARGETS.small;

  assert.equal(metrics.countries >= target.countries, true);
  assert.equal(metrics.cities >= target.cities, true);
  assert.equal(metrics.routes >= 12, true);
  assert.equal(metrics.npcs >= target.npcs, true);
  assert.equal(metrics.households >= target.households, true);
  assert.equal(metrics.relationships >= target.relationships, true);
  assert.equal(metrics.officialCatalogRows >= target.officialCatalogRows, true);
  assert.equal(metrics.postings >= target.postings, true);
  assert.equal(metrics.eventIntelItems >= target.eventIntelItems, true);
  assert.equal(metrics.promptRetrievalRows >= target.promptRetrievalRows, true);
  assert.equal(metrics.promptRetrievalRows <= 500, true);
  assert.equal(metrics.hiddenCanaries >= target.hiddenCanaries, true);

  const geographyView = buildWorldGeographyView(fixture.worldState);
  const s61City = geographyView.cities.find((city) => city.id === "city-s60-001");
  const s61Country = geographyView.countries.find((country) => country.id === "country-s60-western-tribute");
  assert.equal(typeof s61City.taxBase, "number");
  assert.equal(typeof s61City.waterworksIntegrity, "number");
  assert.equal(typeof s61Country.fiscalPressure, "number");
  assert.equal(typeof s61Country.diplomaticTension, "number");

  assert.equal(JSON.stringify(fixture.worldState).includes("S60_PRIVATE_"), false);
  assert.equal(JSON.stringify(fixture.worldState).includes("sk-s60-private-canary-token"), false);
});

test("S60 fixture hidden canaries are present in pollution input but absent from views and prompt", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const canaryDomains = Object.entries(fixture.hiddenCanaries);
  const canaries = flattenCanaries(fixture.hiddenCanaries);

  assert.equal(canaryDomains.length >= 8, true);
  for (const [, tokens] of canaryDomains) {
    assert.equal(tokens.length >= 10, true);
  }

  const polluted = createCanaryPollutedWorldState(fixture);
  assert.equal(JSON.stringify(polluted).includes("S60_PRIVATE_"), true);
  assert.equal(JSON.stringify(polluted).includes("S60_PRIVATE_PROMPT_RETRIEVAL_001"), true);

  const record = createFixtureSessionRecord(clone(polluted));
  const visiblePayload = JSON.stringify({
    geography: buildWorldGeographyView(polluted),
    people: buildWorldPeopleView(polluted),
    officialPostings: buildOfficialPostingsView(polluted),
    eventArchive: buildEventArchiveView(polluted, { pageSize: 50 }),
    prompt: assemblePromptContext(polluted, {
      task: "official_career",
      playerAction: "核查户部、北京和 S60 样本任所"
    }),
    promptRetrievalRows: buildPromptRetrievalRows(record)
  });
  const leaks = canaries.filter((token) => visiblePayload.includes(token));

  assert.deepEqual(leaks, []);
  assert.doesNotMatch(visiblePayload, /prompt_retrieval_index|event_log|ai_change_proposals|data_sessions_secret/);
  assert.doesNotMatch(visiblePayload, /sk-s60-private-canary-token/);
});

test("S60 fixture prompt retrieval is capped relative to fixture row count", () => {
  const fixture = createWorldContentFixture({ size: "small" });
  const metrics = fixture.fixtureSummary.metrics;
  const budget = buildPromptBudgetReport(fixture.worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所"
  });
  const serialized = JSON.stringify(budget.promptContext.retrievalContext);

  assert.equal(metrics.promptRetrievalRows >= WORLD_CONTENT_FIXTURE_TARGETS.small.promptRetrievalRows, true);
  assert.equal(budget.summaryRows <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceRows, true);
  assert.equal(budget.serializedChars <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceChars, true);
  assert.equal(budget.summaryRows < metrics.promptRetrievalRows / 4, true);
  assert.match(serialized, /户部|北京|漕运|任所/);
  assert.doesNotMatch(serialized, /S60_PRIVATE_|prompt_retrieval_index|event_log|ai_change_proposals/);
});

test("S60 fixture keeps JSON and SQLite views plus prompt retrieval parity at small scale", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const fixture = createWorldContentFixture({
    size: "small",
    seed: `s60-parity-${randomUUID()}`
  });
  const jsonAdapter = createJsonSessionAdapter();
  const dbPath = path.join(dataDir, `test-s60-world-fixture-${randomUUID()}.sqlite`);
  const sqliteAdapter = createSqliteSessionAdapter({ databasePath: dbPath });
  t.after(async () => {
    sqliteAdapter.close();
    await removeSqliteArtifacts(dbPath);
    await removeSessionArtifacts(fixture.worldState.sessionId);
  });

  await jsonAdapter.writeSession(clone(fixture.worldState));
  await sqliteAdapter.writeSession(clone(fixture.worldState));
  const jsonLoaded = await jsonAdapter.readSession(fixture.worldState.sessionId);

  withSqliteDatabase(dbPath, (db) => {
    const deletion = db
      .prepare("DELETE FROM prompt_retrieval_index WHERE session_id = ? AND row_id = ?")
      .run(fixture.worldState.sessionId, "people.npcs:npc-s60-001");
    assert.equal(deletion.changes, 1);
  });

  const { record } = await sqliteAdapter.readSessionRecord(fixture.worldState.sessionId);
  const sqliteLoaded = record.worldState;
  const options = {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、样本人物与任所"
  };
  const sqliteContext = assemblePromptContext(sqliteLoaded, options).retrievalContext;
  const fallbackContext = buildRankedRetrievalContext(jsonLoaded, {
    ...options,
    promptRetrievalSource: false
  });
  const expectedRows = buildPromptRetrievalRows(createFixtureSessionRecord(clone(sqliteLoaded))).length;
  const repairedRows = withSqliteDatabase(dbPath, (db) =>
    getPromptRetrievalTableCount(db, fixture.worldState.sessionId)
  );

  assert.deepEqual(buildWorldGeographyView(sqliteLoaded), buildWorldGeographyView(jsonLoaded));
  assert.deepEqual(buildWorldPeopleView(sqliteLoaded), buildWorldPeopleView(jsonLoaded));
  assert.deepEqual(buildOfficialPostingsView(sqliteLoaded), buildOfficialPostingsView(jsonLoaded));
  assert.deepEqual(
    buildEventArchiveView(sqliteLoaded, { pageSize: 50 }).counts,
    buildEventArchiveView(jsonLoaded, { pageSize: 50 }).counts
  );
  assert.deepEqual(sqliteContext.geography, fallbackContext.geography);
  assert.deepEqual(sqliteContext.people, fallbackContext.people);
  assert.deepEqual(sqliteContext.offices, fallbackContext.offices);
  assert.deepEqual(sqliteContext.events.recentEvents, fallbackContext.events.recentEvents);
  assert.equal(repairedRows, expectedRows);
  assert.equal(repairedRows >= WORLD_CONTENT_FIXTURE_TARGETS.small.promptRetrievalRows, true);
  assert.equal(JSON.stringify(record.worldState).includes("promptRetrieval"), false);
});
