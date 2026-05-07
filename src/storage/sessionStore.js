const {
  createJsonSessionAdapter,
  CURRENT_STORAGE_SCHEMA_VERSION,
  SESSIONS_DIR
} = require("./jsonSessionAdapter");

function normalizeStorageAdapterName(value) {
  return String(value || "json")
    .trim()
    .toLowerCase();
}

function createSessionStorageAdapter(options = {}) {
  const adapterName = normalizeStorageAdapterName(options.adapter || process.env.STORAGE_ADAPTER);

  if (adapterName === "json") {
    return createJsonSessionAdapter();
  }

  if (adapterName === "sqlite") {
    const { createSqliteSessionAdapter } = require("./sqliteSessionAdapter");
    return createSqliteSessionAdapter({
      databasePath:
        options.databasePath ||
        process.env.SQLITE_DATABASE_PATH ||
        process.env.SQLITE_DB_PATH
    });
  }

  throw new Error(`Unsupported STORAGE_ADAPTER: ${adapterName}`);
}

const defaultAdapter = createSessionStorageAdapter();

function getSessionStorageAdapter() {
  return defaultAdapter;
}

module.exports = {
  ...defaultAdapter,
  CURRENT_STORAGE_SCHEMA_VERSION,
  SESSIONS_DIR,
  createSessionStorageAdapter,
  createJsonSessionAdapter,
  getSessionStorageAdapter
};
