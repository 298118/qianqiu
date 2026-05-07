const { getBureau, getOffice } = require("./officialCatalog");

const WORLD_ENTITY_SCHEMA_VERSION = 1;
const MAX_ENTITIES = 24;
const MAX_RECENT_NOTES = 8;
const MAX_TEXT_LENGTH = 160;

const ENTITY_CATEGORIES = new Set(["court", "local", "academy", "military", "fiscal", "relief"]);
const ENTITY_KINDS = new Set([
  "court_office",
  "local_gentry",
  "academy_circle",
  "frontier_garrison",
  "fiscal_channel",
  "relief_operation"
]);
const ENTITY_STATUSES = new Set(["stable", "strained", "critical"]);
const VISIBILITY_VALUES = new Set(["public", "role_visible", "hidden"]);
const METRIC_KEYS = ["influence", "pressure", "capacity", "trust", "deficit"];

const CATEGORY_LABELS = {
  court: "朝廷",
  local: "地方",
  academy: "士林",
  military: "军镇",
  fiscal: "财赋",
  relief: "赈务"
};

const KIND_LABELS = {
  court_office: "朝廷衙门",
  local_gentry: "地方士绅",
  academy_circle: "书院同门",
  frontier_garrison: "军镇边墙",
  fiscal_channel: "商税盐漕",
  relief_operation: "灾荒赈务"
};

const STATUS_LABELS = {
  stable: "暂稳",
  strained: "吃紧",
  critical: "危急"
};

const RISK_LABELS = {
  low: "可观察",
  medium: "有牵连",
  high: "急重"
};

const FACTION_LABELS = {
  eunuchs: "内廷宦官",
  scholarOfficials: "士大夫",
  militaryLords: "边镇武臣"
};

const METRIC_LABELS = {
  treasury: "府库",
  grainReserve: "粮储",
  population: "人口",
  publicOrder: "民心",
  taxRate: "税率",
  corruption: "贪腐",
  armySize: "兵额",
  armyMorale: "军心",
  borderThreat: "边患",
  "player.academia": "学识",
  "player.reputation": "声望",
  "player.gentryRelations": "乡绅",
  "player.localOrder": "地方民心",
  "player.pendingLawsuits": "词讼",
  "player.waterworks": "水利",
  "player.performanceMerit": "考成",
  "player.impeachmentRisk": "弹劾",
  "factions.eunuchs": "内廷宦官",
  "factions.scholarOfficials": "士大夫",
  "factions.militaryLords": "边镇武臣"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function readNumber(source, key, fallback) {
  const value = Number(source?.[key]);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readWorldNumber(worldState, key, fallback) {
  return readNumber(worldState, key, fallback);
}

function readPlayerNumber(worldState, key, fallback) {
  return readNumber(worldState?.player, key, fallback);
}

function metric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function normalizeStringList(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanText(entry, "", 80))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeRelated(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    characters: normalizeStringList(source.characters),
    factions: normalizeStringList(source.factions),
    offices: normalizeStringList(source.offices),
    metrics: normalizeStringList(source.metrics, 10)
  };
}

function normalizeMetrics(raw) {
  const source = isPlainObject(raw) ? raw : {};
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [key, metric(source[key], key === "deficit" ? 0 : 50)])
  );
}

function grainStress(worldState) {
  const grainReserve = Math.max(0, readWorldNumber(worldState, "grainReserve", 800));
  const population = Math.max(1, readWorldNumber(worldState, "population", 5000));
  const ratio = grainReserve / population;
  if (ratio < 0.04) return 92;
  if (ratio < 0.07) return 74;
  if (ratio < 0.1) return 58;
  if (ratio > 0.2) return 24;
  return 40;
}

function treasuryCapacity(worldState) {
  const treasury = readWorldNumber(worldState, "treasury", 1000);
  if (treasury >= 8000) return 88;
  if (treasury >= 4000) return 70;
  if (treasury >= 1200) return 52;
  if (treasury >= 400) return 34;
  return 18;
}

function fiscalDeficit(worldState) {
  const treasury = readWorldNumber(worldState, "treasury", 1000);
  const corruption = readWorldNumber(worldState, "corruption", 60);
  const taxRate = readWorldNumber(worldState, "taxRate", 30);
  return metric(70 - treasury / 140 + corruption * 0.35 + Math.max(0, taxRate - 35) * 0.8, 35);
}

function pressureStatus(metrics) {
  if (metrics.pressure >= 78 || metrics.deficit >= 80 || metrics.capacity <= 22 || metrics.trust <= 20) {
    return "critical";
  }
  if (metrics.pressure >= 55 || metrics.deficit >= 55 || metrics.capacity <= 40 || metrics.trust <= 38) {
    return "strained";
  }
  return "stable";
}

function riskTone(entity) {
  const metrics = entity.metrics || {};
  if (entity.status === "critical" || metrics.pressure >= 78 || metrics.deficit >= 78) return "high";
  if (entity.status === "strained" || metrics.pressure >= 55 || metrics.deficit >= 55) return "medium";
  return "low";
}

function baseSummary(prefix, metrics, suffix) {
  return `${prefix}压力约${metrics.pressure}，承载约${metrics.capacity}，信任约${metrics.trust}。${suffix}`;
}

const ENTITY_DEFINITIONS = [
  {
    id: "court-ministry-personnel",
    category: "court",
    kind: "court_office",
    name: "吏部",
    related: { offices: ["ministry_personnel"], factions: ["scholarOfficials"], metrics: ["corruption", "player.performanceMerit"] },
    interventionHints: ["核考成", "查官缺", "谨慎写荐牍"],
    metrics(worldState) {
      const corruption = readWorldNumber(worldState, "corruption", 60);
      const merit = readPlayerNumber(worldState, "performanceMerit", 30);
      return {
        influence: 78,
        pressure: metric(corruption * 0.6 + Math.max(0, 55 - merit) * 0.4, 45),
        capacity: metric(65 - corruption * 0.22 + merit * 0.18, 55),
        trust: metric(100 - corruption * 0.45, 55),
        deficit: metric(corruption * 0.35, 25)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("铨选与考成簿册", metrics, "任免仍由服务器官场结算裁决。");
    }
  },
  {
    id: "court-ministry-revenue",
    category: "court",
    kind: "court_office",
    name: "户部",
    related: { offices: ["ministry_revenue"], factions: ["scholarOfficials"], metrics: ["treasury", "grainReserve", "taxRate", "corruption"] },
    interventionHints: ["查钱粮", "核赈册", "缓急税粮"],
    metrics(worldState) {
      const deficit = fiscalDeficit(worldState);
      return {
        influence: 82,
        pressure: metric(deficit + grainStress(worldState) * 0.25, 58),
        capacity: treasuryCapacity(worldState),
        trust: metric(72 - readWorldNumber(worldState, "corruption", 60) * 0.32, 52),
        deficit
      };
    },
    summary(worldState, metrics) {
      return baseSummary("钱粮、盐漕与赈银都要入户部账", metrics, "府库不足会牵动赈务和军需。");
    }
  },
  {
    id: "court-censorate",
    category: "court",
    kind: "court_office",
    name: "都察院",
    related: { offices: ["censorate"], factions: ["scholarOfficials", "eunuchs"], metrics: ["corruption", "player.impeachmentRisk"] },
    interventionHints: ["留意弹章", "自清账册", "避开未明暗流"],
    metrics(worldState) {
      const corruption = readWorldNumber(worldState, "corruption", 60);
      const impeachmentRisk = readPlayerNumber(worldState, "impeachmentRisk", 18);
      return {
        influence: 72,
        pressure: metric(corruption * 0.55 + impeachmentRisk * 0.45, 48),
        capacity: metric(58 + readPlayerNumber(worldState, "cleanReputation", 60) * 0.2, 60),
        trust: metric(62 - corruption * 0.25 + readPlayerNumber(worldState, "cleanReputation", 60) * 0.18, 55),
        deficit: metric(corruption * 0.25, 20)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("台谏风闻会把钱粮、官声和派系互相牵连", metrics, "只暴露公开风声，不暴露隐藏弹章。");
    }
  },
  {
    id: "local-gentry-county",
    category: "local",
    kind: "local_gentry",
    name: "地方士绅",
    related: { characters: ["C01"], factions: ["scholarOfficials"], metrics: ["player.gentryRelations", "publicOrder", "taxRate"] },
    interventionHints: ["拜会乡绅", "核乡约", "借绅力安民"],
    metrics(worldState) {
      const gentry = readPlayerNumber(worldState, "gentryRelations", 45);
      const order = readWorldNumber(worldState, "publicOrder", 70);
      return {
        influence: 68,
        pressure: metric(80 - gentry * 0.45 + Math.max(0, 50 - order) * 0.45, 42),
        capacity: metric(45 + gentry * 0.45, 60),
        trust: metric(gentry || 48, 48),
        deficit: metric(Math.max(0, readWorldNumber(worldState, "taxRate", 30) - 35) * 1.5, 12)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("乡绅、里甲与县衙互相借力也互相掣肘", metrics, "地方行动会先改变可见关系与县政压力。");
    }
  },
  {
    id: "local-riverworks-lawsuits",
    category: "local",
    kind: "local_gentry",
    name: "河工案牍",
    related: { metrics: ["player.waterworks", "player.pendingLawsuits", "publicOrder"] },
    interventionHints: ["修堤清账", "审理旧案", "压低徭役扰民"],
    metrics(worldState) {
      const lawsuits = readPlayerNumber(worldState, "pendingLawsuits", 12);
      const waterworks = readPlayerNumber(worldState, "waterworks", 42);
      const corvee = readPlayerNumber(worldState, "corveeBurden", 30);
      return {
        influence: 52,
        pressure: metric(lawsuits * 0.8 + corvee * 0.55 + Math.max(0, 55 - waterworks) * 0.35, 45),
        capacity: metric(35 + waterworks * 0.6, 55),
        trust: metric(readPlayerNumber(worldState, "localOrder", 62), 55),
        deficit: metric(corvee * 0.45, 18)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("河工、徭役与词讼常从同一批账册里牵出", metrics, "县政处置可成为后续世界议题来源。");
    }
  },
  {
    id: "academy-county-school",
    category: "academy",
    kind: "academy_circle",
    name: "县学书院",
    related: { characters: ["C01"], factions: ["scholarOfficials"], metrics: ["player.academia", "player.reputation"] },
    interventionHints: ["拜师讲学", "会文结社", "谨慎取名声"],
    metrics(worldState) {
      const academia = readPlayerNumber(worldState, "academia", 10);
      const reputation = readPlayerNumber(worldState, "reputation", 10);
      return {
        influence: metric(35 + reputation * 0.45, 45),
        pressure: metric(Math.max(0, 45 - academia) + Math.max(0, 50 - reputation) * 0.25, 35),
        capacity: metric(45 + academia * 0.45, 50),
        trust: metric(40 + reputation * 0.5, 45),
        deficit: 0
      };
    },
    summary(worldState, metrics) {
      return baseSummary("书院、塾师和文社决定士林入口", metrics, "只呈现玩家当前能听见的师友声气。");
    }
  },
  {
    id: "academy-same-year-circle",
    category: "academy",
    kind: "academy_circle",
    name: "同年文社",
    related: { factions: ["scholarOfficials"], metrics: ["player.peerNetwork", "player.reputation"] },
    interventionHints: ["修书同年", "观望座师", "以文章换声气"],
    metrics(worldState) {
      const peerNetwork = readPlayerNumber(worldState, "peerNetwork", 0);
      const reputation = readPlayerNumber(worldState, "reputation", 10);
      return {
        influence: metric(30 + peerNetwork * 0.6, 40),
        pressure: metric(42 - peerNetwork * 0.22 + readPlayerNumber(worldState, "impeachmentRisk", 0) * 0.25, 38),
        capacity: metric(35 + peerNetwork * 0.5, 45),
        trust: metric(35 + reputation * 0.35 + peerNetwork * 0.25, 42),
        deficit: 0
      };
    },
    summary(worldState, metrics) {
      return baseSummary("同年、座师和文社能扶人，也能牵连人", metrics, "隐藏门路不会进入可见摘要。");
    }
  },
  {
    id: "military-frontier-garrison",
    category: "military",
    kind: "frontier_garrison",
    name: "边镇军镇",
    related: { factions: ["militaryLords"], metrics: ["borderThreat", "armyMorale", "armySize", "treasury"] },
    interventionHints: ["查边报", "核军饷", "稳军心"],
    metrics(worldState) {
      const threat = readWorldNumber(worldState, "borderThreat", 40);
      const morale = readWorldNumber(worldState, "armyMorale", 65);
      return {
        influence: metric(48 + threat * 0.35, 60),
        pressure: metric(threat + Math.max(0, 55 - morale) * 0.35, 50),
        capacity: metric(morale, 60),
        trust: metric(50 + morale * 0.25 - threat * 0.12, 52),
        deficit: metric(Math.max(0, 55 - treasuryCapacity(worldState)) + threat * 0.18, 30)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("边镇奏报把军心、饷银与边患绑在一起", metrics, "战报真假仍需玩家行动和服务器规则辨析。");
    }
  },
  {
    id: "military-wall-beacons",
    category: "military",
    kind: "frontier_garrison",
    name: "边墙堡寨",
    related: { factions: ["militaryLords"], metrics: ["borderThreat", "armyMorale", "player.scouting"] },
    interventionHints: ["修堡设侦", "查烽燧", "约束虚报军功"],
    metrics(worldState) {
      const threat = readWorldNumber(worldState, "borderThreat", 40);
      const scouting = readPlayerNumber(worldState, "scouting", 35);
      return {
        influence: 50,
        pressure: metric(threat + Math.max(0, 42 - scouting) * 0.28, 48),
        capacity: metric(42 + scouting * 0.45, 52),
        trust: metric(50 + scouting * 0.25, 50),
        deficit: metric(threat * 0.25, 18)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("堡寨、烽燧和侦骑决定边报能否落到实处", metrics, "将领行动会优先牵动此处。");
    }
  },
  {
    id: "fiscal-salt-canal",
    category: "fiscal",
    kind: "fiscal_channel",
    name: "盐漕通道",
    related: { offices: ["ministry_revenue"], factions: ["scholarOfficials", "eunuchs"], metrics: ["treasury", "grainReserve", "corruption"] },
    interventionHints: ["查盐课", "验漕仓", "防亏空"],
    metrics(worldState) {
      const corruption = readWorldNumber(worldState, "corruption", 60);
      const deficit = fiscalDeficit(worldState);
      return {
        influence: 76,
        pressure: metric(deficit * 0.7 + corruption * 0.35, 58),
        capacity: metric(treasuryCapacity(worldState) * 0.65 + Math.max(0, 100 - corruption) * 0.2, 50),
        trust: metric(68 - corruption * 0.45, 45),
        deficit
      };
    },
    summary(worldState, metrics) {
      return baseSummary("盐课、漕运和仓场是钱粮最肥也最险的通道", metrics, "模型只能叙事或建议，亏空裁决归服务器。");
    }
  },
  {
    id: "fiscal-land-merchant-tax",
    category: "fiscal",
    kind: "fiscal_channel",
    name: "田赋商税",
    related: { metrics: ["taxRate", "publicOrder", "treasury", "player.gentryRelations"] },
    interventionHints: ["缓征急赋", "清田核册", "听商民怨声"],
    metrics(worldState) {
      const taxRate = readWorldNumber(worldState, "taxRate", 30);
      const order = readWorldNumber(worldState, "publicOrder", 70);
      return {
        influence: 70,
        pressure: metric(taxRate * 0.75 + Math.max(0, 58 - order) * 0.55, 44),
        capacity: metric(treasuryCapacity(worldState), 50),
        trust: metric(order - Math.max(0, taxRate - 35) * 0.7, 55),
        deficit: fiscalDeficit(worldState)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("田赋与商税把府库需求转成民间承受", metrics, "加税、缓征和清丈都应有可见代价。");
    }
  },
  {
    id: "relief-granary-operation",
    category: "relief",
    kind: "relief_operation",
    name: "灾荒赈务",
    related: { offices: ["ministry_revenue"], metrics: ["grainReserve", "publicOrder", "population", "corruption"] },
    interventionHints: ["开仓赈济", "核赈册", "查浮冒"],
    metrics(worldState) {
      const stress = grainStress(worldState);
      const order = readWorldNumber(worldState, "publicOrder", 70);
      const corruption = readWorldNumber(worldState, "corruption", 60);
      return {
        influence: 74,
        pressure: metric(stress * 0.75 + Math.max(0, 50 - order) * 0.45 + corruption * 0.18, 58),
        capacity: metric((100 - stress) * 0.55 + treasuryCapacity(worldState) * 0.35, 48),
        trust: metric(order - corruption * 0.25, 48),
        deficit: metric(stress * 0.45 + fiscalDeficit(worldState) * 0.35, 45)
      };
    },
    summary(worldState, metrics) {
      return baseSummary("赈银、义仓与灾民安置会连续牵动数月", metrics, "具体调度在 S45.2 接入来源系统。");
    }
  }
];

const DEFINITION_BY_ID = new Map(ENTITY_DEFINITIONS.map((definition) => [definition.id, definition]));

function buildDefinitionEntity(definition, worldState = {}) {
  const metrics = normalizeMetrics(definition.metrics(worldState));
  const status = pressureStatus(metrics);
  return {
    schemaVersion: WORLD_ENTITY_SCHEMA_VERSION,
    id: definition.id,
    category: definition.category,
    kind: definition.kind,
    name: definition.name,
    status,
    visibility: "public",
    metrics,
    publicSummary: definition.summary(worldState, metrics),
    related: normalizeRelated(definition.related),
    interventionHints: normalizeStringList(definition.interventionHints, 5),
    lastUpdatedTurn: currentTurn(worldState),
    hiddenNotes: []
  };
}

function normalizeEntity(raw, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const id = cleanText(raw.id, "", 96);
  if (!id) return null;
  const definition = DEFINITION_BY_ID.get(id);
  const fallback = definition ? buildDefinitionEntity(definition, worldState) : null;
  const category = ENTITY_CATEGORIES.has(raw.category) ? raw.category : fallback?.category;
  const kind = ENTITY_KINDS.has(raw.kind) ? raw.kind : fallback?.kind;
  const name = cleanText(raw.name, fallback?.name || "", 80);
  if (!category || !kind || !name) return null;

  const metrics = normalizeMetrics({
    ...(fallback?.metrics || {}),
    ...(isPlainObject(raw.metrics) ? raw.metrics : {})
  });
  const status = ENTITY_STATUSES.has(raw.status) ? raw.status : pressureStatus(metrics);

  return {
    schemaVersion: WORLD_ENTITY_SCHEMA_VERSION,
    id,
    category,
    kind,
    name,
    status,
    visibility: VISIBILITY_VALUES.has(raw.visibility) ? raw.visibility : fallback?.visibility || "public",
    metrics,
    publicSummary: cleanText(raw.publicSummary, fallback?.publicSummary || name),
    related: normalizeRelated(raw.related || fallback?.related),
    interventionHints: normalizeStringList(raw.interventionHints || fallback?.interventionHints, 5),
    lastUpdatedTurn: clampNumber(raw.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(raw.hiddenNotes, 5)
  };
}

function sourceEntityList(source) {
  if (Array.isArray(source.entities)) return source.entities;
  if (isPlainObject(source.entities)) return Object.values(source.entities);
  return [];
}

function normalizeRecentNotes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((note) => cleanText(note, "", MAX_TEXT_LENGTH))
    .filter(Boolean)
    .slice(-MAX_RECENT_NOTES);
}

function normalizeWorldEntityState(worldState = {}) {
  const source = isPlainObject(worldState.worldEntities) ? worldState.worldEntities : {};
  const rawById = new Map(
    sourceEntityList(source)
      .filter(isPlainObject)
      .map((entity) => [cleanText(entity.id, "", 96), entity])
      .filter(([id]) => Boolean(id))
  );
  const entities = [];
  const usedIds = new Set();

  for (const definition of ENTITY_DEFINITIONS) {
    const normalized = normalizeEntity(rawById.get(definition.id) || buildDefinitionEntity(definition, worldState), worldState);
    if (!normalized) continue;
    usedIds.add(normalized.id);
    entities.push(normalized);
  }

  for (const raw of sourceEntityList(source)) {
    if (!isPlainObject(raw) || usedIds.has(cleanText(raw.id, "", 96))) continue;
    const normalized = normalizeEntity(raw, worldState);
    if (!normalized) continue;
    entities.push(normalized);
    usedIds.add(normalized.id);
    if (entities.length >= MAX_ENTITIES) break;
  }

  return {
    schemaVersion: WORLD_ENTITY_SCHEMA_VERSION,
    entities: entities.slice(0, MAX_ENTITIES),
    recentNotes: normalizeRecentNotes(source.recentNotes)
  };
}

function createInitialWorldEntityState(worldState = {}) {
  return normalizeWorldEntityState({ ...worldState, worldEntities: { schemaVersion: WORLD_ENTITY_SCHEMA_VERSION } });
}

function ensureWorldEntityState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.worldEntities = normalizeWorldEntityState(worldState);
  return worldState;
}

function labelOffice(id) {
  const bureau = getBureau(id);
  if (bureau) return bureau.name;
  const office = getOffice(id);
  if (office) return office.title;
  return id;
}

function uniqueList(values, limit = 8) {
  const result = [];
  const seen = new Set();
  values.forEach((value) => {
    const text = cleanText(value, "", 80);
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result.slice(0, limit);
}

function buildRelatedLabels(related = {}, worldState = {}) {
  const characters = uniqueList((related.characters || []).map((id) => {
    const character = Array.isArray(worldState.characters)
      ? worldState.characters.find((entry) => entry?.id === id)
      : null;
    return character?.name || id;
  }), 6);
  const factions = uniqueList((related.factions || []).map((id) => FACTION_LABELS[id] || id), 6);
  const offices = uniqueList((related.offices || []).map(labelOffice), 6);
  const metrics = uniqueList((related.metrics || []).map((id) => METRIC_LABELS[id] || id), 8);
  return {
    characters,
    factions,
    offices,
    metrics,
    summary: uniqueList([...characters, ...factions, ...offices, ...metrics], 8)
  };
}

function viewEntity(entity, worldState = {}) {
  const tone = riskTone(entity);
  return {
    id: entity.id,
    category: entity.category,
    categoryLabel: CATEGORY_LABELS[entity.category] || entity.category,
    kind: entity.kind,
    kindLabel: KIND_LABELS[entity.kind] || entity.kind,
    name: entity.name,
    status: entity.status,
    statusLabel: STATUS_LABELS[entity.status] || entity.status,
    riskTone: tone,
    riskLabel: RISK_LABELS[tone],
    metrics: entity.metrics,
    publicSummary: entity.publicSummary,
    related: entity.related,
    relatedLabels: buildRelatedLabels(entity.related, worldState),
    interventionHints: entity.interventionHints,
    lastUpdatedTurn: entity.lastUpdatedTurn
  };
}

function compareEntityPressure(first, second) {
  const firstScore = Math.max(first.metrics.pressure, first.metrics.deficit, 100 - first.metrics.capacity);
  const secondScore = Math.max(second.metrics.pressure, second.metrics.deficit, 100 - second.metrics.capacity);
  if (secondScore !== firstScore) return secondScore - firstScore;
  return first.id.localeCompare(second.id);
}

function buildWorldEntityView(worldState = {}) {
  const state = normalizeWorldEntityState(worldState);
  const visibleEntities = state.entities
    .filter((entity) => entity.visibility !== "hidden")
    .map((entity) => viewEntity(entity, worldState));
  const groups = [...ENTITY_CATEGORIES]
    .map((category) => {
      const entities = visibleEntities.filter((entity) => entity.category === category);
      return {
        category,
        label: CATEGORY_LABELS[category] || category,
        entities
      };
    })
    .filter((group) => group.entities.length);

  return {
    schemaVersion: WORLD_ENTITY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    groups,
    highlights: visibleEntities.slice().sort(compareEntityPressure).slice(0, 6)
  };
}

function summarizeWorldEntitiesForPrompt(worldState = {}) {
  const view = buildWorldEntityView(worldState);
  return {
    highlights: view.highlights.slice(0, 6).map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      name: entity.name,
      statusLabel: entity.statusLabel,
      riskLabel: entity.riskLabel,
      metrics: entity.metrics,
      publicSummary: entity.publicSummary,
      relatedLabels: entity.relatedLabels.summary,
      interventionHints: entity.interventionHints
    })),
    groups: view.groups.map((group) => ({
      category: group.category,
      label: group.label,
      count: group.entities.length,
      names: group.entities.slice(0, 4).map((entity) => entity.name),
      strained: group.entities.filter((entity) => entity.status !== "stable").length
    }))
  };
}

module.exports = {
  WORLD_ENTITY_SCHEMA_VERSION,
  buildWorldEntityView,
  createInitialWorldEntityState,
  ensureWorldEntityState,
  normalizeWorldEntityState,
  summarizeWorldEntitiesForPrompt
};
