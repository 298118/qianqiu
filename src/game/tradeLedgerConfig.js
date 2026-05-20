const TRADE_LEDGER_SCHEMA_VERSION = "s83.trade-ledger.v1";

const TRADE_STATUSES = Object.freeze([
  "proposed",
  "countered",
  "accepted",
  "rejected",
  "server_blocked"
]);

const TRADE_LEDGER_CONFIG = Object.freeze({
  maxTradeRecords: 120,
  maxTradeViewItems: 30,
  maxTextLength: 220,
  maxSingleTradeSilverLiang: 500,
  statuses: TRADE_STATUSES
});

module.exports = {
  TRADE_LEDGER_CONFIG,
  TRADE_LEDGER_SCHEMA_VERSION,
  TRADE_STATUSES
};
