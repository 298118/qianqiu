const {
  buildOfficeAiActorProfile,
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile,
  summarizeAiActorProfileForPrompt
} = require("./aiActorProfiles");
const {
  buildResolverInputContext,
  createResolverEvidenceRefs,
  filterResolverInputForActor,
  summarizeResolverInputForAudit
} = require("./resolverInputContext");
const { collectVisibleDomainEvidenceRefs } = require("./domainToolResolvers");
const { resolveCityPolicy } = require("./cityPolicyResolver");
const { resolveJudicialCase } = require("./judicialCaseResolver");
const {
  resolveCampaignOrDefense,
  resolveDiplomaticMove
} = require("./militaryDiplomacyResolver");
const {
  SCENE_RUNTIME_LIMITS,
  SCENE_RUNTIME_PROPOSAL_KINDS,
  SCENE_RUNTIME_SCHEMA_VERSION,
  SCENE_RUNTIME_TYPES,
  SCENE_RUNTIME_TYPE_CONFIG
} = require("./sceneRuntimeConfig");

const SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const RESOLVER_KIND_BY_PROPOSAL = Object.freeze({
  city_policy: "city_policy",
  judicial_case: "judicial_case",
  military_order: "military",
  diplomacy_move: "diplomacy",
  pressure_event: "pressure_event",
  procedural_note: "none"
});

const FORBIDDEN_SCENE_PROPOSAL_KEYS = new Set([
  "apiKey",
  "auditRecord",
  "canonicalState",
  "databasePath",
  "hiddenEvidence",
  "hiddenIntent",
  "hiddenNotes",
  "localPath",
  "providerConfig",
  "rawAudit",
  "rawEvidence",
  "rawOutcome",
  "rawPrompt",
  "rawProvider",
  "rawSql",
  "rawTable",
  "resolverOutcome",
  "serverResult",
  "sql",
  "stateDelta",
  "statePatch",
  "worldState"
]);

const SAFE_SCENE_PROPOSAL_METADATA_KEYS = new Set([
  "actionKind",
  "actorId",
  "authorityBoundary",
  "confidence",
  "droppedEvidenceCount",
  "evidenceRefs",
  "institutionalPath",
  "jurisdictionRef",
  "participantId",
  "proposalId",
  "proposalKind",
  "publicPosition",
  "resolverKind",
  "sceneId",
  "schemaVersion",
  "safetyFlags",
  "targetRefs"
]);

const PREFERRED_EVIDENCE_DOMAINS_BY_PROPOSAL = Object.freeze({
  city_policy: Object.freeze(["economy", "market", "local_docket", "events", "geography"]),
  judicial_case: Object.freeze(["local_docket", "people", "events", "office", "offices", "geography"]),
  military_order: Object.freeze(["military", "intel", "market", "economy", "geography", "events"]),
  diplomacy_move: Object.freeze(["diplomacy", "military", "intel", "market", "economy", "geography", "events"]),
  pressure_event: Object.freeze(["events", "market", "local_docket", "military", "intel", "people", "geography"]),
  procedural_note: Object.freeze(["events", "office", "geography", "people"])
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = SCENE_RUNTIME_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanServerText(value, fallback = "", maxLength = SCENE_RUNTIME_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
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

function collectUnsafeFields(value, path = "scene", findings = []) {
  if (typeof value === "string") {
    if (SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnsafeFields(entry, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (
      !SAFE_SCENE_PROPOSAL_METADATA_KEYS.has(key) &&
      (FORBIDDEN_SCENE_PROPOSAL_KEYS.has(key) || SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN.test(key))
    ) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function normalizeSceneType(value) {
  const raw = cleanText(String(value || ""), "", 64).toLowerCase().replace(/[\s-]+/g, "_");
  if (Object.values(SCENE_RUNTIME_TYPES).includes(raw)) return raw;
  if (/堂审|judicial|trial|hearing/.test(String(value || ""))) return SCENE_RUNTIME_TYPES.judicialHearing;
  if (/会盟|diplom|summit|envoy/.test(String(value || ""))) return SCENE_RUNTIME_TYPES.diplomaticSummit;
  if (/战|battle|campaign|military/.test(String(value || ""))) return SCENE_RUNTIME_TYPES.battleCouncil;
  return SCENE_RUNTIME_TYPES.courtDebate;
}

function normalizeProposalKind(value, fallback = "procedural_note") {
  const text = cleanId(value, "");
  if (SCENE_RUNTIME_PROPOSAL_KINDS.includes(text)) return text;
  return SCENE_RUNTIME_PROPOSAL_KINDS.includes(fallback) ? fallback : "procedural_note";
}

function currentSceneDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function sceneLocalTime(worldState = {}, roundIndex = 0, maxRounds = SCENE_RUNTIME_LIMITS.maxRounds) {
  return {
    cadence: "scene",
    roundIndex: clampNumber(roundIndex, 0, 99, 0),
    maxRounds: clampNumber(maxRounds, 1, 9, SCENE_RUNTIME_LIMITS.maxRounds),
    globalDate: currentSceneDate(worldState),
    globalTimeAdvanced: false,
    authorityBoundary: "场景运行时只推进局部轮次，不推进全局年月旬、回合或科期。"
  };
}

function safeActorSummary(actorProfile = {}) {
  const summary = summarizeAiActorProfileForPrompt(actorProfile);
  if (!summary) return null;
  return {
    actorId: cleanText(summary.actorId, "actor:unknown", 96),
    actorType: cleanText(summary.actorType, "unknown", 48),
    authorityTier: cleanText(summary.authorityTier, "T0", 4),
    role: cleanText(summary.role, "", 80),
    allowedToolGroups: unique(summary.allowedToolGroups, 12),
    visibilityDomains: unique(summary.visibilityDomains, 12),
    currentGoals: asArray(summary.currentGoals).map((goal) => cleanText(goal, "", 120)).filter(Boolean).slice(0, 5),
    boundaryStatement: cleanText(summary.boundaryStatement, "服务器裁决后果与持久化。", 180)
  };
}

function actorProfileForPreset(worldState = {}, preset = {}) {
  if (preset.actorSource === "player") {
    return buildPlayerAiActorProfile(worldState);
  }
  if (preset.actorSource === "system") {
    return buildSystemEngineActorProfile(worldState, cleanId(preset.systemRole, "scene_runtime"));
  }
  return buildOfficeAiActorProfile(worldState, preset.officeRef || preset.participantRole, {
    actorType: preset.actorType || preset.fallbackActorType || "minister",
    allowUnknown: true
  });
}

function buildParticipant(worldState = {}, preset = {}, index = 0, sceneConfig = {}) {
  const actorProfile = actorProfileForPreset(worldState, preset);
  const participantRole = cleanId(preset.participantRole, `participant-${index + 1}`);
  const allowedKinds = new Set(asArray(sceneConfig.allowedProposalKinds));
  const requestedKind = normalizeProposalKind(preset.defaultProposalKind, sceneConfig.defaultProposalKind);
  const proposalKind = !allowedKinds.size || allowedKinds.has(requestedKind) ? requestedKind : "procedural_note";
  return {
    participantId: cleanId(`${participantRole}:${index + 1}`, `participant:${index + 1}`),
    participantRole,
    roleLabel: cleanText(preset.label, "场景参与者", 80),
    actorProfile,
    actor: safeActorSummary(actorProfile),
    defaultProposalKind: proposalKind,
    defaultActionKind: cleanId(preset.defaultActionKind, sceneConfig.defaultActionKind || "review"),
    authorityBoundary: cleanText(
      actorProfile.boundaryStatement,
      "场景 actor 只能提交自身视野内的待裁决意见；服务器负责 resolver、状态和持久化。",
      180
    )
  };
}

function createSceneId(sceneType, worldState = {}, seed = "") {
  const date = currentSceneDate(worldState);
  return cleanId(`scene:${sceneType}:${date.turnCount}:${seed || "runtime"}`, `scene:${sceneType}:${date.turnCount}`);
}

function createScene(worldState = {}, sceneSpec = {}, options = {}) {
  const spec = typeof sceneSpec === "string" ? { sceneType: sceneSpec, title: sceneSpec } : (isPlainObject(sceneSpec) ? sceneSpec : {});
  const sceneType = normalizeSceneType(spec.sceneType || spec.type || spec.kind || spec.title);
  const sceneConfig = SCENE_RUNTIME_TYPE_CONFIG[sceneType] || SCENE_RUNTIME_TYPE_CONFIG[SCENE_RUNTIME_TYPES.courtDebate];
  const maxRounds = clampNumber(spec.maxRounds ?? options.maxRounds, 1, 9, SCENE_RUNTIME_LIMITS.maxRounds);
  const title = cleanText(spec.title || spec.topic, sceneConfig.label, 120);
  const topic = cleanText(spec.topic || spec.title, title, 120);
  const focusRefs = unique([
    ...asArray(spec.focusRefs),
    ...asArray(options.focusRefs)
  ], 8);
  const participants = asArray(sceneConfig.participantPresets)
    .slice(0, SCENE_RUNTIME_LIMITS.maxActors)
    .map((preset, index) => buildParticipant(worldState, preset, index, sceneConfig));

  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    sceneId: createSceneId(sceneType, worldState, title),
    sceneType,
    title,
    status: "open",
    sceneLocalTime: sceneLocalTime(worldState, 0, maxRounds),
    participants,
    context: {
      topic,
      focusRefs,
      defaultProposalKind: sceneConfig.defaultProposalKind,
      defaultActionKind: sceneConfig.defaultActionKind,
      allowedProposalKinds: asArray(sceneConfig.allowedProposalKinds),
      evidenceDomains: asArray(sceneConfig.evidenceDomains),
      note: cleanText(spec.note || options.note, "", 160),
      safety: {
        localOnly: true,
        actorVisibleContextOnly: true,
        aiCannotAdvanceGlobalTime: true,
        aiCannotWriteDatabase: true
      }
    },
    proposalBudget: {
      maxRounds,
      maxActors: SCENE_RUNTIME_LIMITS.maxActors,
      maxProposalsPerRound: SCENE_RUNTIME_LIMITS.maxProposalsPerRound,
      maxActorEvidenceRefs: SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs
    },
    authorityBoundary: "多 actor 场景只组织发言、证据引用和待裁决意见；服务器 resolver 决定采纳、状态变化和持久化。"
  };
}

function compactEvidenceRefs(context = {}, allowedDomains = []) {
  const allowed = new Set(allowedDomains);
  return createResolverEvidenceRefs(context)
    .filter((ref) => !allowed.size || allowed.has(ref.domain))
    .map((ref) => ({
      refId: cleanId(ref.refId, ""),
      domain: cleanId(ref.domain, "events"),
      visibility: cleanText(ref.visibility, "public", 48),
      confidence: Math.max(0, Math.min(1, Number(ref.confidence) || 0)),
      relatedRefs: unique(ref.relatedRefs, 6),
      scopeRefs: unique(ref.scopeRefs, 6),
      generatedAtTurn: clampNumber(ref.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0)
    }))
    .filter((ref) => ref.refId)
    .slice(0, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs * 2);
}

function compactDomainEvidenceRefs(worldState = {}, actorProfile = {}, allowedDomains = []) {
  const allowed = new Set(allowedDomains);
  return [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((ref) => !allowed.size || allowed.has(ref.domain))
    .map((ref) => ({
      refId: cleanId(ref.ref || ref.refId, ""),
      domain: cleanId(ref.domain, "events"),
      visibility: "actor_visible",
      confidence: Math.max(0, Math.min(1, Number(ref.confidence) || 0.68)),
      relatedRefs: [],
      scopeRefs: unique(ref.scopeRefs, 6),
      generatedAtTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
    }))
    .filter((ref) => ref.refId)
    .slice(0, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs * 2);
}

function mergeEvidenceRefs(refs = [], allowedDomains = []) {
  const domainRank = new Map(asArray(allowedDomains).map((domain, index) => [domain, index]));
  const merged = [];
  const seen = new Set();
  for (const ref of refs) {
    if (!ref?.refId || seen.has(ref.refId)) continue;
    seen.add(ref.refId);
    merged.push(ref);
  }
  return merged
    .sort((first, second) => (domainRank.get(first.domain) ?? 99) - (domainRank.get(second.domain) ?? 99))
    .slice(0, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs);
}

function compactResolverInputSummary(context = {}) {
  const summary = summarizeResolverInputForAudit(context);
  return {
    schemaVersion: cleanText(summary.schemaVersion, "s71.resolverInputContext.v1", 48),
    generatedAtTurn: clampNumber(summary.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    identity: {
      actorId: cleanText(summary.identity?.actorId, "actor:unknown", 96),
      actorType: cleanText(summary.identity?.actorType, "unknown", 48),
      role: cleanText(summary.identity?.role, "", 48),
      authorityTier: cleanText(summary.identity?.authorityTier, "T0", 4),
      sceneType: cleanText(summary.identity?.sceneType, "turn", 48)
    },
    counts: { ...(summary.counts || {}) },
    totalEvidenceRefs: clampNumber(summary.totalEvidenceRefs, 0, Number.MAX_SAFE_INTEGER, 0),
    safety: {
      localOnly: summary.safety?.localOnly !== false,
      aiCannotWriteDatabase: summary.safety?.aiCannotWriteDatabase !== false,
      hiddenNotBackfilledToStateRoute: summary.safety?.hiddenNotBackfilledToStateRoute !== false
    }
  };
}

function buildSceneActorContext(scene = {}, actorProfile = {}, resolverInput = null) {
  const baseContext = resolverInput || buildResolverInputContext(scene.worldState || {}, {
    actorProfile,
    intentType: cleanId(scene.sceneType, "scene_runtime"),
    requestSummary: cleanText(scene.title || scene.context?.topic, "多 actor 场景", 120)
  });
  const context = filterResolverInputForActor(baseContext, actorProfile);
  const evidenceDomains = scene.context?.evidenceDomains || [];
  const visibleEvidenceRefs = mergeEvidenceRefs([
    ...compactDomainEvidenceRefs(scene.worldState || {}, actorProfile, evidenceDomains),
    ...compactEvidenceRefs(context, evidenceDomains)
  ], evidenceDomains);
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "scene-runtime"),
    actorRef: {
      actorId: cleanText(actorProfile.actorId, "actor:unknown", 96),
      actorType: cleanText(actorProfile.actorType, "unknown", 48),
      authorityTier: cleanText(actorProfile.authorityTier, "T0", 4)
    },
    sceneLocalTime: {
      ...(scene.sceneLocalTime || {}),
      globalTimeAdvanced: false
    },
    visibleEvidenceRefs,
    resolverInput: compactResolverInputSummary(context),
    safety: {
      actorVisibleContextOnly: true,
      hiddenIncluded: false,
      rawTablesIncluded: false,
      aiCannotWriteDatabase: true
    }
  };
}

function defaultEvidenceRefs(actorContext = {}) {
  return asArray(actorContext.visibleEvidenceRefs).map((ref) => ref.refId).slice(0, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs);
}

function preferredEvidenceRefs(actorContext = {}, proposalKind = "procedural_note") {
  const preferredDomains = PREFERRED_EVIDENCE_DOMAINS_BY_PROPOSAL[proposalKind] || PREFERRED_EVIDENCE_DOMAINS_BY_PROPOSAL.procedural_note;
  const rankByDomain = new Map(preferredDomains.map((domain, index) => [domain, index]));
  return asArray(actorContext.visibleEvidenceRefs)
    .slice()
    .sort((first, second) => (rankByDomain.get(first.domain) ?? 99) - (rankByDomain.get(second.domain) ?? 99))
    .slice(0, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs);
}

function buildHeuristicSceneProposal(scene = {}, participant = {}, actorContext = {}) {
  const proposalKind = normalizeProposalKind(participant.defaultProposalKind, scene.context?.defaultProposalKind);
  const topic = cleanText(scene.context?.topic || scene.title, "此事", 80);
  const selectedEvidence = preferredEvidenceRefs(actorContext, proposalKind);
  return sanitizeSceneProposal({
    sceneId: scene.sceneId,
    participantId: participant.participantId,
    actorId: participant.actor?.actorId,
    proposalKind,
    actionKind: participant.defaultActionKind || scene.context?.defaultActionKind,
    publicPosition: `${participant.roleLabel}就${topic}提出${proposalKind === "procedural_note" ? "程序意见" : "待裁决方案"}；后果仍候服务器裁决。`,
    evidenceRefs: selectedEvidence.map((ref) => ref.refId),
    targetRefs: selectedEvidence.flatMap((ref) => ref.scopeRefs).slice(0, 4),
    jurisdictionRef: asArray(participant.actorProfile?.jurisdictionRefs)[0] || "",
    institutionalPath: proposalKind === "military_order" ? "war_council" : proposalKind === "diplomacy_move" ? "envoy_protocol" : "",
    confidence: 0.62
  }, {
    scene,
    participant,
    actorContext
  });
}

function safeParticipantForAiRuntime(participant = {}) {
  const actorSummary = participant.actor || safeActorSummary(participant.actorProfile) || {};
  return {
    participantId: cleanText(participant.participantId, "participant", 96),
    participantRole: cleanText(participant.participantRole, "participant", 64),
    roleLabel: cleanText(participant.roleLabel, "场景参与者", 80),
    actor: {
      actorId: cleanText(actorSummary.actorId, "actor:unknown", 96),
      actorType: cleanText(actorSummary.actorType, "unknown", 48),
      authorityTier: cleanText(actorSummary.authorityTier, "T0", 4),
      role: cleanText(actorSummary.role, "", 80),
      allowedToolGroups: unique(actorSummary.allowedToolGroups, 12),
      visibilityDomains: unique(actorSummary.visibilityDomains, 12),
      currentGoals: asArray(actorSummary.currentGoals).map((goal) => cleanText(goal, "", 120)).filter(Boolean).slice(0, 5),
      boundaryStatement: cleanText(actorSummary.boundaryStatement, "服务器裁决后果与持久化。", 180)
    },
    defaultProposalKind: normalizeProposalKind(participant.defaultProposalKind, "procedural_note"),
    defaultActionKind: cleanId(participant.defaultActionKind, "review"),
    authorityBoundary: cleanText(
      participant.authorityBoundary,
      "场景 actor 只能提交自身视野内的待裁决意见；服务器负责 resolver、状态和持久化。",
      180
    )
  };
}

function safeSceneForAiRuntime(scene = {}) {
  const sceneType = normalizeSceneType(scene.sceneType);
  const sceneConfig = SCENE_RUNTIME_TYPE_CONFIG[sceneType] || SCENE_RUNTIME_TYPE_CONFIG[SCENE_RUNTIME_TYPES.courtDebate];
  const sceneLocal = scene.sceneLocalTime || {};
  const allowedProposalKinds = asArray(scene.context?.allowedProposalKinds).length
    ? asArray(scene.context.allowedProposalKinds)
    : asArray(sceneConfig.allowedProposalKinds);
  const evidenceDomains = asArray(scene.context?.evidenceDomains).length
    ? asArray(scene.context.evidenceDomains)
    : asArray(sceneConfig.evidenceDomains);
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "scene-runtime"),
    sceneType,
    title: cleanText(scene.title, sceneConfig.label, 120),
    sceneLocalTime: {
      cadence: "scene",
      roundIndex: clampNumber(sceneLocal.roundIndex, 0, 99, 0),
      maxRounds: clampNumber(sceneLocal.maxRounds, 1, 9, SCENE_RUNTIME_LIMITS.maxRounds),
      globalDate: {
        year: clampNumber(sceneLocal.globalDate?.year, 1, 9999, 1644),
        month: clampNumber(sceneLocal.globalDate?.month, 1, 12, 1),
        tenDayPeriod: clampNumber(sceneLocal.globalDate?.tenDayPeriod, 1, 3, 1),
        turnCount: clampNumber(sceneLocal.globalDate?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
      },
      globalTimeAdvanced: false
    },
    participants: asArray(scene.participants).slice(0, SCENE_RUNTIME_LIMITS.maxActors).map(safeParticipantForAiRuntime),
    context: {
      topic: cleanText(scene.context?.topic || scene.title, sceneConfig.label, 120),
      focusRefs: unique(scene.context?.focusRefs, 8),
      defaultProposalKind: normalizeProposalKind(scene.context?.defaultProposalKind, sceneConfig.defaultProposalKind),
      defaultActionKind: cleanId(scene.context?.defaultActionKind, sceneConfig.defaultActionKind || "review"),
      allowedProposalKinds: allowedProposalKinds.map((kind) => normalizeProposalKind(kind, "")).filter(Boolean),
      evidenceDomains: unique(evidenceDomains, 12),
      safety: {
        localOnly: true,
        actorVisibleContextOnly: true,
        aiCannotAdvanceGlobalTime: true,
        aiCannotWriteDatabase: true
      }
    },
    proposalBudget: {
      maxRounds: clampNumber(scene.proposalBudget?.maxRounds, 1, 9, SCENE_RUNTIME_LIMITS.maxRounds),
      maxActors: SCENE_RUNTIME_LIMITS.maxActors,
      maxProposalsPerRound: SCENE_RUNTIME_LIMITS.maxProposalsPerRound,
      maxActorEvidenceRefs: SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs
    },
    authorityBoundary: "AI 只能依据当前 actorContext 提交场景意见；服务器裁决采纳、状态变化和持久化。"
  };
}

function safeAiRuntimeOptions(options = {}, scene = {}, participant = {}) {
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    roundIndex: clampNumber(options.roundIndex, 0, 99, (scene.sceneLocalTime?.roundIndex || 0) + 1),
    sceneId: cleanId(scene.sceneId, "scene-runtime"),
    sceneType: normalizeSceneType(scene.sceneType),
    participantId: cleanText(participant.participantId, "participant", 96),
    actorId: cleanText(participant.actor?.actorId, "actor:unknown", 96),
    localOnly: true,
    actorVisibleContextOnly: true,
    aiCannotAdvanceGlobalTime: true,
    aiCannotWriteDatabase: true,
    maxActorEvidenceRefs: SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs,
    maxTextLength: SCENE_RUNTIME_LIMITS.maxTextLength
  };
}

function sanitizeSceneProposal(proposal = {}, constraints = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const scene = constraints.scene || {};
  const participant = constraints.participant || {};
  const actorContext = constraints.actorContext || {};
  const allowedRefs = new Set(defaultEvidenceRefs(actorContext));
  const requestedKind = normalizeProposalKind(source.proposalKind || source.resolverKind, participant.defaultProposalKind || scene.context?.defaultProposalKind);
  const allowedKinds = new Set(asArray(scene.context?.allowedProposalKinds));
  const fallbackKind = normalizeProposalKind(participant.defaultProposalKind || scene.context?.defaultProposalKind, "procedural_note");
  const proposalKind = !allowedKinds.size || allowedKinds.has(requestedKind)
    ? requestedKind
    : (allowedKinds.has(fallbackKind) ? fallbackKind : "procedural_note");
  const inputEvidenceCount = asArray(source.evidenceRefs).length;
  const evidenceRefs = unique(source.evidenceRefs, SCENE_RUNTIME_LIMITS.maxActorEvidenceRefs)
    .filter((ref) => !allowedRefs.size || allowedRefs.has(ref));
  const unsafeFields = collectUnsafeFields(source, "proposal");
  const safetyFlags = unsafeFields.length ? ["unsafe_scene_proposal_payload"] : [];
  for (const flag of asArray(source.safetyFlags)) {
    const cleanedFlag = cleanId(flag, "");
    if (cleanedFlag && !safetyFlags.includes(cleanedFlag)) safetyFlags.push(cleanedFlag);
  }
  if (allowedKinds.size && !allowedKinds.has(requestedKind)) safetyFlags.push("scene_proposal_kind_not_allowed");
  if (source.accepted === true || cleanId(source.status, "") === "accepted") safetyFlags.push("model_claimed_scene_outcome");
  if (asArray(source.privateResultRefs).length) safetyFlags.push("private_result_refs_from_model");
  if (asArray(source.toolCalls).length || cleanText(source.requestedToolName, "", 96)) {
    safetyFlags.push("model_requested_runtime_tool");
  }
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `${scene.sceneId || "scene"}:${participant.participantId || "participant"}:${proposalKind}`),
    sceneId: cleanId(scene.sceneId || source.sceneId, "scene-runtime"),
    participantId: cleanText(participant.participantId || source.participantId, "", 96),
    actorId: cleanText(participant.actor?.actorId || source.actorId, "", 96),
    proposalKind,
    resolverKind: RESOLVER_KIND_BY_PROPOSAL[proposalKind] || "none",
    actionKind: cleanId(source.actionKind, participant.defaultActionKind || scene.context?.defaultActionKind || "review"),
    publicPosition: cleanText(source.publicPosition, "场景意见候选。", 180),
    evidenceRefs,
    droppedEvidenceCount: Math.max(0, inputEvidenceCount - evidenceRefs.length),
    targetRefs: unique(source.targetRefs, 6),
    jurisdictionRef: cleanId(source.jurisdictionRef, asArray(participant.actorProfile?.jurisdictionRefs)[0] || ""),
    institutionalPath: cleanId(source.institutionalPath, ""),
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0.5)),
    safetyFlags,
    requestedToolName: "",
    toolCalls: [],
    privateResultRefs: [],
    accepted: false,
    authorityBoundary: "场景意见只是 resolver 输入；服务器裁决采纳、反噬、状态变化和持久化。"
  };
}

async function proposalForParticipant(worldState, scene, participant, aiRuntime, options = {}) {
  const actorContext = buildSceneActorContext(
    { ...scene, worldState },
    participant.actorProfile,
    options.resolverInputContext || null
  );
  const constraints = { scene, participant, actorContext };
  if (options.allowAi === true && aiRuntime && typeof aiRuntime.generateSceneProposal === "function") {
    const proposal = await aiRuntime.generateSceneProposal(
      safeSceneForAiRuntime(scene),
      safeParticipantForAiRuntime(participant),
      actorContext,
      safeAiRuntimeOptions(options, scene, participant)
    );
    return {
      actorContext,
      proposal: sanitizeSceneProposal(proposal, constraints)
    };
  }
  return {
    actorContext,
    proposal: buildHeuristicSceneProposal(scene, participant, actorContext)
  };
}

async function runSceneRound(worldState = {}, scene = {}, options = {}) {
  const roundIndex = clampNumber(options.roundIndex, 1, 99, (scene.sceneLocalTime?.roundIndex || 0) + 1);
  const participants = asArray(scene.participants).slice(0, SCENE_RUNTIME_LIMITS.maxActors);
  const proposals = [];
  const actorContexts = [];
  for (const participant of participants) {
    const result = await proposalForParticipant(worldState, scene, participant, options.aiRuntime || null, options);
    actorContexts.push(result.actorContext);
    proposals.push(result.proposal);
    if (proposals.length >= SCENE_RUNTIME_LIMITS.maxProposalsPerRound) break;
  }
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "scene-runtime"),
    sceneType: cleanId(scene.sceneType, SCENE_RUNTIME_TYPES.courtDebate),
    roundIndex,
    sceneLocalTime: {
      ...(scene.sceneLocalTime || sceneLocalTime(worldState)),
      roundIndex,
      globalTimeAdvanced: false
    },
    actorContexts,
    transcript: proposals.map((proposal) => cleanText(proposal.publicPosition, "", 140)).filter(Boolean).slice(0, SCENE_RUNTIME_LIMITS.maxTranscriptLines),
    proposals,
    authorityBoundary: "本轮只收集多 actor 意见；不推进全局时间、不写库、不直接执行工具。"
  };
}

function participantMap(scene = {}) {
  return new Map(asArray(scene.participants).map((participant) => [participant.participantId, participant]));
}

function sanitizeProposalForScene(worldState = {}, scene = {}, proposal = {}) {
  const participant = participantMap(scene).get(cleanText(proposal?.participantId, "", 96));
  if (!participant) return null;
  const actorContext = buildSceneActorContext({ ...scene, worldState }, participant.actorProfile);
  return sanitizeSceneProposal(proposal, { scene, participant, actorContext });
}

function collectSceneProposals(sceneRound = {}) {
  const sceneType = normalizeSceneType(sceneRound.sceneType);
  const sceneConfig = SCENE_RUNTIME_TYPE_CONFIG[sceneType] || SCENE_RUNTIME_TYPE_CONFIG[SCENE_RUNTIME_TYPES.courtDebate];
  const contextsByActorId = new Map(asArray(sceneRound.actorContexts).map((context) => [context.actorRef?.actorId, context]));
  const roundScene = {
    sceneId: sceneRound.sceneId,
    sceneType,
    context: {
      defaultProposalKind: sceneConfig.defaultProposalKind,
      defaultActionKind: sceneConfig.defaultActionKind,
      allowedProposalKinds: asArray(sceneConfig.allowedProposalKinds)
    }
  };
  // 只整理 runSceneRound() 已收集的回合意见；外部 proposal 必须交给 resolveSceneOutcome() 用完整 scene 重审。
  return asArray(sceneRound.proposals)
    .map((proposal) => {
      const actorId = cleanText(proposal?.actorId, "", 96);
      return sanitizeSceneProposal(proposal, {
        scene: roundScene,
        participant: {
          participantId: proposal?.participantId,
          actor: { actorId },
          defaultProposalKind: proposal?.proposalKind,
          defaultActionKind: proposal?.actionKind
        },
        actorContext: contextsByActorId.get(actorId) || { visibleEvidenceRefs: [] }
      });
    })
    .slice(0, SCENE_RUNTIME_LIMITS.maxProposalsPerRound);
}

function buildResolverProposal(proposal = {}) {
  const common = {
    evidenceRefs: proposal.evidenceRefs,
    targetRefs: proposal.targetRefs,
    jurisdictionRef: proposal.jurisdictionRef,
    institutionalPath: proposal.institutionalPath,
    publicSummary: proposal.publicPosition
  };
  if (proposal.proposalKind === "city_policy") {
    return { ...common, policyKind: proposal.actionKind, intensity: 1 };
  }
  if (proposal.proposalKind === "judicial_case") {
    return { ...common, caseAction: proposal.actionKind, caseSeverity: 2 };
  }
  if (proposal.proposalKind === "military_order") {
    return { ...common, orderKind: proposal.actionKind, riskLevel: 1, subjectId: proposal.targetRefs[0] || proposal.evidenceRefs[0] || "scene-military" };
  }
  if (proposal.proposalKind === "diplomacy_move") {
    return { ...common, moveKind: proposal.actionKind, riskLevel: 1, subjectId: proposal.targetRefs[0] || proposal.evidenceRefs[0] || "scene-diplomacy" };
  }
  return common;
}

function compactResolverOutcome(proposal = {}, outcome = {}) {
  return {
    proposalId: proposal.proposalId,
    participantId: proposal.participantId,
    actorId: proposal.actorId,
    resolverKind: proposal.resolverKind,
    actionKind: cleanId(outcome.policyType || outcome.caseAction || outcome.actionKind || proposal.actionKind, proposal.actionKind),
    status: cleanText(outcome.status, "rejected", 32),
    publicSummary: cleanServerText(outcome.publicSummary, "服务器 resolver 已返回裁决结果。", 180),
    publicEventSummary: cleanServerText(outcome.publicEvent?.summary || outcome.publicDocket?.summary || outcome.publicResolution?.summary, "", 220),
    rejectionReasons: asArray(outcome.rejectionReasons).map((reason) => cleanServerText(reason, "", 120)).filter(Boolean).slice(0, 5),
    stateDeltaKeys: Object.keys(outcome.stateDelta || {}).filter((key) => !SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN.test(key)).slice(0, 8),
    playerDeltaKeys: Object.keys(outcome.playerDelta || {}).filter((key) => !SCENE_RUNTIME_SENSITIVE_TEXT_PATTERN.test(key)).slice(0, 8),
    safety: {
      rawOutcomeIncluded: false,
      auditRecordIncluded: false,
      appliedToWorldState: false,
      serverAdjudicated: true
    }
  };
}

function rejectedSceneResolverOutcome(proposal = {}, reason = "场景提案未进入服务器 resolver。") {
  return compactResolverOutcome(proposal, {
    status: "rejected",
    publicSummary: "场景提案未通过服务器收束。",
    rejectionReasons: [reason],
    stateDelta: {},
    playerDelta: {}
  });
}

function resolveProposalWithServer(worldState = {}, scene = {}, proposal = {}, participant = {}, options = {}) {
  if (proposal.safetyFlags.length) {
    return rejectedSceneResolverOutcome(proposal, "场景提案包含禁止来源、隐藏材料、原始字段或直写意图。");
  }
  if (!proposal.evidenceRefs.length && proposal.proposalKind !== "procedural_note") {
    return rejectedSceneResolverOutcome(proposal, "场景提案缺少当前 actor 可见证据。");
  }
  const resolverProposal = buildResolverProposal(proposal);
  const context = {
    ...options,
    actorProfile: participant.actorProfile,
    requestSummary: proposal.publicPosition
  };
  if (proposal.proposalKind === "city_policy") {
    return compactResolverOutcome(proposal, resolveCityPolicy(worldState, resolverProposal, context));
  }
  if (proposal.proposalKind === "judicial_case") {
    return compactResolverOutcome(proposal, resolveJudicialCase(worldState, resolverProposal, context));
  }
  if (proposal.proposalKind === "military_order") {
    return compactResolverOutcome(proposal, resolveCampaignOrDefense(worldState, resolverProposal, context));
  }
  if (proposal.proposalKind === "diplomacy_move") {
    return compactResolverOutcome(proposal, resolveDiplomaticMove(worldState, resolverProposal, context));
  }
  return rejectedSceneResolverOutcome(proposal, "程序意见只进入场景纪要，不直接触发领域 resolver。");
}

function resolveSceneOutcome(worldState = {}, scene = {}, proposals = [], auditContext = {}) {
  const participants = participantMap(scene);
  const safeProposals = asArray(proposals)
    .map((proposal) => sanitizeProposalForScene(worldState, scene, proposal))
    .filter(Boolean)
    .slice(0, SCENE_RUNTIME_LIMITS.maxProposalsPerRound);
  const resolverOutcomes = safeProposals.map((proposal) => {
    const participant = participants.get(proposal.participantId);
    return resolveProposalWithServer(worldState, scene, proposal, participant, auditContext);
  });
  const resolvedCount = resolverOutcomes.length;
  return {
    schemaVersion: SCENE_RUNTIME_SCHEMA_VERSION,
    sceneId: cleanId(scene.sceneId, "scene-runtime"),
    sceneType: cleanId(scene.sceneType, SCENE_RUNTIME_TYPES.courtDebate),
    status: "server_resolved",
    publicSummary: cleanServerText(`场景收束为${resolvedCount}条服务器 resolver 结果；是否应用后果仍由调用方显式执行。`, "场景已收束。", 180),
    proposalSummaries: safeProposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      participantId: proposal.participantId,
      actorId: proposal.actorId,
      proposalKind: proposal.proposalKind,
      resolverKind: proposal.resolverKind,
      evidenceCount: proposal.evidenceRefs.length,
      confidence: proposal.confidence
    })),
    resolverOutcomes,
    visibleEvents: resolverOutcomes.map((outcome) => outcome.publicEventSummary).filter(Boolean).slice(0, 6),
    appliedWorldChanges: [],
    sceneLocalTime: {
      ...(scene.sceneLocalTime || sceneLocalTime(worldState)),
      globalTimeAdvanced: false
    },
    auditSummary: {
      resolverOutcomeCount: resolverOutcomes.length,
      acceptedCount: resolverOutcomes.filter((outcome) => outcome.status === "accepted").length,
      rejectedCount: resolverOutcomes.filter((outcome) => outcome.status !== "accepted").length,
      rawPayloadIncluded: false,
      auditRecordIncluded: false
    },
    authorityBoundary: "场景 outcome 只提供 hidden-safe resolver 结果摘要；不写 worldState、SQLite、审计表或全局时间。"
  };
}

module.exports = {
  buildSceneActorContext,
  collectSceneProposals,
  createScene,
  resolveSceneOutcome,
  runSceneRound,
  sanitizeSceneProposal
};
