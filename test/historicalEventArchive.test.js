const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildHistoricalEventArchiveRows,
  buildHistoricalEventArchiveView,
  buildHistoricalEventRetrievalRows
} = require("../src/game/historicalEventArchive");
const { createInitialState } = require("../src/game/initialState");

function createHighPressureOfficialState() {
  const worldState = createInitialState({ role: "official", playerName: "事件链官员" });
  Object.assign(worldState, {
    turnCount: 12,
    treasury: 220,
    grainReserve: 160,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 28,
    borderThreat: 90,
    armyMorale: 32
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  Object.assign(worldState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue"
  });
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-visible",
    postingId: "posting-player-current",
    officeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    holderType: "player",
    status: "pending",
    meritScore: 42,
    riskScore: 82,
    recommendation: "watch",
    publicFinding: "任所奏报牵连户部钱粮、士绅压力与弹劾风险。",
    publicSummary: "户部钱粮考成吃紧，需复核漕册。",
    visibility: "office_visible",
    knownToPlayer: true,
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 12 },
    lastUpdatedTurn: 12
  });
  worldState.worldPeople.relationships.push({
    id: "rel-s65-visible",
    sourceType: "player",
    sourceId: "P1",
    targetType: "npc",
    targetId: "C01",
    relationship: -54,
    trust: 28,
    resentment: 82,
    stance: "疑忌钱粮稽核",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "赵给事对玩家核查钱粮颇有疑忌，人情怨望升高。",
    recentNotes: ["赵给事: 对漕册复核有疑。"],
    lastUpdatedTurn: 12
  });
  worldState.player.examHistory.push({
    examId: "child-exam-s65",
    level: "child_exam",
    examName: "童生试",
    examSubmittedAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 12 },
    score: { overall_score: 78, rank: "取中" },
    promotionResult: { passed: true, rank: "童生" },
    authenticityCheck: { severeCheat: false }
  });
  worldState.worldGeography.routes.push({
    id: "route-hidden-s65",
    type: "canal",
    name: "SEALED_S65_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    visibility: "hidden",
    risk: 99,
    publicSummary: "SEALED_S65_ROUTE prompt provider event_log sk-test-s65-route"
  });
  return worldState;
}

test("S65 historical event archive builds public chains and explicit server-only sealed projections", () => {
  const worldState = createHighPressureOfficialState();
  const publicView = buildHistoricalEventArchiveView(worldState);
  const sealedView = buildHistoricalEventArchiveView(worldState, { includeSealed: true });
  const serializedPublic = JSON.stringify(publicView);
  const domains = new Set(publicView.publicChains.map((chain) => chain.domain));

  assert.equal(publicView.schemaVersion, 1);
  assert.equal(publicView.generatedAtTurn, 12);
  assert.ok(publicView.publicChains.length > 0);
  assert.equal("sealedChains" in publicView, false);
  assert.ok(sealedView.sealedChains.length > 0);
  assert.ok(sealedView.sealedChains.every((chain) => chain.sealedProjection.visibility === "server_only"));
  assert.ok(domains.has("local_assignment") || domains.has("natural_disaster"));
  assert.ok(domains.has("market_tax"));
  assert.ok(domains.has("court_conflict"));
  assert.ok(publicView.publicChains.every((chain) =>
    chain.publicProjection.visibility === "public" &&
    Array.isArray(chain.relatedRefs) &&
    Array.isArray(chain.appliedChanges) &&
    Array.isArray(chain.auditLinks) &&
    Array.isArray(chain.followUpTriggers) &&
    !("hiddenNotice" in chain) &&
    !("sealedProjection" in chain)
  ));
  assert.doesNotMatch(serializedPublic, /SEALED_S65_ROUTE/);
  assert.doesNotMatch(serializedPublic, /sk-test-s65-route|provider|event_log|prompt/);
  assert.doesNotMatch(serializedPublic, /hiddenNotes|hiddenIntent|prompt_retrieval_index|event_archive_index/);
});

test("S65 historical event archive covers military, relationship, and exam chains when sources are visible", () => {
  const generalState = createInitialState({ role: "general", playerName: "事件链将领" });
  Object.assign(generalState, {
    turnCount: 7,
    borderThreat: 92,
    armyMorale: 28,
    grainReserve: 180,
    population: 7000
  });
  generalState.worldPeople.relationships.push({
    id: "rel-s65-general-visible",
    sourceType: "player",
    sourceId: "P1",
    targetType: "npc",
    targetId: "C01",
    relationship: -65,
    trust: 20,
    resentment: 88,
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "沈参将对军粮调拨心生怨望。",
    lastUpdatedTurn: 7
  });
  generalState.player.examHistory.push({
    examId: "provincial-exam-s65",
    level: "provincial_exam",
    examName: "乡试",
    examSubmittedAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 7 },
    score: { overall_score: 82, rank: "举人" },
    promotionResult: { passed: true, rank: "举人" }
  });

  const rows = buildHistoricalEventArchiveRows(generalState, { includeSealed: true });
  const domains = new Set(rows.map((row) => row.domain));
  const serialized = JSON.stringify(rows);

  assert.ok(domains.has("frontier"));
  assert.ok(domains.has("relationship"));
  assert.ok(domains.has("exam"));
  assert.ok(rows.some((row) => row.sealedProjection?.visibility === "server_only"));
  assert.doesNotMatch(serialized, /hiddenNotes|provider|prompt|event_log|sk-/);
});

test("S65 historical event retrieval rows stay public and do not mutate world state", () => {
  const worldState = createHighPressureOfficialState();
  const before = JSON.stringify(worldState);
  const rows = buildHistoricalEventRetrievalRows(worldState);
  const after = JSON.stringify(worldState);

  assert.equal(after, before);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) =>
    row.visibility === "public" &&
    row.publicSummary &&
    !("sealedProjection" in row)
  ));
});
