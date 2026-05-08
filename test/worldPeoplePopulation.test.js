const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildWorldPeopleSchemaView,
  summarizeWorldPeopleSchemaForPrompt
} = require("../src/game/worldPeopleSchemas");
const {
  S62_SOCIAL_IDENTITY_PROFILES,
  createWorldPeoplePopulation,
  measureWorldPeoplePopulation
} = require("../src/game/worldPeoplePopulation");

const CITY_IDS = ["city-beijing", "city-suzhou", "city-xian", "city-wuchang"];

test("S62 population generator creates route-safe NPC identities, genealogy, and social networks", () => {
  const people = createWorldPeoplePopulation({
    prefix: "s62-test",
    cityIds: CITY_IDS,
    npcCount: 96,
    householdCount: 32,
    relationshipCount: 180,
    turnCount: 9,
    officeIds: ["office-a", "office-b"],
    bureauIds: ["bureau-a", "bureau-b"]
  });
  const metrics = measureWorldPeoplePopulation(people);
  const roleLabels = new Set(metrics.roleLabels);
  const serialized = JSON.stringify(people);

  assert.equal(metrics.npcs, 96);
  assert.equal(metrics.households, 32);
  assert.equal(metrics.relationships, 180);
  for (const profile of S62_SOCIAL_IDENTITY_PROFILES) {
    assert.equal(roleLabels.has(profile.rankLabel), true, `missing ${profile.rankLabel}`);
  }
  assert.equal(metrics.householdsWithMembers, 32);
  assert.equal(metrics.parentLinkedNpcs > 0, true);
  assert.equal(metrics.marriageLinkedNpcs > 0, true);
  assert.equal(metrics.hasMarriageNetwork, true);
  assert.equal(metrics.hasMentorNetwork, true);
  assert.equal(metrics.hasNativePlaceNetwork, true);
  assert.equal(metrics.hasExamCohortNetwork, true);
  assert.equal(metrics.hasFactionNetwork, true);
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("hiddenIntent"), false);
  assert.doesNotMatch(serialized, /people_|prompt_retrieval_index|event_log|ai_change_proposals|sk-/);
});

test("S62 population view keeps genealogy references visible-only and prompt summary capped", () => {
  const worldState = createInitialState({ role: "official", playerName: "S62 Tester" });
  worldState.turnCount = 9;
  const people = createWorldPeoplePopulation({
    prefix: "s62-view",
    cityIds: CITY_IDS,
    npcCount: 96,
    householdCount: 32,
    relationshipCount: 180,
    turnCount: worldState.turnCount
  });
  people.npcs.push({
    id: "s62-hidden-parent",
    name: "隐密长亲",
    visibility: "hidden",
    publicSummary: "SEALED_S62_PARENT"
  });
  people.npcs[2].family.fatherId = "s62-hidden-parent";
  people.households[0].memberNpcIds.push("s62-hidden-parent");

  const view = buildWorldPeopleSchemaView(people, worldState);
  const prompt = summarizeWorldPeopleSchemaForPrompt(people, worldState);
  const serialized = JSON.stringify({ view, prompt });
  const affectedNpc = view.npcs.find((npc) => npc.id === people.npcs[2].id);
  const affectedHousehold = view.households.find((household) => household.id === people.households[0].id);

  assert.equal(affectedNpc.family.fatherId, null);
  assert.equal(affectedHousehold.memberNpcIds.includes("s62-hidden-parent"), false);
  assert.equal(prompt.npcs.length, 8);
  assert.equal(prompt.households.length, 6);
  assert.equal(prompt.relationships.length, 10);
  assert.equal(serialized.includes("SEALED_S62_PARENT"), false);
  assert.equal(serialized.includes("s62-hidden-parent"), false);
});
