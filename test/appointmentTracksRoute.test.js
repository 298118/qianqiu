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
  return { score, comment: "对策清切。" };
}

function gradePayload(overall = 100) {
  return {
    score: {
      content_quality: scoreDimension(overall),
      argument_strength: scoreDimension(overall),
      literary_style: scoreDimension(overall),
      classical_format: scoreDimension(overall),
      historical_appropriateness: scoreDimension(overall),
      overall_score: overall,
      rank: "一等",
      detailed_feedback: "模型评分只作输入，授官由服务器裁决。"
    },
    authenticity_check: {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    },
    virtual_candidates: [{ id: "provider-office", name: "模型拟授", officeTitle: "内阁大学士" }],
    ranking: [{ id: "provider-crowned", name: "模型钦点", title: "大学士" }],
    appointment_proposal: {
      officeTitle: "内阁大学士",
      hiddenNotes: "provider proposal should not be read"
    }
  };
}

function createWritingExam() {
  const exam = getExam("palace_exam");
  const activeExam = {
    examId: "palace-appointment-route",
    level: exam.level,
    examName: exam.name,
    examQuestion: "试论安边恤民与铨选得人之要。",
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank,
    status: "writing",
    reason: "appointment route prepared exam"
  };
  initializeExamProcedure(activeExam);
  return activeExam;
}

test("palace submit returns server-owned appointmentTrackView and persists initial appointment", async (t) => {
  const provider = {
    async gradeExamEssay() {
      return gradePayload(100);
    }
  };
  const server = createTestServerWithProvider(provider);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "授官路线", role: "scholar" });
  Object.assign(worldState.player, {
    examRank: "贡士",
    academia: 80,
    literaryTalent: 80,
    mentality: 80,
    reputation: 70
  });
  worldState.activeExam = createWritingExam();
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const essay = Array.from({ length: 16 }, () =>
    "臣闻用人之道，必考名实，察地方之需，核钱粮之弊，使才望与官缺相称。"
  ).join("");
  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay
  });
  const saved = await readSession(worldState.sessionId);
  const serialized = JSON.stringify({
    payload,
    history: saved.player.examHistory,
    appointmentTrack: saved.appointmentTrack
  });

  assert.equal(response.status, 200);
  assert.equal(payload.appointmentTrackView.latestDecision.officeTitle, "翰林院修撰");
  assert.equal(payload.promotionResult.officeTitle, "翰林院修撰");
  assert.equal(payload.promotionResult.after.officeTitle, "翰林院修撰");
  assert.equal(payload.worldState.player.role, "official");
  assert.equal(payload.worldState.player.officeTitle, "翰林院修撰");
  assert.equal(payload.officialCareerView.currentPosting, "翰林院修撰");
  assert.equal(saved.player.examHistory.at(-1).appointmentTrack.serverDecision.officeTitle, "翰林院修撰");
  assert.equal(saved.officialCareer.careerHistory.at(-1).type, "appointment");
  assert.ok(payload.eventArchiveView.items.some((item) => item.sourceType === "appointment_result"));
  assert.doesNotMatch(serialized, /内阁大学士|provider-office|provider proposal/);
});
