const { buildMapRuntimeView } = require("./mapRuntimeView");

const MAP_RUNTIME_DRAFT_CONTEXT_SCHEMA_VERSION = "s88.10-map-runtime-draft-context.v1";
const MAX_MAP_CONTEXT_REFS = 10;
const MAX_MAP_CONTEXT_DRAFT_IDS = 4;

const MAP_RUNTIME_DRAFT_REF_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const MAP_RUNTIME_DRAFT_ALLOWED_KINDS = new Set([
  "map_ref_action",
  "map_route_action",
  "map_event_action"
]);
const MAP_RUNTIME_DRAFT_UNSAFE_REF_TOKENS = new Set([
  "layout",
  "layoutpath",
  "mapbounds",
  "viewporthint",
  "position",
  "coordinate",
  "coordinates",
  "coord",
  "coords",
  "x",
  "y"
]);
const MAP_RUNTIME_DRAFT_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|coordinate|coords?|layout|state|row)|\b(?:statePatch|worldState|providerPayload|providerProposal|prompt|rawSql|SQL|sqlite|latitude|longitude|lat|lng)\b|server\.[A-Za-z0-9_.:-]+|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || MAP_RUNTIME_DRAFT_SENSITIVE_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function cleanMapRuntimeDraftRef(value, fallback = "") {
  const text = cleanText(String(value ?? ""), fallback, 160);
  if (!text || !MAP_RUNTIME_DRAFT_REF_PATTERN.test(text)) return fallback;
  const compact = text.toLowerCase().replace(/[-_.:]/g, "");
  if (
    MAP_RUNTIME_DRAFT_UNSAFE_REF_TOKENS.has(compact) ||
    /^(layout|layoutpath|mapbounds|viewporthint|position|coordinate|coordinates|coord|coords)[:_.-]/i.test(text) ||
    /^[xy][:_\-.]?\d/i.test(text)
  ) {
    return fallback;
  }
  return text;
}

function cleanMapRuntimeDraftKind(value) {
  const text = cleanMapRuntimeDraftRef(value, "");
  return MAP_RUNTIME_DRAFT_ALLOWED_KINDS.has(text) ? text : "map_ref_action";
}

function uniqueFilteredRefs(values = [], allowedRefs = new Set(), limit = MAX_MAP_CONTEXT_REFS) {
  const refs = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    const ref = cleanMapRuntimeDraftRef(value, "");
    if (!ref || seen.has(ref) || !allowedRefs.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
    if (refs.length >= limit) break;
  }
  return refs;
}

function sourceRefAllowedForServer(ref = "") {
  return !String(ref || "").startsWith("domainConsequenceView:");
}

function addRef(set, value) {
  const ref = cleanMapRuntimeDraftRef(value, "");
  if (ref) set.add(ref);
}

function collectAllowedMapRuntimeDraftRefs(mapRuntimeView = {}) {
  const targetRefs = new Set();
  const sourceRefs = new Set();
  const actionDraftRefs = new Set();

  for (const ref of asArray(mapRuntimeView.refs)) {
    addRef(targetRefs, ref?.mapEntityRef);
    addRef(sourceRefs, ref?.sourceRef);
    for (const sourceRef of asArray(ref?.sourceRefs)) addRef(sourceRefs, sourceRef);
  }

  for (const route of asArray(mapRuntimeView.routes)) {
    addRef(targetRefs, route?.mapEntityRef);
    addRef(sourceRefs, route?.sourceRef);
    addRef(sourceRefs, route?.fromRef);
    addRef(sourceRefs, route?.toRef);
    for (const sourceRef of asArray(route?.sourceRefs)) addRef(sourceRefs, sourceRef);
    for (const controlRef of asArray(route?.controlRefs)) addRef(sourceRefs, controlRef);
  }

  for (const effect of asArray(mapRuntimeView.eventEffects)) {
    addRef(targetRefs, effect?.targetRef);
    for (const sourceRef of asArray(effect?.sourceRefs)) {
      if (sourceRefAllowedForServer(sourceRef)) addRef(sourceRefs, sourceRef);
    }
  }

  for (const [draftId, draft] of Object.entries(isPlainObject(mapRuntimeView.actionDrafts) ? mapRuntimeView.actionDrafts : {})) {
    addRef(actionDraftRefs, draftId);
    addRef(targetRefs, draft?.targetRef);
    for (const sourceRef of asArray(draft?.sourceRefs)) addRef(sourceRefs, sourceRef);
  }

  return {
    targetRefs,
    sourceRefs,
    evidenceRefs: new Set([...targetRefs, ...sourceRefs]),
    actionDraftRefs
  };
}

function normalizeActionDraftRefs(draftContext = {}, allowedRefs = new Set()) {
  return uniqueFilteredRefs([
    draftContext.draftId,
    draftContext.actionDraftId,
    ...(asArray(draftContext.draftIds)),
    ...(asArray(draftContext.actionDraftRefs))
  ], allowedRefs, MAX_MAP_CONTEXT_DRAFT_IDS);
}

function normalizeMapRuntimeTurnContext(worldState = {}, draftContext = {}, options = {}) {
  if (!isPlainObject(draftContext)) return null;
  const surfaceId = cleanMapRuntimeDraftRef(draftContext.surfaceId || draftContext.surfaceType, "");
  if (surfaceId !== "map-runtime") return null;
  const mapRuntimeView = options.mapRuntimeView || buildMapRuntimeView(worldState);
  const allowed = collectAllowedMapRuntimeDraftRefs(mapRuntimeView);
  const targetRefs = uniqueFilteredRefs(
    [
      ...(asArray(draftContext.targetRefs)),
      draftContext.targetRef
    ],
    allowed.targetRefs,
    4
  );
  const sourceRefs = uniqueFilteredRefs(draftContext.sourceRefs, allowed.sourceRefs, MAX_MAP_CONTEXT_REFS);
  const evidenceRefs = uniqueFilteredRefs(
    [
      ...(asArray(draftContext.evidenceRefs)),
      ...(asArray(draftContext.selectedEvidenceRefs)),
      ...sourceRefs,
      ...targetRefs
    ],
    allowed.evidenceRefs,
    MAX_MAP_CONTEXT_REFS
  );
  const actionDraftRefs = normalizeActionDraftRefs(draftContext, allowed.actionDraftRefs);
  if (!targetRefs.length && !sourceRefs.length && !evidenceRefs.length && !actionDraftRefs.length) return null;
  return {
    schemaVersion: MAP_RUNTIME_DRAFT_CONTEXT_SCHEMA_VERSION,
    source: "map_runtime_turn_context",
    surfaceId: "map-runtime",
    draftKind: cleanMapRuntimeDraftKind(draftContext.draftKind || draftContext.kind),
    sourceView: "mapRuntimeView",
    evidenceRefs,
    sourceRefs,
    targetRefs,
    ...(actionDraftRefs.length ? { actionDraftRefs } : {}),
    requiresServerTurn: draftContext.requiresServerTurn !== false,
    generatedAtTurn: clampInteger(draftContext.generatedAtTurn ?? mapRuntimeView.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    status: "verified"
  };
}

module.exports = {
  MAP_RUNTIME_DRAFT_CONTEXT_SCHEMA_VERSION,
  collectAllowedMapRuntimeDraftRefs,
  normalizeMapRuntimeTurnContext
};
