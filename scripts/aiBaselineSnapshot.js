#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const fs = require("node:fs");
const path = require("node:path");

const {
  PROMPT_PACKS,
  buildPromptCacheStablePrefix,
  listPromptPackNames
} = require("../src/ai/promptPacks");
const { SCHEMAS } = require("../src/ai/schemas");
const {
  SUPPORTED_PROVIDERS,
  buildDefaultModelRoutePolicy,
  summarizeModelRoutePolicy
} = require("../src/ai/modelRoutePolicy");
const { createBaseGameAiToolDefinitions } = require("../src/ai/gameAiTools");
const { toProviderToolName } = require("../src/ai/toolSchemas");

const BASELINE_SCHEMA_VERSION = "s92.1-ai-baseline.v1";
const DEFAULT_ARTIFACT_PATH = path.join("artifacts", "ai-baseline", "latest.json");

const SENSITIVE_BASELINE_PATTERNS = Object.freeze([
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/i,
  /\bsk-[A-Za-z0-9_-]{6,}\b/,
  /\btp-[A-Za-z0-9_-]{6,}\b/,
  /rawPrompt|raw[_ -]?prompt/i,
  /providerPayload|provider[_ -]?payload/i,
  /rawSql|raw[_ -]?sql/i,
  /rawAudit|raw[_ -]?audit/i,
  /rawTable|raw[_ -]?table/i,
  /hiddenNotes|hiddenIntent/i,
  /worldState|world_state_json/i,
  /ai_change_proposals|event_log/i,
  /server\./i,
  /baseURL|baseUrl/i,
  /file:\/\/\/?/i,
  /[A-Za-z]:[\\/][^\s"'<>]*/,
  /\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]*/,
  /data[\\/](?:sessions|audit)/i
]);

const PROVIDER_CAPABILITIES = Object.freeze({
  mock: {
    credentialRequired: false,
    structuredOutput: true,
    strictStructuredOutput: true,
    tools: "deterministic-local-only",
    streaming: false,
    notes: "CI 默认安全世界法官；不调用网络。"
  },
  openai: {
    credentialRequired: true,
    structuredOutput: true,
    strictStructuredOutput: false,
    tools: "schema-adapters-present",
    streaming: true,
    notes: "当前旧 facade 使用 Responses JSON schema；strict 与 tool loop 留给 v2 adapter。"
  },
  deepseek: {
    credentialRequired: true,
    structuredOutput: true,
    strictStructuredOutput: false,
    tools: "openai-compatible-probe",
    streaming: true,
    notes: "OpenAI-compatible chat completions；真实工具形状以 smoke 为准。"
  },
  mimo: {
    credentialRequired: true,
    structuredOutput: true,
    strictStructuredOutput: false,
    tools: "provider-smoke-covered",
    streaming: true,
    notes: "MiMo tool smoke 已覆盖强制工具与工具结果 roundtrip。"
  },
  "mimo-deepseek": {
    credentialRequired: true,
    structuredOutput: true,
    strictStructuredOutput: false,
    tools: "hybrid-route-policy",
    streaming: true,
    notes: "叙事偏 MiMo，critic/domain/safety 可按 key 路由到 DeepSeek。"
  },
  anthropic: {
    credentialRequired: true,
    structuredOutput: true,
    strictStructuredOutput: false,
    tools: "adapter-contract-pending",
    streaming: true,
    notes: "当前旧 facade 使用 Messages JSON schema；tool loop 待 v2 接入。"
  }
});

const PROVIDER_ENV_STATUS_READERS = Object.freeze({
  mock: () => ({
    credentialConfigured: false,
    endpointOverrideConfigured: false
  }),
  openai: (env) => ({
    credentialConfigured: Boolean(env.OPENAI_API_KEY),
    endpointOverrideConfigured: Boolean(env.OPENAI_BASE_URL)
  }),
  deepseek: (env) => ({
    credentialConfigured: Boolean(env.DEEPSEEK_API_KEY),
    endpointOverrideConfigured: Boolean(env.DEEPSEEK_BASE_URL)
  }),
  mimo: (env) => ({
    credentialConfigured: Boolean(env.MIMO_API_KEY),
    endpointOverrideConfigured: Boolean(env.MIMO_BASE_URL)
  }),
  "mimo-deepseek": (env) => ({
    credentialConfigured: Boolean(env.MIMO_API_KEY || env.DEEPSEEK_API_KEY),
    endpointOverrideConfigured: Boolean(env.MIMO_BASE_URL || env.DEEPSEEK_BASE_URL)
  }),
  anthropic: (env) => ({
    credentialConfigured: Boolean(env.ANTHROPIC_API_KEY),
    endpointOverrideConfigured: false
  })
});

function stableLineCount(packName) {
  return buildPromptCacheStablePrefix(packName)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .length;
}

function summarizePromptPacks() {
  const items = listPromptPackNames().sort().map((promptPackId) => {
    const pack = PROMPT_PACKS[promptPackId];
    return {
      promptPackId,
      schemaName: pack.schemaName,
      purposeLength: String(pack.purpose || "").length,
      toneLineCount: Array.isArray(pack.tone) ? pack.tone.length : 0,
      authorityLineCount: Array.isArray(pack.authority) ? pack.authority.length : 0,
      outputLineCount: Array.isArray(pack.output) ? pack.output.length : 0,
      stablePrefixLineCount: stableLineCount(promptPackId)
    };
  });

  const bySchema = items.reduce((counts, item) => {
    counts[item.schemaName] = (counts[item.schemaName] || 0) + 1;
    return counts;
  }, {});

  return {
    count: items.length,
    bySchema,
    items
  };
}

function summarizeSchema(name, schema) {
  const propertyNames = Object.keys(schema?.properties || {}).sort();
  return {
    schemaName: name,
    topLevelType: schema?.type || "unknown",
    required: Array.isArray(schema?.required) ? [...schema.required].sort() : [],
    propertyNames,
    additionalProperties: schema?.additionalProperties === false ? false : "non-strict-or-unspecified"
  };
}

function summarizeSchemas() {
  const items = Object.entries(SCHEMAS)
    .map(([name, schema]) => summarizeSchema(name, schema))
    .sort((a, b) => a.schemaName.localeCompare(b.schemaName));
  return {
    count: items.length,
    items
  };
}

function summarizeRoutes(env, options = {}) {
  const policy = buildDefaultModelRoutePolicy(env, options);
  const summary = summarizeModelRoutePolicy(policy);
  const safeguards = {
    serverOwnsState: Boolean(summary.safeguards?.serverOwnsState),
    criticAndSafetyReviewOnly: Boolean(summary.safeguards?.criticAndSafetyReviewOnly),
    noRawDatabaseTools: Boolean(summary.safeguards?.noRawSqlTools),
    noHiddenContextUpgrade: Boolean(summary.safeguards?.noHiddenContextUpgrade),
    consensusDoesNotBypassResolver: Boolean(summary.safeguards?.consensusDoesNotBypassResolver)
  };
  return {
    schemaVersion: summary.schemaVersion,
    defaultProvider: summary.defaultProvider,
    taskCount: summary.tasks.length,
    providers: [...new Set(summary.tasks.map((task) => task.provider))].sort(),
    reviewerOnlyTasks: summary.tasks
      .filter((task) => task.reviewerOnly)
      .map((task) => task.taskType)
      .sort(),
    toolEnabledTasks: summary.tasks
      .filter((task) => task.toolBudget > 0)
      .map((task) => ({
        taskType: task.taskType,
        toolBudget: task.toolBudget
      })),
    totalMaxOutputTokens: summary.tasks.reduce((sum, task) => sum + Number(task.maxOutputTokens || 0), 0),
    totalToolBudget: summary.tasks.reduce((sum, task) => sum + Number(task.toolBudget || 0), 0),
    safeguards,
    tasks: summary.tasks
  };
}

function summarizeProviders(env) {
  const items = SUPPORTED_PROVIDERS.map((provider) => {
    const readStatus = PROVIDER_ENV_STATUS_READERS[provider] || (() => ({
      credentialConfigured: false,
      endpointOverrideConfigured: false
    }));
    return {
      provider,
      ...readStatus(env),
      ...(PROVIDER_CAPABILITIES[provider] || {
        credentialRequired: true,
        structuredOutput: false,
        strictStructuredOutput: false,
        tools: "unknown",
        streaming: false,
        notes: "未登记 provider capability。"
      })
    };
  });

  return {
    count: items.length,
    items
  };
}

function summarizeToolDefinitions() {
  const tools = createBaseGameAiToolDefinitions();
  const items = tools.map((tool) => ({
    name: tool.name,
    providerToolName: toProviderToolName(tool.name),
    toolType: tool.permission?.toolType || "unknown",
    authorityTiers: [...(tool.permission?.authorityTiers || [])].sort(),
    actorTypes: [...(tool.permission?.actorTypes || [])].sort(),
    toolGroups: [...(tool.permission?.toolGroups || [])].sort(),
    readScope: [...(tool.permission?.readScope || [])].sort(),
    proposalScope: [...(tool.permission?.proposalScope || [])].sort(),
    requiresJurisdiction: Boolean(tool.permission?.requiresJurisdiction),
    requiresEvidence: Boolean(tool.permission?.requiresEvidence),
    resolverKind: tool.resolver?.kind || "unknown",
    serverOwnedResolver: tool.resolver?.serverOwned === true,
    appliesState: tool.resolver?.appliesState === true,
    writesStorage: tool.resolver?.writesStorage === true,
    cooldownScope: tool.cooldown?.scope || "none",
    cooldownTurns: Number(tool.cooldown?.turns || 0),
    mockFallbackMode: tool.mockFallback?.mode || "unknown",
    mockFixtureId: tool.mockFallback?.fixtureId || "",
    riskTags: [...(tool.riskTags || [])].sort(),
    providerCompatibility: {
      openAiChat: tool.providerCompatibility?.openAiChat || "unknown",
      anthropic: tool.providerCompatibility?.anthropic || "unknown",
      mcp: tool.providerCompatibility?.mcp || "unknown"
    }
  })).sort((a, b) => a.name.localeCompare(b.name));

  const byType = items.reduce((counts, tool) => {
    counts[tool.toolType] = (counts[tool.toolType] || 0) + 1;
    return counts;
  }, {});

  return {
    count: items.length,
    byType,
    items
  };
}

function buildAiBaselineSnapshot(options = {}) {
  const env = options.env || process.env;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const snapshot = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    generatedAt,
    runtimeBehaviorChanged: false,
    summary: {
      purpose: "AI 编排 v2 前的 hidden-safe baseline；只摘要 prompt/schema/route/tool/provider 能力，不改变运行时。",
      defaultPlayableMode: "mock",
      serverOwnsState: true,
      aiWritesCanonicalState: false
    },
    sourceFiles: [
      "src/ai/promptPacks.js",
      "src/ai/schemas.js",
      "src/ai/modelRoutePolicy.js",
      "src/ai/toolSchemas.js",
      "src/ai/gameAiTools.js",
      "src/ai/providers/*.js",
      "src/ai/aiEvaluationRunner.js"
    ],
    recommendedVerification: [
      "npm run ai:baseline",
      "node --test test/aiBaselineSnapshot.test.js",
      "npm run eval:ai",
      "npm run typecheck:server"
    ],
    promptPacks: summarizePromptPacks(),
    schemas: summarizeSchemas(),
    modelRoutes: summarizeRoutes(env, options.routeOptions || {}),
    providers: summarizeProviders(env),
    tools: summarizeToolDefinitions()
  };

  assertBaselineSnapshotSafe(snapshot);
  return snapshot;
}

function assertBaselineSnapshotSafe(snapshot) {
  const serialized = JSON.stringify(snapshot);
  const hits = SENSITIVE_BASELINE_PATTERNS
    .filter((pattern) => pattern.test(serialized))
    .map((pattern) => pattern.toString());
  if (hits.length) {
    throw new Error(`AI baseline snapshot contains sensitive or raw-only terms: ${hits.join(", ")}`);
  }
  return snapshot;
}

function readArg(argv, name) {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }
  return "";
}

function writeJsonArtifact(filePath, payload) {
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return resolved;
}

function runCli(argv = process.argv) {
  const outputPath = readArg(argv, "--out") || DEFAULT_ARTIFACT_PATH;
  const noStdout = argv.includes("--no-stdout");
  const snapshot = buildAiBaselineSnapshot();
  if (outputPath) {
    writeJsonArtifact(outputPath, snapshot);
  }
  if (!noStdout) {
    console.log(JSON.stringify(snapshot, null, 2));
  }
  return snapshot;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`AI baseline snapshot failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  BASELINE_SCHEMA_VERSION,
  DEFAULT_ARTIFACT_PATH,
  SENSITIVE_BASELINE_PATTERNS,
  assertBaselineSnapshotSafe,
  buildAiBaselineSnapshot,
  runCli,
  writeJsonArtifact
};
