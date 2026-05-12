const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertTeacherFeedbackProposal,
  buildSmokeEssay,
  canonicalProviderName,
  collectS69ProviderPatchViolations,
  getProviderNamesToSmoke,
  hasFlag,
  providerHasKey
} = require("../scripts/providerSmoke");

test("provider smoke canonicalizes aliases", () => {
  assert.equal(canonicalProviderName("openai"), "openai");
  assert.equal(canonicalProviderName("claude"), "anthropic");
  assert.equal(canonicalProviderName("xiaomi"), "mimo");
  assert.equal(canonicalProviderName("hybrid"), "mimo-deepseek");
  assert.equal(canonicalProviderName("mock"), "mock");
  assert.throws(() => canonicalProviderName("unknown"), /Unknown smoke provider/);
});

test("provider smoke skips auto mode when no real-provider keys exist", () => {
  const env = { AI_PROVIDER: "mock" };
  const argv = ["node", "scripts/providerSmoke.js"];

  assert.deepEqual(getProviderNamesToSmoke({ argv, env }), []);
});

test("provider smoke auto-selects keyed providers in mock mode", () => {
  const env = {
    AI_PROVIDER: "mock",
    OPENAI_API_KEY: "openai-key",
    DEEPSEEK_API_KEY: "",
    ANTHROPIC_API_KEY: "anthropic-key"
  };
  const argv = ["node", "scripts/providerSmoke.js"];

  assert.deepEqual(getProviderNamesToSmoke({ argv, env }), ["openai", "anthropic"]);
});

test("provider smoke treats configured real provider as required", () => {
  const argv = ["node", "scripts/providerSmoke.js"];

  assert.throws(
    () => getProviderNamesToSmoke({ argv, env: { AI_PROVIDER: "openai" } }),
    /OPENAI_API_KEY/
  );
  assert.deepEqual(
    getProviderNamesToSmoke({ argv, env: { AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "deepseek-key" } }),
    ["deepseek"]
  );
  assert.deepEqual(
    getProviderNamesToSmoke({
      argv,
      env: {
        AI_PROVIDER: "mimo-deepseek",
        MIMO_API_KEY: "mimo-key",
        DEEPSEEK_API_KEY: "deepseek-key"
      }
    }),
    ["mimo-deepseek"]
  );
});

test("provider smoke supports explicit provider override", () => {
  const argv = ["node", "scripts/providerSmoke.js", "--provider", "claude"];
  const env = {
    AI_PROVIDER: "mock",
    ANTHROPIC_API_KEY: "anthropic-key"
  };

  assert.equal(providerHasKey("anthropic", env), true);
  assert.deepEqual(getProviderNamesToSmoke({ argv, env }), ["anthropic"]);
});

test("provider smoke requires both MiMo and DeepSeek keys for hybrid provider", () => {
  assert.equal(providerHasKey("mimo-deepseek", {
    MIMO_API_KEY: "mimo-key"
  }), false);
  assert.equal(providerHasKey("mimo-deepseek", {
    MIMO_API_KEY: "mimo-key",
    DEEPSEEK_API_KEY: "deepseek-key"
  }), true);
});

test("provider smoke detects optional streaming flag", () => {
  assert.equal(hasFlag(["node", "scripts/providerSmoke.js", "--stream"], "--stream"), true);
  assert.equal(hasFlag(["node", "scripts/providerSmoke.js"], "--stream"), false);
});

test("provider smoke essay is long enough for the child exam smoke grade", () => {
  assert.ok(buildSmokeEssay().length >= 200);
  assert.equal(buildSmokeEssay().includes("AI"), false);
});

test("provider smoke catches S69 server-owned patch attempts", () => {
  assert.deepEqual(
    collectS69ProviderPatchViolations({
      activeExam: { level: "palace_exam" },
      examHonorLedger: { honors: [{ title: "模型状元" }] },
      appointmentTrack: { records: [{ officeTitle: "内阁大学士" }] },
      studyProfile: { teacherAdvice: [] },
      worldPeople: { npcs: [] },
      player: {
        teacher: "模型先生",
        position: "新科状元",
        officeTitle: "翰林院修撰",
        examHistory: []
      }
    }),
    [
      "activeExam",
      "examHonorLedger",
      "appointmentTrack",
      "studyProfile",
      "worldPeople",
      "player.teacher",
      "player.position",
      "player.officeTitle",
      "player.examHistory"
    ]
  );
});

test("provider smoke requires teacher feedback proposal fields", () => {
  assert.doesNotThrow(() => assertTeacherFeedbackProposal("mock", {
    teacherFeedbackProposal: {
      focus: "制艺章法",
      advice: "先练破题。",
      reason: "玩家请老师点评文章。"
    }
  }));

  assert.throws(
    () => assertTeacherFeedbackProposal("mock", { teacherFeedbackProposal: { focus: "制艺章法" } }),
    /teacherFeedbackProposal\.advice/
  );
  assert.throws(
    () => assertTeacherFeedbackProposal("mock", {}),
    /did not return teacherFeedbackProposal/
  );
});
