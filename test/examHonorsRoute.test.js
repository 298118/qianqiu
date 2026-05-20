const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { getExam, getExamRequirements } = require("../src/game/exams");
const { initializeExamProcedure } = require("../src/game/examProcedure");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const aiPath = require.resolve("../src/ai");
const examRoutePath = require.resolve("../src/routes/exam");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServerWithProvider(provider) {
  const originalAiModule = require.cache[aiPath];
  const originalExamRouteModule = require.cache[examRoutePath];

  delete require.cache[examRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const app = express();
  app.use(express.json());
  app.use("/api/exam", require("../src/routes/exam"));
  const testServer = createFetchSafeServer(app);

  async function close() {
    await testServer.close();
    delete require.cache[examRoutePath];
    if (originalExamRouteModule) require.cache[examRoutePath] = originalExamRouteModule;
    if (originalAiModule) require.cache[aiPath] = originalAiModule;
    else delete require.cache[aiPath];
  }

  return {
    baseUrl: testServer.baseUrl,
    close
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function scoreDimension(score = 100) {
  return { score, comment: "文气充足。" };
}

function gradePayload(overall = 100, overrides = {}) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: "一等",
      detailed_feedback: "模型评分只作输入，服务器另行定榜。"
    },
    authenticity_check: {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    },
    virtual_candidates: [],
    ranking: [],
    ...overrides
  };
}

function createWritingExam(level = "provincial_exam") {
  const exam = getExam(level);
  const activeExam = {
    examId: `${level}-honor-route`,
    level: exam.level,
    examName: exam.name,
    examQuestion: "试论理财安民与州县教化之要。",
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank,
    status: "writing",
    reason: "honor route prepared exam"
  };
  initializeExamProcedure(activeExam);
  return activeExam;
}

test("exam submit returns server-owned examHonorView and ignores provider ranking honors", async (t) => {
  const provider = {
    async gradeExamEssay() {
      return gradePayload(100, {
        examiner_reviews: [{
          actor: "chief_examiner",
          recommendation: "模型钦点状元",
          suggestedScoreDelta: 2,
          comment: "模型试图定状元，但只能作建议。"
        }],
        ranking: [{ id: "provider-crowned", name: "模型钦点", place: 1, title: "状元" }],
        virtual_candidates: [{ id: "provider-crowned", name: "模型钦点", score: 100 }]
      });
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "荣誉路线", role: "scholar" });
  worldState.player.examRank = "秀才";
  worldState.player.academia = 60;
  worldState.player.literaryTalent = 60;
  worldState.player.mentality = 60;
  worldState.player.reputation = 30;
  worldState.studyProfile.dimensions.examEndurance = 100;
  worldState.studyProfile.dimensions.calligraphyCopying = 100;
  worldState.studyProfile.dimensions.eightLeggedForm = 100;
  worldState.studyProfile.dimensions.policyInsight = 100;
  worldState.activeExam = createWritingExam("provincial_exam");
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const essay = Array.from({ length: 14 }, () =>
    "州县理财，当先宽民力，清簿书，谨仓储，使农桑有时而赋役有经。"
  ).join("");
  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay
  });
  const saved = await readSession(worldState.sessionId);
  const serialized = JSON.stringify({
    ranking: payload.ranking,
    history: saved.player.examHistory,
    examHonorView: payload.examHonorView
  });

  assert.equal(response.status, 200);
  assert.equal(payload.examHonorView.latestHonor.title, "解元");
  assert.equal(payload.examAftermathView.honorTitle, "解元");
  assert.equal(payload.examAftermathView.sameYearCount > 0, true);
  assert.ok(payload.examAftermathView.examinerContacts.some((contact) => contact.relationKind === "seat_teacher"));
  assert.ok(payload.examAftermathView.nextActions.some((action) => /座师|同年|会试/.test(action)));
  assert.equal(payload.examHonorView.honors.at(-1).rankLabel, "乡试第一名");
  assert.equal(payload.worldState.examHonorLedger.honors.at(-1).title, "解元");
  assert.equal(saved.player.examHistory.at(-1).examHonor.currentHonor.title, "解元");
  assert.equal(saved.player.examHistory.at(-1).examAftermath.honorTitle, "解元");
  assert.equal(saved.player.examHistory.at(-1).examNetwork.sameYearContacts.length > 0, true);
  assert.ok(saved.player.examHistory.at(-1).examNetwork.examinerContacts.some((contact) =>
    contact.relationKind === "seat_teacher"
  ));
  assert.ok(payload.relationshipView.contacts.some((contact) =>
    contact.id === "exam-seat-provincial" &&
    contact.networkSource === "乡试主考取中"
  ));
  assert.ok(payload.worldPeopleView.npcs.some((npc) => npc.id === "exam-seat-provincial"));
  assert.ok(payload.eventArchiveView.items.some((item) => item.sourceType === "exam_network"));
  assert.equal(payload.ranking.find((entry) => entry.isPlayer).honorTitle, "解元");
  assert.doesNotMatch(serialized, /provider-crowned/);
  assert.doesNotMatch(JSON.stringify(payload.examHonorView), /状元/);
  assert.doesNotMatch(JSON.stringify(payload.examAftermathView), /provider-crowned|raw provider|hiddenNotes|OPENAI_API_KEY|data\/sessions|\/mnt\//);
});
