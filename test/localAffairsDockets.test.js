const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildLocalAffairsDocketView,
  summarizeLocalAffairsDocketsForPrompt
} = require("../src/game/localAffairsDockets");

test("S63.2 magistrate local affairs dockets cover core domains without changing authority state", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "案牍知县" });
  Object.assign(worldState.player, {
    localOrder: 28,
    pendingLawsuits: 82,
    waterworks: 22,
    gentryRelations: 78,
    banditPressure: 88,
    corveeBurden: 76
  });
  worldState.grainReserve = 160;
  worldState.population = 6400;
  const beforePlayer = JSON.stringify(worldState.player);
  const beforeCareer = JSON.stringify(worldState.officialCareer);

  const view = buildLocalAffairsDocketView(worldState);
  const domains = new Set(view.dockets.map((docket) => docket.domain));
  const serialized = JSON.stringify(view);

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.dockets.length, 9);
  for (const domain of [
    "revenue",
    "judicial",
    "relief",
    "waterworks",
    "banditry",
    "corvee",
    "gentry",
    "epidemic",
    "term_closure"
  ]) {
    assert.equal(domains.has(domain), true, domain);
  }
  assert.ok(view.dockets.every((docket) =>
    docket.id &&
    docket.cityId &&
    docket.jurisdictionId &&
    docket.metricRefs.length > 0 &&
    docket.assessmentHint?.kind === "official_assessment_signal" &&
    docket.authorityBoundary.includes("服务器")
  ));
  assert.ok(view.dockets.some((docket) => docket.domain === "judicial" && docket.pressureScore >= 70));
  assert.ok(view.dockets.some((docket) => docket.domain === "waterworks" && docket.pressureScore >= 70));
  assert.match(serialized, /钱粮|刑名|灾赈|水利|盗匪|徭役|士绅|疫病|任所收束/);
  assert.doesNotMatch(serialized, /statePatch|provider|proposal|prompt|data\/sessions|sk-/);
  assert.equal(JSON.stringify(worldState.player), beforePlayer);
  assert.equal(JSON.stringify(worldState.officialCareer), beforeCareer);
});

test("S63.2 scholar view does not expose administrative dockets", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "案牍书生" });
  const view = buildLocalAffairsDocketView(worldState);
  const promptSummary = summarizeLocalAffairsDocketsForPrompt(worldState);

  assert.equal(view.dockets.length, 0);
  assert.equal(view.counts.total, 0);
  assert.match(view.hiddenNotice, /行政身份/);
  assert.deepEqual(promptSummary.dockets, []);
});

test("S63.2 official dockets derive stable city and posting metrics", () => {
  const worldState = createInitialState({ role: "official", playerName: "案牍官员" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  Object.assign(worldState, {
    turnCount: 6,
    taxRate: 70,
    grainReserve: 150,
    population: 7000,
    publicOrder: 25,
    corruption: 88,
    borderThreat: 75
  });

  const first = buildLocalAffairsDocketView(worldState);
  const second = buildLocalAffairsDocketView(worldState);
  const revenue = first.dockets.find((docket) => docket.domain === "revenue");
  const termClosure = first.dockets.find((docket) => docket.domain === "term_closure");

  assert.deepEqual(first, second);
  assert.equal(revenue.cityId, "city-beijing");
  assert.equal(revenue.bureauId, "ministry_revenue");
  assert.match(revenue.publicSummary, /钱粮奏销|指标/);
  assert.equal(revenue.metricRefs.some((ref) => ref.key === "taxCapacity"), true);
  assert.equal(termClosure.postingId, "posting-player-current");
  assert.match(termClosure.publicDocket, /AI 不得直接结算升降/);
});
