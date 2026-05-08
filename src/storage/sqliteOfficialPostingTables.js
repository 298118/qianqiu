const { buildWorldPeopleView } = require("../game/worldPeople");
const { normalizeOfficialPostingsState } = require("../game/officialPostings");

const OFFICIAL_POSTING_DOMAIN_SCHEMA_VERSION = 1;

const OFFICIAL_POSTING_TABLES = [
  "office_bureaus",
  "office_catalog",
  "office_city_jurisdictions",
  "office_postings",
  "office_assessments",
  "office_transfers"
];

const OFFICIAL_POSTING_TABLE_COLLECTIONS = [
  ["office_bureaus", "bureaus"],
  ["office_catalog", "offices"],
  ["office_city_jurisdictions", "cityJurisdictions"],
  ["office_postings", "postings"],
  ["office_assessments", "assessmentRecords"],
  ["office_transfers", "transferRecords"]
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

function metadataValue(record, key, fallback = 0) {
  return toInteger(record.metadata?.[key] ?? record.worldState?.[key], fallback);
}

function dateValue(source = {}, key, fallback) {
  const date = source && typeof source === "object" ? source : {};
  return toInteger(date[key], fallback);
}

function initializeOfficialPostingTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS office_bureaus (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases_json TEXT NOT NULL,
      level TEXT NOT NULL,
      parent_bureau_row_id TEXT,
      capital_city_row_id TEXT,
      jurisdiction_row_ids_json TEXT NOT NULL,
      office_row_ids_json TEXT NOT NULL,
      duties_json TEXT NOT NULL,
      authority_metrics_json TEXT NOT NULL,
      risk_tags_json TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_bureaus_session_visibility
      ON office_bureaus(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS office_catalog (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT NOT NULL,
      aliases_json TEXT NOT NULL,
      rank_label TEXT NOT NULL,
      rank_band TEXT NOT NULL,
      bureau_row_id TEXT,
      track TEXT NOT NULL,
      jurisdiction_scope TEXT NOT NULL,
      typical_city_row_ids_json TEXT NOT NULL,
      required_rank_or_exam_json TEXT NOT NULL,
      appointment_methods_json TEXT NOT NULL,
      normal_term_months INTEGER NOT NULL,
      duties_json TEXT NOT NULL,
      authority_metrics_json TEXT NOT NULL,
      promotion_path_row_ids_json TEXT NOT NULL,
      risk_tags_json TEXT NOT NULL,
      outpost INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_catalog_session_visibility
      ON office_catalog(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_office_catalog_bureau
      ON office_catalog(session_id, bureau_row_id);

    CREATE TABLE IF NOT EXISTS office_city_jurisdictions (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      bureau_row_id TEXT,
      supervising_bureau_row_id TEXT,
      city_row_id TEXT,
      region_row_id TEXT,
      country_row_id TEXT,
      jurisdiction_scope TEXT NOT NULL,
      available_office_row_ids_json TEXT NOT NULL,
      route_row_ids_json TEXT NOT NULL,
      frontier_zone_row_ids_json TEXT NOT NULL,
      public_order INTEGER NOT NULL,
      tax_capacity INTEGER NOT NULL,
      lawsuits INTEGER NOT NULL,
      waterworks INTEGER NOT NULL,
      gentry_influence INTEGER NOT NULL,
      disaster_risk INTEGER NOT NULL,
      military_pressure INTEGER NOT NULL,
      academy_level INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_city_jurisdictions_session_visibility
      ON office_city_jurisdictions(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_office_city_jurisdictions_city
      ON office_city_jurisdictions(session_id, city_row_id);

    CREATE TABLE IF NOT EXISTS office_postings (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      office_row_id TEXT,
      office_title TEXT NOT NULL,
      bureau_row_id TEXT,
      holder_type TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_people_row_id TEXT,
      status TEXT NOT NULL,
      city_row_id TEXT,
      region_row_id TEXT,
      jurisdiction_row_id TEXT,
      superior_posting_row_id TEXT,
      started_year INTEGER NOT NULL,
      started_month INTEGER NOT NULL,
      started_ten_day_period INTEGER NOT NULL,
      started_turn INTEGER NOT NULL,
      ended_year INTEGER,
      ended_month INTEGER,
      ended_ten_day_period INTEGER,
      ended_turn INTEGER,
      expected_review_turn INTEGER NOT NULL,
      term_months INTEGER NOT NULL,
      performance_score INTEGER NOT NULL,
      impeachment_risk INTEGER NOT NULL,
      public_reputation INTEGER NOT NULL,
      assignment_ids_json TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_postings_session_visibility
      ON office_postings(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_office_postings_holder
      ON office_postings(session_id, holder_type, holder_id);
    CREATE INDEX IF NOT EXISTS idx_office_postings_review
      ON office_postings(session_id, status, expected_review_turn);

    CREATE TABLE IF NOT EXISTS office_assessments (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      posting_row_id TEXT,
      office_row_id TEXT,
      bureau_row_id TEXT,
      holder_type TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_people_row_id TEXT,
      cycle_id TEXT NOT NULL,
      date_year INTEGER NOT NULL,
      date_month INTEGER NOT NULL,
      date_ten_day_period INTEGER NOT NULL,
      date_turn INTEGER NOT NULL,
      status TEXT NOT NULL,
      merit_score INTEGER NOT NULL,
      risk_score INTEGER NOT NULL,
      recommendation TEXT NOT NULL,
      public_finding TEXT NOT NULL,
      evidence_event_ids_json TEXT NOT NULL,
      assignment_ids_json TEXT NOT NULL,
      related_impeachment_stage TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_assessments_session_visibility
      ON office_assessments(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_office_assessments_posting
      ON office_assessments(session_id, posting_row_id);

    CREATE TABLE IF NOT EXISTS office_transfers (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      catalog_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      known_to_player INTEGER NOT NULL,
      intel_confidence INTEGER,
      last_report_turn INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      last_event_id TEXT,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      holder_type TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_people_row_id TEXT,
      from_posting_row_id TEXT,
      to_posting_row_id TEXT,
      from_office_row_id TEXT,
      to_office_row_id TEXT,
      from_city_row_id TEXT,
      to_city_row_id TEXT,
      related_assessment_row_id TEXT,
      date_year INTEGER NOT NULL,
      date_month INTEGER NOT NULL,
      date_ten_day_period INTEGER NOT NULL,
      date_turn INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      public_reason TEXT NOT NULL,
      related_event_ids_json TEXT NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_office_transfers_session_visibility
      ON office_transfers(session_id, visibility, row_id);
    CREATE INDEX IF NOT EXISTS idx_office_transfers_holder
      ON office_transfers(session_id, holder_type, holder_id);
  `);
}

function deleteOfficialPostingRows(database, sessionId) {
  for (const tableName of OFFICIAL_POSTING_TABLES) {
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

function buildVisiblePeopleIds(record) {
  try {
    const view = buildWorldPeopleView(record.worldState);
    return new Set((view.npcs || []).map((npc) => npc.id));
  } catch (error) {
    return new Set();
  }
}

function safeHolderValues(row, visiblePeopleIds) {
  const holderType = text(row.holderType) || "unknown";
  const holderId = text(row.holderId);
  if (holderType !== "npc") {
    return {
      holderId,
      holderPeopleRowId: null
    };
  }
  if (!holderId || !visiblePeopleIds.has(holderId)) {
    return {
      holderId: "",
      holderPeopleRowId: null
    };
  }
  return {
    holderId,
    holderPeopleRowId: holderId
  };
}

function buildCommonRow(record, postings, row, options = {}) {
  const lastUpdatedTurn = toInteger(row.lastUpdatedTurn, metadataValue(record, "turnCount", 0));
  const metadata = {
    bridgeSchemaVersion: postings.schemaVersion,
    generatedAtTurn: postings.generatedAtTurn,
    collection: options.collection || ""
  };

  return {
    session_id: record.sessionId,
    row_id: row.id,
    catalog_row_id: nullableText(options.catalogRowId),
    domain_schema_version: OFFICIAL_POSTING_DOMAIN_SCHEMA_VERSION,
    revision: record.revision,
    row_revision: record.revision,
    source: options.source || "official_posting_bridge",
    visibility: text(row.visibility) || "public",
    known_to_player: boolToInteger(row.knownToPlayer),
    intel_confidence: toNullableInteger(row.intelConfidence),
    last_report_turn: lastUpdatedTurn,
    last_updated_turn: lastUpdatedTurn,
    last_updated_year: metadataValue(record, "year", 0),
    last_updated_month: metadataValue(record, "month", 1),
    last_updated_ten_day_period: metadataValue(record, "tenDayPeriod", 1),
    last_event_id: null,
    public_summary: text(row.publicSummary),
    hidden_notes_json: stringifyJson(row.hiddenNotes, []),
    metadata_json: stringifyJson(metadata, {}),
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function insertBureaus(database, record, postings) {
  for (const row of postings.bureaus) {
    insertRow(database, "office_bureaus", {
      ...buildCommonRow(record, postings, row, {
        catalogRowId: row.id,
        collection: "bureaus",
        source: "official_catalog"
      }),
      name: row.name,
      aliases_json: stringifyJson(row.aliases, []),
      level: row.level,
      parent_bureau_row_id: nullableText(row.parentBureauId),
      capital_city_row_id: nullableText(row.capitalCityId),
      jurisdiction_row_ids_json: stringifyJson(row.jurisdictionIds, []),
      office_row_ids_json: stringifyJson(row.officeIds, []),
      duties_json: stringifyJson(row.duties, []),
      authority_metrics_json: stringifyJson(row.authorityMetrics, []),
      risk_tags_json: stringifyJson(row.riskTags, [])
    });
  }
}

function insertOffices(database, record, postings) {
  for (const row of postings.offices) {
    insertRow(database, "office_catalog", {
      ...buildCommonRow(record, postings, row, {
        catalogRowId: row.id,
        collection: "offices",
        source: "official_catalog"
      }),
      title: row.title,
      aliases_json: stringifyJson(row.aliases, []),
      rank_label: text(row.rankLabel),
      rank_band: row.rankBand,
      bureau_row_id: nullableText(row.bureauId),
      track: text(row.track),
      jurisdiction_scope: row.jurisdictionScope,
      typical_city_row_ids_json: stringifyJson(row.typicalCityIds, []),
      required_rank_or_exam_json: stringifyJson(row.requiredRankOrExam, []),
      appointment_methods_json: stringifyJson(row.appointmentMethods, []),
      normal_term_months: toInteger(row.normalTermMonths, 0),
      duties_json: stringifyJson(row.duties, []),
      authority_metrics_json: stringifyJson(row.authorityMetrics, []),
      promotion_path_row_ids_json: stringifyJson(row.promotionPathIds, []),
      risk_tags_json: stringifyJson(row.riskTags, []),
      outpost: boolToInteger(row.outpost)
    });
  }
}

function insertCityJurisdictions(database, record, postings) {
  for (const row of postings.cityJurisdictions) {
    const metrics = row.localMetrics || {};
    insertRow(database, "office_city_jurisdictions", {
      ...buildCommonRow(record, postings, row, {
        collection: "cityJurisdictions",
        source: "geography_bridge"
      }),
      name: row.name,
      bureau_row_id: nullableText(row.bureauId),
      supervising_bureau_row_id: nullableText(row.supervisingBureauId),
      city_row_id: nullableText(row.cityId),
      region_row_id: nullableText(row.regionId),
      country_row_id: nullableText(row.countryId),
      jurisdiction_scope: row.jurisdictionScope,
      available_office_row_ids_json: stringifyJson(row.availableOfficeIds, []),
      route_row_ids_json: stringifyJson(row.routeIds, []),
      frontier_zone_row_ids_json: stringifyJson(row.frontierZoneIds, []),
      public_order: toInteger(metrics.publicOrder, 50),
      tax_capacity: toInteger(metrics.taxCapacity, 50),
      lawsuits: toInteger(metrics.lawsuits, 20),
      waterworks: toInteger(metrics.waterworks, 50),
      gentry_influence: toInteger(metrics.gentryInfluence, 50),
      disaster_risk: toInteger(metrics.disasterRisk, 20),
      military_pressure: toInteger(metrics.militaryPressure, 20),
      academy_level: toInteger(metrics.academyLevel, 40)
    });
  }
}

function insertPostings(database, record, postings, visiblePeopleIds) {
  for (const row of postings.postings) {
    const holder = safeHolderValues(row, visiblePeopleIds);
    const startedAt = row.startedAt || {};
    const endedAt = row.endedAt || null;
    insertRow(database, "office_postings", {
      ...buildCommonRow(record, postings, row, {
        catalogRowId: row.officeId,
        collection: "postings",
        source: row.holderType === "player" ? "official_career" : "official_posting_bridge"
      }),
      office_row_id: nullableText(row.officeId),
      office_title: text(row.officeTitle),
      bureau_row_id: nullableText(row.bureauId),
      holder_type: text(row.holderType) || "unknown",
      holder_id: holder.holderId,
      holder_people_row_id: holder.holderPeopleRowId,
      status: row.status,
      city_row_id: nullableText(row.cityId),
      region_row_id: nullableText(row.regionId),
      jurisdiction_row_id: nullableText(row.jurisdictionId),
      superior_posting_row_id: nullableText(row.superiorPostingId),
      started_year: dateValue(startedAt, "year", metadataValue(record, "year", 0)),
      started_month: dateValue(startedAt, "month", metadataValue(record, "month", 1)),
      started_ten_day_period: dateValue(startedAt, "tenDayPeriod", metadataValue(record, "tenDayPeriod", 1)),
      started_turn: dateValue(startedAt, "turn", metadataValue(record, "turnCount", 0)),
      ended_year: endedAt ? dateValue(endedAt, "year", 0) : null,
      ended_month: endedAt ? dateValue(endedAt, "month", 1) : null,
      ended_ten_day_period: endedAt ? dateValue(endedAt, "tenDayPeriod", 1) : null,
      ended_turn: endedAt ? dateValue(endedAt, "turn", 0) : null,
      expected_review_turn: toInteger(row.expectedReviewTurn, metadataValue(record, "turnCount", 0)),
      term_months: toInteger(row.termMonths, 0),
      performance_score: toInteger(row.performanceScore, 50),
      impeachment_risk: toInteger(row.impeachmentRisk, 0),
      public_reputation: toInteger(row.publicReputation, 50),
      assignment_ids_json: stringifyJson(row.assignmentIds, [])
    });
  }
}

function insertAssessments(database, record, postings, visiblePeopleIds) {
  for (const row of postings.assessmentRecords) {
    const holder = safeHolderValues(row, visiblePeopleIds);
    const date = row.date || {};
    insertRow(database, "office_assessments", {
      ...buildCommonRow(record, postings, row, {
        catalogRowId: row.officeId,
        collection: "assessmentRecords",
        source: "official_career"
      }),
      posting_row_id: nullableText(row.postingId),
      office_row_id: nullableText(row.officeId),
      bureau_row_id: nullableText(row.bureauId),
      holder_type: text(row.holderType) || "unknown",
      holder_id: holder.holderId,
      holder_people_row_id: holder.holderPeopleRowId,
      cycle_id: text(row.cycleId),
      date_year: dateValue(date, "year", metadataValue(record, "year", 0)),
      date_month: dateValue(date, "month", metadataValue(record, "month", 1)),
      date_ten_day_period: dateValue(date, "tenDayPeriod", metadataValue(record, "tenDayPeriod", 1)),
      date_turn: dateValue(date, "turn", metadataValue(record, "turnCount", 0)),
      status: row.status,
      merit_score: toInteger(row.meritScore, 50),
      risk_score: toInteger(row.riskScore, 0),
      recommendation: row.recommendation,
      public_finding: text(row.publicFinding),
      evidence_event_ids_json: stringifyJson(row.evidenceEventIds, []),
      assignment_ids_json: stringifyJson(row.assignmentIds, []),
      related_impeachment_stage: ""
    });
  }
}

function insertTransfers(database, record, postings, visiblePeopleIds) {
  for (const row of postings.transferRecords) {
    const holder = safeHolderValues(row, visiblePeopleIds);
    const date = row.date || {};
    insertRow(database, "office_transfers", {
      ...buildCommonRow(record, postings, row, {
        catalogRowId: row.toOfficeId || row.fromOfficeId,
        collection: "transferRecords",
        source: "official_career"
      }),
      holder_type: text(row.holderType) || "unknown",
      holder_id: holder.holderId,
      holder_people_row_id: holder.holderPeopleRowId,
      from_posting_row_id: nullableText(row.fromPostingId),
      to_posting_row_id: nullableText(row.toPostingId),
      from_office_row_id: nullableText(row.fromOfficeId),
      to_office_row_id: nullableText(row.toOfficeId),
      from_city_row_id: nullableText(row.fromCityId),
      to_city_row_id: nullableText(row.toCityId),
      related_assessment_row_id: nullableText(row.relatedAssessmentId),
      date_year: dateValue(date, "year", metadataValue(record, "year", 0)),
      date_month: dateValue(date, "month", metadataValue(record, "month", 1)),
      date_ten_day_period: dateValue(date, "tenDayPeriod", metadataValue(record, "tenDayPeriod", 1)),
      date_turn: dateValue(date, "turn", metadataValue(record, "turnCount", 0)),
      type: row.type,
      status: row.status,
      public_reason: text(row.publicReason),
      related_event_ids_json: stringifyJson(row.relatedEventIds, [])
    });
  }
}

function syncOfficialPostingTables(database, record) {
  const postings = normalizeRecordOfficialPostings(record);
  const visiblePeopleIds = buildVisiblePeopleIds(record);

  deleteOfficialPostingRows(database, record.sessionId);
  insertBureaus(database, record, postings);
  insertOffices(database, record, postings);
  insertCityJurisdictions(database, record, postings);
  insertPostings(database, record, postings, visiblePeopleIds);
  insertAssessments(database, record, postings, visiblePeopleIds);
  insertTransfers(database, record, postings, visiblePeopleIds);
}

function getOfficialPostingTableCounts(database, sessionId) {
  return {
    bureaus: database.prepare("SELECT COUNT(*) AS count FROM office_bureaus WHERE session_id = ?").get(sessionId).count,
    offices: database.prepare("SELECT COUNT(*) AS count FROM office_catalog WHERE session_id = ?").get(sessionId).count,
    cityJurisdictions: database.prepare("SELECT COUNT(*) AS count FROM office_city_jurisdictions WHERE session_id = ?").get(sessionId).count,
    postings: database.prepare("SELECT COUNT(*) AS count FROM office_postings WHERE session_id = ?").get(sessionId).count,
    assessmentRecords: database.prepare("SELECT COUNT(*) AS count FROM office_assessments WHERE session_id = ?").get(sessionId).count,
    transferRecords: database.prepare("SELECT COUNT(*) AS count FROM office_transfers WHERE session_id = ?").get(sessionId).count
  };
}

function getExpectedOfficialPostingTableCounts(postings) {
  return {
    bureaus: postings.bureaus.length,
    offices: postings.offices.length,
    cityJurisdictions: postings.cityJurisdictions.length,
    postings: postings.postings.length,
    assessmentRecords: postings.assessmentRecords.length,
    transferRecords: postings.transferRecords.length
  };
}

function hasStaleOfficialPostingRows(database, sessionId, revision) {
  for (const tableName of OFFICIAL_POSTING_TABLES) {
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ? AND revision <> ?`)
      .get(sessionId, revision);
    if (row.count > 0) return true;
  }
  return false;
}

function hasMismatchedOfficialPostingRowIds(database, sessionId, expected) {
  for (const [tableName, collectionName] of OFFICIAL_POSTING_TABLE_COLLECTIONS) {
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

function getOfficialPostingRepairStatus(database, record) {
  const before = JSON.stringify(record.worldState?.officialPostings || null);
  const expected = normalizeOfficialPostingsState(record.worldState);
  const worldStateChanged = JSON.stringify(expected) !== before;
  const counts = getOfficialPostingTableCounts(database, record.sessionId);
  const expectedCounts = getExpectedOfficialPostingTableCounts(expected);
  const missingOrMismatched = (
    counts.bureaus !== expectedCounts.bureaus ||
    counts.offices !== expectedCounts.offices ||
    counts.cityJurisdictions !== expectedCounts.cityJurisdictions ||
    counts.postings !== expectedCounts.postings ||
    counts.assessmentRecords !== expectedCounts.assessmentRecords ||
    counts.transferRecords !== expectedCounts.transferRecords
  );
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedOfficialPostingRowIds(database, record.sessionId, expected);
  const staleRows = hasStaleOfficialPostingRows(database, record.sessionId, record.revision);
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

function ensureOfficialPostingTablesForRecord(database, record) {
  const status = getOfficialPostingRepairStatus(database, record);
  record.worldState.officialPostings = status.expected;

  if (status.tableNeedsRepair || status.worldStateChanged) {
    syncOfficialPostingTables(database, record);
    return true;
  }
  return false;
}

function normalizeRecordOfficialPostings(record) {
  const postings = normalizeOfficialPostingsState(record.worldState);
  record.worldState.officialPostings = postings;
  return postings;
}

module.exports = {
  OFFICIAL_POSTING_DOMAIN_SCHEMA_VERSION,
  deleteOfficialPostingRows,
  ensureOfficialPostingTablesForRecord,
  getOfficialPostingRepairStatus,
  getOfficialPostingTableCounts,
  initializeOfficialPostingTables,
  normalizeRecordOfficialPostings,
  syncOfficialPostingTables
};
