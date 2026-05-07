const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TURNS_PER_MONTH,
  advanceTenDayPeriod,
  ensureWorldCalendarState,
  formatYearMonthPeriod,
  getTenDayPeriodLabel,
  monthsToTenDayPeriods,
  monthsToTurns,
  normalizeCalendar,
  normalizeTenDayPeriod,
  tenDayPeriodsToCompleteMonths,
  turnsToCompleteMonths,
  turnsToTenDayPeriods
} = require("../src/game/time");

test("time helper normalizes and labels ten-day periods", () => {
  assert.equal(TURNS_PER_MONTH, 3);
  assert.equal(normalizeTenDayPeriod(undefined), 1);
  assert.equal(normalizeTenDayPeriod("上旬"), 1);
  assert.equal(normalizeTenDayPeriod("middle"), 2);
  assert.equal(normalizeTenDayPeriod("下旬"), 3);
  assert.equal(normalizeTenDayPeriod(99), 3);
  assert.equal(getTenDayPeriodLabel(2), "中旬");
  assert.deepEqual(
    normalizeCalendar({ year: "1644", month: "8", tenDayPeriod: "下旬" }),
    { year: 1644, month: 8, tenDayPeriod: 3 }
  );
});

test("time helper advances ten-day periods and rolls month/year at month end", () => {
  assert.deepEqual(
    advanceTenDayPeriod({ year: 1644, month: 8, tenDayPeriod: 1 }),
    { year: 1644, month: 8, tenDayPeriod: 2, rolledMonth: false, rolledYear: false, completedMonth: false }
  );
  assert.deepEqual(
    advanceTenDayPeriod({ year: 1644, month: 8, tenDayPeriod: 3 }),
    { year: 1644, month: 9, tenDayPeriod: 1, rolledMonth: true, rolledYear: false, completedMonth: true }
  );
  assert.deepEqual(
    advanceTenDayPeriod({ year: 1644, month: 12, tenDayPeriod: 3 }),
    { year: 1645, month: 1, tenDayPeriod: 1, rolledMonth: true, rolledYear: true, completedMonth: true }
  );
});

test("time helper formats visible year-month-period labels and converts turns", () => {
  assert.equal(formatYearMonthPeriod({ dynasty: "明", year: 1644, month: 8, tenDayPeriod: 1 }), "明1644年八月上旬");
  assert.equal(formatYearMonthPeriod({ year: 1644, month: 11, tenDayPeriod: 2 }), "1644年冬月中旬");
  assert.equal(turnsToTenDayPeriods(5), 5);
  assert.equal(tenDayPeriodsToCompleteMonths(5), 1);
  assert.equal(turnsToCompleteMonths(6), 2);
  assert.equal(monthsToTenDayPeriods(2), 6);
  assert.equal(monthsToTurns(2), 6);
});

test("ensureWorldCalendarState defaults old saves to first ten-day period", () => {
  const oldSave = {
    year: 1644,
    month: 8
  };

  assert.equal(ensureWorldCalendarState(oldSave), oldSave);
  assert.deepEqual(oldSave, {
    year: 1644,
    month: 8,
    tenDayPeriod: 1
  });
});
