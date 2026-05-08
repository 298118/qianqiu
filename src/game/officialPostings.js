const {
  OFFICIAL_POSTING_SCHEMA_VERSION,
  buildOfficialPostingSchemaView,
  normalizeOfficialPostingSchemaBundle,
  summarizeOfficialPostingSchemaForPrompt
} = require("./officialPostingSchemas");
const {
  getOffice,
  inferOfficeByTitle,
  listBureaus,
  listOffices
} = require("./officialCatalog");
const { OFFICIAL_ECOSYSTEM_CONFIG } = require("./officialEcosystemConfig");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");

const MAX_TEXT_LENGTH = 140;
const PLAYER_POSTING_ID = "posting-player-current";
const PLAYER_ASSESSMENT_ID = "assessment-player-current";
const LOCAL_CITY_IDS = new Set(["city-suzhou", "city-hangzhou", "city-kaifeng", "city-guangzhou"]);
const CENTRAL_CITY_ID = "city-beijing";
const ADMIN_POSTING_ROLES = new Set(["official", "magistrate"]);
const CITY_TAX_CAPACITY_WEIGHTS = Object.freeze({
  taxBase: 0.65,
  priceCalm: 0.2,
  stability: 0.15
});
const CITY_MILITARY_PRESSURE_WEIGHTS = Object.freeze({
  banditPressure: 0.5,
  borderThreat: 0.3,
  garrisonGap: 0.2
});
const CITY_ASSESSMENT_THRESHOLDS = Object.freeze({
  lowTaxCapacity: 45,
  highTaxCapacity: 70,
  lowGrainStock: 45,
  highMarketStress: 60,
  highGentryInfluence: 65,
  highLawsuitPressure: 55,
  highCorveeBurden: 55,
  lowWaterworksIntegrity: 45,
  highDisasterRisk: 60,
  highTrafficLoad: 65,
  highGarrisonStrength: 65,
  highAcademyLevel: 65
});

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

function deterministicIndex(seed, length) {
  if (!length) return 0;
  const text = cleanText(seed, "default", 120);
  let total = 0;
  for (const character of text) {
    total += character.codePointAt(0) || 0;
  }
  return total % length;
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const id = cleanId(value, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row?.[key] || "";
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

function buildVisiblePeopleContext(worldState = {}) {
  const view = buildWorldPeopleView(worldState);
  const npcs = (view.npcs || []).filter((npc) =>
    npc &&
    npc.alive !== false &&
    npc.visibility !== "hidden" &&
    (npc.knownToPlayer === true || npc.visibility === "public" || npc.visibility === "role_visible")
  );
  return {
    view,
    npcs
  };
}

function npcMatchesRank(npc, patterns = []) {
  const rank = cleanText(npc?.rankLabel, "", 80);
  const summary = cleanText(npc?.publicSummary, "", 120);
  return patterns.some((pattern) => rank.includes(pattern) || summary.includes(pattern));
}

function chooseVisibleNpc(people, options = {}) {
  const npcs = Array.isArray(people?.npcs) ? people.npcs : [];
  const patterns = options.rankPatterns || [];
  const bureauId = cleanId(options.bureauId, "");
  const preferred = npcs.filter((npc) =>
    (!bureauId || !npc.bureauId || npc.bureauId === bureauId) &&
    (!patterns.length || npcMatchesRank(npc, patterns))
  );
  const candidates = preferred.length ? preferred : npcs.filter((npc) =>
    !patterns.length || npcMatchesRank(npc, patterns)
  );
  const source = candidates.length ? candidates : npcs;
  if (!source.length) return null;
  return source[deterministicIndex(options.seed || bureauId || "npc", source.length)];
}

function holderFromNpc(npc) {
  return npc?.id
    ? { holderType: "npc", holderId: cleanId(npc.id, "") }
    : { holderType: "unknown", holderId: "" };
}

function buildVisibleGeographyContext(worldState = {}) {
  const view = buildWorldGeographyView(worldState);
  const cityById = new Map((view.cities || []).map((city) => [city.id, city]));
  const regionById = new Map((view.regions || []).map((region) => [region.id, region]));
  const countryById = new Map((view.countries || []).map((country) => [country.id, country]));
  const routeById = new Map((view.routes || []).map((route) => [route.id, route]));
  const frontierById = new Map((view.frontierZones || []).map((frontier) => [frontier.id, frontier]));

  return {
    view,
    cityById,
    regionById,
    countryById,
    routeById,
    frontierById,
    cityIds: new Set(cityById.keys()),
    regionIds: new Set(regionById.keys()),
    countryIds: new Set(countryById.keys()),
    routeIds: new Set(routeById.keys()),
    frontierIds: new Set(frontierById.keys())
  };
}

function filterVisibleIds(values, visibleIds) {
  return unique(values).filter((id) => visibleIds.has(id));
}

function nullableVisibleId(id, visibleIds) {
  const value = cleanId(id, "");
  return value && visibleIds.has(value) ? value : "";
}

function bureauLevelForId(bureauId) {
  if (bureauId === "hanlin_academy") return "academy";
  if (bureauId === "censorate") return "censorate";
  if (bureauId === "provincial_admin" || bureauId === "provincial_judicial") return "provincial";
  if (bureauId === "prefecture_county") return "prefecture";
  if (bureauId === "ministry_war") return "military";
  return "court";
}

function jurisdictionScopeForBureau(bureauId, fallback = "court") {
  const level = bureauLevelForId(bureauId);
  if (level === "provincial") return "province";
  if (level === "prefecture") return "county";
  if (level === "military") return "military";
  if (level === "academy") return "academy";
  if (level === "censorate") return "censorate";
  return fallback;
}

function taxCapacityForCity(city = {}) {
  const legacyCapacity = Math.round((city.stability || 50) * 0.45 + (100 - (city.taxBurden || 45)) * 0.35 + 20);
  const taxBase = clampMetric(city.taxBase, legacyCapacity);
  const priceCalm = 100 - clampMetric(city.marketPriceStress, city.grainStress || 35);
  const stability = clampMetric(city.stability, 50);
  return clampMetric(Math.round(
    taxBase * CITY_TAX_CAPACITY_WEIGHTS.taxBase +
    priceCalm * CITY_TAX_CAPACITY_WEIGHTS.priceCalm +
    stability * CITY_TAX_CAPACITY_WEIGHTS.stability
  ), legacyCapacity);
}

function academyLevelForCity(city = {}) {
  if (Number.isFinite(Number(city.academyLevel))) return clampMetric(city.academyLevel, 40);
  const tags = Array.isArray(city.strategicTags) ? city.strategicTags.join(" ") : "";
  if (/贡院|书院|士绅|文社|学校/.test(tags)) return 72;
  if (city.jurisdictionLevel === "capital" || city.jurisdictionLevel === "secondary_capital") return 68;
  return 44;
}

function summarizeCityAssessmentPressure(city = {}, metrics = {}) {
  const thresholds = CITY_ASSESSMENT_THRESHOLDS;
  const notes = [];
  const taxCapacity = clampMetric(metrics.taxCapacity, 50);
  const grainStock = clampMetric(city.grainStock, 55);
  const marketStress = clampMetric(city.marketPriceStress, 40);
  const gentryInfluence = clampMetric(metrics.gentryInfluence, 50);
  const lawsuits = clampMetric(metrics.lawsuits, 20);
  const corveeBurden = clampMetric(city.corveeBurden, 35);
  const waterworks = clampMetric(metrics.waterworks, 50);
  const disasterRisk = clampMetric(metrics.disasterRisk, 35);
  const trafficLoad = clampMetric(city.trafficLoad, 45);
  const garrisonStrength = clampMetric(city.garrisonStrength, 35);
  const academyLevel = clampMetric(metrics.academyLevel, 40);

  if (taxCapacity <= thresholds.lowTaxCapacity) notes.push("税基偏薄");
  else if (taxCapacity >= thresholds.highTaxCapacity) notes.push("税基充实");
  if (grainStock <= thresholds.lowGrainStock) notes.push("粮储吃紧");
  if (marketStress >= thresholds.highMarketStress) notes.push("市价承压");
  if (gentryInfluence >= thresholds.highGentryInfluence) notes.push("士绅势重");
  if (lawsuits >= thresholds.highLawsuitPressure) notes.push("词讼繁多");
  if (corveeBurden >= thresholds.highCorveeBurden) notes.push("徭役偏重");
  if (waterworks <= thresholds.lowWaterworksIntegrity) notes.push("水利待修");
  if (disasterRisk >= thresholds.highDisasterRisk) notes.push("灾患须防");
  if (trafficLoad >= thresholds.highTrafficLoad) notes.push("驿路商旅繁忙");
  if (garrisonStrength >= thresholds.highGarrisonStrength) notes.push("驻军可恃");
  if (academyLevel >= thresholds.highAcademyLevel) notes.push("文教可用");

  return notes.slice(0, 4).join("、") || "任所指标平稳";
}

function cityDepthForAssessment(city = {}) {
  return {
    grainStock: clampMetric(city.grainStock, 55),
    marketPriceStress: clampMetric(city.marketPriceStress, city.grainStress || 35),
    corveeBurden: clampMetric(city.corveeBurden, 35),
    trafficLoad: clampMetric(city.trafficLoad, 45),
    garrisonStrength: clampMetric(city.garrisonStrength, 35)
  };
}

function metricsForCity(city = {}, worldState = {}, isPlayerLocalPosting = false) {
  const player = worldState.player || {};
  const localOrder = isPlayerLocalPosting
    ? clampMetric(player.localOrder, city.localOrder || 55)
    : clampMetric(city.localOrder, 55);
  const pendingLawsuits = isPlayerLocalPosting
    ? clampMetric(player.pendingLawsuits, 18)
    : clampMetric(city.lawsuitPressure, Math.round((city.pressure || 35) * 0.45));
  const waterworks = isPlayerLocalPosting
    ? clampMetric(player.waterworks, Math.max(35, 100 - (city.grainStress || 35)))
    : clampMetric(city.waterworksIntegrity, Math.max(30, 100 - (city.grainStress || 35)));
  const gentryInfluence = isPlayerLocalPosting
    ? clampMetric(player.gentryRelations, 50)
    : clampMetric(city.gentryInfluence, city.strategicTags?.includes("士绅") ? 68 : 48);
  const banditPressure = isPlayerLocalPosting
    ? clampMetric(player.banditPressure, 25)
    : clampMetric(Math.max(20, 100 - (city.localOrder || 55)), 28);
  const garrisonGap = 100 - clampMetric(city.garrisonStrength, 35);

  return {
    publicOrder: localOrder,
    taxCapacity: taxCapacityForCity(city),
    lawsuits: pendingLawsuits,
    waterworks,
    gentryInfluence,
    disasterRisk: clampMetric(city.disasterRisk, Math.max(city.grainStress || 35, city.pressure || 35)),
    militaryPressure: clampMetric(Math.round(
      banditPressure * CITY_MILITARY_PRESSURE_WEIGHTS.banditPressure +
      (worldState.borderThreat || 35) * CITY_MILITARY_PRESSURE_WEIGHTS.borderThreat +
      garrisonGap * CITY_MILITARY_PRESSURE_WEIGHTS.garrisonGap
    ), 35),
    academyLevel: academyLevelForCity(city)
  };
}

function buildGeoJurisdictionRows(worldState, geo, offices) {
  const officesByBureau = groupBy(offices, "bureauId");
  const rows = [];
  const player = worldState.player || {};

  for (const jurisdiction of geo.view.officeJurisdictions || []) {
    const bureauId = cleanId(jurisdiction.bureauId, "");
    const availableOfficeIds = unique((officesByBureau.get(bureauId) || []).map((office) => office.id));
    for (const cityId of filterVisibleIds(jurisdiction.cityIds, geo.cityIds)) {
      const city = geo.cityById.get(cityId);
      if (!city) continue;
      const isPlayerLocalPosting = player.role === "magistrate" &&
        bureauId === "prefecture_county" &&
        LOCAL_CITY_IDS.has(cityId);
      rows.push({
        id: `${jurisdiction.id}-${cityId}`,
        name: `${jurisdiction.name}：${city.name}`,
        bureauId,
        supervisingBureauId: bureauId,
        cityId,
        regionId: city.regionId,
        countryId: city.countryId,
        jurisdictionScope: jurisdictionScopeForBureau(bureauId, jurisdiction.scope === "local" ? "county" : "court"),
        availableOfficeIds,
        routeIds: filterVisibleIds(jurisdiction.routeIds, geo.routeIds),
        frontierZoneIds: filterVisibleIds(jurisdiction.frontierZoneIds, geo.frontierIds),
        localMetrics: metricsForCity(city, worldState, isPlayerLocalPosting),
        cityDepth: cityDepthForAssessment(city),
        visibility: jurisdiction.visibility,
        knownToPlayer: jurisdiction.visibility !== "role_visible",
        intelConfidence: jurisdiction.visibility === "public" ? 80 : 55,
        publicSummary: jurisdiction.publicSummary,
        lastUpdatedTurn: currentTurn(worldState)
      });
    }
  }

  return rows;
}

function buildFallbackJurisdictionRows(worldState, geo, bureaus, offices, existingRows) {
  const existingBureauIds = new Set(existingRows.map((row) => row.bureauId).filter(Boolean));
  const officesByBureau = groupBy(offices, "bureauId");
  const fallbackCity = geo.cityById.get(CENTRAL_CITY_ID) || [...geo.cityById.values()][0] || null;
  if (!fallbackCity) return [];

  return bureaus
    .filter((bureau) => !existingBureauIds.has(bureau.id))
    .map((bureau) => ({
      id: `jurisdiction-${bureau.id}-capital-${fallbackCity.id}`,
      name: `${bureau.name}${fallbackCity.name}任所`,
      bureauId: bureau.id,
      supervisingBureauId: bureau.id,
      cityId: fallbackCity.id,
      regionId: fallbackCity.regionId,
      countryId: fallbackCity.countryId,
      jurisdictionScope: jurisdictionScopeForBureau(bureau.id),
      availableOfficeIds: unique((officesByBureau.get(bureau.id) || []).map((office) => office.id)),
      routeIds: [],
      frontierZoneIds: [],
      localMetrics: metricsForCity(fallbackCity, worldState, false),
      cityDepth: cityDepthForAssessment(fallbackCity),
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 55,
      publicSummary: `${bureau.name}未在地理 seed 中单列辖区，S52.2 暂以${fallbackCity.name}可见城市作为任所锚点。`,
      lastUpdatedTurn: currentTurn(worldState)
    }));
}

function buildCatalogOfficeRows(worldState, geo, jurisdictionRows) {
  const jurisdictionRowsByBureau = groupBy(jurisdictionRows, "bureauId");
  return listOffices().map((office) => {
    const matchingJurisdictions = jurisdictionRowsByBureau.get(office.bureauId) || [];
    const typicalCityIds = unique(matchingJurisdictions.map((row) => row.cityId))
      .filter((cityId) => geo.cityIds.has(cityId));
    const centralFallback = geo.cityIds.has(CENTRAL_CITY_ID) ? [CENTRAL_CITY_ID] : [...geo.cityIds].slice(0, 1);
    return {
      id: office.id,
      title: office.title,
      aliases: office.aliases,
      rankBand: office.rankBand,
      bureauId: office.bureauId,
      track: office.track,
      jurisdictionScope: office.outpost ? jurisdictionScopeForBureau(office.bureauId, "prefecture") : "court",
      typicalCityIds: typicalCityIds.length ? typicalCityIds : centralFallback,
      requiredRankOrExam: office.eligibleFrom,
      appointmentMethods: office.outpost ? ["外放", "迁转", "考成后补缺"] : ["铨选", "观政", "考成后补缺"],
      normalTermMonths: office.outpost ? 36 : 0,
      duties: office.duties,
      outpost: Boolean(office.outpost),
      visibility: "public",
      knownToPlayer: true,
      intelConfidence: 85,
      publicSummary: `${office.title}为${office.bureauName}官职；实际任免、升降和外放仍由服务器官场结算裁决。`,
      lastUpdatedTurn: currentTurn(worldState)
    };
  });
}

function buildCatalogBureauRows(worldState, geo, jurisdictionRows, officeRows) {
  const jurisdictionRowsByBureau = groupBy(jurisdictionRows, "bureauId");
  const officesByBureau = groupBy(officeRows, "bureauId");
  return listBureaus().map((bureau) => {
    const jurisdictionIds = unique((jurisdictionRowsByBureau.get(bureau.id) || []).map((row) => row.id));
    const officeIds = unique((officesByBureau.get(bureau.id) || []).map((row) => row.id));
    const capitalCityId = geo.cityIds.has(CENTRAL_CITY_ID)
      ? CENTRAL_CITY_ID
      : unique((jurisdictionRowsByBureau.get(bureau.id) || []).map((row) => row.cityId))[0] || "";
    return {
      id: bureau.id,
      name: bureau.name,
      aliases: bureau.aliases,
      level: bureauLevelForId(bureau.id),
      capitalCityId,
      jurisdictionIds,
      officeIds,
      duties: bureau.duties,
      authorityMetrics: bureau.assignmentKinds || [],
      riskTags: bureau.id === "censorate" ? ["弹章", "风宪风险"] : [],
      visibility: "public",
      knownToPlayer: true,
      intelConfidence: 85,
      publicSummary: bureau.summary || `${bureau.name}为可追踪官署。`,
      lastUpdatedTurn: currentTurn(worldState)
    };
  });
}

function chooseRow(rows, seed) {
  if (!rows.length) return null;
  return rows[deterministicIndex(seed, rows.length)];
}

function selectPostingJurisdiction(worldState, office, jurisdictionRows) {
  if (!office) return null;
  const role = worldState.player?.role || "scholar";
  const bureauRows = jurisdictionRows.filter((row) => row.bureauId === office.bureauId);

  if (role === "magistrate" || office.bureauId === "prefecture_county") {
    const localRows = jurisdictionRows.filter((row) => row.bureauId === "prefecture_county");
    return chooseRow(localRows, worldState.player?.countyName || office.title) || chooseRow(bureauRows, office.title);
  }

  if (!office.outpost) {
    return bureauRows.find((row) => row.cityId === CENTRAL_CITY_ID) ||
      jurisdictionRows.find((row) => row.cityId === CENTRAL_CITY_ID) ||
      chooseRow(bureauRows, office.title);
  }

  return chooseRow(bureauRows, `${office.title}:${worldState.player?.name || ""}`) ||
    chooseRow(jurisdictionRows, office.title);
}

function titleForPosting(worldState = {}) {
  const player = worldState.player || {};
  const career = worldState.officialCareer || {};
  if (player.role === "magistrate") {
    const careerPosting = cleanText(career.currentPosting, "");
    return player.officeTitle || (careerPosting && careerPosting !== "未授" ? careerPosting : "") || "知县";
  }
  if (player.role === "official") {
    return player.officeTitle || player.position || career.currentPosting || "候选观政";
  }
  return "";
}

function latestHistoryForOffice(career = {}, office = null, title = "") {
  const history = Array.isArray(career.careerHistory) ? career.careerHistory : [];
  for (const entry of history.slice().reverse()) {
    const afterTitle = cleanText(entry.officeTitleAfter, "");
    if (!afterTitle) continue;
    const afterOffice = inferOfficeByTitle(afterTitle);
    if ((office?.id && afterOffice?.id === office.id) || afterTitle === title) return entry;
  }
  return null;
}

function dateFromHistoryOrNow(historyEntry, worldState = {}) {
  if (!historyEntry) return currentDate(worldState);
  return {
    year: clampNumber(historyEntry.year, 1, 9999, worldState.year || 1644),
    month: clampNumber(historyEntry.month, 1, 12, worldState.month || 1),
    tenDayPeriod: clampNumber(historyEntry.tenDayPeriod, 1, 3, worldState.tenDayPeriod || 1),
    turn: clampNumber(historyEntry.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState))
  };
}

function playerPostingScores(worldState = {}) {
  const player = worldState.player || {};
  const career = worldState.officialCareer || {};
  if (player.role === "magistrate") {
    const merit = Math.round((
      clampMetric(player.localOrder, 55) +
      clampMetric(player.gentryRelations, 50) +
      clampMetric(player.waterworks, 45) +
      (100 - clampMetric(player.pendingLawsuits, 20))
    ) / 4);
    const risk = Math.round((
      clampMetric(player.banditPressure, 35) +
      clampMetric(player.corveeBurden, 30) +
      clampMetric(player.pendingLawsuits, 18)
    ) / 3);
    return {
      merit,
      risk,
      reputation: clampMetric(Math.round((player.reputation || 10) + (player.integrity || 60) * 0.6), 50)
    };
  }

  return {
    merit: clampMetric(career.assessmentDossier?.meritScore ?? player.performanceMerit, 40),
    risk: clampMetric(career.assessmentDossier?.riskScore ?? player.impeachmentRisk, 18),
    reputation: clampMetric(player.cleanReputation ?? player.reputation, 55)
  };
}

function buildPlayerPosting(worldState, jurisdictionRows) {
  const player = worldState.player || {};
  if (!ADMIN_POSTING_ROLES.has(player.role)) return null;
  const title = titleForPosting(worldState);
  const fallbackTitle = player.role === "magistrate" ? "知县" : "候选观政";
  const office = inferOfficeByTitle(title) || inferOfficeByTitle(fallbackTitle);
  if (!office) return null;
  const jurisdiction = selectPostingJurisdiction(worldState, office, jurisdictionRows);
  const scores = playerPostingScores(worldState);
  const career = worldState.officialCareer || {};
  const startHistory = latestHistoryForOffice(career, office, title);
  const cityName = cleanText(jurisdiction?.name, "当前任所", 80);
  const countyLabel = player.role === "magistrate" && player.countyName
    ? `${player.countyName}映射至`
    : "";

  return {
    id: PLAYER_POSTING_ID,
    officeId: office.id,
    officeTitle: office.title,
    bureauId: office.bureauId,
    holderType: "player",
    holderId: cleanId(player.id, "P1"),
    status: "active",
    cityId: jurisdiction?.cityId || "",
    regionId: jurisdiction?.regionId || "",
    jurisdictionId: jurisdiction?.id || "",
    startedAt: dateFromHistoryOrNow(startHistory, worldState),
    expectedReviewTurn: currentTurn(worldState) + 36,
    termMonths: player.role === "official" ? clampNumber(career.tenureMonths, 0, 120, 0) : 0,
    performanceScore: scores.merit,
    impeachmentRisk: scores.risk,
    publicReputation: scores.reputation,
    assignmentIds: activeAssignmentIds(career).slice(0, 12),
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 90,
    publicSummary: `${player.name || "玩家"}当前以${office.title}在${countyLabel}${cityName}应差；任免、迁转和考成仍由服务器裁决。`,
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function mapRecommendation(value) {
  const text = cleanText(value, "");
  if (text === "court_nomination") return "promotion";
  if (text === "transfer" || text === "outpost" || text === "demotion" || text === "impeachment") return text;
  return "none";
}

function buildPlayerAssessmentRecord(worldState, posting, jurisdictionRows = []) {
  if (!posting) return null;
  const career = worldState.officialCareer || {};
  const dossier = career.assessmentDossier || {};
  const scores = playerPostingScores(worldState);
  const latestNote = Array.isArray(dossier.notes) ? cleanText(dossier.notes.at(-1), "") : "";
  const jurisdiction = jurisdictionRows.find((row) => row.id === posting.jurisdictionId) || null;
  const cityDepthFinding = jurisdiction
    ? summarizeCityAssessmentPressure(jurisdiction.cityDepth, jurisdiction.localMetrics)
    : "";
  const finding = [
    latestNote || `${posting.officeTitle}当前功过已入服务器考成投影。`,
    cityDepthFinding ? `任所奏报：${cityDepthFinding}。` : ""
  ].filter(Boolean).join("");

  return {
    id: PLAYER_ASSESSMENT_ID,
    postingId: posting.id,
    officeId: posting.officeId,
    bureauId: posting.bureauId,
    holderType: "player",
    holderId: posting.holderId,
    cycleId: cleanId(dossier.cycleId, `${worldState.year || 1644}-posting`),
    date: currentDate(worldState),
    status: "pending",
    meritScore: scores.merit,
    riskScore: scores.risk,
    recommendation: mapRecommendation(dossier.pendingRecommendation),
    publicFinding: finding,
    evidenceEventIds: [],
    assignmentIds: unique((career.assignments || []).map((assignment) => assignment.id)).slice(0, 12),
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 85,
    publicSummary: `${posting.officeTitle}当前考成：功绩${scores.merit}，风险${scores.risk}${cityDepthFinding ? `；${cityDepthFinding}` : ""}。`,
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function transferTypeForHistory(entry = {}) {
  const type = cleanText(entry.type, "");
  if (["appointment", "promotion", "transfer", "outpost", "demotion", "punishment", "mourning_leave", "restoration", "retention"].includes(type)) {
    return type;
  }
  if (type === "dismissal" || type === "impeachment") return "punishment";
  return "transfer";
}

function locationForTitle(worldState, title, jurisdictionRows) {
  const office = inferOfficeByTitle(title);
  const jurisdiction = office ? selectPostingJurisdiction(worldState, office, jurisdictionRows) : null;
  return {
    office,
    cityId: jurisdiction?.cityId || ""
  };
}

function buildTransferRecords(worldState, jurisdictionRows) {
  const career = worldState.officialCareer || {};
  const history = Array.isArray(career.careerHistory) ? career.careerHistory : [];
  const player = worldState.player || {};
  return history.map((entry) => {
    const from = locationForTitle(worldState, entry.officeTitleBefore, jurisdictionRows);
    const to = locationForTitle(worldState, entry.officeTitleAfter, jurisdictionRows);
    return {
      id: `transfer-${cleanId(entry.id, `${entry.type || "career"}-${entry.turn || 0}`)}`,
      holderType: "player",
      holderId: cleanId(player.id, "P1"),
      fromOfficeId: from.office?.id || "",
      toOfficeId: to.office?.id || "",
      fromCityId: from.cityId,
      toCityId: to.cityId,
      date: dateFromHistoryOrNow(entry, worldState),
      type: transferTypeForHistory(entry),
      status: "applied",
      publicReason: cleanText(entry.reason || entry.label, "服务器官场结算已写入迁转投影。"),
      relatedEventIds: [],
      visibility: "office_visible",
      knownToPlayer: true,
      intelConfidence: 85,
      publicSummary: `${entry.label || "官场迁转"}：${entry.officeTitleBefore || "未授"} -> ${entry.officeTitleAfter || "未授"}。`,
      lastUpdatedTurn: currentTurn(worldState)
    };
  });
}

function activeAssignmentIds(career = {}) {
  return unique((career.assignments || [])
    .filter((assignment) => !["resolved", "cancelled", "failed"].includes(cleanText(assignment.status, "")))
    .map((assignment) => assignment.id));
}

function resolveConfiguredOffice(officeId, fallbackOfficeId = "") {
  return getOffice(cleanId(officeId, "")) || getOffice(cleanId(fallbackOfficeId, "")) || null;
}

function selectJurisdictionForOffice(worldState, office, jurisdictionRows, seed = "") {
  if (!office) return null;
  return selectPostingJurisdiction(worldState, office, jurisdictionRows) ||
    chooseRow(jurisdictionRows.filter((row) => row.bureauId === office.bureauId), `${office.id}:${seed}`) ||
    chooseRow(jurisdictionRows, `${office.id}:${seed}`);
}

function vacancyPressureForJurisdiction(jurisdiction = {}) {
  const metrics = jurisdiction.localMetrics || {};
  const weights = OFFICIAL_ECOSYSTEM_CONFIG.vacancyPressureWeights;
  return clampMetric(Math.round(
    clampMetric(metrics.lawsuits, 20) * weights.lawsuits +
    clampMetric(metrics.disasterRisk, 20) * weights.disasterRisk +
    clampMetric(metrics.militaryPressure, 20) * weights.militaryPressure +
    (100 - clampMetric(metrics.taxCapacity, 50)) * weights.lowTaxCapacity +
    clampMetric(metrics.gentryInfluence, 50) * weights.gentryInfluence
  ), 50);
}

function describeAppointmentPressure(jurisdiction = {}) {
  const metrics = jurisdiction.localMetrics || {};
  const thresholds = OFFICIAL_ECOSYSTEM_CONFIG.pressureThresholds;
  const notes = [];
  if (clampMetric(metrics.taxCapacity, 50) <= thresholds.lowTaxCapacity) notes.push("钱粮偏薄");
  if (clampMetric(metrics.lawsuits, 20) >= thresholds.highLawsuitPressure) notes.push("刑名壅积");
  if (clampMetric(metrics.disasterRisk, 20) >= thresholds.highDisasterRisk) notes.push("灾赈催办");
  if (clampMetric(metrics.militaryPressure, 20) >= thresholds.highMilitaryPressure) notes.push("盗防吃紧");
  if (clampMetric(metrics.gentryInfluence, 50) >= thresholds.highGentryInfluence) notes.push("士绅牵制");
  return notes.slice(0, 3).join("、") || "差遣压力平稳";
}

function buildSuperiorPosting(worldState, playerPosting, jurisdictionRows, people) {
  if (!playerPosting) return null;
  const config = OFFICIAL_ECOSYSTEM_CONFIG;
  const office = resolveConfiguredOffice(
    config.superiorOfficeByBureau[playerPosting.bureauId],
    playerPosting.officeId
  );
  if (!office) return null;
  const jurisdiction = selectJurisdictionForOffice(worldState, office, jurisdictionRows, "superior") ||
    jurisdictionRows.find((row) => row.id === playerPosting.jurisdictionId);
  const holder = holderFromNpc(chooseVisibleNpc(people, {
    bureauId: playerPosting.bureauId,
    rankPatterns: config.visibleNpcRankPatterns.superior,
    seed: `${office.id}:superior`
  }));

  return {
    id: config.rowIds.superiorPosting,
    officeId: office.id,
    officeTitle: office.title,
    bureauId: office.bureauId,
    ...holder,
    status: "active",
    cityId: jurisdiction?.cityId || playerPosting.cityId,
    regionId: jurisdiction?.regionId || playerPosting.regionId,
    jurisdictionId: jurisdiction?.id || playerPosting.jurisdictionId,
    startedAt: currentDate(worldState),
    expectedReviewTurn: currentTurn(worldState) + config.reviewTurns.superior,
    termMonths: 0,
    performanceScore: config.scoreDefaults.superiorPerformance,
    impeachmentRisk: config.scoreDefaults.superiorRisk,
    publicReputation: 65,
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 82,
    publicSummary: `${office.title}为${playerPosting.officeTitle}上级堂官投影，负责考成复核、补缺议拟和差遣督责；实际任免仍由服务器官场结算裁决。`,
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildOfficeInterfacePosting(worldState, playerPosting, superiorPosting, jurisdictionRows, people) {
  if (!playerPosting) return null;
  const config = OFFICIAL_ECOSYSTEM_CONFIG;
  const office = resolveConfiguredOffice(
    config.interfaceOfficeByBureau[playerPosting.bureauId],
    playerPosting.officeId
  );
  if (!office) return null;
  const jurisdiction = jurisdictionRows.find((row) => row.id === playerPosting.jurisdictionId) ||
    selectJurisdictionForOffice(worldState, office, jurisdictionRows, "interface");
  const isLocal = playerPosting.bureauId === "prefecture_county" || office.outpost;
  const rankPatterns = isLocal
    ? [...config.visibleNpcRankPatterns.clerk, ...config.visibleNpcRankPatterns.gentry]
    : config.visibleNpcRankPatterns.clerk;
  const holder = holderFromNpc(chooseVisibleNpc(people, {
    bureauId: playerPosting.bureauId,
    rankPatterns,
    seed: `${office.id}:interface`
  }));
  const roleLabel = isLocal ? "胥吏幕友与地方士绅接口" : "属官同僚与署中文案接口";

  return {
    id: config.rowIds.officeInterfacePosting,
    officeId: office.id,
    officeTitle: office.title,
    bureauId: office.bureauId,
    ...holder,
    status: "acting",
    cityId: jurisdiction?.cityId || playerPosting.cityId,
    regionId: jurisdiction?.regionId || playerPosting.regionId,
    jurisdictionId: jurisdiction?.id || playerPosting.jurisdictionId,
    superiorPostingId: superiorPosting?.id || playerPosting.id,
    startedAt: currentDate(worldState),
    expectedReviewTurn: currentTurn(worldState) + config.reviewTurns.officeInterface,
    termMonths: 0,
    performanceScore: config.scoreDefaults.interfacePerformance,
    impeachmentRisk: config.scoreDefaults.interfaceRisk,
    publicReputation: 52,
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 76,
    publicSummary: `${roleLabel}正在署理案牍、钱粮、刑名或士绅沟通；这是 S63.1 可见官署生态投影，不构成服务器任命事实。`,
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildVacancyRows(worldState, jurisdictionRows, people) {
  const config = OFFICIAL_ECOSYSTEM_CONFIG;
  const rows = [];
  const assessments = [];
  const transfers = [];
  config.vacancyOfficeIds.forEach((officeId, index) => {
    const office = getOffice(officeId);
    if (!office) return;
    const jurisdiction = selectJurisdictionForOffice(worldState, office, jurisdictionRows, `vacancy-${index}`) ||
      jurisdictionRows[index % Math.max(1, jurisdictionRows.length)];
    if (!jurisdiction) return;
    const pressure = vacancyPressureForJurisdiction(jurisdiction);
    const pressureText = describeAppointmentPressure(jurisdiction);
    const vacancyId = `posting-s63-vacancy-${index + 1}`;
    const transferId = `transfer-s63-candidate-${index + 1}`;
    const assessmentId = `assessment-s63-vacancy-${index + 1}`;
    const candidate = holderFromNpc(chooseVisibleNpc(people, {
      bureauId: office.bureauId,
      rankPatterns: config.visibleNpcRankPatterns.candidate,
      seed: `${office.id}:candidate:${index}`
    }));

    rows.push({
      id: vacancyId,
      officeId: office.id,
      officeTitle: office.title,
      bureauId: office.bureauId,
      holderType: "vacant",
      holderId: "",
      status: "vacant",
      cityId: jurisdiction.cityId,
      regionId: jurisdiction.regionId,
      jurisdictionId: jurisdiction.id,
      startedAt: currentDate(worldState),
      expectedReviewTurn: currentTurn(worldState) + config.reviewTurns.vacancyBase + index * config.reviewTurns.vacancyStep,
      termMonths: 0,
      performanceScore: clampMetric(100 - pressure, 45),
      impeachmentRisk: pressure,
      publicReputation: config.scoreDefaults.vacancyReputation,
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 68,
      publicSummary: `${office.title}一缺待补，${jurisdiction.name}呈报${pressureText}；候补、补授、试署和外放只进入任命池摘要，正式授官仍由服务器裁决。`,
      lastUpdatedTurn: currentTurn(worldState)
    });

    assessments.push({
      id: assessmentId,
      postingId: vacancyId,
      officeId: office.id,
      bureauId: office.bureauId,
      holderType: "vacant",
      holderId: "",
      cycleId: `${worldState.year || 1644}-s63-vacancy-${index + 1}`,
      date: currentDate(worldState),
      status: "pending",
      meritScore: clampMetric(100 - pressure, 45),
      riskScore: pressure,
      recommendation: office.outpost ? "outpost" : "transfer",
      publicFinding: `${office.title}官缺压力：${pressureText}；待吏部铨选、候补、补授或试署议拟。`,
      evidenceEventIds: [],
      assignmentIds: [],
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 68,
      publicSummary: `${office.title}缺额考成压力 ${pressure}，仅作可见任命池线索。`,
      lastUpdatedTurn: currentTurn(worldState)
    });

    transfers.push({
      id: transferId,
      ...candidate,
      fromOfficeId: "",
      toPostingId: vacancyId,
      toOfficeId: office.id,
      fromCityId: "",
      toCityId: jurisdiction.cityId,
      relatedAssessmentId: assessmentId,
      date: currentDate(worldState),
      type: office.outpost ? "outpost" : "appointment",
      status: "proposed",
      publicReason: `${office.title}候补池列入补授/试署议拟；城市压力为${pressureText}，AI 只能读取该摘要。`,
      relatedEventIds: [],
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 66,
      publicSummary: `${office.title}任命池候补记录，尚未成为任免事实。`,
      lastUpdatedTurn: currentTurn(worldState)
    });
  });

  return { postings: rows, assessmentRecords: assessments, transferRecords: transfers };
}

function buildRestorationAndImpeachmentRows(worldState, jurisdictionRows, people) {
  const config = OFFICIAL_ECOSYSTEM_CONFIG;
  const auditOffice = getOffice("pending_audit_official");
  const censorOffice = getOffice("censorate_investigating_censor") || auditOffice;
  const jurisdiction = selectJurisdictionForOffice(worldState, auditOffice || censorOffice, jurisdictionRows, "restoration") ||
    jurisdictionRows.find((row) => row.cityId === CENTRAL_CITY_ID) ||
    jurisdictionRows[0];
  if (!auditOffice || !jurisdiction) {
    return { postings: [], assessmentRecords: [], transferRecords: [] };
  }
  const restorationHolder = holderFromNpc(chooseVisibleNpc(people, {
    bureauId: auditOffice.bureauId,
    rankPatterns: config.visibleNpcRankPatterns.candidate,
    seed: "restoration"
  }));
  const censorHolder = holderFromNpc(chooseVisibleNpc(people, {
    bureauId: censorOffice?.bureauId || auditOffice.bureauId,
    rankPatterns: config.visibleNpcRankPatterns.superior,
    seed: "impeachment"
  }));

  return {
    postings: [{
      id: config.rowIds.restorationPosting,
      officeId: auditOffice.id,
      officeTitle: auditOffice.title,
      bureauId: auditOffice.bureauId,
      ...restorationHolder,
      status: "restoration_pending",
      cityId: jurisdiction.cityId,
      regionId: jurisdiction.regionId,
      jurisdictionId: jurisdiction.id,
      startedAt: currentDate(worldState),
      expectedReviewTurn: currentTurn(worldState) + config.reviewTurns.restoration,
      termMonths: 0,
      performanceScore: config.scoreDefaults.restorationPerformance,
      impeachmentRisk: config.scoreDefaults.restorationRisk,
      publicReputation: 48,
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 62,
      publicSummary: "丁忧与起复候拟只作为 S63.1 任命池公开线索；是否起复、补授或改外放仍由服务器裁决。",
      lastUpdatedTurn: currentTurn(worldState)
    }, {
      id: config.rowIds.impeachmentPosting,
      officeId: auditOffice.id,
      officeTitle: auditOffice.title,
      bureauId: auditOffice.bureauId,
      ...censorHolder,
      status: "suspended",
      cityId: jurisdiction.cityId,
      regionId: jurisdiction.regionId,
      jurisdictionId: jurisdiction.id,
      startedAt: currentDate(worldState),
      expectedReviewTurn: currentTurn(worldState) + config.reviewTurns.impeachment,
      termMonths: 0,
      performanceScore: config.scoreDefaults.impeachmentPerformance,
      impeachmentRisk: config.scoreDefaults.impeachmentRisk,
      publicReputation: 35,
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 60,
      publicSummary: "弹劾候勘记录只说明风宪压力和缺额风险，不代表玩家或 NPC 已被服务器处分。",
      lastUpdatedTurn: currentTurn(worldState)
    }],
    assessmentRecords: [{
      id: config.rowIds.impeachmentAssessment,
      postingId: config.rowIds.impeachmentPosting,
      officeId: auditOffice.id,
      bureauId: auditOffice.bureauId,
      holderType: censorHolder.holderType,
      holderId: censorHolder.holderId,
      cycleId: `${worldState.year || 1644}-s63-impeachment`,
      date: currentDate(worldState),
      status: "pending",
      meritScore: config.scoreDefaults.impeachmentPerformance,
      riskScore: config.scoreDefaults.impeachmentRisk,
      recommendation: "impeachment",
      publicFinding: "弹劾、停缺与候勘只形成公开考成压力；成案、处分、复叙或起复仍由服务器裁决。",
      evidenceEventIds: [],
      assignmentIds: [],
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 60,
      publicSummary: "风宪候勘考成压力已入官职生态投影。",
      lastUpdatedTurn: currentTurn(worldState)
    }],
    transferRecords: [{
      id: config.rowIds.mourningTransfer,
      holderType: "unknown",
      holderId: "",
      fromOfficeId: auditOffice.id,
      toOfficeId: "",
      fromCityId: jurisdiction.cityId,
      toCityId: "",
      relatedAssessmentId: "",
      date: currentDate(worldState),
      type: "mourning_leave",
      status: "proposed",
      publicReason: "丁忧去任会形成缺额与署理压力；本记录只供任命池和 prompt 摘要读取。",
      relatedEventIds: [],
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 58,
      publicSummary: "丁忧缺额候补记录，未改变任何任命事实。",
      lastUpdatedTurn: currentTurn(worldState)
    }, {
      id: config.rowIds.restorationTransfer,
      ...restorationHolder,
      fromPostingId: config.rowIds.restorationPosting,
      fromOfficeId: auditOffice.id,
      toOfficeId: auditOffice.id,
      fromCityId: jurisdiction.cityId,
      toCityId: jurisdiction.cityId,
      relatedAssessmentId: config.rowIds.impeachmentAssessment,
      date: currentDate(worldState),
      type: "restoration",
      status: "proposed",
      publicReason: "起复候拟需经铨选、考成和风宪压力复核；AI 不得把该 proposal 当成已授事实。",
      relatedEventIds: [],
      visibility: "role_visible",
      knownToPlayer: false,
      intelConfidence: 58,
      publicSummary: "起复候拟迁转记录，仍待服务器裁决。",
      lastUpdatedTurn: currentTurn(worldState)
    }]
  };
}

function buildOfficeInterfaceAssessment(worldState, interfacePosting) {
  if (!interfacePosting) return null;
  const config = OFFICIAL_ECOSYSTEM_CONFIG;
  return {
    id: config.rowIds.interfaceAssessment,
    postingId: interfacePosting.id,
    officeId: interfacePosting.officeId,
    bureauId: interfacePosting.bureauId,
    holderType: interfacePosting.holderType,
    holderId: interfacePosting.holderId,
    cycleId: `${worldState.year || 1644}-s63-interface`,
    date: currentDate(worldState),
    status: "pending",
    meritScore: interfacePosting.performanceScore,
    riskScore: interfacePosting.impeachmentRisk,
    recommendation: "none",
    publicFinding: "署中属官、胥吏幕友、同僚和地方士绅接口只提供案牍压力与执行链背景，不拥有任免裁决权。",
    evidenceEventIds: [],
    assignmentIds: interfacePosting.assignmentIds || [],
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: interfacePosting.intelConfidence,
    publicSummary: "官署内部执行链考成压力已入可见 projection。",
    lastUpdatedTurn: currentTurn(worldState)
  };
}

function buildOfficialEcosystemRows(worldState, playerPosting, jurisdictionRows) {
  const people = buildVisiblePeopleContext(worldState);
  const superiorPosting = buildSuperiorPosting(worldState, playerPosting, jurisdictionRows, people);
  const interfacePosting = buildOfficeInterfacePosting(worldState, playerPosting, superiorPosting, jurisdictionRows, people);
  const vacancyRows = buildVacancyRows(worldState, jurisdictionRows, people);
  const disciplineRows = buildRestorationAndImpeachmentRows(worldState, jurisdictionRows, people);
  const interfaceAssessment = buildOfficeInterfaceAssessment(worldState, interfacePosting);

  return {
    playerSuperiorPostingId: superiorPosting?.id || "",
    postings: [
      superiorPosting,
      interfacePosting,
      ...vacancyRows.postings,
      ...disciplineRows.postings
    ].filter(Boolean),
    assessmentRecords: [
      interfaceAssessment,
      ...vacancyRows.assessmentRecords,
      ...disciplineRows.assessmentRecords
    ].filter(Boolean),
    transferRecords: [
      ...vacancyRows.transferRecords,
      ...disciplineRows.transferRecords
    ].filter(Boolean)
  };
}

function mergeRows(existingRows, bridgeRows) {
  const byId = new Map();
  for (const row of Array.isArray(existingRows) ? existingRows : []) {
    const id = cleanId(row?.id, "");
    if (!id) continue;
    byId.set(id, row);
  }
  for (const row of bridgeRows.filter(Boolean)) {
    const id = cleanId(row?.id, "");
    if (!id) continue;
    byId.set(id, { ...(byId.get(id) || {}), ...row });
  }
  return [...byId.values()];
}

function buildOfficialPostingBridge(worldState = {}, geo) {
  const seedOffices = listOffices();
  const baseBureaus = listBureaus();
  const geoJurisdictionRows = buildGeoJurisdictionRows(worldState, geo, seedOffices);
  const jurisdictionRows = [
    ...geoJurisdictionRows,
    ...buildFallbackJurisdictionRows(worldState, geo, baseBureaus, seedOffices, geoJurisdictionRows)
  ];
  const officeRows = buildCatalogOfficeRows(worldState, geo, jurisdictionRows);
  const bureauRows = buildCatalogBureauRows(worldState, geo, jurisdictionRows, officeRows);
  let playerPosting = buildPlayerPosting(worldState, jurisdictionRows);
  const ecosystemRows = buildOfficialEcosystemRows(worldState, playerPosting, jurisdictionRows);
  if (playerPosting && ecosystemRows.playerSuperiorPostingId) {
    playerPosting = {
      ...playerPosting,
      superiorPostingId: ecosystemRows.playerSuperiorPostingId
    };
  }
  const playerAssessment = buildPlayerAssessmentRecord(worldState, playerPosting, jurisdictionRows);

  return {
    bureaus: bureauRows,
    offices: officeRows,
    cityJurisdictions: jurisdictionRows,
    postings: [playerPosting, ...ecosystemRows.postings].filter(Boolean),
    assessmentRecords: [playerAssessment, ...ecosystemRows.assessmentRecords].filter(Boolean),
    transferRecords: [
      ...buildTransferRecords(worldState, jurisdictionRows),
      ...ecosystemRows.transferRecords
    ],
    recentNotes: []
  };
}

function pruneBundleToVisibleGeography(bundle, geo) {
  const cityJurisdictions = (bundle.cityJurisdictions || [])
    .filter((row) =>
      (!row.cityId || geo.cityIds.has(row.cityId)) &&
      (!row.regionId || geo.regionIds.has(row.regionId)) &&
      (!row.countryId || geo.countryIds.has(row.countryId))
    )
    .map((row) => ({
      ...row,
      routeIds: filterVisibleIds(row.routeIds, geo.routeIds),
      frontierZoneIds: filterVisibleIds(row.frontierZoneIds, geo.frontierIds)
    }));
  const jurisdictionIds = new Set(cityJurisdictions.map((row) => row.id));

  return {
    ...bundle,
    bureaus: (bundle.bureaus || []).map((row) => ({
      ...row,
      capitalCityId: nullableVisibleId(row.capitalCityId, geo.cityIds),
      jurisdictionIds: filterVisibleIds(row.jurisdictionIds, jurisdictionIds)
    })),
    offices: (bundle.offices || []).map((row) => ({
      ...row,
      typicalCityIds: filterVisibleIds(row.typicalCityIds, geo.cityIds)
    })),
    cityJurisdictions,
    postings: (bundle.postings || [])
      .filter((row) =>
        (!row.cityId || geo.cityIds.has(row.cityId)) &&
        (!row.regionId || geo.regionIds.has(row.regionId))
      )
      .map((row) => ({
        ...row,
        jurisdictionId: nullableVisibleId(row.jurisdictionId, jurisdictionIds)
      })),
    transferRecords: (bundle.transferRecords || []).map((row) => ({
      ...row,
      fromCityId: nullableVisibleId(row.fromCityId, geo.cityIds),
      toCityId: nullableVisibleId(row.toCityId, geo.cityIds)
    }))
  };
}

function normalizeOfficialPostingsState(worldState = {}) {
  const source = isPlainObject(worldState.officialPostings) ? worldState.officialPostings : {};
  const geo = buildVisibleGeographyContext(worldState);
  const bridge = buildOfficialPostingBridge(worldState, geo);
  const candidate = normalizeOfficialPostingSchemaBundle({
    schemaVersion: OFFICIAL_POSTING_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    bureaus: mergeRows(source.bureaus, bridge.bureaus),
    offices: mergeRows(source.offices, bridge.offices),
    cityJurisdictions: mergeRows(source.cityJurisdictions, bridge.cityJurisdictions),
    postings: mergeRows(source.postings, bridge.postings),
    assessmentRecords: mergeRows(source.assessmentRecords, bridge.assessmentRecords),
    transferRecords: mergeRows(source.transferRecords, bridge.transferRecords),
    recentNotes: []
  }, worldState);
  const geoSafe = pruneBundleToVisibleGeography(candidate, geo);
  const visible = buildOfficialPostingSchemaView(geoSafe, worldState);

  // Route payloads still include raw local worldState, so store only the
  // server-built visible projection instead of a hidden official ledger.
  return normalizeOfficialPostingSchemaBundle({
    schemaVersion: OFFICIAL_POSTING_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    bureaus: visible.bureaus,
    offices: visible.offices,
    cityJurisdictions: visible.cityJurisdictions,
    postings: visible.postings,
    assessmentRecords: visible.assessmentRecords,
    transferRecords: visible.transferRecords,
    recentNotes: []
  }, worldState);
}

function createInitialOfficialPostingsState(worldState = {}) {
  return normalizeOfficialPostingsState({
    ...worldState,
    officialPostings: {
      schemaVersion: OFFICIAL_POSTING_SCHEMA_VERSION
    }
  });
}

function ensureOfficialPostingsState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.officialPostings = normalizeOfficialPostingsState(worldState);
  return worldState;
}

function buildOfficialPostingsView(worldState = {}) {
  return buildOfficialPostingSchemaView(normalizeOfficialPostingsState(worldState), worldState);
}

function summarizeOfficialPostingsForPrompt(worldState = {}) {
  return summarizeOfficialPostingSchemaForPrompt(normalizeOfficialPostingsState(worldState), worldState);
}

module.exports = {
  buildOfficialPostingsView,
  createInitialOfficialPostingsState,
  ensureOfficialPostingsState,
  normalizeOfficialPostingsState,
  summarizeOfficialPostingsForPrompt
};
