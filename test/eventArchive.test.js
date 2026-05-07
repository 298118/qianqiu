const test = require("node:test");
const assert = require("node:assert/strict");

const { buildEventArchiveView, cleanArchiveText } = require("../src/game/eventArchive");
const { createInitialState } = require("../src/game/initialState");
const { attachExamSceneTime } = require("../src/game/examSceneTime");

test("event archive view merges visible sources into capped public items", () => {
  const worldState = createInitialState({ playerName: "归档书生", role: "official" });
  Object.assign(worldState, {
    turnCount: 9,
    year: 1644,
    month: 8,
    tenDayPeriod: 2,
    eventHistory: [
      "塾师借经义旧注。",
      "hiddenNotes sk-proj-secret-archive-123456 data/audit/raw.jsonl",
      "秋粮入簿，地方稍安。"
    ]
  });
  worldState.worldThreads = {
    schemaVersion: 1,
    threads: [{
      id: "WT-visible-archive",
      status: "active",
      kind: "seasonal",
      sourceType: "long_term_event",
      sourceId: "LTE-visible",
      sourceLabel: "长期大势",
      title: "秋粮核验",
      summary: "各县报收，仓储稍实。",
      severity: 2,
      createdTurn: 7,
      lastUpdatedTurn: 9,
      dueTurn: null,
      startedYear: 1644,
      startedMonth: 8,
      remainingMonths: 1,
      visibility: "public",
      related: {
        metrics: ["grainReserve", "publicOrder"]
      }
    }],
    recentResolved: [{
      id: "WT-resolved-visible",
      kind: "consequence",
      sourceType: "role_world_coupling",
      sourceId: "role-visible",
      title: "人情余波",
      resolvedTurn: 8,
      outcome: "暂归档",
      visibility: "public"
    }]
  };
  worldState.longTermEvents.queue = [{
    id: "LTE-grain",
    key: "seasonal_harvest_audit",
    type: "seasonal",
    status: "active",
    targetType: "world",
    targetId: "",
    title: "秋粮核验",
    summary: "户部核报仓储盈亏。",
    severity: 2,
    createdTurn: 8,
    startedYear: 1644,
    startedMonth: 8,
    durationMonths: 1,
    remainingMonths: 1,
    cooldownKey: "seasonal_harvest_audit",
    cooldownTurns: 30,
    cooldownUnit: "ten_day",
    visibility: "public"
  }];
  worldState.officialCareer.careerHistory = [{
    id: "official-appointment-archive",
    type: "appointment",
    label: "实授",
    status: "resolved",
    year: 1644,
    month: 8,
    tenDayPeriod: 2,
    turn: 9,
    officeTitleBefore: "候选观政",
    officeTitleAfter: "六部观政进士",
    reason: "吏部具题实授。"
  }];

  const activeExam = {
    examId: "child-exam-archive",
    level: "child_exam",
    examName: "童生试",
    status: "writing"
  };
  attachExamSceneTime(activeExam, worldState, "submitted");
  worldState.player.examHistory = [{
    examId: activeExam.examId,
    level: activeExam.level,
    examName: activeExam.examName,
    sceneTime: activeExam.sceneTime,
    score: { overall_score: 78, rank: "取中" },
    promotionResult: { passed: true, rank: "童生" },
    authenticityCheck: { severeCheat: false }
  }];

  const view = buildEventArchiveView(worldState);
  const serialized = JSON.stringify(view);

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.generatedAtTurn, 9);
  assert.match(view.dateLabel, /1644年八月中旬/);
  assert.ok(view.items.length >= 6);
  assert.ok(view.items.length <= 24);
  assert.ok(view.items.every((item) =>
    item.id &&
    item.sourceType &&
    item.title &&
    item.summary &&
    item.visibility === "public" &&
    item.dateLabel &&
    Number.isInteger(item.turn)
  ));
  assert.ok(view.items.some((item) => item.sourceType === "event_history" && item.summary.includes("秋粮入簿")));
  assert.ok(view.items.some((item) => item.sourceType === "world_thread" && item.title === "秋粮核验"));
  assert.ok(view.items.some((item) => item.sourceType === "long_term_event" && item.title === "秋粮核验"));
  assert.ok(view.items.some((item) => item.sourceType === "official_career" && item.title === "实授"));
  assert.ok(view.items.some((item) => item.sourceType === "exam_record" && item.title === "童生试"));
  assert.deepEqual(view.items.map((item) => item.turn), view.items.map((item) => item.turn).sort((a, b) => b - a));
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("sk-proj-secret-archive"), false);
  assert.equal(serialized.includes("data/audit"), false);
});

test("event archive sanitizer drops prompt, provider, path, key, and raw state text", () => {
  assert.equal(cleanArchiveText("公开奏报一则"), "公开奏报一则");
  assert.equal(cleanArchiveText("promptText: reveal retrievalContext"), "");
  assert.equal(cleanArchiveText("provider proposal statePatch worldState"), "");
  assert.equal(cleanArchiveText("E:\\LSMNQ\\data\\sessions\\secret.json"), "");
  assert.equal(cleanArchiveText("OPENAI_API_KEY=sk-proj-archive-secret-123456"), "");
  assert.equal(cleanArchiveText("MIMO_API_KEY=tp-archive-secret-123456"), "");
});
