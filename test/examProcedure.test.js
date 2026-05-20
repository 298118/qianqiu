const test = require("node:test");
const assert = require("node:assert/strict");

const {
  advanceExamProcedurePhase,
  buildExamProcedureView,
  completeExamProcedure,
  initializeExamProcedure,
  summarizeExamProcedureForPrompt
} = require("../src/game/examProcedure");
const {
  advanceExamScenePhase,
  attachExamSceneTime,
  markExamSceneSubmitted
} = require("../src/game/examSceneTime");
const { createInitialState } = require("../src/game/initialState");

function createActiveExam(level = "provincial_exam") {
  return {
    examId: `${level}-procedure-test`,
    level,
    examName: level === "provincial_exam" ? "乡试" : "童试",
    examQuestion: "试论修身读书与地方教化之要。",
    questionType: "策论",
    status: "writing",
    readiness: { ready: true, missing: [] },
    entryPreparation: {
      fullyFunded: true,
      preparationPressure: {
        source: "server_entry_preparation",
        level,
        examName: level === "provincial_exam" ? "乡试" : "童试",
        score: 64,
        band: "strained",
        label: "吃紧",
        summary: "盘费与旅途压力偏高。",
        studyFocus: "制艺章法",
        causes: ["盘费缺口仍须补。"],
        suggestedActions: ["先审题立意。"]
      },
      entryFeedback: {
        pressureScore: 64,
        pressureLabel: "吃紧",
        publicSummary: "盘费压力偏高，入场先稳心神。",
        entrySearchSummary: "入场搜检未见夹带，但备考压力偏高。",
        cellSummary: "号舍已定，先审题再动笔。",
        visibleNextActions: ["先审题立意。"]
      },
      sponsorship: {
        status: "ready",
        ready: true,
        score: 82,
        guarantorName: "顾文衡",
        publicSummary: "顾文衡愿为本场保结。"
      }
    }
  };
}

test("exam procedure view maps active exam into public procedure phases", () => {
  const worldState = createInitialState({ playerName: "Procedure Tester" });
  const activeExam = createActiveExam("provincial_exam");
  worldState.activeExam = activeExam;
  attachExamSceneTime(activeExam, worldState, "question_review");
  initializeExamProcedure(activeExam);

  let view = buildExamProcedureView(worldState);
  assert.equal(view.level, "provincial_exam");
  assert.equal(view.phase, "question_release");
  assert.equal(view.sessionCount, 3);
  assert.equal(view.paperType, "经义制艺");
  assert.equal(view.sponsorship.status, "ready");
  assert.equal(view.preparationPressure.label, "吃紧");
  assert.equal(view.entryFeedback.pressureLabel, "吃紧");
  assert.match(view.entrySearch.publicSummary, /备考压力/);
  assert.equal(view.rollLifecycle.sealed, false);

  advanceExamScenePhase(activeExam, worldState, "作答成文");
  advanceExamProcedurePhase(activeExam);
  view = buildExamProcedureView(worldState);

  assert.equal(view.phase, "drafting");
  assert.equal(view.rollLifecycle.draftRoll, true);
  assert.equal(view.rollLifecycle.sealed, false);
  assert.equal(worldState.turnCount, 0);
  assert.equal(worldState.tenDayPeriod, 1);
});

test("exam procedure records child exam three gates without changing outer level", () => {
  const worldState = createInitialState({ playerName: "Procedure Tester" });
  worldState.activeExam = createActiveExam("child_exam");
  attachExamSceneTime(worldState.activeExam, worldState, "question_review");
  initializeExamProcedure(worldState.activeExam);

  const view = buildExamProcedureView(worldState);

  assert.equal(view.level, "child_exam");
  assert.equal(view.sessionCount, 3);
  assert.deepEqual(view.papers.map((paper) => paper.subStage), [
    "county_exam",
    "prefectural_exam",
    "academy_exam"
  ]);
  assert.deepEqual(view.papers.map((paper) => paper.paperType), [
    "经义章句",
    "经义小题",
    "学政策问"
  ]);
});

test("completed exam procedure archives roll lifecycle and redacts hidden tokens", () => {
  const worldState = createInitialState({ playerName: "Procedure Tester" });
  const activeExam = createActiveExam("provincial_exam");
  activeExam.procedure = {
    incidents: [{
      type: "sealed_mapping",
      label: "SEALED_INTERNAL_MAPPING",
      publicSummary: "SEALED_INTERNAL_MAPPING should be clipped but remains only as supplied public text"
    }, {
      type: "rawProvider",
      label: "prompt leak",
      publicSummary: "sk-procedure-secret /home/procedure rawProvider"
    }],
    visibleNextActions: ["查看 /tmp/procedure prompt"]
  };
  worldState.activeExam = activeExam;
  attachExamSceneTime(activeExam, worldState, "fair_copy");
  markExamSceneSubmitted(activeExam, worldState);

  const procedure = completeExamProcedure(activeExam, {
    score: { overall_score: 76 },
    authenticityCheck: {
      flags: [{ type: "anachronism", label: "时代错语", severity: "major", penalty: 8, detail: "出现不合时宜词语 sk-procedure-secret。" }]
    },
    promotionResult: { passed: true, rank: "举人" },
    ranking: [{ isPlayer: true, place: 5 }],
    reviewResult: {
      incidents: [{ type: "review_raw", label: "rawProvider", publicSummary: "/tmp/review raw provider prompt" }],
      auditFlags: [{ type: "review_prompt", label: "复核", severity: "notice", publicSummary: "OPENAI_API_KEY /mnt/review", penalty: 1 }]
    }
  });
  const view = buildExamProcedureView(worldState, { procedure });
  const promptSummary = summarizeExamProcedureForPrompt(worldState);

  assert.equal(view.phase, "closed");
  assert.equal(view.rollLifecycle.sealed, true);
  assert.equal(view.rollLifecycle.transcribed, true);
  assert.equal(view.rollLifecycle.collated, true);
  assert.equal(view.rollLifecycle.audited, true);
  assert.match(view.resultSummary, /总评76分/);
  assert.equal(view.auditFlags[0].label, "时代错语");
  assert.doesNotMatch(JSON.stringify(view), /hiddenNotes|raw provider|rawProvider|prompt|sk-procedure-secret|data\/sessions|OPENAI_API_KEY|\/mnt\/|\/home\/|\/tmp\//);
  assert.equal(promptSummary.rollLifecycle.sealed, true);
  assert.equal(promptSummary.preparationPressure.label, "吃紧");
  assert.doesNotMatch(JSON.stringify(promptSummary), /hiddenNotes|raw provider|rawProvider|sk-procedure-secret|data\/sessions|OPENAI_API_KEY|\/mnt\/|\/home\/|\/tmp\//);
  assert.match(promptSummary.authorityBoundary, /不得要求或推断弥封身份映射/);
});
