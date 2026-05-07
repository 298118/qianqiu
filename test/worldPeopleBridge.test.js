const test = require("node:test");
const assert = require("node:assert/strict");

const { runActiveNpcRequestStep, buildActiveNpcRequestView } = require("../src/game/activeRequests");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { createInitialState } = require("../src/game/initialState");
const {
  buildWorldPeopleView,
  ensureWorldPeopleState,
  normalizeWorldPeopleState,
  summarizeWorldPeopleForPrompt
} = require("../src/game/worldPeople");

test("initial world people bridge derives visible NPC and relationship rows from legacy state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "People Bridge Tester" });
  const view = buildWorldPeopleView(worldState);
  const serializedState = JSON.stringify(worldState.worldPeople);
  const serializedView = JSON.stringify(view);

  assert.equal(worldState.worldPeople.schemaVersion, 1);
  assert.ok(view.npcs.some((npc) => npc.id === "C01" && npc.name === "顾文衡"));
  assert.ok(view.relationships.some((relationship) =>
    relationship.id === "rel-player-npc-C01" &&
    relationship.sourceType === "player" &&
    relationship.targetType === "npc" &&
    relationship.targetId === "C01"
  ));
  assert.ok(view.relationships.some((relationship) =>
    relationship.id === "rel-player-faction-scholarOfficials" &&
    relationship.targetType === "faction"
  ));
  assert.equal(serializedState.includes("Eunuch faction"), false);
  assert.equal(serializedState.includes("militaryLords"), false);
  assert.equal(serializedView.includes("Eunuch faction"), false);
});

test("world people bridge refreshes relationship values after server-owned changes", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "People Refresh Tester" });
  worldState.turnCount = 3;

  applyRelationshipChanges(worldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: 8,
    resentmentDelta: 4,
    stance: "warm mentor",
    recentIntent: "留意玩家是否勤学守礼。",
    reason: "玩家恭敬问学。"
  }]);
  ensureWorldPeopleState(worldState);

  const relationship = worldState.worldPeople.relationships.find((entry) => entry.id === "rel-player-npc-C01");
  const npc = worldState.worldPeople.npcs.find((entry) => entry.id === "C01");

  assert.equal(relationship.relationship, 20);
  assert.equal(relationship.resentment, 4);
  assert.equal(relationship.stance, "warm mentor");
  assert.equal(relationship.lastUpdatedTurn, 3);
  assert.equal(npc.currentGoal, "留意玩家是否勤学守礼。");
  assert.match(npc.publicSummary, /情分亲近/);
});

test("active request bridge adds visible request notes without owning request lifecycle", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "People Request Tester" });
  worldState.turnCount = 1;
  runActiveNpcRequestStep(worldState, "研读经书");
  const requestView = buildActiveNpcRequestView(worldState);

  ensureWorldPeopleState(worldState);
  const relationship = buildWorldPeopleView(worldState).relationships.find((entry) => entry.id === "rel-player-npc-C01");
  const promptSummary = summarizeWorldPeopleForPrompt(worldState);
  const serializedPrompt = JSON.stringify(promptSummary);

  assert.equal(requestView.targetId, "C01");
  assert.equal(worldState.activeNpcRequest.id, requestView.id);
  assert.ok(relationship.recentNotes.some((note) => note.includes("当前请托")));
  assert.match(serializedPrompt, /当前请托/);
  assert.equal(buildActiveNpcRequestView(worldState).id, requestView.id);
});

test("world people bridge does not store hidden legacy or custom rows in raw route state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "People Hidden Tester" });
  worldState.characters.push({
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    loyalty: 50,
    ambition: 50,
    skill: 50,
    alive: true
  });
  worldState.relationshipLedger.characters.C99 = {
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    stance: "sealed",
    relationship: 0,
    resentment: 0,
    networkSource: "sealed",
    recentIntent: "SEALED_WORLD_PEOPLE_INTENT",
    visible: false,
    lastUpdatedTurn: 0
  };
  worldState.activeNpcRequest = {
    id: "REQ-hidden",
    status: "active",
    kind: "pressure",
    targetType: "character",
    targetId: "C99",
    sourceName: "密札中人",
    title: "SEALED_WORLD_PEOPLE_REQUEST",
    ask: "SEALED_WORLD_PEOPLE_ASK",
    createdTurn: 1,
    dueTurn: 3,
    lastUpdatedTurn: 1
  };
  worldState.worldPeople.npcs.push({
    id: "npc-hidden-custom",
    name: "隐藏人物",
    visibility: "hidden",
    publicSummary: "SEALED_CUSTOM_WORLD_PERSON",
    hiddenNotes: ["SEALED_CUSTOM_WORLD_NOTE"]
  });

  ensureWorldPeopleState(worldState);
  const view = buildWorldPeopleView(worldState);
  const promptSummary = summarizeWorldPeopleForPrompt(worldState);
  const serialized = JSON.stringify({
    raw: worldState.worldPeople,
    view,
    promptSummary,
    normalized: normalizeWorldPeopleState(worldState)
  });

  assert.equal(buildActiveNpcRequestView(worldState), null);
  assert.equal(serialized.includes("C99"), false);
  assert.equal(serialized.includes("密札中人"), false);
  assert.equal(serialized.includes("SEALED_WORLD_PEOPLE"), false);
  assert.equal(serialized.includes("SEALED_CUSTOM_WORLD_PERSON"), false);
  assert.equal(serialized.includes("SEALED_CUSTOM_WORLD_NOTE"), false);
});
