const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertNoUnsafeVisibleText,
  buildPassingEssay,
  runMockImperialExamAcceptance
} = require("../scripts/mockImperialExamAcceptance");

test("S69.5 mock acceptance essay fixtures cover every exam level", () => {
  assert.ok(buildPassingEssay("child_exam").length >= 250);
  assert.ok(buildPassingEssay("provincial_exam").length >= 500);
  assert.ok(buildPassingEssay("metropolitan_exam").length >= 700);
  assert.ok(buildPassingEssay("palace_exam").length >= 700);
  assert.equal(buildPassingEssay("palace_exam").includes("AI"), false);
});

test("S69.5 mock acceptance hidden text guard catches unsafe public text", () => {
  assert.doesNotThrow(() => assertNoUnsafeVisibleText("safe", { text: "县学士子论钱粮。" }));
  assert.throws(
    () => assertNoUnsafeVisibleText("unsafe", {
      visibleKeyNameIsAllowed: "县学士子论钱粮。",
      text: "hiddenNotes statePatch appointmentTrack tp-secret-token data/sessions/x.json E:\\LSMNQ\\data\\audit\\x.jsonl"
    }),
    /leaked hidden\/raw\/provider\/token text/
  );
});

test("S69.5 mock acceptance completes deterministic scholar path", async () => {
  const result = await runMockImperialExamAcceptance();

  assert.equal(result.finalRole, "official");
  assert.ok(result.finalOfficeTitle);
  assert.deepEqual(result.completedLevels, [
    "child_exam",
    "provincial_exam",
    "metropolitan_exam",
    "palace_exam"
  ]);
  assert.equal(result.results.length, 4);
  assert.ok(result.results.every((item) => item.networkContacts >= 1));
  assert.ok(result.results.at(-1).appointment);
});
