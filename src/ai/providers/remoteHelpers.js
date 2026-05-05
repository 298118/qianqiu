const { getModelSchema, validatePayload } = require("../schemas");
const {
  buildExamQuestionTask,
  buildGradeTask,
  buildOpeningTask,
  buildTurnTask
} = require("../prompts");
const { parseJsonFromText } = require("../../utils/json");

function readTimeoutMs() {
  const timeout = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 30000;
}

async function runTask(task, requestJson) {
  const schema = getModelSchema(task.schemaName);
  const raw = await requestJson({
    ...task,
    schema
  });
  const payload = parseJsonFromText(raw);
  return validatePayload(task.schemaName, payload);
}

function createRemoteProvider(requestJson) {
  return {
    startGame(worldState) {
      return runTask(buildOpeningTask(worldState), requestJson);
    },

    runTurn(worldState, input) {
      return runTask(buildTurnTask(worldState, input), requestJson);
    },

    generateExamQuestion(worldState, exam) {
      return runTask(buildExamQuestionTask(worldState, exam), requestJson);
    },

    gradeExamEssay(worldState, exam, essay, authenticityCheck) {
      return runTask(buildGradeTask(worldState, exam, essay, authenticityCheck), requestJson);
    }
  };
}

function requireEnv(name, providerName) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${providerName} provider requires ${name}; falling back to mock.`);
  }
  return value;
}

module.exports = {
  createRemoteProvider,
  readTimeoutMs,
  requireEnv
};
