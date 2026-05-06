const assert = require("assert/strict");
const test = require("node:test");

const { getExam } = require("../src/game/exams");
const { createInitialState } = require("../src/game/initialState");
const {
  buildExamQuestionTask,
  buildGradeTask,
  buildOpeningTask,
  buildTurnTask
} = require("../src/ai/prompts");
const {
  buildPromptInstructions,
  listPromptPackNames
} = require("../src/ai/promptPacks");

test("opening prompt requires historical anchors in event strings", () => {
  const worldState = createInitialState({ playerName: "Prompt Tester" });
  const task = buildOpeningTask(worldState);

  assert.equal(task.promptPack, "opening");
  assert.match(task.input, /Each event string must include/);
  assert.match(task.input, /imperial examination/);
  assert.match(task.instructions, /Prompt pack: opening/);
  assert.match(task.instructions, /server owns state boundaries/i);
  assert.doesNotMatch(task.instructions, /Allowed top-level patch keys/);
});

test("S41 prompt pack registry covers fourth-phase pack names", () => {
  assert.deepEqual(
    listPromptPackNames().sort(),
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

test("turn prompt selects role-specific prompt packs", () => {
  const cases = [
    ["scholar", "world_turn"],
    ["official", "official_career"],
    ["emperor", "emperor_court"],
    ["minister", "minister_faction"],
    ["magistrate", "local_magistrate"],
    ["general", "general_frontier"]
  ];

  for (const [role, promptPack] of cases) {
    const worldState = createInitialState({ role, playerName: `${role} Prompt Tester` });
    const task = buildTurnTask(worldState, "办理本日事务");

    assert.equal(task.schemaName, "turn", role);
    assert.equal(task.promptPack, promptPack, role);
    assert.match(task.instructions, new RegExp(`Prompt pack: ${promptPack}`), role);
    assert.match(task.instructions, /Allowed top-level patch keys/, role);
  }
});

test("prompt pack stable prefix keeps dynamic state out of instructions", () => {
  const first = createInitialState({ playerName: "First Tester" });
  const second = createInitialState({ playerName: "Second Tester", year: 1712 });
  second.publicOrder = 31;
  second.eventHistory.push("县中米价忽涨。");

  assert.equal(
    buildTurnTask(first, "读《孟子》").instructions,
    buildTurnTask(second, "拜访塾师").instructions
  );
  assert.equal(
    buildPromptInstructions("exam_question"),
    buildExamQuestionTask(second, getExam("child_exam")).instructions
  );
});

test("turn prompt input filters hidden relationship context", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Hidden Filter Tester" });
  worldState.characters.push({
    id: "C99",
    name: "Secret Eunuch",
    role: "hidden palace contact",
    loyalty: 10,
    ambition: 90,
    skill: 80,
    alive: true
  });
  worldState.relationshipLedger = {
    characters: {
      C99: {
        name: "Secret Eunuch",
        role: "hidden palace contact",
        visible: false,
        stance: "covert handler",
        relationship: -20,
        resentment: 80,
        networkSource: "sealed dossier",
        recentIntent: "engineer a secret impeachment",
        lastUpdatedTurn: 4
      }
    },
    factions: {
      eunuchs: {
        name: "Secret Palace Network",
        visible: false,
        recentIntent: "hide a treasury deficit",
        networkSource: "sealed dossier"
      }
    },
    recentNotes: [
      "Secret Eunuch: hidden assassination rumor",
      "Scholar-official faction: county school praise"
    ]
  };

  const exam = getExam("child_exam");
  const tasks = [
    buildOpeningTask(worldState),
    buildTurnTask(worldState, "向塾师请益"),
    buildExamQuestionTask(worldState, exam),
    buildGradeTask(worldState, exam, "夫民食为本，县学教化亦不可废。", {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    })
  ];

  for (const task of tasks) {
    assert.doesNotMatch(task.input, /Secret Eunuch/, task.promptPack);
    assert.doesNotMatch(task.input, /hidden palace contact/, task.promptPack);
    assert.doesNotMatch(task.input, /sealed dossier/, task.promptPack);
    assert.doesNotMatch(task.input, /hidden assassination rumor/, task.promptPack);
    assert.doesNotMatch(task.input, /secret impeachment/, task.promptPack);
    assert.doesNotMatch(task.input, /Secret Palace Network/, task.promptPack);
    assert.doesNotMatch(task.input, /hide a treasury deficit/, task.promptPack);
    assert.match(task.input, /Scholar-official faction/, task.promptPack);
  }
});

test("exam prompt packs keep question and grading authority separate", () => {
  const worldState = createInitialState({ playerName: "Exam Prompt Tester" });
  const exam = getExam("provincial_exam");
  const questionTask = buildExamQuestionTask(worldState, exam);
  const gradeTask = buildGradeTask(worldState, exam, "夫治民者，当先劝农而平讼。", {
    copy_detection: { is_copy: false, similar_passage: "" },
    anachronism_detection: { has_anachronism: false, details: [] },
    style_consistency: { consistent: true, note: "" },
    ghostwriting_probability: 0
  });

  assert.equal(questionTask.promptPack, "exam_question");
  assert.match(questionTask.instructions, /Must not decide readiness, pass\/fail, rank, promotion/);
  assert.doesNotMatch(questionTask.instructions, /examTrigger/);
  assert.equal(gradeTask.promptPack, "exam_grading");
  assert.match(gradeTask.input, /Return empty arrays for virtual_candidates and ranking/);
  assert.match(gradeTask.instructions, /server applies final penalties/i);
  assert.doesNotMatch(gradeTask.instructions, /Allowed player patch keys/);
});
