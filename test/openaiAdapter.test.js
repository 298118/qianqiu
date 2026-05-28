const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDefaultModelRoutePolicy } = require("../src/ai/modelRoutePolicy");
const {
  createRuntimeTaskEnvelope
} = require("../src/ai/providers/adapterContract");
const {
  buildOpenAiChatStructuredRequest,
  buildOpenAiStructuredRequest,
  createOpenAiAdapter
} = require("../src/ai/providers/openaiAdapter");
const { runAiTask } = require("../src/ai/runtime/aiTaskRuntime");
const { validatePayload } = require("../src/ai/schemas");

const openingPayload = {
  narrative: "县学晨钟初歇，书案上墨香未散。",
  events: ["县学晨读。"]
};

function createOpeningTask(route = {}) {
  return {
    schemaName: "opening",
    instructions: "以明代县学书生开局，返回严格 JSON。",
    input: "玩家顾慎初入县学。",
    maxOutputTokens: 999,
    route
  };
}

test("S92.3 OpenAI adapter sends strict Responses JSON schema only when route opts in", async () => {
  const calls = [];
  const route = {
    model: "route-openai-model",
    maxOutputTokens: 444,
    temperature: 0.1,
    allowStrictSchema: true
  };
  const adapter = createOpenAiAdapter({
    route,
    model: "route-openai-model",
    client: {
      responses: {
        create: async (params) => {
          calls.push(params);
          return {
            output_text: JSON.stringify(openingPayload),
            usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 }
          };
        }
      }
    }
  });

  const result = await adapter.generateStructured(createOpeningTask(route));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "route-openai-model");
  assert.equal(calls[0].max_output_tokens, 444);
  assert.equal(calls[0].temperature, 0.1);
  assert.equal(calls[0].text.format.type, "json_schema");
  assert.equal(calls[0].text.format.name, "qianqiu_opening");
  assert.equal(calls[0].text.format.strict, true);
  assert.equal(validatePayload("opening", result.payload), result.payload);
  assert.equal(result.strictStructuredOutput, true);
  assert.deepEqual(result.usage, {
    inputTokens: 11,
    outputTokens: 7,
    totalTokens: 18,
    estimated: false
  });
  assert.equal("output_text" in result, false);
});

test("S92.3 OpenAI adapter keeps schema output but disables strict without route opt-in", async () => {
  const calls = [];
  const route = {
    model: "route-openai-model",
    maxOutputTokens: 333,
    temperature: 0.2
  };
  const adapter = createOpenAiAdapter({
    route,
    model: "route-openai-model",
    client: {
      responses: {
        create: async (params) => {
          calls.push(params);
          return { output_text: JSON.stringify(openingPayload) };
        }
      }
    }
  });

  const result = await adapter.generateStructured(createOpeningTask(route));

  assert.equal(calls[0].text.format.type, "json_schema");
  assert.equal(calls[0].text.format.strict, false);
  assert.equal(result.strictStructuredOutput, false);
  assert.equal(validatePayload("opening", result.payload), result.payload);
});

test("S92.3 OpenAI adapter requires boolean route opt-in and strict capability", async () => {
  const calls = [];
  const cases = [{
    route: {
      model: "route-openai-model",
      allowStrictSchema: "false"
    },
    options: {}
  }, {
    route: {
      model: "route-openai-model",
      allowStrictSchema: true
    },
    options: {
      supportsStrictStructuredOutput: false
    }
  }];

  for (const item of cases) {
    const adapter = createOpenAiAdapter({
      route: item.route,
      model: "route-openai-model",
      ...item.options,
      client: {
        responses: {
          create: async (params) => {
            calls.push(params);
            return { output_text: JSON.stringify(openingPayload) };
          }
        }
      }
    });

    const result = await adapter.generateStructured(createOpeningTask(item.route));
    assert.equal(validatePayload("opening", result.payload), result.payload);
  }

  assert.deepEqual(calls.map((call) => call.text.format.strict), [false, false]);
});

test("S92.3 OpenAI adapter downgrades strict unsupported errors to non-strict schema request", async () => {
  const calls = [];
  const route = {
    model: "route-openai-model",
    allowStrictSchema: true
  };
  const adapter = createOpenAiAdapter({
    route,
    model: "route-openai-model",
    client: {
      responses: {
        create: async (params) => {
          calls.push(params);
          if (params.text.format.strict) {
            throw new Error("OpenAI API request failed with 400: unsupported strict json_schema responseBody=SECRET sk-test-secret baseURL=https://api.example.test");
          }
          return { output_text: JSON.stringify(openingPayload) };
        }
      }
    }
  });

  const result = await adapter.generateStructured(createOpeningTask(route));

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.text.format.strict), [true, false]);
  assert.equal(result.strictStructuredOutput, false);
  assert.equal(validatePayload("opening", result.payload), result.payload);
});

test("S92.3 OpenAI adapter supports Chat Completions-compatible fake clients", async () => {
  const calls = [];
  const route = {
    model: "chat-compatible-model",
    allowStrictSchema: true,
    maxOutputTokens: 222,
    temperature: 0.3
  };
  const adapter = createOpenAiAdapter({
    route,
    model: "chat-compatible-model",
    client: {
      chat: {
        completions: {
          create: async (params) => {
            calls.push(params);
            return {
              choices: [{ message: { content: JSON.stringify(openingPayload) } }],
              usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 }
            };
          }
        }
      }
    }
  });

  const result = await adapter.generateStructured(createOpeningTask(route));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "chat-compatible-model");
  assert.equal(calls[0].max_tokens, 222);
  assert.equal(calls[0].temperature, 0.3);
  assert.equal(calls[0].response_format.type, "json_schema");
  assert.equal(calls[0].response_format.json_schema.strict, true);
  assert.equal(calls[0].response_format.json_schema.name, "qianqiu_opening");
  assert.equal(validatePayload("opening", result.payload), result.payload);
  assert.deepEqual(result.usage, {
    inputTokens: 5,
    outputTokens: 6,
    totalTokens: 11,
    estimated: false
  });
});

test("S92.3 OpenAI request builders preserve schema and map Responses params to Chat params", () => {
  const route = {
    model: "builder-model",
    allowStrictSchema: true,
    maxOutputTokens: 128,
    temperature: 0.4
  };
  const responseParams = buildOpenAiStructuredRequest(createOpeningTask(route), {
    route,
    model: "builder-model"
  });
  const chatParams = buildOpenAiChatStructuredRequest(responseParams);

  assert.equal(responseParams.text.format.name, "qianqiu_opening");
  assert.equal(responseParams.text.format.strict, true);
  assert.equal(responseParams.max_output_tokens, 128);
  assert.equal(chatParams.response_format.json_schema.name, "qianqiu_opening");
  assert.equal(chatParams.response_format.json_schema.strict, true);
  assert.equal(chatParams.max_tokens, 128);
  assert.equal(chatParams.messages[0].role, "system");
  assert.equal(chatParams.messages[1].role, "user");
});

test("S92.3 OpenAI adapter schema failures remain local and let runtime fallback safely", async () => {
  const routePolicy = buildDefaultModelRoutePolicy({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key"
  });
  routePolicy.routes.quick_action = {
    ...routePolicy.routes.quick_action,
    provider: "openai",
    model: "route-openai-model",
    allowStrictSchema: true
  };
  const adapter = createOpenAiAdapter({
    route: routePolicy.routes.quick_action,
    model: "route-openai-model",
    client: {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            quickActionSuggestions: [{
              title: "温书",
              label: "温书",
              text: "温读四书章句。",
              roleTags: ["scholar"],
              toolIntent: "study",
              evidenceRefs: [],
              source: "provider-ai",
              rawPrompt: "prompt=SECRET key=abc123 token=tok123 sk-test-secret C:\\Users\\ZZZ\\Downloads\\secret.json"
            }],
            providerPayload: { baseURL: "https://api.example.test" }
          })
        })
      }
    }
  });
  const envelope = {
    ...createRuntimeTaskEnvelope("quick_action", {
      player: { role: "scholar" },
      evidenceRefs: []
    }, {
      taskId: "s92-3-openai-runtime-fallback"
    }),
    instructions: "生成快捷行动 JSON。",
    input: "玩家正在县学读书。"
  };

  const result = await runAiTask(envelope, {
    routePolicy,
    adapter,
    allowNonMockRoute: true,
    allowNonMockAdapter: true
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "fallback");
  assert.equal(result.fallback, true);
  assert.equal(validatePayload("quickAction", result.payload), result.payload);
  assert.doesNotMatch(
    serialized,
    /SECRET|abc123|tok123|sk-test-secret|Downloads|rawPrompt|providerPayload|baseURL|prompt=|key=|token=/i
  );
  assert.doesNotMatch(serialized, /"(?:instructions|input|request|response)"\s*:/i);
});
