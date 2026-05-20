// @ts-check

const SECRET_ENV_NAMES = Object.freeze([
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY"
]);

const PUBLIC_AI_FORBIDDEN_KEYS = Object.freeze([
  "rawPayload",
  "rawProviderPayload",
  "providerPayload",
  "rawPrompt",
  "fullPrompt",
  "prompt",
  "instructions",
  "input",
  "request",
  "requestBody",
  "response",
  "responseBody",
  "headers",
  "apiKey",
  "key",
  "token",
  "baseURL",
  "baseUrl",
  "localPath",
  "statePatch",
  "worldState"
]);

const TOKEN_PATTERN = /\b(?:sk|tp)-[A-Za-z0-9_-]{6,}\b/g;
const LOCAL_PATH_PATTERN =
  /(?:data[\\/](?:sessions|audit)[^\s"'<>]*|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+)/gi;
const BASE_URL_ASSIGNMENT_PATTERN = /\bbase(?:URL|Url|_url)?\s*[:=]\s*[^\s"'<>]+/gi;
const PROVIDER_HTTP_BODY_PATTERN =
  /\b((?:MiMo|OpenAI|DeepSeek|Anthropic|Claude)\s+API\s+(?:request|stream)\s+failed\s+with\s+\d{3}\s*:\s*)[\s\S]*/gi;
const PROVIDER_NON_JSON_BODY_PATTERN =
  /\b((?:MiMo|OpenAI|DeepSeek|Anthropic|Claude)\s+API\s+returned\s+non-JSON\s+response\s*:\s*)[\s\S]*/gi;
const RAW_PROVIDER_DETAIL_SEGMENT_PATTERN =
  /(?:raw provider payload|raw[_ -]?(?:provider|payload|prompt|response|request)|rawProviderPayload|providerPayload|rawPrompt|fullPrompt|request body|response body|complete prompt|完整提示词|完整\s*prompt|instructions|requestBody|responseBody)(?:\s*[:=]\s*)?[^;\n。；]*/gi;
const RAW_PROVIDER_DETAIL_PATTERN =
  /(?:raw provider payload|raw[_ -]?(?:provider|payload|prompt|response|request)|rawProviderPayload|providerPayload|rawPrompt|fullPrompt|request body|response body|complete prompt|完整提示词|完整\s*prompt|instructions|requestBody|responseBody)/gi;

function truncate(value, maxLength = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function redactConfiguredSecrets(message) {
  let redacted = String(message || "");
  for (const envName of SECRET_ENV_NAMES) {
    const secret = process.env[envName];
    if (!secret) continue;
    const variants = new Set([secret]);
    if (secret.length >= 8) {
      variants.add(secret.slice(0, 8));
      variants.add(secret.slice(0, 12));
      variants.add(secret.slice(-8));
      variants.add(secret.slice(-12));
    }
    for (const variant of [...variants].filter((value) => value && value.length >= 8)) {
      redacted = redacted.split(variant).join("[redacted]");
    }
  }
  return redacted;
}

/**
 * Provider 错误可能由 SDK 拼入请求摘要、URL、原始响应、prompt 或 token。
 * 这里生成 public-safe 摘要，只保留诊断必要事实，不回显原文载荷。
 *
 * @param {unknown} value
 * @param {{ maxLength?: number }} [options]
 */
function redactAiProviderText(value, options = {}) {
  const source = value && typeof value === "object" && "message" in value
    ? /** @type {{ message?: unknown }} */ (value).message
    : value;
  let message = redactConfiguredSecrets(String(source || ""));
  message = message
    .replace(TOKEN_PATTERN, "[redacted-key]")
    .replace(LOCAL_PATH_PATTERN, "[redacted-path]")
    .replace(BASE_URL_ASSIGNMENT_PATTERN, "[redacted-url]")
    .replace(PROVIDER_HTTP_BODY_PATTERN, "$1[redacted-provider-body]")
    .replace(PROVIDER_NON_JSON_BODY_PATTERN, "$1[redacted-provider-body]")
    .replace(RAW_PROVIDER_DETAIL_SEGMENT_PATTERN, "[redacted-provider-detail]")
    .replace(RAW_PROVIDER_DETAIL_PATTERN, "[redacted-provider-detail]");
  return truncate(message, options.maxLength || 240);
}

/**
 * @param {unknown} error
 */
function describeAiProviderError(error) {
  return redactAiProviderText(error, { maxLength: 240 }) || "AI provider failed.";
}

/**
 * Public AI diagnostics may expose only bounded health metadata.
 * Raw provider request/response, prompt, key, local path, state patch and worldState
 * must stay internal even when future routes accidentally add fields.
 *
 * @param {unknown} payload
 */
function assertPublicAiProviderEnvelope(payload) {
  /** @type {Set<object>} */
  const seen = new Set();

  /**
   * @param {unknown} value
   * @param {string} path
   */
  function visit(value, path) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    for (const [key, entry] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (PUBLIC_AI_FORBIDDEN_KEYS.includes(key)) {
        throw new Error(`Public AI provider envelope contains forbidden field: ${nextPath}`);
      }
      visit(entry, nextPath);
    }
  }

  visit(payload, "");
}

module.exports = {
  PUBLIC_AI_FORBIDDEN_KEYS,
  SECRET_ENV_NAMES,
  assertPublicAiProviderEnvelope,
  describeAiProviderError,
  redactAiProviderText
};
