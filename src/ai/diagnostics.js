const mockProvider = require("./providers/mock");
const { createAnthropicProvider } = require("./providers/anthropic");
const { createDeepSeekProvider, readTaskModel } = require("./providers/deepseek");
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
  "ANTHROPIC_API_KEY"
];

function normalizeProviderName(value = process.env.AI_PROVIDER || "mock") {
  const name = String(value || "mock").trim().toLowerCase();
  if (!name) return "mock";
  return name === "claude" ? "claude" : name;
}

function redactSecrets(text) {
  let message = String(text || "");
  for (const envName of SECRET_ENV_NAMES) {
    const secret = process.env[envName];
    if (secret) {
      message = message.split(secret).join("[redacted]");
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

  if (config.keyEnv && !process.env[config.keyEnv]) {
    return {
      ok: false,
      provider: requestedProvider,
      configuredProvider,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      models: config.models(),
      error: `${requestedProvider} requires ${config.keyEnv}.`
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
