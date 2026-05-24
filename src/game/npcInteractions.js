const { randomUUID } = require("node:crypto");
const {
  NPC_INTERACTION_CONFIG,
  NPC_INTERACTION_LEDGER_SCHEMA_VERSION,
  NPC_INTERACTION_TYPES
} = require("./npcInteractionsConfig");
const {
  buildNpcDetailView,
  buildNpcPrivateSignalView,
  ensureNpcRoster,
  getNpcForServer
} = require("./npcRoster");

const UNSAFE_TEXT_PATTERN =
  /(hidden[_ -]?(?:notes|intent|dossier)|private[_ -]?signal[_ -]?tags|true[_ -]?assets|secret[_ -]?relationships|unrevealed[_ -]?tasks|provider[_ -]?payload|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|retrieval[_ -]?context|state[_ -]?patch|world[_ -]?state|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|safe_search_fts|ai_change_proposals|event_log|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;
const MAX_RELATIONSHIP_ACTION_EVIDENCE = 8;
const NPC_RELATIONSHIP_ACTION_TOPIC_SURFACES = Object.freeze([
  "npc-profile",
  "court-debate",
  "memorial-review"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = NPC_INTERACTION_CONFIG.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || UNSAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function sanitizePublicViewValue(value, maxLength = NPC_INTERACTION_CONFIG.maxTextLength) {
  if (typeof value === "string") return cleanText(value, "", maxLength);
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePublicViewValue(entry, maxLength))
      .filter((entry) => entry !== "" && entry !== null && entry !== undefined);
  }
  if (!isPlainObject(value)) return value;
  return Object.entries(value).reduce((publicValue, [key, entry]) => {
    if (UNSAFE_TEXT_PATTERN.test(key)) return publicValue;
    publicValue[key] = sanitizePublicViewValue(entry, maxLength);
    return publicValue;
  }, {});
}

function uniqueSafeList(values = [], limit = 8, maxLength = 80) {
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

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function createInitialNpcInteractionLedger(worldState = {}) {
  return {
    schemaVersion: NPC_INTERACTION_LEDGER_SCHEMA_VERSION,
    ownerActorId: cleanId(worldState.player?.id || "player", "player"),
    records: []
  };
}

function ensureNpcInteractionLedger(worldState = {}) {
  if (
    !isPlainObject(worldState.npcInteractionLedger) ||
    worldState.npcInteractionLedger.schemaVersion !== NPC_INTERACTION_LEDGER_SCHEMA_VERSION
  ) {
    worldState.npcInteractionLedger = createInitialNpcInteractionLedger(worldState);
  }
  return worldState.npcInteractionLedger;
}

function normalizeInteractionType(value) {
  const type = cleanText(value, "talk", 40);
  return NPC_INTERACTION_TYPES.includes(type) ? type : "talk";
}

function wasNonEmptyTextDropped(value, sanitized) {
  return typeof value === "string" && value.trim() && !sanitized;
}

function sanitizeNpcDialogueResult(aiResult = {}) {
  const dialogueText = cleanText(aiResult.dialogueText, "", 360);
  const rawMood = cleanText(aiResult.mood, "", 40);
  const mood = rawMood || "平静";
  const followUpSuggestions = Array.isArray(aiResult.followUpSuggestions)
    ? aiResult.followUpSuggestions.map((entry) => cleanText(entry, "", 80)).filter(Boolean).slice(0, 4)
    : [];
  const sourceSuggestions = Array.isArray(aiResult.followUpSuggestions)
    ? aiResult.followUpSuggestions.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const errors = [];

  if (!dialogueText) errors.push("unsafe_or_empty_ai_dialogue_text");
  if (wasNonEmptyTextDropped(aiResult.mood, rawMood)) errors.push("unsafe_ai_dialogue_mood");
  if (sourceSuggestions.length > followUpSuggestions.length) errors.push("unsafe_ai_dialogue_follow_up");

  return {
    ok: errors.length === 0,
    errors,
    dialogueText,
    mood,
    followUpSuggestions
  };
}

function buildNpcDialogueContext(worldState = {}, request = {}) {
  ensureNpcRoster(worldState);
  const npcId = cleanId(request.npcId, "");
  const npcDetailView = buildNpcDetailView(worldState, npcId);
  const privateSignalView = buildNpcPrivateSignalView(worldState, npcId);
  return {
    sessionId: worldState.sessionId,
    turnCount: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    playerRole: cleanText(worldState.player?.role, "scholar", 40),
    playerName: cleanText(worldState.player?.name, "玩家", 40),
    npcId,
    actionType: normalizeInteractionType(request.actionType),
    playerUtterance: cleanText(request.utterance || request.input || request.message, "寒暄问候", 240),
    npcDetailView,
    privateSignalTags: privateSignalView?.privateSignalTags || [],
    serverBoundaries: [
      "AI 只扮演 NPC 并给出建议，关系、资源、物品和任务后果由服务器裁决。",
      "不得输出 hiddenDossier、raw prompt、provider payload、本地路径或密钥。"
    ]
  };
}

function validateNpcInteractionRequest(worldState = {}, request = {}) {
  ensureNpcRoster(worldState);
  const npcId = cleanId(request.npcId, "");
  const actionType = normalizeInteractionType(request.actionType || request.type);
  const npc = getNpcForServer(worldState, npcId);
  const errors = [];
  if (!npc) errors.push("npc_not_found");
  if (npc && !npc.availableInteractions.includes(actionType)) errors.push("interaction_not_available");
  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      npcId,
      actionType,
      utterance: cleanText(request.utterance || request.input || request.message, "", 240),
      itemId: cleanId(request.itemId, ""),
      offerSummary: cleanText(request.offerSummary, "", 160)
    }
  };
}

function recordNpcInteraction(worldState = {}, request = {}, aiResult = {}, options = {}) {
  const validation = validateNpcInteractionRequest(worldState, request);
  const ledger = ensureNpcInteractionLedger(worldState);
  let aiSafety = validation.ok
    ? sanitizeNpcDialogueResult(aiResult)
    : { ok: true, errors: [], dialogueText: "", mood: "", followUpSuggestions: [] };
  if (options.resolutionView && !aiSafety.ok && !aiSafety.dialogueText) {
    aiSafety = {
      ok: true,
      errors: ["unsafe_ai_dialogue_replaced_by_server_resolution"],
      dialogueText: cleanText(options.resolutionView.publicNarrative || options.resolutionView.outcomeSummary, "服务器已裁决此项交游。", 260),
      mood: "已裁",
      followUpSuggestions: []
    };
  }
  const npc = validation.normalized.npcId
    ? getNpcForServer(worldState, validation.normalized.npcId)
    : null;
  const serverReasons = [...validation.errors, ...aiSafety.errors];
  const accepted = validation.ok && aiSafety.ok;
  const record = {
    recordId: `npc-interaction:${randomUUID()}`,
    turn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    npcId: validation.normalized.npcId,
    npcName: cleanText(npc?.displayName, "未知人物", 80),
    actionType: validation.normalized.actionType,
    playerUtterance: validation.normalized.utterance,
    serverStatus: accepted ? "recorded" : "rejected",
    serverReasons,
    dialogueText: accepted ? aiSafety.dialogueText : "",
    mood: accepted ? aiSafety.mood : "",
    followUpSuggestions: accepted ? aiSafety.followUpSuggestions : [],
    actionKind: options.resolutionView?.actionType || validation.normalized.actionType,
    outcomeSummary: cleanText(options.resolutionView?.outcomeSummary, "", 220),
    serverAdjudication: options.resolutionView
      ? {
        status: cleanText(options.resolutionView.serverStatus, accepted ? "recorded" : "rejected", 56),
        actionLabel: cleanText(options.resolutionView.actionLabel, "", 40),
        serverOwnsOutcome: true
      }
      : null,
    riskTags: Array.isArray(options.resolutionView?.riskTags)
      ? options.resolutionView.riskTags.map((entry) => cleanText(entry, "", 40)).filter(Boolean).slice(0, 6)
      : [],
    resolverTrace: isPlainObject(options.resolutionView?.resolverTrace)
      ? sanitizePublicViewValue(options.resolutionView.resolverTrace)
      : null,
    eligibilityView: options.resolutionView?.eligibilityView || null,
    relationshipImpactView: options.resolutionView?.relationshipImpactView || null,
    resourceImpactView: options.resolutionView?.resourceImpactView || null,
    worldPeopleImpactView: options.resolutionView?.worldPeopleImpactView || null,
    ignoredClientResultFields: Array.isArray(options.resolutionView?.ignoredClientResultFields)
      ? options.resolutionView.ignoredClientResultFields.map((entry) => cleanText(entry, "", 60)).filter(Boolean).slice(0, 8)
      : [],
    auditRefs: Array.isArray(options.auditRefs) ? options.auditRefs.map((entry) => cleanText(entry, "", 96)).filter(Boolean) : []
  };
  ledger.records.push(record);
  ledger.records = ledger.records.slice(-NPC_INTERACTION_CONFIG.maxInteractionRecords);
  return {
    ok: accepted,
    errors: serverReasons,
    record,
    npcInteractionView: buildNpcInteractionLedgerView(worldState)
  };
}

function relationshipActionEvidenceSummary(record = {}, trace = {}, npcName = "此人", actionLabel = "交游") {
  const outcome = cleanText(record.outcomeSummary, "", 180);
  if (outcome) return outcome;
  const dialogue = cleanText(record.dialogueText, "", 180);
  if (dialogue) return dialogue;
  if (trace.status === "server_blocked") {
    return `${npcName}${actionLabel}已由服务器挡下，只留下公开复核记录。`;
  }
  return `${npcName}${actionLabel}已由服务器裁决，后续只作公开交游材料引用。`;
}

function buildNpcRelationshipActionEvidenceRowsFromRecords(records = [], worldState = {}) {
  const rows = [];
  for (const record of Array.isArray(records) ? records : []) {
    if (!isPlainObject(record)) continue;
    const trace = isPlainObject(record.resolverTrace) ? record.resolverTrace : {};
    if (trace.resolver !== "npc_relationship_action_resolver") continue;
    if (!["server_adjudicated", "server_blocked"].includes(trace.status)) continue;
    if (trace.boundaries?.serverOwnsOutcome !== true) continue;

    const sourceId = cleanId(trace.publicResolutionRef || record.recordId, "");
    if (!sourceId) continue;
    const npcId = cleanId(record.npcId, "");
    const npcName = cleanText(record.npcName, "此人", 60);
    const actionLabel = cleanText(
      trace.actionLabel || record.serverAdjudication?.actionLabel || record.actionKind || record.actionType,
      "交游",
      40
    );
    const title = cleanText(`交游记录：${npcName}${actionLabel}`, "交游记录", 90);
    const publicSummary = relationshipActionEvidenceSummary(record, trace, npcName, actionLabel);
    if (!title || !publicSummary) continue;

    rows.push({
      evidenceId: cleanId(`npc-relationship-action-evidence:${sourceId}`, sourceId),
      id: cleanId(`npc-relationship-action-evidence:${sourceId}`, sourceId),
      sourceId,
      sourceType: "npc_relationship_action",
      sourceLabel: "交游记录",
      title,
      publicSummary,
      summary: publicSummary,
      npc: {
        npcId,
        displayName: npcName
      },
      actionType: cleanText(trace.actionType || record.actionKind || record.actionType, "", 48),
      actionLabel,
      status: cleanText(trace.status, "server_adjudicated", 48),
      statusLabel: trace.status === "server_blocked" ? "服务器挡下" : "服务器裁决",
      disposition: cleanText(trace.disposition, "relationship_action_recorded", 80),
      riskTags: uniqueSafeList([
        ...(Array.isArray(record.riskTags) ? record.riskTags : []),
        ...(Array.isArray(trace.riskTags) ? trace.riskTags : [])
      ], 6, 40),
      visibility: "player_visible",
      confidence: trace.status === "server_blocked" ? 0.62 : 0.7,
      topicSurfaceIds: NPC_RELATIONSHIP_ACTION_TOPIC_SURFACES,
      relatedRefs: uniqueSafeList([
        npcId ? `npcRosterView:${npcId}` : "",
        `npcInteractionView:${cleanId(record.recordId, sourceId)}`,
        `npcRelationshipActionResolverTrace:${sourceId}`
      ], 6, 120),
      scopeRefs: uniqueSafeList([
        npcId ? `npc:${npcId}` : "",
        sourceId ? `npcRelationshipAction:${sourceId}` : ""
      ], 6, 120),
      generatedAtTurn: clampNumber(record.turn, 0, Number.MAX_SAFE_INTEGER, clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)),
      lastUpdatedTurn: clampNumber(record.turn, 0, Number.MAX_SAFE_INTEGER, clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)),
      boundary: "交游记录只作只读证据；资源、关系终局、婚姻谱系、伤损、弹劾、定罪、背叛和 NPC 行动仍由服务器裁决。"
    });
    if (rows.length >= MAX_RELATIONSHIP_ACTION_EVIDENCE) break;
  }
  return rows;
}

function buildNpcInteractionLedgerView(worldState = {}, options = {}) {
  const ledger = ensureNpcInteractionLedger(worldState);
  const npcId = cleanId(options.npcId, "");
  const records = ledger.records
    .filter((record) => !npcId || record.npcId === npcId)
    .slice(-NPC_INTERACTION_CONFIG.maxInteractionViewItems)
    .reverse()
    .map((record) => ({
      recordId: record.recordId,
      turn: record.turn,
      date: {
        year: record.year,
        month: record.month,
        tenDayPeriod: record.tenDayPeriod
      },
      npcId: cleanId(record.npcId, ""),
      npcName: cleanText(record.npcName, "未知人物", 80),
      actionType: normalizeInteractionType(record.actionType),
      serverStatus: cleanText(record.serverStatus, "recorded", 56),
      serverReasons: uniqueSafeList(record.serverReasons, 8, 80),
      dialogueText: cleanText(record.dialogueText, "", 360),
      mood: cleanText(record.mood, "", 40),
      followUpSuggestions: uniqueSafeList(record.followUpSuggestions, 4, 80),
      actionKind: cleanText(record.actionKind, normalizeInteractionType(record.actionType), 48),
      outcomeSummary: cleanText(record.outcomeSummary, "", 220),
      serverAdjudication: sanitizePublicViewValue(record.serverAdjudication),
      riskTags: uniqueSafeList(record.riskTags, 6, 40),
      resolverTrace: sanitizePublicViewValue(record.resolverTrace),
      eligibilityView: sanitizePublicViewValue(record.eligibilityView),
      relationshipImpactView: sanitizePublicViewValue(record.relationshipImpactView),
      resourceImpactView: sanitizePublicViewValue(record.resourceImpactView),
      worldPeopleImpactView: sanitizePublicViewValue(record.worldPeopleImpactView),
      ignoredClientResultFields: uniqueSafeList(record.ignoredClientResultFields, 8, 60)
    }));
  return {
    schemaVersion: NPC_INTERACTION_LEDGER_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: records.length,
    items: records,
    relationshipActionEvidence: buildNpcRelationshipActionEvidenceRowsFromRecords(records, worldState),
    safeguards: {
      hiddenDossierRedacted: true,
      rawAiPayloadRedacted: true,
      serverOwnsConsequences: true
    }
  };
}

module.exports = {
  buildNpcDialogueContext,
  buildNpcInteractionLedgerView,
  buildNpcRelationshipActionEvidenceRowsFromRecords,
  createInitialNpcInteractionLedger,
  ensureNpcInteractionLedger,
  recordNpcInteraction,
  sanitizeNpcDialogueResult,
  validateNpcInteractionRequest
};
