const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  WORLD_GEOGRAPHY_SCHEMA_VERSION,
  buildWorldGeographyView,
  createInitialWorldGeographyState,
  ensureWorldGeographyState,
  normalizeWorldGeographyState,
  summarizeWorldGeographyForPrompt
} = require("../src/game/worldGeography");

test("initial world geography instantiates seed rows into a per-session ledger", () => {
  const worldState = createInitialState({ playerName: "Geo Tester" });
  const geography = worldState.worldGeography;

  assert.equal(geography.schemaVersion, WORLD_GEOGRAPHY_SCHEMA_VERSION);
  assert.equal(geography.seedId, "late-ming-north-china");
  assert.ok(geography.countries.length >= 5);
  assert.ok(geography.cities.length >= 12);
  assert.ok(geography.routes.length >= 5);
  assert.ok(geography.frontierZones.length >= 4);

  const ming = geography.countries.find((country) => country.id === "country-ming");
  const beijing = geography.cities.find((city) => city.id === "city-beijing");

  assert.ok(ming);
  assert.ok(beijing);
  assert.equal(typeof ming.pressure, "number");
  assert.equal(typeof ming.stability, "number");
  assert.equal(typeof ming.fiscalPressure, "number");
  assert.equal(typeof ming.militaryReadiness, "number");
  assert.equal(typeof ming.legitimacy, "number");
  assert.equal(typeof beijing.localOrder, "number");
  assert.equal(typeof beijing.taxBase, "number");
  assert.equal(typeof beijing.waterworksIntegrity, "number");
  assert.equal(typeof beijing.academyLevel, "number");
});

test("world geography view and prompt expose S61 safe country and city depth metrics", () => {
  const worldState = createInitialState({ role: "official", playerName: "S61 Geo Tester" });
  const view = buildWorldGeographyView(worldState);
  const summary = summarizeWorldGeographyForPrompt(worldState);
  const ming = view.countries.find((country) => country.id === "country-ming");
  const beijing = view.cities.find((city) => city.id === "city-beijing");
  const promptMing = summary.countries.find((country) => country.id === "country-ming");
  const promptBeijing = summary.cities.find((city) => city.id === "city-beijing");

  assert.ok(ming);
  assert.ok(beijing);
  assert.equal(typeof ming.fiscalPressure, "number");
  assert.equal(typeof ming.diplomaticTension, "number");
  assert.ok(Array.isArray(ming.policyPressureTags));
  assert.match(ming.intelligenceSummary, /奏报|传闻|摘要/);
  assert.equal(typeof beijing.populationScale, "number");
  assert.equal(typeof beijing.gentryInfluence, "number");
  assert.equal(typeof beijing.garrisonStrength, "number");
  assert.ok(Array.isArray(beijing.localIssueTags));
  assert.ok(promptMing);
  assert.ok(promptBeijing);
  assert.equal(typeof promptMing.militaryReadiness, "number");
  assert.equal(typeof promptBeijing.waterworksIntegrity, "number");
});

test("world geography view filters hidden rows, hidden notes, and scholar-only role_visible rows", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Hidden Geo Tester" });
  worldState.worldGeography.recentNotes.push("SEALED_RECENT_GEO_NOTE");

  const view = buildWorldGeographyView(worldState);
  const serialized = JSON.stringify(view);

  assert.equal(serialized.includes("route-hidden-liaodong-smuggling"), false);
  assert.equal(serialized.includes("frontier-hidden-palace-intel"), false);
  assert.equal(serialized.includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(serialized.includes("SEALED_FRONTIER_NOTE"), false);
  assert.equal(serialized.includes("SEALED_RECENT_GEO_NOTE"), false);
  assert.equal(serialized.includes("city-hanseong"), false);
  assert.equal(serialized.includes("jurisdiction-ministry-personnel-capital"), false);
  assert.ok(view.countries.some((country) => country.id === "country-ming"));
  assert.ok(view.routes.some((route) => route.id === "route-grand-canal-north"));
});

test("official geography view can see role-visible geography without hidden rows", () => {
  const worldState = createInitialState({ role: "official", playerName: "Official Geo Tester" });
  const view = buildWorldGeographyView(worldState);
  const serialized = JSON.stringify(view);

  assert.ok(view.countries.some((country) => country.id === "country-joseon"));
  assert.ok(view.cities.some((city) => city.id === "city-hanseong"));
  assert.ok(view.officeJurisdictions.some((jurisdiction) =>
    jurisdiction.id === "jurisdiction-ministry-personnel-capital"
  ));
  assert.equal(serialized.includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(serialized.includes("frontier-hidden-palace-intel"), false);
});

test("world geography view filters hidden ids from visible row references", () => {
  const worldState = createInitialState({ role: "official", playerName: "Reference Geo Tester" });
  worldState.worldGeography.frontierZones.push({
    id: "frontier-visible-with-hidden-route",
    name: "可见边面含隐藏暗路",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-shanhai-pass", "city-mukden"],
    routeIds: ["route-shanhai-liaodong-pass", "route-hidden-liaodong-smuggling"],
    status: "tense",
    pressureMetric: "borderThreat",
    visibility: "public",
    publicSummary: "只应暴露可见关隘通道。"
  });
  worldState.worldGeography.officeJurisdictions.push({
    id: "jurisdiction-visible-with-hidden-frontier",
    bureauId: "ministry_war",
    name: "可见辖区含隐藏边面",
    scope: "frontier",
    countryIds: ["country-ming"],
    cityIds: ["city-shanhai-pass"],
    routeIds: ["route-shanhai-liaodong-pass", "route-hidden-liaodong-smuggling"],
    frontierZoneIds: ["frontier-shanhai-liaodong", "frontier-hidden-palace-intel"],
    officeTrack: "central_ministry",
    visibility: "public",
    publicSummary: "只应暴露可见边防辖区。"
  });

  const view = buildWorldGeographyView(worldState);
  const frontier = view.frontierZones.find((entry) => entry.id === "frontier-visible-with-hidden-route");
  const jurisdiction = view.officeJurisdictions.find((entry) => entry.id === "jurisdiction-visible-with-hidden-frontier");
  const serialized = JSON.stringify({ frontier, jurisdiction });

  assert.ok(frontier);
  assert.deepEqual(frontier.routeIds, ["route-shanhai-liaodong-pass"]);
  assert.ok(jurisdiction);
  assert.deepEqual(jurisdiction.routeIds, ["route-shanhai-liaodong-pass"]);
  assert.deepEqual(jurisdiction.frontierZoneIds, ["frontier-shanhai-liaodong"]);
  assert.equal(serialized.includes("route-hidden-liaodong-smuggling"), false);
  assert.equal(serialized.includes("frontier-hidden-palace-intel"), false);
});

test("world geography prompt summary is capped and excludes hidden geography", () => {
  const worldState = createInitialState({ role: "official", playerName: "Prompt Geo Tester" });
  worldState.worldGeography.cities.push({
    id: "city-hidden-prompt",
    countryId: "country-ming",
    regionId: "region-north-zhili",
    name: "Hidden Prompt City",
    jurisdictionLevel: "secret",
    visibility: "hidden",
    publicSummary: "SEALED_CITY_SUMMARY",
    localIssueTags: ["SEALED_CITY_TAG"],
    cityIntelligenceSummary: "SEALED_CITY_INTEL",
    hiddenNotes: ["SEALED_CITY_NOTE"]
  });
  worldState.worldGeography.countries.push({
    id: "country-hidden-prompt",
    kind: "neighbor",
    name: "Hidden Prompt Country",
    visibility: "hidden",
    publicSummary: "SEALED_COUNTRY_SUMMARY",
    policyPressureTags: ["SEALED_COUNTRY_TAG"],
    diplomaticPosture: "SEALED_COUNTRY_POSTURE",
    intelligenceSummary: "SEALED_COUNTRY_INTEL",
    hiddenNotes: ["SEALED_COUNTRY_NOTE"]
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-prompt",
    type: "road",
    name: "Hidden Prompt Route",
    fromCityId: "city-beijing",
    toCityId: "city-hidden-prompt",
    visibility: "hidden",
    publicSummary: "SEALED_ROUTE_PROMPT_SUMMARY",
    hiddenNotes: ["SEALED_ROUTE_PROMPT_NOTE"]
  });

  const summary = summarizeWorldGeographyForPrompt(worldState);
  const serialized = JSON.stringify(summary);

  assert.ok(summary.countries.length <= 4);
  assert.ok(summary.cities.length <= 6);
  assert.ok(summary.routes.length <= 4);
  assert.ok(summary.frontierZones.length <= 4);
  assert.ok(summary.officeJurisdictions.length <= 4);
  assert.match(serialized, /country-ming/);
  assert.doesNotMatch(serialized, /Hidden Prompt City/);
  assert.doesNotMatch(serialized, /SEALED_CITY_SUMMARY/);
  assert.doesNotMatch(serialized, /SEALED_CITY_INTEL/);
  assert.doesNotMatch(serialized, /SEALED_COUNTRY_POSTURE/);
  assert.doesNotMatch(serialized, /SEALED_ROUTE_PROMPT_NOTE/);
});

test("world geography normalization backfills legacy saves and clamps dynamic fields", () => {
  const worldState = createInitialState({ playerName: "Legacy Geo Tester" });
  worldState.worldGeography = {
    schemaVersion: 99,
    seedId: "bad id!",
    label: "  旧存档地理  ",
    countries: [{
      id: "country-ming",
      name: "大明旧档",
      visibility: "bad",
      pressure: 999,
      stability: -50,
      intelConfidence: 999
    }, {
      id: "country-custom-legacy",
      name: "旧档自定义国",
      visibility: "bad",
      pressure: 999,
      stability: -50,
      intelConfidence: 999,
      fiscalPressure: 999,
      militaryReadiness: -10,
      legitimacy: "bad"
    }],
    cities: [{
      id: "city-beijing",
      name: "北京旧档",
      pressure: 999,
      localOrder: -10,
      grainStress: 999
    }, {
      id: "city-custom-legacy",
      name: "旧档自定义城",
      countryId: "country-custom-legacy",
      regionId: "region-north-zhili",
      pressure: 999,
      localOrder: -10,
      grainStress: 999,
      taxBase: 999,
      lawsuitPressure: -4,
      waterworksIntegrity: "bad"
    }],
    recentNotes: ["旧档札记"]
  };

  const normalized = normalizeWorldGeographyState(worldState);
  const ming = normalized.countries.find((country) => country.id === "country-ming");
  const beijing = normalized.cities.find((city) => city.id === "city-beijing");
  const customCountry = normalized.countries.find((country) => country.id === "country-custom-legacy");
  const customCity = normalized.cities.find((city) => city.id === "city-custom-legacy");

  assert.equal(normalized.schemaVersion, WORLD_GEOGRAPHY_SCHEMA_VERSION);
  assert.equal(normalized.seedId, "late-ming-north-china");
  assert.equal(normalized.label, "旧存档地理");
  assert.ok(normalized.routes.some((route) => route.id === "route-grand-canal-north"));
  assert.ok(ming.pressure < 100);
  assert.ok(ming.stability > 0);
  assert.equal(ming.intelConfidence, 100);
  assert.equal(ming.visibility, "public");
  assert.ok(beijing.pressure < 100);
  assert.ok(beijing.localOrder > 0);
  assert.ok(beijing.grainStress < 100);
  assert.equal(customCountry.pressure, 100);
  assert.equal(customCountry.stability, 0);
  assert.equal(customCountry.intelConfidence, 100);
  assert.equal(customCountry.fiscalPressure, 100);
  assert.equal(customCountry.militaryReadiness, 0);
  assert.equal(customCountry.legitimacy, 55);
  assert.equal(customCountry.visibility, "public");
  assert.equal(customCity.pressure, 100);
  assert.equal(customCity.localOrder, 0);
  assert.equal(customCity.grainStress, 100);
  assert.equal(customCity.taxBase, 100);
  assert.equal(customCity.lawsuitPressure, 0);
  assert.equal(customCity.waterworksIntegrity, 52);
});

test("world geography ensure refreshes seed snapshots from current world metrics", () => {
  const worldState = createInitialState({ playerName: "Metric Geo Tester" });
  const before = worldState.worldGeography.frontierZones.find((frontier) => frontier.id === "frontier-shanhai-liaodong");

  worldState.turnCount = 4;
  worldState.borderThreat = 92;
  ensureWorldGeographyState(worldState);
  const after = worldState.worldGeography.frontierZones.find((frontier) => frontier.id === "frontier-shanhai-liaodong");

  assert.ok(after.pressure > before.pressure);
  assert.equal(after.status, "contested");
  assert.equal(after.lastUpdatedTurn, 4);
});

test("S61 city depth metrics refresh from economic, order, grain, and military pressure", () => {
  const worldState = createInitialState({ role: "official", playerName: "Dynamic City Tester" });
  const beforeBeijing = worldState.worldGeography.cities.find((city) => city.id === "city-beijing");
  const beforePass = worldState.worldGeography.cities.find((city) => city.id === "city-shanhai-pass");

  Object.assign(worldState, {
    turnCount: 8,
    taxRate: 68,
    grainReserve: 180,
    population: 6200,
    publicOrder: 24,
    corruption: 88,
    armyMorale: 22,
    borderThreat: 94
  });

  ensureWorldGeographyState(worldState);
  const afterBeijing = worldState.worldGeography.cities.find((city) => city.id === "city-beijing");
  const afterPass = worldState.worldGeography.cities.find((city) => city.id === "city-shanhai-pass");
  const view = buildWorldGeographyView(worldState);
  const prompt = summarizeWorldGeographyForPrompt(worldState);
  const promptBeijing = prompt.cities.find((city) => city.id === "city-beijing");

  assert.ok(afterBeijing.taxBase < beforeBeijing.taxBase);
  assert.ok(afterBeijing.grainStock < beforeBeijing.grainStock);
  assert.ok(afterBeijing.marketPriceStress > beforeBeijing.marketPriceStress);
  assert.ok(afterBeijing.lawsuitPressure > beforeBeijing.lawsuitPressure);
  assert.ok(afterBeijing.corveeBurden > beforeBeijing.corveeBurden);
  assert.ok(afterBeijing.waterworksIntegrity < beforeBeijing.waterworksIntegrity);
  assert.ok(afterBeijing.disasterRisk > beforeBeijing.disasterRisk);
  assert.ok(afterPass.garrisonStrength < beforePass.garrisonStrength);
  assert.equal(afterBeijing.lastUpdatedTurn, 8);
  assert.equal(view.cities.find((city) => city.id === "city-beijing").marketPriceStress, afterBeijing.marketPriceStress);
  assert.ok(promptBeijing);
  assert.equal(promptBeijing.lawsuitPressure, afterBeijing.lawsuitPressure);
});

test("S61 city depth metrics use seed baseline instead of accumulating across turns", () => {
  const worldState = createInitialState({ role: "official", playerName: "No Drift City Tester" });
  Object.assign(worldState, {
    turnCount: 8,
    taxRate: 68,
    grainReserve: 180,
    population: 6200,
    publicOrder: 24,
    corruption: 88,
    armyMorale: 22,
    borderThreat: 94
  });

  ensureWorldGeographyState(worldState);
  const first = worldState.worldGeography.cities.find((city) => city.id === "city-beijing");
  const firstSnapshot = {
    taxBase: first.taxBase,
    grainStock: first.grainStock,
    marketPriceStress: first.marketPriceStress,
    lawsuitPressure: first.lawsuitPressure,
    waterworksIntegrity: first.waterworksIntegrity,
    disasterRisk: first.disasterRisk
  };

  worldState.turnCount = 9;
  ensureWorldGeographyState(worldState);
  const second = worldState.worldGeography.cities.find((city) => city.id === "city-beijing");

  assert.deepEqual({
    taxBase: second.taxBase,
    grainStock: second.grainStock,
    marketPriceStress: second.marketPriceStress,
    lawsuitPressure: second.lawsuitPressure,
    waterworksIntegrity: second.waterworksIntegrity,
    disasterRisk: second.disasterRisk
  }, firstSnapshot);
  assert.equal(second.lastUpdatedTurn, 9);
});

test("ensureWorldGeographyState mutates missing ledgers and initial builder returns isolated copies", () => {
  const worldState = createInitialState({ playerName: "Ensure Geo Tester" });
  const first = createInitialWorldGeographyState(worldState);
  first.countries[0].name = "改名";
  const second = createInitialWorldGeographyState(worldState);

  delete worldState.worldGeography;
  ensureWorldGeographyState(worldState);

  assert.equal(second.countries[0].name, "大明");
  assert.equal(worldState.worldGeography.schemaVersion, WORLD_GEOGRAPHY_SCHEMA_VERSION);
  assert.ok(worldState.worldGeography.cities.some((city) => city.id === "city-beijing"));
});
