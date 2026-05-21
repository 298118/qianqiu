const test = require("node:test");
const assert = require("node:assert/strict");

const { buildClientWorldState, isForbiddenClientWorldStateKey } = require("../src/game/clientWorldState");
const { buildDomainConsequenceView } = require("../src/game/domainConsequenceTrace");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const { ensureNpcEconomyLedgerState } = require("../src/game/npcEconomy");
const { buildResolverInputContext } = require("../src/game/resolverInputContext");
const { buildSafeSearchRows, searchSafeWorldIndex } = require("../src/game/safeWorldSearch");
const { buildTopicSurfaceView } = require("../src/game/topicSurfaceView");
const {
  buildPlayerMonthlyBriefingContext,
  generateMonthlyBriefingProposal
} = require("../src/game/playerMonthlyBriefing");
const { defineGameTurnResponse } = require("../src/routes/routeResponses");
const {
  buildWorldThreadView,
  ensureWorldThreadState
} = require("../src/game/worldThreads");

const sessionId = "00000000-0000-4000-8000-000000000886";

function seedDomainConsequences() {
  const worldState = createInitialState({ role: "magistrate", playerName: "后果追踪知县" });
  worldState.sessionId = sessionId;
  worldState.year = 1644;
  worldState.month = 3;
  worldState.tenDayPeriod = 2;
  worldState.turnCount = 42;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "role-cycle:42:magistrate:market_regulation:market:grain:SEALED_SOURCE",
      policyType: "market_regulation",
      policyLabel: "平抑米价",
      status: "accepted",
      publicSummary: "县中平抑米价，粮商愿照牌价出售。",
      publicSourceId: "market:grain:public-source",
      stateDelta: { publicOrder: 4, treasury: -20 },
      playerDelta: { performanceMerit: 1 },
      resourceUse: { silver: 100 },
      evidenceRefs: ["market:grain:SEALED_SOURCE"],
      auditRecord: { rawSql: "select * from hidden_table" },
      appliedAtTurn: 42
    }, {
      outcomeId: "city-policy-polluted",
      policyType: "relief",
      policyLabel: "SEALED_CITY hiddenNotes rawSql",
      status: "accepted",
      publicSummary: "SEALED_CITY hiddenNotes rawSql /mnt/e/LSMNQ/data/sessions/secret.json",
      stateDelta: { publicOrder: 999 },
      appliedAtTurn: 42
    }, {
      outcomeId: "city-policy-internal-token",
      policyType: "relief",
      policyLabel: "内部字段污染",
      status: "accepted",
      publicSummary: "evidenceRefs: market:grain stateDelta publicOrder auditRecord outcomeId",
      stateDelta: { publicOrder: 999 },
      appliedAtTurn: 42
    }]
  };
  worldState.militaryDiplomacyLedger = {
    records: [{
      outcomeId: "military:42:resupply:frontier:sealed",
      resolverKind: "military",
      actionKind: "resupply",
      actionLabel: "调拨粮饷",
      status: "accepted",
      publicResolution: { summary: "边镇据粮道材料调拨粮饷，军心稍稳。" },
      stateDelta: { grainReserve: -40, armyMorale: 3 },
      playerDelta: { supply: 4, campaignRisk: -1 },
      resourceCost: { grain: 40 },
      evidenceRefs: ["military:frontier:SEALED_SOURCE"],
      appliedAtTurn: 43
    }]
  };
  worldState.judicialCaseLedger = {
    records: [{
      outcomeId: "judicial:42:mediate:case-local-secret",
      caseId: "case-local-secret",
      caseAction: "mediate",
      actionLabel: "堂上调停",
      status: "accepted",
      publicDocket: { summary: "堂上调停邻里田界词讼，暂息争端。" },
      stateDelta: { publicOrder: 3 },
      playerDelta: { pendingLawsuits: -2 },
      relationshipSignals: [{ actorId: "npc:hidden", delta: -5 }],
      evidenceRefs: ["local_docket:SEALED_CASE"],
      auditRecord: { rawSql: "update world_sessions" },
      appliedAtTurn: 44
    }]
  };
  const npcEconomyLedger = ensureNpcEconomyLedgerState(worldState);
  npcEconomyLedger.lastTickTurn = 45;
  npcEconomyLedger.lastMonthlyPeriodKey = "1644-03";
  npcEconomyLedger.recentEvents = [
    "韩绅田庄按月入账，佃户欠粮暂记。",
    "SEALED_NPC privateSignalTags rawLedger /mnt/e/LSMNQ/data/sessions/secret.json"
  ];
  return worldState;
}

function assertNoInternalConsequenceLeak(value) {
  const payload = JSON.stringify(value);
  assert.doesNotMatch(
    payload,
    /cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|"affectedMetrics"|stateDelta|playerDelta|resourceUse|resourceCost|relationshipSignals|evidenceRefs|auditRecord|outcomeId|rawSql|SEALED_|market:grain|case-local-secret|role-cycle:|"path"|"publicOrder"|"grainReserve"|"armyMorale"|"pendingLawsuits"|"campaignRisk"|"performanceMerit"|"supply"/
  );
}

function assertNoInternalConsequenceValueLeak(value) {
  const payload = JSON.stringify(value);
  assert.doesNotMatch(
    payload,
    /cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|"affectedMetrics"|stateDelta|playerDelta|resourceUse|resourceCost|relationshipSignals|auditRecord|outcomeId|rawSql|SEALED_|market:grain|case-local-secret|role-cycle:|"path"|"publicOrder"|"grainReserve"|"armyMorale"|"pendingLawsuits"|"campaignRisk"|"performanceMerit"|"supply"/
  );
}

test("S88.6 domain consequence view projects public traces without resolver internals", () => {
  const worldState = seedDomainConsequences();
  const view = buildDomainConsequenceView(worldState);

  assert.equal(view.active, true);
  assert.equal(view.counts.city_policy, 1);
  assert.equal(view.counts.military_diplomacy, 1);
  assert.equal(view.counts.judicial_case, 1);
  assert.equal(view.counts.npc_economy, 1);
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "city_policy"));
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "judicial_case"));
  assert.ok(view.recentConsequences.some((item) => item.sourceType === "npc_economy"));
  assert.ok(view.recentConsequences.every((item) => !item.sourceId.includes("SEALED_SOURCE")));
  assert.ok(view.recentConsequences.flatMap((item) => item.affectedMetricLabels).includes("民心"));
  assertNoInternalConsequenceLeak(view);
});

test("S88.6 public consequence refs feed archive, world thread, and monthly briefing", () => {
  const worldState = seedDomainConsequences();
  ensureWorldThreadState(worldState);

  const archiveView = buildEventArchiveView(worldState, { pageSize: 50 });
  const worldThreadView = buildWorldThreadView(worldState);
  const monthlyContext = buildPlayerMonthlyBriefingContext(worldState);
  const monthlyProposal = generateMonthlyBriefingProposal(monthlyContext);

  assert.ok(archiveView.items.some((item) => item.sourceType === "domain_consequence"));
  assert.ok(worldThreadView.activeThreads.some((thread) => thread.sourceType === "domain_consequence"));
  assert.ok(monthlyContext.sourceRefs.some((ref) => ref.source === "domain_consequence"));
  assert.ok(monthlyProposal.actionItems.some((item) => /追踪|月账|月报/.test(item)));
  assertNoInternalConsequenceLeak(
    archiveView.items.filter((item) => item.sourceType === "domain_consequence")
  );
  assertNoInternalConsequenceLeak(
    worldThreadView.activeThreads.filter((thread) => thread.sourceType === "domain_consequence")
  );
  assertNoInternalConsequenceLeak(monthlyContext.domainConsequenceView);
  assertNoInternalConsequenceLeak(monthlyProposal.sourceRefs.filter((ref) => ref.source === "domain_consequence"));
});

test("S88.6 public consequence refs feed topic evidence and safe search", () => {
  const worldState = seedDomainConsequences();
  const resolverContext = buildResolverInputContext(worldState, {
    generatedAt: "2026-05-21T00:00:00.000Z"
  });
  const trialSurface = buildTopicSurfaceView(worldState, { surfaceId: "trial" });
  const safeSearchRows = buildSafeSearchRows(worldState);
  const searchView = searchSafeWorldIndex(worldState, {
    query: "平抑米价",
    domain: "events",
    pageSize: 5
  });

  assert.ok(resolverContext.sourceViews.some((source) => source.sourceView === "domainConsequenceView"));
  assert.ok(resolverContext.events.some((item) =>
    item.sourceView === "domainConsequenceView" && /平抑米价|堂上调停/.test(`${item.label}${item.summary}`)
  ));
  assert.ok(trialSurface.sourceViews.some((source) => source.sourceView === "domainConsequenceView"));
  assert.ok(trialSurface.evidenceRefs.some((ref) =>
    ref.sourceView === "domainConsequenceView" && /平抑米价|堂上调停/.test(`${ref.label}${ref.summary}`)
  ));
  assert.ok(safeSearchRows.some((row) =>
    row.sourceView === "domainConsequenceView.recentConsequences" && /平抑米价/.test(`${row.title}${row.searchText}`)
  ));
  assert.ok(searchView.results.some((result) =>
    result.sourceView === "domainConsequenceView.recentConsequences" && /平抑米价/.test(`${result.title}${result.snippet}`)
  ));
  assertNoInternalConsequenceLeak(resolverContext.events.filter((item) => item.sourceView === "domainConsequenceView"));
  assertNoInternalConsequenceValueLeak(trialSurface);
  assertNoInternalConsequenceLeak(searchView);
});

test("S88.6 judicial case ledger is forbidden in public worldState helpers", () => {
  const worldState = seedDomainConsequences();
  const clientState = buildClientWorldState(worldState);

  assert.equal(isForbiddenClientWorldStateKey("judicialCaseLedger"), true);
  assert.equal(clientState.judicialCaseLedger, undefined);
  assert.throws(
    () => defineGameTurnResponse({
      sessionId,
      worldState: {
        sessionId,
        judicialCaseLedger: { records: [] }
      }
    }),
    /judicialCaseLedger/
  );
});
