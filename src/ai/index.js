const mockProvider = require("./providers/mock");
const { createAnthropicProvider } = require("./providers/anthropic");
const { createDeepSeekProvider } = require("./providers/deepseek");
const { createMimoProvider } = require("./providers/mimo");
const { createMimoDeepSeekProvider } = require("./providers/mimoDeepseek");
const { createOpenAiProvider } = require("./providers/openai");
const {
  buildDefaultModelRoutePolicy,
  normalizeProviderName,
  resolveModelForTask
} = require("./modelRoutePolicy");

const PROVIDERS = {
  openai: createOpenAiProvider,
  deepseek: createDeepSeekProvider,
  mimo: createMimoProvider,
  "mimo-deepseek": createMimoDeepSeekProvider,
  anthropic: createAnthropicProvider,
  claude: createAnthropicProvider
};

const PROVIDER_ALIASES = {
  hybrid: "mimo-deepseek",
  "mimo_deepseek": "mimo-deepseek",
  "mimo+deepseek": "mimo-deepseek",
  xiaomi: "mimo"
};

function describeError(error) {
  return error && error.message ? error.message : String(error);
}

function wrapWithMockFallback(providerName, provider) {
  const wrapped = {
    supportsStreaming: Boolean(provider.supportsStreaming && typeof provider.streamTurn === "function")
  };

  for (const method of ["startGame", "runTurn", "streamTurn", "generateExamQuestion", "suggestQuickActions", "draftTopicSurface", "gradeExamEssay"]) {
    wrapped[method] = async (...args) => {
      if (method === "streamTurn") {
        if (!wrapped.supportsStreaming) {
          throw new Error(`AI provider ${providerName} does not support turn streaming.`);
        }
        return provider.streamTurn(...args);
      }

      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          if (typeof provider[method] !== "function") break;
          return await provider[method](...args);
        } catch (error) {
          lastError = error;
          console.warn(`AI provider ${providerName}.${method} attempt ${attempt} failed: ${describeError(error)}`);
        }
      }

      console.warn(`AI provider ${providerName}.${method} fell back to mock after: ${describeError(lastError)}`);
      return mockProvider[method](...args);
    };
  }

  return wrapped;
}

function createProviderByName(providerName, options = {}) {
  const normalizedName = normalizeProviderName(PROVIDER_ALIASES[providerName] || providerName);

  if (normalizedName === "mock") {
    return mockProvider;
  }

  const factory = PROVIDERS[normalizedName];
  if (!factory) {
    console.warn(`AI_PROVIDER=${normalizedName} is unknown; falling back to mock.`);
    return mockProvider;
  }

  try {
    return wrapWithMockFallback(normalizedName, factory(options));
  } catch (error) {
    console.warn(describeError(error));
    return mockProvider;
  }
}

function buildModelRouteView(route) {
  return {
    taskType: route.taskType,
    provider: route.provider,
    model: route.model,
    reviewerOnly: route.reviewerOnly,
    mayUseTools: route.mayUseTools,
    mayRequestAdjudication: route.mayRequestAdjudication,
    maxOutputTokens: route.maxOutputTokens,
    timeoutMs: route.timeoutMs,
    temperature: route.temperature
  };
}

function createReviewOnlyProvider(route) {
  const throwReviewOnly = async () => {
    throw new Error(`AI task ${route.taskType} is review-only and cannot run provider gameplay methods.`);
  };
  return {
    supportsStreaming: false,
    modelRoute: buildModelRouteView(route),
    startGame: throwReviewOnly,
    runTurn: throwReviewOnly,
    streamTurn: throwReviewOnly,
    generateExamQuestion: throwReviewOnly,
    suggestQuickActions: throwReviewOnly,
    draftTopicSurface: throwReviewOnly,
    gradeExamEssay: throwReviewOnly
  };
}

function getProviderForTask(taskType, options = {}) {
  const routePolicy = options.routePolicy || buildDefaultModelRoutePolicy(process.env, options);
  const route = resolveModelForTask(taskType, routePolicy);
  if (route.reviewerOnly && !options.allowReviewOnlyGameplayMethods) {
    return createReviewOnlyProvider(route);
  }
  const provider = createProviderByName(route.provider, { ...options, route });
  return {
    ...provider,
    modelRoute: buildModelRouteView(route)
  };
}

const METHOD_TASK_TYPES = Object.freeze({
  startGame: "narrator",
  runTurn: "narrator",
  streamTurn: "narrator",
  generateExamQuestion: "narrator",
  suggestQuickActions: "quick_action",
  draftTopicSurface: "topic_draft",
  gradeExamEssay: "domain_specialist"
});

function createRoutedProvider(options = {}) {
  const routePolicy = options.routePolicy || buildDefaultModelRoutePolicy(process.env, options);
  const narratorProvider = getProviderForTask("narrator", { ...options, routePolicy });
  const routed = {
    routePolicy,
    supportsStreaming: Boolean(
      narratorProvider.supportsStreaming && typeof narratorProvider.streamTurn === "function"
    )
  };

  for (const [method, taskType] of Object.entries(METHOD_TASK_TYPES)) {
    routed[method] = async (...args) => {
      const provider = getProviderForTask(taskType, { ...options, routePolicy });
      if (method === "streamTurn" && !(provider.supportsStreaming && typeof provider.streamTurn === "function")) {
        throw new Error(`AI task ${taskType} provider ${provider.modelRoute.provider} does not support turn streaming.`);
      }
      return provider[method](...args);
    };
  }

  return routed;
}

function getProvider(options = {}) {
  if (options.taskType) {
    return getProviderForTask(options.taskType, options);
  }
  return createRoutedProvider(options);
}

module.exports = {
  createProviderByName,
  createRoutedProvider,
  getProvider,
  getProviderForTask
};
