const mockProvider = require("./providers/mock");
const { createAnthropicProvider } = require("./providers/anthropic");
const { createDeepSeekProvider } = require("./providers/deepseek");
const { createMimoProvider } = require("./providers/mimo");
const { createMimoDeepSeekProvider } = require("./providers/mimoDeepseek");
const { createOpenAiProvider } = require("./providers/openai");

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

  for (const method of ["startGame", "runTurn", "streamTurn", "generateExamQuestion", "gradeExamEssay"]) {
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

function getProvider() {
  const rawProviderName = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const providerName = PROVIDER_ALIASES[rawProviderName] || rawProviderName;

  if (providerName === "mock") {
    return mockProvider;
  }

  const factory = PROVIDERS[providerName];
  if (!factory) {
    console.warn(`AI_PROVIDER=${providerName} is unknown; falling back to mock.`);
    return mockProvider;
  }

  try {
    return wrapWithMockFallback(providerName, factory());
  } catch (error) {
    console.warn(describeError(error));
    return mockProvider;
  }
}

module.exports = {
  getProvider
};
