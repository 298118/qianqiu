const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
  });
  return createFetchSafeServer(app);
}

async function removeSession(sessionId) {
  if (!sessionId) return;
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

test("S70.11 POST /api/game/turn advances study time skip as three ten-day ticks", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({ playerName: "跳时书生" });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 1;
  t.after(async () => {
    await removeSession(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "学习一月"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.timeSkip.executed, true);
  assert.equal(payload.timeSkip.interrupted, false);
  assert.equal(payload.timeSkip.completedTicks, 3);
  assert.equal(payload.timeSkip.ticks.length, 3);
  assert.equal(payload.worldState.turnCount, 3);
  assert.equal(payload.worldState.year, 1644);
  assert.equal(payload.worldState.month, 2);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.equal(payload.timeSkip.ticks.at(-1).completedMonth, true);
  assert.ok(payload.studyProfileView.recentExercises.some((entry) => entry.source === "player_action"));
  assert.ok(
    payload.aiInvocationSummaryView.recentInvocations
      .some((invocation) => invocation.taskType === "time_skip_planner")
  );
  assert.match(payload.narrative, /推进3\/3旬/);
});

test("S70.11 official routine time skip can cross month end and generate monthly briefing", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({
    playerName: "跳时官员",
    role: "official",
    dynasty: "明",
    year: 1644
  });
  worldState.month = 3;
  worldState.tenDayPeriod = 1;
  t.after(async () => {
    await removeSession(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "照旧处理一月"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.timeSkip.completedTicks, 3);
  assert.equal(payload.worldState.turnCount, 3);
  assert.equal(payload.worldState.month, 4);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.equal(payload.playerMonthlyBriefing.generated, true);
  assert.equal(payload.playerMonthlyBriefingView.latest.periodKey, "1644-03");
  assert.ok(
    payload.aiInvocationSummaryView.recentInvocations
      .some((invocation) => invocation.taskType === "monthly_briefing")
  );
});

test("S70.11 time skip stops when an exam window opens during the batch", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({ playerName: "跳时考生" });
  worldState.year = 1644;
  worldState.month = 7;
  worldState.tenDayPeriod = 3;
  worldState.player.examRank = "秀才";
  t.after(async () => {
    await removeSession(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "学习一月"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.timeSkip.executed, true);
  assert.equal(payload.timeSkip.interrupted, true);
  assert.equal(payload.timeSkip.interruption.type, "exam_window");
  assert.equal(payload.timeSkip.completedTicks, 1);
  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.month, 8);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.match(payload.timeSkip.nextTodo, /应考|赶考/);
});

test("S70.11 time skip is blocked when an active exam is pending question", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({ playerName: "跳时待取题" });
  worldState.year = 1644;
  worldState.month = 1;
  worldState.tenDayPeriod = 1;
  worldState.activeExam = {
    level: "child_exam",
    reason: "已报名待取题",
    requestedAt: new Date().toISOString(),
    sceneTime: {
      type: "exam",
      phase: "entry",
      phaseLabel: "入场"
    }
  };
  t.after(async () => {
    await removeSession(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "学习一月"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.timeSkip.executed, false);
  assert.equal(payload.timeSkip.blocked, true);
  assert.equal(payload.timeSkip.completedTicks, 0);
  assert.equal(payload.worldState.turnCount, 0);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.equal(payload.worldState.activeExam.level, "child_exam");
  assert.match(payload.timeSkip.nextTodo, /考试|待取题/);
});

test("S70.11 SSE preview and final payload include time skip summary", async (t) => {
  const server = createTestServer();
  const worldState = createInitialState({ playerName: "跳时流式" });
  worldState.year = 1644;
  worldState.month = 5;
  worldState.tenDayPeriod = 1;
  t.after(async () => {
    await removeSession(worldState.sessionId);
    await server.close();
  });
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn?stream=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "养病半月"
    })
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);

  const events = parseSse(await response.text());
  const preview = events.find((event) => event.event === "state_preview" && event.data?.timeSkip);
  const finalState = events.find((event) => event.event === "final_state");

  assert.ok(preview);
  assert.equal(preview.data.timeSkip.completedTicks, 2);
  assert.equal(preview.data.timeSkip.actionType, "convalesce");
  assert.ok(finalState);
  assert.equal(finalState.data.timeSkip.completedTicks, 2);
  assert.equal(finalState.data.worldState.turnCount, 2);
});
