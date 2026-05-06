const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSmokeEssay,
  canonicalProviderName,
  getProviderNamesToSmoke,
  hasFlag,
  providerHasKey
} = require("../scripts/providerSmoke");

test("provider smoke canonicalizes aliases", () => {
  assert.equal(canonicalProviderName("openai"), "openai");
  assert.equal(canonicalProviderName("claude"), "anthropic");
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

test("provider smoke detects optional streaming flag", () => {
  assert.equal(hasFlag(["node", "scripts/providerSmoke.js", "--stream"], "--stream"), true);
  assert.equal(hasFlag(["node", "scripts/providerSmoke.js"], "--stream"), false);
});

test("provider smoke essay is long enough for the child exam smoke grade", () => {
  assert.ok(buildSmokeEssay().length >= 200);
  assert.equal(buildSmokeEssay().includes("AI"), false);
});
