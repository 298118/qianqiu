function getEnv() {
  return {
    port: Number(process.env.PORT) || 3000,
    aiProvider: process.env.AI_PROVIDER || "mock",
    aiProviderTimeoutMs: Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 30000
  };
}

module.exports = {
  getEnv
};
