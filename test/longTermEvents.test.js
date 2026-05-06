const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { applyStatePatch } = require("../src/game/stateRules");
const {
  buildLongTermEventView,
  ensureLongTermEventState,
  normalizeLongTermEventState,
  runLongTermEventStep
} = require("../src/game/longTermEvents");

test("initial state carries an empty server-owned long-term event queue", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  assert.deepEqual(worldState.longTermEvents, {
    schemaVersion: 1,
    queue: [],
    cooldowns: {},
    recentResolved: []
  });
  assert.deepEqual(buildLongTermEventView(worldState).activeEvents, []);
});

test("long-term events schedule seasonal work and resolve through bounded patches", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 1;
  worldState.month = 8;
  worldState.activeExam = { level: "child_exam", reason: "server-owned" };
  worldState.player.examRank = "秀才";

  const scheduled = runLongTermEventStep(worldState);
  assert.equal(scheduled.statePatch.grainReserve, undefined);
  assert.equal(scheduled.scheduled[0].key, "seasonal_harvest_audit");
  assert.equal(worldState.longTermEvents.queue.length, 1);
  assert.equal(buildLongTermEventView(worldState).activeEvents[0].title, "秋粮核验");

  worldState.turnCount = 2;
  worldState.month = 9;
  const resolved = runLongTermEventStep(worldState);

  assert.equal(resolved.resolved[0].key, "seasonal_harvest_audit");
  assert.ok(resolved.statePatch.grainReserve > 800);
  assert.equal(resolved.statePatch.activeExam, undefined);
  assert.equal(resolved.statePatch.player?.examRank, undefined);
  assert.ok(resolved.attributeChanges.some((change) => change.path === "grainReserve"));

  applyStatePatch(worldState, resolved.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  assert.equal(worldState.activeExam.level, "child_exam");
  assert.equal(worldState.player.examRank, "秀才");
  assert.equal(worldState.turnCount, 2);
  assert.equal(worldState.longTermEvents.queue.length, 0);
  assert.ok(worldState.longTermEvents.cooldowns.seasonal_harvest_audit > worldState.turnCount);
});

test("long-term disaster events clamp state and never patch protected exam fields", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 4;
  worldState.grainReserve = 20;
  worldState.population = 5000;
  worldState.publicOrder = 30;
  worldState.activeExam = { level: "provincial_exam", status: "writing" };
  worldState.player.examHistory = [{ level: "child_exam" }];

  const scheduled = runLongTermEventStep(worldState);
  assert.equal(scheduled.scheduled[0].key, "disaster_grain_shortage");

  worldState.turnCount = 5;
  const result = runLongTermEventStep(worldState);
  applyStatePatch(worldState, result.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  assert.equal(worldState.grainReserve >= 0, true);
  assert.equal(worldState.publicOrder >= 0, true);
  assert.equal(worldState.activeExam.level, "provincial_exam");
  assert.deepEqual(worldState.player.examHistory, [{ level: "child_exam" }]);
  assert.equal(result.statePatch.player, undefined);
});

test("border long-term events use relationship suggestions instead of raw ledger mutation", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  worldState.turnCount = 6;
  worldState.borderThreat = 82;

  const scheduled = runLongTermEventStep(worldState);
  assert.equal(scheduled.scheduled[0].key, "border_alarm");
  const before = worldState.relationshipLedger.factions.militaryLords.relationship;

  worldState.turnCount = 7;
  const result = runLongTermEventStep(worldState);
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "militaryLords"));
  assert.equal(worldState.relationshipLedger.factions.militaryLords.relationship, before);

  const applied = applyRelationshipChanges(worldState, result.relationshipChanges);
  assert.equal(applied[0].targetId, "militaryLords");
  assert.equal(worldState.relationshipLedger.factions.militaryLords.relationship, before + 2);
});

test("long-term scheduler normalizes invalid legacy data", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.longTermEvents = {
    schemaVersion: 999,
    queue: [
      { type: "invented", title: "Bad event" },
      {
        key: "seasonal_harvest_audit",
        type: "seasonal",
        title: "Valid event",
        status: "active",
        durationMonths: 99,
        remainingMonths: 99
      }
    ],
    cooldowns: {
      seasonal_harvest_audit: 999999,
      "": 10
    },
    recentResolved: [{ title: "Old resolved", type: "seasonal", resolvedTurn: 1 }]
  };

  ensureLongTermEventState(worldState);
  const normalized = normalizeLongTermEventState(worldState);

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.queue.length, 1);
  assert.equal(normalized.queue[0].durationMonths, 12);
  assert.equal(normalized.cooldowns.seasonal_harvest_audit <= worldState.turnCount + 120, true);
  assert.equal(normalized.recentResolved.length, 1);
});
