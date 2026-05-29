// @ts-check

const { randomUUID } = require("crypto");

const {
  validateToolArguments,
  validateToolPayload
} = require("../toolSchemas");
const { safeArgumentSummary } = require("../gameAiToolRunner");
const { isToolAllowedForActor } = require("../../game/aiActorProfiles");
const { redactAiProviderText } = require("../providerSafety");

const FORBIDDEN_MODEL_TOOL_KEYS = Object.freeze([
  "rawSql",
  "sql",
  "statePatch",
  "worldState",
  "rawTable",
  "rawAudit",
  "rawPrompt",
  "fullPrompt",
  "providerConfig",
  "providerPayload",
  "rawProviderPayload",
  "localPath",
  "hiddenNotes",
  "hiddenIntent",
  "apiKey",
  "baseURL",
  "baseUrl",
  "token"
]);

const FORBIDDEN_MODEL_RESULT_KEYS = Object.freeze([
  ...FORBIDDEN_MODEL_TOOL_KEYS,
  "privateResultRefs",
  "normalizedProposal",
  "resolver",
  "permission",
  "audit",
  "cooldown",
  "mockFallback",
  "appliedEventIds",
  "actorRef",
  "toolName"
]);

const SENSITIVE_MODEL_TOOL_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt|sql)|rawSql|rawPrompt|fullPrompt|providerPayload|rawProviderPayload|providerConfig|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|server(?:\.\*|\.[A-Za-z0-9_.:-]+)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanPublicText(value, fallback = "工具请求未被服务器接受。", maxLength = 180) {
  const redacted = redactAiProviderText(value, { maxLength }).replace(/server(?:\.\*|\.[A-Za-z0-9_.:-]+)/gi, "[redacted-internal-tool]");
  const trimmed = redacted.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_MODEL_TOOL_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanPublicText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanToolName(value, fallback = "tool.rejected") {
  const text = cleanPublicText(value, fallback, 96).replace(/\s+/g, "");
  if (!text || /^server\./i.test(text) || /server\.\*/i.test(text)) return fallback;
  return text.replace(/[^A-Za-z0-9_.-]+/g, "").slice(0, 96) || fallback;
}

function actorRef(actorProfile = {}) {
  return {
    actorId: cleanId(actorProfile.actorId, "actor:unknown"),
    actorType: cleanId(actorProfile.actorType, "unknown"),
    authorityTier: cleanId(actorProfile.authorityTier, "T0").slice(0, 4),
    officeId: cleanId(actorProfile.officeId, ""),
    jurisdictionRefs: Array.isArray(actorProfile.jurisdictionRefs)
      ? actorProfile.jurisdictionRefs.map((ref) => cleanId(ref, "")).filter(Boolean).slice(0, 8)
      : []
  };
}

function scanUnsafeModelValue(value, options = {}, path = "value", findings = []) {
  const forbiddenKeys = options.resultProjection
    ? FORBIDDEN_MODEL_RESULT_KEYS
    : FORBIDDEN_MODEL_TOOL_KEYS;

  if (typeof value === "string") {
    if (SENSITIVE_MODEL_TOOL_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafeModelValue(item, options, `${path}[${index}]`, findings));
    return findings;
  }

  if (!isPlainObject(value)) return findings;

  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (forbiddenKeys.includes(key) || SENSITIVE_MODEL_TOOL_TEXT_PATTERN.test(key)) {
      findings.push(nextPath);
    }
    scanUnsafeModelValue(child, options, nextPath, findings);
  }

  return findings;
}

function buildGuardrailRejectedToolResult(toolCall = {}, actorProfile = {}, reasons = [], options = {}) {
  const safeReasons = reasons.length ? reasons : ["工具请求未通过服务器 guardrail。"];
  return validateToolPayload("toolResult", {
    status: options.status || "rejected",
    toolName: cleanToolName(toolCall.name || toolCall.toolName, "tool.rejected"),
    actorRef: actorRef(actorProfile),
    publicResult: {
      summary: cleanPublicText(options.summary, "工具请求未被服务器接受。", 180),
      visibleChanges: []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: safeReasons
      .map((reason) => cleanPublicText(reason, "工具请求未通过服务器 guardrail。", 160))
      .filter(Boolean)
      .slice(0, 6),
    counterCosts: [],
    followUpHooks: [],
    auditRef: cleanId(options.auditRef, `ai-tool-audit:${randomUUID()}`),
    modelFollowUpHint: cleanId(toolCall.id || toolCall.toolCallId || toolCall.tool_call_id, "")
  });
}

function recordLoopGuardrailAudit(context = {}, toolCall = {}, result = {}, rejectedReason = "guardrail") {
  const unsafeArgumentFindings = scanUnsafeModelValue(toolCall.arguments || {}, { resultProjection: false }, "arguments");
  const auditRecord = {
    schemaVersion: 1,
    auditId: cleanId(result.auditRef, `ai-tool-audit:${randomUUID()}`),
    eventType: "ai_tool_loop_guardrail_rejected",
    visibility: "developer",
    actorRef: actorRef(context.actorProfile || {}),
    toolName: cleanToolName(toolCall.name || toolCall.toolName, "tool.rejected"),
    status: cleanPublicText(result.status, "rejected", 32),
    argumentSummary: unsafeArgumentFindings.length ? {} : safeArgumentSummary(toolCall.arguments || {}),
    publicSummary: cleanPublicText(result.publicResult?.summary, "工具请求未被服务器接受。", 180),
    rejectionReasons: Array.isArray(result.rejectionReasons)
      ? result.rejectionReasons.map((reason) => cleanPublicText(reason, "服务器拒绝。", 160))
      : [],
    rejectedReason: cleanPublicText(rejectedReason, "guardrail", 80),
    durationMs: 0
  };

  if (typeof context.recordToolAudit === "function") {
    context.recordToolAudit(auditRecord);
    return auditRecord;
  }
  if (Array.isArray(context.toolAuditRecords)) {
    context.toolAuditRecords.push(auditRecord);
  }
  return auditRecord;
}

function getToolDefinition(toolRegistry, toolName) {
  if (!toolRegistry) return null;
  if (typeof toolRegistry.getTool === "function") return toolRegistry.getTool(toolName);
  if (Array.isArray(toolRegistry)) return toolRegistry.find((tool) => tool.name === toolName) || null;
  if (typeof toolRegistry === "object") return toolRegistry[toolName] || null;
  return null;
}

function inspectToolCallBeforeExecution(toolCall = {}, context = {}) {
  const actorProfile = context.actorProfile || {};
  const toolName = cleanToolName(toolCall.name, "");
  const args = isPlainObject(toolCall.arguments) ? toolCall.arguments : {};
  const toolDefinition = getToolDefinition(context.toolRegistry, toolName);
  const reasons = [];

  if (!toolName) {
    reasons.push("工具名缺失。");
  }
  if (/^server\./i.test(String(toolCall.name || "")) || /server\.\*/i.test(String(toolCall.name || ""))) {
    reasons.push("内部工具不能由模型直接调用。");
  }
  if (!toolDefinition) {
    reasons.push("未知工具。");
  }

  const unsafeFindings = scanUnsafeModelValue(args, { resultProjection: false }, "arguments");
  if (unsafeFindings.length) {
    reasons.push("工具参数含隐藏、原始、路径、密钥或内部字段。");
  }

  if (toolDefinition) {
    try {
      validateToolArguments(toolDefinition, args);
    } catch (_error) {
      reasons.push("工具参数未通过 schema 校验。");
    }

    const toolType = toolDefinition.permission?.toolType;
    if (toolType === "request_adjudication" && context.mayRequestAdjudication === false) {
      reasons.push("当前任务不允许请求服务器裁决。");
    }

    const jurisdictionRef = context.jurisdictionRef || args.jurisdictionRef || args.cityId || args.regionId || "";
    if (!isToolAllowedForActor(actorProfile, toolDefinition, { jurisdictionRef })) {
      reasons.push("actor 无权调用该工具或辖区不匹配。");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons: [...new Set(reasons)].slice(0, 6),
    toolDefinition
  };
}

function assertServerToolResultPublicPartsSafe(result = {}) {
  validateToolPayload("toolResult", result);
  const publicOnly = {
    status: result.status,
    publicResult: result.publicResult,
    rejectionReasons: result.rejectionReasons,
    counterCosts: result.counterCosts,
    followUpHooks: result.followUpHooks,
    auditRef: result.auditRef,
    modelFollowUpHint: result.modelFollowUpHint
  };
  const findings = scanUnsafeModelValue(publicOnly, { resultProjection: false }, "toolResult");
  if (findings.length) {
    throw new Error(`AI tool result public fields contain unsafe content: ${findings.join(", ")}`);
  }
  return result;
}

function assertModelToolProjectionSafe(projection = {}) {
  const serialized = JSON.stringify(projection);
  const findings = scanUnsafeModelValue(projection, { resultProjection: true }, "projection");
  if (findings.length || SENSITIVE_MODEL_TOOL_TEXT_PATTERN.test(serialized)) {
    throw new Error("Provider-visible tool result projection contains forbidden content.");
  }
  return projection;
}

module.exports = {
  FORBIDDEN_MODEL_RESULT_KEYS,
  FORBIDDEN_MODEL_TOOL_KEYS,
  SENSITIVE_MODEL_TOOL_TEXT_PATTERN,
  assertModelToolProjectionSafe,
  assertServerToolResultPublicPartsSafe,
  buildGuardrailRejectedToolResult,
  cleanPublicText,
  inspectToolCallBeforeExecution,
  recordLoopGuardrailAudit,
  scanUnsafeModelValue
};
