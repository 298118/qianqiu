function getEnv() {
  return {
    port: Number(process.env.PORT) || 3000,
    aiProvider: process.env.AI_PROVIDER || "mock"
  };
}

module.exports = {
  getEnv
};
