const PROVIDER_ALIASES = Object.freeze({
  hybrid: "mimo-deepseek",
  "mimo_deepseek": "mimo-deepseek",
  "mimo+deepseek": "mimo-deepseek",
  xiaomi: "mimo",
  claude: "anthropic"
});

const SUPPORTED_PROVIDERS = Object.freeze([
  "mock",
  "openai",
  "deepseek",
  "mimo",
  "mimo-deepseek",
  "anthropic"
]);

const MODEL_TASK_TYPES = Object.freeze([
  "narrator",
  "actor_mind",
  "planner",
  "domain_specialist",
  "critic",
  "safety_gate",
  "memory_summarizer",
  "monthly_briefing",
  "time_skip_planner",
  "quick_action",
  "topic_draft"
]);

const REVIEW_ONLY_TASK_TYPES = Object.freeze(["critic", "safety_gate"]);
const TOOL_DISABLED_TASK_TYPES = Object.freeze(["critic", "safety_gate", "quick_action", "topic_draft"]);

const TASK_DEFAULTS = Object.freeze({
  narrator: {
    purpose: "普通叙事、玩家自由行动和流式文本。",
    temperature: 0.7,
    maxOutputTokens: 1800,
    toolBudget: 2,
    mayUseTools: true,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  actor_mind: {
    purpose: "高显著 NPC 或制度参与者的动机、请托和记忆候选。",
    temperature: 0.55,
    maxOutputTokens: 1200,
    toolBudget: 2,
    mayUseTools: true,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  planner: {
    purpose: "把复杂输入拆成服务器可验证的计划、阶段和证据需求。",
    temperature: 0.35,
    maxOutputTokens: 1200,
    toolBudget: 1,
    mayUseTools: true,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  domain_specialist: {
    purpose: "围绕刑名、财政、军务、外交、科举或任免提交 proposal。",
    temperature: 0.25,
    maxOutputTokens: 1400,
    toolBudget: 3,
    mayUseTools: true,
    mayRequestAdjudication: true,
    reviewerOnly: false
  },
  critic: {
    purpose: "检查因果、制度语气、工具参数和越权风险。",
    temperature: 0,
    maxOutputTokens: 900,
    toolBudget: 0,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: true
  },
  safety_gate: {
    purpose: "检查 hidden/raw 泄漏、直写库、伪造工具结果和外部工具越权。",
    temperature: 0,
    maxOutputTokens: 700,
    toolBudget: 0,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: true
  },
  memory_summarizer: {
    purpose: "把事件和关系整理成服务器可裁剪的记忆 proposal。",
    temperature: 0.2,
    maxOutputTokens: 1000,
    toolBudget: 1,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  monthly_briefing: {
    purpose: "为玩家当前职位生成月报、下月风险和公开待办。",
    temperature: 0.35,
    maxOutputTokens: 1600,
    toolBudget: 2,
    mayUseTools: true,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  time_skip_planner: {
    purpose: "把自然语言跳时意图拆成服务器逐旬执行的计划。",
    temperature: 0.15,
    maxOutputTokens: 900,
    toolBudget: 0,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  quick_action: {
    purpose: "根据玩家当前身份、公开情报和可用工具边界生成快捷行动草稿建议。",
    temperature: 0.35,
    maxOutputTokens: 900,
    toolBudget: 0,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: false
  },
  topic_draft: {
    purpose: "根据专题 surface 的公开材料和文体要求生成只读草稿，不裁决后果。",
    temperature: 0.35,
    maxOutputTokens: 1000,
    toolBudget: 0,
    mayUseTools: false,
    mayRequestAdjudication: false,
    reviewerOnly: false
  }
});

const ROUTE_ENV_KEYS = Object.freeze({
  narrator: ["AI_NARRATOR_PROVIDER", "AI_NARRATOR_MODEL"],
  actor_mind: ["AI_ACTOR_MIND_PROVIDER", "AI_ACTOR_MIND_MODEL"],
  planner: ["AI_PLANNER_PROVIDER", "AI_PLANNER_MODEL"],
  domain_specialist: ["AI_DOMAIN_PROVIDER", "AI_DOMAIN_MODEL"],
  critic: ["AI_CRITIC_PROVIDER", "AI_CRITIC_MODEL"],
  safety_gate: ["AI_SAFETY_PROVIDER", "AI_SAFETY_MODEL"],
  memory_summarizer: ["AI_MEMORY_PROVIDER", "AI_MEMORY_MODEL"],
  monthly_briefing: ["AI_MONTHLY_BRIEFING_PROVIDER", "AI_MONTHLY_BRIEFING_MODEL"],
  time_skip_planner: ["AI_TIME_SKIP_PROVIDER", "AI_TIME_SKIP_MODEL"],
  quick_action: ["AI_QUICK_ACTION_PROVIDER", "AI_QUICK_ACTION_MODEL"],
  topic_draft: ["AI_TOPIC_DRAFT_PROVIDER", "AI_TOPIC_DRAFT_MODEL"]
});

const PROVIDER_DEFAULT_MODELS = Object.freeze({
  mock: "mock",
  openai: "gpt-5.4-mini",
  deepseek: "deepseek-v4-flash",
  mimo: "mimo-v2.5-pro",
  "mimo-deepseek": "mimo-v2.5-pro",
  anthropic: "claude-sonnet-4-5"
});

function normalizeProviderName(value = "mock") {
  const raw = String(value || "mock").trim().toLowerCase();
  if (!raw) return "mock";
  return PROVIDER_ALIASES[raw] || raw;
}

function normalizeTaskType(taskType) {
  const normalized = String(taskType || "").trim().toLowerCase();
  if (!MODEL_TASK_TYPES.includes(normalized)) {
    throw new Error(`Unknown AI model task type: ${taskType}`);
  }
  return normalized;
}

function readEnv(env, key, fallback = "") {
  const value = env && Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function readPositiveInt(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function pickDefaultProviderForTask(taskType, env, options = {}) {
  const configuredProvider = normalizeProviderName(
    options.defaultProvider || readEnv(env, "AI_PROVIDER", "mock")
  );
  if (configuredProvider === "mock") return "mock";

  const [providerEnv] = ROUTE_ENV_KEYS[taskType] || [];
  const explicitProviderRaw = readEnv(env, providerEnv, "");
  if (explicitProviderRaw) return normalizeProviderName(explicitProviderRaw);

  if (configuredProvider === "deepseek") return "deepseek";
  if (configuredProvider === "mimo-deepseek") {
    const hasDeepSeekKey = Boolean(readEnv(env, "DEEPSEEK_API_KEY", ""));
    if (
      hasDeepSeekKey &&
      (taskType === "critic" || taskType === "domain_specialist" || taskType === "safety_gate")
    ) {
      return "deepseek";
    }
    return "mimo";
  }

  return configuredProvider;
}

function pickDefaultModelForTask(taskType, provider, env) {
  const [, modelEnv] = ROUTE_ENV_KEYS[taskType] || [];
  const explicitModel = readEnv(env, modelEnv, "");
  if (explicitModel) return explicitModel;

  if (provider === "deepseek") {
    if (taskType === "narrator") return readEnv(env, "DEEPSEEK_TURN_MODEL", PROVIDER_DEFAULT_MODELS.deepseek);
    if (taskType === "domain_specialist" || taskType === "critic" || taskType === "safety_gate") {
      return readEnv(env, "DEEPSEEK_GRADE_MODEL", PROVIDER_DEFAULT_MODELS.deepseek);
    }
    return readEnv(env, "DEEPSEEK_MODEL", PROVIDER_DEFAULT_MODELS.deepseek);
  }
  if (provider === "mimo") return readEnv(env, "MIMO_MODEL", PROVIDER_DEFAULT_MODELS.mimo);
  if (provider === "mimo-deepseek") return readEnv(env, "MIMO_MODEL", PROVIDER_DEFAULT_MODELS["mimo-deepseek"]);
  if (provider === "openai") return readEnv(env, "OPENAI_MODEL", PROVIDER_DEFAULT_MODELS.openai);
  if (provider === "anthropic") return readEnv(env, "ANTHROPIC_MODEL", PROVIDER_DEFAULT_MODELS.anthropic);
  return PROVIDER_DEFAULT_MODELS.mock;
}

function buildRoute(taskType, env, options = {}) {
  const defaults = TASK_DEFAULTS[taskType];
  const provider = pickDefaultProviderForTask(taskType, env, options);
  const model = pickDefaultModelForTask(taskType, provider, env);
  const tokenEnv = `AI_${taskType.toUpperCase()}_MAX_OUTPUT_TOKENS`;
  const toolBudgetEnv = `AI_${taskType.toUpperCase()}_TOOL_BUDGET`;
  const timeoutEnv = `AI_${taskType.toUpperCase()}_TIMEOUT_MS`;
  const toolDisabled = TOOL_DISABLED_TASK_TYPES.includes(taskType);

  return {
    taskType,
    provider,
    model,
    purpose: defaults.purpose,
    temperature: defaults.temperature,
    maxOutputTokens: readPositiveInt(readEnv(env, tokenEnv, ""), defaults.maxOutputTokens, { min: 128, max: 16000 }),
    timeoutMs: readPositiveInt(readEnv(env, timeoutEnv, ""), options.timeoutMs || 30000, { min: 1000, max: 180000 }),
    toolBudget: toolDisabled ? 0 : readPositiveInt(readEnv(env, toolBudgetEnv, ""), defaults.toolBudget, { min: 0, max: 20 }),
    mayUseTools: toolDisabled ? false : Boolean(defaults.mayUseTools),
    mayRequestAdjudication: toolDisabled ? false : Boolean(defaults.mayRequestAdjudication),
    mayWriteState: false,
    mayCallServerResolvers: false,
    reviewerOnly: Boolean(defaults.reviewerOnly),
    fallbackProvider: "mock",
    audit: {
      recordTask: true,
      recordCostSummary: true,
      redactPrompt: true,
      redactProviderPayload: true
    }
  };
}

function buildDefaultModelRoutePolicy(env = process.env, options = {}) {
  const routes = {};
  for (const taskType of MODEL_TASK_TYPES) {
    routes[taskType] = buildRoute(taskType, env, options);
  }

  return validateModelRoutePolicy({
    schemaVersion: "s70.8-model-route-policy.v1",
    defaultProvider: normalizeProviderName(options.defaultProvider || readEnv(env, "AI_PROVIDER", "mock")),
    routes,
    safeguards: {
      serverOwnsState: true,
      criticAndSafetyReviewOnly: true,
      noRawSqlTools: true,
      noHiddenContextUpgrade: true,
      consensusDoesNotBypassResolver: true
    }
  });
}

function validateRoute(taskType, route) {
  if (!route || typeof route !== "object" || Array.isArray(route)) {
    throw new Error(`Model route for ${taskType} must be an object.`);
  }
  if (route.taskType !== taskType) {
    throw new Error(`Model route taskType mismatch for ${taskType}.`);
  }
  if (!SUPPORTED_PROVIDERS.includes(normalizeProviderName(route.provider))) {
    throw new Error(`Unsupported provider for ${taskType}: ${route.provider}`);
  }
  if (!route.model || typeof route.model !== "string") {
    throw new Error(`Model route for ${taskType} requires a model string.`);
  }
  if (route.mayWriteState) {
    throw new Error(`Model route ${taskType} may not write state.`);
  }
  if (route.mayCallServerResolvers) {
    throw new Error(`Model route ${taskType} may not call server resolvers directly.`);
  }
  if (String(route.model).startsWith("server.") || String(route.provider).startsWith("server.")) {
    throw new Error(`Model route ${taskType} may not expose server.* as provider or model.`);
  }

  if (REVIEW_ONLY_TASK_TYPES.includes(taskType)) {
    if (route.mayUseTools || route.toolBudget !== 0 || route.mayRequestAdjudication || !route.reviewerOnly) {
      throw new Error(`Review-only route ${taskType} cannot use tools or request adjudication.`);
    }
  } else if (TOOL_DISABLED_TASK_TYPES.includes(taskType)) {
    if (route.mayUseTools || route.toolBudget !== 0 || route.mayRequestAdjudication) {
      throw new Error(`No-tool route ${taskType} cannot use tools or request adjudication.`);
    }
  }
}

function validateModelRoutePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("Model route policy must be an object.");
  }
  if (!policy.routes || typeof policy.routes !== "object" || Array.isArray(policy.routes)) {
    throw new Error("Model route policy requires routes.");
  }

  for (const taskType of MODEL_TASK_TYPES) {
    validateRoute(taskType, policy.routes[taskType]);
  }

  if (!policy.safeguards?.serverOwnsState || !policy.safeguards?.consensusDoesNotBypassResolver) {
    throw new Error("Model route policy must preserve server-owned state and resolver authority.");
  }

  return policy;
}

function resolveModelForTask(taskType, routePolicy) {
  const normalizedTaskType = normalizeTaskType(taskType);
  const policy = validateModelRoutePolicy(routePolicy || buildDefaultModelRoutePolicy());
  return {
    ...policy.routes[normalizedTaskType],
    provider: normalizeProviderName(policy.routes[normalizedTaskType].provider)
  };
}

function summarizeModelRoutePolicy(policy) {
  const validated = validateModelRoutePolicy(policy);
  return {
    schemaVersion: validated.schemaVersion,
    defaultProvider: normalizeProviderName(validated.defaultProvider),
    tasks: MODEL_TASK_TYPES.map((taskType) => {
      const route = validated.routes[taskType];
      return {
        taskType,
        provider: normalizeProviderName(route.provider),
        model: route.model,
        maxOutputTokens: route.maxOutputTokens,
        toolBudget: route.toolBudget,
        reviewerOnly: Boolean(route.reviewerOnly)
      };
    }),
    safeguards: { ...validated.safeguards }
  };
}

module.exports = {
  MODEL_TASK_TYPES,
  REVIEW_ONLY_TASK_TYPES,
  TOOL_DISABLED_TASK_TYPES,
  SUPPORTED_PROVIDERS,
  buildDefaultModelRoutePolicy,
  normalizeProviderName,
  normalizeTaskType,
  resolveModelForTask,
  summarizeModelRoutePolicy,
  validateModelRoutePolicy
};
