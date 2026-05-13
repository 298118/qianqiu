#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const { runAiEvaluation } = require("../src/ai/aiEvaluationRunner");
const {
  PROMPT_PACK_OUTPUT_FIXTURES,
  PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES,
  VALID_OUTPUT_FIXTURES
} = require("../testdata/aiEvalFixtures");

function buildLocalEvalFixtures() {
  const validFixtures = [...VALID_OUTPUT_FIXTURES, ...PROMPT_PACK_OUTPUT_FIXTURES].map((fixture) => ({
    ...fixture,
    taskType: fixture.promptPack === "exam_grading" ? "domain_specialist" : "narrator",
    expected: "schema_valid"
  }));

  const authorityFixtures = PROMPT_PACK_AUTHORITY_RED_TEAM_FIXTURES.map((fixture) => ({
    ...fixture,
    taskType: "safety_gate",
    expected: fixture.expected === "schemaReject" ? "schema_reject" : fixture.expected
  }));

  const reviewerFixture = {
    name: "critic review-only policy",
    taskType: "critic",
    payload: {
      risks: ["案牍证据不足，不能把传闻当事实。"],
      suggestions: ["请补充案牍来源，再交由服务器裁决。"],
      refusalReasons: ["不得直接改写状态或调用 server resolver。"]
    },
    toneFields: ["risks.0", "suggestions.0"],
    expected: "review_only"
  };

  return [...validFixtures, ...authorityFixtures, reviewerFixture];
}

function main() {
  const result = runAiEvaluation({
    fixtures: buildLocalEvalFixtures()
  });
  const printable = {
    ok: result.ok,
    schemaVersion: result.schemaVersion,
    costSummary: result.costSummary,
    fixtureCount: result.fixtureResults.length,
    redTeamFindingCount: result.redTeamFindings.length,
    failures: result.failures
  };

  console.log(JSON.stringify(printable, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildLocalEvalFixtures
};
