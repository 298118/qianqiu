const { buildEconomicFiscalRetrievalRows, buildEconomicFiscalView } = require("./economicFiscal");
const { buildExamCalendarView } = require("./examCalendar");
const { TRAVEL_PLANS, getTravelPlan } = require("./examTravel");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const {
  buildMilitaryDiplomacyRetrievalRows,
  buildMilitaryDiplomacyView
} = require("./militaryDiplomacy");
const { buildOfficialPostingsView } = require("./officialPostings");
const { formatYearMonthPeriod } = require("./time");
const { buildWorldGeographyView } = require("./worldGeography");
const {
  MAP_CONTEXT_LIMITS,
  MAP_CONTEXT_SCHEMA_VERSION,
  MAP_DISTANCE_BUDGETS,
  MAP_ENTITY_REF_SCHEMA_VERSION,
  MAP_ENTITY_TYPES,
  MAP_JURISDICTION_BUDGETS,
  MAP_MOVEMENT_TYPE_IDS,
  MAP_MOVEMENT_TYPES,
  MAP_VISIBILITY_VALUES
} = require("./mapContextConfig");

const MAX_TEXT_LENGTH = MAP_CONTEXT_LIMITS.maxSummaryLength;
const MAP_REF_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const SENSITIVE_MAP_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|coordinate|coords?)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite|coordinate|coords?|latitude|longitude|lat|lng)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|MIMO_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const ROLE_FALLBACK_PROFILES = Object.freeze({
  scholar: Object.freeze({
    actorType: "scholar",
    authorityTier: "T1",
    readDomains: ["study", "exam", "people", "events", "geography"],
    allowedToolGroups: ["map"]
  }),
  magistrate: Object.freeze({
    actorType: "magistrate",
    authorityTier: "T3",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market"],
    allowedToolGroups: ["map"]
  }),
  general: Object.freeze({
    actorType: "general",
    authorityTier: "T4",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market", "military", "diplomacy"],
    allowedToolGroups: ["map"]
  }),
  official: Object.freeze({
    actorType: "minister",
    authorityTier: "T4",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market", "career"],
    allowedToolGroups: ["map"]
  }),
  minister: Object.freeze({
    actorType: "minister",
    authorityTier: "T4",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market", "military", "diplomacy", "career"],
    allowedToolGroups: ["map"]
  }),
  emperor: Object.freeze({
    actorType: "emperor",
    authorityTier: "T5",
    readDomains: ["office", "local_docket", "geography", "people", "events", "intel", "market", "military", "diplomacy", "career"],
    allowedToolGroups: ["map"]
  })
});

const EXAM_DESTINATION_CITY_BY_LEVEL = Object.freeze({
  child_exam: "city-suzhou",
  provincial_exam: "city-nanjing",
  metropolitan_exam: "city-beijing",
  palace_exam: "city-beijing"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SENSITIVE_MAP_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(String(value ?? ""), fallback, 120);
  const normalized = text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function cleanMapRefId(value, fallback = "") {
  const text = cleanText(String(value ?? ""), fallback, 160);
  if (!text || !MAP_REF_ID_PATTERN.test(text)) return fallback;
  return text;
}

function unique(values, limit = 12) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = cleanMapRefId(value, "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeVisibility(value, fallback = "public") {
  const text = cleanId(value, fallback);
  return MAP_VISIBILITY_VALUES.includes(text) ? text : fallback;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function fallbackActorProfile(worldState = {}) {
  const role = cleanId(worldState.player?.role, "scholar");
  const fallback = ROLE_FALLBACK_PROFILES[role] || ROLE_FALLBACK_PROFILES.scholar;
  return {
    actorId: `player:${cleanId(worldState.player?.id, "P1")}`,
    actorType: fallback.actorType,
    authorityTier: fallback.authorityTier,
    allowedToolGroups: [...fallback.allowedToolGroups],
    forbiddenToolGroups: [],
    visibilityProfile: {
      readDomains: [...fallback.readDomains]
    },
    jurisdictionRefs: []
  };
}

function normalizeActorProfile(worldState, actorProfile) {
  if (actorProfile && typeof actorProfile === "object") return actorProfile;
  return fallbackActorProfile(worldState);
}

function actorReadDomains(actorProfile = {}) {
  const domains = actorProfile.visibilityProfile?.readDomains;
  return new Set(Array.isArray(domains) ? domains : []);
}

function actorToolGroups(actorProfile = {}) {
  return new Set(Array.isArray(actorProfile.allowedToolGroups) ? actorProfile.allowedToolGroups : []);
}

function actorCanUseMap(actorProfile = {}) {
  if (!actorProfile.actorId) return true;
  const groups = actorToolGroups(actorProfile);
  const forbidden = new Set(Array.isArray(actorProfile.forbiddenToolGroups) ? actorProfile.forbiddenToolGroups : []);
  return groups.has("map") && !forbidden.has("map");
}

function authorityRank(tier = "T0") {
  const parsed = /^T(\d)$/i.exec(String(tier || ""));
  return parsed ? Number(parsed[1]) : 0;
}

function domainVisibleToActor(domain, actorProfile = {}) {
  if (!actorProfile.actorId) return true;
  const readDomains = actorReadDomains(actorProfile);
  const groups = actorToolGroups(actorProfile);

  if (domain === "geography") return readDomains.has("geography") || groups.has("world_read");
  if (domain === "exam") return readDomains.has("exam") || groups.has("exam");
  if (domain === "office") return readDomains.has("office") || readDomains.has("career") || groups.has("office_read") || groups.has("career");
  if (domain === "local_affairs") return readDomains.has("local_docket") || groups.has("judicial") || groups.has("city_policy");
  if (domain === "military") return readDomains.has("military") || readDomains.has("diplomacy") || groups.has("military") || groups.has("diplomacy");
  if (domain === "economic") return readDomains.has("market") || groups.has("market") || groups.has("city_policy");
  return true;
}

function visibilityAllowed(ref, actorProfile = {}) {
  if (!ref || ref.visibility === "hidden") return false;
  if (!domainVisibleToActor(ref.domain, actorProfile)) return false;
  if (["public", "rumor", "player_visible", "actor_visible", "exam_visible"].includes(ref.visibility)) return true;
  if (ref.visibility === "role_visible") return authorityRank(actorProfile.authorityTier) >= 2;
  if (ref.visibility === "office_visible") return domainVisibleToActor("office", actorProfile) || domainVisibleToActor("local_affairs", actorProfile);
  if (ref.visibility === "military_visible") return domainVisibleToActor("military", actorProfile);
  if (ref.visibility === "market_visible") return domainVisibleToActor("economic", actorProfile);
  return false;
}

function typeConfig(entityType) {
  return MAP_ENTITY_TYPES[entityType] || MAP_ENTITY_TYPES.city;
}

function mapRefId(domain, entityType, entityId) {
  return cleanMapRefId(`map:${domain}:${entityType}:${entityId}`, "");
}

function relatedRef(domain, entityType, entityId) {
  const id = cleanId(entityId, "");
  return id ? mapRefId(domain, entityType, id) : "";
}

function relatedRefsForRow(row = {}) {
  return unique([
    relatedRef("geography", "country", row.countryId),
    relatedRef("geography", "country", row.neighborCountryId),
    relatedRef("geography", "region", row.regionId),
    relatedRef("geography", "city", row.cityId),
    relatedRef("geography", "jurisdiction", row.jurisdictionId),
    relatedRef("office", "posting", row.postingId),
    relatedRef("geography", "frontier_zone", row.frontierZoneId),
    relatedRef("geography", "route", row.routeId),
    ...asArray(row.countryIds).map((id) => relatedRef("geography", "country", id)),
    ...asArray(row.cityIds).map((id) => relatedRef("geography", "city", id)),
    ...asArray(row.relatedCityIds).map((id) => relatedRef("geography", "city", id)),
    ...asArray(row.routeIds).map((id) => relatedRef("geography", "route", id)),
    ...asArray(row.relatedRouteIds).map((id) => relatedRef("geography", "route", id)),
    ...asArray(row.frontierZoneIds).map((id) => relatedRef("geography", "frontier_zone", id))
  ], MAP_CONTEXT_LIMITS.maxRelatedRefs);
}

function priorityFor(row = {}) {
  return Math.max(
    clampNumber(row.priority, 0, 200, 0),
    clampNumber(row.pressure, 0, 100, 0),
    clampNumber(row.risk, 0, 100, 0),
    clampNumber(row.pressureScore, 0, 100, 0),
    clampNumber(row.threatScore, 0, 100, 0),
    clampNumber(row.tradeRisk, 0, 100, 0),
    clampNumber(row.severity, 0, 5, 0) * 20
  );
}

function buildMapEntityRef(entity = {}, domain = "geography", options = {}) {
  if (!isPlainObject(entity)) return null;
  const safeDomain = cleanId(domain, "geography");
  const entityType = MAP_ENTITY_TYPES[options.entityType] ? options.entityType : cleanId(options.entityType || entity.entityType, "city");
  if (!MAP_ENTITY_TYPES[entityType]) return null;
  const entityId = cleanId(options.entityId || entity.id || entity.sourceId || entity.examLevel, "");
  if (!entityId) return null;
  const label = cleanText(
    options.label || entity.name || entity.title || entity.officeTitle || entity.examName || entity.kindLabel || entityId,
    "",
    80
  );
  if (!label) return null;
  const sourceView = cleanText(options.sourceView || typeConfig(entityType).sourceView, typeConfig(entityType).sourceView, 96);
  const refId = cleanMapRefId(options.refId, "") || mapRefId(safeDomain, entityType, entityId);
  if (!refId) return null;

  return {
    schemaVersion: MAP_ENTITY_REF_SCHEMA_VERSION,
    refId,
    mapKey: `${entityType}:${entityId}`,
    domain: safeDomain,
    entityType,
    entityId,
    label,
    typeLabel: typeConfig(entityType).label,
    sourceView,
    jumpTarget: {
      sourceView,
      id: entityId
    },
    visibility: normalizeVisibility(options.visibility || entity.visibility, "public"),
    summary: cleanText(
      options.summary || entity.publicSummary || entity.publicDocket || entity.publicFinding || entity.summary || "",
      "",
      140
    ),
    statusLabel: cleanText(entity.statusLabel || entity.status || "", "", 40),
    riskLabel: cleanText(entity.riskLabel || entity.kindLabel || "", "", 40),
    distanceLabel: cleanText(entity.distanceLabel || options.distanceLabel || "", "", 60),
    pressure: clampNumber(entity.pressure ?? entity.pressureScore ?? entity.risk ?? entity.threatScore, 0, 100, 0),
    confidence: clampNumber(entity.intelConfidence ?? entity.confidence ?? 70, 0, 100, 70),
    priority: clampNumber(options.priority ?? priorityFor(entity), 0, 300, 0),
    parentRefs: unique(options.parentRefs || relatedRefsForRow(entity), MAP_CONTEXT_LIMITS.maxRelatedRefs),
    relatedRefs: unique(options.relatedRefs || relatedRefsForRow(entity), MAP_CONTEXT_LIMITS.maxRelatedRefs),
    lastUpdatedTurn: clampNumber(entity.lastUpdatedTurn ?? options.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function pushRef(refs, ref) {
  if (ref) refs.push(ref);
}

function buildGeographyRefs(worldState, geographyView) {
  const refs = [];
  for (const country of asArray(geographyView.countries)) {
    pushRef(refs, buildMapEntityRef(country, "geography", {
      entityType: "country",
      relatedRefs: [relatedRef("geography", "city", country.capitalCityId)].filter(Boolean)
    }));
  }
  for (const region of asArray(geographyView.regions)) {
    pushRef(refs, buildMapEntityRef(region, "geography", {
      entityType: "region",
      parentRefs: [relatedRef("geography", "country", region.countryId)].filter(Boolean),
      relatedRefs: [relatedRef("geography", "city", region.seatCityId)].filter(Boolean)
    }));
  }
  for (const city of asArray(geographyView.cities)) {
    pushRef(refs, buildMapEntityRef(city, "geography", {
      entityType: "city",
      parentRefs: [
        relatedRef("geography", "country", city.countryId),
        relatedRef("geography", "region", city.regionId)
      ].filter(Boolean),
      priority: priorityFor(city) + (city.jurisdictionLevel === "capital" ? 25 : 0)
    }));
  }
  for (const route of asArray(geographyView.routes)) {
    pushRef(refs, buildMapEntityRef(route, "geography", {
      entityType: "route",
      relatedRefs: unique([
        relatedRef("geography", "city", route.fromCityId),
        relatedRef("geography", "city", route.toCityId),
        ...asArray(route.viaCityIds).map((id) => relatedRef("geography", "city", id))
      ])
    }));
  }
  for (const frontier of asArray(geographyView.frontierZones)) {
    pushRef(refs, buildMapEntityRef(frontier, "geography", {
      entityType: "frontier_zone",
      relatedRefs: unique([
        relatedRef("geography", "country", frontier.countryId),
        relatedRef("geography", "country", frontier.neighborCountryId),
        ...asArray(frontier.cityIds).map((id) => relatedRef("geography", "city", id)),
        ...asArray(frontier.routeIds).map((id) => relatedRef("geography", "route", id))
      ]),
      priority: priorityFor(frontier) + 10
    }));
  }
  for (const jurisdiction of asArray(geographyView.officeJurisdictions)) {
    pushRef(refs, buildMapEntityRef(jurisdiction, "geography", {
      entityType: "jurisdiction",
      visibility: jurisdiction.visibility === "public" ? "role_visible" : jurisdiction.visibility,
      relatedRefs: unique([
        ...asArray(jurisdiction.countryIds).map((id) => relatedRef("geography", "country", id)),
        ...asArray(jurisdiction.cityIds).map((id) => relatedRef("geography", "city", id)),
        ...asArray(jurisdiction.routeIds).map((id) => relatedRef("geography", "route", id)),
        ...asArray(jurisdiction.frontierZoneIds).map((id) => relatedRef("geography", "frontier_zone", id))
      ])
    }));
  }
  return refs.map((ref) => ({
    ...ref,
    lastUpdatedTurn: ref.lastUpdatedTurn || currentTurn(worldState)
  }));
}

function buildOfficeRefs(officialView = {}) {
  const refs = [];
  for (const posting of asArray(officialView.postings)) {
    pushRef(refs, buildMapEntityRef(posting, "office", {
      entityType: "posting",
      label: posting.officeTitle || posting.title || posting.id,
      visibility: posting.holderType === "player" ? "player_visible" : "office_visible",
      priority: posting.holderType === "player" ? 105 : 64
    }));
  }
  for (const transfer of asArray(officialView.transferRecords)) {
    pushRef(refs, buildMapEntityRef(transfer, "office", {
      entityType: "transfer",
      label: transfer.publicReason || transfer.type || transfer.id,
      visibility: "office_visible",
      priority: 58,
      relatedRefs: unique([
        relatedRef("geography", "city", transfer.fromCityId),
        relatedRef("geography", "city", transfer.toCityId),
        relatedRef("office", "posting", transfer.postingId)
      ])
    }));
  }
  return refs;
}

function buildLocalAffairsRefs(localView = {}) {
  const refs = [];
  for (const docket of asArray(localView.dockets)) {
    pushRef(refs, buildMapEntityRef(docket, "local_affairs", {
      entityType: "docket",
      visibility: docket.visibility === "office_visible" ? "office_visible" : "role_visible",
      priority: priorityFor(docket) + 58
    }));
  }
  return refs;
}

function buildMilitaryRefs(worldState = {}) {
  return buildMilitaryDiplomacyRetrievalRows(worldState)
    .map((report) => buildMapEntityRef(report, "military", {
      entityType: "military_report",
      label: report.title || report.type || report.id,
      visibility: "military_visible",
      priority: priorityFor(report) + 12
    }))
    .filter(Boolean);
}

function buildEconomicRefs(worldState = {}) {
  return buildEconomicFiscalRetrievalRows(worldState)
    .map((report) => buildMapEntityRef(report, "economic", {
      entityType: "economic_report",
      label: report.title || report.type || report.id,
      visibility: "market_visible",
      priority: priorityFor(report) + 8
    }))
    .filter(Boolean);
}

function examDestinationCityId(level, geographyView = {}) {
  const configured = EXAM_DESTINATION_CITY_BY_LEVEL[level];
  if (configured && asArray(geographyView.cities).some((city) => city.id === configured)) return configured;
  const academyCity = asArray(geographyView.cities)
    .slice()
    .sort((first, second) => (second.academyLevel || 0) - (first.academyLevel || 0))
    .find((city) => city.id);
  return academyCity?.id || "";
}

function buildExamTravelRef(worldState, geographyView = {}) {
  const calendar = buildExamCalendarView(worldState);
  const nextExam = calendar.nextExam;
  if (!nextExam?.level) return null;
  const plan = getTravelPlan(nextExam.level);
  const cityId = examDestinationCityId(nextExam.level, geographyView);
  return buildMapEntityRef({
    id: `exam-travel-${nextExam.level}`,
    examLevel: nextExam.level,
    examName: nextExam.examName,
    title: `赴${nextExam.examName}`,
    publicSummary: `${nextExam.examName}赶考行程：${plan.event}；约需${nextExam.travelMonths || 0}月，盘费与时令由服务器复核。`,
    distanceLabel: plan.distance,
    statusLabel: nextExam.statusLabel || nextExam.status || "",
    lastUpdatedTurn: currentTurn(worldState)
  }, "exam", {
    entityType: "exam_travel",
    visibility: "exam_visible",
    relatedRefs: [relatedRef("geography", "city", cityId)].filter(Boolean),
    priority: 120
  });
}

function createRefIndex(refs = []) {
  const index = new Map();
  for (const ref of refs) {
    if (!ref?.refId) continue;
    index.set(ref.refId, ref);
    index.set(`${ref.domain}:${ref.entityType}:${ref.entityId}`, ref);
    index.set(`${ref.entityType}:${ref.entityId}`, ref);
  }
  return index;
}

function lookupRef(index, domain, entityType, entityId) {
  const id = cleanId(entityId, "");
  if (!id) return null;
  return index.get(`${domain}:${entityType}:${id}`) || index.get(`${entityType}:${id}`) || null;
}

function refsForRow(row = {}, index) {
  const refs = [
    lookupRef(index, "geography", "city", row.cityId),
    lookupRef(index, "geography", "region", row.regionId),
    lookupRef(index, "geography", "country", row.countryId),
    lookupRef(index, "geography", "country", row.neighborCountryId),
    lookupRef(index, "geography", "jurisdiction", row.jurisdictionId),
    lookupRef(index, "office", "posting", row.postingId),
    lookupRef(index, "geography", "frontier_zone", row.frontierZoneId),
    lookupRef(index, "geography", "route", row.routeId),
    ...asArray(row.cityIds).map((id) => lookupRef(index, "geography", "city", id)),
    ...asArray(row.relatedCityIds).map((id) => lookupRef(index, "geography", "city", id)),
    ...asArray(row.routeIds).map((id) => lookupRef(index, "geography", "route", id)),
    ...asArray(row.relatedRouteIds).map((id) => lookupRef(index, "geography", "route", id)),
    ...asArray(row.frontierZoneIds).map((id) => lookupRef(index, "geography", "frontier_zone", id))
  ].filter(Boolean);
  const seen = new Set();
  return refs.filter((ref) => {
    if (seen.has(ref.refId)) return false;
    seen.add(ref.refId);
    return true;
  }).slice(0, 5);
}

function compactRef(ref = {}) {
  return {
    refId: ref.refId,
    mapKey: ref.mapKey,
    entityType: ref.entityType,
    label: ref.label,
    sourceView: ref.sourceView,
    jumpTarget: ref.jumpTarget
  };
}

function buildHook(sourceType, sourceView, row, index, options = {}) {
  const refs = refsForRow(row, index);
  if (!refs.length) return null;
  const sourceId = cleanId(row.id || row.sourceId || row.templateId || sourceType, sourceType);
  const title = cleanText(options.title || row.title || row.officeTitle || row.kindLabel || row.type || sourceType, sourceType, 80);
  const summary = cleanText(options.summary || row.publicSummary || row.publicDocket || row.summary || row.publicReason || "", "", 140);
  if (!summary) return null;
  return {
    hookId: cleanId(`map-hook-${sourceType}-${sourceId}`, `map-hook-${sourceType}`),
    sourceDomain: cleanId(options.sourceDomain, "geography"),
    sourceType,
    sourceView,
    sourceId,
    title,
    publicSummary: summary,
    statusLabel: cleanText(row.statusLabel || row.status || "", "", 40),
    riskLabel: cleanText(row.riskLabel || row.kindLabel || "", "", 40),
    mapEntityRefs: refs.map(compactRef),
    visibility: normalizeVisibility(options.visibility || row.visibility, "role_visible"),
    authorityBoundary: "地图 hook 只把公开 projection 关联到稳定地点引用；移动、调兵、赴任、赈济、市场与外交后果仍由服务器裁决。"
  };
}

function hookPriority(hook = {}) {
  const weights = {
    border_incident: 90,
    market_incident: 82,
    official_posting: 76,
    official_transfer: 72,
    disaster_docket: 68,
    local_docket: 62,
    exam_travel: 58
  };
  return weights[hook.sourceType] || 40;
}

function buildEventHooks(worldState, views, refs) {
  const index = createRefIndex(refs);
  const hooks = [];
  const pushHook = (hook) => {
    if (hook) hooks.push(hook);
  };

  for (const docket of asArray(views.localAffairs.dockets)) {
    const sourceType = ["relief", "waterworks", "epidemic"].includes(docket.domain) ? "disaster_docket" : "local_docket";
    pushHook(buildHook(sourceType, "localAffairsDocketView.dockets", docket, index, {
      sourceDomain: "local_affairs"
    }));
  }

  for (const incident of asArray(views.military.frontierIncidents)) {
    pushHook(buildHook("border_incident", "militaryDiplomacyView.frontierIncidents", incident, index, {
      sourceDomain: "military",
      visibility: "military_visible"
    }));
  }

  for (const incident of asArray(views.economic.marketIncidents)) {
    pushHook(buildHook("market_incident", "economicFiscalView.marketIncidents", incident, index, {
      sourceDomain: "economic",
      visibility: "market_visible"
    }));
  }

  for (const posting of asArray(views.official.postings)) {
    pushHook(buildHook("official_posting", "officialPostingsView.postings", posting, index, {
      sourceDomain: "office",
      title: posting.officeTitle || posting.id,
      visibility: posting.holderType === "player" ? "player_visible" : "office_visible"
    }));
  }

  for (const transfer of asArray(views.official.transferRecords)) {
    pushHook(buildHook("official_transfer", "officialPostingsView.transferRecords", transfer, index, {
      sourceDomain: "office",
      title: transfer.publicReason || transfer.type || transfer.id,
      visibility: "office_visible"
    }));
  }

  const examRef = refs.find((ref) => ref.domain === "exam" && ref.entityType === "exam_travel");
  if (examRef) {
    pushHook({
      hookId: cleanId(`map-hook-exam-travel-${examRef.entityId}`, "map-hook-exam-travel"),
      sourceType: "exam_travel",
      sourceDomain: "exam",
      sourceView: "examCalendarView.nextExam",
      sourceId: examRef.entityId,
      title: examRef.label,
      publicSummary: examRef.summary,
      statusLabel: examRef.statusLabel,
      riskLabel: "赶考",
      mapEntityRefs: [compactRef(examRef)],
      visibility: "exam_visible",
      authorityBoundary: "赶考行程只作为地图引用和 proposal 证据；开考资格、盘费、入场与晋级仍由服务器裁决。"
    });
  }

  return hooks
    .sort((first, second) => hookPriority(second) - hookPriority(first) || first.hookId.localeCompare(second.hookId))
    .map((hook) => ({ ...hook, generatedAtTurn: currentTurn(worldState) }));
}

function compareRefs(first, second) {
  if ((second.priority || 0) !== (first.priority || 0)) return (second.priority || 0) - (first.priority || 0);
  return first.refId.localeCompare(second.refId);
}

function capRefs(refs, actorProfile = {}) {
  const budgetKey = authorityRank(actorProfile.authorityTier) >= 5
    ? "imperial_broad"
    : authorityRank(actorProfile.authorityTier) >= 4
    ? "court_domain"
    : authorityRank(actorProfile.authorityTier) >= 3
    ? "local_office"
    : actorProfile.actorType === "scholar"
    ? "scholar"
    : "public";
  const maxByBudget = MAP_JURISDICTION_BUDGETS[budgetKey]?.maxRefs || MAP_CONTEXT_LIMITS.maxEntityRefs;
  const maxRefs = Math.min(maxByBudget, MAP_CONTEXT_LIMITS.maxEntityRefs);
  const perType = new Map();
  const seen = new Set();
  const result = [];
  for (const ref of refs.slice().sort(compareRefs)) {
    if (!ref?.refId || seen.has(ref.refId)) continue;
    const typeCount = perType.get(ref.entityType) || 0;
    if (typeCount >= MAP_CONTEXT_LIMITS.maxRefsPerType) continue;
    perType.set(ref.entityType, typeCount + 1);
    seen.add(ref.refId);
    result.push(ref);
    if (result.length >= maxRefs) break;
  }
  return result;
}

function movementTypesForActor(actorProfile = {}) {
  if (!actorCanUseMap(actorProfile)) return [];
  const actorType = cleanId(actorProfile.actorType, "");
  const readDomains = actorReadDomains(actorProfile);
  return MAP_MOVEMENT_TYPE_IDS
    .map((type) => ({ type, ...MAP_MOVEMENT_TYPES[type] }))
    .filter((entry) => (
      (!actorType || entry.allowedActorTypes.includes(actorType)) &&
      (!entry.readDomains.length || entry.readDomains.some((domain) => readDomains.has(domain)))
    ))
    .map((entry) => ({
      type: entry.type,
      label: entry.label,
      distanceBudgets: entry.distanceBudgets.map((key) => ({
        key,
        label: MAP_DISTANCE_BUDGETS[key]?.label || key
      })),
      riskTags: [...entry.riskTags],
      authorityBoundary: "只可提交地图移动 proposal；路线合法性、消耗、战和、任免、考试资格与落库由服务器裁决。"
    }));
}

function filterMapContextByVisibility(mapContext = {}, actorProfile = {}) {
  const filteredRefs = capRefs(asArray(mapContext.mapEntityRefs).filter((ref) => visibilityAllowed(ref, actorProfile)), actorProfile);
  const refIds = new Set(filteredRefs.map((ref) => ref.refId));
  const eventHooks = asArray(mapContext.mapEventHooks)
    .map((hook) => ({
      ...hook,
      mapEntityRefs: asArray(hook.mapEntityRefs).filter((ref) => refIds.has(ref.refId))
    }))
    .filter((hook) => hook.mapEntityRefs.length)
    .filter((hook) => visibilityAllowed({ domain: hook.sourceDomain || "geography", visibility: hook.visibility }, actorProfile))
    .slice(0, MAP_CONTEXT_LIMITS.maxEventHooks);

  return {
    ...mapContext,
    actorScope: {
      actorId: cleanText(actorProfile.actorId, "actor:unknown", 96),
      actorType: cleanText(actorProfile.actorType, "unknown", 40),
      authorityTier: cleanText(actorProfile.authorityTier, "T0", 4),
      jurisdictionRefs: unique(actorProfile.jurisdictionRefs || [], 8),
      readDomains: [...actorReadDomains(actorProfile)].slice(0, 12),
      mapToolVisible: actorCanUseMap(actorProfile)
    },
    mapEntityRefs: filteredRefs,
    mapEventHooks: eventHooks,
    movementTypes: movementTypesForActor(actorProfile),
    counts: {
      totalRefs: filteredRefs.length,
      eventHooks: eventHooks.length,
      byType: filteredRefs.reduce((counts, ref) => {
        counts[ref.entityType] = (counts[ref.entityType] || 0) + 1;
        return counts;
      }, {})
    }
  };
}

function buildMapContextView(worldState = {}, actorProfile = null, options = {}) {
  const actor = normalizeActorProfile(worldState, actorProfile);
  const geography = buildWorldGeographyView(worldState);
  const official = buildOfficialPostingsView(worldState);
  const localAffairs = buildLocalAffairsDocketView(worldState);
  const military = buildMilitaryDiplomacyView(worldState);
  const economic = buildEconomicFiscalView(worldState);
  const refs = [
    ...buildGeographyRefs(worldState, geography),
    ...buildOfficeRefs(official),
    ...buildLocalAffairsRefs(localAffairs),
    ...buildMilitaryRefs(worldState),
    ...buildEconomicRefs(worldState)
  ];
  const examRef = buildExamTravelRef(worldState, geography);
  if (examRef) refs.push(examRef);

  const mapContext = {
    schemaVersion: MAP_CONTEXT_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    dateLabel: formatYearMonthPeriod(worldState),
    sourceViews: [
      "worldGeographyView",
      "officialPostingsView",
      "localAffairsDocketView",
      "militaryDiplomacyView",
      "economicFiscalView",
      "examCalendarView"
    ],
    mapEntityRefs: refs,
    mapEventHooks: buildEventHooks(worldState, { geography, official, localAffairs, military, economic }, refs),
    movementTypes: [],
    distanceBudgets: Object.fromEntries(Object.entries(MAP_DISTANCE_BUDGETS).map(([key, value]) => [key, {
      label: value.label,
      turnBudget: value.turnBudget,
      summary: value.summary
    }])),
    hiddenNotice: "mapContextView 只含服务器安全投影与稳定地点引用；不含原始坐标表、未公开敌情、模型原文、数据库底表、本地路径或密钥。",
    authorityBoundary: "AI 可读取地图摘要并提交 movement proposal；移动、行军、赴任、赶考、外交、商路后果和持久化仍由服务器裁决。"
  };

  const filtered = filterMapContextByVisibility(mapContext, actor);
  if (options.promptCap === true) return summarizeMapContextForPrompt(filtered, options);
  return filtered;
}

function compactPromptRef(ref = {}) {
  return {
    refId: ref.refId,
    type: ref.entityType,
    label: ref.label,
    domain: ref.domain,
    statusLabel: ref.statusLabel,
    riskLabel: ref.riskLabel,
    distanceLabel: ref.distanceLabel,
    summary: cleanText(ref.summary, "", 100),
    relatedRefs: unique(ref.relatedRefs, 4)
  };
}

function summarizeMapContextForPrompt(mapContextOrWorldState = {}, options = {}) {
  const view = Array.isArray(mapContextOrWorldState.mapEntityRefs)
    ? mapContextOrWorldState
    : buildMapContextView(mapContextOrWorldState, options.actorProfile || null);
  const refs = asArray(view.mapEntityRefs);
  const places = refs
    .filter((ref) => ["country", "region", "city", "jurisdiction", "posting", "exam_travel"].includes(ref.entityType))
    .slice(0, MAP_CONTEXT_LIMITS.maxPromptPlaces)
    .map(compactPromptRef);
  const routes = refs
    .filter((ref) => ref.entityType === "route")
    .slice(0, MAP_CONTEXT_LIMITS.maxPromptRoutes)
    .map(compactPromptRef);
  const frontiers = refs
    .filter((ref) => ["frontier_zone", "military_report"].includes(ref.entityType))
    .slice(0, MAP_CONTEXT_LIMITS.maxPromptFrontiers)
    .map(compactPromptRef);
  const hooks = asArray(view.mapEventHooks)
    .slice(0, MAP_CONTEXT_LIMITS.maxPromptHooks)
    .map((hook) => ({
      sourceType: hook.sourceType,
      sourceId: hook.sourceId,
      title: hook.title,
      publicSummary: cleanText(hook.publicSummary, "", 100),
      mapRefs: asArray(hook.mapEntityRefs).map((ref) => ref.refId).slice(0, 4)
    }));

  return {
    schemaVersion: MAP_CONTEXT_SCHEMA_VERSION,
    generatedAtTurn: view.generatedAtTurn,
    dateLabel: view.dateLabel,
    source: "mapContextView",
    actorScope: view.actorScope,
    movementTypes: asArray(view.movementTypes).map((type) => ({
      type: type.type,
      label: type.label,
      riskTags: type.riskTags
    })),
    places,
    routes,
    frontiers,
    hooks,
    safety: {
      visibility: "只读服务器可见 mapContextView 与 capped 摘要；不读取原始坐标表或未公开敌情真值。",
      authority: "模型只能提交 map.propose_route_or_geopolitical_move 意图；路线、消耗、后果和落库由服务器裁决。"
    }
  };
}

module.exports = {
  buildMapContextView,
  buildMapEntityRef,
  filterMapContextByVisibility,
  summarizeMapContextForPrompt
};
