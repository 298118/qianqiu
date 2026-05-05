const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);

  const server = app.listen(0);
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
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
