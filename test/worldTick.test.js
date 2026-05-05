const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch } = require("../src/game/stateRules");
const { runWorldTick } = require("../src/game/worldTick");

test("initial state starts in the first month", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  assert.equal(worldState.month, 1);
});

test("runWorldTick advances the calendar and does not mutate protected state", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 12;
  worldState.turnCount = 7;
  worldState.activeExam = { level: "child_exam" };
  worldState.player.examRank = "秀才";

  const before = JSON.parse(JSON.stringify(worldState));
  const result = runWorldTick(worldState);

  assert.deepEqual(worldState, before);
  assert.equal(result.statePatch.year, 1645);
  assert.equal(result.statePatch.month, 1);
  assert.equal(result.statePatch.player, undefined);
  assert.equal(result.statePatch.activeExam, undefined);
  assert.equal(result.statePatch.sessionId, undefined);
  assert.ok(result.events.length >= 1);
  assert.ok(result.events.length <= 2);
  assert.ok(result.summary);
  assert.ok(result.attributeChanges.every((change) => !change.path.startsWith("player.")));

  applyStatePatch(worldState, result.statePatch, { incrementTurnCount: false });
  assert.equal(worldState.year, 1645);
  assert.equal(worldState.month, 1);
  assert.equal(worldState.turnCount, 7);
  assert.deepEqual(worldState.activeExam, before.activeExam);
  assert.equal(worldState.player.examRank, "秀才");
});

test("runWorldTick clamps natural changes and only patches known factions", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 7;
  worldState.treasury = 999999999;
  worldState.grainReserve = 999999999;
  worldState.population = 999999999;
  worldState.publicOrder = -50;
  worldState.taxRate = 100;
  worldState.corruption = 150;
  worldState.armySize = 0;
  worldState.armyMorale = -20;
  worldState.borderThreat = 150;
  worldState.factions = {
    eunuchs: 99,
    scholarOfficials: 1,
    militaryLords: 99,
    inventedFaction: 50
  };

  const result = runWorldTick(worldState);

  assert.equal(result.statePatch.month, 8);
  assert.ok(result.statePatch.treasury <= 10000000);
  assert.ok(result.statePatch.grainReserve <= 10000000);
  assert.ok(result.statePatch.population <= 100000000);
  assert.ok(result.statePatch.publicOrder >= 0);
  assert.ok(result.statePatch.corruption <= 100);
  assert.ok(result.statePatch.armyMorale >= 0);
  assert.ok(result.statePatch.borderThreat <= 100);
  assert.deepEqual(result.statePatch.factions, {
    eunuchs: 100,
    scholarOfficials: 0,
    militaryLords: 100
  });
});
