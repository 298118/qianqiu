const { createDomainToolDefinitions } = require("../ai/domainToolDefinitions");
const { buildAppointmentTrackView } = require("./appointmentTracks");
const { isToolAllowedForActor } = require("./aiActorProfiles");
const { buildEconomicFiscalView } = require("./economicFiscal");
const { buildEventArchiveView } = require("./eventArchive");
const { buildExamHonorView } = require("./examHonors");
const { buildExamProcedureView } = require("./examProcedure");
const { buildExaminerPanelView } = require("./examReview");
const { buildIntelligenceRumorView } = require("./intelligenceRumors");
const { buildLocalAffairsDocketView } = require("./localAffairsDockets");
const { buildMilitaryDiplomacyView } = require("./militaryDiplomacy");
const { buildOfficialPostingsView } = require("./officialPostings");
const { buildWorldGeographyView } = require("./worldGeography");
const { buildWorldPeopleView } = require("./worldPeople");

const DOMAIN_TOOL_SCHEMA_VERSION = 1;
const MAX_DOMAIN_TEXT_LENGTH = 180;
const COMMON_DOMAIN_INPUT_FIELDS = new Set([
  "publicSummary",
  "evidenceRefs",
  "targetRefs",
  "jurisdictionRef",
  "visibility",
  "confidence",
  "riskLevel",
  "cooldownKey",
  "expectedBenefits",
  "counterCosts",
  "riskDisclosure",
  "privateResultRefs",
  "riskTags"
]);

const SENSITIVE_DOMAIN_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal|source|path|key|hidden|raw|SQL)\b|server\.[A-Za-z0-9_.:-]+|rawSql|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

const FORBIDDEN_DOMAIN_KEYS = new Set([
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

const EVIDENCE_DOMAIN_ALIASES = Object.freeze({
  local_docket: ["local_docket", "office", "events"],
  market: ["market", "events"],
  geography: ["geography", "events"],
  military: ["military", "diplomacy", "intel", "events", "geography"],
  diplomacy: ["diplomacy", "military", "intel", "events", "geography"],
  intel: ["intel", "events"],
  office: ["office", "career", "events"],
  career: ["career", "office", "events"],
  exam: ["exam", "office", "events"],
  people: ["people", "events"],
  events: ["events"]
});

const TOOL_EVIDENCE_DOMAINS = Object.freeze({
  "judicial.propose_case_resolution": ["local_docket", "office", "people", "events"],
  "city.propose_policy": ["local_docket", "market", "geography", "events"],
  "military.propose_order": ["military", "diplomacy", "geography", "intel", "events", "market"],
  "diplomacy.propose_move": ["diplomacy", "military", "geography", "intel", "events", "market"],
  "exam.request_ranking_adjudication": ["exam", "office", "events"],
  "office.request_appointment_adjudication": ["office", "career", "exam", "events"],
  "career.propose_reward_or_promotion": ["office", "career", "exam", "people", "events"],
  "career.request_discipline_adjudication": ["office", "local_docket", "people", "events"]
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = MAX_DOMAIN_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_DOMAIN_TEXT_PATTERN.test(trimmed)) return fallback;
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

function normalizeEvidenceConfidence(entry = {}, fallback = 0.6) {
  const value = entry.confidence ?? entry.intelConfidence ?? entry.trustScore ?? entry.reliability;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Number(clampFloat(normalized, 0, 1, fallback).toFixed(3));
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

function cleanRefList(values, limit = 8) {
  return cleanTextList(values, limit, 120)
    .map((ref) => cleanId(ref, ""))
    .filter(Boolean);
}

function scopeRefsForEntry(entry = {}) {
  return cleanRefList([
    entry.jurisdictionId,
    entry.cityId,
    entry.regionId,
    entry.countryId,
    entry.neighborCountryId,
    entry.frontierZoneId,
    entry.routeId,
    entry.officeId,
    entry.postingId,
    entry.bureauId,
    ...asArray(entry.cityIds),
    ...asArray(entry.routeIds),
    ...asArray(entry.scopeRefs)
  ], 16);
}

function collectUnsafeFields(value, path = "arguments", findings = []) {
  if (typeof value === "string") {
    if (SENSITIVE_DOMAIN_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeFields(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_DOMAIN_KEYS.has(key) || SENSITIVE_DOMAIN_TEXT_PATTERN.test(key)) {
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

function actionPropertyForTool(toolDefinition = {}) {
  const properties = toolDefinition.inputSchema?.properties || {};
  return Object.keys(properties).find((propertyName) => !COMMON_DOMAIN_INPUT_FIELDS.has(propertyName)) || "domainAction";
}

function normalizeVisibility(value, fallback = "actor_visible") {
  const text = cleanText(value, "", 48);
  return ["player_visible", "actor_visible"].includes(text) ? text : fallback;
}

function normalizeDomainToolProposal(argumentsPayload = {}, options = {}) {
  const source = isPlainObject(argumentsPayload) ? argumentsPayload : {};
  const toolDefinition = options.toolDefinition || {};
  const actionProperty = actionPropertyForTool(toolDefinition);
  const actor = actorRef(options.actorProfile, source.actorRef);
  const actionEnum = toolDefinition.inputSchema?.properties?.[actionProperty]?.enum || [];
  const actionKind = cleanText(source[actionProperty], "", 64);
  const safeActionKind = actionEnum.includes(actionKind) ? actionKind : (actionEnum[0] || "review");
  const evidenceRefs = cleanRefList(source.evidenceRefs, 8);
  const cooldownKey = cleanId(
    source.cooldownKey,
    `${toolDefinition.name || "domain.tool"}:${safeActionKind}:${evidenceRefs[0] || actor.actorId}`
  );
  const safetyFlags = collectUnsafeFields(source)
    .map((field) => `unsafe_text:${field}`)
    .slice(0, 10);
  if (asArray(source.privateResultRefs).length) {
    safetyFlags.push("private_result_refs_from_model");
  }

  return {
    schemaVersion: DOMAIN_TOOL_SCHEMA_VERSION,
    proposalId: cleanId(`domain:${actor.actorId}:${cooldownKey}`, "domain-tool-proposal"),
    toolName: cleanText(toolDefinition.name, "domain.tool", 96),
    actionProperty,
    actionKind: safeActionKind,
    actorRef: actor,
    publicSummary: cleanText(source.publicSummary, "领域工具意图待服务器裁决。", 180),
    evidenceRefs,
    targetRefs: cleanRefList(source.targetRefs, 8),
    jurisdictionRef: cleanId(source.jurisdictionRef, ""),
    visibility: normalizeVisibility(source.visibility),
    confidence: clampFloat(source.confidence, 0, 1, 0.5),
    riskLevel: clampNumber(source.riskLevel, 0, 5, 2),
    cooldownKey,
    expectedBenefits: cleanTextList(source.expectedBenefits, 5, 120),
    counterCosts: cleanTextList(source.counterCosts, 5, 120),
    riskDisclosure: cleanText(source.riskDisclosure, "需服务器复核证据、法度与执行链风险。", 180),
    privateResultRefs: [],
    riskTags: cleanRefList(source.riskTags, 6),
    safetyFlags,
    accepted: false,
    authorityBoundary: "领域工具只提交待裁决意图；判案、赈济、军令、战和、定榜、授官、赏罚、落库和审计仍归服务器 resolver。"
  };
}

function actorReadDomains(actorProfile = {}) {
  const domains = actorProfile.visibilityProfile?.readDomains;
  return new Set(Array.isArray(domains) ? domains : []);
}

function actorToolGroups(actorProfile = {}) {
  const groups = actorProfile.allowedToolGroups;
  return new Set(Array.isArray(groups) ? groups : []);
}

function evidenceDomainVisibleToActor(domain, actorProfile = {}) {
  const readDomains = actorReadDomains(actorProfile);
  const toolGroups = actorToolGroups(actorProfile);
  const aliases = EVIDENCE_DOMAIN_ALIASES[domain] || [domain];
  if (aliases.some((alias) => readDomains.has(alias))) return true;
  if (domain === "exam" && toolGroups.has("exam")) return true;
  if (domain === "career" && toolGroups.has("career")) return true;
  if (domain === "military" && toolGroups.has("military")) return true;
  if (domain === "diplomacy" && toolGroups.has("diplomacy")) return true;
  if (domain === "local_docket" && (toolGroups.has("judicial") || toolGroups.has("city_policy"))) return true;
  if (domain === "market" && (toolGroups.has("market") || toolGroups.has("city_policy"))) return true;
  return false;
}

function pushEvidenceRef(refs, actorProfile, entry) {
  if (!entry?.domain || !entry?.id) return;
  if (!evidenceDomainVisibleToActor(entry.domain, actorProfile)) return;
  const id = cleanId(entry.id, "evidence");
  const ref = `${entry.domain}:${id}`;
  refs.set(ref, {
    ref,
    domain: entry.domain,
    id,
    sourceView: cleanText(entry.sourceView, "", 80),
    title: cleanText(entry.title, "", 80),
    publicSummary: cleanText(entry.publicSummary, "可见证据摘要。", 160),
    confidence: normalizeEvidenceConfidence(entry),
    scopeRefs: scopeRefsForEntry(entry),
    riskTags: cleanRefList(entry.riskTags, 6)
  });
}

function collectVisibleDomainEvidenceRefs(worldState = {}, actorProfile = {}) {
  const refs = new Map();

  const dockets = buildLocalAffairsDocketView(worldState);
  for (const docket of asArray(dockets.dockets).slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "local_docket",
      id: docket.id,
      sourceView: "localAffairsDocketView.dockets",
      title: docket.title,
      publicSummary: docket.publicSummary,
      confidence: docket.confidence ?? docket.intelConfidence,
      jurisdictionId: docket.jurisdictionId,
      cityId: docket.cityId,
      regionId: docket.regionId,
      countryId: docket.countryId,
      officeId: docket.officeId,
      postingId: docket.postingId,
      bureauId: docket.bureauId,
      riskTags: [docket.domain || "local_docket", docket.status || ""]
    });
  }

  const fiscal = buildEconomicFiscalView(worldState);
  for (const ledger of asArray(fiscal.fiscalLedgers).slice(0, 4)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "market",
      id: ledger.id,
      sourceView: "economicFiscalView.fiscalLedgers",
      title: ledger.title,
      publicSummary: ledger.publicSummary,
      confidence: ledger.confidence ?? ledger.intelConfidence,
      countryId: ledger.countryId,
      riskTags: ["fiscal", ledger.status || ""]
    });
  }
  for (const market of [...asArray(fiscal.grainMarketReports), ...asArray(fiscal.marketIncidents)].slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "market",
      id: market.id,
      sourceView: "economicFiscalView.market",
      title: market.title,
      publicSummary: market.publicSummary,
      confidence: market.confidence ?? market.intelConfidence,
      cityId: market.cityId,
      regionId: market.regionId,
      countryId: market.countryId,
      riskTags: ["market", market.kind || ""]
    });
  }

  const military = buildMilitaryDiplomacyView(worldState);
  for (const theater of asArray(military.theaters).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "military",
      id: theater.id,
      sourceView: "militaryDiplomacyView.theaters",
      title: theater.title || theater.name,
      publicSummary: theater.publicSummary,
      confidence: theater.confidence ?? theater.intelConfidence,
      frontierZoneId: theater.frontierZoneId,
      cityIds: theater.cityIds,
      routeIds: theater.routeIds,
      countryId: theater.countryId,
      neighborCountryId: theater.neighborCountryId,
      riskTags: ["military", theater.status || ""]
    });
    pushEvidenceRef(refs, actorProfile, {
      domain: "diplomacy",
      id: theater.id,
      sourceView: "militaryDiplomacyView.theaters",
      title: theater.title || theater.name,
      publicSummary: theater.publicSummary,
      confidence: theater.confidence ?? theater.intelConfidence,
      frontierZoneId: theater.frontierZoneId,
      cityIds: theater.cityIds,
      routeIds: theater.routeIds,
      countryId: theater.countryId,
      neighborCountryId: theater.neighborCountryId,
      riskTags: ["diplomacy", theater.status || ""]
    });
  }
  for (const incident of asArray(military.frontierIncidents).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "military",
      id: incident.id,
      sourceView: "militaryDiplomacyView.frontierIncidents",
      title: incident.title,
      publicSummary: incident.publicSummary,
      confidence: incident.confidence ?? incident.intelConfidence,
      frontierZoneId: incident.frontierZoneId,
      cityId: incident.cityId,
      regionId: incident.regionId,
      countryId: incident.countryId,
      scopeRefs: incident.relatedRefs,
      riskTags: ["frontier", incident.kind || ""]
    });
  }

  const intel = buildIntelligenceRumorView(worldState);
  for (const rumor of asArray(intel.publicRumors).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "intel",
      id: rumor.id,
      sourceView: "intelligenceRumorView.publicRumors",
      title: rumor.sourceLabel || rumor.channelLabel,
      publicSummary: rumor.publicSummary,
      confidence: rumor.confidence ?? rumor.intelConfidence,
      cityId: rumor.cityId,
      regionId: rumor.regionId,
      countryId: rumor.countryId,
      scopeRefs: rumor.relatedRefs,
      riskTags: ["intel", rumor.kind || ""]
    });
  }

  const geography = buildWorldGeographyView(worldState);
  for (const city of asArray(geography.cities).slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "geography",
      id: city.id,
      sourceView: "worldGeographyView.cities",
      title: city.name,
      publicSummary: city.publicSummary || city.regionName,
      confidence: city.confidence ?? city.intelConfidence,
      cityId: city.id,
      regionId: city.regionId,
      countryId: city.countryId,
      riskTags: ["city", city.status || ""]
    });
  }
  for (const frontier of asArray(geography.frontierZones).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "geography",
      id: frontier.id,
      sourceView: "worldGeographyView.frontierZones",
      title: frontier.name,
      publicSummary: frontier.publicSummary,
      confidence: frontier.confidence ?? frontier.intelConfidence,
      frontierZoneId: frontier.id,
      countryId: frontier.countryId,
      neighborCountryId: frontier.neighborCountryId,
      cityIds: frontier.cityIds,
      routeIds: frontier.routeIds,
      riskTags: ["frontier", frontier.status || ""]
    });
  }

  const office = buildOfficialPostingsView(worldState);
  for (const posting of asArray(office.postings).slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "office",
      id: posting.id,
      sourceView: "officialPostingsView.postings",
      title: posting.officeTitle,
      publicSummary: posting.publicSummary || posting.statusLabel,
      jurisdictionId: posting.jurisdictionId,
      cityId: posting.cityId,
      regionId: posting.regionId,
      countryId: posting.countryId,
      officeId: posting.officeId,
      postingId: posting.id,
      bureauId: posting.bureauId,
      riskTags: ["office", posting.status || ""]
    });
  }
  for (const assessment of asArray(office.assessmentRecords).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "office",
      id: assessment.id,
      sourceView: "officialPostingsView.assessmentRecords",
      title: assessment.title || assessment.officeTitle,
      publicSummary: assessment.publicSummary || assessment.publicFinding,
      jurisdictionId: assessment.jurisdictionId,
      cityId: assessment.cityId,
      regionId: assessment.regionId,
      countryId: assessment.countryId,
      officeId: assessment.officeId,
      postingId: assessment.postingId,
      bureauId: assessment.bureauId,
      riskTags: ["assessment", assessment.status || ""]
    });
  }

  const procedure = buildExamProcedureView(worldState);
  if (procedure) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "exam",
      id: `procedure-${procedure.examId || procedure.level || "active"}`,
      sourceView: "examProcedureView",
      title: procedure.phaseLabel || procedure.levelLabel,
      publicSummary: procedure.publicSummary || procedure.phaseLabel,
      scopeRefs: [procedure.examId, procedure.level, procedure.currentStage],
      riskTags: ["exam_procedure"]
    });
    const panel = buildExaminerPanelView(procedure.examinerPanelView);
    pushEvidenceRef(refs, actorProfile, {
      domain: "exam",
      id: `examiner-panel-${procedure.examId || procedure.level || "active"}`,
      sourceView: "examinerPanelView",
      title: "多考官阅卷摘要",
      publicSummary: panel.serverDecision || panel.publicSummary,
      scopeRefs: [procedure.examId, procedure.level],
      riskTags: ["examiner_panel"]
    });
  }
  const honors = buildExamHonorView(worldState);
  if (honors?.latestHonor || asArray(honors.honors).length) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "exam",
      id: `honor-${honors.latestHonor?.id || honors.latestHonor?.honorType || "latest"}`,
      sourceView: "examHonorView",
      title: honors.latestHonor?.title || honors.currentAchievement || "科名荣誉",
      publicSummary: honors.publicSummary,
      scopeRefs: [honors.latestHonor?.id, honors.latestHonor?.examLevel, honors.latestHonor?.honorType],
      riskTags: ["exam_honor"]
    });
  }
  const appointment = buildAppointmentTrackView(worldState);
  if (appointment?.latestDecision || asArray(appointment.records).length) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "career",
      id: `appointment-${appointment.latestDecision?.id || appointment.latestDecision?.officeId || "latest"}`,
      sourceView: "appointmentTrackView",
      title: appointment.latestDecision?.officeTitle || appointment.latestTrack || "授官轨迹",
      publicSummary: appointment.publicSummary,
      officeId: appointment.latestDecision?.officeId,
      postingId: appointment.latestDecision?.postingId,
      cityId: appointment.latestDecision?.cityId,
      regionId: appointment.latestDecision?.regionId,
      countryId: appointment.latestDecision?.countryId,
      riskTags: ["appointment"]
    });
  }

  const people = buildWorldPeopleView(worldState);
  for (const npc of asArray(people.npcs).slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "people",
      id: npc.id,
      sourceView: "worldPeopleView.npcs",
      title: npc.name,
      publicSummary: npc.publicSummary || npc.rankLabel,
      cityId: npc.cityId,
      regionId: npc.regionId,
      countryId: npc.countryId,
      riskTags: ["people"]
    });
  }
  for (const relationship of asArray(people.relationships).slice(0, 6)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "people",
      id: relationship.id,
      sourceView: "worldPeopleView.relationships",
      title: relationship.targetId || relationship.targetType,
      publicSummary: relationship.publicSummary || relationship.recentIntent,
      cityId: relationship.cityId,
      regionId: relationship.regionId,
      countryId: relationship.countryId,
      scopeRefs: [relationship.targetId, relationship.sourceId],
      riskTags: ["relationship"]
    });
  }

  const archive = buildEventArchiveView(worldState, { pageSize: 8 });
  for (const item of asArray(archive.items).slice(0, 8)) {
    pushEvidenceRef(refs, actorProfile, {
      domain: "events",
      id: item.id,
      sourceView: "eventArchiveView.items",
      title: item.title || item.kind,
      publicSummary: item.summary || item.statusLabel,
      scopeRefs: item.relatedRefs,
      riskTags: [item.kind || "event"]
    });
  }

  return refs;
}

function allowedEvidenceDomainsForTool(toolName) {
  return new Set(TOOL_EVIDENCE_DOMAINS[toolName] || []);
}

function evidenceMatchesJurisdiction(entry = {}, actorProfile = {}, jurisdictionRef = "") {
  const actorRefs = new Set(cleanRefList([
    jurisdictionRef,
    ...asArray(actorProfile.jurisdictionRefs)
  ], 20));
  if (!actorRefs.size) return false;
  return asArray(entry.scopeRefs).some((ref) => actorRefs.has(ref));
}

function validateDomainToolAuthority(actorProfile = {}, proposal = {}, context = {}) {
  const toolDefinition = context.toolDefinition ||
    createDomainToolDefinitions().find((tool) => tool.name === proposal.toolName);
  const normalized = proposal.schemaVersion === DOMAIN_TOOL_SCHEMA_VERSION
    ? proposal
    : normalizeDomainToolProposal(proposal, { actorProfile, toolDefinition });
  const reasons = [];

  if (normalized.safetyFlags.length) {
    reasons.push("领域工具参数含隐藏、原始、路径、密钥、SQL、状态补丁或内部 resolver 形状文本。");
  }
  if (!actorProfile?.actorId) {
    reasons.push("缺少 actor profile，不能提交领域工具意图。");
  } else if (!isToolAllowedForActor(actorProfile, toolDefinition, {
    jurisdictionRef: normalized.jurisdictionRef || context.jurisdictionRef || ""
  })) {
    reasons.push("actor 无权调用该领域工具或辖区不匹配。");
  }

  if (toolDefinition.permission?.requiresJurisdiction) {
    const refs = new Set(asArray(actorProfile.jurisdictionRefs));
    if (!normalized.jurisdictionRef) {
      reasons.push("该领域工具需要明确辖区 ref。");
    } else if (!refs.has(normalized.jurisdictionRef)) {
      reasons.push(`辖区 ${normalized.jurisdictionRef} 不属于当前 actor。`);
    }
  }

  if (toolDefinition.permission?.requiresEvidence && !normalized.evidenceRefs.length) {
    reasons.push("领域工具缺少可见 evidenceRefs。");
  }

  const visibleRefs = collectVisibleDomainEvidenceRefs(context.worldState || {}, actorProfile);
  const allowedDomains = allowedEvidenceDomainsForTool(normalized.toolName);
  for (const ref of normalized.evidenceRefs) {
    const entry = visibleRefs.get(ref);
    if (!entry) {
      reasons.push(`证据 ${ref} 不在当前 actor 可见 projection 内。`);
      continue;
    }
    if (allowedDomains.size && !allowedDomains.has(entry.domain)) {
      reasons.push(`证据 ${ref} 的领域不适用于 ${normalized.toolName}。`);
    }
    if (
      toolDefinition.permission?.requiresJurisdiction &&
      !evidenceMatchesJurisdiction(entry, actorProfile, normalized.jurisdictionRef)
    ) {
      reasons.push(`证据 ${ref} 不属于当前辖区。`);
    }
  }

  return {
    accepted: reasons.length === 0,
    status: reasons.length === 0 ? "pending" : "rejected",
    rejectionReasons: reasons.slice(0, 8),
    visibleEvidenceRefs: normalized.evidenceRefs
      .map((ref) => visibleRefs.get(ref))
      .filter(Boolean)
  };
}

function followUpHookFor(toolName = "") {
  const domain = cleanId(toolName.split(".")[0], "domain");
  return `review_${domain}_tool_candidate`;
}

function resolveDomainTool(worldState = {}, argumentsPayload = {}, options = {}) {
  const toolDefinition = options.toolDefinition || {};
  const normalized = normalizeDomainToolProposal(argumentsPayload, {
    actorProfile: options.actorProfile,
    toolDefinition
  });
  const validation = validateDomainToolAuthority(options.actorProfile || {}, normalized, {
    ...options.context,
    worldState,
    toolDefinition,
    jurisdictionRef: options.jurisdictionRef
  });
  const accepted = validation.accepted;
  const publicSummary = accepted
    ? `${toolDefinition.name || normalized.toolName} 已进入服务器待裁决队列：${normalized.publicSummary}`
    : "领域工具意图未被服务器接受。";

  return {
    status: accepted ? "pending" : "rejected",
    publicResult: {
      summary: cleanText(publicSummary, "领域工具意图已记录为待裁决。", 180),
      visibleChanges: accepted ? [
        normalized.publicSummary,
        `动作：${normalized.actionKind}`,
        `证据：${normalized.evidenceRefs.slice(0, 4).join("、")}`
      ].map((text) => cleanText(text, "", 140)).filter(Boolean) : []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: validation.rejectionReasons.map((reason) => cleanText(reason, "服务器拒绝领域工具意图。", 160)),
    counterCosts: accepted
      ? ["S70.7 只记录领域工具意图；真实审案、赈济、军令、战和、定榜、授官和赏罚留给后续服务器 resolver。"]
      : [],
    followUpHooks: accepted ? [followUpHookFor(toolDefinition.name || normalized.toolName)] : [],
    normalizedProposal: {
      ...normalized,
      accepted
    }
  };
}

function resolveDomainToolCall({ worldState = {}, arguments: args = {}, actorProfile = {}, toolDefinition = {}, context = {} }) {
  return resolveDomainTool(worldState, args, {
    actorProfile,
    toolDefinition,
    jurisdictionRef: context.jurisdictionRef,
    context
  });
}

function buildDomainToolAudit(proposal = {}, result = {}) {
  const toolDefinition = createDomainToolDefinitions().find((tool) => tool.name === proposal.toolName) || {};
  const normalized = proposal.schemaVersion === DOMAIN_TOOL_SCHEMA_VERSION
    ? proposal
    : normalizeDomainToolProposal(proposal, { toolDefinition });
  return {
    schemaVersion: DOMAIN_TOOL_SCHEMA_VERSION,
    auditId: cleanId(`ai-domain-tool:${normalized.proposalId}`, "ai-domain-tool"),
    visibility: "developer",
    toolName: cleanText(normalized.toolName, "domain.tool", 96),
    status: cleanText(result.status, "pending", 32),
    actorRef: actorRef(normalized.actorRef),
    actionKind: cleanText(normalized.actionKind, "", 64),
    evidenceRefs: cleanRefList(normalized.evidenceRefs, 8),
    targetRefs: cleanRefList(normalized.targetRefs, 8),
    jurisdictionRef: cleanId(normalized.jurisdictionRef, ""),
    publicSummary: cleanText(normalized.publicSummary, "领域工具意图已脱敏。", 160),
    rejectionReasons: cleanTextList(result.rejectionReasons, 6, 140),
    privateResultRefs: [],
    appliedEventIds: []
  };
}

module.exports = {
  DOMAIN_TOOL_SCHEMA_VERSION,
  buildDomainToolAudit,
  collectVisibleDomainEvidenceRefs,
  normalizeDomainToolProposal,
  resolveDomainTool,
  resolveDomainToolCall,
  validateDomainToolAuthority
};
