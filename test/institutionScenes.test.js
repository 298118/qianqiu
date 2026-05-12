const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  collectInstitutionProposals,
  createCourtDebateScene,
  resolveInstitutionSceneOutcome,
  runInstitutionSceneRound
} = require("../src/game/institutionScenes");

test("S70.5 court debate scene creates scene-local actors and pending outcome", async () => {
  const worldState = createInitialState({ role: "emperor", playerName: "御前测试" });
  worldState.turnCount = 7;
  worldState.year = 1645;
  worldState.month = 3;
  worldState.tenDayPeriod = 2;

  const scene = createCourtDebateScene(worldState, "边饷与钱粮并议");
  const roles = scene.participants.map((participant) => participant.participantRole);
  const round = await runInstitutionSceneRound(scene);
  const proposals = collectInstitutionProposals(round);
  const outcome = resolveInstitutionSceneOutcome(worldState, scene, proposals);

  assert.equal(scene.sceneType, "court_debate");
  assert.equal(scene.sceneLocalTime.cadence, "scene");
  assert.equal(scene.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(scene.sceneLocalTime.globalDate.turnCount, 7);
  assert.equal(roles.includes("emperor"), true);
  assert.equal(roles.includes("censor"), true);
  assert.equal(roles.includes("domain_office"), true);
  assert.equal(scene.participants.some((participant) => participant.defaultProposalType === "frontier_warning"), true);
  assert.equal(round.proposals.length, scene.participants.length);
  assert.equal(proposals.every((proposal) => proposal.sceneId === scene.sceneId), true);
  assert.equal(proposals.every((proposal) => proposal.toolCalls.length === 0), true);
  assert.equal(outcome.status, "pending_server_resolution");
  assert.equal(outcome.appliedWorldChanges.length, 0);
  assert.equal(outcome.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(worldState.turnCount, 7);
});

test("S70.5 outcome ignores forged participants and anchors actor identity", async () => {
  const worldState = createInitialState({ role: "emperor", playerName: "御前复核" });
  const scene = createCourtDebateScene(worldState, "河工修筑");
  const round = await runInstitutionSceneRound(scene);
  const validProposal = round.proposals[0];
  const outcome = resolveInstitutionSceneOutcome(worldState, scene, [
    {
      sceneId: scene.sceneId,
      participantId: "intruder:1",
      actorId: "npc:C99",
      proposalType: "imperial_signal",
      publicPosition: "伪造入场意见。"
    },
    {
      ...validProposal,
      actorId: "npc:C99"
    }
  ]);

  assert.equal(outcome.proposalSummaries.length, 1);
  assert.equal(outcome.proposalSummaries[0].participantId, validProposal.participantId);
  assert.equal(outcome.proposalSummaries[0].actorId, scene.participants[0].actor.actorId);
  assert.equal(worldState.turnCount, 0);
});
