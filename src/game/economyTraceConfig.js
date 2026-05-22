const ECONOMY_TRACE_SCHEMA_VERSION = "s88.8-economy-trace.v1";

const ECONOMY_TRACE_CONFIG = Object.freeze({
  maxTraceItems: 18,
  maxGroupItems: 8,
  maxFeedbackChanges: 8,
  maxResourceItems: 4,
  maxAssetItems: 4,
  maxInventoryItems: 4,
  maxTradeItems: 6,
  maxDelegatedTaskItems: 6,
  maxMarketSignals: 4,
  maxMonthlyEvents: 4,
  maxAffectedLabels: 4,
  maxEvidenceRefs: 4,
  maxTitleLength: 72,
  maxSummaryLength: 180,
  maxNextStepLength: 160
});

module.exports = {
  ECONOMY_TRACE_CONFIG,
  ECONOMY_TRACE_SCHEMA_VERSION
};
