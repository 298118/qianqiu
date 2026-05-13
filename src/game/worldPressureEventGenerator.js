const { buildSystemEngineActorProfile } = require("./aiActorProfiles");
const { collectVisiblePressureRefs } = require("./aiEventProposal");
const {
  buildResolverInputContext,
  filterResolverInputForActor,
  summarizeResolverInputForAudit
} = require("./resolverInputContext");
const { appendEvents, clamp, NUMERIC_RANGES } = require("./stateRules");
const {
  WORLD_PRESSURE_EVENT_ALLOWED_STATE_KEYS,
  WORLD_PRESSURE_EVENT_DEFAULT_MAX_CANDIDATES,
  WORLD_PRESSURE_EVENT_DEFAULT_MAX_EVENTS,
  WORLD_PRESSURE_EVENT_RECORD_LIMIT,
  WORLD_PRESSURE_EVENT_RULES,
  WORLD_PRESSURE_EVENT_RULES_BY_ID,
  WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
  WORLD_PRESSURE_EVENT_SIGNAL_LIMIT
} = require("./worldPressureEventConfig");

const WORLD_PRESSURE_EVENT_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_PRESSURE_EVENT_KEYS = new Set([
  "apiKey",
  "hiddenIntent",
  "hiddenNotes",
  "localPath",
  "providerConfig",
  "rawAudit",
  "rawEvidence",
  "rawPrompt",
  "rawSql",
  "rawTable",
  "secretTruth",
  "sql",
  "statePatch",
  "worldState"
]);

const SAFE_PRESSURE_EVENT_METADATA_KEYS = new Set([
  "cooldownKey",
  "ruleId"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || WORLD_PRESSURE_EVENT_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(String(value || ""), fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampFloat(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeConfidence(value, fallback = 0.62) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Number(clampFloat(normalized, 0, 1, fallback).toFixed(3));
}

function unique(values = [], limit = 12) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanId(value, "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueText(values = [], limit = 8, maxLength = 120) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueServerReasons(values = [], limit = 8, maxLength = 160) {
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    if (typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text.length > maxLength ? `${text.slice(0, maxLength)}...` : text);
    if (result.length >= limit) break;
  }
  return result;
}

function collectUnsafeFields(value, path = "candidate", findings = []) {
  if (typeof value === "string") {
    if (WORLD_PRESSURE_EVENT_SENSITIVE_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeFields(entry, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (
      !SAFE_PRESSURE_EVENT_METADATA_KEYS.has(key) &&
      (FORBIDDEN_PRESSURE_EVENT_KEYS.has(key) || WORLD_PRESSURE_EVENT_SENSITIVE_TEXT_PATTERN.test(key))
    ) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function severityFromPressure(value) {
  const pressure = clampNumber(value, 0, 100, 40);
  if (pressure >= 88) return 5;
  if (pressure >= 72) return 4;
  if (pressure >= 52) return 3;
  if (pressure >= 32) return 2;
  return 1;
}

function pressureFromSeverity(severity) {
  return clampNumber(severity, 0, 5, 2) * 18 + 10;
}

function inferDomainFromPressureRef(domain) {
  if (domain === "market") return "market";
  if (domain === "local_docket") return "local_docket";
  if (domain === "world_entity") return "world_entity";
  return cleanId(domain, "events");
}

function inferIncidentKindFromEvidence(item = {}) {
  const domain = cleanId(item.domain, "events");
  const sourceView = cleanText(item.sourceView, "", 80);
  const text = `${item.label || ""} ${item.summary || ""} ${sourceView}`.toLowerCase();
  if (domain === "military" || /边|军|frontier|garrison|supply/.test(text)) return "frontier_alert";
  if (domain === "economy" || /粮|价|库|财|税|银|market|fiscal|salt|canal/.test(text)) return "fiscal_market";
  if (domain === "intel" || /传闻|谣|风声|rumor|intel/.test(text)) return "rumor_pressure";
  if (domain === "people" && /怨|控|仇|resent|rival|请托|报复/.test(text)) return "npc_resentment";
  if (domain === "events" && /案|讼|docket|localAffairsDocket/.test(text)) return "local_docket";
  if (/书院|士林|科场|考试|academy|exam/.test(text)) return "academy_pressure";
  if (/台谏|弹劾|官场|部院|朝|court|office/.test(text)) return "court_pressure";
  if (domain === "geography") return /边|frontier|关|防/.test(text) ? "frontier_alert" : "city_pressure";
  return "generic_incident";
}

function domainFromEvidence(item = {}) {
  const domain = cleanId(item.domain, "events");
  if (domain === "economy") return "market";
  if (domain === "offices") return "offices";
  return domain;
}

function pressureFromEvidence(item = {}, incidentKind = "generic_incident") {
  const confidence = normalizeConfidence(item.confidence, 0.62);
  const summary = `${item.label || ""} ${item.summary || ""}`;
  let pressure = Math.round(confidence * 58 + 18);
  if (/危急|急报|紧张|争持|危局|急务|critical|urgent|contested/.test(summary)) pressure += 18;
  if (/吃紧|留察|重务|strained|watch/.test(summary)) pressure += 10;
  if (/怨望|粮价|亏空|边压|弹劾|讼|民情|supply|frontier/.test(summary)) pressure += 8;
  if (incidentKind === "npc_resentment") pressure += 8;
  if (incidentKind === "frontier_alert") pressure += 6;
  if (item.freshness === "current") pressure += 4;
  return clampNumber(pressure, 0, 100, 45);
}

function buildPressureEventActorProfile(worldState = {}, options = {}) {
  if (options.actorProfile) return options.actorProfile;
  const profile = buildSystemEngineActorProfile(worldState, "pressure_events");
  return {
    ...profile,
    visibilityProfile: {
      ...(profile.visibilityProfile || {}),
      readDomains: unique([
        ...asArray(profile.visibilityProfile?.readDomains),
        "people",
        "office",
        "local_docket",
        "military"
      ], 20)
    }
  };
}

function sourceSignalFromPressureRef(entry = {}, turn) {
  const domain = inferDomainFromPressureRef(entry.domain);
  const severity = clampNumber(entry.severity, 1, 5, 2);
  const pressureScore = pressureFromSeverity(severity);
  const ref = cleanId(entry.ref, "");
  if (!ref) return null;
  return {
    ref,
    sourceRef: ref,
    domain,
    sourceKind: "s70_pressure_ref",
    sourceView: cleanText(entry.sourceView, "visiblePressureRefs", 80),
    sourceId: cleanId(entry.id, ref),
    incidentKind: cleanId(entry.incidentKind, "generic_incident"),
    title: cleanText(entry.title, "可见压力", 80),
    publicSummary: cleanText(entry.publicSummary, "可见压力摘要。", 160),
    confidence: normalizeConfidence(entry.confidence, 0.66),
    severity,
    pressureScore,
    scopeRefs: unique([entry.id, entry.ref, ...asArray(entry.scopeRefs)], 8),
    relatedRefs: unique([entry.ref, ...asArray(entry.relatedRefs)], 8),
    riskTags: unique([entry.incidentKind, entry.domain, ...asArray(entry.riskTags)], 8),
    generatedAtTurn: turn
  };
}

function sourceSignalFromResolverEvidence(item = {}, turn) {
  const incidentKind = inferIncidentKindFromEvidence(item);
  const domain = domainFromEvidence(item);
  const ref = cleanId(item.refId, "");
  const pressureScore = pressureFromEvidence(item, incidentKind);
  if (!ref) return null;
  return {
    ref,
    sourceRef: ref,
    domain,
    sourceKind: "resolver_input_evidence",
    sourceView: cleanText(item.sourceView, "resolverInputContext", 80),
    sourceId: cleanId(item.sourceId, ref),
    incidentKind,
    title: cleanText(item.label, "可见证据", 80),
    publicSummary: cleanText(item.summary, "可见证据摘要。", 160),
    confidence: normalizeConfidence(item.confidence, 0.62),
    severity: severityFromPressure(pressureScore),
    pressureScore,
    scopeRefs: unique(item.scopeRefs, 10),
    relatedRefs: unique(item.relatedRefs, 10),
    riskTags: unique([incidentKind, domain], 8),
    generatedAtTurn: clampNumber(item.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, turn)
  };
}

function collectResolverEvidenceSignals(worldState = {}, actorProfile = {}, options = {}) {
  const baseContext = options.resolverInputContext || buildResolverInputContext(worldState, {
    actorProfile,
    intentType: "pressure_events",
    requestSummary: "服务器按可见 projection 汇集压力事件候选。",
    extraEvidence: options.extraEvidence
  });
  const context = filterResolverInputForActor(baseContext, actorProfile);
  const turn = currentTurn(worldState);
  const signals = [];
  for (const domain of ["geography", "people", "offices", "economy", "military", "events", "intel"]) {
    for (const item of asArray(context[domain])) {
      const signal = sourceSignalFromResolverEvidence(item, turn);
      if (signal) signals.push(signal);
    }
  }
  return {
    context,
    signals,
    auditSummary: summarizeResolverInputForAudit(context)
  };
}

function signalSort(first, second) {
  if (second.pressureScore !== first.pressureScore) return second.pressureScore - first.pressureScore;
  if (second.confidence !== first.confidence) return second.confidence - first.confidence;
  return first.ref.localeCompare(second.ref);
}

function dedupeSignals(signals = []) {
  const byRef = new Map();
  for (const signal of signals) {
    if (!signal?.ref) continue;
    const current = byRef.get(signal.ref);
    if (!current || signal.pressureScore > current.pressureScore) byRef.set(signal.ref, signal);
  }
  return [...byRef.values()].sort(signalSort).slice(0, WORLD_PRESSURE_EVENT_SIGNAL_LIMIT);
}

function collectWorldPressureSignals(worldState = {}, context = {}) {
  const actorProfile = buildPressureEventActorProfile(worldState, context);
  const turn = currentTurn(worldState);
  const visiblePressureRefs = [...collectVisiblePressureRefs(worldState, actorProfile).values()]
    .map((entry) => sourceSignalFromPressureRef(entry, turn))
    .filter(Boolean);
  const resolverSignals = collectResolverEvidenceSignals(worldState, actorProfile, context);
  const signals = dedupeSignals([...visiblePressureRefs, ...resolverSignals.signals]);
  return {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    generatedAtTurn: turn,
    actorRef: {
      actorId: cleanText(actorProfile.actorId, "system:pressure_events", 96),
      actorType: cleanText(actorProfile.actorType, "system_engine", 48),
      authorityTier: cleanText(actorProfile.authorityTier, "T6", 4)
    },
    signals,
    signalRefs: signals.map((signal) => signal.ref),
    resolverInput: resolverSignals.auditSummary,
    safety: {
      modelGenerated: false,
      localOnly: true,
      hiddenSignalsIncluded: false,
      rawTablesIncluded: false,
      serverAdjudicated: true
    }
  };
}

function signalMatchesRule(signal = {}, rule = {}) {
  return asArray(rule.incidentKinds).includes(signal.incidentKind) ||
    asArray(rule.primaryDomains).includes(signal.domain) ||
    asArray(rule.supportDomains).includes(signal.domain);
}

function isPrimarySignal(signal = {}, rule = {}) {
  return asArray(rule.primaryDomains).includes(signal.domain) ||
    asArray(rule.incidentKinds).includes(signal.incidentKind);
}

function intersects(first = [], second = []) {
  if (!first.length || !second.length) return false;
  const secondSet = new Set(second);
  return first.some((value) => secondSet.has(value));
}

function supportScoreFor(primary, candidate, rule) {
  let score = candidate.pressureScore;
  if (intersects(primary.scopeRefs, candidate.scopeRefs)) score += 20;
  if (asArray(rule.supportDomains).includes(candidate.domain)) score += 12;
  if (asArray(rule.incidentKinds).includes(candidate.incidentKind)) score += 8;
  if (candidate.generatedAtTurn === primary.generatedAtTurn) score += 4;
  return score;
}

function primaryScopeKey(primary = {}) {
  return cleanId(
    asArray(primary.scopeRefs)[0] || primary.sourceId || primary.ref,
    primary.ref || "scope"
  );
}

function buildSignalCandidate(rule, primary, signals = []) {
  const support = signals
    .filter((signal) => signal.ref !== primary.ref && signalMatchesRule(signal, rule))
    .map((signal) => ({ signal, score: supportScoreFor(primary, signal, rule) }))
    .filter((entry) => entry.score >= 45 || intersects(primary.scopeRefs, entry.signal.scopeRefs))
    .sort((first, second) => second.score - first.score || first.signal.ref.localeCompare(second.signal.ref))
    .map((entry) => entry.signal)
    .slice(0, Math.max(0, rule.maxSources - 1));
  const sourceSignals = [primary, ...support].slice(0, rule.maxSources);
  if (sourceSignals.length < rule.minimumSources) return null;
  const sourcePressureRefs = unique(sourceSignals.map((signal) => signal.ref), 6);
  const affectedRefs = unique([
    ...sourceSignals.flatMap((signal) => signal.scopeRefs),
    ...sourceSignals.map((signal) => signal.sourceId)
  ], 20).sort().slice(0, 6);
  const sourceDomains = unique(sourceSignals.map((signal) => signal.domain), 8);
  const severity = Math.max(...sourceSignals.map((signal) => signal.severity));
  const confidence = Number((
    sourceSignals.reduce((sum, signal) => sum + signal.confidence, 0) / sourceSignals.length
  ).toFixed(3));
  const title = cleanText(primary.title, rule.label, 80);
  const publicClues = uniqueText(sourceSignals.map((signal) => signal.publicSummary), 3, 90);
  const scopeKey = primaryScopeKey(primary);
  const candidate = {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    candidateId: cleanId(`pressure-event:${rule.ruleId}:${scopeKey}`, `pressure-event:${rule.ruleId}`),
    ruleId: rule.ruleId,
    incidentKind: rule.incidentKind,
    label: rule.label,
    sourcePressureRefs,
    sourceDomains,
    sourceSignals: sourceSignals.map((signal) => ({
      ref: signal.ref,
      domain: signal.domain,
      sourceKind: signal.sourceKind,
      sourceView: signal.sourceView,
      sourceId: signal.sourceId,
      incidentKind: signal.incidentKind,
      title: signal.title,
      publicSummary: signal.publicSummary,
      confidence: signal.confidence,
      severity: signal.severity,
      pressureScore: signal.pressureScore,
      scopeRefs: signal.scopeRefs
    })),
    affectedRefs,
    publicSummary: cleanText(`${rule.publicSummaryPrefix} 公开线索：${title}。`, rule.publicSummaryPrefix, 180),
    publicClues,
    confidence,
    severity,
    priority: rule.priority,
    pressureScore: Math.max(...sourceSignals.map((signal) => signal.pressureScore)),
    cooldownKey: cleanId(`${rule.cooldownPrefix}:${scopeKey}`, `${rule.cooldownPrefix}:scope`),
    cooldownTurns: rule.cooldownTurns,
    privateResultRefs: [],
    riskTags: unique([...(rule.riskTags || []), ...sourceSignals.flatMap((signal) => signal.riskTags)], 8),
    authorityBoundary: "压力事件候选由服务器从可见 projection 生成；概率、冷却、公开事件、状态边界和持久化仍由服务器裁决。"
  };
  return scorePressureEventCandidate(candidate);
}

function scorePressureEventCandidate(signal, options = {}) {
  const candidate = isPlainObject(signal) ? { ...signal } : {};
  const rule = WORLD_PRESSURE_EVENT_RULES_BY_ID[candidate.ruleId] || {};
  const sourceCount = asArray(candidate.sourcePressureRefs).length;
  const domainCount = new Set(asArray(candidate.sourceDomains)).size;
  const severity = clampNumber(candidate.severity, 1, 5, 2);
  const pressureScore = clampNumber(candidate.pressureScore, 0, 100, 40);
  const confidence = normalizeConfidence(candidate.confidence, 0.58);
  const priority = clampNumber(candidate.priority ?? rule.priority, 0, 100, 50);
  const score = clampNumber(
    Math.round(
      pressureScore * 0.55 +
      severity * 6 +
      domainCount * 5 +
      Math.max(0, sourceCount - 1) * 6 +
      priority * 0.12
    ),
    0,
    100,
    0
  );
  const probability = Number(clampFloat(
    (score / 100) * (0.72 + confidence * 0.28) + (options.probabilityBias || 0),
    0,
    1,
    0
  ).toFixed(3));
  return {
    ...candidate,
    severity,
    pressureScore,
    confidence,
    priority,
    score,
    probability
  };
}

function generatePressureEventCandidates(worldState = {}, options = {}) {
  const pressureContext = options.pressureContext || collectWorldPressureSignals(worldState, options);
  const signals = asArray(pressureContext.signals);
  const candidates = [];
  const seen = new Set();
  for (const rule of WORLD_PRESSURE_EVENT_RULES) {
    const primaries = signals
      .filter((signal) => isPrimarySignal(signal, rule))
      .sort(signalSort)
      .slice(0, 4);
    for (const primary of primaries) {
      const candidate = buildSignalCandidate(rule, primary, signals);
      if (!candidate || seen.has(candidate.cooldownKey)) continue;
      seen.add(candidate.cooldownKey);
      candidates.push(candidate);
    }
  }
  const limit = clampNumber(
    options.maxCandidates,
    1,
    20,
    WORLD_PRESSURE_EVENT_DEFAULT_MAX_CANDIDATES
  );
  return candidates
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      if (second.priority !== first.priority) return second.priority - first.priority;
      return first.candidateId.localeCompare(second.candidateId);
    })
    .slice(0, limit);
}

function normalizePressureEventCandidate(candidate = {}) {
  const source = isPlainObject(candidate) ? candidate : {};
  const rule = WORLD_PRESSURE_EVENT_RULES_BY_ID[cleanId(source.ruleId, "")] || null;
  const unsafeFields = collectUnsafeFields(source);
  if (asArray(source.privateResultRefs).length) unsafeFields.push("candidate.privateResultRefs");
  const safeCandidateId = cleanId(source.candidateId, "scope");
  const normalized = scorePressureEventCandidate({
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    candidateId: cleanId(source.candidateId, `pressure-event:${source.ruleId || "unknown"}`),
    ruleId: cleanId(source.ruleId, ""),
    incidentKind: cleanId(source.incidentKind, rule?.incidentKind || "generic_incident"),
    label: cleanText(source.label, rule?.label || "压力事件", 80),
    sourcePressureRefs: unique(source.sourcePressureRefs, 6),
    sourceDomains: unique(source.sourceDomains, 8),
    sourceSignals: asArray(source.sourceSignals).map((signal) => ({
      ref: cleanId(signal.ref, ""),
      domain: cleanId(signal.domain, "events"),
      sourceKind: cleanId(signal.sourceKind, "pressure"),
      sourceView: cleanText(signal.sourceView, "", 80),
      sourceId: cleanId(signal.sourceId, ""),
      incidentKind: cleanId(signal.incidentKind, "generic_incident"),
      title: cleanText(signal.title, "可见线索", 80),
      publicSummary: cleanText(signal.publicSummary, "可见线索摘要。", 160),
      confidence: normalizeConfidence(signal.confidence, 0.62),
      severity: clampNumber(signal.severity, 1, 5, 2),
      pressureScore: clampNumber(signal.pressureScore, 0, 100, 40),
      scopeRefs: unique(signal.scopeRefs, 8)
    })).filter((signal) => signal.ref),
    affectedRefs: unique(source.affectedRefs, 6),
    publicSummary: cleanText(source.publicSummary, rule?.publicSummaryPrefix || "压力事件候选待服务器裁决。", 180),
    publicClues: uniqueText(source.publicClues, 3, 90),
    confidence: normalizeConfidence(source.confidence, 0.58),
    severity: clampNumber(source.severity, 1, 5, 2),
    priority: clampNumber(source.priority, 0, 100, rule?.priority || 50),
    pressureScore: clampNumber(source.pressureScore, 0, 100, 40),
    cooldownKey: cleanId(source.cooldownKey, `${rule?.cooldownPrefix || "pressure"}:${safeCandidateId}`),
    cooldownTurns: clampNumber(source.cooldownTurns, 1, 12, rule?.cooldownTurns || 2),
    privateResultRefs: [],
    riskTags: unique(source.riskTags, 8),
    authorityBoundary: cleanText(
      source.authorityBoundary,
      "压力事件候选由服务器裁决；模型不能直写事件、状态或数据库。",
      180
    )
  });
  return {
    ...normalized,
    safetyFlags: unsafeFields.length ? ["unsafe_pressure_event_payload"] : []
  };
}

function normalizePressureEventLedger(worldState = {}) {
  const ledger = isPlainObject(worldState.worldPressureEventLedger) ? worldState.worldPressureEventLedger : {};
  return {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    records: asArray(ledger.records).filter(isPlainObject).slice(-WORLD_PRESSURE_EVENT_RECORD_LIMIT),
    cooldowns: isPlainObject(ledger.cooldowns) ? { ...ledger.cooldowns } : {}
  };
}

function cooldownRejection(worldState = {}, candidate = {}) {
  const ledger = normalizePressureEventLedger(worldState);
  const record = ledger.cooldowns[candidate.cooldownKey];
  if (!isPlainObject(record)) return "";
  const now = currentTurn(worldState);
  const lastTurn = clampNumber(record.lastAcceptedTurn, 0, Number.MAX_SAFE_INTEGER, -9999);
  const cooldownTurns = clampNumber(record.cooldownTurns, 1, 12, candidate.cooldownTurns || 2);
  if (now - lastTurn < cooldownTurns) {
    return `压力事件冷却中：${candidate.cooldownKey} 需间隔 ${cooldownTurns} 旬。`;
  }
  return "";
}

function validateCandidateRefs(worldState = {}, candidate = {}, options = {}) {
  const context = options.pressureContext || collectWorldPressureSignals(worldState, options);
  const visibleRefs = new Set(asArray(context.signals).map((signal) => signal.ref));
  return candidate.sourcePressureRefs.filter((ref) => !visibleRefs.has(ref));
}

function rebuildCandidateFromVisibleSignals(normalized = {}, rule = {}, pressureContext = {}) {
  const signalByRef = new Map(asArray(pressureContext.signals).map((signal) => [signal.ref, signal]));
  const sourceSignals = normalized.sourcePressureRefs
    .map((ref) => signalByRef.get(ref))
    .filter(Boolean);
  const rejectionReasons = [];
  if (sourceSignals.length < rule.minimumSources) {
    rejectionReasons.push("压力事件候选可见来源数量未达服务器规则要求。");
  }
  const unmatchedRuleSignals = sourceSignals.filter((signal) => !signalMatchesRule(signal, rule));
  if (unmatchedRuleSignals.length) {
    rejectionReasons.push("压力事件候选来源不符合服务器规则的领域或事件类型。");
  }
  const primary = signalByRef.get(normalized.sourcePressureRefs[0]);
  if (!primary || !isPrimarySignal(primary, rule)) {
    rejectionReasons.push("压力事件候选缺少符合服务器规则的主压力来源。");
  }
  const rebuilt = primary && !unmatchedRuleSignals.length
    ? buildSignalCandidate(rule, primary, sourceSignals)
    : null;
  if (!rebuilt) {
    rejectionReasons.push("压力事件候选无法由当前可见 projection 重新构造。");
  }
  return {
    candidate: rebuilt,
    rejectionReasons: uniqueText(rejectionReasons, 6, 120)
  };
}

function safeStateDelta(delta = {}) {
  const allowed = new Set(WORLD_PRESSURE_EVENT_ALLOWED_STATE_KEYS);
  return Object.fromEntries(
    Object.entries(delta || {}).filter(([key, value]) => allowed.has(key) && Number.isFinite(Number(value)))
  );
}

function scaleRuleDelta(rule = {}, severity = 2) {
  const scale = severity >= 5 ? 1.25 : severity >= 4 ? 1.1 : severity <= 1 ? 0.75 : 1;
  return Object.fromEntries(
    Object.entries(rule.stateDelta || {}).map(([key, value]) => [key, Math.round(value * scale)])
  );
}

function evidencePublicSummary(candidate = {}) {
  const clues = uniqueText(candidate.publicClues, 3, 70);
  if (clues.length) return clues.join("；");
  const labels = asArray(candidate.sourceSignals)
    .map((signal) => cleanText(signal.title || signal.publicSummary, "", 50))
    .filter(Boolean)
    .slice(0, 3);
  return labels.length ? labels.join("、") : "可见压力线索";
}

function buildPressureEventPublicEvent(outcome = {}) {
  const accepted = outcome.status === "accepted";
  const summary = accepted
    ? `${outcome.label}已由服务器成案：${outcome.publicSummary} 公开线索为${outcome.evidenceSummary}，不公开未证实细节或原始材料。`
    : `${outcome.label || "压力事件"}未成案：${outcome.rejectionReasons?.[0] || "压力分数、概率或冷却未达服务器阈值"}。`;
  return {
    eventId: cleanId(`world-pressure-event:${outcome.outcomeId || "outcome"}`, "world-pressure-event"),
    sourceType: "world_pressure_event",
    visibility: "public",
    title: cleanText(outcome.label || "压力事件", "压力事件", 80),
    summary: cleanText(summary, accepted ? "压力事件已成案。" : "压力事件未成案。", 240),
    relatedRefs: []
  };
}

function buildAuditRecord(outcome = {}, context = {}) {
  return {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    auditId: cleanId(`world-pressure-event:${outcome.outcomeId}`, "world-pressure-event"),
    visibility: "developer",
    status: outcome.status,
    ruleId: outcome.ruleId,
    incidentKind: outcome.incidentKind,
    cooldownKey: outcome.cooldownKey,
    sourcePressureRefs: outcome.sourcePressureRefs,
    sourceDomains: outcome.sourceDomains,
    affectedRefs: outcome.affectedRefs,
    score: outcome.score,
    probability: outcome.probability,
    threshold: outcome.threshold,
    stateDelta: outcome.stateDelta,
    rejectionReasons: outcome.rejectionReasons,
    resolverInput: context.resolverInput || null,
    safety: {
      candidatePayloadIncluded: false,
      stateSnapshotIncluded: false,
      sqlIncluded: false,
      hiddenIncluded: false,
      serverAdjudicated: true,
      deterministicProbability: true
    }
  };
}

function resolvePressureEventCandidate(worldState = {}, candidate = {}, auditContext = {}) {
  const normalized = normalizePressureEventCandidate(candidate);
  const rule = WORLD_PRESSURE_EVENT_RULES_BY_ID[normalized.ruleId];
  const rejectionReasons = [];
  if (normalized.safetyFlags.length) rejectionReasons.push("压力事件候选包含禁止来源、隐藏事实、原始材料或直写字段。");
  if (!rule) rejectionReasons.push("压力事件规则不在服务器配置中。");
  if (!normalized.sourcePressureRefs.length) rejectionReasons.push("压力事件候选缺少可见压力源。");
  const pressureContext = auditContext.pressureContext || collectWorldPressureSignals(worldState, auditContext);
  const forgedRefs = rule ? validateCandidateRefs(worldState, normalized, { ...auditContext, pressureContext }) : [];
  if (forgedRefs.length) rejectionReasons.push("压力事件候选引用了当前服务器 projection 不可见的压力源。");
  const rebuiltResult = rule && !forgedRefs.length
    ? rebuildCandidateFromVisibleSignals(normalized, rule, pressureContext)
    : { candidate: null, rejectionReasons: [] };
  rejectionReasons.push(...rebuiltResult.rejectionReasons);
  const authoritative = rebuiltResult.candidate || normalized;
  if (rule && authoritative.score < rule.minimumScore) rejectionReasons.push("压力分数未达服务器成案阈值。");
  if (rule && authoritative.probability < rule.probabilityThreshold) rejectionReasons.push("确定性概率未达服务器成案阈值。");
  const cooldownReason = cooldownRejection(worldState, authoritative);
  if (cooldownReason) rejectionReasons.push(cooldownReason);

  const accepted = rejectionReasons.length === 0;
  const stateDelta = accepted ? safeStateDelta(scaleRuleDelta(rule, authoritative.severity)) : {};
  const outcome = {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    outcomeId: cleanId(`${authoritative.candidateId}:${accepted ? "accepted" : "rejected"}`, "world-pressure-event-outcome"),
    status: accepted ? "accepted" : "rejected",
    ruleId: authoritative.ruleId,
    incidentKind: authoritative.incidentKind,
    label: authoritative.label,
    sourcePressureRefs: authoritative.sourcePressureRefs,
    sourceDomains: authoritative.sourceDomains,
    affectedRefs: authoritative.affectedRefs,
    publicSummary: accepted
      ? cleanText(authoritative.publicSummary, "压力事件已由服务器成案。", 180)
      : "压力事件未通过服务器成案裁决。",
    evidenceSummary: evidencePublicSummary(authoritative),
    severity: authoritative.severity,
    score: authoritative.score,
    probability: authoritative.probability,
    threshold: rule ? {
      minimumScore: rule.minimumScore,
      probabilityThreshold: rule.probabilityThreshold
    } : {},
    cooldownKey: authoritative.cooldownKey,
    cooldownTurns: authoritative.cooldownTurns,
    stateDelta,
    playerDelta: {},
    privateResultRefs: [],
    rejectionReasons: uniqueServerReasons(rejectionReasons, 8, 160),
    riskTags: authoritative.riskTags,
    followUpHooks: accepted ? ["review_world_pressure_event"] : [],
    authorityBoundary: authoritative.authorityBoundary
  };
  outcome.publicEvent = buildPressureEventPublicEvent(outcome);
  outcome.auditRecord = buildAuditRecord(outcome, auditContext);
  return outcome;
}

function applyNumericDelta(target, key, delta) {
  if (!Number.isFinite(Number(delta)) || delta === 0) return;
  if (!WORLD_PRESSURE_EVENT_ALLOWED_STATE_KEYS.includes(key)) return;
  const [min, max] = NUMERIC_RANGES[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const current = Number(target[key]);
  const fallback = Number.isFinite(current) ? current : 0;
  target[key] = clamp(Math.round(fallback + Number(delta)), min, max);
}

function sanitizeOutcomeForApply(outcome = {}) {
  const safeOutcome = {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    outcomeId: cleanId(outcome.outcomeId, "world-pressure-event-outcome"),
    status: cleanText(outcome.status, "rejected", 32),
    ruleId: cleanId(outcome.ruleId, "pressure-rule"),
    incidentKind: cleanId(outcome.incidentKind, "generic_incident"),
    label: cleanText(outcome.label, "压力事件", 80),
    sourcePressureRefs: unique(outcome.sourcePressureRefs, 6),
    sourceDomains: unique(outcome.sourceDomains, 8),
    affectedRefs: unique(outcome.affectedRefs, 6),
    publicSummary: cleanText(outcome.publicSummary, "压力事件已由服务器成案。", 180),
    evidenceSummary: cleanText(outcome.evidenceSummary, "可见压力线索", 140),
    severity: clampNumber(outcome.severity, 1, 5, 2),
    score: clampNumber(outcome.score, 0, 100, 0),
    probability: normalizeConfidence(outcome.probability, 0),
    cooldownKey: cleanId(outcome.cooldownKey, "world-pressure-event:cooldown"),
    cooldownTurns: clampNumber(outcome.cooldownTurns, 1, 12, 2),
    stateDelta: safeStateDelta(outcome.stateDelta),
    rejectionReasons: uniqueServerReasons(outcome.rejectionReasons, 6, 120),
    riskTags: unique(outcome.riskTags, 8),
    followUpHooks: unique(outcome.followUpHooks, 6),
    authorityBoundary: cleanText(
      outcome.authorityBoundary,
      "压力事件 outcome 由服务器裁决；应用阶段只写白名单状态与公开摘要。",
      180
    )
  };
  return {
    ...safeOutcome,
    publicEvent: buildPressureEventPublicEvent(safeOutcome)
  };
}

function applyPressureEventOutcome(worldState = {}, outcome = {}, auditContext = {}) {
  if (outcome.status !== "accepted") return worldState;
  const safeOutcome = sanitizeOutcomeForApply(outcome);
  for (const [key, delta] of Object.entries(safeOutcome.stateDelta || {})) {
    applyNumericDelta(worldState, key, delta);
  }
  appendEvents(worldState, [safeOutcome.publicEvent.summary]);
  const ledger = normalizePressureEventLedger(worldState);
  const appliedAtTurn = clampNumber(auditContext.turn ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
  ledger.records.push({
    outcomeId: safeOutcome.outcomeId,
    ruleId: safeOutcome.ruleId,
    incidentKind: safeOutcome.incidentKind,
    label: safeOutcome.label,
    status: "accepted",
    sourcePressureRefs: safeOutcome.sourcePressureRefs,
    sourceDomains: safeOutcome.sourceDomains,
    affectedRefs: safeOutcome.affectedRefs,
    score: safeOutcome.score,
    probability: safeOutcome.probability,
    cooldownKey: safeOutcome.cooldownKey,
    cooldownTurns: safeOutcome.cooldownTurns,
    stateDelta: safeOutcome.stateDelta,
    publicSummary: cleanText(safeOutcome.publicEvent.summary, "压力事件已成案。", 240),
    appliedAtTurn
  });
  ledger.records = ledger.records.slice(-WORLD_PRESSURE_EVENT_RECORD_LIMIT);
  ledger.cooldowns[safeOutcome.cooldownKey] = {
    ruleId: safeOutcome.ruleId,
    outcomeId: safeOutcome.outcomeId,
    lastAcceptedTurn: appliedAtTurn,
    cooldownTurns: safeOutcome.cooldownTurns
  };
  worldState.worldPressureEventLedger = ledger;
  return worldState;
}

function resolveAndApplyPressureEvents(worldState = {}, options = {}) {
  const pressureContext = collectWorldPressureSignals(worldState, options);
  const candidates = generatePressureEventCandidates(worldState, { ...options, pressureContext });
  const maxEvents = clampNumber(
    options.maxEvents,
    1,
    10,
    WORLD_PRESSURE_EVENT_DEFAULT_MAX_EVENTS
  );
  const outcomes = [];
  const ledger = normalizePressureEventLedger(worldState);
  const turn = currentTurn(worldState);
  let acceptedCount = ledger.records.filter((record) => record.appliedAtTurn === turn).length;
  for (const candidate of candidates) {
    const outcome = resolvePressureEventCandidate(worldState, candidate, {
      ...options,
      pressureContext,
      resolverInput: pressureContext.resolverInput
    });
    outcomes.push(outcome);
    if (outcome.status !== "accepted") continue;
    if (acceptedCount >= maxEvents) {
      outcome.status = "rejected";
      outcome.stateDelta = {};
      outcome.playerDelta = {};
      outcome.rejectionReasons = ["本旬压力事件成案数量已达服务器上限。"];
      outcome.publicSummary = "压力事件未通过服务器成案裁决。";
      outcome.publicEvent = buildPressureEventPublicEvent(outcome);
      outcome.auditRecord = buildAuditRecord(outcome, {
        resolverInput: pressureContext.resolverInput
      });
      continue;
    }
    applyPressureEventOutcome(worldState, outcome, options.auditContext);
    acceptedCount += 1;
  }
  return {
    schemaVersion: WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
    pressureContext,
    candidates,
    outcomes,
    acceptedOutcomes: outcomes.filter((outcome) => outcome.status === "accepted")
  };
}

module.exports = {
  WORLD_PRESSURE_EVENT_SCHEMA_VERSION,
  applyPressureEventOutcome,
  collectWorldPressureSignals,
  generatePressureEventCandidates,
  normalizePressureEventCandidate,
  resolveAndApplyPressureEvents,
  resolvePressureEventCandidate,
  scorePressureEventCandidate
};
