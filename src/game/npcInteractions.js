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
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

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
  const aiSafety = validation.ok
    ? sanitizeNpcDialogueResult(aiResult)
    : { ok: true, errors: [], dialogueText: "", mood: "", followUpSuggestions: [] };
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
      npcId: record.npcId,
      npcName: record.npcName,
      actionType: record.actionType,
      serverStatus: record.serverStatus,
      serverReasons: record.serverReasons,
      dialogueText: record.dialogueText,
      mood: record.mood,
      followUpSuggestions: record.followUpSuggestions
    }));
  return {
    schemaVersion: NPC_INTERACTION_LEDGER_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: records.length,
    items: records,
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
  createInitialNpcInteractionLedger,
  ensureNpcInteractionLedger,
  recordNpcInteraction,
  sanitizeNpcDialogueResult,
  validateNpcInteractionRequest
};
