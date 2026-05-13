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
  CITY_POLICY_ACTION_ALIASES,
  CITY_POLICY_ACTIONS,
  CITY_POLICY_ALLOWED_TIERS,
  CITY_POLICY_EVIDENCE_DOMAINS,
  CITY_POLICY_RECORD_LIMIT,
  CITY_POLICY_SCHEMA_VERSION
} = require("./cityPolicyResolverConfig");

const CITY_POLICY_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_CITY_POLICY_KEYS = new Set([
  "apiKey",
  "hiddenIntent",
  "hiddenNotes",
  "localPath",
  "providerConfig",
  "rawAudit",
  "rawPrompt",
  "rawSql",
  "rawTable",
  "sql",
  "statePatch",
  "worldState"
]);

const SAFE_CITY_POLICY_METADATA_KEYS = new Set([
  "cooldownKey"
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
  if (!trimmed || CITY_POLICY_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
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
    if (CITY_POLICY_SENSITIVE_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeFields(entry, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (
      !SAFE_CITY_POLICY_METADATA_KEYS.has(key) &&
      (FORBIDDEN_CITY_POLICY_KEYS.has(key) || CITY_POLICY_SENSITIVE_TEXT_PATTERN.test(key))
    ) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function normalizePolicyType(value) {
  const raw = String(value || "").trim();
  if (/赈|开仓/.test(raw)) return "relief";
  if (/平粜|粮价|稳价/.test(raw)) return "grain_price_stabilization";
  if (/征粮|催科|征税|税粮/.test(raw)) return "tax_collection";
  if (/修堤|水利|河工/.test(raw)) return "waterworks";
  if (/清丈|田亩|鱼鳞/.test(raw)) return "land_survey";
  if (/减免|蠲免|缓征/.test(raw)) return "tax_remission";
  if (/追赃|清欠|亏空/.test(raw)) return "asset_recovery";
  if (/盐漕|漕运|盐政/.test(raw)) return "salt_canal_reform";
  if (/徭役|差役/.test(raw)) return "corvee_adjustment";
  if (/治安|缉盗|安民/.test(raw)) return "public_order";
  const normalized = cleanId(raw.toLowerCase().replace(/[\s-]+/g, "_"), "");
  return CITY_POLICY_ACTION_ALIASES[normalized] || "relief";
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

function normalizeCityPolicyProposal(proposal = {}, options = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const actor = actorRef(options.actorProfile, source.actorRef);
  const policyType = normalizePolicyType(
    source.policyType ||
    source.policyKind ||
    source.actionKind ||
    source.cityPolicyKind ||
    source.type
  );
  const action = CITY_POLICY_ACTIONS[policyType] || CITY_POLICY_ACTIONS.relief;
  const evidenceRefs = cleanRefList(source.evidenceRefs, 8);
  const jurisdictionRef = cleanId(source.jurisdictionRef, actor.jurisdictionRefs[0] || "");
  const intensity = clampNumber(source.intensity ?? source.riskLevel, 1, 3, 1);
  const unsafeFields = collectUnsafeFields(source);
  const safetyFlags = unsafeFields.length ? ["unsafe_policy_payload"] : [];

  return {
    schemaVersion: CITY_POLICY_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `city-policy:${actor.actorId}:${policyType}:${evidenceRefs[0] || jurisdictionRef || "scope"}`),
    sourceToolName: cleanText(source.toolName, "city.propose_policy", 96),
    policyType,
    policyLabel: action.label,
    actorRef: actor,
    jurisdictionRef,
    evidenceRefs,
    targetRefs: cleanRefList(source.targetRefs, 8),
    publicSummary: cleanText(source.publicSummary, `${action.label}待服务器裁决。`, 180),
    intensity,
    expectedBenefits: asArray(source.expectedBenefits).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    counterCosts: asArray(source.counterCosts).map((item) => cleanText(item, "", 100)).filter(Boolean).slice(0, 5),
    riskDisclosure: cleanText(source.riskDisclosure, "需复核财政、民情、辖区和执行链风险。", 160),
    privateResultRefs: [],
    safetyFlags,
    authorityBoundary: "城市政策 proposal 只进入服务器财政与城市 resolver；税粮、仓储、赈济、清丈、水利、市场和持久化由服务器裁决。"
  };
}

function buildCityPolicyContext(worldState = {}, actorProfile = {}, proposal = {}, options = {}) {
  const baseContext = options.resolverInputContext || buildResolverInputContext(worldState, {
    actorProfile,
    intentType: "city_policy",
    requestSummary: proposal.publicSummary
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

function selectedEvidenceFor(proposal, cityContext) {
  const selected = [];
  for (const ref of proposal.evidenceRefs) {
    const evidence = cityContext.evidenceByRef.get(ref);
    if (evidence) selected.push(evidence);
  }
  return selected;
}

function intersects(first = [], second = []) {
  const secondSet = new Set(second);
  return first.some((value) => secondSet.has(value));
}

function validateCityPolicyAuthority(worldState = {}, proposal = {}, context = {}) {
  const actorProfile = context.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = proposal.schemaVersion === CITY_POLICY_SCHEMA_VERSION
    ? proposal
    : normalizeCityPolicyProposal(proposal, { actorProfile });
  const action = CITY_POLICY_ACTIONS[normalized.policyType];
  const cityContext = context.cityContext || buildCityPolicyContext(worldState, actorProfile, normalized, context);
  const selectedEvidence = selectedEvidenceFor(normalized, cityContext);
  const rejectionReasons = [];

  if (normalized.safetyFlags.length) rejectionReasons.push("政策文本包含禁止来源或直写字段。");
  if (!action) rejectionReasons.push("政策类型不在服务器允许范围。");
  if (!CITY_POLICY_ALLOWED_TIERS.includes(actorProfile.authorityTier)) rejectionReasons.push("当前 actor 权限不足，不能裁决城市财政政策。");
  if (!asArray(actorProfile.allowedToolGroups).includes("city_policy")) rejectionReasons.push("当前 actor 未获城市政策工具组。");
  if (!normalized.evidenceRefs.length) rejectionReasons.push("城市政策必须引用玩家可见 resolver evidence。");
  if (!selectedEvidence.length) rejectionReasons.push("引用证据不在当前 actor 可见 resolver 输入中。");

  const allowedDomains = new Set(action?.evidenceDomains || CITY_POLICY_EVIDENCE_DOMAINS);
  const evidenceDomainOk = selectedEvidence.some((evidence) => allowedDomains.has(evidence.domain));
  if (selectedEvidence.length && !evidenceDomainOk) rejectionReasons.push("引用证据领域不适用于该政策。");

  const actorScopes = asArray(actorProfile.jurisdictionRefs);
  const selectedScopes = unique(selectedEvidence.flatMap((evidence) => evidence.scopeRefs), 24);
  const selectedScopeOk = intersects(selectedScopes, actorScopes);
  const localTier = actorProfile.authorityTier === "T3";
  if (localTier && !selectedScopeOk) {
    rejectionReasons.push("政策证据不属于当前 actor 辖区。");
  }

  return {
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
    normalized,
    selectedEvidence,
    cityContext
  };
}

function scaleDeltas(deltas = {}, intensity = 1) {
  return Object.fromEntries(Object.entries(deltas).map(([key, value]) => [key, Math.round(value * intensity)]));
}

function calculateResourceUse(stateDelta = {}) {
  return {
    treasury: Math.max(0, -(stateDelta.treasury || 0)),
    grainReserve: Math.max(0, -(stateDelta.grainReserve || 0))
  };
}

function resourceRejections(worldState = {}, resourceUse = {}) {
  const rejectionReasons = [];
  if ((resourceUse.treasury || 0) > Math.max(0, Number(worldState.treasury) || 0)) {
    rejectionReasons.push("府库不足，不能执行该财政政策。");
  }
  if ((resourceUse.grainReserve || 0) > Math.max(0, Number(worldState.grainReserve) || 0)) {
    rejectionReasons.push("粮储不足，不能执行该仓储政策。");
  }
  return rejectionReasons;
}

function safeDelta(delta = {}, allowedKeys = []) {
  const allowed = new Set(allowedKeys);
  return Object.fromEntries(Object.entries(delta).filter(([key, value]) => allowed.has(key) && Number.isFinite(Number(value))));
}

function buildCityPolicyPublicEvent(outcome = {}) {
  const accepted = outcome.status === "accepted";
  const evidenceCount = asArray(outcome.evidenceRefs).length;
  const evidenceLabel = evidenceCount ? `${evidenceCount}条可见证据` : "可见证据";
  const summary = accepted
    ? `${outcome.policyLabel}已由服务器裁决执行：${outcome.publicSummary} 依据${evidenceLabel}，产生受控钱粮与民情影响。`
    : `${outcome.policyLabel || "城市政策"}未获服务器裁决：${outcome.rejectionReasons?.[0] || "权限或证据不足"}。`;
  return {
    eventId: cleanId(`city-policy:${outcome.outcomeId || "outcome"}`, "city-policy"),
    sourceType: "city_policy",
    visibility: "public",
    title: cleanText(outcome.policyLabel || "城市政策", "城市政策", 80),
    summary: cleanText(summary, accepted ? "城市政策已裁决。" : "城市政策未通过裁决。", 180),
    relatedRefs: cleanRefList(outcome.evidenceRefs, 6)
  };
}

function buildAuditRecord(outcome, validation, resourceUse) {
  return {
    schemaVersion: CITY_POLICY_SCHEMA_VERSION,
    auditId: cleanId(`city-policy:${outcome.outcomeId}`, "city-policy"),
    visibility: "developer",
    status: outcome.status,
    policyType: outcome.policyType,
    actorRef: outcome.actorRef,
    evidenceRefs: outcome.evidenceRefs,
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    resourceUse,
    rejectionReasons: outcome.rejectionReasons,
    resolverInput: validation.cityContext.auditSummary,
    safety: {
      proposalPayloadIncluded: false,
      stateSnapshotIncluded: false,
      sqlIncluded: false,
      hiddenIncluded: false,
      serverAdjudicated: true
    }
  };
}

function resolveCityPolicy(worldState = {}, proposal = {}, options = {}) {
  const actorProfile = options.actorProfile || buildPlayerAiActorProfile(worldState);
  const normalized = normalizeCityPolicyProposal(proposal, { actorProfile });
  const cityContext = buildCityPolicyContext(worldState, actorProfile, normalized, options);
  const validation = validateCityPolicyAuthority(worldState, normalized, {
    ...options,
    actorProfile,
    cityContext
  });
  const action = CITY_POLICY_ACTIONS[normalized.policyType] || CITY_POLICY_ACTIONS.relief;
  const stateDelta = safeDelta(scaleDeltas(action.stateDelta, normalized.intensity), [
    "treasury",
    "grainReserve",
    "population",
    "publicOrder",
    "taxRate",
    "corruption"
  ]);
  const playerDelta = safeDelta(scaleDeltas(action.playerDelta, normalized.intensity), [
    "performanceMerit",
    "promotionProspect",
    "impeachmentRisk",
    "cleanReputation",
    "superiorFavor",
    "gentryRelations",
    "corveeBurden",
    "waterworks",
    "banditPressure"
  ]);
  const resourceUse = calculateResourceUse(stateDelta);
  const rejectionReasons = validation.rejectionReasons.concat(resourceRejections(worldState, resourceUse));
  const accepted = rejectionReasons.length === 0;
  const outcome = {
    schemaVersion: CITY_POLICY_SCHEMA_VERSION,
    outcomeId: cleanId(`${normalized.proposalId}:${accepted ? "accepted" : "rejected"}`, "city-policy-outcome"),
    status: accepted ? "accepted" : "rejected",
    policyType: normalized.policyType,
    policyLabel: action.label,
    actorRef: normalized.actorRef,
    jurisdictionRef: normalized.jurisdictionRef,
    evidenceRefs: validation.selectedEvidence.map((evidence) => evidence.refId).slice(0, 8),
    publicSummary: accepted
      ? cleanText(`${action.summaryVerb}已按强度${normalized.intensity}裁决。`, "城市政策已裁决。", 120)
      : "城市政策未通过服务器裁决。",
    stateDelta: accepted ? stateDelta : {},
    playerDelta: accepted ? playerDelta : {},
    resourceUse: accepted ? resourceUse : {},
    rejectionReasons,
    riskTags: asArray(action.riskTags),
    authorityBoundary: normalized.authorityBoundary
  };
  outcome.publicEvent = buildCityPolicyPublicEvent(outcome);
  outcome.auditRecord = buildAuditRecord(outcome, validation, resourceUse);
  return outcome;
}

function applyNumericDelta(target, key, delta) {
  if (!Number.isFinite(Number(delta)) || delta === 0) return;
  const [min, max] = NUMERIC_RANGES[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const current = Number(target[key]);
  const fallback = Number.isFinite(current) ? current : 0;
  target[key] = clamp(Math.round(fallback + delta), min, max);
}

function normalizePolicyLedger(worldState = {}) {
  const ledger = isPlainObject(worldState.cityPolicyLedger) ? worldState.cityPolicyLedger : {};
  return {
    schemaVersion: CITY_POLICY_SCHEMA_VERSION,
    records: asArray(ledger.records).filter(isPlainObject).slice(-CITY_POLICY_RECORD_LIMIT)
  };
}

function applyCityPolicyOutcome(worldState = {}, outcome = {}, auditContext = {}) {
  if (outcome.status !== "accepted") return worldState;
  for (const [key, delta] of Object.entries(outcome.stateDelta || {})) {
    applyNumericDelta(worldState, key, delta);
  }
  if (!isPlainObject(worldState.player)) worldState.player = {};
  for (const [key, delta] of Object.entries(outcome.playerDelta || {})) {
    applyNumericDelta(worldState.player, key, delta);
  }
  appendEvents(worldState, [outcome.publicEvent?.summary]);
  const ledger = normalizePolicyLedger(worldState);
  ledger.records.push({
    outcomeId: cleanId(outcome.outcomeId, "city-policy-outcome"),
    policyType: cleanId(outcome.policyType, "policy"),
    policyLabel: cleanText(outcome.policyLabel, "城市政策", 80),
    status: "accepted",
    actorRef: outcome.actorRef,
    jurisdictionRef: cleanId(outcome.jurisdictionRef, ""),
    evidenceRefs: cleanRefList(outcome.evidenceRefs, 8),
    stateDelta: outcome.stateDelta,
    playerDelta: outcome.playerDelta,
    resourceUse: outcome.resourceUse,
    publicSummary: cleanText(outcome.publicEvent?.summary, "城市政策已裁决。", 180),
    appliedAtTurn: clampNumber(auditContext.turn ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  });
  ledger.records = ledger.records.slice(-CITY_POLICY_RECORD_LIMIT);
  worldState.cityPolicyLedger = ledger;
  return worldState;
}

function resolveAndApplyCityPolicy(worldState = {}, proposal = {}, options = {}) {
  const outcome = resolveCityPolicy(worldState, proposal, options);
  if (outcome.status === "accepted") {
    applyCityPolicyOutcome(worldState, outcome, options.auditContext);
  }
  return outcome;
}

function resolveCityPolicyFromDomainTool(worldState = {}, domainToolResult = {}, options = {}) {
  const proposal = domainToolResult.normalizedProposal || domainToolResult;
  return resolveCityPolicy(worldState, proposal, options);
}

module.exports = {
  CITY_POLICY_SCHEMA_VERSION,
  applyCityPolicyOutcome,
  buildCityPolicyPublicEvent,
  normalizeCityPolicyProposal,
  resolveAndApplyCityPolicy,
  resolveCityPolicy,
  resolveCityPolicyFromDomainTool,
  validateCityPolicyAuthority
};
