const { buildActorMemoryView } = require("./actorMemoryLedger");
const { buildPlayerAiActorProfile } = require("./aiActorProfiles");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildDomainConsequenceView } = require("./domainConsequenceTrace");
const { buildEventArchiveView } = require("./eventArchive");
const { buildHistoricalEventArchiveView } = require("./historicalEventArchive");
const { buildIntelligenceRumorView } = require("./intelligenceRumors");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMapContextView } = require("./mapContext");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildOfficialCareerView } = require("./officialCareer");
const { buildOfficialCourtConsequenceView } = require("./officialCourtConsequences");
const { buildOfficialCourtResponseView } = require("./officialCourtResponse");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildPlayerMonthlyBriefingView } = require("./playerMonthlyBriefing");
const { buildRelationshipInspectionView } = require("./relationships");
const { buildRoleCycleView } = require("./roleCycleView");
const { buildSessionSummaryView } = require("./sessionSummary");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  ACTOR_READ_DOMAIN_ALIASES,
  RESOLVER_INPUT_DOMAIN_CONFIG,
  RESOLVER_INPUT_DOMAINS,
  RESOLVER_INPUT_FORBIDDEN_SOURCE_CATEGORIES,
  RESOLVER_INPUT_GLOBAL_CAPS,
  RESOLVER_INPUT_SCHEMA_VERSION,
  RESOLVER_INPUT_SENSITIVE_TEXT_PATTERN,
  RESOLVER_INPUT_SOURCE_COLLECTIONS,
  RESOLVER_INPUT_VISIBILITY_ALIASES
} = require("./resolverInputConfig");

const RESOLVER_INPUT_ALLOWED_SOURCE_VIEWS = new Set([
  ...RESOLVER_INPUT_SOURCE_COLLECTIONS.map((source) => source.sourceView),
  "actorMemoryView",
  "playerStateSafeProjection",
  "sessionSummaryView"
]);

const RESOLVER_INPUT_SOURCE_VIEW_DOMAINS = new Map();
for (const source of RESOLVER_INPUT_SOURCE_COLLECTIONS) {
  const domains = RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.get(source.sourceView) || new Set();
  domains.add(source.domain);
  RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.set(source.sourceView, domains);
}
RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.set("actorMemoryView", new Set(["memory"]));
RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.set("playerStateSafeProjection", new Set(["player"]));
RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.set("sessionSummaryView", new Set(["memory"]));

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || RESOLVER_INPUT_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const safeFallback = typeof fallback === "string" ? fallback : "";
  const text = cleanText(String(value || ""), safeFallback, 96);
  const cleaned = text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampInteger(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function unique(values = [], limit = 12) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = cleanText(String(value || ""), "", 96);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function currentTurn(worldState = {}) {
  return clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function currentTimeScope(worldState = {}) {
  return {
    year: clampInteger(worldState.year, 1, 9999, 1644),
    month: clampInteger(worldState.month, 1, 12, 1),
    tenDayPeriod: clampInteger(worldState.tenDayPeriod, 1, 3, 1)
  };
}

function normalizeVisibility(value) {
  if (typeof value !== "string" || !value.trim()) return "public";
  const key = cleanText(value, "", 48).toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "hidden";
  if (/(^|_)(hidden|private|sealed|internal|secret|gm_only|server_only)(_|$)/.test(key)) return "hidden";
  return RESOLVER_INPUT_VISIBILITY_ALIASES[key] || "role_visible";
}

function normalizeConfidence(value, fallback = 0.6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric > 1) return clampNumber(numeric / 100, 0, 1, fallback);
  return clampNumber(numeric, 0, 1, fallback);
}

function valueAtPath(source, path) {
  return path.reduce((value, key) => (isPlainObject(value) ? value[key] : undefined), source);
}

function buildSourceViews(worldState, options = {}) {
  if (isPlainObject(options.views)) return options.views;
  const worldGeographyView = buildWorldGeographyView(worldState);
  const worldPeopleView = buildWorldPeopleView(worldState);
  const officialPostingsView = buildOfficialPostingsView(worldState);
  return {
    actorMemoryView: buildActorMemoryView(worldState),
    economicFiscalView: buildEconomicFiscalView(worldState),
    eventArchiveView: buildEventArchiveView(worldState, { pageSize: options.eventArchivePageSize || 50 }),
    historicalEventArchiveView: buildHistoricalEventArchiveView(worldState),
    intelligenceRumorView: buildIntelligenceRumorView(worldState),
    localAffairsDocketView: buildLocalAffairsDocketView(worldState),
    mapContextView: buildMapContextView(worldState, options.actorProfile || null),
    militaryDiplomacyView: buildMilitaryDiplomacyView(worldState),
    officialCareerView: buildOfficialCareerView(worldState),
    courtConsequenceView: buildOfficialCourtConsequenceView(worldState),
    domainConsequenceView: buildDomainConsequenceView(worldState),
    courtResponseView: buildOfficialCourtResponseView(worldState),
    officialPostingsView,
    playerMonthlyBriefingView: buildPlayerMonthlyBriefingView(worldState),
    relationshipView: buildRelationshipInspectionView(worldState),
    roleCycleView: buildRoleCycleView(worldState),
    sessionSummaryView: buildSessionSummaryView(worldState),
    worldGeographyView,
    worldPeopleView
  };
}

function titleForRow(row = {}, fallback = "") {
  return cleanText(
    row.title ||
    row.name ||
    row.label ||
    row.actorLabel ||
    row.displayName ||
    row.summaryTitle ||
    row.type ||
    fallback,
    fallback,
    80
  );
}

function summaryForRow(row = {}, fallback = "") {
  const candidates = [
    row.publicSummary,
    row.summary,
    row.publicDocket,
    row.description,
    row.statusLabel && row.title ? `${row.title}：${row.statusLabel}` : "",
    row.name,
    row.label,
    fallback
  ];
  for (const candidate of candidates) {
    const text = cleanText(candidate, "", 180);
    if (text) return text;
  }
  return cleanText(fallback, "", 180);
}

function sourceIdForRow(row = {}, sourceView, collection, index) {
  return cleanId(
    row.sourceId ||
    row.refId ||
    row.id ||
    row.chainId ||
    row.actorId ||
    row.memoryId ||
    `${sourceView}:${collection}:${index}`,
    `${sourceView}:${collection}:${index}`
  );
}

function collectRefValues(row = {}, keys = []) {
  const values = [];
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) values.push(...value);
    else if (value) values.push(value);
  }
  return unique(values, 12);
}

function relatedRefsForRow(row = {}) {
  return unique([
    ...asArray(row.relatedRefs),
    ...asArray(row.mapEntityRefs).map((ref) => ref?.refId || ref?.id).filter(Boolean),
    ...collectRefValues(row, [
      "actorId",
      "bureauId",
      "cityId",
      "cityIds",
      "countryId",
      "frontierZoneId",
      "frontierZoneIds",
      "jurisdictionId",
      "officeId",
      "postingId",
      "regionId",
      "routeId",
      "routeIds",
      "sourceId"
    ])
  ], 12);
}

function scopeRefsForRow(row = {}) {
  return unique([
    ...asArray(row.scopeRefs),
    ...collectRefValues(row, [
      "bureauId",
      "cityId",
      "cityIds",
      "countryId",
      "frontierZoneId",
      "frontierZoneIds",
      "jurisdictionId",
      "jurisdictionIds",
      "officeId",
      "postingId",
      "regionId",
      "routeId",
      "routeIds"
    ])
  ], 12);
}

function evidenceFromRow(row, meta, index, worldState) {
  if (!isPlainObject(row)) return null;
  const domainConfig = RESOLVER_INPUT_DOMAIN_CONFIG[meta.domain] || RESOLVER_INPUT_DOMAIN_CONFIG.events;
  const sourceId = sourceIdForRow(row, meta.sourceView, meta.collection, index);
  const label = titleForRow(row, sourceId);
  const summary = summaryForRow(row, label);
  if (!sourceId || !label || !summary) return null;
  const visibility = normalizeVisibility(row.visibility || (row.knownToPlayer ? "player_visible" : "public"));
  if (visibility === "hidden") return null;
  return {
    refId: `evidence:${meta.domain}:${cleanId(sourceId, `${meta.sourceView}-${index}`)}`,
    sourceView: meta.sourceView,
    sourceId,
    domain: meta.domain,
    visibility,
    confidence: normalizeConfidence(row.confidence ?? row.intelConfidence ?? row.trustScore, domainConfig.defaultConfidence),
    label,
    summary: cleanText(summary, "", domainConfig.maxCharacters),
    relatedRefs: relatedRefsForRow(row),
    scopeRefs: scopeRefsForRow(row),
    generatedAtTurn: clampInteger(row.generatedAtTurn ?? row.lastUpdatedTurn ?? row.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    freshness: row.generatedAtTurn === currentTurn(worldState) || row.lastUpdatedTurn === currentTurn(worldState)
      ? "current"
      : "recent"
  };
}

function buildPlayerEvidence(worldState = {}) {
  const player = worldState.player || {};
  const label = cleanText(player.name, "玩家", 80);
  const role = cleanText(player.role, "scholar", 40);
  const officeTitle = cleanText(player.officeTitle || player.position, "", 80);
  const examRank = cleanText(player.examRank || player.palaceRank, "", 40);
  const summaryParts = [
    `身份：${role}`,
    officeTitle ? `名位：${officeTitle}` : "",
    examRank ? `科名：${examRank}` : ""
  ].filter(Boolean);
  return [{
    refId: "evidence:player:player",
    sourceView: "playerStateSafeProjection",
    sourceId: "player",
    domain: "player",
    visibility: "player_visible",
    confidence: RESOLVER_INPUT_DOMAIN_CONFIG.player.defaultConfidence,
    label,
    summary: cleanText(summaryParts.join("；"), "玩家公开身份。", RESOLVER_INPUT_DOMAIN_CONFIG.player.maxCharacters),
    relatedRefs: unique([
      role ? `role:${role}` : "",
      officeTitle ? `officeTitle:${officeTitle}` : "",
      examRank ? `examRank:${examRank}` : ""
    ], 6),
    scopeRefs: unique([
      worldState.officialCareer?.bureauId ? `bureau:${worldState.officialCareer.bureauId}` : "",
      player.countyName ? `county:${player.countyName}` : ""
    ], 6),
    generatedAtTurn: currentTurn(worldState),
    freshness: "current"
  }];
}

function buildMemoryEvidence(views, worldState = {}) {
  const actorMemory = views.actorMemoryView || {};
  const sessionSummary = views.sessionSummaryView || {};
  const rows = [];
  for (const actor of asArray(actorMemory.actors)) {
    for (const memory of asArray(actor.memories)) {
      rows.push({
        id: memory.id,
        actorId: actor.actorId,
        title: actor.actorLabel,
        summary: memory.summary,
        type: memory.type,
        visibility: memory.visibility || "player_visible",
        confidence: memory.confidence,
        salience: memory.salience,
        sourceId: memory.sourceId
      });
    }
  }
  for (const summary of asArray(sessionSummary.recentMonthlySummaries)) {
    rows.push({
      id: summary.id || summary.periodKey,
      title: summary.periodLabel || summary.label || "经历摘要",
      summary: summary.publicSummary || summary.summary,
      type: "session_summary",
      visibility: "player_visible",
      confidence: 0.72,
      sourceId: "sessionSummaryView.summary"
    });
  }
  return rows
    .map((row, index) => evidenceFromRow(row, {
      sourceView: row.type === "session_summary" ? "sessionSummaryView" : "actorMemoryView",
      collection: row.type === "session_summary" ? "recentMonthlySummaries" : "actors.memories",
      domain: "memory"
    }, index, worldState))
    .filter(Boolean);
}

function buildEvidenceItems(worldState, views, options = {}) {
  const items = [];
  for (const source of RESOLVER_INPUT_SOURCE_COLLECTIONS) {
    const view = views[source.sourceView];
    if (!isPlainObject(view)) continue;
    for (const collection of source.collections) {
      const rows = asArray(valueAtPath(view, collection.split(".")));
      rows.forEach((row, index) => {
        const evidence = evidenceFromRow(row, {
          sourceView: source.sourceView,
          collection,
          domain: source.domain
        }, index, worldState);
        if (evidence) items.push(evidence);
      });
    }
  }
  items.push(...buildPlayerEvidence(worldState));
  items.push(...buildMemoryEvidence(views, worldState));
  return options.extraEvidence ? items.concat(asArray(options.extraEvidence)) : items;
}

function normalizeResolverEvidenceCandidate(item, index, worldState = {}) {
  if (!isPlainObject(item)) return null;
  const domain = cleanText(item.domain, "", 40);
  if (!RESOLVER_INPUT_DOMAINS.includes(domain)) return null;
  const sourceView = cleanText(item.sourceView, "", 96);
  if (!RESOLVER_INPUT_ALLOWED_SOURCE_VIEWS.has(sourceView)) {
    throw new Error(`resolverInputContext evidence uses forbidden sourceView at evidence[${index}]`);
  }
  if (!RESOLVER_INPUT_SOURCE_VIEW_DOMAINS.get(sourceView)?.has(domain)) {
    throw new Error(`resolverInputContext evidence uses forbidden sourceView-domain pair at evidence[${index}]`);
  }
  const visibility = normalizeVisibility(item.visibility);
  if (visibility === "hidden") return null;
  const domainConfig = RESOLVER_INPUT_DOMAIN_CONFIG[domain] || RESOLVER_INPUT_DOMAIN_CONFIG.events;
  if (typeof item.refId !== "string" || !item.refId.trim()) return null;
  if (typeof item.sourceId !== "string" || !item.sourceId.trim()) return null;
  if (typeof item.label !== "string" || !item.label.trim()) return null;
  if (typeof item.summary !== "string" || !item.summary.trim()) return null;
  assertResolverInputSafe({
    evidenceIndex: index,
    evidence: {
      refId: item.refId,
      sourceView,
      sourceId: item.sourceId,
      domain,
      visibility: item.visibility,
      label: item.label,
      summary: item.summary,
      relatedRefs: item.relatedRefs,
      scopeRefs: item.scopeRefs
    }
  });
  const refId = cleanText(item.refId, "", 120);
  const sourceId = cleanId(item.sourceId, "");
  const label = cleanText(item.label, "", 80);
  const summary = cleanText(item.summary, "", domainConfig.maxCharacters);
  if (!refId || !sourceId || !label || !summary) return null;
  const freshness = ["current", "recent", "stale"].includes(item.freshness) ? item.freshness : "recent";
  return {
    refId,
    sourceId,
    domain,
    sourceView,
    visibility,
    confidence: normalizeConfidence(item.confidence, domainConfig.defaultConfidence),
    label,
    summary,
    relatedRefs: unique(item.relatedRefs, 12),
    scopeRefs: unique(item.scopeRefs, 12),
    generatedAtTurn: clampInteger(item.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    freshness
  };
}

function emptyDomainBuckets() {
  return RESOLVER_INPUT_DOMAINS.reduce((result, domain) => {
    result[domain] = [];
    return result;
  }, {});
}

function addEvidenceToBuckets(buckets, item, state, options = {}) {
  if (!RESOLVER_INPUT_DOMAINS.includes(item.domain)) return;
  const domainConfig = RESOLVER_INPUT_DOMAIN_CONFIG[item.domain];
  const domainCap = clampInteger(options.domainCaps?.[item.domain], 1, 200, domainConfig.maxItems);
  if (buckets[item.domain].length >= domainCap) {
    state.truncation.push({ domain: item.domain, reason: "domain_cap", sourceView: item.sourceView });
    return;
  }
  if (state.itemCount >= RESOLVER_INPUT_GLOBAL_CAPS.maxItems) {
    state.truncation.push({ domain: item.domain, reason: "global_item_cap", sourceView: item.sourceView });
    return;
  }
  const itemCharacters = item.summary.length + item.label.length;
  if (state.totalCharacters + itemCharacters > RESOLVER_INPUT_GLOBAL_CAPS.maxTotalCharacters) {
    state.truncation.push({ domain: item.domain, reason: "total_character_cap", sourceView: item.sourceView });
    return;
  }
  buckets[item.domain].push(item);
  state.itemCount += 1;
  state.totalCharacters += itemCharacters;
}

function sourceViewSummary(buckets) {
  const byKey = new Map();
  for (const [domain, items] of Object.entries(buckets)) {
    if (!RESOLVER_INPUT_DOMAINS.includes(domain) || !Array.isArray(items)) continue;
    for (const item of items) {
      const key = `${item.sourceView}:${domain}`;
      const current = byKey.get(key) || {
        sourceView: item.sourceView,
        domain,
        count: 0
      };
      current.count += 1;
      byKey.set(key, current);
    }
  }
  return Array.from(byKey.values()).sort((first, second) =>
    first.sourceView.localeCompare(second.sourceView) || first.domain.localeCompare(second.domain)
  );
}

function actorIdentity(worldState = {}, actorProfile = {}) {
  const player = worldState.player || {};
  return {
    actorId: cleanId(actorProfile.actorId || "player", "player"),
    actorType: cleanText(actorProfile.actorType, "player", 40),
    role: cleanText(player.role || actorProfile.role, "scholar", 40),
    authorityTier: cleanText(actorProfile.authorityTier, "T1", 4),
    sceneType: "turn"
  };
}

function actorContext(actorProfile = {}) {
  return {
    visibleScopes: unique(actorProfile.visibilityProfile?.readDomains || [], 20),
    jurisdictionRefs: unique(actorProfile.jurisdictionRefs || [], 20),
    allowedToolGroups: unique(actorProfile.allowedToolGroups || [], 32),
    forbiddenToolGroups: unique(actorProfile.forbiddenToolGroups || [], 32)
  };
}

function buildResolverInputContext(worldState = {}, options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const views = buildSourceViews(worldState, { ...options, actorProfile });
  const buckets = emptyDomainBuckets();
  const capState = { itemCount: 0, totalCharacters: 0, truncation: [] };
  const evidenceItems = buildEvidenceItems(worldState, views, options)
    .map((item, index) => normalizeResolverEvidenceCandidate(item, index, worldState))
    .filter(Boolean)
    .filter((item, index) => {
      assertResolverInputSafe({ evidenceIndex: index, evidence: item });
      return true;
    })
    .sort((first, second) => {
      const firstPriority = RESOLVER_INPUT_DOMAIN_CONFIG[first.domain]?.priority || 0;
      const secondPriority = RESOLVER_INPUT_DOMAIN_CONFIG[second.domain]?.priority || 0;
      if (secondPriority !== firstPriority) return secondPriority - firstPriority;
      if (second.confidence !== first.confidence) return second.confidence - first.confidence;
      return first.refId.localeCompare(second.refId);
    });

  for (const item of evidenceItems) {
    addEvidenceToBuckets(buckets, item, capState, options);
  }

  const context = {
    schemaVersion: RESOLVER_INPUT_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    generatedAtTurn: currentTurn(worldState),
    sessionId: options.includeSessionId ? cleanId(worldState.sessionId, "redacted") : "redacted",
    identity: {
      ...actorIdentity(worldState, actorProfile),
      sceneType: cleanText(options.sceneType, "turn", 40)
    },
    actor: actorContext(actorProfile),
    scene: {
      sceneId: cleanId(options.sceneId, null),
      intentType: cleanText(options.intentType, null, 48),
      requestSummary: cleanText(options.requestSummary, "", 180),
      timeScope: currentTimeScope(worldState)
    },
    ...buckets,
    sourceViews: sourceViewSummary(buckets),
    forbiddenSources: [...RESOLVER_INPUT_FORBIDDEN_SOURCE_CATEGORIES],
    caps: {
      maxItemsPerDomain: Object.fromEntries(Object.entries(RESOLVER_INPUT_DOMAIN_CONFIG).map(([domain, config]) => [domain, config.maxItems])),
      maxCharactersPerItem: Object.fromEntries(Object.entries(RESOLVER_INPUT_DOMAIN_CONFIG).map(([domain, config]) => [domain, config.maxCharacters])),
      maxTotalCharacters: RESOLVER_INPUT_GLOBAL_CAPS.maxTotalCharacters,
      truncation: capState.truncation.slice(0, 24)
    },
    safety: {
      localOnly: true,
      redactedPlayerApiRequiredForHiddenProfiles: true,
      rejectsRawTables: true,
      rejectsRawAudit: true,
      rejectsProviderPayload: true,
      rejectsPromptText: true,
      rejectsLocalPathsAndKeys: true,
      hiddenNotBackfilledToStateRoute: true,
      aiCannotWriteDatabase: true
    }
  };
  assertResolverInputSafe(context);
  return context;
}

function allowedDomainsForActor(actorProfile = {}) {
  const readDomains = actorProfile.visibilityProfile?.readDomains || [];
  if (!readDomains.length) return new Set(RESOLVER_INPUT_DOMAINS);
  const allowed = new Set();
  for (const domain of readDomains) {
    for (const mapped of ACTOR_READ_DOMAIN_ALIASES[domain] || [domain]) {
      if (RESOLVER_INPUT_DOMAINS.includes(mapped)) allowed.add(mapped);
    }
  }
  return allowed;
}

function filterResolverInputForActor(context = {}, actorProfile = {}) {
  const allowed = allowedDomainsForActor(actorProfile);
  const next = cloneJson(context);
  for (const domain of RESOLVER_INPUT_DOMAINS) {
    next[domain] = allowed.has(domain) ? asArray(next[domain]) : [];
  }
  next.identity = {
    ...(next.identity || {}),
    actorId: cleanId(actorProfile.actorId || next.identity?.actorId, "actor"),
    actorType: cleanText(actorProfile.actorType || next.identity?.actorType, "player", 40),
    authorityTier: cleanText(actorProfile.authorityTier || next.identity?.authorityTier, "T1", 4)
  };
  next.actor = actorContext(actorProfile);
  next.sourceViews = sourceViewSummary(next);
  assertResolverInputSafe(next);
  return next;
}

function createResolverEvidenceRefs(context = {}) {
  return RESOLVER_INPUT_DOMAINS.flatMap((domain) =>
    asArray(context[domain]).map((item) => ({
      refId: item.refId,
      sourceView: item.sourceView,
      sourceId: item.sourceId,
      domain: item.domain,
      visibility: item.visibility,
      confidence: item.confidence,
      relatedRefs: asArray(item.relatedRefs),
      scopeRefs: asArray(item.scopeRefs),
      generatedAtTurn: item.generatedAtTurn
    }))
  );
}

function summarizeResolverInputForAudit(context = {}) {
  const evidenceRefs = createResolverEvidenceRefs(context);
  return {
    schemaVersion: context.schemaVersion || RESOLVER_INPUT_SCHEMA_VERSION,
    generatedAtTurn: context.generatedAtTurn || 0,
    identity: context.identity || {},
    counts: Object.fromEntries(RESOLVER_INPUT_DOMAINS.map((domain) => [domain, asArray(context[domain]).length])),
    totalEvidenceRefs: evidenceRefs.length,
    sourceViews: asArray(context.sourceViews),
    truncation: asArray(context.caps?.truncation),
    safety: {
      localOnly: context.safety?.localOnly === true,
      aiCannotWriteDatabase: context.safety?.aiCannotWriteDatabase === true,
      hiddenNotBackfilledToStateRoute: context.safety?.hiddenNotBackfilledToStateRoute === true
    }
  };
}

function assertResolverInputSafe(context = {}) {
  const unsafe = [];
  function visit(value, path) {
    if (typeof value === "string") {
      if (RESOLVER_INPUT_SENSITIVE_TEXT_PATTERN.test(value)) unsafe.push(path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (path === "" && key === "forbiddenSources") continue;
        visit(entry, path ? `${path}.${key}` : key);
      }
    }
  }
  visit(context, "");
  if (unsafe.length) {
    throw new Error(`resolverInputContext contains forbidden source text at ${unsafe.slice(0, 5).join(", ")}`);
  }
  return true;
}

module.exports = {
  assertResolverInputSafe,
  buildResolverInputContext,
  createResolverEvidenceRefs,
  filterResolverInputForActor,
  summarizeResolverInputForAudit
};
