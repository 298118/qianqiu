const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyRelationshipChanges } = require("../src/game/relationships");
const {
  rankNpcSalience,
  runBackgroundNpcHeuristic
} = require("../src/game/npcMind");

test("S70.4 ranks visible NPC salience by relationship, resentment and active requests", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "问学士子" });
  worldState.characters.push({
    id: "C02",
    name: "周同年",
    role: "同窗",
    loyalty: 50,
    ambition: 50,
    skill: 50,
    alive: true
  });
  worldState.relationshipLedger.characters.C02 = {
    id: "C02",
    name: "周同年",
    role: "同窗",
    stance: "rival",
    relationship: -5,
    resentment: 55,
    networkSource: "academy",
    recentIntent: "对玩家文章颇有不服。",
    visible: true,
    lastUpdatedTurn: 2
  };
  worldState.turnCount = 3;
  worldState.activeNpcRequest = {
    id: "REQ-test",
    status: "active",
    kind: "pressure",
    targetType: "character",
    targetId: "C02",
    sourceName: "周同年",
    title: "周同年前来施压",
    ask: "盼你在文会上让一步。",
    createdTurn: 3,
    dueTurn: 5,
    lastUpdatedTurn: 3
  };

  const ranked = rankNpcSalience(worldState, { limit: 2 });

  assert.equal(ranked[0].npcId, "C02");
  assert.equal(ranked[0].salienceReasons.includes("当前请托相关"), true);
  assert.equal(ranked[0].salienceReasons.includes("怨望显著"), true);
});

test("S70.4 background NPC heuristic returns low-impact memory material only", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "背景测试" });
  applyRelationshipChanges(worldState, [{
    targetType: "character",
    targetId: "C01",
    relationshipDelta: -10,
    resentmentDelta: 0,
    reason: "降低显著度测试。"
  }]);

  const rows = runBackgroundNpcHeuristic(worldState, { limit: 5 });
  const serialized = JSON.stringify(rows);

  assert.ok(Array.isArray(rows));
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("provider proposal"), false);
  assert.equal(serialized.includes("data/sessions"), false);
});
