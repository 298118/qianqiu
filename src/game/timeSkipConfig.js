const TIME_SKIP_SCHEMA_VERSION = 1;
const TIME_SKIP_MAX_TICKS = 6;
const TIME_SKIP_TICKS_PER_MONTH = 3;
const TIME_SKIP_HALF_MONTH_TICKS = 2;
const TIME_SKIP_DEFAULT_STRATEGY = "ten_day_batch";

const TIME_SKIP_INTERRUPT_EVENT_TYPES = Object.freeze([
  "active_exam",
  "exam_window",
  "disaster",
  "impeachment",
  "superior_summons",
  "urgent_letter",
  "war",
  "death_or_severe_illness",
  "urgent_assignment"
]);

const TIME_SKIP_PER_STEP_BUDGET = Object.freeze({
  plannerTaskType: "time_skip_planner",
  maxProviderCalls: 0,
  maxToolCalls: 0,
  maxTicksPerBatch: TIME_SKIP_MAX_TICKS
});

const TIME_SKIP_ACTIONS = Object.freeze({
  study: Object.freeze({
    label: "读书进学",
    tickInput: "闭门读书，按原计划温习经义与文章。",
    narrative: "按跳时计划闭门读书，逐旬记入读书簿。",
    playerPatch: Object.freeze({
      academia: 1,
      literaryTalent: 1,
      mentality: 0
    })
  }),
  convalesce: Object.freeze({
    label: "养病休整",
    tickInput: "闭门养病，调息作息，不另起大事。",
    narrative: "按跳时计划养病休整，逐旬恢复体力。",
    playerPatch: Object.freeze({
      health: 2,
      mentality: 1
    })
  }),
  official_routine: Object.freeze({
    label: "照旧办差",
    tickInput: "照旧处理本署文案，呈报上官，按例办理差事。",
    narrative: "按跳时计划照旧办差，逐旬结算官场与本署事务。",
    playerPatch: Object.freeze({
      performanceMerit: 1,
      peerNetwork: 0,
      superiorFavor: 0
    })
  }),
  routine: Object.freeze({
    label: "照旧度日",
    tickInput: "照旧安排行止，不另起大事。",
    narrative: "按跳时计划照旧度日，逐旬结算局势。",
    playerPatch: Object.freeze({
      mentality: 1
    })
  })
});

module.exports = {
  TIME_SKIP_ACTIONS,
  TIME_SKIP_DEFAULT_STRATEGY,
  TIME_SKIP_HALF_MONTH_TICKS,
  TIME_SKIP_INTERRUPT_EVENT_TYPES,
  TIME_SKIP_MAX_TICKS,
  TIME_SKIP_PER_STEP_BUDGET,
  TIME_SKIP_SCHEMA_VERSION,
  TIME_SKIP_TICKS_PER_MONTH
};
