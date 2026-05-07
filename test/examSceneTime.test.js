const test = require("node:test");
const assert = require("node:assert/strict");

const {
  advanceExamScenePhase,
  attachExamSceneTime,
  markExamSceneSubmitted
} = require("../src/game/examSceneTime");
const { createInitialState } = require("../src/game/initialState");

function createActiveExam() {
  return {
    examId: "child_exam-scene-test",
    level: "child_exam",
    examName: "童试",
    examQuestion: "试论修身读书与县学教化之要。",
    status: "writing"
  };
}

test("exam scene time stamps the global date without advancing it", () => {
  const worldState = createInitialState({ playerName: "Scene Tester" });
  worldState.year = 1644;
  worldState.month = 9;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 12;
  const activeExam = createActiveExam();

  const sceneTime = attachExamSceneTime(activeExam, worldState, "question_review");

  assert.equal(sceneTime.phase, "question_review");
  assert.equal(sceneTime.phaseLabel, "发题审题");
  assert.equal(sceneTime.startedAt.year, 1644);
  assert.equal(sceneTime.startedAt.month, 9);
  assert.equal(sceneTime.startedAt.tenDayPeriod, 3);
  assert.equal(sceneTime.startedAt.turnCount, 12);
  assert.equal(activeExam.scenePhaseLabel, "发题审题");
  assert.equal(worldState.year, 1644);
  assert.equal(worldState.month, 9);
  assert.equal(worldState.tenDayPeriod, 3);
  assert.equal(worldState.turnCount, 12);
});

test("exam scene phase advances locally and caps at fair copy before submit", () => {
  const worldState = createInitialState({ playerName: "Scene Tester" });
  const activeExam = createActiveExam();
  attachExamSceneTime(activeExam, worldState, "question_review");

  const outline = advanceExamScenePhase(activeExam, worldState, "拟纲定章法");
  const drafting = advanceExamScenePhase(activeExam, worldState, "作答成文");
  const fairCopy = advanceExamScenePhase(activeExam, worldState, "誊清定稿");
  const stillFairCopy = advanceExamScenePhase(activeExam, worldState, "再三校读");

  assert.equal(outline.sceneTime.phase, "outline");
  assert.equal(drafting.sceneTime.phase, "drafting");
  assert.equal(fairCopy.sceneTime.phase, "fair_copy");
  assert.equal(stillFairCopy.sceneTime.phase, "fair_copy");
  assert.equal(activeExam.sceneTurnCount, 4);
  assert.equal(worldState.tenDayPeriod, 1);
  assert.equal(worldState.turnCount, 0);
});

test("exam scene submit records submitted phase on active exam", () => {
  const worldState = createInitialState({ playerName: "Scene Tester" });
  worldState.month = 4;
  const activeExam = createActiveExam();
  attachExamSceneTime(activeExam, worldState, "fair_copy");

  const sceneTime = markExamSceneSubmitted(activeExam, worldState);

  assert.equal(sceneTime.phase, "submitted");
  assert.equal(activeExam.globalSubmittedAt.month, 4);
  assert.equal(activeExam.globalSubmittedAt.tenDayPeriod, 1);
  assert.equal(activeExam.scenePhaseLabel, "交卷");
});
