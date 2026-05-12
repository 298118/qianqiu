const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cleanProviderText,
  sanitizeExamGradePayload,
  sanitizeExamQuestionPayload
} = require("../src/game/examProviderSanitizer");
const { getExam } = require("../src/game/exams");

test("exam provider sanitizer redacts hidden, key, token plan, and path-shaped text", () => {
  const cleaned = cleanProviderText(
    "hiddenNotes SEALED_EXAM_TOKEN OPENAI_API_KEY sk-exam-secret tp-mimo-secret data/sessions/raw.json E:\\LSMNQ\\data\\audit\\x.jsonl prompt",
    "fallback"
  );

  assert.doesNotMatch(cleaned, /hiddenNotes|SEALED_EXAM_TOKEN|OPENAI_API_KEY|sk-exam-secret|tp-mimo-secret|data\/sessions|E:\\LSMNQ|prompt/);
  assert.match(cleaned, /已遮蔽/);
});

test("exam question sanitizer keeps provider questions route-safe", () => {
  const exam = getExam("child_exam");
  const question = sanitizeExamQuestionPayload({
    level: "child_exam",
    examName: "童试 hiddenNotes",
    examQuestion: "题面含 SEALED_Q_TOKEN 与 tp-question-secret data/sessions/q.json",
    questionType: "essay",
    difficulty: "entry",
    requirements: ["写出 OPENAI_API_KEY", "论修身"],
    promotionRank: "秀才 sk-rank-secret"
  }, exam);

  const serialized = JSON.stringify(question);
  assert.doesNotMatch(serialized, /hiddenNotes|SEALED_Q_TOKEN|tp-question-secret|data\/sessions|OPENAI_API_KEY|sk-rank-secret/);
  assert.equal(question.level, "child_exam");
  assert.match(question.examQuestion, /已遮蔽/);
});

test("exam grade sanitizer cleans score comments before they enter saved history", () => {
  const grade = sanitizeExamGradePayload({
    score: {
      content_quality: { score: 90, comment: "义理尚可 hiddenIntent tp-grade-secret" },
      argument_strength: { score: 90, comment: "statePatch.player.officeTitle" },
      literary_style: { score: 90, comment: "文气雅正" },
      classical_format: { score: 90, comment: "raw provider proposal" },
      historical_appropriateness: { score: 90, comment: "E:\\LSMNQ\\data\\sessions\\x.json" },
      overall_score: 90,
      rank: "一等 OPENAI_API_KEY",
      detailed_feedback: "详评含 SEALED_SCORE_TOKEN sk-score-secret prompt_retrieval_index。"
    },
    examiner_reviews: [{
      actor: "room_officer",
      label: "prompt_retrieval_index",
      recommendation: "world_sessions",
      comment: "statePatch appointmentTrack event_log ai_change_proposals raw table",
      concern: "retrievalContext worldState E:\\LSMNQ\\data\\audit\\review.jsonl"
    }],
    authenticity_check: {},
    virtual_candidates: [],
    ranking: []
  });

  const serialized = JSON.stringify({
    score: grade.score,
    examinerReviews: grade.examiner_reviews
  });
  assert.doesNotMatch(
    serialized,
    /hiddenIntent|tp-grade-secret|statePatch|appointmentTrack|raw provider|raw table|retrievalContext|worldState|event_log|ai_change_proposals|world_sessions|E:\\LSMNQ|OPENAI_API_KEY|SEALED_SCORE_TOKEN|sk-score-secret|prompt_retrieval_index/
  );
  assert.equal(grade.score.overall_score, 90);
  assert.match(grade.score.detailed_feedback, /已遮蔽/);
});
