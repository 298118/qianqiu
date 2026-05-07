const test = require("node:test");
const assert = require("node:assert/strict");

const { EXAMS } = require("../src/game/exams");
const {
  buildExamCalendarView,
  buildExamRivalView,
  canOpenExamInCalendar,
  createInitialExamCalendar,
  ensureExamCalendarState,
  preparePersistentExamCohort,
  recordExamCohortResult,
  recordMissedExamWindow,
  selectPersistentCandidateSeeds
} = require("../src/game/examCalendar");
const { buildRanking, generateVirtualCandidates } = require("../src/game/candidates");
const { createInitialState } = require("../src/game/initialState");

function makePlayerEntry(worldState, score = 76) {
  return {
    id: "player",
    name: worldState.player.name,
    origin: worldState.dynasty,
    background: "test player",
    score: {
      overall_score: score,
      rank: "取中"
    },
    isPlayer: true
  };
}

test("exam calendar view exposes next exam windows, funding, travel, and recommendation state", () => {
  const worldState = createInitialState({ playerName: "Calendar Tester" });
  worldState.month = 1;
  worldState.tenDayPeriod = 2;
  worldState.player.gold = 1;

  const view = buildExamCalendarView(worldState);

  assert.equal(view.currentTenDayPeriod, 2);
  assert.equal(view.currentDateLabel, "明1644年正月中旬");
  assert.equal(view.nextExam.level, "child_exam");
  assert.equal(view.nextExam.isOpen, true);
  assert.equal(view.nextExam.currentTenDayPeriod, 2);
  assert.equal(view.nextExam.currentDateLabel, "明1644年正月中旬");
  assert.equal(view.nextExam.monthsUntil, 0);
  assert.equal(view.nextExam.preparationMonths, 1);
  assert.equal(view.nextExam.travelMonths, 0);
  assert.equal(view.nextExam.funding.requiredGold, 2);
  assert.equal(view.nextExam.funding.shortfall, 1);
  assert.equal(view.nextExam.teacherRecommendation.ready, true);
});

test("calendar gate distinguishes early and missed exam windows", () => {
  const worldState = createInitialState({ playerName: "Window Tester" });
  worldState.player.examRank = EXAMS.child_exam.promotionRank;
  worldState.month = 7;

  const earlyGate = canOpenExamInCalendar(worldState, EXAMS.provincial_exam);
  assert.equal(earlyGate.ok, false);
  assert.equal(earlyGate.snapshot.status, "early");
  assert.equal(earlyGate.snapshot.nextWindowMonth, 8);

  worldState.month = 10;
  const missedGate = canOpenExamInCalendar(worldState, EXAMS.provincial_exam);
  assert.equal(missedGate.ok, false);
  assert.equal(missedGate.snapshot.status, "missed");

  const missed = recordMissedExamWindow(worldState, EXAMS.provincial_exam, missedGate.snapshot, missedGate.reason);
  assert.ok(missed);
  assert.equal(worldState.examCalendar.missedWindows.length, 1);
  assert.equal(worldState.examCalendar.missedWindows[0].nextWindowMonth, 8);
});

test("persistent exam rivals survive across later exam cohorts", () => {
  const worldState = createInitialState({ playerName: "Rival Tester" });
  worldState.examCalendar = createInitialExamCalendar();
  worldState.month = 1;

  const childCandidates = preparePersistentExamCohort(
    worldState,
    EXAMS.child_exam,
    generateVirtualCandidates(worldState, EXAMS.child_exam, 78)
  );
  const childRanking = buildRanking(makePlayerEntry(worldState, 78), childCandidates);
  recordExamCohortResult(worldState, EXAMS.child_exam, childCandidates, childRanking);

  assert.ok(worldState.examCalendar.rivals.length >= 4);
  assert.ok(childCandidates.every((candidate) => candidate.persistent));

  worldState.player.examRank = EXAMS.child_exam.promotionRank;
  worldState.month = 8;
  const seeds = selectPersistentCandidateSeeds(worldState, EXAMS.provincial_exam);
  assert.ok(seeds.length > 0);
  assert.equal(seeds[0].id.startsWith("rival-"), true);

  const provincialCandidates = generateVirtualCandidates(worldState, EXAMS.provincial_exam, 80, {
    persistentCandidates: seeds
  });
  assert.equal(provincialCandidates[0].id, seeds[0].id);
  assert.equal(provincialCandidates[0].name, seeds[0].name);
});

test("palace-exam peers can become official relationship contacts", () => {
  const worldState = createInitialState({ playerName: "Peer Tester", role: "official" });
  ensureExamCalendarState(worldState);
  worldState.month = 4;

  const candidates = preparePersistentExamCohort(
    worldState,
    EXAMS.palace_exam,
    generateVirtualCandidates(worldState, EXAMS.palace_exam, 82).slice(0, 4)
  );
  candidates[0].score.overall_score = 95;
  const ranking = buildRanking(makePlayerEntry(worldState, 82), candidates);
  recordExamCohortResult(worldState, EXAMS.palace_exam, candidates, ranking);

  const rivalView = buildExamRivalView(worldState);
  const peer = rivalView.rivals.find((rival) => rival.relationship === "official_peer");
  assert.ok(peer);
  assert.ok(peer.contactId);
  assert.ok(worldState.characters.some((character) => character.id === peer.contactId));
});
