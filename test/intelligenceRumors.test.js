const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildIntelligenceRumorRetrievalRows,
  buildIntelligenceRumorView
} = require("../src/game/intelligenceRumors");

function createHighPressureState(role = "official") {
  const worldState = createInitialState({ role, playerName: "情报测试" });
  Object.assign(worldState, {
    turnCount: 11,
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 26,
    borderThreat: 88,
    armyMorale: 34
  });
  Object.assign(worldState.player, {
    officeTitle: role === "official" ? "户部主事" : worldState.player.officeTitle,
    position: role === "official" ? "户部主事" : worldState.player.position
  });
  if (role === "official") {
    worldState.officialCareer.currentPosting = "户部主事";
    worldState.officialCareer.bureauId = "ministry_revenue";
  }
  worldState.worldPeople.relationships.push({
    id: "rel-s65-2-visible",
    sourceType: "player",
    sourceId: "P1",
    targetType: "npc",
    targetId: "C01",
    relationship: -58,
    trust: 24,
    resentment: 84,
    stance: "疑忌钱粮稽核",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "赵给事对玩家核查钱粮颇有疑忌，人情怨望升高。",
    recentNotes: ["赵给事: 对漕册复核有疑。"],
    lastUpdatedTurn: 11
  });
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-2-visible",
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
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 11 },
    lastUpdatedTurn: 11
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-s65-2",
    type: "canal",
    name: "SEALED_S65_2_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    visibility: "hidden",
    risk: 99,
    publicSummary: "SEALED_S65_2_ROUTE prompt provider event_log sk-test-s65-2"
  });
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-s65-2",
    name: "SEALED_S65_2_NPC",
    visibility: "hidden",
    knownToPlayer: false,
    publicSummary: "SEALED_S65_2_NPC_SUMMARY",
    hiddenIntent: "SEALED_S65_2_INTENT",
    hiddenNotes: ["SEALED_S65_2_NOTE"]
  });
  return worldState;
}

test("S65.2 intelligence rumor view derives role-scoped rumors with source attribution", () => {
  const officialState = createHighPressureState("official");
  const generalState = createHighPressureState("general");
  const scholarState = createHighPressureState("scholar");
  const officialView = buildIntelligenceRumorView(officialState);
  const generalView = buildIntelligenceRumorView(generalState);
  const scholarView = buildIntelligenceRumorView(scholarState);

  assert.equal(officialView.schemaVersion, 1);
  assert.equal(officialView.generatedAtTurn, 11);
  assert.ok(officialView.publicRumors.length > 0);
  assert.ok(officialView.publicRumors.length <= 9);
  assert.ok(generalView.publicRumors.some((rumor) => rumor.channel === "军中侦报"));
  assert.ok(scholarView.publicRumors.every((rumor) => rumor.channel === "坊间传闻"));
  assert.ok(officialView.publicRumors.every((rumor) =>
    rumor.publicSummary &&
    rumor.credibilityScore >= 0 &&
    rumor.credibilityScore <= 82 &&
    rumor.sourceAttributions.length > 0 &&
    rumor.sourceAttributions.every((source) => source.sourceView && source.sourceId) &&
    rumor.authorityBoundary.includes("服务器")
  ));
  assert.match(JSON.stringify(officialView), /同僚私信|官署奏报|情报/);
});

test("S65.2 intelligence rumor view strips hidden sources and sensitive text", () => {
  const worldState = createHighPressureState("official");
  const before = JSON.stringify(worldState);
  const view = buildIntelligenceRumorView(worldState);
  const rows = buildIntelligenceRumorRetrievalRows(worldState);
  const serialized = JSON.stringify({ view, rows });

  assert.equal(JSON.stringify(worldState), before);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.publicSummary && row.sourceAttributions.length > 0));
  assert.doesNotMatch(serialized, /SEALED_S65_2/);
  assert.doesNotMatch(serialized, /hiddenNotes|hiddenIntent|sealedProjection|server_only/);
  assert.doesNotMatch(serialized, /prompt_retrieval_index|event_archive_index|event_log|provider|prompt|sk-test-s65-2/);
});
