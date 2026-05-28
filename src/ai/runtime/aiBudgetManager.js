// @ts-check

const AI_TASK_BUDGET_LIMITS = Object.freeze({
  minOutputTokens: 128,
  maxOutputTokens: 16000,
  minTimeoutMs: 1000,
  maxTimeoutMs: 180000,
  minTemperature: 0,
  maxTemperature: 1,
  minToolBudget: 0,
  maxToolBudget: 20
});

function readInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function readNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function buildAiTaskBudget(route = {}, overrides = {}) {
  const toolBudget = readInteger(
    overrides.toolBudget ?? route.toolBudget,
    0,
    AI_TASK_BUDGET_LIMITS.minToolBudget,
    AI_TASK_BUDGET_LIMITS.maxToolBudget
  );
  const mayUseTools = Boolean(overrides.mayUseTools ?? route.mayUseTools) && toolBudget > 0;

  return assertAiTaskBudget({
    schemaVersion: "s92.2-ai-task-budget.v1",
    maxOutputTokens: readInteger(
      overrides.maxOutputTokens ?? route.maxOutputTokens,
      900,
      AI_TASK_BUDGET_LIMITS.minOutputTokens,
      AI_TASK_BUDGET_LIMITS.maxOutputTokens
    ),
    timeoutMs: readInteger(
      overrides.timeoutMs ?? route.timeoutMs,
      30000,
      AI_TASK_BUDGET_LIMITS.minTimeoutMs,
      AI_TASK_BUDGET_LIMITS.maxTimeoutMs
    ),
    temperature: readNumber(
      overrides.temperature ?? route.temperature,
      0.35,
      AI_TASK_BUDGET_LIMITS.minTemperature,
      AI_TASK_BUDGET_LIMITS.maxTemperature
    ),
    toolBudget: mayUseTools ? toolBudget : 0,
    mayUseTools,
    mayRequestAdjudication: mayUseTools
      ? Boolean(overrides.mayRequestAdjudication ?? route.mayRequestAdjudication)
      : false,
    mayWriteState: false,
    mayCallServerResolvers: false
  });
}

function assertAiTaskBudget(budget) {
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    throw new Error("AI task budget must be an object.");
  }
  if (budget.mayWriteState || budget.mayCallServerResolvers) {
    throw new Error("AI task runtime budget may not write state or call server resolvers.");
  }
  if (!budget.mayUseTools && budget.toolBudget !== 0) {
    throw new Error("AI task runtime budget must set toolBudget=0 when tools are disabled.");
  }
  if (!budget.mayUseTools && budget.mayRequestAdjudication) {
    throw new Error("AI task runtime budget may not request adjudication when tools are disabled.");
  }
  if (
    !Number.isInteger(budget.maxOutputTokens) ||
    !Number.isInteger(budget.timeoutMs) ||
    !Number.isInteger(budget.toolBudget) ||
    typeof budget.temperature !== "number"
  ) {
    throw new Error("AI task runtime budget has invalid numeric fields.");
  }
  return budget;
}

function summarizeAiTaskBudget(budget) {
  const safeBudget = assertAiTaskBudget(budget);
  return {
    schemaVersion: safeBudget.schemaVersion,
    maxOutputTokens: safeBudget.maxOutputTokens,
    timeoutMs: safeBudget.timeoutMs,
    temperature: safeBudget.temperature,
    toolBudget: safeBudget.toolBudget,
    mayUseTools: safeBudget.mayUseTools,
    mayRequestAdjudication: safeBudget.mayRequestAdjudication
  };
}

module.exports = {
  AI_TASK_BUDGET_LIMITS,
  assertAiTaskBudget,
  buildAiTaskBudget,
  summarizeAiTaskBudget
};
