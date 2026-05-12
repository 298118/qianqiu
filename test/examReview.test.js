const test = require("node:test");
const assert = require("node:assert/strict");

const { getExam } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const {
  resolveExamReview,
  summarizeExaminerPanelForPrompt
} = require("../src/game/examReview");

function scoreDimension(score = 80, comment = "尚可。") {
  return { score, comment };
}

function scorePayload(overall = 80, overrides = {}) {
  return {
    content_quality: scoreDimension(overall),
    argument_strength: scoreDimension(overall),
    literary_style: scoreDimension(overall),
    classical_format: scoreDimension(overall),
    historical_appropriateness: scoreDimension(overall),
    overall_score: overall,
    rank: "取中",
    detailed_feedback: "初评可取。",
    ...overrides
  };
}

function authenticity(flags = []) {
  return {
    copy_detection: { is_copy: false, similar_passage: "" },
    anachronism_detection: { has_anachronism: false, details: [] },
    style_consistency: { consistent: true, note: "" },
    ghostwriting_probability: 0,
    flags
  };
}

test("exam review resolves public incidents and bounded examiner deltas before ranking", () => {
  const worldState = createInitialState({ playerName: "Review Tester" });
  worldState.studyProfile = {
    dimensions: {
      examEndurance: 42,
      calligraphyCopying: 45,
      eightLeggedForm: 82,
      policyInsight: 62
    }
  };
  worldState.player.health = 40;
  const activeExam = {
    examId: "provincial-review-test",
    level: "provincial_exam",
    examName: "乡试",
    procedure: { rollLifecycle: { transcribed: true } }
  };
  const exam = getExam("provincial_exam");
  const grade = {
    examiner_reviews: [
      {
        actor: "chief_examiner",
        recommendation: "钦点解元",
        suggestedScoreDelta: 2,
        comment: "hiddenIntent OPENAI_API_KEY sk-review-secret raw provider proposal E:\\secret\\exam.txt",
        concern: "sealed_mapping 不得公开"
      }
    ]
  };

  const result = resolveExamReview({
    worldState,
    activeExam,
    exam,
    essay: "夫治民之道，在正风俗、平讼狱、恤民力。",
    grade,
    score: scorePayload(80),
    authenticityCheck: authenticity()
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.score.overall_score, 74);
  assert.equal(result.scoreDelta, -6);
  assert.equal(result.examinerPanel.roomReviews.some((review) => review.actor === "room_officer" && review.accepted), true);
  assert.equal(result.examinerPanel.roomReviews.some((review) => review.source === "provider_proposal" && review.accepted === false), true);
  assert.ok(result.incidents.some((incident) => incident.type === "sudden_illness"));
  assert.ok(result.incidents.some((incident) => incident.type === "transcription_error"));
  assert.match(result.examinerPanel.serverDecision, /最终榜单/);
  assert.doesNotMatch(serialized, /hiddenIntent|OPENAI_API_KEY|sk-review-secret|raw provider|E:\\secret|sealed_mapping/);
});

test("exam review keeps severe local cheating ahead of favorable examiner proposals", () => {
  const worldState = createInitialState({ playerName: "Review Tester" });
  const activeExam = { examId: "child-review-test", level: "child_exam", examName: "童试" };
  const exam = getExam("child_exam");
  const result = resolveExamReview({
    worldState,
    activeExam,
    exam,
    essay: "学而时习之不亦说乎",
    grade: {
      examiner_reviews: [{
        actor: "chief_examiner",
        recommendation: "强行取中",
        suggestedScoreDelta: 2,
        comment: "模型说应当取中。"
      }]
    },
    score: scorePayload(0, {
      content_quality: scoreDimension(0),
      argument_strength: scoreDimension(0),
      literary_style: scoreDimension(0),
      classical_format: scoreDimension(0),
      historical_appropriateness: scoreDimension(0)
    }),
    authenticityCheck: {
      ...authenticity([{ type: "copy_detection", label: "照抄", severity: "severe", penalty: 100 }]),
      copy_detection: { is_copy: true, similar_passage: "学而时习之" }
    }
  });

  assert.equal(result.score.overall_score, 0);
  assert.ok(result.auditFlags.some((flag) => flag.type === "exam_review_contraband"));
  assert.equal(result.examinerPanel.roomReviews.some((review) => review.source === "provider_proposal" && review.accepted), false);
  assert.match(result.examinerPanel.disputeSummary, /模型考官建议已脱敏留痕/);
});

test("examiner panel prompt summary is capped and authority-scoped", () => {
  const panel = {
    level: "metropolitan_exam",
    examName: "会试",
    roomReviews: Array.from({ length: 8 }, (_, index) => ({
      actor: index === 0 ? "chief_examiner" : "room_officer",
      label: `阅卷${index}`,
      recommendation: "建议",
      suggestedScoreDelta: 1,
      comment: "只作建议。",
      accepted: index < 4
    })),
    scoreInputs: [{ source: "server_final", label: "服务器定分", score: 79, publicSummary: "定分。" }],
    incidents: [
      { type: "cell_noise", label: "邻号扰动", severity: "info", scoreDelta: 0, publicSummary: "已平息。" }
    ],
    auditFlags: [],
    disputeSummary: "公开分歧。",
    serverDecision: "服务器定序。"
  };

  const summary = summarizeExaminerPanelForPrompt(panel);

  assert.equal(summary.roomReviews.length, 3);
  assert.match(summary.authorityBoundary, /不得要求弥封映射/);
  assert.equal(summary.scoreInputs[0].source, "server_final");
});
