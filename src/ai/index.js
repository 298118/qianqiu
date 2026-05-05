const mockProvider = require("./providers/mock");

function getProvider() {
  const providerName = process.env.AI_PROVIDER || "mock";

  if (providerName !== "mock") {
    console.warn(`AI_PROVIDER=${providerName} is not implemented yet; falling back to mock.`);
  }

  return mockProvider;
}

module.exports = {
  getProvider
};
