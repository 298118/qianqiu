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

async function runStreamingTask(task, requestJsonStream, streamHandlers = {}) {
  const schema = getModelSchema(task.schemaName);
  let raw = "";

  const returnedRaw = await requestJsonStream({
    ...task,
    schema,
    onTextDelta(delta) {
      const text = String(delta || "");
      if (!text) return;
      raw += text;
      if (typeof streamHandlers.onTextDelta === "function") {
        streamHandlers.onTextDelta(text);
      }
    }
  });

  const parseSource = returnedRaw !== undefined && returnedRaw !== null && (
    typeof returnedRaw !== "string" || returnedRaw.trim()
  ) ? returnedRaw : raw;
  const payload = parseJsonFromText(parseSource);
  return validatePayload(task.schemaName, payload);
}

function createRemoteProvider(requestJson, requestJsonStream) {
  return {
    supportsStreaming: Boolean(requestJsonStream),

    startGame(worldState) {
      return runTask(buildOpeningTask(worldState), requestJson);
    },

    runTurn(worldState, input) {
      return runTask(buildTurnTask(worldState, input), requestJson);
    },

    async streamTurn(worldState, input, streamHandlers = {}) {
      if (!requestJsonStream) {
        return runTask(buildTurnTask(worldState, input), requestJson);
      }

      return runStreamingTask(buildTurnTask(worldState, input), requestJsonStream, streamHandlers);
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
