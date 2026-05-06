const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePayload } = require("../src/ai/schemas");
const { createInitialState } = require("../src/game/initialState");
const { getExam } = require("../src/game/exams");
const { applyAuthenticityPenalties, checkEssayAuthenticity } = require("../src/game/essayChecks");
const { applyStatePatch } = require("../src/game/stateRules");
const { parseJsonFromText } = require("../src/utils/json");
const {
  ESSAY_EVAL_FIXTURES,
  HISTORICAL_TONE,
  INVALID_GRADE_FIXTURES,
  PATCH_SAFETY_FIXTURE,
  POLICY_RISK_TURN_FIXTURES,
  UNSAFE_TURN_FIXTURES,
  VALID_OUTPUT_FIXTURES
} = require("../testdata/aiEvalFixtures");

const ORDINARY_TURN_SERVER_OWNED_PATCH_KEYS = new Set(["activeExam", "characters", "eventHistory"]);
const ORDINARY_TURN_SERVER_OWNED_PLAYER_KEYS = new Set(["examRank", "examHistory"]);

function readPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (/^\d+$/.test(segment)) return current[Number(segment)];
    return current[segment];
  }, value);
}

function collectToneIssues(text) {
  const value = String(text || "");
  const lowerValue = value.toLowerCase();
  const hasHistoricalAnchor = HISTORICAL_TONE.anchors.some((anchor) => value.includes(anchor));
  const modernHits = HISTORICAL_TONE.forbiddenModern.filter((term) => lowerValue.includes(term.toLowerCase()));
  const issues = [];

  if (!hasHistoricalAnchor) {
    issues.push("missing historical anchor");
  }
  if (modernHits.length) {
    issues.push(`modern terms: ${modernHits.join(", ")}`);
  }

  return issues;
}

function assertHistoricalTone(fixtureName, fieldName, text) {
  assert.deepEqual(
    collectToneIssues(text),
    [],
    `${fixtureName}.${fieldName} should keep a historical tone`
  );
}

function collectOrdinaryTurnPolicyIssues(payload) {
  const issues = [];
  const patch = payload?.statePatch || {};
  const playerPatch = patch.player || {};

  for (const key of ORDINARY_TURN_SERVER_OWNED_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      issues.push(key);
    }
  }

  for (const key of ORDINARY_TURN_SERVER_OWNED_PLAYER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(playerPatch, key)) {
      issues.push(`player.${key}`);
    }
  }

  return issues;
}

test("AI eval fixtures parse, validate, and preserve historical tone", () => {
  for (const fixture of VALID_OUTPUT_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);

    assert.equal(validatePayload(fixture.schemaName, payload), payload, fixture.name);

    for (const fieldName of fixture.toneFields) {
      assertHistoricalTone(fixture.name, fieldName, readPath(payload, fieldName));
    }
  }
});

test("AI eval fixtures reject unsafe turn authority claims", () => {
  for (const fixture of UNSAFE_TURN_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);

    assert.throws(
      () => validatePayload("turn", payload),
      /schema validation/,
      fixture.name
    );
  }
});

test("AI eval policy catches schema-valid ordinary turn authority risks", () => {
  for (const fixture of POLICY_RISK_TURN_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);

    assert.equal(validatePayload("turn", payload), payload, fixture.name);
    assert.ok(
      collectOrdinaryTurnPolicyIssues(payload).includes(fixture.expectedIssue),
      fixture.name
    );
  }
});

test("AI eval fixtures verify provider patches are clamped and faction-safe", () => {
  const payload = validatePayload("turn", parseJsonFromText(PATCH_SAFETY_FIXTURE.raw));
  const worldState = createInitialState({ role: "scholar", playerName: "Eval Tester" });

  applyStatePatch(worldState, payload.statePatch);

  assert.equal(worldState.publicOrder, 0);
  assert.equal(worldState.treasury, 10000000);
  assert.equal(worldState.player.academia, 100);
  assert.equal(worldState.player.gold, 0);
  assert.equal(worldState.factions.eunuchs, 100);
  assert.equal(worldState.factions.militaryLords, 0);
  assert.equal(worldState.factions.inventedFaction, undefined);
  assert.equal(worldState.turnCount, 1);
});

test("AI eval fixtures cover grade bounds and local exam penalties", () => {
  for (const fixture of INVALID_GRADE_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);
    assert.throws(() => validatePayload("grade", payload), /schema validation/, fixture.name);
  }

  const validGrade = validatePayload("grade", parseJsonFromText(
    VALID_OUTPUT_FIXTURES.find((fixture) => fixture.name === "grade").raw
  ));
  const worldState = createInitialState({ role: "scholar", playerName: "Eval Tester" });
  const exam = getExam("child_exam");
  const historicalCheck = checkEssayAuthenticity({
    essay: ESSAY_EVAL_FIXTURES.historical,
    exam,
    player: worldState.player
  });
  const anachronisticCheck = checkEssayAuthenticity({
    essay: ESSAY_EVAL_FIXTURES.anachronistic,
    exam,
    player: worldState.player
  });
  const penalized = applyAuthenticityPenalties(validGrade.score, anachronisticCheck, exam);

  assert.equal(historicalCheck.anachronism_detection.has_anachronism, false);
  assert.equal(anachronisticCheck.anachronism_detection.has_anachronism, true);
  assert.ok(anachronisticCheck.flags.some((flag) => flag.type === "too_short"));
  assert.ok(penalized.overall_score < validGrade.score.overall_score);
  assert.ok(penalized.overall_score >= 0);
});

test("AI eval tone heuristic catches modern phrasing fixtures", () => {
  assert.deepEqual(
    collectToneIssues(ESSAY_EVAL_FIXTURES.modernTone),
    ["missing historical anchor", "modern terms: AI, startup, stock market, company"]
  );
});
