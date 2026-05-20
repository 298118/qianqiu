const {
  normalizeAssetLedger,
  writeAssetLedgerState
} = require("./assetLedger");
const {
  normalizeInventoryLedger,
  writeInventoryLedgerState
} = require("./inventoryLedger");
const {
  ensureNpcRoster
} = require("./npcRoster");
const {
  ensureDelegatedTaskLedger,
  updateDelegatedTaskStatus
} = require("./delegatedTasks");
const { LAND_SURVEY_TASK_TEMPLATE } = require("./delegatedTasksConfig");
const { ensureTradeLedger } = require("./tradeLedger");
const {
  MARKET_PRICE_CATALOG,
  MARKET_PRICE_SCHEMA_VERSION,
  NPC_ECONOMY_CONFIG,
  NPC_ECONOMY_SCHEMA_VERSION
} = require("./npcEconomyConfig");
const { formatYearMonthPeriod } = require("./time");

const SAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

const HARVEST_MONTHS = new Set([8, 9, 10]);
const WINTER_MONTHS = new Set([11, 12, 1, 2]);
const PRODUCTIVE_ASSET_TYPES = new Set(["farmland", "shop", "boat", "workshop"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || SAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function clampDecimal(value, min, max, fallback = min, precision = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const factor = 10 ** precision;
  return Math.max(min, Math.min(max, Math.round(parsed * factor) / factor));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function uniqueCleanList(values = [], limit = 8, maxLength = 96) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turn: currentTurn(worldState)
  };
}

function periodIndex(date = {}) {
  return clampNumber(date.year, 1, 9999, 1644) * 36 +
    (clampNumber(date.month, 1, 12, 1) - 1) * 3 +
    clampNumber(date.tenDayPeriod, 1, 3, 1);
}

function dueReached(task = {}, date = {}) {
  const due = isPlainObject(task.dueTime) ? task.dueTime : {};
  if (Number.isFinite(Number(due.turn))) {
    return clampNumber(due.turn, 0, Number.MAX_SAFE_INTEGER, 0) <= clampNumber(date.turn, 0, Number.MAX_SAFE_INTEGER, 0);
  }
  return periodIndex(due) <= periodIndex(date);
}

function emptyFeedback(cadence = "ten_day") {
  return {
    schemaVersion: NPC_ECONOMY_SCHEMA_VERSION,
    cadence,
    summary: "",
    events: [],
    attributeChanges: [],
    outcome: {
      priceRowsUpdated: 0,
      assetAdjustments: 0,
      inventoryUpdates: 0,
      delegatedTasksResolved: 0,
      tradeCommitmentsUpdated: 0,
      npcRelationshipUpdates: 0,
      humanDebtDelta: 0
    }
  };
}

function readWorldNumber(worldState, key, fallback) {
  return clampNumber(worldState?.[key], Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback);
}

function grainStress(worldState = {}) {
  const grainReserve = Math.max(0, readWorldNumber(worldState, "grainReserve", 800));
  const population = Math.max(1, readWorldNumber(worldState, "population", 5000));
  const ratio = grainReserve / population;
  if (ratio < 0.04) return 94;
  if (ratio < 0.07) return 78;
  if (ratio < 0.1) return 62;
  if (ratio > 0.22) return 24;
  return 42;
}

function marketContext(worldState = {}) {
  const date = currentDate(worldState);
  const publicOrder = clampMetric(worldState.publicOrder, 70);
  const corruption = clampMetric(worldState.corruption, 60);
  const taxRate = clampMetric(worldState.taxRate, 30);
  const borderThreat = clampMetric(worldState.borderThreat, 40);
  const treasury = Math.max(0, readWorldNumber(worldState, "treasury", 1000));
  const treasuryStress = treasury < 400 ? 78 : treasury < 1200 ? 58 : treasury > 6000 ? 28 : 42;
  return {
    date,
    role: cleanText(worldState.player?.role, "scholar", 40),
    publicOrder,
    corruption,
    taxRate,
    borderThreat,
    treasuryStress,
    grainStress: grainStress(worldState),
    harvestRelief: HARVEST_MONTHS.has(date.month) ? 12 : 0,
    winterStress: WINTER_MONTHS.has(date.month) ? 8 : 0
  };
}

function basePressure(context) {
  return clampMetric(
    32 +
    context.grainStress * 0.22 +
    context.corruption * 0.18 +
    context.borderThreat * 0.14 +
    context.taxRate * 0.12 +
    (100 - context.publicOrder) * 0.18 +
    context.treasuryStress * 0.12 -
    context.harvestRelief,
    50
  );
}

function categoryPressure(category, context) {
  const common = basePressure(context);
  if (category === "grain") {
    return clampMetric(context.grainStress * 0.62 + context.taxRate * 0.16 + (100 - context.publicOrder) * 0.16 - context.harvestRelief);
  }
  if (category === "medicine") {
    return clampMetric(common * 0.45 + context.winterStress * 2 + context.borderThreat * 0.2 + (100 - context.publicOrder) * 0.2);
  }
  if (category === "horse" || category === "weapon") {
    return clampMetric(common * 0.35 + context.borderThreat * 0.52 + context.corruption * 0.12);
  }
  if (category === "document" || category === "office_budget") {
    return clampMetric(common * 0.35 + context.corruption * 0.36 + context.taxRate * 0.18 + context.treasuryStress * 0.12);
  }
  if (category === "estate_maintenance") {
    return clampMetric(common * 0.42 + context.corruption * 0.22 + (100 - context.publicOrder) * 0.24);
  }
  if (category === "gift") {
    return clampMetric(common * 0.36 + context.corruption * 0.2 + context.taxRate * 0.12 + 18);
  }
  if (category === "book") {
    return clampMetric(common * 0.36 + context.taxRate * 0.1 + (context.date.month === 1 || context.date.month === 8 ? 16 : 0));
  }
  return common;
}

function priceAvailability(pressure, floor) {
  if (pressure >= 82) return "稀少";
  if (pressure >= 62) return "吃紧";
  if (pressure <= Math.max(30, floor)) return "充足";
  return "平稳";
}

function roleMultiplierFor(definition, role) {
  const specific = definition.roleMultipliers?.[role];
  if (Number.isFinite(Number(specific))) return Number(specific);
  return 1;
}

function trendFromPrevious(previous, currentSilverLiang) {
  if (!previous || !Number.isFinite(Number(previous.currentSilverLiang))) return "new";
  const before = Number(previous.currentSilverLiang);
  if (currentSilverLiang >= before + 0.2) return "up";
  if (currentSilverLiang <= before - 0.2) return "down";
  return "stable";
}

function trendLabel(trend) {
  if (trend === "up") return "上扬";
  if (trend === "down") return "回落";
  if (trend === "new") return "新报";
  return "持平";
}

function calculatePriceRows(worldState = {}, previousRows = []) {
  const context = marketContext(worldState);
  const previousById = new Map((Array.isArray(previousRows) ? previousRows : []).map((row) => [row.priceId, row]));
  const [minMultiplier, maxMultiplier] = NPC_ECONOMY_CONFIG.priceMultiplierRange;

  return Object.entries(MARKET_PRICE_CATALOG).map(([priceId, definition]) => {
    const pressure = categoryPressure(definition.category, context);
    const pressureDelta = (pressure - 50) / 100;
    const multiplier = clampDecimal(
      1 + pressureDelta * definition.sensitivity * 2,
      minMultiplier,
      maxMultiplier,
      1
    );
    const roleMultiplier = roleMultiplierFor(definition, context.role);
    const currentSilverLiang = clampDecimal(definition.baseSilverLiang * multiplier * roleMultiplier, 0.1, 100000, definition.baseSilverLiang);
    const currentCopperCash = clampNumber(
      currentSilverLiang * NPC_ECONOMY_CONFIG.silverToCopperCash,
      1,
      Number.MAX_SAFE_INTEGER,
      1
    );
    const trend = trendFromPrevious(previousById.get(priceId), currentSilverLiang);

    return {
      priceId,
      label: definition.label,
      category: definition.category,
      baseSilverLiang: definition.baseSilverLiang,
      currentSilverLiang,
      currentCopperCash,
      role: context.role,
      roleMultiplier,
      marketPressure: pressure,
      availability: priceAvailability(pressure, definition.availabilityFloor),
      trend,
      trendLabel: trendLabel(trend),
      drivers: [...definition.drivers],
      authorityBoundary: "基础市价只供服务器裁决交易、维护和叙事；前端与 AI 不得自行成交或改账。"
    };
  });
}

function averagePriceIndex(rows = []) {
  if (!rows.length) return 100;
  const total = rows.reduce((sum, row) => {
    const base = Math.max(0.1, Number(row.baseSilverLiang) || 0.1);
    return sum + Number(row.currentSilverLiang || base) / base * 100;
  }, 0);
  return clampNumber(total / rows.length, 1, 9999, 100);
}

function priceSignals(rows = [], context = marketContext({})) {
  const sorted = [...rows].sort((first, second) => second.marketPressure - first.marketPressure);
  const signals = [];
  const highest = sorted[0];
  if (highest) {
    signals.push(`${highest.label}${highest.availability}，${highest.trendLabel}至${highest.currentSilverLiang}两。`);
  }
  const grain = rows.find((row) => row.priceId === "grain_shi");
  if (grain && grain.marketPressure >= 60) {
    signals.push(`粮价受仓储与税粮牵动，当前一石约${grain.currentSilverLiang}两。`);
  } else if (HARVEST_MONTHS.has(context.date.month) && grain) {
    signals.push(`秋收入仓，粮价暂报${grain.currentSilverLiang}两一石。`);
  }
  const office = rows.find((row) => row.priceId === "office_budget_unit");
  if (office && ["magistrate", "official", "minister", "emperor"].includes(context.role)) {
    signals.push(`官署经费一档约${office.currentSilverLiang}两，仍由服务器按权限支应。`);
  }
  return uniqueCleanList(signals, NPC_ECONOMY_CONFIG.maxSignalsInView, 140);
}

function createInitialMarketPriceLedger(worldState = {}) {
  const date = currentDate(worldState);
  const rows = calculatePriceRows(worldState, []);
  const context = marketContext(worldState);
  return {
    schemaVersion: MARKET_PRICE_SCHEMA_VERSION,
    generatedAtTurn: date.turn,
    date,
    role: context.role,
    averagePriceIndex: averagePriceIndex(rows),
    priceRows: rows,
    recentSignals: priceSignals(rows, context),
    history: []
  };
}

function ensureMarketPriceLedgerState(worldState = {}) {
  if (
    !isPlainObject(worldState.marketPriceLedger) ||
    worldState.marketPriceLedger.schemaVersion !== MARKET_PRICE_SCHEMA_VERSION
  ) {
    worldState.marketPriceLedger = createInitialMarketPriceLedger(worldState);
  }
  return worldState.marketPriceLedger;
}

function refreshMarketPrices(worldState = {}, options = {}) {
  const previous = ensureMarketPriceLedgerState(worldState);
  const date = currentDate(worldState);
  const rows = calculatePriceRows(worldState, previous.priceRows);
  const context = marketContext(worldState);
  const averageIndex = averagePriceIndex(rows);
  const history = Array.isArray(previous.history) ? [...previous.history] : [];

  if (options.recordHistory) {
    history.push({
      turn: date.turn,
      year: date.year,
      month: date.month,
      tenDayPeriod: date.tenDayPeriod,
      cadence: cleanText(options.cadence, "ten_day", 24),
      averagePriceIndex: averageIndex,
      notablePriceIds: rows
        .filter((row) => row.trend === "up" || row.marketPressure >= 70)
        .map((row) => row.priceId)
        .slice(0, 4)
    });
  }

  worldState.marketPriceLedger = {
    schemaVersion: MARKET_PRICE_SCHEMA_VERSION,
    generatedAtTurn: date.turn,
    date,
    role: context.role,
    averagePriceIndex: averageIndex,
    priceRows: rows,
    recentSignals: priceSignals(rows, context),
    history: history.slice(-NPC_ECONOMY_CONFIG.maxPriceHistory)
  };

  return worldState.marketPriceLedger;
}

function createInitialNpcEconomyLedger(worldState = {}) {
  return {
    schemaVersion: NPC_ECONOMY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    lastTickTurn: null,
    lastMonthlyPeriodKey: "",
    recentEvents: [],
    lastOutcome: null
  };
}

function ensureNpcEconomyLedgerState(worldState = {}) {
  if (
    !isPlainObject(worldState.npcEconomyLedger) ||
    worldState.npcEconomyLedger.schemaVersion !== NPC_ECONOMY_SCHEMA_VERSION
  ) {
    worldState.npcEconomyLedger = createInitialNpcEconomyLedger(worldState);
  }
  return worldState.npcEconomyLedger;
}

function marketPriceById(worldState = {}) {
  const ledger = ensureMarketPriceLedgerState(worldState);
  return new Map((ledger.priceRows || []).map((row) => [row.priceId, row]));
}

function addAttributeChange(result, path, label, before, after, reason) {
  if (before === after || result.attributeChanges.length >= NPC_ECONOMY_CONFIG.maxAttributeChangesPerTick) return;
  result.attributeChanges.push({
    path: publicAttributePath(path),
    label,
    before,
    after,
    reason
  });
}

function publicAttributePath(path = "") {
  if (typeof path !== "string") return "economy.summary";
  if (path.startsWith("assetLedger.")) return "economy.assets";
  if (path.startsWith("resourceLedger.")) return "economy.resources";
  if (path.startsWith("inventoryLedger.")) return "economy.inventory";
  if (/^player\.(localTreasury|localOrder|gentryRelations)$/.test(path)) return path;
  return "economy.summary";
}

function adjustResource(ledger, ownerActorId, resourceId, delta, turn) {
  const next = ledger;
  let account = next.resourceAccounts.find((row) =>
    row.ownerActorId === ownerActorId && row.resourceId === resourceId
  );
  if (!account) return { ledger: next, before: 0, after: 0, delta: 0 };
  const before = clampNumber(account.amount, -100000000, 100000000, 0);
  const after = resourceId === "human_debt"
    ? clampNumber(before + delta, -1000, 1000, before)
    : clampNumber(before + delta, 0, 100000000, before);
  account.amount = after;
  account.updatedTurn = turn;
  return {
    ledger: next,
    before,
    after,
    delta: after - before
  };
}

function productiveIncome(asset = {}) {
  const productivity = clampNumber(asset.productivity, 0, 100, 50);
  if (asset.assetType === "farmland") {
    return { resourceId: "grain_shi", amount: Math.max(1, Math.round(productivity / 35)) };
  }
  if (asset.assetType === "shop" || asset.assetType === "workshop" || asset.assetType === "boat") {
    return { resourceId: "silver_liang", amount: Math.max(1, Math.round(productivity / 45)) };
  }
  if (asset.assetType === "study" && productivity >= 50) {
    return { resourceId: "academic_prestige", amount: 1 };
  }
  return null;
}

function settleAssetAndResourceLifecycle(worldState, result) {
  let ledger = normalizeAssetLedger(worldState, { ownerActorId: worldState.player?.id || "player" });
  const ownerActorId = ledger.ownerActorId;
  const priceMap = marketPriceById(worldState);
  const maintenancePrice = priceMap.get("estate_maintenance");
  const maintenanceRate = maintenancePrice
    ? Math.max(0.1, maintenancePrice.currentSilverLiang / Math.max(0.1, maintenancePrice.baseSilverLiang))
    : 1;
  const silver = ledger.resourceAccounts.find((row) => row.ownerActorId === ownerActorId && row.resourceId === "silver_liang");
  let availableSilver = clampNumber(silver?.amount, 0, 100000000, 0);
  let upkeepDue = 0;
  let upkeepPaid = 0;
  let assetAdjustments = 0;

  for (const asset of ledger.assets) {
    if (asset.ownerActorId !== ownerActorId) continue;
    const due = clampNumber((asset.upkeepSilver || 0) * maintenanceRate, 0, 100000, 0);
    upkeepDue += due;
    if (due > 0) {
      const paid = Math.min(availableSilver, due);
      availableSilver -= paid;
      upkeepPaid += paid;
      if (paid < due) {
        const before = asset.productivity;
        asset.productivity = clampNumber(asset.productivity - NPC_ECONOMY_CONFIG.assetProductivityUpkeepPenalty, 0, 100, asset.productivity);
        asset.condition = "失修待补";
        assetAdjustments += 1;
        addAttributeChange(result, `assetLedger.${asset.assetId}.productivity`, asset.name, before, asset.productivity, "S85 月度维护不足");
      } else if (PRODUCTIVE_ASSET_TYPES.has(asset.assetType) || asset.assetType === "study") {
        const before = asset.productivity;
        asset.productivity = clampNumber(asset.productivity + NPC_ECONOMY_CONFIG.assetProductivityMaintainedBonus, 0, 100, asset.productivity);
        asset.condition = asset.condition === "失修待补" ? "修缮稍复" : asset.condition;
        if (asset.productivity !== before) {
          assetAdjustments += 1;
          addAttributeChange(result, `assetLedger.${asset.assetId}.productivity`, asset.name, before, asset.productivity, "S85 月度维护");
        }
      }
    }

    const income = productiveIncome(asset);
    if (income) {
      const adjusted = adjustResource(ledger, ownerActorId, income.resourceId, income.amount, currentTurn(worldState));
      ledger = adjusted.ledger;
      if (adjusted.delta !== 0) {
        assetAdjustments += 1;
        addAttributeChange(result, `resourceLedger.${income.resourceId}`, income.resourceId, adjusted.before, adjusted.after, "S85 资产月收益");
      }
    }
  }

  if (upkeepPaid > 0) {
    const adjusted = adjustResource(ledger, ownerActorId, "silver_liang", -upkeepPaid, currentTurn(worldState));
    ledger = adjusted.ledger;
    addAttributeChange(result, "resourceLedger.silver_liang", "白银", adjusted.before, adjusted.after, "S85 资产月维护");
  }

  const humanDebt = ledger.resourceAccounts.find((row) => row.ownerActorId === ownerActorId && row.resourceId === "human_debt");
  let humanDebtDelta = 0;
  if (humanDebt) {
    const before = humanDebt.amount;
    const stress = clampMetric(worldState.publicOrder, 70) < 45 || availableSilver <= 0;
    if (before > 0 && stress) humanDebtDelta = NPC_ECONOMY_CONFIG.humanDebtStressIncrease;
    else if (before > 0) humanDebtDelta = -NPC_ECONOMY_CONFIG.humanDebtMonthlyEase;
    else if (before < 0) humanDebtDelta = NPC_ECONOMY_CONFIG.humanDebtMonthlyEase;
    if (humanDebtDelta !== 0) {
      const adjusted = adjustResource(ledger, ownerActorId, "human_debt", humanDebtDelta, currentTurn(worldState));
      ledger = adjusted.ledger;
      result.outcome.humanDebtDelta = adjusted.delta;
      addAttributeChange(result, "resourceLedger.human_debt", "人情债", adjusted.before, adjusted.after, "S85 月度人情债");
    }
  }

  writeAssetLedgerState(worldState, ledger, { ownerActorId });
  result.outcome.assetAdjustments += assetAdjustments;
  if (upkeepDue > 0) {
    result.events.push(upkeepPaid >= upkeepDue
      ? `资产月账：本月修缮支出${upkeepPaid}两，家业暂得维持。`
      : `资产月账：应修${upkeepDue}两，仅支${upkeepPaid}两，部分产业失修。`);
  }
}

function inventoryDurabilityLoss(item = {}, worldState = {}) {
  if (item.category === "medical") return WINTER_MONTHS.has(currentDate(worldState).month) ? 3 : 2;
  if (item.category === "tool") return 1;
  if (item.category === "book" && clampMetric(worldState.publicOrder, 70) < 35) return 1;
  return 0;
}

function settleInventoryLifecycle(worldState, result) {
  const ownerActorId = worldState.player?.id || "player";
  const ledger = normalizeInventoryLedger(worldState, { ownerActorId });
  let updates = 0;
  for (const item of ledger.items) {
    if (updates >= NPC_ECONOMY_CONFIG.maxInventoryUpdatesPerTick) break;
    const loss = inventoryDurabilityLoss(item, worldState);
    if (loss <= 0 || item.durability <= 0) continue;
    const before = item.durability;
    item.durability = clampNumber(item.durability - loss, 0, 100, before);
    if (item.durability < 35) item.condition = "损耗待换";
    else if (item.category === "medical") item.condition = "药性渐衰";
    else if (item.category === "tool") item.condition = "需整理";
    item.provenance = [
      ...(Array.isArray(item.provenance) ? item.provenance : []),
      { ref: "s85:economy:inventory-aging", label: "月度盘点损耗", turn: currentTurn(worldState) }
    ].slice(-4);
    updates += 1;
    addAttributeChange(result, `inventoryLedger.${item.itemId}.durability`, item.name, before, item.durability, "S85 月度库存损耗");
  }
  if (updates > 0) {
    writeInventoryLedgerState(worldState, ledger, { ownerActorId });
    result.outcome.inventoryUpdates += updates;
    result.events.push(`库存月账：${updates}件物品完成保养与损耗登记。`);
  }
}

function getEffectiveTaskBudget(worldState = {}, task = {}) {
  const requestedBudget = clampNumber(task.budget, 0, 100000, 0);
  const availableTreasury = clampNumber(worldState.player?.localTreasury, 0, 100000, 0);
  return Math.min(requestedBudget, availableTreasury);
}

function taskResolutionScore(worldState = {}, task = {}, npc = {}) {
  const budget = getEffectiveTaskBudget(worldState, task);
  const trust = clampNumber(npc.relationship?.trust, 0, 100, 40);
  const closeness = clampNumber(npc.relationship?.closeness, -100, 100, 0);
  const corruption = clampMetric(worldState.corruption, 60);
  const integrity = clampMetric(worldState.player?.integrity, 60);
  const privateRisk = Array.isArray(npc.privateSignalTags) && npc.privateSignalTags.includes("可能欺瞒") ? 6 : 0;
  const budgetBonus = task.taskType === "land_survey"
    ? Math.min(22, Math.max(0, budget - LAND_SURVEY_TASK_TEMPLATE.minBudget))
    : Math.min(16, budget);
  return clampNumber(42 + budgetBonus + trust / 5 + closeness / 12 + integrity / 8 - corruption / 5 - privateRisk, 0, 100, 50);
}

function adjustPlayerMetric(worldState, key, delta, min = 0, max = 100) {
  if (!worldState.player) return { before: null, after: null };
  const before = clampNumber(worldState.player[key], min, max, 0);
  const after = clampNumber(before + delta, min, max, before);
  worldState.player[key] = after;
  return { before, after };
}

function adjustNpcRelationshipAfterTask(npc = {}, success) {
  if (!isPlainObject(npc.relationship)) return false;
  const before = cloneJson(npc.relationship);
  npc.relationship.trust = clampNumber(npc.relationship.trust + (success ? 3 : -3), 0, 100, npc.relationship.trust);
  npc.relationship.closeness = clampNumber(npc.relationship.closeness + (success ? 1 : -1), -100, 100, npc.relationship.closeness);
  npc.relationship.hostility = clampNumber(npc.relationship.hostility + (success ? -1 : 2), 0, 100, npc.relationship.hostility);
  npc.relationship.favorsOwed = clampNumber(npc.relationship.favorsOwed + (success ? 1 : 0), -20, 20, npc.relationship.favorsOwed);
  return JSON.stringify(before) !== JSON.stringify(npc.relationship);
}

function settleDelegatedTasks(worldState, result) {
  const ledger = ensureDelegatedTaskLedger(worldState);
  const roster = ensureNpcRoster(worldState);
  const date = currentDate(worldState);
  let resolved = 0;

  for (const task of ledger.tasks) {
    if (resolved >= NPC_ECONOMY_CONFIG.maxDelegatedTaskResolutionsPerTick) break;
    if (!["active", "overdue"].includes(task.status)) continue;
    if (!dueReached(task, date)) continue;

    const npc = roster.npcs.find((row) => row.npcId === task.assigneeActorId) || {};
    const score = taskResolutionScore(worldState, task, npc);
    const success = score >= 52;
    const status = success ? "completed" : "failed";
    const assigneeName = cleanText(npc.displayName, "执行人", 60);
    const summary = task.taskType === "land_survey"
      ? success
        ? `${assigneeName}回报：田亩初清，册实差异已列为复核线索。`
        : `${assigneeName}回报迟滞：乡绅阻力与胥吏索费使清丈未成。`
      : success
        ? `${assigneeName}已回报差事，结果进入后续案卷。`
        : `${assigneeName}未能按期办成差事，需玩家复核。`;

    updateDelegatedTaskStatus(worldState, task.taskId, status, {
      result: {
        summary,
        outcome: status,
        followUpActionRefs: success ? ["followup:review-report", "followup:reward-or-audit"] : ["followup:reassign-task", "followup:investigate-obstruction"]
      },
      auditRefs: [`s85:economy:delegated-task:${task.taskId}`]
    });

    const effectiveBudget = getEffectiveTaskBudget(worldState, task);
    if (effectiveBudget > 0 && Number.isFinite(Number(worldState.player?.localTreasury))) {
      const before = clampNumber(worldState.player.localTreasury, 0, 100000, 0);
      const after = clampNumber(before - effectiveBudget, 0, 100000, before);
      worldState.player.localTreasury = after;
      addAttributeChange(result, "player.localTreasury", "地方库银", before, after, "S85 委派经费结算");
    }
    const order = adjustPlayerMetric(worldState, "localOrder", success ? 1 : -1);
    if (order.before !== null && order.before !== order.after) {
      addAttributeChange(result, "player.localOrder", "地方秩序", order.before, order.after, "S85 委派结果");
    }
    const gentry = adjustPlayerMetric(worldState, "gentryRelations", success && task.taskType === "land_survey" ? -1 : success ? 0 : -2);
    if (gentry.before !== null && gentry.before !== gentry.after) {
      addAttributeChange(result, "player.gentryRelations", "士绅关系", gentry.before, gentry.after, "S85 委派结果");
    }
    if (adjustNpcRelationshipAfterTask(npc, success)) {
      result.outcome.npcRelationshipUpdates += 1;
    }

    result.events.push(`委派月结：${summary}`);
    resolved += 1;
  }

  result.outcome.delegatedTasksResolved += resolved;
}

function settleTradeCommitments(worldState, result) {
  const ledger = ensureTradeLedger(worldState);
  let updated = 0;
  for (const record of ledger.records || []) {
    if (updated >= NPC_ECONOMY_CONFIG.maxTradeUpdatesPerTick) break;
    if (!["proposed", "countered"].includes(record.status) || record.settlementApplied) continue;
    const age = currentTurn(worldState) - clampNumber(record.turn, 0, Number.MAX_SAFE_INTEGER, 0);
    if (age < NPC_ECONOMY_CONFIG.maxOpenTradeAgeTurns) continue;
    record.status = "rejected";
    record.publicSummary = "议价逾期未结，已转为作废记录；银钱与物品未发生流转。";
    record.serverReasons = uniqueCleanList([...(record.serverReasons || []), "trade_commitment_expired"], 8, 80);
    record.serverSettlement = {
      ...(record.serverSettlement || {}),
      resourceDeltaApplied: false,
      itemTransferApplied: false,
      boundary: "逾期议价只作公开记录，成交仍需玩家重新提交并由服务器裁决。"
    };
    record.maturedAtTurn = currentTurn(worldState);
    updated += 1;
  }
  if (updated > 0) {
    result.outcome.tradeCommitmentsUpdated += updated;
    result.events.push(`交易月账：${updated}条未结议价已转为逾期作废。`);
  }
}

function settleNpcRelationshipMemory(worldState, result) {
  const roster = ensureNpcRoster(worldState);
  let updates = 0;
  for (const npc of roster.npcs || []) {
    if (updates >= NPC_ECONOMY_CONFIG.maxNpcRelationshipUpdatesPerTick) break;
    if (!isPlainObject(npc.relationship)) continue;
    const before = cloneJson(npc.relationship);
    if (npc.relationship.favorsOwed > 0) {
      npc.relationship.favorsOwed = clampNumber(npc.relationship.favorsOwed - 1, -20, 20, npc.relationship.favorsOwed);
      npc.relationship.trust = clampNumber(npc.relationship.trust + 1, 0, 100, npc.relationship.trust);
    } else if (npc.relationship.favorsOwed < 0) {
      npc.relationship.favorsOwed = clampNumber(npc.relationship.favorsOwed + 1, -20, 20, npc.relationship.favorsOwed);
    } else if (npc.tier === "active" && npc.relationship.hostility > 0 && clampMetric(worldState.publicOrder, 70) >= 60) {
      npc.relationship.hostility = clampNumber(npc.relationship.hostility - 1, 0, 100, npc.relationship.hostility);
    }
    if (JSON.stringify(before) !== JSON.stringify(npc.relationship)) {
      updates += 1;
    }
  }
  if (updates > 0) {
    result.outcome.npcRelationshipUpdates += updates;
    result.events.push(`人情月账：${updates}名 NPC 的信任、人情或怨意完成月度整理。`);
  }
}

function finalizeEconomyLedger(worldState, result) {
  const ledger = ensureNpcEconomyLedgerState(worldState);
  const date = currentDate(worldState);
  const safeEvents = uniqueCleanList(result.events, NPC_ECONOMY_CONFIG.maxEventsPerTick, 160);
  ledger.generatedAtTurn = date.turn;
  ledger.lastTickTurn = date.turn;
  if (result.cadence === "monthly") {
    ledger.lastMonthlyPeriodKey = `${date.year}-${String(date.month).padStart(2, "0")}`;
  }
  ledger.recentEvents = uniqueCleanList([
    ...(ledger.recentEvents || []),
    ...safeEvents
  ], NPC_ECONOMY_CONFIG.maxRecentEvents, 160);
  ledger.lastOutcome = cloneJson(result.outcome);
  worldState.npcEconomyLedger = ledger;
}

function buildSummary(worldState, result) {
  const dateLabel = formatYearMonthPeriod(worldState);
  const priceIndex = ensureMarketPriceLedgerState(worldState).averagePriceIndex;
  if (result.cadence === "monthly") {
    return `NPC 经济月结：${dateLabel}，市价指数${priceIndex}，委派${result.outcome.delegatedTasksResolved}件，交易逾期${result.outcome.tradeCommitmentsUpdated}条。`;
  }
  return `NPC 经济旬更：${dateLabel}，基础市价已刷新，交易、委派与资产仍由服务器月末结算。`;
}

function runNpcEconomyTickStep(worldState = {}, options = {}) {
  if (!isPlainObject(worldState)) return emptyFeedback();
  const cadence = options.worldTick?.completedMonth ? "monthly" : "ten_day";
  const result = emptyFeedback(cadence);
  const priceLedger = refreshMarketPrices(worldState, { recordHistory: true, cadence });
  result.outcome.priceRowsUpdated = priceLedger.priceRows.length;

  if (cadence === "monthly") {
    settleAssetAndResourceLifecycle(worldState, result);
    settleInventoryLifecycle(worldState, result);
    settleDelegatedTasks(worldState, result);
    settleTradeCommitments(worldState, result);
    settleNpcRelationshipMemory(worldState, result);
  }

  result.events = uniqueCleanList(result.events, NPC_ECONOMY_CONFIG.maxEventsPerTick, 160);
  result.summary = buildSummary(worldState, result);
  finalizeEconomyLedger(worldState, result);
  return result;
}

function buildMarketPriceView(worldState = {}, options = {}) {
  const ledger = ensureMarketPriceLedgerState(worldState);
  const limit = clampNumber(options.limit, 1, 50, NPC_ECONOMY_CONFIG.maxPriceRowsInView);
  return {
    schemaVersion: MARKET_PRICE_SCHEMA_VERSION,
    generatedAtTurn: ledger.generatedAtTurn,
    date: ledger.date,
    dateLabel: formatYearMonthPeriod({ ...worldState, ...(ledger.date || {}) }),
    role: ledger.role,
    averagePriceIndex: ledger.averagePriceIndex,
    priceRows: (ledger.priceRows || []).slice(0, limit).map((row) => ({
      priceId: row.priceId,
      label: row.label,
      category: row.category,
      baseSilverLiang: row.baseSilverLiang,
      currentSilverLiang: row.currentSilverLiang,
      currentCopperCash: row.currentCopperCash,
      roleMultiplier: row.roleMultiplier,
      marketPressure: row.marketPressure,
      availability: row.availability,
      trend: row.trend,
      trendLabel: row.trendLabel,
      drivers: row.drivers,
      authorityBoundary: row.authorityBoundary
    })),
    recentSignals: uniqueCleanList(ledger.recentSignals, NPC_ECONOMY_CONFIG.maxSignalsInView, 140),
    history: (ledger.history || []).slice(-NPC_ECONOMY_CONFIG.maxPriceHistory),
    safeguards: {
      serverOwnsSettlement: true,
      browserReadonly: true,
      providerCannotSetPrices: true
    }
  };
}

function buildNpcEconomyView(worldState = {}) {
  const ledger = ensureNpcEconomyLedgerState(worldState);
  return {
    schemaVersion: NPC_ECONOMY_SCHEMA_VERSION,
    generatedAtTurn: ledger.generatedAtTurn,
    lastTickTurn: ledger.lastTickTurn,
    lastMonthlyPeriodKey: ledger.lastMonthlyPeriodKey,
    recentEvents: uniqueCleanList(ledger.recentEvents, NPC_ECONOMY_CONFIG.maxRecentEvents, 160),
    lastOutcome: isPlainObject(ledger.lastOutcome) ? cloneJson(ledger.lastOutcome) : null,
    safeguards: {
      serverOwnsAssetsAndTasks: true,
      privateNpcDetailsRedacted: true,
      browserCannotResolveEconomy: true
    }
  };
}

module.exports = {
  buildMarketPriceView,
  buildNpcEconomyView,
  createInitialMarketPriceLedger,
  createInitialNpcEconomyLedger,
  ensureMarketPriceLedgerState,
  ensureNpcEconomyLedgerState,
  refreshMarketPrices,
  runNpcEconomyTickStep
};
