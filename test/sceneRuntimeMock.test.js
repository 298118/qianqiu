const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  collectSceneProposals,
  createScene,
  resolveSceneOutcome,
  runSceneRound
} = require("../src/game/sceneRuntime");

test("S71.9 mock scene runtime runs battle council without mutating world state", async () => {
  const worldState = createInitialState({ role: "general", playerName: "军议测试" });
  for (const frontier of worldState.worldGeography?.frontierZones || []) {
    frontier.intelConfidence = 90;
  }
  const before = JSON.stringify(worldState);
  const scene = createScene(worldState, { sceneType: "battle_council", title: "边面军议" });
  const round = await runSceneRound(worldState, scene);
  const collected = collectSceneProposals(round);
  const forged = {
    participantId: "outsider:99",
    actorId: "system:forged",
    proposalKind: "military_order",
    evidenceRefs: collected[0]?.evidenceRefs || [],
    accepted: true,
    stateDelta: { borderThreat: -100 }
  };
  const outcome = resolveSceneOutcome(worldState, scene, [...collected, forged]);

  assert.equal(round.proposals.length, scene.participants.length);
  assert.equal(collected.length, round.proposals.length);
  assert.equal(outcome.proposalSummaries.length, collected.length);
  assert.ok(outcome.resolverOutcomes.some((entry) => entry.resolverKind === "military"));
  assert.ok(outcome.resolverOutcomes.some((entry) => entry.status === "accepted"));
  assert.equal(outcome.appliedWorldChanges.length, 0);
  assert.equal(JSON.stringify(worldState), before);
  assert.equal(worldState.militaryDiplomacyLedger, undefined);
  assert.doesNotMatch(JSON.stringify(outcome), /statePatch|rawSql|server\.resolve_battle|world_sessions/);
  assert.ok(outcome.resolverOutcomes.every((entry) => !("auditRecord" in entry)));
});

test("S71.9 scene runtime enforces local round budgets in mock fallback", async () => {
  const worldState = createInitialState({ role: "emperor", playerName: "预算测试" });
  const scene = createScene(worldState, { sceneType: "diplomatic_summit", maxRounds: 2 });
  const firstRound = await runSceneRound(worldState, scene, { roundIndex: 1 });
  const secondRound = await runSceneRound(worldState, scene, { roundIndex: 2 });

  assert.equal(scene.proposalBudget.maxRounds, 2);
  assert.equal(firstRound.sceneLocalTime.roundIndex, 1);
  assert.equal(secondRound.sceneLocalTime.roundIndex, 2);
  assert.equal(firstRound.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(secondRound.sceneLocalTime.globalTimeAdvanced, false);
  assert.ok(firstRound.proposals.length <= scene.proposalBudget.maxProposalsPerRound);
  assert.ok(secondRound.proposals.length <= scene.proposalBudget.maxProposalsPerRound);
});
