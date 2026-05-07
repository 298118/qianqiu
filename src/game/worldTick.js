const { NUMERIC_RANGES, clamp } = require("./stateRules");
const {
  MONTH_NAMES,
  TURNS_PER_MONTH,
  advanceTenDayPeriod,
  formatYearMonthPeriod,
  normalizeCalendar,
  normalizeMonth
} = require("./time");

const ATTRIBUTE_LABELS = {
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  corruption: "贪腐",
  armyMorale: "军心",
  borderThreat: "边患",
  "factions.eunuchs": "宦官",
  "factions.scholarOfficials": "士大夫",
  "factions.militaryLords": "武臣"
};

const HARVEST_MONTHS = new Set([8, 9, 10]);

function numericRange(key, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
  const range = NUMERIC_RANGES[key];
  return range || [fallbackMin, fallbackMax];
}

function clampForKey(key, value) {
  const [min, max] = numericRange(key);
  return clamp(Math.round(value), min, max);
}

function readNumber(source, key, fallback) {
  const value = Number(source?.[key]);
  const numeric = Number.isFinite(value) ? value : fallback;
  return clampForKey(key, numeric);
}

function readMonth(worldState) {
  return normalizeMonth(worldState?.month);
}

function advanceCalendar(worldState) {
  return advanceTenDayPeriod({
    year: readNumber(worldState, "year", 1644),
    month: readMonth(worldState),
    tenDayPeriod: worldState?.tenDayPeriod
  });
}

function shiftStat(key, current, delta) {
  return clampForKey(key, current + delta);
}

function isGoverningRole(role) {
  return role === "emperor" || role === "minister" || role === "official" || role === "magistrate";
}

function getFactionDelta(key, context) {
  if (key === "eunuchs") {
    if (context.corruption >= 70 || context.treasury >= 6000) return 1;
    if (context.corruption <= 40 && context.publicOrder >= 65) return -1;
  }

  if (key === "scholarOfficials") {
    if (context.publicOrder >= 75 || context.integrity >= 80) return 1;
    if (context.corruption >= 75 || context.taxRate >= 60) return -1;
  }

  if (key === "militaryLords") {
    if (context.borderThreat >= 60) return 1;
    if (context.borderThreat <= 25 && context.armyMorale >= 70) return -1;
  }

  return 0;
}

function buildFactionPatch(worldState, context) {
  const patch = {};
  const factions = worldState?.factions || {};

  for (const key of ["eunuchs", "scholarOfficials", "militaryLords"]) {
    if (typeof factions[key] !== "number") continue;
    const current = clamp(factions[key], 0, 100);
    const next = clamp(current + getFactionDelta(key, context), 0, 100);
    if (next !== current) {
      patch[key] = next;
    }
  }

  return patch;
}

function calculateResourcePatch(worldState, calendar) {
  const treasury = readNumber(worldState, "treasury", 1000);
  const grainReserve = readNumber(worldState, "grainReserve", 800);
  const population = readNumber(worldState, "population", 5000);
  const publicOrder = readNumber(worldState, "publicOrder", 70);
  const taxRate = readNumber(worldState, "taxRate", 30);
  const corruption = readNumber(worldState, "corruption", 60);
  const armySize = readNumber(worldState, "armySize", 200);
  const armyMorale = readNumber(worldState, "armyMorale", 65);
  const borderThreat = readNumber(worldState, "borderThreat", 40);
  const integrity = readNumber(worldState?.player, "integrity", 60);
  const role = worldState?.player?.role;

  const revenue = population * (taxRate / 100) * 0.06;
  const armyUpkeep = armySize * 0.3;
  const corruptionLeakage = treasury * (corruption / 100) * 0.01;
  const treasuryNext = clampForKey("treasury", treasury + revenue - armyUpkeep - corruptionLeakage);

  const grainConsumption = population * 0.004;
  const harvestGain = HARVEST_MONTHS.has(calendar.month) ? population * 0.014 : 0;
  const grainNext = clampForKey("grainReserve", grainReserve + harvestGain - grainConsumption);
  const grainRatio = population > 0 ? grainNext / population : 1;

  let orderDelta = 0;
  if (taxRate > 45) orderDelta -= Math.ceil((taxRate - 45) / 15);
  if (corruption > 65) orderDelta -= 1;
  if (borderThreat > 65) orderDelta -= 1;
  if (grainRatio < 0.08) orderDelta -= 2;
  else if (grainRatio > 0.2 && taxRate <= 35 && corruption <= 55) orderDelta += 1;
  const publicOrderNext = shiftStat("publicOrder", publicOrder, orderDelta);

  let corruptionDelta = 0;
  if (publicOrderNext < 45) corruptionDelta += 1;
  if (treasuryNext > 5000 && publicOrderNext < 70) corruptionDelta += 1;
  if (isGoverningRole(role) && integrity >= 75) corruptionDelta -= 1;
  const corruptionNext = shiftStat("corruption", corruption, corruptionDelta);

  let moraleDelta = 0;
  if (treasuryNext < Math.max(armyUpkeep * 3, 200)) moraleDelta -= 1;
  if (grainRatio < 0.08) moraleDelta -= 1;
  if (borderThreat > 75) moraleDelta -= 1;
  if (publicOrderNext > 75 && treasuryNext > armyUpkeep * 6) moraleDelta += 1;
  const armyMoraleNext = shiftStat("armyMorale", armyMorale, moraleDelta);

  let borderDelta = 0;
  if (armyMoraleNext < 45) borderDelta += 2;
  if (armySize < population * 0.025) borderDelta += 1;
  if (armyMoraleNext > 72 && armySize >= population * 0.035) borderDelta -= 1;
  if (publicOrderNext < 35) borderDelta += 1;
  const borderThreatNext = shiftStat("borderThreat", borderThreat, borderDelta);

  let populationDelta = Math.round(population * 0.0008);
  if (publicOrderNext >= 75 && grainRatio >= 0.14) populationDelta += Math.round(population * 0.0006);
  if (publicOrderNext < 40) populationDelta -= Math.round(population * 0.002);
  if (grainRatio < 0.06) populationDelta -= Math.round(population * 0.003);
  if (borderThreatNext > 75) populationDelta -= Math.round(population * 0.001);
  const populationNext = clampForKey("population", population + populationDelta);

  const context = {
    treasury: treasuryNext,
    publicOrder: publicOrderNext,
    taxRate,
    corruption: corruptionNext,
    armyMorale: armyMoraleNext,
    borderThreat: borderThreatNext,
    integrity
  };

  return {
    treasury: treasuryNext,
    grainReserve: grainNext,
    population: populationNext,
    publicOrder: publicOrderNext,
    corruption: corruptionNext,
    armyMorale: armyMoraleNext,
    borderThreat: borderThreatNext,
    factions: buildFactionPatch(worldState, context)
  };
}

function addChange(changes, path, before, after, reason) {
  if (typeof before !== "number" || typeof after !== "number" || before === after) return;
  changes.push({
    path,
    label: ATTRIBUTE_LABELS[path] || path,
    before,
    after,
    reason
  });
}

function buildAttributeChanges(worldState, statePatch, reason = "月度推演") {
  const changes = [];

  for (const key of ["treasury", "grainReserve", "population", "publicOrder", "corruption", "armyMorale", "borderThreat"]) {
    addChange(changes, key, readNumber(worldState, key, 0), statePatch[key], reason);
  }

  for (const [key, after] of Object.entries(statePatch.factions || {})) {
    addChange(changes, `factions.${key}`, worldState?.factions?.[key], after, reason);
  }

  return changes;
}

function trend(before, after, label) {
  if (after > before) return `${label}略升`;
  if (after < before) return `${label}略降`;
  return `${label}暂稳`;
}

function buildSummary(worldState, statePatch) {
  const pieces = [
    trend(readNumber(worldState, "grainReserve", 800), statePatch.grainReserve, "粮储"),
    trend(readNumber(worldState, "publicOrder", 70), statePatch.publicOrder, "民心"),
    trend(readNumber(worldState, "borderThreat", 40), statePatch.borderThreat, "边患")
  ];
  return `月度推演：${pieces.join("，")}。`;
}

function buildEvents(worldState, statePatch, calendar) {
  const events = [];
  const monthName = MONTH_NAMES[calendar.month] || `${calendar.month}月`;

  if (calendar.rolledYear) {
    events.push(`${worldState.dynasty || ""}${calendar.year}年岁序更易，朝野簿册重开，旧事并入前岁。`);
  }

  if (statePatch.grainReserve < Math.max(1, statePatch.population * 0.08)) {
    events.push(`${monthName}，仓廪偏紧，市价渐起，乡里催输益急。`);
  } else if (statePatch.publicOrder <= 35) {
    events.push(`${monthName}，里巷多有盗讼，州县催捕稍急。`);
  } else if (statePatch.borderThreat >= 70) {
    events.push(`${monthName}，边报数至，兵部催饷练卒。`);
  } else if (statePatch.corruption >= 75) {
    events.push(`${monthName}，吏胥需索渐重，公门外多有怨声。`);
  } else if (HARVEST_MONTHS.has(calendar.month)) {
    events.push(`${monthName}，秋收陆续入仓，粮储稍得补益。`);
  } else {
    events.push(`${monthName}，户部核算钱粮，民间风声暂稳。`);
  }

  return events.slice(0, calendar.rolledYear ? 2 : 1);
}

function readPatchBaseline(worldState, key) {
  return readNumber(worldState, key, 0);
}

function scaleTenDayValue(worldState, key, projectedValue) {
  const before = readPatchBaseline(worldState, key);
  const delta = projectedValue - before;
  const scaledDelta = Math.round(delta / TURNS_PER_MONTH);
  if (scaledDelta === 0) return before;
  return clampForKey(key, before + scaledDelta);
}

function calculateTenDayResourcePatch(worldState, calendar) {
  const projectedMonthlyPatch = calculateResourcePatch(worldState, calendar);
  const patch = {};

  for (const key of ["treasury", "grainReserve", "population", "publicOrder", "corruption", "armyMorale", "borderThreat"]) {
    const next = scaleTenDayValue(worldState, key, projectedMonthlyPatch[key]);
    if (next !== readPatchBaseline(worldState, key)) {
      patch[key] = next;
    }
  }

  return patch;
}

function buildTenDaySummary(worldState, statePatch, calendar) {
  const pieces = [
    Object.prototype.hasOwnProperty.call(statePatch, "grainReserve")
      ? trend(readNumber(worldState, "grainReserve", 800), statePatch.grainReserve, "粮储")
      : "粮储暂稳",
    Object.prototype.hasOwnProperty.call(statePatch, "publicOrder")
      ? trend(readNumber(worldState, "publicOrder", 70), statePatch.publicOrder, "民心")
      : "民心暂稳",
    Object.prototype.hasOwnProperty.call(statePatch, "borderThreat")
      ? trend(readNumber(worldState, "borderThreat", 40), statePatch.borderThreat, "边患")
      : "边患暂稳"
  ];
  return `旬度小结：${formatYearMonthPeriod({ ...worldState, ...calendar })}，${pieces.join("，")}。`;
}

function buildTenDayEvents(worldState, statePatch, calendar) {
  const dateLabel = formatYearMonthPeriod({ ...worldState, ...calendar });
  if (Object.prototype.hasOwnProperty.call(statePatch, "grainReserve") && statePatch.grainReserve < readNumber(worldState, "grainReserve", 800)) {
    return [`${dateLabel}，旬内仓粮照常支放，账上略有消耗。`];
  }
  if (Object.prototype.hasOwnProperty.call(statePatch, "treasury") && statePatch.treasury > readNumber(worldState, "treasury", 1000)) {
    return [`${dateLabel}，旬内钱粮入账，府库稍见周转。`];
  }
  return [`${dateLabel}，旬日流转，未至月末大结，地方风声暂稳。`];
}

function runWorldTick(worldState = {}) {
  const beforeCalendar = normalizeCalendar(worldState);
  const calendar = advanceCalendar(worldState);
  const statePatch = {
    year: calendar.year,
    month: calendar.month,
    tenDayPeriod: calendar.tenDayPeriod
  };

  if (!calendar.completedMonth) {
    Object.assign(statePatch, calculateTenDayResourcePatch(worldState, calendar));
    return {
      cadence: "ten_day",
      label: "旬度",
      completedMonth: false,
      timeAdvance: {
        from: beforeCalendar,
        to: {
          year: calendar.year,
          month: calendar.month,
          tenDayPeriod: calendar.tenDayPeriod
        }
      },
      statePatch,
      attributeChanges: buildAttributeChanges(worldState, statePatch, "旬度推演"),
      events: buildTenDayEvents(worldState, statePatch, calendar),
      summary: buildTenDaySummary(worldState, statePatch, calendar)
    };
  }

  const naturalPatch = calculateResourcePatch(worldState, calendar);
  Object.assign(statePatch, {
    treasury: naturalPatch.treasury,
    grainReserve: naturalPatch.grainReserve,
    population: naturalPatch.population,
    publicOrder: naturalPatch.publicOrder,
    corruption: naturalPatch.corruption,
    armyMorale: naturalPatch.armyMorale,
    borderThreat: naturalPatch.borderThreat
  });

  if (Object.keys(naturalPatch.factions).length) {
    statePatch.factions = naturalPatch.factions;
  }

  return {
    cadence: "monthly",
    label: "月度",
    completedMonth: true,
    timeAdvance: {
      from: beforeCalendar,
      to: {
        year: calendar.year,
        month: calendar.month,
        tenDayPeriod: calendar.tenDayPeriod
      },
      rolledMonth: calendar.rolledMonth,
      rolledYear: calendar.rolledYear
    },
    statePatch,
    attributeChanges: buildAttributeChanges(worldState, statePatch),
    events: buildEvents(worldState, statePatch, calendar),
    summary: buildSummary(worldState, statePatch)
  };
}

module.exports = {
  runWorldTick,
  advanceCalendar
};
