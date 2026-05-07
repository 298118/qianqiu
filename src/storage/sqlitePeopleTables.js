const { normalizeWorldPeopleState } = require("../game/worldPeople");

const PEOPLE_DOMAIN_SCHEMA_VERSION = 1;
const PEOPLE_SOURCE = "world_people_bridge";

const PEOPLE_TABLES = [
  "people_npcs",
  "people_households",
  "people_assets",
  "people_estates",
  "people_relationships"
];

const PEOPLE_TABLE_COLLECTIONS = [
  ["people_npcs", "npcs"],
  ["people_households", "households"],
  ["people_assets", "assets"],
  ["people_estates", "estates"],
  ["people_relationships", "relationships"]
];

function stringifyJson(value, fallback) {
  const source = value === undefined ? fallback : value;
  return JSON.stringify(source);
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toNullableInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function boolToInteger(value) {
  return value === true ? 1 : 0;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function nullableText(value) {
  return typeof value === "string" && value ? value : null;
}

function cleanText(value, maxLength = 120) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function collectionFor(value) {
  const collectionNames = new Set(PEOPLE_TABLE_COLLECTIONS.map(([, collectionName]) => collectionName));
  if (collectionNames.has(value)) return value;
  const tableMatch = PEOPLE_TABLE_COLLECTIONS.find(([tableName]) => tableName === value);
  if (tableMatch) return tableMatch[1];
  const singular = {
    npc: "npcs",
    household: "households",
    asset: "assets",
    estate: "estates",
    relationship: "relationships"
  };
  return singular[value] || "";
}

function eventLinkKey(collectionName, rowId) {
  const collection = collectionFor(collectionName);
  const id = cleanText(rowId, 96);
  if (!collection || !id) return "";
  return `${collection}:${id}`;
}

function normalizePeopleEventLink(link) {
  const source = link && typeof link === "object" ? link : {};
  const collection = collectionFor(source.collection || source.rowKind || source.rowType || source.tableName);
  const rowId = cleanText(source.rowId || source.row_id, 96);
  const eventId = cleanText(source.eventId || source.event_id, 120);
  if (!collection || !rowId || !eventId) return null;
  return { collection, rowId, eventId };
}

function metadataValue(record, key, fallback = 0) {
  return toInteger(record.metadata?.[key] ?? record.worldState?.[key], fallback);
}

function initializePeopleTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS people_npcs (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      legacy_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER NOT NULL,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_intent TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      courtesy_name TEXT NOT NULL,
      gender_label TEXT NOT NULL,
      age INTEGER NOT NULL,
      alive INTEGER NOT NULL,
      home_city_row_id TEXT,
      current_city_row_id TEXT,
      household_row_id TEXT,
      current_office_row_id TEXT,
      current_posting_row_id TEXT,
      rank_label TEXT NOT NULL,
      bureau_row_id TEXT,
      faction_row_id TEXT,
      literary_skill INTEGER NOT NULL,
      administration INTEGER NOT NULL,
      legal_judgment INTEGER NOT NULL,
      military_command INTEGER NOT NULL,
      diplomacy INTEGER NOT NULL,
      learning INTEGER NOT NULL,
      ambition INTEGER NOT NULL,
      loyalty INTEGER NOT NULL,
      integrity INTEGER NOT NULL,
      caution INTEGER NOT NULL,
      temper INTEGER NOT NULL,
      ideology_tags_json TEXT NOT NULL,
      current_goal TEXT NOT NULL,
      reputation INTEGER NOT NULL,
      influence INTEGER NOT NULL,
      patronage_power INTEGER NOT NULL,
      peer_network INTEGER NOT NULL,
      wealth_cash_estimate INTEGER NOT NULL,
      land_mu_estimate INTEGER NOT NULL,
      debts_estimate INTEGER NOT NULL,
      annual_income_estimate INTEGER NOT NULL,
      estate_ids_json TEXT NOT NULL,
      asset_ids_json TEXT NOT NULL,
      father_row_id TEXT,
      mother_row_id TEXT,
      spouse_ids_json TEXT NOT NULL,
      children_ids_json TEXT NOT NULL,
      marriage_alliance_tags_json TEXT NOT NULL,
      health INTEGER NOT NULL,
      legal_risk INTEGER NOT NULL,
      impeachment_risk INTEGER NOT NULL,
      resentment_risk INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_people_npcs_session_visibility
      ON people_npcs(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_people_npcs_household
      ON people_npcs(session_id, household_row_id);

    CREATE TABLE IF NOT EXISTS people_households (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      legacy_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER NOT NULL,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_intent TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      family_name TEXT NOT NULL,
      seat_city_row_id TEXT,
      wealth_score INTEGER NOT NULL,
      land_mu INTEGER NOT NULL,
      prestige INTEGER NOT NULL,
      gentry_rank TEXT NOT NULL,
      marriage_network_score INTEGER NOT NULL,
      debt_pressure INTEGER NOT NULL,
      political_alignment TEXT NOT NULL,
      family_risk INTEGER NOT NULL,
      member_npc_ids_json TEXT NOT NULL,
      estate_ids_json TEXT NOT NULL,
      asset_ids_json TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_people_households_session_visibility
      ON people_households(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_people_households_seat_city
      ON people_households(session_id, seat_city_row_id);

    CREATE TABLE IF NOT EXISTS people_assets (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      legacy_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER NOT NULL,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_intent TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      owner_row_id TEXT,
      city_row_id TEXT,
      value_estimate INTEGER NOT NULL,
      annual_income_estimate INTEGER NOT NULL,
      debt_value INTEGER NOT NULL,
      status_label TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_people_assets_session_visibility
      ON people_assets(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_people_assets_owner
      ON people_assets(session_id, owner_type, owner_row_id);

    CREATE TABLE IF NOT EXISTS people_estates (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      legacy_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER NOT NULL,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_intent TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      owner_row_id TEXT,
      city_row_id TEXT,
      region_row_id TEXT,
      land_mu INTEGER NOT NULL,
      tenant_households INTEGER NOT NULL,
      rent_grain_estimate INTEGER NOT NULL,
      tax_burden INTEGER NOT NULL,
      waterworks INTEGER NOT NULL,
      dispute_risk INTEGER NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_people_estates_session_visibility
      ON people_estates(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_people_estates_owner
      ON people_estates(session_id, owner_type, owner_row_id);

    CREATE TABLE IF NOT EXISTS people_relationships (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      legacy_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER NOT NULL,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_intent TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_row_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_row_id TEXT NOT NULL,
      relationship INTEGER NOT NULL,
      trust INTEGER NOT NULL,
      resentment INTEGER NOT NULL,
      obligation INTEGER NOT NULL,
      patronage INTEGER NOT NULL,
      fear INTEGER NOT NULL,
      rivalry INTEGER NOT NULL,
      stance TEXT NOT NULL,
      recent_intent TEXT NOT NULL,
      recent_notes_json TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_people_relationships_session_visibility
      ON people_relationships(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_people_relationships_source
      ON people_relationships(session_id, source_type, source_row_id);
    CREATE INDEX IF NOT EXISTS idx_people_relationships_target
      ON people_relationships(session_id, target_type, target_row_id);
  `);
}

function deletePeopleRows(database, sessionId) {
  for (const tableName of PEOPLE_TABLES) {
    database.prepare(`DELETE FROM ${tableName} WHERE session_id = ?`).run(sessionId);
  }
}

function insertRow(database, tableName, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  database
    .prepare(`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...columns.map((column) => row[column]));
}

function readAuditEventLinkMap(database, sessionId) {
  const links = new Map();
  const rows = database
    .prepare(`
      SELECT event_id, related_json
      FROM event_log
      WHERE session_id = ?
        AND source_system = 'world_people'
      ORDER BY created_at, event_id
    `)
    .all(sessionId);

  for (const row of rows) {
    const related = parseJsonObject(row.related_json);
    const primary = normalizePeopleEventLink({
      collection: related.rowKind,
      rowId: related.rowId,
      eventId: row.event_id
    });
    if (primary) links.set(eventLinkKey(primary.collection, primary.rowId), primary.eventId);

    const rowLinks = Array.isArray(related.rowLinks) ? related.rowLinks : [];
    for (const link of rowLinks) {
      const normalized = normalizePeopleEventLink({
        collection: link.collection || link.rowKind,
        rowId: link.rowId,
        eventId: row.event_id
      });
      if (!normalized) continue;
      links.set(eventLinkKey(normalized.collection, normalized.rowId), normalized.eventId);
    }
  }
  return links;
}

function readExistingEventLinkMap(database, sessionId) {
  const links = readAuditEventLinkMap(database, sessionId);
  for (const [tableName, collectionName] of PEOPLE_TABLE_COLLECTIONS) {
    const rows = database
      .prepare(`
        SELECT p.row_id, p.last_event_id
        FROM ${tableName} p
        JOIN event_log e
          ON e.session_id = p.session_id
         AND e.event_id = p.last_event_id
        WHERE p.session_id = ?
          AND p.last_event_id IS NOT NULL
          AND e.source_system = 'world_people'
      `)
      .all(sessionId);
    for (const row of rows) {
      const key = eventLinkKey(collectionName, row.row_id);
      if (key) links.set(key, row.last_event_id);
    }
  }
  return links;
}

function buildEventLinkMap(database, sessionId, eventLinks = []) {
  const links = readExistingEventLinkMap(database, sessionId);
  for (const link of Array.isArray(eventLinks) ? eventLinks : []) {
    const normalized = normalizePeopleEventLink(link);
    if (!normalized) continue;
    const key = eventLinkKey(normalized.collection, normalized.rowId);
    if (key) links.set(key, normalized.eventId);
  }
  return links;
}

function buildCommonRow(record, people, row, collectionName, eventLinkMap) {
  const metadata = {
    bridgeSchemaVersion: people.schemaVersion,
    generatedAtTurn: people.generatedAtTurn
  };
  const lastUpdatedTurn = toInteger(row.lastUpdatedTurn, metadataValue(record, "turnCount", 0));
  const lastEventId = eventLinkMap.get(eventLinkKey(collectionName, row.id)) || null;

  return {
    session_id: record.sessionId,
    row_id: row.id,
    legacy_row_id: row.id,
    domain_schema_version: PEOPLE_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: PEOPLE_SOURCE,
    visibility: text(row.visibility) || "public",
    known_to_player: boolToInteger(row.knownToPlayer),
    intel_confidence: toNullableInteger(row.intelConfidence),
    last_report_turn: lastUpdatedTurn,
    last_updated_turn: lastUpdatedTurn,
    last_updated_year: metadataValue(record, "year", 0),
    last_updated_month: metadataValue(record, "month", 1),
    last_updated_ten_day_period: metadataValue(record, "tenDayPeriod", 1),
    last_event_id: lastEventId,
    public_summary: text(row.publicSummary),
    hidden_intent: text(row.hiddenIntent),
    hidden_notes_json: stringifyJson(row.hiddenNotes, []),
    metadata_json: stringifyJson(metadata, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function insertNpcs(database, record, people, eventLinkMap) {
  for (const row of people.npcs) {
    insertRow(database, "people_npcs", {
      ...buildCommonRow(record, people, row, "npcs", eventLinkMap),
      name: row.name,
      courtesy_name: text(row.courtesyName),
      gender_label: text(row.genderLabel),
      age: toInteger(row.age, 30),
      alive: boolToInteger(row.alive !== false),
      home_city_row_id: nullableText(row.homeCityId),
      current_city_row_id: nullableText(row.currentCityId),
      household_row_id: nullableText(row.householdId),
      current_office_row_id: nullableText(row.currentOfficeId),
      current_posting_row_id: nullableText(row.currentPostingId),
      rank_label: text(row.rankLabel),
      bureau_row_id: nullableText(row.bureauId),
      faction_row_id: nullableText(row.factionId),
      literary_skill: toInteger(row.skills?.literarySkill, 40),
      administration: toInteger(row.skills?.administration, 40),
      legal_judgment: toInteger(row.skills?.legalJudgment, 40),
      military_command: toInteger(row.skills?.militaryCommand, 30),
      diplomacy: toInteger(row.skills?.diplomacy, 40),
      learning: toInteger(row.skills?.learning, 45),
      ambition: toInteger(row.temperament?.ambition, 45),
      loyalty: toInteger(row.temperament?.loyalty, 50),
      integrity: toInteger(row.temperament?.integrity, 55),
      caution: toInteger(row.temperament?.caution, 50),
      temper: toInteger(row.temperament?.temper, 40),
      ideology_tags_json: stringifyJson(row.ideologyTags, []),
      current_goal: text(row.currentGoal),
      reputation: toInteger(row.reputation, 30),
      influence: toInteger(row.influence, 20),
      patronage_power: toInteger(row.patronagePower, 10),
      peer_network: toInteger(row.peerNetwork, 20),
      wealth_cash_estimate: toInteger(row.wealthCash, 0),
      land_mu_estimate: toInteger(row.landMu, 0),
      debts_estimate: toInteger(row.debts, 0),
      annual_income_estimate: toInteger(row.annualIncomeEstimate, 0),
      estate_ids_json: stringifyJson(row.estateIds, []),
      asset_ids_json: stringifyJson(row.assetIds, []),
      father_row_id: nullableText(row.family?.fatherId),
      mother_row_id: nullableText(row.family?.motherId),
      spouse_ids_json: stringifyJson(row.family?.spouseIds, []),
      children_ids_json: stringifyJson(row.family?.childrenIds, []),
      marriage_alliance_tags_json: stringifyJson(row.family?.marriageAllianceTags, []),
      health: toInteger(row.health, 80),
      legal_risk: toInteger(row.legalRisk, 0),
      impeachment_risk: toInteger(row.impeachmentRisk, 0),
      resentment_risk: toInteger(row.resentmentRisk, 0)
    });
  }
}

function insertHouseholds(database, record, people, eventLinkMap) {
  for (const row of people.households) {
    insertRow(database, "people_households", {
      ...buildCommonRow(record, people, row, "households", eventLinkMap),
      family_name: row.familyName,
      seat_city_row_id: nullableText(row.seatCityId),
      wealth_score: toInteger(row.wealthScore, 30),
      land_mu: toInteger(row.landMu, 0),
      prestige: toInteger(row.prestige, 20),
      gentry_rank: text(row.gentryRank),
      marriage_network_score: toInteger(row.marriageNetworkScore, 20),
      debt_pressure: toInteger(row.debtPressure, 0),
      political_alignment: text(row.politicalAlignment),
      family_risk: toInteger(row.familyRisk, 0),
      member_npc_ids_json: stringifyJson(row.memberNpcIds, []),
      estate_ids_json: stringifyJson(row.estateIds, []),
      asset_ids_json: stringifyJson(row.assetIds, [])
    });
  }
}

function insertAssets(database, record, people, eventLinkMap) {
  for (const row of people.assets) {
    insertRow(database, "people_assets", {
      ...buildCommonRow(record, people, row, "assets", eventLinkMap),
      kind: text(row.kind) || "other",
      name: row.name,
      owner_type: text(row.ownerType) || "household",
      owner_row_id: nullableText(row.ownerId),
      city_row_id: nullableText(row.cityId),
      value_estimate: toInteger(row.valueEstimate, 0),
      annual_income_estimate: toInteger(row.annualIncomeEstimate, 0),
      debt_value: toInteger(row.debtValue, 0),
      status_label: text(row.statusLabel)
    });
  }
}

function insertEstates(database, record, people, eventLinkMap) {
  for (const row of people.estates) {
    insertRow(database, "people_estates", {
      ...buildCommonRow(record, people, row, "estates", eventLinkMap),
      name: row.name,
      owner_type: text(row.ownerType) || "household",
      owner_row_id: nullableText(row.ownerId),
      city_row_id: nullableText(row.cityId),
      region_row_id: nullableText(row.regionId),
      land_mu: toInteger(row.landMu, 0),
      tenant_households: toInteger(row.tenantHouseholds, 0),
      rent_grain_estimate: toInteger(row.rentGrainEstimate, 0),
      tax_burden: toInteger(row.taxBurden, 30),
      waterworks: toInteger(row.waterworks, 50),
      dispute_risk: toInteger(row.disputeRisk, 0),
      status: text(row.status) || "unknown",
      status_label: text(row.statusLabel)
    });
  }
}

function insertRelationships(database, record, people, eventLinkMap) {
  for (const row of people.relationships) {
    insertRow(database, "people_relationships", {
      ...buildCommonRow(record, people, row, "relationships", eventLinkMap),
      source_type: row.sourceType,
      source_row_id: row.sourceId,
      target_type: row.targetType,
      target_row_id: row.targetId,
      relationship: toInteger(row.relationship, 0),
      trust: toInteger(row.trust, 0),
      resentment: toInteger(row.resentment, 0),
      obligation: toInteger(row.obligation, 0),
      patronage: toInteger(row.patronage, 0),
      fear: toInteger(row.fear, 0),
      rivalry: toInteger(row.rivalry, 0),
      stance: text(row.stance),
      recent_intent: text(row.recentIntent),
      recent_notes_json: stringifyJson(row.recentNotes, [])
    });
  }
}

function syncPeopleTables(database, record, eventLinks = []) {
  const people = normalizeRecordWorldPeople(record);
  const eventLinkMap = buildEventLinkMap(database, record.sessionId, eventLinks);

  deletePeopleRows(database, record.sessionId);
  insertNpcs(database, record, people, eventLinkMap);
  insertHouseholds(database, record, people, eventLinkMap);
  insertAssets(database, record, people, eventLinkMap);
  insertEstates(database, record, people, eventLinkMap);
  insertRelationships(database, record, people, eventLinkMap);
}

function getPeopleTableCounts(database, sessionId) {
  return {
    npcs: database.prepare("SELECT COUNT(*) AS count FROM people_npcs WHERE session_id = ?").get(sessionId).count,
    households: database.prepare("SELECT COUNT(*) AS count FROM people_households WHERE session_id = ?").get(sessionId).count,
    assets: database.prepare("SELECT COUNT(*) AS count FROM people_assets WHERE session_id = ?").get(sessionId).count,
    estates: database.prepare("SELECT COUNT(*) AS count FROM people_estates WHERE session_id = ?").get(sessionId).count,
    relationships: database.prepare("SELECT COUNT(*) AS count FROM people_relationships WHERE session_id = ?").get(sessionId).count
  };
}

function getExpectedPeopleTableCounts(people) {
  return {
    npcs: people.npcs.length,
    households: people.households.length,
    assets: people.assets.length,
    estates: people.estates.length,
    relationships: people.relationships.length
  };
}

function hasStalePeopleRows(database, sessionId, revision) {
  for (const tableName of PEOPLE_TABLES) {
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ? AND revision <> ?`)
      .get(sessionId, revision);
    if (row.count > 0) return true;
  }
  return false;
}

function hasMismatchedPeopleRowIds(database, sessionId, expected) {
  for (const [tableName, collectionName] of PEOPLE_TABLE_COLLECTIONS) {
    const expectedIds = new Set(expected[collectionName].map((row) => row.id));
    const storedRows = database
      .prepare(`SELECT row_id FROM ${tableName} WHERE session_id = ?`)
      .all(sessionId);

    if (storedRows.length !== expectedIds.size) return true;
    for (const row of storedRows) {
      if (!expectedIds.has(row.row_id)) return true;
    }
  }
  return false;
}

function getPeopleRepairStatus(database, record) {
  const before = JSON.stringify(record.worldState?.worldPeople || null);
  const expected = normalizeWorldPeopleState(record.worldState);
  const worldStateChanged = JSON.stringify(expected) !== before;
  const counts = getPeopleTableCounts(database, record.sessionId);
  const expectedCounts = getExpectedPeopleTableCounts(expected);
  const missingOrMismatched = (
    counts.npcs !== expectedCounts.npcs ||
    counts.households !== expectedCounts.households ||
    counts.assets !== expectedCounts.assets ||
    counts.estates !== expectedCounts.estates ||
    counts.relationships !== expectedCounts.relationships
  );
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedPeopleRowIds(database, record.sessionId, expected);
  const staleRows = hasStalePeopleRows(database, record.sessionId, record.revision);
  const tableNeedsRepair = missingOrMismatched || mismatchedRowIds || staleRows;

  return {
    counts,
    expected,
    expectedCounts,
    missingOrMismatched,
    mismatchedRowIds,
    needsRepair: worldStateChanged || tableNeedsRepair,
    staleRows,
    tableNeedsRepair,
    worldStateChanged
  };
}

function ensurePeopleTablesForRecord(database, record) {
  const status = getPeopleRepairStatus(database, record);
  record.worldState.worldPeople = status.expected;

  if (status.tableNeedsRepair || status.worldStateChanged) {
    syncPeopleTables(database, record);
    return true;
  }
  return false;
}

function normalizeRecordWorldPeople(record) {
  const people = normalizeWorldPeopleState(record.worldState);
  record.worldState.worldPeople = people;
  return people;
}

module.exports = {
  PEOPLE_DOMAIN_SCHEMA_VERSION,
  PEOPLE_SOURCE,
  deletePeopleRows,
  ensurePeopleTablesForRecord,
  getPeopleRepairStatus,
  getPeopleTableCounts,
  initializePeopleTables,
  normalizeRecordWorldPeople,
  syncPeopleTables
};
