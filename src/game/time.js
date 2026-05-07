const TURNS_PER_MONTH = 3;

const TEN_DAY_PERIOD_LABELS = Object.freeze({
  1: "上旬",
  2: "中旬",
  3: "下旬"
});

const TEN_DAY_PERIOD_ALIASES = Object.freeze({
  early: 1,
  first: 1,
  shang: 1,
  "上旬": 1,
  "上": 1,
  middle: 2,
  mid: 2,
  second: 2,
  zhong: 2,
  "中旬": 2,
  "中": 2,
  late: 3,
  last: 3,
  third: 3,
  xia: 3,
  "下旬": 3,
  "下": 3
});

const MONTH_NAMES = Object.freeze([
  "",
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月"
]);

function toInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function clampInteger(value, min, max, fallback) {
  const integer = toInteger(value, fallback);
  return Math.max(min, Math.min(max, integer));
}

function normalizeYear(value, fallback = 1644) {
  return clampInteger(value, 1, 9999, fallback);
}

function normalizeMonth(value, fallback = 1) {
  return clampInteger(value, 1, 12, fallback);
}

function normalizeTenDayPeriod(value, fallback = 1) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (Object.prototype.hasOwnProperty.call(TEN_DAY_PERIOD_ALIASES, trimmed)) {
      return TEN_DAY_PERIOD_ALIASES[trimmed];
    }
    const lower = trimmed.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TEN_DAY_PERIOD_ALIASES, lower)) {
      return TEN_DAY_PERIOD_ALIASES[lower];
    }
  }

  return clampInteger(value, 1, TURNS_PER_MONTH, fallback);
}

function getMonthName(month) {
  const normalized = normalizeMonth(month);
  return MONTH_NAMES[normalized] || `${normalized}月`;
}

function getTenDayPeriodLabel(period) {
  return TEN_DAY_PERIOD_LABELS[normalizeTenDayPeriod(period)];
}

function normalizeCalendar(source = {}) {
  return {
    year: normalizeYear(source.year),
    month: normalizeMonth(source.month),
    tenDayPeriod: normalizeTenDayPeriod(source.tenDayPeriod)
  };
}

function ensureWorldCalendarState(worldState = {}) {
  if (!worldState || typeof worldState !== "object" || Array.isArray(worldState)) {
    return worldState;
  }

  const calendar = normalizeCalendar(worldState);
  worldState.year = calendar.year;
  worldState.month = calendar.month;
  worldState.tenDayPeriod = calendar.tenDayPeriod;
  return worldState;
}

function advanceMonth(source = {}) {
  const { year, month, tenDayPeriod } = normalizeCalendar(source);

  if (month >= 12) {
    return {
      year: normalizeYear(year + 1),
      month: 1,
      tenDayPeriod,
      rolledYear: true
    };
  }

  return {
    year,
    month: month + 1,
    tenDayPeriod,
    rolledYear: false
  };
}

function advanceTenDayPeriod(source = {}) {
  const { year, month, tenDayPeriod } = normalizeCalendar(source);

  if (tenDayPeriod < TURNS_PER_MONTH) {
    return {
      year,
      month,
      tenDayPeriod: tenDayPeriod + 1,
      rolledMonth: false,
      rolledYear: false,
      completedMonth: false
    };
  }

  const nextMonth = advanceMonth({ year, month, tenDayPeriod: 1 });
  return {
    year: nextMonth.year,
    month: nextMonth.month,
    tenDayPeriod: 1,
    rolledMonth: true,
    rolledYear: nextMonth.rolledYear,
    completedMonth: true
  };
}

function turnsToTenDayPeriods(turns) {
  return Math.max(0, toInteger(turns, 0));
}

function tenDayPeriodsToCompleteMonths(periods) {
  return Math.floor(turnsToTenDayPeriods(periods) / TURNS_PER_MONTH);
}

function monthsToTenDayPeriods(months) {
  return Math.max(0, toInteger(months, 0)) * TURNS_PER_MONTH;
}

function turnsToCompleteMonths(turns) {
  return tenDayPeriodsToCompleteMonths(turns);
}

function monthsToTurns(months) {
  return monthsToTenDayPeriods(months);
}

function formatYearMonthPeriod(source = {}) {
  const calendar = normalizeCalendar(source);
  const dynasty = source.dynasty ? `${source.dynasty}` : "";
  return `${dynasty}${calendar.year}年${getMonthName(calendar.month)}${getTenDayPeriodLabel(calendar.tenDayPeriod)}`;
}

module.exports = {
  MONTH_NAMES,
  TEN_DAY_PERIOD_LABELS,
  TURNS_PER_MONTH,
  advanceMonth,
  advanceTenDayPeriod,
  ensureWorldCalendarState,
  formatYearMonthPeriod,
  getMonthName,
  getTenDayPeriodLabel,
  monthsToTenDayPeriods,
  monthsToTurns,
  normalizeCalendar,
  normalizeMonth,
  normalizeTenDayPeriod,
  normalizeYear,
  tenDayPeriodsToCompleteMonths,
  turnsToCompleteMonths,
  turnsToTenDayPeriods
};
