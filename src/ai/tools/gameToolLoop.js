// @ts-check

const { createGameAiToolRegistry, listToolsForActor } = require("../gameAiTools");
const {
  runProposalTool,
  runReadTool,
  runRequestAdjudicationTool
} = require("../gameAiToolRunner");
const {
  buildProviderToolNameMapForTools,
  buildProviderVisibleToolList,
  normalizeToolCalls
} = require("./toolCallNormalizer");
const {
  assertServerToolResultPublicPartsSafe,
  buildGuardrailRejectedToolResult,
  inspectToolCallBeforeExecution,
  recordLoopGuardrailAudit
} = require("./toolGuardrails");
const {
  parseProjectedToolContent,
  projectToolResultForModel
} = require("./toolResultProjector");
const { toProviderToolName } = require("../toolSchemas");

const GAME_TOOL_LOOP_SCHEMA_VERSION = "s92.4-game-tool-loop.v1";
const GAME_TOOL_LOOP_TRACE_SCHEMA_VERSION = "s92.4-game-tool-loop-trace.v1";
const MAX_TOOL_LOOP_STEPS = 12;
const MAX_TOOL_BUDGET = 20;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function toolBudgetFrom(envelope = {}, options = {}) {
  const budget = options.budget || envelope.budget || {};
  const actorBudget = options.actorProfile?.budgetPolicy || envelope.actorProfile?.budgetPolicy || {};
  const requested = options.toolBudget ??
    budget.toolBudget ??
    budget.maxToolCalls ??
    actorBudget.maxToolCallsPerScene ??
    0;
  const allowed = readInteger(requested, 0, 0, MAX_TOOL_BUDGET);
  const mayUseTools = Boolean(options.mayUseTools ?? budget.mayUseTools ?? allowed > 0) && allowed > 0;
  return {
    allowed: mayUseTools ? allowed : 0,
    mayUseTools,
    mayRequestAdjudication: mayUseTools
      ? Boolean(options.mayRequestAdjudication ?? budget.mayRequestAdjudication ?? true)
      : false
  };
}

function normalizeModelSteps(envelope = {}, options = {}) {
  const modelSteps = options.modelSteps || envelope.modelSteps;
  if (Array.isArray(modelSteps)) return modelSteps;
  const toolCalls = options.toolCalls || envelope.toolCalls || envelope.tool_calls;
  if (Array.isArray(toolCalls)) return [{ toolCalls }];
  if (toolCalls) return [{ toolCalls: [toolCalls] }];
  return [];
}

function createLoopContext(envelope = {}, options = {}) {
  const toolRegistry = options.toolRegistry || envelope.toolRegistry || createGameAiToolRegistry();
  const actorProfile = options.actorProfile || envelope.actorProfile || {};
  const availableTools = listToolsForActor(actorProfile, toolRegistry);
  const providerToolNameMap = buildProviderToolNameMapForTools(availableTools);
  const providerVisibleTools = buildProviderVisibleToolList(availableTools);
  const toolBudget = toolBudgetFrom({ ...envelope, actorProfile }, { ...options, actorProfile });
  const toolAuditRecords = options.toolAuditRecords || envelope.toolAuditRecords || [];
  const toolCooldowns = options.toolCooldowns || envelope.toolCooldowns || {};

  return {
    toolRegistry,
    actorProfile,
    availableTools,
    providerToolNameMap,
    providerVisibleTools,
    toolBudget,
    toolAuditRecords,
    toolCooldowns,
    worldState: options.worldState || envelope.worldState || {},
    jurisdictionRef: options.jurisdictionRef || envelope.jurisdictionRef || "",
    resolvers: options.resolvers || envelope.resolvers || {},
    recordToolAudit: options.recordToolAudit || envelope.recordToolAudit
  };
}

function providerVisibleName(toolCall = {}) {
  const name = String(toolCall.name || "").trim();
  if (!name || /^server\./i.test(name) || /server\.\*/i.test(name)) return "tool_rejected";
  return toProviderToolName(name) || "tool_rejected";
}

async function executeAllowedToolCall(toolCall, loopContext) {
  const inspection = inspectToolCallBeforeExecution(toolCall, {
    actorProfile: loopContext.actorProfile,
    toolRegistry: loopContext.toolRegistry,
    jurisdictionRef: loopContext.jurisdictionRef,
    mayRequestAdjudication: loopContext.toolBudget.mayRequestAdjudication
  });

  const runnerContext = {
    worldState: loopContext.worldState,
    actorProfile: loopContext.actorProfile,
    toolRegistry: loopContext.toolRegistry,
    toolAuditRecords: loopContext.toolAuditRecords,
    toolCooldowns: loopContext.toolCooldowns,
    jurisdictionRef: loopContext.jurisdictionRef,
    resolvers: loopContext.resolvers,
    recordToolAudit: loopContext.recordToolAudit
  };

  if (!inspection.ok) {
    const rejected = buildGuardrailRejectedToolResult(toolCall, loopContext.actorProfile, inspection.reasons);
    recordLoopGuardrailAudit(runnerContext, toolCall, rejected, "guardrail");
    return {
      result: rejected,
      executed: false
    };
  }

  const toolType = inspection.toolDefinition?.permission?.toolType;
  if (toolType === "read") {
    return {
      result: await runReadTool(toolCall, runnerContext),
      executed: true
    };
  }
  if (toolType === "proposal") {
    return {
      result: await runProposalTool(toolCall, runnerContext),
      executed: true
    };
  }
  if (toolType === "request_adjudication") {
    return {
      result: await runRequestAdjudicationTool(toolCall, runnerContext),
      executed: true
    };
  }

  const rejected = buildGuardrailRejectedToolResult(toolCall, loopContext.actorProfile, ["工具类型不受支持。"]);
  recordLoopGuardrailAudit(runnerContext, toolCall, rejected, "unsupported_tool_type");
  return {
    result: rejected,
    executed: false
  };
}

function projectedContent(projection) {
  try {
    return parseProjectedToolContent(projection);
  } catch (_error) {
    return {};
  }
}

function summarizePublicTrace(status, counts, auditRefs, providerVisibleToolCount) {
  return {
    schemaVersion: GAME_TOOL_LOOP_TRACE_SCHEMA_VERSION,
    status,
    toolCounts: {
      allowed: counts.allowed,
      attempted: counts.attempted,
      used: counts.used,
      executed: counts.executed,
      rejected: counts.rejected
    },
    auditRefs: auditRefs.slice(0, 20),
    providerVisibleToolCount
  };
}

async function runGameToolLoop(envelope = {}, options = {}) {
  const loopContext = createLoopContext(envelope, options);
  const steps = normalizeModelSteps(envelope, options);
  const provider = options.provider || envelope.provider || null;
  const maxSteps = readInteger(options.maxSteps ?? envelope.maxSteps, Math.max(1, loopContext.toolBudget.allowed + 1), 1, MAX_TOOL_LOOP_STEPS);
  const counts = {
    allowed: loopContext.toolBudget.allowed,
    attempted: 0,
    used: 0,
    executed: 0,
    rejected: 0
  };
  const toolMessages = [];
  const toolResults = [];
  const toolExecutionOrder = [];
  const auditRefs = [];
  let status = "ok";
  let finalPayload = null;
  let budgetExhausted = false;

  async function appendRejected(toolCall, reasons, rejectedReason = "guardrail") {
    const result = buildGuardrailRejectedToolResult(toolCall, loopContext.actorProfile, reasons);
    recordLoopGuardrailAudit({
      actorProfile: loopContext.actorProfile,
      toolAuditRecords: loopContext.toolAuditRecords,
      recordToolAudit: loopContext.recordToolAudit
    }, toolCall, result, rejectedReason);
    const projection = projectToolResultForModel(result, toolCall);
    const content = projectedContent(projection);
    toolMessages.push(projection);
    toolResults.push(content);
    toolExecutionOrder.push(providerVisibleName(toolCall));
    auditRefs.push(content.auditRef);
    counts.rejected += 1;
  }

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const providerStep = steps[stepIndex] || (
      provider && typeof provider.generateOrRequestTools === "function"
        ? await provider.generateOrRequestTools({
          envelope,
          stepIndex,
          tools: loopContext.providerVisibleTools,
          toolMessages,
          toolResults,
          toolBudget: loopContext.toolBudget
        })
        : {}
    );
    if (!isPlainObject(providerStep) && !Array.isArray(providerStep)) break;

    const normalized = normalizeToolCalls(providerStep, {
      providerToolNameMap: loopContext.providerToolNameMap
    });
    const attempts = normalized.items.map((item) => ({
      toolCall: item.toolCall,
      preRejected: item.rejected
    }));

    if (!attempts.length) {
      finalPayload = providerStep.finalPayload || providerStep.payload || null;
      break;
    }

    for (const attempt of attempts) {
      counts.attempted += 1;

      if (!loopContext.toolBudget.mayUseTools || counts.used >= loopContext.toolBudget.allowed) {
        budgetExhausted = true;
        await appendRejected(attempt.toolCall, ["工具预算已用尽；模型必须停止请求工具并给出最终回应。"], "tool_budget_exhausted");
        break;
      }

      counts.used += 1;
      if (attempt.preRejected) {
        await appendRejected(attempt.toolCall, attempt.toolCall.rejectionReasons || ["工具调用形状无效。"], "invalid_tool_shape");
        continue;
      }

      const execution = await executeAllowedToolCall(attempt.toolCall, loopContext);
      const serverResult = execution.result;
      assertServerToolResultPublicPartsSafe(serverResult);
      const projection = projectToolResultForModel(serverResult, attempt.toolCall);
      const content = projectedContent(projection);
      toolMessages.push(projection);
      toolResults.push(content);
      toolExecutionOrder.push(providerVisibleName(attempt.toolCall));
      auditRefs.push(content.auditRef);
      if (execution.executed) counts.executed += 1;
      if (content.status === "rejected" || content.status === "failed") counts.rejected += 1;
    }

    if (budgetExhausted) {
      status = "tool_budget_exhausted";
      break;
    }
  }

  if (steps.length >= maxSteps && !finalPayload && !budgetExhausted) {
    status = "max_steps_reached";
  }

  return {
    schemaVersion: GAME_TOOL_LOOP_SCHEMA_VERSION,
    status,
    finalPayload,
    toolCounts: counts,
    toolMessages,
    toolResults,
    toolExecutionOrder,
    auditRefs: [...new Set(auditRefs)].slice(0, 20),
    providerVisibleToolCount: loopContext.availableTools.length,
    publicTrace: summarizePublicTrace(
      status,
      counts,
      [...new Set(auditRefs)],
      loopContext.availableTools.length
    )
  };
}

function listProviderVisibleToolsForActor(actorProfile = {}, toolRegistry = createGameAiToolRegistry()) {
  const tools = listToolsForActor(actorProfile, toolRegistry);
  return buildProviderVisibleToolList(tools);
}

module.exports = {
  GAME_TOOL_LOOP_SCHEMA_VERSION,
  GAME_TOOL_LOOP_TRACE_SCHEMA_VERSION,
  listProviderVisibleToolsForActor,
  runGameToolLoop
};
