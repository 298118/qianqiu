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

test("remote turn payload normalization drops malformed relationship suggestions", () => {
  const payload = {
    narrative: "你拜见座师，言辞谨慎。",
    statePatch: { player: { reputation: 11 } },
    attributeChanges: [],
    relationshipChanges: [
      {
        targetType: "character",
        targetId: " C01 ",
        relationshipDelta: 16,
        resentmentDelta: -12,
        stance: "赏识",
        recentIntent: "观察后续文章",
        note: "座师略有嘉许。",
        reason: "拜见座师",
        invented: true
      },
      { targetType: "npc", targetId: "C02", relationshipDelta: 2, resentmentDelta: 0, reason: "非法类型" },
      { targetType: "faction", targetId: "", relationshipDelta: 2, resentmentDelta: 0, reason: "空目标" },
      { targetType: "faction", targetId: "scholarOfficials", relationshipDelta: "2", resentmentDelta: 0, reason: "非数值" },
      { targetType: "faction", targetId: "eunuchs", relationshipDelta: 1, resentmentDelta: 0 }
    ],
    events: ["拜见座师。"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };

  assert.deepEqual(normalizeModelPayload("turn", payload).relationshipChanges, [
    {
      targetType: "character",
      targetId: "C01",
      relationshipDelta: 12,
      resentmentDelta: -10,
      stance: "赏识",
      recentIntent: "观察后续文章",
      note: "座师略有嘉许。",
      reason: "拜见座师"
    }
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
      turnCount: 99,
      year: 1700,
      month: 9,
      tenDayPeriod: 3,
      activeExam: { level: "palace_exam" },
      officialPostings: { postings: [{ id: "provider-forged-posting", officeId: "ministry_revenue_principal" }] },
      worldGeography: { countries: [{ id: "provider-forged-country", name: "伪地理" }] },
      worldEntities: { entities: [{ id: "provider-forged-entity", name: "伪实体" }] },
      worldPeople: { npcs: [{ id: "provider-forged-npc", name: "伪人物" }] },
      worldThreads: { threads: [{ id: "provider-forged", title: "伪议题" }] },
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
