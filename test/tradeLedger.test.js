const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { ensureAssetLedgerState } = require("../src/game/assetLedger");
const { ensureInventoryLedgerState } = require("../src/game/inventoryLedger");
const { resolveTradeRequest } = require("../src/game/tradeLedger");

function playerSilver(worldState) {
  const ledger = ensureAssetLedgerState(worldState);
  return ledger.resourceAccounts.find((account) =>
    account.resourceId === "silver_liang" && account.ownerActorId === worldState.player.id
  )?.amount;
}

test("S83 trade settlement rejects positive silver without verified item consideration", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "交易边界测试" });
  const before = playerSilver(worldState);

  const result = resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:safety:mint",
    silverDelta: 500,
    offerSummary: "空口索取白银。"
  }, {
    npcResponse: "可。",
    proposal: {
      status: "accepted",
      publicSummary: "AI 声称成交。",
      riskTags: []
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.record.status, "server_blocked");
  assert.equal(result.record.settlementApplied, false);
  assert.ok(result.errors.includes("positive_silver_requires_verified_item_ref"));
  assert.equal(playerSilver(worldState), before);
});

test("S83 trade accepted by AI records negotiation but never mutates resources directly", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "交易议价测试" });
  const inventory = ensureInventoryLedgerState(worldState);
  const item = inventory.items.find((row) => row.transferPolicy === "tradeable");
  const before = playerSilver(worldState);

  const result = resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:safety:defer",
    silverDelta: 50,
    itemRefs: [item.itemId],
    offerSummary: "以随身书册议价。"
  }, {
    npcResponse: "可先记下，待验货再议。",
    proposal: {
      status: "accepted",
      publicSummary: "对方愿按此价议成。",
      riskTags: ["需验货"]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.status, "countered");
  assert.equal(result.record.actorAId, worldState.player.id);
  assert.equal(result.record.actorBId, "npc:magistrate:gentry-han");
  assert.equal(result.record.settlementApplied, false);
  assert.equal(result.record.serverSettlement.resourceDeltaApplied, false);
  assert.equal(result.record.serverSettlement.itemTransferApplied, false);
  assert.equal(playerSilver(worldState), before);
});

test("S83 trade ledger rejects unsafe AI negotiation text", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "交易文本安全测试" });
  const result = resolveTradeRequest(worldState, {
    npcId: "npc:magistrate:gentry-han",
    tradeId: "trade:safety:text",
    silverDelta: 0,
    offerSummary: "询问纸张价格。"
  }, {
    npcResponse: "hiddenDossier raw prompt sk-testsecret",
    proposal: {
      status: "countered",
      publicSummary: "可再议。",
      riskTags: []
    }
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.record.status, "server_blocked");
  assert.ok(result.errors.includes("unsafe_ai_trade_response"));
  assert.equal(result.record.npcResponse, "");
  assert.doesNotMatch(serialized, /hiddenDossier raw|raw prompt|sk-testsecret/);
});
