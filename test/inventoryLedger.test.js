const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildInventoryView,
  canTransferItem,
  createDeterministicInitialInventoryLedger,
  createItemFromTemplate,
  normalizeInventoryLedger,
  transferItem
} = require("../src/game/inventoryLedger");

test("S81.2 deterministic inventory ledger is stable and JSON serializable", () => {
  const first = createDeterministicInitialInventoryLedger({ role: "scholar", playerActorId: "player" });
  const second = createDeterministicInitialInventoryLedger({ role: "scholar", playerActorId: "player" });

  assert.deepEqual(first, second);
  assert.equal(JSON.parse(JSON.stringify(first)).schemaVersion, 1);
  assert.ok(first.containers.some((container) => container.type === "personal"));
  assert.ok(first.items.some((item) => item.templateId === "book_four_books"));
});

test("S81.2 invalid item templates are rejected and do not enter safe view", () => {
  assert.equal(createItemFromTemplate("not_a_real_template").accepted, false);

  const ledger = normalizeInventoryLedger({
    ownerActorId: "player",
    containers: [{ type: "personal", ownerActorId: "player" }],
    items: [{
      itemId: "item:invalid",
      templateId: "not_a_real_template",
      name: "SEALED_S81_2_INVALID_ITEM",
      ownerActorId: "player",
      containerId: "container:player:personal"
    }]
  });
  const payload = JSON.stringify(buildInventoryView(ledger));

  assert.equal(ledger.items.length, 0);
  assert.doesNotMatch(payload, /SEALED_S81_2_INVALID_ITEM|not_a_real_template/);
});

test("S81.2 bound credentials and server-only documents cannot be moved by browser-like requests", () => {
  const officialLedger = createDeterministicInitialInventoryLedger({ role: "official", playerActorId: "player" });
  const seal = officialLedger.items.find((item) => item.templateId === "official_seal_county");
  const sealDecision = canTransferItem(officialLedger, {
    actorId: "player",
    itemId: seal.itemId,
    toContainerId: "container:player:personal"
  });

  assert.equal(sealDecision.accepted, false);
  assert.equal(sealDecision.reason, "bound_office_credential_cannot_leave_office_storage");

  const deed = createItemFromTemplate("deed_estate", {
    ownerActorId: "player",
    itemId: "item:player:deed",
    containerId: "container:player:home_storage"
  }).item;
  const ledger = normalizeInventoryLedger({
    ownerActorId: "player",
    containers: [
      { type: "personal", ownerActorId: "player" },
      { type: "home_storage", ownerActorId: "player" }
    ],
    items: [deed]
  });
  const deedDecision = transferItem(ledger, {
    actorId: "player",
    itemId: "item:player:deed",
    toContainerId: "container:player:personal"
  });

  assert.equal(deedDecision.accepted, false);
  assert.equal(deedDecision.reason, "server_only_transfer_policy");
});

test("S81.2 contraband is hidden from player view and cannot transfer without server case resolution", () => {
  const contraband = createItemFromTemplate("forged_seal", {
    ownerActorId: "player",
    itemId: "item:player:forged-seal",
    containerId: "container:player:home_storage",
    provenance: [{ ref: "hidden-case", label: "hiddenNotes provider prompt sk-test-s81-2", turn: 0 }]
  }).item;
  const ledger = normalizeInventoryLedger({
    ownerActorId: "player",
    containers: [
      { type: "personal", ownerActorId: "player" },
      { type: "home_storage", ownerActorId: "player" }
    ],
    items: [contraband]
  });

  const viewPayload = JSON.stringify(buildInventoryView(ledger));
  const decision = canTransferItem(ledger, {
    actorId: "player",
    itemId: "item:player:forged-seal",
    toContainerId: "container:player:personal"
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, "contraband_requires_server_case_resolution");
  assert.doesNotMatch(viewPayload, /伪造关防|forged-seal|hiddenNotes|provider|prompt|sk-test-s81-2/);
});

test("S81.2 safe inventory view exposes important credential summaries without hidden/raw leakage", () => {
  const ledger = createDeterministicInitialInventoryLedger({ role: "official", playerActorId: "player" });
  ledger.items.push(createItemFromTemplate("book_law_code", {
    ownerActorId: "player",
    itemId: "item:player:polluted-book",
    containerId: "container:player:personal",
    name: "raw_table world_sessions /mnt/e/secret prompt_retrieval_index",
    provenance: [{ ref: "visible", label: "data/sessions/provider/proposal", turn: 0 }]
  }).item);

  const view = buildInventoryView(ledger, { viewerActorId: "player" });
  const payload = JSON.stringify(view);

  assert.ok(view.importantCredentials.some((item) => item.legalStatus === "official_seal"));
  assert.match(payload, /县印|绑定官署|服务器裁决/);
  assert.doesNotMatch(payload, /raw_table|world_sessions|\/mnt\/e|prompt_retrieval_index|data\/sessions|provider|proposal|hiddenDossier/);
});

test("S81.2 tradeable items transfer only after capacity and ownership checks", () => {
  const ledger = createDeterministicInitialInventoryLedger({ role: "scholar", playerActorId: "player" });
  const book = ledger.items.find((item) => item.templateId === "book_four_books");
  const accepted = transferItem(ledger, {
    actorId: "player",
    itemId: book.itemId,
    toContainerId: "container:player:home_storage",
    auditRef: "test:move-book",
    turn: 2
  });
  const rejected = transferItem(ledger, {
    actorId: "npc:other",
    itemId: book.itemId,
    toContainerId: "container:player:home_storage"
  });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.ledger.items.find((item) => item.itemId === book.itemId).containerId, "container:player:home_storage");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "actor_not_owner_or_custodian");
});
