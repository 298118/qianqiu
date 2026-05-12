const { randomUUID } = require("crypto");

const {
  TOOL_TYPES,
  validateToolArguments,
  validateToolPayload
} = require("./toolSchemas");
const { isToolAllowedForActor } = require("../game/aiActorProfiles");
const { DEFAULT_AI_TOOL_RESOLVERS } = require("../game/aiToolResolvers");

const TOOL_AUDIT_SCHEMA_VERSION = 1;
const SENSITIVE_TOOL_AUDIT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|source|path|key|hidden|raw|SQL)\b|server\.[A-Za-z0-9_.:-]+|rawSql|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_TOOL_AUDIT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanToolName(value, fallback = "", maxLength = 96) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, "");
  if (!trimmed || /[\\/:"'<>]/.test(trimmed)) return fallback;
  return trimmed.replace(/[^A-Za-z0-9_.-]+/g, "").slice(0, maxLength) || fallback;
}

function actorRef(actorProfile = {}) {
  return {
    actorId: cleanText(actorProfile.actorId, "actor:unknown", 96),
    actorType: cleanText(actorProfile.actorType, "unknown", 40),
    authorityTier: cleanText(actorProfile.authorityTier, "T0", 4),
    officeId: cleanText(actorProfile.officeId, "", 96),
    jurisdictionRefs: Array.isArray(actorProfile.jurisdictionRefs)
      ? actorProfile.jurisdictionRefs.map((ref) => cleanText(ref, "", 96)).filter(Boolean).slice(0, 8)
      : []
  };
}

function safeArgumentSummary(args = {}) {
  const summary = {};
  if (!args || typeof args !== "object" || Array.isArray(args)) return summary;
  for (const [key, value] of Object.entries(args).slice(0, 8)) {
    const safeKey = cleanText(key, "", 48);
    if (!safeKey) continue;
    if (Array.isArray(value)) {
      summary[safeKey] = value.map((item) => cleanText(String(item), "", 60)).filter(Boolean).slice(0, 6);
    } else if (value && typeof value === "object") {
      summary[safeKey] = "[object]";
    } else {
      summary[safeKey] = cleanText(String(value ?? ""), "", 80);
    }
  }
  return summary;
}

function rejectToolResult(toolDefinition, actorProfile, reasons = [], options = {}) {
  return validateToolPayload("toolResult", {
    status: options.status || "rejected",
    toolName: toolDefinition?.name || options.toolName || "unknown.tool",
    actorRef: actorRef(actorProfile),
    publicResult: {
      summary: cleanText(options.summary, "工具请求未被服务器接受。", 180),
      visibleChanges: []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: reasons.map((reason) => cleanText(reason, "服务器拒绝。", 160)).filter(Boolean).slice(0, 6),
    counterCosts: [],
    followUpHooks: [],
    auditRef: options.auditRef || `ai-tool-audit:${randomUUID()}`,
    modelFollowUpHint: cleanText(options.toolCallId, "", 96)
  });
}

function buildAcceptedToolResult(toolDefinition, actorProfile, resolverResult = {}, auditRef, toolCallId = "") {
  return validateToolPayload("toolResult", {
    status: resolverResult.status || "accepted",
    toolName: toolDefinition.name,
    actorRef: actorRef(actorProfile),
    publicResult: {
      summary: cleanText(resolverResult.publicResult?.summary, "服务器已处理工具请求。", 180),
      visibleChanges: Array.isArray(resolverResult.publicResult?.visibleChanges)
        ? resolverResult.publicResult.visibleChanges.map((item) => cleanText(item, "", 140)).filter(Boolean).slice(0, 12)
        : []
    },
    privateResultRefs: Array.isArray(resolverResult.privateResultRefs)
      ? resolverResult.privateResultRefs.map((item) => cleanText(item, "", 96)).filter(Boolean).slice(0, 8)
      : [],
    appliedEventIds: Array.isArray(resolverResult.appliedEventIds)
      ? resolverResult.appliedEventIds.map((item) => cleanText(item, "", 96)).filter(Boolean).slice(0, 8)
      : [],
    rejectionReasons: Array.isArray(resolverResult.rejectionReasons)
      ? resolverResult.rejectionReasons.map((item) => cleanText(item, "", 140)).filter(Boolean).slice(0, 8)
      : [],
    counterCosts: Array.isArray(resolverResult.counterCosts)
      ? resolverResult.counterCosts.map((item) => cleanText(item, "", 140)).filter(Boolean).slice(0, 8)
      : [],
    followUpHooks: Array.isArray(resolverResult.followUpHooks)
      ? resolverResult.followUpHooks.map((item) => cleanText(item, "", 96)).filter(Boolean).slice(0, 8)
      : [],
    auditRef,
    modelFollowUpHint: cleanText(toolCallId, "", 96)
  });
}

function parseToolArguments(rawArguments) {
  if (rawArguments === undefined || rawArguments === null || rawArguments === "") return {};
  if (typeof rawArguments === "string") {
    return JSON.parse(rawArguments);
  }
  if (typeof rawArguments === "object" && !Array.isArray(rawArguments)) return cloneJson(rawArguments);
  throw new Error("Tool call arguments must be a JSON object or JSON object string.");
}

function normalizeProviderToolCall(providerPayload = {}, options = {}) {
  const providerNameMap = options.providerToolNameMap || {};
  const id = cleanText(providerPayload.id || providerPayload.tool_call_id || providerPayload.callId, `tool-call:${randomUUID()}`, 96);
  const rawName = providerPayload.name ||
    providerPayload.function?.name ||
    providerPayload.toolName ||
    providerPayload.input?.name;
  const providerName = cleanToolName(rawName, "", 96);
  const name = providerNameMap[providerName] || providerName;
  const rawArguments = providerPayload.arguments ??
    providerPayload.function?.arguments ??
    providerPayload.input ??
    providerPayload.args ??
    {};

  if (!name) throw new Error("Provider tool call is missing a tool name.");
  return {
    id,
    name,
    arguments: parseToolArguments(rawArguments)
  };
}

function getToolDefinition(toolRegistry, toolName) {
  if (!toolRegistry) return null;
  if (typeof toolRegistry.getTool === "function") return toolRegistry.getTool(toolName);
  if (Array.isArray(toolRegistry)) return toolRegistry.find((tool) => tool.name === toolName) || null;
  if (typeof toolRegistry === "object") return toolRegistry[toolName] || null;
  return null;
}

function isInternalToolName(toolName) {
  return /^server\./.test(String(toolName || ""));
}

function resolverFor(toolDefinition, context = {}) {
  const resolvers = {
    ...DEFAULT_AI_TOOL_RESOLVERS,
    ...(context.resolvers || {})
  };
  const resolverName = toolDefinition.resolver?.name;
  if (resolvers[resolverName]) return resolvers[resolverName];
  if (toolDefinition.permission?.toolType === "read") return DEFAULT_AI_TOOL_RESOLVERS["server.read_visible_context"];
  if (toolDefinition.permission?.toolType === "proposal") return DEFAULT_AI_TOOL_RESOLVERS["server.pending_proposal"];
  return DEFAULT_AI_TOOL_RESOLVERS["server.pending_adjudication"];
}

function cooldownKey(toolDefinition, actorProfile, args = {}) {
  const fields = Array.isArray(toolDefinition.cooldown?.cooldownKeyFields) ? toolDefinition.cooldown.cooldownKeyFields : [];
  const fieldValues = fields.map((field) => {
    if (field === "actorRef.actorId") return actorProfile.actorId;
    if (Object.prototype.hasOwnProperty.call(args, field)) return JSON.stringify(args[field]);
    return "";
  }).filter(Boolean);
  return [toolDefinition.cooldown?.scope || "none", toolDefinition.name, ...fieldValues].join("|");
}

function isCooldownActive(toolDefinition, actorProfile, args, context = {}) {
  if (!toolDefinition.cooldown || toolDefinition.cooldown.scope === "none" || !toolDefinition.cooldown.turns) {
    return { active: false, key: "" };
  }
  const key = cooldownKey(toolDefinition, actorProfile, args);
  const turn = Number(context.worldState?.turnCount || context.currentTurn || 0);
  const expiresAt = Number(context.toolCooldowns?.[key] || 0);
  return {
    active: Number.isFinite(expiresAt) && expiresAt > turn,
    key,
    turn
  };
}

function actorAllowedReadDomains(actorProfile = {}) {
  const domains = actorProfile.visibilityProfile?.readDomains;
  return Array.isArray(domains) ? new Set(domains) : null;
}

function filterArgumentsByActorVisibility(toolDefinition, actorProfile, args = {}) {
  if (toolDefinition.name !== "world.read_visible_context" || !Array.isArray(args.domains)) {
    return { args, rejectedDomains: [] };
  }
  const allowedDomains = actorAllowedReadDomains(actorProfile);
  if (!allowedDomains) return { args, rejectedDomains: [] };

  const domains = args.domains.filter((domain) => allowedDomains.has(domain));
  const rejectedDomains = args.domains.filter((domain) => !allowedDomains.has(domain));
  return {
    args: {
      ...args,
      domains
    },
    rejectedDomains
  };
}

function applyCooldown(toolDefinition, actorProfile, args, context = {}) {
  if (!context.toolCooldowns || !toolDefinition.cooldown || toolDefinition.cooldown.scope === "none") return;
  const turns = Number(toolDefinition.cooldown.turns || 0);
  if (!Number.isFinite(turns) || turns <= 0) return;
  const key = cooldownKey(toolDefinition, actorProfile, args);
  const turn = Number(context.worldState?.turnCount || context.currentTurn || 0);
  context.toolCooldowns[key] = turn + turns;
}

function buildToolAuditRecord({ toolDefinition, actorProfile, args, result, durationMs, rejectedReason }) {
  return {
    schemaVersion: TOOL_AUDIT_SCHEMA_VERSION,
    auditId: result.auditRef,
    eventType: toolDefinition.audit?.eventType || "ai_game_tool_call",
    visibility: "developer",
    actorRef: actorRef(actorProfile),
    toolName: toolDefinition.name,
    status: result.status,
    argumentSummary: safeArgumentSummary(args),
    publicSummary: cleanText(result.publicResult?.summary, "工具请求已记录。", 180),
    rejectionReasons: Array.isArray(result.rejectionReasons) ? result.rejectionReasons : [],
    rejectedReason: cleanText(rejectedReason, "", 160),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0
  };
}

function recordToolAudit(context = {}, auditRecord) {
  if (!auditRecord) return;
  if (typeof context.recordToolAudit === "function") {
    context.recordToolAudit(auditRecord);
    return;
  }
  if (Array.isArray(context.toolAuditRecords)) {
    context.toolAuditRecords.push(auditRecord);
  }
}

function auditDefinitionForRejectedTool(toolName, eventType = "ai_game_tool_call_rejected") {
  const safeName = cleanToolName(toolName, "unknown.tool", 96);
  return {
    name: safeName,
    audit: {
      eventType
    }
  };
}

async function runGameAiTool(toolCall, context = {}, expectedToolType = null) {
  const startedAt = Date.now();
  const actorProfile = context.actorProfile || {};
  const toolName = cleanToolName(toolCall?.name || toolCall?.toolName, "", 96);
  const toolDefinition = getToolDefinition(context.toolRegistry, toolName);
  const toolCallId = cleanText(toolCall?.id || toolCall?.toolCallId || toolCall?.tool_call_id, "", 96);
  let args = {};
  let result;
  let rejectedReason = "";

  try {
    if (isInternalToolName(toolName)) {
      result = rejectToolResult({ name: toolName || "server.internal" }, actorProfile, ["内部 server.* 工具不能由模型直接调用。"], {
        toolName,
        toolCallId
      });
      rejectedReason = "internal_tool_denied";
      return result;
    }

    if (!toolDefinition) {
      result = rejectToolResult({ name: toolName || "unknown.tool" }, actorProfile, ["未知工具。"], {
        toolName,
        toolCallId
      });
      rejectedReason = "unknown_tool";
      return result;
    }

    const toolType = toolDefinition.permission?.toolType;
    if (expectedToolType && toolType !== expectedToolType) {
      result = rejectToolResult(toolDefinition, actorProfile, [`工具类型不匹配：期望 ${expectedToolType}。`], {
        toolCallId
      });
      rejectedReason = "tool_type_mismatch";
      return result;
    }
    if (!TOOL_TYPES.includes(toolType)) {
      result = rejectToolResult(toolDefinition, actorProfile, ["工具类型不受支持。"], { toolCallId });
      rejectedReason = "unsupported_tool_type";
      return result;
    }

    args = parseToolArguments(toolCall.arguments);
    validateToolArguments(toolDefinition, args);
    const visibilityFiltered = filterArgumentsByActorVisibility(toolDefinition, actorProfile, args);
    args = visibilityFiltered.args;

    const jurisdictionRef = context.jurisdictionRef || args.jurisdictionRef || args.cityId || args.regionId || "";
    if (!isToolAllowedForActor(actorProfile, toolDefinition, { jurisdictionRef })) {
      result = rejectToolResult(toolDefinition, actorProfile, ["actor 无权调用该工具或辖区不匹配。"], { toolCallId });
      rejectedReason = "permission_denied";
      return result;
    }

    const cooldown = isCooldownActive(toolDefinition, actorProfile, args, context);
    if (cooldown.active) {
      result = rejectToolResult(toolDefinition, actorProfile, ["工具冷却未结束。"], { toolCallId });
      rejectedReason = "cooldown";
      return result;
    }

    const auditRef = `ai-tool-audit:${randomUUID()}`;
    const resolver = resolverFor(toolDefinition, context);
    const resolverResult = await resolver({
      toolCall,
      toolDefinition,
      actorProfile,
      arguments: args,
      worldState: context.worldState || {},
      context
    });
    const adjustedResolverResult = visibilityFiltered.rejectedDomains.length
      ? {
        ...resolverResult,
        counterCosts: [
          ...(Array.isArray(resolverResult.counterCosts) ? resolverResult.counterCosts : []),
          `已按 actor 视野过滤读取域：${visibilityFiltered.rejectedDomains.join("、")}`
        ]
      }
      : resolverResult;
    result = buildAcceptedToolResult(toolDefinition, actorProfile, adjustedResolverResult, auditRef, toolCallId);
    applyCooldown(toolDefinition, actorProfile, args, context);
    return result;
  } catch (error) {
    result = rejectToolResult(toolDefinition || { name: toolName || "unknown.tool" }, actorProfile, [
      cleanText(error.message, "工具请求校验失败。", 140)
    ], { toolCallId });
    rejectedReason = "exception";
    return result;
  } finally {
    if (result) {
      recordToolAudit(context, buildToolAuditRecord({
        toolDefinition: toolDefinition || auditDefinitionForRejectedTool(toolName, rejectedReason),
        actorProfile,
        args,
        result,
        durationMs: Date.now() - startedAt,
        rejectedReason
      }));
    }
  }
}

function runReadTool(toolCall, context = {}) {
  return runGameAiTool(toolCall, context, "read");
}

function runProposalTool(toolCall, context = {}) {
  return runGameAiTool(toolCall, context, "proposal");
}

function runRequestAdjudicationTool(toolCall, context = {}) {
  return runGameAiTool(toolCall, context, "request_adjudication");
}

function buildToolResultForModel(result = {}, toolCall = {}) {
  validateToolPayload("toolResult", result);
  const toolCallId = cleanText(
    toolCall.id || toolCall.toolCallId || toolCall.tool_call_id || result.modelFollowUpHint,
    "",
    96
  );
  return {
    tool_call_id: toolCallId || cleanText(result.auditRef, "", 96),
    role: "tool",
    name: cleanText(result.toolName, "", 96).replace(/[^A-Za-z0-9_-]+/g, "_"),
    content: JSON.stringify({
      status: result.status,
      summary: result.publicResult.summary,
      visibleChanges: result.publicResult.visibleChanges,
      rejectionReasons: result.rejectionReasons,
      counterCosts: result.counterCosts,
      followUpHooks: result.followUpHooks
    })
  };
}

module.exports = {
  TOOL_AUDIT_SCHEMA_VERSION,
  buildToolAuditRecord,
  buildToolResultForModel,
  normalizeProviderToolCall,
  runGameAiTool,
  runProposalTool,
  runReadTool,
  runRequestAdjudicationTool,
  safeArgumentSummary
};
