const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServerWithProvider(provider) {
  const aiPath = require.resolve("../src/ai");
  const gameRoutePath = require.resolve("../src/routes/game");
  const originalAiModule = require.cache[aiPath];
  const originalGameRouteModule = require.cache[gameRoutePath];

  delete require.cache[gameRoutePath];
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: {
      getProvider: () => provider
    }
  };

  const gameRoutes = require("../src/routes/game");
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);

  const testServer = createFetchSafeServer(app);

  async function close() {
    await testServer.close();

    delete require.cache[gameRoutePath];
    if (originalGameRouteModule) {
      require.cache[gameRoutePath] = originalGameRouteModule;
    }

    if (originalAiModule) {
      require.cache[aiPath] = originalAiModule;
    } else {
      delete require.cache[aiPath];
    }
  }

  return {
    baseUrl: testServer.baseUrl,
    close
  };
}

function createProviderWithTrigger(examTrigger) {
  return {
    async runTurn() {
      return {
        narrative: "The exam request was considered.",
        statePatch: {},
        attributeChanges: [],
        relationshipChanges: [],
        events: [],
        examTrigger
      };
    }
  };
}

async function postTurn(baseUrl, sessionId, input = "request exam") {
  const response = await fetch(`${baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, input })
  });
  return {
    response,
    payload: await response.json()
  };
}

test("POST /api/game/turn rejects illegal examTrigger level skips", async (t) => {
  const server = createTestServerWithProvider(createProviderWithTrigger({
    shouldStart: true,
    level: "palace_exam",
    reason: "provider tried to skip ranks"
  }));
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.month = 4;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postTurn(server.baseUrl, worldState.sessionId);

  assert.equal(response.status, 200);
  assert.equal(payload.examTrigger.shouldStart, false);
  assert.equal(payload.examTrigger.level, "palace_exam");
  assert.match(payload.examTrigger.reason, /当前应参加童试/);
  assert.equal(payload.worldState.activeExam, null);
});

test("POST /api/game/turn rejects closed calendar examTrigger requests", async (t) => {
  const server = createTestServerWithProvider(createProviderWithTrigger({
    shouldStart: true,
    level: "child_exam",
    reason: "provider tried a closed month"
  }));
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.year = 1644;
  worldState.month = 3;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postTurn(server.baseUrl, worldState.sessionId);

  assert.equal(response.status, 200);
  assert.equal(payload.examTrigger.shouldStart, false);
  assert.equal(payload.examTrigger.level, "child_exam");
  assert.match(payload.examTrigger.reason, /本期已过|尚未开场/);
  assert.equal(payload.worldState.activeExam, null);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.activeExam, null);
});

test("POST /api/game/turn ignores null examTrigger levels", async (t) => {
  const server = createTestServerWithProvider(createProviderWithTrigger({
    shouldStart: true,
    level: null,
    reason: "provider omitted the level"
  }));
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.month = 1;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postTurn(server.baseUrl, worldState.sessionId);

  assert.equal(response.status, 200);
  assert.equal(payload.examTrigger.shouldStart, false);
  assert.equal(payload.examTrigger.level, null);
  assert.match(payload.examTrigger.reason, /未知考试等级/);
  assert.equal(payload.worldState.activeExam, null);
});

test("POST /api/game/turn treats active writing exams as local scene actions", async (t) => {
  const server = createTestServerWithProvider(createProviderWithTrigger({
    shouldStart: true,
    level: "child_exam",
    reason: "provider tried to replace writing state"
  }));
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester", role: "scholar" });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 3;
  worldState.activeExam = {
    examId: "child_exam-existing",
    level: "child_exam",
    examName: "童试",
    examQuestion: "试论修身为学之义。",
    questionType: "经义简答",
    status: "writing",
    reason: "server-created question"
  };
  const originalActiveExam = JSON.parse(JSON.stringify(worldState.activeExam));
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postTurn(server.baseUrl, worldState.sessionId);

  assert.equal(response.status, 200);
  assert.equal(payload.examTrigger.shouldStart, false);
  assert.match(payload.examTrigger.reason, /考试场景|局部阶段/);
  assert.equal(payload.worldTick.cadence, "scene");
  assert.equal(payload.worldTick.completedMonth, false);
  assert.equal(payload.worldState.turnCount, 0);
  assert.equal(payload.worldState.year, 1644);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 3);
  assert.equal(payload.worldState.activeExam.examId, originalActiveExam.examId);
  assert.equal(payload.worldState.activeExam.examQuestion, originalActiveExam.examQuestion);
  assert.equal(payload.worldState.activeExam.sceneTime.phase, "outline");
  assert.equal(payload.worldState.activeExam.sceneTime.startedAt.tenDayPeriod, 3);

  const saved = await readSession(worldState.sessionId);
  assert.equal(saved.activeExam.examId, originalActiveExam.examId);
  assert.equal(saved.activeExam.examQuestion, originalActiveExam.examQuestion);
  assert.equal(saved.activeExam.sceneTime.phase, "outline");
  assert.equal(saved.tenDayPeriod, 3);
});
