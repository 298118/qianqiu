const {
  NPC_MIND_LIMITS,
  NPC_MIND_PROPOSAL_TYPES,
  NPC_MIND_SCHEMA_VERSION,
  NPC_MIND_SCORE_WEIGHTS
} = require("./npcMindConfig");
const { buildNpcAiActorProfile, summarizeAiActorProfileForPrompt } = require("./aiActorProfiles");
const { buildActiveNpcRequestView } = require("./activeRequests");
const { applyRelationshipChanges, normalizeRelationshipLedger } = require("./relationships");
const { buildWorldPeopleView } = require("./worldPeople");
const { buildEventArchiveView } = require("./eventArchive");

const SENSITIVE_NPC_MIND_TEXT_PATTERN = /(hiddenNotes|hiddenIntent|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:\\[^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = NPC_MIND_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_NPC_MIND_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanTextList(values, limit = 8, maxLength = NPC_MIND_LIMITS.maxTextLength) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || result.includes(text)) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeProposalType(value, fallback = "memory") {
  const text = cleanText(value, "", 40);
  if (NPC_MIND_PROPOSAL_TYPES.includes(text)) return text;
  return NPC_MIND_PROPOSAL_TYPES.includes(fallback) ? fallback : "memory";
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function sanitizeActorSummaryForNpcMind(actorProfile = {}) {
  const summary = summarizeAiActorProfileForPrompt(actorProfile);
  if (!summary) return null;
  return {
    actorId: cleanText(summary.actorId, "", 96),
    actorType: cleanText(summary.actorType, "", 40),
    authorityTier: cleanText(summary.authorityTier, "", 8),
    role: cleanText(summary.role, "", 80),
    allowedToolGroups: cleanTextList(summary.allowedToolGroups, 12, 64),
    visibilityDomains: cleanTextList(summary.visibilityDomains, 12, 64),
    currentGoals: cleanTextList(summary.currentGoals, 5, 120),
    boundaryStatement: cleanText(summary.boundaryStatement, "", 180)
  };
}

function relationshipEntryForNpc(worldState, npcId) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  return ledger.characters[npcId] || null;
}

function calculateNpcSalience(worldState, npc = {}) {
  const id = cleanId(npc.id, "");
  const entry = relationshipEntryForNpc(worldState, id);
  const activeRequest = buildActiveNpcRequestView(worldState);
  const relationship = Math.abs(clampNumber(entry?.relationship, -100, 100, 0));
  const resentment = clampNumber(entry?.resentment ?? npc.resentmentRisk, 0, 100, 0);
  const influence = clampNumber(npc.influence, 0, 100, 20);
  const requestScore = activeRequest?.targetType === "character" && activeRequest.targetId === id ? 100 : 0;
  const turnGap = Math.max(0, currentTurn(worldState) - clampNumber(entry?.lastUpdatedTurn ?? npc.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, 0));
  const recentTurn = Math.max(0, 100 - turnGap * 12);
  const score = Math.round(
    relationship * NPC_MIND_SCORE_WEIGHTS.relationship +
    resentment * NPC_MIND_SCORE_WEIGHTS.resentment +
    influence * NPC_MIND_SCORE_WEIGHTS.influence +
    requestScore * NPC_MIND_SCORE_WEIGHTS.activeRequest +
    recentTurn * NPC_MIND_SCORE_WEIGHTS.recentTurn
  );
  return {
    score,
    reasons: [
      relationship >= 20 ? "关系显著" : "",
      resentment >= 20 ? "怨望显著" : "",
      influence >= 50 ? "影响较高" : "",
      requestScore ? "当前请托相关" : "",
      recentTurn >= 80 ? "近期互动" : ""
    ].filter(Boolean)
  };
}

function rankNpcSalience(worldState = {}, options = {}) {
  const view = buildWorldPeopleView(worldState);
  const limit = clampNumber(options.limit, 1, 50, NPC_MIND_LIMITS.maxLlmNpcPerTenDay);
  return (view.npcs || [])
    .filter((npc) => npc && npc.alive !== false && npc.knownToPlayer !== false && npc.visibility !== "hidden")
    .map((npc) => {
      const salience = calculateNpcSalience(worldState, npc);
      return {
        npcId: cleanId(npc.id, ""),
        name: cleanText(npc.name, "可见人物", 80),
        role: cleanText(npc.rankLabel, "可见人物", 80),
        salienceScore: salience.score,
        salienceReasons: salience.reasons,
        publicSummary: cleanText(npc.publicSummary, "", 160),
        currentGoal: cleanText(npc.currentGoal, "", 120)
      };
    })
    .filter((row) => row.npcId)
    .sort((a, b) => b.salienceScore - a.salienceScore || a.npcId.localeCompare(b.npcId))
    .slice(0, limit);
}

function buildNpcMindPromptContext(worldState = {}, actorProfile = {}, options = {}) {
  const maxItems = clampNumber(options.maxItems, 1, 12, NPC_MIND_LIMITS.maxPromptContextItems);
  const safeActorProfile = isPlainObject(actorProfile) ? actorProfile : {};
  const actorId = cleanText(safeActorProfile.actorId, "", 96);
  if (!actorId.startsWith("npc:")) return null;

  const npcId = cleanId(actorId.replace(/^npc:/, ""), "");
  const people = buildWorldPeopleView(worldState);
  const npc = (people.npcs || []).find((row) => row.id === npcId) || {};
  if (!npc.id) return null;

  const relationship = (people.relationships || []).find((row) => row.targetType === "npc" && row.targetId === npcId);
  const activeRequest = buildActiveNpcRequestView(worldState);
  const archive = buildEventArchiveView(worldState, { pageSize: maxItems });
  const recentEvents = (archive.items || [])
    .map((item) => cleanText(`${item.title || item.kind}：${item.summary || ""}`, "", 140))
    .filter(Boolean)
    .slice(0, maxItems);

  return {
    schemaVersion: NPC_MIND_SCHEMA_VERSION,
    actor: sanitizeActorSummaryForNpcMind(safeActorProfile),
    npc: {
      id: cleanId(npc.id, npcId),
      name: cleanText(npc.name, safeActorProfile.displayName || "可见人物", 80),
      publicSummary: cleanText(npc.publicSummary, "", 160),
      currentGoal: cleanText(npc.currentGoal, "", 120),
      influence: clampNumber(npc.influence, 0, 100, 0),
      resentmentRisk: clampNumber(npc.resentmentRisk, 0, 100, 0)
    },
    relationship: relationship
      ? {
        relationship: clampNumber(relationship.relationship, -100, 100, 0),
        trust: clampNumber(relationship.trust, 0, 100, 0),
        resentment: clampNumber(relationship.resentment, 0, 100, 0),
        stance: cleanText(relationship.stance, "", 80),
        recentIntent: cleanText(relationship.recentIntent, "", 120)
      }
      : null,
    activeRequest: activeRequest?.targetId === npcId
      ? {
        id: cleanId(activeRequest.id, ""),
        title: cleanText(activeRequest.title, "", 100),
        ask: cleanText(activeRequest.ask, "", 140),
        turnsRemaining: clampNumber(activeRequest.turnsRemaining, 0, 99, 0)
      }
      : null,
    recentEvents
  };
}

function classifyNpcIntent(context = {}) {
  const resentment = context.relationship?.resentment ?? context.npc?.resentmentRisk ?? 0;
  const relationship = context.relationship?.relationship ?? 0;
  if (context.activeRequest) return "request";
  if (resentment >= 35) return "obstruct";
  if (relationship >= 25 || context.relationship?.trust >= 65) return "assist";
  if ((context.npc?.influence || 0) >= 55) return "warn";
  return "memory";
}

function buildHeuristicProposal(worldState, actorProfile, context, options = {}) {
  const safeActorProfile = isPlainObject(actorProfile) ? actorProfile : {};
  const safeContext = isPlainObject(context) ? context : {};
  const intentType = normalizeProposalType(options.intentType, classifyNpcIntent(safeContext));
  const npcName = cleanText(safeContext.npc?.name || safeActorProfile.displayName, "此人", 80);
  const base = {
    schemaVersion: NPC_MIND_SCHEMA_VERSION,
    proposalId: `npc-mind:${cleanId(safeContext.npc?.id || safeActorProfile.actorId, "npc")}:${currentTurn(worldState)}`,
    actorId: cleanText(safeActorProfile.actorId, "", 96),
    npcId: cleanId(safeContext.npc?.id, ""),
    intentType,
    confidence: 0.62,
    publicSummary: "",
    relationshipDelta: 0,
    resentmentDelta: 0,
    events: [],
    memoryCandidates: [],
    toolCalls: []
  };

  if (intentType === "request") {
    base.publicSummary = `${npcName}仍盼你回应眼前请托。`;
    base.relationshipDelta = 0;
    base.resentmentDelta = 1;
    base.events.push(`[NPC心念] ${npcName}惦记着未了的人情。`);
    base.memoryCandidates.push(`${npcName}记得当前请托尚未收束。`);
  } else if (intentType === "obstruct") {
    base.publicSummary = `${npcName}对你心存芥蒂，暗中观望。`;
    base.relationshipDelta = -1;
    base.resentmentDelta = 2;
    base.events.push(`[NPC心念] ${npcName}因旧怨而多留一分戒心。`);
    base.memoryCandidates.push(`${npcName}对玩家的怨望仍在累积。`);
  } else if (intentType === "assist") {
    base.publicSummary = `${npcName}愿在小事上助你一臂之力。`;
    base.relationshipDelta = 2;
    base.resentmentDelta = -1;
    base.events.push(`[NPC心念] ${npcName}念及旧情，态度稍缓。`);
    base.memoryCandidates.push(`${npcName}把玩家视为可互相照应之人。`);
  } else if (intentType === "warn") {
    base.publicSummary = `${npcName}留意到局势压力，准备递来提醒。`;
    base.relationshipDelta = 1;
    base.resentmentDelta = 0;
    base.events.push(`[NPC心念] ${npcName}留意近日风声，或有提醒。`);
    base.memoryCandidates.push(`${npcName}关注近期局势与玩家处境。`);
  } else {
    base.publicSummary = `${npcName}把近日互动记入心中。`;
    base.relationshipDelta = 0;
    base.resentmentDelta = 0;
    base.events.push(`[NPC心念] ${npcName}默默记下近日往来。`);
    base.memoryCandidates.push(`${npcName}形成一条新的公开印象。`);
  }

  return sanitizeNpcMindProposal(base);
}

async function generateNpcMindProposal(worldState = {}, actorProfile = {}, aiClient = null, options = {}) {
  const context = options.context || buildNpcMindPromptContext(worldState, actorProfile, options);
  const safeActorProfile = isPlainObject(actorProfile) ? actorProfile : {};
  const expectedActorId = cleanText(context?.actor?.actorId || safeActorProfile.actorId, "", 96);
  const expectedNpcId = cleanId(context?.npc?.id, "");
  if (!context) {
    return sanitizeNpcMindProposal({
      actorId: isPlainObject(actorProfile) ? actorProfile.actorId : "",
      intentType: "memory",
      publicSummary: "NPC 心念候选。"
    });
  }
  if (aiClient && typeof aiClient.generateNpcMindProposal === "function" && options.allowAi === true) {
    const proposal = await aiClient.generateNpcMindProposal(context, actorProfile, options);
    return sanitizeNpcMindProposal(proposal, { actorId: expectedActorId, npcId: expectedNpcId });
  }
  return buildHeuristicProposal(worldState, actorProfile, context, options);
}

function sanitizeNpcMindProposal(proposal = {}, constraints = {}) {
  const source = isPlainObject(proposal) ? proposal : {};
  const expectedActorId = cleanText(constraints.actorId, "", 96);
  const expectedNpcId = cleanId(constraints.npcId, "");
  return {
    schemaVersion: NPC_MIND_SCHEMA_VERSION,
    proposalId: cleanId(source.proposalId, `npc-mind:${Date.now()}`),
    actorId: expectedActorId || cleanText(source.actorId, "", 96),
    npcId: expectedNpcId || cleanId(source.npcId, ""),
    intentType: normalizeProposalType(source.intentType, "memory"),
    confidence: Math.max(0, Math.min(1, Number(source.confidence) || 0.5)),
    publicSummary: cleanText(source.publicSummary, "NPC 心念候选。", 160),
    relationshipDelta: clampNumber(source.relationshipDelta, -3, 3, 0),
    resentmentDelta: clampNumber(source.resentmentDelta, -3, 3, 0),
    events: (Array.isArray(source.events) ? source.events : [])
      .map((item) => cleanText(item, "", 140))
      .filter(Boolean)
      .slice(0, NPC_MIND_LIMITS.maxProposalEvents),
    memoryCandidates: (Array.isArray(source.memoryCandidates) ? source.memoryCandidates : [])
      .map((item) => cleanText(item, "", 140))
      .filter(Boolean)
      .slice(0, NPC_MIND_LIMITS.maxMemoryCandidates),
    toolCalls: []
  };
}

function applyNpcMindProposal(worldState = {}, proposal = {}, auditContext = {}) {
  const safeProposal = sanitizeNpcMindProposal(proposal);
  const events = safeProposal.events.length
    ? safeProposal.events
    : [`[NPC心念] ${safeProposal.publicSummary}`];
  const relationshipChanges = safeProposal.npcId
    ? applyRelationshipChanges(worldState, [{
      targetType: "character",
      targetId: safeProposal.npcId,
      relationshipDelta: safeProposal.relationshipDelta,
      resentmentDelta: safeProposal.resentmentDelta,
      stance: safeProposal.intentType,
      recentIntent: safeProposal.publicSummary,
      reason: "NPC mind proposal resolved by server."
    }])
    : [];

  const memoryCandidates = safeProposal.memoryCandidates.map((text, index) => ({
    id: `${safeProposal.proposalId}:memory:${index + 1}`,
    actorId: safeProposal.actorId,
    npcId: safeProposal.npcId,
    visibility: "player_visible",
    confidence: safeProposal.confidence,
    summary: text,
    source: "npc_mind_heuristic",
    turnCount: currentTurn(worldState)
  }));

  if (Array.isArray(auditContext.npcMindRecords)) {
    auditContext.npcMindRecords.push({
      proposalId: safeProposal.proposalId,
      actorId: safeProposal.actorId,
      npcId: safeProposal.npcId,
      status: "applied",
      publicSummary: safeProposal.publicSummary,
      relationshipChangeCount: relationshipChanges.length,
      memoryCandidateCount: memoryCandidates.length
    });
  }

  return {
    proposal: safeProposal,
    events,
    relationshipChanges,
    memoryCandidates
  };
}

function runBackgroundNpcHeuristic(worldState = {}, options = {}) {
  const limit = clampNumber(options.limit, 1, 20, NPC_MIND_LIMITS.maxBackgroundNpcPerTenDay);
  return rankNpcSalience(worldState, { limit })
    .filter((row) => row.salienceScore < 45)
    .map((row) => ({
      npcId: row.npcId,
      publicSummary: `${row.name}维持原有往来，暂不触发大事。`,
      memoryCandidate: `${row.name}延续既有立场。`
    }));
}

function buildNpcMindActorProfile(worldState, npcId, options = {}) {
  return buildNpcAiActorProfile(worldState, npcId, {
    allowUnknown: options.allowUnknown === true
  });
}

module.exports = {
  applyNpcMindProposal,
  buildHeuristicProposal,
  buildNpcMindActorProfile,
  buildNpcMindPromptContext,
  generateNpcMindProposal,
  rankNpcSalience,
  runBackgroundNpcHeuristic,
  sanitizeNpcMindProposal
};
