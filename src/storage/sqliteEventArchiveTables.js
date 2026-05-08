const { createHash } = require("node:crypto");

const {
  EVENT_ARCHIVE_SCHEMA_VERSION,
  buildEventArchiveIndexItems
} = require("../game/eventArchive");

const EVENT_ARCHIVE_INDEX_DOMAIN_SCHEMA_VERSION = 1;
const EVENT_ARCHIVE_INDEX_SOURCE = "event_archive_view";

function stringifyJson(value, fallback) {
  const source = value === undefined ? fallback : value;
  return JSON.stringify(source);
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
  return Object.keys(value)
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = normalizeForStableJson(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalizeForStableJson(value));
}

function hashEventArchiveRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

function attachEventArchiveRowHash(row) {
  const metadata = parseJsonObject(row.metadata_json);
  return {
    ...row,
    metadata_json: stringifyJson({
      ...metadata,
      contentHash: hashEventArchiveRow(row)
    }, {})
  };
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function metadataValue(record, key, fallback = 0) {
  return toInteger(record.metadata?.[key] ?? record.worldState?.[key], fallback);
}

function initializeEventArchiveTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS event_archive_index (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      archive_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_label TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      event_year INTEGER NOT NULL,
      event_month INTEGER NOT NULL,
      event_ten_day_period INTEGER NOT NULL,
      turn_count INTEGER NOT NULL,
      date_label TEXT NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      risk_label TEXT NOT NULL,
      related_labels_json TEXT NOT NULL,
      sort_turn INTEGER NOT NULL,
      sort_year INTEGER NOT NULL,
      sort_month INTEGER NOT NULL,
      sort_ten_day_period INTEGER NOT NULL,
      sort_sequence INTEGER NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_event_archive_index_session_sort
      ON event_archive_index(session_id, sort_turn DESC, sort_year DESC, sort_month DESC, sort_ten_day_period DESC, sort_sequence ASC);
    CREATE INDEX IF NOT EXISTS idx_event_archive_index_session_source
      ON event_archive_index(session_id, source_type, status, row_id);
  `);
}

function deleteEventArchiveRows(database, sessionId) {
  database.prepare("DELETE FROM event_archive_index WHERE session_id = ?").run(sessionId);
}

function insertEventArchiveRow(database, row) {
  const safeRow = attachEventArchiveRowHash(row);
  const columns = Object.keys(safeRow);
  const placeholders = columns.map(() => "?").join(", ");
  database
    .prepare(`INSERT INTO event_archive_index (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...columns.map((column) => safeRow[column]));
}

function buildEventArchiveRows(record) {
  const items = buildEventArchiveIndexItems(record.worldState);
  return items.map((item, index) => {
    const turn = toInteger(item.turn, metadataValue(record, "turnCount", 0));
    const year = toInteger(item.year, metadataValue(record, "year", 0));
    const month = toInteger(item.month, metadataValue(record, "month", 1));
    const tenDayPeriod = toInteger(item.tenDayPeriod, metadataValue(record, "tenDayPeriod", 1));

    return {
      session_id: record.sessionId,
      row_id: item.id,
      domain_schema_version: EVENT_ARCHIVE_INDEX_DOMAIN_SCHEMA_VERSION,
      archive_schema_version: EVENT_ARCHIVE_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: EVENT_ARCHIVE_INDEX_SOURCE,
      visibility: "public",
      source_type: text(item.sourceType) || "event_history",
      source_label: text(item.sourceLabel),
      kind: text(item.kind),
      title: text(item.title),
      summary: text(item.summary),
      event_year: year,
      event_month: month,
      event_ten_day_period: tenDayPeriod,
      turn_count: turn,
      date_label: text(item.dateLabel),
      status: text(item.status) || "recorded",
      status_label: text(item.statusLabel),
      risk_label: text(item.riskLabel),
      related_labels_json: stringifyJson(item.relatedLabels, []),
      sort_turn: turn,
      sort_year: year,
      sort_month: month,
      sort_ten_day_period: tenDayPeriod,
      sort_sequence: index,
      metadata_json: stringifyJson({
        generatedAtTurn: metadataValue(record, "turnCount", 0),
        archiveSchemaVersion: EVENT_ARCHIVE_SCHEMA_VERSION
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    };
  });
}

function syncEventArchiveTables(database, record) {
  deleteEventArchiveRows(database, record.sessionId);
  for (const row of buildEventArchiveRows(record)) {
    insertEventArchiveRow(database, row);
  }
}

function getEventArchiveTableCount(database, sessionId) {
  return database
    .prepare("SELECT COUNT(*) AS count FROM event_archive_index WHERE session_id = ?")
    .get(sessionId).count;
}

function hasStaleEventArchiveRows(database, sessionId, revision) {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM event_archive_index WHERE session_id = ? AND revision <> ?")
    .get(sessionId, revision);
  return row.count > 0;
}

function hasMismatchedEventArchiveRowIds(database, sessionId, expectedRows) {
  const expectedIds = new Set(expectedRows.map((row) => row.row_id));
  const storedRows = database
    .prepare("SELECT row_id FROM event_archive_index WHERE session_id = ?")
    .all(sessionId);

  if (storedRows.length !== expectedIds.size) return true;
  for (const row of storedRows) {
    if (!expectedIds.has(row.row_id)) return true;
  }
  return false;
}

function hasMismatchedEventArchiveContentHashes(database, sessionId) {
  const storedRows = database
    .prepare("SELECT * FROM event_archive_index WHERE session_id = ?")
    .all(sessionId);

  for (const row of storedRows) {
    const metadata = parseJsonObject(row.metadata_json);
    if (!metadata.contentHash) return true;
    if (metadata.contentHash !== hashEventArchiveRow(row)) return true;
  }
  return false;
}

function getEventArchiveRepairStatus(database, record) {
  const expectedRows = buildEventArchiveRows(record);
  const count = getEventArchiveTableCount(database, record.sessionId);
  const missingOrMismatched = count !== expectedRows.length;
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedEventArchiveRowIds(database, record.sessionId, expectedRows);
  const staleRows = hasStaleEventArchiveRows(database, record.sessionId, record.revision);
  const contentMismatches = !missingOrMismatched &&
    !mismatchedRowIds &&
    hasMismatchedEventArchiveContentHashes(database, record.sessionId);
  const tableNeedsRepair = missingOrMismatched || mismatchedRowIds || staleRows || contentMismatches;

  return {
    contentMismatches,
    count,
    expectedCount: expectedRows.length,
    missingOrMismatched,
    mismatchedRowIds,
    needsRepair: tableNeedsRepair,
    staleRows,
    tableNeedsRepair
  };
}

function ensureEventArchiveTablesForRecord(database, record) {
  const status = getEventArchiveRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncEventArchiveTables(database, record);
    return true;
  }
  return false;
}

module.exports = {
  EVENT_ARCHIVE_INDEX_DOMAIN_SCHEMA_VERSION,
  deleteEventArchiveRows,
  ensureEventArchiveTablesForRecord,
  getEventArchiveRepairStatus,
  getEventArchiveTableCount,
  initializeEventArchiveTables,
  syncEventArchiveTables
};
