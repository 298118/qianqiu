#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const { createAnthropicProvider } = require("../src/ai/providers/anthropic");
const { createDeepSeekProvider } = require("../src/ai/providers/deepseek");
const { createOpenAiProvider } = require("../src/ai/providers/openai");
const { checkEssayAuthenticity } = require("../src/game/essayChecks");
const { getExam, summarizeReadiness } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");

const PROVIDER_CONFIGS = {
  openai: {
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    create: createOpenAiProvider
  },
  deepseek: {
    label: "DeepSeek",
    keyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    create: createDeepSeekProvider
  },
  anthropic: {
    label: "Anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    create: createAnthropicProvider
  }
};

const PROVIDER_ALIASES = {
  claude: "anthropic"
};

const ALL_PROVIDER_NAMES = Object.keys(PROVIDER_CONFIGS);

function readArg(argv, name) {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);

  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }

  return "";
}

function canonicalProviderName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (!name || name === "mock") return "mock";
  if (name === "all") return "all";

  const canonical = PROVIDER_ALIASES[name] || name;
  if (!PROVIDER_CONFIGS[canonical]) {
    throw new Error(`Unknown smoke provider "${value}". Use one of: ${ALL_PROVIDER_NAMES.join(", ")}, claude.`);
  }

  return canonical;
}

function providerHasKey(providerName, env = process.env) {
  const config = PROVIDER_CONFIGS[providerName];
  return Boolean(config && env[config.keyEnv]);
}

function getRequestedProviderNames({ argv = process.argv, env = process.env } = {}) {
  const cliProvider = readArg(argv, "--provider");
  const smokeProvider = env.AI_SMOKE_PROVIDER;
  const configuredProvider = env.AI_PROVIDER;
  const rawProvider = cliProvider || smokeProvider || configuredProvider || "mock";
  const canonical = canonicalProviderName(rawProvider);

  if (canonical === "mock") {
    return { explicit: false, providerNames: ALL_PROVIDER_NAMES };
  }
  if (canonical === "all") {
    return { explicit: false, providerNames: ALL_PROVIDER_NAMES };
  }

  return {
    explicit: Boolean(cliProvider || smokeProvider || configuredProvider),
    providerNames: [canonical]
  };
}

function getProviderNamesToSmoke(options = {}) {
  const env = options.env || process.env;
  const { explicit, providerNames } = getRequestedProviderNames(options);
  const uniqueNames = [...new Set(providerNames)];

  if (!explicit) {
    return uniqueNames.filter((providerName) => providerHasKey(providerName, env));
  }

  const missing = uniqueNames.filter((providerName) => !providerHasKey(providerName, env));
  if (missing.length) {
    const details = missing
      .map((providerName) => `${PROVIDER_CONFIGS[providerName].label} requires ${PROVIDER_CONFIGS[providerName].keyEnv}`)
      .join("; ");
    throw new Error(`${details}. Set the key or run with AI_PROVIDER=mock.`);
  }

  return uniqueNames;
}

function truncate(text, limit = 96) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 3)}...`;
}

function buildSmokeEssay() {
  return [
    "Learning should begin with disciplined reading and end with service to the people.",
    "If a scholar only remembers phrases but cannot measure grain prices, taxes, and local hardship,",
    "then the learning remains on paper. If an official only chases immediate revenue and forgets",
    "the people's strength, then the treasury may be full for a season while trust is spent for years.",
    "The better path is to keep records carefully, reduce waste, reward honest village elders,",
    "and let schools teach both classical duty and practical judgment. In this way study becomes",
    "a root for governance, and governance returns to nourish study."
  ].join(" ");
}

function makeSmokeWorldState() {
  const worldState = createInitialState({
    dynasty: "Ming",
    year: 1644,
    role: "scholar",
    playerName: "Provider Smoke",
    background: "A minimal keyed smoke run.",
    customSetting: "The run checks model JSON contracts without writing session files."
  });
  worldState.player.academia = 32;
  worldState.player.literaryTalent = 30;
  worldState.player.adaptability = 28;
  worldState.player.mentality = 30;
  worldState.player.reputation = 18;
  return worldState;
}

function logStep(providerName, stepName, detail) {
  console.log(`[${providerName}] ${stepName} ok: ${detail}`);
}

async function smokeProvider(providerName) {
  const config = PROVIDER_CONFIGS[providerName];
  const provider = config.create();
  const worldState = makeSmokeWorldState();
  const exam = getExam("child_exam");

  console.log(`[${providerName}] starting real-provider smoke (${config.modelEnv}=${process.env[config.modelEnv] || "default"})`);

  const opening = await provider.startGame(worldState);
  logStep(providerName, "start", `events=${opening.events.length}, narrative="${truncate(opening.narrative)}"`);

  const turn = await provider.runTurn(worldState, "Study the classics and ask the mentor how to prepare for the next exam.");
  logStep(
    providerName,
    "turn",
    `patchKeys=${Object.keys(turn.statePatch || {}).join(",") || "none"}, examTrigger=${turn.examTrigger?.shouldStart === true}`
  );

  worldState.activeExam = {
    level: exam.level,
    examName: exam.name,
    questionType: exam.questionType,
    status: "writing",
    readiness: summarizeReadiness(worldState.player, exam)
  };

  const question = await provider.generateExamQuestion(worldState, exam);
  logStep(
    providerName,
    "question",
    `level=${question.level}, wordCount=${question.wordCount.min}-${question.wordCount.max}`
  );

  const essay = buildSmokeEssay();
  const authenticityCheck = checkEssayAuthenticity({ essay, exam, player: worldState.player });
  const grade = await provider.gradeExamEssay(worldState, exam, essay, authenticityCheck);
  logStep(providerName, "submit", `overall=${grade.score.overall_score}, rank="${truncate(grade.score.rank, 32)}"`);
}

async function runProviderSmoke(options = {}) {
  const providerNames = getProviderNamesToSmoke(options);

  if (!providerNames.length) {
    console.log("No real-provider keys found; skipping provider smoke. Set OPENAI_API_KEY, DEEPSEEK_API_KEY, or ANTHROPIC_API_KEY to run it.");
    return { skipped: true, providerNames: [] };
  }

  for (const providerName of providerNames) {
    await smokeProvider(providerName);
  }

  console.log(`Provider smoke completed for: ${providerNames.join(", ")}`);
  return { skipped: false, providerNames };
}

function printUsage() {
  console.log([
    "Usage: npm run smoke:provider -- [--provider openai|deepseek|anthropic|claude|all]",
    "",
    "Default behavior:",
    "- AI_PROVIDER=mock: run every provider that has its required key in the environment.",
    "- AI_PROVIDER=<real provider>: run that provider and fail if its key is missing.",
    "- --provider overrides AI_PROVIDER for this smoke run.",
    "",
    "This script calls real provider adapters directly, without Mock fallback or session writes."
  ].join("\n"));
}

if (require.main === module) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
  } else {
    runProviderSmoke().catch((error) => {
      console.error(`Provider smoke failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  buildSmokeEssay,
  canonicalProviderName,
  getProviderNamesToSmoke,
  providerHasKey,
  runProviderSmoke
};
