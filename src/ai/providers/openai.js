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

  return createRemoteProvider(async ({ instructions, input, schemaName, schema, maxOutputTokens }) => {
    const response = await client.responses.create({
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
    });

    return response.output_text;
  });
}

module.exports = {
  createOpenAiProvider
};
