const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePayload } = require("../src/ai/schemas");
const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch } = require("../src/game/stateRules");
const {
  WORLD_PEOPLE_SCHEMA_VERSION,
  buildWorldPeopleSchemaView,
  normalizeWorldPeopleSchemaBundle,
  summarizeWorldPeopleSchemaForPrompt
} = require("../src/game/worldPeopleSchemas");

function samplePeopleBundle() {
  return {
    npcs: [{
      id: "npc-gu-mentor",
      name: "顾文衡",
      courtesyName: "衡之",
      age: 156,
      homeCityId: "city-suzhou",
      currentCityId: "city-beijing",
      householdId: "household-gu",
      wealthCash: -50,
      landMu: 999999999,
      debts: -10,
      annualIncomeEstimate: 50,
      estateIds: ["estate-gu-field", "estate-hidden-field"],
      assetIds: ["asset-gu-shop", "asset-hidden-ledger"],
      fatherId: "npc-hidden-patron",
      spouseIds: ["npc-hidden-patron"],
      childrenIds: ["npc-visible-child", "npc-hidden-patron"],
      hiddenIntent: "SEALED_NPC_INTENT",
      hiddenNotes: ["SEALED_NPC_NOTE"],
      publicSummary: "乡中塾师，和玩家有师门渊源。"
    }, {
      id: "npc-visible-child",
      name: "顾小衡",
      relationship: 20,
      visibility: "relationship_visible",
      knownToPlayer: true
    }, {
      id: "npc-hidden-patron",
      name: "密札贵人",
      visibility: "hidden",
      hiddenNotes: ["SEALED_HIDDEN_PATRON"]
    }, {
      id: "bad id!",
      name: "Bad Id"
    }],
    households: [{
      id: "household-gu",
      familyName: "顾",
      seatCityId: "city-suzhou",
      wealthScore: 150,
      landMu: 200,
      memberNpcIds: ["npc-gu-mentor", "npc-visible-child", "npc-hidden-patron"],
      estateIds: ["estate-gu-field", "estate-hidden-field"],
      assetIds: ["asset-gu-shop", "asset-hidden-ledger"],
      hiddenNotes: ["SEALED_HOUSEHOLD_NOTE"]
    }],
    assets: [{
      id: "asset-gu-shop",
      kind: "shop",
      name: "顾氏书坊股本",
      ownerType: "household",
      ownerId: "household-gu",
      valueEstimate: 120,
      annualIncomeEstimate: 12
    }, {
      id: "asset-hidden-ledger",
      kind: "debt",
      name: "密账银两",
      ownerType: "npc",
      ownerId: "npc-hidden-patron",
      visibility: "hidden",
      publicSummary: "SEALED_ASSET_SUMMARY",
      hiddenNotes: ["SEALED_ASSET_NOTE"]
    }],
    estates: [{
      id: "estate-gu-field",
      name: "顾氏义田",
      ownerType: "household",
      ownerId: "household-gu",
      cityId: "city-suzhou",
      landMu: 80,
      disputeRisk: 12
    }, {
      id: "estate-hidden-field",
      name: "隐名田庄",
      ownerType: "npc",
      ownerId: "npc-hidden-patron",
      visibility: "hidden",
      publicSummary: "SEALED_ESTATE_SUMMARY",
      hiddenNotes: ["SEALED_ESTATE_NOTE"]
    }],
    relationships: [{
      id: "rel-player-gu",
      sourceType: "player",
      sourceId: "P1",
      targetType: "npc",
      targetId: "npc-gu-mentor",
      relationship: 24,
      trust: 65,
      resentment: 3,
      obligation: 8,
      publicSummary: "师门情分尚稳。"
    }, {
      id: "rel-hidden-patron",
      sourceType: "npc",
      sourceId: "npc-gu-mentor",
      targetType: "npc",
      targetId: "npc-hidden-patron",
      relationship: 80,
      visibility: "public",
      publicSummary: "SEALED_RELATIONSHIP_SUMMARY"
    }, {
      id: "rel-sealed",
      sourceType: "player",
      sourceId: "P1",
      targetType: "npc",
      targetId: "npc-hidden-patron",
      relationship: 80,
      visibility: "hidden",
      hiddenNotes: ["SEALED_RELATIONSHIP_NOTE"]
    }],
    recentNotes: ["SEALED_RECENT_NOTE"]
  };
}

test("world people schema bundle normalizes NPC, household, asset, estate, and relationship rows", () => {
  const worldState = createInitialState({ playerName: "Schema Tester" });
  worldState.turnCount = 7;
  const bundle = normalizeWorldPeopleSchemaBundle(samplePeopleBundle(), worldState);

  assert.equal(bundle.schemaVersion, WORLD_PEOPLE_SCHEMA_VERSION);
  assert.equal(bundle.generatedAtTurn, 7);
  assert.equal(bundle.npcs.length, 3);
  assert.equal(bundle.households.length, 1);
  assert.equal(bundle.assets.length, 2);
  assert.equal(bundle.estates.length, 2);
  assert.equal(bundle.relationships.length, 3);

  const mentor = bundle.npcs.find((npc) => npc.id === "npc-gu-mentor");
  assert.equal(mentor.age, 120);
  assert.equal(mentor.wealthCash, 0);
  assert.equal(mentor.landMu, 10000000);
  assert.equal(mentor.debts, 0);
  assert.equal(mentor.family.fatherId, "npc-hidden-patron");
  assert.equal(mentor.hiddenIntent, "SEALED_NPC_INTENT");

  const household = bundle.households[0];
  assert.equal(household.wealthScore, 100);
  assert.deepEqual(household.memberNpcIds, ["npc-gu-mentor", "npc-visible-child", "npc-hidden-patron"]);

  const relationship = bundle.relationships.find((entry) => entry.id === "rel-player-gu");
  assert.equal(relationship.relationship, 24);
  assert.equal(relationship.trust, 65);
  assert.equal(relationship.obligation, 8);
});

test("world people schema view filters hidden rows, hidden notes, and hidden nested references", () => {
  const worldState = createInitialState({ playerName: "Visible Tester" });
  const view = buildWorldPeopleSchemaView(samplePeopleBundle(), worldState);
  const serialized = JSON.stringify(view);

  assert.ok(view.npcs.some((npc) => npc.id === "npc-gu-mentor"));
  assert.ok(view.households.some((household) => household.id === "household-gu"));
  assert.ok(view.assets.some((asset) => asset.id === "asset-gu-shop"));
  assert.ok(view.estates.some((estate) => estate.id === "estate-gu-field"));
  assert.ok(view.relationships.some((relationship) => relationship.id === "rel-player-gu"));

  const mentor = view.npcs.find((npc) => npc.id === "npc-gu-mentor");
  assert.equal(mentor.family.fatherId, null);
  assert.deepEqual(mentor.family.spouseIds, []);
  assert.deepEqual(mentor.family.childrenIds, ["npc-visible-child"]);
  assert.deepEqual(mentor.assetIds, ["asset-gu-shop"]);
  assert.deepEqual(mentor.estateIds, ["estate-gu-field"]);

  const household = view.households.find((entry) => entry.id === "household-gu");
  assert.deepEqual(household.memberNpcIds, ["npc-gu-mentor", "npc-visible-child"]);
  assert.deepEqual(household.assetIds, ["asset-gu-shop"]);
  assert.deepEqual(household.estateIds, ["estate-gu-field"]);

  assert.equal(serialized.includes("npc-hidden-patron"), false);
  assert.equal(serialized.includes("asset-hidden-ledger"), false);
  assert.equal(serialized.includes("estate-hidden-field"), false);
  assert.equal(serialized.includes("SEALED_NPC_INTENT"), false);
  assert.equal(serialized.includes("SEALED_HOUSEHOLD_NOTE"), false);
  assert.equal(serialized.includes("SEALED_RELATIONSHIP_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_RECENT_NOTE"), false);
  assert.ok(view.hiddenNotice);
});

test("world people schema visibility distinguishes scholar, official, and relationship-visible rows", () => {
  const bundle = {
    npcs: [{
      id: "npc-role-visible",
      name: "部中主事",
      visibility: "role_visible",
      publicSummary: "官署中人。"
    }, {
      id: "npc-relationship-known",
      name: "同窗故人",
      visibility: "relationship_visible",
      knownToPlayer: true
    }, {
      id: "npc-relationship-unknown",
      name: "未识门客",
      visibility: "relationship_visible",
      knownToPlayer: false,
      publicSummary: "SEALED_UNKNOWN_RELATIONSHIP"
    }]
  };

  const scholarState = createInitialState({ role: "scholar", playerName: "Scholar" });
  const officialState = createInitialState({ role: "official", playerName: "Official" });
  const scholarView = buildWorldPeopleSchemaView(bundle, scholarState);
  const officialView = buildWorldPeopleSchemaView(bundle, officialState);

  assert.equal(scholarView.npcs.some((npc) => npc.id === "npc-role-visible"), false);
  assert.ok(scholarView.npcs.some((npc) => npc.id === "npc-relationship-known"));
  assert.equal(JSON.stringify(scholarView).includes("SEALED_UNKNOWN_RELATIONSHIP"), false);
  assert.ok(officialView.npcs.some((npc) => npc.id === "npc-role-visible"));
});

test("world people prompt summary is capped and excludes hidden people, estates, and notes", () => {
  const bundle = {
    npcs: Array.from({ length: 12 }, (_, index) => ({
      id: `npc-visible-${index}`,
      name: `可见人物${index}`,
      publicSummary: `可见人物摘要${index}`
    })).concat([{
      id: "npc-hidden-prompt",
      name: "隐藏人物",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_NPC",
      hiddenNotes: ["SEALED_PROMPT_NPC_NOTE"]
    }]),
    households: [{
      id: "household-hidden-prompt",
      familyName: "隐",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_HOUSEHOLD"
    }],
    assets: Array.from({ length: 8 }, (_, index) => ({
      id: `asset-visible-${index}`,
      kind: "business",
      name: `可见资产${index}`,
      ownerType: "player",
      ownerId: "P1",
      publicSummary: `可见资产摘要${index}`
    })).concat([{
      id: "asset-hidden-prompt",
      kind: "debt",
      name: "隐藏资产",
      ownerType: "player",
      ownerId: "P1",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_ASSET"
    }]),
    estates: Array.from({ length: 8 }, (_, index) => ({
      id: `estate-visible-${index}`,
      name: `可见田产${index}`,
      ownerType: "player",
      ownerId: "P1",
      publicSummary: `可见田产摘要${index}`
    })).concat([{
      id: "estate-hidden-prompt",
      name: "隐藏田产",
      ownerType: "player",
      ownerId: "P1",
      visibility: "hidden",
      publicSummary: "SEALED_PROMPT_ESTATE"
    }])
  };
  const worldState = createInitialState({ playerName: "Prompt Tester" });
  const summary = summarizeWorldPeopleSchemaForPrompt(bundle, worldState);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.npcs.length, 8);
  assert.equal(summary.assets.length, 6);
  assert.equal(summary.estates.length, 6);
  assert.equal(serialized.includes("SEALED_PROMPT_NPC"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_NPC_NOTE"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_HOUSEHOLD"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_ASSET"), false);
  assert.equal(serialized.includes("SEALED_PROMPT_ESTATE"), false);
});

test("ordinary provider payloads cannot write future world people ledgers directly", () => {
  assert.throws(() => validatePayload("turn", {
    narrative: "有人自称可替服务器改写人物库。",
    statePatch: {
      worldPeople: {
        npcs: [{ id: "npc-provider", name: "模型新造人物" }]
      },
      player: { reputation: 20 }
    },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["模型试图越权改写人物库。"],
    examTrigger: {
      shouldStart: false,
      level: null,
      reason: "无考试。"
    }
  }), /schema validation/);

  const worldState = createInitialState({ playerName: "Patch Tester" });
  const before = JSON.parse(JSON.stringify(worldState.worldPeople));
  applyStatePatch(worldState, {
    worldPeople: {
      npcs: [{ id: "npc-provider", name: "模型新造人物" }]
    },
    player: {
      reputation: 20
    }
  });

  assert.deepEqual(worldState.worldPeople, before);
  assert.equal(worldState.player.reputation, 20);
});
