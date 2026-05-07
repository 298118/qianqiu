const assert = require("assert/strict");
const test = require("node:test");

const { createMimoDeepSeekProvider } = require("../src/ai/providers/mimoDeepseek");

test("MiMo+DeepSeek provider routes ordinary work to MiMo and grading to DeepSeek", async () => {
  const calls = [];
  const mimoProvider = {
    supportsStreaming: true,
    startGame: async () => {
      calls.push("mimo.startGame");
      return { provider: "mimo" };
    },
    runTurn: async () => {
      calls.push("mimo.runTurn");
      return { provider: "mimo" };
    },
    streamTurn: async () => {
      calls.push("mimo.streamTurn");
      return { provider: "mimo" };
    },
    generateExamQuestion: async () => {
      calls.push("mimo.generateExamQuestion");
      return { provider: "mimo" };
    }
  };
  const deepSeekProvider = {
    gradeExamEssay: async () => {
      calls.push("deepseek.gradeExamEssay");
      return { provider: "deepseek" };
    }
  };
  const provider = createMimoDeepSeekProvider({ mimoProvider, deepSeekProvider });

  assert.equal(provider.supportsStreaming, true);
  assert.deepEqual(await provider.startGame(), { provider: "mimo" });
  assert.deepEqual(await provider.runTurn(), { provider: "mimo" });
  assert.deepEqual(await provider.streamTurn(), { provider: "mimo" });
  assert.deepEqual(await provider.generateExamQuestion(), { provider: "mimo" });
  assert.deepEqual(await provider.gradeExamEssay(), { provider: "deepseek" });
  assert.deepEqual(calls, [
    "mimo.startGame",
    "mimo.runTurn",
    "mimo.streamTurn",
    "mimo.generateExamQuestion",
    "deepseek.gradeExamEssay"
  ]);
});
