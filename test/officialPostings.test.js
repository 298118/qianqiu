const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildOfficialCareerView } = require("../src/game/officialCareer");
const {
  buildOfficialPostingsView,
  ensureOfficialPostingsState,
  summarizeOfficialPostingsForPrompt
} = require("../src/game/officialPostings");

const LOCAL_CITY_IDS = ["city-suzhou", "city-hangzhou", "city-kaifeng", "city-guangzhou"];

test("initial official postings bridge links current official office to visible city data", () => {
  const worldState = createInitialState({ role: "official", playerName: "任所官员" });
  const view = buildOfficialPostingsView(worldState);
  const posting = view.postings.find((row) => row.id === "posting-player-current");

  assert.equal(worldState.officialPostings.schemaVersion, 1);
  assert.ok(view.bureaus.some((bureau) => bureau.id === "ministry_personnel"));
  assert.ok(view.offices.some((office) => office.id === "probationary_observer"));
  assert.equal(posting.officeId, "probationary_observer");
  assert.equal(posting.officeTitle, "六部观政进士");
  assert.equal(posting.cityId, "city-beijing");
  assert.equal(posting.jurisdictionId, "jurisdiction-ministry-personnel-capital-city-beijing");
  assert.ok(view.cityJurisdictions.some((row) =>
    row.id === posting.jurisdictionId &&
    row.cityId === "city-beijing" &&
    row.localMetrics.publicOrder >= 0
  ));
});

test("magistrate postings map local yamen role to deterministic visible city metrics", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "地方官" });
  Object.assign(worldState.player, {
    position: "户部主事",
    localOrder: 73,
    pendingLawsuits: 6,
    waterworks: 61,
    gentryRelations: 55
  });
  ensureOfficialPostingsState(worldState);
  const view = buildOfficialPostingsView(worldState);
  const posting = view.postings.find((row) => row.id === "posting-player-current");
  const jurisdiction = view.cityJurisdictions.find((row) => row.id === posting.jurisdictionId);

  assert.equal(buildOfficialCareerView(worldState).active, false);
  assert.equal(posting.officeId, "county_magistrate");
  assert.equal(posting.officeTitle, "知县");
  assert.equal(posting.bureauId, "prefecture_county");
  assert.ok(LOCAL_CITY_IDS.includes(posting.cityId));
  assert.equal(jurisdiction.bureauId, "prefecture_county");
  assert.equal(jurisdiction.localMetrics.publicOrder, 73);
  assert.equal(jurisdiction.localMetrics.lawsuits, 6);
  assert.equal(jurisdiction.localMetrics.waterworks, 61);
  assert.match(posting.publicSummary, /清河县映射至/);
});

test("official postings bridge clips hidden geography references from raw state, view, and prompt", () => {
  const worldState = createInitialState({ role: "official", playerName: "隐藏探针" });
  worldState.worldGeography.cities.push({
    id: "city-hidden-posting",
    countryId: "country-ming",
    regionId: "region-north-zhili",
    name: "SEALED_POSTING_CITY",
    visibility: "hidden",
    publicSummary: "SEALED_POSTING_CITY_SUMMARY",
    hiddenNotes: ["SEALED_POSTING_CITY_NOTE"]
  });
  worldState.officialPostings.cityJurisdictions.push({
    id: "jurisdiction-hidden-posting-city",
    name: "Hidden Posting Jurisdiction",
    bureauId: "ministry_revenue",
    cityId: "city-hidden-posting",
    regionId: "region-north-zhili",
    countryId: "country-ming",
    routeIds: ["route-hidden-liaodong-smuggling"],
    frontierZoneIds: ["frontier-hidden-palace-intel"],
    visibility: "public",
    publicSummary: "SEALED_POSTING_JURISDICTION"
  });
  worldState.officialPostings.postings.push({
    id: "posting-hidden-city",
    officeId: "ministry_revenue_principal",
    officeTitle: "户部主事",
    bureauId: "ministry_revenue",
    holderType: "player",
    holderId: "P1",
    cityId: "city-hidden-posting",
    jurisdictionId: "jurisdiction-hidden-posting-city",
    visibility: "office_visible",
    knownToPlayer: true,
    publicSummary: "SEALED_POSTING_ROW",
    hiddenNotes: ["SEALED_POSTING_ROW_NOTE"]
  });

  ensureOfficialPostingsState(worldState);
  const view = buildOfficialPostingsView(worldState);
  const promptSummary = summarizeOfficialPostingsForPrompt(worldState);
  const serialized = JSON.stringify({
    raw: worldState.officialPostings,
    view,
    promptSummary
  });

  assert.equal(serialized.includes("city-hidden-posting"), false);
  assert.equal(serialized.includes("route-hidden-liaodong-smuggling"), false);
  assert.equal(serialized.includes("frontier-hidden-palace-intel"), false);
  assert.equal(serialized.includes("SEALED_POSTING"), false);
});

test("official postings bridge derives idempotent transfer records from server career history", () => {
  const worldState = createInitialState({ role: "official", playerName: "迁转官员" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue",
    tenureMonths: 2,
    careerHistory: [{
      id: "OC-0001-appointment",
      type: "appointment",
      label: "实授户部主事",
      status: "resolved",
      year: 1644,
      month: 1,
      tenDayPeriod: 2,
      turn: 1,
      officeTitleBefore: "候选观政",
      officeTitleAfter: "户部主事",
      reason: "考成具奏，服务器实授。"
    }]
  });

  ensureOfficialPostingsState(worldState);
  const first = JSON.stringify(worldState.officialPostings);
  ensureOfficialPostingsState(worldState);
  const view = buildOfficialPostingsView(worldState);
  const posting = view.postings.find((row) => row.id === "posting-player-current");
  const transfer = view.transferRecords.find((row) => row.id === "transfer-OC-0001-appointment");
  const promptSummary = summarizeOfficialPostingsForPrompt(worldState);

  assert.equal(JSON.stringify(worldState.officialPostings), first);
  assert.equal(posting.officeId, "ministry_revenue_principal");
  assert.equal(posting.cityId, "city-beijing");
  assert.equal(posting.termMonths, 2);
  assert.equal(transfer.type, "appointment");
  assert.equal(transfer.status, "applied");
  assert.equal(transfer.fromOfficeId, "probationary_observer");
  assert.equal(transfer.toOfficeId, "ministry_revenue_principal");
  assert.equal(transfer.toCityId, "city-beijing");
  assert.ok(promptSummary.postings.some((row) => row.officeId === "ministry_revenue_principal"));
});
