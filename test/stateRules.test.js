const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch, appendEvents, MAX_EVENT_HISTORY } = require("../src/game/stateRules");

test("applyStatePatch applies only whitelisted fields and clamps numeric ranges", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const originalSessionId = worldState.sessionId;
  const originalRole = worldState.player.role;
  const originalCharacters = JSON.parse(JSON.stringify(worldState.characters));

  applyStatePatch(worldState, {
    sessionId: "not-allowed",
    year: 2000,
    month: 12,
    activeExam: { level: "child_exam" },
    activeNpcRequest: { id: "provider-request" },
    longTermEvents: { queue: [{ key: "provider-event" }] },
    characters: [{ id: "C99", name: "Invented", role: "patron" }],
    eventHistory: ["provider tries to replace history"],
    publicOrder: -10,
    treasury: 999999999,
    player: {
      health: 150,
      gold: -5,
      academia: 250,
      examRank: "秀才",
      examHistory: [{ level: "child_exam" }],
      role: "emperor",
      officeTitle: "not-allowed"
    },
    factions: {
      eunuchs: 88,
      inventedFaction: 99
    }
  });

  assert.equal(worldState.sessionId, originalSessionId);
  assert.equal(worldState.year, 1644);
  assert.equal(worldState.month, 1);
  assert.equal(worldState.activeExam, null);
  assert.equal(worldState.activeNpcRequest, null);
  assert.deepEqual(worldState.longTermEvents.queue, []);
  assert.deepEqual(worldState.characters, originalCharacters);
  assert.deepEqual(worldState.eventHistory, []);
  assert.equal(worldState.publicOrder, 0);
  assert.equal(worldState.treasury, 10000000);
  assert.equal(worldState.player.health, 100);
  assert.equal(worldState.player.gold, 0);
  assert.equal(worldState.player.academia, 100);
  assert.equal(worldState.player.examRank, null);
  assert.deepEqual(worldState.player.examHistory, []);
  assert.equal(worldState.player.role, originalRole);
  assert.equal(worldState.player.officeTitle, null);
  assert.equal(worldState.factions.eunuchs, 88);
  assert.equal(worldState.factions.inventedFaction, undefined);
  assert.equal(worldState.turnCount, 1);
});

test("ordinary state patches preserve server-owned exam and narrative fields", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.activeExam = { level: "child_exam", reason: "server-created" };
  worldState.characters = [{ id: "C01", name: "Original mentor", role: "teacher" }];
  worldState.eventHistory = ["existing history"];
  worldState.player.examRank = "server-rank";
  worldState.player.examHistory = [{ level: "child_exam", score: 80 }];

  applyStatePatch(worldState, {
    activeExam: null,
    characters: [{ id: "C99", name: "Invented patron", role: "patron" }],
    eventHistory: ["provider replacement"],
    publicOrder: 65,
    player: {
      academia: 22,
      examRank: "model-rank",
      examHistory: [{ level: "palace_exam", score: 100 }]
    }
  });

  assert.deepEqual(worldState.activeExam, { level: "child_exam", reason: "server-created" });
  assert.deepEqual(worldState.characters, [{ id: "C01", name: "Original mentor", role: "teacher" }]);
  assert.deepEqual(worldState.eventHistory, ["existing history"]);
  assert.equal(worldState.player.examRank, "server-rank");
  assert.deepEqual(worldState.player.examHistory, [{ level: "child_exam", score: 80 }]);
  assert.equal(worldState.publicOrder, 65);
  assert.equal(worldState.player.academia, 22);
  assert.equal(worldState.turnCount, 1);
});

test("applyStatePatch can apply server follow-up patches without incrementing turn count", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  applyStatePatch(worldState, {
    year: -50,
    month: 99,
    activeExam: { level: "child_exam", status: "writing" },
    eventHistory: Array.from({ length: MAX_EVENT_HISTORY + 1 }, (_, index) => `server-event-${index}`),
    publicOrder: 80
  }, { incrementTurnCount: false, allowServerOwnedPatchKeys: true });

  assert.equal(worldState.year, 1);
  assert.equal(worldState.month, 12);
  assert.equal(worldState.activeExam.level, "child_exam");
  assert.equal(worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.equal(worldState.eventHistory[0], "server-event-1");
  assert.equal(worldState.publicOrder, 80);
  assert.equal(worldState.turnCount, 0);
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
