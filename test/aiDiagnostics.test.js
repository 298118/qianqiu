const assert = require("assert/strict");
const test = require("node:test");

const {
  normalizeProviderName,
  redactSecrets,
  runAiConnectionTest
} = require("../src/ai/diagnostics");

function withEnv(overrides, fn) {
  const keys = [
    "AI_PROVIDER",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "MIMO_API_KEY",
    "MIMO_MODEL",
    "ANTHROPIC_API_KEY",
    "DEEPSEEK_MODEL",
    "DEEPSEEK_OPENING_MODEL",
    "DEEPSEEK_TURN_MODEL",
    "DEEPSEEK_EXAM_QUESTION_MODEL",
    "DEEPSEEK_GRADE_MODEL",
    ...Object.keys(overrides)
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  return Promise.resolve()
    .then(() => {
      for (const key of keys) delete process.env[key];
      for (const [key, value] of Object.entries(overrides)) process.env[key] = value;
      return fn();
    })
    .finally(() => {
      for (const key of keys) {
        const value = previous.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("AI diagnostics normalizes provider names", () => {
  assert.equal(normalizeProviderName(""), "mock");
  assert.equal(normalizeProviderName(" DeepSeek "), "deepseek");
  assert.equal(normalizeProviderName("Claude"), "claude");
  assert.equal(normalizeProviderName("xiaomi"), "mimo");
  assert.equal(normalizeProviderName("hybrid"), "mimo-deepseek");
});

test("AI diagnostics redacts configured secrets from errors", () => {
  return withEnv({ DEEPSEEK_API_KEY: "sk-secret-value" }, () => {
    assert.equal(redactSecrets("bad key sk-secret-value"), "bad key [redacted]");
  });
});

test("AI diagnostics redacts long secret fragments from errors", () => {
  return withEnv({ OPENAI_API_KEY: "sk-proj-abcdef1234567890" }, () => {
    const redacted = redactSecrets("prefix sk-proj- suffix 34567890 full sk-proj-abcdef1234567890");

    assert.equal(redacted.includes("sk-proj-"), false);
    assert.equal(redacted.includes("34567890"), false);
    assert.equal(redacted.includes("abcdef1234567890"), false);
    assert.match(redacted, /\[redacted\]/);
  });
});

test("AI connection test succeeds for mock without writing a session", async () => {
  await withEnv({ AI_PROVIDER: "mock" }, async () => {
    const result = await runAiConnectionTest();
    assert.equal(result.ok, true);
    assert.equal(result.provider, "mock");
    assert.equal(result.configuredProvider, "mock");
    assert.equal(result.models.default, "mock");
    assert.equal(typeof result.supportsStreaming, "boolean");
    assert.ok(!Number.isNaN(Date.parse(result.checkedAt)));
    assert.ok(result.openingEventCount > 0);
    assert.ok(result.latencyMs >= 0);
    assert.equal(JSON.stringify(result).includes("data/sessions"), false);
  });
});

test("AI connection test reports unknown providers without throwing", async () => {
  await withEnv({ AI_PROVIDER: "mock" }, async () => {
    const result = await runAiConnectionTest({ provider: "unknown" });
    assert.equal(result.ok, false);
    assert.equal(result.provider, "unknown");
    assert.equal(result.configuredProvider, "mock");
    assert.match(result.error, /Unknown AI provider/);
  });
});

test("AI connection test reports missing DeepSeek key without leaking secrets", async () => {
  await withEnv({
    AI_PROVIDER: "deepseek",
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    DEEPSEEK_GRADE_MODEL: "deepseek-v4-pro"
  }, async () => {
    const result = await runAiConnectionTest();
    assert.equal(result.ok, false);
    assert.equal(result.provider, "deepseek");
    assert.match(result.error, /DEEPSEEK_API_KEY/);
    assert.equal(result.models.grade, "deepseek-v4-pro");
  });
});

test("AI connection test reports missing MiMo Token Plan key", async () => {
  await withEnv({
    AI_PROVIDER: "mimo",
    MIMO_MODEL: "mimo-v2.5-pro"
  }, async () => {
    const result = await runAiConnectionTest();
    assert.equal(result.ok, false);
    assert.equal(result.provider, "mimo");
    assert.match(result.error, /MIMO_API_KEY/);
    assert.equal(result.models.default, "mimo-v2.5-pro");
  });
});

test("AI connection test reports all missing keys for MiMo+DeepSeek hybrid", async () => {
  await withEnv({
    AI_PROVIDER: "mimo-deepseek",
    MIMO_MODEL: "mimo-v2.5-pro",
    DEEPSEEK_GRADE_MODEL: "deepseek-v4-pro"
  }, async () => {
    const result = await runAiConnectionTest();
    assert.equal(result.ok, false);
    assert.equal(result.provider, "mimo-deepseek");
    assert.match(result.error, /MIMO_API_KEY and DEEPSEEK_API_KEY/);
    assert.equal(result.models.mimo, "mimo-v2.5-pro");
    assert.equal(result.models.deepseekGrade, "deepseek-v4-pro");
  });
});
