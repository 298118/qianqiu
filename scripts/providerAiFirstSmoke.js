#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const { createMimoProvider, DEFAULT_MIMO_BASE_URL, DEFAULT_MIMO_MODEL } = require("../src/ai/providers/mimo");
const { readTimeoutMs } = require("../src/ai/providers/remoteHelpers");
const { createInitialState } = require("../src/game/initialState");
const { applyStatePatch } = require("../src/game/stateRules");
const { runWorldTick } = require("../src/game/worldTick");
const {
  applyTurnActorMemoryUpdates,
  buildActorMemoryView
} = require("../src/game/actorMemoryLedger");
const {
  buildPlayerMonthlyBriefingView,
  runPlayerMonthlyBriefingStep
} = require("../src/game/playerMonthlyBriefing");
const {
  buildTimeSkipPlan,
  buildTimeSkipSummary
} = require("../src/game/timeSkip");
const {
  buildSessionSummaryView,
  updateMonthlySessionSummary
} = require("../src/game/sessionSummary");
const { buildMapContextView } = require("../src/game/mapContext");
const { resolveMapMovementProposal } = require("../src/game/mapToolResolvers");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  buildDefaultModelRoutePolicy,
  resolveModelForTask
} = require("../src/ai/modelRoutePolicy");
const {
  resolveAiSettingsForSession,
  redactAiSettingsForClient,
  recordAiInvocation
} = require("../src/game/aiSettings");

const S70_PROTECTED_TOP_LEVEL_PATCH_KEYS = Object.freeze([
  "activeExam",
  "examCalendar",
  "examProcedure",
  "examHonorLedger",
  "appointmentTrack",
  "studyProfile",
  "activeNpcRequest",
  "longTermEvents",
  "officialCareer",
  "officialPostings",
  "roleWorldCoupling",
  "worldGeography",
  "worldEntities",
  "worldPeople",
  "worldThreads",
  "actorMemoryLedger",
  "sessionSummary",
  "playerMonthlyBriefing",
  "aiSettings",
  "characters",
  "eventHistory",
  "turnCount",
  "year",
  "month",
  "tenDayPeriod",
  "mapContextView"
]);

const S70_PROTECTED_PLAYER_PATCH_KEYS = Object.freeze([
  "role",
  "roleLabel",
  "teacher",
  "position",
  "examRank",
  "palaceRank",
  "officeTitle",
  "examHistory"
]);

const S70_AI_FIRST_BLOCKED_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/,
  /hidden(?:Notes|Intent)/i,
  /raw[_ -]?(?:provider|prompt|table|audit|ledger|proposal|coordinate)/i,
  /provider proposal/i,
  /statePatch|worldState|rawSql/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/,
  /sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,}/,
  /data[\\/](?:sessions|audit)|event_log|ai_change_proposals|world_sessions|world_state_json|prompt_retrieval_index|event_archive_index/i,
  /file:\/\/\/?(?:[A-Za-z]:[\\/]|(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/)/i,
  /[A-Za-z]:[\\/][^\s"'<>]+/,
  /\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/
]);

function readArg(argv, name) {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);

  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }

  return "";
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function isTruthy(value) {
  return ["1", "true", "yes", "required"].includes(String(value || "").trim().toLowerCase());
}

function readMimoAiFirstSmokeConfig({ argv = process.argv, env = process.env } = {}) {
  const provider = String(readArg(argv, "--provider") || "mimo").trim().toLowerCase();
  if (!["mimo", "xiaomi"].includes(provider)) {
    throw new Error("S70.14 AI-first provider smoke currently supports only --provider mimo.");
  }

  return {
    provider: "mimo",
    apiKey: env.MIMO_API_KEY || "",
    baseUrl: readArg(argv, "--base-url") || env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL,
    model: readArg(argv, "--model") || env.MIMO_MODEL || DEFAULT_MIMO_MODEL,
    required: hasFlag(argv, "--required") || isTruthy(env.MIMO_REQUIRED),
    timeoutMs: Number(env.AI_PROVIDER_TIMEOUT_MS) || readTimeoutMs()
  };
}

function redactAcceptanceText(value) {
  return String(value || "")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(/\btp-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z]:[\\/][^\s"'<>]+/g, "[REDACTED_PATH]")
    .replace(/\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+/g, "[REDACTED_PATH]")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, limit = 96) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 3)}...`;
}

function stripSafeNoticeFields(value) {
  if (Array.isArray(value)) return value.map(stripSafeNoticeFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "hiddenNotice")
      .map(([key, child]) => [key, stripSafeNoticeFields(child)])
  );
}

function assertNoSensitiveLeak(label, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(stripSafeNoticeFields(value));
  const leaked = S70_AI_FIRST_BLOCKED_PATTERNS.filter((pattern) => pattern.test(serialized));
  if (leaked.length) {
    throw new Error(`${label} leaked hidden/raw/provider/path/key text.`);
  }
}

function collectS70ProviderPatchViolations(statePatch = {}) {
  const patch = statePatch && typeof statePatch === "object" && !Array.isArray(statePatch)
    ? statePatch
    : {};
  const violations = [];

  for (const key of S70_PROTECTED_TOP_LEVEL_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) violations.push(key);
  }

  const playerPatch = patch.player && typeof patch.player === "object" && !Array.isArray(patch.player)
    ? patch.player
    : {};
  for (const key of S70_PROTECTED_PLAYER_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(playerPatch, key)) violations.push(`player.${key}`);
  }

  return violations;
}

function assertS70ProviderPatchSafe(providerName, stepName, statePatch = {}) {
  const violations = collectS70ProviderPatchViolations(statePatch);
  if (violations.length) {
    throw new Error(`${providerName} ${stepName} returned S70 server-owned patches after adapter normalization: ${violations.join(", ")}`);
  }
}

function createAiFirstWorldState() {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "S70 验收官",
    nativePlace: "苏州府",
    background: "新科进士，初入部院观政。",
    customSetting: "S70.14 AI-first smoke checks provider JSON while server-owned systems stay deterministic."
  });

  worldState.month = 5;
  worldState.tenDayPeriod = 3;
  worldState.turnCount = 8;
  worldState.player.officeTitle = "吏部主事";
  worldState.player.position = "吏部主事";
  worldState.officialCareer.currentPosting = "吏部主事";
  worldState.officialCareer.bureauId = "ministry_personnel";
  worldState.officialCareer.assignments.push({
    id: "s70-ai-first-assignment",
    title: "核验候补官缺",
    status: "active",
    progress: 45,
    turnsRemaining: 1,
    deadlineLabel: "下月上旬"
  });

  recordAiInvocation(worldState, {
    id: "s70-ai-first-seed",
    taskType: "narrator",
    provider: "mimo",
    model: DEFAULT_MIMO_MODEL,
    status: "completed",
    durationMs: 1,
    maxOutputTokens: 1600,
    toolCallCount: 0,
    rejectedToolCallCount: 0,
    recordedTurn: worldState.turnCount
  });

  return worldState;
}

function createDefaultMimoProvider(config) {
  return createMimoProvider({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    route: {
      taskType: "narrator",
      provider: "mimo",
      model: config.model,
      timeoutMs: config.timeoutMs,
      maxOutputTokens: 2200,
      temperature: 0.35
    }
  });
}

async function runProviderNarrativeProbe(provider, worldState, config) {
  const opening = await provider.startGame(worldState);
  if (!opening?.narrative || !Array.isArray(opening.events)) {
    throw new Error("MiMo AI-first opening did not return the opening schema shape.");
  }
  assertNoSensitiveLeak("MiMo AI-first opening narrative", opening.narrative);
  assertNoSensitiveLeak("MiMo AI-first opening events", opening.events);

  const playerAction = [
    "以吏部主事身份写一封较长署务札记：",
    "核验候补官缺，询问同僚意见，参考可见地图地点和官署差遣，",
    "可以提出公开关系或记忆建议，但不得修改官职、地图、数据库、时间或隐藏事实。"
  ].join("");
  const turn = await provider.runTurn(worldState, playerAction);
  if (!turn?.narrative || typeof turn.statePatch !== "object") {
    throw new Error("MiMo AI-first turn did not return the turn schema shape.");
  }
  assertS70ProviderPatchSafe("mimo", "ai-first-turn", turn.statePatch);
  assertNoSensitiveLeak("MiMo AI-first turn narrative", turn.narrative);
  assertNoSensitiveLeak("MiMo AI-first turn events", turn.events || []);

  return {
    summary: {
      openingPreview: truncate(opening.narrative),
      turnPreview: truncate(turn.narrative),
      eventCount: (opening.events || []).length + (turn.events || []).length,
      adapterPatchKeys: Object.keys(turn.statePatch || {}),
      memoryProposalCount: Array.isArray(turn.memoryProposals) ? turn.memoryProposals.length : 0,
      model: config.model
    },
    turn
  };
}

function pickMapRefs(mapContextView = {}) {
  const refs = Array.isArray(mapContextView.mapEntityRefs) ? mapContextView.mapEntityRefs : [];
  const origin = refs.find((ref) => ["posting", "city", "jurisdiction"].includes(ref.entityType)) || refs[0];
  const destination = refs.find((ref) => ref.refId !== origin?.refId && ["city", "jurisdiction", "posting"].includes(ref.entityType))
    || refs.find((ref) => ref.refId !== origin?.refId)
    || origin;
  const route = refs.find((ref) => ref.entityType === "route");
  return {
    originRef: origin?.refId || "",
    destinationRefs: destination?.refId ? [destination.refId] : [],
    routeRefs: route?.refId ? [route.refId] : [],
    evidenceRefs: [origin?.refId, destination?.refId, route?.refId].filter(Boolean).slice(0, 4)
  };
}

function runServerAiFirstSurfaceProbe(worldState, turn) {
  const previousState = JSON.parse(JSON.stringify(worldState));
  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  const monthlyBriefing = runPlayerMonthlyBriefingStep(worldState, {
    previousState,
    worldTick
  });
  if (!monthlyBriefing.generated) {
    throw new Error(`S70 AI-first monthly briefing was not generated: ${monthlyBriefing.reason}`);
  }
  const playerMonthlyBriefingView = buildPlayerMonthlyBriefingView(worldState);
  assertNoSensitiveLeak("S70 player monthly briefing view", playerMonthlyBriefingView);

  const actorMemory = applyTurnActorMemoryUpdates(worldState, {
    providerMemoryProposals: [
      ...(Array.isArray(turn?.memoryProposals) ? turn.memoryProposals : []),
      {
        actorId: "npc:C01",
        type: "impression",
        visibility: "player_visible",
        subjectType: "player",
        subjectId: "P1",
        summary: "赵给事记得玩家本月核验官缺案牍，行事较为谨慎。",
        salience: 64,
        confidence: 0.74,
        sourceRefs: [{ id: "s70-ai-first-turn", sourceView: "provider_turn", label: "署务札记" }]
      },
      {
        actorId: "npc:C01",
        type: "fact",
        visibility: "private",
        summary: "这条私密记忆应被服务器拒绝。"
      }
    ],
    playerMonthlyBriefing: monthlyBriefing
  }, { actorMemoryRecords: [] });
  if (actorMemory.appliedCount < 1 || actorMemory.rejectedCount < 1) {
    throw new Error("S70 AI-first memory probe did not apply visible memory and reject private memory.");
  }
  const actorMemoryView = buildActorMemoryView(worldState);
  assertNoSensitiveLeak("S70 actor memory view", actorMemoryView);

  const sessionSummary = updateMonthlySessionSummary(worldState, {
    worldTick,
    playerMonthlyBriefing: monthlyBriefing,
    actorMemory
  }, { taskType: "memory_summarizer" });
  if (!sessionSummary.updated) {
    throw new Error(`S70 session summary was not updated: ${sessionSummary.reason}`);
  }
  const sessionSummaryView = buildSessionSummaryView(worldState);
  assertNoSensitiveLeak("S70 session summary view", sessionSummaryView);

  const timeSkipPlan = buildTimeSkipPlan("照旧处理一月", {}, { worldState });
  const timeSkipSummary = buildTimeSkipSummary({
    executed: false,
    blocked: true,
    plan: timeSkipPlan,
    validation: { reasons: ["AI-first smoke 只验证跳时计划，不执行额外真实 provider 回合。"] },
    requestedTicks: timeSkipPlan.ticks || 0,
    completedTicks: 0,
    tickResults: []
  }, { provider: "mimo", model: DEFAULT_MIMO_MODEL });
  if (timeSkipPlan.detected !== true || timeSkipPlan.ticks !== 3) {
    throw new Error("S70 time skip planner did not detect one-month official routine.");
  }
  assertNoSensitiveLeak("S70 time skip summary", timeSkipSummary);

  const actorProfile = buildPlayerAiActorProfile(worldState);
  const mapContextView = buildMapContextView(worldState, actorProfile);
  const refs = pickMapRefs(mapContextView);
  if (!refs.originRef || !refs.destinationRefs.length || !refs.evidenceRefs.length) {
    throw new Error("S70 map context did not expose enough visible refs for AI-first smoke.");
  }
  const mapProposal = resolveMapMovementProposal(worldState, {
    moveType: "inspection",
    publicSummary: "巡查吏部官缺与相关城邑差遣，待服务器复核路线与后果。",
    visibility: "actor_visible",
    confidence: 0.7,
    riskLevel: 2,
    expectedBenefits: ["厘清候补官缺牵连地点"],
    counterCosts: ["需盘费和文移"],
    riskDisclosure: "只作待裁决巡查建议。",
    cooldownKey: "s70-ai-first-map-inspection",
    affectedMapRefs: refs.destinationRefs,
    ...refs
  }, { actorProfile });
  if (mapProposal.status !== "pending") {
    throw new Error(`S70 map movement proposal was not pending: ${mapProposal.rejectionReasons.join("; ")}`);
  }
  assertNoSensitiveLeak("S70 map context view", mapContextView);
  assertNoSensitiveLeak("S70 map proposal public result", mapProposal.publicResult);

  const env = { AI_PROVIDER: "mimo", MIMO_API_KEY: "configured", MIMO_MODEL: DEFAULT_MIMO_MODEL };
  const routePolicy = buildDefaultModelRoutePolicy(env);
  const critic = resolveModelForTask("critic", routePolicy);
  const safety = resolveModelForTask("safety_gate", routePolicy);
  if (!critic.reviewerOnly || critic.mayUseTools || critic.mayRequestAdjudication) {
    throw new Error("S70 critic route is not review-only.");
  }
  if (!safety.reviewerOnly || safety.mayUseTools || safety.mayRequestAdjudication) {
    throw new Error("S70 safety route is not review-only.");
  }

  const { settings, routePolicy: settingsRoutePolicy } = resolveAiSettingsForSession(worldState, env);
  const aiSettingsView = redactAiSettingsForClient({ ...settings, routePolicy: settingsRoutePolicy }, env);
  assertNoSensitiveLeak("S70 AI settings view", aiSettingsView);

  return {
    monthlyBriefing: {
      generated: monthlyBriefing.generated,
      active: playerMonthlyBriefingView.active,
      latestReportId: playerMonthlyBriefingView.latest?.reportId || null
    },
    actorMemory: {
      appliedCount: actorMemory.appliedCount,
      rejectedCount: actorMemory.rejectedCount,
      actorCount: actorMemoryView.actors.length
    },
    sessionSummary: {
      updated: sessionSummary.updated,
      latestPeriodKey: sessionSummaryView.latest?.periodKey || null
    },
    timeSkip: {
      detected: timeSkipPlan.detected,
      ticks: timeSkipPlan.ticks,
      blockedSummary: timeSkipSummary.summary
    },
    mapContext: {
      refCount: mapContextView.mapEntityRefs.length,
      proposalStatus: mapProposal.status,
      readScope: ["mapContextView"]
    },
    reviewOnly: {
      critic: {
        provider: critic.provider,
        reviewerOnly: critic.reviewerOnly,
        mayUseTools: critic.mayUseTools
      },
      safety: {
        provider: safety.provider,
        reviewerOnly: safety.reviewerOnly,
        mayUseTools: safety.mayUseTools
      }
    },
    aiSettings: {
      preset: aiSettingsView.preset,
      routeCount: aiSettingsView.taskRoutes.length,
      narratorProvider: settingsRoutePolicy.routes.narrator.provider
    }
  };
}

async function runProviderAiFirstSmoke(options = {}) {
  const config = readMimoAiFirstSmokeConfig(options);
  if (!config.apiKey) {
    const message = "No MIMO_API_KEY found; skipping MiMo AI-first smoke. Set MIMO_API_KEY or MIMO_REQUIRED=1 for required validation.";
    if (config.required) throw new Error(message);
    console.log(message);
    return { skipped: true, provider: "mimo", cases: [] };
  }

  const providerFactory = options.providerFactory || createDefaultMimoProvider;
  const provider = providerFactory(config);
  const worldState = createAiFirstWorldState();

  console.log(`[mimo] starting S70.14 AI-first smoke (${config.model})`);
  const narrative = await runProviderNarrativeProbe(provider, worldState, config);
  console.log(`[mimo] narrator ok: events=${narrative.summary.eventCount}, preview="${narrative.summary.turnPreview}"`);

  const surfaces = runServerAiFirstSurfaceProbe(worldState, narrative.turn);
  console.log(`[mimo] S70 surfaces ok: monthly=${surfaces.monthlyBriefing.generated}, memory=${surfaces.actorMemory.appliedCount}/${surfaces.actorMemory.rejectedCount}, map=${surfaces.mapContext.proposalStatus}`);

  return {
    skipped: false,
    provider: "mimo",
    model: config.model,
    cases: [
      { id: "ordinary_and_long_turn", status: "passed", ...narrative.summary },
      { id: "s70_server_ai_first_surfaces", status: "passed", ...surfaces }
    ],
    required: config.required,
    notes: [
      "S70.14 AI-first smoke writes no sessions and grants no model write authority.",
      "Tool-call shape remains covered by npm run smoke:provider:tools; run both with MIMO_REQUIRED=1 for final keyed acceptance."
    ]
  };
}

function printUsage() {
  console.log([
    "Usage: npm run smoke:provider:ai-first -- [--provider mimo] [--required] [--model mimo-v2.5-pro] [--base-url URL]",
    "",
    "Default behavior:",
    "- Missing MIMO_API_KEY: skip with a clear message.",
    "- MIMO_REQUIRED=1 or --required: fail if MIMO_API_KEY is missing.",
    "- This smoke calls MiMo for opening/ordinary long-turn JSON, then verifies S70 AI-first server surfaces in memory.",
    "- It writes no sessions and never prints API keys, raw prompts, provider payloads, SQLite rows, or local paths."
  ].join("\n"));
}

if (require.main === module) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
  } else {
    runProviderAiFirstSmoke().then((result) => {
      console.log(JSON.stringify(result, null, 2));
    }).catch((error) => {
      console.error(`Provider AI-first smoke failed: ${redactAcceptanceText(error.message)}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  assertNoSensitiveLeak,
  assertS70ProviderPatchSafe,
  collectS70ProviderPatchViolations,
  createAiFirstWorldState,
  readMimoAiFirstSmokeConfig,
  redactAcceptanceText,
  runProviderAiFirstSmoke,
  runServerAiFirstSurfaceProbe
};
