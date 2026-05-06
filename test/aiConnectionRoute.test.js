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
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return server.close();
  });

  const { response, payload } = await postJson(`${server.baseUrl}/api/ai/connection-test`);
  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.provider, "deepseek");
  assert.match(payload.error, /DEEPSEEK_API_KEY/);
});
