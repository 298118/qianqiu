const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  EXAMS,
  canEnterExam,
  getNextExamLevel,
  summarizeReadiness
} = require("../src/game/exams");
const { applyAuthenticityPenalties, checkEssayAuthenticity } = require("../src/game/essayChecks");
const { buildRanking, generateVirtualCandidates } = require("../src/game/candidates");
const { applyExamPromotion, hasSevereCheating } = require("../src/game/promotions");

function noCheat() {
  return {
    flags: [],
    copy_detection: { is_copy: false, similar_passage: "" }
  };
}

function baseScore(overall = 80) {
  const dimension = { score: overall, comment: "ok" };
  return {
    content_quality: dimension,
    argument_strength: dimension,
    literary_style: dimension,
    classical_format: dimension,
    historical_appropriateness: dimension,
    overall_score: overall,
    rank: "pass",
    detailed_feedback: "base"
  };
}

test("exam gates follow the scholar rank ladder", () => {
  const player = createInitialState({ role: "scholar" }).player;

  assert.equal(getNextExamLevel(null), "child_exam");
  assert.equal(canEnterExam(player, "child_exam").ok, true);
  assert.equal(canEnterExam(player, "provincial_exam").ok, false);

  player.examRank = EXAMS.child_exam.promotionRank;
  assert.equal(getNextExamLevel(player.examRank), "provincial_exam");
  assert.equal(canEnterExam(player, "provincial_exam").ok, true);

  player.examRank = EXAMS.provincial_exam.promotionRank;
  assert.equal(getNextExamLevel(player.examRank), "metropolitan_exam");
  assert.equal(canEnterExam(player, "metropolitan_exam").ok, true);

  player.examRank = EXAMS.metropolitan_exam.promotionRank;
  assert.equal(getNextExamLevel(player.examRank), "palace_exam");
  assert.equal(canEnterExam(player, "palace_exam").ok, true);

  player.role = "official";
  assert.equal(canEnterExam(player, "palace_exam").ok, false);
});

test("readiness reports missing threshold attributes and passes once met", () => {
  const player = createInitialState({ role: "scholar" }).player;
  const exam = EXAMS.metropolitan_exam;
  const firstReadiness = summarizeReadiness(player, exam);

  assert.equal(firstReadiness.ready, false);
  assert.ok(firstReadiness.missing.some((item) => item.key === "academia"));

  for (const [key, value] of Object.entries(exam.threshold)) {
    player[key] = value;
  }

  assert.deepEqual(summarizeReadiness(player, exam), { ready: true, missing: [] });
});

test("server-owned promotion applies rank changes and official transition", () => {
  const worldState = createInitialState({ role: "scholar" });

  const childResult = applyExamPromotion(worldState, EXAMS.child_exam, baseScore(90), noCheat());
  assert.equal(childResult.passed, true);
  assert.equal(worldState.player.examRank, EXAMS.child_exam.promotionRank);

  worldState.player.examRank = EXAMS.metropolitan_exam.promotionRank;
  const palaceResult = applyExamPromotion(worldState, EXAMS.palace_exam, baseScore(80), noCheat());

  assert.equal(palaceResult.passed, true);
  assert.equal(worldState.player.examRank, EXAMS.palace_exam.promotionRank);
  assert.equal(worldState.player.role, "official");
  assert.ok(worldState.player.officeTitle);
  assert.ok(worldState.player.influence > 0);
});

test("severe cheating forces failure and downgrades existing rank", () => {
  const worldState = createInitialState({ role: "scholar" });
  worldState.player.examRank = EXAMS.provincial_exam.promotionRank;
  worldState.player.reputation = 50;

  const authenticityCheck = {
    flags: [],
    copy_detection: { is_copy: true, similar_passage: "classic" }
  };
  const result = applyExamPromotion(worldState, EXAMS.metropolitan_exam, baseScore(95), authenticityCheck);

  assert.equal(hasSevereCheating(authenticityCheck), true);
  assert.equal(result.passed, false);
  assert.equal(result.severeCheat, true);
  assert.equal(worldState.player.examRank, EXAMS.child_exam.promotionRank);
  assert.ok(worldState.player.reputation < 50);
});

test("local essay checks and penalties catch short anachronistic submissions", () => {
  const worldState = createInitialState({ role: "scholar" });
  const exam = EXAMS.child_exam;
  const authenticityCheck = checkEssayAuthenticity({
    essay: "AI",
    exam,
    player: worldState.player
  });

  assert.ok(authenticityCheck.flags.some((flag) => flag.type === "too_short"));
  assert.ok(authenticityCheck.flags.some((flag) => flag.type === "anachronism"));

  const penalized = applyAuthenticityPenalties(baseScore(80), authenticityCheck, exam);
  assert.ok(penalized.overall_score < 80);

  const copied = applyAuthenticityPenalties(
    baseScore(80),
    { flags: [], copy_detection: { is_copy: true, similar_passage: "classic" } },
    exam
  );
  assert.equal(copied.overall_score, 0);
});

test("virtual candidates are bounded and ranking favors the player on score ties", () => {
  const worldState = createInitialState({ role: "scholar" });
  const candidates = generateVirtualCandidates(worldState, EXAMS.child_exam, 70);

  assert.ok(candidates.length >= 4);
  assert.ok(candidates.length <= 8);
  assert.ok(candidates.every((candidate) => candidate.score.overall_score >= 0));
  assert.ok(candidates.every((candidate) => candidate.score.overall_score <= 100));

  const ranking = buildRanking(
    {
      id: "player",
      name: "Tester",
      origin: "local",
      background: "manual",
      score: { overall_score: 70, rank: "pass" },
      isPlayer: true
    },
    [
      {
        id: "candidate-high",
        name: "Higher",
        origin: "local",
        background: "manual",
        score: { overall_score: 80, rank: "pass" }
      },
      {
        id: "candidate-tie",
        name: "Tie",
        origin: "local",
        background: "manual",
        score: { overall_score: 70, rank: "pass" }
      }
    ]
  );

  assert.equal(ranking[0].id, "candidate-high");
  assert.equal(ranking[1].id, "player");
  assert.equal(ranking[1].place, 2);
  assert.equal(ranking[2].id, "candidate-tie");
});
