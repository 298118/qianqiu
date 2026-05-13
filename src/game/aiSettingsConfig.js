const AI_SETTINGS_SCHEMA_VERSION = "s70.9-ai-settings.v1";

const AI_SETTING_PRESETS = Object.freeze({
  balanced: Object.freeze({
    id: "balanced",
    label: "均衡",
    outputScale: 1,
    toolBudgetScale: 1,
    maxConcurrency: 2,
    safetyStrictness: "standard",
    criticEnabled: true,
    safetyGateEnabled: true
  }),
  quality_first: Object.freeze({
    id: "quality_first",
    label: "审慎",
    outputScale: 1.25,
    toolBudgetScale: 1,
    maxConcurrency: 2,
    safetyStrictness: "strict",
    criticEnabled: true,
    safetyGateEnabled: true
  }),
  fast: Object.freeze({
    id: "fast",
    label: "迅捷",
    outputScale: 0.72,
    toolBudgetScale: 0.6,
    maxConcurrency: 1,
    safetyStrictness: "standard",
    criticEnabled: false,
    safetyGateEnabled: true
  }),
  long_context: Object.freeze({
    id: "long_context",
    label: "长卷",
    outputScale: 1.5,
    toolBudgetScale: 1,
    maxConcurrency: 2,
    safetyStrictness: "strict",
    criticEnabled: true,
    safetyGateEnabled: true
  }),
  mimo_full: Object.freeze({
    id: "mimo_full",
    label: "MiMo",
    outputScale: 1.12,
    toolBudgetScale: 1,
    maxConcurrency: 2,
    safetyStrictness: "standard",
    criticEnabled: true,
    safetyGateEnabled: true
  })
});

const AI_TASK_LABELS = Object.freeze({
  narrator: "叙事",
  actor_mind: "人物心智",
  planner: "筹划",
  domain_specialist: "制度专题",
  critic: "复核",
  safety_gate: "安全门",
  memory_summarizer: "记忆提要",
  monthly_briefing: "月报",
  time_skip_planner: "跳时"
});

const AI_SAFETY_STRICTNESS = Object.freeze(["standard", "strict", "maximum"]);
const AI_INVOCATION_LOG_LIMIT = 12;

module.exports = {
  AI_INVOCATION_LOG_LIMIT,
  AI_SETTING_PRESETS,
  AI_SETTINGS_SCHEMA_VERSION,
  AI_SAFETY_STRICTNESS,
  AI_TASK_LABELS
};
