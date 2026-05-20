const { createHash } = require("node:crypto");

const {
  buildAssetLedgerView,
  buildResourceLedgerView,
  normalizeAssetLedger
} = require("../game/assetLedger");

const ASSET_TABLE_DOMAIN_SCHEMA_VERSION = 1;
const ASSET_TABLE_SOURCE = "asset_ledger_safe_projection";

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

function cleanList(values, limit = 8) {
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

function initializeAssetTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS asset_resource_accounts (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      owner_actor_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      label TEXT NOT NULL,
      amount INTEGER NOT NULL,
      unit TEXT NOT NULL,
      visibility TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_asset_resource_accounts_session_owner
      ON asset_resource_accounts(session_id, owner_actor_id, resource_id);

    CREATE TABLE IF NOT EXISTS asset_long_term_assets (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      owner_actor_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      name TEXT NOT NULL,
      type_label TEXT NOT NULL,
      location_ref TEXT NOT NULL,
      legal_status TEXT NOT NULL,
      visibility TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_asset_long_term_assets_session_owner
      ON asset_long_term_assets(session_id, owner_actor_id, asset_type);
  `);
}

function buildAssetRows(record) {
  const ledger = normalizeAssetLedger(record.worldState || {});
  const resourceView = buildResourceLedgerView(ledger, { viewerActorId: ledger.ownerActorId });
  const assetView = buildAssetLedgerView(ledger, { viewerActorId: ledger.ownerActorId, includeRoleLimited: true });
  const generatedAtTurn = metadataValue(record, "turnCount", 0);

  return {
    resourceAccounts: resourceView.accounts.map((account) => ({
      session_id: record.sessionId,
      row_id: idText(account.accountId, `resource:${account.resourceId}`),
      domain_schema_version: ASSET_TABLE_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: ASSET_TABLE_SOURCE,
      owner_actor_id: idText(account.ownerActorId, "player"),
      resource_id: idText(account.resourceId, "resource"),
      label: text(account.label, "资源", 80),
      amount: integer(account.amount, 0),
      unit: text(account.unit, "", 24),
      visibility: "safe_summary",
      summary: `${text(account.label, "资源", 80)}：${integer(account.amount, 0)}${text(account.unit, "", 24)}`,
      refs_json: stringifyJson([idText(account.accountId, "")].filter(Boolean), []),
      metadata_json: stringifyJson({
        generatedAtTurn,
        sourceView: "resourceLedgerView"
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    })),
    longTermAssets: assetView.assets.map((asset) => ({
      session_id: record.sessionId,
      row_id: idText(asset.assetId, `asset:${asset.assetType}`),
      domain_schema_version: ASSET_TABLE_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: ASSET_TABLE_SOURCE,
      owner_actor_id: idText(asset.ownerActorId, "player"),
      asset_type: idText(asset.assetType, "asset"),
      name: text(asset.name, "资产", 80),
      type_label: text(asset.typeLabel, "资产", 80),
      location_ref: text(asset.locationRef, "", 96),
      legal_status: text(asset.legalStatus, "unknown", 48),
      visibility: text(asset.visibility, "safe_summary", 40),
      summary: `${text(asset.typeLabel, "资产", 80)}：${text(asset.name, "资产", 80)}，状态${text(asset.condition, "可用", 40)}`,
      refs_json: stringifyJson(cleanList([
        asset.assetId,
        asset.locationRef,
        ...(asset.effectRefs || []),
        ...(asset.provenance || []).map((entry) => entry.ref)
      ], 12), []),
      metadata_json: stringifyJson({
        generatedAtTurn,
        sourceView: "assetLedgerView",
        productivity: integer(asset.productivity, 0),
        upkeepSilver: integer(asset.upkeepSilver, 0)
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    }))
  };
}

function deleteAssetRows(database, sessionId) {
  database.prepare("DELETE FROM asset_resource_accounts WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM asset_long_term_assets WHERE session_id = ?").run(sessionId);
}

function insertRow(database, tableName, row) {
  const safeRow = attachRowHash(row);
  const columns = Object.keys(safeRow);
  database
    .prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...columns.map((column) => safeRow[column]));
}

function syncAssetTables(database, record) {
  deleteAssetRows(database, record.sessionId);
  const rows = buildAssetRows(record);
  for (const row of rows.resourceAccounts) insertRow(database, "asset_resource_accounts", row);
  for (const row of rows.longTermAssets) insertRow(database, "asset_long_term_assets", row);
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

function getAssetRepairStatus(database, record) {
  const expected = buildAssetRows(record);
  const tables = {
    asset_resource_accounts: tableStatus(database, "asset_resource_accounts", record.sessionId, record.revision, expected.resourceAccounts),
    asset_long_term_assets: tableStatus(database, "asset_long_term_assets", record.sessionId, record.revision, expected.longTermAssets)
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

function ensureAssetTablesForRecord(database, record) {
  const status = getAssetRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncAssetTables(database, record);
    return true;
  }
  return false;
}

module.exports = {
  ASSET_TABLE_DOMAIN_SCHEMA_VERSION,
  ASSET_TABLE_SOURCE,
  buildAssetRows,
  deleteAssetRows,
  ensureAssetTablesForRecord,
  getAssetRepairStatus,
  initializeAssetTables,
  syncAssetTables
};
