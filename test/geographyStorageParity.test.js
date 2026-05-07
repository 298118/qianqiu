const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isBuiltin } = require("node:module");

const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { createInitialState } = require("../src/game/initialState");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
const { createJsonSessionAdapter } = require("../src/storage/jsonSessionAdapter");
const { createSqliteSessionAdapter } = require("../src/storage/sqliteSessionAdapter");

const dataDir = path.join(__dirname, "..", "data");
const sessionsDir = path.join(dataDir, "sessions");
const auditDir = path.join(dataDir, "audit");

const HIDDEN_MARKERS = [
  "SEALED_PARITY_CITY",
  "SEALED_PARITY_CITY_NOTE",
  "SEALED_PARITY_ROUTE",
  "SEALED_PARITY_ROUTE_NOTE",
  "SEALED_ROUTE_NOTE",
  "route-hidden-liaodong-smuggling",
  "city-hidden-storage-parity"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function createParityWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "地理一致性"
  });
  Object.assign(worldState, {
    year: 1644,
    month: 8,
    tenDayPeriod: 2,
    turnCount: 12,
    borderThreat: 91,
    corruption: 76,
    grainReserve: 330
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";

  worldState.worldGeography.cities.push({
    id: "city-hidden-storage-parity",
    countryId: "country-ming",
    regionId: "region-north-zhili",
    name: "SEALED_PARITY_CITY",
    jurisdictionLevel: "secret",
    terrain: "密档",
    visibility: "hidden",
    publicSummary: "SEALED_PARITY_CITY_SUMMARY",
    hiddenNotes: ["SEALED_PARITY_CITY_NOTE"]
  });
  const publicRoute = worldState.worldGeography.routes.find((route) => route.id === "route-grand-canal-north");
  publicRoute.viaCityIds = ["city-hidden-storage-parity"];
  publicRoute.publicSummary = "公开漕运摘要只可见公开城镇，不得泄露密档中途点。";
  publicRoute.hiddenNotes = ["SEALED_PARITY_VISIBLE_ROUTE_NOTE"];
  worldState.worldGeography.routes.push({
    id: "route-hidden-storage-parity",
    type: "road",
    name: "SEALED_PARITY_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-shanhaiguan",
    visibility: "hidden",
    publicSummary: "SEALED_PARITY_ROUTE_SUMMARY",
    hiddenNotes: ["SEALED_PARITY_ROUTE_NOTE"]
  });

  return worldState;
}

function stableById(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => clone(row))
    .sort((first, second) => String(first.id).localeCompare(String(second.id)));
}

function geographyViewKey(view) {
  return {
    schemaVersion: view.schemaVersion,
    seedId: view.seedId,
    generatedAtTurn: view.generatedAtTurn,
    countries: stableById(view.countries),
    regions: stableById(view.regions),
    cities: stableById(view.cities),
    routes: stableById(view.routes),
    frontierZones: stableById(view.frontierZones),
    officeJurisdictions: stableById(view.officeJurisdictions),
    highlights: {
      countries: stableById(view.highlights.countries),
      cities: stableById(view.highlights.cities),
      routes: stableById(view.highlights.routes),
      frontierZones: stableById(view.highlights.frontierZones)
    }
  };
}

function promptGeographyKey(worldState) {
  const context = assemblePromptContext(worldState, {
    task: "official_career",
    playerAction: "核查北京、山海关与京杭漕运账册"
  });
  return {
    worldGeography: context.worldGeography,
    retrievalGeography: context.retrievalContext.geography
  };
}

async function loadThroughAdapters(t, worldState) {
  const jsonAdapter = createJsonSessionAdapter();
  const dbPath = path.join(dataDir, `test-geography-parity-${randomUUID()}.sqlite`);
  const sqliteAdapter = createSqliteSessionAdapter({ databasePath: dbPath });

  t.after(async () => {
    sqliteAdapter.close();
    await removeSqliteArtifacts(dbPath);
    await removeSessionArtifacts(worldState.sessionId);
  });

  await jsonAdapter.writeSession(clone(worldState));
  await sqliteAdapter.writeSession(clone(worldState));

  return {
    jsonWorldState: await jsonAdapter.readSession(worldState.sessionId),
    sqliteWorldState: await sqliteAdapter.readSession(worldState.sessionId)
  };
}

test("JSON and SQLite geography storage produce the same route and prompt visible summaries", {
  skip: typeof isBuiltin === "function" && isBuiltin("node:sqlite")
    ? false
    : "node:sqlite is unavailable in this Node.js runtime"
}, async (t) => {
  const worldState = createParityWorldState();
  const { jsonWorldState, sqliteWorldState } = await loadThroughAdapters(t, worldState);

  const jsonView = buildWorldGeographyView(jsonWorldState);
  const sqliteView = buildWorldGeographyView(sqliteWorldState);
  const jsonPrompt = promptGeographyKey(jsonWorldState);
  const sqlitePrompt = promptGeographyKey(sqliteWorldState);
  const serializedVisiblePayload = JSON.stringify({
    jsonView,
    sqliteView,
    jsonPrompt,
    sqlitePrompt
  });
  const routeViewPayloadKeys = Object.keys({
    sessionId: jsonWorldState.sessionId,
    worldState: jsonWorldState,
    worldGeographyView: jsonView
  }).sort();

  assert.deepEqual(geographyViewKey(sqliteView), geographyViewKey(jsonView));
  assert.deepEqual(sqlitePrompt.worldGeography, jsonPrompt.worldGeography);
  assert.deepEqual(sqlitePrompt.retrievalGeography, jsonPrompt.retrievalGeography);
  assert.deepEqual(routeViewPayloadKeys, ["sessionId", "worldGeographyView", "worldState"]);

  assert.ok(jsonView.routes.some((route) => route.id === "route-grand-canal-north"));
  assert.deepEqual(
    jsonView.routes.find((route) => route.id === "route-grand-canal-north").viaCityIds,
    []
  );
  assert.match(serializedVisiblePayload, /北京|山海关|京杭漕运|户部/);
  for (const marker of HIDDEN_MARKERS) {
    assert.equal(serializedVisiblePayload.includes(marker), false, `${marker} should stay hidden`);
  }
});
