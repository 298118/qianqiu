const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { readSession, writeSession } = require("../src/storage/sessionStore");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

test("writeSession and readSession round-trip JSON state", async (t) => {
  const worldState = createInitialState({ playerName: "Tester", year: 1601 });
  t.after(() => removeSessionFile(worldState.sessionId));

  worldState.player.gold = 42;
  worldState.eventHistory.push("created during test");

  await writeSession(worldState);
  const loaded = await readSession(worldState.sessionId);

  assert.deepEqual(loaded, worldState);
});

test("readSession rejects unsafe session ids before touching the filesystem", async () => {
  await assert.rejects(
    () => readSession("../bad-session"),
    (error) => error.statusCode === 400 && error.message === "Invalid session id"
  );
});

test("readSession reports missing safe session ids as 404", async () => {
  const missingSessionId = randomUUID();
  await removeSessionFile(missingSessionId);

  await assert.rejects(
    () => readSession(missingSessionId),
    (error) => error.statusCode === 404 && error.message === "Session not found"
  );
});
