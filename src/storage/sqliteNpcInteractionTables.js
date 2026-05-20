const { createHash } = require("node:crypto");

const { buildDelegatedTaskLedgerView } = require("../game/delegatedTasks");
const { buildNpcActiveRequestView } = require("../game/npcActiveRequests");
const {
  buildNpcDetailView,
  buildNpcRosterView,
  ensureNpcRoster
} = require("../game/npcRoster");

const NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION = 1;
const NPC_INTERACTION_TABLE_SOURCE = "npc_inventory_safe_projection";

const UNSAFE_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|privateSignalTags|trueAssets|secretRelationships|unrevealedTasks|raw[_ -]?(?:provider|audit|table|ledger|prompt|payload|state)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|world_sessions|prompt_retrieval_index|event_archive_index|safe_search_index|ai_change_proposals|event_log|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sqlite|data[\\/](?:sessions|audit)|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

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

function text(value, fallback = "", maxLength = 180) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || UNSAFE_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function idText(value, fallback = "") {
  return text(value, fallback, 140).replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function cleanList(values, limit = 10) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = text(value, "", 120);
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

function initializeNpcInteractionTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS npc_roster_profiles (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      tier TEXT NOT NULL,
      portrait_ref TEXT NOT NULL,
      title TEXT NOT NULL,
      posting TEXT NOT NULL,
      summary TEXT NOT NULL,
      relationship_summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_npc_roster_profiles_session_npc
      ON npc_roster_profiles(session_id, npc_id, tier);

    CREATE TABLE IF NOT EXISTS npc_interaction_events (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_npc_interaction_events_session_npc
      ON npc_interaction_events(session_id, npc_id, action_type);

    CREATE TABLE IF NOT EXISTS npc_active_requests (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      request_id TEXT NOT NULL,
      npc_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_npc_active_requests_session_status
      ON npc_active_requests(session_id, status, request_type);

    CREATE TABLE IF NOT EXISTS delegated_tasks (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      task_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL,
      issuer_actor_id TEXT NOT NULL,
      assignee_actor_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_delegated_tasks_session_status
      ON delegated_tasks(session_id, status, task_type);

    CREATE TABLE IF NOT EXISTS trade_ledger_records (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      trade_id TEXT NOT NULL,
      status TEXT NOT NULL,
      actor_a_id TEXT NOT NULL,
      actor_b_id TEXT NOT NULL,
      trade_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      refs_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_trade_ledger_records_session_status
      ON trade_ledger_records(session_id, status, trade_type);
  `);
}

function buildNpcProfileRows(record) {
  const worldState = record.worldState || {};
  ensureNpcRoster(worldState);
  const view = buildNpcRosterView(worldState, { pageSize: 50 });
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  return view.items.map((item) => {
    const detail = buildNpcDetailView(worldState, item.npcId) || {};
    const relationship = item.relationshipSummary || {};
    return {
      session_id: record.sessionId,
      row_id: idText(item.npcId, "npc"),
      domain_schema_version: NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
      revision: record.revision,
      row_revision: record.revision,
      source: NPC_INTERACTION_TABLE_SOURCE,
      npc_id: idText(item.npcId, "npc"),
      display_name: text(item.displayName, "无名人物", 80),
      tier: text(item.tier, "ambient", 32),
      portrait_ref: text(item.portraitRef, "", 160),
      title: text(item.publicProfile?.title || detail.publicProfile?.title, "", 80),
      posting: text(item.publicProfile?.posting || detail.publicProfile?.posting, "", 80),
      summary: text(item.publicProfile?.summary || detail.publicProfile?.summary, "可见人物摘要", 180),
      relationship_summary: text((relationship.labels || []).join("、"), "关系尚浅", 120),
      refs_json: stringifyJson(cleanList([
        item.npcId,
        detail.sourceRef,
        ...(detail.inventoryRefs || []),
        ...(detail.assetRefs || []),
        ...(detail.resourceAccountRefs || []),
        ...(item.availableInteractions || [])
      ], 16), []),
      metadata_json: stringifyJson({
        generatedAtTurn,
        sourceView: "npcRosterView",
        closeness: integer(relationship.closeness, 0),
        trust: integer(relationship.trust, 0),
        hostility: integer(relationship.hostility, 0)
      }, {}),
      created_at: record.createdAt,
      updated_at: record.updatedAt
    };
  });
}

function sourceEventRows(worldState = {}) {
  if (Array.isArray(worldState.npcInteractionLedger?.records)) return worldState.npcInteractionLedger.records;
  if (Array.isArray(worldState.npcInteractionLedger?.events)) return worldState.npcInteractionLedger.events;
  if (Array.isArray(worldState.npcInteractionEvents)) return worldState.npcInteractionEvents;
  return [];
}

function buildNpcInteractionEventRows(record) {
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  return sourceEventRows(record.worldState).map((event, index) => ({
    session_id: record.sessionId,
    row_id: idText(event.recordId || event.eventId || event.interactionId, `npc-interaction:${index + 1}`),
    domain_schema_version: NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: NPC_INTERACTION_TABLE_SOURCE,
    npc_id: idText(event.npcId || event.actorId, ""),
    action_type: idText(event.actionType || event.type, "talk"),
    outcome: text(event.outcome || event.serverStatus || event.status, "recorded", 48),
    summary: text(event.summary || event.publicSummary || event.dialogueText, "NPC 交互已记录", 180),
    refs_json: stringifyJson(cleanList([event.recordId, event.eventId, event.npcId, ...(event.refs || event.relatedRefs || event.auditRefs || [])], 12), []),
    metadata_json: stringifyJson({
      generatedAtTurn,
      sourceView: "npcInteractionLedger.safeEvents",
      turn: integer(event.turn ?? event.turnCount, generatedAtTurn)
    }, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  })).filter((row) => row.npc_id && row.summary);
}

function buildDelegatedTaskRows(record) {
  const view = buildDelegatedTaskLedgerView(record.worldState || {});
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  return view.items.map((task) => ({
    session_id: record.sessionId,
    row_id: idText(task.taskId, "delegated-task"),
    domain_schema_version: NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: NPC_INTERACTION_TABLE_SOURCE,
    task_id: idText(task.taskId, "delegated-task"),
    task_type: idText(task.taskType, "task"),
    status: text(task.status, "active", 40),
    issuer_actor_id: idText(task.issuerActorId, "player"),
    assignee_actor_id: idText(task.assignee?.npcId, ""),
    title: text(task.title, "委派任务", 80),
    summary: text(task.result?.summary || `${task.title}：${task.status}`, "委派任务摘要", 180),
    refs_json: stringifyJson(cleanList([
      task.taskId,
      task.assignee?.npcId,
      ...(task.requiredItems || []),
      ...(task.budgetAccountRefs || []),
      ...(task.auditRefs || [])
    ], 16), []),
    metadata_json: stringifyJson({
      generatedAtTurn,
      sourceView: "delegatedTaskLedgerView",
      budget: integer(task.budget, 0),
      cadence: text(task.cadence, "", 40)
    }, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  }));
}

function buildNpcActiveRequestRows(record) {
  const view = buildNpcActiveRequestView(record.worldState || {}, { includeResolved: true });
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  return (view.items || []).map((request, index) => ({
    session_id: record.sessionId,
    row_id: idText(request.requestId, `npc-active-request:${index + 1}`),
    domain_schema_version: NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: NPC_INTERACTION_TABLE_SOURCE,
    request_id: idText(request.requestId, `npc-active-request:${index + 1}`),
    npc_id: idText(request.npc?.npcId, ""),
    request_type: idText(request.type, "help"),
    status: text(request.status, "active", 56),
    summary: text(request.outcome?.publicSummary || request.ask || request.title, "NPC 主动请求摘要", 180),
    refs_json: stringifyJson(cleanList([
      request.requestId,
      request.npc?.npcId,
      ...(request.evidenceRefs || []),
      ...(request.riskTags || [])
    ], 16), []),
    metadata_json: stringifyJson({
      generatedAtTurn,
      sourceView: "npcActiveRequestView",
      turnsRemaining: integer(request.turnsRemaining, 0),
      serverIntentOnly: true
    }, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  })).filter((row) => row.npc_id && row.summary);
}

function sourceTradeRows(worldState = {}) {
  if (Array.isArray(worldState.tradeLedger?.records)) return worldState.tradeLedger.records;
  if (Array.isArray(worldState.tradeLedgerRecords)) return worldState.tradeLedgerRecords;
  return [];
}

function buildTradeLedgerRows(record) {
  const generatedAtTurn = metadataValue(record, "turnCount", 0);
  const fallbackPlayerActorId = idText(record.worldState?.player?.id || record.worldState?.player?.actorId, "player");
  return sourceTradeRows(record.worldState).map((trade, index) => ({
    session_id: record.sessionId,
    row_id: idText(trade.tradeId || trade.recordId, `trade:${index + 1}`),
    domain_schema_version: NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: NPC_INTERACTION_TABLE_SOURCE,
    trade_id: idText(trade.tradeId || trade.recordId, `trade:${index + 1}`),
    status: text(trade.status, "recorded", 40),
    actor_a_id: idText(trade.actorAId || trade.fromActorId || trade.sellerActorId || trade.ownerActorId, fallbackPlayerActorId),
    actor_b_id: idText(trade.actorBId || trade.toActorId || trade.buyerActorId || trade.npcId, ""),
    trade_type: idText(trade.tradeType || trade.type, "trade"),
    summary: text(trade.summary || trade.publicSummary, "交易记录摘要", 180),
    refs_json: stringifyJson(cleanList([
      trade.tradeId,
      trade.actorAId || trade.fromActorId || trade.sellerActorId || trade.ownerActorId || fallbackPlayerActorId,
      trade.actorBId || trade.toActorId || trade.buyerActorId || trade.npcId,
      ...(trade.itemRefs || []),
      ...(trade.resourceRefs || []),
      ...(trade.auditRefs || [])
    ], 16), []),
    metadata_json: stringifyJson({
      generatedAtTurn,
      sourceView: "tradeLedger.safeRecords",
      turn: integer(trade.turn ?? trade.turnCount, generatedAtTurn)
    }, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  })).filter((row) => row.summary);
}

function buildNpcInteractionRows(record) {
  return {
    npcProfiles: buildNpcProfileRows(record),
    npcInteractionEvents: buildNpcInteractionEventRows(record),
    npcActiveRequests: buildNpcActiveRequestRows(record),
    delegatedTasks: buildDelegatedTaskRows(record),
    tradeLedgerRecords: buildTradeLedgerRows(record)
  };
}

function deleteNpcInteractionRows(database, sessionId) {
  database.prepare("DELETE FROM npc_roster_profiles WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM npc_interaction_events WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM npc_active_requests WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM delegated_tasks WHERE session_id = ?").run(sessionId);
  database.prepare("DELETE FROM trade_ledger_records WHERE session_id = ?").run(sessionId);
}

function insertRow(database, tableName, row) {
  const safeRow = attachRowHash(row);
  const columns = Object.keys(safeRow);
  database
    .prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...columns.map((column) => safeRow[column]));
}

function syncNpcInteractionTables(database, record) {
  deleteNpcInteractionRows(database, record.sessionId);
  const rows = buildNpcInteractionRows(record);
  for (const row of rows.npcProfiles) insertRow(database, "npc_roster_profiles", row);
  for (const row of rows.npcInteractionEvents) insertRow(database, "npc_interaction_events", row);
  for (const row of rows.npcActiveRequests) insertRow(database, "npc_active_requests", row);
  for (const row of rows.delegatedTasks) insertRow(database, "delegated_tasks", row);
  for (const row of rows.tradeLedgerRecords) insertRow(database, "trade_ledger_records", row);
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

function getNpcInteractionRepairStatus(database, record) {
  const expected = buildNpcInteractionRows(record);
  const tables = {
    npc_roster_profiles: tableStatus(database, "npc_roster_profiles", record.sessionId, record.revision, expected.npcProfiles),
    npc_interaction_events: tableStatus(database, "npc_interaction_events", record.sessionId, record.revision, expected.npcInteractionEvents),
    npc_active_requests: tableStatus(database, "npc_active_requests", record.sessionId, record.revision, expected.npcActiveRequests),
    delegated_tasks: tableStatus(database, "delegated_tasks", record.sessionId, record.revision, expected.delegatedTasks),
    trade_ledger_records: tableStatus(database, "trade_ledger_records", record.sessionId, record.revision, expected.tradeLedgerRecords)
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

function ensureNpcInteractionTablesForRecord(database, record) {
  const status = getNpcInteractionRepairStatus(database, record);
  if (status.tableNeedsRepair) {
    syncNpcInteractionTables(database, record);
    return true;
  }
  return false;
}

module.exports = {
  NPC_INTERACTION_TABLE_DOMAIN_SCHEMA_VERSION,
  NPC_INTERACTION_TABLE_SOURCE,
  buildNpcInteractionRows,
  deleteNpcInteractionRows,
  ensureNpcInteractionTablesForRecord,
  getNpcInteractionRepairStatus,
  initializeNpcInteractionTables,
  syncNpcInteractionTables
};
