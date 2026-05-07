const assert = require("assert/strict");
const test = require("node:test");

const {
  DEFAULT_MIMO_BASE_URL,
  buildChatCompletionsUrl,
  buildMimoHeaders,
  createMimoProvider,
  readMimoModel,
  readMimoThinkingMode
} = require("../src/ai/providers/mimo");
const { createInitialState } = require("../src/game/initialState");

function withEnv(overrides, fn) {
  const keys = [
    "MIMO_API_KEY",
    "MIMO_AUTH_HEADER",
    "MIMO_BASE_URL",
    "MIMO_MODEL",
    "MIMO_THINKING",
    "MIMO_TEMPERATURE",
    "MIMO_TOP_P",
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

test("MiMo provider defaults to the official API id for the 1m-capable Pro model", () => {
  return withEnv({}, () => {
    assert.equal(DEFAULT_MIMO_BASE_URL, "https://token-plan-sgp.xiaomimimo.com/v1");
    assert.equal(
      buildChatCompletionsUrl(),
      "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"
    );
    assert.equal(readMimoModel(), "mimo-v2.5-pro");
    assert.equal(readMimoThinkingMode(), "disabled");
  });
});

test("MiMo provider builds Token Plan OpenAI-compatible chat completion requests", async () => {
  await withEnv({
    MIMO_API_KEY: "tp-test-token-plan-key",
    MIMO_BASE_URL: "https://token-plan-sgp.xiaomimimo.com/v1",
    MIMO_MODEL: "mimo-v2.5-pro"
  }, async () => {
    const calls = [];
    const provider = createMimoProvider({
      timeoutMs: 1000,
      fetchImpl: async (url, options) => {
        calls.push({
          url,
          headers: options.headers,
          body: JSON.parse(options.body)
        });

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  narrative: "县学灯火未灭，塾师点检书箱。",
                  events: ["连接校验未落盘。"]
                })
              }
            }]
          })
        };
      }
    });

    const opening = await provider.startGame(createInitialState({
      dynasty: "明",
      year: 1644,
      role: "scholar",
      playerName: "米模校验"
    }));

    assert.equal(opening.narrative.includes("县学"), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions");
    assert.equal(calls[0].headers["api-key"], "tp-test-token-plan-key");
    assert.equal(calls[0].headers.Authorization, undefined);
    assert.equal(calls[0].body.model, "mimo-v2.5-pro");
    assert.equal(calls[0].body.response_format.type, "json_object");
    assert.equal(calls[0].body.thinking.type, "disabled");
    assert.equal(calls[0].body.stream, false);
    assert.equal(typeof calls[0].body.max_completion_tokens, "number");
  });
});

test("MiMo URL and auth helpers support official compatibility variants", () => {
  assert.equal(
    buildChatCompletionsUrl("https://token-plan-sgp.xiaomimimo.com/v1/"),
    "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"
  );
  assert.equal(
    buildChatCompletionsUrl("https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"),
    "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions"
  );

  return withEnv({ MIMO_AUTH_HEADER: "bearer" }, () => {
    assert.deepEqual(buildMimoHeaders("tp-token"), {
      "Content-Type": "application/json",
      Authorization: "Bearer tp-token"
    });
  });
});
