const ASSET_LEDGER_SCHEMA_VERSION = 1;

const RESOURCE_DEFINITIONS = Object.freeze({
  silver_liang: Object.freeze({
    label: "白银",
    unit: "两",
    min: 0,
    max: 100000,
    defaultAmount: 35,
    visibleToPlayer: true
  }),
  gold_liang: Object.freeze({
    label: "黄金",
    unit: "两",
    min: 0,
    max: 10000,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  copper_cash: Object.freeze({
    label: "铜钱",
    unit: "文",
    min: 0,
    max: 10000000,
    defaultAmount: 1800,
    visibleToPlayer: true
  }),
  grain_shi: Object.freeze({
    label: "粮食",
    unit: "石",
    min: 0,
    max: 100000,
    defaultAmount: 2,
    visibleToPlayer: true
  }),
  merit: Object.freeze({
    label: "功绩",
    unit: "点",
    min: 0,
    max: 10000,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  official_reputation: Object.freeze({
    label: "官声",
    unit: "点",
    min: -100,
    max: 100,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  public_esteem: Object.freeze({
    label: "民望",
    unit: "点",
    min: -100,
    max: 100,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  imperial_favor: Object.freeze({
    label: "皇恩",
    unit: "点",
    min: -100,
    max: 100,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  military_merit: Object.freeze({
    label: "军功",
    unit: "点",
    min: 0,
    max: 10000,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  human_debt: Object.freeze({
    label: "人情债",
    unit: "桩",
    min: -1000,
    max: 1000,
    defaultAmount: 0,
    visibleToPlayer: true
  }),
  academic_prestige: Object.freeze({
    label: "学望",
    unit: "点",
    min: 0,
    max: 10000,
    defaultAmount: 8,
    visibleToPlayer: true
  })
});

const ROLE_RESOURCE_DEFAULTS = Object.freeze({
  scholar: Object.freeze({
    silver_liang: 35,
    copper_cash: 1800,
    grain_shi: 2,
    academic_prestige: 8
  }),
  child_exam: Object.freeze({
    silver_liang: 45,
    copper_cash: 2200,
    grain_shi: 3,
    academic_prestige: 18
  }),
  provincial_exam: Object.freeze({
    silver_liang: 70,
    copper_cash: 3600,
    grain_shi: 4,
    academic_prestige: 34
  }),
  metropolitan_exam: Object.freeze({
    silver_liang: 110,
    copper_cash: 5200,
    grain_shi: 5,
    academic_prestige: 52
  }),
  palace_exam: Object.freeze({
    silver_liang: 160,
    copper_cash: 8000,
    grain_shi: 6,
    academic_prestige: 70,
    imperial_favor: 5
  }),
  official: Object.freeze({
    silver_liang: 240,
    copper_cash: 12000,
    grain_shi: 8,
    academic_prestige: 78,
    official_reputation: 10,
    public_esteem: 5,
    imperial_favor: 8
  }),
  magistrate: Object.freeze({
    silver_liang: 300,
    copper_cash: 16000,
    grain_shi: 12,
    academic_prestige: 72,
    official_reputation: 14,
    public_esteem: 8,
    imperial_favor: 6
  }),
  general: Object.freeze({
    silver_liang: 260,
    copper_cash: 12000,
    grain_shi: 20,
    military_merit: 30,
    public_esteem: 6
  }),
  emperor: Object.freeze({
    silver_liang: 10000,
    gold_liang: 500,
    copper_cash: 1000000,
    grain_shi: 10000,
    imperial_favor: 100
  })
});

const ASSET_TYPE_DEFINITIONS = Object.freeze({
  estate: Object.freeze({ label: "宅产", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  farmland: Object.freeze({ label: "田产", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  shop: Object.freeze({ label: "铺面", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  boat: Object.freeze({ label: "船只", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  horse: Object.freeze({ label: "马匹", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  workshop: Object.freeze({ label: "作坊", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  study: Object.freeze({ label: "书斋", defaultVisibility: "player_visible", defaultLegalStatus: "ordinary" }),
  treasury: Object.freeze({ label: "府库", defaultVisibility: "role_limited", defaultLegalStatus: "official_property" }),
  armory: Object.freeze({ label: "军械库", defaultVisibility: "role_limited", defaultLegalStatus: "restricted" })
});

const ASSET_LEDGER_CONFIG = Object.freeze({
  maxAssetsInPlayerView: 40,
  maxResourceAccountsInView: 20,
  maxProvenanceEntriesInView: 4,
  textLimit: 120,
  resourceDefinitions: RESOURCE_DEFINITIONS,
  roleResourceDefaults: ROLE_RESOURCE_DEFAULTS,
  assetTypeDefinitions: ASSET_TYPE_DEFINITIONS,
  visibilityLevels: Object.freeze(["player_visible", "public", "rumor", "role_limited", "hidden"]),
  legalStatuses: Object.freeze(["ordinary", "restricted", "official_property", "sealed", "disputed", "confiscated"])
});

module.exports = {
  ASSET_LEDGER_CONFIG,
  ASSET_LEDGER_SCHEMA_VERSION,
  ASSET_TYPE_DEFINITIONS,
  RESOURCE_DEFINITIONS,
  ROLE_RESOURCE_DEFAULTS
};
