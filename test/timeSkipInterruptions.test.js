const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildTimeSkipPlan,
  buildTimeSkipSummary,
  runTimeSkipTicks
} = require("../src/game/timeSkip");

test("S70.11 runTimeSkipTicks stops at first interruption", async () => {
  const worldState = createInitialState({ playerName: "跳时中断" });
  const plan = buildTimeSkipPlan("学习一月", {}, { worldState });
  let calls = 0;

  const results = await runTimeSkipTicks(worldState, plan, {
    async runTick({ tick }) {
      calls += 1;
      return {
        worldTick: {
          cadence: tick.index === 2 ? "monthly" : "ten_day",
          completedMonth: tick.index === 2,
          summary: `第${tick.index}旬结算。`,
          events: [`第${tick.index}旬事件。`],
          timeAdvance: {
            to: {
              year: 1644,
              month: tick.index === 1 ? 1 : 2,
              tenDayPeriod: tick.index === 1 ? 2 : 1
            }
          }
        },
        interruption: tick.index === 2
          ? {
            type: "exam_window",
            label: "科期开场",
            reason: "童试已开场。",
            todo: "先决定是否应考。"
          }
          : null
      };
    }
  });

  assert.equal(calls, 2);
  assert.equal(results.executed, true);
  assert.equal(results.interrupted, true);
  assert.equal(results.completedTicks, 2);
  assert.equal(results.interruption.type, "exam_window");

  const summary = buildTimeSkipSummary(results);
  assert.equal(summary.interrupted, true);
  assert.equal(summary.ticks.length, 2);
  assert.match(summary.summary, /童试已开场/);
});

test("S70.11 runTimeSkipTicks returns blocked result for invalid plans", async () => {
  const worldState = createInitialState({ playerName: "跳时过长" });
  const plan = buildTimeSkipPlan("学习三个月", {}, { worldState });

  const results = await runTimeSkipTicks(worldState, plan, {
    async runTick() {
      throw new Error("should not run invalid plan");
    }
  });

  assert.equal(results.executed, false);
  assert.equal(results.blocked, true);
  assert.equal(results.completedTicks, 0);
  assert.match(results.validation.reasons.join(" "), /最多6旬/);
});
