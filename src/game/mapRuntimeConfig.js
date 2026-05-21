const MAP_RUNTIME_SCHEMA_VERSION = 1;
const MAP_RUNTIME_LAYOUT_VERSION = "ink-layout-v1";
const MAP_RUNTIME_ASSET_SET_ID = "ink-map-v1";

const MAP_RUNTIME_BOUNDS = Object.freeze({
  width: 2400,
  height: 1600,
  coordinateSpace: "normalized-image-space"
});

const MAP_RUNTIME_LAYERS = Object.freeze([
  Object.freeze({ id: "base", label: "底图", order: 0, visible: true }),
  Object.freeze({ id: "routes", label: "通路", order: 20, visible: true }),
  Object.freeze({ id: "places", label: "城邑", order: 30, visible: true }),
  Object.freeze({ id: "events", label: "事势", order: 40, visible: true })
]);

const MAP_RUNTIME_LAYER_IDS = Object.freeze(MAP_RUNTIME_LAYERS.map((layer) => layer.id));

const MAP_RUNTIME_LIMITS = Object.freeze({
  maxRefs: 80,
  maxRoutes: 40,
  maxEventEffects: 12,
  maxActionDrafts: 80,
  maxLabelLength: 80,
  maxSummaryLength: 160,
  maxActionTextLength: 120,
  maxSourceRefs: 4
});

const MAP_RUNTIME_LABEL_ANCHORS = Object.freeze(["top", "right", "bottom", "left", "center"]);

const MAP_RUNTIME_STYLE_TOKENS = Object.freeze({
  country: "edict",
  region: "edict",
  city: "city_prefecture",
  frontier_zone: "frontier_pressure",
  jurisdiction: "edict",
  posting: "edict",
  transfer: "edict",
  docket: "legal_docket",
  military_report: "garrison",
  economic_report: "trade_port",
  exam_travel: "exam_hall"
});

const MAP_RUNTIME_ROUTE_STYLE_TOKENS = Object.freeze({
  canal: "water_route",
  river: "water_route",
  sea: "sea_route",
  pass: "pass_route",
  road: "land_route"
});

const MAP_RUNTIME_EVENT_EFFECTS = Object.freeze({
  border_incident: Object.freeze({
    kind: "military_pressure",
    label: "边警",
    animationToken: "ink_ripple_red",
    severityFloor: 0.55
  }),
  market_incident: Object.freeze({
    kind: "market_pressure",
    label: "市况",
    animationToken: "ink_ripple_ochre",
    severityFloor: 0.4
  }),
  disaster_docket: Object.freeze({
    kind: "disaster_pressure",
    label: "灾务",
    animationToken: "ink_ripple_red",
    severityFloor: 0.5
  }),
  local_docket: Object.freeze({
    kind: "legal_docket",
    label: "案牍",
    animationToken: "ink_ripple_black",
    severityFloor: 0.35
  }),
  official_posting: Object.freeze({
    kind: "office_attention",
    label: "任所",
    animationToken: "ink_seal_pulse",
    severityFloor: 0.3
  }),
  official_transfer: Object.freeze({
    kind: "office_transfer",
    label: "迁转",
    animationToken: "ink_seal_pulse",
    severityFloor: 0.35
  }),
  exam_travel: Object.freeze({
    kind: "exam_travel",
    label: "科期",
    animationToken: "ink_ripple_blue",
    severityFloor: 0.35
  }),
  domain_city_policy: Object.freeze({
    kind: "domain_city_policy",
    label: "政策余波",
    animationToken: "ink_ripple_ochre",
    severityFloor: 0.42
  }),
  domain_military_diplomacy: Object.freeze({
    kind: "domain_military_consequence",
    label: "军务余波",
    animationToken: "ink_ripple_red",
    severityFloor: 0.55
  }),
  domain_judicial_case: Object.freeze({
    kind: "domain_judicial_consequence",
    label: "刑名余波",
    animationToken: "ink_ripple_black",
    severityFloor: 0.4
  }),
  domain_npc_economy: Object.freeze({
    kind: "domain_npc_economy",
    label: "人物经济",
    animationToken: "ink_ripple_ochre",
    severityFloor: 0.35
  })
});

const MAP_RUNTIME_HIDDEN_NOTICE =
  "mapRuntimeView 只含服务器安全投影与显示布局；不含原始坐标表、未公开敌情、模型原文、本地路径或密钥。";

module.exports = {
  MAP_RUNTIME_ASSET_SET_ID,
  MAP_RUNTIME_BOUNDS,
  MAP_RUNTIME_EVENT_EFFECTS,
  MAP_RUNTIME_HIDDEN_NOTICE,
  MAP_RUNTIME_LABEL_ANCHORS,
  MAP_RUNTIME_LAYERS,
  MAP_RUNTIME_LAYER_IDS,
  MAP_RUNTIME_LAYOUT_VERSION,
  MAP_RUNTIME_LIMITS,
  MAP_RUNTIME_ROUTE_STYLE_TOKENS,
  MAP_RUNTIME_SCHEMA_VERSION,
  MAP_RUNTIME_STYLE_TOKENS
};
