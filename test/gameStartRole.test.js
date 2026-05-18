const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

process.env.AI_PROVIDER = "mock";

const gameRoutes = require("../src/routes/game");
const {
  ALLOWED_ROLES,
  createInitialState,
  normalizeInitialFamilyBackground,
  normalizeInitialRole
} = require("../src/game/initialState");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

const sessionsDir = path.join(__dirname, "..", "data", "sessions");

async function removeSessionFile(sessionId) {
  await fs.rm(path.join(sessionsDir, `${sessionId}.json`), { force: true });
}

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/game", gameRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error",
      allowedRoles: err.allowedRoles
    });
  });

  return createFetchSafeServer(app);
}

test("initial role normalization accepts the documented start roles and defaults blanks to scholar", () => {
  assert.deepEqual(ALLOWED_ROLES, ["scholar", "emperor", "minister", "general", "magistrate", "official"]);
  assert.equal(normalizeInitialRole(undefined), "scholar");
  assert.equal(normalizeInitialRole(""), "scholar");
  assert.equal(normalizeInitialRole(" official "), "official");

  for (const role of ALLOWED_ROLES) {
    const worldState = createInitialState({ playerName: "Tester", role });
    assert.equal(worldState.player.role, role);
  }
});

test("initial role normalization rejects unsupported roles before state creation", () => {
  assert.throws(() => normalizeInitialRole("grand_tutor"), /Unsupported role/);
  assert.throws(() => createInitialState({ role: "grand_tutor" }), /Unsupported role/);
  assert.throws(() => createInitialState({ role: ["scholar"] }), /Unsupported role/);
});

test("createInitialState clamps initial years to state boundaries", () => {
  assert.equal(createInitialState({ year: -500 }).year, 1);
  assert.equal(createInitialState({ year: 20000 }).year, 9999);
  assert.equal(createInitialState({ year: "1644.7" }).year, 1645);
  assert.equal(createInitialState({ year: "" }).year, 1644);
  assert.equal(createInitialState({ year: null }).year, 1644);
  assert.equal(createInitialState({ year: "not-a-year" }).year, 1644);
  assert.equal(createInitialState({ tenDayPeriod: 3 }).tenDayPeriod, 1);
});

test("createInitialState stores public native place for appointment avoidance", () => {
  const worldState = createInitialState({
    playerName: "籍贯测试",
    role: "scholar",
    nativePlace: " 苏州府 "
  });

  assert.equal(worldState.player.nativePlace, "苏州府");
  assert.equal(worldState.setup.nativePlace, "苏州府");
});

test("createInitialState stores scholar family background as public setup text only", () => {
  assert.equal(normalizeInitialFamilyBackground("poor", "scholar"), "贫寒");
  assert.equal(normalizeInitialFamilyBackground("世家", "scholar"), "世家");
  assert.equal(normalizeInitialFamilyBackground("豪门", "scholar"), "");
  assert.equal(normalizeInitialFamilyBackground("gentry", "official"), "");

  const scholar = createInitialState({
    playerName: "家境测试",
    role: "scholar",
    familyBackground: "poor",
    background: "县学附读，父兄供纸笔。",
    customSetting: "只作为公开自述，不作密档。"
  });

  assert.equal(scholar.setup.familyBackground, "贫寒");
  assert.equal(scholar.setup.background, "书生家境：贫寒；县学附读，父兄供纸笔。");
  assert.equal(scholar.setup.customSetting, "只作为公开自述，不作密档。");
  assert.equal(scholar.player.examRank, null);

  const official = createInitialState({
    playerName: "官员家境测试",
    role: "official",
    familyBackground: "gentry"
  });
  assert.equal(official.setup.familyBackground, "");
  assert.equal(official.setup.background, "");
  assert.equal(official.player.role, "official");
});

test("POST /api/game/start rejects unsupported role input with a 400 response", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dynasty: "明",
      year: 1644,
      role: "grand_tutor",
      playerName: "Tester"
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /Unsupported role/);
  assert.deepEqual(payload.allowedRoles, ALLOWED_ROLES);
});

test("POST /api/game/start allows direct official starts", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dynasty: "明",
      year: 1644,
      role: "official",
      playerName: "Tester"
    })
  });
  const payload = await response.json();
  t.after(() => removeSessionFile(payload.sessionId));

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.player.role, "official");
  assert.equal(payload.worldState.player.roleLabel, "入仕官员");
  assert.equal(payload.worldState.player.position, "候选观政");
  assert.equal(payload.worldState.player.cleanReputation, 70);
  assert.ok(payload.worldState.characters.some((character) => character.role === "署中上官"));
  assert.match(payload.narrative, /入仕官员|衙署|上官/);
});

test("POST /api/game/start always starts at the first ten-day period", async (t) => {
  const server = createTestServer();
  t.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dynasty: "明",
      year: 1644,
      month: 8,
      tenDayPeriod: 3,
      role: "scholar",
      playerName: "Time Tester"
    })
  });
  const payload = await response.json();
  t.after(() => removeSessionFile(payload.sessionId));

  assert.equal(response.status, 201);
  assert.equal(payload.worldState.month, 1);
  assert.equal(payload.worldState.tenDayPeriod, 1);
});
