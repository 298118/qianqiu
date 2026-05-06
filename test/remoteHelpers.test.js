const assert = require("assert/strict");
const test = require("node:test");

const { normalizeModelPayload, normalizeProviderStatePatch } = require("../src/ai/providers/remoteHelpers");

test("remote turn payload normalization drops malformed display-only attribute changes", () => {
  const payload = {
    narrative: "你研读经义，塾师颔首。",
    statePatch: { player: { academia: 12 } },
    attributeChanges: [
      { attribute: "academia", delta: 2, reason: "读书" },
      { path: "player.academia", before: 10, after: 12, reason: "读书" }
    ],
    relationshipChanges: [],
    events: ["研读经义。"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };

  assert.deepEqual(normalizeModelPayload("turn", payload).attributeChanges, [
    { path: "player.academia", before: 10, after: 12, reason: "读书" }
  ]);
});

test("remote payload normalization leaves non-turn payloads unchanged", () => {
  const payload = { narrative: "开局", events: [] };
  assert.equal(normalizeModelPayload("opening", payload), payload);
});

test("remote provider state patch normalization drops server-owned and unknown fields", () => {
  assert.deepEqual(
    normalizeProviderStatePatch({
      treasury: 990,
      activeExam: { level: "palace_exam" },
      relationshipLedger: { characters: {} },
      factions: {
        eunuchs: 48,
        invented: "high"
      },
      player: {
        academia: 12,
        examRank: "进士",
        officeTitle: "翰林",
        invented: true
      }
    }),
    {
      treasury: 990,
      factions: { eunuchs: 48 },
      player: { academia: 12 }
    }
  );
});
