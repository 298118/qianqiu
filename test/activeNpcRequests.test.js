const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildActiveNpcRequestView,
  classifyRequestResponse,
  runActiveNpcRequestStep
} = require("../src/game/activeRequests");

test("active NPC requests classify obvious player responses", () => {
  assert.equal(classifyRequestResponse("答应塾师，拜访帮忙"), "accept");
  assert.equal(classifyRequestResponse("politely refuse the request"), "refuse");
  assert.equal(classifyRequestResponse("独自休息一日"), null);
});

test("active NPC requests schedule one visible deterministic request", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Tester" });
  worldState.turnCount = 1;

  const result = runActiveNpcRequestStep(worldState, "研读经书");
  const view = buildActiveNpcRequestView(worldState);

  assert.equal(result.scheduled, true);
  assert.equal(result.events.length, 1);
  assert.equal(view.targetType, "character");
  assert.equal(view.targetId, "C01");
  assert.equal(view.status, "active");
  assert.equal(view.turnsRemaining, 2);
  assert.equal(JSON.stringify(view).includes("Eunuch faction"), false);
});

test("active NPC requests do not schedule hidden scholar factions", () => {
  const worldState = createInitialState({ role: "scholar" });
  worldState.characters = [];
  worldState.factions = { eunuchs: 50, militaryLords: 30 };
  worldState.relationshipLedger = {
    characters: {},
    factions: {
      eunuchs: {
        id: "eunuchs",
        name: "Hidden Palace",
        stance: "hidden",
        relationship: 0,
        resentment: 20,
        networkSource: "hidden",
        recentIntent: "hidden",
        visible: false,
        lastUpdatedTurn: 0
      },
      militaryLords: {
        id: "militaryLords",
        name: "Hidden Army",
        stance: "hidden",
        relationship: 0,
        resentment: 20,
        networkSource: "hidden",
        recentIntent: "hidden",
        visible: false,
        lastUpdatedTurn: 0
      }
    },
    recentNotes: []
  };
  worldState.turnCount = 1;

  const result = runActiveNpcRequestStep(worldState, "继续读书");

  assert.equal(result.scheduled, false);
  assert.equal(worldState.activeNpcRequest, null);
  assert.equal(buildActiveNpcRequestView(worldState), null);
});

test("active NPC requests resolve with bounded relationship changes", () => {
  const worldState = createInitialState({ role: "scholar" });
  worldState.turnCount = 1;
  runActiveNpcRequestStep(worldState, "研读经书");
  const before = worldState.relationshipLedger.characters.C01.relationship;

  worldState.turnCount = 2;
  const result = runActiveNpcRequestStep(worldState, "答应拜访塾师并帮忙");

  assert.equal(result.resolved, true);
  assert.equal(worldState.activeNpcRequest, null);
  assert.equal(result.relationshipChanges.length, 1);
  assert.equal(result.relationshipChanges[0].targetId, "C01");
  assert.equal(result.relationshipChanges[0].relationship.delta, 4);
  assert.equal(worldState.relationshipLedger.characters.C01.relationship, before + 4);
});

test("active NPC requests expire overdue requests with resentment pressure", () => {
  const worldState = createInitialState({ role: "scholar" });
  worldState.turnCount = 1;
  runActiveNpcRequestStep(worldState, "研读经书");

  worldState.turnCount = 3;
  const result = runActiveNpcRequestStep(worldState, "独自休息一日");

  assert.equal(result.expired, true);
  assert.equal(worldState.activeNpcRequest, null);
  assert.equal(result.relationshipChanges.length, 1);
  assert.equal(result.relationshipChanges[0].resentment.delta, 5);
  assert.match(result.events[0], /逾期/);
});
