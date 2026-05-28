// @ts-check

const { validatePayload } = require("../schemas");
const { redactAiProviderText } = require("../providerSafety");
const { getRuntimeTaskConfig, normalizeTaskKind } = require("../providers/adapterContract");

const FALLBACK_SCHEMA_VERSION = "s92.2-ai-fallback-policy.v1";
const TOPIC_DRAFT_SURFACE_IDS = Object.freeze([
  "memorial-review",
  "edict-draft",
  "court-debate",
  "trial",
  "war-council",
  "npc-profile"
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readContext(envelope) {
  return isPlainObject(envelope?.context) ? envelope.context : {};
}

function readNestedContext(envelope, key) {
  const context = readContext(envelope);
  return isPlainObject(context[key]) ? context[key] : context;
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maxLength);
}

function cleanList(value, limit, maxLength) {
  return Array.isArray(value)
    ? value
      .map((entry) => cleanText(entry?.refId || entry, "", maxLength))
      .filter(Boolean)
      .slice(0, limit)
    : [];
}

function buildOpeningFallback(envelope) {
  const worldState = readNestedContext(envelope, "worldState");
  const dynasty = cleanText(worldState.dynasty, "本朝", 24);
  const year = cleanText(worldState.year, "元年", 16);
  const player = isPlainObject(worldState.player) ? worldState.player : {};
  const playerName = cleanText(player.name, "案主", 24);
  const roleLabel = cleanText(player.roleLabel || player.role, "局中人", 24);

  return {
    narrative: `${dynasty}${year}，${playerName}以${roleLabel}之身启卷。AI 编排暂由本地样例接管，只铺陈可见处境与下一步行止，不写入额外身份、资源或隐藏事实。`,
    events: [`${dynasty}${year}，${playerName}开卷，候服务器按安全规则裁决后续。`]
  };
}

function buildQuickActionFallback(envelope) {
  const quickActionContext = readNestedContext(envelope, "quickActionContext");
  const player = isPlainObject(quickActionContext.player) ? quickActionContext.player : {};
  const role = cleanText(player.role, "official", 24);
  const evidenceRefs = cleanList(quickActionContext.evidenceRefs, 1, 120);
  const title = role === "scholar" ? "温书" : "阅牍";
  const text = role === "scholar"
    ? "温习经义并整理一页策论提纲，准备下一步请教师友。"
    : "查阅公开案牍与近事摘要，整理本旬可呈主卷的稳妥行动。";

  return {
    quickActionSuggestions: [{
      source: "mock-ai",
      title,
      label: title,
      text,
      roleTags: [role, "generic"].slice(0, 2),
      toolIntent: role === "scholar" ? "study" : "office",
      evidenceRefs
    }]
  };
}

function buildTopicDraftFallback(envelope) {
  const topicDraftContext = readNestedContext(envelope, "topicDraftContext");
  const rawSurfaceId = cleanText(topicDraftContext.surfaceId, "memorial-review", 64);
  const surfaceId = TOPIC_DRAFT_SURFACE_IDS.includes(rawSurfaceId) ? rawSurfaceId : "memorial-review";
  const draftKind = cleanText(topicDraftContext.draftKind, "topic_draft", 64);
  const draftLabel = cleanText(topicDraftContext.draftLabel || topicDraftContext.surfaceTitle, "专题草稿", 48);
  const selectedRefs = cleanList(topicDraftContext.selectedEvidenceRefs, 5, 140);
  const fallbackRefs = cleanList(topicDraftContext.evidenceRefs, 5, 140);

  return {
    surfaceId,
    draftKind,
    draftTitle: draftLabel,
    draftText: `据当前公开材料拟成初稿：先列事实，再请有司复核；凡任免、赏罚、结案、战和、钱粮处置与关系后果，仍候玩家呈上主卷后由服务器裁决。`,
    evidenceRefs: selectedRefs.length ? selectedRefs : fallbackRefs,
    riskNote: "本地 fallback 只供编辑，不推进时间、不调用裁决器、不写入案卷状态。",
    nextStep: "玩家可删改措辞后写入主卷，再候服务器回批。",
    source: "mock-ai"
  };
}

function buildAiFallbackPayload(envelope, reason = "provider_failed") {
  const taskKind = normalizeTaskKind(envelope?.taskKind);
  const config = getRuntimeTaskConfig(taskKind);
  const payloadByKind = {
    opening: buildOpeningFallback,
    quick_action: buildQuickActionFallback,
    topic_draft: buildTopicDraftFallback
  };
  const builder = payloadByKind[taskKind];
  if (!builder) {
    throw new Error(`No AI fallback payload builder for ${taskKind}.`);
  }
  const payload = builder(envelope, redactAiProviderText(reason));
  return validatePayload(config.schemaName, payload);
}

function summarizeFallbackDecision(envelope, reason) {
  const taskKind = normalizeTaskKind(envelope?.taskKind);
  return {
    schemaVersion: FALLBACK_SCHEMA_VERSION,
    taskKind,
    fallbackProvider: "mock",
    fallbackReason: redactAiProviderText(reason, { maxLength: 120 }) || "provider_failed",
    applied: true
  };
}

module.exports = {
  FALLBACK_SCHEMA_VERSION,
  TOPIC_DRAFT_SURFACE_IDS,
  buildAiFallbackPayload,
  summarizeFallbackDecision
};
