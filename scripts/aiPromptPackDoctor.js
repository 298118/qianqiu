#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const {
  buildPromptRegistryDoctorResult
} = require("../src/ai/prompts/registry");
const { assertPublicAiProviderEnvelope } = require("../src/ai/providerSafety");

function main() {
  const result = buildPromptRegistryDoctorResult();
  assertPublicAiProviderEnvelope(result);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`AI prompt pack doctor failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main
};
