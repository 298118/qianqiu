const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MODEL_TASK_TYPES,
  buildDefaultModelRoutePolicy,
  resolveModelForTask,
  summarizeModelRoutePolicy,
  validateModelRoutePolicy
} = require("../src/ai/modelRoutePolicy");
const { getProviderForTask } = require("../src/ai");
const { createInitialState } = require("../src/game/initialState");

function withEnv(overrides, fn) {
  const keys = [
    "MIMO_API_KEY",
    "MIMO_MODEL",
    "MIMO_BASE_URL",
    "AI_PROVIDER",
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

function withMockedModule(moduleName, fakeExports, loadModule) {
  const modulePath = require.resolve(moduleName);
  const originalDependency = require.cache[modulePath];
  const targetPath = require.resolve(loadModule.path);
  const originalTarget = require.cache[targetPath];

  delete require.cache[targetPath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: fakeExports
  };

  try {
    return loadModule();
  } finally {
    delete require.cache[targetPath];
    if (originalTarget) require.cache[targetPath] = originalTarget;
    if (originalDependency) require.cache[modulePath] = originalDependency;
    else delete require.cache[modulePath];
  }
}

test("S70.8 default model route policy covers all AI task types", () => {
  const policy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" });
  assert.deepEqual(Object.keys(policy.routes).sort(), [...MODEL_TASK_TYPES].sort());

  for (const taskType of MODEL_TASK_TYPES) {
    const route = resolveModelForTask(taskType, policy);
    assert.equal(route.provider, "mock");
    assert.equal(route.mayWriteState, false);
    assert.equal(route.mayCallServerResolvers, false);
    assert.ok(route.maxOutputTokens > 0);
  }
});

test("S70.8 mimo-deepseek policy separates narrator and reviewer tasks", () => {
  const policy = buildDefaultModelRoutePolicy({
    AI_PROVIDER: "mimo-deepseek",
    MIMO_MODEL: "mimo-v2.5-pro",
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_GRADE_MODEL: "deepseek-v4-pro"
  });

  assert.equal(resolveModelForTask("narrator", policy).provider, "mimo");
  assert.equal(resolveModelForTask("actor_mind", policy).provider, "mimo");
  assert.equal(resolveModelForTask("domain_specialist", policy).provider, "deepseek");
  assert.equal(resolveModelForTask("critic", policy).provider, "deepseek");
  assert.equal(resolveModelForTask("critic", policy).model, "deepseek-v4-pro");
  assert.equal(resolveModelForTask("safety_gate", policy).toolBudget, 0);
});

test("S70.8 mock provider remains fully local even when real keys exist", () => {
  const policy = buildDefaultModelRoutePolicy({
    AI_PROVIDER: "mock",
    DEEPSEEK_API_KEY: "test-key",
    MIMO_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key",
    ANTHROPIC_API_KEY: "test-key",
    AI_NARRATOR_PROVIDER: "openai",
    AI_DOMAIN_PROVIDER: "deepseek",
    AI_CRITIC_PROVIDER: "anthropic",
    AI_SAFETY_PROVIDER: "mimo"
  });

  assert.equal(resolveModelForTask("narrator", policy).provider, "mock");
  assert.equal(resolveModelForTask("domain_specialist", policy).provider, "mock");
  assert.equal(resolveModelForTask("critic", policy).provider, "mock");
  assert.equal(resolveModelForTask("safety_gate", policy).provider, "mock");
});

test("S70.8 policy validation keeps critic and safety review-only", () => {
  const policy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" });
  policy.routes.critic = {
    ...policy.routes.critic,
    mayUseTools: true,
    toolBudget: 1
  };

  assert.throws(
    () => validateModelRoutePolicy(policy),
    /Review-only route critic cannot use tools/
  );
});

test("S70.8 policy validation rejects server resolver exposure", () => {
  const policy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" });
  policy.routes.safety_gate = {
    ...policy.routes.safety_gate,
    model: "server.resolve_case"
  };

  assert.throws(
    () => validateModelRoutePolicy(policy),
    /server\.\*/
  );
});

test("S70.8 provider facade can resolve a provider by task type", () => {
  const policy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" });
  const provider = getProviderForTask("monthly_briefing", { routePolicy: policy });

  assert.equal(typeof provider.runTurn, "function");
  assert.deepEqual(provider.modelRoute, {
    taskType: "monthly_briefing",
    provider: "mock",
    model: "mock",
    reviewerOnly: false,
    mayUseTools: true,
    mayRequestAdjudication: false,
    maxOutputTokens: 1600,
    timeoutMs: 30000,
    temperature: 0.35
  });
});

test("S70.8 reviewer-only task providers reject gameplay methods by default", async () => {
  const policy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mock" });
  const provider = getProviderForTask("critic", { routePolicy: policy });

  assert.equal(provider.modelRoute.reviewerOnly, true);
  await assert.rejects(
    () => provider.runTurn(createInitialState({ role: "scholar" }), "请裁决天下。"),
    /review-only/
  );
});

test("S70.8 routed provider passes model and budget into actual adapter requests", async () => {
  await withEnv({
    MIMO_API_KEY: "tp-test-token-plan-key",
    MIMO_BASE_URL: "https://token-plan-sgp.xiaomimimo.com/v1",
    MIMO_MODEL: "env-model-should-not-win"
  }, async () => {
    const routePolicy = buildDefaultModelRoutePolicy({ AI_PROVIDER: "mimo" });
    routePolicy.routes.narrator = {
      ...routePolicy.routes.narrator,
      provider: "mimo",
      model: "route-model",
      maxOutputTokens: 333,
      temperature: 0.2,
      timeoutMs: 1234
    };

    const calls = [];
    const provider = getProviderForTask("narrator", {
      routePolicy,
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  narrative: "县学灯火未灭，士友仍论经义。",
                  events: ["县学论经。"]
                })
              }
            }]
          })
        };
      }
    });

    const opening = await provider.startGame(createInitialState({ role: "scholar" }));
    assert.equal(opening.events.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.model, "route-model");
    assert.equal(calls[0].body.max_completion_tokens, 333);
    assert.equal(calls[0].body.temperature, 0.2);
  });
});

test("S70.8 OpenAI route passes model, temperature, timeout, and token budget into requests", async () => {
  const calls = [];

  await withEnv({
    OPENAI_API_KEY: "openai-test-key"
  }, async () => {
    const { createOpenAiProvider } = withMockedModule("openai", class FakeOpenAI {
      constructor(options) {
        calls.push({ constructorOptions: options });
        this.responses = {
          create: async (params) => {
            calls.push({ params });
            return {
              output_text: JSON.stringify({
                narrative: "县学晨钟方歇，诸生整衣入讲堂。",
                events: ["县学开讲。"]
              })
            };
          }
        };
      }
    }, Object.assign(
      () => require("../src/ai/providers/openai"),
      { path: "../src/ai/providers/openai" }
    ));

    const provider = createOpenAiProvider({
      route: {
        model: "route-openai-model",
        maxOutputTokens: 444,
        temperature: 0.1,
        timeoutMs: 4321
      }
    });

    const opening = await provider.startGame(createInitialState({ role: "scholar" }));
    assert.equal(opening.events.length, 1);
  });

  assert.equal(calls[0].constructorOptions.timeout, 4321);
  assert.equal(calls[1].params.model, "route-openai-model");
  assert.equal(calls[1].params.max_output_tokens, 444);
  assert.equal(calls[1].params.temperature, 0.1);
});

test("S70.8 Anthropic route passes model, temperature, timeout, and token budget into requests", async () => {
  const calls = [];

  await withEnv({
    ANTHROPIC_API_KEY: "anthropic-test-key"
  }, async () => {
    const { createAnthropicProvider } = withMockedModule("@anthropic-ai/sdk", class FakeAnthropic {
      constructor(options) {
        calls.push({ constructorOptions: options });
        this.messages = {
          create: async (params) => {
            calls.push({ params });
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  narrative: "贡院鼓声初定，帘内外皆肃然。",
                  events: ["贡院入场。"]
                })
              }]
            };
          }
        };
      }
    }, Object.assign(
      () => require("../src/ai/providers/anthropic"),
      { path: "../src/ai/providers/anthropic" }
    ));

    const provider = createAnthropicProvider({
      route: {
        model: "route-anthropic-model",
        maxOutputTokens: 555,
        temperature: 0.05,
        timeoutMs: 5432
      }
    });

    const opening = await provider.startGame(createInitialState({ role: "scholar" }));
    assert.equal(opening.events.length, 1);
  });

  assert.equal(calls[0].constructorOptions.timeout, 5432);
  assert.equal(calls[1].params.model, "route-anthropic-model");
  assert.equal(calls[1].params.max_tokens, 555);
  assert.equal(calls[1].params.temperature, 0.05);
});

test("S70.8 route summary is hidden-safe and bounded", () => {
  const summary = summarizeModelRoutePolicy(buildDefaultModelRoutePolicy({
    AI_PROVIDER: "mimo",
    MIMO_API_KEY: "sk-should-not-appear",
    MIMO_MODEL: "mimo-v2.5-pro"
  }));
  const serialized = JSON.stringify(summary);

  assert.ok(serialized.includes("mimo-v2.5-pro"));
  assert.ok(!serialized.includes("sk-should-not-appear"));
  assert.ok(!serialized.includes("raw"));
  assert.ok(!serialized.includes("server."));
});
