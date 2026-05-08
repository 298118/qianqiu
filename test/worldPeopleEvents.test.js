const test = require("node:test");
const assert = require("node:assert/strict");

const { runActiveNpcRequestStep } = require("../src/game/activeRequests");
const { createInitialState } = require("../src/game/initialState");
const { applyRelationshipChanges } = require("../src/game/relationships");
const {
  buildWorldPeopleEventBatch,
  snapshotWorldPeopleForEvents
} = require("../src/game/worldPeopleEvents");

test("world people events record visible relationship changes without provider notes", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "事件书生" });
  worldState.turnCount = 3;
  const previousPeople = snapshotWorldPeopleForEvents(worldState);

  applyRelationshipChanges(worldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: 8,
    resentmentDelta: 3,
    stance: "愿意提携",
    recentIntent: "继续观察其读书成色。",
    reason: "SEALED_RELATIONSHIP_REASON should not enter people event audit"
  }]);

  const batch = buildWorldPeopleEventBatch(worldState, { previousPeople });
  const serialized = JSON.stringify(batch);

  assert.equal(batch.events.length, 1);
  assert.match(batch.events[0], /人物关系更新/);
  assert.match(batch.events[0], /顾文衡/);
  assert.equal(batch.auditEvents[0].sourceSystem, "world_people");
  assert.equal(batch.auditEvents[0].eventType, "relationship_changed");
  assert.equal(batch.auditEvents[0].visibility, "public");
  assert.equal(batch.auditEvents[0].appliedChanges.metrics.relationship.delta, 8);
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "relationships" && link.rowId === "rel-player-npc-C01"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "npcs" && link.rowId === "C01"));
  assert.equal(serialized.includes("SEALED_RELATIONSHIP_REASON"), false);
  assert.equal(serialized.includes("worldPeople"), false);
});

test("world people events ignore active request scheduling notes until a relationship result exists", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "请托书生" });
  worldState.turnCount = 1;
  const previousPeople = snapshotWorldPeopleForEvents(worldState);

  const activeRequest = runActiveNpcRequestStep(worldState, "研读经书");
  const batch = buildWorldPeopleEventBatch(worldState, {
    previousPeople,
    activeNpcRequest: activeRequest
  });

  assert.equal(activeRequest.scheduled, true);
  assert.deepEqual(batch.events, []);
  assert.deepEqual(batch.auditEvents, []);
  assert.deepEqual(batch.rowEventLinks, []);
});

test("world people events classify visible lifecycle, asset, and estate changes", () => {
  const worldState = createInitialState({ role: "official", playerName: "谱牒官" });
  const previousPeople = {
    schemaVersion: 1,
    generatedAtTurn: 4,
    npcs: [{
      id: "npc-visible-li",
      name: "李谨",
      alive: true,
      currentCityId: "city-old",
      wealthCash: 20,
      estateIds: ["estate-visible-li"],
      assetIds: ["asset-visible-li"],
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "李谨为可见人物。",
      lastUpdatedTurn: 4
    }],
    households: [],
    assets: [{
      id: "asset-visible-li",
      kind: "shop",
      name: "李氏书肆",
      ownerType: "player",
      ownerId: "P1",
      valueEstimate: 120,
      statusLabel: "照常营生",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "李氏书肆照常营生。",
      lastUpdatedTurn: 4
    }],
    estates: [{
      id: "estate-visible-li",
      name: "李氏南田",
      ownerType: "player",
      ownerId: "P1",
      landMu: 80,
      disputeRisk: 5,
      status: "held",
      statusLabel: "自有",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "李氏南田收成平稳。",
      lastUpdatedTurn: 4
    }],
    relationships: []
  };
  const currentPeople = JSON.parse(JSON.stringify(previousPeople));
  currentPeople.generatedAtTurn = 5;
  currentPeople.npcs[0].currentCityId = "city-new";
  currentPeople.npcs[0].wealthCash = 35;
  currentPeople.assets[0].valueEstimate = 150;
  currentPeople.assets[0].statusLabel = "盘出半股";
  currentPeople.estates[0].status = "disputed";
  currentPeople.estates[0].disputeRisk = 32;

  const batch = buildWorldPeopleEventBatch(worldState, {
    previousPeople,
    currentPeople
  });
  const eventTypes = batch.auditEvents.map((event) => event.eventType);

  assert.ok(eventTypes.includes("npc_lifecycle_changed"));
  assert.ok(eventTypes.includes("people_asset_changed"));
  assert.ok(eventTypes.includes("people_estate_changed"));
  assert.ok(batch.events.some((event) => /人物履历更新/.test(event)));
  assert.ok(batch.events.some((event) => /资产记录更新/.test(event)));
  assert.ok(batch.events.some((event) => /田产记录更新/.test(event)));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "npcs" && link.rowId === "npc-visible-li"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "assets" && link.rowId === "asset-visible-li"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "estates" && link.rowId === "estate-visible-li"));
});

test("world people events record newly created visible relationship rows", () => {
  const worldState = createInitialState({ role: "official", playerName: "入谱官" });
  const previousPeople = {
    schemaVersion: 1,
    generatedAtTurn: 9,
    npcs: [{
      id: "npc-visible-a",
      name: "顾甲",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "顾甲为可见人物。",
      lastUpdatedTurn: 9
    }, {
      id: "npc-visible-b",
      name: "陆乙",
      visibility: "public",
      knownToPlayer: true,
      publicSummary: "陆乙为可见人物。",
      lastUpdatedTurn: 9
    }],
    households: [],
    assets: [],
    estates: [],
    relationships: []
  };
  const currentPeople = JSON.parse(JSON.stringify(previousPeople));
  currentPeople.generatedAtTurn = 10;
  currentPeople.relationships.push({
    id: "rel-marriage-npc-visible-a-npc-visible-b",
    sourceType: "npc",
    sourceId: "npc-visible-a",
    targetType: "npc",
    targetId: "npc-visible-b",
    relationship: 56,
    trust: 58,
    resentment: 0,
    obligation: 18,
    patronage: 0,
    stance: "婚姻",
    visibility: "public",
    knownToPlayer: true,
    publicSummary: "顾甲与陆乙有公开婚姻关系。",
    lastUpdatedTurn: 10
  });

  const batch = buildWorldPeopleEventBatch(worldState, {
    previousPeople,
    currentPeople
  });
  const event = batch.auditEvents.find((entry) => entry.eventType === "relationship_created");

  assert.ok(event);
  assert.match(event.summary, /人物关系入谱/);
  assert.equal(event.appliedChanges.created, true);
  assert.equal(event.appliedChanges.metrics.obligation.after, 18);
  assert.ok(batch.rowEventLinks.some((link) =>
    link.collection === "relationships" &&
    link.rowId === "rel-marriage-npc-visible-a-npc-visible-b"
  ));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "npcs" && link.rowId === "npc-visible-a"));
  assert.ok(batch.rowEventLinks.some((link) => link.collection === "npcs" && link.rowId === "npc-visible-b"));
});
