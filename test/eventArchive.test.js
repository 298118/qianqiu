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
  worldState.officialCareer.assignments = [{
    id: "ASG-0000-first-month-top_hanlin_editor",
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    bureauId: "hanlin_academy",
    status: "active",
    dueTurn: 12,
    deadlineUnit: "ten_day",
    progress: 72,
    risk: 24,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰。",
    hiddenNotes: ["密札不可见"]
  }];
  const entryId = "official-court-entry-first-month-ASG-0000-first-month-top_hanlin_editor";
  worldState.officialCareer.courtEntryResolutions = [{
    id: "OCER-archive-court-entry",
    entryId,
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    surfaceId: "memorial-review",
    submissionKind: "official_first_month_memorial",
    status: "accepted_for_review",
    statusLabel: "准入复核",
    title: "准入复核：馆阁讲章校订",
    publicSummary: "准入复核：馆阁讲章校订已入奏折队列服务器裁决，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 9,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    nextStep: "由部院复核公开凭据后再入长期考成。"
  }];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-archive-follow-up",
    entryId,
    resolutionId: "OCER-archive-court-entry",
    assignmentId: "ASG-0000-first-month-top_hanlin_editor",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "部院待覆",
    title: "部院覆奏：馆阁讲章校订",
    publicSummary: "部院待覆：馆阁讲章校订承接近次准入复核进入部院覆奏，皇帝、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 9,
    sourceRefs: [`officialCareer.courtEntry:${entryId}`],
    consequenceRefs: ["worldThread:official_court_follow_up"],
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
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
  worldState.appointmentTrack.records = [{
    id: "appointment-archive",
    level: "palace_exam",
    examName: "殿试",
    date: { year: 1644, month: 8, tenDayPeriod: 2, turnCount: 9 },
    palaceRank: "一甲",
    honorTitle: "状元",
    publicSummary: "殿试后，服务器定一甲翰林修撰，初授翰林院修撰。",
    serverDecision: {
      trackKey: "top_hanlin_compiler",
      trackLabel: "一甲翰林修撰",
      officeTitle: "翰林院修撰",
      bureauId: "hanlin_academy"
    }
  }];

  const view = buildEventArchiveView(worldState, { pageSize: 50 });
  const serialized = JSON.stringify(view);

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.generatedAtTurn, 9);
  assert.match(view.dateLabel, /1644年八月中旬/);
  assert.equal(view.pagination.page, 1);
  assert.equal(view.pagination.pageSize, 50);
  assert.equal(view.pagination.totalItems, view.counts.total);
  assert.equal(view.pageCounts.total, view.items.length);
  assert.ok(view.items.length >= 6);
  assert.ok(view.items.length <= 50);
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
  assert.ok(view.items.some((item) => item.sourceType === "official_court_entry" && item.title.includes("馆阁讲章校订")));
  assert.ok(view.items.some((item) => item.sourceType === "official_court_follow_up" && item.title.includes("馆阁讲章校订")));
  assert.ok(view.items.some((item) => item.sourceType === "intelligence_rumor" && item.sourceLabel === "情报"));
  assert.ok(view.items.some((item) =>
    item.sourceType === "official_assessment" &&
    item.sourceLabel === "考成" &&
    item.summary.includes("任所奏报")
  ));
  assert.ok(view.items.some((item) =>
    item.sourceType === "local_docket" &&
    item.sourceLabel === "案牍" &&
    /案牍|任所|钱粮|刑名|水利/.test(item.summary)
  ));
  assert.ok(view.items.some((item) =>
    item.sourceType === "economic_fiscal" &&
    item.sourceLabel === "财赋" &&
    /财政|粮价|盐漕|赈济|债务/.test(item.title)
  ));
  assert.ok(view.items.some((item) => item.sourceType === "exam_record" && item.title === "童生试"));
  assert.ok(view.items.some((item) =>
    item.sourceType === "appointment_result" &&
    item.sourceLabel === "授官" &&
    item.title.includes("翰林院修撰")
  ));
  assert.deepEqual(view.items.map((item) => item.turn), view.items.map((item) => item.turn).sort((a, b) => b - a));
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("sk-proj-secret-archive"), false);
  assert.equal(serialized.includes("data/audit"), false);
});

test("event archive derives local docket items only for administrative views", () => {
  const magistrateState = createInitialState({ playerName: "案牍归档", role: "magistrate" });
  Object.assign(magistrateState.player, {
    pendingLawsuits: 80,
    waterworks: 20,
    banditPressure: 84
  });
  const scholarState = createInitialState({ playerName: "案牍旁听", role: "scholar" });

  const magistrateArchive = buildEventArchiveView(magistrateState, { pageSize: 50 });
  const scholarArchive = buildEventArchiveView(scholarState, { pageSize: 50 });
  const docketItem = magistrateArchive.items.find((item) => item.sourceType === "local_docket");
  const serialized = JSON.stringify(magistrateArchive);

  assert.ok(docketItem);
  assert.equal(docketItem.sourceLabel, "案牍");
  assert.match(docketItem.summary, /服务器|AI/);
  assert.equal(scholarArchive.counts.local_docket || 0, 0);
  assert.doesNotMatch(serialized, /statePatch|provider|proposal|prompt|data\/sessions|sk-/);
});

test("event archive derives military diplomacy incidents only for military-aware views", () => {
  const generalState = createInitialState({ playerName: "军务归档", role: "general" });
  Object.assign(generalState, {
    borderThreat: 90,
    armyMorale: 32,
    grainReserve: 180,
    population: 7400
  });
  generalState.worldGeography.frontierZones.push({
    id: "frontier-hidden-archive-s64",
    name: "SEALED_S64_ARCHIVE_FRONTIER",
    countryId: "country-ming",
    neighborCountryId: "country-manchu-frontier",
    cityIds: ["city-beijing"],
    routeIds: ["route-shanhai-liaodong-pass"],
    pressure: 99,
    visibility: "hidden",
    publicSummary: "SEALED_S64_ARCHIVE_FRONTIER prompt provider event_log sk-test-s64-archive"
  });
  const scholarState = createInitialState({ playerName: "军务旁听", role: "scholar" });

  const generalArchive = buildEventArchiveView(generalState, { pageSize: 50 });
  const scholarArchive = buildEventArchiveView(scholarState, { pageSize: 50 });
  const item = generalArchive.items.find((entry) => entry.sourceType === "military_diplomacy");
  const serialized = JSON.stringify(generalArchive);

  assert.ok(item);
  assert.equal(item.sourceLabel, "军务");
  assert.match(item.summary, /威胁|粮道|战备|情报可信/);
  assert.equal(scholarArchive.counts.military_diplomacy || 0, 0);
  assert.doesNotMatch(serialized, /SEALED_S64_ARCHIVE/);
  assert.doesNotMatch(serialized, /sk-test-s64-archive|provider|event_log/);
});

test("event archive derives economic fiscal incidents only for administrative views", () => {
  const officialState = createInitialState({ playerName: "财赋归档", role: "official" });
  Object.assign(officialState, {
    treasury: 240,
    grainReserve: 180,
    population: 7200,
    taxRate: 68,
    corruption: 88
  });
  officialState.worldGeography.routes.push({
    id: "route-hidden-archive-s64-2",
    type: "canal",
    name: "SEALED_S64_2_ARCHIVE_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    visibility: "hidden",
    risk: 99,
    publicSummary: "SEALED_S64_2_ARCHIVE_ROUTE prompt provider event_log sk-test-s64-2-archive"
  });
  const scholarState = createInitialState({ playerName: "财赋旁听", role: "scholar" });

  const officialArchive = buildEventArchiveView(officialState, { pageSize: 50 });
  const scholarArchive = buildEventArchiveView(scholarState, { pageSize: 50 });
  const item = officialArchive.items.find((entry) => entry.sourceType === "economic_fiscal");
  const serialized = JSON.stringify(officialArchive);

  assert.ok(item);
  assert.equal(item.sourceLabel, "财赋");
  assert.match(item.summary, /压力|财政|粮价|盐漕|赈济|债务/);
  assert.equal(scholarArchive.counts.economic_fiscal || 0, 0);
  assert.doesNotMatch(serialized, /SEALED_S64_2_ARCHIVE/);
  assert.doesNotMatch(serialized, /sk-test-s64-2-archive|provider|event_log/);
});

test("event archive includes S65 public historical event chains without sealed projection leakage", () => {
  const officialState = createInitialState({ playerName: "事件链归档", role: "official" });
  Object.assign(officialState, {
    turnCount: 16,
    treasury: 220,
    grainReserve: 160,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 28
  });
  Object.assign(officialState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  Object.assign(officialState.officialCareer, {
    currentPosting: "户部主事",
    bureauId: "ministry_revenue"
  });
  officialState.officialPostings.assessmentRecords.push({
    id: "assessment-s65-archive-visible",
    postingId: "posting-player-current",
    officeId: "ministry_revenue_principal",
    bureauId: "ministry_revenue",
    holderType: "player",
    status: "pending",
    meritScore: 42,
    riskScore: 82,
    recommendation: "watch",
    publicFinding: "任所奏报牵连户部钱粮与弹劾风险。",
    publicSummary: "户部钱粮考成吃紧，需复核漕册。",
    visibility: "office_visible",
    knownToPlayer: true,
    date: { year: 1644, month: 1, tenDayPeriod: 1, turn: 16 },
    lastUpdatedTurn: 16
  });
  officialState.worldGeography.routes.push({
    id: "route-hidden-archive-s65",
    type: "canal",
    name: "SEALED_S65_ARCHIVE_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    visibility: "hidden",
    risk: 99,
    publicSummary: "SEALED_S65_ARCHIVE_ROUTE prompt provider event_log sk-test-s65-archive"
  });

  const archive = buildEventArchiveView(officialState, { pageSize: 50 });
  const item = archive.items.find((entry) => entry.sourceType === "historical_event_chain");
  const serialized = JSON.stringify(archive);

  assert.ok(item);
  assert.equal(item.sourceLabel, "事件链");
  assert.match(item.summary, /事件链|公共卷宗|因果线索|服务器/);
  assert.equal(archive.counts.historical_event_chain > 0, true);
  assert.doesNotMatch(serialized, /sealedProjection|server_only|密档只保留/);
  assert.doesNotMatch(serialized, /SEALED_S65_ARCHIVE/);
  assert.doesNotMatch(serialized, /sk-test-s65-archive|provider|event_log|prompt/);
});

test("event archive sanitizer drops prompt, provider, path, key, and raw state text", () => {
  assert.equal(cleanArchiveText("公开奏报一则"), "公开奏报一则");
  assert.equal(cleanArchiveText("promptText: reveal retrievalContext"), "");
  assert.equal(cleanArchiveText("provider proposal statePatch worldState"), "");
  assert.equal(cleanArchiveText("E:\\LSMNQ\\data\\sessions\\secret.json"), "");
  assert.equal(cleanArchiveText("OPENAI_API_KEY=sk-proj-archive-secret-123456"), "");
  assert.equal(cleanArchiveText("MIMO_API_KEY=tp-archive-secret-123456"), "");
  assert.equal(cleanArchiveText("RAW_TABLE_geo_cities C:\\Users\\ZZZ\\secret.txt SECRET_KEY_VALUE"), "");
  assert.equal(cleanArchiveText("prompt_retrieval_index people_npcs TOKEN_VALUE"), "");
});

test("event archive drops polluted actor memory and session summary raw text variants", () => {
  const worldState = createInitialState({ playerName: "记忆归档过滤", role: "official" });
  worldState.turnCount = 18;
  worldState.actorMemoryLedger = {
    schemaVersion: 1,
    generatedAtTurn: 18,
    memoriesByActor: {
      "npc:C01": [{
        id: "AM-polluted-archive",
        actorId: "npc:C01",
        type: "fact",
        typeLabel: "事实",
        visibility: "player_visible",
        summary: "顾文衡 hidden notes 中有一条不该进入事件档案的私评。",
        salience: 95,
        confidence: 0.9,
        sourceType: "ai_memory_proposal",
        sourceLabel: "记忆提案",
        tags: ["密档线索"],
        createdAt: { year: 1644, month: 1, tenDayPeriod: 1, turn: 18 },
        lastTouchedTurn: 18,
        lastReinforcedTurn: 18,
        reinforcementCount: 1
      }]
    },
    recentUpdates: []
  };
  worldState.sessionSummary = {
    schemaVersion: 1,
    generatedAtTurn: 18,
    monthlySummaries: [{
      id: "SS-polluted-archive",
      periodLabel: "1644年一月",
      publicSummary: "本月私档记录了一条隐藏意图。",
      highlights: ["hidden intent", "公开摘要"],
      generatedAt: { year: 1644, month: 1, tenDayPeriod: 3, turn: 18 },
      generatedAtTurn: 18
    }]
  };

  const archive = buildEventArchiveView(worldState, { pageSize: 50 });
  const serialized = JSON.stringify(archive);

  assert.equal(archive.counts.actor_memory || 0, 0);
  assert.equal(archive.counts.session_summary || 0, 0);
  assert.doesNotMatch(serialized, /hidden notes|hidden intent|私档|隐藏意图|密档线索/);
});

test("event archive includes S65.2 intelligence rumors without hidden source leakage", () => {
  const worldState = createInitialState({ role: "official", playerName: "情报归档" });
  Object.assign(worldState, {
    treasury: 240,
    grainReserve: 170,
    population: 7200,
    taxRate: 68,
    corruption: 88,
    publicOrder: 26,
    borderThreat: 88,
    armyMorale: 34
  });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事"
  });
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.bureauId = "ministry_revenue";
  worldState.worldGeography.routes.push({
    id: "route-hidden-s65-2-archive",
    type: "canal",
    name: "SEALED_S65_2_ARCHIVE_ROUTE",
    fromCityId: "city-beijing",
    toCityId: "city-nanjing",
    visibility: "hidden",
    risk: 99,
    publicSummary: "SEALED_S65_2_ARCHIVE_ROUTE prompt provider event_log sk-test-s65-2-archive"
  });

  const archive = buildEventArchiveView(worldState);
  const serialized = JSON.stringify(archive);

  assert.ok(archive.items.some((item) => item.sourceType === "intelligence_rumor"));
  assert.match(serialized, /情报|坊间传闻|官署奏报|部院奏报|御前摘报|军中侦报/);
  assert.doesNotMatch(serialized, /SEALED_S65_2_ARCHIVE/);
  assert.doesNotMatch(serialized, /sk-test-s65-2-archive|event_log|provider|prompt/);
});

test("event archive drops polluted raw official assessment text after visible view sanitization", () => {
  const worldState = createInitialState({ playerName: "考成污染", role: "official" });
  worldState.turnCount = 12;
  worldState.officialPostings.assessmentRecords.push({
    id: "assessment-polluted-raw",
    postingId: "posting-player-current",
    officeId: "probationary_observer",
    bureauId: "ministry_personnel",
    holderType: "player",
    holderId: "P1",
    cycleId: "polluted",
    date: {
      year: 1644,
      month: 1,
      tenDayPeriod: 1,
      turn: 12
    },
    status: "pending",
    meritScore: 55,
    riskScore: 45,
    recommendation: "none",
    publicFinding: "SEALED_OFFICIAL_ASSESSMENT prompt event_log sk-proj-archive-raw-123456",
    publicSummary: "SEALED_OFFICIAL_ASSESSMENT provider proposal",
    visibility: "office_visible",
    knownToPlayer: true,
    intelConfidence: 80,
    lastUpdatedTurn: 12
  });

  const view = buildEventArchiveView(worldState, { pageSize: 50 });
  const serialized = JSON.stringify(view);

  assert.ok(view.items.some((item) => item.sourceType === "official_assessment"));
  assert.doesNotMatch(serialized, /SEALED_OFFICIAL_ASSESSMENT/);
  assert.doesNotMatch(serialized, /sk-proj-archive-raw/);
  assert.doesNotMatch(serialized, /event_log|provider|proposal|prompt/);
});

test("event archive view paginates the safe projection without reviving filtered text", () => {
  const worldState = createInitialState({ playerName: "分页书生", role: "scholar" });
  worldState.turnCount = 40;
  worldState.eventHistory = Array.from({ length: 30 }, (_, index) =>
    index === 25
      ? "prompt provider proposal event_log sk-proj-archive-secret-777777"
      : `公开近事第${index + 1}条`
  );

  const firstPage = buildEventArchiveView(worldState, { pageSize: 5 });
  const secondPage = buildEventArchiveView(worldState, { page: 2, pageSize: 5 });
  const overLargePage = buildEventArchiveView(worldState, { page: 999, pageSize: 5 });
  const serialized = JSON.stringify([firstPage, secondPage, overLargePage]);

  assert.equal(firstPage.items.length, 5);
  assert.equal(firstPage.pagination.page, 1);
  assert.equal(firstPage.pagination.pageSize, 5);
  assert.equal(firstPage.pagination.hasNextPage, true);
  assert.equal(secondPage.pagination.page, 2);
  assert.equal(secondPage.pagination.hasPreviousPage, true);
  assert.equal(overLargePage.pagination.page, overLargePage.pagination.totalPages);
  assert.equal(firstPage.pagination.totalItems, 12);
  assert.equal(firstPage.counts.total, 12);
  assert.equal(firstPage.counts.event_history, 7);
  assert.equal(firstPage.counts.intelligence_rumor, 5);
  assert.equal(firstPage.pageCounts.total, 5);
  assert.ok(firstPage.items.some((item) => item.sourceType === "event_history" && item.summary === "公开近事第30条"));
  assert.ok(firstPage.items.some((item) => item.sourceType === "intelligence_rumor"));
  assert.deepEqual(
    buildEventArchiveView(worldState, { pageSize: 50 }).items
      .filter((item) => item.sourceType === "event_history")
      .map((item) => item.summary),
    ["公开近事第30条", "公开近事第29条", "公开近事第28条", "公开近事第27条", "公开近事第25条", "公开近事第24条", "公开近事第23条"]
  );
  assert.doesNotMatch(serialized, /sk-proj-archive-secret/);
  assert.doesNotMatch(serialized, /event_log/);
  assert.doesNotMatch(serialized, /provider/);
});
