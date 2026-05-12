const test = require("node:test");
const assert = require("node:assert/strict");

const { getExam } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const { buildEventArchiveView } = require("../src/game/eventArchive");
const {
  buildRelationshipInspectionView
} = require("../src/game/relationships");
const { buildWorldPeopleView } = require("../src/game/worldPeople");
const {
  normalizeNetworkSnapshot,
  resolveExamNetwork,
  summarizeExamNetworkForPrompt
} = require("../src/game/examNetworks");

function rankingEntry(id, place, score = 88, isPlayer = false) {
  return {
    id,
    name: isPlayer ? "玩家" : `同年${place}`,
    origin: "应天府",
    background: "同场士子",
    score,
    rank: "取中",
    place,
    isPlayer,
    rankLabel: `第${place}名`
  };
}

test("exam network resolver creates visible same-year and examiner relationships from canonical ranking", () => {
  const worldState = createInitialState({ playerName: "同年测试", role: "scholar" });
  worldState.turnCount = 6;
  const exam = getExam("provincial_exam");
  const ranking = [
    rankingEntry("player", 1, 96, true),
    rankingEntry("rival-001", 2, 84),
    rankingEntry("rival-002", 3, 78)
  ];

  const snapshot = resolveExamNetwork({
    worldState,
    activeExam: { level: exam.level, examName: exam.name },
    exam,
    ranking,
    promotionResult: { passed: true, rank: "举人" },
    examHonor: { currentHonor: { title: "解元" } }
  });
  worldState.player.examHistory.push({
    level: exam.level,
    examName: exam.name,
    score: { overall_score: 96, rank: "一等" },
    promotionResult: { passed: true, rank: "举人" },
    examNetwork: snapshot
  });

  const relationshipView = buildRelationshipInspectionView(worldState);
  const worldPeopleView = buildWorldPeopleView(worldState);
  const archive = buildEventArchiveView(worldState, { pageSize: 50 });
  const promptSummary = summarizeExamNetworkForPrompt(worldState);
  const serialized = JSON.stringify({ snapshot, relationshipView, worldPeopleView, archive, promptSummary });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sameYearContacts.length, 2);
  assert.ok(snapshot.examinerContacts.some((contact) => contact.relationKind === "seat_teacher"));
  assert.ok(relationshipView.contacts.some((contact) =>
    contact.id === "exam-seat-provincial" &&
    contact.name === "冯主考" &&
    contact.networkSource === "乡试主考取中"
  ));
  assert.ok(relationshipView.contacts.some((contact) => contact.id === "exam-peer-provincial_exam-rival-001"));
  assert.ok(worldPeopleView.npcs.some((npc) => npc.id === "exam-seat-provincial" && npc.rankLabel === "乡试主考座师"));
  assert.ok(worldPeopleView.relationships.some((relationship) =>
    relationship.targetId === "exam-seat-provincial" &&
    relationship.publicSummary.includes("冯主考")
  ));
  assert.ok(archive.items.some((item) =>
    item.sourceType === "exam_network" &&
    item.summary.includes("定榜顺序")
  ));
  assert.equal(promptSummary.examinerContacts.some((contact) => contact.name === "冯主考"), true);
  assert.doesNotMatch(serialized, /hiddenNotes|provider proposal|raw audit|promptText|sk-/);
});

test("failed exam network snapshot does not invent durable contacts", () => {
  const worldState = createInitialState({ playerName: "落第同年", role: "scholar" });
  const exam = getExam("provincial_exam");
  const beforeCharacters = worldState.characters.length;

  const snapshot = resolveExamNetwork({
    worldState,
    activeExam: { level: exam.level, examName: exam.name },
    exam,
    ranking: [rankingEntry("player", 4, 55, true)],
    promotionResult: { passed: false, rank: null },
    examHonor: null
  });
  const normalized = normalizeNetworkSnapshot(snapshot);

  assert.equal(normalized.sameYearContacts.length, 0);
  assert.equal(normalized.examinerContacts.length, 0);
  assert.equal(worldState.characters.length, beforeCharacters);
  assert.match(normalized.publicSummary, /未取中/);
});
