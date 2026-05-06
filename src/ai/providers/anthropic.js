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

  function buildMessageParams({ instructions, input, schema, maxOutputTokens }) {
    return {
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
    };
  }

  function getStreamingTextDelta(event) {
    if (event.type !== "content_block_delta" || !event.delta) return "";
    if (event.delta.type === "text_delta") return event.delta.text || "";
    if (event.delta.type === "input_json_delta") return event.delta.partial_json || "";
    return "";
  }

  return createRemoteProvider(async (task) => {
    const message = await client.messages.create(buildMessageParams(task));

    return getTextFromMessage(message);
  }, async (task) => {
    const stream = client.messages.stream(buildMessageParams(task));

    for await (const event of stream) {
      const delta = getStreamingTextDelta(event);
      if (!delta) continue;
      task.onTextDelta(delta);
    }

    return getTextFromMessage(await stream.finalMessage());
  });
}

module.exports = {
  createAnthropicProvider
};
