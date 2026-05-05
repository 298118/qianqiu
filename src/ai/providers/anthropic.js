const Anthropic = require("@anthropic-ai/sdk");
const { createRemoteProvider, readTimeoutMs, requireEnv } = require("./remoteHelpers");

function getTextFromMessage(message) {
  if (message.parsed_output) {
    return message.parsed_output;
  }

  return (message.content || [])
    .filter((block) => block && block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function createAnthropicProvider() {
  const apiKey = requireEnv("ANTHROPIC_API_KEY", "Claude");
  const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: readTimeoutMs()
  });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  return createRemoteProvider(async ({ instructions, input, schema, maxOutputTokens }) => {
    const message = await client.messages.create({
      model,
      max_tokens: maxOutputTokens,
      system: instructions,
      messages: [{ role: "user", content: input }],
      output_config: {
        format: {
          type: "json_schema",
          schema
        }
      }
    });

    return getTextFromMessage(message);
  });
}

module.exports = {
  createAnthropicProvider
};
