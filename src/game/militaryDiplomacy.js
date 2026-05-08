const { formatYearMonthPeriod } = require("./time");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  MILITARY_DIPLOMACY_CONFIG,
  MILITARY_DIPLOMACY_SCHEMA_VERSION
} = require("./militaryDiplomacyConfig");

const STATUS_LABELS = Object.freeze({
  routine: "例行",
  watch: "留察",
  strained: "吃紧",
  urgent: "急报",
  critical: "危急"
});

const INCIDENT_LABELS = Object.freeze({
  frontier_alert: "边患预警",
  supply_strain: "粮道吃紧",
  envoy_watch: "使节试探",
  war_warning: "战备警讯"
});

const SECRET_LIKE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = MILITARY_DIPLOMACY_CONFIG.textLimit) {
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
  return MILITARY_DIPLOMACY_CONFIG.roleAccess[role] ||
    MILITARY_DIPLOMACY_CONFIG.roleAccess.scholar;
}

function roleCanReadMilitaryDiplomacy(worldState = {}) {
  return roleProfile(worldState).theaterLimit > 0;
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

function weightedMetric(parts, fallback = 50) {
  const totalWeight = parts.reduce((sum, part) => sum + Math.max(0, Number(part.weight) || 0), 0);
  if (totalWeight <= 0) return fallback;
  const total = parts.reduce((sum, part) => {
    const value = clampMetric(part.value, fallback);
    return sum + value * Math.max(0, Number(part.weight) || 0);
  }, 0);
  return clampMetric(Math.round(total / totalWeight), fallback);
}

function statusFromPressure(pressure) {
  const thresholds = MILITARY_DIPLOMACY_CONFIG.thresholds;
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

function cityIsMilitaryRelevant(city = {}) {
  return /frontier|pass|garrison/i.test(city.jurisdictionLevel || "") ||
    includesAny(city.strategicTags, /边|军|关|防|营|镇/) ||
    clampMetric(city.garrisonStrength, 0) >= MILITARY_DIPLOMACY_CONFIG.garrisonCityThreshold;
}

function routeIsSupplyRelevant(route = {}) {
  return /pass|road|canal|river|sea/i.test(route.type || "") ||
    includesAny(route.strategicTags, /粮|军|边|关|驿|漕|贡|互市|海道/);
}

function supplyRiskFor(relatedRoutes = [], relatedCities = []) {
  const weights = MILITARY_DIPLOMACY_CONFIG.supplyWeights;
  const routeRisk = maxMetric(relatedRoutes, "risk", 28);
  const grainStress = Math.max(
    maxMetric(relatedCities, "grainStress", 25),
    100 - averageMetric(relatedCities, "grainStock", 65)
  );
  const marketStress = maxMetric(relatedCities, "marketPriceStress", 25);
  const trafficLoad = maxMetric(relatedCities, "trafficLoad", 35);
  return weightedMetric([
    { value: routeRisk, weight: weights.routeRisk },
    { value: grainStress, weight: weights.grainStress },
    { value: marketStress, weight: weights.marketStress },
    { value: trafficLoad, weight: weights.trafficLoad }
  ], routeRisk);
}

function readinessFor(worldState, country = {}, relatedCities = []) {
  const weights = MILITARY_DIPLOMACY_CONFIG.readinessWeights;
  const cityGarrison = averageMetric(relatedCities, "garrisonStrength", 48);
  const armyMorale = clampMetric(worldState.armyMorale, 60);
  const countryReadiness = clampMetric(country.militaryReadiness, 50);
  return weightedMetric([
    { value: cityGarrison, weight: weights.cityGarrison },
    { value: armyMorale, weight: weights.armyMorale },
    { value: countryReadiness, weight: weights.countryReadiness }
  ], 50);
}

function theaterThreatFor(worldState, frontier, country, neighbor, relatedCities, relatedRoutes) {
  const weights = MILITARY_DIPLOMACY_CONFIG.theaterWeights;
  const supplyRisk = supplyRiskFor(relatedRoutes, relatedCities);
  const readiness = readinessFor(worldState, country, relatedCities);
  const diplomaticTension = Math.max(
    clampMetric(country?.diplomaticTension, 40),
    clampMetric(neighbor?.diplomaticTension, 40)
  );
  return {
    readiness,
    supplyRisk,
    diplomaticTension,
    threatScore: weightedMetric([
      { value: clampMetric(frontier?.pressure, worldState.borderThreat ?? 40), weight: weights.frontierPressure },
      { value: diplomaticTension, weight: weights.diplomaticTension },
      { value: supplyRisk, weight: weights.supplyRisk },
      { value: 100 - readiness, weight: weights.readinessGap }
    ], clampMetric(frontier?.pressure, 40))
  };
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
    frontierIds: new Set(currentJurisdiction?.frontierZoneIds || [])
  };
}

function focusBoost(row, focus) {
  let score = 0;
  if (row.frontierZoneId && focus.frontierIds.has(row.frontierZoneId)) score += 100;
  if ((row.cityIds || []).some((id) => focus.cityIds.has(id))) score += 70;
  if ((row.routeIds || []).some((id) => focus.routeIds.has(id))) score += 55;
  if (row.bureauId && focus.bureauId && row.bureauId === focus.bureauId) score += 30;
  return score;
}

function buildTheater(worldState, frontier, maps) {
  const country = maps.countries.get(frontier.countryId) || {};
  const neighbor = maps.countries.get(frontier.neighborCountryId) || {};
  const relatedCities = relatedRows(frontier.cityIds, maps.cities);
  const relatedRoutes = relatedRows(frontier.routeIds, maps.routes);
  const metrics = theaterThreatFor(worldState, frontier, country, neighbor, relatedCities, relatedRoutes);
  const status = statusFromPressure(metrics.threatScore);
  const cityNames = relatedCities.map((city) => city.name).filter(Boolean).slice(0, 3).join("、") || "边镇";
  const routeNames = relatedRoutes.map((route) => route.name).filter(Boolean).slice(0, 2).join("、") || "粮道未详";
  const neighborName = cleanText(neighbor.name, "邻境", 60);
  const title = `${frontier.name}军务`;
  const publicSummary = `${title}列为${pressureTone(status)}：邻境${neighborName}，边压${frontier.pressure}，战备${metrics.readiness}，粮道${metrics.supplyRisk}；相关边镇${cityNames}，粮道${routeNames}。`;

  return {
    id: cleanId(`military-theater-${frontier.id}`),
    frontierZoneId: frontier.id,
    title: cleanText(title, "边防军务", 80),
    name: cleanText(frontier.name, "边面", 80),
    countryId: cleanId(frontier.countryId, ""),
    neighborCountryId: cleanId(frontier.neighborCountryId, ""),
    neighborName,
    cityIds: unique(frontier.cityIds, 8),
    routeIds: unique(frontier.routeIds, 8),
    status,
    statusLabel: STATUS_LABELS[status],
    threatScore: metrics.threatScore,
    frontierPressure: clampMetric(frontier.pressure, 40),
    diplomaticTension: metrics.diplomaticTension,
    readinessScore: metrics.readiness,
    supplyRisk: metrics.supplyRisk,
    garrisonStrength: averageMetric(relatedCities, "garrisonStrength", 45),
    morale: clampMetric(worldState.armyMorale, 60),
    intelConfidence: clampMetric(
      Math.min(
        clampMetric(frontier.intelConfidence, 70),
        clampMetric(neighbor.intelligenceReliability ?? neighbor.intelConfidence, 60)
      ),
      60
    ),
    publicSummary: cleanText(publicSummary, ""),
    authorityBoundary: "AI 只能读取军务外交态势、撰写叙事或提出有界建议；服务器裁决调兵、战役、宣战、和议、任免、粮饷和持久化。",
    visibility: frontier.visibility || "public",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildGarrison(worldState, city, theaterIds = []) {
  const weights = MILITARY_DIPLOMACY_CONFIG.garrisonWeights;
  const readiness = weightedMetric([
    { value: city.garrisonStrength, weight: weights.cityGarrison },
    { value: worldState.armyMorale, weight: weights.armyMorale },
    { value: 100 - clampMetric(city.disasterRisk, 20), weight: weights.disasterSafety }
  ], 50);
  const supplyRisk = supplyRiskFor([], [city]);
  const stress = Math.max(100 - readiness, supplyRisk, clampMetric(worldState.borderThreat, 40));
  const status = statusFromPressure(stress);
  const title = `${city.name}驻军`;
  return {
    id: cleanId(`military-garrison-${city.id}`),
    title: cleanText(title, "驻军", 80),
    cityId: cleanId(city.id, ""),
    cityName: cleanText(city.name, "边镇", 60),
    regionId: cleanId(city.regionId, ""),
    countryId: cleanId(city.countryId, ""),
    frontierZoneIds: unique(theaterIds, 6),
    garrisonStrength: clampMetric(city.garrisonStrength, 45),
    readinessScore: readiness,
    supplyRisk,
    morale: clampMetric(worldState.armyMorale, 60),
    status,
    statusLabel: STATUS_LABELS[status],
    intelConfidence: clampMetric(city.intelConfidence, 70),
    publicSummary: cleanText(`${title}：驻防${city.garrisonStrength ?? 45}，战备${readiness}，粮秣风险${supplyRisk}；AI 不得据此直接调兵。`, ""),
    authorityBoundary: "驻军 projection 只供叙事、侦报和受限建议；兵额、军令、战果和粮饷由服务器裁决。",
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildSupplyLine(route, relatedCityNames = []) {
  const status = statusFromPressure(clampMetric(route.risk, 30));
  const title = `${route.name}粮道`;
  return {
    id: cleanId(`military-supply-${route.id}`),
    title: cleanText(title, "粮道", 80),
    routeId: cleanId(route.id, ""),
    routeName: cleanText(route.name, "粮道", 80),
    routeType: cleanText(route.type, "road", 32),
    cityIds: unique([route.fromCityId, route.toCityId, ...(route.viaCityIds || [])], 8),
    relatedCityNames: unique(relatedCityNames, 6),
    supplyRisk: clampMetric(route.risk, 30),
    status,
    statusLabel: STATUS_LABELS[status],
    seasonalRisk: cleanText(route.seasonalRisk, "随时令与军情变动。"),
    publicSummary: cleanText(`${title}：通行${route.statusLabel || "未详"}，风险${route.risk ?? 30}；只作军需与边报线索。`, ""),
    authorityBoundary: "粮道 projection 不结算军需、税粮或运输结果；后续仍需服务器 resolver。",
    lastUpdatedTurn: clampNumber(route.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function envoyCandidates(peopleView = {}) {
  return (peopleView.npcs || []).filter((npc) =>
    /使者|贡使|译官|外邦|邻国/.test(`${npc.rankLabel || ""} ${npc.publicSummary || ""}`)
  );
}

function buildDiplomaticContact(worldState, country, envoys = []) {
  const tension = clampMetric(country.diplomaticTension, 40);
  const status = statusFromPressure(Math.max(tension, clampMetric(country.successionRisk, 30)));
  const envoy = envoys.find((npc) => /使者|贡使|外邦|邻国/.test(`${npc.rankLabel || ""} ${npc.publicSummary || ""}`));
  const envoyLabel = cleanText(envoy?.name ? `${envoy.name}（${envoy.rankLabel || "使者"}）` : "", "", 80);
  const title = `${country.shortName || country.name}使节往来`;
  return {
    id: cleanId(`military-diplomacy-${country.id}`),
    title: cleanText(title, "使节往来", 80),
    countryId: cleanId(country.id, ""),
    countryName: cleanText(country.name, "邻国", 60),
    polityType: cleanText(country.polityType, "polity", 48),
    envoyLabel,
    diplomaticTension: tension,
    tributeTradeActivity: clampMetric(country.tributeTradeActivity, 50),
    intelligenceReliability: clampMetric(country.intelligenceReliability, country.intelConfidence ?? 55),
    status,
    statusLabel: STATUS_LABELS[status],
    posture: cleanText(country.diplomaticPosture, "只见公开礼文与边吏传闻。"),
    intelligenceSummary: cleanText(country.intelligenceSummary, "情报可信度未详。"),
    publicSummary: cleanText(`${title}：张力${tension}，贡贸${country.tributeTradeActivity ?? 50}，${envoyLabel || "暂无具名使者"}；谈判、扣使、和议或宣战均非 AI 可直接裁决。`, ""),
    authorityBoundary: "AI 可叙述使节、贡道和谈判气氛；服务器裁决外交政策、盟约、宣战、和议和隐藏情报公开。",
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function incidentKindFor(theater, contact = null) {
  if (theater.threatScore >= MILITARY_DIPLOMACY_CONFIG.thresholds.critical) return "war_warning";
  if (theater.supplyRisk >= MILITARY_DIPLOMACY_CONFIG.thresholds.urgent) return "supply_strain";
  if (contact && contact.diplomaticTension >= MILITARY_DIPLOMACY_CONFIG.thresholds.strained) return "envoy_watch";
  return "frontier_alert";
}

function buildFrontierIncident(worldState, theater, contact = null) {
  const kind = incidentKindFor(theater, contact);
  const status = theater.status === "routine" ? "watch" : theater.status;
  const title = `${theater.name}${INCIDENT_LABELS[kind]}`;
  const summary = `${title}：威胁${theater.threatScore}，粮道${theater.supplyRisk}，战备${theater.readinessScore}，情报可信${theater.intelConfidence}。`;
  return {
    id: cleanId(`military-incident-${theater.frontierZoneId}-${kind}`),
    kind,
    kindLabel: INCIDENT_LABELS[kind],
    title: cleanText(title, "边患预警", 80),
    theaterId: theater.id,
    frontierZoneId: theater.frontierZoneId,
    countryId: theater.countryId,
    neighborCountryId: theater.neighborCountryId,
    severity: status === "critical" || status === "urgent" ? 4 : status === "strained" ? 3 : 2,
    status,
    statusLabel: STATUS_LABELS[status],
    threatScore: theater.threatScore,
    intelConfidence: theater.intelConfidence,
    relatedCityIds: theater.cityIds,
    relatedRouteIds: theater.routeIds,
    publicSummary: cleanText(summary, ""),
    authorityBoundary: "该边患事件只是可见情报 projection；是否成战、调兵、议和或入档为真实结果仍归服务器。",
    date: currentDate(worldState),
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function comparePriority(first, second) {
  const firstScore = Math.max(first.threatScore || 0, first.supplyRisk || 0, first.diplomaticTension || 0) +
    (first._focusBoost || 0);
  const secondScore = Math.max(second.threatScore || 0, second.supplyRisk || 0, second.diplomaticTension || 0) +
    (second._focusBoost || 0);
  if (secondScore !== firstScore) return secondScore - firstScore;
  return first.id.localeCompare(second.id);
}

function stripInternal(row) {
  if (!isPlainObject(row)) return row;
  const { _focusBoost, ...clean } = row;
  return clean;
}

function buildMilitaryDiplomacyView(worldState = {}) {
  const profile = roleProfile(worldState);
  if (!roleCanReadMilitaryDiplomacy(worldState)) {
    return {
      schemaVersion: MILITARY_DIPLOMACY_SCHEMA_VERSION,
      generatedAtTurn: currentTurn(worldState),
      dateLabel: formatYearMonthPeriod(worldState),
      theaters: [],
      garrisons: [],
      supplyLines: [],
      diplomaticContacts: [],
      frontierIncidents: [],
      counts: { total: 0 },
      hiddenNotice: profile.notice
    };
  }

  const geoView = buildWorldGeographyView(worldState);
  const peopleView = buildWorldPeopleView(worldState);
  const officialView = buildOfficialPostingsView(worldState);
  const focus = focusIds(worldState, officialView);
  const maps = {
    countries: indexById(geoView.countries),
    cities: indexById(geoView.cities),
    routes: indexById(geoView.routes)
  };

  const theaters = (geoView.frontierZones || [])
    .map((frontier) => buildTheater(worldState, frontier, maps))
    .map((theater) => ({
      ...theater,
      _focusBoost: focusBoost(theater, focus)
    }))
    .sort(comparePriority)
    .slice(0, profile.theaterLimit)
    .map(stripInternal);
  const theaterFrontierIds = new Set(theaters.map((theater) => theater.frontierZoneId));
  const frontierIdsByCity = new Map();
  for (const theater of theaters) {
    for (const cityId of theater.cityIds) {
      const ids = frontierIdsByCity.get(cityId) || [];
      ids.push(theater.frontierZoneId);
      frontierIdsByCity.set(cityId, ids);
    }
  }
  const routeIds = new Set(theaters.flatMap((theater) => theater.routeIds));
  const cityIds = new Set(theaters.flatMap((theater) => theater.cityIds));
  const garrisons = (geoView.cities || [])
    .filter((city) => cityIds.has(city.id) || cityIsMilitaryRelevant(city))
    .map((city) => ({
      ...buildGarrison(worldState, city, frontierIdsByCity.get(city.id) || []),
      _focusBoost: focus.cityIds.has(city.id) ? 90 : 0
    }))
    .sort(comparePriority)
    .slice(0, MILITARY_DIPLOMACY_CONFIG.maxGarrisons)
    .map(stripInternal);
  const supplyLines = (geoView.routes || [])
    .filter((route) => routeIds.has(route.id) || routeIsSupplyRelevant(route))
    .map((route) => {
      const routeCityNames = relatedRows([route.fromCityId, route.toCityId, ...(route.viaCityIds || [])], maps.cities)
        .map((city) => city.name);
      return {
        ...buildSupplyLine(route, routeCityNames),
        _focusBoost: focus.routeIds.has(route.id) ? 80 : 0
      };
    })
    .sort(comparePriority)
    .slice(0, MILITARY_DIPLOMACY_CONFIG.maxSupplyLines)
    .map(stripInternal);
  const envoys = envoyCandidates(peopleView);
  const diplomaticContacts = (geoView.countries || [])
    .filter((country) => country.kind !== "player_realm")
    .map((country) => buildDiplomaticContact(worldState, country, envoys))
    .sort(comparePriority)
    .slice(0, profile.contactLimit)
    .map(stripInternal);
  const contactsByCountry = new Map(diplomaticContacts.map((contact) => [contact.countryId, contact]));
  const frontierIncidents = theaters
    .filter((theater) => theaterFrontierIds.has(theater.frontierZoneId))
    .map((theater) => buildFrontierIncident(worldState, theater, contactsByCountry.get(theater.neighborCountryId)))
    .sort(comparePriority)
    .slice(0, MILITARY_DIPLOMACY_CONFIG.maxIncidents)
    .map(stripInternal);

  return {
    schemaVersion: MILITARY_DIPLOMACY_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    theaters,
    garrisons,
    supplyLines,
    diplomaticContacts,
    frontierIncidents,
    counts: {
      total: theaters.length + garrisons.length + supplyLines.length + diplomaticContacts.length + frontierIncidents.length,
      theaters: theaters.length,
      garrisons: garrisons.length,
      supplyLines: supplyLines.length,
      diplomaticContacts: diplomaticContacts.length,
      frontierIncidents: frontierIncidents.length
    },
    hiddenNotice: `${profile.notice} 本视图只含服务器由可见地理、人物和任所 projection 整理的军务外交摘要；AI 不得写外交、战役、驻军、粮道、数据库或隐藏情报。`
  };
}

function compactReport(type, row = {}) {
  return {
    id: row.id,
    type,
    title: row.title,
    statusLabel: row.statusLabel,
    threatScore: row.threatScore,
    supplyRisk: row.supplyRisk,
    readinessScore: row.readinessScore,
    diplomaticTension: row.diplomaticTension,
    intelConfidence: row.intelConfidence,
    countryId: row.countryId,
    neighborCountryId: row.neighborCountryId,
    cityId: row.cityId,
    cityIds: unique(row.cityIds || row.relatedCityIds, 6),
    routeId: row.routeId,
    routeIds: unique(row.routeIds || row.relatedRouteIds, 6),
    frontierZoneId: row.frontierZoneId,
    publicSummary: row.publicSummary,
    authorityBoundary: row.authorityBoundary
  };
}

function buildMilitaryDiplomacyRetrievalRows(worldState = {}) {
  const view = buildMilitaryDiplomacyView(worldState);
  return [
    ...(view.theaters || []).map((row) => compactReport("frontier_theater", row)),
    ...(view.garrisons || []).map((row) => compactReport("garrison", row)),
    ...(view.supplyLines || []).map((row) => compactReport("supply_line", row)),
    ...(view.diplomaticContacts || []).map((row) => compactReport("diplomatic_contact", row)),
    ...(view.frontierIncidents || []).map((row) => compactReport("frontier_incident", row))
  ]
    .filter((row) => row.id && row.publicSummary)
    .slice(0, MILITARY_DIPLOMACY_CONFIG.maxRetrievalReports);
}

function summarizeMilitaryDiplomacyForPrompt(worldState = {}) {
  const view = buildMilitaryDiplomacyView(worldState);
  return {
    generatedAtTurn: view.generatedAtTurn,
    reports: buildMilitaryDiplomacyRetrievalRows(worldState)
      .slice(0, MILITARY_DIPLOMACY_CONFIG.maxPromptReports),
    safety: {
      source: "server_visible_military_diplomacy_projection",
      authority: "AI 只能读取和叙述；服务器裁决调兵、战役、外交、粮饷、情报公开和持久化。"
    }
  };
}

module.exports = {
  MILITARY_DIPLOMACY_SCHEMA_VERSION,
  buildMilitaryDiplomacyRetrievalRows,
  buildMilitaryDiplomacyView,
  summarizeMilitaryDiplomacyForPrompt
};
