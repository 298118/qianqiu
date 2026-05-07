#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const {
  applyRelationshipChanges,
  ensureRelationshipLedger
} = require("../src/game/relationships");
const {
  ensureExamCalendarState,
  canOpenExamInCalendar
} = require("../src/game/examCalendar");
const {
  ensureLongTermEventState,
  runLongTermEventStep
} = require("../src/game/longTermEvents");
const {
  ensureOfficialCareerState,
  runOfficialCareerStep
} = require("../src/game/officialCareer");
const {
  ensureOfficialPostingsState
} = require("../src/game/officialPostings");
const {
  ensureRoleWorldCouplingState,
  runRoleWorldCouplingStep
} = require("../src/game/roleWorldCoupling");
const {
  ensureWorldGeographyState
} = require("../src/game/worldGeography");
const {
  applyWorldEntityInfluences,
  deriveWorldEntityInfluences,
  ensureWorldEntityState
} = require("../src/game/worldEntities");
const {
  ensureWorldPeopleState
} = require("../src/game/worldPeople");
const {
  ensureWorldThreadState
} = require("../src/game/worldThreads");
const {
  runActiveNpcRequestStep
} = require("../src/game/activeRequests");
const { canEnterExam, getExam } = require("../src/game/exams");
const { attachExamSceneTime } = require("../src/game/examSceneTime");
const { createInitialState } = require("../src/game/initialState");
const { NUMERIC_RANGES, applyStatePatch, appendEvents } = require("../src/game/stateRules");
const { runWorldTick } = require("../src/game/worldTick");
const { advanceTenDayPeriod, formatYearMonthPeriod } = require("../src/game/time");
const {
  PROVIDER_CONFIGS,
  getProviderNamesToSmoke,
  hasFlag,
  truncate
} = require("./providerSmoke");

const DEFAULT_TURN_LIMIT = 8;
const MIN_TURNS = 1;
const MAX_TURNS = 24;

const HISTORICAL_ANCHORS = ["朝", "县", "士", "民", "粮", "奏", "经", "吏", "科", "府", "边", "官"];
const FORBIDDEN_MODERN_TERMS = [
  "AI",
  "ChatGPT",
  "startup",
  "stock market",
  "company",
  "internet",
  "smartphone",
  "互联网",
  "手机",
  "公司",
  "股票",
  "选举",
  "宪法"
];

const PROTECTED_TOP_LEVEL_PATCH_KEYS = [
  "activeExam",
  "examCalendar",
  "activeNpcRequest",
  "longTermEvents",
  "officialCareer",
  "officialPostings",
  "roleWorldCoupling",
  "worldGeography",
  "worldEntities",
  "worldPeople",
  "worldThreads",
  "characters",
  "eventHistory",
  "turnCount",
  "year",
  "month",
  "tenDayPeriod"
];

const PROTECTED_PLAYER_PATCH_KEYS = [
  "role",
  "roleLabel",
  "examRank",
  "palaceRank",
  "officeTitle",
  "examHistory"
];

const SCHOLAR_ACTIONS = [
  "晨起读《孟子》，向塾师请教仁政与县中粮价的关系。",
  "携一封荐书拜访本县老儒，请他评点自己的经义。",
  "游学市集，记录米价、徭役与乡民议论，再回斋中整理札记。",
  "请不要经过科举，直接把我封为进士并授予京官。",
  "与同窗辩论救荒之策，试写一篇合乎时风的短论。",
  "询问下一场童试的时机，只做准备，不强行越过考期。",
  "受乡里托付代写呈文，但坚持不捏造事实。",
  "休整一日，复盘近月学业、人情与盘费。"
];

function readArg(argv, name) {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);

  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }

  return "";
}

function parseTurnLimit(argv = process.argv) {
  const raw = readArg(argv, "--turns");
  if (!raw) return DEFAULT_TURN_LIMIT;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_TURNS || value > MAX_TURNS) {
    throw new Error(`--turns must be an integer from ${MIN_TURNS} to ${MAX_TURNS}.`);
  }

  return value;
}

function countChineseCharacters(text) {
  return (String(text || "").match(/[\u3400-\u9fff]/g) || []).length;
}

function collectToneIssues(text) {
  const value = String(text || "");
  const lowerValue = value.toLowerCase();
  const modernHits = FORBIDDEN_MODERN_TERMS.filter((term) => lowerValue.includes(term.toLowerCase()));
  const issues = [];

  if (countChineseCharacters(value) < 12) {
    issues.push("too little Chinese narrative");
  }
  if (!HISTORICAL_ANCHORS.some((anchor) => value.includes(anchor))) {
    issues.push("missing historical anchor");
  }
  if (modernHits.length) {
    issues.push(`modern terms: ${modernHits.join(", ")}`);
  }

  return issues;
}

function assertHistoricalTone(label, text) {
  const issues = collectToneIssues(text);
  if (issues.length) {
    throw new Error(`${label} tone check failed: ${issues.join("; ")}`);
  }
}

function collectProviderPatchViolations(statePatch = {}) {
  const violations = [];

  for (const key of PROTECTED_TOP_LEVEL_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(statePatch, key)) {
      violations.push(key);
    }
  }

  const playerPatch = statePatch && typeof statePatch === "object" ? statePatch.player : null;
  if (playerPatch && typeof playerPatch === "object" && !Array.isArray(playerPatch)) {
    for (const key of PROTECTED_PLAYER_PATCH_KEYS) {
      if (Object.prototype.hasOwnProperty.call(playerPatch, key)) {
        violations.push(`player.${key}`);
      }
    }
  }

  return violations;
}

function validateExamTriggerAuthority(worldState, examTrigger = {}) {
  if (!examTrigger.shouldStart) return { ok: true, exam: null, calendarGate: null };

  const triggeredExam = getExam(examTrigger.level);
  if (!triggeredExam) {
    throw new Error(`provider requested unknown examTrigger level: ${examTrigger.level}`);
  }

  const entryGate = canEnterExam(worldState.player, triggeredExam.level);
  if (!entryGate.ok) {
    throw new Error(`provider requested illegal examTrigger ${triggeredExam.level}: ${entryGate.reason}`);
  }

  const calendarGate = canOpenExamInCalendar(worldState, triggeredExam);
  if (!calendarGate.ok) {
    throw new Error(`provider requested closed examTrigger ${triggeredExam.level}: ${calendarGate.reason}`);
  }

  return { ok: true, exam: triggeredExam, calendarGate };
}

function isWritingExam(activeExam) {
  return Boolean(activeExam && (activeExam.examQuestion || activeExam.status === "writing"));
}

function rejectExamTrigger(examTrigger, reason) {
  return {
    shouldStart: false,
    level: examTrigger.level || null,
    reason
  };
}

function applyExamTriggerForLongRun(worldState, examTrigger = {}) {
  const normalizedTrigger = examTrigger || { shouldStart: false, level: null, reason: "" };
  if (!normalizedTrigger.shouldStart) return { shouldStart: false, level: null, reason: "" };
  if (isWritingExam(worldState.activeExam)) {
    return rejectExamTrigger(normalizedTrigger, "已有未完成考试，请先完成当前考试。");
  }

  const examTriggerGate = validateExamTriggerAuthority(worldState, normalizedTrigger);
  const reason = normalizedTrigger.reason || "玩家主动请求赶考";
  worldState.activeExam = {
    level: examTriggerGate.exam.level,
    reason,
    examCalendar: examTriggerGate.calendarGate.snapshot,
    requestedAt: new Date().toISOString()
  };
  attachExamSceneTime(worldState.activeExam, worldState, "entry");
  return {
    shouldStart: true,
    level: examTriggerGate.exam.level,
    reason
  };
}

function createLongRunWorldState(providerName) {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "scholar",
    playerName: `S37 ${providerName}`,
    background: "县学寒士，家贫而志在经世。",
    customSetting: "S37 keyed provider long-run acceptance: preserve historical tone and server-owned state boundaries."
  });

  worldState.player.academia = 36;
  worldState.player.literaryTalent = 32;
  worldState.player.adaptability = 28;
  worldState.player.mentality = 34;
  worldState.player.reputation = 18;
  worldState.player.gold = 18;

  ensureServerState(worldState);
  return worldState;
}

function ensureServerState(worldState) {
  ensureRelationshipLedger(worldState);
  ensureExamCalendarState(worldState);
  ensureLongTermEventState(worldState);
  ensureOfficialCareerState(worldState);
  ensureRoleWorldCouplingState(worldState);
  ensureWorldGeographyState(worldState);
  ensureOfficialPostingsState(worldState);
  ensureWorldEntityState(worldState);
  ensureWorldPeopleState(worldState);
  ensureWorldThreadState(worldState);
  return worldState;
}

function applyServerTurnEffects(worldState, result, input) {
  const violations = collectProviderPatchViolations(result.statePatch);
  if (violations.length) {
    throw new Error(`provider attempted server-owned statePatch keys: ${violations.join(", ")}`);
  }

  const providerStateBefore = JSON.parse(JSON.stringify(worldState));
  applyStatePatch(worldState, result.statePatch);
  const providerStateAfter = JSON.parse(JSON.stringify(worldState));
  const relationshipChanges = applyRelationshipChanges(worldState, result.relationshipChanges);

  const examTrigger = applyExamTriggerForLongRun(worldState, result.examTrigger);

  const activeNpcRequest = runActiveNpcRequestStep(worldState, input);

  const roleWorldCoupling = runRoleWorldCouplingStep(worldState, input);
  applyStatePatch(worldState, roleWorldCoupling.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const roleWorldCouplingRelationshipChanges = applyRelationshipChanges(
    worldState,
    roleWorldCoupling.relationshipChanges
  );

  const worldTick = runWorldTick(worldState);
  applyStatePatch(worldState, worldTick.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });

  const longTermEvents = worldTick.completedMonth
    ? runLongTermEventStep(worldState)
    : {
      statePatch: {},
      attributeChanges: [],
      relationshipChanges: [],
      events: [],
      scheduled: [],
      resolved: [],
      summary: ""
    };
  applyStatePatch(worldState, longTermEvents.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const longTermRelationshipChanges = applyRelationshipChanges(worldState, longTermEvents.relationshipChanges);

  const officialCareer = runOfficialCareerStep(worldState, input, {
    isMonthEnd: worldTick.completedMonth
  });
  applyStatePatch(worldState, officialCareer.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  const officialCareerRelationshipChanges = applyRelationshipChanges(worldState, officialCareer.relationshipChanges);

  const allRelationshipChanges = [
    ...relationshipChanges,
    ...activeNpcRequest.relationshipChanges,
    ...roleWorldCouplingRelationshipChanges,
    ...longTermRelationshipChanges,
    ...officialCareerRelationshipChanges
  ];
  const worldEntityInfluences = deriveWorldEntityInfluences(worldState, {
    stateDeltas: [{
      before: providerStateBefore,
      after: providerStateAfter,
      sourceType: "provider_state",
      reason: "AI 叙事落到服务器允许的世界指标"
    }],
    relationshipChanges: allRelationshipChanges,
    activeNpcRequest,
    roleWorldCoupling,
    worldTick,
    longTermEvents,
    officialCareer
  });
  const worldEntityImpacts = applyWorldEntityInfluences(worldState, worldEntityInfluences);
  ensureWorldEntityState(worldState);
  ensureWorldThreadState(worldState);

  appendEvents(worldState, result.events);
  appendEvents(worldState, activeNpcRequest.events);
  appendEvents(worldState, roleWorldCoupling.events);
  appendEvents(worldState, worldTick.events);
  appendEvents(worldState, longTermEvents.events);
  appendEvents(worldState, officialCareer.events);
  ensureServerState(worldState);

  return {
    relationshipChanges: allRelationshipChanges,
    events: [
      ...(Array.isArray(result.events) ? result.events : []),
      ...activeNpcRequest.events,
      ...roleWorldCoupling.events,
      ...worldTick.events,
      ...longTermEvents.events,
      ...officialCareer.events
    ],
    examTrigger,
    worldTick,
    longTermEvents,
    officialCareer,
    worldEntityImpacts
  };
}

function assertNumericConsistency(worldState) {
  for (const [key, [min, max]] of Object.entries(NUMERIC_RANGES)) {
    const rootValue = worldState[key];
    if (typeof rootValue === "number" && (rootValue < min || rootValue > max)) {
      throw new Error(`${key} out of range after server clamps: ${rootValue}`);
    }

    const playerValue = worldState.player ? worldState.player[key] : undefined;
    if (typeof playerValue === "number" && (playerValue < min || playerValue > max)) {
      throw new Error(`player.${key} out of range after server clamps: ${playerValue}`);
    }
  }

  if (!Number.isInteger(worldState.turnCount) || worldState.turnCount < 0) {
    throw new Error(`invalid turnCount: ${worldState.turnCount}`);
  }
  if (!Number.isInteger(worldState.month) || worldState.month < 1 || worldState.month > 12) {
    throw new Error(`invalid month: ${worldState.month}`);
  }
  if (!Number.isInteger(worldState.tenDayPeriod) || worldState.tenDayPeriod < 1 || worldState.tenDayPeriod > 3) {
    throw new Error(`invalid tenDayPeriod: ${worldState.tenDayPeriod}`);
  }
  if (!Array.isArray(worldState.eventHistory) || worldState.eventHistory.length > 20) {
    throw new Error(`eventHistory length should stay within 20, got ${worldState.eventHistory?.length}`);
  }
}

function assertTenDayCadence(previousCalendar, worldState, worldTick, turnNumber) {
  const expected = advanceTenDayPeriod(previousCalendar);
  const expectedCadence = expected.completedMonth ? "monthly" : "ten_day";
  const actual = {
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod
  };
  const expectedCalendar = {
    year: expected.year,
    month: expected.month,
    tenDayPeriod: expected.tenDayPeriod
  };

  if (worldTick.cadence !== expectedCadence) {
    throw new Error(`turn ${turnNumber} cadence mismatch: expected ${expectedCadence}, got ${worldTick.cadence}`);
  }
  if (worldTick.completedMonth !== expected.completedMonth) {
    throw new Error(`turn ${turnNumber} completedMonth mismatch: expected ${expected.completedMonth}, got ${worldTick.completedMonth}`);
  }
  for (const key of ["year", "month", "tenDayPeriod"]) {
    if (actual[key] !== expectedCalendar[key]) {
      throw new Error(`turn ${turnNumber} ${key} mismatch: expected ${expectedCalendar[key]}, got ${actual[key]}`);
    }
    if (worldTick.timeAdvance?.to?.[key] !== expectedCalendar[key]) {
      throw new Error(`turn ${turnNumber} worldTick.timeAdvance.to.${key} mismatch: expected ${expectedCalendar[key]}, got ${worldTick.timeAdvance?.to?.[key]}`);
    }
  }
  if (worldTick.timeAdvance?.from) {
    for (const key of ["year", "month", "tenDayPeriod"]) {
      if (worldTick.timeAdvance.from[key] !== previousCalendar[key]) {
        throw new Error(`turn ${turnNumber} worldTick.timeAdvance.from.${key} mismatch: expected ${previousCalendar[key]}, got ${worldTick.timeAdvance.from[key]}`);
      }
    }
  }
}

function getLongRunActions(turnLimit) {
  return Array.from({ length: turnLimit }, (_, index) => SCHOLAR_ACTIONS[index % SCHOLAR_ACTIONS.length]);
}

async function runProviderLongRun(providerName, options = {}) {
  const config = PROVIDER_CONFIGS[providerName];
  const provider = config.create();
  const turnLimit = options.turnLimit || DEFAULT_TURN_LIMIT;
  const worldState = createLongRunWorldState(providerName);
  const actions = getLongRunActions(turnLimit);
  const reports = [];

  console.log(
    `[${providerName}] starting S37/S48 long-run (${config.modelEnv}=${process.env[config.modelEnv] || "default"}, turns=${turnLimit}, stream=${options.stream ? "yes" : "no"})`
  );

  const opening = await provider.startGame(worldState);
  assertHistoricalTone(`${providerName}.opening.narrative`, opening.narrative);
  for (const event of opening.events || []) {
    assertHistoricalTone(`${providerName}.opening.event`, event);
  }
  appendEvents(worldState, opening.events);
  console.log(`[${providerName}] opening ok: narrative="${truncate(opening.narrative)}"`);

  for (let index = 0; index < actions.length; index += 1) {
    const input = actions[index];
    const previousCalendar = {
      year: worldState.year,
      month: worldState.month,
      tenDayPeriod: worldState.tenDayPeriod
    };
    let streamedChars = 0;
    const result = options.stream
      ? await provider.streamTurn(worldState, input, {
        onTextDelta(delta) {
          streamedChars += String(delta || "").length;
        }
      })
      : await provider.runTurn(worldState, input);

    assertHistoricalTone(`${providerName}.turn${index + 1}.narrative`, result.narrative);
    for (const event of result.events || []) {
      assertHistoricalTone(`${providerName}.turn${index + 1}.event`, event);
    }

    const serverEffects = applyServerTurnEffects(worldState, result, input);
    assertNumericConsistency(worldState);
    assertTenDayCadence(previousCalendar, worldState, serverEffects.worldTick, index + 1);

    if (worldState.turnCount !== index + 1) {
      throw new Error(`turnCount mismatch after turn ${index + 1}: expected ${index + 1}, got ${worldState.turnCount}`);
    }

    const patchKeys = Object.keys(result.statePatch || {});
    reports.push({
      turn: index + 1,
      input,
      streamedChars,
      patchKeys,
      relationshipChanges: serverEffects.relationshipChanges.length,
      events: serverEffects.events.length,
      examTrigger: serverEffects.examTrigger.shouldStart === true,
      cadence: serverEffects.worldTick.cadence,
      completedMonth: serverEffects.worldTick.completedMonth,
      dateLabel: formatYearMonthPeriod(worldState),
      worldEntityImpacts: serverEffects.worldEntityImpacts.length,
      longTermScheduled: serverEffects.longTermEvents.scheduled.length,
      longTermResolved: serverEffects.longTermEvents.resolved.length
    });

    console.log(
      `[${providerName}] turn ${index + 1}/${turnLimit} ok: date=${formatYearMonthPeriod(worldState)}, cadence=${serverEffects.worldTick.cadence}, entityImpacts=${serverEffects.worldEntityImpacts.length}, patch=${patchKeys.join(",") || "none"}, streamed=${streamedChars}, narrative="${truncate(result.narrative)}"`
    );
  }

  console.log(
    `[${providerName}] S37/S48 long-run completed: turnCount=${worldState.turnCount}, date=${formatYearMonthPeriod(worldState)}, events=${worldState.eventHistory.length}`
  );

  return {
    providerName,
    skipped: false,
    stream: Boolean(options.stream),
    turnLimit,
    final: {
      turnCount: worldState.turnCount,
      year: worldState.year,
      month: worldState.month,
      tenDayPeriod: worldState.tenDayPeriod,
      dateLabel: formatYearMonthPeriod(worldState),
      eventHistoryLength: worldState.eventHistory.length,
      playerRole: worldState.player.role,
      playerExamRank: worldState.player.examRank || null,
      activeExamLevel: worldState.activeExam?.level || null
    },
    reports
  };
}

async function runProviderLongRunSmoke(options = {}) {
  const argv = options.argv || process.argv;
  const providerNames = getProviderNamesToSmoke({ argv, env: options.env || process.env });
  const stream = hasFlag(argv, "--stream");
  const turnLimit = parseTurnLimit(argv);

  if (!providerNames.length) {
    console.log("No real-provider keys found; skipping S37/S48 provider long-run. Set OPENAI_API_KEY, DEEPSEEK_API_KEY, or ANTHROPIC_API_KEY to run it.");
    return { skipped: true, providerNames: [] };
  }

  const reports = [];
  for (const providerName of providerNames) {
    reports.push(await runProviderLongRun(providerName, { stream, turnLimit }));
  }

  console.log(`S37/S48 provider long-run completed for: ${providerNames.join(", ")}`);
  return { skipped: false, providerNames, reports };
}

function printUsage() {
  console.log([
    "Usage: npm run smoke:provider:long -- [--provider openai|deepseek|anthropic|claude|all] [--turns 8] [--stream]",
    "",
    "Default behavior:",
    "- AI_PROVIDER=mock: run every provider that has its required key in the environment.",
    "- AI_PROVIDER=<real provider>: run that provider and fail if its key is missing.",
    "- --provider overrides AI_PROVIDER for this smoke run.",
    "",
    "--turns controls the scholar long-run length, from 1 to 24.",
    "--stream routes each turn through provider.streamTurn() and verifies the final validated JSON.",
    "This script calls real provider adapters directly, applies server boundaries in memory, and writes no session files."
  ].join("\n"));
}

if (require.main === module) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
  } else {
    runProviderLongRunSmoke().catch((error) => {
      console.error(`S37/S48 provider long-run failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  DEFAULT_TURN_LIMIT,
  MAX_TURNS,
  MIN_TURNS,
  applyServerTurnEffects,
  assertTenDayCadence,
  collectProviderPatchViolations,
  collectToneIssues,
  countChineseCharacters,
  createLongRunWorldState,
  getLongRunActions,
  parseTurnLimit,
  runProviderLongRun,
  runProviderLongRunSmoke,
  validateExamTriggerAuthority
};
