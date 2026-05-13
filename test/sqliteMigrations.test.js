const test = require("node:test");
const assert = require("node:assert/strict");
const { isBuiltin } = require("node:module");

const {
  applyPendingMigrations,
  assertMigrationIntegrity,
  listAppliedMigrations,
  schemaMigrationsTableExists
} = require("../src/storage/sqliteMigrations");

const hasNodeSqlite = typeof isBuiltin === "function" && isBuiltin("node:sqlite");

function createMemoryDatabase(t) {
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  return database;
}

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)
  );
}

test("SQLite migration runner is dry-run safe, applies once, and reruns idempotently", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, (t) => {
  const database = createMemoryDatabase(t);
  const migrations = [{
    migrationId: "s71_2_create_sample",
    schemaVersion: 1,
    statements: [
      "CREATE TABLE sample_migration_rows (id INTEGER PRIMARY KEY, name TEXT NOT NULL) STRICT",
      "INSERT INTO sample_migration_rows (id, name) VALUES (1, 'first')"
    ]
  }];

  const dryRun = applyPendingMigrations(database, migrations, { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.pending.length, 1);
  assert.equal(schemaMigrationsTableExists(database), false);
  assert.equal(tableExists(database, "sample_migration_rows"), false);

  const applied = applyPendingMigrations(database, migrations, {
    appliedAt: "2026-05-13T00:00:00.000Z"
  });
  assert.equal(applied.applied.length, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sample_migration_rows").get().count, 1);

  const rerun = applyPendingMigrations(database, migrations);
  assert.equal(rerun.applied.length, 0);
  assert.equal(rerun.skipped.length, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sample_migration_rows").get().count, 1);

  assert.throws(
    () => applyPendingMigrations(database, [
      ...migrations,
      {
        migrationId: "s71_2_create_sample",
        schemaVersion: 2,
        statements: ["CREATE TABLE duplicate_guard (id INTEGER PRIMARY KEY) STRICT"]
      }
    ]),
    /defined more than once/
  );

  const integrity = assertMigrationIntegrity(database, migrations);
  assert.deepEqual(integrity, {
    appliedCount: 1,
    highestSchemaVersion: 1,
    ok: true
  });
});

test("SQLite migration checksum mismatch blocks rerun", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, (t) => {
  const database = createMemoryDatabase(t);
  applyPendingMigrations(database, [{
    migrationId: "s71_2_checksum_guard",
    schemaVersion: 1,
    statements: ["CREATE TABLE checksum_guard (id INTEGER PRIMARY KEY) STRICT"]
  }]);

  assert.throws(
    () => applyPendingMigrations(database, [{
      migrationId: "s71_2_checksum_guard",
      schemaVersion: 1,
      statements: [
        "CREATE TABLE checksum_guard (id INTEGER PRIMARY KEY, value TEXT) STRICT"
      ]
    }]),
    /checksum mismatch/
  );
});

test("SQLite migration failure rolls back and does not mark applied", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, (t) => {
  const database = createMemoryDatabase(t);

  assert.throws(
    () => applyPendingMigrations(database, [{
      migrationId: "s71_2_rollback_guard",
      schemaVersion: 1,
      statements: [
        "CREATE TABLE rollback_guard (id INTEGER PRIMARY KEY) STRICT",
        "INSERT INTO rollback_guard (id) VALUES (1)",
        "INSERT INTO missing_rollback_table (id) VALUES (2)"
      ]
    }]),
    /missing_rollback_table/
  );

  assert.equal(tableExists(database, "rollback_guard"), false);
  assert.deepEqual(listAppliedMigrations(database), []);
});

test("SQLite migrations are forward-only and require explicit destructive approval", {
  skip: hasNodeSqlite ? false : "node:sqlite is unavailable in this Node.js runtime"
}, (t) => {
  const database = createMemoryDatabase(t);
  database.exec("CREATE TABLE destructive_guard (id INTEGER PRIMARY KEY) STRICT");

  applyPendingMigrations(database, [{
    migrationId: "s71_2_version_two",
    schemaVersion: 2,
    statements: ["CREATE TABLE forward_only_marker (id INTEGER PRIMARY KEY) STRICT"]
  }]);

  assert.throws(
    () => applyPendingMigrations(database, [{
      migrationId: "s71_2_late_version_one",
      schemaVersion: 1,
      statements: ["CREATE TABLE late_version_one (id INTEGER PRIMARY KEY) STRICT"]
    }]),
    /forward-only/
  );
  assert.equal(tableExists(database, "late_version_one"), false);

  const destructive = [{
    migrationId: "s71_2_drop_destructive_guard",
    schemaVersion: 3,
    destructive: true,
    statements: ["DROP TABLE destructive_guard"]
  }];
  assert.throws(
    () => applyPendingMigrations(database, destructive),
    /backup/
  );
  assert.equal(tableExists(database, "destructive_guard"), true);

  const applied = applyPendingMigrations(database, destructive, { allowDestructive: true });
  assert.equal(applied.applied.length, 1);
  assert.equal(tableExists(database, "destructive_guard"), false);
});
