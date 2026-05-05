const mockProvider = require("./providers/mock");
const { createAnthropicProvider } = require("./providers/anthropic");
const { createDeepSeekProvider } = require("./providers/deepseek");
const { createOpenAiProvider } = require("./providers/openai");

const PROVIDERS = {
  openai: createOpenAiProvider,
  deepseek: createDeepSeekProvider,
  anthropic: createAnthropicProvider,
  claude: createAnthropicProvider
};

function describeError(error) {
  return error && error.message ? error.message : String(error);
}

function wrapWithMockFallback(providerName, provider) {
  const wrapped = {};

  for (const method of ["startGame", "runTurn", "generateExamQuestion", "gradeExamEssay"]) {
    wrapped[method] = async (...args) => {
      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
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
  const providerName = (process.env.AI_PROVIDER || "mock").toLowerCase();

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
