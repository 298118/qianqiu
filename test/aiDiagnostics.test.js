const assert = require("assert/strict");
const test = require("node:test");

const {
  PROVIDER_DIAGNOSTICS,
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

test("AI diagnostics redacts generic provider payload, prompt, path, URL, and token shapes", () => {
  const redacted = redactSecrets(
    "raw provider payload: {\"hidden\":\"SEALED_PROVIDER_FACT\",\"prompt\":\"完整密札\"}; request body baseURL=https://api.example.test/v1 data/sessions/private.json /mnt/e/secret sk-live-secret-token 完整提示词"
  );

  assert.doesNotMatch(
    redacted,
    /raw provider payload|request body|baseURL=https|data\/sessions|\/mnt\/e|sk-live-secret|完整提示词|SEALED_PROVIDER_FACT|完整密札/i
  );
  assert.match(redacted, /\[redacted/);
});

test("AI diagnostics redacts unmarked provider HTTP response bodies", () => {
  const redacted = redactSecrets(
    "MiMo API request failed with 500: {\"hidden\":\"SEALED_PROVIDER_FACT\",\"prompt\":\"完整密札\",\"path\":\"/mnt/e/secret\"}"
  );
  const semicolonRedacted = redactSecrets(
    "OpenAI API stream failed with 429: {\"message\":\"SEALED; 完整密札 /mnt/e/secret\"}"
  );

  assert.match(redacted, /MiMo API request failed with 500: \[redacted-provider-body\]/);
  assert.doesNotMatch(redacted, /SEALED_PROVIDER_FACT|完整密札|\/mnt\/e\/secret/);
  assert.match(semicolonRedacted, /OpenAI API stream failed with 429: \[redacted-provider-body\]/);
  assert.doesNotMatch(semicolonRedacted, /SEALED|完整密札|\/mnt\/e\/secret/);
});

test("AI connection test sanitizes provider narrative preview before returning public envelope", async (t) => {
  await withEnv({ AI_PROVIDER: "mock" }, async () => {
    const originalCreate = PROVIDER_DIAGNOSTICS.mock.create;
    PROVIDER_DIAGNOSTICS.mock.create = () => ({
      supportsStreaming: false,
      startGame: async () => ({
        narrative: "raw provider payload data/sessions/private.json /mnt/e/secret sk-preview-secret 完整提示词",
        events: ["诊断事件"]
      })
    });
    t.after(() => {
      PROVIDER_DIAGNOSTICS.mock.create = originalCreate;
    });

    const result = await runAiConnectionTest();
    assert.equal(result.ok, true);
    assert.doesNotMatch(
      JSON.stringify(result),
      /raw provider payload|data\/sessions|\/mnt\/e|sk-preview-secret|完整提示词/i
    );
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
