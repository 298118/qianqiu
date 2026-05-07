const { normalizeWorldGeographyState } = require("../game/worldGeography");
const { getDefaultWorldGeographySeed } = require("../game/worldGeographySeeds");

const GEOGRAPHY_DOMAIN_SCHEMA_VERSION = 1;

const GEOGRAPHY_TABLES = [
  "geo_office_jurisdictions",
  "geo_frontier_zones",
  "geo_routes",
  "geo_cities",
  "geo_regions",
  "geo_countries"
];

const GEOGRAPHY_TABLE_COLLECTIONS = [
  ["geo_countries", "countries"],
  ["geo_regions", "regions"],
  ["geo_cities", "cities"],
  ["geo_routes", "routes"],
  ["geo_frontier_zones", "frontierZones"],
  ["geo_office_jurisdictions", "officeJurisdictions"]
];

function stringifyJson(value, fallback) {
  const source = value === undefined ? fallback : value;
  return JSON.stringify(source);
}

function toNullableInteger(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function buildSeedRowIdSets() {
  const seed = getDefaultWorldGeographySeed();
  return {
    seedId: seed.seedId,
    countries: new Set(seed.countries.map((row) => row.id)),
    regions: new Set(seed.regions.map((row) => row.id)),
    cities: new Set(seed.cities.map((row) => row.id)),
    routes: new Set(seed.routes.map((row) => row.id)),
    frontierZones: new Set(seed.frontierZones.map((row) => row.id)),
    officeJurisdictions: new Set(seed.officeJurisdictions.map((row) => row.id))
  };
}

function initializeGeographyTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS geo_countries (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      polity_type TEXT NOT NULL,
      ruler_title TEXT NOT NULL,
      capital_city_row_id TEXT,
      culture_tags_json TEXT NOT NULL,
      government_tags_json TEXT NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      pressure INTEGER NOT NULL,
      stability INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_countries_session_visibility
      ON geo_countries(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS geo_regions (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      country_row_id TEXT NOT NULL,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      seat_city_row_id TEXT,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_regions_session_visibility
      ON geo_regions(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS geo_cities (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      country_row_id TEXT NOT NULL,
      region_row_id TEXT NOT NULL,
      name TEXT NOT NULL,
      jurisdiction_level TEXT NOT NULL,
      terrain TEXT NOT NULL,
      river_or_coast TEXT NOT NULL,
      strategic_tags_json TEXT NOT NULL,
      supervising_bureau_ids_json TEXT NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      pressure INTEGER NOT NULL,
      stability INTEGER NOT NULL,
      local_order INTEGER NOT NULL,
      tax_burden INTEGER NOT NULL,
      grain_stress INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_cities_session_visibility
      ON geo_cities(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS geo_routes (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      from_city_row_id TEXT NOT NULL,
      to_city_row_id TEXT NOT NULL,
      via_city_ids_json TEXT NOT NULL,
      distance_label TEXT NOT NULL,
      seasonal_risk TEXT NOT NULL,
      strategic_tags_json TEXT NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      risk INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_routes_session_visibility
      ON geo_routes(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS geo_frontier_zones (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      country_row_id TEXT NOT NULL,
      neighbor_country_row_id TEXT NOT NULL,
      city_ids_json TEXT NOT NULL,
      route_ids_json TEXT NOT NULL,
      pressure_metric TEXT NOT NULL,
      status TEXT NOT NULL,
      status_label TEXT NOT NULL,
      pressure INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_frontier_zones_session_visibility
      ON geo_frontier_zones(session_id, visibility, row_id);

    CREATE TABLE IF NOT EXISTS geo_office_jurisdictions (
      session_id TEXT NOT NULL,
      row_id TEXT NOT NULL,
      seed_id TEXT NOT NULL,
      seed_row_id TEXT,
      domain_schema_version INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      row_revision INTEGER NOT NULL,
      source TEXT NOT NULL,
      visibility TEXT NOT NULL,
      intel_confidence INTEGER,
      last_updated_turn INTEGER NOT NULL,
      last_updated_year INTEGER NOT NULL,
      last_updated_month INTEGER NOT NULL,
      last_updated_ten_day_period INTEGER NOT NULL,
      public_summary TEXT NOT NULL,
      hidden_notes_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      bureau_id TEXT NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      country_ids_json TEXT NOT NULL,
      city_ids_json TEXT NOT NULL,
      route_ids_json TEXT NOT NULL,
      frontier_zone_ids_json TEXT NOT NULL,
      office_track TEXT NOT NULL,
      priority INTEGER NOT NULL,
      PRIMARY KEY (session_id, row_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_geo_office_jurisdictions_session_visibility
      ON geo_office_jurisdictions(session_id, visibility, row_id);
  `);
}

function deleteGeographyRows(database, sessionId) {
  for (const tableName of GEOGRAPHY_TABLES) {
    database.prepare(`DELETE FROM ${tableName} WHERE session_id = ?`).run(sessionId);
  }
}

function buildCommonValues(record, geography, seedRowIds, collectionName, row) {
  const metadata = record.metadata || {};
  const isSeedRow = seedRowIds[collectionName]?.has(row.id);
  return [
    record.sessionId,
    row.id,
    geography.seedId || seedRowIds.seedId,
    isSeedRow ? row.id : null,
    GEOGRAPHY_DOMAIN_SCHEMA_VERSION,
    record.revision,
    record.revision,
    isSeedRow ? "seed" : "custom",
    row.visibility || "public",
    toNullableInteger(row.intelConfidence),
    Number.isFinite(Number(row.lastUpdatedTurn)) ? Math.round(Number(row.lastUpdatedTurn)) : metadata.turnCount,
    metadata.year,
    metadata.month,
    metadata.tenDayPeriod,
    row.publicSummary || "",
    stringifyJson(row.hiddenNotes, []),
    stringifyJson({}, {}),
    record.createdAt,
    record.updatedAt
  ];
}

function insertCountries(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_countries (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      kind, name, short_name, polity_type, ruler_title, capital_city_row_id, culture_tags_json,
      government_tags_json, status, status_label, pressure, stability
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.countries) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "countries", row),
      row.kind,
      row.name,
      row.shortName,
      row.polityType,
      row.rulerTitle,
      row.capitalCityId || null,
      stringifyJson(row.cultureTags, []),
      stringifyJson(row.governmentTags, []),
      row.status,
      row.statusLabel,
      row.pressure,
      row.stability
    );
  }
}

function insertRegions(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_regions (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      country_row_id, name, level, seat_city_row_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.regions) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "regions", row),
      row.countryId,
      row.name,
      row.level,
      row.seatCityId || null
    );
  }
}

function insertCities(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_cities (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      country_row_id, region_row_id, name, jurisdiction_level, terrain, river_or_coast, strategic_tags_json,
      supervising_bureau_ids_json, status, status_label, pressure, stability, local_order, tax_burden, grain_stress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.cities) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "cities", row),
      row.countryId,
      row.regionId,
      row.name,
      row.jurisdictionLevel,
      row.terrain,
      row.riverOrCoast,
      stringifyJson(row.strategicTags, []),
      stringifyJson(row.supervisingBureauIds, []),
      row.status,
      row.statusLabel,
      row.pressure,
      row.stability,
      row.localOrder,
      row.taxBurden,
      row.grainStress
    );
  }
}

function insertRoutes(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_routes (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      type, name, from_city_row_id, to_city_row_id, via_city_ids_json, distance_label, seasonal_risk,
      strategic_tags_json, status, status_label, risk
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.routes) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "routes", row),
      row.type,
      row.name,
      row.fromCityId,
      row.toCityId,
      stringifyJson(row.viaCityIds, []),
      row.distanceLabel,
      row.seasonalRisk,
      stringifyJson(row.strategicTags, []),
      row.status,
      row.statusLabel,
      row.risk
    );
  }
}

function insertFrontierZones(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_frontier_zones (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      name, country_row_id, neighbor_country_row_id, city_ids_json, route_ids_json, pressure_metric,
      status, status_label, pressure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.frontierZones) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "frontierZones", row),
      row.name,
      row.countryId,
      row.neighborCountryId,
      stringifyJson(row.cityIds, []),
      stringifyJson(row.routeIds, []),
      row.pressureMetric,
      row.status,
      row.statusLabel,
      row.pressure
    );
  }
}

function insertOfficeJurisdictions(database, record, geography, seedRowIds) {
  const statement = database.prepare(`
    INSERT INTO geo_office_jurisdictions (
      session_id, row_id, seed_id, seed_row_id, domain_schema_version, revision, row_revision,
      source, visibility, intel_confidence, last_updated_turn, last_updated_year, last_updated_month,
      last_updated_ten_day_period, public_summary, hidden_notes_json, metadata_json, created_at, updated_at,
      bureau_id, name, scope, country_ids_json, city_ids_json, route_ids_json, frontier_zone_ids_json,
      office_track, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of geography.officeJurisdictions) {
    statement.run(
      ...buildCommonValues(record, geography, seedRowIds, "officeJurisdictions", row),
      row.bureauId,
      row.name,
      row.scope,
      stringifyJson(row.countryIds, []),
      stringifyJson(row.cityIds, []),
      stringifyJson(row.routeIds, []),
      stringifyJson(row.frontierZoneIds, []),
      row.officeTrack,
      row.priority
    );
  }
}

function syncGeographyTables(database, record) {
  const seedRowIds = buildSeedRowIdSets();
  const geography = normalizeRecordWorldGeography(record);

  deleteGeographyRows(database, record.sessionId);
  insertCountries(database, record, geography, seedRowIds);
  insertRegions(database, record, geography, seedRowIds);
  insertCities(database, record, geography, seedRowIds);
  insertRoutes(database, record, geography, seedRowIds);
  insertFrontierZones(database, record, geography, seedRowIds);
  insertOfficeJurisdictions(database, record, geography, seedRowIds);
}

function getGeographyTableCounts(database, sessionId) {
  return {
    countries: database.prepare("SELECT COUNT(*) AS count FROM geo_countries WHERE session_id = ?").get(sessionId).count,
    regions: database.prepare("SELECT COUNT(*) AS count FROM geo_regions WHERE session_id = ?").get(sessionId).count,
    cities: database.prepare("SELECT COUNT(*) AS count FROM geo_cities WHERE session_id = ?").get(sessionId).count,
    routes: database.prepare("SELECT COUNT(*) AS count FROM geo_routes WHERE session_id = ?").get(sessionId).count,
    frontierZones: database.prepare("SELECT COUNT(*) AS count FROM geo_frontier_zones WHERE session_id = ?").get(sessionId).count,
    officeJurisdictions: database.prepare("SELECT COUNT(*) AS count FROM geo_office_jurisdictions WHERE session_id = ?").get(sessionId).count
  };
}

function hasStaleGeographyRows(database, sessionId, revision) {
  for (const tableName of GEOGRAPHY_TABLES) {
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ? AND revision <> ?`)
      .get(sessionId, revision);
    if (row.count > 0) return true;
  }
  return false;
}

function hasMismatchedGeographyRowIds(database, sessionId, expected) {
  for (const [tableName, collectionName] of GEOGRAPHY_TABLE_COLLECTIONS) {
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

function ensureGeographyTablesForRecord(database, record) {
  const before = JSON.stringify(record.worldState?.worldGeography || null);
  const expected = normalizeWorldGeographyState(record.worldState);
  record.worldState.worldGeography = expected;
  const worldStateChanged = JSON.stringify(expected) !== before;
  const counts = getGeographyTableCounts(database, record.sessionId);
  const missingOrMismatched = (
    counts.countries !== expected.countries.length ||
    counts.regions !== expected.regions.length ||
    counts.cities !== expected.cities.length ||
    counts.routes !== expected.routes.length ||
    counts.frontierZones !== expected.frontierZones.length ||
    counts.officeJurisdictions !== expected.officeJurisdictions.length
  );
  const mismatchedRowIds = !missingOrMismatched &&
    hasMismatchedGeographyRowIds(database, record.sessionId, expected);

  if (
    missingOrMismatched ||
    mismatchedRowIds ||
    hasStaleGeographyRows(database, record.sessionId, record.revision)
  ) {
    syncGeographyTables(database, record);
    return true;
  }
  return worldStateChanged;
}

function normalizeRecordWorldGeography(record) {
  const geography = normalizeWorldGeographyState(record.worldState);
  record.worldState.worldGeography = geography;
  return geography;
}

module.exports = {
  GEOGRAPHY_DOMAIN_SCHEMA_VERSION,
  deleteGeographyRows,
  ensureGeographyTablesForRecord,
  getGeographyTableCounts,
  initializeGeographyTables,
  normalizeRecordWorldGeography,
  syncGeographyTables
};
