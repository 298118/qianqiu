const mockProvider = require("./providers/mock");
const { createAnthropicProvider } = require("./providers/anthropic");
const { createDeepSeekProvider, readTaskModel } = require("./providers/deepseek");
const { createMimoProvider, readMimoModel } = require("./providers/mimo");
const { createMimoDeepSeekProvider } = require("./providers/mimoDeepseek");
const { createOpenAiProvider } = require("./providers/openai");
const { createInitialState } = require("../game/initialState");

const PROVIDER_DIAGNOSTICS = {
  mock: {
    keyEnv: null,
    create: () => mockProvider,
    models: () => ({ default: "mock" })
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    create: createOpenAiProvider,
    models: () => ({ default: process.env.OPENAI_MODEL || "gpt-5.4-mini" })
  },
  deepseek: {
    keyEnv: "DEEPSEEK_API_KEY",
    create: createDeepSeekProvider,
    models: () => ({
      default: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      opening: readTaskModel("opening"),
      turn: readTaskModel("turn"),
      examQuestion: readTaskModel("examQuestion"),
      grade: readTaskModel("grade")
    })
  },
  mimo: {
    keyEnv: "MIMO_API_KEY",
    create: createMimoProvider,
    models: () => ({ default: readMimoModel() })
  },
  "mimo-deepseek": {
    keyEnvs: ["MIMO_API_KEY", "DEEPSEEK_API_KEY"],
    create: createMimoDeepSeekProvider,
    models: () => ({
      default: "mimo-deepseek",
      mimo: readMimoModel(),
      deepseekGrade: readTaskModel("grade")
    })
  },
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    create: createAnthropicProvider,
    models: () => ({ default: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5" })
  },
  claude: {
    keyEnv: "ANTHROPIC_API_KEY",
    create: createAnthropicProvider,
    models: () => ({ default: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5" })
  }
};

const SECRET_ENV_NAMES = [
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "MIMO_API_KEY",
  "ANTHROPIC_API_KEY"
];

const PROVIDER_ALIASES = {
  hybrid: "mimo-deepseek",
  "mimo_deepseek": "mimo-deepseek",
  "mimo+deepseek": "mimo-deepseek",
  xiaomi: "mimo"
};

function normalizeProviderName(value = process.env.AI_PROVIDER || "mock") {
  const name = String(value || "mock").trim().toLowerCase();
  if (!name) return "mock";
  if (PROVIDER_ALIASES[name]) return PROVIDER_ALIASES[name];
  return name === "claude" ? "claude" : name;
}

function getProviderKeyEnvs(config) {
  if (Array.isArray(config.keyEnvs)) return config.keyEnvs;
  return config.keyEnv ? [config.keyEnv] : [];
}

function redactSecrets(text) {
  let message = String(text || "");
  for (const envName of SECRET_ENV_NAMES) {
    const secret = process.env[envName];
    if (secret) {
      const variants = new Set([secret]);
      if (secret.length >= 8) {
        variants.add(secret.slice(0, 8));
        variants.add(secret.slice(0, 12));
        variants.add(secret.slice(-8));
        variants.add(secret.slice(-12));
      }
      for (const variant of [...variants].filter((value) => value && value.length >= 8)) {
        message = message.split(variant).join("[redacted]");
      }
    }
  }
  return message;
}

function truncate(value, maxLength = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function createDiagnosticWorldState(providerName) {
  return createInitialState({
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: "连接校验",
    background: "寒窗士子，用于不落盘的 AI 连接校验。",
    customSetting: `Provider diagnostic for ${providerName}; return concise historical JSON.`
  });
}

async function runAiConnectionTest(options = {}) {
  const requestedProvider = normalizeProviderName(options.provider);
  const configuredProvider = normalizeProviderName(process.env.AI_PROVIDER || "mock");
  const config = PROVIDER_DIAGNOSTICS[requestedProvider];
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  if (!config) {
    return {
      ok: false,
      provider: requestedProvider,
      configuredProvider,
      checkedAt,
      latencyMs: 0,
      error: `Unknown AI provider: ${requestedProvider}`
    };
  }

  const missingKeyEnvs = getProviderKeyEnvs(config).filter((envName) => !process.env[envName]);
  if (missingKeyEnvs.length) {
    return {
      ok: false,
      provider: requestedProvider,
      configuredProvider,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      models: config.models(),
      error: `${requestedProvider} requires ${missingKeyEnvs.join(" and ")}.`
    };
  }

  try {
    const provider = config.create();
    const worldState = createDiagnosticWorldState(requestedProvider);
    const opening = await provider.startGame(worldState);
    return {
      ok: true,
      provider: requestedProvider,
      configuredProvider,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      supportsStreaming: Boolean(provider.supportsStreaming),
      models: config.models(),
      openingEventCount: Array.isArray(opening.events) ? opening.events.length : 0,
      narrativePreview: truncate(opening.narrative)
    };
  } catch (error) {
    return {
      ok: false,
      provider: requestedProvider,
      configuredProvider,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      models: config.models(),
      error: redactSecrets(error.message || error)
    };
  }
}

module.exports = {
  PROVIDER_DIAGNOSTICS,
  normalizeProviderName,
  redactSecrets,
  runAiConnectionTest
};
