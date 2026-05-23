const { buildMapContextView } = require("./mapContext");
const { buildDomainConsequenceView } = require("./domainConsequenceTrace");
const { buildNpcActiveRequestView } = require("./npcActiveRequests");
const { buildNpcInteractionLedgerView } = require("./npcInteractions");
const { buildWorldPeopleView } = require("./worldPeople");
const {
  MAP_RUNTIME_ACTION_DRAFT_TEMPLATES,
  MAP_RUNTIME_ASSET_SET_ID,
  MAP_RUNTIME_BOUNDS,
  MAP_RUNTIME_EVENT_EFFECTS,
  MAP_RUNTIME_HIDDEN_NOTICE,
  MAP_RUNTIME_LABEL_ANCHORS,
  MAP_RUNTIME_LAYERS,
  MAP_RUNTIME_LAYER_IDS,
  MAP_RUNTIME_LAYOUT_VERSION,
  MAP_RUNTIME_LIMITS,
  MAP_RUNTIME_NPC_ACTIVITY_ANCHORS,
  MAP_RUNTIME_ROUTE_STYLE_TOKENS,
  MAP_RUNTIME_SCHEMA_VERSION,
  MAP_RUNTIME_STYLE_TOKENS
} = require("./mapRuntimeConfig");
const {
  MAP_VISUAL_LAYOUT_BY_REF,
  MAP_VISUAL_ROUTE_BY_REF
} = require("./mapVisualLayoutSeed");

const MAP_REF_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const SAFE_SOURCE_REF_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const SENSITIVE_MAP_RUNTIME_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent|dossier)|hidden\s+(?:notes?|intent|dossier)|hiddenDossier|privateSignalTags|trueAssets|secretRelationships|npcActiveRequestLedger|npcInteractionLedger|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw(?:[_ -]?|(?=[A-Z]))(?:provider|audit|table|ledger|prompt|proposal|coordinate|coords?|layout|state)|coordinate[_ -]?table|coordinateTable|latitude|longitude|\b(?:statePatch|worldState|providerPayload|providerProposal|prompt|rawSql|SQL|sqlite|lat|lng)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const DOMAIN_CONSEQUENCE_TARGET_TYPES = Object.freeze({
  city_policy: Object.freeze(["economic_report", "jurisdiction", "posting", "city", "region"]),
  military_diplomacy: Object.freeze(["military_report", "frontier_zone", "city", "region", "country"]),
  judicial_case: Object.freeze(["docket", "jurisdiction", "posting", "city", "region"]),
  npc_economy: Object.freeze(["economic_report", "city", "posting", "region"])
});

const NPC_ACTIVITY_VISIBLE_STATUSES = new Set([
  "active",
  "deferred",
  "under_review",
  "reported",
  "converted_to_risk",
  "accepted_pending_server_resolution",
  "server_follow_up_recorded"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampInteger(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function clampUnit(value, fallback = 0.5) {
  return Number(clampNumber(value, 0, 1, fallback).toFixed(4));
}

function sanitizeFallbackText(fallback = "", maxLength = MAP_RUNTIME_LIMITS.maxSummaryLength) {
  const trimmed = String(fallback ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed || SENSITIVE_MAP_RUNTIME_TEXT_PATTERN.test(trimmed)) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function sanitizeMapRuntimeText(value, fallback = "", maxLength = MAP_RUNTIME_LIMITS.maxSummaryLength) {
  const safeFallback = sanitizeFallbackText(fallback, maxLength);
  if (typeof value !== "string") return safeFallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || SENSITIVE_MAP_RUNTIME_TEXT_PATTERN.test(trimmed)) return safeFallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function cleanId(value, fallback = "") {
  const text = sanitizeMapRuntimeText(String(value ?? ""), fallback, 120);
  const normalized = text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function cleanMapRefId(value, fallback = "") {
  const text = sanitizeMapRuntimeText(String(value ?? ""), fallback, 180);
  if (!text || !MAP_REF_ID_PATTERN.test(text)) return fallback;
  return text;
}

function cleanSourceRef(value, fallback = "") {
  const text = sanitizeMapRuntimeText(String(value ?? ""), fallback, 180);
  if (!text || !SAFE_SOURCE_REF_PATTERN.test(text)) return fallback;
  return text;
}

function unique(values = [], limit = 12) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = cleanMapRefId(value, "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function currentTurn(worldState = {}) {
  return clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function hashText(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cloneLayout(layout = {}) {
  return {
    x: layout.x,
    y: layout.y,
    layer: layout.layer,
    importance: layout.importance,
    labelAnchor: layout.labelAnchor,
    styleToken: layout.styleToken
  };
}

function layerForEntityType(entityType = "") {
  if (["docket", "military_report", "economic_report", "transfer"].includes(entityType)) return "events";
  return "places";
}

function deterministicFallbackLayout(ref = {}, baseLayout = null) {
  const hash = hashText(ref.refId || ref.mapEntityRef || ref.entityId || ref.label || "map-ref");
  const anchor = MAP_RUNTIME_LABEL_ANCHORS[hash % MAP_RUNTIME_LABEL_ANCHORS.length];
  const layer = layerForEntityType(ref.entityType);

  if (baseLayout) {
    const angle = ((hash % 360) * Math.PI) / 180;
    const radius = 0.018 + ((hash >>> 4) % 5) * 0.006;
    return {
      x: clampUnit((baseLayout.x || 0.5) + Math.cos(angle) * radius),
      y: clampUnit((baseLayout.y || 0.5) + Math.sin(angle) * radius),
      layer,
      importance: clampUnit((baseLayout.importance || 0.5) * 0.82, 0.4),
      labelAnchor: anchor
    };
  }

  const column = hash % 8;
  const row = (hash >>> 3) % 5;
  return {
    x: clampUnit(0.18 + column * 0.09),
    y: clampUnit(0.20 + row * 0.13),
    layer,
    importance: 0.35,
    labelAnchor: anchor
  };
}

function sanitizeMapLayout(layout, fallback = null) {
  const source = isPlainObject(layout) ? layout : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : null;
  const fallbackX = Number.isFinite(Number(fallbackSource?.x)) ? Number(fallbackSource.x) : null;
  const fallbackY = Number.isFinite(Number(fallbackSource?.y)) ? Number(fallbackSource.y) : null;
  const x = Number.isFinite(Number(source.x)) ? Number(source.x) : fallbackX;
  const y = Number.isFinite(Number(source.y)) ? Number(source.y) : fallbackY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const layer = MAP_RUNTIME_LAYER_IDS.includes(source.layer)
    ? source.layer
    : MAP_RUNTIME_LAYER_IDS.includes(fallbackSource?.layer)
      ? fallbackSource.layer
      : "places";
  const labelAnchor = MAP_RUNTIME_LABEL_ANCHORS.includes(source.labelAnchor)
    ? source.labelAnchor
    : MAP_RUNTIME_LABEL_ANCHORS.includes(fallbackSource?.labelAnchor)
      ? fallbackSource.labelAnchor
      : "top";

  return {
    x: clampUnit(x),
    y: clampUnit(y),
    layer,
    importance: clampUnit(source.importance, clampUnit(fallbackSource?.importance, 0.45)),
    labelAnchor
  };
}

function seedLayoutForRefId(refId) {
  const layout = MAP_VISUAL_LAYOUT_BY_REF[refId];
  return layout ? cloneLayout(layout) : null;
}

function createContextRefIndex(mapContextView = {}) {
  const index = new Map();
  for (const ref of asArray(mapContextView.mapEntityRefs)) {
    const refId = cleanMapRefId(ref?.refId, "");
    if (!refId) continue;
    index.set(refId, ref);
  }
  return index;
}

function findRelatedLayout(ref = {}, layoutByRef = new Map()) {
  const related = [
    ...asArray(ref.relatedRefs),
    ...asArray(ref.parentRefs)
  ];
  for (const refId of related) {
    const layout = layoutByRef.get(refId) || seedLayoutForRefId(refId);
    if (layout) return sanitizeMapLayout(layout);
  }
  return null;
}

function buildLayoutForContextRef(ref = {}, layoutByRef = new Map()) {
  const refId = cleanMapRefId(ref.refId, "");
  const direct = seedLayoutForRefId(refId);
  if (direct) return sanitizeMapLayout(direct);

  const related = findRelatedLayout(ref, layoutByRef);
  return sanitizeMapLayout(deterministicFallbackLayout(ref, related));
}

function pressureRatio(ref = {}) {
  const pressure = clampNumber(ref.pressure, 0, 100, 0);
  return Number((pressure / 100).toFixed(2));
}

function stylePressure(ref = {}) {
  const ratio = pressureRatio(ref);
  if (ratio >= 0.75) return "urgent";
  if (ratio >= 0.55) return "strained";
  if (ratio >= 0.3) return "watch";
  return "calm";
}

function stylePulse(ref = {}) {
  const ratio = pressureRatio(ref);
  if (ratio >= 0.75) return "strong";
  if (ratio >= 0.55) return "soft";
  return "none";
}

function styleTokenForRef(ref = {}, layout = {}) {
  const layoutToken = sanitizeMapRuntimeText(layout.styleToken, "", 40);
  if (layoutToken) return layoutToken;
  return MAP_RUNTIME_STYLE_TOKENS[ref.entityType] || "edict";
}

function affordancesForRef(ref = {}) {
  const affordances = ["inspect"];
  if (["city", "posting", "exam_travel"].includes(ref.entityType)) {
    affordances.push("draft_travel_action");
  } else if (["docket", "military_report", "economic_report"].includes(ref.entityType)) {
    affordances.push("draft_inspect_action");
  }
  return affordances;
}

function runtimeRefPriority(ref = {}) {
  const base = clampNumber(ref.priority, 0, 300, 0);
  const typeBoost = {
    exam_travel: 150,
    city: 130,
    frontier_zone: 110,
    posting: 95,
    jurisdiction: 80,
    country: 70,
    region: 64,
    military_report: 50,
    economic_report: 45,
    transfer: 35,
    docket: 24
  }[ref.entityType] || 30;
  const visibilityBoost = ref.visibility === "player_visible" ? 60 : ref.visibility === "public" ? 12 : 0;
  return base + typeBoost + visibilityBoost;
}

function compareRuntimeRefs(first = {}, second = {}) {
  const diff = runtimeRefPriority(second) - runtimeRefPriority(first);
  if (diff !== 0) return diff;
  return String(first.refId || "").localeCompare(String(second.refId || ""));
}

function draftIdForTarget(prefix, targetRef) {
  const refTail = cleanId(String(targetRef || "").split(":").pop(), "target");
  return cleanId(`draft-${prefix}-${refTail}`, `draft-${prefix}`);
}

function mergeMapRefsWithLayout(mapContextView = {}, options = {}) {
  const refs = [];
  const seen = new Set();
  const layoutByRef = new Map();
  for (const [refId, layout] of Object.entries(MAP_VISUAL_LAYOUT_BY_REF)) {
    const cleanRefId = cleanMapRefId(refId, "");
    const safeLayout = sanitizeMapLayout(layout);
    if (cleanRefId && safeLayout) layoutByRef.set(cleanRefId, safeLayout);
  }

  const sourceRefs = asArray(mapContextView.mapEntityRefs)
    .filter((ref) => ref?.entityType !== "route")
    .sort(compareRuntimeRefs);

  for (const source of sourceRefs) {
    const mapEntityRef = cleanMapRefId(source?.refId, "");
    if (!mapEntityRef || seen.has(mapEntityRef)) continue;
    const layoutSeed = buildLayoutForContextRef(source, layoutByRef);
    const layout = sanitizeMapLayout(layoutSeed);
    if (!layout) continue;
    const label = sanitizeMapRuntimeText(source.label, source.entityId || "地图节点", MAP_RUNTIME_LIMITS.maxLabelLength);
    if (!label) continue;
    const entityType = sanitizeMapRuntimeText(source.entityType, "city", 40);
    const affordances = affordancesForRef(source);
    const actionDraftRefs = affordances
      .filter((item) => item.startsWith("draft_"))
      .map((item) => draftIdForTarget(item === "draft_inspect_action" ? "inspect" : "travel", mapEntityRef));

    refs.push({
      mapEntityRef,
      entityType,
      label,
      summary: sanitizeMapRuntimeText(source.summary, source.statusLabel || source.riskLabel || "可见地图节点。", MAP_RUNTIME_LIMITS.maxSummaryLength),
      visibility: sanitizeMapRuntimeText(source.visibility, "public", 32),
      layout,
      style: {
        token: styleTokenForRef(source, layoutSeed || {}),
        pressure: stylePressure(source),
        pulse: stylePulse(source)
      },
      affordances,
      actionDraftRefs,
      sourceView: "mapContextView",
      sourceRef: mapEntityRef
    });
    seen.add(mapEntityRef);
    layoutByRef.set(mapEntityRef, layout);
    if (refs.length >= (options.maxRefs || MAP_RUNTIME_LIMITS.maxRefs)) break;
  }

  return refs;
}

function pointFromLayout(layout = {}) {
  const safe = sanitizeMapLayout(layout);
  return safe ? [safe.x, safe.y] : null;
}

function sanitizeLayoutPath(path = []) {
  return asArray(path)
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [clampUnit(x), clampUnit(y)];
    })
    .filter(Boolean);
}

function deriveRouteSeedFromRelatedRefs(routeRef = {}, runtimeRefById = new Map()) {
  const relatedRefs = unique(asArray(routeRef.relatedRefs), 6).filter((refId) => runtimeRefById.has(refId));
  if (relatedRefs.length < 2) return null;
  const layoutPath = relatedRefs
    .map((refId) => pointFromLayout(runtimeRefById.get(refId)?.layout))
    .filter(Boolean);
  if (layoutPath.length < 2) return null;
  return {
    type: "road",
    fromRef: relatedRefs[0],
    toRef: relatedRefs[relatedRefs.length - 1],
    controlRefs: relatedRefs.slice(1, -1),
    layoutPath
  };
}

function routeActivity(routeRef = {}, routeSeed = {}) {
  const label = `${routeRef.label || ""} ${routeRef.summary || ""}`;
  if (routeSeed.type === "canal" || /漕|粮|河|运/.test(label)) return "trade";
  if (routeSeed.type === "sea" || /海|贡舶|海道/.test(label)) return "tribute";
  if (routeSeed.type === "pass" || /边|军|关/.test(label)) return "frontier";
  if (/科|贡院|赶考/.test(label)) return "exam";
  return "travel";
}

function buildMapRoutes(mapContextView = {}, runtimeRefs = [], options = {}) {
  const runtimeRefById = new Map(runtimeRefs.map((ref) => [ref.mapEntityRef, ref]));
  const routes = [];

  for (const routeRef of asArray(mapContextView.mapEntityRefs).filter((ref) => ref?.entityType === "route")) {
    const mapEntityRef = cleanMapRefId(routeRef.refId, "");
    if (!mapEntityRef) continue;
    const seed = MAP_VISUAL_ROUTE_BY_REF[mapEntityRef] || deriveRouteSeedFromRelatedRefs(routeRef, runtimeRefById);
    if (!seed) continue;
    const fromRef = runtimeRefById.has(seed.fromRef) ? seed.fromRef : "";
    const toRef = runtimeRefById.has(seed.toRef) ? seed.toRef : "";
    if (!fromRef || !toRef) continue;
    const controlRefs = unique(seed.controlRefs || [], 8).filter((refId) => runtimeRefById.has(refId));
    const layoutPath = sanitizeLayoutPath(seed.layoutPath);
    if (layoutPath.length < 2) continue;
    const label = sanitizeMapRuntimeText(routeRef.label, routeRef.entityId || "通路", MAP_RUNTIME_LIMITS.maxLabelLength);
    if (!label) continue;
    const routeType = sanitizeMapRuntimeText(seed.type, "road", 32);
    const actionDraftRefs = [draftIdForTarget("route", mapEntityRef)];

    routes.push({
      mapEntityRef,
      label,
      fromRef,
      toRef,
      controlRefs,
      layoutPath,
      style: {
        token: MAP_RUNTIME_ROUTE_STYLE_TOKENS[routeType] || MAP_RUNTIME_ROUTE_STYLE_TOKENS.road,
        activity: routeActivity(routeRef, seed)
      },
      affordances: ["inspect", "draft_route_action"],
      actionDraftRefs,
      sourceView: "mapContextView",
      sourceRef: mapEntityRef
    });
    if (routes.length >= (options.maxRoutes || MAP_RUNTIME_LIMITS.maxRoutes)) break;
  }

  return routes;
}

function draftTextForRef(ref = {}) {
  const label = sanitizeMapRuntimeText(ref.label, "此处", MAP_RUNTIME_LIMITS.maxLabelLength);
  const template = MAP_RUNTIME_ACTION_DRAFT_TEMPLATES[ref.entityType] || MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.default_travel;
  return sanitizeMapRuntimeText(
    template.actionText.replace("{label}", label),
    "",
    MAP_RUNTIME_LIMITS.maxActionTextLength
  );
}

function draftTextForRoute(route = {}) {
  const label = sanitizeMapRuntimeText(route.label, "此路", MAP_RUNTIME_LIMITS.maxLabelLength);
  return sanitizeMapRuntimeText(
    MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.route.actionText.replace("{label}", label),
    "",
    MAP_RUNTIME_LIMITS.maxActionTextLength
  );
}

function draftLabelForRef(ref = {}) {
  const label = sanitizeMapRuntimeText(ref.label, "此处", MAP_RUNTIME_LIMITS.maxLabelLength);
  const template = MAP_RUNTIME_ACTION_DRAFT_TEMPLATES[ref.entityType] || MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.default_travel;
  return sanitizeMapRuntimeText(`${template.labelPrefix}${label}`, "", MAP_RUNTIME_LIMITS.maxLabelLength);
}

function draftIntentForRef(ref = {}) {
  const template = MAP_RUNTIME_ACTION_DRAFT_TEMPLATES[ref.entityType] || MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.default_travel;
  return cleanId(template.domainIntentHint, "map_travel");
}

function sourceRefsForRefDraft(ref = {}) {
  return unique([
    ref.sourceRef,
    ...(Array.isArray(ref.sourceRefs) ? ref.sourceRefs : []),
    ref.mapEntityRef
  ], MAP_RUNTIME_LIMITS.maxSourceRefs);
}

function sourceRefsForRouteDraft(route = {}) {
  return unique([
    route.sourceRef,
    route.fromRef,
    route.toRef,
    ...(Array.isArray(route.controlRefs) ? route.controlRefs : []),
    route.mapEntityRef
  ], MAP_RUNTIME_LIMITS.maxSourceRefs);
}

function addActionDraft(target, draft) {
  if (!draft?.id || target[draft.id]) return;
  const actionText = sanitizeMapRuntimeText(draft.actionText, "", MAP_RUNTIME_LIMITS.maxActionTextLength);
  const label = sanitizeMapRuntimeText(draft.label, "", MAP_RUNTIME_LIMITS.maxLabelLength);
  const targetRef = cleanMapRefId(draft.targetRef, "");
  const sourceRefs = unique(draft.sourceRefs || [], MAP_RUNTIME_LIMITS.maxSourceRefs);
  const domainIntentHint = cleanId(draft.domainIntentHint, "");
  if (!actionText || !label || !targetRef) return;
  target[draft.id] = {
    id: draft.id,
    targetRef,
    label,
    actionText,
    ...(sourceRefs.length ? { sourceRefs } : {}),
    ...(domainIntentHint ? { domainIntentHint } : {}),
    requiresServerTurn: true
  };
}

function buildMapActionDrafts({ refs = [], routes = [] } = {}, options = {}) {
  const drafts = {};
  const maxDrafts = options.maxActionDrafts || MAP_RUNTIME_LIMITS.maxActionDrafts;
  for (const ref of refs) {
    if (!asArray(ref.affordances).some((item) => item.startsWith("draft_"))) continue;
    const id = asArray(ref.actionDraftRefs)[0] || draftIdForTarget("travel", ref.mapEntityRef);
    addActionDraft(drafts, {
      id,
      targetRef: ref.mapEntityRef,
      label: draftLabelForRef(ref),
      actionText: draftTextForRef(ref),
      sourceRefs: sourceRefsForRefDraft(ref),
      domainIntentHint: draftIntentForRef(ref)
    });
    if (Object.keys(drafts).length >= maxDrafts) return drafts;
  }

  for (const route of routes) {
    const id = asArray(route.actionDraftRefs)[0] || draftIdForTarget("route", route.mapEntityRef);
    addActionDraft(drafts, {
      id,
      targetRef: route.mapEntityRef,
      label: `${MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.route.labelPrefix}${route.label}`,
      actionText: draftTextForRoute(route),
      sourceRefs: sourceRefsForRouteDraft(route),
      domainIntentHint: MAP_RUNTIME_ACTION_DRAFT_TEMPLATES.route.domainIntentHint
    });
    if (Object.keys(drafts).length >= maxDrafts) return drafts;
  }

  return drafts;
}

function filterDraftRefs(entries = [], actionDrafts = {}) {
  const draftIds = new Set(Object.keys(actionDrafts));
  return entries.map((entry) => ({
    ...entry,
    actionDraftRefs: asArray(entry.actionDraftRefs).filter((id) => draftIds.has(id))
  }));
}

function sourceRefsForHook(hook = {}) {
  const source = cleanSourceRef(`${hook.sourceView || "mapContextView"}:${hook.sourceId || hook.hookId || "hook"}`, "");
  const refs = source ? [source] : [];
  return refs.slice(0, MAP_RUNTIME_LIMITS.maxSourceRefs);
}

function effectConfigForHook(hook = {}) {
  return MAP_RUNTIME_EVENT_EFFECTS[hook.sourceType] || MAP_RUNTIME_EVENT_EFFECTS.local_docket;
}

function eventSeverity(hook = {}, targetRef = null, config = {}) {
  const pressure = targetRef ? pressureRatio(targetRef) : 0;
  return Number(Math.max(config.severityFloor || 0.3, pressure).toFixed(2));
}

function buildMapEventEffects(mapContextView = {}, runtimeRefs = [], runtimeRoutes = [], options = {}) {
  const targetByRef = new Map([
    ...runtimeRefs.map((ref) => [ref.mapEntityRef, ref]),
    ...runtimeRoutes.map((route) => [route.mapEntityRef, route])
  ]);
  const effects = [];
  for (const hook of asArray(mapContextView.mapEventHooks)) {
    const targetRefId = asArray(hook.mapEntityRefs)
      .map((ref) => cleanMapRefId(ref?.refId, ""))
      .find((refId) => refId && targetByRef.has(refId));
    if (!targetRefId) continue;
    const config = effectConfigForHook(hook);
    const sourceRefs = sourceRefsForHook(hook);
    if (!sourceRefs.length) continue;
    const label = sanitizeMapRuntimeText(hook.riskLabel || hook.title || config.label, config.label, 32);
    const id = cleanId(`event-${hook.sourceType || "hook"}-${hook.sourceId || hook.hookId || effects.length + 1}`, `event-effect-${effects.length + 1}`);

    effects.push({
      id,
      targetRef: targetRefId,
      kind: config.kind,
      severity: eventSeverity(hook, targetByRef.get(targetRefId), config),
      label,
      animationToken: config.animationToken,
      sourceRefs
    });
    if (effects.length >= (options.maxEventEffects || MAP_RUNTIME_LIMITS.maxEventEffects)) break;
  }
  return effects;
}

function targetTypesForDomainConsequence(sourceType = "") {
  return DOMAIN_CONSEQUENCE_TARGET_TYPES[sourceType] || [];
}

function compareDomainConsequenceTargets(preferredTypes = []) {
  return (first = {}, second = {}) => {
    const firstIndex = preferredTypes.indexOf(first.entityType);
    const secondIndex = preferredTypes.indexOf(second.entityType);
    if (firstIndex !== secondIndex) return firstIndex - secondIndex;
    const firstImportance = clampNumber(first.layout?.importance, 0, 1, 0);
    const secondImportance = clampNumber(second.layout?.importance, 0, 1, 0);
    if (secondImportance !== firstImportance) return secondImportance - firstImportance;
    return String(first.mapEntityRef || "").localeCompare(String(second.mapEntityRef || ""));
  };
}

function chooseDomainConsequenceTarget(consequence = {}, runtimeRefs = []) {
  const preferredTypes = targetTypesForDomainConsequence(consequence.sourceType);
  if (!preferredTypes.length) return null;
  return runtimeRefs
    .filter((ref) => preferredTypes.includes(ref.entityType))
    .sort(compareDomainConsequenceTargets(preferredTypes))[0] || null;
}

function domainConsequenceEffectConfig(consequence = {}) {
  return MAP_RUNTIME_EVENT_EFFECTS[`domain_${consequence.sourceType}`] || MAP_RUNTIME_EVENT_EFFECTS.local_docket;
}

function domainConsequenceSeverity(consequence = {}, config = {}) {
  const severityRatio = clampNumber(consequence.severity, 0, 3, 1) / 3;
  return Number(Math.max(config.severityFloor || 0.35, severityRatio).toFixed(2));
}

function buildDomainConsequenceEventEffects(domainConsequenceView = {}, runtimeRefs = [], options = {}) {
  const effects = [];
  for (const consequence of asArray(domainConsequenceView.recentConsequences).slice().reverse()) {
    if (!isPlainObject(consequence)) continue;
    const target = chooseDomainConsequenceTarget(consequence, runtimeRefs);
    const targetRef = cleanMapRefId(target?.mapEntityRef, "");
    if (!targetRef) continue;
    const sourceId = cleanSourceRef(consequence.id || consequence.sourceId || consequence.sourceType, "");
    const sourceRef = sourceId ? cleanSourceRef(`domainConsequenceView:${sourceId}`, "") : "";
    if (!sourceRef) continue;
    const config = domainConsequenceEffectConfig(consequence);
    const id = cleanId(`event-domain-consequence-${sourceId}`, `event-domain-consequence-${effects.length + 1}`);
    const label = sanitizeMapRuntimeText(
      consequence.kindLabel || consequence.sourceLabel || config.label,
      config.label,
      32
    );
    if (!label) continue;
    effects.push({
      id,
      targetRef,
      kind: config.kind,
      severity: domainConsequenceSeverity(consequence, config),
      label,
      animationToken: config.animationToken,
      sourceRefs: [sourceRef]
    });
    if (effects.length >= (options.maxDomainConsequenceEventEffects || 4)) break;
  }
  return effects;
}

function worldPeopleViewForMapRuntime(worldState = {}, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "worldPeopleView")) {
    return isPlainObject(options.worldPeopleView) ? options.worldPeopleView : null;
  }
  return buildWorldPeopleView(worldState);
}

function npcActiveRequestViewForMapRuntime(worldState = {}, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "npcActiveRequestView")) {
    return isPlainObject(options.npcActiveRequestView) ? options.npcActiveRequestView : null;
  }
  if (!isPlainObject(worldState.npcActiveRequestLedger)) return null;
  return buildNpcActiveRequestView(worldState, { includeResolved: true });
}

function npcInteractionViewForMapRuntime(worldState = {}, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "npcInteractionView")) {
    return isPlainObject(options.npcInteractionView) ? options.npcInteractionView : null;
  }
  if (!isPlainObject(worldState.npcInteractionLedger)) return null;
  return buildNpcInteractionLedgerView(worldState);
}

function buildVisibleNpcLocationIndex(worldPeopleView = {}) {
  const index = new Map();
  for (const npc of asArray(worldPeopleView.npcs)) {
    if (!isPlainObject(npc)) continue;
    const visibility = sanitizeMapRuntimeText(npc.visibility, "", 32);
    if (visibility === "hidden" || (npc.knownToPlayer === false && !["public", "rumor"].includes(visibility))) continue;
    const npcId = cleanId(npc.id || npc.npcId, "");
    if (!npcId) continue;
    index.set(npcId, {
      npcId,
      currentPostingId: cleanId(npc.currentPostingId, ""),
      currentCityId: cleanId(npc.currentCityId, ""),
      homeCityId: cleanId(npc.homeCityId, "")
    });
  }
  return index;
}

function npcLocationTargetCandidates(npcLocation = {}) {
  return unique([
    npcLocation.currentPostingId ? `map:office:posting:${npcLocation.currentPostingId}` : "",
    npcLocation.currentCityId ? `map:geography:city:${npcLocation.currentCityId}` : "",
    npcLocation.homeCityId ? `map:geography:city:${npcLocation.homeCityId}` : ""
  ], 4);
}

function chooseNpcActivityTarget(npcId = "", npcLocationById = new Map(), runtimeRefs = []) {
  const npcLocation = npcLocationById.get(cleanId(npcId, ""));
  if (!npcLocation) return null;
  const runtimeRefById = new Map(runtimeRefs.map((ref) => [ref.mapEntityRef, ref]));
  return npcLocationTargetCandidates(npcLocation)
    .map((candidate) => runtimeRefById.get(candidate))
    .find(Boolean) || null;
}

function npcActivitySeverity(source = {}, config = {}) {
  const tags = asArray(source.riskTags).join(" ");
  const status = sanitizeMapRuntimeText(source.status, "", 64);
  const serverStatus = sanitizeMapRuntimeText(source.serverStatus, "", 64);
  const urgency = sanitizeMapRuntimeText(source.urgency, "", 32);
  let severity = config.severityFloor || 0.34;
  if (urgency === "high" || /risk|watchlist|censorate|integrity|betrayal|impeach|弹劾|背叛|廉政|风险/.test(tags)) {
    severity = Math.max(severity, 0.62);
  } else if (status === "server_blocked" || serverStatus === "rejected") {
    severity = Math.max(severity, 0.5);
  } else if (status === "under_review" || status === "converted_to_risk") {
    severity = Math.max(severity, 0.52);
  } else if (status === "deferred" || status === "reported") {
    severity = Math.max(severity, 0.44);
  }
  return Number(clampNumber(severity, 0, 1, 0.34).toFixed(2));
}

function buildNpcActivityAnchor({
  source = {},
  sourceId = "",
  sourceRefs = [],
  config = MAP_RUNTIME_NPC_ACTIVITY_ANCHORS.active_request,
  target = null,
  fallbackSummary = "人物动向只作舆图观察线索；资源、关系、婚姻、弹劾、背叛事实和后续任务仍由服务器裁决。"
} = {}) {
  const safeSourceId = cleanSourceRef(sourceId, "");
  const targetRef = cleanMapRefId(target?.mapEntityRef, "");
  if (!safeSourceId || !targetRef) return null;
  const npcName = sanitizeMapRuntimeText(source.npc?.displayName || source.npc?.name, "可见人物", 40);
  const label = sanitizeMapRuntimeText(`${config.label}：${npcName}`, config.label, 36);
  const summary = sanitizeMapRuntimeText(
    source.publicSummary || source.summary || source.intentSummary || source.outcomeSummary || source.dialogueText || source.ask || source.stakes || fallbackSummary,
    fallbackSummary,
    MAP_RUNTIME_LIMITS.maxSummaryLength
  );
  if (!label || !summary) return null;
  const safeSourceRefs = unique(sourceRefs, MAP_RUNTIME_LIMITS.maxSourceRefs);
  if (!safeSourceRefs.length) return null;
  return {
    id: cleanId(`npc-activity-${config.kind}-${safeSourceId}`, `npc-activity-${safeSourceId}`),
    targetRef,
    kind: config.kind,
    label,
    summary,
    severity: npcActivitySeverity(source, config),
    animationToken: config.animationToken,
    sourceRefs: safeSourceRefs,
    visualOnly: true,
    serverAdjudication: "只读舆图视觉锚点；NPC 行动、关系、资源、任务和隐藏事实仍由服务器回合裁决。"
  };
}

function buildNpcActiveRequestAnchors(npcActiveRequestView = {}, npcLocationById = new Map(), runtimeRefs = [], options = {}) {
  const anchors = [];
  const seen = new Set();
  const maxAnchors = options.maxNpcActivityAnchors || MAP_RUNTIME_LIMITS.maxNpcActivityAnchors;
  const config = MAP_RUNTIME_NPC_ACTIVITY_ANCHORS.active_request;
  for (const item of asArray(npcActiveRequestView.items)) {
    if (!isPlainObject(item) || !NPC_ACTIVITY_VISIBLE_STATUSES.has(item.status)) continue;
    const requestId = cleanSourceRef(item.requestId, "");
    const npcId = cleanId(item.npc?.npcId, "");
    if (!requestId || !npcId || seen.has(`request:${requestId}`)) continue;
    const target = chooseNpcActivityTarget(npcId, npcLocationById, runtimeRefs);
    if (!target) continue;
    const anchor = buildNpcActivityAnchor({
      source: item,
      sourceId: requestId,
      sourceRefs: [`npcActiveRequestView:${requestId}`],
      config,
      target
    });
    if (!anchor) continue;
    anchors.push(anchor);
    seen.add(`request:${requestId}`);
    if (anchors.length >= maxAnchors) break;
  }
  return anchors;
}

function buildNpcFollowUpEvidenceAnchors(npcActiveRequestView = {}, npcLocationById = new Map(), runtimeRefs = [], options = {}) {
  const anchors = [];
  const seen = new Set();
  const maxAnchors = options.maxNpcActivityAnchors || MAP_RUNTIME_LIMITS.maxNpcActivityAnchors;
  const config = MAP_RUNTIME_NPC_ACTIVITY_ANCHORS.follow_up_evidence;
  const evidenceView = isPlainObject(npcActiveRequestView.followUpEvidence) ? npcActiveRequestView.followUpEvidence : {};
  for (const item of asArray(evidenceView.items)) {
    if (!isPlainObject(item)) continue;
    const evidenceId = cleanSourceRef(item.evidenceId || item.sourceId, "");
    const requestId = cleanSourceRef(item.requestId, "");
    const npcId = cleanId(item.npc?.npcId, "");
    if (!evidenceId || !npcId || seen.has(`follow-up:${evidenceId}`)) continue;
    const target = chooseNpcActivityTarget(npcId, npcLocationById, runtimeRefs);
    if (!target) continue;
    const anchor = buildNpcActivityAnchor({
      source: item,
      sourceId: evidenceId,
      sourceRefs: [
        `npcActiveRequestFollowUpEvidence:${evidenceId}`,
        requestId ? `npcActiveRequestView:${requestId}` : ""
      ],
      config,
      target
    });
    if (!anchor) continue;
    anchors.push(anchor);
    seen.add(`follow-up:${evidenceId}`);
    if (anchors.length >= maxAnchors) break;
  }
  return anchors;
}

function relationshipActionAnchorSource(record = {}) {
  const trace = isPlainObject(record.resolverTrace) ? record.resolverTrace : {};
  const actionLabel = sanitizeMapRuntimeText(
    trace.actionLabel || record.serverAdjudication?.actionLabel || record.actionKind || record.actionType,
    "交游",
    40
  );
  return {
    npc: {
      npcId: cleanId(record.npcId, ""),
      displayName: sanitizeMapRuntimeText(record.npcName, "可见人物", 40)
    },
    publicSummary: sanitizeMapRuntimeText(
      record.outcomeSummary || record.dialogueText,
      `${sanitizeMapRuntimeText(record.npcName, "可见人物", 40)}的${actionLabel}已由服务器裁决；关系、婚姻、资源与后续任务仍候服务器回合裁决。`,
      MAP_RUNTIME_LIMITS.maxSummaryLength
    ),
    status: sanitizeMapRuntimeText(trace.status, record.serverStatus, 64),
    serverStatus: sanitizeMapRuntimeText(record.serverStatus, "", 64),
    riskTags: [
      ...asArray(record.riskTags),
      ...asArray(trace.riskTags),
      sanitizeMapRuntimeText(trace.disposition, "", 40)
    ].filter(Boolean)
  };
}

function buildNpcRelationshipActionAnchors(npcInteractionView = {}, npcLocationById = new Map(), runtimeRefs = [], options = {}) {
  const anchors = [];
  const seen = new Set();
  const maxAnchors = options.maxNpcActivityAnchors || MAP_RUNTIME_LIMITS.maxNpcActivityAnchors;
  const config = MAP_RUNTIME_NPC_ACTIVITY_ANCHORS.relationship_action;
  for (const record of asArray(npcInteractionView.items)) {
    if (!isPlainObject(record) || !isPlainObject(record.resolverTrace)) continue;
    if (record.resolverTrace.resolver !== "npc_relationship_action_resolver") continue;
    const recordId = cleanSourceRef(record.recordId, "");
    const resolutionRef = cleanSourceRef(record.resolverTrace.publicResolutionRef, "");
    const sourceId = resolutionRef || recordId;
    const npcId = cleanId(record.npcId, "");
    if (!sourceId || !npcId || seen.has(`relationship:${sourceId}`)) continue;
    const target = chooseNpcActivityTarget(npcId, npcLocationById, runtimeRefs);
    if (!target) continue;
    const anchor = buildNpcActivityAnchor({
      source: relationshipActionAnchorSource(record),
      sourceId,
      sourceRefs: [
        recordId ? `npcInteractionView:${recordId}` : "",
        resolutionRef ? `npcRelationshipActionResolverTrace:${resolutionRef}` : ""
      ],
      config,
      target,
      fallbackSummary: "人物交游只作舆图观察线索；关系、资源、婚姻与后续任务仍由服务器裁决。"
    });
    if (!anchor) continue;
    anchors.push(anchor);
    seen.add(`relationship:${sourceId}`);
    if (anchors.length >= maxAnchors) break;
  }
  return anchors;
}

function buildNpcActivityAnchors(worldState = {}, runtimeRefs = [], options = {}) {
  const npcActiveRequestView = npcActiveRequestViewForMapRuntime(worldState, options);
  const npcInteractionView = npcInteractionViewForMapRuntime(worldState, options);
  if (!npcActiveRequestView && !npcInteractionView) return [];
  const worldPeopleView = worldPeopleViewForMapRuntime(worldState, options);
  const npcLocationById = buildVisibleNpcLocationIndex(worldPeopleView || {});
  if (!npcLocationById.size) return [];
  const maxAnchors = options.maxNpcActivityAnchors || MAP_RUNTIME_LIMITS.maxNpcActivityAnchors;
  const anchors = [
    ...buildNpcActiveRequestAnchors(npcActiveRequestView || {}, npcLocationById, runtimeRefs, options),
    ...buildNpcFollowUpEvidenceAnchors(npcActiveRequestView || {}, npcLocationById, runtimeRefs, options),
    ...buildNpcRelationshipActionAnchors(npcInteractionView || {}, npcLocationById, runtimeRefs, options)
  ];
  const seen = new Set();
  return anchors.filter((anchor) => {
    if (!anchor?.id || seen.has(anchor.id)) return false;
    seen.add(anchor.id);
    return true;
  }).slice(0, maxAnchors);
}

function mergeEventEffectsWithDomainConsequences(eventEffects = [], domainEffects = [], options = {}) {
  const maxEventEffects = options.maxEventEffects || MAP_RUNTIME_LIMITS.maxEventEffects;
  if (!domainEffects.length) return eventEffects.slice(0, maxEventEffects);
  const reservedDomainEffects = Math.min(domainEffects.length, Math.max(1, Math.min(2, maxEventEffects - 1)));
  const keptContextEffects = eventEffects.slice(0, Math.max(0, maxEventEffects - reservedDomainEffects));
  return [
    ...keptContextEffects,
    ...domainEffects.slice(0, reservedDomainEffects),
    ...domainEffects.slice(reservedDomainEffects)
  ].slice(0, maxEventEffects);
}

function refById(refs = [], mapEntityRef) {
  return refs.find((ref) => ref.mapEntityRef === mapEntityRef) || null;
}

function chooseFocusRef(refs = [], options = {}) {
  const requested = cleanMapRefId(options.centerRef || options.playerFocusRef, "");
  if (requested && refById(refs, requested)) {
    return {
      ref: requested,
      reason: "requested_safe_center"
    };
  }

  const exam = refs.find((ref) => ref.entityType === "exam_travel");
  if (exam) return { ref: exam.mapEntityRef, reason: "next_exam_travel" };
  const playerVisible = refs.find((ref) => ref.visibility === "player_visible");
  if (playerVisible) return { ref: playerVisible.mapEntityRef, reason: "player_current_posting" };
  const suzhou = refById(refs, "map:geography:city:city-suzhou");
  if (suzhou) return { ref: suzhou.mapEntityRef, reason: "player_home_or_study_area" };
  const beijing = refById(refs, "map:geography:city:city-beijing");
  if (beijing) return { ref: beijing.mapEntityRef, reason: "default_capital" };
  const first = refs[0];
  return {
    ref: first?.mapEntityRef || "",
    reason: first ? "first_visible_ref" : "no_renderable_ref"
  };
}

function zoomForFocus(ref = {}) {
  if (["country", "region"].includes(ref.entityType)) return "realm";
  if (["frontier_zone", "route"].includes(ref.entityType)) return "regional";
  return "local";
}

function buildMapRuntimeView(worldState = {}, options = {}) {
  const mapContextView = options.mapContextView || buildMapContextView(worldState, options.actorProfile || null);
  const domainConsequenceView = options.domainConsequenceView || buildDomainConsequenceView(worldState);
  const refs = mergeMapRefsWithLayout(mapContextView, options);
  const routes = buildMapRoutes(mapContextView, refs, options);
  const actionDrafts = buildMapActionDrafts({ refs, routes }, options);
  const finalRefs = filterDraftRefs(refs, actionDrafts);
  const finalRoutes = filterDraftRefs(routes, actionDrafts);
  const focus = chooseFocusRef(finalRefs, options);
  const focusRef = refById(finalRefs, focus.ref) || finalRefs[0] || null;
  const eventEffects = mergeEventEffectsWithDomainConsequences(
    buildMapEventEffects(mapContextView, finalRefs, finalRoutes, options),
    buildDomainConsequenceEventEffects(domainConsequenceView, finalRefs, options),
    options
  );
  const npcActivityAnchors = buildNpcActivityAnchors(worldState, finalRefs, options);

  return {
    schemaVersion: MAP_RUNTIME_SCHEMA_VERSION,
    generatedAtTurn: clampInteger(mapContextView.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState)),
    layoutVersion: MAP_RUNTIME_LAYOUT_VERSION,
    assetSetId: MAP_RUNTIME_ASSET_SET_ID,
    playerFocusRef: focusRef?.mapEntityRef || "",
    viewportHint: {
      centerRef: focusRef?.mapEntityRef || "",
      zoom: zoomForFocus(focusRef || {}),
      reason: focus.reason
    },
    mapBounds: { ...MAP_RUNTIME_BOUNDS },
    layers: MAP_RUNTIME_LAYERS.map((layer) => ({ ...layer })),
    refs: finalRefs,
    routes: finalRoutes,
    eventEffects,
    npcActivityAnchors,
    actionDrafts,
    hiddenNotice: MAP_RUNTIME_HIDDEN_NOTICE
  };
}

module.exports = {
  buildMapActionDrafts,
  buildDomainConsequenceEventEffects,
  buildMapEventEffects,
  buildNpcActivityAnchors,
  buildMapRuntimeView,
  buildMapRoutes,
  mergeMapRefsWithLayout,
  sanitizeMapLayout,
  sanitizeMapRuntimeText
};
