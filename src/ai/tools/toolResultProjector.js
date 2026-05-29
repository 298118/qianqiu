// @ts-check

const { validateToolPayload } = require("../toolSchemas");
const {
  assertModelToolProjectionSafe,
  cleanPublicText
} = require("./toolGuardrails");

function cleanId(value, fallback = "") {
  const text = cleanPublicText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanVisibleChanges(values = []) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => cleanPublicText(value, "", 140))
    .filter(Boolean)
    .slice(0, 12);
}

function cleanReasons(values = []) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => cleanPublicText(value, "服务器拒绝。", 160))
    .filter(Boolean)
    .slice(0, 8);
}

function contentForModel(result = {}, toolCall = {}) {
  validateToolPayload("toolResult", result);
  const toolCallId = cleanId(
    toolCall.id || toolCall.toolCallId || toolCall.tool_call_id || result.modelFollowUpHint,
    cleanId(result.auditRef, "tool-call")
  );

  return {
    status: cleanPublicText(result.status, "failed", 32),
    publicResult: {
      summary: cleanPublicText(result.publicResult?.summary, "工具请求已由服务器处理。", 180),
      visibleChanges: cleanVisibleChanges(result.publicResult?.visibleChanges)
    },
    rejectionReasons: cleanReasons(result.rejectionReasons),
    auditRef: cleanId(result.auditRef, "ai-tool-audit:redacted"),
    modelFollowUpHint: cleanId(result.modelFollowUpHint || toolCallId, toolCallId)
  };
}

function projectToolResultForModel(result = {}, toolCall = {}) {
  const toolCallId = cleanId(
    toolCall.id || toolCall.toolCallId || toolCall.tool_call_id || result.modelFollowUpHint,
    cleanId(result.auditRef, "tool-call")
  );
  const content = contentForModel(result, toolCall);
  const projection = {
    tool_call_id: toolCallId,
    role: "tool",
    name: "tool_result",
    content: JSON.stringify(content)
  };
  assertModelToolProjectionSafe(projection);
  return projection;
}

function projectToolResultsForModel(results = [], toolCalls = []) {
  return results.map((result, index) => projectToolResultForModel(result, toolCalls[index] || {}));
}

function parseProjectedToolContent(projection = {}) {
  if (typeof projection.content !== "string") return {};
  return JSON.parse(projection.content);
}

module.exports = {
  contentForModel,
  parseProjectedToolContent,
  projectToolResultForModel,
  projectToolResultsForModel
};
