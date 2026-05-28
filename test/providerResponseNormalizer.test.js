const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractProviderJsonCandidate,
  normalizeProviderStructuredResult,
  normalizeProviderUsage
} = require("../src/ai/providers/providerResponseNormalizer");
const { validatePayload } = require("../src/ai/schemas");

const openingPayload = {
  narrative: "县学晨钟初歇，书案上墨香未散。",
  events: ["县学晨读。"]
};

const quickActionPayload = {
  quickActionSuggestions: [{
    title: "温书",
    label: "温书",
    text: "温读四书章句，整理今日疑义。",
    roleTags: ["scholar"],
    toolIntent: "study",
    evidenceRefs: ["eventArchiveView:morning-study"],
    source: "provider-ai"
  }]
};

test("S92.3 provider response normalizer parses Responses output_text and usage", () => {
  const result = normalizeProviderStructuredResult({
    schemaName: "opening",
    raw: {
      output_text: JSON.stringify(openingPayload),
      usage: {
        input_tokens: 12,
        output_tokens: 8,
        total_tokens: 20
      }
    },
    provider: "openai",
    model: "route-openai-model",
    strictStructuredOutput: true
  });

  assert.equal(validatePayload("opening", result.payload), result.payload);
  assert.equal(result.provider, "openai");
  assert.equal(result.model, "route-openai-model");
  assert.deepEqual(result.usage, {
    inputTokens: 12,
    outputTokens: 8,
    totalTokens: 20,
    estimated: false
  });
  assert.equal(result.strictStructuredOutput, true);
  assert.equal("raw" in result, false);
  assert.equal("response" in result, false);
});

test("S92.3 provider response normalizer parses Responses output content text", () => {
  const result = normalizeProviderStructuredResult({
    schemaName: "opening",
    raw: {
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify(openingPayload)
        }]
      }]
    },
    provider: "openai",
    model: "gpt-test"
  });

  assert.deepEqual(result.payload, openingPayload);
  assert.equal(result.usage.estimated, true);
});

test("S92.3 provider response normalizer parses Chat choices and content parts", () => {
  const result = normalizeProviderStructuredResult({
    schemaName: "quickAction",
    raw: {
      choices: [{
        message: {
          content: [{
            type: "text",
            text: JSON.stringify(quickActionPayload)
          }]
        }
      }],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 6,
        total_tokens: 15
      }
    },
    provider: "openai",
    model: "chat-compatible"
  });

  assert.equal(validatePayload("quickAction", result.payload), result.payload);
  assert.deepEqual(normalizeProviderUsage({ usage: { prompt_tokens: 9, completion_tokens: 6 } }), {
    inputTokens: 9,
    outputTokens: 6,
    totalTokens: 15,
    estimated: false
  });
});

test("S92.3 provider response normalizer accepts parsed objects but still validates schema", () => {
  assert.deepEqual(extractProviderJsonCandidate({ parsed: openingPayload }), openingPayload);

  assert.throws(
    () => normalizeProviderStructuredResult({
      schemaName: "opening",
      raw: {
        parsed: {
          ...openingPayload,
          rawProviderPayload: "prompt=SECRET key=abc123 token=tok123 sk-test-secret C:\\Users\\ZZZ\\Downloads\\secret.json"
        }
      },
      provider: "openai",
      model: "gpt-test"
    }),
    (error) => {
      assert.match(error.message, /structured output failed/);
      assert.doesNotMatch(error.message, /SECRET|abc123|tok123|sk-test-secret|Downloads|rawProviderPayload|prompt=|key=|token=/);
      return true;
    }
  );
});

test("S92.3 provider response normalizer rejects wrapper responses without JSON safely", () => {
  assert.throws(
    () => normalizeProviderStructuredResult({
      schemaName: "opening",
      raw: {
        output_text: "not json prompt=SECRET key=abc123 token=tok123 baseURL=https://api.example.test sk-test-secret",
        usage: { input_tokens: 1 }
      },
      provider: "openai",
      model: "gpt-test"
    }),
    (error) => {
      assert.match(error.message, /structured output failed/);
      assert.doesNotMatch(error.message, /SECRET|abc123|tok123|baseURL=https|sk-test-secret|prompt=|key=|token=/);
      return true;
    }
  );
});
