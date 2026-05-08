const test = require("node:test");
const assert = require("node:assert/strict");

const { listBureaus } = require("../src/game/officialCatalog");
const {
  WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION,
  buildWorldGeographySeedView,
  getDefaultWorldGeographySeed,
  normalizeWorldGeographySeed,
  validateWorldGeographySeed
} = require("../src/game/worldGeographySeeds");

test("default geography seed defines static countries, cities, routes, frontiers, and jurisdictions", () => {
  const seed = getDefaultWorldGeographySeed();
  const countryKinds = new Set(seed.countries.map((country) => country.kind));
  const routeTypes = new Set(seed.routes.map((route) => route.type));
  const jurisdictionBureaus = new Set(seed.officeJurisdictions.map((jurisdiction) => jurisdiction.bureauId));

  assert.equal(seed.schemaVersion, WORLD_GEOGRAPHY_SEED_SCHEMA_VERSION);
  assert.equal(seed.seedId, "late-ming-north-china");
  assert.ok(seed.countries.length >= 5);
  assert.ok(seed.regions.length >= 6);
  assert.ok(seed.cities.length >= 12);
  assert.ok(seed.routes.length >= 5);
  assert.ok(seed.frontierZones.length >= 4);
  assert.ok(seed.officeJurisdictions.length >= 8);
  assert.equal(countryKinds.has("player_realm"), true);
  assert.equal(countryKinds.has("neighbor"), true);
  assert.equal(countryKinds.has("tributary"), true);
  assert.equal(routeTypes.has("canal"), true);
  assert.equal(routeTypes.has("road"), true);
  assert.equal(routeTypes.has("pass"), true);
  assert.equal(jurisdictionBureaus.has("ministry_revenue"), true);
  assert.equal(jurisdictionBureaus.has("ministry_war"), true);
  assert.equal(seed.cities.find((city) => city.id === "city-kaifeng").regionId, "region-henan");
  assert.ok(seed.regions.some((region) => region.id === "region-henan"));
  assert.equal(typeof seed.countries.find((country) => country.id === "country-ming").fiscalPressure, "number");
  assert.equal(typeof seed.countries.find((country) => country.id === "country-manchu-frontier").diplomaticTension, "number");
  assert.equal(typeof seed.cities.find((city) => city.id === "city-beijing").taxBase, "number");
  assert.equal(typeof seed.cities.find((city) => city.id === "city-kaifeng").disasterRisk, "number");
  assert.deepEqual(validateWorldGeographySeed(seed), []);
});

test("default geography seed references existing official bureaus", () => {
  const seed = getDefaultWorldGeographySeed();
  const bureauIds = new Set(listBureaus().map((bureau) => bureau.id));
  const referencedBureaus = new Set([
    ...seed.cities.flatMap((city) => city.supervisingBureauIds),
    ...seed.officeJurisdictions.map((jurisdiction) => jurisdiction.bureauId)
  ]);

  for (const bureauId of referencedBureaus) {
    assert.equal(bureauIds.has(bureauId), true, `${bureauId} should exist in officialCatalog`);
  }
});

test("geography seed view filters hidden rows and hidden notes", () => {
  const view = buildWorldGeographySeedView();
  const serialized = JSON.stringify(view);

  assert.equal(serialized.includes("route-hidden-liaodong-smuggling"), false);
  assert.equal(serialized.includes("frontier-hidden-palace-intel"), false);
  assert.equal(serialized.includes("SEALED_LIAODONG_SMUGGLING_ROUTE"), false);
  assert.equal(serialized.includes("SEALED_ROUTE_RISK"), false);
  assert.equal(serialized.includes("SEALED_ROUTE_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_ROUTE_NOTE"), false);
  assert.equal(serialized.includes("SEALED_FRONTIER_TITLE"), false);
  assert.equal(serialized.includes("SEALED_FRONTIER_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_FRONTIER_NOTE"), false);
  assert.ok(view.countries.some((country) => country.id === "country-ming"));
  assert.ok(view.routes.some((route) => route.id === "route-grand-canal-north"));
  assert.ok(view.frontierZones.some((frontier) => frontier.id === "frontier-shanhai-liaodong"));
});

test("geography seed view filters hidden ids from visible row references", () => {
  const seed = getDefaultWorldGeographySeed();
  seed.frontierZones.push({
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
  seed.officeJurisdictions.push({
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

  const view = buildWorldGeographySeedView(seed);
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

test("geography seed normalization clamps legacy visibility, confidence, ids, and list sizes", () => {
  const normalized = normalizeWorldGeographySeed({
    schemaVersion: 99,
    seedId: "bad id!",
    label: "  自定义种子  ",
    countries: [
      {
        id: "country-test",
        kind: "bad",
        name: "测试国",
        shortName: "",
        polityType: "",
        rulerTitle: "",
        capitalCityId: "city-test",
        visibility: "sealed",
        intelConfidence: 999,
        cultureTags: ["甲", "甲", "乙"],
        governmentTags: ["制"],
        fiscalPressure: 999,
        militaryReadiness: -10,
        successionRisk: "bad",
        policyPressureTags: ["压", "压", "贡"],
        diplomaticPosture: "  观望  ",
        intelligenceSummary: "  据报未详  ",
        publicSummary: "  可见摘要  ",
        hiddenNotes: ["密记"]
      }
    ],
    regions: [],
    cities: [
      {
        id: "city-test",
        countryId: "country-test",
        regionId: "missing-region",
        name: "测试城",
        supervisingBureauIds: ["ministry_revenue", "ministry_revenue", "bad id!"],
        visibility: "rumor",
        intelConfidence: -20,
        populationScale: 999,
        taxBase: -10,
        waterworksIntegrity: "bad",
        localIssueTags: ["案", "案", "水"],
        cityIntelligenceSummary: "  城市札记  "
      }
    ],
    routes: [
      {
        id: "route-test",
        type: "bad",
        name: "测试路",
        fromCityId: "city-test",
        toCityId: "missing-city",
        viaCityIds: ["city-test", "city-test", "bad id!"],
        visibility: "hidden"
      }
    ],
    frontierZones: [],
    officeJurisdictions: []
  });

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.seedId, "late-ming-north-china");
  assert.equal(normalized.label, "自定义种子");
  assert.equal(normalized.countries[0].kind, "neighbor");
  assert.equal(normalized.countries[0].visibility, "public");
  assert.equal(normalized.countries[0].intelConfidence, 100);
  assert.deepEqual(normalized.countries[0].cultureTags, ["甲", "乙"]);
  assert.equal(normalized.countries[0].fiscalPressure, 100);
  assert.equal(normalized.countries[0].militaryReadiness, 0);
  assert.equal(normalized.countries[0].successionRisk, 44);
  assert.deepEqual(normalized.countries[0].policyPressureTags, ["压", "贡"]);
  assert.equal(normalized.countries[0].diplomaticPosture, "观望");
  assert.equal(normalized.countries[0].intelligenceSummary, "据报未详");
  assert.equal(normalized.cities[0].visibility, "rumor");
  assert.equal(normalized.cities[0].intelConfidence, 0);
  assert.deepEqual(normalized.cities[0].supervisingBureauIds, ["ministry_revenue"]);
  assert.equal(normalized.cities[0].populationScale, 100);
  assert.equal(normalized.cities[0].taxBase, 0);
  assert.equal(normalized.cities[0].waterworksIntegrity, 50);
  assert.deepEqual(normalized.cities[0].localIssueTags, ["案", "水"]);
  assert.equal(normalized.cities[0].cityIntelligenceSummary, "城市札记");
  assert.equal(normalized.routes[0].type, "road");
  assert.deepEqual(normalized.routes[0].viaCityIds, ["city-test"]);
});

test("geography seed validation reports dangling references and duplicate ids", () => {
  const seed = getDefaultWorldGeographySeed();
  seed.countries.push({ ...seed.countries[0] });
  seed.cities[0].countryId = "missing-country";
  seed.routes[0].toCityId = "missing-city";
  seed.frontierZones[0].routeIds.push("missing-route");
  seed.officeJurisdictions[0].frontierZoneIds.push("missing-frontier");

  const issues = validateWorldGeographySeed(seed);
  const serialized = JSON.stringify(issues);

  assert.match(serialized, /country id/);
  assert.match(serialized, /missing-country/);
  assert.match(serialized, /missing-city/);
  assert.match(serialized, /missing-route/);
  assert.match(serialized, /missing-frontier/);
});

test("getDefaultWorldGeographySeed returns an isolated normalized copy", () => {
  const first = getDefaultWorldGeographySeed();
  first.countries[0].name = "改名";
  first.routes.push({ id: "route-added", name: "新增路线" });

  const second = getDefaultWorldGeographySeed();

  assert.equal(second.countries[0].name, "大明");
  assert.equal(second.routes.some((route) => route.id === "route-added"), false);
});
