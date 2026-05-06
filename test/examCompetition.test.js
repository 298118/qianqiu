const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRanking, generateVirtualCandidates } = require("../src/game/candidates");
const { EXAMS } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");

function assertCandidateProfile(candidate) {
  assert.equal(typeof candidate.id, "string");
  assert.equal(typeof candidate.name, "string");
  assert.equal(typeof candidate.origin, "string");
  assert.equal(typeof candidate.background, "string");
  assert.equal(typeof candidate.style, "string");
  assert.notEqual(candidate.style.trim(), "");
  assert.equal(typeof candidate.examinerComment, "string");
  assert.notEqual(candidate.examinerComment.trim(), "");
  assert.ok(Array.isArray(candidate.strengths));
  assert.ok(candidate.strengths.length > 0);
  assert.ok(Array.isArray(candidate.weaknesses));
  assert.ok(candidate.weaknesses.length > 0);

  assert.equal(typeof candidate.essay.title, "string");
  assert.notEqual(candidate.essay.title.trim(), "");
  assert.equal(typeof candidate.essay.body, "string");
  assert.notEqual(candidate.essay.body.trim(), "");
  assert.equal(typeof candidate.essay.excerpt, "string");
  assert.notEqual(candidate.essay.excerpt.trim(), "");
  assert.ok(candidate.essay.wordCount > 0);
}

test("virtual candidates keep count and score boundaries while adding inspectable profiles", () => {
  const worldState = createInitialState({ role: "scholar" });
  const candidates = generateVirtualCandidates(worldState, EXAMS.provincial_exam, 72);

  assert.ok(candidates.length >= 4);
  assert.ok(candidates.length <= 8);

  for (const candidate of candidates) {
    assert.ok(candidate.score.overall_score >= 0);
    assert.ok(candidate.score.overall_score <= 100);
    assertCandidateProfile(candidate);
  }
});

test("candidate essays vary by exam level and style", () => {
  const worldState = createInitialState({ role: "scholar" });
  const childCandidate = generateVirtualCandidates(worldState, EXAMS.child_exam, 72)[0];
  const palaceCandidate = generateVirtualCandidates(worldState, EXAMS.palace_exam, 72)[0];
  const sameField = generateVirtualCandidates(worldState, EXAMS.metropolitan_exam, 72);

  assert.match(childCandidate.essay.title, /童试经义/);
  assert.match(palaceCandidate.essay.title, /殿试对策/);
  assert.notEqual(childCandidate.essay.body, palaceCandidate.essay.body);
  assert.notEqual(sameField[0].style, sameField[1].style);
  assert.notEqual(sameField[0].essay.body, sameField[1].essay.body);
});

test("ranking remains score sorted, favors player ties, and carries candidate summaries", () => {
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
        score: { overall_score: 80, rank: "pass" },
        style: "策论明快",
        essay: {
          title: "乡试策论：理财安民",
          body: "此卷条陈分明，论财赋与民力。",
          excerpt: "此卷条陈分明",
          wordCount: 15
        },
        examinerComment: "大体切题。",
        strengths: ["议政切实"],
        weaknesses: ["辞采稍平"]
      },
      {
        id: "candidate-tie",
        name: "Tie",
        origin: "local",
        background: "manual",
        score: { overall_score: 70, rank: "pass" },
        style: "经义谨严",
        essay: {
          title: "童试经义：明伦修身",
          body: "此卷持论谨严。",
          excerpt: "此卷持论",
          wordCount: 8
        },
        examinerComment: "章法尚存。",
        strengths: ["义理稳实"],
        weaknesses: ["机锋略少"]
      }
    ]
  );

  assert.equal(ranking[0].id, "candidate-high");
  assert.equal(ranking[0].score, 80);
  assert.equal(ranking[0].style, "策论明快");
  assert.equal(ranking[0].essayTitle, "乡试策论：理财安民");
  assert.equal(ranking[0].essayExcerpt, "此卷条陈分明");
  assert.equal(ranking[0].examinerComment, "大体切题。");
  assert.deepEqual(ranking[0].strengths, ["议政切实"]);
  assert.deepEqual(ranking[0].weaknesses, ["辞采稍平"]);

  assert.equal(ranking[1].id, "player");
  assert.equal(ranking[1].place, 2);
  assert.equal(ranking[1].score, 70);
  assert.equal(ranking[1].style, null);
  assert.equal(ranking[2].id, "candidate-tie");
});
