const { createHash } = require("node:crypto");

const SCHEMA_MIGRATIONS_TABLE = "schema_migrations";

let savepointCounter = 0;

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

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  );
}

function schemaMigrationsTableExists(database) {
  return tableExists(database, SCHEMA_MIGRATIONS_TABLE);
}

function initializeSchemaMigrationsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('applied', 'failed')),
      error_summary TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
      ON schema_migrations(schema_version, migration_id);
  `);
}

function listAppliedMigrations(database) {
  if (!schemaMigrationsTableExists(database)) return [];
  return database
    .prepare(`
      SELECT migration_id, schema_version, applied_at, checksum, status, error_summary
      FROM schema_migrations
      ORDER BY schema_version ASC, migration_id ASC
    `)
    .all()
    .map((row) => ({
      migrationId: row.migration_id,
      schemaVersion: row.schema_version,
      appliedAt: row.applied_at,
      checksum: row.checksum,
      status: row.status,
      errorSummary: row.error_summary || ""
    }));
}

function computeMigrationChecksum(migration) {
  if (migration.checksum) return String(migration.checksum);
  const payload = {
    migrationId: migration.migrationId,
    schemaVersion: migration.schemaVersion,
    destructive: Boolean(migration.destructive),
    statements: migration.statements || [],
    up: migration.up ? String(migration.up) : null
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function normalizeMigration(migration) {
  if (!migration || typeof migration !== "object") {
    throw new Error("SQLite migration must be an object");
  }
  const migrationId = migration.migrationId || migration.id || migration.migration_id;
  if (!migrationId || typeof migrationId !== "string") {
    throw new Error("SQLite migration requires migrationId");
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(migrationId)) {
    throw new Error(`SQLite migration ${migrationId} has an unsafe id`);
  }

  const schemaVersion = Number(migration.schemaVersion || migration.schema_version);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error(`SQLite migration ${migrationId} requires a positive schemaVersion`);
  }

  const statements = Array.isArray(migration.statements)
    ? migration.statements.filter((statement) => String(statement || "").trim())
    : [];
  if (!statements.length && typeof migration.up !== "function") {
    throw new Error(`SQLite migration ${migrationId} requires statements or an up function`);
  }

  const normalized = {
    migrationId,
    schemaVersion,
    checksum: computeMigrationChecksum({
      ...migration,
      migrationId,
      schemaVersion,
      statements
    }),
    destructive: Boolean(migration.destructive),
    statements,
    up: typeof migration.up === "function" ? migration.up : null
  };
  return normalized;
}

function summarizeMigration(migration) {
  return {
    migrationId: migration.migrationId,
    schemaVersion: migration.schemaVersion,
    checksum: migration.checksum,
    destructive: migration.destructive
  };
}

function resolveAppliedAt(options = {}) {
  if (typeof options.appliedAt === "string") return options.appliedAt;
  if (typeof options.clock === "function") return options.clock();
  return new Date().toISOString();
}

function runInMigrationTransaction(database, task) {
  if (database.isTransaction) {
    savepointCounter += 1;
    const savepointName = `qianqiu_migration_${savepointCounter}`;
    database.exec(`SAVEPOINT ${savepointName}`);
    try {
      const result = task();
      database.exec(`RELEASE ${savepointName}`);
      return result;
    } catch (error) {
      database.exec(`ROLLBACK TO ${savepointName}`);
      database.exec(`RELEASE ${savepointName}`);
      throw error;
    }
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const result = task();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  }
}

function executeMigration(database, migration) {
  for (const statement of migration.statements) {
    database.exec(statement);
  }
  if (migration.up) migration.up(database);
}

function insertAppliedMigration(database, migration, appliedAt) {
  database
    .prepare(`
      INSERT INTO schema_migrations (
        migration_id,
        schema_version,
        applied_at,
        checksum,
        status,
        error_summary
      ) VALUES (?, ?, ?, ?, 'applied', '')
    `)
    .run(
      migration.migrationId,
      migration.schemaVersion,
      appliedAt,
      migration.checksum
    );
}

function sortMigrations(migrations) {
  const normalized = migrations
    .map((migration) => normalizeMigration(migration))
    .sort((left, right) => {
      if (left.schemaVersion !== right.schemaVersion) {
        return left.schemaVersion - right.schemaVersion;
      }
      return left.migrationId.localeCompare(right.migrationId);
    });
  const seen = new Set();
  for (const migration of normalized) {
    if (seen.has(migration.migrationId)) {
      throw new Error(`SQLite migration ${migration.migrationId} is defined more than once`);
    }
    seen.add(migration.migrationId);
  }
  return normalized;
}

function applyPendingMigrations(database, migrations = [], options = {}) {
  const normalizedMigrations = sortMigrations(migrations);
  if (!options.dryRun) initializeSchemaMigrationsTable(database);

  const appliedRows = listAppliedMigrations(database);
  const appliedById = new Map(appliedRows.map((row) => [row.migrationId, row]));
  const skipped = [];
  const pending = [];

  for (const migration of normalizedMigrations) {
    const existing = appliedById.get(migration.migrationId);
    if (!existing) {
      pending.push(summarizeMigration(migration));
      continue;
    }
    if (existing.status !== "applied") {
      throw new Error(`SQLite migration ${migration.migrationId} is not applied cleanly`);
    }
    if (existing.checksum !== migration.checksum) {
      throw new Error(`SQLite migration ${migration.migrationId} checksum mismatch; inspect the migration manually`);
    }
    skipped.push(summarizeMigration(migration));
  }

  if (options.dryRun) {
    return {
      applied: [],
      dryRun: true,
      pending,
      skipped
    };
  }

  let highestAppliedVersion = appliedRows.reduce(
    (highest, row) => Math.max(highest, Number(row.schemaVersion) || 0),
    0
  );
  const applied = [];

  for (const migration of normalizedMigrations) {
    if (appliedById.has(migration.migrationId)) continue;
    if (migration.schemaVersion < highestAppliedVersion) {
      throw new Error(
        `SQLite migration ${migration.migrationId} is out of order; only forward-only migrations are supported`
      );
    }
    if (migration.destructive && !options.allowDestructive) {
      throw new Error(
        `SQLite migration ${migration.migrationId} is destructive; run a local backup and pass allowDestructive explicitly`
      );
    }

    runInMigrationTransaction(database, () => {
      executeMigration(database, migration);
      insertAppliedMigration(database, migration, resolveAppliedAt(options));
    });
    applied.push(summarizeMigration(migration));
    highestAppliedVersion = Math.max(highestAppliedVersion, migration.schemaVersion);
  }

  return {
    applied,
    dryRun: false,
    pending: [],
    skipped
  };
}

function assertMigrationIntegrity(database, migrations = []) {
  if (!schemaMigrationsTableExists(database)) {
    throw new Error("SQLite schema_migrations table is missing");
  }

  const appliedRows = listAppliedMigrations(database);
  for (const row of appliedRows) {
    if (row.status !== "applied") {
      throw new Error(`SQLite migration ${row.migrationId} has status ${row.status}`);
    }
  }

  const expectedById = new Map(
    sortMigrations(migrations).map((migration) => [migration.migrationId, migration])
  );
  const checksumMismatches = [];
  for (const row of appliedRows) {
    const expected = expectedById.get(row.migrationId);
    if (expected && expected.checksum !== row.checksum) {
      checksumMismatches.push(row.migrationId);
    }
  }
  if (checksumMismatches.length) {
    throw new Error(`SQLite migration checksum mismatch: ${checksumMismatches.join(", ")}`);
  }

  return {
    appliedCount: appliedRows.length,
    highestSchemaVersion: appliedRows.reduce(
      (highest, row) => Math.max(highest, Number(row.schemaVersion) || 0),
      0
    ),
    ok: true
  };
}

module.exports = {
  SCHEMA_MIGRATIONS_TABLE,
  applyPendingMigrations,
  assertMigrationIntegrity,
  computeMigrationChecksum,
  initializeSchemaMigrationsTable,
  listAppliedMigrations,
  schemaMigrationsTableExists
};
