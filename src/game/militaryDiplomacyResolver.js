const { buildPlayerAiActorProfile } = require("./aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("./domainToolResolvers");
const {
  buildResolverInputContext,
  createResolverEvidenceRefs,
  filterResolverInputForActor,
  summarizeResolverInputForAudit
} = require("./resolverInputContext");
const { appendEvents, clamp, NUMERIC_RANGES } = require("./stateRules");
const {
  DIPLOMACY_MOVE_ACTIONS,
  DIPLOMACY_MOVE_ALIASES,
  MILITARY_DIPLOMACY_ALLOWED_TIERS,
  MILITARY_DIPLOMACY_EVIDENCE_CREDIBILITY,
  MILITARY_DIPLOMACY_EVIDENCE_DOMAINS,
  MILITARY_DIPLOMACY_INSTITUTIONAL_PATHS,
  MILITARY_DIPLOMACY_RECORD_LIMIT,
  MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
  MILITARY_DIPLOMACY_TIER_ORDER,
  MILITARY_ORDER_ACTIONS,
  MILITARY_ORDER_ALIASES
} = require("./militaryDiplomacyResolverConfig");

const MILITARY_DIPLOMACY_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_MILITARY_DIPLOMACY_KEYS = new Set([
  "apiKey",
  "hiddenIntel",
  "hiddenIntent",
  "hiddenNotes",
  "localPath",
  "providerConfig",
  "rawAudit",
  "rawEvidence",
  "rawPrompt",
  "rawSql",
  "rawTable",
  "sql",
  "statePatch",
  "warState",
  "worldState"
]);

const SAFE_MILITARY_DIPLOMACY_METADATA_KEYS = new Set([
  "cooldownKey",
  "institutionalPath"
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
  if (!trimmed || MILITARY_DIPLOMACY_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
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

function normalizeEvidenceConfidence(value, fallback = 0.5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(3));
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

function collectUnsafeFields(value, path = "proposal", findings = []) {
  if (typeof value === "string") {
    if (MILITARY_DIPLOMACY_SENSITIVE_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeFields(entry, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (
      !SAFE_MILITARY_DIPLOMACY_METADATA_KEYS.has(key) &&
      (FORBIDDEN_MILITARY_DIPLOMACY_KEYS.has(key) || MILITARY_DIPLOMACY_SENSITIVE_TEXT_PATTERN.test(key))
    ) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function cleanRefList(values, limit = 8) {
  return unique(asArray(values), limit);
}

function actorRef(actorProfile = {}, fallback = {}) {
  const source = isPlainObject(fallback) ? fallback : {};
  return {
    actorId: cleanText(actorProfile.actorId || source.actorId, "actor:unknown", 96),
    actorType: cleanText(actorProfile.actorType || source.actorType, "unknown", 48),
    authorityTier: cleanText(actorProfile.authorityTier || source.authorityTier, "T0", 4),
    officeId: cleanId(actorProfile.officeId || source.officeId, ""),
    bureauId: cleanId(actorProfile.bureauId || source.bureauId, ""),
    jurisdictionRefs: cleanRefList(actorProfile.jurisdictionRefs || source.jurisdictionRefs, 12)
  };
}

function normalizeInstitutionalPath(value) {
  const raw = String(value || "").trim();
  if (/军机|廷议|阁议/.test(raw)) return "grand_council_review";
  if (/兵部|部议|部院/.test(raw)) return "ministry_war_review";
  if (/御批|圣裁|诏|诏令/.test(raw)) return "imperial_edict";
  if (/边镇|总督|总兵|军门|前线/.test(raw)) return "frontier_command";
  if (/使节|礼文|通使/.test(raw)) return "envoy_protocol";
  if (/朝贡|贡使/.test(raw)) return "tribute_mission";
  if (/和议|盟约|条约/.test(raw)) return "treaty_review";
  if (/战议|会战|宣战/.test(raw)) return "war_council";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return MILITARY_DIPLOMACY_INSTITUTIONAL_PATHS.includes(normalized) ? normalized : "";
}

function normalizeMilitaryOrderKind(value) {
  const raw = String(value || "").trim();
  if (/侦|探|哨/.test(raw)) return "scout";
  if (/守|固守|防/.test(raw)) return "defend";
  if (/练|操/.test(raw)) return "train";
  if (/粮|饷|补给|转运/.test(raw)) return "resupply";
  if (/出击|进剿|进兵|动员/.test(raw)) return "mobilize";
  if (/大会战|决战/.test(raw)) return "decisive_battle";
  if (/会战|接战|交战/.test(raw)) return "engage";
  if (/撤|退兵|收兵/.test(raw)) return "withdraw";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return MILITARY_ORDER_ALIASES[normalized] || "scout";
}

function normalizeDiplomacyMoveKind(value) {
  const raw = String(value || "").trim();
  if (/遣使|通使|使节/.test(raw)) return "envoy";
  if (/互市|贸易|通商/.test(raw)) return "negotiate_trade";
  if (/和议|停战|议和/.test(raw)) return "seek_truce";
  if (/朝贡|贡使|责贡/.test(raw)) return "demand_tribute";
  if (/威慑|警告|边檄|示威/.test(raw)) return "warn_border";
  if (/宣战|请战|开战/.test(raw)) return "declare_war_request";
  if (/会盟|同盟|盟约/.test(raw)) return "alliance";
  if (/扣使|扣留/.test(raw)) return "detain_envoy";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return DIPLOMACY_MOVE_ALIASES[normalized] || "envoy";
}

function normalizeCommonProposal(source, options, kind, actionKind, action) {
  const actor = actorRef(options.actorProfile, source.actorRef);
  const evidenceRefs = cleanRefList(source.evidenceRefs, 8);
  const jurisdictionRef = cleanId(source.jurisdictionRef, actor.jurisdictionRefs[0] || "");
  const subjectId = cleanId(
    source.subjectId || source.targetId || source.theaterId || source.frontierZoneId || source.countryId || source.moveId || source.orderId,
    `${kind}:${actor.actorId}:${actionKind}:${jurisdictionRef || "scope"}`
  );
  const unsafeFields = collectUnsafeFields(source);
  const safetyFlags = unsafeFields.length ? ["unsafe_military_diplomacy_payload"] : [];
  if (asArray(source.privateResultRefs).length) safetyFlags.push("private_result_refs_from_model");
  return {
    schemaVersion: MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
    resolverKind: kind,
    proposalId: cleanId(source.proposalId, `${subjectId}:${actionKind}`),
    sourceToolName: cleanText(
      source.toolName || source.sourceToolName,
      kind === "military" ? "military.propose_order" : "diplomacy.propose_move",
      96
    ),
    subjectId,
    actionKind,
    actionLabel: action.label,
    actorRef: actor,
    jurisdictionRef,
    institutionalPath: normalizeInstitutionalPath(source.institutionalPath || source.escalationPath || source.reviewPath),
    riskLevel: clampNumber(source.riskLevel ?? source.severity ?? source.caseSeverity, 0, 5, 2),
    evidenceRefs,
    targetRefs: cleanRefList(source.targetRefs, 8),
    publicSummary: cleanText(source.publicSummary, `${action.label}待服务器裁决。`, 180),
    expectedBenefits: asArray(source.expectedBenefits).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    counterCosts: asArray(source.counterCosts).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    riskDisclosure: cleanText(source.riskDisclosure, "需复核兵粮、情报可信度、制度授权、礼法和战和反噬。", 180),
    privateResultRefs: [],
    safetyFlags,
    authorityBoundary: "军务外交提案只进入服务器 resolver；调兵、战果、宣战、和议、外交关系、粮饷、持久化和公开情报由服务器裁决。"
  };
}

function normalizeMilitaryProposal(proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const actionKind = normalizeMilitaryOrderKind(source.orderKind || source.actionKind || source.action || source.type);
  const action = MILITARY_ORDER_ACTIONS[actionKind] || MILITARY_ORDER_ACTIONS.scout;
  return normalizeCommonProposal(source, options, "military", actionKind, action);
}

function normalizeDiplomacyProposal(proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const actionKind = normalizeDiplomacyMoveKind(source.moveKind || source.actionKind || source.action || source.type);
  const action = DIPLOMACY_MOVE_ACTIONS[actionKind] || DIPLOMACY_MOVE_ACTIONS.envoy;
  return normalizeCommonProposal(source, options, "diplomacy", actionKind, action);
}

function buildMilitaryDiplomacyEvidenceContext(worldState = {}, subjectId = "", options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const baseContext = options.resolverInputContext || buildResolverInputContext(worldState, {
    actorProfile,
    intentType: options.intentType || "military_diplomacy",
    sceneId: cleanId(subjectId, "") || null,
    requestSummary: options.requestSummary,
    extraEvidence: options.extraEvidence
  });
  const context = filterResolverInputForActor(baseContext, actorProfile);
  const evidenceRefs = createResolverEvidenceRefs(context);
  const evidenceByRef = new Map();
  for (const evidence of evidenceRefs) {
    evidenceByRef.set(evidence.refId, evidence);
    evidenceByRef.set(`${evidence.domain}:${evidence.sourceId}`, evidence);
  }
  for (const evidence of collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()) {
    const bridged = {
      refId: evidence.ref,
      sourceView: evidence.sourceView,
      sourceId: evidence.id,
      domain: evidence.domain,
      label: cleanText(evidence.title, "", 80),
      title: cleanText(evidence.title, "", 80),
      summary: cleanText(evidence.publicSummary, "", 160),
      visibility: "actor_visible",
      confidence: normalizeEvidenceConfidence(evidence.confidence, 0.6),
      relatedRefs: [],
      scopeRefs: asArray(evidence.scopeRefs),
      generatedAtTurn: context.generatedAtTurn
    };
    evidenceByRef.set(bridged.refId, bridged);
    evidenceByRef.set(`${bridged.domain}:${bridged.sourceId}`, bridged);
  }
  return {
    context,
    evidenceRefs,
    evidenceByRef,
    auditSummary: summarizeResolverInputForAudit(context)
  };
}

function selectedEvidenceFor(proposal, evidenceContext) {
  const selected = [];
  for (const ref of proposal.evidenceRefs) {
    const evidence = evidenceContext.evidenceByRef.get(ref);
    if (evidence) selected.push(evidence);
  }
  return selected;
}

function tierAtLeast(actual, required) {
  const actualIndex = MILITARY_DIPLOMACY_TIER_ORDER.indexOf(actual);
  const requiredIndex = MILITARY_DIPLOMACY_TIER_ORDER.indexOf(required);
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
}

function evidenceScoreFor(selectedEvidence = []) {
  return Number(selectedEvidence.reduce((total, evidence) => {
    const domainWeight = MILITARY_DIPLOMACY_EVIDENCE_CREDIBILITY[evidence.domain] || 0.6;
    const confidence = normalizeEvidenceConfidence(evidence.confidence, 0.6);
    return total + domainWeight * Math.max(0, Math.min(1, confidence));
  }, 0).toFixed(3));
}

function evidenceConfidenceFor(selectedEvidence = [], domains = null) {
  const wanted = Array.isArray(domains) && domains.length ? new Set(domains) : null;
  const evidenceRows = wanted ? selectedEvidence.filter((evidence) => wanted.has(evidence.domain)) : selectedEvidence;
  if (!evidenceRows.length) return 0;
  const total = evidenceRows.reduce((sum, evidence) => {
    const confidence = normalizeEvidenceConfidence(evidence.confidence, 0.5);
    return sum + confidence;
  }, 0);
  return Number((total / evidenceRows.length).toFixed(3));
}

function hasEvidenceDomain(selectedEvidence, domains = []) {
  const wanted = new Set(domains);
  return selectedEvidence.some((evidence) => wanted.has(evidence.domain));
}

function hasCredibleEvidenceDomain(selectedEvidence, domains = [], minimumConfidence = 0) {
  const wanted = new Set(domains);
  return selectedEvidence.some((evidence) =>
    wanted.has(evidence.domain) && normalizeEvidenceConfidence(evidence.confidence, 0.5) >= minimumConfidence
  );
}

function selectedEvidenceScopes(selectedEvidence = []) {
  const refs = new Set();
  for (const evidence of selectedEvidence) {
    if (evidence.refId) refs.add(evidence.refId);
    if (evidence.sourceId) refs.add(evidence.sourceId);
    for (const scopeRef of asArray(evidence.scopeRefs)) {
      const cleaned = cleanId(scopeRef, "");
      if (cleaned) refs.add(cleaned);
    }
  }
  return refs;
}

function evidenceMatchesActorScope(selectedEvidence = [], actorProfile = {}) {
  const actorScopes = new Set(cleanRefList(actorProfile.jurisdictionRefs, 16));
  if (!actorScopes.size) return true;
  return selectedEvidence.some((evidence) =>
    asArray(evidence.scopeRefs).some((scopeRef) => actorScopes.has(scopeRef))
  );
}

function targetRefsAnchoredToEvidence(proposal = {}, selectedEvidence = []) {
  if (!proposal.targetRefs.length) return true;
  const evidenceScopes = selectedEvidenceScopes(selectedEvidence);
  return proposal.targetRefs.every((targetRef) => evidenceScopes.has(targetRef));
}

function resourceAvailable(worldState = {}, actorPlayer = {}, resourceCost = {}, actorProfile = {}) {
  const checks = [];
  if (Number(resourceCost.treasury || 0) > 0) checks.push(["府库", Number(worldState.treasury || 0), Number(resourceCost.treasury)]);
  if (Number(resourceCost.grainReserve || 0) > 0) checks.push(["粮储", Number(worldState.grainReserve || 0), Number(resourceCost.grainReserve)]);
  const usesPlayerTroops = actorProfile.actorId?.startsWith("player:") && actorProfile.actorType === "general";
  if (usesPlayerTroops && Number(resourceCost.playerSupply || 0) > 0) {
    checks.push(["本部粮饷", Number(actorPlayer.supply || 0), Number(resourceCost.playerSupply)]);
  }
  if (usesPlayerTroops && Number(resourceCost.playerTroops || 0) > 0) {
    checks.push(["本部兵力", Number(actorPlayer.troops || 0), Number(resourceCost.playerTroops)]);
  }
  return checks.filter(([, available, required]) => available < required).map(([label]) => label);
}

function validateCommonAuthority(worldState = {}, proposal = {}, action = {}, context = {}) {
  const actorProfile = context.actorProfile || buildPlayerAiActorProfile(worldState);
  const evidenceContext = context.evidenceContext || buildMilitaryDiplomacyEvidenceContext(worldState, proposal.subjectId, {
    ...context,
    actorProfile,
    requestSummary: proposal.publicSummary,
    intentType: proposal.resolverKind
  });
  const selectedEvidence = selectedEvidenceFor(proposal, evidenceContext);
  const evidenceScore = evidenceScoreFor(selectedEvidence);
  const evidenceConfidence = evidenceConfidenceFor(selectedEvidence);
  const rejectionReasons = [];
  const requiredToolName = proposal.resolverKind === "military" ? "military.propose_order" : "diplomacy.propose_move";
  const requiredToolGroup = proposal.resolverKind === "military" ? "military" : "diplomacy";

  if (proposal.safetyFlags.length) rejectionReasons.push("军务外交文本包含禁止来源、隐藏情报、原始材料或直写字段。");
  if (proposal.sourceToolName !== requiredToolName) rejectionReasons.push("非对应军务/外交工具不能进入该 resolver 裁决。");
  if (!MILITARY_DIPLOMACY_ALLOWED_TIERS.includes(actorProfile.authorityTier)) rejectionReasons.push("当前 actor 权限不足，不能裁决军务外交 proposal。");
  if (!asArray(actorProfile.allowedToolGroups).includes(requiredToolGroup)) rejectionReasons.push(`当前 actor 未获${proposal.resolverKind === "military" ? "军务" : "外交"}工具组。`);
  if (!tierAtLeast(actorProfile.authorityTier, action.minimumAuthorityTier)) {
    rejectionReasons.push("当前 actor 等级不足，不能执行该军务外交动作。");
  }
  if (!proposal.evidenceRefs.length) rejectionReasons.push("军务外交 proposal 必须引用玩家可见 resolver evidence。");
  if (!selectedEvidence.length) rejectionReasons.push("引用证据不在当前 actor 可见 resolver 输入中。");

  const allowedDomains = new Set(action.evidenceDomains || MILITARY_DIPLOMACY_EVIDENCE_DOMAINS);
  const unsupportedEvidence = selectedEvidence.filter((evidence) => !allowedDomains.has(evidence.domain));
  if (unsupportedEvidence.length) rejectionReasons.push("引用证据领域不适用于该军务外交动作。");
  if (selectedEvidence.length < action.minimumEvidenceRefs) rejectionReasons.push("证据不足，不能形成该军务外交处置。");
  if (evidenceScore < action.minimumEvidenceScore) rejectionReasons.push("证据可信度不足，不能形成该军务外交处置。");
  if (evidenceConfidence < action.minimumIntelConfidence) rejectionReasons.push("低可信边报只能作为风险线索，不能支持该动作成案。");
  if (action.requiresMilitaryEvidence && !hasEvidenceDomain(selectedEvidence, ["military"])) {
    rejectionReasons.push("该军务高风险动作必须至少引用一条可见军务态势证据。");
  } else if (action.requiresMilitaryEvidence && !hasCredibleEvidenceDomain(selectedEvidence, ["military"], action.minimumIntelConfidence)) {
    rejectionReasons.push("所引军务态势可信度不足，不能支持该高风险动作。");
  }
  if (action.requiresDiplomacyEvidence && !hasEvidenceDomain(selectedEvidence, ["diplomacy"])) {
    rejectionReasons.push("该外交高风险动作必须至少引用一条可见外交态势证据。");
  } else if (action.requiresDiplomacyEvidence && !hasCredibleEvidenceDomain(selectedEvidence, ["diplomacy"], action.minimumIntelConfidence)) {
    rejectionReasons.push("所引外交态势可信度不足，不能支持该高风险动作。");
  }
  if (action.requiresEconomicEvidence && !hasEvidenceDomain(selectedEvidence, ["economy", "market"])) {
    rejectionReasons.push("调粮、互市或朝贡类动作必须至少引用一条可见钱粮/市场证据。");
  }
  if (action.requiresInstitutionalPath && !proposal.institutionalPath) {
    rejectionReasons.push("战和、会战、宣战或扣使等高风险动作必须给出制度路径。");
  }
  if (selectedEvidence.length && !evidenceMatchesActorScope(selectedEvidence, actorProfile)) {
    rejectionReasons.push("所引军务外交证据不在当前 actor 辖区或任所范围内。");
  }
  if (!targetRefsAnchoredToEvidence(proposal, selectedEvidence)) {
    rejectionReasons.push("targetRefs 必须来自已引用可见证据或其公开 scopeRefs。");
  }

  const missingResources = resourceAvailable(worldState, worldState.player || {}, action.resourceCost, actorProfile);
  if (missingResources.length) rejectionReasons.push(`资源不足：${missingResources.join("、")}不足以执行该动作。`);

  return {
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
    selectedEvidence,
    evidenceScore,
    evidenceConfidence,
    evidenceContext
  };
}

function validateMilitaryAuthority(worldState = {}, proposal = {}, context = {}) {
  const actorProfile = context.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = proposal.schemaVersion === MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION
    ? proposal
    : normalizeMilitaryProposal(proposal, { actorProfile });
  const action = MILITARY_ORDER_ACTIONS[normalized.actionKind] || MILITARY_ORDER_ACTIONS.scout;
  return {
    normalized,
    ...validateCommonAuthority(worldState, normalized, action, {
      ...context,
      actorProfile
    })
  };
}

function validateDiplomacyAuthority(worldState = {}, proposal = {}, context = {}) {
  const actorProfile = context.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = proposal.schemaVersion === MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION
    ? proposal
    : normalizeDiplomacyProposal(proposal, { actorProfile });
  const action = DIPLOMACY_MOVE_ACTIONS[normalized.actionKind] || DIPLOMACY_MOVE_ACTIONS.envoy;
  return {
    normalized,
    ...validateCommonAuthority(worldState, normalized, action, {
      ...context,
      actorProfile
    })
  };
}

function safeDelta(delta = {}, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  return Object.fromEntries(Object.entries(delta).filter(([key, value]) => allowed.has(key) && Number.isFinite(Number(value))));
}

function evidencePublicSummary(selectedEvidence = []) {
  const count = selectedEvidence.length;
  if (!count) return "未能引用可见材料";
  const labels = selectedEvidence
    .slice(0, 3)
    .map((evidence) => cleanText(evidence.label || evidence.title || evidence.summary || evidence.publicSummary, "", 44))
    .filter(Boolean);
  return labels.length ? `${count}条可见材料（${labels.join("、")}）` : `${count}条可见材料`;
}

function buildPublicResolution(outcome = {}, selectedEvidence = []) {
  const accepted = outcome.status === "accepted";
  const evidenceSummary = evidencePublicSummary(selectedEvidence);
  const kindLabel = outcome.resolverKind === "military" ? "军务" : "外交";
  const summary = accepted
    ? `${outcome.actionLabel}已由服务器裁决：${outcome.publicSummary} 依据${evidenceSummary}，只公开可见态势摘要。`
    : `${outcome.actionLabel || kindLabel}未获服务器裁决：${outcome.rejectionReasons?.[0] || "权限、证据、资源或制度路径不足"}。`;
  return {
    resolutionId: cleanId(`military-diplomacy:${outcome.resolverKind || "domain"}:${outcome.actionKind || "action"}:${outcome.status || "status"}`, "military-diplomacy-resolution"),
    visibility: "public",
    title: cleanText(outcome.actionLabel || kindLabel, kindLabel, 80),
    summary: cleanText(summary, accepted ? "军务外交处置已裁决。" : "军务外交处置未通过裁决。", 240),
    evidenceSummary: cleanText(evidenceSummary, "可见材料", 120),
    statusLabel: accepted ? "已裁决" : "未通过",
    boundary: "公开军务外交摘要只显示可见证据摘要；隐藏情报、原始提案、完整审计和内部台账不公开。"
  };
}

function buildMilitaryDiplomacyPublicEvent(outcome = {}) {
  return {
    eventId: cleanId(`military-diplomacy:${outcome.resolverKind || "domain"}:${outcome.actionKind || "action"}:${outcome.status || "status"}`, "military-diplomacy"),
    sourceType: "military_diplomacy_resolution",
    visibility: "public",
    title: cleanText(outcome.actionLabel || "军务外交", "军务外交", 80),
    summary: cleanText(outcome.publicResolution?.summary, outcome.status === "accepted" ? "军务外交处置已裁决。" : "军务外交处置未通过裁决。", 240),
    relatedRefs: cleanRefList([outcome.jurisdictionRef, outcome.institutionalPath], 4)
  };
}

function buildAuditRecord(outcome, validation) {
  return {
    schemaVersion: MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
    auditId: cleanId(`military-diplomacy:${outcome.outcomeId}`, "military-diplomacy"),
    visibility: "developer",
    status: outcome.status,
    resolverKind: outcome.resolverKind,
    actionKind: outcome.actionKind,
    riskLevel: outcome.riskLevel,
    actorRef: outcome.actorRef,
    jurisdictionRef: outcome.jurisdictionRef,
    institutionalPath: outcome.institutionalPath,
    evidenceRefs: outcome.evidenceRefs,
    evidenceScore: validation.evidenceScore,
    evidenceConfidence: validation.evidenceConfidence,
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    resourceCost: outcome.resourceCost,
    rejectionReasons: outcome.rejectionReasons,
    resolverInput: validation.evidenceContext.auditSummary,
    safety: {
      proposalPayloadIncluded: false,
      stateSnapshotIncluded: false,
      sqlIncluded: false,
      hiddenIncluded: false,
      serverAdjudicated: true
    }
  };
}

function buildOutcome(worldState, normalized, action, validation) {
  const accepted = validation.rejectionReasons.length === 0;
  const stateDelta = safeDelta(action.stateDelta, ["treasury", "grainReserve", "publicOrder", "armyMorale", "borderThreat"]);
  const playerDelta = safeDelta(action.playerDelta, [
    "command",
    "troops",
    "supply",
    "battleReputation",
    "scouting",
    "campaignRisk",
    "influence",
    "reputation",
    "integrity"
  ]);
  const outcome = {
    schemaVersion: MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
    outcomeId: cleanId(`${normalized.proposalId}:${accepted ? "accepted" : "rejected"}`, "military-diplomacy-outcome"),
    status: accepted ? "accepted" : "rejected",
    resolverKind: normalized.resolverKind,
    subjectId: normalized.subjectId,
    actionKind: normalized.actionKind,
    actionLabel: action.label,
    riskLevel: normalized.riskLevel,
    actorRef: normalized.actorRef,
    jurisdictionRef: normalized.jurisdictionRef,
    institutionalPath: normalized.institutionalPath,
    evidenceRefs: validation.selectedEvidence.map((evidence) => evidence.refId).slice(0, 8),
    publicSummary: accepted
      ? cleanText(`${action.summaryVerb}已按军务外交权限裁决。`, "军务外交处置已裁决。", 140)
      : "军务外交处置未通过服务器裁决。",
    stateDelta: accepted ? stateDelta : {},
    playerDelta: accepted ? playerDelta : {},
    resourceCost: accepted ? { ...(action.resourceCost || {}) } : {},
    followUpHooks: accepted ? [
      normalized.resolverKind === "military" ? "review_military_resolution_outcome" : "review_diplomacy_resolution_outcome"
    ] : [],
    rejectionReasons: validation.rejectionReasons,
    riskTags: asArray(action.riskTags),
    authorityBoundary: normalized.authorityBoundary
  };
  outcome.publicResolution = buildPublicResolution(outcome, validation.selectedEvidence);
  outcome.publicEvent = buildMilitaryDiplomacyPublicEvent(outcome);
  outcome.auditRecord = buildAuditRecord(outcome, validation);
  return outcome;
}

function resolveCampaignOrDefense(worldState = {}, proposal = {}, options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = normalizeMilitaryProposal(proposal, { actorProfile });
  const evidenceContext = buildMilitaryDiplomacyEvidenceContext(worldState, normalized.subjectId, {
    ...options,
    actorProfile,
    requestSummary: normalized.publicSummary,
    intentType: "military"
  });
  const action = MILITARY_ORDER_ACTIONS[normalized.actionKind] || MILITARY_ORDER_ACTIONS.scout;
  const validation = validateMilitaryAuthority(worldState, normalized, {
    ...options,
    actorProfile,
    evidenceContext
  });
  return buildOutcome(worldState, normalized, action, validation);
}

function resolveDiplomaticMove(worldState = {}, proposal = {}, options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = normalizeDiplomacyProposal(proposal, { actorProfile });
  const evidenceContext = buildMilitaryDiplomacyEvidenceContext(worldState, normalized.subjectId, {
    ...options,
    actorProfile,
    requestSummary: normalized.publicSummary,
    intentType: "diplomacy"
  });
  const action = DIPLOMACY_MOVE_ACTIONS[normalized.actionKind] || DIPLOMACY_MOVE_ACTIONS.envoy;
  const validation = validateDiplomacyAuthority(worldState, normalized, {
    ...options,
    actorProfile,
    evidenceContext
  });
  return buildOutcome(worldState, normalized, action, validation);
}

function applyNumericDelta(target, key, delta) {
  if (!Number.isFinite(Number(delta)) || delta === 0) return;
  const [min, max] = NUMERIC_RANGES[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const current = Number(target[key]);
  const fallback = Number.isFinite(current) ? current : 0;
  target[key] = clamp(Math.round(fallback + delta), min, max);
}

function normalizeMilitaryDiplomacyLedger(worldState = {}) {
  const ledger = isPlainObject(worldState.militaryDiplomacyLedger) ? worldState.militaryDiplomacyLedger : {};
  return {
    schemaVersion: MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
    records: asArray(ledger.records).filter(isPlainObject).slice(-MILITARY_DIPLOMACY_RECORD_LIMIT)
  };
}

function applyMilitaryDiplomacyOutcome(worldState = {}, outcome = {}, auditContext = {}) {
  if (outcome.status !== "accepted") return worldState;
  for (const [key, delta] of Object.entries(outcome.stateDelta || {})) {
    applyNumericDelta(worldState, key, delta);
  }
  if (!isPlainObject(worldState.player)) worldState.player = {};
  for (const [key, delta] of Object.entries(outcome.playerDelta || {})) {
    applyNumericDelta(worldState.player, key, delta);
  }
  appendEvents(worldState, [outcome.publicEvent?.summary]);
  const ledger = normalizeMilitaryDiplomacyLedger(worldState);
  ledger.records.push({
    outcomeId: cleanId(outcome.outcomeId, "military-diplomacy-outcome"),
    resolverKind: cleanId(outcome.resolverKind, "military"),
    subjectId: cleanId(outcome.subjectId, "military-diplomacy-subject"),
    actionKind: cleanId(outcome.actionKind, "action"),
    actionLabel: cleanText(outcome.actionLabel, "军务外交", 80),
    status: "accepted",
    actorRef: outcome.actorRef,
    jurisdictionRef: cleanId(outcome.jurisdictionRef, ""),
    institutionalPath: cleanId(outcome.institutionalPath, ""),
    evidenceRefs: cleanRefList(outcome.evidenceRefs, 8),
    publicResolution: outcome.publicResolution,
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    resourceCost: outcome.resourceCost,
    followUpHooks: cleanRefList(outcome.followUpHooks, 6),
    appliedAtTurn: clampNumber(auditContext.turn ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  });
  ledger.records = ledger.records.slice(-MILITARY_DIPLOMACY_RECORD_LIMIT);
  worldState.militaryDiplomacyLedger = ledger;
  return worldState;
}

function resolveAndApplyMilitaryDiplomacy(worldState = {}, proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const toolName = cleanText(source.toolName || source.sourceToolName, "", 96);
  const outcome = toolName === "diplomacy.propose_move" || source.moveKind
    ? resolveDiplomaticMove(worldState, source, options)
    : resolveCampaignOrDefense(worldState, source, options);
  if (outcome.status === "accepted") applyMilitaryDiplomacyOutcome(worldState, outcome, options.auditContext);
  return outcome;
}

function resolveMilitaryDiplomacyFromDomainTool(worldState = {}, domainToolResult = {}, options = {}) {
  const proposal = domainToolResult.normalizedProposal || domainToolResult;
  const toolName = cleanText(proposal.toolName || proposal.sourceToolName, "", 96);
  if (toolName === "military.propose_order") return resolveCampaignOrDefense(worldState, proposal, options);
  if (toolName === "diplomacy.propose_move") return resolveDiplomaticMove(worldState, proposal, options);
  return resolveCampaignOrDefense(worldState, {
    ...proposal,
    toolName: toolName || "domain.tool"
  }, options);
}

module.exports = {
  MILITARY_DIPLOMACY_RESOLVER_SCHEMA_VERSION,
  applyMilitaryDiplomacyOutcome,
  buildMilitaryDiplomacyEvidenceContext,
  buildMilitaryDiplomacyPublicEvent,
  normalizeDiplomacyProposal,
  normalizeMilitaryProposal,
  resolveAndApplyMilitaryDiplomacy,
  resolveCampaignOrDefense,
  resolveDiplomaticMove,
  resolveMilitaryDiplomacyFromDomainTool,
  validateDiplomacyAuthority,
  validateMilitaryAuthority
};
