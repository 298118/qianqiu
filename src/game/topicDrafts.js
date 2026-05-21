const {
  buildTopicSurfaceView,
  getTopicSurfaceConfig,
  normalizeSurfaceId
} = require("./topicSurfaceView");

const TOPIC_DRAFT_SCHEMA_VERSION = "s78.topicDraft.v1";
const TOPIC_DRAFT_MAX_SELECTED_REFS = 5;
const TOPIC_DRAFT_MAX_TEXT = 420;
const TOPIC_DRAFT_MAX_TITLE = 40;
const TOPIC_DRAFT_SOURCES = Object.freeze(["local-rule", "mock-ai", "provider-ai"]);

const TOPIC_DRAFT_SENSITIVE_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记|军情)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|(?:outcome[_ -]?id|state[_ -]?delta|player[_ -]?delta|resource[_ -]?(?:use|cost)|relationship[_ -]?signals?|audit[_ -]?record)|\b(?:cityPolicyLedger|militaryDiplomacyLedger|judicialCaseLedger|npcEconomyLedger|provider|prompt|statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/opt|\/workspace|\/mnt)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;

const TOPIC_DRAFT_RESULT_CLAIM_PATTERN =
  /(?:已|已经)(?:审结|结案|裁决|处置|平定|破获|赈济|授官|任命|罢免|定罪|升迁|提拔|发兵|开战|获胜|议和|生效|执行完毕|推进完成|定考成|记功|记过|减风险|减轻风险|入考成|记入考成|录入考成|写入考成|定处分)|(?:考成|功过|功绩|风险|弹劾|处分)(?:已|已经)(?:定|写定|记定|入簿|生效|成案|减轻)|弹劾(?:已|已经)?成案|处分(?:已|已经)?定|(?:圣旨|诏令|判词|军令)(?:已|已经)(?:生效|颁行|执行)|(?:立即|直接)(?:任命|罢免|处死|定罪|结案|授官|平定|裁决|开战|调兵|定考成|记功|记过|成案|处分)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || TOPIC_DRAFT_SENSITIVE_PATTERN.test(trimmed) || TOPIC_DRAFT_RESULT_CLAIM_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function cleanId(value, fallback = "") {
  const text = cleanText(String(value || ""), fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeSource(value, fallback = "provider-ai") {
  const source = cleanId(value, fallback);
  return TOPIC_DRAFT_SOURCES.includes(source) ? source : fallback;
}

function normalizeSelectedRefs(refs = [], allowedRefIds = new Set(), limit = TOPIC_DRAFT_MAX_SELECTED_REFS) {
  const result = [];
  for (const ref of asArray(refs)) {
    const text = cleanText(String(ref || ""), "", 140);
    if (!text || !allowedRefIds.has(text) || result.includes(text)) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeTopicDraftRequest(body = {}) {
  const input = isPlainObject(body) ? body : {};
  const surfaceId = normalizeSurfaceId(input.surfaceId || input.surfaceType);
  if (!surfaceId) {
    const error = new Error("未知专题 surface。");
    error.statusCode = 400;
    throw error;
  }
  const config = getTopicSurfaceConfig(surfaceId);
  const allowedDraftKinds = new Set(asArray(config.draftSlots).map((slot) => slot.draftKind));
  const requestedDraftKind = cleanId(input.draftKind || input.actionKind, "");
  const defaultDraftKind = config.draftSlots?.[0]?.draftKind || "topic_draft";
  return {
    surfaceId,
    draftKind: allowedDraftKinds.has(requestedDraftKind) ? requestedDraftKind : defaultDraftKind,
    selectedEvidenceRefs: asArray(input.selectedEvidenceRefs || input.evidenceRefs).map((ref) => cleanText(String(ref || ""), "", 140)).filter(Boolean).slice(0, 8),
    playerNote: cleanText(input.playerNote || input.note || "", "", 120),
    count: clampInteger(input.count, 1, 1, 1)
  };
}

function slotForDraftKind(surfaceView, draftKind) {
  return asArray(surfaceView.draftSlots).find((slot) => slot.draftKind === draftKind) || surfaceView.draftSlots?.[0] || null;
}

function buildTopicDraftContext(worldState = {}, request = {}) {
  const normalized = request.surfaceId ? request : normalizeTopicDraftRequest(request);
  const topicSurfaceView = buildTopicSurfaceView(worldState, { surfaceId: normalized.surfaceId });
  const allowedRefIds = new Set(asArray(topicSurfaceView.evidenceRefs).map((ref) => ref.refId).filter(Boolean));
  const selectedEvidenceRefs = normalizeSelectedRefs(normalized.selectedEvidenceRefs, allowedRefIds);
  const selectedEvidence = selectedEvidenceRefs.length
    ? asArray(topicSurfaceView.evidenceRefs).filter((ref) => selectedEvidenceRefs.includes(ref.refId))
    : asArray(topicSurfaceView.evidenceRefs).slice(0, 3);
  const draftSlot = slotForDraftKind(topicSurfaceView, normalized.draftKind);
  const context = {
    schemaVersion: TOPIC_DRAFT_SCHEMA_VERSION,
    sessionId: cleanId(worldState.sessionId, ""),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    surfaceId: topicSurfaceView.surfaceId,
    surfaceType: topicSurfaceView.surfaceType,
    surfaceTitle: topicSurfaceView.title,
    player: {
      role: cleanText(worldState.player?.role, "official", 48),
      roleLabel: cleanText(worldState.player?.roleLabel || worldState.player?.role, "", 48),
      name: cleanText(worldState.player?.name, "玩家", 48),
      officeTitle: cleanText(worldState.player?.officeTitle || worldState.player?.position, "", 80)
    },
    draftKind: draftSlot?.draftKind || normalized.draftKind,
    draftLabel: cleanText(draftSlot?.label, "草稿", 40),
    draftTemplate: cleanText(draftSlot?.template, "", 160),
    playerNote: normalized.playerNote,
    selectedEvidenceRefs: selectedEvidence.map((ref) => ref.refId),
    evidenceRefs: selectedEvidence.map((ref) => ({
      refId: ref.refId,
      label: ref.label,
      summary: ref.summary,
      domain: ref.domain,
      sourceView: ref.sourceView,
      confidence: ref.confidence
    })),
    allowedDraftKinds: asArray(topicSurfaceView.draftSlots).map((slot) => slot.draftKind).filter(Boolean),
    safety: {
      draftOnly: true,
      citeSuppliedEvidenceOnly: true,
      noResolverExecution: true,
      noStateWrites: true,
      noGlobalTimeAdvance: true
    }
  };
  assertTopicDraftSafe(context, { allowProviderSource: true, allowResultClaims: true });
  return context;
}

function evidenceSummary(context = {}) {
  const labels = asArray(context.evidenceRefs).slice(0, 3).map((ref) => cleanText(ref.label, "", 36)).filter(Boolean);
  return labels.length ? labels.join("、") : "当前公开材料";
}

function localDraftText(context = {}) {
  const material = evidenceSummary(context);
  const template = cleanText(context.draftTemplate, "据公开材料拟稿，先陈事实，再请服务器裁决后果。", 140);
  const note = context.playerNote ? `并附玩家按语：${context.playerNote}。` : "";
  const surfaceLead = {
    "memorial-review": "臣谨阅所选奏报",
    "edict-draft": "拟谕中外有司",
    "court-debate": "请召诸臣廷议",
    trial: "本官拟升堂复核",
    "war-council": "本营拟集军议",
    "npc-profile": "拟就公开谱牒先行问讯"
  }[context.surfaceId] || "据此拟稿";
  return `${surfaceLead}，所据为${material}。${template}${note}请依公开证据、职分权限与后续服务器裁决办理。`;
}

function buildLocalTopicDraftResponse(worldState = {}, request = {}, options = {}) {
  const normalized = request.surfaceId ? request : normalizeTopicDraftRequest(request);
  const context = options.context || buildTopicDraftContext(worldState, normalized);
  const draft = normalizeTopicDraftPayload({
    surfaceId: context.surfaceId,
    draftKind: context.draftKind,
    draftTitle: context.draftLabel || "专题草稿",
    draftText: localDraftText(context),
    evidenceRefs: context.selectedEvidenceRefs,
    riskNote: "此稿只写入底部奏折，是否成事仍候普通回合服务器裁决。",
    nextStep: "写入草稿后可自行修改，再于主卷呈上。",
    source: options.source || "local-rule"
  }, context, { fallbackSource: options.source || "local-rule" });
  return {
    schemaVersion: TOPIC_DRAFT_SCHEMA_VERSION,
    sessionId: cleanId(worldState.sessionId, ""),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    surfaceId: context.surfaceId,
    source: draft.source,
    status: options.status || "fallback",
    fallbackReason: cleanText(options.fallbackReason, "", 80) || undefined,
    topicDraft: draft
  };
}

function normalizeTopicDraftPayload(payload = {}, context = {}, options = {}) {
  if (!isPlainObject(payload)) throw new Error("topic draft payload must be an object");
  const source = normalizeSource(payload.source, options.fallbackSource || "provider-ai");
  if (options.expectedSource && source !== options.expectedSource) {
    throw new Error("topic draft source mismatch");
  }
  const surfaceId = normalizeSurfaceId(payload.surfaceId || context.surfaceId);
  if (surfaceId !== context.surfaceId) throw new Error("topic draft surface mismatch");
  const allowedKinds = new Set(asArray(context.allowedDraftKinds));
  const draftKind = cleanId(payload.draftKind || payload.kind || context.draftKind, context.draftKind);
  if (allowedKinds.size && !allowedKinds.has(draftKind)) throw new Error("topic draft kind is not allowed");
  const title = cleanText(payload.draftTitle || payload.title, "", TOPIC_DRAFT_MAX_TITLE);
  const text = cleanText(payload.draftText || payload.text, "", TOPIC_DRAFT_MAX_TEXT);
  if (!title || !text) throw new Error("topic draft title or text failed safety validation");

  const allowedRefIds = new Set(asArray(context.evidenceRefs).map((ref) => ref.refId).filter(Boolean));
  const evidenceRefs = normalizeSelectedRefs(payload.evidenceRefs, allowedRefIds);
  if (asArray(payload.evidenceRefs).length > 0 && evidenceRefs.length === 0) {
    throw new Error("topic draft evidence refs are not in surface context");
  }
  if (TOPIC_DRAFT_RESULT_CLAIM_PATTERN.test(JSON.stringify(payload))) {
    throw new Error("topic draft claims resolved outcome");
  }

  const draft = {
    surfaceId,
    draftKind,
    draftTitle: title,
    draftText: text,
    evidenceRefs,
    riskNote: cleanText(payload.riskNote, "此稿只供呈上前编辑；后果仍候服务器裁决。", 120),
    nextStep: cleanText(payload.nextStep, "写入草稿后由玩家修改并呈上。", 120),
    source
  };
  assertTopicDraftSafe(draft, { allowProviderSource: true });
  return draft;
}

function buildTopicDraftResponse(worldState = {}, payload = {}, context = {}, options = {}) {
  const draft = normalizeTopicDraftPayload(payload, context, {
    fallbackSource: options.source || "provider-ai",
    expectedSource: options.expectedSource
  });
  return {
    schemaVersion: TOPIC_DRAFT_SCHEMA_VERSION,
    sessionId: cleanId(worldState.sessionId, ""),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    surfaceId: context.surfaceId,
    source: draft.source,
    status: "ready",
    fallbackReason: undefined,
    topicDraft: draft
  };
}

function assertTopicDraftSafe(value, options = {}) {
  const serialized = JSON.stringify(value);
  const safeSerialized = options.allowProviderSource ? serialized.replace(/provider-ai/g, "provider_ai") : serialized;
  if (TOPIC_DRAFT_SENSITIVE_PATTERN.test(safeSerialized) || (!options.allowResultClaims && TOPIC_DRAFT_RESULT_CLAIM_PATTERN.test(serialized))) {
    throw new Error("topic draft payload contains forbidden source text or resolved outcome claim");
  }
  return true;
}

module.exports = {
  TOPIC_DRAFT_SCHEMA_VERSION,
  assertTopicDraftSafe,
  buildLocalTopicDraftResponse,
  buildTopicDraftContext,
  buildTopicDraftResponse,
  normalizeTopicDraftPayload,
  normalizeTopicDraftRequest
};
