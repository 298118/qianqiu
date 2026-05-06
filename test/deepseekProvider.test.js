const assert = require("assert/strict");
const test = require("node:test");

const { readTaskModel } = require("../src/ai/providers/deepseek");

function withEnv(overrides, fn) {
  const keys = [
    "DEEPSEEK_MODEL",
    "DEEPSEEK_OPENING_MODEL",
    "DEEPSEEK_TURN_MODEL",
    "DEEPSEEK_EXAM_QUESTION_MODEL",
    "DEEPSEEK_GRADE_MODEL",
    ...Object.keys(overrides)
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(overrides)) {
      process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("DeepSeek task model selection uses task override before global default", () => {
  withEnv({
    DEEPSEEK_MODEL: "deepseek-v4-flash",
    DEEPSEEK_OPENING_MODEL: "deepseek-v4-pro",
    DEEPSEEK_GRADE_MODEL: "deepseek-v4-pro"
  }, () => {
    assert.equal(readTaskModel("opening"), "deepseek-v4-pro");
    assert.equal(readTaskModel("turn"), "deepseek-v4-flash");
    assert.equal(readTaskModel("examQuestion"), "deepseek-v4-flash");
    assert.equal(readTaskModel("grade"), "deepseek-v4-pro");
  });
});

test("DeepSeek task model selection falls back to V4 Flash", () => {
  withEnv({}, () => {
    assert.equal(readTaskModel("turn"), "deepseek-v4-flash");
    assert.equal(readTaskModel("grade"), "deepseek-v4-flash");
  });
});
