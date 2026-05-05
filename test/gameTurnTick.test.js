const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const examRoutes = require("../src/routes/exam");
const { createInitialState } = require("../src/game/initialState");
const { MAX_EVENT_HISTORY, NUMERIC_RANGES } = require("../src/game/stateRules");
const { writeSession } = require("../src/storage/sessionStore");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");
const PASSING_ESSAY = "治民以德，修身齐家，明经达变，慎刑薄赋，安民养士。".repeat(70);

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use("/api/exam", examRoutes);

  const server = app.listen(0);
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
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
  assert.ok(payload.worldTick.summary);
  assert.ok(payload.worldTick.events.length >= 1);
  assert.deepEqual(
    payload.worldState.eventHistory.slice(-payload.worldTick.events.length),
    payload.worldTick.events
  );
  assert.ok(payload.worldState.eventHistory.length > payload.worldTick.events.length);
  assert.ok(payload.attributeChanges.some((change) => change.path === "player.academia"));
  assert.ok(payload.attributeChanges.some((change) => change.reason === "月度推演"));
});

test("POST /api/game/turn clamps tick output through route patch boundaries", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.month = 7;
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
  assert.equal(payload.worldState.eventHistory[0], "old-1");
  assert.deepEqual(
    payload.worldState.eventHistory.slice(-payload.worldTick.events.length),
    payload.worldTick.events
  );
  const providerEvent = payload.worldState.eventHistory[MAX_EVENT_HISTORY - payload.worldTick.events.length - 1];
  assert.ok(providerEvent);
  assert.ok(!providerEvent.startsWith("old-"));
});

test("POST /api/game/turn remains stable across repeated Mock turns", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Tester" });
  worldState.year = 1644;
  worldState.month = 10;
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

  assert.equal(latest.year, 1646);
  assert.equal(latest.month, 1);
  assert.equal(latest.player.role, "scholar");
  assert.equal(latest.player.examRank, null);
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
  assert.equal(latest.year, 1645);
  assert.equal(latest.month, 2);

  for (const level of ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"]) {
    latest = await completeExam(server.baseUrl, worldState.sessionId, level);
  }

  assert.equal(latest.turnCount, 3);
  assert.equal(latest.year, 1645);
  assert.equal(latest.month, 2);
  assert.equal(latest.player.role, "official");
  assert.equal(latest.player.examHistory.length, 4);
  assert.equal(latest.activeExam, null);
  assert.ok(latest.player.officeTitle);
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
  assert.equal(finalState.data.worldState.turnCount, 1);
  assert.equal(finalState.data.worldState.month, 2);
  assert.ok(finalState.data.worldTick.summary);
  assert.ok(finalState.data.worldTick.events.length >= 1);
  assert.ok(previews.some((event) => event.data?.worldTick?.summary));
});
