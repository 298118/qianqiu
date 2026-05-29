#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const fs = require("node:fs");
const path = require("node:path");

const { runAiScenarioEvaluation } = require("../src/ai/eval/aiScenarioRunner");
const { assertPublicAiProviderEnvelope } = require("../src/ai/providerSafety");

const DEFAULT_AI_EVAL_V2_FIXTURE_DIR = path.join("testdata", "aiScenarios");
const DEFAULT_AI_EVAL_V2_ARTIFACT_PATH = path.join("artifacts", "ai-eval-v2", "latest.json");

function readArg(argv, name) {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }
  return "";
}

function buildPrintableScenarioEvalResult(result) {
  const printable = {
    ok: Boolean(result.ok),
    schemaVersion: result.schemaVersion,
    fixtureSchemaVersion: result.fixtureSchemaVersion,
    metricTotals: result.metricTotals,
    scenarioCount: result.scenarios.length,
    failures: result.failures
  };
  assertPublicAiProviderEnvelope(printable);
  return printable;
}

function writeAiEvalV2Artifact(filePath, result) {
  const printable = buildPrintableScenarioEvalResult(result);
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(printable, null, 2)}\n`, "utf8");
  return resolved;
}

async function main(argv = process.argv) {
  const fixtureDir = readArg(argv, "--fixtures") || DEFAULT_AI_EVAL_V2_FIXTURE_DIR;
  const artifactPath = readArg(argv, "--out") || DEFAULT_AI_EVAL_V2_ARTIFACT_PATH;
  const result = await runAiScenarioEvaluation({ fixtureDir });
  const printable = buildPrintableScenarioEvalResult(result);

  if (!argv.includes("--no-artifact")) {
    writeAiEvalV2Artifact(artifactPath, result);
  }

  console.log(JSON.stringify(printable, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_AI_EVAL_V2_ARTIFACT_PATH,
  DEFAULT_AI_EVAL_V2_FIXTURE_DIR,
  buildPrintableScenarioEvalResult,
  main,
  writeAiEvalV2Artifact
};
