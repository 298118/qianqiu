const OpenAI = require("openai");
const { createRemoteProvider, readTimeoutMs, requireEnv } = require("./remoteHelpers");

function createOpenAiProvider() {
  const apiKey = requireEnv("OPENAI_API_KEY", "OpenAI");
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    maxRetries: 0,
    timeout: readTimeoutMs()
  });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  function buildResponseParams({ instructions, input, schemaName, schema, maxOutputTokens }) {
    return {
      model,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: `qianqiu_${schemaName}`,
          schema,
          strict: false
        }
      }
    };
  }

  return createRemoteProvider(async (task) => {
    const response = await client.responses.create(buildResponseParams(task));

    return response.output_text;
  }, async (task) => {
    const stream = await client.responses.create({
      ...buildResponseParams(task),
      stream: true
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && event.delta) {
        task.onTextDelta(event.delta);
      }
    }
  });
}

module.exports = {
  createOpenAiProvider
};
