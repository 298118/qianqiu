// @ts-check

const {
  buildProviderToolNameMap,
  toProviderToolName,
  validateToolDefinition
} = require("../toolSchemas");

const MAX_NORMALIZED_TOOL_CALLS = 20;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanId(value, fallback = "tool-call") {
  const text = String(value || "").trim().replace(/\s+/g, "");
  const cleaned = text.replace(/[^A-Za-z0-9_.:-]+/g, "").slice(0, 96);
  return cleaned || fallback;
}

function cleanToolName(value, fallback = "") {
  const text = String(value || "").trim().replace(/\s+/g, "");
  if (!text || /[\\/:"'<>]/.test(text)) return fallback;
  return text.replace(/[^A-Za-z0-9_.-]+/g, "").slice(0, 96) || fallback;
}

function readMaxCalls(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_NORMALIZED_TOOL_CALLS;
  return Math.max(0, Math.min(MAX_NORMALIZED_TOOL_CALLS, Math.trunc(parsed)));
}

function parseToolArguments(rawArguments) {
  if (rawArguments === undefined || rawArguments === null || rawArguments === "") return {};
  if (typeof rawArguments === "string") {
    const parsed = JSON.parse(rawArguments);
    if (!isPlainObject(parsed)) {
      throw new Error("Tool call arguments JSON must decode to an object.");
    }
    return parsed;
  }
  if (isPlainObject(rawArguments)) return cloneJson(rawArguments);
  throw new Error("Tool call arguments must be a JSON object or JSON object string.");
}

function extractRawToolCalls(providerStep = {}) {
  if (Array.isArray(providerStep)) return providerStep;
  if (!isPlainObject(providerStep)) return [];

  if (Array.isArray(providerStep.toolCalls)) return providerStep.toolCalls;
  if (Array.isArray(providerStep.tool_calls)) return providerStep.tool_calls;
  if (Array.isArray(providerStep.tools)) return providerStep.tools;
  if (Array.isArray(providerStep.message?.tool_calls)) return providerStep.message.tool_calls;

  const firstChoice = Array.isArray(providerStep.choices) ? providerStep.choices[0] : null;
  if (Array.isArray(firstChoice?.message?.tool_calls)) return firstChoice.message.tool_calls;

  if (Array.isArray(providerStep.output)) {
    return providerStep.output.filter((item) => (
      item?.type === "function_call" ||
      item?.type === "tool_call" ||
      item?.type === "tool_use" ||
      item?.function?.name ||
      item?.name
    ));
  }

  if (providerStep.toolCall || providerStep.tool_call) {
    return [providerStep.toolCall || providerStep.tool_call];
  }

  return [];
}

function rawToolCallId(rawCall, index = 0) {
  return cleanId(
    rawCall?.id || rawCall?.tool_call_id || rawCall?.callId || rawCall?.call_id,
    `tool-call-${index + 1}`
  );
}

function rawToolCallName(rawCall) {
  return rawCall?.name ||
    rawCall?.function?.name ||
    rawCall?.toolName ||
    rawCall?.tool_name ||
    rawCall?.input?.name ||
    "";
}

function rawToolCallArguments(rawCall) {
  if (!isPlainObject(rawCall)) return {};
  if (Object.prototype.hasOwnProperty.call(rawCall, "arguments")) return rawCall.arguments;
  if (Object.prototype.hasOwnProperty.call(rawCall.function || {}, "arguments")) return rawCall.function.arguments;
  if (rawCall.type === "tool_use" && isPlainObject(rawCall.input)) return rawCall.input;
  if (Object.prototype.hasOwnProperty.call(rawCall, "args")) return rawCall.args;
  return {};
}

function normalizeToolCall(rawCall, options = {}, index = 0) {
  if (!isPlainObject(rawCall)) {
    throw new Error("Provider tool call must be an object.");
  }

  const providerToolNameMap = options.providerToolNameMap || {};
  const id = rawToolCallId(rawCall, index);
  const providerName = cleanToolName(rawToolCallName(rawCall), "");
  const name = providerToolNameMap[providerName] || providerName;
  if (!name) {
    throw new Error("Provider tool call is missing a tool name.");
  }

  return {
    id,
    name,
    providerName: providerName || toProviderToolName(name),
    arguments: parseToolArguments(rawToolCallArguments(rawCall))
  };
}

function rejectedNormalizedCall(rawCall, index, reason) {
  return {
    id: rawToolCallId(rawCall, index),
    name: cleanToolName(rawToolCallName(rawCall), "unknown.tool"),
    providerName: cleanToolName(rawToolCallName(rawCall), "unknown_tool"),
    arguments: {},
    rejectionReasons: [reason || "工具调用形状无效。"]
  };
}

function normalizeToolCalls(providerStep = {}, options = {}) {
  const rawCalls = extractRawToolCalls(providerStep);
  const maxCalls = readMaxCalls(options.maxCalls);
  const toolCalls = [];
  const rejectedCalls = [];
  const items = [];

  rawCalls.slice(0, maxCalls).forEach((rawCall, index) => {
    try {
      const toolCall = normalizeToolCall(rawCall, options, index);
      toolCalls.push(toolCall);
      items.push({ toolCall, rejected: false });
    } catch (_error) {
      const rejectedCall = rejectedNormalizedCall(rawCall, index, "工具调用参数不是有效 JSON object。");
      rejectedCalls.push(rejectedCall);
      items.push({ toolCall: rejectedCall, rejected: true });
    }
  });

  if (rawCalls.length > maxCalls) {
    const rejectedCall = rejectedNormalizedCall(rawCalls[maxCalls], maxCalls, "工具调用数量超过单步上限。");
    rejectedCall.overflowCount = rawCalls.length - maxCalls;
    rejectedCalls.push(rejectedCall);
    items.push({ toolCall: rejectedCall, rejected: true });
  }

  return {
    rawCount: rawCalls.length,
    toolCalls,
    rejectedCalls,
    items
  };
}

function buildProviderToolNameMapForTools(toolDefinitions = []) {
  return buildProviderToolNameMap(toolDefinitions);
}

function toProviderVisibleToolSpec(toolDefinition) {
  validateToolDefinition(toolDefinition);
  return {
    type: "function",
    function: {
      name: toProviderToolName(toolDefinition.name),
      description: String(toolDefinition.description || "").slice(0, 1024),
      strict: true,
      parameters: cloneJson(toolDefinition.inputSchema)
    }
  };
}

function buildProviderVisibleToolList(toolDefinitions = []) {
  return toolDefinitions.map(toProviderVisibleToolSpec);
}

module.exports = {
  MAX_NORMALIZED_TOOL_CALLS,
  buildProviderToolNameMapForTools,
  buildProviderVisibleToolList,
  extractRawToolCalls,
  normalizeToolCall,
  normalizeToolCalls,
  parseToolArguments,
  toProviderVisibleToolSpec
};
