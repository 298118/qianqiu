function getEnv() {
  return {
    port: Number(process.env.PORT) || 3000,
    aiProvider: process.env.AI_PROVIDER || "mock",
    aiProviderTimeoutMs: Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 30000,
    storageAdapter: process.env.STORAGE_ADAPTER || "json",
    sqliteDatabasePath:
      process.env.SQLITE_DATABASE_PATH || process.env.SQLITE_DB_PATH || "data/qianqiu.sqlite"
  };
}

module.exports = {
  getEnv
};
