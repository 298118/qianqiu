const NPC_ECONOMY_SCHEMA_VERSION = "s85.npc-economy.v1";
const MARKET_PRICE_SCHEMA_VERSION = "s85.market-prices.v1";

const MARKET_PRICE_CATALOG = Object.freeze({
  book_basic: Object.freeze({
    label: "经书抄本",
    category: "book",
    baseSilverLiang: 1,
    sensitivity: 0.18,
    availabilityFloor: 20,
    roleMultipliers: Object.freeze({ scholar: 0.92, official: 0.98, magistrate: 1.02, emperor: 0.9 }),
    drivers: Object.freeze(["纸价", "书院需求", "科期"])
  }),
  book_rare: Object.freeze({
    label: "名师批本",
    category: "book",
    baseSilverLiang: 12,
    sensitivity: 0.28,
    availabilityFloor: 12,
    roleMultipliers: Object.freeze({ scholar: 0.96, official: 1.04, magistrate: 1.05, emperor: 0.92 }),
    drivers: Object.freeze(["藏书稀缺", "科场声望", "士林门路"])
  }),
  grain_shi: Object.freeze({
    label: "粮食一石",
    category: "grain",
    baseSilverLiang: 0.8,
    sensitivity: 0.52,
    availabilityFloor: 18,
    roleMultipliers: Object.freeze({ magistrate: 0.94, general: 1.08, emperor: 0.88 }),
    drivers: Object.freeze(["仓储", "灾赈", "秋收"])
  }),
  medicinal_herbs: Object.freeze({
    label: "药材一包",
    category: "medicine",
    baseSilverLiang: 2,
    sensitivity: 0.34,
    availabilityFloor: 20,
    roleMultipliers: Object.freeze({ scholar: 1.04, general: 1.12, emperor: 0.9 }),
    drivers: Object.freeze(["疫病", "军需", "季节"])
  }),
  horse_common: Object.freeze({
    label: "驿马一匹",
    category: "horse",
    baseSilverLiang: 30,
    sensitivity: 0.42,
    availabilityFloor: 10,
    roleMultipliers: Object.freeze({ general: 0.9, magistrate: 1.08, scholar: 1.18, emperor: 0.86 }),
    drivers: Object.freeze(["边患", "驿传", "军需"])
  }),
  weapon_standard: Object.freeze({
    label: "制式兵器",
    category: "weapon",
    baseSilverLiang: 8,
    sensitivity: 0.4,
    availabilityFloor: 14,
    roleMultipliers: Object.freeze({ general: 0.88, magistrate: 1.05, scholar: 1.22, emperor: 0.9 }),
    drivers: Object.freeze(["军务", "禁限", "铁价"])
  }),
  document_service: Object.freeze({
    label: "文书保结",
    category: "document",
    baseSilverLiang: 3,
    sensitivity: 0.24,
    availabilityFloor: 28,
    roleMultipliers: Object.freeze({ scholar: 1.08, magistrate: 0.86, official: 0.9, emperor: 0.82 }),
    drivers: Object.freeze(["官署规费", "胥吏需索", "保结风险"])
  }),
  gift_ordinary: Object.freeze({
    label: "常礼一份",
    category: "gift",
    baseSilverLiang: 5,
    sensitivity: 0.22,
    availabilityFloor: 24,
    roleMultipliers: Object.freeze({ scholar: 1.04, official: 1.1, minister: 1.14, emperor: 1.2 }),
    drivers: Object.freeze(["人情往来", "节令", "身份门槛"])
  }),
  estate_maintenance: Object.freeze({
    label: "宅产月修",
    category: "estate_maintenance",
    baseSilverLiang: 2,
    sensitivity: 0.28,
    availabilityFloor: 30,
    roleMultipliers: Object.freeze({ scholar: 1.05, magistrate: 0.96, official: 0.98, emperor: 0.86 }),
    drivers: Object.freeze(["工价", "契税", "治安"])
  }),
  office_budget_unit: Object.freeze({
    label: "官署经费一档",
    category: "office_budget",
    baseSilverLiang: 10,
    sensitivity: 0.32,
    availabilityFloor: 24,
    roleMultipliers: Object.freeze({ magistrate: 0.9, official: 0.92, minister: 0.88, emperor: 0.82, scholar: 1.35 }),
    drivers: Object.freeze(["库银", "贪腐", "差役支应"])
  })
});

const NPC_ECONOMY_CONFIG = Object.freeze({
  maxPriceRowsInView: 12,
  maxSignalsInView: 8,
  maxPriceHistory: 12,
  maxRecentEvents: 12,
  maxEventsPerTick: 4,
  maxAttributeChangesPerTick: 12,
  maxInventoryUpdatesPerTick: 8,
  maxDelegatedTaskResolutionsPerTick: 4,
  maxTradeUpdatesPerTick: 8,
  maxNpcRelationshipUpdatesPerTick: 5,
  maxOpenTradeAgeTurns: 6,
  silverToCopperCash: 1000,
  priceMultiplierRange: Object.freeze([0.35, 3.2]),
  marketPressureRange: Object.freeze([0, 100]),
  assetProductivityUpkeepPenalty: 5,
  assetProductivityMaintainedBonus: 1,
  humanDebtMonthlyEase: 1,
  humanDebtStressIncrease: 1
});

module.exports = {
  MARKET_PRICE_CATALOG,
  MARKET_PRICE_SCHEMA_VERSION,
  NPC_ECONOMY_CONFIG,
  NPC_ECONOMY_SCHEMA_VERSION
};
