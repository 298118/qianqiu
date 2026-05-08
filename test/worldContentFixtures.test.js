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
  WORLD_CONTENT_BROWSER_PAGE,
  WORLD_CONTENT_FIXTURE_TARGETS,
  WORLD_CONTENT_PROMPT_BUDGET,
  buildWorldContentFixturePage,
  buildWorldContentPerformanceBaseline,
  buildPromptBudgetReport,
  countRetrievalSummaryRows,
  createCanaryPollutedWorldState,
  createFixtureSessionRecord,
  createWorldContentFixture,
  flattenCanaries
} = require("../src/game/worldContentFixtures");
const { buildTurnTask } = require("../src/ai/prompts");
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

function padForTest(number, width = 3) {
  return String(number).padStart(width, "0");
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
  assert.equal(metrics.peopleGenealogy.roleLabels.includes("邻国使者"), true);
  assert.equal(metrics.peopleGenealogy.parentLinkedNpcs > 0, true);
  assert.equal(metrics.peopleGenealogy.marriageLinkedNpcs > 0, true);
  assert.equal(metrics.peopleGenealogy.hasMentorNetwork, true);
  assert.equal(metrics.peopleGenealogy.hasNativePlaceNetwork, true);
  assert.equal(metrics.peopleGenealogy.hasExamCohortNetwork, true);
  assert.equal(metrics.peopleGenealogy.hasFactionNetwork, true);

  const geographyView = buildWorldGeographyView(fixture.worldState);
  const peopleView = buildWorldPeopleView(fixture.worldState);
  const s61City = geographyView.cities.find((city) => city.id === "city-s60-001");
  const s61Country = geographyView.countries.find((country) => country.id === "country-s60-western-tribute");
  const lineageNpc = peopleView.npcs.find((npc) => npc.family.fatherId || npc.family.motherId);
  const spouseNpc = peopleView.npcs.find((npc) => npc.family.spouseIds.length);
  assert.equal(typeof s61City.taxBase, "number");
  assert.equal(typeof s61City.waterworksIntegrity, "number");
  assert.equal(typeof s61Country.fiscalPressure, "number");
  assert.equal(typeof s61Country.diplomaticTension, "number");
  assert.ok(lineageNpc, "S62 fixture should expose visible parent/child genealogy");
  assert.ok(spouseNpc, "S62 fixture should expose visible marriage genealogy");
  assert.match(JSON.stringify(peopleView.relationships), /门生故旧|同乡|同年|派系/);

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
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "high"
  });
  const ordinaryBudget = buildPromptBudgetReport(fixture.worldState, {
    task: "official_career",
    playerAction: "核查户部、北京、漕运、边报、样本人物与任所",
    promptBudgetProfile: "ordinary"
  });
  const serialized = JSON.stringify(budget.promptContext.retrievalContext);

  assert.equal(metrics.promptRetrievalRows >= WORLD_CONTENT_FIXTURE_TARGETS.small.promptRetrievalRows, true);
  assert.equal(ordinaryBudget.summaryRows <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryRows, true);
  assert.equal(ordinaryBudget.serializedChars <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryChars, true);
  assert.equal(budget.summaryRows <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceRows, true);
  assert.equal(budget.serializedChars <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceChars, true);
  assert.equal(budget.summaryRows < metrics.promptRetrievalRows / 4, true);
  assert.match(serialized, /户部|北京|漕运|任所/);
  assert.doesNotMatch(serialized, /S60_PRIVATE_|prompt_retrieval_index|event_log|ai_change_proposals/);

  const turnTask = buildTurnTask(fixture.worldState, "核查户部、北京、漕运、边报、样本人物与任所");
  const turnWorldState = JSON.parse(turnTask.input.split("World state:\n")[1]);
  const turnRetrieval = JSON.stringify(turnWorldState.retrievalContext);
  assert.equal(countRetrievalSummaryRows(turnWorldState.retrievalContext) <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryRows, true);
  assert.equal(turnRetrieval.length <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryChars, true);
});

test("S60 medium and large fixtures reach storage-only quantity gates without bloating route state", () => {
  for (const size of ["medium", "large"]) {
    const fixture = createWorldContentFixture({ size });
    const metrics = fixture.fixtureSummary.metrics;
    const target = WORLD_CONTENT_FIXTURE_TARGETS[size];
    const canaryCounts = Object.fromEntries(
      Object.entries(fixture.hiddenCanaries).map(([domain, tokens]) => [domain, tokens.length])
    );

    assert.equal(metrics.countries >= target.countries, true, `${size} countries`);
    assert.equal(metrics.cities >= target.cities, true, `${size} cities`);
    assert.equal(metrics.npcs >= target.npcs, true, `${size} npcs`);
    assert.equal(metrics.households >= target.households, true, `${size} households`);
    assert.equal(metrics.relationships >= target.relationships, true, `${size} relationships`);
    assert.equal(metrics.officialCatalogRows >= target.officialCatalogRows, true, `${size} catalog rows`);
    assert.equal(metrics.postings >= target.postings, true, `${size} postings`);
    assert.equal(metrics.eventIntelItems >= target.eventIntelItems, true, `${size} event intel`);
    assert.equal(metrics.promptRetrievalRows >= target.promptRetrievalRows, true, `${size} prompt rows`);
    assert.equal(metrics.hiddenCanaries >= target.hiddenCanaries, true, `${size} hidden canaries`);
    assert.ok(Object.values(canaryCounts).every((count) => count >= 10), `${size} canary domains`);

    assert.equal(metrics.storageRows.cities, target.cities);
    assert.equal(metrics.storageRows.npcs, target.npcs);
    assert.equal(metrics.storageRows.promptRetrievalRows, target.promptRetrievalRows);
    assert.equal(metrics.storagePeopleGenealogy.roleLabels.includes("邻国使者"), true, `${size} envoy identity`);
    assert.equal(metrics.storagePeopleGenealogy.parentLinkedNpcs > 0, true, `${size} lineage links`);
    assert.equal(metrics.storagePeopleGenealogy.hasMarriageNetwork, true, `${size} marriage network`);
    assert.equal(metrics.storagePeopleGenealogy.hasMentorNetwork, true, `${size} mentor network`);
    assert.equal(metrics.storagePeopleGenealogy.hasNativePlaceNetwork, true, `${size} native-place network`);
    assert.equal(metrics.storagePeopleGenealogy.hasExamCohortNetwork, true, `${size} exam cohort network`);
    assert.equal(metrics.storagePeopleGenealogy.hasFactionNetwork, true, `${size} faction network`);
    assert.equal(metrics.routeViewRows.cities < metrics.cities, true, `${size} route cities are capped`);
    assert.equal(metrics.routeViewRows.npcs < metrics.npcs, true, `${size} route npcs are capped`);
    assert.equal(metrics.routeViewRows.promptRetrievalRows < metrics.promptRetrievalRows, true, `${size} route prompt rows are capped`);
    assert.equal(metrics.ordinaryRetrievalSummaryRows <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryRows, true);
    assert.equal(metrics.ordinaryRetrievalSerializedChars <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryChars, true);
    assert.equal(metrics.retrievalSummaryRows <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceRows, true);
    assert.equal(metrics.retrievalSerializedChars <= WORLD_CONTENT_PROMPT_BUDGET.highRelevanceChars, true);
    assert.equal(JSON.stringify(fixture.worldState).includes(`${size}-city-${padForTest(target.cities)}`), false);
    assert.equal(JSON.stringify(fixture.worldState).includes("S60_PRIVATE_"), false);
  }
});

test("S60 storage-only fixture pages medium and large collections safely", () => {
  const large = createWorldContentFixture({ size: "large" });
  const target = WORLD_CONTENT_FIXTURE_TARGETS.large;
  large.storageLedger.geography.cities[0].hiddenNotes = ["S60_PRIVATE_PAGE_HIDDEN_NOTE"];
  large.storageLedger.geography.cities[0].contentHash = "S60_PRIVATE_PAGE_contentHash";
  large.promptRetrievalRows[0].metadata_json = "S60_PRIVATE_PAGE_prompt_retrieval_index";
  large.promptRetrievalRows[0].localPath = "data/sessions/secret-page.json";
  const cityPage = buildWorldContentFixturePage(large, "geography.cities", { page: 2, pageSize: 24 });
  const clampedPromptPage = buildWorldContentFixturePage(large, "promptRetrievalRows", { pageSize: 500 });
  const pollutedPromptPage = buildWorldContentFixturePage(large, "promptRetrievalRows", { page: 1, pageSize: 1 });
  const hiddenSearchPage = buildWorldContentFixturePage(large, "geography.cities", {
    query: "S60_PRIVATE_PAGE_HIDDEN_NOTE"
  });
  const rawPathSearchPage = buildWorldContentFixturePage(large, "promptRetrievalRows", {
    query: "secret-page"
  });
  const eventSearchPage = buildWorldContentFixturePage(large, "events.eventIntelItems", {
    page: 1,
    pageSize: 20,
    query: "公开情报49"
  });
  const payload = JSON.stringify({
    cityPage,
    clampedPromptPage,
    pollutedPromptPage,
    hiddenSearchPage,
    rawPathSearchPage,
    eventSearchPage
  });

  assert.equal(cityPage.pagination.totalItems, target.cities);
  assert.equal(cityPage.items.length, 24);
  assert.equal(cityPage.pagination.hasNextPage, true);
  assert.equal(clampedPromptPage.pagination.totalItems, target.promptRetrievalRows);
  assert.equal(clampedPromptPage.pagination.pageSize, WORLD_CONTENT_BROWSER_PAGE.maxPageSize);
  assert.equal(clampedPromptPage.items.length, WORLD_CONTENT_BROWSER_PAGE.maxPageSize);
  assert.equal(eventSearchPage.pagination.totalItems > 0, true);
  assert.ok(eventSearchPage.items.every((item) => JSON.stringify(item).includes("公开情报49")));
  assert.equal(hiddenSearchPage.pagination.totalItems, 0);
  assert.equal(rawPathSearchPage.pagination.totalItems, 0);
  assert.deepEqual(Object.keys(pollutedPromptPage.items[0]).sort(), [
    "collection",
    "domain",
    "relatedRefs",
    "rowId",
    "sortPriority",
    "sourceView",
    "summary",
    "tags",
    "title",
    "visibility"
  ]);
  assert.doesNotMatch(payload, /S60_PRIVATE_|prompt_retrieval_index|event_log|ai_change_proposals|data_sessions_secret/);
  assert.doesNotMatch(payload, /contentHash|metadata_json|localPath|data\/sessions/);
  assert.doesNotMatch(payload, /sk-s60-private-canary-token/);
});

test("S60 fixture event intel references existing fixture cities", () => {
  for (const size of ["small", "medium", "large"]) {
    const fixture = createWorldContentFixture({ size });
    const cityIds = new Set(
      size === "small"
        ? buildWorldGeographyView(fixture.worldState).cities.map((city) => city.id)
        : fixture.storageLedger.geography.cities.map((city) => city.id)
    );
    const dangling = fixture.eventIntelItems
      .flatMap((item) => item.relatedRefs)
      .filter((ref) => !cityIds.has(ref));

    assert.deepEqual(dangling, [], `${size} event/intel relatedRefs must resolve`);
  }
});

test("S60 fixture records minimal performance baselines for later S67 thresholds", () => {
  const large = createWorldContentFixture({ size: "large" });
  const baseline = buildWorldContentPerformanceBaseline(large);

  for (const value of [
    large.fixtureSummary.performanceBaseline.fixtureGenerationMs,
    baseline.eventArchivePaginationMs,
    baseline.promptAssemblyMs,
    baseline.promptRetrievalRowsMs,
    baseline.fixturePageMs
  ]) {
    assert.equal(Number.isFinite(value), true);
    assert.equal(value >= 0, true);
  }
  assert.equal(large.fixtureSummary.performanceBaseline.fixtureSize, "large");
  assert.equal(baseline.fixturePageRows, WORLD_CONTENT_BROWSER_PAGE.maxPageSize);
  assert.equal(baseline.promptSummaryRows <= WORLD_CONTENT_PROMPT_BUDGET.ordinaryRows, true);
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
      .run(fixture.worldState.sessionId, "people.npcs:s60-npc-001");
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
