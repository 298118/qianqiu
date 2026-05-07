const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const examRoutes = require("../src/routes/exam");
const { EXAMS } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const PASSING_ESSAY = "govern with rites, study the classics, preserve order, and care for the people. ".repeat(80);
const OPEN_MONTH_BY_LEVEL = {
  child_exam: 1,
  provincial_exam: 8,
  metropolitan_exam: 2,
  palace_exam: 4
};

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/exam", examRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return createFetchSafeServer(app);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  return { response, payload };
}

function makeReadyScholar(overrides = {}) {
  const worldState = createInitialState({ playerName: "Travel Tester" });
  Object.assign(worldState.player, {
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100,
    gold: 100000,
    ...overrides
  });
  return worldState;
}

async function completeExam(baseUrl, sessionId, level) {
  const current = await readSession(sessionId);
  current.month = OPEN_MONTH_BY_LEVEL[level];
  await writeSession(current);

  const question = await postJson(`${baseUrl}/api/exam/question`, { sessionId, level });
  assert.equal(question.response.status, 201);
  assert.ok(question.payload.entryPreparation);

  const submit = await postJson(`${baseUrl}/api/exam/submit`, {
    sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.payload.promotionResult.passed, true);
  assert.ok(submit.payload.worldState.player.examHistory.at(-1).entryPreparation);
  return submit.payload.worldState;
}

test("exam question entry applies funded travel cost without advancing time", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 50 });
  worldState.year = 1644;
  worldState.month = 7;
  worldState.turnCount = 7;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.turnCount, 7);
  assert.equal(payload.worldState.year, 1644);
  assert.equal(payload.worldState.month, 7);
  assert.equal(payload.sceneTime.phase, "question_review");
  assert.equal(payload.sceneTime.startedAt.year, 1644);
  assert.equal(payload.sceneTime.startedAt.month, 7);
  assert.equal(payload.sceneTime.startedAt.tenDayPeriod, 1);
  assert.equal(payload.entryPreparation.fullyFunded, true);
  assert.equal(payload.entryPreparation.requiredGold, 2);
  assert.equal(payload.entryPreparation.paidGold, 2);
  assert.equal(payload.worldState.player.gold, 48);
  assert.deepEqual(payload.worldState.activeExam.entryPreparation, payload.entryPreparation);

  const saved = await readSession(worldState.sessionId);
  assert.deepEqual(saved.activeExam.entryPreparation, payload.entryPreparation);
  assert.equal(saved.activeExam.sceneTime.phase, "question_review");
});

test("exam question allows shortfall and converts it into preparation risk", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({
    examRank: EXAMS.child_exam.promotionRank,
    gold: 1,
    health: 80,
    mentality: 80,
    adaptability: 80
  });
  worldState.month = 9;
  worldState.turnCount = 3;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 201);
  assert.equal(payload.entryPreparation.fullyFunded, false);
  assert.equal(payload.entryPreparation.requiredGold, 8);
  assert.equal(payload.entryPreparation.paidGold, 1);
  assert.equal(payload.entryPreparation.shortfall, 7);
  assert.equal(payload.worldState.player.gold, 0);
  assert.equal(payload.worldState.player.health, 77);
  assert.equal(payload.worldState.player.mentality, 76);
  assert.equal(payload.worldState.player.adaptability, 79);
  assert.equal(payload.worldState.turnCount, 3);
  assert.equal(payload.worldState.month, 9);
});

test("exam question outside a missed window records the calendar miss without charging travel", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({
    examRank: EXAMS.child_exam.promotionRank,
    gold: 30
  });
  worldState.month = 10;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "provincial_exam"
  });

  assert.equal(response.status, 409);
  assert.match(payload.error, /乡试/);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.player.gold, 30);
  assert.equal(saved.activeExam, null);
  assert.equal(saved.examCalendar.missedWindows.length, 1);
  assert.equal(saved.examCalendar.missedWindows[0].level, "provincial_exam");
});

test("exam progress advances only the local exam scene phase", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 20 });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 5;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 201);

  const progress = await postJson(`${server.baseUrl}/api/exam/progress`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    action: "拟纲定章法"
  });

  assert.equal(progress.response.status, 200);
  assert.equal(progress.payload.sceneTime.phase, "outline");
  assert.equal(progress.payload.examScene.phase, "outline");
  assert.equal(progress.payload.worldTick.cadence, "scene");
  assert.equal(progress.payload.worldTick.completedMonth, false);
  assert.equal(progress.payload.worldState.year, 1644);
  assert.equal(progress.payload.worldState.month, 1);
  assert.equal(progress.payload.worldState.tenDayPeriod, 3);
  assert.equal(progress.payload.worldState.turnCount, 5);
  assert.equal(progress.payload.worldState.activeExam.sceneTime.turnCount, 1);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.activeExam.sceneTime.phase, "outline");
  assert.equal(saved.tenDayPeriod, 3);
  assert.equal(saved.turnCount, 5);
});

test("exam submit preserves entry preparation in exam history", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 20 });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 201);

  const submit = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });

  assert.equal(submit.response.status, 200);
  assert.deepEqual(submit.payload.entryPreparation, question.payload.entryPreparation);
  assert.equal(submit.payload.examQuestion, question.payload.examQuestion);
  assert.equal(submit.payload.essay, PASSING_ESSAY.trim());
  assert.equal(submit.payload.sceneTime.phase, "submitted");
  assert.equal(submit.payload.examStartedAt.month, 1);
  assert.equal(submit.payload.examSubmittedAt.month, 1);
  assert.equal(submit.payload.worldState.activeExam, null);
  const historyEntry = submit.payload.worldState.player.examHistory.at(-1);
  assert.deepEqual(historyEntry.entryPreparation, question.payload.entryPreparation);
  assert.equal(historyEntry.entryPreparation.requiredGold, 2);
  assert.equal(historyEntry.sceneTime.phase, "submitted");
  assert.equal(historyEntry.examStartedAt.tenDayPeriod, 1);
  assert.equal(historyEntry.examSubmittedAt.tenDayPeriod, 1);
});

test("complete scholar to official path still works with entry preparation costs", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = makeReadyScholar({ gold: 100000 });
  worldState.year = 1644;
  worldState.month = 4;
  worldState.turnCount = 2;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  let latest = worldState;
  for (const level of ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"]) {
    latest = await completeExam(server.baseUrl, worldState.sessionId, level);
  }

  assert.equal(latest.player.role, "official");
  assert.equal(latest.player.examRank, EXAMS.palace_exam.promotionRank);
  assert.equal(latest.player.examHistory.length, 4);
  assert.equal(latest.turnCount, 2);
  assert.equal(latest.year, 1644);
  assert.equal(latest.month, OPEN_MONTH_BY_LEVEL.palace_exam);
  assert.ok(latest.player.examHistory.every((entry) => entry.entryPreparation));
  assert.ok(latest.player.examHistory.every((entry) => entry.sceneTime?.phase === "submitted"));
});
