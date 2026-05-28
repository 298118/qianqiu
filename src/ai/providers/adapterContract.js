// @ts-check

const { validatePayload } = require("../schemas");
const { normalizeProviderName, normalizeTaskType } = require("../modelRoutePolicy");

/**
 * S92.2 的 ProviderAdapter 是 AiTaskRuntime 的旁路合约，不替换既有 provider facade。
 * 适配器只能返回已经结构化的 payload；raw prompt/request/response 仍留在 provider 内部。
 */

const RUNTIME_TASK_CONFIGS = Object.freeze({
  opening: Object.freeze({
    taskKind: "opening",
    taskType: "narrator",
    schemaName: "opening",
    promptPackId: "opening",
    facadeMethod: "startGame",
    contextKey: "worldState",
    mayUseTools: false
  }),
  quick_action: Object.freeze({
    taskKind: "quick_action",
    taskType: "quick_action",
    schemaName: "quickAction",
    promptPackId: "quick_action",
    facadeMethod: "suggestQuickActions",
    contextKey: "quickActionContext",
    mayUseTools: false
  }),
  topic_draft: Object.freeze({
    taskKind: "topic_draft",
    taskType: "topic_draft",
    schemaName: "topicDraft",
    promptPackId: "topic_draft",
    facadeMethod: "draftTopicSurface",
    contextKey: "topicDraftContext",
    mayUseTools: false
  })
});

const RUNTIME_TASK_KINDS = Object.freeze(Object.keys(RUNTIME_TASK_CONFIGS));

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTaskKind(value) {
  const taskKind = String(value || "").trim();
  if (!RUNTIME_TASK_KINDS.includes(taskKind)) {
    throw new Error(`Unknown AI runtime task kind: ${value}`);
  }
  return taskKind;
}

function getRuntimeTaskConfig(taskKind) {
  return RUNTIME_TASK_CONFIGS[normalizeTaskKind(taskKind)];
}

function createRuntimeTaskEnvelope(taskKind, context = {}, options = {}) {
  const config = getRuntimeTaskConfig(taskKind);
  const routeTaskType = normalizeTaskType(options.taskType || config.taskType);
  if (routeTaskType !== config.taskType) {
    throw new Error(`AI runtime task ${taskKind} must use route task type ${config.taskType}.`);
  }

  return {
    schemaVersion: "s92.2-ai-task-envelope.v1",
    taskId: options.taskId || `${config.taskKind}:${Date.now().toString(36)}`,
    taskKind: config.taskKind,
    taskType: routeTaskType,
    schemaName: config.schemaName,
    promptPackId: options.promptPackId || config.promptPackId,
    context: isPlainObject(context) ? context : {},
    metadata: isPlainObject(options.metadata) ? { ...options.metadata } : {}
  };
}

function getEnvelopeContextForFacade(envelope, config) {
  if (isPlainObject(envelope.context) && config.contextKey in envelope.context) {
    return envelope.context[config.contextKey];
  }
  return envelope.context;
}

function assertProviderAdapter(adapter, options = {}) {
  if (!isPlainObject(adapter)) {
    throw new Error("AI runtime provider adapter must be an object.");
  }
  if (typeof adapter.generateStructured !== "function") {
    throw new Error("AI runtime provider adapter requires generateStructured().");
  }
  const providerName = normalizeProviderName(adapter.providerName || adapter.name || "mock");
  if (!options.allowNonMock && providerName !== "mock") {
    throw new Error(`AI runtime skeleton only allows mock adapters, received ${providerName}.`);
  }
  return {
    providerName,
    model: String(adapter.model || providerName || "mock"),
    capabilities: isPlainObject(adapter.capabilities) ? { ...adapter.capabilities } : {}
  };
}

function createProviderFacadeAdapter(provider, options = {}) {
  if (!isPlainObject(provider)) {
    throw new Error("AI provider facade adapter requires a provider facade object.");
  }

  const providerName = normalizeProviderName(
    options.providerName || provider.modelRoute?.provider || provider.providerName || "mock"
  );
  const model = String(options.model || provider.modelRoute?.model || providerName);

  return {
    providerName,
    model,
    capabilities: {
      strictStructuredOutput: true,
      sourceFacade: true,
      supportsStreaming: Boolean(provider.supportsStreaming)
    },
    async generateStructured(envelope) {
      const config = getRuntimeTaskConfig(envelope.taskKind);
      const method = provider[config.facadeMethod];
      if (typeof method !== "function") {
        throw new Error(`Provider facade does not implement ${config.facadeMethod}.`);
      }
      const payload = await method(getEnvelopeContextForFacade(envelope, config));
      return {
        payload: validatePayload(config.schemaName, payload),
        provider: providerName,
        model,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimated: providerName === "mock"
        }
      };
    }
  };
}

module.exports = {
  RUNTIME_TASK_CONFIGS,
  RUNTIME_TASK_KINDS,
  assertProviderAdapter,
  createProviderFacadeAdapter,
  createRuntimeTaskEnvelope,
  getRuntimeTaskConfig,
  normalizeTaskKind
};
