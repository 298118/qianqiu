const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_TURN_LIMIT,
  MAX_TURNS,
  MIN_TURNS,
  collectProviderPatchViolations,
  collectToneIssues,
  countChineseCharacters,
  createLongRunWorldState,
  getLongRunActions,
  parseTurnLimit,
  runProviderLongRunSmoke,
  validateExamTriggerAuthority
} = require("../scripts/providerLongRun");

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
      activeExam: { level: "child_exam" },
      player: {
        examRank: "秀才",
        officeTitle: "翰林"
      }
    }),
    ["activeExam", "year", "player.examRank", "player.officeTitle"]
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
  assert.equal(worldState.examCalendar.schemaVersion, 1);
  assert.equal(worldState.longTermEvents.schemaVersion, 1);
  assert.equal(worldState.roleWorldCoupling.schemaVersion, 1);
  assert.ok(worldState.sessionId);
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
