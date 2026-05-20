const { randomUUID } = require("node:crypto");
const {
  TRADE_LEDGER_CONFIG,
  TRADE_LEDGER_SCHEMA_VERSION,
  TRADE_STATUSES
} = require("./tradeLedgerConfig");
const {
  ensureAssetLedgerState
} = require("./assetLedger");
const { ensureInventoryLedgerState } = require("./inventoryLedger");
const { ensureNpcRoster, getNpcForServer } = require("./npcRoster");

const UNSAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt|state)|worldState|provider|proposal|prompt|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|sqlite|world_sessions|prompt_retrieval_index|event_archive_index|ai_change_proposals|event_log|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = TRADE_LEDGER_CONFIG.maxTextLength) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || UNSAFE_TEXT_PATTERN.test(text)) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function wasNonEmptyTextDropped(value, sanitized) {
  return typeof value === "string" && value.trim() && !sanitized;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function createInitialTradeLedger(worldState = {}) {
  return {
    schemaVersion: TRADE_LEDGER_SCHEMA_VERSION,
    ownerActorId: cleanId(worldState.player?.id || "player", "player"),
    records: []
  };
}

function ensureTradeLedger(worldState = {}) {
  if (!isPlainObject(worldState.tradeLedger) || worldState.tradeLedger.schemaVersion !== TRADE_LEDGER_SCHEMA_VERSION) {
    worldState.tradeLedger = createInitialTradeLedger(worldState);
  }
  return worldState.tradeLedger;
}

function normalizeTradeStatus(value) {
  const status = cleanText(value, "proposed", 40);
  return TRADE_STATUSES.includes(status) ? status : "proposed";
}

function buildTradeNegotiationContext(worldState = {}, request = {}) {
  ensureNpcRoster(worldState);
  const npcId = cleanId(request.npcId, "");
  const npc = getNpcForServer(worldState, npcId);
  return {
    sessionId: worldState.sessionId,
    tradeId: cleanId(request.tradeId, `trade:${randomUUID()}`),
    npcId,
    npcName: cleanText(npc?.displayName, "未知人物", 80),
    playerRole: cleanText(worldState.player?.role, "scholar", 40),
    requestedItemRefs: Array.isArray(request.itemRefs)
      ? request.itemRefs.map((entry) => cleanId(entry, "")).filter(Boolean).slice(0, 8)
      : [],
    requestedSilverDelta: clampNumber(request.silverDelta, -TRADE_LEDGER_CONFIG.maxSingleTradeSilverLiang, TRADE_LEDGER_CONFIG.maxSingleTradeSilverLiang, 0),
    offerSummary: cleanText(request.offerSummary, "", 160),
    serverBoundaries: [
      "AI 只能议价和给出公开建议，成交、扣款、物品转移和关系变化由服务器裁决。",
      "交易不得暴露 NPC hiddenDossier、raw provider payload、prompt、本地路径或密钥。"
    ]
  };
}

function validateTradeRequest(worldState = {}, request = {}) {
  ensureNpcRoster(worldState);
  const assetLedger = ensureAssetLedgerState(worldState);
  const inventoryLedger = ensureInventoryLedgerState(worldState);
  const playerActorId = cleanId(worldState.player?.id || "player", "player");
  const npcId = cleanId(request.npcId, "");
  const npc = getNpcForServer(worldState, npcId);
  const itemRefs = Array.isArray(request.itemRefs)
    ? request.itemRefs.map((entry) => cleanId(entry, "")).filter(Boolean).slice(0, 8)
    : [];
  const silverDelta = clampNumber(
    request.silverDelta,
    -TRADE_LEDGER_CONFIG.maxSingleTradeSilverLiang,
    TRADE_LEDGER_CONFIG.maxSingleTradeSilverLiang,
    0
  );
  const errors = [];
  if (!npc) errors.push("npc_not_found");
  if (npc && !npc.availableInteractions.includes("trade")) errors.push("npc_trade_not_available");
  if (Math.abs(Number(request.silverDelta || 0)) > TRADE_LEDGER_CONFIG.maxSingleTradeSilverLiang) {
    errors.push("silver_delta_exceeds_single_trade_limit");
  }
  if (silverDelta > 0 && itemRefs.length === 0) {
    errors.push("positive_silver_requires_verified_item_ref");
  }
  if (silverDelta < 0) {
    const silver = assetLedger.resourceAccounts.find((account) =>
      account.resourceId === "silver_liang" && account.ownerActorId === playerActorId
    );
    if (!silver || silver.amount + silverDelta < 0) {
      errors.push("silver_insufficient_for_offer");
    }
  }
  for (const itemRef of itemRefs) {
    const item = inventoryLedger.items.find((row) => row.itemId === itemRef);
    if (!item) {
      errors.push("trade_item_not_found");
      continue;
    }
    if (item.ownerActorId !== playerActorId && item.custodianActorId !== playerActorId) {
      errors.push("trade_item_not_owned_or_custodied");
    }
    if (!["tradeable", "giftable"].includes(item.transferPolicy)) {
      errors.push("trade_item_not_tradeable");
    }
    if (item.legalStatus === "contraband") {
      errors.push("trade_item_requires_case_resolution");
    }
  }
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    normalized: {
      tradeId: cleanId(request.tradeId, `trade:${randomUUID()}`),
      actorAId: playerActorId,
      actorBId: npcId,
      npcId,
      silverDelta,
      offerSummary: cleanText(request.offerSummary, "", 180),
      itemRefs
    }
  };
}

function resolveTradeRequest(worldState = {}, request = {}, aiResult = {}) {
  const validation = validateTradeRequest(worldState, request);
  const ledger = ensureTradeLedger(worldState);
  const npc = validation.normalized.npcId ? getNpcForServer(worldState, validation.normalized.npcId) : null;
  const modelStatus = validation.ok ? normalizeTradeStatus(aiResult.proposal?.status) : "server_blocked";
  let serverStatus = modelStatus;
  const reasons = [...validation.errors];
  const requestedSilverDelta = validation.normalized.silverDelta;
  const settlementDeferred = validation.ok && modelStatus === "accepted" && (
    requestedSilverDelta !== 0 || validation.normalized.itemRefs.length > 0
  );

  if (settlementDeferred) {
    serverStatus = "countered";
  }
  const npcResponse = cleanText(aiResult.npcResponse, "", 320);
  const modelPublicSummary = cleanText(aiResult.proposal?.publicSummary, "", 180);
  const riskTags = Array.isArray(aiResult.proposal?.riskTags)
    ? aiResult.proposal.riskTags.map((entry) => cleanText(entry, "", 48)).filter(Boolean).slice(0, 6)
    : [];
  const sourceRiskTagCount = Array.isArray(aiResult.proposal?.riskTags)
    ? aiResult.proposal.riskTags.filter((entry) => typeof entry === "string" && entry.trim()).length
    : 0;

  if (validation.ok && wasNonEmptyTextDropped(aiResult.npcResponse, npcResponse)) {
    reasons.push("unsafe_ai_trade_response");
  }
  if (validation.ok && wasNonEmptyTextDropped(aiResult.proposal?.publicSummary, modelPublicSummary)) {
    reasons.push("unsafe_ai_trade_summary");
  }
  if (validation.ok && sourceRiskTagCount > riskTags.length) {
    reasons.push("unsafe_ai_trade_risk_tags");
  }

  const record = {
    tradeId: validation.normalized.tradeId,
    turn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    actorAId: validation.normalized.actorAId,
    actorBId: validation.normalized.actorBId,
    npcId: validation.normalized.npcId,
    npcName: cleanText(npc?.displayName, "未知人物", 80),
    status: reasons.length ? "server_blocked" : serverStatus,
    offerSummary: validation.normalized.offerSummary,
    itemRefs: validation.normalized.itemRefs,
    requestedSilverDelta,
    npcResponse: reasons.length ? "" : npcResponse,
    publicSummary: modelPublicSummary || cleanText(
      "",
      reasons.length
        ? "交易被服务器规则挡下。"
        : settlementDeferred
          ? "交易议价已记录；银钱与物品须经服务器结算路径另行办理。"
          : "交易已记录，结果以服务器裁决为准。",
      180
    ),
    serverReasons: reasons,
    settlementApplied: false,
    serverSettlement: {
      resourceDeltaApplied: false,
      itemTransferApplied: false,
      boundary: "AI 只生成议价和公开建议；银钱、物品、所有权与关系后果必须由服务器可审计结算路径另行执行。"
    },
    riskTags: reasons.length ? [] : riskTags
  };
  ledger.records.push(record);
  ledger.records = ledger.records.slice(-TRADE_LEDGER_CONFIG.maxTradeRecords);
  return {
    ok: !record.serverReasons.length,
    errors: record.serverReasons,
    record,
    tradeLedgerView: buildTradeLedgerView(worldState)
  };
}

function buildTradeLedgerView(worldState = {}, options = {}) {
  const ledger = ensureTradeLedger(worldState);
  const npcId = cleanId(options.npcId, "");
  const items = ledger.records
    .filter((record) => !npcId || record.npcId === npcId)
    .slice(-TRADE_LEDGER_CONFIG.maxTradeViewItems)
    .reverse()
    .map((record) => ({
      tradeId: record.tradeId,
      turn: record.turn,
      actorAId: record.actorAId,
      actorBId: record.actorBId,
      npcId: record.npcId,
      npcName: record.npcName,
      status: record.status,
      offerSummary: record.offerSummary,
      itemRefs: record.itemRefs,
      requestedSilverDelta: record.requestedSilverDelta,
      npcResponse: record.npcResponse,
      publicSummary: record.publicSummary,
      serverReasons: record.serverReasons,
      settlementApplied: record.settlementApplied,
      serverSettlement: record.serverSettlement,
      riskTags: record.riskTags
    }));
  return {
    schemaVersion: TRADE_LEDGER_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: items.length,
    items,
    safeguards: {
      serverOwnsSettlement: true,
      hiddenInventoryRedacted: true,
      rawAiPayloadRedacted: true
    }
  };
}

module.exports = {
  buildTradeLedgerView,
  buildTradeNegotiationContext,
  createInitialTradeLedger,
  ensureTradeLedger,
  resolveTradeRequest,
  validateTradeRequest
};
