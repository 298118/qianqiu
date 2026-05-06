const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { createInitialState } = require("../src/game/initialState");
const { writeSession } = require("../src/storage/sessionStore");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const serverPath = require.resolve("../server");
const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function loadServerWithEnv(env = {}) {
  const keys = ["PORT", "CORS_ALLOWED_ORIGINS"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      process.env[key] = env[key];
    } else {
      delete process.env[key];
    }
  }

  delete require.cache[serverPath];
  const loaded = require("../server");

  for (const key of keys) {
    if (previous[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous[key];
    }
  }

  return loaded;
}

test("default CORS allows only the configured local app origins", async (t) => {
  const { app } = loadServerWithEnv({ PORT: "3333" });
  const server = createFetchSafeServer(app);
  t.after(server.close);

  const blocked = await fetch(`${server.baseUrl}/api/health`, {
    headers: { Origin: "http://malicious.example" }
  });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.headers.get("access-control-allow-origin"), null);

  const allowed = await fetch(`${server.baseUrl}/api/health`, {
    headers: { Origin: "http://localhost:3333" }
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:3333");
});

test("default CORS does not expose save APIs to hostile origins", async (t) => {
  const { app } = loadServerWithEnv({ PORT: "3333" });
  const server = createFetchSafeServer(app);
  t.after(server.close);

  const worldState = createInitialState({ playerName: "Cors Save Tester" });
  t.after(() => removeSessionFile(worldState.sessionId));
  await writeSession(worldState);

  const saves = await fetch(`${server.baseUrl}/api/game/saves`, {
    headers: { Origin: "http://malicious.example" }
  });
  assert.equal(saves.status, 200);
  assert.equal(saves.headers.get("access-control-allow-origin"), null);

  const state = await fetch(`${server.baseUrl}/api/game/state/${worldState.sessionId}`, {
    headers: { Origin: "http://malicious.example" }
  });
  assert.equal(state.status, 200);
  assert.equal(state.headers.get("access-control-allow-origin"), null);

  const localSaves = await fetch(`${server.baseUrl}/api/game/saves`, {
    headers: { Origin: "http://localhost:3333" }
  });
  assert.equal(localSaves.status, 200);
  assert.equal(localSaves.headers.get("access-control-allow-origin"), "http://localhost:3333");
});

test("CORS can allow explicit extra origins from environment", async (t) => {
  const { app } = loadServerWithEnv({
    PORT: "3333",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173, https://tools.example"
  });
  const server = createFetchSafeServer(app);
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/health`, {
    headers: { Origin: "http://localhost:5173" }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("CORS parser trims empty configured origins", () => {
  const { buildAllowedCorsOrigins, parseAllowedCorsOrigins } = loadServerWithEnv({ PORT: "3000" });

  assert.deepEqual(parseAllowedCorsOrigins(" http://one.test, ,http://two.test "), [
    "http://one.test",
    "http://two.test"
  ]);

  const origins = buildAllowedCorsOrigins(4444, "http://tools.test");
  assert.equal(origins.has("http://localhost:4444"), true);
  assert.equal(origins.has("http://tools.test"), true);
  assert.equal(origins.has("http://localhost:5555"), false);
});
