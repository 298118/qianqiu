const assert = require("assert/strict");
const test = require("node:test");

const { createInitialState } = require("../src/game/initialState");
const { buildOpeningTask } = require("../src/ai/prompts");

test("opening prompt requires historical anchors in event strings", () => {
  const worldState = createInitialState({ playerName: "Prompt Tester" });
  const task = buildOpeningTask(worldState);

  assert.match(task.input, /Each event string must include/);
  assert.match(task.input, /imperial examination/);
});
