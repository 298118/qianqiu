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
  PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES,
  PROMPT_PACK_HIDDEN_LEAK_FIXTURES,
  PROMPT_PACK_OUTPUT_FIXTURES,
  PROMPT_PACK_TONE_RED_TEAM_FIXTURES,
  SERVER_OWNED_TURN_FIXTURES,
  STRICT_JSON_FIXTURES,
  UNSAFE_TURN_FIXTURES,
  VALID_OUTPUT_FIXTURES
} = require("../testdata/aiEvalFixtures");

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

function parseStrictJsonObject(raw) {
  const payload = JSON.parse(String(raw || "").trim());
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("strict JSON output must be a single object");
  }
  return payload;
}

function collectHiddenInfoIssues(payload, hiddenTerms = []) {
  const serialized = JSON.stringify(payload);
  return hiddenTerms.filter((term) => serialized.includes(term));
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

test("S41 prompt-pack output fixtures validate and preserve historical tone", () => {
  const seenPromptPacks = new Set();

  for (const fixture of PROMPT_PACK_OUTPUT_FIXTURES) {
    const payload = parseStrictJsonObject(fixture.raw);

    assert.equal(validatePayload(fixture.schemaName, payload), payload, fixture.name);
    seenPromptPacks.add(fixture.promptPack);

    for (const fieldName of fixture.toneFields) {
      assertHistoricalTone(fixture.name, fieldName, readPath(payload, fieldName));
    }

    if (fixture.promptPack === "exam_grading") {
      assert.deepEqual(payload.virtual_candidates, [], `${fixture.name} should not invent canonical candidates`);
      assert.deepEqual(payload.ranking, [], `${fixture.name} should not invent canonical ranking`);
    }
  }

  assert.deepEqual(
    [...seenPromptPacks].sort(),
    [
      "emperor_court",
      "exam_grading",
      "exam_question",
      "general_frontier",
      "local_magistrate",
      "minister_faction",
      "official_career",
      "opening",
      "world_turn"
    ].sort()
  );
});

test("S41 prompt-pack strict JSON fixtures reject wrappers and non-object roots", () => {
  for (const fixture of STRICT_JSON_FIXTURES.valid) {
    const payload = parseStrictJsonObject(fixture.raw);
    assert.equal(validatePayload(fixture.schemaName, payload), payload, fixture.name);
  }

  for (const fixture of STRICT_JSON_FIXTURES.invalid) {
    assert.throws(
      () => parseStrictJsonObject(fixture.raw),
      /JSON|object/,
      fixture.name
    );
  }
});

test("S41 prompt-pack red-team fixtures catch modern phrasing", () => {
  for (const fixture of PROMPT_PACK_TONE_RED_TEAM_FIXTURES) {
    const payload = validatePayload(fixture.schemaName, parseJsonFromText(fixture.raw));
    const issues = fixture.toneFields.flatMap((fieldName) =>
      collectToneIssues(readPath(payload, fieldName))
    );

    assert.ok(
      issues.some((issue) => issue.startsWith("modern terms")),
      `${fixture.name} should be flagged for modern terms`
    );
  }
});

test("S41 prompt-pack red-team fixtures catch hidden information leakage", () => {
  for (const fixture of PROMPT_PACK_HIDDEN_LEAK_FIXTURES) {
    const payload = validatePayload(fixture.schemaName, parseJsonFromText(fixture.raw));

    assert.deepEqual(
      collectHiddenInfoIssues(payload, fixture.hiddenTerms).sort(),
      fixture.hiddenTerms.sort(),
      fixture.name
    );
  }
});

test("S41 prompt-pack authority fixtures catch overreach beyond schema", () => {
  for (const fixture of PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);

    if (fixture.expected === "schemaReject") {
      assert.throws(
        () => validatePayload(fixture.schemaName, payload),
        /schema validation/,
        fixture.name
      );
      continue;
    }

    if (fixture.expected === "nonEmptyServerRanking") {
      const validated = validatePayload(fixture.schemaName, payload);
      assert.ok(
        validated.virtual_candidates.length || validated.ranking.length,
        `${fixture.name} should represent a server-owned ranking overreach`
      );
      continue;
    }

    assert.fail(`Unhandled prompt-pack authority fixture expectation: ${fixture.expected}`);
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

test("AI eval rejects ordinary turn server-owned field patches", () => {
  for (const fixture of SERVER_OWNED_TURN_FIXTURES) {
    const payload = parseJsonFromText(fixture.raw);

    assert.throws(
      () => validatePayload("turn", payload),
      /schema validation/,
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
