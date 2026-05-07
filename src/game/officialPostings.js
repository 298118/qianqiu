const {
  OFFICIAL_POSTING_SCHEMA_VERSION,
  buildOfficialPostingSchemaView,
  normalizeOfficialPostingSchemaBundle,
  summarizeOfficialPostingSchemaForPrompt
} = require("./officialPostingSchemas");
const {
  inferOfficeByTitle,
  listBureaus,
  listOffices
} = require("./officialCatalog");
const { buildWorldGeographyView } = require("./worldGeography");

const MAX_TEXT_LENGTH = 140;
const PLAYER_POSTING_ID = "posting-player-current";
const PLAYER_ASSESSMENT_ID = "assessment-player-current";
const LOCAL_CITY_IDS = new Set(["city-suzhou", "city-hangzhou", "city-kaifeng", "city-guangzhou"]);
const CENTRAL_CITY_ID = "city-beijing";
const ADMIN_POSTING_ROLES = new Set(["official", "magistrate"]);

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
  return clampMetric(Math.round((city.stability || 50) * 0.45 + (100 - (city.taxBurden || 45)) * 0.35 + 20), 55);
}

function academyLevelForCity(city = {}) {
  const tags = Array.isArray(city.strategicTags) ? city.strategicTags.join(" ") : "";
  if (/贡院|书院|士绅|文社|学校/.test(tags)) return 72;
  if (city.jurisdictionLevel === "capital" || city.jurisdictionLevel === "secondary_capital") return 68;
  return 44;
}

function metricsForCity(city = {}, worldState = {}, isPlayerLocalPosting = false) {
  const player = worldState.player || {};
  const localOrder = isPlayerLocalPosting
    ? clampMetric(player.localOrder, city.localOrder || 55)
    : clampMetric(city.localOrder, 55);
  const pendingLawsuits = isPlayerLocalPosting
    ? clampMetric(player.pendingLawsuits, 18)
    : clampMetric(Math.round((city.pressure || 35) * 0.45), 20);
  const waterworks = isPlayerLocalPosting
    ? clampMetric(player.waterworks, Math.max(35, 100 - (city.grainStress || 35)))
    : clampMetric(Math.max(30, 100 - (city.grainStress || 35)), 55);
  const gentryInfluence = isPlayerLocalPosting
    ? clampMetric(player.gentryRelations, 50)
    : clampMetric(city.strategicTags?.includes("士绅") ? 68 : 48, 50);
  const banditPressure = isPlayerLocalPosting
    ? clampMetric(player.banditPressure, 25)
    : clampMetric(Math.max(20, 100 - (city.localOrder || 55)), 28);

  return {
    publicOrder: localOrder,
    taxCapacity: taxCapacityForCity(city),
    lawsuits: pendingLawsuits,
    waterworks,
    gentryInfluence,
    disasterRisk: clampMetric(Math.max(city.grainStress || 35, city.pressure || 35), 35),
    militaryPressure: clampMetric(Math.max(banditPressure, worldState.borderThreat || 35), 35),
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

function buildPlayerAssessmentRecord(worldState, posting) {
  if (!posting) return null;
  const career = worldState.officialCareer || {};
  const dossier = career.assessmentDossier || {};
  const scores = playerPostingScores(worldState);
  const latestNote = Array.isArray(dossier.notes) ? cleanText(dossier.notes.at(-1), "") : "";

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
    publicFinding: latestNote || `${posting.officeTitle}当前功过已入服务器考成投影。`,
    evidenceEventIds: [],
    assignmentIds: unique((career.assignments || []).map((assignment) => assignment.id)).slice(0, 12),
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 85,
    publicSummary: `${posting.officeTitle}当前考成：功绩${scores.merit}，风险${scores.risk}。`,
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
  const playerPosting = buildPlayerPosting(worldState, jurisdictionRows);
  const playerAssessment = buildPlayerAssessmentRecord(worldState, playerPosting);

  return {
    bureaus: bureauRows,
    offices: officeRows,
    cityJurisdictions: jurisdictionRows,
    postings: [playerPosting].filter(Boolean),
    assessmentRecords: [playerAssessment].filter(Boolean),
    transferRecords: buildTransferRecords(worldState, jurisdictionRows),
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
