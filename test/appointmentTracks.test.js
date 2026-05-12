const test = require("node:test");
const assert = require("node:assert/strict");

const { getExam } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { applyExamPromotion } = require("../src/game/promotions");
const {
  applyCanonicalScoreRank,
  buildExamHonorSnapshot,
  decorateExamRanking,
  resolveExamHonors
} = require("../src/game/examHonors");
const { resolveExamNetwork } = require("../src/game/examNetworks");
const {
  buildAppointmentTrackView,
  ensureAppointmentTrackState,
  resolveInitialAppointmentTrack,
  summarizeAppointmentTrackForPrompt
} = require("../src/game/appointmentTracks");

function rankingEntry(place, isPlayer = false) {
  return {
    id: isPlayer ? "player" : `candidate-${place}`,
    name: isPlayer ? "授官测试" : `同年${place}`,
    origin: place % 2 === 0 ? "应天府" : "苏州府",
    background: "同场士子",
    score: 100 - place,
    rank: "取中",
    place,
    isPlayer
  };
}

function palaceRanking(playerPlace) {
  return decorateExamRanking({
    exam: getExam("palace_exam"),
    ranking: Array.from({ length: 8 }, (_, index) => {
      const place = index + 1;
      return rankingEntry(place, place === playerPlace);
    })
  });
}

function resolvePalaceAppointment(playerPlace, options = {}) {
  const worldState = createInitialState({ playerName: "授官测试", role: "scholar" });
  Object.assign(worldState.player, {
    examRank: "贡士",
    reputation: options.reputation ?? 70,
    nativePlace: options.nativePlace
  });
  const exam = getExam("palace_exam");
  const activeExam = {
    examId: `palace-appointment-${playerPlace}`,
    level: exam.level,
    examName: exam.name
  };
  const ranking = palaceRanking(playerPlace);
  const score = applyCanonicalScoreRank({
    overall_score: 98,
    rank: "二甲"
  }, exam, ranking);
  const promotionResult = applyExamPromotion(worldState, exam, score, {
    flags: [],
    copy_detection: { is_copy: false }
  }, { ranking });
  const honorResult = resolveExamHonors({
    worldState,
    activeExam,
    exam,
    ranking,
    promotionResult
  });
  const examHonor = buildExamHonorSnapshot(honorResult);
  const examNetwork = resolveExamNetwork({
    worldState,
    activeExam,
    exam,
    ranking,
    promotionResult,
    examHonor
  });
  const appointmentTrack = resolveInitialAppointmentTrack({
    worldState,
    activeExam,
    exam,
    ranking,
    promotionResult,
    examHonor,
    examNetwork
  });
  return {
    worldState,
    promotionResult,
    appointmentTrack,
    view: buildAppointmentTrackView(worldState),
    promptSummary: summarizeAppointmentTrackForPrompt(worldState)
  };
}

test("palace top-three appointment resolver distinguishes one-jia Hanlin posts", () => {
  const secondPlace = resolvePalaceAppointment(2);

  assert.equal(secondPlace.appointmentTrack.palaceRank, "一甲");
  assert.equal(secondPlace.appointmentTrack.serverDecision.trackKey, "top_hanlin_editor");
  assert.equal(secondPlace.worldState.player.officeTitle, "翰林院编修");
  assert.equal(secondPlace.promotionResult.officeTitle, "翰林院编修");
  assert.equal(secondPlace.worldState.officialCareer.currentPosting, "翰林院编修");
  assert.equal(secondPlace.worldState.officialCareer.careerHistory.at(-1).label, "初授");
  assert.equal(secondPlace.view.latestDecision.officeTitle, "翰林院编修");
});

test("second class front rank enters shujishi track with server-owned view", () => {
  const result = resolvePalaceAppointment(4);

  assert.equal(result.appointmentTrack.palaceRank, "二甲");
  assert.equal(result.appointmentTrack.classPlace, 1);
  assert.equal(result.appointmentTrack.serverDecision.trackKey, "second_shujishi");
  assert.equal(result.worldState.player.officeTitle, "翰林院庶吉士");
  assert.match(result.view.publicSummary, /庶吉士|馆选/);
  assert.match(result.promptSummary.authorityBoundary, /officeTitle/);
});

test("third class uses vacancy pool and native-place avoidance before appointment", () => {
  const noAvoidance = resolvePalaceAppointment(7);
  assert.equal(noAvoidance.appointmentTrack.palaceRank, "三甲");
  assert.equal(noAvoidance.appointmentTrack.serverDecision.trackKey, "outpost_appointee");
  assert.equal(noAvoidance.worldState.player.officeTitle, "知县");

  const avoided = resolvePalaceAppointment(7, { nativePlace: "苏州府" });
  assert.ok(avoided.appointmentTrack.avoidanceChecks.some((check) =>
    check.status === "blocked" &&
    check.officeTitle === "知县"
  ));
  assert.equal(avoided.appointmentTrack.serverDecision.trackKey, "ministry_appointee");
  assert.equal(avoided.worldState.player.officeTitle, "户部主事");
});

test("appointment track normalization redacts unsafe public text and ignores failed exams", () => {
  const failed = createInitialState({ playerName: "黜落测试", role: "scholar" });
  const exam = getExam("palace_exam");
  const skipped = resolveInitialAppointmentTrack({
    worldState: failed,
    activeExam: { examId: "failed", level: exam.level, examName: exam.name },
    exam,
    ranking: palaceRanking(1),
    promotionResult: { passed: false, severeCheat: true }
  });
  assert.equal(skipped, null);

  failed.appointmentTrack = {
    records: [{
      id: "unsafe",
      level: "palace_exam",
      examName: "殿试",
      publicSummary: "hiddenNotes: 某考官私意推升，OPENAI_API_KEY sk-secret-token data\\sessions\\unsafe.json",
      serverDecision: {
        officeTitle: "翰林院修撰",
        trackLabel: "一甲翰林修撰",
        publicSummary: "prompt: 请公开密札授官理由"
      }
    }]
  };
  ensureAppointmentTrackState(failed);
  const serialized = JSON.stringify({
    view: buildAppointmentTrackView(failed),
    promptSummary: summarizeAppointmentTrackForPrompt(failed)
  });
  assert.doesNotMatch(serialized, /hiddenNotes|某考官私意|OPENAI_API_KEY|sk-secret-token|data\\sessions|请公开密札|密札授官/);
});
