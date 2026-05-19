const fs = require("fs");
const path = require("path");

const {
  MODEL_TASK_TYPES,
  REVIEW_ONLY_TASK_TYPES,
  SUPPORTED_PROVIDERS,
  TOOL_DISABLED_TASK_TYPES,
  buildDefaultModelRoutePolicy,
  normalizeProviderName,
  resolveModelForTask,
  validateModelRoutePolicy
} = require("../ai/modelRoutePolicy");
const {
  AI_INVOCATION_LOG_LIMIT,
  AI_SETTING_PRESETS,
  AI_SETTINGS_SCHEMA_VERSION,
  AI_SAFETY_STRICTNESS,
  AI_TASK_LABELS
} = require("./aiSettingsConfig");

const GLOBAL_AI_SETTINGS_SCHEMA_VERSION = "s80-ai-global-settings.v1";
const DEFAULT_GLOBAL_AI_SETTINGS_PATH = path.join(__dirname, "..", "..", "data", "settings", "ai-global-settings.json");

const SENSITIVE_AI_SETTINGS_PATTERN =
  /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:statePatch|worldState|rawSql|server\.)\b|retrievalContext|prompt_retrieval_index|event_archive_index|world_sessions|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/][^\s"'<>]+|\\\\[^\\/\s"'<>]+[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function normalizeSettingKeyForSafety(key) {
  return String(key).toLowerCase().replace(/[\s_.-]+/g, "");
}

const FORBIDDEN_SETTING_KEYS = new Set([
  "hidden",
  "hiddenNotes",
  "hiddenIntent",
  "private",
  "raw",
  "rawAudit",
  "rawLedger",
  "rawProviderPayload",
  "rawProvider",
  "rawPrompt",
  "rawSql",
  "hiddenRaw",
  "statePatch",
  "worldState",
  "directWrite",
  "directStateWrite",
  "mayWriteState",
  "mayCallServerResolvers",
  "server",
  "serverResolver",
  "serverResolvers",
  "resolver",
  "readHidden",
  "writeDatabase",
  "writeSql",
  "path",
  "localPath",
  "filePath",
  "basePath",
  "baseURL",
  "baseUrl",
  "apiKey",
  "accessToken",
  "authToken",
  "bearerToken",
  "key",
  "secret",
  "token"
].map((key) => normalizeSettingKeyForSafety(key)));

const ROUTE_PATCH_KEYS = new Set([
  "provider",
  "model",
  "maxOutputTokens",
  "toolBudget",
  "temperature"
]);

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampInt(value, fallback, min, max) {
  return Math.trunc(clampNumber(value, fallback, min, max));
}

function cleanVisibleText(value, fallback = "", maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || SENSITIVE_AI_SETTINGS_PATTERN.test(text)) return fallback;
  return text.slice(0, maxLength);
}

function shouldUseDefaultGlobalSettingsPath(env = process.env) {
  if (env !== process.env) return false;
  return !process.argv.includes("--test");
}

function resolveGlobalAiSettingsPath(env = process.env, options = {}) {
  const explicitPath = env && Object.prototype.hasOwnProperty.call(env, "AI_GLOBAL_SETTINGS_PATH")
    ? env.AI_GLOBAL_SETTINGS_PATH
    : undefined;
  if (explicitPath) return path.resolve(String(explicitPath));
  if (shouldUseDefaultGlobalSettingsPath(env)) return DEFAULT_GLOBAL_AI_SETTINGS_PATH;
  return null;
}

function createGlobalSettingsError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function assertSettingsSafe(value, path = "aiSettings") {
  if (typeof value === "string") {
    if (SENSITIVE_AI_SETTINGS_PATTERN.test(value)) {
      throw new Error(`${path} 含有 hidden/raw/server/path/key 等禁止设置内容。`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeSettingKeyForSafety(key);
    if (FORBIDDEN_SETTING_KEYS.has(normalizedKey) || SENSITIVE_AI_SETTINGS_PATTERN.test(key)) {
      const safeKey = cleanVisibleText(key, "[blocked]", 40);
      throw new Error(`${path}.${safeKey} 是 AI 设置禁止字段。`);
    }
    assertSettingsSafe(child, `${path}.${key}`);
  }
}

function normalizePreset(value) {
  const preset = String(value || "balanced").trim();
  return AI_SETTING_PRESETS[preset] ? preset : "balanced";
}

function normalizeSafetyStrictness(value, fallback = "standard") {
  const normalized = String(value || fallback).trim();
  return AI_SAFETY_STRICTNESS.includes(normalized) ? normalized : fallback;
}

function normalizePatchShape(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  const controls = patch.controls && typeof patch.controls === "object" && !Array.isArray(patch.controls)
    ? patch.controls
    : {};
  return {
    ...patch,
    outputScale: patch.outputScale ?? controls.outputScale,
    toolBudgetScale: patch.toolBudgetScale ?? controls.toolBudgetScale,
    maxConcurrency: patch.maxConcurrency ?? controls.maxConcurrency,
    safetyStrictness: patch.safetyStrictness ?? controls.safetyStrictness,
    criticEnabled: patch.criticEnabled ?? controls.criticEnabled,
    safetyGateEnabled: patch.safetyGateEnabled ?? controls.safetyGateEnabled
  };
}

function normalizeInvocationLog(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(-AI_INVOCATION_LOG_LIMIT).map((entry = {}) => ({
    id: cleanVisibleText(entry.id, `ai-invocation:${Date.now()}`, 80),
    taskType: cleanVisibleText(entry.taskType, "narrator", 40),
    provider: normalizeProviderName(entry.provider || "mock"),
    model: redactModelName(entry.model || "mock"),
    status: cleanVisibleText(entry.status, "completed", 32),
    durationMs: clampInt(entry.durationMs, 0, 0, 300000),
    maxOutputTokens: clampInt(entry.maxOutputTokens, 0, 0, 16000),
    toolCallCount: clampInt(entry.toolCallCount, 0, 0, 100),
    rejectedToolCallCount: clampInt(entry.rejectedToolCallCount, 0, 0, 100),
    rejectionReasons: Array.isArray(entry.rejectionReasons)
      ? entry.rejectionReasons.map((reason) => cleanVisibleText(reason, "", 80)).filter(Boolean).slice(0, 4)
      : [],
    recordedTurn: clampInt(entry.recordedTurn, 0, 0, Number.MAX_SAFE_INTEGER)
  }));
}

function normalizeRoutePatch(taskType, patch = {}) {
  if (!MODEL_TASK_TYPES.includes(taskType)) {
    throw new Error(`未知 AI 任务类型：${taskType}`);
  }
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error(`${taskType} AI 路由设置必须是对象。`);
  }

  for (const key of Object.keys(patch)) {
    if (!ROUTE_PATCH_KEYS.has(key)) {
      throw new Error(`${taskType} AI 路由设置包含不支持字段：${key}`);
    }
  }

  const normalized = {};
  if (patch.provider !== undefined) {
    const provider = normalizeProviderName(patch.provider);
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`${taskType} provider 不受支持。`);
    }
    normalized.provider = provider;
  }
  if (patch.model !== undefined) {
    const model = cleanVisibleText(patch.model, "", 96);
    if (!model) throw new Error(`${taskType} model 不可包含 hidden/raw/server/path/key 内容。`);
    normalized.model = model;
  }
  if (patch.maxOutputTokens !== undefined) {
    normalized.maxOutputTokens = clampInt(patch.maxOutputTokens, 1200, 128, 16000);
  }
  if (patch.toolBudget !== undefined) {
    normalized.toolBudget = clampInt(patch.toolBudget, 0, 0, 20);
  }
  if (patch.temperature !== undefined) {
    normalized.temperature = Number(clampNumber(patch.temperature, 0.35, 0, 1).toFixed(2));
  }
  if (TOOL_DISABLED_TASK_TYPES.includes(taskType) && normalized.toolBudget && normalized.toolBudget > 0) {
    normalized.toolBudget = 0;
  }

  return normalized;
}

function normalizeTaskRoutes(taskRoutes = {}) {
  if (!taskRoutes || typeof taskRoutes !== "object" || Array.isArray(taskRoutes)) return {};
  const normalized = {};
  for (const [taskType, routePatch] of Object.entries(taskRoutes)) {
    normalized[taskType] = normalizeRoutePatch(taskType, routePatch);
  }
  return normalized;
}

function buildDefaultAiSettings(patch = {}, options = {}) {
  assertSettingsSafe(patch);
  if (!options.allowObservabilityPatch && patch.observability !== undefined) {
    throw new Error("AI 设置观测记录由服务器维护。");
  }
  const normalizedPatch = normalizePatchShape(patch);
  const presetId = normalizePreset(normalizedPatch.preset);
  const preset = AI_SETTING_PRESETS[presetId];
  const controls = {
    outputScale: Number(clampNumber(normalizedPatch.outputScale, preset.outputScale, 0.5, 1.75).toFixed(2)),
    toolBudgetScale: Number(clampNumber(normalizedPatch.toolBudgetScale, preset.toolBudgetScale, 0, 1.5).toFixed(2)),
    maxConcurrency: clampInt(normalizedPatch.maxConcurrency, preset.maxConcurrency, 1, 4),
    safetyStrictness: normalizeSafetyStrictness(normalizedPatch.safetyStrictness, preset.safetyStrictness),
    criticEnabled: normalizedPatch.criticEnabled === undefined
      ? Boolean(preset.criticEnabled)
      : Boolean(normalizedPatch.criticEnabled),
    safetyGateEnabled: normalizedPatch.safetyGateEnabled === undefined
      ? Boolean(preset.safetyGateEnabled)
      : Boolean(normalizedPatch.safetyGateEnabled)
  };

  return {
    schemaVersion: AI_SETTINGS_SCHEMA_VERSION,
    preset: presetId,
    controls,
    taskRoutes: normalizeTaskRoutes(normalizedPatch.taskRoutes),
    observability: {
      recentInvocations: options.allowObservabilityPatch
        ? normalizeInvocationLog(patch.observability?.recentInvocations)
        : []
    }
  };
}

function mergeAiSettings(base, patch = {}, options = {}) {
  assertSettingsSafe(patch);
  if (!options.allowObservabilityPatch && patch.observability !== undefined) {
    throw new Error("AI 设置观测记录由服务器维护。");
  }
  const normalizedPatch = normalizePatchShape(patch);
  const presetId = normalizedPatch.preset === undefined ? base.preset : normalizePreset(normalizedPatch.preset);
  const preset = AI_SETTING_PRESETS[presetId];
  const baseControls = base.controls || {};
  const controls = {
    outputScale: Number(clampNumber(
      normalizedPatch.outputScale,
      baseControls.outputScale ?? preset.outputScale,
      0.5,
      1.75
    ).toFixed(2)),
    toolBudgetScale: Number(clampNumber(
      normalizedPatch.toolBudgetScale,
      baseControls.toolBudgetScale ?? preset.toolBudgetScale,
      0,
      1.5
    ).toFixed(2)),
    maxConcurrency: clampInt(
      normalizedPatch.maxConcurrency,
      baseControls.maxConcurrency ?? preset.maxConcurrency,
      1,
      4
    ),
    safetyStrictness: normalizeSafetyStrictness(
      normalizedPatch.safetyStrictness,
      baseControls.safetyStrictness || preset.safetyStrictness
    ),
    criticEnabled: normalizedPatch.criticEnabled === undefined
      ? Boolean(baseControls.criticEnabled ?? preset.criticEnabled)
      : Boolean(normalizedPatch.criticEnabled),
    safetyGateEnabled: normalizedPatch.safetyGateEnabled === undefined
      ? Boolean(baseControls.safetyGateEnabled ?? preset.safetyGateEnabled)
      : Boolean(normalizedPatch.safetyGateEnabled)
  };

  return {
    schemaVersion: AI_SETTINGS_SCHEMA_VERSION,
    preset: presetId,
    controls,
    taskRoutes: {
      ...(base.taskRoutes || {}),
      ...normalizeTaskRoutes(normalizedPatch.taskRoutes)
    },
    observability: {
      recentInvocations: options.allowObservabilityPatch && Array.isArray(normalizedPatch.observability?.recentInvocations)
        ? normalizeInvocationLog(normalizedPatch.observability.recentInvocations)
        : normalizeInvocationLog(base.observability?.recentInvocations)
    }
  };
}

function validateAiSettingsPatch(patch = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("AI 设置 patch 必须是对象。");
  }
  return mergeAiSettings(buildDefaultAiSettings(), patch);
}

function ensureAiSettingsState(worldState = {}) {
  const current = worldState.aiSettings && typeof worldState.aiSettings === "object" && !Array.isArray(worldState.aiSettings)
    ? worldState.aiSettings
    : {};
  worldState.aiSettings = mergeAiSettings(buildDefaultAiSettings(), current, { allowObservabilityPatch: true });
  return worldState.aiSettings;
}

function applyPresetToRoute(route, settings) {
  const controls = settings.controls || {};
  const scale = Number(controls.outputScale || 1);
  const toolScale = Number(controls.toolBudgetScale ?? 1);
  const reviewOnly = REVIEW_ONLY_TASK_TYPES.includes(route.taskType);
  const toolDisabled = TOOL_DISABLED_TASK_TYPES.includes(route.taskType);
  return {
    ...route,
    maxOutputTokens: clampInt(route.maxOutputTokens * scale, route.maxOutputTokens, 128, 16000),
    toolBudget: toolDisabled ? 0 : clampInt(route.toolBudget * toolScale, route.toolBudget, 0, 20),
    mayUseTools: toolDisabled ? false : route.mayUseTools,
    mayRequestAdjudication: toolDisabled ? false : route.mayRequestAdjudication,
    reviewerOnly: reviewOnly ? true : route.reviewerOnly
  };
}

function applyTaskRoutePatch(route, routePatch = {}) {
  const reviewOnly = REVIEW_ONLY_TASK_TYPES.includes(route.taskType);
  const toolDisabled = TOOL_DISABLED_TASK_TYPES.includes(route.taskType);
  const next = {
    ...route,
    ...routePatch,
    toolBudget: toolDisabled ? 0 : routePatch.toolBudget ?? route.toolBudget,
    mayUseTools: toolDisabled ? false : route.mayUseTools,
    mayRequestAdjudication: toolDisabled ? false : route.mayRequestAdjudication,
    mayWriteState: false,
    mayCallServerResolvers: false,
    reviewerOnly: reviewOnly ? true : route.reviewerOnly
  };

  return next;
}

function buildRoutePolicyFromSettings(settings, env = process.env, options = {}) {
  const routePolicy = buildDefaultModelRoutePolicy(env, options);
  for (const taskType of MODEL_TASK_TYPES) {
    routePolicy.routes[taskType] = applyTaskRoutePatch(
      applyPresetToRoute(routePolicy.routes[taskType], settings),
      settings.taskRoutes?.[taskType]
    );
  }
  return validateModelRoutePolicy(routePolicy);
}

function normalizeGlobalSettingsRecordPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createGlobalSettingsError("全局 AI 设置文件格式错误。");
  }
  const rawSettings = payload.settings || payload.aiSettings || payload;
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) {
    throw createGlobalSettingsError("全局 AI 设置文件缺少 settings。");
  }
  const settings = mergeAiSettings(buildDefaultAiSettings(), rawSettings);
  return {
    schemaVersion: cleanVisibleText(payload.schemaVersion, GLOBAL_AI_SETTINGS_SCHEMA_VERSION, 64),
    settings,
    updatedAt: cleanVisibleText(payload.updatedAt, "", 64) || null
  };
}

function readGlobalAiSettingsRecord(env = process.env, options = {}) {
  const filePath = resolveGlobalAiSettingsPath(env, options);
  if (!filePath) {
    return {
      exists: false,
      settings: null,
      updatedAt: null
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      exists: true,
      ...normalizeGlobalSettingsRecordPayload(parsed)
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        settings: null,
        updatedAt: null
      };
    }
    if (error.statusCode) throw error;
    throw createGlobalSettingsError("全局 AI 设置文件无法读取或格式错误。");
  }
}

function globalSettingsState(settings, worldState = {}) {
  return {
    ...worldState,
    sessionId: worldState.sessionId || "global-ai-settings",
    turnCount: worldState.turnCount || 0,
    aiSettings: {
      ...settings,
      observability: worldState.aiSettings?.observability || settings.observability
    }
  };
}

function writeGlobalAiSettingsRecord(settings, env = process.env) {
  assertSettingsSafe(settings);
  const filePath = resolveGlobalAiSettingsPath(env, { forWrite: true });
  if (!filePath) throw createGlobalSettingsError("全局 AI 设置路径不可用。");
  const updatedAt = new Date().toISOString();
  const record = {
    schemaVersion: GLOBAL_AI_SETTINGS_SCHEMA_VERSION,
    settingsSchemaVersion: settings.schemaVersion,
    updatedAt,
    settings: {
      schemaVersion: settings.schemaVersion,
      preset: settings.preset,
      controls: { ...settings.controls },
      taskRoutes: { ...(settings.taskRoutes || {}) }
    }
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch (cleanupError) {
      // best effort
    }
    throw error;
  }
  return record;
}

function buildGlobalAiSettingsPayload(env = process.env, options = {}) {
  const record = readGlobalAiSettingsRecord(env, options);
  const settings = record.exists ? record.settings : buildDefaultAiSettings();
  const routePolicy = buildRoutePolicyFromSettings(settings, env);
  const worldState = globalSettingsState(settings, options.worldState);
  const aiInvocationSummaryView = buildAiInvocationSummaryView(worldState, routePolicy, env);
  return {
    sessionId: options.worldState?.sessionId || "global",
    targetSessionId: options.targetSessionId || options.worldState?.sessionId || null,
    scope: "global",
    updatedAt: record.updatedAt,
    globalSettingsExists: record.exists,
    aiSettingsView: redactAiSettingsForClient({ ...settings, routePolicy }, env),
    aiInvocationSummaryView,
    aiControlAuditView: options.buildAiControlAuditView
      ? options.buildAiControlAuditView(worldState, { routePolicy, aiInvocationSummaryView })
      : undefined
  };
}

function updateGlobalAiSettings(patch = {}, env = process.env, options = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("AI 设置 patch 必须是对象。");
  }
  const record = readGlobalAiSettingsRecord(env, { forWrite: true });
  const worldState = globalSettingsState(record.exists ? record.settings : buildDefaultAiSettings(), options.worldState);
  const result = updateAiSettings(worldState, patch, env);
  assertRouteProvidersAvailable(result.routePolicy, env);
  const saved = writeGlobalAiSettingsRecord(result.settings, env);
  const aiInvocationSummaryView = buildAiInvocationSummaryView(worldState, result.routePolicy, env);
  return {
    sessionId: options.worldState?.sessionId || "global",
    targetSessionId: options.targetSessionId || options.worldState?.sessionId || null,
    scope: "global",
    updatedAt: saved.updatedAt,
    globalSettingsExists: true,
    settings: result.settings,
    routePolicy: result.routePolicy,
    aiSettingsView: redactAiSettingsForClient({ ...result.settings, routePolicy: result.routePolicy }, env),
    aiInvocationSummaryView,
    aiControlAuditView: options.buildAiControlAuditView
      ? options.buildAiControlAuditView(worldState, {
        routePolicy: result.routePolicy,
        aiInvocationSummaryView
      })
      : undefined
  };
}

function resolveAiSettingsForSession(worldState = {}, env = process.env, options = {}) {
  const globalRecord = readGlobalAiSettingsRecord(env, options);
  const settings = globalRecord.exists ? globalRecord.settings : ensureAiSettingsState(worldState);
  const routePolicy = buildRoutePolicyFromSettings(settings, env, options);
  return {
    settings,
    routePolicy,
    scope: globalRecord.exists ? "global" : "session",
    updatedAt: globalRecord.updatedAt,
    globalSettingsExists: globalRecord.exists
  };
}

function providerHasRequiredKeys(provider, env = process.env) {
  const normalized = normalizeProviderName(provider);
  if (normalized === "mock") return true;
  if (normalized === "openai") return Boolean(env.OPENAI_API_KEY);
  if (normalized === "deepseek") return Boolean(env.DEEPSEEK_API_KEY);
  if (normalized === "mimo") return Boolean(env.MIMO_API_KEY);
  if (normalized === "mimo-deepseek") return Boolean(env.MIMO_API_KEY && env.DEEPSEEK_API_KEY);
  if (normalized === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
  return false;
}

function assertRouteProvidersAvailable(routePolicy, env = process.env) {
  const unavailable = MODEL_TASK_TYPES
    .map((taskType) => resolveModelForTask(taskType, routePolicy))
    .filter((route) => !providerHasRequiredKeys(route.provider, env));
  if (!unavailable.length) return;
  const summary = unavailable
    .map((route) => `${AI_TASK_LABELS[route.taskType] || route.taskType}:${route.provider}`)
    .join("，");
  throw new Error(`全局 AI 设置不能保存缺少 key 的 provider：${summary}。`);
}

function redactModelName(model) {
  return cleanVisibleText(model, "[redacted-model]", 96);
}

function routeEffectiveStatus(route, env = process.env) {
  if (!providerHasRequiredKeys(route.provider, env)) return "missing_provider_key";
  if (route.reviewerOnly) return "review_only";
  if (!route.mayUseTools && route.toolBudget === 0) return "no_tool";
  return "active";
}

function redactAiSettingsForClient(settings, env = process.env) {
  const resolved = settings.routePolicy
    ? settings
    : { ...settings, routePolicy: buildRoutePolicyFromSettings(settings, env) };
  const routePolicy = resolved.routePolicy;
  const preset = AI_SETTING_PRESETS[resolved.preset] || AI_SETTING_PRESETS.balanced;

  return {
    schemaVersion: AI_SETTINGS_SCHEMA_VERSION,
    preset: resolved.preset,
    presetLabel: preset.label,
    presets: Object.values(AI_SETTING_PRESETS).map((item) => ({
      id: item.id,
      label: item.label
    })),
    providerOptions: SUPPORTED_PROVIDERS.map((provider) => ({
      provider,
      available: providerHasRequiredKeys(provider, env),
      requiresKey: provider !== "mock"
    })),
    controls: { ...resolved.controls },
    taskRoutes: MODEL_TASK_TYPES.map((taskType) => {
      const route = resolveModelForTask(taskType, routePolicy);
      const providerAvailable = providerHasRequiredKeys(route.provider, env);
      return {
        taskType,
        label: AI_TASK_LABELS[taskType] || taskType,
        purpose: cleanVisibleText(route.purpose, AI_TASK_LABELS[taskType] || taskType, 160),
        provider: route.provider,
        providerAvailable,
        requiresKey: route.provider !== "mock",
        effectiveStatus: routeEffectiveStatus(route, env),
        model: redactModelName(route.model),
        maxOutputTokens: route.maxOutputTokens,
        toolBudget: route.toolBudget,
        temperature: route.temperature,
        reviewerOnly: Boolean(route.reviewerOnly),
        mayUseTools: Boolean(route.mayUseTools),
        mayRequestAdjudication: Boolean(route.mayRequestAdjudication)
      };
    }),
    safeguards: {
      serverOwnsState: true,
      noHiddenRawAccess: true,
      noDirectDatabaseWrites: true,
      reviewOnlyTasks: [...REVIEW_ONLY_TASK_TYPES]
    }
  };
}

function buildRouteCostSummary(routePolicy, env = process.env) {
  const policy = validateModelRoutePolicy(routePolicy);
  const routes = MODEL_TASK_TYPES.map((taskType) => resolveModelForTask(taskType, policy));
  return {
    taskCount: routes.length,
    maxOutputTokens: routes.reduce((sum, route) => sum + route.maxOutputTokens, 0),
    maxToolCalls: routes.reduce((sum, route) => sum + route.toolBudget, 0),
    reviewerOnlyTasks: routes.filter((route) => route.reviewerOnly).map((route) => route.taskType),
    providers: [...new Set(routes.map((route) => route.provider))].sort(),
    unavailableProviders: [...new Set(routes
      .filter((route) => !providerHasRequiredKeys(route.provider, env))
      .map((route) => route.provider))]
      .sort()
  };
}

function recordAiInvocation(worldState = {}, invocation = {}) {
  const settings = ensureAiSettingsState(worldState);
  const route = invocation.route || {};
  const item = {
    id: cleanVisibleText(invocation.id, `ai-invocation:${Date.now()}`, 80),
    taskType: cleanVisibleText(invocation.taskType || route.taskType, "narrator", 40),
    provider: normalizeProviderName(invocation.provider || route.provider || "mock"),
    model: redactModelName(invocation.model || route.model || "mock"),
    status: cleanVisibleText(invocation.status, "completed", 32),
    durationMs: clampInt(invocation.durationMs, 0, 0, 300000),
    maxOutputTokens: clampInt(invocation.maxOutputTokens ?? route.maxOutputTokens, 0, 0, 16000),
    toolCallCount: clampInt(invocation.toolCallCount, 0, 0, 100),
    rejectedToolCallCount: clampInt(invocation.rejectedToolCallCount, 0, 0, 100),
    rejectionReasons: Array.isArray(invocation.rejectionReasons)
      ? invocation.rejectionReasons.map((reason) => cleanVisibleText(reason, "", 80)).filter(Boolean).slice(0, 4)
      : [],
    recordedTurn: clampInt(worldState.turnCount, 0, 0, Number.MAX_SAFE_INTEGER)
  };
  settings.observability.recentInvocations = [
    ...(settings.observability.recentInvocations || []),
    item
  ].slice(-AI_INVOCATION_LOG_LIMIT);
  return item;
}

function buildAiInvocationSummaryView(worldState = {}, routePolicy = null, env = process.env) {
  const { settings, routePolicy: resolvedPolicy } = routePolicy
    ? { settings: ensureAiSettingsState(worldState), routePolicy }
    : resolveAiSettingsForSession(worldState, env);
  const recentInvocations = Array.isArray(settings.observability?.recentInvocations)
    ? settings.observability.recentInvocations.slice(-AI_INVOCATION_LOG_LIMIT)
    : [];

  return {
    schemaVersion: AI_SETTINGS_SCHEMA_VERSION,
    generatedAtTurn: worldState.turnCount || 0,
    routeCostSummary: buildRouteCostSummary(resolvedPolicy, env),
    toolCallSummary: {
      recentToolCalls: recentInvocations.reduce((sum, item) => sum + (item.toolCallCount || 0), 0),
      recentRejectedToolCalls: recentInvocations.reduce((sum, item) => sum + (item.rejectedToolCallCount || 0), 0),
      rejectionReasons: [...new Set(recentInvocations.flatMap((item) => item.rejectionReasons || []))].slice(0, 8)
    },
    recentInvocations: recentInvocations.map((item) => ({
      taskType: item.taskType,
      label: AI_TASK_LABELS[item.taskType] || item.taskType,
      provider: item.provider,
      model: redactModelName(item.model),
      status: item.status,
      durationMs: item.durationMs,
      maxOutputTokens: item.maxOutputTokens,
      toolCallCount: item.toolCallCount,
      rejectedToolCallCount: item.rejectedToolCallCount,
      recordedTurn: item.recordedTurn
    }))
  };
}

function updateAiSettings(worldState = {}, patch = {}, env = process.env) {
  const current = ensureAiSettingsState(worldState);
  worldState.aiSettings = mergeAiSettings(current, patch);
  const routePolicy = buildRoutePolicyFromSettings(worldState.aiSettings, env);
  return {
    settings: worldState.aiSettings,
    routePolicy,
    aiSettingsView: redactAiSettingsForClient({ ...worldState.aiSettings, routePolicy }, env),
    aiInvocationSummaryView: buildAiInvocationSummaryView(worldState, routePolicy, env)
  };
}

module.exports = {
  AI_SETTINGS_SCHEMA_VERSION,
  DEFAULT_GLOBAL_AI_SETTINGS_PATH,
  GLOBAL_AI_SETTINGS_SCHEMA_VERSION,
  buildAiInvocationSummaryView,
  buildDefaultAiSettings,
  buildGlobalAiSettingsPayload,
  ensureAiSettingsState,
  providerHasRequiredKeys,
  recordAiInvocation,
  redactAiSettingsForClient,
  readGlobalAiSettingsRecord,
  resolveAiSettingsForSession,
  updateGlobalAiSettings,
  updateAiSettings,
  validateAiSettingsPatch
};
