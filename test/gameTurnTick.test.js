const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const examRoutes = require("../src/routes/exam");
const { createInitialState } = require("../src/game/initialState");
const { EXAMS } = require("../src/game/exams");
const { MAX_EVENT_HISTORY, NUMERIC_RANGES } = require("../src/game/stateRules");
const { readSession, writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const PASSING_ESSAY = "治民以德，修身齐家，明经达变，慎刑薄赋，安民养士。".repeat(70);

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
  app.use("/api/game", gameRoutes);
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

function assertRange(value, key) {
  const [min, max] = NUMERIC_RANGES[key];
  assert.ok(value >= min, `${key} should be >= ${min}`);
  assert.ok(value <= max, `${key} should be <= ${max}`);
}

async function completeExam(baseUrl, sessionId, level) {
  const worldState = await readSession(sessionId);
  worldState.month = OPEN_MONTH_BY_LEVEL[level];
  await writeSession(worldState);

  const question = await postJson(`${baseUrl}/api/exam/question`, { sessionId, level });
  assert.equal(question.response.status, 201);
  assert.equal(question.payload.level, level);

  const submit = await postJson(`${baseUrl}/api/exam/submit`, {
    sessionId,
    examId: question.payload.examId,
    essay: PASSING_ESSAY
  });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.payload.promotionResult.passed, true);
  return submit.payload.worldState;
}

test("POST /api/game/turn applies world tick after provider output in JSON mode", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 12;
  worldState.tenDayPeriod = 3;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "研读《论语》三日"
    })
  });

  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.worldState.turnCount, 1);
  assert.equal(payload.worldState.year, 1645);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.equal(payload.worldTick.cadence, "monthly");
  assert.equal(payload.worldTick.completedMonth, true);
  assert.ok(payload.worldTick.summary);
  assert.ok(payload.worldTick.events.length >= 1);
  const latestWorldTickEvent = payload.worldTick.events.at(-1);
  const latestWorldTickIndex = payload.worldState.eventHistory.lastIndexOf(latestWorldTickEvent);
  const lifecycleIndex = payload.worldState.eventHistory.findIndex((event) => /人物演化/.test(event));
  assert.notEqual(latestWorldTickIndex, -1);
  if (lifecycleIndex !== -1) {
    assert.equal(lifecycleIndex > latestWorldTickIndex, true);
  }
  assert.ok(payload.worldState.eventHistory.length > payload.worldTick.events.length);
  assert.ok(payload.attributeChanges.some((change) => change.path === "player.academia"));
  assert.ok(payload.attributeChanges.some((change) => change.path === "studyProfile.dimensions.classicsFoundation"));
  assert.equal(payload.studyProfileView.schemaVersion, 1);
  assert.ok(payload.studyProfileView.recentExercises.some((entry) => entry.source === "player_action"));
  assert.ok(payload.attributeChanges.some((change) => change.reason === "月度推演"));
});

test("POST /api/game/turn advances upper to middle to late to next month upper", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 5;
  worldState.tenDayPeriod = 1;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const dates = [];
  const cadences = [];
  for (let index = 0; index < 3; index += 1) {
    const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
      sessionId: worldState.sessionId,
      input: `旬度推进 ${index}`
    });
    assert.equal(response.status, 200);
    assert.equal(payload.worldState.turnCount, index + 1);
    dates.push([
      payload.worldState.year,
      payload.worldState.month,
      payload.worldState.tenDayPeriod
    ]);
    cadences.push(payload.worldTick.cadence);
  }

  assert.deepEqual(dates, [
    [1644, 5, 2],
    [1644, 5, 3],
    [1644, 6, 1]
  ]);
  assert.deepEqual(cadences, ["ten_day", "ten_day", "monthly"]);
});

test("POST /api/game/turn clamps tick output through route patch boundaries", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 7;
  worldState.tenDayPeriod = 3;
  worldState.treasury = 999999999;
  worldState.grainReserve = 999999999;
  worldState.population = 999999999;
  worldState.publicOrder = -50;
  worldState.taxRate = 100;
  worldState.corruption = 150;
  worldState.armySize = 0;
  worldState.armyMorale = -20;
  worldState.borderThreat = 150;
  worldState.factions = {
    eunuchs: 99,
    scholarOfficials: 1,
    militaryLords: 99,
    inventedFaction: 50
  };
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "rest"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.turnCount, 1);
  for (const key of ["year", "month", "treasury", "grainReserve", "population", "publicOrder", "corruption", "armyMorale", "borderThreat"]) {
    assertRange(payload.worldState[key], key);
  }
  assert.equal(payload.worldState.factions.inventedFaction, 50);
  assert.ok(!payload.worldTick.attributeChanges.some((change) => change.path === "factions.inventedFaction"));
  for (const key of ["eunuchs", "scholarOfficials", "militaryLords"]) {
    assert.ok(payload.worldState.factions[key] >= 0);
    assert.ok(payload.worldState.factions[key] <= 100);
  }
  assert.equal(payload.worldState.month, 8);
  assert.equal(payload.worldState.tenDayPeriod, 1);
  assert.ok(payload.worldTick.attributeChanges.length >= 1);
});

test("POST /api/game/turn trims provider plus tick events in order", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 1;
  worldState.eventHistory = Array.from({ length: MAX_EVENT_HISTORY - 1 }, (_, index) => `old-${index}`);
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "rest"
  });

  assert.equal(response.status, 200);
  assert.equal(payload.worldState.eventHistory.length, MAX_EVENT_HISTORY);
  assert.equal(payload.activeNpcRequestEvents.length, 1);
  assert.equal(payload.worldState.eventHistory[0], "old-2");
  assert.deepEqual(
    payload.worldState.eventHistory.slice(-payload.worldTick.events.length),
    payload.worldTick.events
  );
  const activeRequestStart = MAX_EVENT_HISTORY - payload.worldTick.events.length - payload.activeNpcRequestEvents.length;
  assert.deepEqual(
    payload.worldState.eventHistory.slice(activeRequestStart, activeRequestStart + payload.activeNpcRequestEvents.length),
    payload.activeNpcRequestEvents
  );
  const providerEvent = payload.worldState.eventHistory[activeRequestStart - 1];
  assert.ok(providerEvent);
  assert.ok(!providerEvent.startsWith("old-"));
});

test("POST /api/game/turn remains stable across repeated Mock turns", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 10;
  worldState.tenDayPeriod = 1;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  let latest;
  for (let index = 0; index < 15; index += 1) {
    const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
      sessionId: worldState.sessionId,
      input: `rest ${index}`
    });
    assert.equal(response.status, 200);
    assert.equal(payload.worldState.turnCount, index + 1);
    assert.ok(payload.worldTick.summary);
    assert.ok(payload.worldTick.events.length >= 1);
    assert.ok(payload.worldState.eventHistory.length <= MAX_EVENT_HISTORY);
    latest = payload.worldState;
  }

  assert.equal(latest.year, 1645);
  assert.equal(latest.month, 3);
  assert.equal(latest.tenDayPeriod, 1);
  assert.equal(latest.player.role, "scholar");
  assert.equal(latest.player.examRank, null);
});

test("POST /api/game/turn generates official player monthly briefing only at month end", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ role: "official", playerName: "Tick 月报" });
  worldState.year = 1644;
  worldState.month = 6;
  worldState.tenDayPeriod = 2;
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const tenDay = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "先清点案卷。"
  });

  assert.equal(tenDay.response.status, 200);
  assert.equal(tenDay.payload.worldTick.completedMonth, false);
  assert.equal(tenDay.payload.playerMonthlyBriefing.generated, false);
  assert.equal(tenDay.payload.playerMonthlyBriefingView.latest, null);

  const monthEnd = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "月末汇总差事。"
  });

  assert.equal(monthEnd.response.status, 200);
  assert.equal(monthEnd.payload.worldTick.completedMonth, true);
  assert.equal(monthEnd.payload.playerMonthlyBriefing.generated, true);
  assert.equal(monthEnd.payload.playerMonthlyBriefingView.latest.periodKey, "1644-06");
  assert.ok(monthEnd.payload.playerMonthlyBriefing.events.length >= 1);
});

test("exam trigger preserves a valid calendar window across the month-end tick", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 9;
  worldState.tenDayPeriod = 3;
  Object.assign(worldState.player, {
    examRank: EXAMS.child_exam.promotionRank,
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100,
    gold: 100
  });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const turn = await postJson(`${server.baseUrl}/api/game/turn`, {
    sessionId: worldState.sessionId,
    input: "参加乡试考试"
  });

  assert.equal(turn.response.status, 200);
  assert.equal(turn.payload.examTrigger.shouldStart, true);
  assert.equal(turn.payload.worldState.month, 10);
  assert.equal(turn.payload.worldState.tenDayPeriod, 1);
  assert.equal(turn.payload.worldState.activeExam.level, "provincial_exam");
  assert.equal(turn.payload.worldState.activeExam.examCalendar.currentMonth, 9);
  assert.equal(turn.payload.worldState.activeExam.examCalendar.status, "open");
  assert.equal(turn.payload.worldState.activeExam.sceneTime.phase, "entry");
  assert.equal(turn.payload.worldState.activeExam.sceneTime.startedAt.month, 9);
  assert.equal(turn.payload.worldState.activeExam.sceneTime.startedAt.tenDayPeriod, 3);

  const question = await postJson(`${server.baseUrl}/api/exam/question`, {
    sessionId: worldState.sessionId
  });

  assert.equal(question.response.status, 201);
  assert.equal(question.payload.level, "provincial_exam");
  assert.equal(question.payload.examCalendar.currentMonth, 9);
  assert.equal(question.payload.examCalendar.status, "open");
  assert.equal(question.payload.worldState.month, 10);
  assert.equal(question.payload.worldState.examCalendar.missedWindows.length, 0);
  assert.equal(question.payload.sceneTime.phase, "question_review");
  assert.equal(question.payload.sceneTime.startedAt.month, 9);
  assert.equal(question.payload.sceneTime.startedAt.tenDayPeriod, 3);
});

test("complete scholar exam path still works after world tick integration", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 11;
  Object.assign(worldState.player, {
    academia: 100,
    literaryTalent: 100,
    adaptability: 100,
    mentality: 100,
    reputation: 100,
    gold: 100
  });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  let latest;
  for (let index = 0; index < 3; index += 1) {
    const { response, payload } = await postJson(`${server.baseUrl}/api/game/turn`, {
      sessionId: worldState.sessionId,
      input: `rest before exam ${index}`
    });
    assert.equal(response.status, 200);
    latest = payload.worldState;
  }

  assert.equal(latest.turnCount, 3);
  assert.equal(latest.year, 1644);
  assert.equal(latest.month, 12);
  assert.equal(latest.tenDayPeriod, 1);

  for (const level of ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"]) {
    latest = await completeExam(server.baseUrl, worldState.sessionId, level);
  }

  assert.equal(latest.turnCount, 3);
  assert.equal(latest.year, 1644);
  assert.equal(latest.month, OPEN_MONTH_BY_LEVEL.palace_exam);
  assert.equal(latest.player.role, "official");
  assert.equal(latest.player.examHistory.length, 4);
  assert.equal(latest.activeExam, null);
  assert.ok(latest.player.officeTitle);
  assert.ok(latest.player.examHistory.every((entry) => entry.sceneTime?.phase === "submitted"));
});

test("POST /api/game/turn includes world tick feedback in SSE final payloads", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const response = await fetch(`${server.baseUrl}/api/game/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify({
      sessionId: worldState.sessionId,
      input: "拜访书院先生"
    })
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);

  const events = parseSse(await response.text());
  const finalState = events.find((event) => event.event === "final_state");
  const previews = events.filter((event) => event.event === "state_preview");

  assert.ok(finalState);
  assert.equal(finalState.data.studyProfileView.schemaVersion, 1);
  assert.equal(finalState.data.worldState.turnCount, 1);
  assert.equal(finalState.data.worldState.month, 1);
  assert.equal(finalState.data.worldState.tenDayPeriod, 2);
  assert.equal(finalState.data.worldTick.cadence, "ten_day");
  assert.ok(finalState.data.worldTick.summary);
  assert.ok(finalState.data.worldTick.events.length >= 1);
  assert.ok(previews.some((event) => event.data?.worldTick?.summary));
  assert.ok(previews.some((event) => event.data?.studyProfileView?.schemaVersion === 1));
});
