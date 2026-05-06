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

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/exam", examRoutes);

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
  worldState.month = 6;
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
  assert.equal(payload.worldState.month, 6);
  assert.equal(payload.entryPreparation.fullyFunded, true);
  assert.equal(payload.entryPreparation.requiredGold, 2);
  assert.equal(payload.entryPreparation.paidGold, 2);
  assert.equal(payload.worldState.player.gold, 48);
  assert.deepEqual(payload.worldState.activeExam.entryPreparation, payload.entryPreparation);

  const saved = await readSession(worldState.sessionId);
  assert.deepEqual(saved.activeExam.entryPreparation, payload.entryPreparation);
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
  assert.equal(submit.payload.worldState.activeExam, null);
  const historyEntry = submit.payload.worldState.player.examHistory.at(-1);
  assert.deepEqual(historyEntry.entryPreparation, question.payload.entryPreparation);
  assert.equal(historyEntry.entryPreparation.requiredGold, 2);
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
  assert.equal(latest.month, 4);
  assert.ok(latest.player.examHistory.every((entry) => entry.entryPreparation));
});
