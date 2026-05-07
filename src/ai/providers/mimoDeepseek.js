const { createDeepSeekProvider } = require("./deepseek");
const { createMimoProvider } = require("./mimo");

function createMimoDeepSeekProvider(options = {}) {
  const mimoProvider = options.mimoProvider || createMimoProvider();
  const deepSeekProvider = options.deepSeekProvider || createDeepSeekProvider();

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

    gradeExamEssay(...args) {
      return deepSeekProvider.gradeExamEssay(...args);
    }
  };
}

module.exports = {
  createMimoDeepSeekProvider
};
