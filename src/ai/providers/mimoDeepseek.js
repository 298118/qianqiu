const { createDeepSeekProvider } = require("./deepseek");
const { createMimoProvider } = require("./mimo");

function createMimoDeepSeekProvider(options = {}) {
  const routeOptions = options.route ? { route: options.route } : {};
  const mimoProvider = options.mimoProvider || createMimoProvider(routeOptions);
  const deepSeekProvider = options.deepSeekProvider || createDeepSeekProvider(routeOptions);

  return {
    supportsStreaming: Boolean(mimoProvider.supportsStreaming && typeof mimoProvider.streamTurn === "function"),

    startGame(...args) {
      return mimoProvider.startGame(...args);
    },

    runTurn(...args) {
      return mimoProvider.runTurn(...args);
    },

    streamTurn(...args) {
      return mimoProvider.streamTurn(...args);
    },

    generateExamQuestion(...args) {
      return mimoProvider.generateExamQuestion(...args);
    },

    suggestQuickActions(...args) {
      return mimoProvider.suggestQuickActions(...args);
    },

    draftTopicSurface(...args) {
      return mimoProvider.draftTopicSurface(...args);
    },

    gradeExamEssay(...args) {
      return deepSeekProvider.gradeExamEssay(...args);
    }
  };
}

module.exports = {
  createMimoDeepSeekProvider
};
