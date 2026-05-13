const OpenAI = require("openai");
const { createRemoteProvider, readTimeoutMs, requireEnv } = require("./remoteHelpers");

const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

const TASK_MODEL_ENV = {
  opening: "DEEPSEEK_OPENING_MODEL",
  turn: "DEEPSEEK_TURN_MODEL",
  examQuestion: "DEEPSEEK_EXAM_QUESTION_MODEL",
  grade: "DEEPSEEK_GRADE_MODEL"
};

function readTaskModel(schemaName) {
  const taskEnvName = TASK_MODEL_ENV[schemaName];
  return (
    (taskEnvName && process.env[taskEnvName]) ||
    process.env.DEEPSEEK_MODEL ||
    DEFAULT_DEEPSEEK_MODEL
  );
}

function applyRouteTokenBudget(taskMaxOutputTokens, routeMaxOutputTokens) {
  const routeValue = Number(routeMaxOutputTokens);
  return Number.isFinite(routeValue) && routeValue > 0 ? Math.trunc(routeValue) : taskMaxOutputTokens;
}

function createDeepSeekProvider(options = {}) {
  const route = options.route || {};
  const apiKey = requireEnv("DEEPSEEK_API_KEY", "DeepSeek");
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 0,
    timeout: route.timeoutMs || readTimeoutMs()
  });

  function buildCompletionParams({ instructions, input, schemaName, schema, maxOutputTokens }) {
    return {
      model: route.model || readTaskModel(schemaName),
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: [
            input,
            "",
            `Return JSON for schema qianqiu_${schemaName}:`,
            JSON.stringify(schema)
          ].join("\n")
        }
      ],
      max_tokens: applyRouteTokenBudget(maxOutputTokens, route.maxOutputTokens),
      temperature: Number.isFinite(Number(route.temperature)) ? Number(route.temperature) : 0.7,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" }
    };
  }

  return createRemoteProvider(async (task) => {
    const response = await client.chat.completions.create(buildCompletionParams(task));

    return response.choices?.[0]?.message?.content || "";
  }, async (task) => {
    const stream = await client.chat.completions.create({
      ...buildCompletionParams(task),
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) task.onTextDelta(delta);
    }
  });
}

module.exports = {
  createDeepSeekProvider,
  readTaskModel,
  TASK_MODEL_ENV
};
