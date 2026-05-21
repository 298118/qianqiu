const {
  NPC_RELATIONSHIP_ACTION_CONFIG,
  NPC_RELATIONSHIP_ACTION_LIMITS,
  NPC_RELATIONSHIP_ACTION_SCHEMA_VERSION,
  NPC_RELATIONSHIP_ACTION_TYPES
} = require("./npcRelationshipActionsConfig");
const {
  buildNpcDetailView,
  ensureNpcRoster,
  getNpcForServer
} = require("./npcRoster");

const UNSAFE_TEXT_PATTERN =
  /(hidden[_ -]?(?:notes|intent|dossier)|private[_ -]?signal[_ -]?tags|true[_ -]?assets|secret[_ -]?relationships|unrevealed[_ -]?tasks|provider[_ -]?payload|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|\b(?:provider|prompt|proposal)\b|retrieval[_ -]?context|state[_ -]?patch|world[_ -]?state|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|safe_search_fts|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;
const NPC_RELATIONSHIP_RESOLVER_TRACE_VERSION = "s88.7-npc-relationship-resolver-trace.v1";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = NPC_RELATIONSHIP_ACTION_LIMITS.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || UNSAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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

function uniqueCleanList(values = [], limit = 8, maxLength = 80) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeActionType(value, fallback = "") {
  const actionType = cleanText(value, fallback, 48);
  return NPC_RELATIONSHIP_ACTION_TYPES.includes(actionType) ? actionType : fallback;
}

function publicSocialProfile(npc = {}) {
  const source = isPlainObject(npc.socialProfile) ? npc.socialProfile : {};
  return {
    adult: source.adult !== false,
    marriageStatus: cleanText(source.marriageStatus, "unknown", 40),
    kinshipBlocked: source.kinshipBlocked === true,
    ritualStatus: cleanText(source.ritualStatus, "unreviewed", 40),
    publicNote: cleanText(source.publicNote, "礼法、身份和亲族意见须由服务器审查。", 120)
  };
}

function relationshipSnapshot(npc = {}) {
  const relation = isPlainObject(npc.relationship) ? npc.relationship : {};
  return {
    closeness: clampNumber(relation.closeness, -100, 100, 0),
    trust: clampNumber(relation.trust, 0, 100, 0),
    hostility: clampNumber(relation.hostility, 0, 100, 0),
    favorsOwed: clampNumber(relation.favorsOwed, -20, 20, 0),
    labels: uniqueCleanList(relation.labels, 6, 40)
  };
}

function blockersForAction(worldState = {}, npc = {}, actionType = "") {
  const config = NPC_RELATIONSHIP_ACTION_CONFIG[actionType];
  if (!config) return ["action_not_supported"];
  const blockers = [];
  const available = Array.isArray(npc.availableInteractions) ? npc.availableInteractions : [];
  const relation = relationshipSnapshot(npc);
  const social = publicSocialProfile(npc);

  if (!available.includes(actionType)) blockers.push("npc_action_not_available");
  if (relation.closeness < config.minimumCloseness) blockers.push("relationship_closeness_too_low");
  if (relation.trust < config.minimumTrust) blockers.push("relationship_trust_too_low");
  if (actionType === "duel" && worldState.player?.role === "emperor") blockers.push("role_cannot_duel_directly");
  if ((actionType === "courtship" || actionType === "marriage") && !social.adult) blockers.push("adult_status_required");
  if ((actionType === "courtship" || actionType === "marriage") && social.kinshipBlocked) blockers.push("kinship_blocks_action");
  if (actionType === "marriage" && !["unmarried", "unknown"].includes(social.marriageStatus)) blockers.push("marriage_status_unavailable");
  return blockers.slice(0, NPC_RELATIONSHIP_ACTION_LIMITS.maxBlockers);
}

function buildNpcRelationshipActionEligibilityView(worldState = {}, npcId, options = {}) {
  ensureNpcRoster(worldState);
  const id = cleanId(npcId, "");
  const npc = getNpcForServer(worldState, id);
  if (!npc) return null;
  const actions = NPC_RELATIONSHIP_ACTION_TYPES.map((actionType) => {
    const config = NPC_RELATIONSHIP_ACTION_CONFIG[actionType];
    const blockers = blockersForAction(worldState, npc, actionType);
    return {
      actionType,
      label: config.label,
      requestLabel: config.requestLabel,
      available: blockers.length === 0,
      blockers,
      riskTags: uniqueCleanList(config.riskTags, NPC_RELATIONSHIP_ACTION_LIMITS.maxRiskTags, 40),
      serverBoundary: "前端只能提交意图；胜负、伤损、求爱结果、婚姻谱系、资源和关系落账均由服务器裁决。"
    };
  });
  return {
    schemaVersion: NPC_RELATIONSHIP_ACTION_SCHEMA_VERSION,
    npcId: npc.npcId,
    socialProfile: publicSocialProfile(npc),
    relationshipSnapshot: relationshipSnapshot(npc),
    actions,
    safeguards: {
      serverOwnsOutcome: true,
      browserCannotSetSpouseIds: true,
      browserCannotSetWinnerOrInjury: true,
      resourceAndRelationshipDeltasIgnoredFromClient: true,
      privateNpcDossierRedacted: true
    }
  };
}

function actionEligibilityFor(worldState = {}, npcId, actionType) {
  const view = buildNpcRelationshipActionEligibilityView(worldState, npcId);
  const action = view?.actions.find((item) => item.actionType === actionType) || null;
  return { view, action };
}

function applySafeRelationshipImpact(npc = {}, config = {}) {
  if (!npc || !isPlainObject(npc.relationship)) return null;
  const before = relationshipSnapshot(npc);
  npc.relationship.closeness = clampNumber(before.closeness + config.relationshipDelta, -100, 100, before.closeness);
  npc.relationship.trust = clampNumber(before.trust + config.trustDelta, 0, 100, before.trust);
  npc.relationship.hostility = clampNumber(before.hostility + config.hostilityDelta, 0, 100, before.hostility);
  const after = relationshipSnapshot(npc);
  return {
    npcId: npc.npcId,
    npcName: npc.displayName,
    closenessDelta: after.closeness - before.closeness,
    trustDelta: after.trust - before.trust,
    hostilityDelta: after.hostility - before.hostility,
    favorsOwedDelta: 0,
    appliedBy: "server"
  };
}

function relationshipDisposition(actionType = "", accepted = false) {
  if (!accepted) return "blocked_by_server_eligibility";
  if (actionType === "debate") return "public_debate_recorded";
  if (actionType === "duel") return "duel_review_recorded";
  if (actionType === "courtship") return "courtship_intent_review";
  if (actionType === "marriage") return "marriage_ritual_review";
  return "relationship_action_recorded";
}

function buildNpcRelationshipResolverTrace({
  worldState = {},
  npc = {},
  actionType = "",
  config = {},
  accepted = false,
  errors = [],
  ignoredClientResultFields = []
}) {
  const npcId = cleanId(npc.npcId, "");
  const turn = clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
  return {
    schemaVersion: NPC_RELATIONSHIP_RESOLVER_TRACE_VERSION,
    resolver: "npc_relationship_action_resolver",
    publicResolutionRef: cleanId(`npc-relationship-resolution:${npcId || "npc"}:${actionType || "action"}:${turn}`, ""),
    actionType,
    actionLabel: cleanText(config.label, "交游", 40),
    status: accepted ? "server_adjudicated" : "server_blocked",
    disposition: relationshipDisposition(actionType, accepted),
    blockerCount: Array.isArray(errors) ? errors.length : 0,
    ignoredClientResultFields: uniqueCleanList(ignoredClientResultFields, 8, 60),
    publicSourceRefs: uniqueCleanList([
      npcId ? `npcRosterView:${npcId}` : "",
      npcId && actionType ? `npcRelationshipActionEligibilityView:${npcId}:${actionType}` : ""
    ], 4, 120),
    riskTags: uniqueCleanList(config.riskTags, NPC_RELATIONSHIP_ACTION_LIMITS.maxRiskTags, 40),
    boundaries: {
      serverOwnsOutcome: true,
      browserCannotSetSpouseIds: true,
      browserCannotSetWinnerOrInjury: true,
      resourceAndRelationshipDeltasIgnoredFromClient: true,
      privateNpcDossierRedacted: true
    }
  };
}

function resolveNpcRelationshipAction(worldState = {}, request = {}, aiResult = {}) {
  ensureNpcRoster(worldState);
  const actionType = normalizeActionType(request.actionType || request.type, "");
  const npcId = cleanId(request.npcId, "");
  const config = NPC_RELATIONSHIP_ACTION_CONFIG[actionType];
  const npc = getNpcForServer(worldState, npcId);
  const errors = [];
  if (!config) errors.push("relationship_action_not_supported");
  if (!npc) errors.push("npc_not_found");
  const eligibility = npc ? actionEligibilityFor(worldState, npc.npcId, actionType) : { view: null, action: null };
  if (eligibility.action && !eligibility.action.available) errors.push(...eligibility.action.blockers);

  const accepted = errors.length === 0;
  const relationshipImpactView = accepted ? applySafeRelationshipImpact(npc, config) : null;
  const dialogueText = cleanText(aiResult.dialogueText, "", 260);
  const outcomeSummary = accepted
    ? config.outcomeSummary
    : "服务器挡下此项交游动作；前端提交的胜负、婚姻、资源或关系结果均未采纳。";
  const ignoredClientResultFields = uniqueCleanList(
    Object.keys(isPlainObject(request) ? request : {})
      .filter((key) => /winner|injury|spouse|relationshipDelta|resourceDelta|acceptedMarriage|statePatch/i.test(key)),
    8,
    60
  );
  const resolverTrace = buildNpcRelationshipResolverTrace({
    worldState,
    npc: npc || { npcId },
    actionType,
    config: config || {},
    accepted,
    errors,
    ignoredClientResultFields
  });
  const result = {
    ok: accepted,
    errors,
    resolutionView: {
      schemaVersion: NPC_RELATIONSHIP_ACTION_SCHEMA_VERSION,
      actionType,
      actionLabel: config?.label || "交游",
      serverStatus: accepted ? "server_adjudicated" : "server_blocked",
      outcomeSummary,
      publicNarrative: dialogueText || outcomeSummary,
      resolverTrace,
      riskTags: uniqueCleanList(config?.riskTags, NPC_RELATIONSHIP_ACTION_LIMITS.maxRiskTags, 40),
      eligibilityView: eligibility.view,
      relationshipImpactView: relationshipImpactView || {
        npcId,
        appliedBy: "server",
        note: accepted ? "无可见关系项可调整。" : "动作被服务器挡下。"
      },
      resourceImpactView: {
        applied: false,
        reason: "论道、切磋、求爱和婚姻扩展位不会让前端或 AI 直接扣银、转物或写资源账本。"
      },
      worldPeopleImpactView: {
        applied: false,
        spouseIdsWritten: false,
        reason: actionType === "marriage"
          ? "本阶段只登记议婚审查，不写 worldPeople.npcs[].family.spouseIds。"
          : "本动作不写人物谱系。"
      },
      ignoredClientResultFields
    }
  };
  return result;
}

function attachRelationshipActionEligibilityToDetail(worldState = {}, detailView = null) {
  if (!detailView?.npcId) return detailView;
  return {
    ...detailView,
    relationshipActionEligibilityView: buildNpcRelationshipActionEligibilityView(worldState, detailView.npcId)
  };
}

module.exports = {
  attachRelationshipActionEligibilityToDetail,
  buildNpcRelationshipActionEligibilityView,
  resolveNpcRelationshipAction,
  NPC_RELATIONSHIP_ACTION_TYPES
};
