const test = require("node:test");
const assert = require("node:assert/strict");

const { getExam } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const {
  applyCanonicalScoreRank,
  buildExamHonorSnapshot,
  buildExamHonorView,
  decorateExamRanking,
  resolveExamHonors,
  summarizeExamHonorsForPrompt
} = require("../src/game/examHonors");

function entry(id, place, score = 90, rank = "取中", isPlayer = false) {
  return {
    id,
    name: isPlayer ? "玩家" : `考生${place}`,
    origin: "应天府",
    background: "同场",
    score,
    rank,
    place,
    isPlayer
  };
}

test("provincial and metropolitan first places award server-owned first honors", () => {
  const worldState = createInitialState({ playerName: "荣誉测试" });
  const provincial = getExam("provincial_exam");
  const provincialRanking = decorateExamRanking({
    exam: provincial,
    ranking: [entry("player", 1, 96, "一等", true), entry("candidate-2", 2, 85)]
  });
  const firstResult = resolveExamHonors({
    worldState,
    activeExam: { level: provincial.level, examName: provincial.name },
    exam: provincial,
    ranking: provincialRanking,
    promotionResult: { passed: true, rank: "举人" }
  });

  assert.equal(firstResult.currentHonor.title, "解元");
  assert.equal(firstResult.currentHonor.rankLabel, "乡试第一名");

  const metropolitan = getExam("metropolitan_exam");
  const metropolitanRanking = decorateExamRanking({
    exam: metropolitan,
    ranking: [entry("player", 1, 98, "一等", true), entry("candidate-2", 2, 90)]
  });
  const secondResult = resolveExamHonors({
    worldState,
    activeExam: { level: metropolitan.level, examName: metropolitan.name },
    exam: metropolitan,
    ranking: metropolitanRanking,
    promotionResult: { passed: true, rank: "贡士" }
  });
  const view = buildExamHonorView(worldState);

  assert.equal(secondResult.currentHonor.title, "会元");
  assert.deepEqual(view.honors.map((honor) => honor.title), ["解元", "会元"]);
  assert.match(view.authorityBoundary, /服务器定榜顺序/);
});

test("failed or cheating results do not award honors even if ranking is first", () => {
  const worldState = createInitialState({ playerName: "落第测试" });
  const exam = getExam("provincial_exam");
  const ranking = decorateExamRanking({
    exam,
    ranking: [entry("player", 1, 50, "落第", true), entry("candidate-2", 2, 48, "落第")]
  });
  const result = resolveExamHonors({
    worldState,
    activeExam: { level: exam.level, examName: exam.name },
    exam,
    ranking,
    promotionResult: { passed: false, severeCheat: true }
  });

  assert.equal(result.currentHonor, null);
  assert.deepEqual(buildExamHonorView(worldState).honors, []);
});

test("palace ranking decorates top three, transmission reader, and class order", () => {
  const exam = getExam("palace_exam");
  const ranking = decorateExamRanking({
    exam,
    ranking: [
      entry("player", 1, 82, "二甲", true),
      entry("candidate-2", 2, 81, "二甲"),
      entry("candidate-3", 3, 80, "二甲"),
      entry("candidate-4", 4, 79, "二甲"),
      entry("candidate-5", 5, 78, "二甲"),
      entry("candidate-6", 6, 77, "二甲"),
      entry("candidate-7", 7, 76, "二甲")
    ]
  });
  const canonicalScore = applyCanonicalScoreRank({ overall_score: 82, rank: "二甲" }, exam, ranking);

  assert.equal(ranking[0].honorTitle, "状元");
  assert.equal(ranking[1].honorTitle, "榜眼");
  assert.equal(ranking[2].honorTitle, "探花");
  assert.equal(ranking[3].honorTitle, "传胪");
  assert.equal(ranking[4].rankLabel, "二甲第2名");
  assert.equal(ranking[6].rankLabel, "三甲第1名");
  assert.equal(canonicalScore.rank, "一甲");
});

test("triple first achievement derives only from existing canonical honor ledger", () => {
  const worldState = createInitialState({ playerName: "三元测试" });
  const levels = [
    ["provincial_exam", "解元", "举人"],
    ["metropolitan_exam", "会元", "贡士"],
    ["palace_exam", "状元", "一甲进士及第"]
  ];
  let lastResult = null;

  for (const [level, expectedTitle, promotionRank] of levels) {
    const exam = getExam(level);
    const ranking = decorateExamRanking({
      exam,
      ranking: [entry("player", 1, 98, level === "palace_exam" ? "一甲" : "一等", true)]
    });
    lastResult = resolveExamHonors({
      worldState,
      activeExam: { level, examName: exam.name },
      exam,
      ranking,
      promotionResult: { passed: true, rank: promotionRank }
    });
    assert.equal(lastResult.currentHonor.title, expectedTitle);
  }

  const snapshot = buildExamHonorSnapshot(lastResult);
  const promptSummary = summarizeExamHonorsForPrompt(worldState);

  assert.equal(lastResult.currentAchievement.title, "三元及第");
  assert.equal(snapshot.currentAchievement.title, "三元及第");
  assert.equal(promptSummary.currentAchievement.title, "三元及第");
  assert.ok(promptSummary.honors.length <= 5);
});
