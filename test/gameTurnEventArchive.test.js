const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const examRoutes = require("../src/routes/exam");
const { getExam, getExamRequirements } = require("../src/game/exams");
const { attachExamSceneTime } = require("../src/game/examSceneTime");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const auditDir = path.join(__dirname, "..", "data", "audit");

async function removeSessionArtifacts(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.event-log.jsonl`), { force: true });
  await fs.rm(path.join(auditDir, `${sessionId}.ai-proposals.jsonl`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use("/api/exam", examRoutes);
  return createFetchSafeServer(app);
}

async function postJson(url, body, headers = { "Content-Type": "application/json" }) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function parseSse(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      return {
        event: eventLine ? eventLine.slice(6).trim() : "message",
        data: data ? JSON.parse(data) : null
      };
    });
}

function createWritingExam(worldState, level = "child_exam") {
  const exam = getExam(level);
  const activeExam = {
    examId: `${level}-event-archive-route`,
    level: exam.level,
    examName: exam.name,
    examQuestion: "试论读书明理与县学风教之关系。",
    questionType: exam.questionType,
    difficulty: exam.difficulty,
    requirements: getExamRequirements(exam),
    wordCount: exam.wordCount,
    passScore: exam.passScore,
    promotionRank: exam.promotionRank,
    readiness: { label: "测试可交卷" },
    status: "writing",
    generatedAt: new Date().toISOString()
  };
  attachExamSceneTime(activeExam, worldState, "question_review");
  return activeExam;
}

test("game routes expose sanitized event archive view without audit or provider leakage", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const start = await postJson(`${server.baseUrl}/api/game/start`, {
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "事件书生"
  });
  t.after(() => removeSessionArtifacts(start.payload.sessionId));

  assert.equal(start.response.status, 201);
  assert.equal(start.payload.eventArchiveView.schemaVersion, 1);
  assert.ok(start.payload.eventArchiveView.items.some((item) => item.sourceType === "event_history"));

  const stateResponse = await fetch(`${server.baseUrl}/api/game/state/${start.payload.sessionId}`);
  const statePayload = await stateResponse.json();
  assert.equal(stateResponse.status, 200);
  assert.equal(statePayload.eventArchiveView.schemaVersion, 1);

  const turn = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: start.payload.sessionId,
    input: "勤读经义，顺便查问秋粮"
  });
  const serialized = JSON.stringify(turn.payload.eventArchiveView);
  assert.equal(turn.response.status, 200);
  assert.equal(turn.payload.eventArchiveView.schemaVersion, 1);
  assert.ok(turn.payload.eventArchiveView.items.length >= start.payload.eventArchiveView.items.length);
  assert.equal(serialized.includes("provider"), false);
  assert.equal(serialized.includes("proposal"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("statePatch"), false);
  assert.equal(serialized.includes("data/sessions"), false);
  assert.equal(serialized.includes("data/audit"), false);

  const pagedStateResponse = await fetch(`${server.baseUrl}/api/game/state/${start.payload.sessionId}?eventArchivePage=1&eventArchivePageSize=2`);
  const pagedState = await pagedStateResponse.json();
  assert.equal(pagedStateResponse.status, 200);
  assert.equal(pagedState.eventArchiveView.pagination.pageSize, 2);
  assert.ok(pagedState.eventArchiveView.items.length <= 2);
  assert.equal(pagedState.eventArchiveView.counts.total, pagedState.eventArchiveView.pagination.totalItems);
  assert.equal(pagedState.eventArchiveView.pageCounts.total, pagedState.eventArchiveView.items.length);

  const sseResponse = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: start.payload.sessionId,
      input: "再读一卷，记下近日风声"
    })
  });
  const events = parseSse(await sseResponse.text());
  const preview = events.find((event) => event.event === "state_preview" && event.data?.eventArchiveView);
  const final = events.find((event) => event.event === "final_state");

  assert.equal(sseResponse.status, 200);
  assert.ok(preview);
  assert.equal(preview.data.eventArchiveView.schemaVersion, 1);
  assert.equal(final.data.eventArchiveView.schemaVersion, 1);
});

test("exam routes expose event archive view through question, progress, and submit", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "归档考生", role: "scholar" });
  worldState.activeExam = createWritingExam(worldState, "child_exam");
  worldState.eventHistory.push("归档考生入场取题。");
  t.after(() => removeSessionArtifacts(worldState.sessionId));
  await writeSession(worldState);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId,
    level: "child_exam"
  });
  assert.equal(question.response.status, 200);
  assert.equal(question.payload.eventArchiveView.schemaVersion, 1);

  const progress = await postJson(`${server.baseUrl}/api/exam/progress`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    action: "先拟大纲，分条论述"
  });
  assert.equal(progress.response.status, 200);
  assert.equal(progress.payload.eventArchiveView.schemaVersion, 1);

  const essay = Array.from({ length: 8 }, () =>
    "县学之兴在敦本务实，士子读书当明礼义，亦当知仓储、水利、听讼与养民之要。"
  ).join("");
  const submit = await postJson(`${server.baseUrl}/api/exam/submit`, {
    sessionId: worldState.sessionId,
    examId: worldState.activeExam.examId,
    essay
  });
  const archive = submit.payload.eventArchiveView;

  assert.equal(submit.response.status, 200);
  assert.equal(archive.schemaVersion, 1);
  assert.ok(archive.items.some((item) => item.sourceType === "exam_record" && item.status === "submitted"));
  assert.equal(JSON.stringify(archive).includes("prompt"), false);
  assert.equal(JSON.stringify(archive).includes("provider"), false);
});
