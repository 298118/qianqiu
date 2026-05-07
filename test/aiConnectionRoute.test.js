const assert = require("assert/strict");
const test = require("node:test");
const express = require("express");

const aiRoutes = require("../src/routes/ai");
const { createFetchSafeServer } = require("../test-helpers/fetchSafeServer");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return createFetchSafeServer(app);
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("POST /api/ai/connection-test returns mock diagnostic without secrets", async (t) => {
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "mock";
  const server = createTestServer();
  t.after(() => {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`);
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, "mock");
  assert.ok(!JSON.stringify(payload).includes("API_KEY"));
});

test("POST /api/ai/connection-test returns 503 for missing real-provider key", async (t) => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
  };
  process.env.AI_PROVIDER = "deepseek";
  delete process.env.DEEPSEEK_API_KEY;
  const server = createTestServer();
  t.after(() => {
    restoreEnv(previous);
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`);
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.provider, "deepseek");
  assert.match(payload.error, /DEEPSEEK_API_KEY/);
});

test("POST /api/ai/connection-test honors requested provider over configured provider", async (t) => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
  };
  process.env.AI_PROVIDER = "deepseek";
  delete process.env.DEEPSEEK_API_KEY;
  const server = createTestServer();
  t.after(() => {
    restoreEnv(previous);
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`, {
    provider: "mock"
  });
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, "mock");
  assert.equal(payload.configuredProvider, "deepseek");
  assert.equal(payload.models.default, "mock");
});

test("POST /api/ai/connection-test returns controlled 503 for unknown provider", async (t) => {
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "mock";
  const server = createTestServer();
  t.after(() => {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`, {
    provider: "unknown"
  });
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.provider, "unknown");
  assert.match(payload.error, /Unknown AI provider/);
});

test("POST /api/ai/connection-test maps claude alias to Anthropic key checks", async (t) => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  };
  process.env.AI_PROVIDER = "mock";
  delete process.env.ANTHROPIC_API_KEY;
  const server = createTestServer();
  t.after(() => {
    restoreEnv(previous);
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`, {
    provider: "claude"
  });
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.provider, "claude");
  assert.match(payload.error, /ANTHROPIC_API_KEY/);
});

test("POST /api/ai/connection-test maps hybrid alias to MiMo+DeepSeek key checks", async (t) => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    MIMO_API_KEY: process.env.MIMO_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY
  };
  process.env.AI_PROVIDER = "mock";
  delete process.env.MIMO_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  const server = createTestServer();
  t.after(() => {
    restoreEnv(previous);
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`, {
    provider: "hybrid"
  });
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.provider, "mimo-deepseek");
  assert.match(payload.error, /MIMO_API_KEY and DEEPSEEK_API_KEY/);
});
