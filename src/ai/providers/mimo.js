const { createRemoteProvider, readTimeoutMs, requireEnv } = require("./remoteHelpers");

const DEFAULT_MIMO_BASE_URL = "https://token-plan-sgp.xiaomimimo.com/v1";
const DEFAULT_MIMO_MODEL = "mimo-v2.5-pro";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildChatCompletionsUrl(baseUrl = process.env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL) {
  const value = trimTrailingSlash(baseUrl);
  if (value.endsWith("/chat/completions")) return value;
  return `${value}/chat/completions`;
}

function readMimoModel() {
  return process.env.MIMO_MODEL || DEFAULT_MIMO_MODEL;
}

function readMimoThinkingMode() {
  const value = String(process.env.MIMO_THINKING || "disabled").trim().toLowerCase();
  return value === "enabled" ? "enabled" : "disabled";
}

function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function buildMimoHeaders(apiKey) {
  const authHeader = String(process.env.MIMO_AUTH_HEADER || "api-key").trim().toLowerCase();
  const headers = {
    "Content-Type": "application/json"
  };

  if (authHeader === "authorization" || authHeader === "bearer") {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers["api-key"] = apiKey;
  }

  return headers;
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    if (typeof part.text === "string") return part.text;
    if (typeof part.content === "string") return part.content;
    return "";
  }).join("");
}

function extractChoiceText(choice) {
  return extractTextContent(choice?.message?.content ?? choice?.delta?.content ?? choice?.text);
}

function truncateErrorBody(text, maxLength = 500) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MiMo API request failed with ${response.status}: ${truncateErrorBody(text)}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`MiMo API returned non-JSON response: ${truncateErrorBody(text)}`);
  }
}

function createAbortController(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

async function postMimoRequest({ fetchImpl, endpoint, apiKey, body, timeoutMs }) {
  const { controller, timeoutId } = createAbortController(timeoutMs);

  try {
    return await fetchImpl(endpoint, {
      method: "POST",
      headers: buildMimoHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`MiMo provider timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCompletionParams({ instructions, input, schemaName, schema, maxOutputTokens }) {
  return {
    model: readMimoModel(),
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
    max_completion_tokens: maxOutputTokens,
    temperature: readNumberEnv("MIMO_TEMPERATURE", 0.7),
    top_p: readNumberEnv("MIMO_TOP_P", 0.95),
    stream: false,
    response_format: { type: "json_object" },
    thinking: { type: readMimoThinkingMode() }
  };
}

function processSseLine(line, onTextDelta) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("data:")) return false;

  const data = trimmed.slice(5).trim();
  if (!data) return false;
  if (data === "[DONE]") return true;

  const payload = JSON.parse(data);
  const delta = extractChoiceText(payload.choices?.[0]);
  if (delta) onTextDelta(delta);
  return false;
}

async function readStreamingResponse(response, onTextDelta) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiMo API stream failed with ${response.status}: ${truncateErrorBody(text)}`);
  }
  if (!response.body?.getReader) {
    throw new Error("MiMo API stream response has no readable body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (processSseLine(line, onTextDelta)) return;
    }
  }

  buffer += decoder.decode();
  for (const line of buffer.split(/\r?\n/)) {
    if (processSseLine(line, onTextDelta)) return;
  }
}

function createMimoProvider(options = {}) {
  const apiKey = requireEnv("MIMO_API_KEY", "MiMo");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("MiMo provider requires global fetch support.");
  }

  const endpoint = buildChatCompletionsUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs || readTimeoutMs();

  return createRemoteProvider(async (task) => {
    const response = await postMimoRequest({
      fetchImpl,
      endpoint,
      apiKey,
      body: buildCompletionParams(task),
      timeoutMs
    });
    const payload = await parseJsonResponse(response);
    return extractChoiceText(payload.choices?.[0]);
  }, async (task) => {
    const response = await postMimoRequest({
      fetchImpl,
      endpoint,
      apiKey,
      body: {
        ...buildCompletionParams(task),
        stream: true
      },
      timeoutMs
    });

    await readStreamingResponse(response, task.onTextDelta);
  });
}

module.exports = {
  DEFAULT_MIMO_BASE_URL,
  DEFAULT_MIMO_MODEL,
  buildChatCompletionsUrl,
  buildCompletionParams,
  buildMimoHeaders,
  createMimoProvider,
  extractTextContent,
  readMimoModel,
  readMimoThinkingMode
};
