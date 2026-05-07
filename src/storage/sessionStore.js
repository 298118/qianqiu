const {
  createJsonSessionAdapter,
  CURRENT_STORAGE_SCHEMA_VERSION,
  SESSIONS_DIR
} = require("./jsonSessionAdapter");

const defaultAdapter = createJsonSessionAdapter();

function getSessionStorageAdapter() {
  return defaultAdapter;
}

module.exports = {
  ...defaultAdapter,
  CURRENT_STORAGE_SCHEMA_VERSION,
  SESSIONS_DIR,
  createJsonSessionAdapter,
  getSessionStorageAdapter
};
