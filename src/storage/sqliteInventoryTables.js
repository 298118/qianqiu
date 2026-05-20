const { createHash } = require("node:crypto");

const {
  buildInventoryView,
  normalizeInventoryLedger
} = require("../game/inventoryLedger");

const INVENTORY_TABLE_DOMAIN_SCHEMA_VERSION = 1;
const INVENTORY_TABLE_SOURCE = "inventory_ledger_safe_projection";

const UNSAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function stringifyJson(value, fallback) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function normalizeForStableJson(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeForStableJson(entry));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((normalized, key) => {
    normalized[key] = normalizeForStableJson(value[key]);
    return normalized;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalizeForStableJson(value));
}

function hashRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

function attachRowHash(row) {
  return {
    ...row,
    metadata_json: stringifyJson({
      ...parseJsonObject(row.metadata_json),
      contentHash: hashRow(row)
    }, {})
  };
}

function text(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || UNSAFE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function idText(value, fallback = "") {
  return text(value, fallback, 120).replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function cleanList(values, limit = 10) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = text(value, "", 96);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function metadataValue(record, key, fallback = 0) {
  return integer(record.metadata?.[key] ?? record.worldState?.[key], fallback);
}

function initializeInventoryTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS inventory_containers (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      owner_actor_id TEXT NOT NULL,
      custodian_actor_id TEXT NOT NULL,
      container_type TEXT NOT NULL,
      label TEXT NOT NULL,
      location_ref TEXT NOT NULL,
      capacity_weight INTEGER NOT NULL,
      current_weight INTEGER NOT NULL,
      locked INTEGER NOT NULL,
      visibility TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_inventory_containers_session_owner
      ON inventory_containers(session_id, owner_actor_id, container_type);

    CREATE TABLE IF NOT EXISTS inventory_items (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      owner_actor_id TEXT NOT NULL,
      custodian_actor_id TEXT NOT NULL,
      container_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      legal_status TEXT NOT NULL,
      transfer_policy TEXT NOT NULL,
      important INTEGER NOT NULL,
      credential INTEGER NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_inventory_items_session_container
      ON inventory_items(session_id, container_id, category);
  `);
}

function buildInventoryRows(record) {
  const ledger = normalizeInventoryLedger(record.worldState || {});
  const view = buildInventoryView(ledger, { viewerActorId: ledger.ownerActorId, includeRoleLimited: true });
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  return {
    containers: view.containers.map((container) => ({
      session_id: record.sessionId,
      row_id: idText(container.containerId, "container"),
      domain_schema_version: INVENTORY_TABLE_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: INVENTORY_TABLE_SOURCE,
      owner_actor_id: idText(container.ownerActorId, "player"),
      custodian_actor_id: idText(container.custodianActorId, container.ownerActorId || "player"),
      container_type: idText(container.type, "container"),
      label: text(container.label, "容器", 80),
      location_ref: text(container.locationRef, "", 96),
      capacity_weight: integer(container.capacityWeight, 0),
      current_weight: integer(container.currentWeight, 0),
      locked: container.locked ? 1 : 0,
      visibility: text(container.visibility, "safe_summary", 40),
      summary: `${text(container.label, "容器", 80)}：${integer(container.currentWeight, 0)}/${integer(container.capacityWeight, 0)} 承重`,
      refs_json: stringifyJson(cleanList([container.containerId, container.locationRef], 6), []),
      metadata_json: stringifyJson({ generatedAtTurn, sourceView: "inventoryView.containers" }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    })),
    items: view.items.map((item) => ({
      session_id: record.sessionId,
      row_id: idText(item.itemId, "item"),
      domain_schema_version: INVENTORY_TABLE_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: INVENTORY_TABLE_SOURCE,
      owner_actor_id: idText(item.ownerActorId, "player"),
      custodian_actor_id: idText(item.custodianActorId, item.ownerActorId || "player"),
      container_id: idText(item.containerId, "container"),
      template_id: idText(item.templateId, "template"),
      item_name: text(item.name, "物品", 80),
      category: idText(item.category, "misc"),
      quantity: integer(item.quantity, 1),
      unit: text(item.unit, "", 24),
      legal_status: text(item.legalStatus, "unknown", 48),
      transfer_policy: text(item.transferPolicy, "server_only", 48),
      important: item.important ? 1 : 0,
      credential: item.credential ? 1 : 0,
      summary: `${text(item.name, "物品", 80)} x${integer(item.quantity, 1)}${text(item.unit, "", 24)}，${text(item.condition, "可用", 40)}`,
      refs_json: stringifyJson(cleanList([
        item.itemId,
        item.containerId,
        ...(item.effects || []),
        ...(item.provenance || []).map((entry) => entry.ref)
      ], 12), []),
      metadata_json: stringifyJson({
        generatedAtTurn,
        sourceView: "inventoryView.items",
        quality: integer(item.quality, 0),
        durability: integer(item.durability, 0),
        rarity: text(item.rarity, "", 32)
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    }))
  };
}

function deleteInventoryRows(database, sessionId) {
  database.prepare("DELETE FROM inventory_items WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM inventory_containers WHERE session_id = ?").run(sessionId);
}

function insertRow(database, tableName, row) {
  const safeRow = attachRowHash(row);
  const columns = Object.keys(safeRow);
  database
    .prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...columns.map((column) => safeRow[column]));
}

function syncInventoryTables(database, record) {
  deleteInventoryRows(database, record.sessionId);
  const rows = buildInventoryRows(record);
  for (const row of rows.containers) insertRow(database, "inventory_containers", row);
  for (const row of rows.items) insertRow(database, "inventory_items", row);
}

function tableStatus(database, tableName, sessionId, revision, expectedRows) {
  const count = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get(sessionId).count;
  const missingOrMismatched = count !== expectedRows.length;
  const staleRows = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ? AND revision <> ?`)
    .get(sessionId, revision).count > 0;
  const storedRows = database.prepare(`SELECT * FROM ${tableName} WHERE session_id = ?`).all(sessionId);
  const expectedIds = new Set(expectedRows.map((row) => row.row_id));
  const mismatchedRowIds = !missingOrMismatched &&
    (storedRows.length !== expectedIds.size || storedRows.some((row) => !expectedIds.has(row.row_id)));
  const expectedById = new Map(expectedRows.map((row) => [row.row_id, row]));
  const contentMismatches = !missingOrMismatched && !mismatchedRowIds && storedRows.some((row) => {
    const metadata = parseJsonObject(row.metadata_json);
    const expected = expectedById.get(row.row_id);
    return !expected || !metadata.contentHash || metadata.contentHash !== hashRow(row) || metadata.contentHash !== hashRow(expected);
  });
  const tableNeedsRepair = missingOrMismatched || staleRows || mismatchedRowIds || contentMismatches;
  return { contentMismatches, count, expectedCount: expectedRows.length, missingOrMismatched, mismatchedRowIds, staleRows, tableNeedsRepair };
}

function getInventoryRepairStatus(database, record) {
  const expected = buildInventoryRows(record);
  const tables = {
    inventory_containers: tableStatus(database, "inventory_containers", record.sessionId, record.revision, expected.containers),
    inventory_items: tableStatus(database, "inventory_items", record.sessionId, record.revision, expected.items)
  };
  const needsRepair = Object.values(tables).some((status) => status.tableNeedsRepair);
  return {
    needsRepair,
    tableNeedsRepair: needsRepair,
    tables,
    count: Object.values(tables).reduce((sum, status) => sum + status.count, 0),
    expectedCount: Object.values(tables).reduce((sum, status) => sum + status.expectedCount, 0),
    missingOrMismatched: Object.values(tables).some((status) => status.missingOrMismatched),
    mismatchedRowIds: Object.values(tables).some((status) => status.mismatchedRowIds),
    staleRows: Object.values(tables).some((status) => status.staleRows),
    contentMismatches: Object.values(tables).some((status) => status.contentMismatches)
  };
}

function ensureInventoryTablesForRecord(database, record) {
  const status = getInventoryRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncInventoryTables(database, record);
    return true;
  }
  return false;
}

module.exports = {
  INVENTORY_TABLE_DOMAIN_SCHEMA_VERSION,
  INVENTORY_TABLE_SOURCE,
  buildInventoryRows,
  deleteInventoryRows,
  ensureInventoryTablesForRecord,
  getInventoryRepairStatus,
  initializeInventoryTables,
  syncInventoryTables
};
