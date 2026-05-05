const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch, appendEvents, MAX_EVENT_HISTORY } = require("../src/game/stateRules");

test("applyStatePatch applies only whitelisted fields and clamps numeric ranges", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const originalSessionId = worldState.sessionId;
  const originalRole = worldState.player.role;

  applyStatePatch(worldState, {
    sessionId: "not-allowed",
    publicOrder: -10,
    treasury: 999999999,
    player: {
      health: 150,
      gold: -5,
      academia: 250,
      role: "emperor",
      officeTitle: "not-allowed"
    },
    factions: {
      eunuchs: 88,
      inventedFaction: 99
    }
  });

  assert.equal(worldState.sessionId, originalSessionId);
  assert.equal(worldState.publicOrder, 0);
  assert.equal(worldState.treasury, 10000000);
  assert.equal(worldState.player.health, 100);
  assert.equal(worldState.player.gold, 0);
  assert.equal(worldState.player.academia, 100);
  assert.equal(worldState.player.role, originalRole);
  assert.equal(worldState.player.officeTitle, null);
  assert.equal(worldState.factions.eunuchs, 88);
  assert.equal(worldState.factions.inventedFaction, undefined);
  assert.equal(worldState.turnCount, 1);
});

test("appendEvents ignores empty values and trims history to the most recent entries", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const events = Array.from({ length: MAX_EVENT_HISTORY + 5 }, (_, index) => `event-${index}`);

  appendEvents(worldState, ["", "   ", 42, null]);
  assert.equal(worldState.eventHistory.length, 0);

  appendEvents(worldState, events);

  assert.equal(worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.equal(worldState.eventHistory[0], "event-5");
  assert.equal(worldState.eventHistory[MAX_EVENT_HISTORY - 1], "event-24");
});
