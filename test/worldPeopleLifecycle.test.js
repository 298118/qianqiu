const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { runWorldPeopleLifecycleStep } = require("../src/game/worldPeopleLifecycle");
const {
  buildWorldPeopleEventBatch,
  snapshotWorldPeopleForEvents
} = require("../src/game/worldPeopleEvents");

function buildLifecycleWorldState() {
  const worldState = createInitialState({ role: "official", playerName: "谱牒推演" });
  worldState.turnCount = 12;
  worldState.year = 1644;
  worldState.month = 8;
  worldState.tenDayPeriod = 1;
  worldState.publicOrder = 30;
  worldState.corruption = 82;
  worldState.taxRate = 62;
  worldState.grainReserve = 200;
  worldState.population = 10000;
  worldState.worldPeople = {
    schemaVersion: 1,
    generatedAtTurn: 12,
    npcs: [{
      id: "npc-elder-gu",
      name: "顾惟",
      age: 82,
      alive: true,
      homeCityId: "city-beijing",
      currentCityId: "city-beijing",
      householdId: "hh-gu",
      currentOfficeId: "office-gu",
      rankLabel: "在任官员",
      currentGoal: "料理族中田产。",
      reputation: 72,
      patronagePower: 60,
      peerNetwork: 34,
      wealthCash: 12,
      landMu: 40,
      debts: 130,
      annualIncomeEstimate: 24,
      estateIds: ["estate-gu"],
      assetIds: ["asset-gu"],
      family: {
        fatherId: "",
        motherId: "",
        spouseIds: ["npc-lu"],
        childrenIds: [],
        marriageAllianceTags: ["旧谱姻亲"]
      },
      health: 5,
      legalRisk: 20,
      impeachmentRisk: 64,
      resentmentRisk: 48,
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾惟为可见人物。",
      lastUpdatedTurn: 11
    }, {
      id: "npc-lu",
      name: "陆婉",
      age: 30,
      alive: true,
      homeCityId: "city-suzhou",
      currentCityId: "city-suzhou",
      householdId: "hh-lu",
      rankLabel: "士绅",
      reputation: 46,
      patronagePower: 18,
      peerNetwork: 32,
      wealthCash: 60,
      landMu: 20,
      debts: 0,
      annualIncomeEstimate: 12,
      estateIds: [],
      assetIds: [],
      family: {
        fatherId: "",
        motherId: "",
        spouseIds: ["npc-elder-gu"],
        childrenIds: [],
        marriageAllianceTags: ["旧谱姻亲"]
      },
      health: 62,
      legalRisk: 0,
      impeachmentRisk: 0,
      resentmentRisk: 10,
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "陆婉为可见人物。",
      lastUpdatedTurn: 11
    }],
    households: [{
      id: "hh-gu",
      familyName: "顾氏",
      seatCityId: "city-beijing",
      wealthScore: 42,
      landMu: 90,
      prestige: 38,
      gentryRank: "乡绅",
      marriageNetworkScore: 34,
      debtPressure: 50,
      politicalAlignment: "观望",
      familyRisk: 22,
      memberNpcIds: ["npc-elder-gu"],
      estateIds: ["estate-gu"],
      assetIds: ["asset-gu"],
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏有可见家产。",
      lastUpdatedTurn: 11
    }, {
      id: "hh-lu",
      familyName: "陆氏",
      seatCityId: "city-suzhou",
      wealthScore: 35,
      landMu: 40,
      prestige: 34,
      gentryRank: "民户",
      marriageNetworkScore: 28,
      debtPressure: 8,
      politicalAlignment: "观望",
      familyRisk: 10,
      memberNpcIds: ["npc-lu"],
      estateIds: [],
      assetIds: [],
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "陆氏有可见家谱。",
      lastUpdatedTurn: 11
    }],
    assets: [{
      id: "asset-gu",
      kind: "debt",
      name: "顾氏欠契",
      ownerType: "household",
      ownerId: "hh-gu",
      cityId: "city-beijing",
      valueEstimate: 100,
      annualIncomeEstimate: 10,
      debtValue: 80,
      statusLabel: "旧欠",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏欠契为公开估计。",
      lastUpdatedTurn: 11
    }],
    estates: [{
      id: "estate-gu",
      name: "顾氏南田",
      ownerType: "household",
      ownerId: "hh-gu",
      cityId: "city-beijing",
      regionId: "region-north",
      landMu: 90,
      tenantHouseholds: 6,
      rentGrainEstimate: 30,
      taxBurden: 68,
      waterworks: 20,
      disputeRisk: 54,
      status: "held",
      statusLabel: "自有",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾氏南田为公开估计。",
      lastUpdatedTurn: 11
    }],
    relationships: [{
      id: "rel-gu-lu",
      sourceType: "npc",
      sourceId: "npc-elder-gu",
      targetType: "npc",
      targetId: "npc-lu",
      relationship: 50,
      trust: 55,
      resentment: 10,
      obligation: 20,
      patronage: 0,
      fear: 0,
      rivalry: 0,
      stance: "婚姻",
      recentIntent: "维系两家旧谊。",
      recentNotes: ["旧有人情债"],
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾惟与陆婉有可见婚姻关系。",
      lastUpdatedTurn: 11
    }],
    recentNotes: []
  };
  return worldState;
}

test("S62.2 lifecycle helper applies server-owned visible lifecycle and asset flow", () => {
  const worldState = buildLifecycleWorldState();
  const previousPeople = snapshotWorldPeopleForEvents(worldState);

  const result = runWorldPeopleLifecycleStep(worldState, { isMonthEnd: true });
  const batch = buildWorldPeopleEventBatch(worldState, { previousPeople });
  const serializedPublicOutput = JSON.stringify({ result, batch });
  const npc = worldState.worldPeople.npcs.find((row) => row.id === "npc-elder-gu");
  const asset = worldState.worldPeople.assets.find((row) => row.id === "asset-gu");
  const estate = worldState.worldPeople.estates.find((row) => row.id === "estate-gu");
  const household = worldState.worldPeople.households.find((row) => row.id === "hh-gu");
  const relationship = worldState.worldPeople.relationships.find((row) => row.id === "rel-gu-lu");
  const eventTypes = batch.auditEvents.map((event) => event.eventType);

  assert.equal(result.applied, true);
  assert.ok(result.events.some((event) => /人物演化/.test(event)));
  assert.equal(npc.alive, false);
  assert.equal(npc.health, 0);
  assert.equal(asset.debtValue > 80, true);
  assert.equal(estate.status, "disputed");
  assert.equal(estate.disputeRisk > 54, true);
  assert.equal(household.familyRisk > 22, true);
  assert.equal(relationship.resentment > 10, true);
  assert.ok(relationship.recentNotes.some((note) => /S62\.2月度人情账/.test(note)));
  assert.ok(eventTypes.includes("npc_lifecycle_changed"));
  assert.ok(eventTypes.includes("people_asset_changed"));
  assert.ok(eventTypes.includes("people_estate_changed"));
  assert.ok(eventTypes.includes("relationship_changed"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "assets" && link.rowId === "asset-gu"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "estates" && link.rowId === "estate-gu"));
  assert.equal(serializedPublicOutput.includes("hiddenNotes"), false);
  assert.equal(serializedPublicOutput.includes("hiddenIntent"), false);
  assert.doesNotMatch(serializedPublicOutput, /people_(?:npcs|households|assets|estates|relationships)/);
  assert.equal(serializedPublicOutput.includes("event_log"), false);
});

test("S62.2 lifecycle helper is idle outside month-end unless forced", () => {
  const worldState = buildLifecycleWorldState();
  const before = JSON.stringify(worldState.worldPeople);
  const result = runWorldPeopleLifecycleStep(worldState, { isMonthEnd: false });

  assert.equal(result.applied, false);
  assert.deepEqual(result.events, []);
  assert.equal(JSON.stringify(worldState.worldPeople), before);
});

test("S62.2 lifecycle helper can force annual marriage and migration projections", () => {
  const worldState = buildLifecycleWorldState();
  worldState.month = 1;
  worldState.tenDayPeriod = 1;
  worldState.worldPeople.npcs[0].age = 24;
  worldState.worldPeople.npcs[0].health = 70;
  worldState.worldPeople.npcs[0].alive = true;
  worldState.worldPeople.npcs[0].family.spouseIds = [];
  worldState.worldPeople.npcs[1].family.spouseIds = [];
  worldState.worldPeople.relationships = [];

  const result = runWorldPeopleLifecycleStep(worldState, {
    force: true,
    forceMarriage: true,
    forceMigration: true
  });
  const first = worldState.worldPeople.npcs.find((row) => row.id === "npc-elder-gu");
  const second = worldState.worldPeople.npcs.find((row) => row.id === "npc-lu");
  const marriage = worldState.worldPeople.relationships.find((row) => row.id.startsWith("rel-marriage-"));

  assert.equal(result.applied, true);
  assert.ok(first.family.spouseIds.includes(second.id));
  assert.ok(second.family.spouseIds.includes(first.id));
  assert.ok(marriage);
  assert.notEqual(first.currentCityId, "city-beijing");
});
