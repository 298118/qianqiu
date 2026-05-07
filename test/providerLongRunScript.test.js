const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
  runProviderLongRunSmoke,
  validateExamTriggerAuthority
} = require("../scripts/providerLongRun");
const { monthsToTurns } = require("../src/game/time");

test("provider long-run parses bounded turn limits", () => {
  assert.equal(parseTurnLimit(["node", "scripts/providerLongRun.js"]), DEFAULT_TURN_LIMIT);
  assert.equal(parseTurnLimit(["node", "scripts/providerLongRun.js", "--turns", "3"]), 3);
  assert.equal(parseTurnLimit(["node", "scripts/providerLongRun.js", "--turns=4"]), 4);

  assert.throws(
    () => parseTurnLimit(["node", "scripts/providerLongRun.js", "--turns", String(MIN_TURNS - 1)]),
    /--turns/
  );
  assert.throws(
    () => parseTurnLimit(["node", "scripts/providerLongRun.js", "--turns", String(MAX_TURNS + 1)]),
    /--turns/
  );
  assert.throws(
    () => parseTurnLimit(["node", "scripts/providerLongRun.js", "--turns", "2.5"]),
    /--turns/
  );
});

test("provider long-run detects tone risks", () => {
  assert.equal(countChineseCharacters("县学士子议粮政"), 7);
  assert.deepEqual(collectToneIssues("县学诸生闻粮价，归而读经论民事。"), []);
  assert.deepEqual(
    collectToneIssues("The official launches an AI startup."),
    ["too little Chinese narrative", "missing historical anchor", "modern terms: AI, startup"]
  );
});

test("provider long-run detects server-owned patch attempts", () => {
  assert.deepEqual(
    collectProviderPatchViolations({
      year: 1645,
      month: 9,
      tenDayPeriod: 3,
      turnCount: 99,
      activeExam: { level: "child_exam" },
      officialPostings: { postings: [{ id: "provider-forged-posting", officeId: "ministry_revenue_principal" }] },
      worldGeography: { countries: [{ id: "provider-forged-country", name: "伪地理" }] },
      worldEntities: { entities: [{ id: "provider-forged-entity", name: "伪实体" }] },
      worldPeople: { npcs: [{ id: "provider-forged-npc", name: "伪人物" }] },
      worldThreads: { threads: [{ id: "provider-forged", title: "伪议题" }] },
      player: {
        examRank: "秀才",
        officeTitle: "翰林"
      }
    }),
    ["activeExam", "officialPostings", "worldGeography", "worldEntities", "worldPeople", "worldThreads", "turnCount", "year", "month", "tenDayPeriod", "player.examRank", "player.officeTitle"]
  );

  assert.deepEqual(
    collectProviderPatchViolations({
      publicOrder: 72,
      player: {
        academia: 42
      }
    }),
    []
  );
});

test("provider long-run creates a scholar acceptance world without session writes", () => {
  const worldState = createLongRunWorldState("openai");

  assert.equal(worldState.player.role, "scholar");
  assert.equal(worldState.turnCount, 0);
  assert.equal(worldState.tenDayPeriod, 1);
  assert.equal(worldState.examCalendar.schemaVersion, 1);
  assert.equal(worldState.longTermEvents.schemaVersion, 1);
  assert.equal(worldState.roleWorldCoupling.schemaVersion, 1);
  assert.equal(worldState.worldGeography.schemaVersion, 1);
  assert.equal(worldState.worldEntities.schemaVersion, 1);
  assert.equal(worldState.worldPeople.schemaVersion, 1);
  assert.equal(worldState.worldThreads.schemaVersion, 1);
  assert.ok(worldState.sessionId);
});

test("provider long-run in-memory server effects follow ten-day cadence and entity impacts", () => {
  const worldState = createLongRunWorldState("openai");
  worldState.month = 8;
  worldState.tenDayPeriod = 1;
  worldState.longTermEvents.queue = [{
    schemaVersion: 1,
    id: "LTE-provider-cadence",
    key: "seasonal_harvest_audit",
    type: "seasonal",
    status: "active",
    targetType: "world",
    targetId: "",
    title: "秋粮核验",
    summary: "秋粮入簿，地方与户部核报仓储盈亏。",
    severity: 1,
    createdTurn: 0,
    startedYear: 1644,
    startedMonth: 8,
    durationMonths: 1,
    remainingMonths: 1,
    cooldownKey: "seasonal_harvest_audit",
    cooldownTurns: monthsToTurns(10),
    cooldownUnit: "ten_day",
    visibility: "public"
  }];

  const result = {
    narrative: "县学士子听粮价，归而记入札记。",
    statePatch: { publicOrder: 42 },
    relationshipChanges: [],
    events: ["县中粮户议论渐多。"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };

  const first = applyServerTurnEffects(worldState, result, "查问秋粮簿册");
  assert.equal(first.worldTick.cadence, "ten_day");
  assert.equal(first.worldTick.completedMonth, false);
  assert.equal(worldState.tenDayPeriod, 2);
  assert.equal(first.longTermEvents.resolved.length, 0);
  assert.equal(first.worldEntityImpacts.some((impact) => impact.sourceType === "long_term_event"), false);
  assert.equal(worldState.longTermEvents.queue[0].remainingMonths, 1);

  const second = applyServerTurnEffects(worldState, { ...result, statePatch: {} }, "继续查问秋粮簿册");
  assert.equal(second.worldTick.cadence, "ten_day");
  assert.equal(second.worldTick.completedMonth, false);
  assert.equal(worldState.tenDayPeriod, 3);

  const third = applyServerTurnEffects(worldState, { ...result, statePatch: {} }, "月末核验秋粮簿册");
  assert.equal(third.worldTick.cadence, "monthly");
  assert.equal(third.worldTick.completedMonth, true);
  assert.equal(third.longTermEvents.resolved[0].key, "seasonal_harvest_audit");
  assert.equal(third.worldEntityImpacts.some((impact) => impact.sourceType === "long_term_event"), true);
  assert.equal(worldState.turnCount, 3);
  assert.equal(worldState.month, 9);
  assert.equal(worldState.tenDayPeriod, 1);
});

test("provider long-run cadence helper validates one-month three-turn rhythm", () => {
  const worldState = createLongRunWorldState("openai");
  worldState.year = 1644;
  worldState.month = 8;
  worldState.tenDayPeriod = 2;
  const worldTick = {
    cadence: "ten_day",
    completedMonth: false,
    timeAdvance: {
      from: { year: 1644, month: 8, tenDayPeriod: 1 },
      to: { year: 1644, month: 8, tenDayPeriod: 2 }
    }
  };

  assert.doesNotThrow(() =>
    assertTenDayCadence({ year: 1644, month: 8, tenDayPeriod: 1 }, worldState, worldTick, 1)
  );

  assert.throws(
    () => assertTenDayCadence({ year: 1644, month: 8, tenDayPeriod: 2 }, worldState, worldTick, 2),
    /tenDayPeriod mismatch/
  );
});

test("provider long-run exam triggers attach scene time and preserve active writing exams", () => {
  const worldState = createLongRunWorldState("openai");
  const result = {
    narrative: "县学士子整衣赴试。",
    statePatch: {},
    relationshipChanges: [],
    events: [],
    examTrigger: { shouldStart: true, level: "child_exam", reason: "童试在期" }
  };

  const started = applyServerTurnEffects(worldState, result, "请求入场童试");

  assert.equal(started.examTrigger.shouldStart, true);
  assert.equal(started.examTrigger.level, "child_exam");
  assert.equal(worldState.activeExam.level, "child_exam");
  assert.equal(worldState.activeExam.sceneTime.phase, "entry");
  assert.equal(worldState.activeExam.sceneTime.startedAt.tenDayPeriod, 1);

  worldState.activeExam = {
    level: "child_exam",
    status: "writing",
    examQuestion: "论为学之本",
    sceneTime: worldState.activeExam.sceneTime
  };
  const rejected = applyServerTurnEffects(worldState, result, "未交卷又请求入场");

  assert.equal(rejected.examTrigger.shouldStart, false);
  assert.match(rejected.examTrigger.reason, /未完成考试/);
  assert.equal(worldState.activeExam.examQuestion, "论为学之本");
});

test("provider long-run action list cycles to requested turn count", () => {
  const actions = getLongRunActions(10);

  assert.equal(actions.length, 10);
  assert.equal(actions[0], actions[8]);
  assert.ok(actions.some((action) => action.includes("直接把我封为进士")));
});

test("provider long-run rejects illegal exam trigger skips", () => {
  const worldState = createLongRunWorldState("openai");

  assert.throws(
    () => validateExamTriggerAuthority(worldState, {
      shouldStart: true,
      level: "palace_exam",
      reason: "Skip directly to palace exam."
    }),
    /illegal examTrigger palace_exam/
  );
});

test("provider long-run rejects closed calendar exam triggers", () => {
  const worldState = createLongRunWorldState("openai");
  worldState.month = 3;

  assert.throws(
    () => validateExamTriggerAuthority(worldState, {
      shouldStart: true,
      level: "child_exam",
      reason: "Try child exam outside a window."
    }),
    /closed examTrigger child_exam/
  );
});

test("provider long-run skips cleanly when no provider keys are configured", async () => {
  const result = await runProviderLongRunSmoke({
    argv: ["node", "scripts/providerLongRun.js"],
    env: { AI_PROVIDER: "mock" }
  });

  assert.deepEqual(result, { skipped: true, providerNames: [] });
});
