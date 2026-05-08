const { getDefaultWorldGeographySeed } = require("./worldGeographySeeds");
const { WORLD_GEOGRAPHY_DEEP_CONFIG } = require("./worldGeographyConfig");

const WORLD_GEOGRAPHY_SCHEMA_VERSION = 1;
const MAX_COUNTRIES = 24;
const MAX_REGIONS = 32;
const MAX_CITIES = 64;
const MAX_ROUTES = 32;
const MAX_FRONTIER_ZONES = 24;
const MAX_OFFICE_JURISDICTIONS = 32;
const MAX_RECENT_NOTES = 8;
const MAX_TEXT_LENGTH = 180;
const MAX_DEEP_TAGS = WORLD_GEOGRAPHY_DEEP_CONFIG.maxDeepTags;
const COUNTRY_DEEP_METRIC_DEFAULTS = WORLD_GEOGRAPHY_DEEP_CONFIG.countryMetricDefaults;
const CITY_DEEP_METRIC_DEFAULTS = WORLD_GEOGRAPHY_DEEP_CONFIG.cityMetricDefaults;
const COUNTRY_DEEP_METRIC_KEYS = WORLD_GEOGRAPHY_DEEP_CONFIG.countryMetricKeys;
const CITY_DEEP_METRIC_KEYS = WORLD_GEOGRAPHY_DEEP_CONFIG.cityMetricKeys;
const CITY_DEEP_DYNAMIC_WEIGHTS = WORLD_GEOGRAPHY_DEEP_CONFIG.cityDynamicWeights;

const VISIBILITY_VALUES = new Set(["public", "role_visible", "rumor", "hidden"]);
const STATUS_VALUES = new Set(["stable", "strained", "critical", "unknown"]);
const ROUTE_STATUS_VALUES = new Set(["open", "strained", "risky", "unknown"]);
const FRONTIER_STATUSES = new Set(["quiet", "open", "tense", "contested"]);

const STATUS_LABELS = {
  stable: "暂稳",
  strained: "吃紧",
  critical: "急重",
  unknown: "未详"
};

const ROUTE_STATUS_LABELS = {
  open: "通行",
  strained: "阻滞",
  risky: "险急",
  unknown: "未详"
};

const FRONTIER_STATUS_LABELS = {
  quiet: "暂静",
  open: "互市",
  tense: "紧张",
  contested: "争持"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return /^[a-z0-9][a-z0-9_-]*$/i.test(text) ? text : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
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

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
}

function hasStrategicTag(row, pattern) {
  return (Array.isArray(row?.strategicTags) ? row.strategicTags : [])
    .some((tag) => pattern.test(String(tag)));
}

function normalizeDeepMetrics(source, base, keys, defaults) {
  return keys.reduce((result, key) => {
    result[key] = clampMetric(source?.[key] ?? base?.[key], defaults[key]);
    return result;
  }, {});
}

function blendDynamicMetric(staticValue, dynamicValue, weight, fallback = 50) {
  const staticMetric = clampMetric(staticValue, fallback);
  const dynamicMetric = clampMetric(dynamicValue, fallback);
  return clampMetric(Math.round(staticMetric * (1 - weight) + dynamicMetric * weight), staticMetric);
}

function countryDeepSnapshot(seedCountry = {}, worldState = {}, countryCore = {}) {
  const publicOrder = readWorldNumber(worldState, "publicOrder", 70);
  const corruption = readWorldNumber(worldState, "corruption", 60);
  const borderThreat = readWorldNumber(worldState, "borderThreat", 40);
  const treasury = readWorldNumber(worldState, "treasury", 1000);
  const armyMorale = readWorldNumber(worldState, "armyMorale", 65);
  const taxRate = readWorldNumber(worldState, "taxRate", 30);
  const base = normalizeDeepMetrics(seedCountry, {}, COUNTRY_DEEP_METRIC_KEYS, COUNTRY_DEEP_METRIC_DEFAULTS);

  if (seedCountry.kind === "player_realm") {
    return {
      fiscalPressure: clampMetric(Math.max(corruption * 0.65, taxRate * 1.4, treasury < 600 ? 72 : 34), 45),
      militaryReadiness: clampMetric(armyMorale * 0.65 + (100 - borderThreat) * 0.35, 55),
      nationalPrestige: clampMetric((countryCore.stability || 55) * 0.55 + publicOrder * 0.25 + (100 - borderThreat) * 0.2, 55),
      legitimacy: clampMetric(publicOrder * 0.6 + (100 - corruption) * 0.4, 55),
      successionRisk: clampMetric(Math.max(24, (countryCore.pressure || 40) * 0.4 + corruption * 0.25), 35),
      diplomaticTension: clampMetric(borderThreat, 40),
      tributeTradeActivity: clampMetric(55 - Math.max(0, borderThreat - 55) * 0.35, 48),
      intelligenceReliability: 92
    };
  }

  return {
    ...base,
    diplomaticTension: clampMetric(seedCountry.diplomaticTension, Math.max(base.diplomaticTension, borderThreat)),
    intelligenceReliability: clampMetric(
      seedCountry.intelligenceReliability,
      clampNumber(seedCountry.intelConfidence, 0, 100, base.intelligenceReliability)
    )
  };
}

function cityDeepSnapshot(seedCity = {}, worldState = {}, cityCore = {}, options = {}) {
  const taxRate = readWorldNumber(worldState, "taxRate", 30);
  const publicOrder = readWorldNumber(worldState, "publicOrder", 70);
  const corruption = readWorldNumber(worldState, "corruption", 60);
  const borderThreat = readWorldNumber(worldState, "borderThreat", 40);
  const armyMorale = readWorldNumber(worldState, "armyMorale", 65);
  const grainReserve = readWorldNumber(worldState, "grainReserve", 800);
  const population = Math.max(1, readWorldNumber(worldState, "population", 5000));
  const grainRatio = grainReserve / population;
  const base = normalizeDeepMetrics(seedCity, {}, CITY_DEEP_METRIC_KEYS, CITY_DEEP_METRIC_DEFAULTS);
  const isCapital = /capital/.test(seedCity.jurisdictionLevel || "");
  const isFrontier = /frontier|pass|garrison/.test(seedCity.jurisdictionLevel || "") || hasStrategicTag(seedCity, /边|军|关|防/);
  const isScholarCity = hasStrategicTag(seedCity, /书院|贡院|科举|文社/);
  const isTradeCity = hasStrategicTag(seedCity, /商|漕|海道|海舶|互市|贡道/);
  const dynamicWeight = Number.isFinite(Number(options.dynamicWeightOverride))
    ? Number(options.dynamicWeightOverride)
    : seedCity.countryId === "country-ming"
    ? CITY_DEEP_DYNAMIC_WEIGHTS.playerRealm
    : CITY_DEEP_DYNAMIC_WEIGHTS.foreignRealm;
  const grainPressure = clampMetric(cityCore.grainStress ?? (grainRatio < 0.05 ? 88 : grainRatio < 0.1 ? 62 : 35), 35);
  const taxPressure = clampMetric(taxRate * 1.35 + corruption * 0.2, 40);
  const orderPressure = clampMetric(100 - publicOrder, 30);
  const militaryReadiness = clampMetric(armyMorale * 0.7 + (100 - borderThreat) * 0.3, 55);

  return {
    ...base,
    populationScale: clampMetric(seedCity.populationScale, isCapital ? 86 : base.populationScale),
    taxBase: blendDynamicMetric(
      seedCity.taxBase,
      100 - taxPressure,
      dynamicWeight,
      isTradeCity ? Math.max(base.taxBase, 68) : base.taxBase
    ),
    grainStock: blendDynamicMetric(seedCity.grainStock, 100 - grainPressure, dynamicWeight, 100 - grainPressure),
    marketPriceStress: blendDynamicMetric(seedCity.marketPriceStress, Math.max(grainPressure, taxRate), dynamicWeight, Math.max(grainPressure, taxRate)),
    gentryInfluence: blendDynamicMetric(seedCity.gentryInfluence, corruption * 0.55 + taxRate * 0.45, dynamicWeight, isScholarCity ? Math.max(base.gentryInfluence, 72) : base.gentryInfluence),
    lawsuitPressure: blendDynamicMetric(seedCity.lawsuitPressure, Math.max(orderPressure, taxPressure), dynamicWeight, base.lawsuitPressure),
    corveeBurden: blendDynamicMetric(seedCity.corveeBurden, Math.max(taxRate, corruption * 0.55), dynamicWeight, base.corveeBurden),
    waterworksIntegrity: blendDynamicMetric(
      seedCity.waterworksIntegrity,
      100 - Math.max(grainPressure, corruption * 0.45),
      dynamicWeight,
      /河|运河|水|江|湖/.test(seedCity.riverOrCoast || "") ? Math.max(base.waterworksIntegrity, 58) : base.waterworksIntegrity
    ),
    disasterRisk: blendDynamicMetric(seedCity.disasterRisk, Math.max(grainPressure, orderPressure), dynamicWeight, Math.max(base.disasterRisk, grainPressure - 12)),
    trafficLoad: clampMetric(seedCity.trafficLoad, isTradeCity || isCapital ? Math.max(base.trafficLoad, 70) : base.trafficLoad),
    garrisonStrength: blendDynamicMetric(
      seedCity.garrisonStrength,
      militaryReadiness,
      isFrontier && dynamicWeight > 0 ? CITY_DEEP_DYNAMIC_WEIGHTS.garrisonStress : dynamicWeight,
      isFrontier ? Math.max(base.garrisonStrength, 75) : base.garrisonStrength
    ),
    academyLevel: clampMetric(seedCity.academyLevel, isScholarCity ? Math.max(base.academyLevel, 78) : base.academyLevel)
  };
}

function normalizeVisibility(value, fallback = "public") {
  return VISIBILITY_VALUES.has(value) ? value : fallback;
}

function normalizeStringList(value, limit = 8, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const text = cleanText(entry, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeIdList(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const id = cleanId(entry, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeRecentNotes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((note) => cleanText(note, "", MAX_TEXT_LENGTH))
    .filter(Boolean)
    .slice(-MAX_RECENT_NOTES);
}

function statusFromPressure(pressure, stability = 60) {
  if (pressure >= 78 || stability <= 22) return "critical";
  if (pressure >= 55 || stability <= 42) return "strained";
  return "stable";
}

function countrySnapshot(seedCountry = {}, worldState = {}) {
  if (seedCountry.kind === "player_realm") {
    const publicOrder = readWorldNumber(worldState, "publicOrder", 70);
    const corruption = readWorldNumber(worldState, "corruption", 60);
    const borderThreat = readWorldNumber(worldState, "borderThreat", 40);
    const treasury = readWorldNumber(worldState, "treasury", 1000);
    const pressure = clampMetric(
      Math.max(100 - publicOrder, corruption * 0.75, borderThreat * 0.85, treasury < 500 ? 70 : 35),
      45
    );
    const stability = clampMetric(publicOrder * 0.6 + (100 - corruption) * 0.25 + (100 - borderThreat) * 0.15, 55);
    return { pressure, stability, status: statusFromPressure(pressure, stability) };
  }

  const basePressure = seedCountry.kind === "neighbor"
    ? readWorldNumber(worldState, "borderThreat", 40)
    : seedCountry.kind === "frontier_polity"
      ? Math.round(readWorldNumber(worldState, "borderThreat", 40) * 0.8)
      : 32;
  const intelPenalty = Math.max(0, 70 - clampNumber(seedCountry.intelConfidence, 0, 100, 40));
  const pressure = clampMetric(basePressure + intelPenalty * 0.18, basePressure);
  const stability = clampMetric(82 - pressure * 0.35, 60);
  return { pressure, stability, status: statusFromPressure(pressure, stability) };
}

function citySnapshot(seedCity = {}, worldState = {}) {
  const localOrder = readPlayerNumber(worldState, "localOrder", readWorldNumber(worldState, "publicOrder", 70));
  const publicOrder = readWorldNumber(worldState, "publicOrder", 70);
  const taxRate = readWorldNumber(worldState, "taxRate", 30);
  const grainReserve = readWorldNumber(worldState, "grainReserve", 800);
  const population = Math.max(1, readWorldNumber(worldState, "population", 5000));
  const grainRatio = grainReserve / population;
  const grainStress = grainRatio < 0.05 ? 88 : grainRatio < 0.1 ? 62 : 35;
  const baseOrder = seedCity.countryId === "country-ming" ? Math.round((localOrder + publicOrder) / 2) : 55;
  const pressure = clampMetric(Math.max(100 - baseOrder, Math.max(0, taxRate - 35) * 1.5, grainStress), 40);
  const stability = clampMetric(baseOrder - Math.max(0, taxRate - 35) * 0.4, baseOrder);
  return {
    pressure,
    stability,
    status: statusFromPressure(pressure, stability),
    localOrder: clampMetric(baseOrder, 55),
    taxBurden: clampMetric(taxRate, 30),
    grainStress: clampMetric(grainStress, 35)
  };
}

function routeSnapshot(seedRoute = {}, worldState = {}) {
  const borderThreat = readWorldNumber(worldState, "borderThreat", 40);
  const grainStress = readWorldNumber(worldState, "grainReserve", 800) < 450 ? 70 : 35;
  const corruption = readWorldNumber(worldState, "corruption", 60);
  const routeRisk = seedRoute.type === "pass"
    ? borderThreat
    : seedRoute.type === "canal" || seedRoute.type === "river"
      ? Math.max(grainStress, corruption * 0.55)
      : Math.max(28, corruption * 0.35);
  const risk = clampMetric(routeRisk, 35);
  const status = risk >= 76 ? "risky" : risk >= 55 ? "strained" : "open";
  return { risk, status };
}

function frontierSnapshot(seedFrontier = {}, worldState = {}) {
  const worldValue = readWorldNumber(worldState, seedFrontier.pressureMetric, readWorldNumber(worldState, "borderThreat", 40));
  const seedBase = seedFrontier.status === "contested" ? 68 : seedFrontier.status === "tense" ? 58 : 35;
  const pressure = clampMetric(Math.max(seedBase, worldValue), seedBase);
  let status = seedFrontier.status;
  if (pressure >= 82) status = "contested";
  else if (pressure >= 62 && status === "quiet") status = "tense";
  return {
    pressure,
    status: FRONTIER_STATUSES.has(status) ? status : "open"
  };
}

function jurisdictionSnapshot(seedJurisdiction = {}, worldState = {}) {
  const role = worldState.player?.role || "scholar";
  const officialBureau = worldState.officialCareer?.bureauId || "";
  const roleBoost = role !== "scholar" && seedJurisdiction.visibility === "role_visible" ? 18 : 0;
  const bureauBoost = officialBureau && officialBureau === seedJurisdiction.bureauId ? 28 : 0;
  const localBoost = role === "magistrate" && seedJurisdiction.officeTrack === "local" ? 22 : 0;
  return {
    priority: clampMetric(36 + roleBoost + bureauBoost + localBoost, 36)
  };
}

function mergeRows(seedRows, sourceRows) {
  const byId = new Map(
    (Array.isArray(sourceRows) ? sourceRows : [])
      .filter(isPlainObject)
      .map((row) => [cleanId(row.id, ""), row])
      .filter(([id]) => Boolean(id))
  );
  const rows = [];
  const usedIds = new Set();

  for (const seedRow of seedRows) {
    rows.push({ seedRow, raw: byId.get(seedRow.id) || {} });
    usedIds.add(seedRow.id);
  }

  for (const raw of Array.isArray(sourceRows) ? sourceRows : []) {
    const id = cleanId(raw?.id, "");
    if (!id || usedIds.has(id)) continue;
    rows.push({ seedRow: null, raw });
    usedIds.add(id);
  }

  return rows;
}

function normalizeCountryInstance(raw, seedCountry = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedCountry || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 60);
  if (!id || !name) return null;
  const snapshot = countrySnapshot({ ...base, ...source, id, name }, worldState);
  const deepSnapshot = countryDeepSnapshot({ ...base, ...source, id, name }, worldState, snapshot);
  const useSeedSnapshot = Boolean(seedCountry);
  const status = useSeedSnapshot || !STATUS_VALUES.has(source.status) ? snapshot.status : source.status;
  const deepMetrics = useSeedSnapshot
    ? deepSnapshot
    : normalizeDeepMetrics(source, base, COUNTRY_DEEP_METRIC_KEYS, deepSnapshot);

  return {
    id,
    kind: cleanText(source.kind || base.kind, "neighbor", 40),
    name,
    shortName: cleanText(source.shortName || base.shortName, name, 24),
    polityType: cleanText(source.polityType || base.polityType, "polity", 48),
    rulerTitle: cleanText(source.rulerTitle || base.rulerTitle, "未明君主", 32),
    capitalCityId: cleanId(source.capitalCityId || base.capitalCityId, ""),
    cultureTags: normalizeStringList(source.cultureTags || base.cultureTags, 8),
    governmentTags: normalizeStringList(source.governmentTags || base.governmentTags, 8),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    intelConfidence: clampNumber(source.intelConfidence, 0, 100, clampNumber(base.intelConfidence, 0, 100, 50)),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例国家。`),
    policyPressureTags: normalizeStringList(source.policyPressureTags || base.policyPressureTags, MAX_DEEP_TAGS),
    diplomaticPosture: cleanText(source.diplomaticPosture || base.diplomaticPosture, "外交态势未详。", WORLD_GEOGRAPHY_DEEP_CONFIG.countryTextLimits.diplomaticPosture),
    intelligenceSummary: cleanText(source.intelligenceSummary || base.intelligenceSummary, "只见公开奏报与传闻摘要。", WORLD_GEOGRAPHY_DEEP_CONFIG.countryTextLimits.intelligenceSummary),
    ...deepMetrics,
    status,
    statusLabel: STATUS_LABELS[status],
    pressure: useSeedSnapshot ? snapshot.pressure : clampMetric(source.pressure, snapshot.pressure),
    stability: useSeedSnapshot ? snapshot.stability : clampMetric(source.stability, snapshot.stability),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeRegionInstance(raw, seedRegion = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedRegion || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 60);
  if (!id || !name) return null;
  const useSeedSnapshot = Boolean(seedRegion);

  return {
    id,
    countryId: cleanId(source.countryId || base.countryId, ""),
    name,
    level: cleanText(source.level || base.level, "region", 48),
    seatCityId: cleanId(source.seatCityId || base.seatCityId, ""),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例区划。`),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeCityInstance(raw, seedCity = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedCity || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 60);
  if (!id || !name) return null;
  const useSeedSnapshot = Boolean(seedCity);
  const snapshot = citySnapshot({ ...base, ...source, id, name }, worldState);
  const deepSnapshotSource = useSeedSnapshot ? { ...base, id, name } : { ...base, ...source, id, name };
  const deepSnapshot = cityDeepSnapshot(deepSnapshotSource, worldState, snapshot);
  const status = useSeedSnapshot || !STATUS_VALUES.has(source.status) ? snapshot.status : source.status;
  const deepMetrics = useSeedSnapshot
    ? deepSnapshot
    : normalizeDeepMetrics(source, base, CITY_DEEP_METRIC_KEYS, deepSnapshot);

  return {
    id,
    countryId: cleanId(source.countryId || base.countryId, ""),
    regionId: cleanId(source.regionId || base.regionId, ""),
    name,
    jurisdictionLevel: cleanText(source.jurisdictionLevel || base.jurisdictionLevel, "city", 48),
    terrain: cleanText(source.terrain || base.terrain, "未明地势", 48),
    riverOrCoast: cleanText(source.riverOrCoast || base.riverOrCoast, "", 48),
    strategicTags: normalizeStringList(source.strategicTags || base.strategicTags, 8),
    supervisingBureauIds: normalizeIdList(source.supervisingBureauIds || base.supervisingBureauIds, 8),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    intelConfidence: clampNumber(source.intelConfidence, 0, 100, clampNumber(base.intelConfidence, 0, 100, 55)),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例城市。`),
    localIssueTags: normalizeStringList(source.localIssueTags || base.localIssueTags, MAX_DEEP_TAGS),
    cityIntelligenceSummary: cleanText(source.cityIntelligenceSummary || base.cityIntelligenceSummary, "城市奏报只含可见指标。", WORLD_GEOGRAPHY_DEEP_CONFIG.cityTextLimits.cityIntelligenceSummary),
    ...deepMetrics,
    status,
    statusLabel: STATUS_LABELS[status],
    pressure: useSeedSnapshot ? snapshot.pressure : clampMetric(source.pressure, snapshot.pressure),
    stability: useSeedSnapshot ? snapshot.stability : clampMetric(source.stability, snapshot.stability),
    localOrder: useSeedSnapshot ? snapshot.localOrder : clampMetric(source.localOrder, snapshot.localOrder),
    taxBurden: useSeedSnapshot ? snapshot.taxBurden : clampMetric(source.taxBurden, snapshot.taxBurden),
    grainStress: useSeedSnapshot ? snapshot.grainStress : clampMetric(source.grainStress, snapshot.grainStress),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeRouteInstance(raw, seedRoute = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedRoute || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 80);
  if (!id || !name) return null;
  const snapshot = routeSnapshot({ ...base, ...source, id, name }, worldState);
  const useSeedSnapshot = Boolean(seedRoute);
  const status = useSeedSnapshot || !ROUTE_STATUS_VALUES.has(source.status) ? snapshot.status : source.status;

  return {
    id,
    type: cleanText(source.type || base.type, "road", 32),
    name,
    fromCityId: cleanId(source.fromCityId || base.fromCityId, ""),
    toCityId: cleanId(source.toCityId || base.toCityId, ""),
    viaCityIds: normalizeIdList(source.viaCityIds || base.viaCityIds, 8),
    distanceLabel: cleanText(source.distanceLabel || base.distanceLabel, "路程未详", 40),
    seasonalRisk: cleanText(source.seasonalRisk || base.seasonalRisk, "随时令有通行风险。"),
    strategicTags: normalizeStringList(source.strategicTags || base.strategicTags, 8),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例路线。`),
    status,
    statusLabel: ROUTE_STATUS_LABELS[status],
    risk: useSeedSnapshot ? snapshot.risk : clampMetric(source.risk, snapshot.risk),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeFrontierZoneInstance(raw, seedFrontier = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedFrontier || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 80);
  if (!id || !name) return null;
  const snapshot = frontierSnapshot({ ...base, ...source, id, name }, worldState);
  const useSeedSnapshot = Boolean(seedFrontier);
  const status = useSeedSnapshot || !FRONTIER_STATUSES.has(source.status) ? snapshot.status : source.status;

  return {
    id,
    name,
    countryId: cleanId(source.countryId || base.countryId, ""),
    neighborCountryId: cleanId(source.neighborCountryId || base.neighborCountryId, ""),
    cityIds: normalizeIdList(source.cityIds || base.cityIds, 8),
    routeIds: normalizeIdList(source.routeIds || base.routeIds, 8),
    status,
    statusLabel: FRONTIER_STATUS_LABELS[status],
    pressureMetric: cleanText(source.pressureMetric || base.pressureMetric, "borderThreat", 48),
    pressure: useSeedSnapshot ? snapshot.pressure : clampMetric(source.pressure, snapshot.pressure),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例边面。`),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeOfficeJurisdictionInstance(raw, seedJurisdiction = null, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const base = seedJurisdiction || {};
  const id = cleanId(source.id || base.id, "");
  const name = cleanText(source.name || base.name, "", 80);
  if (!id || !name) return null;
  const snapshot = jurisdictionSnapshot({ ...base, ...source, id, name }, worldState);
  const useSeedSnapshot = Boolean(seedJurisdiction);

  return {
    id,
    bureauId: cleanId(source.bureauId || base.bureauId, ""),
    name,
    scope: cleanText(source.scope || base.scope, "local", 48),
    countryIds: normalizeIdList(source.countryIds || base.countryIds, 8),
    cityIds: normalizeIdList(source.cityIds || base.cityIds, 16),
    routeIds: normalizeIdList(source.routeIds || base.routeIds, 8),
    frontierZoneIds: normalizeIdList(source.frontierZoneIds || base.frontierZoneIds, 8),
    officeTrack: cleanText(source.officeTrack || base.officeTrack, "local", 48),
    visibility: normalizeVisibility(source.visibility, normalizeVisibility(base.visibility, "public")),
    priority: useSeedSnapshot ? snapshot.priority : clampMetric(source.priority, snapshot.priority),
    publicSummary: cleanText(source.publicSummary || base.publicSummary, `${name}为天下地理实例官署辖区。`),
    lastUpdatedTurn: useSeedSnapshot
      ? currentTurn(worldState)
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    hiddenNotes: normalizeStringList(source.hiddenNotes || base.hiddenNotes, 6)
  };
}

function normalizeRows(seedRows, sourceRows, normalizer, limit, worldState) {
  return mergeRows(seedRows, sourceRows)
    .map(({ seedRow, raw }) => normalizer({ ...seedRow, ...raw }, seedRow, worldState))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeWorldGeographyState(worldState = {}) {
  const seed = getDefaultWorldGeographySeed();
  const source = isPlainObject(worldState.worldGeography) ? worldState.worldGeography : {};

  return {
    schemaVersion: WORLD_GEOGRAPHY_SCHEMA_VERSION,
    seedId: cleanId(source.seedId, seed.seedId),
    label: cleanText(source.label, seed.label, 80),
    generatedAtTurn: clampNumber(source.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    countries: normalizeRows(seed.countries, source.countries, normalizeCountryInstance, MAX_COUNTRIES, worldState),
    regions: normalizeRows(seed.regions, source.regions, normalizeRegionInstance, MAX_REGIONS, worldState),
    cities: normalizeRows(seed.cities, source.cities, normalizeCityInstance, MAX_CITIES, worldState),
    routes: normalizeRows(seed.routes, source.routes, normalizeRouteInstance, MAX_ROUTES, worldState),
    frontierZones: normalizeRows(seed.frontierZones, source.frontierZones, normalizeFrontierZoneInstance, MAX_FRONTIER_ZONES, worldState),
    officeJurisdictions: normalizeRows(seed.officeJurisdictions, source.officeJurisdictions, normalizeOfficeJurisdictionInstance, MAX_OFFICE_JURISDICTIONS, worldState),
    recentNotes: normalizeRecentNotes(source.recentNotes)
  };
}

function createInitialWorldGeographyState(worldState = {}) {
  return normalizeWorldGeographyState({
    ...worldState,
    worldGeography: {
      schemaVersion: WORLD_GEOGRAPHY_SCHEMA_VERSION
    }
  });
}

function ensureWorldGeographyState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.worldGeography = normalizeWorldGeographyState(worldState);
  return worldState;
}

function canSeeRow(row, worldState = {}) {
  if (!row || row.visibility === "hidden") return false;
  if (row.visibility !== "role_visible") return true;
  return worldState.player?.role && worldState.player.role !== "scholar";
}

function filterVisibleIds(values, visibleIds) {
  return values.filter((id) => visibleIds.has(id));
}

function nullableVisibleId(id, visibleIds) {
  return visibleIds.has(id) ? id : null;
}

function viewCountry(country, visibleCityIds) {
  return {
    id: country.id,
    kind: country.kind,
    name: country.name,
    shortName: country.shortName,
    polityType: country.polityType,
    rulerTitle: country.rulerTitle,
    capitalCityId: nullableVisibleId(country.capitalCityId, visibleCityIds),
    cultureTags: country.cultureTags,
    governmentTags: country.governmentTags,
    visibility: country.visibility,
    intelConfidence: country.intelConfidence,
    publicSummary: country.publicSummary,
    policyPressureTags: country.policyPressureTags,
    diplomaticPosture: country.diplomaticPosture,
    intelligenceSummary: country.intelligenceSummary,
    fiscalPressure: country.fiscalPressure,
    militaryReadiness: country.militaryReadiness,
    nationalPrestige: country.nationalPrestige,
    legitimacy: country.legitimacy,
    successionRisk: country.successionRisk,
    diplomaticTension: country.diplomaticTension,
    tributeTradeActivity: country.tributeTradeActivity,
    intelligenceReliability: country.intelligenceReliability,
    status: country.status,
    statusLabel: country.statusLabel,
    pressure: country.pressure,
    stability: country.stability,
    lastUpdatedTurn: country.lastUpdatedTurn
  };
}

function viewRegion(region, visibleCityIds) {
  return {
    id: region.id,
    countryId: region.countryId,
    name: region.name,
    level: region.level,
    seatCityId: nullableVisibleId(region.seatCityId, visibleCityIds),
    visibility: region.visibility,
    publicSummary: region.publicSummary,
    lastUpdatedTurn: region.lastUpdatedTurn
  };
}

function viewCity(city) {
  return {
    id: city.id,
    countryId: city.countryId,
    regionId: city.regionId,
    name: city.name,
    jurisdictionLevel: city.jurisdictionLevel,
    terrain: city.terrain,
    riverOrCoast: city.riverOrCoast,
    strategicTags: city.strategicTags,
    supervisingBureauIds: city.supervisingBureauIds,
    visibility: city.visibility,
    intelConfidence: city.intelConfidence,
    publicSummary: city.publicSummary,
    localIssueTags: city.localIssueTags,
    cityIntelligenceSummary: city.cityIntelligenceSummary,
    populationScale: city.populationScale,
    taxBase: city.taxBase,
    grainStock: city.grainStock,
    marketPriceStress: city.marketPriceStress,
    gentryInfluence: city.gentryInfluence,
    lawsuitPressure: city.lawsuitPressure,
    corveeBurden: city.corveeBurden,
    waterworksIntegrity: city.waterworksIntegrity,
    disasterRisk: city.disasterRisk,
    trafficLoad: city.trafficLoad,
    garrisonStrength: city.garrisonStrength,
    academyLevel: city.academyLevel,
    status: city.status,
    statusLabel: city.statusLabel,
    pressure: city.pressure,
    stability: city.stability,
    localOrder: city.localOrder,
    taxBurden: city.taxBurden,
    grainStress: city.grainStress,
    lastUpdatedTurn: city.lastUpdatedTurn
  };
}

function viewRoute(route, visibleCityIds) {
  return {
    id: route.id,
    type: route.type,
    name: route.name,
    fromCityId: route.fromCityId,
    toCityId: route.toCityId,
    viaCityIds: filterVisibleIds(route.viaCityIds, visibleCityIds),
    distanceLabel: route.distanceLabel,
    seasonalRisk: route.seasonalRisk,
    strategicTags: route.strategicTags,
    visibility: route.visibility,
    publicSummary: route.publicSummary,
    status: route.status,
    statusLabel: route.statusLabel,
    risk: route.risk,
    lastUpdatedTurn: route.lastUpdatedTurn
  };
}

function viewFrontierZone(frontier, visibleCityIds, visibleRouteIds) {
  return {
    id: frontier.id,
    name: frontier.name,
    countryId: frontier.countryId,
    neighborCountryId: frontier.neighborCountryId,
    cityIds: filterVisibleIds(frontier.cityIds, visibleCityIds),
    routeIds: filterVisibleIds(frontier.routeIds, visibleRouteIds),
    status: frontier.status,
    statusLabel: frontier.statusLabel,
    pressureMetric: frontier.pressureMetric,
    pressure: frontier.pressure,
    visibility: frontier.visibility,
    publicSummary: frontier.publicSummary,
    lastUpdatedTurn: frontier.lastUpdatedTurn
  };
}

function viewOfficeJurisdiction(jurisdiction, visibleCountryIds, visibleCityIds, visibleRouteIds, visibleFrontierIds) {
  return {
    id: jurisdiction.id,
    bureauId: jurisdiction.bureauId,
    name: jurisdiction.name,
    scope: jurisdiction.scope,
    countryIds: filterVisibleIds(jurisdiction.countryIds, visibleCountryIds),
    cityIds: filterVisibleIds(jurisdiction.cityIds, visibleCityIds),
    routeIds: filterVisibleIds(jurisdiction.routeIds, visibleRouteIds),
    frontierZoneIds: filterVisibleIds(jurisdiction.frontierZoneIds, visibleFrontierIds),
    officeTrack: jurisdiction.officeTrack,
    visibility: jurisdiction.visibility,
    priority: jurisdiction.priority,
    publicSummary: jurisdiction.publicSummary,
    lastUpdatedTurn: jurisdiction.lastUpdatedTurn
  };
}

function comparePressure(first, second) {
  const firstScore = Math.max(first.pressure || 0, first.risk || 0, 100 - (first.stability || 100));
  const secondScore = Math.max(second.pressure || 0, second.risk || 0, 100 - (second.stability || 100));
  if (secondScore !== firstScore) return secondScore - firstScore;
  return first.id.localeCompare(second.id);
}

function buildWorldGeographyView(worldState = {}) {
  const state = normalizeWorldGeographyState(worldState);
  const visibleCountries = state.countries.filter((country) => canSeeRow(country, worldState));
  const visibleCountryIds = new Set(visibleCountries.map((country) => country.id));
  const visibleRegions = state.regions
    .filter((region) => canSeeRow(region, worldState) && visibleCountryIds.has(region.countryId));
  const visibleRegionIds = new Set(visibleRegions.map((region) => region.id));
  const visibleCities = state.cities
    .filter((city) =>
      canSeeRow(city, worldState) &&
      visibleCountryIds.has(city.countryId) &&
      visibleRegionIds.has(city.regionId)
    );
  const visibleCityIds = new Set(visibleCities.map((city) => city.id));
  const visibleRoutes = state.routes
    .filter((route) =>
      canSeeRow(route, worldState) &&
      visibleCityIds.has(route.fromCityId) &&
      visibleCityIds.has(route.toCityId)
    );
  const visibleRouteIds = new Set(visibleRoutes.map((route) => route.id));
  const visibleFrontiers = state.frontierZones
    .filter((frontier) =>
      canSeeRow(frontier, worldState) &&
      visibleCountryIds.has(frontier.countryId) &&
      visibleCountryIds.has(frontier.neighborCountryId)
    );
  const visibleFrontierIds = new Set(visibleFrontiers.map((frontier) => frontier.id));
  const visibleJurisdictions = state.officeJurisdictions.filter((jurisdiction) => canSeeRow(jurisdiction, worldState));

  const countries = visibleCountries.map((country) => viewCountry(country, visibleCityIds));
  const regions = visibleRegions.map((region) => viewRegion(region, visibleCityIds));
  const cities = visibleCities.map(viewCity);
  const routes = visibleRoutes.map((route) => viewRoute(route, visibleCityIds));
  const frontierZones = visibleFrontiers.map((frontier) =>
    viewFrontierZone(frontier, visibleCityIds, visibleRouteIds)
  );
  const officeJurisdictions = visibleJurisdictions.map((jurisdiction) =>
    viewOfficeJurisdiction(jurisdiction, visibleCountryIds, visibleCityIds, visibleRouteIds, visibleFrontierIds)
  );

  return {
    schemaVersion: WORLD_GEOGRAPHY_SCHEMA_VERSION,
    seedId: state.seedId,
    label: state.label,
    generatedAtTurn: currentTurn(worldState),
    countries,
    regions,
    cities,
    routes,
    frontierZones,
    officeJurisdictions,
    highlights: {
      countries: countries.slice().sort(comparePressure).slice(0, 4),
      cities: cities.slice().sort(comparePressure).slice(0, 6),
      routes: routes.slice().sort(comparePressure).slice(0, 4),
      frontierZones: frontierZones.slice().sort(comparePressure).slice(0, 4)
    }
  };
}

function summarizeWorldGeographyForPrompt(worldState = {}) {
  const view = buildWorldGeographyView(worldState);
  const bureauId = worldState.officialCareer?.bureauId || "";
  const jurisdictions = view.officeJurisdictions
    .slice()
    .sort((first, second) => {
      const firstBoost = first.bureauId === bureauId ? 100 : 0;
      const secondBoost = second.bureauId === bureauId ? 100 : 0;
      if (second.priority + secondBoost !== first.priority + firstBoost) {
        return second.priority + secondBoost - (first.priority + firstBoost);
      }
      return first.id.localeCompare(second.id);
    })
    .slice(0, 4);

  return {
    seedId: view.seedId,
    generatedAtTurn: view.generatedAtTurn,
    countries: view.highlights.countries.map((country) => ({
      id: country.id,
      name: country.name,
      kind: country.kind,
      statusLabel: country.statusLabel,
      pressure: country.pressure,
      stability: country.stability,
      intelConfidence: country.intelConfidence,
      fiscalPressure: country.fiscalPressure,
      militaryReadiness: country.militaryReadiness,
      nationalPrestige: country.nationalPrestige,
      legitimacy: country.legitimacy,
      successionRisk: country.successionRisk,
      diplomaticTension: country.diplomaticTension,
      tributeTradeActivity: country.tributeTradeActivity,
      intelligenceReliability: country.intelligenceReliability,
      policyPressureTags: country.policyPressureTags,
      diplomaticPosture: country.diplomaticPosture,
      intelligenceSummary: country.intelligenceSummary,
      publicSummary: country.publicSummary
    })),
    cities: view.highlights.cities.map((city) => ({
      id: city.id,
      name: city.name,
      countryId: city.countryId,
      jurisdictionLevel: city.jurisdictionLevel,
      statusLabel: city.statusLabel,
      pressure: city.pressure,
      localOrder: city.localOrder,
      grainStress: city.grainStress,
      populationScale: city.populationScale,
      taxBase: city.taxBase,
      grainStock: city.grainStock,
      marketPriceStress: city.marketPriceStress,
      gentryInfluence: city.gentryInfluence,
      lawsuitPressure: city.lawsuitPressure,
      corveeBurden: city.corveeBurden,
      waterworksIntegrity: city.waterworksIntegrity,
      disasterRisk: city.disasterRisk,
      trafficLoad: city.trafficLoad,
      garrisonStrength: city.garrisonStrength,
      academyLevel: city.academyLevel,
      localIssueTags: city.localIssueTags,
      cityIntelligenceSummary: city.cityIntelligenceSummary,
      publicSummary: city.publicSummary
    })),
    routes: view.highlights.routes.map((route) => ({
      id: route.id,
      name: route.name,
      type: route.type,
      statusLabel: route.statusLabel,
      risk: route.risk,
      cityIds: [route.fromCityId, route.toCityId],
      publicSummary: route.publicSummary
    })),
    frontierZones: view.highlights.frontierZones.map((frontier) => ({
      id: frontier.id,
      name: frontier.name,
      statusLabel: frontier.statusLabel,
      pressure: frontier.pressure,
      pressureMetric: frontier.pressureMetric,
      publicSummary: frontier.publicSummary
    })),
    officeJurisdictions: jurisdictions.map((jurisdiction) => ({
      id: jurisdiction.id,
      bureauId: jurisdiction.bureauId,
      name: jurisdiction.name,
      officeTrack: jurisdiction.officeTrack,
      priority: jurisdiction.priority,
      publicSummary: jurisdiction.publicSummary
    }))
  };
}

module.exports = {
  WORLD_GEOGRAPHY_SCHEMA_VERSION,
  buildWorldGeographyView,
  createInitialWorldGeographyState,
  ensureWorldGeographyState,
  normalizeWorldGeographyState,
  summarizeWorldGeographyForPrompt
};
