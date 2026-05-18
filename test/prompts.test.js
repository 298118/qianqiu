const assert = require("assert/strict");
const test = require("node:test");

const { getExam } = require("../src/game/exams");
const { runActiveNpcRequestStep } = require("../src/game/activeRequests");
const { createInitialState } = require("../src/game/initialState");
const {
  buildExamQuestionTask,
  buildGradeTask,
  buildOpeningTask,
  buildQuickActionTask,
  buildTurnTask
} = require("../src/ai/prompts");
const {
  buildPromptCacheStablePrefix,
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
      "quick_action",
      "world_turn"
    ].sort()
  );
});

test("S75.9 quick action prompt is draft-only and hidden-safe", () => {
  const task = buildQuickActionTask({
    schemaVersion: "s75.9-quick-actions.v1",
    page: "game",
    requestedCount: 3,
    draftPreview: "",
    player: { name: "顾澄", role: "scholar", examRank: "童生" },
    routeViewFlags: { hasPublicEvidence: false, hasExamContext: true },
    toolCapabilities: [{ group: "exam", toolIntent: "exam", boundary: "只可生成行动草稿；工具执行由服务器处理。" }],
    evidenceRefs: []
  });

  assert.equal(task.promptPack, "quick_action");
  assert.equal(task.schemaName, "quickAction");
  assert.match(task.instructions, /Prompt pack: quick_action/);
  assert.match(task.instructions, /May propose draft text only/);
  assert.doesNotMatch(task.instructions, /Allowed top-level patch keys/);
  assert.match(task.input, /The browser will only copy one suggestion into the action textarea/);
  assert.doesNotMatch(task.input, /statePatch|canonical state/);
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

test("S47 prompt cache prefix is byte-stable before pack-specific text", () => {
  const turnPrefix = buildPromptCacheStablePrefix("world_turn");
  const officialPrefix = buildPromptCacheStablePrefix("official_career");
  const openingPrefix = buildPromptCacheStablePrefix("opening");
  const questionPrefix = buildPromptCacheStablePrefix("exam_question");

  assert.equal(turnPrefix, officialPrefix);
  assert.equal(openingPrefix, questionPrefix);
  assert.notEqual(turnPrefix, openingPrefix);
  assert.match(turnPrefix, /The server owns state boundaries/);
  assert.match(turnPrefix, /Allowed top-level patch keys/);
  assert.doesNotMatch(openingPrefix, /Allowed top-level patch keys/);

  assert.ok(
    buildPromptInstructions("world_turn").startsWith(`${turnPrefix}\n\nPrompt pack: world_turn`)
  );
  assert.ok(
    buildPromptInstructions("opening").startsWith(`${openingPrefix}\n\nPrompt pack: opening`)
  );
});

test("S47 prompt instructions keep dynamic task payloads outside the stable prefix", () => {
  const worldState = createInitialState({ playerName: "S47 Cache Name", year: 1712 });
  worldState.month = 9;
  worldState.tenDayPeriod = 3;
  worldState.eventHistory.push("S47_DYNAMIC_EVENT_县学米价忽涨。");
  worldState.setup = { note: "S47_DYNAMIC_SETUP_NOTE" };
  const exam = getExam("child_exam");
  const authenticityCheck = {
    copy_detection: { is_copy: false, similar_passage: "S47_DYNAMIC_COPY_NOTE" },
    anachronism_detection: { has_anachronism: false, details: ["S47_DYNAMIC_AUTH_NOTE"] },
    style_consistency: { consistent: true, note: "S47_DYNAMIC_STYLE_NOTE" },
    ghostwriting_probability: 0
  };
  const action = "S47_DYNAMIC_ACTION_拜访塾师";
  const essay = "S47_DYNAMIC_ESSAY_夫民食为本，县学教化亦不可废。";
  const tasks = [
    buildOpeningTask(worldState),
    buildTurnTask(worldState, action),
    buildExamQuestionTask(worldState, exam),
    buildGradeTask(worldState, exam, essay, authenticityCheck)
  ];
  const dynamicPattern = /S47 Cache Name|1712|S47_DYNAMIC_EVENT|S47_DYNAMIC_SETUP_NOTE|S47_DYNAMIC_ACTION|S47_DYNAMIC_ESSAY|S47_DYNAMIC_COPY_NOTE|S47_DYNAMIC_AUTH_NOTE|S47_DYNAMIC_STYLE_NOTE|下旬/;

  for (const task of tasks) {
    assert.doesNotMatch(task.instructions, dynamicPattern, task.promptPack);
    assert.doesNotMatch(
      buildPromptCacheStablePrefix(task.promptPack),
      dynamicPattern,
      task.promptPack
    );
  }

  assert.match(buildOpeningTask(worldState).input, /S47 Cache Name/);
  assert.match(buildOpeningTask(worldState).input, /"tenDayPeriod": 3/);
  assert.match(buildOpeningTask(worldState).input, /1712年九月下旬/);
  assert.match(buildTurnTask(worldState, action).input, /S47_DYNAMIC_ACTION/);
  assert.match(buildGradeTask(worldState, exam, essay, authenticityCheck).input, /S47_DYNAMIC_ESSAY/);
});

test("turn prompt recent events use sanitized event archive projection", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Prompt Archive Tester" });
  worldState.turnCount = 12;
  worldState.eventHistory.push(
    "AI_PROMPT_LEAK prompt provider proposal event_log data/audit/session sk-proj-prompt-secret-123456"
  );
  worldState.eventHistory.push("县学外闻米价回稳，士子相约修课。");

  const task = buildTurnTask(worldState, "查问近事");

  assert.match(task.input, /"recentEvents"/);
  assert.match(task.input, /eventArchiveView/);
  assert.match(task.input, /县学外闻米价回稳/);
  assert.doesNotMatch(task.input, /AI_PROMPT_LEAK/);
  assert.doesNotMatch(task.input, /sk-proj-prompt-secret/);
  assert.doesNotMatch(task.input, /event_log/);
  assert.doesNotMatch(task.input, /data\/audit/);
});

test("turn prompt redacts polluted player teacher text", () => {
  const worldState = createInitialState({ playerName: "Prompt Teacher Tester" });
  worldState.player.teacher = "hidden prompt sk-teacher-prompt-secret";

  const task = buildTurnTask(worldState, "拜访老师");

  assert.doesNotMatch(task.input, /hidden prompt|sk-teacher-prompt-secret/);
  assert.doesNotMatch(task.input, /"player":\s*\{[\s\S]*"teacher":/);
  assert.match(task.input, /"studyProfile"/);
  assert.match(task.input, /"examHonors"/);
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

test("turn prompt input includes visible world people bridge without hidden targets", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "People Prompt Tester" });
  worldState.turnCount = 1;
  runActiveNpcRequestStep(worldState, "研读经书");

  const task = buildTurnTask(worldState, "答应塾师请托");

  assert.match(task.input, /worldPeople/);
  assert.match(task.input, /顾文衡/);
  assert.match(task.input, /当前请托/);
  assert.doesNotMatch(task.input, /Eunuch faction/);
  assert.doesNotMatch(task.input, /Military faction/);
});

test("turn prompt input includes only visible world thread summaries", () => {
  const worldState = createInitialState({ role: "official", playerName: "Thread Prompt Tester" });
  worldState.worldThreads = {
    schemaVersion: 1,
    threads: [
      {
        id: "WT-visible",
        status: "active",
        kind: "official_assignment",
        sourceType: "official_assignment",
        sourceId: "ASG-visible",
        sourceLabel: "官场差遣",
        title: "赈银核销",
        summary: "赈务牵连钱粮与民心。",
        severity: 2,
        createdTurn: 1,
        lastUpdatedTurn: 1,
        dueTurn: 4,
        visibility: "public",
        related: { characters: [], factions: ["scholarOfficials"], offices: ["ministry_revenue"], metrics: ["grainReserve"] }
      },
      {
        id: "WT-hidden",
        status: "active",
        kind: "faction_conflict",
        sourceType: "faction_pressure",
        sourceId: "hidden",
        sourceLabel: "朝局派系",
        title: "Hidden Palace Thread",
        summary: "sealed impeachment dossier",
        severity: 3,
        createdTurn: 1,
        lastUpdatedTurn: 1,
        visibility: "hidden",
        related: { characters: ["C99-hidden"], factions: ["eunuchs"], offices: [], metrics: [] }
      }
    ],
    recentResolved: []
  };

  const task = buildTurnTask(worldState, "核查赈册");

  assert.match(task.input, /赈银核销/);
  assert.match(task.input, /worldThreads/);
  assert.doesNotMatch(task.input, /Hidden Palace Thread/);
  assert.doesNotMatch(task.input, /sealed impeachment dossier/);
  assert.doesNotMatch(task.input, /C99-hidden/);
});

test("turn prompt input includes only visible world entity summaries", () => {
  const worldState = createInitialState({ role: "official", playerName: "Entity Prompt Tester" });
  worldState.worldEntities.entities.push(
    {
      id: "visible-relief",
      category: "relief",
      kind: "relief_operation",
      name: "赈务公册",
      status: "critical",
      visibility: "public",
      metrics: { influence: 70, pressure: 98, capacity: 18, trust: 32, deficit: 96 },
      publicSummary: "赈务牵连粮储、民心与户部核销。",
      related: { offices: ["ministry_revenue"], metrics: ["grainReserve", "publicOrder"] },
      interventionHints: ["开仓赈济", "查赈册"]
    },
    {
      id: "hidden-relief",
      category: "relief",
      kind: "relief_operation",
      name: "Hidden Relief Ledger",
      status: "critical",
      visibility: "hidden",
      metrics: { influence: 90, pressure: 99, capacity: 10, trust: 5, deficit: 99 },
      publicSummary: "SEALED_RELIEF_SUMMARY",
      hiddenNotes: ["SEALED_ENTITY_NOTE"],
      interventionHints: ["do not reveal"]
    }
  );

  const task = buildTurnTask(worldState, "核查赈册");

  assert.match(task.input, /worldEntities/);
  assert.match(task.input, /赈务公册/);
  assert.match(task.input, /赈务牵连粮储/);
  assert.doesNotMatch(task.input, /Hidden Relief Ledger/);
  assert.doesNotMatch(task.input, /SEALED_RELIEF_SUMMARY/);
  assert.doesNotMatch(task.input, /SEALED_ENTITY_NOTE/);
});

test("prompt input includes capped visible world geography without hidden rows", () => {
  const worldState = createInitialState({ role: "official", playerName: "Geography Prompt Tester" });
  worldState.worldGeography.frontierZones.push({
    id: "frontier-hidden-prompt",
    name: "Hidden Geography Frontier",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-beijing"],
    routeIds: [],
    status: "contested",
    pressureMetric: "borderThreat",
    visibility: "hidden",
    publicSummary: "SEALED_GEOGRAPHY_SUMMARY",
    hiddenNotes: ["SEALED_GEOGRAPHY_NOTE"]
  });
  const exam = getExam("child_exam");
  const tasks = [
    buildOpeningTask(worldState),
    buildTurnTask(worldState, "查问山海关与漕运消息"),
    buildExamQuestionTask(worldState, exam),
    buildGradeTask(worldState, exam, "夫民食为本，县学教化亦不可废。", {
      copy_detection: { is_copy: false, similar_passage: "" },
      anachronism_detection: { has_anachronism: false, details: [] },
      style_consistency: { consistent: true, note: "" },
      ghostwriting_probability: 0
    })
  ];

  for (const task of tasks) {
    assert.match(task.input, /worldGeography/, task.promptPack);
    assert.match(task.input, /country-ming|北京|山海关/, task.promptPack);
    assert.doesNotMatch(task.input, /Hidden Geography Frontier/, task.promptPack);
    assert.doesNotMatch(task.input, /SEALED_GEOGRAPHY_SUMMARY/, task.promptPack);
    assert.doesNotMatch(task.input, /SEALED_GEOGRAPHY_NOTE/, task.promptPack);
  }
});

test("prompt input includes visible official postings without hidden geography refs", () => {
  const worldState = createInitialState({ role: "official", playerName: "Posting Prompt Tester" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  Object.assign(worldState, {
    turnCount: 5,
    taxRate: 68,
    grainReserve: 180,
    population: 6200,
    publicOrder: 24,
    corruption: 88,
    borderThreat: 80,
    armyMorale: 30
  });
  worldState.officialPostings.cityJurisdictions.push({
    id: "jurisdiction-hidden-prompt-posting",
    name: "Hidden Posting Prompt Jurisdiction",
    bureauId: "ministry_revenue",
    cityId: "city-hidden-prompt-posting",
    regionId: "region-north-zhili",
    countryId: "country-ming",
    routeIds: ["route-hidden-liaodong-smuggling"],
    frontierZoneIds: ["frontier-hidden-palace-intel"],
    visibility: "public",
    publicSummary: "SEALED_PROMPT_POSTING_JURISDICTION"
  });

  const task = buildTurnTask(worldState, "核查户部漕粮任所");

  assert.match(task.input, /officialPostings/);
  assert.match(task.input, /ministry_revenue_principal|户部/);
  assert.match(task.input, /city-beijing|北京/);
  assert.match(task.input, /任所奏报/);
  assert.match(task.input, /税基偏薄|粮储吃紧|市价承压|士绅势重/);
  assert.doesNotMatch(task.input, /jurisdiction-hidden-prompt-posting/);
  assert.doesNotMatch(task.input, /city-hidden-prompt-posting/);
  assert.doesNotMatch(task.input, /route-hidden-liaodong-smuggling/);
  assert.doesNotMatch(task.input, /frontier-hidden-palace-intel/);
  assert.doesNotMatch(task.input, /SEALED_PROMPT_POSTING_JURISDICTION/);
});

test("turn prompt input includes visible local affairs dockets for magistrate only", () => {
  const magistrateState = createInitialState({ role: "magistrate", playerName: "案牍 Prompt Tester" });
  Object.assign(magistrateState.player, {
    pendingLawsuits: 82,
    waterworks: 24,
    banditPressure: 86
  });
  const scholarState = createInitialState({ role: "scholar", playerName: "无案牍 Prompt Tester" });

  const magistrateTask = buildTurnTask(magistrateState, "审理积案并查修水利");
  const scholarTask = buildTurnTask(scholarState, "在县学听闻积案与水利");

  assert.match(magistrateTask.input, /localAffairsDockets/);
  assert.match(magistrateTask.input, /localAffairsDocketView/);
  assert.match(magistrateTask.input, /刑名|水利|盗匪|任所收束/);
  assert.match(magistrateTask.input, /服务器裁决/);
  assert.match(scholarTask.input, /localAffairsDockets/);
  assert.doesNotMatch(scholarTask.input, /钱粮奏销|刑名词讼|水利修防|任所收束/);
});

test("turn prompt input includes visible S64 military diplomacy reports for general only", () => {
  const generalState = createInitialState({ role: "general", playerName: "军务 Prompt Tester" });
  Object.assign(generalState, {
    borderThreat: 88,
    armyMorale: 34,
    grainReserve: 240,
    population: 7000
  });
  generalState.worldGeography.frontierZones.push({
    id: "frontier-hidden-prompt-s64",
    name: "SEALED_S64_PROMPT_FRONTIER",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-beijing"],
    routeIds: ["route-shanhai-liaodong-pass"],
    pressure: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_PROMPT_FRONTIER prompt provider event_log sk-test-s64-prompt"
  });
  const scholarState = createInitialState({ role: "scholar", playerName: "无军务 Prompt Tester" });

  const generalTask = buildTurnTask(generalState, "查问山海关粮道、驻军和邻国使节");
  const scholarTask = buildTurnTask(scholarState, "在县学听闻边报");

  assert.match(generalTask.input, /militaryDiplomacy/);
  assert.match(generalTask.input, /militaryDiplomacyView/);
  assert.match(generalTask.input, /军务|粮道|使节|服务器裁决/);
  assert.doesNotMatch(generalTask.input, /SEALED_S64_PROMPT/);
  assert.doesNotMatch(generalTask.input, /sk-test-s64-prompt|event_log/);
  assert.match(scholarTask.input, /militaryDiplomacy/);
  assert.doesNotMatch(scholarTask.input, /military-theater-|military-incident-|驻军|使节往来/);
});

test("turn prompt input includes visible S64.2 economic fiscal reports for officials only", () => {
  const officialState = createInitialState({ role: "official", playerName: "财赋 Prompt Tester" });
  Object.assign(officialState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88
  });
  officialState.worldGeography.routes.push({
    id: "route-hidden-prompt-s64-2",
    type: "canal",
    name: "SEALED_S64_2_PROMPT_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    risk: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_2_PROMPT_ROUTE prompt provider event_log sk-test-s64-2-prompt"
  });
  const scholarState = createInitialState({ role: "scholar", playerName: "无财赋 Prompt Tester" });

  const officialTask = buildTurnTask(officialState, "核查户部钱粮、粮价、盐漕和地方库银");
  const scholarTask = buildTurnTask(scholarState, "在县学听闻粮价与商路");

  assert.match(officialTask.input, /economicFiscal/);
  assert.match(officialTask.input, /economicFiscalView/);
  assert.match(officialTask.input, /财赋|粮储|盐漕|库银|服务器裁决/);
  assert.doesNotMatch(officialTask.input, /SEALED_S64_2_PROMPT/);
  assert.doesNotMatch(officialTask.input, /sk-test-s64-2-prompt|event_log/);
  assert.match(scholarTask.input, /economicFiscal/);
  assert.doesNotMatch(scholarTask.input, /economic-ledger-|economic-incident-|盐漕商路预警|库银赈济/);
});

test("turn prompt input includes S53 retrieval context as dynamic world state", () => {
  const worldState = createInitialState({ role: "official", playerName: "Retrieval Prompt Tester" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";

  const task = buildTurnTask(worldState, "核查户部与京杭漕运北段");

  assert.match(task.input, /Use retrievalContext as the first index/);
  assert.match(task.input, /"retrievalContext"/);
  assert.match(task.input, /server_visible_ranked_projection/);
  assert.match(task.input, /"playerAction": "核查户部与京杭漕运北段"/);
  assert.match(task.input, /route-grand-canal-north|京杭漕运北段/);
  assert.doesNotMatch(task.instructions, /Retrieval Prompt Tester|京杭漕运北段/);
});

test("scholar geography prompt does not expose role-visible diplomatic geography", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "Scholar Geo Prompt Tester" });
  const task = buildTurnTask(worldState, "在县学听闻边报");

  assert.match(task.input, /worldGeography/);
  assert.doesNotMatch(task.input, /city-hanseong/);
  assert.doesNotMatch(task.input, /jurisdiction-ministry-personnel-capital/);
  assert.doesNotMatch(task.input, /辽东朝鲜贡道/);
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
