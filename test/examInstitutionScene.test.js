const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createExamReviewScene,
  resolveInstitutionSceneOutcome,
  runInstitutionSceneRound
} = require("../src/game/institutionScenes");

test("S70.5 exam review scene keeps examiner proposals scene-local and server-owned", async () => {
  const worldState = createInitialState({ role: "scholar", playerName: "科场测试" });
  worldState.turnCount = 11;
  worldState.activeExam = {
    level: "provincial_exam",
    examName: "乡试",
    scenePhase: "drafting",
    questionType: "策论"
  };
  const scene = createExamReviewScene(worldState, {
    examName: "乡试榜前评议",
    essayExcerpt: "provider /mnt/e/raw-roll.txt",
    scoreSummary: "本卷经义尚稳"
  });
  const roles = scene.participants.map((participant) => participant.participantRole);
  const round = await runInstitutionSceneRound(scene);
  const outcome = resolveInstitutionSceneOutcome(worldState, scene, round.proposals);

  assert.equal(scene.sceneType, "exam_review");
  assert.deepEqual(roles, ["room_officer", "co_examiner", "chief_examiner", "audit_critic"]);
  assert.equal(scene.context.essayExcerpt, "");
  assert.equal(scene.context.scoreSummary, "本卷经义尚稳");
  assert.equal(scene.context.appointmentTrack.publicSummary, "授官轨迹尚无记录。");
  assert.equal(JSON.stringify(scene.context).includes("provider"), false);
  assert.equal(JSON.stringify(scene.context).includes("prompt"), false);
  assert.equal(JSON.stringify(scene.context).includes("/mnt/e"), false);
  assert.equal(scene.sceneLocalTime.globalDate.turnCount, 11);
  assert.equal(round.proposals.every((proposal) => (
    proposal.proposalType === "exam_comment" ||
    proposal.proposalType === "exam_audit_risk" ||
    proposal.proposalType === "procedural_note"
  )), true);
  assert.equal(outcome.publicSummary.includes("定榜"), true);
  assert.equal(outcome.appliedWorldChanges.length, 0);
  assert.equal(outcome.sceneLocalTime.globalTimeAdvanced, false);
  assert.equal(worldState.turnCount, 11);
});
