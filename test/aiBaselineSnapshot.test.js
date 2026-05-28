const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  BASELINE_SCHEMA_VERSION,
  assertBaselineSnapshotSafe,
  buildAiBaselineSnapshot
} = require("../scripts/aiBaselineSnapshot");

function createEnv(overrides = {}) {
  return {
    AI_PROVIDER: "mock",
    ...overrides
  };
}

function assertNoSecretValues(serialized) {
  for (const forbidden of [
    "sk-test-secret-123456",
    "tp-test-secret-123456",
    "anthropic-test-secret-123456",
    "deepseek-test-secret-123456",
    "https://private.example.test/v1",
    "E:\\LSMNQ\\.env",
    "rawProviderPayload",
    "rawPrompt",
    "hiddenNotes",
    "worldState",
    "world_state_json"
  ]) {
    assert.equal(serialized.includes(forbidden), false, `baseline must not include ${forbidden}`);
  }
}

test("S92.1 AI baseline snapshot summarizes current AI surface without secrets", () => {
  const snapshot = buildAiBaselineSnapshot({
    generatedAt: "2026-05-28T00:00:00.000Z",
    env: createEnv({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-secret-123456",
      OPENAI_BASE_URL: "https://private.example.test/v1",
      DEEPSEEK_API_KEY: "deepseek-test-secret-123456",
      MIMO_API_KEY: "tp-test-secret-123456",
      ANTHROPIC_API_KEY: "anthropic-test-secret-123456"
    })
  });

  assert.equal(snapshot.schemaVersion, BASELINE_SCHEMA_VERSION);
  assert.equal(snapshot.runtimeBehaviorChanged, false);
  assert.ok(snapshot.promptPacks.items.some((item) => item.promptPackId === "world_turn"));
  assert.ok(snapshot.schemas.items.some((item) => item.schemaName === "turn"));
  assert.ok(snapshot.modelRoutes.reviewerOnlyTasks.includes("critic"));
  assert.ok(snapshot.modelRoutes.reviewerOnlyTasks.includes("safety_gate"));
  assert.ok(snapshot.tools.items.some((item) => item.name === "world.read_visible_context"));
  assert.equal(
    snapshot.providers.items.find((item) => item.provider === "openai").credentialConfigured,
    true
  );
  assert.equal(
    snapshot.providers.items.find((item) => item.provider === "openai").endpointOverrideConfigured,
    true
  );

  assert.equal(assertBaselineSnapshotSafe(snapshot), snapshot);
  assertNoSecretValues(JSON.stringify(snapshot));
});

test("S92.1 AI baseline safety scan rejects generic internal server resolver names", () => {
  assert.throws(
    () => assertBaselineSnapshotSafe({ toolName: "server.resolve_career" }),
    /sensitive or raw-only terms/
  );
});

test("S92.1 AI baseline snapshot does not expose internal resolver names", () => {
  const snapshot = buildAiBaselineSnapshot({
    generatedAt: "2026-05-28T00:00:00.000Z",
    env: createEnv()
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(serialized.includes("server.resolve"), false);
  assert.equal(serialized.includes("server.request"), false);
  assert.equal(serialized.includes("server.read_visible_context"), false);
  assert.ok(snapshot.tools.items.every((item) => item.serverOwnedResolver === true));
});

test("S92.1 AI baseline CLI writes hidden-safe JSON artifact", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qianqiu-ai-baseline-"));
  const outPath = path.join(tmpDir, "latest.json");
  execFileSync(process.execPath, [
    "scripts/aiBaselineSnapshot.js",
    "--out",
    outPath,
    "--no-stdout"
  ], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      AI_PROVIDER: "mimo",
      MIMO_API_KEY: "tp-test-secret-123456",
      MIMO_BASE_URL: "https://private.example.test/v1"
    },
    encoding: "utf8"
  });

  const artifact = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(artifact.schemaVersion, BASELINE_SCHEMA_VERSION);
  assert.equal(artifact.providers.items.find((item) => item.provider === "mimo").credentialConfigured, true);
  assert.equal(artifact.providers.items.find((item) => item.provider === "mimo").endpointOverrideConfigured, true);
  assertNoSecretValues(JSON.stringify(artifact));
});
