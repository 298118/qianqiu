// @ts-check

const { createHash } = require("node:crypto");

const {
  SAFE_WORLD_SEARCH_SCHEMA_VERSION,
  SAFE_WORLD_SEARCH_SOURCE,
  buildSafeSearchRows,
  formatSafeSearchResults,
  normalizeDomainFilter,
  normalizeSearchQuery
} = require("../game/safeWorldSearch");

const SQLITE_SAFE_SEARCH_SOURCE = SAFE_WORLD_SEARCH_SOURCE;

/**
 * @typedef {import("../contracts/serverContracts").JsonObject} JsonObject
 * @typedef {import("../contracts/serverContracts").SessionRecord} SessionRecord
 * @typedef {import("../contracts/serverContracts").SqliteSafeSearchIndexRow} SqliteSafeSearchIndexRow
 * @typedef {import("../contracts/serverContracts").SqliteSafeSearchRepairStatus} SqliteSafeSearchRepairStatus
 */

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

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
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

/**
 * @param {SqliteSafeSearchIndexRow} row
 */
function hashSafeSearchRow(row) {
  const comparable = {};
  for (const column of Object.keys(row).sort()) {
    if (column === "metadata_json" || column === "created_at" || column === "updated_at") continue;
    comparable[column] = row[column];
  }
  return createHash("sha256").update(stableStringify(comparable)).digest("hex");
}

/**
 * @param {SqliteSafeSearchIndexRow} row
 * @returns {SqliteSafeSearchIndexRow}
 */
function attachSafeSearchRowHash(row) {
  const metadata = parseJsonObject(row.metadata_json);
  return {
    ...row,
    metadata_json: stringifyJson({
      ...metadata,
      contentHash: hashSafeSearchRow(row)
    }, {})
  };
}

function metadataValue(record, key, fallback = 0) {
  const parsed = Number(record.metadata?.[key] ?? record.worldState?.[key]);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function detectSqliteFts5Support(database) {
  try {
    database.exec("CREATE VIRTUAL TABLE temp.__qianqiu_fts5_probe USING fts5(content)");
    database.exec("DROP TABLE temp.__qianqiu_fts5_probe");
    return true;
  } catch (error) {
    try {
      database.exec("DROP TABLE IF EXISTS temp.__qianqiu_fts5_probe");
    } catch (cleanupError) {
      // Best-effort cleanup; lack of FTS5 support is handled by LIKE fallback.
    }
    return false;
  }
}

function hasSafeSearchFtsTable(database) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'safe_search_fts'")
    .get();
  return Boolean(row);
}

function initializeSafeSearchTables(database, options = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS safe_search_index (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      safe_search_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_view TEXT NOT NULL,
      domain TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      visibility TEXT NOT NULL,
      related_refs_json TEXT NOT NULL,
      route_view_ref_json TEXT NOT NULL,
      search_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_safe_search_session_domain
      ON safe_search_index(session_id, domain, source_view, source_id);
    CREATE INDEX IF NOT EXISTS idx_safe_search_session_revision
      ON safe_search_index(session_id, revision, row_id);
  `);

  if (options.forceFts5Disabled) return false;
  if (!detectSqliteFts5Support(database)) return false;

  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS safe_search_fts USING fts5(
      session_id UNINDEXED,
      row_id UNINDEXED,
      domain,
      title,
      summary,
      search_text,
      tokenize = 'unicode61'
    );
  `);
  return true;
}

function deleteSafeSearchRows(database, sessionId) {
  database.prepare("DELETE FROM safe_search_index WHERE session_id = ?").run(sessionId);
  if (hasSafeSearchFtsTable(database)) {
    database.prepare("DELETE FROM safe_search_fts WHERE session_id = ?").run(sessionId);
  }
}

/**
 * @param {SessionRecord} record
 * @returns {SqliteSafeSearchIndexRow[]}
 */
function buildSafeSearchTableRows(record) {
  return buildSafeSearchRows(record.worldState).map((row, index) => ({
    session_id: record.sessionId,
    row_id: row.rowId,
    safe_search_schema_version: SAFE_WORLD_SEARCH_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: SAFE_WORLD_SEARCH_SOURCE,
    source_view: row.sourceView,
    domain: row.domain,
    source_id: row.sourceId,
    title: row.title,
    summary: row.summary || "",
    confidence: row.confidence,
    visibility: row.visibility,
    related_refs_json: stringifyJson(row.relatedRefs || [], []),
    route_view_ref_json: stringifyJson(row.routeViewRef || {}, {}),
    search_text: row.searchText,
    metadata_json: stringifyJson({
      generatedAtTurn: metadataValue(record, "turnCount", 0),
      sourceView: row.sourceView,
      sortPriority: index
    }, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }));
}

/**
 * @param {any} database
 * @param {SqliteSafeSearchIndexRow} row
 */
function insertSafeSearchIndexRow(database, row) {
  const safeRow = attachSafeSearchRowHash(row);
  const columns = Object.keys(safeRow);
  const placeholders = columns.map(() => "?").join(", ");
  database
    .prepare(`INSERT INTO safe_search_index (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...columns.map((column) => safeRow[column]));
}

/**
 * @param {any} database
 * @param {SqliteSafeSearchIndexRow} row
 */
function insertSafeSearchFtsRow(database, row) {
  if (!hasSafeSearchFtsTable(database)) return;
  database
    .prepare(`
      INSERT INTO safe_search_fts (
        session_id,
        row_id,
        domain,
        title,
        summary,
        search_text
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(row.session_id, row.row_id, row.domain, row.title, row.summary, row.search_text);
}

function syncSafeSearchTables(database, record) {
  deleteSafeSearchRows(database, record.sessionId);
  for (const row of buildSafeSearchTableRows(record)) {
    insertSafeSearchIndexRow(database, row);
    insertSafeSearchFtsRow(database, row);
  }
}

function getSafeSearchTableCount(database, sessionId) {
  return database
    .prepare("SELECT COUNT(*) AS count FROM safe_search_index WHERE session_id = ?")
    .get(sessionId).count;
}

function hasStaleSafeSearchRows(database, sessionId, revision) {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM safe_search_index WHERE session_id = ? AND revision <> ?")
    .get(sessionId, revision);
  return row.count > 0;
}

/**
 * @param {any} database
 * @param {string} sessionId
 * @param {SqliteSafeSearchIndexRow[]} expectedRows
 */
function hasMismatchedSafeSearchRowIds(database, sessionId, expectedRows) {
  const expectedIds = new Set(expectedRows.map((row) => row.row_id));
  const storedRows = /** @type {Array<Pick<SqliteSafeSearchIndexRow, "row_id">>} */ (
    database
      .prepare("SELECT row_id FROM safe_search_index WHERE session_id = ?")
      .all(sessionId)
  );
  if (storedRows.length !== expectedIds.size) return true;
  for (const row of storedRows) {
    if (!expectedIds.has(row.row_id)) return true;
  }
  return false;
}

/**
 * @param {any} database
 * @param {string} sessionId
 * @param {SqliteSafeSearchIndexRow[]} expectedRows
 */
function hasMismatchedSafeSearchContentHashes(database, sessionId, expectedRows) {
  const expectedRowsById = new Map(expectedRows.map((row) => [row.row_id, row]));
  const storedRows = /** @type {SqliteSafeSearchIndexRow[]} */ (
    database
      .prepare("SELECT * FROM safe_search_index WHERE session_id = ?")
      .all(sessionId)
  );
  for (const row of storedRows) {
    const expected = expectedRowsById.get(row.row_id);
    const metadata = parseJsonObject(row.metadata_json);
    if (!expected) return true;
    if (!metadata.contentHash) return true;
    if (metadata.contentHash !== hashSafeSearchRow(row)) return true;
    if (metadata.contentHash !== hashSafeSearchRow(expected)) return true;
  }
  return false;
}

function hasMismatchedFtsRows(database, sessionId) {
  if (!hasSafeSearchFtsTable(database)) return false;
  const indexCount = database
    .prepare("SELECT COUNT(*) AS count FROM safe_search_index WHERE session_id = ?")
    .get(sessionId).count;
  const ftsCount = database
    .prepare("SELECT COUNT(*) AS count FROM safe_search_fts WHERE session_id = ?")
    .get(sessionId).count;
  if (indexCount !== ftsCount) return true;
  const mismatch = database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM safe_search_index idx
      LEFT JOIN safe_search_fts
        ON safe_search_fts.session_id = idx.session_id
       AND safe_search_fts.row_id = idx.row_id
      WHERE idx.session_id = ?
        AND (
          safe_search_fts.row_id IS NULL
          OR safe_search_fts.domain <> idx.domain
          OR safe_search_fts.title <> idx.title
          OR safe_search_fts.summary <> idx.summary
          OR safe_search_fts.search_text <> idx.search_text
        )
    `)
    .get(sessionId);
  return mismatch.count > 0;
}

/**
 * @param {any} database
 * @param {SessionRecord} record
 * @returns {SqliteSafeSearchRepairStatus}
 */
function getSafeSearchRepairStatus(database, record) {
  const expectedRows = buildSafeSearchTableRows(record);
  const count = getSafeSearchTableCount(database, record.sessionId);
  const missingOrMismatched = count !== expectedRows.length;
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedSafeSearchRowIds(database, record.sessionId, expectedRows);
  const staleRows = hasStaleSafeSearchRows(database, record.sessionId, record.revision);
  const contentMismatches = !missingOrMismatched &&
    !mismatchedRowIds &&
    hasMismatchedSafeSearchContentHashes(database, record.sessionId, expectedRows);
  const ftsMismatches = !missingOrMismatched && hasMismatchedFtsRows(database, record.sessionId);
  const tableNeedsRepair = missingOrMismatched || mismatchedRowIds || staleRows || contentMismatches || ftsMismatches;

  return {
    contentMismatches,
    count,
    expectedCount: expectedRows.length,
    ftsAvailable: hasSafeSearchFtsTable(database),
    ftsMismatches,
    missingOrMismatched,
    mismatchedRowIds,
    needsRepair: tableNeedsRepair,
    staleRows,
    tableNeedsRepair
  };
}

/**
 * @param {any} database
 * @param {SessionRecord} record
 */
function repairSafeSearchTablesForRecord(database, record) {
  const status = getSafeSearchRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncSafeSearchTables(database, record);
    return { ...status, repaired: true };
  }
  return { ...status, repaired: false };
}

/**
 * @param {any} database
 * @param {SessionRecord} record
 */
function ensureSafeSearchTablesForRecord(database, record) {
  return repairSafeSearchTablesForRecord(database, record).repaired;
}

/**
 * @param {SqliteSafeSearchIndexRow} row
 * @returns {JsonObject}
 */
function rowToSafeSearchRow(row) {
  return {
    rowId: row.row_id,
    domain: row.domain,
    sourceView: row.source_view,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    confidence: row.confidence,
    visibility: row.visibility,
    relatedRefs: parseJsonArray(row.related_refs_json),
    routeViewRef: parseJsonObject(row.route_view_ref_json),
    searchText: row.search_text
  };
}

function escapedLikeTerm(term) {
  return String(term || "")
    .toLowerCase()
    .replace(/[\\%_]/g, (match) => `\\${match}`);
}

function domainClause(domains, params) {
  if (!domains.length) return "";
  params.push(...domains);
  return ` AND idx.domain IN (${domains.map(() => "?").join(", ")})`;
}

/**
 * @param {any} database
 * @returns {SqliteSafeSearchIndexRow[]}
 */
function selectRowsByLike(database, sessionId, normalizedQuery, domains) {
  if (!normalizedQuery.query || normalizedQuery.rejected) return [];
  const terms = normalizedQuery.terms.map(escapedLikeTerm).filter(Boolean);
  if (!terms.length) return [];
  const params = [sessionId];
  const clauses = terms.map((term) => {
    const pattern = `%${term}%`;
    params.push(pattern, pattern, pattern);
    return "(lower(idx.search_text) LIKE ? ESCAPE '\\' OR lower(idx.title) LIKE ? ESCAPE '\\' OR lower(idx.summary) LIKE ? ESCAPE '\\')";
  });

  const sql = `
    SELECT idx.*
    FROM safe_search_index idx
    WHERE idx.session_id = ?
      AND (${clauses.join(" OR ")})
      ${domainClause(domains, params)}
    ORDER BY idx.domain, idx.source_view, idx.source_id
  `;
  return database.prepare(sql).all(...params);
}

function ftsTokenParts(term) {
  return String(term || "")
    .split(/[^\p{L}\p{N}_]+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildFtsQuery(terms) {
  const parts = [];
  const seen = new Set();
  for (const term of terms) {
    for (const part of ftsTokenParts(term)) {
      if (!part || seen.has(part)) continue;
      seen.add(part);
      parts.push(`"${part.replace(/"/g, '""')}"`);
      if (parts.length >= 8) break;
    }
    if (parts.length >= 8) break;
  }
  return parts.join(" OR ");
}

/**
 * @param {any} database
 * @returns {SqliteSafeSearchIndexRow[]}
 */
function selectRowsByFts(database, sessionId, normalizedQuery, domains) {
  if (!hasSafeSearchFtsTable(database) || !normalizedQuery.query || normalizedQuery.rejected) return [];
  const ftsQuery = buildFtsQuery(normalizedQuery.terms);
  if (!ftsQuery) return [];
  const params = [sessionId, ftsQuery];
  const sql = `
    SELECT idx.*
    FROM safe_search_fts
    JOIN safe_search_index idx
      ON idx.session_id = safe_search_fts.session_id
     AND idx.row_id = safe_search_fts.row_id
    WHERE safe_search_fts.session_id = ?
      AND safe_search_fts MATCH ?
      ${domainClause(domains, params)}
    ORDER BY rank, idx.domain, idx.source_view, idx.source_id
  `;
  try {
    return database.prepare(sql).all(...params);
  } catch (error) {
    return [];
  }
}

/**
 * @param {any} database
 * @returns {SqliteSafeSearchIndexRow[]}
 */
function selectAllRowsForSession(database, sessionId, domains) {
  const params = [sessionId];
  const sql = `
    SELECT idx.*
    FROM safe_search_index idx
    WHERE idx.session_id = ?
      ${domainClause(domains, params)}
    ORDER BY idx.domain, idx.source_view, idx.source_id
  `;
  return database.prepare(sql).all(...params);
}

/**
 * @param {...SqliteSafeSearchIndexRow[]} rowLists
 * @returns {SqliteSafeSearchIndexRow[]}
 */
function mergeRows(...rowLists) {
  const rows = [];
  const seen = new Set();
  for (const list of rowLists) {
    for (const row of list || []) {
      const key = `${row.session_id}:${row.row_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function searchSafeSearchTables(database, sessionId, query, options = {}) {
  const normalizedQuery = normalizeSearchQuery(query ?? options.query ?? options.q);
  const domains = normalizeDomainFilter(options.domains ?? options.domain);
  const allDomainRows = selectAllRowsForSession(database, sessionId, domains);
  const ftsRows = options.forceLike
    ? []
    : selectRowsByFts(database, sessionId, normalizedQuery, domains);
  const likeRows = selectRowsByLike(database, sessionId, normalizedQuery, domains);
  const matchedRows = mergeRows(ftsRows, likeRows).map(rowToSafeSearchRow);
  const result = formatSafeSearchResults(
    matchedRows,
    normalizedQuery,
    {
      ...options,
      domains,
      query: normalizedQuery.query
    },
    SQLITE_SAFE_SEARCH_SOURCE
  );

  return {
    ...result,
    counts: {
      ...result.counts,
      totalAvailable: allDomainRows.length,
      domainAvailable: allDomainRows.length
    },
    storage: {
      engine: hasSafeSearchFtsTable(database) && !options.forceLike ? "fts5_like_union" : "like",
      ftsAvailable: hasSafeSearchFtsTable(database)
    }
  };
}

module.exports = {
  SQLITE_SAFE_SEARCH_SOURCE,
  buildSafeSearchTableRows,
  deleteSafeSearchRows,
  detectSqliteFts5Support,
  ensureSafeSearchTablesForRecord,
  getSafeSearchRepairStatus,
  getSafeSearchTableCount,
  hasSafeSearchFtsTable,
  initializeSafeSearchTables,
  repairSafeSearchTablesForRecord,
  searchSafeSearchTables,
  syncSafeSearchTables
};
