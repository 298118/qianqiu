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
  JUDICIAL_CASE_ACTION_ALIASES,
  JUDICIAL_CASE_ACTIONS,
  JUDICIAL_CASE_ALLOWED_TIERS,
  JUDICIAL_CASE_EVIDENCE_CREDIBILITY,
  JUDICIAL_CASE_EVIDENCE_DOMAINS,
  JUDICIAL_CASE_INSTITUTIONAL_PATHS,
  JUDICIAL_CASE_RECORD_LIMIT,
  JUDICIAL_CASE_SCHEMA_VERSION,
  JUDICIAL_CASE_TIER_ORDER
} = require("./judicialCaseConfig");

const JUDICIAL_CASE_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_JUDICIAL_CASE_KEYS = new Set([
  "apiKey",
  "hiddenEvidence",
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
  "worldState"
]);

const SAFE_JUDICIAL_CASE_METADATA_KEYS = new Set([
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
  if (!trimmed || JUDICIAL_CASE_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
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
    if (JUDICIAL_CASE_SENSITIVE_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeFields(entry, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (
      !SAFE_JUDICIAL_CASE_METADATA_KEYS.has(key) &&
      (FORBIDDEN_JUDICIAL_CASE_KEYS.has(key) || JUDICIAL_CASE_SENSITIVE_TEXT_PATTERN.test(key))
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
  if (/御史|风宪|都察/.test(raw)) return "censorate_review";
  if (/部院|刑部|部议/.test(raw)) return "ministry_review";
  if (/省|臬司|按察/.test(raw)) return "provincial_review";
  if (/府|上司/.test(raw)) return "prefectural_review";
  if (/县|本衙|本县/.test(raw)) return "county_docket";
  if (/诏|圣裁|御批/.test(raw)) return "imperial_rescript";
  if (/移交|管辖/.test(raw)) return "transfer_order";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return JUDICIAL_CASE_INSTITUTIONAL_PATHS.includes(normalized) ? normalized : "";
}

function normalizeCaseAction(value) {
  const raw = String(value || "").trim();
  if (/受理|立案/.test(raw)) return "accept";
  if (/传唤|拘传/.test(raw)) return "summon";
  if (/查证|核证|勘验|复核/.test(raw)) return "investigate";
  if (/调解|和息|息讼/.test(raw)) return "mediate";
  if (/罚|罚银|罚款/.test(raw)) return "fine";
  if (/羁押|收押|拘押/.test(raw)) return "detain";
  if (/驳回|不受理/.test(raw)) return "dismiss";
  if (/判决|定罪|断案|拟罪/.test(raw)) return "judge";
  if (/申详|详报|上详/.test(raw)) return "escalate";
  if (/移交|改管辖/.test(raw)) return "transfer";
  if (/缓审|留案|延期/.test(raw)) return "defer";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return JUDICIAL_CASE_ACTION_ALIASES[normalized] || "accept";
}

function normalizeCaseProposal(proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const actor = actorRef(options.actorProfile, source.actorRef);
  const caseAction = normalizeCaseAction(
    source.caseAction ||
    source.actionKind ||
    source.action ||
    source.caseResolution ||
    source.type
  );
  const action = JUDICIAL_CASE_ACTIONS[caseAction] || JUDICIAL_CASE_ACTIONS.accept;
  const evidenceRefs = cleanRefList(source.evidenceRefs, 8);
  const jurisdictionRef = cleanId(source.jurisdictionRef, actor.jurisdictionRefs[0] || "");
  const caseId = cleanId(
    source.caseId || source.docketId || source.targetCaseId,
    `judicial-case:${actor.actorId}:${caseAction}:${jurisdictionRef || "scope"}`
  );
  const unsafeFields = collectUnsafeFields(source);
  const safetyFlags = unsafeFields.length ? ["unsafe_case_payload"] : [];
  if (asArray(source.privateResultRefs).length) {
    safetyFlags.push("private_result_refs_from_model");
  }

  return {
    schemaVersion: JUDICIAL_CASE_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `${caseId}:${caseAction}`),
    sourceToolName: cleanText(source.toolName || source.sourceToolName, "judicial.propose_case_resolution", 96),
    caseId,
    caseAction,
    actionLabel: action.label,
    actorRef: actor,
    jurisdictionRef,
    institutionalPath: normalizeInstitutionalPath(source.institutionalPath || source.escalationPath || source.reviewPath),
    caseSeverity: clampNumber(source.caseSeverity ?? source.severity ?? source.riskLevel, 1, 5, 2),
    evidenceRefs,
    targetRefs: cleanRefList(source.targetRefs, 8),
    publicSummary: cleanText(source.publicSummary, `${action.label}待服务器裁决。`, 180),
    expectedBenefits: asArray(source.expectedBenefits).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    counterCosts: asArray(source.counterCosts).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    riskDisclosure: cleanText(source.riskDisclosure, "需复核证据、辖区、法度、士绅压力与胥吏阻力。", 180),
    privateResultRefs: [],
    safetyFlags,
    authorityBoundary: "刑名案件 proposal 只进入服务器司法 resolver；受理、查证、羁押、判决、公开案牍、关系反噬和持久化由服务器裁决。"
  };
}

function buildCaseEvidenceContext(worldState = {}, caseId = "", options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const baseContext = options.resolverInputContext || buildResolverInputContext(worldState, {
    actorProfile,
    intentType: "judicial_case",
    sceneId: cleanId(caseId, "") || null,
    requestSummary: options.requestSummary
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
      confidence: 0.68,
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

function selectedEvidenceFor(proposal, caseContext) {
  const selected = [];
  for (const ref of proposal.evidenceRefs) {
    const evidence = caseContext.evidenceByRef.get(ref);
    if (evidence) selected.push(evidence);
  }
  return selected;
}

function intersects(first = [], second = []) {
  const secondSet = new Set(second);
  return first.some((value) => secondSet.has(value));
}

function tierAtLeast(actual, required) {
  const actualIndex = JUDICIAL_CASE_TIER_ORDER.indexOf(actual);
  const requiredIndex = JUDICIAL_CASE_TIER_ORDER.indexOf(required);
  return actualIndex >= 0 && requiredIndex >= 0 && actualIndex >= requiredIndex;
}

function evidenceScoreFor(selectedEvidence = []) {
  return Number(selectedEvidence.reduce((total, evidence) => {
    const domainWeight = JUDICIAL_CASE_EVIDENCE_CREDIBILITY[evidence.domain] || 0.6;
    const confidence = Number.isFinite(Number(evidence.confidence)) ? Number(evidence.confidence) : 0.6;
    return total + domainWeight * Math.max(0, Math.min(1, confidence));
  }, 0).toFixed(3));
}

function isLocalDocketEvidence(evidence = {}) {
  return evidence.domain === "local_docket" || evidence.sourceView === "localAffairsDocketView.dockets";
}

function validateCaseAuthority(worldState = {}, proposal = {}, context = {}) {
  const actorProfile = context.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = proposal.schemaVersion === JUDICIAL_CASE_SCHEMA_VERSION
    ? proposal
    : normalizeCaseProposal(proposal, { actorProfile });
  const action = JUDICIAL_CASE_ACTIONS[normalized.caseAction];
  const caseContext = context.caseContext || buildCaseEvidenceContext(worldState, normalized.caseId, {
    ...context,
    actorProfile,
    requestSummary: normalized.publicSummary
  });
  const selectedEvidence = selectedEvidenceFor(normalized, caseContext);
  const evidenceScore = evidenceScoreFor(selectedEvidence);
  const rejectionReasons = [];

  if (normalized.safetyFlags.length) rejectionReasons.push("案件文本包含禁止来源、隐藏证据、原始材料或直写字段。");
  if (normalized.sourceToolName !== "judicial.propose_case_resolution") rejectionReasons.push("非刑名工具不能进入司法案件裁决。");
  if (!action) rejectionReasons.push("刑名动作不在服务器允许范围。");
  if (!JUDICIAL_CASE_ALLOWED_TIERS.includes(actorProfile.authorityTier)) rejectionReasons.push("当前 actor 权限不足，不能裁决刑名案件。");
  if (!asArray(actorProfile.allowedToolGroups).includes("judicial")) rejectionReasons.push("当前 actor 未获刑名工具组。");
  if (action && !tierAtLeast(actorProfile.authorityTier, action.minimumAuthorityTier)) {
    rejectionReasons.push("当前 actor 等级不足，不能执行该刑名动作。");
  }
  if (!normalized.evidenceRefs.length) rejectionReasons.push("刑名案件必须引用玩家可见 resolver evidence。");
  if (!selectedEvidence.length) rejectionReasons.push("引用证据不在当前 actor 可见 resolver 输入中。");

  const allowedDomains = new Set(action?.evidenceDomains || JUDICIAL_CASE_EVIDENCE_DOMAINS);
  const unsupportedEvidence = selectedEvidence.filter((evidence) => !allowedDomains.has(evidence.domain));
  if (unsupportedEvidence.length) rejectionReasons.push("引用证据领域不适用于该刑名动作。");
  if (action && selectedEvidence.length < action.minimumEvidenceRefs) {
    rejectionReasons.push("证据不足，不能形成该刑名处置。");
  }
  if (action && evidenceScore < action.minimumEvidenceScore) {
    rejectionReasons.push("证据可信度不足，不能形成该刑名处置。");
  }

  const actorScopes = asArray(actorProfile.jurisdictionRefs);
  const selectedScopes = unique(selectedEvidence.flatMap((evidence) => evidence.scopeRefs), 24);
  const selectedScopeOk = intersects(selectedScopes, actorScopes);
  const localTier = actorProfile.authorityTier === "T2" || actorProfile.authorityTier === "T3";
  if (localTier && !selectedScopeOk) {
    rejectionReasons.push("案件证据不属于当前 actor 辖区。");
  }
  if (localTier && normalized.jurisdictionRef && actorScopes.length && !actorScopes.includes(normalized.jurisdictionRef)) {
    rejectionReasons.push("案件辖区不属于当前 actor。");
  }

  const highTier = actorProfile.authorityTier === "T4" || actorProfile.authorityTier === "T5";
  const punitiveAction = ["fine", "detain", "judge"].includes(normalized.caseAction);
  const majorCase = normalized.caseSeverity >= 4 || action?.majorCase === true;
  if (punitiveAction && !selectedEvidence.some(isLocalDocketEvidence)) {
    rejectionReasons.push("罚银、羁押或判决必须至少引用一条可见案牍证据。");
  }
  if (highTier && punitiveAction && majorCase && !normalized.institutionalPath) {
    rejectionReasons.push("高阶 actor 直接处分重大案件必须给出制度路径。");
  }

  return {
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
    normalized,
    selectedEvidence,
    evidenceScore,
    caseContext
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
  return labels.length
    ? `${count}条可见材料（${labels.join("、")}）`
    : `${count}条可见材料`;
}

function buildPublicDocket(outcome = {}, selectedEvidence = []) {
  const accepted = outcome.status === "accepted";
  const evidenceSummary = evidencePublicSummary(selectedEvidence);
  const summary = accepted
    ? `${outcome.actionLabel}已由服务器裁决：${outcome.publicSummary} 依据${evidenceSummary}，只公开可见案情摘要。`
    : `${outcome.actionLabel || "刑名案件"}未获服务器裁决：${outcome.rejectionReasons?.[0] || "权限或证据不足"}。`;
  return {
    docketId: cleanId(`judicial-docket:${outcome.caseAction || "case"}:${outcome.jurisdictionRef || "scope"}:${outcome.status || "status"}`, "judicial-docket"),
    visibility: "public",
    title: cleanText(outcome.actionLabel || "刑名案件", "刑名案件", 80),
    summary: cleanText(summary, accepted ? "刑名案件已裁决。" : "刑名案件未通过裁决。", 220),
    evidenceSummary: cleanText(evidenceSummary, "可见材料", 120),
    statusLabel: accepted ? "已裁决" : "未通过",
    boundary: "公开案牍只显示可见证据摘要；隐藏证据、原始 proposal、完整审计和内部台账不公开。"
  };
}

function buildJudicialCasePublicEvent(outcome = {}) {
  return {
    eventId: cleanId(`judicial-case:${outcome.caseAction || "case"}:${outcome.jurisdictionRef || "scope"}:${outcome.status || "status"}`, "judicial-case"),
    sourceType: "judicial_case",
    visibility: "public",
    title: cleanText(outcome.actionLabel || "刑名案件", "刑名案件", 80),
    summary: cleanText(outcome.publicDocket?.summary, outcome.status === "accepted" ? "刑名案件已裁决。" : "刑名案件未通过裁决。", 220),
    relatedRefs: cleanRefList([outcome.jurisdictionRef], 4)
  };
}

function buildAuditRecord(outcome, validation) {
  return {
    schemaVersion: JUDICIAL_CASE_SCHEMA_VERSION,
    auditId: cleanId(`judicial-case:${outcome.outcomeId}`, "judicial-case"),
    visibility: "developer",
    status: outcome.status,
    caseAction: outcome.caseAction,
    caseSeverity: outcome.caseSeverity,
    actorRef: outcome.actorRef,
    jurisdictionRef: outcome.jurisdictionRef,
    institutionalPath: outcome.institutionalPath,
    evidenceRefs: outcome.evidenceRefs,
    evidenceScore: validation.evidenceScore,
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    relationshipSignals: outcome.relationshipSignals,
    clerkResistance: outcome.clerkResistance,
    rejectionReasons: outcome.rejectionReasons,
    resolverInput: validation.caseContext.auditSummary,
    safety: {
      proposalPayloadIncluded: false,
      stateSnapshotIncluded: false,
      sqlIncluded: false,
      hiddenIncluded: false,
      serverAdjudicated: true
    }
  };
}

function resolveJudicialCase(worldState = {}, proposal = {}, options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = normalizeCaseProposal(proposal, { actorProfile });
  const caseContext = buildCaseEvidenceContext(worldState, normalized.caseId, {
    ...options,
    actorProfile,
    requestSummary: normalized.publicSummary
  });
  const validation = validateCaseAuthority(worldState, normalized, {
    ...options,
    actorProfile,
    caseContext
  });
  const action = JUDICIAL_CASE_ACTIONS[normalized.caseAction] || JUDICIAL_CASE_ACTIONS.accept;
  const accepted = validation.rejectionReasons.length === 0;
  const stateDelta = safeDelta(action.stateDelta, [
    "treasury",
    "publicOrder",
    "corruption"
  ]);
  const playerDelta = safeDelta(action.playerDelta, [
    "pendingLawsuits",
    "performanceMerit",
    "promotionProspect",
    "impeachmentRisk",
    "cleanReputation",
    "superiorFavor",
    "gentryRelations",
    "localOrder",
    "banditPressure",
    "reputation",
    "integrity"
  ]);
  const outcome = {
    schemaVersion: JUDICIAL_CASE_SCHEMA_VERSION,
    outcomeId: cleanId(`${normalized.proposalId}:${accepted ? "accepted" : "rejected"}`, "judicial-case-outcome"),
    status: accepted ? "accepted" : "rejected",
    caseId: normalized.caseId,
    caseAction: normalized.caseAction,
    actionLabel: action.label,
    caseSeverity: normalized.caseSeverity,
    actorRef: normalized.actorRef,
    jurisdictionRef: normalized.jurisdictionRef,
    institutionalPath: normalized.institutionalPath,
    evidenceRefs: validation.selectedEvidence.map((evidence) => evidence.refId).slice(0, 8),
    publicSummary: accepted
      ? cleanText(`${action.summaryVerb}已按刑名权限裁决。`, "刑名案件已裁决。", 120)
      : "刑名案件未通过服务器裁决。",
    stateDelta: accepted ? stateDelta : {},
    playerDelta: accepted ? playerDelta : {},
    relationshipSignals: accepted ? {
      targetRefs: normalized.targetRefs,
      ...action.relationshipDelta
    } : {},
    clerkResistance: accepted ? action.clerkResistance : 0,
    followUpHooks: accepted ? [
      normalized.caseAction === "escalate" ? "review_judicial_escalation" : "review_judicial_case_outcome"
    ] : [],
    rejectionReasons: validation.rejectionReasons,
    riskTags: asArray(action.riskTags),
    authorityBoundary: normalized.authorityBoundary
  };
  outcome.publicDocket = buildPublicDocket(outcome, validation.selectedEvidence);
  outcome.publicEvent = buildJudicialCasePublicEvent(outcome);
  outcome.auditRecord = buildAuditRecord(outcome, validation);
  return outcome;
}

function applyNumericDelta(target, key, delta) {
  if (!Number.isFinite(Number(delta)) || delta === 0) return;
  const [min, max] = NUMERIC_RANGES[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const current = Number(target[key]);
  const fallback = Number.isFinite(current) ? current : 0;
  target[key] = clamp(Math.round(fallback + delta), min, max);
}

function normalizeCaseLedger(worldState = {}) {
  const ledger = isPlainObject(worldState.judicialCaseLedger) ? worldState.judicialCaseLedger : {};
  return {
    schemaVersion: JUDICIAL_CASE_SCHEMA_VERSION,
    records: asArray(ledger.records).filter(isPlainObject).slice(-JUDICIAL_CASE_RECORD_LIMIT)
  };
}

function applyJudicialCaseOutcome(worldState = {}, outcome = {}, auditContext = {}) {
  if (outcome.status !== "accepted") return worldState;
  for (const [key, delta] of Object.entries(outcome.stateDelta || {})) {
    applyNumericDelta(worldState, key, delta);
  }
  if (!isPlainObject(worldState.player)) worldState.player = {};
  for (const [key, delta] of Object.entries(outcome.playerDelta || {})) {
    applyNumericDelta(worldState.player, key, delta);
  }
  appendEvents(worldState, [outcome.publicEvent?.summary]);
  const ledger = normalizeCaseLedger(worldState);
  ledger.records.push({
    outcomeId: cleanId(outcome.outcomeId, "judicial-case-outcome"),
    caseId: cleanId(outcome.caseId, "judicial-case"),
    caseAction: cleanId(outcome.caseAction, "case-action"),
    actionLabel: cleanText(outcome.actionLabel, "刑名案件", 80),
    status: "accepted",
    actorRef: outcome.actorRef,
    jurisdictionRef: cleanId(outcome.jurisdictionRef, ""),
    institutionalPath: cleanId(outcome.institutionalPath, ""),
    evidenceRefs: cleanRefList(outcome.evidenceRefs, 8),
    publicDocket: outcome.publicDocket,
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    relationshipSignals: outcome.relationshipSignals,
    clerkResistance: clampNumber(outcome.clerkResistance, 0, 10, 0),
    followUpHooks: cleanRefList(outcome.followUpHooks, 6),
    appliedAtTurn: clampNumber(auditContext.turn ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  });
  ledger.records = ledger.records.slice(-JUDICIAL_CASE_RECORD_LIMIT);
  worldState.judicialCaseLedger = ledger;
  return worldState;
}

function resolveAndApplyJudicialCase(worldState = {}, proposal = {}, options = {}) {
  const outcome = resolveJudicialCase(worldState, proposal, options);
  if (outcome.status === "accepted") {
    applyJudicialCaseOutcome(worldState, outcome, options.auditContext);
  }
  return outcome;
}

function resolveJudicialCaseFromDomainTool(worldState = {}, domainToolResult = {}, options = {}) {
  const proposal = domainToolResult.normalizedProposal || domainToolResult;
  return resolveJudicialCase(worldState, proposal, options);
}

module.exports = {
  JUDICIAL_CASE_SCHEMA_VERSION,
  applyJudicialCaseOutcome,
  buildCaseEvidenceContext,
  buildJudicialCasePublicEvent,
  normalizeCaseProposal,
  resolveAndApplyJudicialCase,
  resolveJudicialCase,
  resolveJudicialCaseFromDomainTool,
  validateCaseAuthority
};
