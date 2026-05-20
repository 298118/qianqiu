const INVENTORY_LEDGER_SCHEMA_VERSION = 1;

const CONTAINER_DEFINITIONS = Object.freeze({
  personal: Object.freeze({
    label: "随身背包",
    defaultCapacityWeight: 40,
    defaultVisibility: "player_visible",
    ownerPolicy: "actor"
  }),
  home_storage: Object.freeze({
    label: "家宅仓库",
    defaultCapacityWeight: 800,
    defaultVisibility: "player_visible",
    ownerPolicy: "household"
  }),
  office_storage: Object.freeze({
    label: "官署库房",
    defaultCapacityWeight: 2000,
    defaultVisibility: "role_limited",
    ownerPolicy: "office"
  }),
  military_baggage: Object.freeze({
    label: "军中辎重",
    defaultCapacityWeight: 3000,
    defaultVisibility: "role_limited",
    ownerPolicy: "military"
  }),
  imperial_vault: Object.freeze({
    label: "宫中内库",
    defaultCapacityWeight: 10000,
    defaultVisibility: "role_limited",
    ownerPolicy: "imperial"
  }),
  sealed_case: Object.freeze({
    label: "封存匣",
    defaultCapacityWeight: 80,
    defaultVisibility: "role_limited",
    ownerPolicy: "server"
  })
});

const ITEM_TEMPLATES = Object.freeze({
  book_four_books: Object.freeze({
    name: "四书章句",
    category: "book",
    subtype: "classic",
    unit: "册",
    weight: 1,
    stackLimit: 1,
    legalStatus: "ordinary",
    transferPolicy: "tradeable",
    rarity: "common",
    effects: Object.freeze(["study:classic_foundation"])
  }),
  book_law_code: Object.freeze({
    name: "大明律例钞本",
    category: "book",
    subtype: "law",
    unit: "册",
    weight: 1,
    stackLimit: 1,
    legalStatus: "restricted",
    transferPolicy: "lendable",
    rarity: "uncommon",
    effects: Object.freeze(["study:law_context", "official:case_reference"])
  }),
  deed_estate: Object.freeze({
    name: "宅院地契",
    category: "document",
    subtype: "deed",
    unit: "份",
    weight: 0,
    stackLimit: 1,
    legalStatus: "restricted",
    transferPolicy: "server_only",
    rarity: "rare",
    important: true,
    credential: true,
    effects: Object.freeze(["asset:estate_claim"])
  }),
  official_seal_county: Object.freeze({
    name: "县印",
    category: "credential",
    subtype: "official_seal",
    unit: "枚",
    weight: 2,
    stackLimit: 1,
    legalStatus: "official_seal",
    transferPolicy: "bound_to_office",
    rarity: "rare",
    important: true,
    credential: true,
    effects: Object.freeze(["authority:county_office"])
  }),
  military_tally_bronze: Object.freeze({
    name: "铜虎符",
    category: "credential",
    subtype: "military_token",
    unit: "枚",
    weight: 1,
    stackLimit: 1,
    legalStatus: "military_token",
    transferPolicy: "bound_to_actor",
    rarity: "epic",
    important: true,
    credential: true,
    effects: Object.freeze(["authority:military_command"])
  }),
  imperial_edict: Object.freeze({
    name: "诏书",
    category: "credential",
    subtype: "imperial_edict",
    unit: "卷",
    weight: 0,
    stackLimit: 1,
    legalStatus: "imperial_artifact",
    transferPolicy: "server_only",
    rarity: "legendary",
    important: true,
    credential: true,
    effects: Object.freeze(["authority:imperial_order"])
  }),
  silver_ingot: Object.freeze({
    name: "银锭",
    category: "valuable",
    subtype: "silver",
    unit: "锭",
    weight: 1,
    stackLimit: 100,
    legalStatus: "ordinary",
    transferPolicy: "tradeable",
    rarity: "common",
    effects: Object.freeze(["resource:silver_liang"])
  }),
  medicinal_herbs: Object.freeze({
    name: "药材包",
    category: "medical",
    subtype: "herb",
    unit: "包",
    weight: 1,
    stackLimit: 20,
    legalStatus: "ordinary",
    transferPolicy: "tradeable",
    rarity: "common",
    effects: Object.freeze(["health:minor_care"])
  }),
  survey_tools: Object.freeze({
    name: "测田绳尺",
    category: "tool",
    subtype: "survey",
    unit: "套",
    weight: 3,
    stackLimit: 4,
    legalStatus: "ordinary",
    transferPolicy: "lendable",
    rarity: "uncommon",
    effects: Object.freeze(["delegated_task:land_survey"])
  }),
  forged_seal: Object.freeze({
    name: "伪造关防",
    category: "contraband",
    subtype: "forged_seal",
    unit: "枚",
    weight: 1,
    stackLimit: 1,
    legalStatus: "contraband",
    transferPolicy: "server_only",
    rarity: "rare",
    important: true,
    effects: Object.freeze(["risk:criminal_evidence"])
  })
});

const INVENTORY_LEDGER_CONFIG = Object.freeze({
  maxContainersInView: 12,
  maxItemsInView: 80,
  maxImportantCredentialsInView: 20,
  maxProvenanceEntriesInView: 4,
  textLimit: 120,
  containerDefinitions: CONTAINER_DEFINITIONS,
  itemTemplates: ITEM_TEMPLATES,
  legalStatuses: Object.freeze([
    "ordinary",
    "restricted",
    "official_seal",
    "military_token",
    "imperial_artifact",
    "contraband"
  ]),
  transferPolicies: Object.freeze([
    "tradeable",
    "giftable",
    "lendable",
    "bound_to_office",
    "bound_to_actor",
    "server_only"
  ]),
  visibilityLevels: Object.freeze(["player_visible", "public", "rumor", "role_limited", "hidden"])
});

module.exports = {
  CONTAINER_DEFINITIONS,
  INVENTORY_LEDGER_CONFIG,
  INVENTORY_LEDGER_SCHEMA_VERSION,
  ITEM_TEMPLATES
};
