const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROVIDER_HEALTH_FAILURE_REASONS,
  assertPublicProviderHealthSummary,
  classifyProviderFailure,
  createProviderHealthManager
} = require("../src/ai/runtime/providerHealthManager");

test("S92.8 provider health classifies required provider failure reasons", () => {
  const cases = [
    [new Error("OPENAI_API_KEY missing"), "missing_key"],
    [new Error("AI provider timed out after 1000ms"), "timeout"],
    [new Error("Ajv schema validation failed for structured output"), "schema_invalid"],
    [{ status: 429, message: "rate limit exceeded" }, "rate_limit"],
    [{ status: 403, message: "content policy safety rejection: not allowed" }, "safety_reject"],
    [new Error("fetch failed ECONNRESET socket closed"), "network_error"],
    [new Error("tool shape mismatch: invalid arguments for tool call"), "tool_shape_mismatch"],
    [new Error("guardrail safety rejected hidden worldState server.resolveHiddenLedger"), "safety_reject"]
  ];

  for (const [error, expected] of cases) {
    const result = classifyProviderFailure(error);
    assert.equal(result.reason, expected);
    assert.equal(PROVIDER_HEALTH_FAILURE_REASONS.includes(result.reason), true);
    assert.doesNotMatch(JSON.stringify(result), /OPENAI_API_KEY|worldState|server\.resolveHiddenLedger/);
  }
});

test("S92.8 provider health manager publishes redacted counters and circuit state", () => {
  let current = Date.parse("2026-05-29T00:00:00.000Z");
  const manager = createProviderHealthManager({
    now: () => current,
    circuitBreakerFailures: 2,
    circuitBreakerCooldownMs: 1000
  });

  const first = manager.recordFailure(
    new Error("OpenAI API request failed with 500: prompt=SECRET key=abc123 token=tok123 Authorization: Bearer abcdef123456 rawProviderPayload apiKey=sk-test-abcdef C:\\Users\\ZZZ\\Downloads\\secret.json"),
    { provider: "openai", model: "gpt-test", reason: "schema_invalid", latencyMs: 9 }
  );
  current += 100;
  const second = manager.recordFailure(new Error("AI provider timed out after 1000ms"), {
    provider: "openai",
    model: "gpt-test",
    latencyMs: 1000
  });
  const snapshot = manager.getPublicSnapshot();
  const serialized = JSON.stringify(snapshot);

  assert.equal(first.lastFailureReason, "schema_invalid");
  assert.equal(second.lastFailureReason, "timeout");
  assert.equal(second.status, "unavailable");
  assert.equal(second.circuitOpen, true);
  assert.equal(manager.shouldShortCircuit({ provider: "openai", model: "gpt-test" }), true);
  assert.equal(snapshot.providers.length, 1);
  assert.equal(snapshot.providers[0].failuresByReason.schema_invalid, 1);
  assert.equal(snapshot.providers[0].failuresByReason.timeout, 1);
  assert.doesNotMatch(serialized, /SECRET|abc123|tok123|abcdef123456|sk-test-abcdef|secret\.json|rawProviderPayload|apiKey|prompt=|key=|token=|Authorization/);
  assertPublicProviderHealthSummary(snapshot);

  current += 1200;
  assert.equal(manager.shouldShortCircuit({ provider: "openai", model: "gpt-test" }), false);
  const recovered = manager.recordSuccess({ provider: "openai", model: "gpt-test", latencyMs: 11 });
  assert.equal(recovered.status, "healthy");
  assert.equal(recovered.consecutiveFailures, 0);
});

test("S92.8 provider health summary rejects unsafe public diagnostics", () => {
  const safeRecord = {
    schemaVersion: "s92.8-provider-health.v1",
    provider: "openai",
    model: "gpt-test",
    status: "degraded",
    recentSuccessCount: 0,
    recentFailureCount: 1,
    consecutiveFailures: 1,
    lastFailureReason: "schema_invalid",
    lastPublicMessage: "schema_invalid",
    lastFailureAt: "2026-05-29T00:00:00.000Z",
    lastSuccessAt: "",
    lastCheckedAt: "2026-05-29T00:00:00.000Z",
    circuitOpen: false,
    circuitOpenUntil: "",
    failuresByReason: Object.fromEntries(PROVIDER_HEALTH_FAILURE_REASONS.map((reason) => [reason, reason === "schema_invalid" ? 1 : 0]))
  };

  assertPublicProviderHealthSummary({
    schemaVersion: "s92.8-provider-health.v1",
    checkedAt: "2026-05-29T00:00:00.000Z",
    providers: [safeRecord]
  });

  assert.throws(
    () => assertPublicProviderHealthSummary({
      schemaVersion: "s92.8-provider-health.v1",
      checkedAt: "2026-05-29T00:00:00.000Z",
      providers: [{
        ...safeRecord,
        rawRows: [{ content: "汴京春日" }]
      }]
    }),
    /forbidden providers\.0 field/
  );

  assert.throws(
    () => assertPublicProviderHealthSummary({
      schemaVersion: "s92.8-provider-health.v1",
      checkedAt: "2026-05-29T00:00:00.000Z",
      providers: [{
        ...safeRecord,
        failuresByReason: {
          ...safeRecord.failuresByReason,
          rawSql: 1
        }
      }]
    }),
    /forbidden providers\.0\.failuresByReason field/
  );

  assert.throws(
    () => assertPublicProviderHealthSummary({
      ...safeRecord,
      lastPublicMessage: "rawPrompt=完整提示词",
    }),
    /forbidden raw diagnostic content|sensitive assignment/
  );
});
