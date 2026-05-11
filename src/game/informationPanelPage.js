const { buildEventArchiveIndexItems } = require("./eventArchive");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");

const INFORMATION_PANEL_PAGE_SCHEMA_VERSION = 1;
const INFORMATION_PANEL_PAGE_TABS = Object.freeze([
  "world-geography",
  "posting-geography",
  "world-people",
  "official-postings",
  "event-archive"
]);
const INFORMATION_PANEL_MIN_PAGE_SIZE = 1;
const INFORMATION_PANEL_DEFAULT_PAGE_SIZE = 8;
const INFORMATION_PANEL_MAX_PAGE_SIZE = 24;
const INFORMATION_PANEL_MAX_QUERY_LENGTH = 48;
const INFORMATION_PANEL_MAX_TEXT_LENGTH = 160;

const SECRET_ENV_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const SENSITIVE_INFORMATION_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|relationshipLedger|retrievalContext|statePatch|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|raw[_ -]?(?:table|ledger|audit)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|[A-Za-z]:\\[^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const KIND_LABELS = Object.freeze({
  country: "国家",
  city: "城市",
  route: "路线",
  frontier: "边面",
  "office-jurisdiction": "地理辖区",
  posting: "任命",
  jurisdiction: "辖区",
  npc: "人物",
  household: "家族",
  asset: "资产",
  estate: "田产",
  relationship: "关系",
  bureau: "官署",
  office: "官职",
  assessment: "考成",
  transfer: "迁转",
  event_history: "近事",
  world_thread: "议程",
  long_term_event: "长期",
  official_career: "官场",
  official_assessment: "考成",
  local_docket: "案牍",
  military_diplomacy: "军务",
  economic_fiscal: "财赋",
  historical_event_chain: "事件链",
  intelligence_rumor: "情报",
  exam_record: "科场"
});

const SORT_LABELS = Object.freeze({
  default: "默认",
  pressure: "压力",
  risk: "风险",
  turn: "回合",
  name: "名称"
});

const DEFAULT_TAB_FILTERS = Object.freeze({
  "world-geography": "all",
  "posting-geography": "all",
  "world-people": "npc",
  "official-postings": "all",
  "event-archive": "all"
});

const DEFAULT_TAB_SORTS = Object.freeze({
  "world-geography": "pressure",
  "posting-geography": "risk",
  "world-people": "risk",
  "official-postings": "risk",
  "event-archive": "turn"
});

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
  return clampNumber(
    value,
    INFORMATION_PANEL_MIN_PAGE_SIZE,
    INFORMATION_PANEL_MAX_PAGE_SIZE,
    INFORMATION_PANEL_DEFAULT_PAGE_SIZE
  );
}

function redactPanelText(value) {
  let text = String(value ?? "");
  for (const [envName, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME_PATTERN.test(envName) || !secret || String(secret).length < 8) continue;
    const raw = String(secret);
    const variants = new Set([raw, raw.slice(0, 8), raw.slice(0, 12), raw.slice(-8), raw.slice(-12)]);
    for (const variant of variants) {
      if (variant && variant.length >= 8) text = text.split(variant).join("[redacted]");
    }
  }

  text = text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/\btp-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  text = text.replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[redacted-path]");
  text = text.replace(/(^|\s)(?:\.{0,2}[\\/])?data[\\/][^\s"'<>]+/g, "$1[redacted-path]");
  text = text.replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/g, "[redacted-path]");
  return text;
}

function cleanPanelText(value, fallback = "", maxLength = INFORMATION_PANEL_MAX_TEXT_LENGTH) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  const redacted = redactPanelText(raw).replace(/\s+/g, " ").trim();
  if (!redacted || SENSITIVE_INFORMATION_TEXT_PATTERN.test(redacted)) return fallback;
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function normalizeTabId(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return INFORMATION_PANEL_PAGE_TABS.includes(candidate) ? candidate : "world-geography";
}

function normalizeFilter(value) {
  const candidate = cleanPanelText(value, "all", 48).toLowerCase();
  return candidate || "all";
}

function normalizeSort(value) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SORT_LABELS[candidate] ? candidate : "default";
}

function normalizeQuery(value) {
  const raw = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!raw) return { query: "", rejected: false };
  if (SENSITIVE_INFORMATION_TEXT_PATTERN.test(raw)) return { query: "", rejected: true };
  return {
    query: cleanPanelText(raw.slice(0, INFORMATION_PANEL_MAX_QUERY_LENGTH), "", INFORMATION_PANEL_MAX_QUERY_LENGTH),
    rejected: false
  };
}

function metric(label, value) {
  if (value === undefined || value === null || value === "") return null;
  return {
    label: cleanPanelText(label, "项", 24),
    value: cleanPanelText(value, "未明", 60)
  };
}

function compactList(values = [], fallback = "", limit = 4) {
  const list = Array.isArray(values)
    ? values.map((value) => cleanPanelText(value, "", 48)).filter(Boolean)
    : [];
  return list.length ? list.slice(0, limit).join("、") : fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowName(rows = [], id, fallback = "未明") {
  if (!id) return fallback;
  const row = rows.find((entry) => entry?.id === id);
  return cleanPanelText(row?.name || row?.familyName || row?.shortName || row?.title || row?.officeTitle, fallback, 80);
}

function makePageRow(fields = {}) {
  const title = cleanPanelText(fields.title, "未名条目", 80);
  const meta = cleanPanelText(fields.meta, KIND_LABELS[fields.filterValue] || KIND_LABELS[fields.kind] || "", 80);
  const summary = cleanPanelText(fields.summary, "暂无公开案语。");
  const extra = cleanPanelText(fields.extra, "", 120);
  const tags = Array.isArray(fields.tags)
    ? fields.tags.map((tag) => cleanPanelText(tag, "", 40)).filter(Boolean).slice(0, 6)
    : [];
  const metrics = Array.isArray(fields.metrics)
    ? fields.metrics.map(([label, value]) => metric(label, value)).filter(Boolean).slice(0, 6)
    : [];
  const filterValue = cleanPanelText(fields.filterValue || fields.kind, "item", 48).toLowerCase();
  const kind = cleanPanelText(fields.kind || filterValue, "item", 48);
  const row = {
    id: cleanPanelText(fields.id, `${kind}-item`, 80),
    tabId: fields.tabId,
    sourceView: cleanPanelText(fields.sourceView, "", 80),
    kind,
    kindLabel: cleanPanelText(fields.kindLabel || KIND_LABELS[filterValue] || KIND_LABELS[kind], kind, 32),
    filterValue,
    title,
    meta,
    summary,
    metrics,
    extra,
    tags,
    status: cleanPanelText(fields.status, "", 48),
    statusLabel: cleanPanelText(fields.statusLabel, "", 48),
    visibility: cleanPanelText(fields.visibility, "public", 32),
    cityId: cleanPanelText(fields.cityId, "", 80),
    routeId: cleanPanelText(fields.routeId, "", 80),
    pressure: fields.pressure === undefined ? null : numberValue(fields.pressure),
    risk: fields.risk === undefined ? null : numberValue(fields.risk),
    turn: fields.turn === undefined ? null : numberValue(fields.turn),
    year: fields.year === undefined ? null : numberValue(fields.year),
    month: fields.month === undefined ? null : numberValue(fields.month),
    tenDayPeriod: fields.tenDayPeriod === undefined ? null : numberValue(fields.tenDayPeriod),
    dateLabel: cleanPanelText(fields.dateLabel, "", 80),
    sortValue: numberValue(fields.sortValue, 0)
  };
  row.searchText = [
    row.kindLabel,
    row.title,
    row.meta,
    row.summary,
    row.extra,
    row.statusLabel,
    ...row.tags,
    ...row.metrics.flatMap((entry) => [entry.label, entry.value])
  ].filter(Boolean).join(" ").toLowerCase();
  return row;
}

function publicRow(row) {
  const { searchText, ...publicFields } = row;
  return publicFields;
}

function buildWorldGeographyRows(worldState, views) {
  const geography = views.worldGeographyView || {};
  const countries = Array.isArray(geography.countries) ? geography.countries : [];
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const routes = Array.isArray(geography.routes) ? geography.routes : [];
  const frontiers = Array.isArray(geography.frontierZones) ? geography.frontierZones : [];
  const jurisdictions = Array.isArray(geography.officeJurisdictions) ? geography.officeJurisdictions : [];

  return [
    ...countries.map((country) => makePageRow({
      tabId: "world-geography",
      sourceView: "worldGeographyView.countries",
      id: country.id,
      kind: "country",
      filterValue: "country",
      title: country.name,
      meta: `国家 · ${country.statusLabel || country.status || "未详"}`,
      summary: country.publicSummary,
      metrics: [
        ["压力", country.pressure],
        ["安稳", country.stability],
        ["信度", country.intelConfidence]
      ],
      extra: compactList(country.policyPressureTags || country.cultureTags, ""),
      status: country.status,
      statusLabel: country.statusLabel,
      visibility: country.visibility,
      pressure: country.pressure,
      sortValue: country.pressure
    })),
    ...cities.map((city) => makePageRow({
      tabId: "world-geography",
      sourceView: "worldGeographyView.cities",
      id: city.id,
      kind: "city",
      filterValue: "city",
      title: city.name,
      meta: `${rowName(countries, city.countryId, "未知邦国")} · ${city.statusLabel || city.status || "未详"}`,
      summary: city.publicSummary,
      metrics: [
        ["压力", city.pressure],
        ["民心", city.localOrder],
        ["粮压", city.grainStress]
      ],
      extra: compactList(city.strategicTags || city.localIssueTags, city.terrain || ""),
      status: city.status,
      statusLabel: city.statusLabel,
      visibility: city.visibility,
      cityId: city.id,
      pressure: city.pressure,
      sortValue: city.pressure
    })),
    ...routes.map((route) => makePageRow({
      tabId: "world-geography",
      sourceView: "worldGeographyView.routes",
      id: route.id,
      kind: "route",
      filterValue: "route",
      title: route.name,
      meta: `路线 · ${route.statusLabel || route.status || "未详"}`,
      summary: route.publicSummary,
      metrics: [
        ["风险", route.risk],
        ["里程", route.distanceLabel],
        ["端点", `${rowName(cities, route.fromCityId)}至${rowName(cities, route.toCityId)}`]
      ],
      extra: route.seasonalRisk || compactList(route.strategicTags, ""),
      status: route.status,
      statusLabel: route.statusLabel,
      visibility: route.visibility,
      routeId: route.id,
      risk: route.risk,
      sortValue: route.risk
    })),
    ...frontiers.map((frontier) => makePageRow({
      tabId: "world-geography",
      sourceView: "worldGeographyView.frontierZones",
      id: frontier.id,
      kind: "frontier",
      filterValue: "frontier",
      title: frontier.name,
      meta: `边面 · ${frontier.statusLabel || frontier.status || "未详"}`,
      summary: frontier.publicSummary,
      metrics: [
        ["压力", frontier.pressure],
        ["邻境", rowName(countries, frontier.neighborCountryId)],
        ["路线", compactList((frontier.routeIds || []).map((id) => rowName(routes, id, "")), "暂无")]
      ],
      extra: compactList((frontier.cityIds || []).map((id) => rowName(cities, id, "")), ""),
      status: frontier.status,
      statusLabel: frontier.statusLabel,
      visibility: frontier.visibility,
      pressure: frontier.pressure,
      sortValue: frontier.pressure
    })),
    ...jurisdictions.map((jurisdiction) => makePageRow({
      tabId: "world-geography",
      sourceView: "worldGeographyView.officeJurisdictions",
      id: jurisdiction.id,
      kind: "office-jurisdiction",
      filterValue: "office-jurisdiction",
      title: jurisdiction.name,
      meta: `辖区 · ${jurisdiction.scope || "未详"}`,
      summary: jurisdiction.publicSummary,
      metrics: [
        ["优先", jurisdiction.priority],
        ["城市", (jurisdiction.cityIds || []).length],
        ["路线", (jurisdiction.routeIds || []).length]
      ],
      extra: compactList((jurisdiction.cityIds || []).map((id) => rowName(cities, id, "")), ""),
      visibility: jurisdiction.visibility,
      pressure: jurisdiction.priority,
      sortValue: jurisdiction.priority
    }))
  ];
}

function buildPostingGeographyRows(worldState, views) {
  const geography = views.worldGeographyView || {};
  const postings = views.officialPostingsView || {};
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const routes = Array.isArray(geography.routes) ? geography.routes : [];
  const bureaus = Array.isArray(postings.bureaus) ? postings.bureaus : [];
  const jurisdictions = Array.isArray(postings.cityJurisdictions) ? postings.cityJurisdictions : [];
  const routeIds = new Set(jurisdictions.flatMap((row) => row.routeIds || []));

  return [
    ...(Array.isArray(postings.postings) ? postings.postings : []).map((posting) => makePageRow({
      tabId: "posting-geography",
      sourceView: "officialPostingsView.postings",
      id: posting.id,
      kind: "posting",
      filterValue: "posting",
      title: posting.officeTitle,
      meta: `${rowName(bureaus, posting.bureauId, "未明官署")} · ${rowName(cities, posting.cityId, "未明城市")}`,
      summary: posting.publicSummary,
      metrics: [
        ["考成", posting.performanceScore],
        ["弹劾", posting.impeachmentRisk],
        ["任期", `${posting.termMonths ?? 0}月`]
      ],
      extra: rowName(jurisdictions, posting.jurisdictionId, ""),
      status: posting.status,
      visibility: posting.visibility,
      cityId: posting.cityId,
      risk: posting.impeachmentRisk,
      sortValue: Math.max(numberValue(posting.performanceScore), numberValue(posting.impeachmentRisk))
    })),
    ...jurisdictions.map((jurisdiction) => makePageRow({
      tabId: "posting-geography",
      sourceView: "officialPostingsView.cityJurisdictions",
      id: jurisdiction.id,
      kind: "jurisdiction",
      filterValue: "jurisdiction",
      title: jurisdiction.name,
      meta: `${rowName(bureaus, jurisdiction.bureauId, "未明官署")} · ${rowName(cities, jurisdiction.cityId, "未明城市")}`,
      summary: jurisdiction.publicSummary,
      metrics: [
        ["民心", jurisdiction.localMetrics?.publicOrder],
        ["税力", jurisdiction.localMetrics?.taxCapacity],
        ["词讼", jurisdiction.localMetrics?.lawsuits],
        ["水利", jurisdiction.localMetrics?.waterworks]
      ],
      extra: compactList((jurisdiction.routeIds || []).map((id) => rowName(routes, id, "")), ""),
      visibility: jurisdiction.visibility,
      cityId: jurisdiction.cityId,
      risk: Math.max(numberValue(jurisdiction.localMetrics?.disasterRisk), numberValue(jurisdiction.localMetrics?.militaryPressure)),
      sortValue: Math.max(numberValue(jurisdiction.localMetrics?.disasterRisk), numberValue(jurisdiction.localMetrics?.militaryPressure))
    })),
    ...routes.filter((route) => routeIds.has(route.id)).map((route) => makePageRow({
      tabId: "posting-geography",
      sourceView: "worldGeographyView.routes",
      id: route.id,
      kind: "route",
      filterValue: "route",
      title: route.name,
      meta: `任所通路 · ${route.statusLabel || route.status || "未详"}`,
      summary: route.publicSummary,
      metrics: [
        ["风险", route.risk],
        ["端点", `${rowName(cities, route.fromCityId)}至${rowName(cities, route.toCityId)}`],
        ["里程", route.distanceLabel]
      ],
      extra: route.seasonalRisk,
      status: route.status,
      visibility: route.visibility,
      routeId: route.id,
      risk: route.risk,
      sortValue: route.risk
    }))
  ];
}

function buildWorldPeopleRows(worldState, views) {
  const people = views.worldPeopleView || {};
  const geography = views.worldGeographyView || {};
  const cities = Array.isArray(geography.cities) ? geography.cities : [];
  const npcs = Array.isArray(people.npcs) ? people.npcs : [];
  const households = Array.isArray(people.households) ? people.households : [];
  const assets = Array.isArray(people.assets) ? people.assets : [];
  const estates = Array.isArray(people.estates) ? people.estates : [];

  const ownerName = (type, id) => {
    if (type === "player") return cleanPanelText(worldState.player?.name, "玩家", 80);
    if (type === "npc") return rowName(npcs, id, "未明人物");
    if (type === "household") return rowName(households, id, "未明家族");
    return "未明归属";
  };
  const endpointName = (type, id) => {
    if (type === "player") return cleanPanelText(worldState.player?.name, "玩家", 80);
    if (type === "npc") return rowName(npcs, id, "未明人物");
    if (type === "household") return rowName(households, id, "未明家族");
    if (type === "asset") return rowName(assets, id, "未明资产");
    if (type === "estate") return rowName(estates, id, "未明田产");
    return "可见关系";
  };

  return [
    ...npcs.map((npc) => {
      const risk = Math.max(numberValue(npc.resentmentRisk), numberValue(npc.legalRisk), numberValue(npc.impeachmentRisk));
      return makePageRow({
        tabId: "world-people",
        sourceView: "worldPeopleView.npcs",
        id: npc.id,
        kind: "npc",
        filterValue: "npc",
        title: npc.courtesyName ? `${npc.name}（字${npc.courtesyName}）` : npc.name,
        meta: `${npc.rankLabel || "可见人物"} · ${npc.alive === false ? "故" : "在世"}`,
        summary: npc.publicSummary,
        metrics: [
          ["声望", npc.reputation],
          ["影响", npc.influence],
          ["怨险", risk]
        ],
        extra: npc.currentGoal || compactList(npc.ideologyTags, ""),
        visibility: npc.visibility,
        risk,
        sortValue: Math.max(numberValue(npc.influence), numberValue(npc.reputation), risk)
      });
    }),
    ...households.map((household) => makePageRow({
      tabId: "world-people",
      sourceView: "worldPeopleView.households",
      id: household.id,
      kind: "household",
      filterValue: "household",
      title: `${household.familyName || "未名"}氏`,
      meta: `${rowName(cities, household.seatCityId, "未明郡邑")} · ${household.gentryRank || "家声未详"}`,
      summary: household.publicSummary,
      metrics: [
        ["家资", household.wealthScore],
        ["声望", household.prestige],
        ["债压", household.debtPressure]
      ],
      extra: household.politicalAlignment || compactList((household.memberNpcIds || []).map((id) => rowName(npcs, id, "")), ""),
      visibility: household.visibility,
      risk: Math.max(numberValue(household.familyRisk), numberValue(household.debtPressure)),
      sortValue: Math.max(numberValue(household.wealthScore), numberValue(household.prestige), numberValue(household.familyRisk))
    })),
    ...assets.map((asset) => makePageRow({
      tabId: "world-people",
      sourceView: "worldPeopleView.assets",
      id: asset.id,
      kind: "asset",
      filterValue: "asset",
      title: asset.name,
      meta: `${asset.kind || "资产"} · ${rowName(cities, asset.cityId, "未明郡邑")}`,
      summary: asset.publicSummary,
      metrics: [
        ["估值", asset.valueEstimate],
        ["岁入", asset.annualIncomeEstimate],
        ["负债", asset.debtValue]
      ],
      extra: `归属：${ownerName(asset.ownerType, asset.ownerId)}；情状：${asset.statusLabel || "未详"}`,
      status: asset.statusLabel,
      visibility: asset.visibility,
      cityId: asset.cityId,
      risk: asset.debtValue,
      sortValue: Math.max(numberValue(asset.valueEstimate), numberValue(asset.annualIncomeEstimate), numberValue(asset.debtValue))
    })),
    ...estates.map((estate) => makePageRow({
      tabId: "world-people",
      sourceView: "worldPeopleView.estates",
      id: estate.id,
      kind: "estate",
      filterValue: "estate",
      title: estate.name,
      meta: rowName(cities, estate.cityId, "未明郡邑"),
      summary: estate.publicSummary,
      metrics: [
        ["田亩", estate.landMu ? `${estate.landMu}亩` : ""],
        ["租谷", estate.rentGrainEstimate],
        ["讼险", estate.disputeRisk]
      ],
      extra: `归属：${ownerName(estate.ownerType, estate.ownerId)}；水利：${estate.waterworks ?? "未详"}`,
      status: estate.status,
      visibility: estate.visibility,
      cityId: estate.cityId,
      risk: estate.disputeRisk,
      sortValue: Math.max(numberValue(estate.landMu), numberValue(estate.disputeRisk), numberValue(estate.taxBurden))
    })),
    ...(Array.isArray(people.relationships) ? people.relationships : []).map((relationship) => {
      const risk = Math.max(numberValue(relationship.resentment), numberValue(relationship.rivalry), numberValue(relationship.fear));
      const source = endpointName(relationship.sourceType, relationship.sourceId);
      const target = endpointName(relationship.targetType, relationship.targetId);
      return makePageRow({
        tabId: "world-people",
        sourceView: "worldPeopleView.relationships",
        id: relationship.id,
        kind: "relationship",
        filterValue: "relationship",
        title: `${source}与${target}`,
        meta: relationship.stance || "关系可见",
        summary: relationship.publicSummary,
        metrics: [
          ["情分", relationship.relationship],
          ["信任", relationship.trust],
          ["怨望", relationship.resentment]
        ],
        extra: relationship.recentIntent || compactList(relationship.recentNotes, "", 2),
        visibility: relationship.visibility,
        risk,
        sortValue: Math.max(risk, 100 - numberValue(relationship.trust, 50))
      });
    })
  ];
}

function buildOfficialPostingsRows(worldState, views) {
  const postings = views.officialPostingsView || {};
  const geography = views.worldGeographyView || {};
  const bureaus = Array.isArray(postings.bureaus) ? postings.bureaus : [];
  const offices = Array.isArray(postings.offices) ? postings.offices : [];
  const cities = Array.isArray(geography.cities) ? geography.cities : [];

  return [
    ...(Array.isArray(postings.postings) ? postings.postings : []).map((posting) => makePageRow({
      tabId: "official-postings",
      sourceView: "officialPostingsView.postings",
      id: posting.id,
      kind: "posting",
      filterValue: "posting",
      title: posting.officeTitle || rowName(offices, posting.officeId, "任命"),
      meta: `${rowName(bureaus, posting.bureauId, "未明官署")} · ${posting.holderType || "未详"}`,
      summary: posting.publicSummary,
      metrics: [
        ["状态", posting.status],
        ["考成", posting.performanceScore],
        ["弹劾", posting.impeachmentRisk],
        ["任期", posting.termMonths ? `${posting.termMonths}月` : "0月"]
      ],
      extra: rowName(cities, posting.cityId, "未明城市"),
      status: posting.status,
      visibility: posting.visibility,
      cityId: posting.cityId,
      risk: posting.impeachmentRisk,
      sortValue: Math.max(numberValue(posting.performanceScore), numberValue(posting.impeachmentRisk))
    })),
    ...(Array.isArray(postings.assessmentRecords) ? postings.assessmentRecords : []).map((record) => makePageRow({
      tabId: "official-postings",
      sourceView: "officialPostingsView.assessmentRecords",
      id: record.id,
      kind: "assessment",
      filterValue: "assessment",
      title: `${rowName(offices, record.officeId, "官职")}考成`,
      meta: `${rowName(bureaus, record.bureauId, "未明官署")} · ${record.date?.dateLabel || "本期"}`,
      summary: record.publicFinding || record.publicSummary,
      metrics: [
        ["功绩", record.meritScore],
        ["风险", record.riskScore],
        ["建议", record.recommendation],
        ["状态", record.status]
      ],
      extra: `差遣据数：${(record.assignmentIds || []).length}`,
      status: record.status,
      visibility: record.visibility,
      risk: record.riskScore,
      turn: record.date?.turn,
      sortValue: Math.max(numberValue(record.meritScore), numberValue(record.riskScore))
    })),
    ...bureaus.map((bureau) => makePageRow({
      tabId: "official-postings",
      sourceView: "officialPostingsView.bureaus",
      id: bureau.id,
      kind: "bureau",
      filterValue: "bureau",
      title: bureau.name,
      meta: `官署 · ${bureau.level || "未详"}`,
      summary: bureau.publicSummary,
      metrics: [
        ["官职", (bureau.officeIds || []).length],
        ["辖区", (bureau.jurisdictionIds || []).length],
        ["信度", bureau.intelConfidence]
      ],
      extra: compactList(bureau.duties, compactList(bureau.riskTags, "")),
      visibility: bureau.visibility,
      sortValue: Math.max(numberValue(bureau.intelConfidence), (bureau.officeIds || []).length)
    })),
    ...offices.map((office) => makePageRow({
      tabId: "official-postings",
      sourceView: "officialPostingsView.offices",
      id: office.id,
      kind: "office",
      filterValue: "office",
      title: office.title,
      meta: `${rowName(bureaus, office.bureauId, "未明官署")} · ${office.rankLabel || office.rankBand || "品秩未详"}`,
      summary: office.publicSummary,
      metrics: [
        ["任期", office.normalTermMonths ? `${office.normalTermMonths}月` : "未定"],
        ["职掌", (office.duties || []).length],
        ["路径", (office.promotionPathIds || []).length]
      ],
      extra: compactList(office.duties, office.requiredRankOrExam || ""),
      visibility: office.visibility,
      sortValue: Math.max(numberValue(office.normalTermMonths), (office.duties || []).length)
    })),
    ...(Array.isArray(postings.transferRecords) ? postings.transferRecords : []).map((record) => makePageRow({
      tabId: "official-postings",
      sourceView: "officialPostingsView.transferRecords",
      id: record.id,
      kind: "transfer",
      filterValue: "transfer",
      title: `${rowName(offices, record.fromOfficeId, "未授")}至${rowName(offices, record.toOfficeId, "未授")}`,
      meta: `${record.type || "迁转"} · ${record.date?.dateLabel || "本期"}`,
      summary: record.publicReason || record.publicSummary,
      metrics: [
        ["状态", record.status],
        ["起地", rowName(cities, record.fromCityId, "未详")],
        ["赴地", rowName(cities, record.toCityId, "未详")]
      ],
      status: record.status,
      visibility: record.visibility,
      cityId: record.toCityId,
      turn: record.date?.turn,
      sortValue: numberValue(record.date?.turn)
    }))
  ];
}

function buildEventArchiveRows(worldState) {
  return buildEventArchiveIndexItems(worldState).map((item) => makePageRow({
    tabId: "event-archive",
    sourceView: "eventArchiveView.items",
    id: item.id,
    kind: item.kind || item.sourceType,
    kindLabel: item.sourceLabel,
    filterValue: item.sourceType,
    title: item.title,
    meta: item.dateLabel || item.sourceLabel,
    summary: item.summary,
    metrics: [
      ["来源", item.sourceLabel || item.sourceType],
      ["状态", item.statusLabel || item.status],
      ["回数", `第${item.turn ?? 0}回`],
      ["风险", item.riskLabel]
    ],
    extra: compactList(item.relatedLabels, ""),
    status: item.status,
    statusLabel: item.statusLabel,
    visibility: item.visibility,
    risk: item.riskLabel ? 1 : 0,
    turn: item.turn,
    year: item.year,
    month: item.month,
    tenDayPeriod: item.tenDayPeriod,
    dateLabel: item.dateLabel,
    sortValue: item.turn
  })).map((row) => ({
    ...row,
    sourceType: row.filterValue
  }));
}

function buildAllRows(worldState, views, tabId) {
  if (tabId === "world-geography") return buildWorldGeographyRows(worldState, views);
  if (tabId === "posting-geography") return buildPostingGeographyRows(worldState, views);
  if (tabId === "world-people") return buildWorldPeopleRows(worldState, views);
  if (tabId === "official-postings") return buildOfficialPostingsRows(worldState, views);
  if (tabId === "event-archive") return buildEventArchiveRows(worldState, views);
  return [];
}

function compareDefault(first, second) {
  if (first.tabId === "event-archive") {
    return (second.turn ?? 0) - (first.turn ?? 0) || first.id.localeCompare(second.id);
  }
  return first.id.localeCompare(second.id);
}

function sortRows(rows, sort) {
  const sorted = rows.slice();
  if (sort === "name") {
    return sorted.sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id));
  }
  if (sort === "turn") {
    return sorted.sort((first, second) => (second.turn ?? 0) - (first.turn ?? 0) || first.id.localeCompare(second.id));
  }
  if (sort === "risk") {
    return sorted.sort((first, second) => (second.risk ?? 0) - (first.risk ?? 0) || first.id.localeCompare(second.id));
  }
  if (sort === "pressure") {
    return sorted.sort((first, second) => (second.pressure ?? second.sortValue ?? 0) - (first.pressure ?? first.sortValue ?? 0) || first.id.localeCompare(second.id));
  }
  return sorted.sort(compareDefault);
}

function countFilters(rows) {
  const counts = rows.reduce((memo, row) => {
    memo[row.filterValue] = (memo[row.filterValue] || 0) + 1;
    return memo;
  }, {});
  return [
    { value: "all", label: "全部", count: rows.length },
    ...Object.entries(counts)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([value, count]) => ({
        value,
        label: KIND_LABELS[value] || value,
        count
      }))
  ];
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

function buildSourceViews(worldState = {}, prebuiltViews = null) {
  const views = prebuiltViews && isPlainObject(prebuiltViews) ? prebuiltViews : {};
  return {
    worldGeographyView: views.worldGeographyView || buildWorldGeographyView(worldState),
    worldPeopleView: views.worldPeopleView || buildWorldPeopleView(worldState),
    officialPostingsView: views.officialPostingsView || buildOfficialPostingsView(worldState)
  };
}

function buildInformationPanelPageView(worldState = {}, rawOptions = {}, prebuiltViews = null) {
  const tabId = normalizeTabId(rawOptions.tabId || rawOptions.tab);
  const { query, rejected: queryRejected } = normalizeQuery(rawOptions.query);
  const filter = normalizeFilter(rawOptions.filter);
  const sort = normalizeSort(rawOptions.sort);
  const pageSize = normalizePageSize(rawOptions.pageSize);
  const views = buildSourceViews(worldState, prebuiltViews);
  const rows = buildAllRows(worldState, views, tabId);
  const queryRows = query
    ? rows.filter((row) => row.searchText.includes(query.toLowerCase()))
    : rows;
  const filters = countFilters(queryRows);
  const filterRows = filter === "all"
    ? queryRows
    : queryRows.filter((row) => row.filterValue === filter);
  const sortedRows = sortRows(filterRows, sort);
  const pagination = buildPagination(sortedRows.length, rawOptions.page, pageSize);
  const items = sortedRows.slice(pagination.offset, pagination.offset + pagination.pageSize).map(publicRow);

  return {
    schemaVersion: INFORMATION_PANEL_PAGE_SCHEMA_VERSION,
    tabId,
    source: "route_view_projection",
    generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    query,
    queryRejected,
    filter,
    sort,
    sorts: Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label })),
    filters,
    items,
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
      queryMatched: queryRows.length,
      filtered: filterRows.length,
      pageItems: items.length
    },
    hiddenNotice: "局势簿分页只读服务器整理的可见视图；本地诊断、密钥路径、模型提案和隐藏私档均已过滤。"
  };
}

function buildInformationPanelPageViews(worldState = {}, rawOptions = {}, prebuiltViews = null) {
  const activeTabId = normalizeTabId(rawOptions.tabId || rawOptions.tab);
  const views = buildSourceViews(worldState, prebuiltViews);
  const cleanRawOptions = Object.fromEntries(
    Object.entries(rawOptions).filter(([, value]) => value !== undefined)
  );
  const defaultOptions = {
    page: 1,
    pageSize: INFORMATION_PANEL_DEFAULT_PAGE_SIZE,
    query: ""
  };
  const pages = INFORMATION_PANEL_PAGE_TABS.map((tabId) => {
    const tabDefaults = {
      filter: DEFAULT_TAB_FILTERS[tabId] || "all",
      sort: DEFAULT_TAB_SORTS[tabId] || "default"
    };
    const options = tabId === activeTabId
      ? { ...defaultOptions, ...tabDefaults, ...cleanRawOptions, tabId }
      : { ...defaultOptions, ...tabDefaults, tabId };
    return buildInformationPanelPageView(worldState, options, views);
  });
  const activePage = pages.find((page) => page.tabId === activeTabId) || pages[0];

  return {
    schemaVersion: INFORMATION_PANEL_PAGE_SCHEMA_VERSION,
    activeTabId,
    generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    pages,
    activePage,
    hiddenNotice: "局势簿分页集合只含玩家可见服务器视图。"
  };
}

function informationPanelOptionsFromQuery(query = {}) {
  return {
    tabId: query.informationTab ?? query.informationPanelTab ?? query.informationCollection,
    query: query.informationQuery ?? query.informationSearch,
    filter: query.informationFilter,
    sort: query.informationSort,
    page: query.informationPage,
    pageSize: query.informationPageSize
  };
}

module.exports = {
  INFORMATION_PANEL_DEFAULT_PAGE_SIZE,
  INFORMATION_PANEL_MAX_PAGE_SIZE,
  INFORMATION_PANEL_PAGE_SCHEMA_VERSION,
  buildInformationPanelPageView,
  buildInformationPanelPageViews,
  informationPanelOptionsFromQuery
};
