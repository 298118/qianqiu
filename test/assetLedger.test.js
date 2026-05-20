const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyResourceDelta,
  buildAssetLedgerView,
  buildResourceLedgerView,
  clampResourceAmount,
  createDeterministicInitialAssetLedger,
  normalizeAssetLedger
} = require("../src/game/assetLedger");

test("S81.2 deterministic asset ledger is stable and JSON serializable", () => {
  const first = createDeterministicInitialAssetLedger({ role: "scholar", playerActorId: "player" });
  const second = createDeterministicInitialAssetLedger({ role: "scholar", playerActorId: "player" });

  assert.deepEqual(first, second);
  assert.equal(JSON.parse(JSON.stringify(first)).schemaVersion, 1);
  assert.ok(first.resourceAccounts.some((account) => account.resourceId === "silver_liang"));
  assert.ok(first.assets.some((asset) => asset.assetType === "study"));
});

test("S81.2 resource ledger clamps unsafe or extreme values", () => {
  assert.deepEqual(clampResourceAmount("silver_liang", 999999999), {
    accepted: true,
    amount: 100000,
    min: 0,
    max: 100000,
    clamped: true
  });
  assert.equal(clampResourceAmount("official_reputation", -999).amount, -100);
  assert.equal(clampResourceAmount("unknown_resource", 10).accepted, false);

  const ledger = createDeterministicInitialAssetLedger({ role: "official" });
  const result = applyResourceDelta(ledger, "silver_liang", 999999999, { ownerActorId: "player", turn: 3 });
  assert.equal(result.accepted, true);
  assert.equal(result.after, 100000);
  assert.equal(result.clamped, true);
  assert.equal(result.ledger.resourceAccounts.find((account) => account.resourceId === "silver_liang").updatedTurn, 3);
});

test("S81.2 asset view strips hidden/raw-like fields and polluted labels", () => {
  const ledger = normalizeAssetLedger({
    ownerActorId: "player",
    resourceAccounts: [{
      resourceId: "silver_liang",
      ownerActorId: "player",
      amount: 25,
      hiddenNotes: "SEALED_S81_2_RESOURCE"
    }],
    assets: [{
      assetId: "asset:visible-estate",
      assetType: "estate",
      name: "城南宅院",
      ownerActorId: "player",
      locationRef: "home:south",
      hiddenValue: 999999,
      rawLedger: "SEALED_S81_2_RAW",
      provenance: [{ ref: "opening", label: "家传产业", turn: 0 }]
    }, {
      assetId: "asset:hidden-estate",
      assetType: "estate",
      name: "SEALED_S81_2_HIDDEN_ESTATE",
      ownerActorId: "player",
      visibility: "hidden",
      provenance: [{ ref: "hidden", label: "SEALED_S81_2_HIDDEN_PROVENANCE", turn: 0 }]
    }, {
      assetId: "asset:polluted",
      assetType: "shop",
      name: "prompt_retrieval_index /mnt/e/secret sk-test-s81-2",
      ownerActorId: "player",
      locationRef: "world_sessions raw_table people_assets"
    }]
  });

  const payload = JSON.stringify({
    assetLedgerView: buildAssetLedgerView(ledger),
    resourceLedgerView: buildResourceLedgerView(ledger)
  });

  assert.match(payload, /城南宅院|白银|服务器裁决/);
  assert.doesNotMatch(payload, /SEALED_S81_2|hiddenValue|rawLedger|prompt_retrieval_index|world_sessions|sk-test-s81-2|\/mnt\/e/);
});

test("S81.2 official initial ledger exposes role-limited assets only through safe summaries", () => {
  const ledger = createDeterministicInitialAssetLedger({ role: "official", playerActorId: "player" });
  const view = buildAssetLedgerView(ledger, { viewerActorId: "player" });
  const payload = JSON.stringify(view);

  assert.ok(view.assets.some((asset) => asset.assetType === "treasury"));
  assert.match(payload, /官署库房摘要|official_property/);
  assert.doesNotMatch(payload, /hiddenNotes|hiddenIntent|raw|provider|proposal|prompt|api_key/i);
});
