const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildExamAftermathView,
  buildLatestExamAftermathView,
  sanitizeExamAftermathView
} = require("../src/game/examAftermath");
const { createInitialState } = require("../src/game/initialState");

test("exam aftermath view summarizes ranking, network, appointment and next actions safely", () => {
  const worldState = createInitialState({ playerName: "顾衡", role: "scholar" });
  worldState.turnCount = 8;
  worldState.officialCareer = {
    assignments: [{ title: "翰林院讲章初稿" }]
  };

  const view = buildExamAftermathView(worldState, {
    activeExam: { level: "palace_exam", examName: "殿试" },
    exam: { level: "palace_exam", name: "殿试" },
    ranking: [{ id: "player", isPlayer: true, place: 1, rankLabel: "一甲第一名", honorTitle: "状元", score: 96 }],
    score: { overall_score: 96 },
    promotionResult: { passed: true, rank: "进士", officeTitle: "翰林院修撰" },
    examHonor: { currentHonor: { title: "状元" } },
    examNetwork: {
      sameYearContacts: [{ id: "peer-1", name: "沈同年", role: "同年进士", stance: "同年声援", relationship: 18, publicSummary: "沈同年可公开往来。" }],
      examinerContacts: [{ id: "reader-1", name: "许读卷官", role: "殿试读卷官", relationKind: "palace_reader", stance: "读卷赏识", relationship: 20, publicSummary: "许读卷官公开赏识。" }]
    },
    appointmentTrack: { latestDecision: { officeTitle: "翰林院修撰" } }
  });

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.passed, true);
  assert.equal(view.honorTitle, "状元");
  assert.equal(view.officeTitle, "翰林院修撰");
  assert.equal(view.sameYearContacts[0].name, "沈同年");
  assert.equal(view.examinerContacts[0].name, "许读卷官");
  assert.ok(view.nextActions.some((action) => /首月差事|讲章初稿|翰林院修撰/.test(action)));
  assert.match(view.authorityBoundary, /AI 与前端不能/);
});

test("exam aftermath sanitizer drops polluted legacy text and forbidden keys", () => {
  const view = sanitizeExamAftermathView({
    level: "provincial_exam",
    examName: "乡试",
    passed: true,
    score: 88,
    rankLabel: "乡试第一名",
    honorTitle: "解元",
    source: "provider",
    publicSummary: "provider payload statePatch rawProvider sk-aftermath-secret /mnt/e/session data/sessions/legacy.json",
    hiddenNotes: "SEALED_AFTER",
    providerPayload: { ok: true },
    sameYearContacts: [{
      id: "peer-1",
      name: "provider",
      role: "乡试同年",
      relationKind: "statePatch relation",
      stance: "provider payload",
      publicSummary: "prompt /home/secret"
    }],
    examinerContacts: [{
      id: "exam-seat-provincial",
      name: "冯主考",
      role: "乡试主考座师",
      stance: "座师门生",
      publicSummary: "公开取中。"
    }],
    nextActions: ["statePatch action", "data/sessions/legacy.json", "具帖拜会座师。"]
  });
  const serialized = JSON.stringify(view);

  assert.equal(view.source, "server_exam_aftermath");
  assert.equal(view.publicSummary, "放榜后过渡由服务器整理。");
  assert.equal(view.sameYearContacts[0].name, "同年");
  assert.equal(view.sameYearContacts[0].relationKind, "same_year");
  assert.equal(view.sameYearContacts[0].stance, "同年往来");
  assert.deepEqual(view.nextActions, ["具帖拜会座师。"]);
  assert.doesNotMatch(serialized, /hiddenNotes|providerPayload|provider|statePatch|rawProvider|prompt|sk-aftermath-secret|data\/sessions|\/mnt\/|\/home\//);
});

test("latest exam aftermath view derives from legacy exam history when snapshot is missing", () => {
  const worldState = createInitialState({ playerName: "顾衡", role: "scholar" });
  worldState.player.examHistory = [{
    level: "provincial_exam",
    examName: "乡试",
    score: { overall_score: 91 },
    promotionResult: { passed: true, rank: "举人" },
    ranking: [{ id: "player", isPlayer: true, place: 1, rankLabel: "乡试第一名", honorTitle: "解元", score: 91 }],
    examHonor: { currentHonor: { title: "解元" } },
    examNetwork: {
      sameYearContacts: [{ id: "peer-1", name: "沈同年", role: "乡试同年", stance: "同年声援", relationship: 18, publicSummary: "沈同年为乡试同年。" }],
      examinerContacts: [{ id: "exam-seat-provincial", name: "冯主考", role: "乡试主考座师", relationKind: "seat_teacher", stance: "座师门生", relationship: 22, publicSummary: "冯主考取中。" }]
    }
  }];

  const view = buildLatestExamAftermathView(worldState);

  assert.equal(view.examName, "乡试");
  assert.equal(view.honorTitle, "解元");
  assert.equal(view.sameYearCount, 1);
  assert.equal(view.examinerCount, 1);
  assert.ok(view.nextActions.some((action) => /会试|座师/.test(action)));
});
