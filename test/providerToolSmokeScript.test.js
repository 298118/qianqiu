const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMimoToolRequestBody,
  buildMimoToolSmokeHeaders,
  extractToolCalls,
  parseToolArguments,
  readMimoToolSmokeConfig,
  runMimoToolSmoke,
  summarizeProviderErrorBody
} = require("../scripts/providerToolSmoke");

function makeJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test("provider tool smoke skips MiMo when key is absent unless required", async () => {
  const skipped = await runMimoToolSmoke({
    argv: ["node", "scripts/providerToolSmoke.js"],
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });

  assert.equal(skipped.skipped, true);
  await assert.rejects(
    () => runMimoToolSmoke({
      argv: ["node", "scripts/providerToolSmoke.js", "--required"],
      env: {},
      fetchImpl: async () => {
        throw new Error("fetch should not be called");
      }
    }),
    /MIMO_API_KEY/
  );
});

test("provider tool smoke no-key skip does not require fetch support", async () => {
  const originalFetch = globalThis.fetch;
  try {
    delete globalThis.fetch;
    const skipped = await runMimoToolSmoke({
      argv: ["node", "scripts/providerToolSmoke.js"],
      env: {}
    });

    assert.equal(skipped.skipped, true);
    assert.equal(skipped.provider, "mimo");
  } finally {
    globalThis.fetch = originalFetch;
  }

  try {
    delete globalThis.fetch;
    await assert.rejects(
      () => runMimoToolSmoke({
        argv: ["node", "scripts/providerToolSmoke.js"],
        env: { MIMO_API_KEY: "mimo-key" }
      }),
      /requires global fetch support/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider tool smoke config reads model, base URL, auth and required flags", () => {
  const config = readMimoToolSmokeConfig({
    argv: ["node", "scripts/providerToolSmoke.js", "--provider", "mimo", "--model", "mimo-test", "--base-url=https://example.test/v1"],
    env: {
      MIMO_API_KEY: "key",
      MIMO_AUTH_HEADER: "authorization",
      MIMO_REQUIRED: "1",
      AI_PROVIDER_TIMEOUT_MS: "1234"
    }
  });

  assert.equal(config.apiKey, "key");
  assert.equal(config.provider, "mimo");
  assert.equal(config.model, "mimo-test");
  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.equal(config.authHeader, "authorization");
  assert.equal(config.required, true);
  assert.equal(config.timeoutMs, 1234);

  assert.throws(
    () => readMimoToolSmokeConfig({
      argv: ["node", "scripts/providerToolSmoke.js", "--provider", "openai"],
      env: {}
    }),
    /only --provider mimo/
  );
});

test("provider tool smoke headers support api-key and bearer modes", () => {
  assert.deepEqual(buildMimoToolSmokeHeaders("abc", "api-key"), {
    "Content-Type": "application/json",
    "api-key": "abc"
  });
  assert.deepEqual(buildMimoToolSmokeHeaders("abc", "authorization"), {
    "Content-Type": "application/json",
    Authorization: "Bearer abc"
  });
});

test("provider tool smoke request body carries tools and tool_choice", () => {
  const body = buildMimoToolRequestBody({
    config: { model: "mimo-test" },
    messages: [{ role: "user", content: "读上下文" }],
    tools: [{ type: "function", function: { name: "world_read_visible_context" } }],
    toolChoice: { type: "function", function: { name: "world_read_visible_context" } }
  });

  assert.equal(body.model, "mimo-test");
  assert.equal(body.tools.length, 1);
  assert.deepEqual(body.tool_choice, { type: "function", function: { name: "world_read_visible_context" } });
  assert.equal(body.stream, false);
});

test("provider tool smoke normalizes OpenAI-compatible tool calls", () => {
  assert.deepEqual(parseToolArguments("{\"query\":\"科举\",\"domains\":[\"exam\"],\"maxItems\":3}"), {
    query: "科举",
    domains: ["exam"],
    maxItems: 3
  });

  const calls = extractToolCalls({
    choices: [{
      message: {
        tool_calls: [{
          id: "call_1",
          type: "function",
          function: {
            name: "world_read_visible_context",
            arguments: "{\"domains\":[\"exam\"],\"query\":\"科举\",\"maxItems\":3}"
          }
        }]
      }
    }]
  });

  assert.deepEqual(calls, [{
    id: "call_1",
    name: "world_read_visible_context",
    arguments: {
      domains: ["exam"],
      query: "科举",
      maxItems: 3
    }
  }]);
});

test("provider tool smoke redacts provider error body summaries", () => {
  const summary = summarizeProviderErrorBody(
    "bad sk-abcdefghijklmnopqrstuvwxyz and tp-1234567890 at E:\\LSMNQ\\.env, E:/LSMNQ/.env and file:///E:/LSMNQ/.env"
  );

  assert.equal(summary.includes("sk-"), false);
  assert.equal(summary.includes("tp-"), false);
  assert.equal(summary.includes("E:\\"), false);
  assert.equal(summary.includes("E:/"), false);
  assert.equal(summary.includes("file:///"), false);
  assert.match(summary, /\[REDACTED_KEY\]/);
  assert.match(summary, /\[REDACTED_PATH\]/);
});

test("provider tool smoke runs forced tool and roundtrip probes with fake fetch", async () => {
  const bodies = [];
  const fetchImpl = async (_endpoint, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) {
      return makeJsonResponse({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_1",
              type: "function",
              function: {
                name: "world_read_visible_context",
                arguments: JSON.stringify({
                  domains: ["exam", "people"],
                  query: "书生科举",
                  maxItems: 3
                })
              }
            }]
          }
        }]
      });
    }

    return makeJsonResponse({
      choices: [{
        message: {
          role: "assistant",
          content: "已依据工具返回的可见摘要作出一句话总结。"
        }
      }]
    });
  };

  const result = await runMimoToolSmoke({
    argv: ["node", "scripts/providerToolSmoke.js"],
    env: {
      MIMO_API_KEY: "mimo-key",
      MIMO_MODEL: "mimo-test",
      MIMO_BASE_URL: "https://example.test/v1",
      AI_PROVIDER_TIMEOUT_MS: "1000"
    },
    fetchImpl
  });

  assert.equal(result.skipped, false);
  assert.equal(result.cases.length, 2);
  assert.equal(result.cases[0].phase, "forced_tool");
  assert.equal(result.cases[1].phase, "tool_result_roundtrip");
  assert.equal(bodies[0].tool_choice.function.name, "world_read_visible_context");
  assert.equal(bodies[1].tool_choice, "none");
  assert.equal(bodies[1].messages.some((message) => message.role === "tool"), true);
});
