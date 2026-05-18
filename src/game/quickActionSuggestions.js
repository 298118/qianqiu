const { buildPlayerAiActorProfile } = require("./aiActorProfiles");
const {
  assertResolverInputSafe,
  buildResolverInputContext
} = require("./resolverInputContext");
const { RESOLVER_INPUT_DOMAINS } = require("./resolverInputConfig");
const { formatYearMonthPeriod } = require("./time");

const QUICK_ACTION_SCHEMA_VERSION = "s75.9-quick-actions.v1";
const QUICK_ACTION_MAX_COUNT = 3;
const QUICK_ACTION_MAX_DRAFT_PREVIEW = 80;
const QUICK_ACTION_MAX_TEXT = 96;
const QUICK_ACTION_MAX_TITLE = 12;
const QUICK_ACTION_MAX_TAGS = 6;
const QUICK_ACTION_MAX_EVIDENCE_REFS = 4;

const QUICK_ACTION_SOURCES = Object.freeze(["local-rule", "mock-ai", "provider-ai"]);
const QUICK_ACTION_TOOL_INTENTS = Object.freeze([
  "study",
  "exam",
  "patrol",
  "case",
  "memorial",
  "march",
  "court",
  "travel",
  "office",
  "generic"
]);

const SENSITIVE_QUICK_ACTION_PATTERN =
  /(SEALED_[A-Z0-9_]+|hidden[_ -]?(?:notes?|intent)|hidden\s+(?:notes?|intent)|密档|私档|密札|密信|隐藏(?:意图|动机|事实|札记)|隐秘(?:意图|动机|事实)|raw[_ -]?(?:provider|audit|table|ledger|prompt|proposal|state|row)|\b(?:statePatch|worldState|provider\s+payload|provider\s+proposal|rawSql|SQL|sqlite|server\.)\b|完整\s*prompt|完整提示词|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index|safe_search_(?:index|fts)|(?:geo|people)_[A-Za-z0-9_]+|office_(?!read\b)[A-Za-z0-9_]+|\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b|file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/)[^\s"'<>]+|[A-Za-z]:[\\/][^\s"'<>]+|\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]+|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,})/i;
const RESULT_CLAIM_QUICK_ACTION_PATTERN =
  /(?:已|已经)(?:审结|结案|裁决|处置|平定|破获|赈济|授官|任命|罢免|定罪|升迁|提拔|推进完成|执行完毕)|(?:立即|直接)(?:任命|罢免|处死|定罪|结案|授官|平定|裁决)/i;

const ROLE_ALIASES = Object.freeze({
  emperor: "emperor",
  皇帝: "emperor",
  scholar: "scholar",
  书生: "scholar",
  general: "general",
  将领: "general",
  magistrate: "magistrate",
  地方官: "magistrate",
  minister: "minister",
  大臣: "minister",
  official: "official",
  官员: "official",
  入仕官员: "official"
});

const ROLE_ALLOWED_TOOL_INTENTS = Object.freeze({
  emperor: Object.freeze(["court", "memorial", "office", "patrol", "generic"]),
  scholar: Object.freeze(["study", "exam", "travel", "generic"]),
  general: Object.freeze(["march", "patrol", "memorial", "travel", "generic"]),
  magistrate: Object.freeze(["case", "patrol", "memorial", "office", "generic"]),
  minister: Object.freeze(["memorial", "court", "office", "patrol", "generic"]),
  official: Object.freeze(["memorial", "office", "court", "patrol", "generic"])
});

const TOOL_GROUP_TO_INTENT = Object.freeze({
  study: "study",
  exam: "exam",
  judicial: "case",
  city_policy: "patrol",
  military: "march",
  diplomacy: "travel",
  ruler: "court",
  career: "office",
  report: "memorial",
  map: "travel",
  time: "generic",
  personal_action: "generic"
});

const LOCAL_ROLE_SUGGESTIONS = Object.freeze({
  emperor: Object.freeze([
    Object.freeze({ id: "emperor-edict", title: "宣旨", label: "宣旨", text: "宣旨整饬吏治，命中枢三日内具奏各省积弊。", roleTags: Object.freeze(["emperor", "edict"]), toolIntent: "court" }),
    Object.freeze({ id: "emperor-vermilion", title: "朱批", label: "朱批", text: "朱批近日奏折，询问钱粮、边防与民生三事。", roleTags: Object.freeze(["emperor", "memorial"]), toolIntent: "memorial" }),
    Object.freeze({ id: "emperor-court", title: "召见群臣", label: "召见群臣", text: "召见群臣廷议，听取各部对当前局势的陈奏。", roleTags: Object.freeze(["emperor", "court"]), toolIntent: "court" })
  ]),
  scholar: Object.freeze([
    Object.freeze({ id: "scholar-study", title: "研读", label: "研读", text: "闭门研读经义，整理近日所得，准备下一场考试。", roleTags: Object.freeze(["scholar", "study"]), toolIntent: "study" }),
    Object.freeze({ id: "scholar-essay", title: "作文", label: "作文", text: "拟作一篇策论，请师友指出破题与立意得失。", roleTags: Object.freeze(["scholar", "essay"]), toolIntent: "study" }),
    Object.freeze({ id: "scholar-exam", title: "赴考", label: "赴考", text: "打听考期与贡院规矩，整备行装准备赴考。", roleTags: Object.freeze(["scholar", "exam"]), toolIntent: "exam" })
  ]),
  general: Object.freeze([
    Object.freeze({ id: "general-deploy", title: "遣将", label: "遣将", text: "遣将巡查前哨，回报粮道、军心与敌情虚实。", roleTags: Object.freeze(["general", "scout"]), toolIntent: "patrol" }),
    Object.freeze({ id: "general-camp", title: "巡营", label: "巡营", text: "亲自巡营，查点甲仗粮草，并安抚将士。", roleTags: Object.freeze(["general", "camp"]), toolIntent: "patrol" }),
    Object.freeze({ id: "general-report", title: "上战报", label: "上战报", text: "整理边情与军务得失，上战报请朝廷裁示。", roleTags: Object.freeze(["general", "report"]), toolIntent: "memorial" })
  ]),
  magistrate: Object.freeze([
    Object.freeze({ id: "magistrate-trial", title: "审案", label: "审案", text: "升堂审理积案，先核公开证词与案牍记录。", roleTags: Object.freeze(["magistrate", "case"]), toolIntent: "case" }),
    Object.freeze({ id: "magistrate-relief", title: "赈济", label: "赈济", text: "查问灾情与仓储，拟定赈济安民之策。", roleTags: Object.freeze(["magistrate", "relief"]), toolIntent: "patrol" }),
    Object.freeze({ id: "magistrate-dike", title: "修堤", label: "修堤", text: "召集里正与工匠，勘查河堤险段并筹措修缮。", roleTags: Object.freeze(["magistrate", "dike"]), toolIntent: "office" })
  ]),
  minister: Object.freeze([
    Object.freeze({ id: "minister-memorial", title: "上疏", label: "上疏", text: "上疏陈明时弊，提出可由朝廷裁量的三条办法。", roleTags: Object.freeze(["minister", "memorial"]), toolIntent: "memorial" }),
    Object.freeze({ id: "minister-council", title: "会商", label: "会商", text: "约同僚会商部务，分辨轻重缓急后再行具奏。", roleTags: Object.freeze(["minister", "council"]), toolIntent: "court" }),
    Object.freeze({ id: "minister-docket", title: "查阅案牍", label: "查阅案牍", text: "查阅近日案牍与公文，摘出关涉民生与官声的要点。", roleTags: Object.freeze(["minister", "docket"]), toolIntent: "office" })
  ]),
  official: Object.freeze([
    Object.freeze({ id: "official-memorial", title: "上疏", label: "上疏", text: "上疏陈明任内见闻，请求朝廷明示处置章程。", roleTags: Object.freeze(["official", "memorial"]), toolIntent: "memorial" }),
    Object.freeze({ id: "official-council", title: "会商", label: "会商", text: "拜会同僚会商公事，先求稳妥可行之策。", roleTags: Object.freeze(["official", "council"]), toolIntent: "court" }),
    Object.freeze({ id: "official-docket", title: "查阅案牍", label: "查阅案牍", text: "查阅案牍与考成记录，整理下一步施政重点。", roleTags: Object.freeze(["official", "docket"]), toolIntent: "office" })
  ])
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || SENSITIVE_QUICK_ACTION_PATTERN.test(text) || RESULT_CLAIM_QUICK_ACTION_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function cleanTag(value) {
  const text = cleanText(String(value || ""), "", 32)
    .replace(/[^A-Za-z0-9_\-\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "";
}

function normalizeRole(role) {
  return ROLE_ALIASES[String(role || "").trim()] || "official";
}

function normalizeQuickActionRequest(body = {}) {
  const input = isPlainObject(body) ? body : {};
  return {
    page: cleanText(input.page, "game", 32) || "game",
    draftPreview: cleanText(input.draftPreview || input.currentDraftPreview, "", QUICK_ACTION_MAX_DRAFT_PREVIEW),
    count: clampInteger(input.count ?? input.limit, 1, QUICK_ACTION_MAX_COUNT, QUICK_ACTION_MAX_COUNT)
  };
}

function buildPlayerSummary(worldState = {}) {
  const player = worldState.player || {};
  return {
    name: cleanText(player.name, "未题名", 48),
    role: normalizeRole(player.role),
    roleLabel: cleanText(player.roleLabel || player.role, "", 48),
    position: cleanText(player.position || player.officeTitle, "", 80),
    examRank: cleanText(player.examRank || player.palaceRank, "", 40),
    officeTitle: cleanText(player.officeTitle, "", 80),
    countyName: cleanText(player.countyName, "", 80)
  };
}

function flattenEvidence(context = {}, limit = 12) {
  const evidence = [];
  for (const domain of RESOLVER_INPUT_DOMAINS) {
    for (const item of Array.isArray(context[domain]) ? context[domain] : []) {
      evidence.push({
        refId: item.refId,
        sourceView: item.sourceView,
        domain: item.domain,
        label: item.label,
        summary: item.summary,
        visibility: item.visibility,
        confidence: item.confidence,
        freshness: item.freshness
      });
      if (evidence.length >= limit) return evidence;
    }
  }
  return evidence;
}

function buildRouteViewFlags(context = {}, worldState = {}) {
  return {
    hasPublicEvidence: RESOLVER_INPUT_DOMAINS.some((domain) => Array.isArray(context[domain]) && context[domain].length > 0),
    hasMapContext: Array.isArray(context.map) && context.map.length > 0,
    hasEventArchive: Array.isArray(context.events) && context.events.length > 0,
    hasPeopleView: Array.isArray(context.people) && context.people.length > 0,
    hasOfficeView: Array.isArray(context.offices) && context.offices.length > 0,
    hasExamContext: Boolean(worldState.activeExam || worldState.player?.examRank || worldState.studyProfile)
  };
}

function buildToolCapabilities(actorProfile = {}) {
  const allowedGroups = Array.isArray(actorProfile.allowedToolGroups) ? actorProfile.allowedToolGroups : [];
  return allowedGroups
    .map((group) => {
      const intent = TOOL_GROUP_TO_INTENT[group] || "generic";
      return {
        group,
        toolIntent: intent,
        boundary: "只可生成行动草稿；工具执行、proposal 裁决和状态写入均由服务器处理。"
      };
    })
    .filter((item, index, source) => source.findIndex((other) => other.group === item.group) === index)
    .slice(0, 16);
}

function buildQuickActionContext(worldState = {}, request = {}) {
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const resolverContext = buildResolverInputContext(worldState, {
    includeSessionId: false,
    eventArchivePageSize: 12,
    sceneType: "quick_action",
    intentType: "quick_action",
    requestSummary: request.draftPreview || "快捷行动建议",
    actorProfile,
    domainCaps: {
      geography: 3,
      people: 3,
      offices: 3,
      economy: 2,
      military: 2,
      events: 4,
      intel: 2,
      player: 3,
      map: 3,
      memory: 2
    }
  });
  assertResolverInputSafe(resolverContext);
  const evidenceRefs = flattenEvidence(resolverContext, 12);
  const player = buildPlayerSummary(worldState);
  const context = {
    schemaVersion: QUICK_ACTION_SCHEMA_VERSION,
    page: request.page || "game",
    requestedCount: request.count || QUICK_ACTION_MAX_COUNT,
    draftPreview: request.draftPreview || "",
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    date: {
      label: formatYearMonthPeriod(worldState),
      year: worldState.year,
      month: worldState.month,
      tenDayPeriod: worldState.tenDayPeriod
    },
    player,
    routeViewFlags: buildRouteViewFlags(resolverContext, worldState),
    toolCapabilities: buildToolCapabilities(actorProfile),
    evidenceRefs
  };
  assertQuickActionSafe(context, { allowProviderSource: true });
  return context;
}

function withSource(suggestion, source) {
  return {
    ...suggestion,
    source,
    sourceLabel: source,
    status: "ready",
    evidenceRefs: []
  };
}

function buildLocalQuickActionSuggestions(contextOrWorldState = {}, options = {}) {
  const source = QUICK_ACTION_SOURCES.includes(options.source) ? options.source : "local-rule";
  const player = contextOrWorldState.player?.role
    ? contextOrWorldState.player
    : buildPlayerSummary(contextOrWorldState);
  const role = normalizeRole(player.role);
  const limit = clampInteger(options.count ?? contextOrWorldState.requestedCount, 1, QUICK_ACTION_MAX_COUNT, QUICK_ACTION_MAX_COUNT);
  const base = LOCAL_ROLE_SUGGESTIONS[role] || LOCAL_ROLE_SUGGESTIONS.official;
  return base.slice(0, limit).map((suggestion) => withSource(suggestion, source));
}

function buildLocalQuickActionResponse(worldState = {}, request = {}, options = {}) {
  const context = options.context || buildQuickActionContext(worldState, request);
  const source = QUICK_ACTION_SOURCES.includes(options.source) ? options.source : "local-rule";
  const suggestions = buildLocalQuickActionSuggestions(context, {
    source,
    count: request.count || context.requestedCount
  });
  return {
    schemaVersion: QUICK_ACTION_SCHEMA_VERSION,
    sessionId: cleanText(worldState.sessionId, "", 80),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    source,
    status: options.status || (source === "local-rule" ? "fallback" : "ready"),
    stale: false,
    fallbackReason: cleanText(options.fallbackReason, "", 80) || undefined,
    quickActionSuggestions: suggestions.map((suggestion, index) => normalizeSuggestion(
      suggestion,
      context,
      index,
      { fallbackSource: source, role: context.player?.role }
    )).filter(Boolean)
  };
}

function normalizeSource(value, fallbackSource = "provider-ai") {
  const source = String(value || "").trim();
  if (QUICK_ACTION_SOURCES.includes(source)) return source;
  return fallbackSource;
}

function normalizeToolIntent(value, role) {
  const intent = QUICK_ACTION_TOOL_INTENTS.includes(value) ? value : "generic";
  const allowed = ROLE_ALLOWED_TOOL_INTENTS[normalizeRole(role)] || ROLE_ALLOWED_TOOL_INTENTS.official;
  return allowed.includes(intent) ? intent : "";
}

function normalizeEvidenceRefs(refs, allowedRefIds) {
  if (!Array.isArray(refs)) return [];
  const accepted = [];
  for (const ref of refs) {
    const text = cleanText(String(ref || ""), "", 120);
    if (!text || !allowedRefIds.has(text) || accepted.includes(text)) continue;
    accepted.push(text);
    if (accepted.length >= QUICK_ACTION_MAX_EVIDENCE_REFS) break;
  }
  return accepted;
}

function normalizeSuggestion(suggestion, context = {}, index = 0, options = {}) {
  if (!isPlainObject(suggestion)) return null;
  const role = normalizeRole(options.role || context.player?.role);
  const source = normalizeSource(suggestion.source, options.fallbackSource || "provider-ai");
  if (options.expectedSource && source !== options.expectedSource) return null;
  const toolIntent = normalizeToolIntent(suggestion.toolIntent, role);
  if (!toolIntent) return null;

  const allowedRefIds = new Set((context.evidenceRefs || []).map((ref) => ref.refId).filter(Boolean));
  const title = cleanText(suggestion.title, "", QUICK_ACTION_MAX_TITLE);
  const label = cleanText(suggestion.label || suggestion.title, title, QUICK_ACTION_MAX_TITLE);
  const text = cleanText(suggestion.text, "", QUICK_ACTION_MAX_TEXT);
  if (!title || !label || !text) return null;

  const evidenceRefs = normalizeEvidenceRefs(suggestion.evidenceRefs, allowedRefIds);
  if (Array.isArray(suggestion.evidenceRefs) && suggestion.evidenceRefs.length > 0 && evidenceRefs.length === 0) {
    return null;
  }

  const roleTags = Array.isArray(suggestion.roleTags)
    ? suggestion.roleTags.map(cleanTag).filter(Boolean)
    : [];
  if (!roleTags.includes(role)) roleTags.unshift(role);

  return {
    id: cleanTag(suggestion.id) || `quick-${source}-${role}-${index + 1}`,
    source,
    sourceLabel: source,
    title,
    label,
    text,
    roleTags: roleTags.slice(0, QUICK_ACTION_MAX_TAGS),
    toolIntent,
    evidenceRefs,
    status: "ready"
  };
}

function normalizeQuickActionProviderPayload(payload = {}, context = {}, options = {}) {
  const suggestions = Array.isArray(payload.quickActionSuggestions)
    ? payload.quickActionSuggestions
    : [];
  const normalized = suggestions
    .map((suggestion, index) => normalizeSuggestion(suggestion, context, index, {
      fallbackSource: options.source || "provider-ai",
      expectedSource: options.expectedSource,
      role: context.player?.role
    }))
    .filter(Boolean)
    .slice(0, clampInteger(options.count ?? context.requestedCount, 1, QUICK_ACTION_MAX_COUNT, QUICK_ACTION_MAX_COUNT));
  if (!normalized.length) {
    throw new Error("quick_action suggestions were empty after safety validation");
  }
  assertQuickActionSafe(normalized, { allowProviderSource: true });
  return normalized;
}

function buildQuickActionResponse(worldState = {}, payload = {}, context = {}, options = {}) {
  const suggestions = normalizeQuickActionProviderPayload(payload, context, {
    source: options.source || "provider-ai",
    expectedSource: options.expectedSource,
    count: options.count
  });
  const responseSource = suggestions.some((suggestion) => suggestion.source === "provider-ai")
    ? "provider-ai"
    : suggestions[0]?.source || "mock-ai";
  return {
    schemaVersion: QUICK_ACTION_SCHEMA_VERSION,
    sessionId: cleanText(worldState.sessionId, "", 80),
    generatedAtTurn: clampInteger(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    source: responseSource,
    status: "ready",
    stale: false,
    quickActionSuggestions: suggestions
  };
}

function assertQuickActionSafe(value, options = {}) {
  const serialized = JSON.stringify(value);
  if (SENSITIVE_QUICK_ACTION_PATTERN.test(serialized)) {
    throw new Error("quick action payload contains forbidden source text");
  }
  return true;
}

module.exports = {
  QUICK_ACTION_MAX_COUNT,
  QUICK_ACTION_SCHEMA_VERSION,
  assertQuickActionSafe,
  buildLocalQuickActionResponse,
  buildLocalQuickActionSuggestions,
  buildQuickActionContext,
  buildQuickActionResponse,
  normalizeQuickActionProviderPayload,
  normalizeQuickActionRequest
};
