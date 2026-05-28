// @ts-check

const { parseJsonFromText } = require("../../utils/json");
const { redactAiProviderText } = require("../providerSafety");
const { validatePayload } = require("../schemas");
const { normalizeModelPayload } = require("./remoteHelpers");

const PROVIDER_WRAPPER_KEYS = Object.freeze([
  "choices",
  "content",
  "created",
  "id",
  "model",
  "object",
  "output",
  "output_text",
  "parsed",
  "parsed_output",
  "usage"
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

function collectContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (!isPlainObject(block)) return "";
      return readString(block.text) || readString(block.output_text) || readString(block.content);
    })
    .filter(Boolean)
    .join("\n");
}

function collectResponsesOutputText(output) {
  if (!Array.isArray(output)) return "";
  return output
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isPlainObject(item)) return "";
      if (readString(item.text)) return readString(item.text);
      return collectContentText(item.content);
    })
    .filter(Boolean)
    .join("\n");
}

function extractResponsesParsedObject(output) {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!isPlainObject(item) || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (isPlainObject(block) && isPlainObject(block.parsed)) return block.parsed;
      if (isPlainObject(block) && isPlainObject(block.parsed_output)) return block.parsed_output;
    }
  }
  return null;
}

function extractChoiceParsedObject(choices) {
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    if (!isPlainObject(choice) || !isPlainObject(choice.message)) continue;
    if (isPlainObject(choice.message.parsed)) return choice.message.parsed;
    if (isPlainObject(choice.message.parsed_output)) return choice.message.parsed_output;
  }
  return null;
}

function extractChoiceText(choices) {
  if (!Array.isArray(choices)) return "";
  return choices
    .map((choice) => {
      if (!isPlainObject(choice)) return "";
      if (isPlainObject(choice.message)) {
        if (isPlainObject(choice.message.parsed)) return "";
        return collectContentText(choice.message.content);
      }
      if (isPlainObject(choice.delta)) return collectContentText(choice.delta.content);
      return readString(choice.text);
    })
    .filter(Boolean)
    .join("\n");
}

function hasProviderWrapperShape(value) {
  if (!isPlainObject(value)) return false;
  return PROVIDER_WRAPPER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/**
 * Provider SDK 返回可能是 Responses、Chat Completions、已解析对象或测试替身。
 * 这里只抽取结构化 JSON 候选，不把 raw provider wrapper 暴露给运行时 trace。
 *
 * @param {unknown} raw
 * @returns {unknown}
 */
function extractProviderJsonCandidate(raw) {
  if (typeof raw === "string") return raw;
  if (!isPlainObject(raw)) {
    throw new Error("AI provider response did not contain structured JSON content.");
  }

  if (isPlainObject(raw.payload)) return raw.payload;
  if (isPlainObject(raw.parsed)) return raw.parsed;
  if (isPlainObject(raw.parsed_output)) return raw.parsed_output;

  const outputText = readString(raw.output_text);
  if (outputText) return outputText;

  const responseParsed = extractResponsesParsedObject(raw.output);
  if (responseParsed) return responseParsed;

  const responseOutputText = collectResponsesOutputText(raw.output);
  if (responseOutputText) return responseOutputText;

  const choiceParsed = extractChoiceParsedObject(raw.choices);
  if (choiceParsed) return choiceParsed;

  const choiceText = extractChoiceText(raw.choices);
  if (choiceText) return choiceText;

  const contentText = collectContentText(raw.content);
  if (contentText) return contentText;

  if (!hasProviderWrapperShape(raw)) return raw;

  throw new Error("AI provider response did not contain structured JSON content.");
}

function readTokenCount(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed);
  }
  return 0;
}

/**
 * @param {unknown} raw
 */
function normalizeProviderUsage(raw) {
  const rawUsage = isPlainObject(raw) && isPlainObject(raw.usage) ? raw.usage : {};
  const inputTokens = readTokenCount(rawUsage.inputTokens, rawUsage.input_tokens, rawUsage.prompt_tokens);
  const outputTokens = readTokenCount(rawUsage.outputTokens, rawUsage.output_tokens, rawUsage.completion_tokens);
  const totalTokens = readTokenCount(rawUsage.totalTokens, rawUsage.total_tokens, inputTokens + outputTokens);
  const hasAnyUsage = inputTokens > 0 || outputTokens > 0 || totalTokens > 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimated: !hasAnyUsage
  };
}

/**
 * @param {{
 *   schemaName: string,
 *   raw: unknown,
 *   provider?: string,
 *   model?: string,
 *   strictStructuredOutput?: boolean
 * }} options
 */
function normalizeProviderStructuredResult(options) {
  const schemaName = String(options.schemaName || "").trim();
  if (!schemaName) throw new Error("AI provider structured result requires schemaName.");

  try {
    const candidate = extractProviderJsonCandidate(options.raw);
    const parsed = parseJsonFromText(candidate);
    const normalized = normalizeModelPayload(schemaName, parsed);
    const payload = validatePayload(schemaName, normalized);

    return {
      payload,
      provider: String(options.provider || "unknown"),
      model: String(options.model || options.provider || "unknown"),
      usage: normalizeProviderUsage(options.raw),
      strictStructuredOutput: Boolean(options.strictStructuredOutput)
    };
  } catch (error) {
    const safeReason = redactAiProviderText(error, { maxLength: 180 });
    throw new Error(`AI provider structured output failed for ${schemaName}: ${safeReason}`);
  }
}

module.exports = {
  extractProviderJsonCandidate,
  normalizeProviderStructuredResult,
  normalizeProviderUsage
};
