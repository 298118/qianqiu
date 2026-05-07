const test = require("node:test");
const assert = require("node:assert/strict");

const {
  collectSecretFragments,
  getRouteHealthPayloadFailures,
  redactRouteHealthText,
  summarizeRouteHealthPayload
} = require("../scripts/providerRouteHealth");

test("provider route health collects long secret fragments for leak checks", () => {
  assert.deepEqual(
    collectSecretFragments("deepseek", {
      DEEPSEEK_API_KEY: "sk-deepseek-abcdef123456"
    }),
    [
      "sk-deepseek-abcdef123456",
      "sk-deeps",
      "sk-deepseek-",
      "ef123456",
      "abcdef123456"
    ]
  );
  assert.deepEqual(collectSecretFragments("openai", { OPENAI_API_KEY: "short" }), []);
});

test("provider route health collects both hybrid provider secrets", () => {
  const fragments = collectSecretFragments("mimo-deepseek", {
    MIMO_API_KEY: "tp-mimo-abcdef123456",
    DEEPSEEK_API_KEY: "sk-deepseek-abcdef123456"
  });

  assert.equal(fragments.includes("tp-mimo-abcdef123456"), true);
  assert.equal(fragments.includes("sk-deepseek-abcdef123456"), true);
  assert.equal(fragments.includes("tp-mimo-"), true);
  assert.equal(fragments.includes("sk-deeps"), true);
});

test("provider route health accepts complete diagnostic payloads", () => {
  const failures = getRouteHealthPayloadFailures("deepseek", {
    ok: true,
    provider: "deepseek",
    configuredProvider: "mock",
    checkedAt: "2026-05-07T00:00:00.000Z",
    latencyMs: 120,
    supportsStreaming: true,
    models: {
      default: "deepseek-v4-flash",
      opening: "deepseek-v4-pro"
    },
    openingEventCount: 2,
    narrativePreview: "县学灯火未灭。"
  });

  assert.deepEqual(failures, []);
});

test("provider route health catches malformed payloads and secret leaks", () => {
  const failures = getRouteHealthPayloadFailures(
    "openai",
    {
      ok: true,
      provider: "deepseek",
      configuredProvider: "",
      checkedAt: "not-a-date",
      latencyMs: -1,
      supportsStreaming: "yes",
      models: {},
      openingEventCount: "2",
      narrativePreview: "",
      error: "bad key sk-secret-value in data/sessions/example.json"
    },
    {
      hiddenTextTokens: ["sk-secret-value"]
    }
  );

  assert.match(failures.join("\n"), /returned provider deepseek/);
  assert.match(failures.join("\n"), /omitted configuredProvider/);
  assert.match(failures.join("\n"), /ISO checkedAt/);
  assert.match(failures.join("\n"), /non-negative latencyMs/);
  assert.match(failures.join("\n"), /supportsStreaming/);
  assert.match(failures.join("\n"), /model summary/);
  assert.match(failures.join("\n"), /openingEventCount/);
  assert.match(failures.join("\n"), /narrativePreview/);
  assert.match(failures.join("\n"), /leaked 1 hidden text token/);
  assert.doesNotMatch(failures.join("\n"), /sk-secret-value/);
  assert.match(failures.join("\n"), /session storage path/);
});

test("provider route health redacts unsafe route error details", () => {
  const redacted = redactRouteHealthText(
    "bad key sk-secret-value at E:\\LSMNQ\\data\\sessions\\abc.json /tmp/qianqiu/data/sessions/def.json data/sessions/ghi.json",
    { hiddenTextTokens: ["sk-secret-value"] }
  );

  assert.equal(redacted.includes("sk-secret-value"), false);
  assert.equal(redacted.includes("data\\sessions"), false);
  assert.equal(redacted.includes("data/sessions"), false);
  assert.equal(redacted.includes("/tmp/qianqiu"), false);
  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /\[session-path\]/);
});

test("provider route health summarizes model and streaming details", () => {
  const summary = summarizeRouteHealthPayload("anthropic", {
    supportsStreaming: true,
    models: { default: "claude-sonnet-4-5" },
    openingEventCount: 1,
    narrativePreview: "某年县学灯火未灭，诸生问策。"
  });

  assert.match(summary, /streaming=yes/);
  assert.match(summary, /default=claude-sonnet-4-5/);
  assert.match(summary, /events=1/);
});
