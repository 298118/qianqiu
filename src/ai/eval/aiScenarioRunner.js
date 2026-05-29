// @ts-check

const fs = require("node:fs");
const path = require("node:path");

const mockProvider = require("../providers/mock");
const { validatePayload } = require("../schemas");
const { redactAiProviderText, assertPublicAiProviderEnvelope } = require("../providerSafety");
const { createRuntimeTaskEnvelope } = require("../providers/adapterContract");
const { createAiTaskRuntime } = require("../runtime/aiTaskRuntime");
const { runGameToolLoop } = require("../tools/gameToolLoop");
const { createInitialState } = require("../../game/initialState");
const { buildPlayerAiActorProfile } = require("../../game/aiActorProfiles");
const {
  buildScenarioMetrics,
  summarizeScenarioMetrics
} = require("./aiMetrics");

const AI_SCENARIO_RUNNER_SCHEMA_VERSION = "s92.5-ai-scenario-runner.v1";
const AI_SCENARIO_FIXTURE_SCHEMA_VERSION = "s92.5-ai-scenario-fixtures.v1";

const SUPPORTED_SCENARIO_KINDS = Object.freeze([
  "runtime_task",
  "mock_provider_task",
  "tool_loop",
  "static_payload"
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function compactText(value, fallback = "", maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim() || fallback;
  return text.slice(0, maxLength);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function buildWorldState(scenario = {}) {
  const context = isPlainObject(scenario.context) ? scenario.context : {};
  const initialState = isPlainObject(context.initialState)
    ? context.initialState
    : isPlainObject(scenario.initialState)
      ? scenario.initialState
      : {};
  const role = compactText(initialState.role || scenario.actorRole || "scholar", "scholar", 32);
  const playerName = compactText(initialState.playerName || scenario.playerName || "评测案主", "评测案主", 32);
  const worldState = createInitialState({
    ...initialState,
    role,
    playerName
  });
  if (isPlainObject(context.worldStatePatch)) {
    Object.assign(worldState, cloneJson(context.worldStatePatch));
  }
  return worldState;
}

function buildScenarioId(scenario, index) {
  return compactText(scenario.id || scenario.name || `scenario-${index + 1}`, `scenario-${index + 1}`, 96);
}

function readScenarioKind(scenario) {
  const kind = compactText(scenario.kind, "", 64);
  if (!SUPPORTED_SCENARIO_KINDS.includes(kind)) {
    throw new Error(`Unsupported AI scenario kind: ${kind || "(blank)"}.`);
  }
  return kind;
}

function normalizeScenarioList(input, sourcePath = "") {
  if (Array.isArray(input)) return input;
  if (isPlainObject(input) && Array.isArray(input.scenarios)) return input.scenarios;
  throw new Error(`AI scenario fixture ${sourcePath || "(inline)"} must contain a scenarios array.`);
}

function loadScenarioFixturesFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeScenarioList(parsed, filePath).map((scenario) => ({
    ...scenario,
    sourceFile: path.basename(filePath)
  }));
}

function loadScenarioFixturesFromDirectory(directoryPath) {
  const resolved = path.resolve(process.cwd(), directoryPath);
  const files = fs.existsSync(resolved)
    ? fs.readdirSync(resolved)
      .filter((fileName) => fileName.endsWith(".json"))
      .sort()
    : [];
  return files.flatMap((fileName) => loadScenarioFixturesFromFile(path.join(resolved, fileName)));
}

function validateScenarioPayload(schemaName, payload) {
  if (!schemaName) return true;
  validatePayload(schemaName, payload);
  return true;
}

async function runRuntimeTaskScenario(scenario) {
  const taskKind = compactText(scenario.taskKind, "", 64);
  const context = isPlainObject(scenario.context) ? scenario.context : {};
  const runtime = createAiTaskRuntime();
  const envelope = createRuntimeTaskEnvelope(taskKind, context, {
    taskId: compactText(scenario.id || scenario.name || taskKind, `${taskKind}:scenario`, 96)
  });
  const result = await runtime.run(taskKind, context, { envelope });
  return {
    payload: result.payload,
    publicTrace: result.trace,
    schemaValid: true,
    fallbackReason: result.fallbackReason || result.trace?.fallbackReason || ""
  };
}

async function runMockProviderScenario(scenario) {
  const taskKind = compactText(scenario.taskKind || scenario.mockTask, "", 64);
  const context = isPlainObject(scenario.context) ? scenario.context : {};
  let payload;
  let schemaName = scenario.schemaName;

  if (taskKind === "opening") {
    payload = await mockProvider.startGame(context.worldState || context);
    schemaName = schemaName || "opening";
  } else if (taskKind === "turn") {
    payload = await mockProvider.runTurn(buildWorldState(scenario), compactText(context.playerInput || scenario.playerInput || "温习经义。", "温习经义。", 240));
    schemaName = schemaName || "turn";
  } else if (taskKind === "quick_action") {
    payload = await mockProvider.suggestQuickActions(context.quickActionContext || context);
    schemaName = schemaName || "quickAction";
  } else if (taskKind === "topic_draft") {
    payload = await mockProvider.draftTopicSurface(context.topicDraftContext || context);
    schemaName = schemaName || "topicDraft";
  } else if (taskKind === "npc_dialogue") {
    payload = await mockProvider.runNpcDialogue(context.npcDialogueContext || context);
    schemaName = schemaName || "npcDialogue";
  } else {
    throw new Error(`Unsupported mock provider scenario task: ${taskKind}.`);
  }

  validateScenarioPayload(schemaName, payload);
  return {
    payload,
    publicTrace: {
      status: "ok",
      taskKind,
      provider: "mock",
      toolCounts: { allowed: 0, attempted: 0, used: 0, rejected: 0 }
    },
    schemaValid: true,
    fallbackReason: "",
    allowedProviderInternalKeys: taskKind === "turn" ? ["statePatch"] : []
  };
}

async function runToolLoopScenario(scenario) {
  const worldState = buildWorldState(scenario);
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const result = await runGameToolLoop({
    worldState,
    actorProfile,
    budget: isPlainObject(scenario.budget) ? scenario.budget : {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: false
    },
    modelSteps: Array.isArray(scenario.modelSteps) ? scenario.modelSteps : []
  }, {
    maxSteps: Number.isFinite(Number(scenario.maxSteps)) ? Number(scenario.maxSteps) : undefined
  });

  return {
    payload: {
      status: result.status,
      finalPayload: result.finalPayload,
      toolResults: result.toolResults,
      toolExecutionOrder: result.toolExecutionOrder
    },
    publicTrace: result.publicTrace,
    schemaValid: true,
    fallbackReason: ""
  };
}

async function runStaticPayloadScenario(scenario) {
  const payload = cloneJson(scenario.payload || {});
  validateScenarioPayload(scenario.schemaName, payload);
  return {
    payload,
    publicTrace: {
      status: "static",
      taskKind: compactText(scenario.taskKind || "static_payload", "static_payload", 64),
      toolCounts: { allowed: 0, attempted: 0, used: 0, rejected: 0 }
    },
    schemaValid: true,
    fallbackReason: ""
  };
}

function expectedBoolean(scenario, key, fallback) {
  const expected = isPlainObject(scenario.expect) ? scenario.expect : {};
  if (typeof expected[key] === "boolean") return expected[key];
  return fallback;
}

function evaluateMetricExpectations(scenario, metrics) {
  const issues = [];
  const expectedSchemaValid = expectedBoolean(scenario, "schema_valid", true);
  const expectedHiddenLeak = expectedBoolean(scenario, "hidden_leak", false);
  const expectedServerBypass = expectedBoolean(scenario, "server_bypass", false);
  const expectedHistoricalAnchor = expectedBoolean(scenario, "historical_anchor", true);
  const expectedToolBudgetOk = expectedBoolean(scenario, "tool_budget_ok", true);
  const expectedPendingNotFact = expectedBoolean(scenario, "pending_not_fact", true);
  const expectedFallbackReason = isPlainObject(scenario.expect) ? scenario.expect.fallback_reason : undefined;

  if (metrics.schema_valid !== expectedSchemaValid) issues.push("schema_valid expectation mismatch");
  if (metrics.hidden_leak !== expectedHiddenLeak) issues.push("hidden_leak expectation mismatch");
  if (metrics.server_bypass !== expectedServerBypass) issues.push("server_bypass expectation mismatch");
  if (metrics.historical_anchor !== expectedHistoricalAnchor) issues.push("historical_anchor expectation mismatch");
  if (metrics.tool_budget_ok !== expectedToolBudgetOk) issues.push("tool_budget_ok expectation mismatch");
  if (metrics.pending_not_fact !== expectedPendingNotFact) issues.push("pending_not_fact expectation mismatch");

  if (expectedFallbackReason === false && metrics.fallback_reason) {
    issues.push("fallback_reason should be empty");
  } else if (expectedFallbackReason === true && !metrics.fallback_reason) {
    issues.push("fallback_reason should be present");
  } else if (typeof expectedFallbackReason === "string" && metrics.fallback_reason !== expectedFallbackReason) {
    issues.push("fallback_reason expectation mismatch");
  }

  return issues;
}

async function executeScenario(scenario, index = 0) {
  const id = buildScenarioId(scenario, index);
  const kind = readScenarioKind(scenario);
  const startedAt = Date.now();
  const base = {
    id,
    name: compactText(scenario.name || id, id, 120),
    kind,
    sourceFile: compactText(scenario.sourceFile || "", "", 120),
    status: "passed",
    metrics: null,
    issues: []
  };

  try {
    const resultByKind = {
      runtime_task: runRuntimeTaskScenario,
      mock_provider_task: runMockProviderScenario,
      tool_loop: runToolLoopScenario,
      static_payload: runStaticPayloadScenario
    };
    const run = resultByKind[kind];
    const result = await run(scenario);
    const metrics = buildScenarioMetrics({
      payload: result.payload,
      publicTrace: result.publicTrace,
      schemaValid: result.schemaValid,
      startedAt,
      fallbackReason: result.fallbackReason,
      historicalAnchorFields: Array.isArray(scenario.historicalAnchorFields) ? scenario.historicalAnchorFields : [],
      skipHistoricalAnchor: Boolean(scenario.skipHistoricalAnchor),
      requiresPendingBoundary: Boolean(scenario.requiresPendingBoundary),
      allowedProviderInternalKeys: Array.isArray(result.allowedProviderInternalKeys)
        ? result.allowedProviderInternalKeys
        : []
    });
    const summarized = summarizeScenarioMetrics(metrics);
    const issues = evaluateMetricExpectations(scenario, summarized);
    return {
      ...base,
      status: issues.length ? "failed" : "passed",
      metrics: summarized,
      publicTrace: result.publicTrace ? {
        status: compactText(result.publicTrace.status, "", 64),
        toolCounts: result.publicTrace.toolCounts || {}
      } : undefined,
      issues
    };
  } catch (error) {
    const metrics = summarizeScenarioMetrics(buildScenarioMetrics({
      payload: {},
      publicTrace: {},
      schemaValid: false,
      startedAt,
      fallbackReason: redactAiProviderText(error, { maxLength: 120 })
    }));
    const issues = evaluateMetricExpectations(scenario, metrics);
    if (!issues.length) issues.push("scenario execution failed before producing a valid payload");
    return {
      ...base,
      status: "failed",
      metrics,
      issues
    };
  }
}

function summarizeMetricTotals(results) {
  const totals = {
    scenarioCount: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status !== "passed").length,
    schemaValid: results.filter((result) => result.metrics?.schema_valid).length,
    hiddenLeak: results.filter((result) => result.metrics?.hidden_leak).length,
    serverBypass: results.filter((result) => result.metrics?.server_bypass).length,
    historicalAnchor: results.filter((result) => result.metrics?.historical_anchor).length,
    toolBudgetOk: results.filter((result) => result.metrics?.tool_budget_ok).length,
    pendingNotFact: results.filter((result) => result.metrics?.pending_not_fact).length,
    fallbackReason: results.filter((result) => result.metrics?.fallback_reason).length,
    latencyMs: results.reduce((sum, result) => sum + (Number(result.metrics?.latency_ms) || 0), 0)
  };
  return totals;
}

async function runAiScenarioEvaluation(options = {}) {
  const scenarios = Array.isArray(options.scenarios)
    ? options.scenarios
    : loadScenarioFixturesFromDirectory(options.fixtureDir || path.join("testdata", "aiScenarios"));
  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    results.push(await executeScenario(scenarios[index], index));
  }

  const summary = {
    schemaVersion: AI_SCENARIO_RUNNER_SCHEMA_VERSION,
    fixtureSchemaVersion: AI_SCENARIO_FIXTURE_SCHEMA_VERSION,
    ok: results.every((result) => result.status === "passed"),
    generatedAt: new Date().toISOString(),
    metricTotals: summarizeMetricTotals(results),
    scenarios: results.map((result) => ({
      id: result.id,
      name: result.name,
      kind: result.kind,
      sourceFile: result.sourceFile,
      status: result.status,
      metrics: result.metrics,
      issues: result.issues
    })),
    failures: results
      .filter((result) => result.status !== "passed")
      .map((result) => ({
        id: result.id,
        kind: result.kind,
        issues: result.issues
      }))
  };
  assertPublicAiProviderEnvelope(summary);
  return summary;
}

module.exports = {
  AI_SCENARIO_FIXTURE_SCHEMA_VERSION,
  AI_SCENARIO_RUNNER_SCHEMA_VERSION,
  SUPPORTED_SCENARIO_KINDS,
  executeScenario,
  loadScenarioFixturesFromDirectory,
  loadScenarioFixturesFromFile,
  normalizeScenarioList,
  runAiScenarioEvaluation,
  summarizeMetricTotals
};
