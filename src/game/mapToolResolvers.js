const { buildMapContextView } = require("./mapContext");
const {
  MAP_MOVEMENT_PROPOSAL_SCHEMA_VERSION,
  MAP_MOVEMENT_TYPE_IDS,
  MAP_MOVEMENT_TYPES
} = require("./mapContextConfig");

const MAX_TEXT_LENGTH = 180;
const COMMON_MAP_REF_LIMIT = 8;
const SENSITIVE_MAP_TOOL_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|coordinate|coords?)|\b(?:statePatch|worldState|provider|proposal|prompt|rawSql|SQL|sqlite|coordinate|coords?|latitude|longitude|lat|lng)\b|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,})/i;

const FORBIDDEN_MAP_TOOL_KEYS = new Set([
  "rawSql",
  "sql",
  "statePatch",
  "worldState",
  "rawTable",
  "rawAudit",
  "rawPrompt",
  "providerConfig",
  "localPath",
  "hiddenNotes",
  "hiddenIntent",
  "apiKey",
  "coordinates",
  "coordinateTable",
  "latitude",
  "longitude",
  "lat",
  "lng"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || SENSITIVE_MAP_TOOL_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(String(value ?? ""), fallback, 140);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanRefList(values, limit = COMMON_MAP_REF_LIMIT) {
  const seen = new Set();
  const result = [];
  for (const value of asArray(values)) {
    const ref = cleanId(value, "");
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    result.push(ref);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanTextList(values, limit = 6, maxLength = 120) {
  const result = [];
  for (const value of asArray(values)) {
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

function clampFloat(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function collectUnsafeFields(value, path = "arguments", findings = []) {
  if (typeof value === "string") {
    if (SENSITIVE_MAP_TOOL_PATTERN.test(value)) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeFields(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isPlainObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_MAP_TOOL_KEYS.has(key) || SENSITIVE_MAP_TOOL_PATTERN.test(key)) {
      findings.push(`${path}.${key}`);
    }
    collectUnsafeFields(child, `${path}.${key}`, findings);
  }
  return findings;
}

function actorRef(actorProfile = {}) {
  return {
    actorId: cleanText(actorProfile.actorId, "actor:unknown", 96),
    actorType: cleanText(actorProfile.actorType, "unknown", 48),
    authorityTier: cleanText(actorProfile.authorityTier, "T0", 4),
    officeId: cleanText(actorProfile.officeId, "", 96),
    jurisdictionRefs: cleanRefList(actorProfile.jurisdictionRefs, 8)
  };
}

function actorToolGroups(actorProfile = {}) {
  return new Set(Array.isArray(actorProfile.allowedToolGroups) ? actorProfile.allowedToolGroups : []);
}

function normalizeVisibility(value, fallback = "actor_visible") {
  const text = cleanText(value, "", 48);
  return ["player_visible", "actor_visible"].includes(text) ? text : fallback;
}

function normalizeMapMovementProposal(argumentsPayload = {}, options = {}) {
  const source = isPlainObject(argumentsPayload) ? argumentsPayload : {};
  const actor = actorRef(options.actorProfile);
  const moveType = cleanId(source.moveType, "");
  const safeMoveType = MAP_MOVEMENT_TYPE_IDS.includes(moveType) ? moveType : moveType;
  const originRef = cleanId(source.originRef, "");
  const destinationRefs = cleanRefList(source.destinationRefs, 5);
  const routeRefs = cleanRefList(source.routeRefs, 5);
  const affectedMapRefs = cleanRefList(source.affectedMapRefs, 8);
  const evidenceRefs = cleanRefList(source.evidenceRefs, 8);
  const cooldownKey = cleanId(
    source.cooldownKey,
    `map:${safeMoveType || "unknown"}:${originRef || destinationRefs[0] || evidenceRefs[0] || actor.actorId}`
  );
  const safetyFlags = collectUnsafeFields(source)
    .map((field) => `unsafe_text:${field}`)
    .slice(0, 10);
  if (!MAP_MOVEMENT_TYPE_IDS.includes(safeMoveType)) {
    safetyFlags.push("invalid_move_type");
  }
  if (asArray(source.privateResultRefs).length) {
    safetyFlags.push("private_result_refs_from_model");
  }

  return {
    schemaVersion: MAP_MOVEMENT_PROPOSAL_SCHEMA_VERSION,
    proposalId: cleanId(`map:${actor.actorId}:${cooldownKey}`, "map-movement-proposal"),
    toolName: "map.propose_route_or_geopolitical_move",
    moveType: safeMoveType,
    moveLabel: MAP_MOVEMENT_TYPES[safeMoveType]?.label || safeMoveType || "未知移动",
    actorRef: actor,
    publicSummary: cleanText(source.publicSummary, "地图移动意图待服务器裁决。", 180),
    originRef,
    destinationRefs,
    routeRefs,
    affectedMapRefs,
    evidenceRefs,
    jurisdictionRef: cleanId(source.jurisdictionRef, ""),
    visibility: normalizeVisibility(source.visibility),
    confidence: clampFloat(source.confidence, 0, 1, 0.5),
    riskLevel: clampNumber(source.riskLevel, 0, 5, 2),
    cooldownKey,
    expectedBenefits: cleanTextList(source.expectedBenefits, 5, 120),
    counterCosts: cleanTextList(source.counterCosts, 5, 120),
    riskDisclosure: cleanText(source.riskDisclosure, "需服务器复核路线、辖区、消耗、战和与落库风险。", 180),
    privateResultRefs: [],
    riskTags: cleanRefList(source.riskTags, 6),
    safetyFlags,
    accepted: false,
    authorityBoundary: "地图工具只提交待裁决移动意图；赶考、赴任、巡查、行军、押解、使节、商路、外交后果和持久化仍归服务器。"
  };
}

function visibleMapRefIndex(worldState = {}, actorProfile = {}) {
  const view = buildMapContextView(worldState, actorProfile);
  return new Map(asArray(view.mapEntityRefs).map((ref) => [ref.refId, ref]));
}

function validateRefVisible(refId, visibleRefs, reasons, label = "地图引用") {
  if (!refId) return null;
  const ref = visibleRefs.get(refId);
  if (!ref) {
    reasons.push(`${label} ${refId} 不在当前 actor 可见 mapContextView 内。`);
    return null;
  }
  return ref;
}

function validateMapMovementProposalAuthority(actorProfile = {}, proposal = {}, context = {}) {
  const normalized = proposal.schemaVersion === MAP_MOVEMENT_PROPOSAL_SCHEMA_VERSION
    ? proposal
    : normalizeMapMovementProposal(proposal, { actorProfile });
  const reasons = [];
  const movement = MAP_MOVEMENT_TYPES[normalized.moveType];
  const actorType = cleanId(actorProfile.actorType, "");
  const toolGroups = actorToolGroups(actorProfile);

  if (normalized.safetyFlags.length) {
    reasons.push("地图工具参数含不安全字段、坐标表或内部 resolver 形状文本。");
  }
  if (!actorProfile?.actorId) {
    reasons.push("缺少 actor profile，不能提交地图移动意图。");
  }
  if (!toolGroups.has("map")) {
    reasons.push("actor 当前工具组不可提交地图移动 proposal。");
  }
  if (!movement) {
    reasons.push("未知地图移动类型。");
  } else if (actorType && !movement.allowedActorTypes.includes(actorType)) {
    reasons.push(`${actorType} 无权提交 ${movement.label} 地图移动。`);
  }
  if (!normalized.originRef) {
    reasons.push("地图移动请求缺少起点 originRef。");
  }
  if (!normalized.destinationRefs.length) {
    reasons.push("地图移动请求缺少目的地 destinationRefs。");
  }
  if (!normalized.evidenceRefs.length) {
    reasons.push("地图移动请求缺少 mapContextView evidenceRefs。");
  }

  const visibleRefs = visibleMapRefIndex(context.worldState || {}, actorProfile);
  const origin = validateRefVisible(normalized.originRef, visibleRefs, reasons, "起点");
  const destinationRefs = normalized.destinationRefs
    .map((refId) => validateRefVisible(refId, visibleRefs, reasons, "目的地"))
    .filter(Boolean);
  const routeRefs = normalized.routeRefs
    .map((refId) => validateRefVisible(refId, visibleRefs, reasons, "路线"))
    .filter(Boolean);
  const affectedRefs = normalized.affectedMapRefs
    .map((refId) => validateRefVisible(refId, visibleRefs, reasons, "影响地点"))
    .filter(Boolean);
  const evidenceRefs = normalized.evidenceRefs
    .map((refId) => validateRefVisible(refId, visibleRefs, reasons, "证据"))
    .filter(Boolean);

  for (const route of routeRefs) {
    if (route.entityType !== "route") reasons.push(`路线 ${route.refId} 不是 route 类型地图引用。`);
  }
  if (!origin && !destinationRefs.length && !routeRefs.length && !affectedRefs.length) {
    reasons.push("地图移动请求至少需要一个可见起点、目的地、路线或影响地点。");
  }

  return {
    accepted: reasons.length === 0,
    status: reasons.length === 0 ? "pending" : "rejected",
    rejectionReasons: reasons.slice(0, 8),
    visibleMapRefs: [origin, ...destinationRefs, ...routeRefs, ...affectedRefs, ...evidenceRefs]
      .filter(Boolean)
      .filter((ref, index, refs) => refs.findIndex((item) => item.refId === ref.refId) === index)
  };
}

function resolveMapMovementProposal(worldState = {}, argumentsPayload = {}, options = {}) {
  const normalized = normalizeMapMovementProposal(argumentsPayload, {
    actorProfile: options.actorProfile
  });
  const validation = validateMapMovementProposalAuthority(options.actorProfile || {}, normalized, {
    ...options.context,
    worldState
  });
  const accepted = validation.accepted;
  const publicSummary = accepted
    ? `地图移动意图已进入服务器待裁决队列：${normalized.moveLabel}，${normalized.publicSummary}`
    : "地图移动意图未被服务器接受。";

  return {
    status: accepted ? "pending" : "rejected",
    publicResult: {
      summary: cleanText(publicSummary, "地图移动意图已记录为待裁决。", 180),
      visibleChanges: accepted ? [
        normalized.publicSummary,
        `移动类型：${normalized.moveLabel}`,
        `地图证据：${validation.visibleMapRefs.slice(0, 4).map((ref) => ref.refId).join("、")}`
      ].map((text) => cleanText(text, "", 140)).filter(Boolean) : []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: validation.rejectionReasons.map((reason) => cleanText(reason, "服务器拒绝地图移动意图。", 160)),
    counterCosts: accepted
      ? ["S70.13 只记录地图移动意图；路线、盘费、军粮、任免、外交、商路和持久化由后续服务器 resolver 裁决。"]
      : [],
    followUpHooks: accepted ? ["review_map_movement_candidate"] : [],
    normalizedProposal: {
      ...normalized,
      accepted
    }
  };
}

function resolveMapMovementTool({ worldState = {}, arguments: args = {}, actorProfile = {}, context = {} }) {
  return resolveMapMovementProposal(worldState, args, {
    actorProfile,
    context
  });
}

module.exports = {
  normalizeMapMovementProposal,
  resolveMapMovementProposal,
  resolveMapMovementTool,
  validateMapMovementProposalAuthority
};
