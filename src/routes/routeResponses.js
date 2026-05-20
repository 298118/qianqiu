// @ts-check

/**
 * 本文件只提供 route response 的类型化 identity helpers。
 * 大型 route 仍保持 CommonJS 运行；这里用局部 JSDoc 把 public payload
 * 对齐到 `src/contracts/serverContracts.ts`，避免为了类型覆盖给整条 route
 * 开启 whole-file `@ts-check`。
 */

const RAW_LEDGER_KEYS = Object.freeze([
  "actorMemoryLedger",
  "sessionSummary",
  "assetLedger",
  "resourceLedger",
  "inventoryLedger",
  "npcRoster",
  "delegatedTaskLedger",
  "npcInteractionLedger",
  "tradeLedger",
  "openingBackgroundClaims",
  "marketPriceLedger",
  "npcEconomyLedger",
  "npcActiveRequestLedger"
]);

/**
 * route 里的兼容 worldState 只能是 public-safe clone；真实 ledger 和内部摘要
 * 必须通过独立 safe view 暴露。
 *
 * @param {unknown} worldState
 */
function assertRouteWorldStateIsPublic(worldState) {
  if (!worldState || typeof worldState !== "object") return;
  for (const key of RAW_LEDGER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(worldState, key)) {
      throw new Error(`Route response worldState contains raw ledger key: ${key}`);
    }
  }
}

/**
 * @param {import("../contracts/serverContracts").CommonTurnViews} views
 * @returns {import("../contracts/serverContracts").CommonTurnViews}
 */
function defineCommonTurnViews(views) {
  return views;
}

/**
 * @param {import("../contracts/serverContracts").GameStartResponse} payload
 * @returns {import("../contracts/serverContracts").GameStartResponse}
 */
function defineGameStartResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").GameStateResponse} payload
 * @returns {import("../contracts/serverContracts").GameStateResponse}
 */
function defineGameStateResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").PlayerStateResponse} payload
 * @returns {import("../contracts/serverContracts").PlayerStateResponse}
 */
function definePlayerStateResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").TopicSurfaceResponse} payload
 * @returns {import("../contracts/serverContracts").TopicSurfaceResponse}
 */
function defineTopicSurfaceResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").SafeWorldSearchResponse} payload
 * @returns {import("../contracts/serverContracts").SafeWorldSearchResponse}
 */
function defineSafeWorldSearchResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").SavesResponse} payload
 * @returns {import("../contracts/serverContracts").SavesResponse}
 */
function defineSavesResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").InventoryResponse} payload
 * @returns {import("../contracts/serverContracts").InventoryResponse}
 */
function defineInventoryResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").InventoryTransferResponse} payload
 * @returns {import("../contracts/serverContracts").InventoryTransferResponse}
 */
function defineInventoryTransferResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").NpcListResponse} payload
 * @returns {import("../contracts/serverContracts").NpcListResponse}
 */
function defineNpcListResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").NpcDetailResponse} payload
 * @returns {import("../contracts/serverContracts").NpcDetailResponse}
 */
function defineNpcDetailResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").NpcInteractionResponse} payload
 * @returns {import("../contracts/serverContracts").NpcInteractionResponse}
 */
function defineNpcInteractionResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").TradeResponse} payload
 * @returns {import("../contracts/serverContracts").TradeResponse}
 */
function defineTradeResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").NpcCommandResponse} payload
 * @returns {import("../contracts/serverContracts").NpcCommandResponse}
 */
function defineNpcCommandResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").GameTurnResponse} payload
 * @returns {import("../contracts/serverContracts").GameTurnResponse}
 */
function defineGameTurnResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").GameTurnSseStatePreviewResponse} payload
 * @returns {import("../contracts/serverContracts").GameTurnSseStatePreviewResponse}
 */
function defineGameTurnSseStatePreviewResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").ExamQuestionResponse} payload
 * @returns {import("../contracts/serverContracts").ExamQuestionResponse}
 */
function defineExamQuestionResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").ExamProgressResponse} payload
 * @returns {import("../contracts/serverContracts").ExamProgressResponse}
 */
function defineExamProgressResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").ExamSubmitResponse} payload
 * @returns {import("../contracts/serverContracts").ExamSubmitResponse}
 */
function defineExamSubmitResponse(payload) {
  assertRouteWorldStateIsPublic(payload.worldState);
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").AiConnectionTestResponse} payload
 * @returns {import("../contracts/serverContracts").AiConnectionTestResponse}
 */
function defineAiConnectionTestResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").AiSettingsRouteResponse} payload
 * @returns {import("../contracts/serverContracts").AiSettingsRouteResponse}
 */
function defineAiSettingsRouteResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").QuickActionResponse} payload
 * @returns {import("../contracts/serverContracts").QuickActionResponse}
 */
function defineQuickActionResponse(payload) {
  return payload;
}

/**
 * @param {import("../contracts/serverContracts").TopicDraftResponse} payload
 * @returns {import("../contracts/serverContracts").TopicDraftResponse}
 */
function defineTopicDraftResponse(payload) {
  return payload;
}

module.exports = {
  RAW_LEDGER_KEYS,
  defineAiConnectionTestResponse,
  defineAiSettingsRouteResponse,
  defineCommonTurnViews,
  defineExamProgressResponse,
  defineExamQuestionResponse,
  defineExamSubmitResponse,
  defineGameStartResponse,
  defineGameStateResponse,
  defineGameTurnResponse,
  defineGameTurnSseStatePreviewResponse,
  defineInventoryResponse,
  defineInventoryTransferResponse,
  defineNpcCommandResponse,
  defineNpcDetailResponse,
  defineNpcInteractionResponse,
  defineNpcListResponse,
  definePlayerStateResponse,
  defineQuickActionResponse,
  defineSafeWorldSearchResponse,
  defineSavesResponse,
  defineTopicDraftResponse,
  defineTopicSurfaceResponse,
  defineTradeResponse
};
