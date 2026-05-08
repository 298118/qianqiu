const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildOfficialCareerView } = require("../src/game/officialCareer");
const { buildWorldGeographyView } = require("../src/game/worldGeography");
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

test("S63 official ecosystem exposes appointment pool without changing appointment authority", () => {
  const worldState = createInitialState({ role: "official", playerName: "任命池官员" });
  const beforeOfficeTitle = worldState.player.officeTitle;
  const beforeCurrentPosting = worldState.officialCareer.currentPosting;
  worldState.officialCareer.assignments = [{
    id: "assignment-visible-docket",
    title: "核查官缺",
    status: "active"
  }, {
    id: "assignment-resolved-docket",
    title: "已结差事",
    status: "resolved"
  }];

  ensureOfficialPostingsState(worldState);
  const first = JSON.stringify(worldState.officialPostings);
  ensureOfficialPostingsState(worldState);
  const view = buildOfficialPostingsView(worldState);
  const promptSummary = summarizeOfficialPostingsForPrompt(worldState);
  const playerPosting = view.postings.find((row) => row.id === "posting-player-current");
  const superior = view.postings.find((row) => row.id === "posting-s63-superior-current");
  const interfacePosting = view.postings.find((row) => row.id === "posting-s63-office-interface-current");
  const vacancy = view.postings.find((row) => row.id === "posting-s63-vacancy-1");
  const candidateTransfer = view.transferRecords.find((row) => row.id === "transfer-s63-candidate-1");
  const mourningTransfer = view.transferRecords.find((row) => row.id === "transfer-s63-mourning-vacancy");
  const restorationTransfer = view.transferRecords.find((row) => row.id === "transfer-s63-restoration-pending");
  const vacancyAssessment = view.assessmentRecords.find((row) => row.id === "assessment-s63-vacancy-1");
  const impeachmentAssessment = view.assessmentRecords.find((row) => row.id === "assessment-s63-impeachment-watch");
  const serializedPrompt = JSON.stringify(promptSummary);

  assert.equal(JSON.stringify(worldState.officialPostings), first);
  assert.equal(playerPosting.superiorPostingId, "posting-s63-superior-current");
  assert.deepEqual(playerPosting.assignmentIds, ["assignment-visible-docket"]);
  assert.equal(superior.status, "active");
  assert.match(superior.publicSummary, /上级堂官|服务器官场结算/);
  assert.equal(interfacePosting.status, "acting");
  assert.match(interfacePosting.publicSummary, /胥吏幕友|属官同僚|地方士绅接口/);
  assert.equal(vacancy.status, "vacant");
  assert.equal(vacancy.holderType, "vacant");
  assert.equal(vacancy.holderId, "");
  assert.match(vacancy.publicSummary, /候补|补授|试署|外放|服务器裁决/);
  assert.equal(candidateTransfer.status, "proposed");
  assert.match(candidateTransfer.publicReason, /候补池|AI 只能读取/);
  assert.equal(mourningTransfer.type, "mourning_leave");
  assert.match(mourningTransfer.publicReason, /丁忧/);
  assert.equal(restorationTransfer.type, "restoration");
  assert.match(restorationTransfer.publicReason, /起复候拟/);
  assert.equal(vacancyAssessment.status, "pending");
  assert.match(vacancyAssessment.publicFinding, /官缺压力|吏部铨选/);
  assert.equal(impeachmentAssessment.recommendation, "impeachment");
  assert.match(impeachmentAssessment.publicFinding, /弹劾|服务器裁决/);
  assert.match(serializedPrompt, /候补|官缺|任命池/);
  assert.equal(worldState.player.officeTitle, beforeOfficeTitle);
  assert.equal(worldState.officialCareer.currentPosting, beforeCurrentPosting);
});

test("official assessment summaries read S61 city depth metrics", () => {
  const worldState = createInitialState({ role: "official", playerName: "任所考成" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  worldState.officialCareer.assessmentDossier.notes.push("已有考成札记：钱粮文册待核。");
  Object.assign(worldState, {
    turnCount: 5,
    taxRate: 68,
    grainReserve: 180,
    population: 6200,
    publicOrder: 24,
    corruption: 88,
    borderThreat: 80,
    armyMorale: 30
  });

  ensureOfficialPostingsState(worldState);
  const geoView = buildWorldGeographyView(worldState);
  const view = buildOfficialPostingsView(worldState);
  const posting = view.postings.find((row) => row.id === "posting-player-current");
  const city = geoView.cities.find((row) => row.id === posting.cityId);
  const jurisdiction = view.cityJurisdictions.find((row) => row.id === posting.jurisdictionId);
  const assessment = view.assessmentRecords.find((row) => row.id === "assessment-player-current");
  const promptSummary = summarizeOfficialPostingsForPrompt(worldState);

  assert.ok(city);
  assert.equal(jurisdiction.localMetrics.taxCapacity <= city.taxBase + 10, true);
  assert.equal(jurisdiction.localMetrics.lawsuits, city.lawsuitPressure);
  assert.equal(jurisdiction.localMetrics.waterworks, city.waterworksIntegrity);
  assert.equal(jurisdiction.localMetrics.gentryInfluence, city.gentryInfluence);
  assert.equal(jurisdiction.localMetrics.disasterRisk, city.disasterRisk);
  assert.match(assessment.publicFinding, /已有考成札记/);
  assert.match(assessment.publicFinding, /任所奏报/);
  assert.match(assessment.publicFinding, /税基偏薄|粮储吃紧|市价承压|士绅势重/);
  assert.match(assessment.publicSummary, /税基偏薄|粮储吃紧|市价承压|士绅势重/);
  assert.match(JSON.stringify(promptSummary.assessmentRecords), /税基偏薄|粮储吃紧|市价承压|士绅势重/);
});

test("magistrate postings map local yamen role to deterministic visible city metrics", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "地方官" });
  Object.assign(worldState.player, {
    position: "户部主事",
    localOrder: 73,
    pendingLawsuits: 6,
    waterworks: 61,
    gentryRelations: 55,
    banditPressure: 90
  });
  worldState.borderThreat = 10;
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
  assert.ok(jurisdiction.localMetrics.militaryPressure >= 50);
  assert.match(posting.publicSummary, /清河县映射至/);
});

test("magistrate postings keep player bandit pressure ahead of city projection for military pressure", () => {
  const basePlayer = {
    countyName: "清河县",
    localOrder: 70,
    pendingLawsuits: 8,
    waterworks: 62,
    gentryRelations: 52
  };
  const lowBanditState = createInitialState({ role: "magistrate", playerName: "低盗地方官" });
  const highBanditState = createInitialState({ role: "magistrate", playerName: "高盗地方官" });
  Object.assign(lowBanditState.player, basePlayer, { banditPressure: 5 });
  Object.assign(highBanditState.player, basePlayer, { banditPressure: 95 });
  lowBanditState.borderThreat = 15;
  highBanditState.borderThreat = 15;

  ensureOfficialPostingsState(lowBanditState);
  ensureOfficialPostingsState(highBanditState);
  const lowView = buildOfficialPostingsView(lowBanditState);
  const highView = buildOfficialPostingsView(highBanditState);
  const lowPosting = lowView.postings.find((row) => row.id === "posting-player-current");
  const highPosting = highView.postings.find((row) => row.id === "posting-player-current");
  const lowMetrics = lowView.cityJurisdictions.find((row) => row.id === lowPosting.jurisdictionId).localMetrics;
  const highMetrics = highView.cityJurisdictions.find((row) => row.id === highPosting.jurisdictionId).localMetrics;

  assert.equal(lowPosting.cityId, highPosting.cityId);
  assert.ok(highMetrics.militaryPressure > lowMetrics.militaryPressure + 35);
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
