const { redactSecrets } = require("../ai/diagnostics");
const { buildAiInvocationSummaryView, resolveAiSettingsForSession } = require("./aiSettings");
const { buildAiControlAuditDiagnostics } = require("./aiControlAudit");
const {
  buildResolverInputContext,
  summarizeResolverInputForAudit
} = require("./resolverInputContext");
const { buildSafeSearchRows } = require("./safeWorldSearch");
const { buildSessionMetadata } = require("../storage/sessionRecord");

const REDACTED_STATE_SCHEMA_VERSION = "s71.redactedState.v1";
const REDACTED_STATE_SOURCE = "server_player_visible_state_projection";
const DEVELOPER_DIAGNOSTICS_SCHEMA_VERSION = "s71.developerDiagnostics.v1";
const DEVELOPER_DIAGNOSTICS_SOURCE = "server_hidden_safe_developer_diagnostics";

const PLAYER_STATE_TOP_LEVEL_KEYS = Object.freeze([
  "sessionId",
  "year",
  "month",
  "tenDayPeriod",
  "dynasty",
  "turnCount",
  "treasury",
  "grainReserve",
  "population",
  "publicOrder",
  "taxRate",
  "corruption",
  "armySize",
  "armyMorale",
  "borderThreat",
  "factions",
  "eventHistory",
  "activeExam"
]);

const PLAYER_STATE_PLAYER_KEYS = Object.freeze([
  "role",
  "roleLabel",
  "name",
  "portraitRef",
  "health",
  "gold",
  "examRank",
  "palaceRank",
  "officeTitle",
  "academia",
  "literaryTalent",
  "adaptability",
  "mentality",
  "reputation",
  "examHistory",
  "teacher",
  "position",
  "faction",
  "influence",
  "integrity",
  "nativePlace",
  "hometown",
  "countyName",
  "localTreasury",
  "localOrder",
  "gentryRelations",
  "banditPressure",
  "pendingLawsuits",
  "corveeBurden",
  "waterworks",
  "personalPower",
  "courtControl",
  "mandate",
  "command",
  "troops",
  "supply",
  "battleReputation",
  "scouting",
  "campaignRisk",
  "bureauId",
  "currentPostingId",
  "superiorFavor",
  "peerNetwork",
  "performanceMerit",
  "promotionProspect",
  "impeachmentRisk",
  "cleanReputation"
]);

const PLAYER_STATE_MAX_ARRAY_ITEMS = 40;
const PLAYER_STATE_MAX_OBJECT_KEYS = 80;
const PLAYER_STATE_MAX_TEXT_LENGTH = 240;
const DIAGNOSTIC_MAX_ARRAY_ITEMS = 60;
const DIAGNOSTIC_MAX_OBJECT_KEYS = 120;
const DIAGNOSTIC_MAX_TEXT_LENGTH = 240;
const PLAYER_ROUTE_VIEW_MAX_ARRAY_ITEMS = 80;
const PLAYER_ROUTE_VIEW_MAX_OBJECT_KEYS = 160;
const PLAYER_ROUTE_VIEW_MAX_TEXT_LENGTH = 240;

const SENSITIVE_REDACTION_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|\b(?:relationshipLedger|actorMemoryLedger|sessionSummary|retrievalContext|sealedMapping|sealed_mapping)\b|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row)|\b(?:statePatch|rawSql)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "hidden",
  "hiddenNotes",
  "hiddenIntent",
  "private",
  "privateNotes",
  "raw",
  "rawAudit",
  "rawLedger",
  "rawProvider",
  "rawProviderPayload",
  "rawPrompt",
  "rawSql",
  "statePatch",
  "worldState",
  "relationshipLedger",
  "actorMemoryLedger",
  "sessionSummary",
  "retrievalContext",
  "providerPayload",
  "providerProposal",
  "prompt",
  "apiKey",
  "key",
  "secret",
  "token",
  "password"
]);
const FORBIDDEN_PUBLIC_KEYS_LOWER = new Set(
  Array.from(FORBIDDEN_PUBLIC_KEYS, (key) => key.toLowerCase())
);

const SENSITIVE_KEY_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|\b(?:relationshipLedger|actorMemoryLedger|sessionSummary|retrievalContext|sealedMapping|sealed_mapping)\b|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|row)|\b(?:statePatch|rawSql)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people|office)_[A-Za-z0-9_]+)/i;
const PORTRAIT_REF_PATTERN = /^portrait-[a-z0-9][a-z0-9_-]{0,140}$/i;
const UNSAFE_PORTRAIT_REF_PATTERN = /(?:^|[-_])(raw|provider|prompt|hidden|private|key|path|secret|token|api|file|data|http)(?:$|[-_])/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function isForbiddenKey(key) {
  const text = String(key || "");
  return FORBIDDEN_PUBLIC_KEYS_LOWER.has(text.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(text);
}

function sanitizeText(value, fallback = "", maxLength = PLAYER_STATE_MAX_TEXT_LENGTH) {
  const text = redactSecrets(String(value ?? ""))
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/\btp-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/\bfile:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+/gi, "[redacted-path]")
    .replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[redacted-path]")
    .replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+/g, "[redacted-path]")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  if (SENSITIVE_REDACTION_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function sanitizeKeyName(value, fallback = "", maxLength = 80) {
  const text = String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
  if (!text || isForbiddenKey(text)) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function sanitizeVisiblePortraitRef(value) {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !PORTRAIT_REF_PATTERN.test(text) || UNSAFE_PORTRAIT_REF_PATTERN.test(text)) return null;
  return text;
}

function sanitizeVisibleValue(value, options = {}, path = "value") {
  const maxTextLength = options.maxTextLength || PLAYER_STATE_MAX_TEXT_LENGTH;
  const maxArrayItems = options.maxArrayItems || PLAYER_STATE_MAX_ARRAY_ITEMS;
  const maxObjectKeys = options.maxObjectKeys || PLAYER_STATE_MAX_OBJECT_KEYS;

  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return sanitizeText(value, "", maxTextLength);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((entry, index) => sanitizeVisibleValue(entry, options, `${path}[${index}]`))
      .filter((entry) => entry !== "" && entry !== undefined);
  }
  if (!isPlainObject(value)) return null;

  const output = {};
  for (const [key, entry] of Object.entries(value).slice(0, maxObjectKeys)) {
    if (isForbiddenKey(key)) continue;
    const cleanKey = sanitizeKeyName(key, "", 80);
    if (!cleanKey) continue;
    const cleanValue = sanitizeVisibleValue(entry, options, `${path}.${cleanKey}`);
    if (cleanValue === "" || cleanValue === undefined) continue;
    output[cleanKey] = cleanValue;
  }
  return output;
}

function pickSanitizedObject(source = {}, keys = [], options = {}) {
  const output = {};
  for (const key of keys) {
    if (source[key] === undefined || isForbiddenKey(key)) continue;
    if (key === "portraitRef") {
      output[key] = sanitizeVisiblePortraitRef(source[key]);
      continue;
    }
    const cleanValue = sanitizeVisibleValue(source[key], options, key);
    if (cleanValue === "" || cleanValue === undefined) continue;
    output[key] = cleanValue;
  }
  return output;
}

function buildPlayerVisibleState(worldState = {}, options = {}) {
  const state = pickSanitizedObject(worldState, PLAYER_STATE_TOP_LEVEL_KEYS, options);
  state.player = pickSanitizedObject(worldState.player || {}, PLAYER_STATE_PLAYER_KEYS, options);
  return state;
}

function normalizeRecord(recordOrWorldState = {}) {
  if (recordOrWorldState?.worldState && isPlainObject(recordOrWorldState.worldState)) {
    return recordOrWorldState;
  }
  const worldState = recordOrWorldState || {};
  return {
    storageSchemaVersion: null,
    sessionId: worldState.sessionId,
    createdAt: null,
    updatedAt: null,
    revision: null,
    metadata: buildSessionMetadata(worldState),
    worldState
  };
}

function buildPlayerStateEnvelope(recordOrWorldState = {}, options = {}) {
  const record = normalizeRecord(recordOrWorldState);
  const worldState = record.worldState || {};
  const metadata = sanitizeVisibleValue(record.metadata || buildSessionMetadata(worldState), {
    maxArrayItems: 20,
    maxObjectKeys: 40,
    maxTextLength: 120
  });

  return {
    schemaVersion: REDACTED_STATE_SCHEMA_VERSION,
    source: REDACTED_STATE_SOURCE,
    sessionId: sanitizeText(record.sessionId || worldState.sessionId, "", 80),
    storageSchemaVersion: record.storageSchemaVersion ?? null,
    revision: record.revision ?? null,
    createdAt: sanitizeText(record.createdAt, null, 40),
    updatedAt: sanitizeText(record.updatedAt, null, 40),
    metadata,
    worldState: buildPlayerVisibleState(worldState, options),
    redaction: {
      playerVisibleOnly: true,
      rawStateIncluded: false,
      omittedSections: [
        "characters",
        "关系原账",
        "记忆原账",
        "经历摘要原账",
        "资产与资源原账",
        "背包原账",
        "NPC 名册原账",
        "NPC 交互原账",
        "交易与委派原账",
        "开局背景宣称原账",
        "地理原账",
        "人物原账",
        "任所原账",
        "实体原账",
        "议题原账"
      ]
    }
  };
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function countObjectKeys(value) {
  return isPlainObject(value) ? Object.keys(value).length : 0;
}

function buildResolverSummary(worldState = {}) {
  try {
    return summarizeResolverInputForAudit(buildResolverInputContext(worldState, {
      eventArchivePageSize: 20,
      includeSessionId: false
    }));
  } catch (error) {
    return {
      unavailable: true,
      error: sanitizeText(error.message || "resolver input unavailable", "resolver input unavailable", 160)
    };
  }
}

function buildDeveloperDiagnostics(recordOrWorldState = {}, options = {}) {
  const record = normalizeRecord(recordOrWorldState);
  const worldState = record.worldState || {};
  const routePolicy = resolveAiSettingsForSession(worldState).routePolicy;
  const aiInvocationSummaryView = buildAiInvocationSummaryView(worldState, routePolicy);
  const aiControlAudit = buildAiControlAuditDiagnostics(worldState, {
    routePolicy,
    aiInvocationSummaryView
  });
  const safeSearchRows = buildSafeSearchRows(worldState);
  const adapter = options.storageAdapter || {};

  const diagnostics = {
    schemaVersion: DEVELOPER_DIAGNOSTICS_SCHEMA_VERSION,
    source: DEVELOPER_DIAGNOSTICS_SOURCE,
    generatedAt: new Date().toISOString(),
    sessionId: sanitizeText(record.sessionId || worldState.sessionId, "", 80),
    storage: {
      adapter: sanitizeText(adapter.name || "json", "json", 32),
      storageSchemaVersion: record.storageSchemaVersion ?? null,
      revision: record.revision ?? null,
      createdAt: sanitizeText(record.createdAt, null, 40),
      updatedAt: sanitizeText(record.updatedAt, null, 40),
      features: {
        sqlite: adapter.name === "sqlite",
        safeSearch: typeof adapter.searchSafeSearchIndex === "function",
        auditRead: typeof adapter.listAuditEvents === "function" && typeof adapter.listAiProposals === "function"
      }
    },
    metadata: sanitizeVisibleValue(record.metadata || buildSessionMetadata(worldState), {
      maxArrayItems: 20,
      maxObjectKeys: 40,
      maxTextLength: 120
    }),
    counts: {
      stateTopLevelKeys: countObjectKeys(worldState),
      eventHistory: countArray(worldState.eventHistory),
      characters: countArray(worldState.characters),
      relationshipRecords: countObjectKeys(worldState.relationshipLedger),
      longTermEvents: countArray(worldState.longTermEvents),
      activeExam: Boolean(worldState.activeExam),
      aiRecentInvocations: countArray(worldState.aiSettings?.observability?.recentInvocations),
      safeSearchRows: safeSearchRows.length
    },
    resolverInputSummary: buildResolverSummary(worldState),
    ai: {
      routeCostSummary: aiInvocationSummaryView.routeCostSummary,
      toolCallSummary: aiInvocationSummaryView.toolCallSummary,
      recentInvocations: aiInvocationSummaryView.recentInvocations,
      controlAudit: aiControlAudit
    },
    safety: {
      localOnly: true,
      stateSnapshotIncluded: false,
      auditRowsIncluded: false,
      modelPayloadIncluded: false,
      promptIncluded: false,
      localPathsIncluded: false,
      secretValuesIncluded: false
    }
  };

  return redactDiagnosticValue(diagnostics);
}

function redactDiagnosticValue(value, path = "diagnostic") {
  return sanitizeVisibleValue(value, {
    maxArrayItems: DIAGNOSTIC_MAX_ARRAY_ITEMS,
    maxObjectKeys: DIAGNOSTIC_MAX_OBJECT_KEYS,
    maxTextLength: DIAGNOSTIC_MAX_TEXT_LENGTH
  }, path);
}

function redactPlayerRouteViews(value) {
  const clean = sanitizeVisibleValue(value, {
    maxArrayItems: PLAYER_ROUTE_VIEW_MAX_ARRAY_ITEMS,
    maxObjectKeys: PLAYER_ROUTE_VIEW_MAX_OBJECT_KEYS,
    maxTextLength: PLAYER_ROUTE_VIEW_MAX_TEXT_LENGTH
  }, "routeViews");

  if (Array.isArray(clean?.relationshipView?.contacts)) {
    clean.relationshipView.contacts = clean.relationshipView.contacts.filter((entry) => entry?.name);
  }

  return clean;
}

function assertRedactedStateSafe(value) {
  const serialized = JSON.stringify(value);
  if (SENSITIVE_REDACTION_PATTERN.test(serialized)) {
    throw new Error("redacted state contains forbidden source text");
  }
  return true;
}

module.exports = {
  DEVELOPER_DIAGNOSTICS_SCHEMA_VERSION,
  DEVELOPER_DIAGNOSTICS_SOURCE,
  REDACTED_STATE_SCHEMA_VERSION,
  REDACTED_STATE_SOURCE,
  assertRedactedStateSafe,
  buildDeveloperDiagnostics,
  buildPlayerStateEnvelope,
  buildPlayerVisibleState,
  redactDiagnosticValue,
  redactPlayerRouteViews
};
