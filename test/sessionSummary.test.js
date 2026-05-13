const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildSessionSummaryView,
  ensureSessionSummaryState,
  summarizeRecentPlayerHistory,
  updateMonthlySessionSummary
} = require("../src/game/sessionSummary");

function monthEndTick(year = 1644, month = 5) {
  return {
    completedMonth: true,
    timeAdvance: {
      from: { year, month, tenDayPeriod: 3 },
      to: { year, month: month + 1, tenDayPeriod: 1 }
    }
  };
}

test("S70.12 monthly session summary records one visible period summary", () => {
  const worldState = createInitialState({ role: "official", playerName: "经历摘要" });
  worldState.month = 6;
  worldState.tenDayPeriod = 1;
  const result = updateMonthlySessionSummary(worldState, {
    worldTick: monthEndTick(1644, 5),
    playerMonthlyBriefing: {
      generated: true,
      summary: "本月官务以清理旧案、核查钱粮为要。",
      reportId: "PMB-1644-05"
    },
    officialCareer: {
      summary: "考成暂稳。",
      events: ["署中旧案略清。"]
    },
    relationshipChanges: [{
      name: "赵给事",
      relationship: { delta: 2 },
      resentment: { delta: -1 }
    }]
  });

  assert.equal(result.updated, true);
  assert.equal(result.summary.periodKey, "1644-05");
  assert.match(result.summary.publicSummary, /清理旧案|钱粮/);
  assert.equal(worldState.sessionSummary.monthlySummaries.length, 1);

  const duplicate = updateMonthlySessionSummary(worldState, {
    worldTick: monthEndTick(1644, 5)
  });
  assert.equal(duplicate.updated, false);
  assert.equal(duplicate.reason, "period_already_recorded");
});

test("S70.12 session summary view and prompt summary are capped and hidden-safe", () => {
  const worldState = createInitialState({ role: "official", playerName: "摘要安全" });
  for (let month = 1; month <= 8; month += 1) {
    updateMonthlySessionSummary(worldState, {
      worldTick: monthEndTick(1644, month),
      playerMonthlyBriefing: {
        generated: true,
        summary: month === 4
          ? "SEALED_SUMMARY raw provider prompt event_log data/sessions/x sk-test-secret-123456 hidden notes 密档 私档 隐藏意图"
          : `第${month}月本职差事已归档。`,
        reportId: `PMB-1644-${String(month).padStart(2, "0")}`
      },
      relationshipChanges: []
    }, null, { allowDuplicate: true });
  }
  ensureSessionSummaryState(worldState);

  const view = buildSessionSummaryView(worldState);
  const recentPlayerHistory = summarizeRecentPlayerHistory(worldState, { limit: 4 });
  const serialized = JSON.stringify({ view, recentPlayerHistory });

  assert.equal(view.recentMonthlySummaries.length <= 6, true);
  assert.equal(recentPlayerHistory.recentMonthlySummaries.length, 4);
  assert.doesNotMatch(serialized, /SEALED_SUMMARY|raw provider|raw prompt|event_log|data\/sessions|sk-test-secret|hidden notes|密档|私档|隐藏意图/i);
  assert.match(serialized, /第8月本职差事/);
});
