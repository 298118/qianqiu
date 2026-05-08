const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { assemblePromptContext } = require("../src/ai/promptContextAssembler");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const {
  buildEconomicFiscalRetrievalRows,
  buildEconomicFiscalView,
  summarizeEconomicFiscalForPrompt
} = require("../src/game/economicFiscal");

test("S64.2 administrative view derives fiscal, grain, market, treasury, debt, and incident reports without mutating state", () => {
  const worldState = createInitialState({ role: "official", playerName: "钱粮官" });
  Object.assign(worldState, {
    treasury: 320,
    grainReserve: 220,
    population: 7200,
    taxRate: 64,
    corruption: 86
  });
  const before = JSON.stringify(worldState);

  const first = buildEconomicFiscalView(worldState);
  const second = buildEconomicFiscalView(worldState);
  const reports = buildEconomicFiscalRetrievalRows(worldState);
  const serialized = JSON.stringify({ first, reports });

  assert.equal(first.schemaVersion, 1);
  assert.deepEqual(first, second);
  assert.equal(first.fiscalLedgers.length > 0, true);
  assert.equal(first.grainMarketReports.length > 0, true);
  assert.equal(first.tradeSaltCanalRoutes.length > 0, true);
  assert.equal(first.localTreasuryReports.length > 0, true);
  assert.equal(first.debtCorruptionRisks.length > 0, true);
  assert.equal(first.marketIncidents.length > 0, true);
  assert.ok(first.fiscalLedgers.every((ledger) =>
    Number.isInteger(ledger.fiscalPressure) &&
    Number.isInteger(ledger.deficitPressure) &&
    ledger.authorityBoundary.includes("服务器")
  ));
  assert.ok(first.grainMarketReports.some((report) => /粮储|市价/.test(report.title)));
  assert.ok(first.tradeSaltCanalRoutes.some((route) => /商税|盐漕/.test(route.title)));
  assert.ok(first.localTreasuryReports.some((report) => /库银|赈济/.test(report.title)));
  assert.ok(first.debtCorruptionRisks.some((risk) => /债|亏空|贪腐/.test(risk.title)));
  assert.ok(first.marketIncidents.some((incident) => /财政|粮价|盐漕|赈济|债务/.test(incident.kindLabel)));
  assert.ok(reports.length > 0);
  assert.match(serialized, /economic-|财赋|粮储|盐漕|库银|服务器裁决/);
  assert.doesNotMatch(serialized, /statePatch|provider|proposal|prompt|data\/sessions|event_log|sk-/);
  assert.equal(JSON.stringify(worldState), before);
});

test("S64.2 scholar view does not expose economic fiscal reports", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "市井书生" });
  Object.assign(worldState, {
    treasury: 180,
    grainReserve: 160,
    population: 7200,
    taxRate: 70,
    corruption: 90
  });
  const view = buildEconomicFiscalView(worldState);
  const promptSummary = summarizeEconomicFiscalForPrompt(worldState);

  assert.equal(view.counts.total, 0);
  assert.deepEqual(view.fiscalLedgers, []);
  assert.deepEqual(view.marketIncidents, []);
  assert.deepEqual(promptSummary.reports, []);
  assert.match(view.hiddenNotice, /书生/);
});

test("S64.2 filters hidden economic geography and debt-like private rows", () => {
  const worldState = createInitialState({ role: "official", playerName: "财赋巡核" });
  Object.assign(worldState, {
    treasury: 220,
    grainReserve: 180,
    population: 7200,
    taxRate: 68,
    corruption: 88
  });
  worldState.worldGeography.cities.push({
    id: "city-hidden-s64-2-market",
    countryId: "country-ming",
    regionId: "region-north-capital",
    name: "SEALED_S64_2_MARKET_CITY",
    visibility: "hidden",
    grainStock: 5,
    marketPriceStress: 99,
    publicSummary: "SEALED_S64_2_MARKET_CITY prompt provider event_log sk-test-s64-2"
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-s64-2-salt",
    type: "canal",
    name: "SEALED_S64_2_SALT_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-hidden-s64-2-market",
    visibility: "hidden",
    risk: 99,
    strategicTags: ["盐漕"],
    publicSummary: "SEALED_S64_2_SALT_ROUTE"
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-s64-2-debt",
    name: "SEALED_S64_2_DEBT_NPC",
    debts: 9999,
    wealthCash: 1,
    visibility: "hidden",
    publicSummary: "SEALED_S64_2_DEBT_NPC"
  });

  const payload = JSON.stringify({
    view: buildEconomicFiscalView(worldState),
    reports: buildEconomicFiscalRetrievalRows(worldState)
  });

  assert.doesNotMatch(payload, /SEALED_S64_2/);
  assert.doesNotMatch(payload, /sk-test-s64-2|provider|event_log/);
  assert.match(payload, /economic-|财赋|粮储|盐漕|服务器/);
});

test("S64.2 drops visible polluted economic labels before route prompt and archive output", () => {
  const worldState = createInitialState({ role: "official", playerName: "清查御史" });
  Object.assign(worldState, {
    treasury: 180,
    grainReserve: 140,
    population: 7200,
    taxRate: 70,
    corruption: 91
  });
  const pollutedText = "RAW_TABLE_geo_cities C:\\Users\\ZZZ\\secret.txt SECRET_KEY_VALUE prompt_retrieval_index";
  const visibleCity = worldState.worldGeography.cities.find((city) => city.id === "city-beijing") ||
    worldState.worldGeography.cities[0];
  Object.assign(visibleCity, {
    name: pollutedText,
    grainStock: 4,
    grainStress: 96,
    marketPriceStress: 99,
    disasterRisk: 90,
    taxBurden: 86,
    trafficLoad: 88,
    visibility: "public",
    publicSummary: pollutedText
  });
  const visibleRoute = worldState.worldGeography.routes[0];
  Object.assign(visibleRoute, {
    name: pollutedText,
    type: "canal",
    risk: 99,
    statusLabel: pollutedText,
    seasonalRisk: pollutedText,
    strategicTags: ["盐漕", pollutedText],
    visibility: "public",
    publicSummary: pollutedText
  });
  worldState.worldPeople.npcs.push({
    id: "npc-visible-s64-2-polluted-debt",
    name: pollutedText,
    wealthCash: 1,
    debts: 900,
    legalRisk: 94,
    impeachmentRisk: 90,
    influence: 72,
    currentCityId: visibleCity.id,
    visibility: "public",
    knownToPlayer: true,
    publicSummary: pollutedText
  });

  const promptContext = assemblePromptContext(worldState, { promptBudgetProfile: "high" });
  const payload = JSON.stringify({
    view: buildEconomicFiscalView(worldState),
    reports: buildEconomicFiscalRetrievalRows(worldState),
    prompt: {
      economicFiscal: promptContext.economicFiscal,
      economicReports: promptContext.retrievalContext.events.economicReports
    },
    archive: buildEventArchiveView(worldState)
  });

  assert.doesNotMatch(payload, /RAW_TABLE_geo_cities|SECRET_KEY_VALUE|prompt_retrieval_index/);
  assert.doesNotMatch(payload, /C:\\\\Users|secret\.txt|geo_cities/);
  assert.match(payload, /财赋|粮储|盐漕|服务器/);
});
