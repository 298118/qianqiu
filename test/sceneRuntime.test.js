const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createScene,
  resolveSceneOutcome,
  runSceneRound
} = require("../src/game/sceneRuntime");

test("S71.9 scene runtime collects actor proposals and resolves without advancing global time", async () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "堂上测试" });
  const before = {
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    turnCount: worldState.turnCount,
    publicOrder: worldState.publicOrder,
    corruption: worldState.corruption,
    eventHistory: JSON.stringify(worldState.eventHistory || [])
  };

  const scene = createScene(worldState, {
    sceneType: "judicial_hearing",
    title: "堂审水利讼案",
    focusRefs: ["local_docket:waterworks"]
  });
  const round = await runSceneRound(worldState, scene);
  const outcome = resolveSceneOutcome(worldState, scene, round.proposals);

  assert.equal(scene.sceneType, "judicial_hearing");
  assert.equal(scene.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(round.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(outcome.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(round.proposals.length, scene.participants.length);
  assert.equal(round.actorContexts.length, scene.participants.length);
  assert.ok(round.proposals.every((proposal) => proposal.sceneId === scene.sceneId));
  assert.ok(round.proposals.every((proposal) => proposal.accepted === false));
  assert.ok(round.actorContexts.every((context) => context.safety.actorVisibleContextOnly === true));
  assert.ok(round.actorContexts.every((context) => context.visibleEvidenceRefs.length > 0));

  assert.equal(outcome.status, "server_resolved");
  assert.equal(outcome.resolverOutcomes.length, round.proposals.length);
  assert.equal(outcome.appliedWorldChanges.length, 0);
  assert.ok(outcome.resolverOutcomes.some((entry) => entry.status === "accepted"));
  assert.ok(outcome.resolverOutcomes.every((entry) => entry.safety.appliedToWorldState === false));

  assert.equal(worldState.year, before.year);
  assert.equal(worldState.month, before.month);
  assert.equal(worldState.tenDayPeriod, before.tenDayPeriod);
  assert.equal(worldState.turnCount, before.turnCount);
  assert.equal(worldState.publicOrder, before.publicOrder);
  assert.equal(worldState.corruption, before.corruption);
  assert.equal(JSON.stringify(worldState.eventHistory || []), before.eventHistory);
  assert.equal(worldState.judicialCaseLedger, undefined);
  assert.doesNotMatch(JSON.stringify(outcome), /server\.resolve_case|rawSql|world_sessions|sk-[A-Za-z0-9_-]+/);
});

test("S71.9 court debate routes only safe summaries to existing server resolvers", async () => {
  const worldState = createInitialState({ role: "emperor", playerName: "御前测试" });
  const scene = createScene(worldState, { sceneType: "court_debate", title: "朝议赈济" });
  const round = await runSceneRound(worldState, scene);
  const outcome = resolveSceneOutcome(worldState, scene, round.proposals);

  assert.equal(scene.context.allowedProposalKinds.includes("city_policy"), true);
  assert.ok(round.proposals.some((proposal) => proposal.proposalKind === "city_policy"));
  assert.ok(outcome.resolverOutcomes.some((entry) => entry.resolverKind === "city_policy"));
  assert.equal(worldState.cityPolicyLedger, undefined);
  assert.equal(outcome.auditSummary.rawPayloadIncluded, false);
  assert.equal(outcome.auditSummary.auditRecordIncluded, false);
});
