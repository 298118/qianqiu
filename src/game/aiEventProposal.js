const { createEventIncidentAdjudicationToolDefinition, createEventProposalToolDefinition } = require("../ai/eventToolDefinitions");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildEventArchiveView } = require("./eventArchive");
const { buildIntelligenceRumorView } = require("./intelligenceRumors");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildWorldEntityView } = require("./worldEntities");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");
const { isToolAllowedForActor } = require("./aiActorProfiles");
const {
  AI_EVENT_PROPOSAL_SCHEMA_VERSION,
  EVENT_INCIDENT_KINDS,
  EVENT_PROPOSAL_LIMITS,
  EVENT_VISIBILITY_LEVELS,
  SOURCE_PRESSURE_DOMAIN_ALIASES
} = require("./aiEventProposalConfig");

const SENSITIVE_EVENT_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal|source|path|key|hidden|raw|SQL)\b|server\.[A-Za-z0-9_.:-]+|rawSql|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;
const FORBIDDEN_EVENT_KEYS = new Set([
  "rawSql",
  "sql",
  "statePatch",
  "worldState",
  "rawTable",
  "rawAudit",
  "rawPrompt",
  "providerConfig",
  "localPath",
  "hiddenNotes",
  "hiddenIntent",
  "apiKey"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = EVENT_PROPOSAL_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_EVENT_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
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

function cleanTextList(values, limit = 6, maxLength = 120) {
  const result = [];
  for (const value of asArray(values)) {
    const text = cleanText(value, "", maxLength);
    if (!text || result.includes(text)) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanRefList(values, limit = EVENT_PROPOSAL_LIMITS.maxSourcePressureRefs) {
  return cleanTextList(values, limit, 120)
    .map((ref) => cleanId(ref, ""))
    .filter(Boolean);
}

function collectUnsafeFields(value, path = "proposal", findings = []) {
  if (typeof value === "string") {
    if (SENSITIVE_EVENT_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeFields(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVENT_KEYS.has(key) || SENSITIVE_EVENT_TEXT_PATTERN.test(key)) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function actorRef(actorProfile = {}, fallback = {}) {
  const source = isPlainObject(fallback) ? fallback : {};
  return {
    actorId: cleanText(actorProfile.actorId || source.actorId, "actor:unknown", 96),
    actorType: cleanText(actorProfile.actorType || source.actorType, "unknown", 48),
    authorityTier: cleanText(actorProfile.authorityTier || source.authorityTier, "T0", 4),
    officeId: cleanText(actorProfile.officeId || source.officeId, "", 96),
    jurisdictionRefs: cleanRefList(actorProfile.jurisdictionRefs || source.jurisdictionRefs, 8)
  };
}

function normalizeIncidentKind(value, fallback = "generic_incident") {
  const text = cleanText(value, "", 48);
  return EVENT_INCIDENT_KINDS.includes(text) ? text : fallback;
}

function normalizeVisibility(value, fallback = "actor_visible") {
  const text = cleanText(value, "", 48);
  return EVENT_VISIBILITY_LEVELS.includes(text) ? text : fallback;
}

function pressureSeverity(value) {
  return clampNumber(value, 0, 5, 2);
}

function severityFromPressure(value) {
  const score = clampNumber(value, 0, 100, 40);
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 3;
  if (score >= 35) return 2;
  return 1;
}

function normalizeEventProposal(proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const requestedAdjudication = options.requestedAdjudication === true ||
    options.toolName === "event.request_incident_adjudication";
  const incidentKind = normalizeIncidentKind(source.incidentKind);
  const sourcePressureRefs = cleanRefList(source.sourcePressureRefs);
  const actor = actorRef(options.actorProfile, source.actorRef);
  const cooldownKey = cleanId(
    source.cooldownKey,
    `${incidentKind}:${sourcePressureRefs[0] || actor.actorId || "pressure"}`
  );
  const safetyFlags = collectUnsafeFields(source)
    .map((field) => `unsafe_text:${field}`)
    .slice(0, 8);
  if (asArray(source.privateResultRefs).length) {
    safetyFlags.push("private_result_refs_from_model");
  }

  return {
    schemaVersion: AI_EVENT_PROPOSAL_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `event:${actor.actorId}:${cooldownKey}`),
    toolName: requestedAdjudication ? "event.request_incident_adjudication" : "event.propose_incident",
    actorRef: actor,
    incidentKind,
    publicSummary: cleanText(source.publicSummary, "压力事件候选待服务器裁决。", 180),
    sourcePressureRefs,
    visibility: normalizeVisibility(source.visibility),
    confidence: clampFloat(source.confidence, 0, 1, 0.5),
    severity: pressureSeverity(source.severity),
    cooldownKey,
    affectedRefs: cleanRefList(source.affectedRefs, EVENT_PROPOSAL_LIMITS.maxAffectedRefs),
    privateResultRefs: [],
    riskTags: cleanRefList(source.riskTags, EVENT_PROPOSAL_LIMITS.maxRiskTags),
    safetyFlags,
    requestedAdjudication,
    accepted: false,
    authorityBoundary: "事件候选只进入服务器待裁决队列；成案、公开事件、状态变化、审计和持久化仍归服务器 resolver。"
  };
}

function actorReadDomains(actorProfile = {}) {
  const domains = actorProfile.visibilityProfile?.readDomains;
  return new Set(Array.isArray(domains) ? domains : []);
}

function domainVisibleToActor(domain, actorProfile = {}) {
  const readDomains = actorReadDomains(actorProfile);
  const aliases = SOURCE_PRESSURE_DOMAIN_ALIASES[domain] || [domain];
  return aliases.some((alias) => readDomains.has(alias));
}

function pushPressureRef(refs, actorProfile, entry) {
  if (!entry?.domain || !entry?.id) return;
  if (!domainVisibleToActor(entry.domain, actorProfile)) return;
  const ref = `${entry.domain}:${cleanId(entry.id, "pressure")}`;
  refs.set(ref, {
    ref,
    domain: entry.domain,
    id: cleanId(entry.id, "pressure"),
    incidentKind: normalizeIncidentKind(entry.incidentKind),
    publicSummary: cleanText(entry.publicSummary, "可见压力摘要。", 160),
    title: cleanText(entry.title, "", 80),
    severity: severityFromPressure(entry.pressureScore),
    riskTags: cleanRefList(entry.riskTags, EVENT_PROPOSAL_LIMITS.maxRiskTags)
  });
}

function collectVisiblePressureRefs(worldState = {}, actorProfile = {}) {
  const refs = new Map();
  const geography = buildWorldGeographyView(worldState);
  for (const city of asArray(geography.highlights?.cities).slice(0, 4)) {
    pushPressureRef(refs, actorProfile, {
      domain: "geography",
      id: city.id,
      incidentKind: "city_pressure",
      title: city.name,
      pressureScore: city.pressure,
      publicSummary: city.publicSummary || `${city.name || "城市"}压力约${city.pressure || 0}。`,
      riskTags: ["city_pressure"]
    });
  }
  for (const frontier of asArray(geography.highlights?.frontierZones).slice(0, 3)) {
    pushPressureRef(refs, actorProfile, {
      domain: "geography",
      id: frontier.id,
      incidentKind: "frontier_alert",
      title: frontier.name,
      pressureScore: frontier.pressure,
      publicSummary: frontier.publicSummary || `${frontier.name || "边面"}边压约${frontier.pressure || 0}。`,
      riskTags: ["frontier_alert"]
    });
  }

  const dockets = buildLocalAffairsDocketView(worldState);
  for (const docket of asArray(dockets.dockets).slice(0, 5)) {
    pushPressureRef(refs, actorProfile, {
      domain: "local_docket",
      id: docket.id,
      incidentKind: "local_docket",
      title: docket.title,
      pressureScore: Math.max((docket.severity || 0) * 20, docket.pressureScore || 0),
      publicSummary: docket.publicSummary,
      riskTags: [docket.domain || "local_docket"]
    });
  }

  const fiscal = buildEconomicFiscalView(worldState);
  for (const incident of asArray(fiscal.marketIncidents).slice(0, 4)) {
    pushPressureRef(refs, actorProfile, {
      domain: "market",
      id: incident.id,
      incidentKind: "fiscal_market",
      title: incident.title,
      pressureScore: incident.pressureScore || incident.marketPressure || incident.fiscalPressure,
      publicSummary: incident.publicSummary,
      riskTags: ["fiscal_market", incident.kind || ""]
    });
  }

  const military = buildMilitaryDiplomacyView(worldState);
  for (const incident of asArray(military.frontierIncidents).slice(0, 4)) {
    pushPressureRef(refs, actorProfile, {
      domain: "military",
      id: incident.id,
      incidentKind: "frontier_alert",
      title: incident.title,
      pressureScore: incident.pressureScore || incident.threatScore || incident.supplyRisk,
      publicSummary: incident.publicSummary,
      riskTags: ["frontier_alert", incident.kind || ""]
    });
  }

  const intel = buildIntelligenceRumorView(worldState);
  for (const rumor of asArray(intel.publicRumors).slice(0, 4)) {
    pushPressureRef(refs, actorProfile, {
      domain: "intel",
      id: rumor.id,
      incidentKind: "rumor_pressure",
      title: rumor.sourceLabel || rumor.channelLabel,
      pressureScore: rumor.pressureScore || rumor.priorityScore || rumor.credibilityScore,
      publicSummary: rumor.publicSummary,
      riskTags: ["rumor_pressure", rumor.kind || ""]
    });
  }

  const people = buildWorldPeopleView(worldState);
  for (const relation of asArray(people.relationships).slice(0, 8)) {
    if ((relation.resentment || 0) < 20 && (relation.rivalry || 0) < 15) continue;
    pushPressureRef(refs, actorProfile, {
      domain: "people",
      id: relation.id,
      incidentKind: "npc_resentment",
      title: relation.targetId || relation.targetType,
      pressureScore: Math.max(relation.resentment || 0, relation.rivalry || 0),
      publicSummary: relation.publicSummary,
      riskTags: ["npc_resentment"]
    });
  }

  const entities = buildWorldEntityView(worldState);
  const entityCandidates = [
    ...asArray(entities.highlights),
    ...asArray(entities.groups).flatMap((group) => asArray(group.entities))
  ];
  const seenEntityIds = new Set();
  for (const entity of entityCandidates) {
    const entityId = cleanId(entity.id, "");
    if (!entityId || seenEntityIds.has(entityId)) continue;
    seenEntityIds.add(entityId);
    const metrics = entity.metrics || {};
    const incidentKind = {
      academy: "academy_pressure",
      court: "court_pressure",
      military: "frontier_alert",
      fiscal: "fiscal_market",
      relief: "city_pressure",
      local: "city_pressure"
    }[entity.category] || "generic_incident";
    pushPressureRef(refs, actorProfile, {
      domain: "world_entity",
      id: entity.id,
      incidentKind,
      title: entity.name,
      pressureScore: Math.max(metrics.pressure || 0, metrics.deficit || 0, 100 - (metrics.capacity || 100)),
      publicSummary: entity.publicSummary,
      riskTags: [entity.category || "", entity.kind || ""]
    });
    if (seenEntityIds.size >= 16) break;
  }

  const archive = buildEventArchiveView(worldState, { pageSize: 6 });
  for (const item of asArray(archive.items).slice(0, 6)) {
    pushPressureRef(refs, actorProfile, {
      domain: "events",
      id: item.id,
      incidentKind: "generic_incident",
      title: item.title,
      pressureScore: item.riskScore || 35,
      publicSummary: item.summary,
      riskTags: [item.kind || ""]
    });
  }

  return refs;
}

function validateEventProposalAuthority(actorProfile = {}, proposal = {}, context = {}) {
  const normalized = proposal.schemaVersion === AI_EVENT_PROPOSAL_SCHEMA_VERSION
    ? proposal
    : normalizeEventProposal(proposal, { actorProfile, toolName: context.toolName });
  const toolDefinition = context.toolDefinition ||
    (normalized.requestedAdjudication
      ? createEventIncidentAdjudicationToolDefinition()
      : createEventProposalToolDefinition());
  const reasons = [];

  if (normalized.safetyFlags.length) {
    reasons.push("事件 proposal 含隐藏、原始、路径、密钥、SQL 或内部 resolver 形状文本。");
  }
  if (!actorProfile?.actorId) {
    reasons.push("缺少 actor profile，不能提交事件候选。");
  } else if (!isToolAllowedForActor(actorProfile, toolDefinition, {
    jurisdictionRef: context.jurisdictionRef || normalized.affectedRefs[0] || ""
  })) {
    reasons.push("actor 无权提交该事件工具或辖区不匹配。");
  }
  if (!normalized.sourcePressureRefs.length) {
    reasons.push("事件候选缺少可见压力源。");
  }
  const visibleRefs = collectVisiblePressureRefs(context.worldState || {}, actorProfile);
  for (const ref of normalized.sourcePressureRefs) {
    if (!visibleRefs.has(ref)) {
      reasons.push(`压力源 ${ref} 不在当前 actor 可见 projection 内。`);
    }
  }

  return {
    accepted: reasons.length === 0,
    status: reasons.length === 0 ? "pending" : "rejected",
    rejectionReasons: reasons.slice(0, 8),
    visiblePressureRefs: normalized.sourcePressureRefs
      .map((ref) => visibleRefs.get(ref))
      .filter(Boolean)
  };
}

function resolveEventProposal(worldState = {}, proposal = {}, options = {}) {
  const normalized = normalizeEventProposal(proposal, {
    actorProfile: options.actorProfile,
    requestedAdjudication: options.requestedAdjudication,
    toolName: options.toolName
  });
  const validation = validateEventProposalAuthority(options.actorProfile || {}, normalized, {
    ...options.context,
    worldState,
    toolDefinition: options.toolDefinition,
    toolName: normalized.toolName,
    jurisdictionRef: options.jurisdictionRef
  });
  const accepted = validation.accepted;
  const publicSummary = accepted
    ? `事件候选已进入服务器待裁决队列：${normalized.publicSummary}`
    : "事件候选未被服务器接受。";

  return {
    status: accepted ? "pending" : "rejected",
    publicResult: {
      summary: cleanText(publicSummary, "事件候选已记录为待裁决。", 180),
      visibleChanges: accepted ? [
        normalized.publicSummary,
        `压力源：${normalized.sourcePressureRefs.slice(0, 3).join("、")}`
      ].map((text) => cleanText(text, "", 140)).filter(Boolean) : []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: validation.rejectionReasons.map((reason) => cleanText(reason, "服务器拒绝事件候选。", 160)),
    counterCosts: accepted
      ? ["S70.6 只记录压力事件候选；成案、概率、冷却和事件档案写入留给服务器后续 resolver。"]
      : [],
    followUpHooks: accepted ? ["review_event_candidate"] : [],
    normalizedProposal: {
      ...normalized,
      accepted
    }
  };
}

function buildEventProposalAudit(proposal = {}, result = {}) {
  const normalized = proposal.schemaVersion === AI_EVENT_PROPOSAL_SCHEMA_VERSION
    ? proposal
    : normalizeEventProposal(proposal);
  return {
    schemaVersion: AI_EVENT_PROPOSAL_SCHEMA_VERSION,
    auditId: cleanId(`ai-event-proposal:${normalized.proposalId}`, "ai-event-proposal"),
    visibility: "developer",
    toolName: cleanText(normalized.toolName, "event.propose_incident", 96),
    status: cleanText(result.status, "pending", 32),
    actorRef: actorRef(normalized.actorRef),
    incidentKind: normalizeIncidentKind(normalized.incidentKind),
    sourcePressureRefs: cleanRefList(normalized.sourcePressureRefs, EVENT_PROPOSAL_LIMITS.maxAuditRefs),
    visibilityLevel: normalizeVisibility(normalized.visibility),
    confidence: clampFloat(normalized.confidence, 0, 1, 0.5),
    severity: pressureSeverity(normalized.severity),
    publicSummary: cleanText(normalized.publicSummary, "事件候选已脱敏。", 160),
    rejectionReasons: cleanTextList(result.rejectionReasons, 6, 140),
    privateResultRefs: [],
    appliedEventIds: []
  };
}

function proposalForPressureEntry(entry, actorProfile, options = {}) {
  return normalizeEventProposal({
    incidentKind: entry.incidentKind,
    publicSummary: `${entry.title || "可见压力"}形成事件候选：${entry.publicSummary}`,
    sourcePressureRefs: [entry.ref],
    visibility: options.visibility || "actor_visible",
    confidence: options.confidence ?? 0.56,
    severity: entry.severity,
    cooldownKey: `${entry.incidentKind}:${entry.ref}`,
    affectedRefs: [entry.ref],
    privateResultRefs: [],
    riskTags: entry.riskTags
  }, { actorProfile });
}

function buildMockEventProposals(worldState = {}, actorProfile = {}, options = {}) {
  const refs = [...collectVisiblePressureRefs(worldState, actorProfile).values()];
  const desiredKinds = [
    "city_pressure",
    "frontier_alert",
    "academy_pressure",
    "court_pressure",
    "npc_resentment",
    "fiscal_market",
    "local_docket",
    "rumor_pressure"
  ];
  const proposals = [];
  const limit = clampNumber(options.limit, 1, EVENT_PROPOSAL_LIMITS.maxMockProposals, EVENT_PROPOSAL_LIMITS.maxMockProposals);

  for (const kind of desiredKinds) {
    const entry = refs.find((candidate) => candidate.incidentKind === kind);
    if (!entry) continue;
    const proposal = proposalForPressureEntry(entry, actorProfile, options);
    const validation = validateEventProposalAuthority(actorProfile, proposal, { worldState });
    if (validation.accepted) proposals.push(proposal);
    if (proposals.length >= limit) break;
  }

  return proposals;
}

module.exports = {
  buildEventProposalAudit,
  buildMockEventProposals,
  collectVisiblePressureRefs,
  normalizeEventProposal,
  resolveEventProposal,
  validateEventProposalAuthority
};
