const { formatYearMonthPeriod } = require("./time");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldEntityView } = require("./worldEntities");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  ECONOMIC_FISCAL_CONFIG,
  ECONOMIC_FISCAL_SCHEMA_VERSION
} = require("./economicFiscalConfig");

const STATUS_LABELS = Object.freeze({
  routine: "例行",
  watch: "留察",
  strained: "吃紧",
  urgent: "急报",
  critical: "危急"
});

const INCIDENT_LABELS = Object.freeze({
  fiscal_pressure: "财政压力",
  grain_price_spike: "粮价仓储预警",
  salt_canal_delay: "盐漕商路预警",
  relief_shortage: "赈济库银预警",
  debt_corruption: "债务亏空预警"
});

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = ECONOMIC_FISCAL_CONFIG.textLimit) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SECRET_LIKE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampMetric(value, fallback = 50) {
  return clampNumber(value, 0, 100, fallback);
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

function roleProfile(worldState = {}) {
  const role = cleanText(worldState.player?.role, "scholar", 32);
  return ECONOMIC_FISCAL_CONFIG.roleAccess[role] ||
    ECONOMIC_FISCAL_CONFIG.roleAccess.scholar;
}

function roleCanReadEconomicFiscal(worldState = {}) {
  return roleProfile(worldState).ledgerLimit > 0;
}

function readWorldNumber(worldState, key, fallback) {
  return clampNumber(worldState?.[key], Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback);
}

function weightedMetric(parts, fallback = 50) {
  const totalWeight = parts.reduce((sum, part) => sum + Math.max(0, Number(part.weight) || 0), 0);
  if (totalWeight <= 0) return fallback;
  const total = parts.reduce((sum, part) => {
    const value = clampMetric(part.value, fallback);
    return sum + value * Math.max(0, Number(part.weight) || 0);
  }, 0);
  return clampMetric(Math.round(total / totalWeight), fallback);
}

function averageMetric(rows, key, fallback = 50) {
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row?.[key]))
    .filter(Number.isFinite);
  if (!values.length) return fallback;
  const total = values.reduce((sum, value) => sum + value, 0);
  return clampMetric(Math.round(total / values.length), fallback);
}

function maxMetric(rows, key, fallback = 0) {
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row?.[key]))
    .filter(Number.isFinite);
  return values.length ? clampMetric(Math.max(...values), fallback) : fallback;
}

function statusFromPressure(pressure) {
  const thresholds = ECONOMIC_FISCAL_CONFIG.thresholds;
  if (pressure >= thresholds.critical) return "critical";
  if (pressure >= thresholds.urgent) return "urgent";
  if (pressure >= thresholds.strained) return "strained";
  if (pressure >= thresholds.watch) return "watch";
  return "routine";
}

function pressureTone(status) {
  if (status === "critical") return "危局";
  if (status === "urgent") return "急务";
  if (status === "strained") return "重务";
  if (status === "watch") return "留察";
  return "常务";
}

function unique(values, limit = 8) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value, "", 96);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function indexById(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]).filter(([id]) => id));
}

function relatedRows(ids = [], map) {
  return unique(ids, 12).map((id) => map.get(id)).filter(Boolean);
}

function includesAny(values = [], pattern) {
  return (Array.isArray(values) ? values : []).some((value) => pattern.test(String(value)));
}

function treasuryCapacity(worldState = {}) {
  const treasury = Math.max(0, readWorldNumber(worldState, "treasury", 1000));
  if (treasury >= 8000) return 88;
  if (treasury >= 4000) return 70;
  if (treasury >= 1200) return 52;
  if (treasury >= 400) return 34;
  return 18;
}

function grainStressForWorld(worldState = {}) {
  const grainReserve = Math.max(0, readWorldNumber(worldState, "grainReserve", 800));
  const population = Math.max(1, readWorldNumber(worldState, "population", 5000));
  const ratio = grainReserve / population;
  if (ratio < 0.04) return 92;
  if (ratio < 0.07) return 74;
  if (ratio < 0.1) return 58;
  if (ratio > 0.2) return 24;
  return 40;
}

function fiscalDeficit(worldState = {}) {
  const treasury = Math.max(0, readWorldNumber(worldState, "treasury", 1000));
  const corruption = readWorldNumber(worldState, "corruption", 60);
  const taxRate = readWorldNumber(worldState, "taxRate", 30);
  return clampMetric(70 - treasury / 140 + corruption * 0.35 + Math.max(0, taxRate - 35) * 0.8, 35);
}

function routeIsEconomicRelevant(route = {}) {
  return /canal|river|sea|road/i.test(route.type || "") ||
    includesAny(route.strategicTags, /商|漕|盐|粮|运河|海道|贡|互市|矿|税|驿/);
}

function cityMarketPressure(city = {}) {
  const weights = ECONOMIC_FISCAL_CONFIG.grainMarketWeights;
  return weightedMetric([
    { value: 100 - clampMetric(city.grainStock, 60), weight: weights.grainStockGap },
    { value: city.marketPriceStress, weight: weights.marketPriceStress },
    { value: city.grainStress, weight: weights.grainStress },
    { value: city.disasterRisk, weight: weights.disasterRisk },
    { value: city.taxBurden, weight: weights.taxBurden }
  ], clampMetric(city.marketPriceStress, 40));
}

function focusIds(worldState = {}, officialView = {}) {
  const currentPosting = (officialView.postings || []).find((posting) => posting.holderType === "player") || null;
  const currentJurisdiction = currentPosting
    ? (officialView.cityJurisdictions || []).find((row) => row.id === currentPosting.jurisdictionId)
    : null;
  return {
    bureauId: cleanId(worldState.officialCareer?.bureauId || currentPosting?.bureauId, ""),
    cityIds: new Set([
      currentPosting?.cityId,
      currentJurisdiction?.cityId
    ].filter(Boolean)),
    routeIds: new Set(currentJurisdiction?.routeIds || []),
    jurisdictionIds: new Set([currentPosting?.jurisdictionId, currentJurisdiction?.id].filter(Boolean))
  };
}

function focusBoost(row, focus) {
  let score = 0;
  if (row.jurisdictionId && focus.jurisdictionIds.has(row.jurisdictionId)) score += 100;
  if (row.cityId && focus.cityIds.has(row.cityId)) score += 80;
  if ((row.cityIds || []).some((id) => focus.cityIds.has(id))) score += 70;
  if (row.routeId && focus.routeIds.has(row.routeId)) score += 70;
  if ((row.routeIds || []).some((id) => focus.routeIds.has(id))) score += 55;
  if (row.bureauId && focus.bureauId && row.bureauId === focus.bureauId) score += 30;
  return score;
}

function priorityScore(row = {}) {
  const primary = clampMetric(
    row.pressureScore ??
    row.fiscalPressure ??
    row.marketPressure ??
    row.tradeRisk ??
    row.debtPressure ??
    row.corruptionRisk,
    0
  );
  const secondary = Math.max(
    clampMetric(row.fiscalPressure, 0),
    clampMetric(row.marketPressure, 0),
    clampMetric(row.tradeRisk, 0),
    clampMetric(row.debtPressure, 0),
    clampMetric(row.corruptionRisk, 0)
  );
  return primary * 1.2 + secondary * 0.2 + (row._focusBoost || 0);
}

function comparePriority(first, second) {
  const firstScore = priorityScore(first);
  const secondScore = priorityScore(second);
  if (secondScore !== firstScore) return secondScore - firstScore;
  return first.id.localeCompare(second.id);
}

function stripInternal(row) {
  if (!isPlainObject(row)) return row;
  const { _focusBoost, ...clean } = row;
  return clean;
}

function entityMetricById(entityView = {}, id, key, fallback = 50) {
  const entity = (entityView.highlights || []).find((row) => row.id === id) ||
    (entityView.groups || []).flatMap((group) => group.entities || []).find((row) => row.id === id);
  return clampMetric(entity?.metrics?.[key], fallback);
}

function buildFiscalLedger(worldState, country = {}, entityView = {}) {
  const weights = ECONOMIC_FISCAL_CONFIG.fiscalWeights;
  const treasury = Math.max(0, readWorldNumber(worldState, "treasury", 1000));
  const grainReserve = Math.max(0, readWorldNumber(worldState, "grainReserve", 800));
  const taxRate = clampMetric(readWorldNumber(worldState, "taxRate", 30), 30);
  const corruption = clampMetric(readWorldNumber(worldState, "corruption", 60), 60);
  const fiscalChannelPressure = entityMetricById(entityView, "fiscal-salt-canal", "pressure", 58);
  const reliefPressure = entityMetricById(entityView, "relief-granary-operation", "pressure", 58);
  const deficitPressure = fiscalDeficit(worldState);
  const fiscalPressure = weightedMetric([
    { value: country.fiscalPressure ?? fiscalChannelPressure, weight: weights.fiscalPressure },
    { value: deficitPressure, weight: weights.deficitPressure },
    { value: Math.max(grainStressForWorld(worldState), reliefPressure), weight: weights.grainStress },
    { value: corruption, weight: weights.corruption },
    { value: Math.max(taxRate, Math.max(0, taxRate - 35) * 2), weight: weights.taxPressure }
  ], deficitPressure);
  const status = statusFromPressure(fiscalPressure);
  const countryName = cleanText(country.shortName || country.name, "本朝", 60);
  const title = `${countryName}户部钱粮总账`;

  return {
    id: cleanId(`economic-ledger-${country.id || "realm"}`),
    title: cleanText(title, "户部钱粮总账", 80),
    countryId: cleanId(country.id, "country-ming"),
    countryName,
    treasury,
    grainReserve,
    treasuryCapacity: treasuryCapacity(worldState),
    taxRate,
    corruptionRisk: corruption,
    fiscalPressure,
    deficitPressure,
    grainStress: grainStressForWorld(worldState),
    saltCanalPressure: fiscalChannelPressure,
    reliefPressure,
    status,
    statusLabel: STATUS_LABELS[status],
    publicSummary: cleanText(`${title}列为${pressureTone(status)}：府库${treasury}，粮储${grainReserve}，税率${taxRate}，贪腐${corruption}，财政压力${fiscalPressure}。`, ""),
    authorityBoundary: "AI 只能读取财赋摘要、撰写叙事或提出有界建议；服务器裁决税赋、库银、粮储、赈济、追赃、市场价格和持久化。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildGrainMarketReport(worldState, city = {}) {
  const pressureScore = cityMarketPressure(city);
  const status = statusFromPressure(pressureScore);
  const title = `${city.name}粮储市价`;
  return {
    id: cleanId(`economic-market-${city.id}`),
    title: cleanText(title, "粮储市价", 80),
    cityId: cleanId(city.id, ""),
    cityName: cleanText(city.name, "城镇", 60),
    regionId: cleanId(city.regionId, ""),
    countryId: cleanId(city.countryId, ""),
    taxBase: clampMetric(city.taxBase, 55),
    taxBurden: clampMetric(city.taxBurden, clampMetric(worldState.taxRate, 30)),
    grainStock: clampMetric(city.grainStock, 60),
    grainStress: clampMetric(city.grainStress, 35),
    marketPriceStress: clampMetric(city.marketPriceStress, 40),
    disasterRisk: clampMetric(city.disasterRisk, 25),
    trafficLoad: clampMetric(city.trafficLoad, 45),
    marketPressure: pressureScore,
    pressureScore,
    status,
    statusLabel: STATUS_LABELS[status],
    publicSummary: cleanText(`${title}列为${pressureTone(status)}：仓储${city.grainStock ?? 60}，粮价${city.marketPriceStress ?? 40}，灾赈风险${city.disasterRisk ?? 25}，商旅负荷${city.trafficLoad ?? 45}。`, ""),
    authorityBoundary: "粮价与仓储 projection 只供叙事、预警和受限建议；开仓、平粜、加税、免税和结算仍归服务器。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function tradeRiskFor(worldState, route = {}, relatedCities = []) {
  const weights = ECONOMIC_FISCAL_CONFIG.tradeRouteWeights;
  return weightedMetric([
    { value: route.risk, weight: weights.routeRisk },
    { value: maxMetric(relatedCities, "marketPriceStress", 35), weight: weights.marketStress },
    { value: Math.max(maxMetric(relatedCities, "grainStress", 35), 100 - averageMetric(relatedCities, "grainStock", 60)), weight: weights.grainStress },
    { value: maxMetric(relatedCities, "trafficLoad", 45), weight: weights.trafficLoad },
    { value: worldState.corruption, weight: weights.corruption }
  ], clampMetric(route.risk, 35));
}

function routeEconomicKind(route = {}) {
  const text = `${route.type || ""} ${(route.strategicTags || []).join(" ")}`;
  if (/盐|漕|运河|canal/i.test(text)) return "salt_canal";
  if (/海道|海|sea/i.test(text)) return "sea_trade";
  if (/贡|互市/.test(text)) return "tribute_trade";
  if (/矿|冶/.test(text)) return "mining";
  return "merchant_route";
}

function buildTradeSaltCanalRoute(worldState, route = {}, maps = {}) {
  const relatedCities = relatedRows([route.fromCityId, route.toCityId, ...(route.viaCityIds || [])], maps.cities);
  const tradeRisk = tradeRiskFor(worldState, route, relatedCities);
  const status = statusFromPressure(tradeRisk);
  const routeNames = relatedCities.map((city) => city.name).filter(Boolean).slice(0, 4).join("、") || "沿线城镇";
  const title = `${route.name}商税盐漕`;
  return {
    id: cleanId(`economic-route-${route.id}`),
    title: cleanText(title, "商税盐漕", 80),
    routeId: cleanId(route.id, ""),
    routeName: cleanText(route.name, "商路", 80),
    routeType: cleanText(route.type, "road", 32),
    economicKind: routeEconomicKind(route),
    cityIds: unique([route.fromCityId, route.toCityId, ...(route.viaCityIds || [])], 8),
    relatedCityNames: unique(relatedCities.map((city) => city.name), 6),
    strategicTags: unique(route.strategicTags, 8),
    tradeRisk,
    marketPressure: maxMetric(relatedCities, "marketPriceStress", 35),
    grainStress: maxMetric(relatedCities, "grainStress", 35),
    trafficLoad: maxMetric(relatedCities, "trafficLoad", 45),
    routeRisk: clampMetric(route.risk, 35),
    status,
    statusLabel: STATUS_LABELS[status],
    seasonalRisk: cleanText(route.seasonalRisk, "随时令、河道与商旅变动。"),
    publicSummary: cleanText(`${title}列为${pressureTone(status)}：沿线${routeNames}，通行${route.statusLabel || "未详"}，路线风险${route.risk ?? 35}，贸易压力${tradeRisk}。`, ""),
    authorityBoundary: "商路盐漕 projection 不结算税课、漕粮、盐引、矿冶或运输结果；后续仍需服务器 resolver。",
    date: currentDate(worldState),
    lastUpdatedTurn: clampNumber(route.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function localTreasuryAmount(worldState = {}, isCurrent = false) {
  if (!isCurrent) return null;
  const value = Number(worldState.player?.localTreasury);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function buildLocalTreasuryReport(worldState, jurisdiction = {}, city = {}, isCurrent = false) {
  const metrics = jurisdiction.localMetrics || {};
  const weights = ECONOMIC_FISCAL_CONFIG.localTreasuryWeights;
  const taxCapacity = clampMetric(metrics.taxCapacity, clampMetric(city.taxBase, 55));
  const treasuryAmount = localTreasuryAmount(worldState, isCurrent);
  const treasuryGap = treasuryAmount === null
    ? 100 - weightedMetric([
      { value: taxCapacity, weight: 0.6 },
      { value: city.taxBase, weight: 0.4 }
    ], taxCapacity)
    : treasuryAmount < 120 ? 86 : treasuryAmount < 280 ? 66 : treasuryAmount < 600 ? 42 : 22;
  const reliefPressure = Math.max(
    clampMetric(metrics.disasterRisk, clampMetric(city.disasterRisk, 25)),
    100 - clampMetric(city.grainStock, 60),
    clampMetric(city.marketPriceStress, 40)
  );
  const pressureScore = weightedMetric([
    { value: 100 - taxCapacity, weight: weights.taxCapacityGap },
    { value: treasuryGap, weight: weights.localTreasuryGap },
    { value: reliefPressure, weight: weights.reliefPressure },
    { value: metrics.gentryInfluence ?? city.gentryInfluence, weight: weights.gentryInfluence },
    { value: worldState.corruption, weight: weights.corruption }
  ], reliefPressure);
  const status = statusFromPressure(pressureScore);
  const title = `${jurisdiction.name || city.name || "任所"}库银赈济`;

  return {
    id: cleanId(`economic-local-treasury-${jurisdiction.id || city.id}`),
    title: cleanText(title, "库银赈济", 80),
    jurisdictionId: cleanId(jurisdiction.id, ""),
    bureauId: cleanId(jurisdiction.bureauId, ""),
    cityId: cleanId(city.id || jurisdiction.cityId, ""),
    cityName: cleanText(city.name, "任所", 60),
    regionId: cleanId(city.regionId || jurisdiction.regionId, ""),
    countryId: cleanId(city.countryId || jurisdiction.countryId, ""),
    localTreasury: treasuryAmount,
    localTreasuryCapacity: clampMetric(100 - treasuryGap, 45),
    taxCapacity,
    reliefPressure,
    gentryInfluence: clampMetric(metrics.gentryInfluence ?? city.gentryInfluence, 50),
    corruptionRisk: clampMetric(worldState.corruption, 60),
    pressureScore,
    status,
    statusLabel: STATUS_LABELS[status],
    publicSummary: cleanText(`${title}列为${pressureTone(status)}：税粮能力${taxCapacity}，赈济压力${reliefPressure}，库银承载${clampMetric(100 - treasuryGap, 45)}。`, ""),
    authorityBoundary: "地方库银 projection 只给任所和朝廷叙事线索；征收、拨银、赈济、追赃、考成和持久化由服务器裁决。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function npcDebtPressure(npc = {}) {
  const cash = Math.max(0, Number(npc.wealthCash) || 0);
  const debts = Math.max(0, Number(npc.debts) || 0);
  if (debts <= 0) return 0;
  if (debts > cash + 300) return 92;
  if (debts > cash + 120) return 76;
  if (debts > cash + 40) return 58;
  return 42;
}

function buildDebtCorruptionRisk(worldState, source = {}, kind = "court") {
  const weights = ECONOMIC_FISCAL_CONFIG.debtCorruptionWeights;
  let debtPressure = 0;
  let corruptionRisk = clampMetric(worldState.corruption, 60);
  let legalRisk = 0;
  let influence = 50;
  let cityId = "";
  let title = "朝廷亏空贪腐";
  let sourceId = "court";
  let sourceLabel = "朝廷";
  let publicDetail = `贪腐${corruptionRisk}，财政缺口${fiscalDeficit(worldState)}`;

  if (kind === "household") {
    sourceId = cleanId(source.id, "household");
    sourceLabel = cleanText(`${source.familyName || "地方"}家`, "地方家族", 60);
    title = `${sourceLabel}债压`;
    debtPressure = clampMetric(source.debtPressure, 0);
    corruptionRisk = clampMetric(source.familyRisk, corruptionRisk);
    legalRisk = clampMetric(source.familyRisk, 0);
    influence = clampMetric(source.prestige, source.wealthScore ?? 50);
    cityId = cleanId(source.seatCityId, "");
    publicDetail = `债压${debtPressure}，家族风险${source.familyRisk ?? 0}，财富${source.wealthScore ?? 50}`;
  } else if (kind === "npc") {
    sourceId = cleanId(source.id, "npc");
    sourceLabel = cleanText(source.name, "人物", 60);
    title = `${sourceLabel}债务亏空`;
    debtPressure = npcDebtPressure(source);
    legalRisk = Math.max(clampMetric(source.legalRisk, 0), clampMetric(source.impeachmentRisk, 0));
    corruptionRisk = Math.max(corruptionRisk, legalRisk);
    influence = clampMetric(source.influence, source.reputation ?? 50);
    cityId = cleanId(source.currentCityId || source.homeCityId, "");
    publicDetail = `欠债${source.debts ?? 0}，现银${source.wealthCash ?? 0}，法纪风险${legalRisk}`;
  } else if (kind === "asset") {
    sourceId = cleanId(source.id, "asset");
    sourceLabel = cleanText(source.name, "资产", 60);
    title = `${sourceLabel}债项`;
    const value = Math.max(1, Number(source.valueEstimate) || 1);
    const debt = Math.max(0, Number(source.debtValue) || 0);
    debtPressure = clampMetric(debt / value * 100, source.kind === "debt" ? 72 : 35);
    legalRisk = source.statusLabel === "纠纷" || source.statusLabel === "吃紧" ? 65 : 25;
    corruptionRisk = Math.max(corruptionRisk, legalRisk);
    influence = clampMetric(value / 40, 45);
    cityId = cleanId(source.cityId, "");
    publicDetail = `估值${value}，债项${debt}，状态${source.statusLabel || "未详"}`;
  }

  const pressureScore = weightedMetric([
    { value: debtPressure, weight: weights.debtPressure },
    { value: corruptionRisk, weight: weights.corruptionRisk },
    { value: fiscalDeficit(worldState), weight: weights.deficitPressure },
    { value: legalRisk, weight: weights.legalRisk },
    { value: influence, weight: weights.influence }
  ], Math.max(debtPressure, corruptionRisk));
  const status = statusFromPressure(pressureScore);

  return {
    id: cleanId(`economic-debt-${kind}-${sourceId}`),
    title: cleanText(title, "债务亏空", 80),
    kind,
    sourceId,
    sourceLabel,
    cityId,
    debtPressure,
    corruptionRisk,
    legalRisk,
    influence,
    pressureScore,
    status,
    statusLabel: STATUS_LABELS[status],
    publicSummary: cleanText(`${title}列为${pressureTone(status)}：${publicDetail}。`, ""),
    authorityBoundary: "债务腐败 projection 只作案源和叙事线索；追赃、定罪、罚没、家产变动、债务清偿和持久化由服务器裁决。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildDebtCorruptionRisks(worldState, peopleView = {}) {
  const rows = [buildDebtCorruptionRisk(worldState, {}, "court")];
  for (const household of peopleView.households || []) {
    if (clampMetric(household.debtPressure, 0) >= 35 || clampMetric(household.familyRisk, 0) >= 45) {
      rows.push(buildDebtCorruptionRisk(worldState, household, "household"));
    }
  }
  for (const npc of peopleView.npcs || []) {
    if (Math.max(npcDebtPressure(npc), clampMetric(npc.legalRisk, 0), clampMetric(npc.impeachmentRisk, 0)) >= 35) {
      rows.push(buildDebtCorruptionRisk(worldState, npc, "npc"));
    }
  }
  for (const asset of peopleView.assets || []) {
    const relevant = Number(asset.debtValue) > 0 || /debt|shop|mine|granary|business/i.test(asset.kind || "");
    if (relevant) rows.push(buildDebtCorruptionRisk(worldState, asset, "asset"));
  }
  return rows;
}

function buildIncident(worldState, kind, row = {}) {
  const pressureScore = clampMetric(row.pressureScore ?? row.fiscalPressure ?? row.tradeRisk ?? row.marketPressure ?? row.debtPressure, 45);
  const status = statusFromPressure(pressureScore);
  const title = `${row.title || "财赋市场"}${INCIDENT_LABELS[kind]}`;
  const sourceKey = row.jurisdictionId || row.routeId || row.cityId || row.countryId || row.sourceId || row.id || "realm";
  return {
    id: cleanId(`economic-incident-${kind}-${sourceKey}`),
    kind,
    kindLabel: INCIDENT_LABELS[kind],
    title: cleanText(title, INCIDENT_LABELS[kind], 80),
    status,
    statusLabel: STATUS_LABELS[status],
    severity: status === "critical" || status === "urgent" ? 4 : status === "strained" ? 3 : 2,
    pressureScore,
    fiscalPressure: row.fiscalPressure,
    marketPressure: row.marketPressure,
    tradeRisk: row.tradeRisk,
    debtPressure: row.debtPressure,
    corruptionRisk: row.corruptionRisk,
    countryId: row.countryId,
    cityId: row.cityId,
    cityIds: unique(row.cityIds, 6),
    routeId: row.routeId,
    routeIds: unique(row.routeIds, 6),
    jurisdictionId: row.jurisdictionId,
    bureauId: row.bureauId,
    sourceId: row.sourceId,
    publicSummary: cleanText(`${title}：压力${pressureScore}，${row.publicSummary || "需继续留察钱粮、粮价与商路。"}。`, ""),
    authorityBoundary: "该财赋市场事件只是服务器可见 projection；是否拨银、赈济、追赃、缓征、平粜或入档为真实结果仍归服务器。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function collectMarketIncidents(worldState, rows, profile) {
  const incidents = [
    ...rows.fiscalLedgers
      .filter((row) => row.fiscalPressure >= ECONOMIC_FISCAL_CONFIG.thresholds.watch)
      .map((row) => buildIncident(worldState, "fiscal_pressure", row)),
    ...rows.grainMarketReports
      .filter((row) => row.pressureScore >= ECONOMIC_FISCAL_CONFIG.thresholds.watch)
      .map((row) => buildIncident(worldState, "grain_price_spike", row)),
    ...rows.tradeSaltCanalRoutes
      .filter((row) => row.tradeRisk >= ECONOMIC_FISCAL_CONFIG.thresholds.watch)
      .map((row) => buildIncident(worldState, "salt_canal_delay", row)),
    ...rows.localTreasuryReports
      .filter((row) => row.pressureScore >= ECONOMIC_FISCAL_CONFIG.thresholds.watch)
      .map((row) => buildIncident(worldState, "relief_shortage", row)),
    ...rows.debtCorruptionRisks
      .filter((row) => row.pressureScore >= ECONOMIC_FISCAL_CONFIG.thresholds.watch)
      .map((row) => buildIncident(worldState, "debt_corruption", row))
  ];

  return incidents
    .sort(comparePriority)
    .slice(0, profile.incidentLimit || ECONOMIC_FISCAL_CONFIG.maxMarketIncidents)
    .map(stripInternal);
}

function buildEconomicFiscalView(worldState = {}) {
  const profile = roleProfile(worldState);
  if (!roleCanReadEconomicFiscal(worldState)) {
    return {
      schemaVersion: ECONOMIC_FISCAL_SCHEMA_VERSION,
      generatedAtTurn: currentTurn(worldState),
      dateLabel: formatYearMonthPeriod(worldState),
      fiscalLedgers: [],
      grainMarketReports: [],
      tradeSaltCanalRoutes: [],
      localTreasuryReports: [],
      debtCorruptionRisks: [],
      marketIncidents: [],
      counts: { total: 0 },
      hiddenNotice: profile.notice
    };
  }

  const geoView = buildWorldGeographyView(worldState);
  const officialView = buildOfficialPostingsView(worldState);
  const localDocketView = buildLocalAffairsDocketView(worldState);
  const entityView = buildWorldEntityView(worldState);
  const peopleView = buildWorldPeopleView(worldState);
  const focus = focusIds(worldState, officialView);
  const maps = {
    cities: indexById(geoView.cities)
  };
  const countries = (geoView.countries || [])
    .filter((country) => country.kind === "player_realm" || country.fiscalPressure >= ECONOMIC_FISCAL_CONFIG.thresholds.watch);
  const fiscalLedgers = (countries.length ? countries : (geoView.countries || []).slice(0, 1))
    .map((country) => buildFiscalLedger(worldState, country, entityView))
    .map((row) => ({
      ...row,
      _focusBoost: row.countryId === "country-ming" ? 25 : 0
    }))
    .sort(comparePriority)
    .slice(0, profile.ledgerLimit)
    .map(stripInternal);

  const grainMarketReports = (geoView.cities || [])
    .map((city) => ({
      ...buildGrainMarketReport(worldState, city),
      _focusBoost: focus.cityIds.has(city.id) ? 90 : 0
    }))
    .sort(comparePriority)
    .slice(0, profile.cityLimit)
    .map(stripInternal);

  const tradeSaltCanalRoutes = (geoView.routes || [])
    .filter(routeIsEconomicRelevant)
    .map((route) => ({
      ...buildTradeSaltCanalRoute(worldState, route, maps),
      _focusBoost: focus.routeIds.has(route.id) ? 90 : 0
    }))
    .sort(comparePriority)
    .slice(0, profile.routeLimit)
    .map(stripInternal);

  const cityById = maps.cities;
  const currentPosting = (officialView.postings || []).find((posting) => posting.holderType === "player") || null;
  const localTreasuryReports = (officialView.cityJurisdictions || [])
    .filter((jurisdiction) => jurisdiction.cityId && cityById.has(jurisdiction.cityId))
    .map((jurisdiction) => ({
      ...buildLocalTreasuryReport(
        worldState,
        jurisdiction,
        cityById.get(jurisdiction.cityId),
        Boolean(currentPosting?.jurisdictionId && currentPosting.jurisdictionId === jurisdiction.id)
      ),
      _focusBoost: focus.jurisdictionIds.has(jurisdiction.id) ? 100 : 0
    }))
    .sort(comparePriority)
    .slice(0, profile.localTreasuryLimit)
    .map(stripInternal);

  const docketCityIds = new Set((localDocketView.dockets || [])
    .filter((docket) => /revenue|relief|waterworks|corvee|gentry/.test(docket.domain || ""))
    .map((docket) => docket.cityId)
    .filter(Boolean));
  const debtCorruptionRisks = buildDebtCorruptionRisks(worldState, peopleView)
    .map((row) => ({
      ...row,
      _focusBoost: (row.cityId && (focus.cityIds.has(row.cityId) || docketCityIds.has(row.cityId))) ? 65 : 0
    }))
    .sort(comparePriority)
    .slice(0, profile.debtLimit)
    .map(stripInternal);

  const marketIncidents = collectMarketIncidents(worldState, {
    fiscalLedgers,
    grainMarketReports,
    tradeSaltCanalRoutes,
    localTreasuryReports,
    debtCorruptionRisks
  }, profile);

  return {
    schemaVersion: ECONOMIC_FISCAL_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    fiscalLedgers,
    grainMarketReports,
    tradeSaltCanalRoutes,
    localTreasuryReports,
    debtCorruptionRisks,
    marketIncidents,
    counts: {
      total: fiscalLedgers.length + grainMarketReports.length + tradeSaltCanalRoutes.length +
        localTreasuryReports.length + debtCorruptionRisks.length + marketIncidents.length,
      fiscalLedgers: fiscalLedgers.length,
      grainMarketReports: grainMarketReports.length,
      tradeSaltCanalRoutes: tradeSaltCanalRoutes.length,
      localTreasuryReports: localTreasuryReports.length,
      debtCorruptionRisks: debtCorruptionRisks.length,
      marketIncidents: marketIncidents.length
    },
    hiddenNotice: `${profile.notice} 本视图只含服务器由可见地理、任所、案牍、实体和人物 projection 整理的财赋市场摘要；AI 不得写税粮、库银、债务、赈济、市场价格、数据库或隐藏情报。`
  };
}

function compactReport(type, row = {}) {
  return {
    id: row.id,
    type,
    title: row.title,
    statusLabel: row.statusLabel,
    pressureScore: row.pressureScore,
    fiscalPressure: row.fiscalPressure,
    deficitPressure: row.deficitPressure,
    marketPressure: row.marketPressure,
    tradeRisk: row.tradeRisk,
    debtPressure: row.debtPressure,
    corruptionRisk: row.corruptionRisk,
    reliefPressure: row.reliefPressure,
    treasuryCapacity: row.treasuryCapacity,
    localTreasuryCapacity: row.localTreasuryCapacity,
    grainStock: row.grainStock,
    grainStress: row.grainStress,
    marketPriceStress: row.marketPriceStress,
    taxCapacity: row.taxCapacity,
    taxRate: row.taxRate,
    countryId: row.countryId,
    cityId: row.cityId,
    cityIds: unique(row.cityIds, 6),
    routeId: row.routeId,
    routeIds: unique(row.routeIds, 6),
    jurisdictionId: row.jurisdictionId,
    bureauId: row.bureauId,
    sourceId: row.sourceId,
    publicSummary: row.publicSummary,
    authorityBoundary: row.authorityBoundary
  };
}

function buildEconomicFiscalRetrievalRows(worldState = {}) {
  const view = buildEconomicFiscalView(worldState);
  return [
    ...(view.fiscalLedgers || []).map((row) => compactReport("fiscal_ledger", row)),
    ...(view.grainMarketReports || []).map((row) => compactReport("grain_market", row)),
    ...(view.tradeSaltCanalRoutes || []).map((row) => compactReport("trade_salt_canal", row)),
    ...(view.localTreasuryReports || []).map((row) => compactReport("local_treasury", row)),
    ...(view.debtCorruptionRisks || []).map((row) => compactReport("debt_corruption", row)),
    ...(view.marketIncidents || []).map((row) => compactReport("market_incident", row))
  ]
    .filter((row) => row.id && row.publicSummary)
    .slice(0, ECONOMIC_FISCAL_CONFIG.maxRetrievalReports);
}

function summarizeEconomicFiscalForPrompt(worldState = {}) {
  const view = buildEconomicFiscalView(worldState);
  return {
    generatedAtTurn: view.generatedAtTurn,
    reports: buildEconomicFiscalRetrievalRows(worldState)
      .slice(0, ECONOMIC_FISCAL_CONFIG.maxPromptReports),
    safety: {
      source: "server_visible_economic_fiscal_projection",
      authority: "AI 只能读取和叙述；服务器裁决税赋、库银、粮储、盐漕、商路、赈济、债务、腐败、市场价格和持久化。"
    }
  };
}

module.exports = {
  ECONOMIC_FISCAL_SCHEMA_VERSION,
  buildEconomicFiscalRetrievalRows,
  buildEconomicFiscalView,
  summarizeEconomicFiscalForPrompt
};
