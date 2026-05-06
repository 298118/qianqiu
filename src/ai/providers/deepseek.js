const OpenAI = require("openai");
const { createRemoteProvider, readTimeoutMs, requireEnv } = require("./remoteHelpers");

function createDeepSeekProvider() {
  const apiKey = requireEnv("DEEPSEEK_API_KEY", "DeepSeek");
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 0,
    timeout: readTimeoutMs()
  });
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  function buildCompletionParams({ instructions, input, schemaName, schema, maxOutputTokens }) {
    return {
      model,
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
      max_tokens: maxOutputTokens,
      temperature: 0.7,
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
  createDeepSeekProvider
};
