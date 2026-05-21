const { buildEventArchiveIndexItems } = require("./eventArchive");
const { buildDomainConsequenceView } = require("./domainConsequenceTrace");
const { buildEconomicFiscalRetrievalRows } = require("./economicFiscal");
const { buildHistoricalEventRetrievalRows } = require("./historicalEventArchive");
const { buildIntelligenceRumorRetrievalRows } = require("./intelligenceRumors");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyRetrievalRows } = require("./militaryDiplomacy");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");

const SAFE_WORLD_SEARCH_SCHEMA_VERSION = 1;
const SAFE_WORLD_SEARCH_SOURCE = "server_visible_safe_search_projection";
const SAFE_WORLD_SEARCH_DEFAULT_PAGE_SIZE = 10;
const SAFE_WORLD_SEARCH_MAX_PAGE_SIZE = 25;
const SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH = 80;
const SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH = 180;
const SAFE_WORLD_SEARCH_MAX_SEARCH_TEXT_LENGTH = 1400;
const SAFE_WORLD_SEARCH_MAX_ROWS = 1200;

const SAFE_SEARCH_DOMAINS = Object.freeze([
  "geography",
  "people",
  "offices",
  "events",
  "reports",
  "rumors"
]);

const DOMAIN_ALIASES = Object.freeze({
  city: "geography",
  cities: "geography",
  country: "geography",
  countries: "geography",
  route: "geography",
  routes: "geography",
  npc: "people",
  npcs: "people",
  person: "people",
  people: "people",
  office: "offices",
  offices: "offices",
  posting: "offices",
  postings: "offices",
  event: "events",
  events: "events",
  archive: "events",
  consequence: "events",
  consequences: "events",
  report: "reports",
  reports: "reports",
  docket: "reports",
  dockets: "reports",
  rumor: "rumors",
  rumors: "rumors",
  intel: "rumors",
  intelligence: "rumors"
});

const ALLOWED_VISIBILITIES = new Set([
  "public",
  "player_visible",
  "relationship_visible",
  "office_visible",
  "role_visible",
  "known",
  "visible"
]);

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_SEARCH_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|relationshipLedger|actorMemoryLedger|sessionSummary|retrievalContext|sealedMapping|sealed_mapping|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row)|(?:outcome[_ -]?id|evidence[_ -]?refs?|state[_ -]?delta|player[_ -]?delta|resource[_ -]?(?:use|cost)|relationship[_ -]?signals?|audit[_ -]?record)|\b(?:cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizePage(value) {
  return clampNumber(value, 1, Number.MAX_SAFE_INTEGER, 1);
}

function normalizePageSize(value) {
  return clampNumber(value, 1, SAFE_WORLD_SEARCH_MAX_PAGE_SIZE, SAFE_WORLD_SEARCH_DEFAULT_PAGE_SIZE);
}

function redactSearchText(value) {
  let text = String(value ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const raw = String(secret);
    const variants = new Set([raw, raw.slice(0, 8), raw.slice(0, 12), raw.slice(-8), raw.slice(-12)]);
    for (const variant of variants) {
      if (variant && variant.length >= 8) text = text.split(variant).join("[redacted]");
    }
  }

  text = text.replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, "[redacted]");
  text = text.replace(/\btp-[A-Za-z0-9_-]{6,}\b/g, "[redacted]");
  text = text.replace(/\bfile:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+/gi, "[redacted-path]");
  text = text.replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]");
  text = text.replace(/(^|\s)(?:\.{0,2}[\\/])?data[\\/][^\s"'<>]+/g, "$1[redacted-path]");
  text = text.replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+/g, "[redacted-path]");
  return text;
}

function cleanSearchText(value, fallback = "", maxLength = SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  const redacted = redactSearchText(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_SEARCH_TEXT_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function cleanSearchId(value, fallback = "") {
  const text = cleanSearchText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function unique(values, limit = 8) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanSearchText(value, "", 80);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeTerms(query) {
  const terms = [];
  const seen = new Set();
  const add = (term) => {
    const normalized = String(term || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    terms.push(normalized);
  };

  add(query);
  for (const term of String(query || "").split(/[^\p{L}\p{N}_.:-]+/u)) {
    add(term);
    if (terms.length >= 8) break;
  }
  return terms.slice(0, 8);
}

function normalizeSearchQuery(query) {
  const raw = typeof query === "string" ? query.replace(/\s+/g, " ").trim() : "";
  const rawLength = raw.length;
  if (!raw) {
    return {
      query: "",
      terms: [],
      rejected: false,
      truncated: false,
      rawLength,
      maxLength: SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH
    };
  }

  const truncated = rawLength > SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH;
  const candidate = raw.slice(0, SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH);
  const redacted = redactSearchText(candidate).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_SEARCH_TEXT_PATTERN.test(raw) || SENSITIVE_SEARCH_TEXT_PATTERN.test(redacted)) {
    return {
      query: "",
      terms: [],
      rejected: true,
      truncated,
      rawLength,
      maxLength: SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH
    };
  }

  return {
    query: redacted,
    terms: normalizeTerms(redacted),
    rejected: false,
    truncated,
    rawLength,
    maxLength: SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH
  };
}

function normalizeDomainValue(value) {
  const candidate = cleanSearchText(value, "", 32).toLowerCase();
  return DOMAIN_ALIASES[candidate] || (SAFE_SEARCH_DOMAINS.includes(candidate) ? candidate : "");
}

function normalizeDomainFilter(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  const domains = unique(values.map(normalizeDomainValue).filter(Boolean), SAFE_SEARCH_DOMAINS.length);
  return domains;
}

function normalizeVisibility(value) {
  const visibility = cleanSearchText(value, "public", 32).toLowerCase();
  if (!visibility) return "public";
  if (!ALLOWED_VISIBILITIES.has(visibility)) return "";
  return visibility;
}

function confidenceFrom(...values) {
  const number = values.map(Number).find(Number.isFinite);
  return clampNumber(number, 0, 100, 70);
}

function relatedRef(type, id, label) {
  const cleanId = cleanSearchId(id, "");
  if (!cleanId) return null;
  return {
    type: cleanSearchText(type, "ref", 32),
    id: cleanId,
    label: cleanSearchText(label, cleanId, 60)
  };
}

function normalizeRelatedRefs(refs = []) {
  const normalized = [];
  const seen = new Set();
  for (const ref of Array.isArray(refs) ? refs : []) {
    const entry = isPlainObject(ref)
      ? relatedRef(ref.type || ref.sourceType || ref.domain, ref.id || ref.sourceId, ref.label || ref.title || ref.name)
      : null;
    if (!entry) continue;
    const key = `${entry.type}:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(entry);
    if (normalized.length >= 8) break;
  }
  return normalized;
}

function makeSearchText(parts) {
  return parts
    .flat()
    .map((part) => cleanSearchText(part, "", 240))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SAFE_WORLD_SEARCH_MAX_SEARCH_TEXT_LENGTH);
}

function makeSafeSearchRow(fields = {}) {
  const domain = normalizeDomainValue(fields.domain);
  if (!domain) return null;
  const sourceView = cleanSearchText(fields.sourceView, "", 96);
  if (!sourceView) return null;
  const sourceId = cleanSearchId(fields.sourceId || fields.id, `${domain}-${fields.index ?? 0}`);
  const visibility = normalizeVisibility(fields.visibility);
  if (!visibility) return null;
  const title = cleanSearchText(fields.title || fields.name, "未名条目", 96);
  const summary = cleanSearchText(fields.summary || fields.publicSummary || fields.meta, "", 260);
  const extra = cleanSearchText(fields.extra, "", 160);
  const tags = unique(fields.tags, 6);
  const metrics = Array.isArray(fields.metrics)
    ? fields.metrics.map(([label, value]) => `${cleanSearchText(label, "", 24)} ${cleanSearchText(value, "", 64)}`.trim()).filter(Boolean)
    : [];
  const relatedRefs = normalizeRelatedRefs(fields.relatedRefs);
  const searchText = makeSearchText([
    domain,
    title,
    fields.meta,
    summary,
    extra,
    tags,
    metrics,
    relatedRefs.map((ref) => ref.label)
  ]);
  if (!searchText) return null;

  const routeViewRef = {
    sourceView,
    sourceId,
    domain,
    label: title
  };

  return {
    rowId: `${domain}:${sourceView}:${sourceId}`,
    domain,
    sourceView,
    sourceId,
    title,
    summary,
    confidence: confidenceFrom(fields.confidence, fields.intelConfidence, fields.credibilityScore),
    visibility,
    relatedRefs,
    routeViewRef,
    searchText
  };
}

function addSearchRow(rows, fields) {
  const row = makeSafeSearchRow({ ...fields, index: rows.length });
  if (row) rows.push(row);
}

function rowName(rows = [], id, fallback = "") {
  if (!id) return fallback;
  const row = rows.find((entry) => entry?.id === id);
  return cleanSearchText(row?.name || row?.shortName || row?.title || row?.officeTitle, fallback, 80);
}

function buildViews(worldState = {}, prebuiltViews = null) {
  const views = isPlainObject(prebuiltViews) ? prebuiltViews : {};
  return {
    worldGeographyView: views.worldGeographyView || buildWorldGeographyView(worldState),
    worldPeopleView: views.worldPeopleView || buildWorldPeopleView(worldState),
    officialPostingsView: views.officialPostingsView || buildOfficialPostingsView(worldState)
  };
}

function buildGeographySearchRows(rows, geography = {}) {
  const countries = Array.isArray(geography.countries) ? geography.countries : [];
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const routes = Array.isArray(geography.routes) ? geography.routes : [];
  const frontiers = Array.isArray(geography.frontierZones) ? geography.frontierZones : [];

  for (const country of countries) {
    addSearchRow(rows, {
      domain: "geography",
      sourceView: "worldGeographyView.countries",
      sourceId: country.id,
      title: country.name,
      meta: country.statusLabel || country.kind,
      summary: country.publicSummary,
      confidence: country.intelConfidence,
      visibility: country.visibility,
      tags: country.policyPressureTags || country.cultureTags,
      relatedRefs: [relatedRef("country", country.id, country.name)]
    });
  }
  for (const city of cities) {
    addSearchRow(rows, {
      domain: "geography",
      sourceView: "worldGeographyView.cities",
      sourceId: city.id,
      title: city.name,
      meta: `${rowName(countries, city.countryId, "未知邦国")} ${city.statusLabel || city.jurisdictionLevel || ""}`,
      summary: city.publicSummary,
      confidence: city.intelConfidence,
      visibility: city.visibility,
      tags: city.strategicTags || city.localIssueTags,
      metrics: [
        ["民心", city.localOrder],
        ["粮压", city.grainStress],
        ["压力", city.pressure]
      ],
      relatedRefs: [
        relatedRef("city", city.id, city.name),
        relatedRef("country", city.countryId, rowName(countries, city.countryId, ""))
      ]
    });
  }
  for (const route of routes) {
    addSearchRow(rows, {
      domain: "geography",
      sourceView: "worldGeographyView.routes",
      sourceId: route.id,
      title: route.name,
      meta: route.statusLabel || route.type,
      summary: route.publicSummary,
      confidence: route.intelConfidence,
      visibility: route.visibility,
      tags: route.strategicTags,
      metrics: [
        ["风险", route.risk],
        ["端点", `${rowName(cities, route.fromCityId)}至${rowName(cities, route.toCityId)}`]
      ],
      relatedRefs: [
        relatedRef("route", route.id, route.name),
        relatedRef("city", route.fromCityId, rowName(cities, route.fromCityId, "")),
        relatedRef("city", route.toCityId, rowName(cities, route.toCityId, ""))
      ]
    });
  }
  for (const frontier of frontiers) {
    addSearchRow(rows, {
      domain: "geography",
      sourceView: "worldGeographyView.frontierZones",
      sourceId: frontier.id,
      title: frontier.name,
      meta: frontier.statusLabel || "边面",
      summary: frontier.publicSummary,
      confidence: frontier.intelConfidence,
      visibility: frontier.visibility,
      metrics: [["压力", frontier.pressure]],
      relatedRefs: [
        relatedRef("frontier", frontier.id, frontier.name),
        relatedRef("country", frontier.countryId, rowName(countries, frontier.countryId, "")),
        relatedRef("country", frontier.neighborCountryId, rowName(countries, frontier.neighborCountryId, ""))
      ]
    });
  }
}

function buildPeopleSearchRows(rows, worldState = {}, people = {}, geography = {}) {
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const npcs = Array.isArray(people.npcs) ? people.npcs : [];
  const households = Array.isArray(people.households) ? people.households : [];
  const relationships = Array.isArray(people.relationships) ? people.relationships : [];

  for (const npc of npcs) {
    addSearchRow(rows, {
      domain: "people",
      sourceView: "worldPeopleView.npcs",
      sourceId: npc.id,
      title: npc.courtesyName ? `${npc.name}（字${npc.courtesyName}）` : npc.name,
      meta: `${npc.rankLabel || "可见人物"} ${rowName(cities, npc.currentCityId, "")}`,
      summary: npc.publicSummary,
      confidence: npc.confidence,
      visibility: npc.visibility,
      tags: npc.ideologyTags,
      metrics: [
        ["声望", npc.reputation],
        ["影响", npc.influence],
        ["怨险", Math.max(Number(npc.resentmentRisk) || 0, Number(npc.legalRisk) || 0, Number(npc.impeachmentRisk) || 0)]
      ],
      relatedRefs: [
        relatedRef("npc", npc.id, npc.name),
        relatedRef("city", npc.currentCityId, rowName(cities, npc.currentCityId, ""))
      ]
    });
  }
  for (const household of households) {
    addSearchRow(rows, {
      domain: "people",
      sourceView: "worldPeopleView.households",
      sourceId: household.id,
      title: `${household.familyName || "未名"}氏`,
      meta: `${rowName(cities, household.seatCityId, "")} ${household.gentryRank || ""}`,
      summary: household.publicSummary,
      confidence: household.confidence,
      visibility: household.visibility,
      metrics: [
        ["家资", household.wealthScore],
        ["声望", household.prestige],
        ["债压", household.debtPressure]
      ],
      relatedRefs: [
        relatedRef("household", household.id, household.familyName),
        relatedRef("city", household.seatCityId, rowName(cities, household.seatCityId, ""))
      ]
    });
  }
  for (const relationship of relationships) {
    addSearchRow(rows, {
      domain: "people",
      sourceView: "worldPeopleView.relationships",
      sourceId: relationship.id,
      title: relationship.stance || relationship.publicSummary || "可见关系",
      meta: `${relationship.sourceType || ""}:${relationship.sourceId || ""} ${relationship.targetType || ""}:${relationship.targetId || ""}`,
      summary: relationship.publicSummary,
      confidence: relationship.confidence,
      visibility: relationship.visibility,
      extra: unique(relationship.recentNotes, 2).join(" "),
      metrics: [
        ["情分", relationship.relationship],
        ["信任", relationship.trust],
        ["怨望", relationship.resentment]
      ],
      relatedRefs: [
        relatedRef(relationship.sourceType || "source", relationship.sourceId, relationship.sourceId === "P1" ? worldState.player?.name : relationship.sourceId),
        relatedRef(relationship.targetType || "target", relationship.targetId, relationship.targetId === "P1" ? worldState.player?.name : relationship.targetId)
      ]
    });
  }
}

function buildOfficeSearchRows(rows, postings = {}, geography = {}) {
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const bureaus = Array.isArray(postings.bureaus) ? postings.bureaus : [];
  const offices = Array.isArray(postings.offices) ? postings.offices : [];
  const sourceRows = [
    ["officialPostingsView.bureaus", "bureau", bureaus],
    ["officialPostingsView.offices", "office", offices],
    ["officialPostingsView.cityJurisdictions", "jurisdiction", postings.cityJurisdictions],
    ["officialPostingsView.postings", "posting", postings.postings],
    ["officialPostingsView.assessmentRecords", "assessment", postings.assessmentRecords],
    ["officialPostingsView.transferRecords", "transfer", postings.transferRecords]
  ];
  for (const [sourceView, type, items] of sourceRows) {
    for (const item of Array.isArray(items) ? items : []) {
      const title = item.name || item.title || item.officeTitle || item.publicFinding || item.publicReason || item.id;
      addSearchRow(rows, {
        domain: "offices",
        sourceView,
        sourceId: item.id,
        title,
        meta: [
          type,
          item.rankLabel || item.rankBand,
          item.statusLabel || item.status,
          rowName(bureaus, item.bureauId, ""),
          rowName(cities, item.cityId || item.toCityId || item.fromCityId, "")
        ].filter(Boolean).join(" "),
        summary: item.publicSummary || item.publicFinding || item.publicReason,
        confidence: item.intelConfidence,
        visibility: item.visibility,
        tags: item.duties || item.riskTags,
        metrics: [
          ["考成", item.performanceScore || item.meritScore],
          ["风险", item.impeachmentRisk || item.riskScore]
        ],
        relatedRefs: [
          relatedRef(type, item.id, title),
          relatedRef("bureau", item.bureauId, rowName(bureaus, item.bureauId, "")),
          relatedRef("city", item.cityId || item.toCityId || item.fromCityId, rowName(cities, item.cityId || item.toCityId || item.fromCityId, ""))
        ]
      });
    }
  }
}

function buildReportSearchRows(rows, worldState = {}) {
  const localDocketView = buildLocalAffairsDocketView(worldState);
  for (const docket of Array.isArray(localDocketView.dockets) ? localDocketView.dockets : []) {
    addSearchRow(rows, {
      domain: "reports",
      sourceView: "localAffairsDocketView.dockets",
      sourceId: docket.id,
      title: docket.title,
      meta: `${docket.domainLabel || docket.domain || "案牍"} ${docket.statusLabel || ""}`,
      summary: docket.publicSummary,
      confidence: docket.confidence,
      visibility: docket.visibility,
      metrics: [
        ["压力", docket.pressureScore],
        ["程度", docket.severity]
      ],
      relatedRefs: [
        relatedRef("docket", docket.id, docket.title),
        relatedRef("city", docket.cityId, docket.cityId),
        relatedRef("bureau", docket.bureauId, docket.bureauId)
      ]
    });
  }

  for (const report of buildMilitaryDiplomacyRetrievalRows(worldState)) {
    addSearchRow(rows, {
      domain: "reports",
      sourceView: "militaryDiplomacyView.reports",
      sourceId: report.id,
      title: report.title,
      meta: `${report.type || "军务"} ${report.statusLabel || ""}`,
      summary: report.publicSummary,
      confidence: report.intelConfidence,
      visibility: report.visibility || "public",
      metrics: [
        ["威胁", report.threatScore],
        ["粮道", report.supplyRisk],
        ["战备", report.readinessScore]
      ],
      relatedRefs: [
        relatedRef("report", report.id, report.title),
        relatedRef("country", report.countryId, report.countryId),
        relatedRef("city", report.cityId, report.cityId)
      ]
    });
  }

  for (const report of buildEconomicFiscalRetrievalRows(worldState)) {
    addSearchRow(rows, {
      domain: "reports",
      sourceView: "economicFiscalView.reports",
      sourceId: report.id,
      title: report.title,
      meta: `${report.type || "财赋"} ${report.statusLabel || ""}`,
      summary: report.publicSummary,
      confidence: report.confidence,
      visibility: report.visibility || "public",
      metrics: [
        ["压力", report.pressureScore],
        ["财政", report.fiscalPressure],
        ["粮压", report.grainStress]
      ],
      relatedRefs: [
        relatedRef("report", report.id, report.title),
        relatedRef("country", report.countryId, report.countryId),
        relatedRef("city", report.cityId, report.cityId)
      ]
    });
  }
}

function buildEventSearchRows(rows, worldState = {}) {
  for (const chain of buildHistoricalEventRetrievalRows(worldState)) {
    addSearchRow(rows, {
      domain: "events",
      sourceView: "historicalEventArchiveView.publicChains",
      sourceId: chain.id,
      title: chain.title,
      meta: `${chain.domainLabel || chain.domain || "事件链"} ${chain.statusLabel || ""}`,
      summary: chain.publicSummary,
      confidence: chain.confidence,
      visibility: chain.visibility || "public",
      metrics: [
        ["压力", chain.pressureScore],
        ["程度", chain.severity]
      ],
      relatedRefs: [
        relatedRef("event_chain", chain.id, chain.title),
        ...(Array.isArray(chain.relatedRefs) ? chain.relatedRefs : [])
      ]
    });
  }

  for (const item of buildEventArchiveIndexItems(worldState)) {
    addSearchRow(rows, {
      domain: "events",
      sourceView: "eventArchiveView.items",
      sourceId: item.id,
      title: item.title,
      meta: item.sourceLabel || item.dateLabel,
      summary: item.summary,
      confidence: item.confidence,
      visibility: item.visibility,
      extra: unique(item.relatedLabels, 6).join(" "),
      relatedRefs: [relatedRef(item.sourceType || "event", item.id, item.title)]
    });
  }

  const domainConsequenceView = buildDomainConsequenceView(worldState);
  for (const consequence of Array.isArray(domainConsequenceView.recentConsequences)
    ? domainConsequenceView.recentConsequences
    : []) {
    addSearchRow(rows, {
      domain: "events",
      sourceView: "domainConsequenceView.recentConsequences",
      sourceId: consequence.id,
      title: consequence.title,
      meta: `${consequence.sourceLabel || "领域后果"} ${consequence.kindLabel || ""} ${consequence.statusLabel || ""}`,
      summary: consequence.publicSummary,
      confidence: consequence.severity >= 2 ? 82 : 72,
      visibility: "public",
      extra: [
        consequence.nextStep,
        ...(Array.isArray(consequence.affectedMetricLabels) ? consequence.affectedMetricLabels : [])
      ].filter(Boolean).join(" "),
      tags: [
        consequence.sourceLabel,
        consequence.kindLabel,
        ...(Array.isArray(consequence.affectedMetricLabels) ? consequence.affectedMetricLabels : [])
      ],
      metrics: [
        ["风险级", consequence.severity],
        ["发生旬", `${consequence.year || ""}-${consequence.month || ""}-${consequence.tenDayPeriod || ""}`]
      ],
      relatedRefs: [
        relatedRef("domain_consequence", consequence.id, consequence.title),
        relatedRef(consequence.sourceType, consequence.sourceId, consequence.sourceLabel)
      ]
    });
  }
}

function buildRumorSearchRows(rows, worldState = {}) {
  for (const rumor of buildIntelligenceRumorRetrievalRows(worldState)) {
    addSearchRow(rows, {
      domain: "rumors",
      sourceView: "intelligenceRumorView.rumors",
      sourceId: rumor.id,
      title: rumor.title,
      meta: `${rumor.kindLabel || rumor.kind || "情报"} ${rumor.credibilityLabel || ""}`,
      summary: rumor.publicSummary,
      confidence: rumor.credibilityScore,
      visibility: rumor.visibility || "public",
      tags: [rumor.channel, rumor.credibilityTier],
      relatedRefs: [
        relatedRef("rumor", rumor.id, rumor.title),
        ...(Array.isArray(rumor.relatedRefs) ? rumor.relatedRefs : [])
      ]
    });
  }
}

function buildSafeSearchRows(worldState = {}, options = {}) {
  const rows = [];
  const views = buildViews(worldState, options.views);
  buildGeographySearchRows(rows, views.worldGeographyView);
  buildPeopleSearchRows(rows, worldState, views.worldPeopleView, views.worldGeographyView);
  buildOfficeSearchRows(rows, views.officialPostingsView, views.worldGeographyView);
  buildReportSearchRows(rows, worldState);
  buildEventSearchRows(rows, worldState);
  buildRumorSearchRows(rows, worldState);
  return capSafeSearchRows(rows);
}

function capSafeSearchRows(rows = []) {
  if (rows.length <= SAFE_WORLD_SEARCH_MAX_ROWS) return rows;
  const protectedRows = rows.filter((row) => row.sourceView === "domainConsequenceView.recentConsequences");
  if (!protectedRows.length) return rows.slice(0, SAFE_WORLD_SEARCH_MAX_ROWS);
  const protectedRowIds = new Set(protectedRows.map((row) => row.rowId));
  const available = Math.max(0, SAFE_WORLD_SEARCH_MAX_ROWS - protectedRows.length);
  return [
    ...rows.filter((row) => !protectedRowIds.has(row.rowId)).slice(0, available),
    ...protectedRows
  ].slice(0, SAFE_WORLD_SEARCH_MAX_ROWS);
}

function scoreRow(row, normalizedQuery) {
  if (!normalizedQuery.query || normalizedQuery.rejected) return 0;
  const title = String(row.title || "").toLowerCase();
  const summary = String(row.summary || "").toLowerCase();
  const searchText = String(row.searchText || "").toLowerCase();
  let score = 0;
  for (const term of normalizedQuery.terms) {
    if (!term) continue;
    if (title.includes(term)) score += 5;
    if (summary.includes(term)) score += 3;
    if (searchText.includes(term)) score += 1;
  }
  const exact = normalizedQuery.query.toLowerCase();
  if (exact && title.includes(exact)) score += 4;
  if (exact && summary.includes(exact)) score += 2;
  return score;
}

function buildSafeSearchSnippet(row, query) {
  const normalized = typeof query === "string" ? normalizeSearchQuery(query) : query;
  const fullText = cleanSearchText(
    [row.title, row.summary, row.searchText].filter(Boolean).join(" "),
    row.title || "可见条目",
    SAFE_WORLD_SEARCH_MAX_SEARCH_TEXT_LENGTH
  );
  if (!fullText) return cleanSearchText(row.title, "可见条目", SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH);
  const lower = fullText.toLowerCase();
  const term = (normalized?.terms || []).find((entry) => lower.includes(entry));
  if (!term) return cleanSearchText(row.summary || row.title || fullText, "可见条目", SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH);

  const index = lower.indexOf(term);
  const radius = Math.floor(SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH / 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(fullText.length, index + term.length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < fullText.length ? "..." : "";
  return cleanSearchText(`${prefix}${fullText.slice(start, end)}${suffix}`, row.title || "可见条目", SAFE_WORLD_SEARCH_MAX_SNIPPET_LENGTH);
}

function publicSearchResult(row, normalizedQuery) {
  return {
    domain: row.domain,
    sourceView: row.sourceView,
    sourceId: row.sourceId,
    title: cleanSearchText(row.title, "未名条目", 96),
    snippet: buildSafeSearchSnippet(row, normalizedQuery),
    confidence: clampNumber(row.confidence, 0, 100, 70),
    visibility: normalizeVisibility(row.visibility) || "public",
    relatedRefs: normalizeRelatedRefs(row.relatedRefs),
    routeViewRef: {
      sourceView: cleanSearchText(row.routeViewRef?.sourceView || row.sourceView, row.sourceView, 96),
      sourceId: cleanSearchId(row.routeViewRef?.sourceId || row.sourceId, row.sourceId),
      domain: normalizeDomainValue(row.routeViewRef?.domain || row.domain) || row.domain,
      label: cleanSearchText(row.routeViewRef?.label || row.title, row.title, 96)
    }
  };
}

function buildPagination(totalItems, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Math.min(normalizePage(page), totalPages);
  return {
    page: normalizedPage,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    offset: (normalizedPage - 1) * pageSize
  };
}

function formatSafeSearchResults(rows, normalizedQuery, options = {}, source = SAFE_WORLD_SEARCH_SOURCE) {
  const query = normalizedQuery && typeof normalizedQuery === "object"
    ? normalizedQuery
    : normalizeSearchQuery(options.query);
  const domains = normalizeDomainFilter(options.domains ?? options.domain);
  const pageSize = normalizePageSize(options.pageSize);
  const domainRows = domains.length
    ? rows.filter((row) => domains.includes(row.domain))
    : rows;
  const scoredRows = query.query && !query.rejected
    ? domainRows
      .map((row) => ({ row, score: scoreRow(row, query) }))
      .filter((entry) => entry.score > 0)
      .sort((first, second) =>
        second.score - first.score ||
        (Number(second.row.confidence) || 0) - (Number(first.row.confidence) || 0) ||
        String(first.row.sourceId).localeCompare(String(second.row.sourceId))
      )
      .map((entry) => entry.row)
    : [];
  const pagination = buildPagination(scoredRows.length, options.page, pageSize);
  const results = scoredRows
    .slice(pagination.offset, pagination.offset + pagination.pageSize)
    .map((row) => publicSearchResult(row, query));

  return {
    schemaVersion: SAFE_WORLD_SEARCH_SCHEMA_VERSION,
    source,
    query: query.query,
    queryRejected: query.rejected,
    queryTruncated: query.truncated,
    domains,
    results,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: pagination.hasNextPage
    },
    counts: {
      totalAvailable: rows.length,
      domainAvailable: domainRows.length,
      queryMatched: scoredRows.length,
      pageItems: results.length
    },
    safety: {
      source: SAFE_WORLD_SEARCH_SOURCE,
      snippetOnly: true,
      authority: "搜索只读玩家可见服务器投影；只返回摘要片段与视图引用，不返回内部行、隐藏私档、提示全文、审计原文、本地路径或密钥。"
    }
  };
}

function searchSafeWorldIndex(worldState = {}, options = {}) {
  const normalizedQuery = normalizeSearchQuery(options.query ?? options.q);
  const rows = buildSafeSearchRows(worldState, options);
  return {
    generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    ...formatSafeSearchResults(rows, normalizedQuery, options, SAFE_WORLD_SEARCH_SOURCE)
  };
}

module.exports = {
  SAFE_SEARCH_DOMAINS,
  SAFE_WORLD_SEARCH_DEFAULT_PAGE_SIZE,
  SAFE_WORLD_SEARCH_MAX_PAGE_SIZE,
  SAFE_WORLD_SEARCH_MAX_QUERY_LENGTH,
  SAFE_WORLD_SEARCH_SCHEMA_VERSION,
  SAFE_WORLD_SEARCH_SOURCE,
  buildSafeSearchRows,
  buildSafeSearchSnippet,
  cleanSearchText,
  formatSafeSearchResults,
  normalizeDomainFilter,
  normalizeSearchQuery,
  searchSafeWorldIndex
};
