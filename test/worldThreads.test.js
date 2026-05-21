const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createNpcActiveRequest,
  resolveNpcActiveRequest
} = require("../src/game/npcActiveRequests");
const {
  buildWorldThreadView,
  ensureWorldThreadState,
  normalizeWorldThreadState,
  summarizeWorldThreadsForPrompt
} = require("../src/game/worldThreads");

test("initial state carries an empty server-owned world thread ledger", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  assert.deepEqual(worldState.worldThreads, {
    schemaVersion: 1,
    threads: [],
    recentResolved: []
  });
  assert.deepEqual(buildWorldThreadView(worldState).activeThreads, []);
});

test("S88.7 world threads consume the dedicated NPC active request ledger safely", () => {
  const worldState = createInitialState({ playerName: "来函议程", role: "magistrate" });
  worldState.turnCount = 4;
  const created = createNpcActiveRequest(worldState, "bribe");
  assert.equal(created.ok, true);

  ensureWorldThreadState(worldState);
  const activeView = buildWorldThreadView(worldState);
  const activeThread = activeView.activeThreads.find((thread) => thread.sourceId === created.request.requestId);
  assert.ok(activeThread);
  assert.equal(activeThread.sourceType, "active_npc_request");
  assert.equal(activeThread.kind, "npc_request");
  assert.equal(activeThread.deadlineUnit, "turn");
  assert.match(activeThread.summary, /礼物|银钱|廉政|风险/);

  const resolved = resolveNpcActiveRequest(worldState, created.request.requestId, "report");
  assert.equal(resolved.ok, true);
  ensureWorldThreadState(worldState);
  const watchView = buildWorldThreadView(worldState);
  const watchThread = watchView.activeThreads.find((thread) => thread.sourceId === created.request.requestId);
  assert.ok(watchThread);
  assert.equal(watchThread.status, "watch");
  assert.match(watchThread.summary, /廉政|线索|服务器/);
  assert.doesNotMatch(
    JSON.stringify(watchView),
    /npcActiveRequestLedger|hiddenDossier|privateSignalTags|求财|亲族压力|rawProvider|sk-[A-Za-z0-9_-]{6,}/
  );
});

test("world thread view filters hidden thread notes and normalizes legacy rows", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.worldEntities.entities.push({
    id: "hidden-thread-entity",
    category: "fiscal",
    kind: "fiscal_channel",
    name: "Hidden Thread Entity",
    status: "critical",
    visibility: "hidden",
    metrics: { pressure: 90, capacity: 10, trust: 5, deficit: 95 },
    publicSummary: "SEALED_THREAD_ENTITY_SUMMARY",
    hiddenNotes: ["SEALED_THREAD_ENTITY_NOTE"]
  });
  worldState.worldThreads = {
    schemaVersion: 99,
    threads: [
      { id: "", title: "bad" },
      {
        id: "WT-hidden",
        status: "active",
        kind: "border",
        sourceType: "frontier_report",
        sourceId: "secret",
        title: "Hidden Frontier",
        summary: "sealed dossier",
        severity: 99,
        visibility: "hidden",
        related: { factions: ["militaryLords"], metrics: ["borderThreat"] }
      },
      {
        id: "WT-visible",
        status: "unknown",
        kind: "invented",
        sourceType: "invented",
        sourceId: "visible",
        title: "可见议题",
        summary: "县中钱粮与民情尚需观察。",
        severity: -5,
        related: { characters: ["C01"], entities: ["hidden-thread-entity"], metrics: ["publicOrder"] }
      }
    ],
    recentResolved: [{ id: "WT-old", title: "旧议题", sourceType: "long_term_event", resolvedTurn: 2 }]
  };

  const normalized = normalizeWorldThreadState(worldState);
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.threads.length, 2);
  assert.equal(normalized.threads.find((thread) => thread.id === "WT-visible").kind, "consequence");
  assert.equal(normalized.threads.find((thread) => thread.id === "WT-visible").severity, 1);

  const view = buildWorldThreadView(worldState);
  assert.equal(view.activeThreads.length, 1);
  assert.equal(view.activeThreads[0].id, "WT-visible");
  assert.deepEqual(view.activeThreads[0].related.entities, []);
  assert.deepEqual(view.activeThreads[0].relatedEntitySummaries, []);
  assert.equal(JSON.stringify(view).includes("sealed dossier"), false);
  assert.equal(JSON.stringify(view).includes("Hidden Thread Entity"), false);
  assert.equal(JSON.stringify(view).includes("SEALED_THREAD_ENTITY_SUMMARY"), false);
  assert.equal(JSON.stringify(view).includes("SEALED_THREAD_ENTITY_NOTE"), false);
});

test("world threads unify active requests, long events, official assignments, and role impacts", () => {
  const worldState = createInitialState({ role: "official", playerName: "Tester" });
  Object.assign(worldState.player, {
    officeTitle: "户部主事",
    position: "户部主事",
    performanceMerit: 44,
    impeachmentRisk: 20
  });
  worldState.turnCount = 8;
  worldState.activeNpcRequest = {
    schemaVersion: 1,
    id: "REQ-test-C01",
    status: "active",
    kind: "request",
    targetType: "character",
    targetId: "C01",
    sourceName: "赵给事",
    title: "赵给事有事相托",
    ask: "请你核一份赈册。",
    stakes: "办妥可进情分。",
    createdTurn: 7,
    dueTurn: 10,
    lastUpdatedTurn: 7
  };
  worldState.longTermEvents.queue = [
    {
      schemaVersion: 1,
      id: "LTE-test-border",
      key: "border_alarm",
      type: "border",
      status: "active",
      targetType: "world",
      targetId: "",
      title: "边报连至",
      summary: "边镇催饷，兵部与军镇持续施压。",
      severity: 2,
      createdTurn: 7,
      startedYear: 1644,
      startedMonth: 8,
      durationMonths: 2,
      remainingMonths: 2,
      cooldownKey: "border_alarm",
      cooldownTurns: 7,
      cooldownUnit: "ten_day",
      visibility: "public"
    }
  ];
  worldState.officialCareer.currentPosting = "户部主事";
  worldState.officialCareer.assignments = [
    {
      id: "ASG-test-relief",
      title: "赈银核销",
      kind: "relief",
      bureauId: "ministry_revenue",
      status: "active",
      dueTurn: 11,
      deadlineUnit: "ten_day",
      progress: 45,
      risk: 60,
      publicStake: 70,
      privatePressure: 30,
      visibleSummary: "赈务牵连钱粮与亏空。",
      hiddenNotes: ["暗中有人遮掩亏空"]
    }
  ];
  worldState.officialCareer.courtEntryFollowUps = [{
    id: "OCEF-test-follow-up",
    entryId: "official-court-entry-first-month-ASG-test-relief",
    resolutionId: "OCER-test-relief",
    assignmentId: "ASG-test-relief",
    stage: "bureau_review",
    stageLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "部院待覆",
    title: "部院覆奏：赈银核销",
    publicSummary: "部院待覆：赈银核销承接近次准入复核进入部院覆奏，皇帝、部院、台谏只形成公开中间意见，不直接任免、奖惩、处分或成弹劾。",
    generatedAtTurn: 8,
    sourceRefs: ["officialCareer.courtEntry:official-court-entry-first-month-ASG-test-relief"],
    consequenceRefs: ["worldThread:official_court_follow_up"],
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
  }];
  worldState.officialCourtResponses.responses = [{
    id: "OCR-thread-chain",
    responseRole: "minister",
    responseKind: "bureau_reply",
    responseKindLabel: "部院覆奏",
    status: "referred_to_bureau",
    statusLabel: "交部院覆奏",
    sourceType: "official_court_follow_up",
    sourceId: "OCEF-test-follow-up",
    sourceFollowUpId: "OCEF-test-follow-up",
    chainId: "official_court_follow_up:OCEF-test-follow-up",
    chainRound: 1,
    chainStageLabel: "首轮 · 部院覆奏",
    nextHandlerRole: "emperor",
    nextHandlerLabel: "御前",
    title: "部院覆奏：赈银核销",
    publicSummary: "部院覆奏赈银核销，只列公开凭据、经手人、限期和仍须御前复核之处。",
    generatedAtTurn: 8,
    sourceRefs: ["official_court_follow_up:OCEF-test-follow-up"],
    consequenceRefs: ["eventArchive:official_court_response"]
  }];
  worldState.roleWorldCoupling.recentImpacts = [
    {
      id: "RWC-test-campaign",
      kind: "general_campaign",
      role: "general",
      title: "兵事及边",
      summary: "边事牵动军费与军心。",
      year: 1644,
      month: 8,
      turn: 8,
      affectedPaths: ["borderThreat", "treasury", "factions.militaryLords"]
    }
  ];

  ensureWorldThreadState(worldState);
  const view = buildWorldThreadView(worldState);
  const sourceTypes = new Set(view.activeThreads.map((thread) => thread.sourceType));

  assert.equal(sourceTypes.has("active_npc_request"), true);
  assert.equal(sourceTypes.has("long_term_event"), true);
  assert.equal(sourceTypes.has("official_assignment"), true);
  assert.equal(sourceTypes.has("official_court_follow_up"), true);
  assert.equal(sourceTypes.has("official_court_response"), true);
  assert.equal(sourceTypes.has("role_world_coupling"), true);
  const requestThread = view.activeThreads.find((thread) => thread.sourceType === "active_npc_request");
  assert.ok(requestThread);
  assert.equal(requestThread.deadlineUnit, "turn");
  assert.equal(requestThread.deadlineLabel, "第10回，尚余2回");
  const reliefThread = view.activeThreads.find((thread) => thread.title === "赈银核销");
  assert.ok(reliefThread);
  assert.equal(reliefThread.severity, 2);
  assert.equal(reliefThread.riskLabel, "有牵连");
  assert.equal(reliefThread.deadlineUnit, "ten_day");
  assert.equal(reliefThread.deadlineLabel, "第11回，尚余3旬（约1月）");
  assert.match(reliefThread.goal, /办结差事/);
  assert.ok(reliefThread.relatedLabels.offices.includes("户部"));
  assert.ok(reliefThread.relatedLabels.entities.includes("灾荒赈务"));
  assert.ok(reliefThread.relatedLabels.metrics.includes("考成"));
  assert.ok(reliefThread.relatedEntitySummaries.some((entity) => entity.id === "relief-granary-operation"));
  assert.ok(reliefThread.interventionHints.some((hint) => hint.includes("差事")));
  assert.match(reliefThread.followUpHint, /官场模块/);
  const followUpThread = view.activeThreads.find((thread) => thread.sourceType === "official_court_follow_up");
  assert.ok(followUpThread);
  assert.match(followUpThread.goal, /首月奏议/);
  assert.ok(followUpThread.interventionHints.some((hint) => hint.includes("覆奏")));
  const responseThread = view.activeThreads.find((thread) => thread.sourceType === "official_court_response");
  assert.ok(responseThread);
  assert.match(responseThread.summary, /赈银核销|部院覆奏/);
  assert.ok(responseThread.interventionHints.some((hint) => /回应|凭据|覆奏/.test(hint)));
  assert.equal(JSON.stringify(view).includes("暗中有人遮掩亏空"), false);

  const promptSummary = summarizeWorldThreadsForPrompt(worldState);
  const promptBorderThread = promptSummary.activeThreads.find((thread) => thread.title === "边报连至");
  assert.ok(promptBorderThread);
  assert.match(promptBorderThread.goal, /边报/);
  assert.equal(promptBorderThread.deadlineUnit, "month");
  assert.equal(promptBorderThread.deadlineLabel, "约余2月");
  assert.ok(promptBorderThread.interventionHints.length);
  assert.ok(promptBorderThread.relatedLabels.factions.includes("边镇武臣"));
  assert.ok(promptBorderThread.relatedEntitySummaries.some((entity) => entity.id === "military-frontier-garrison"));
  assert.equal(JSON.stringify(promptSummary).includes("暗中有人遮掩亏空"), false);
});

test("high-pressure visible world entities become threads with capped entity summaries", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 4;
  worldState.worldEntities.entities.push({
    id: "hidden-relief-ledger",
    category: "relief",
    kind: "relief_operation",
    name: "Hidden Relief Ledger",
    status: "critical",
    visibility: "hidden",
    metrics: { influence: 90, pressure: 99, capacity: 10, trust: 5, deficit: 98 },
    publicSummary: "SEALED_RELIEF_THREAD_SUMMARY",
    related: { metrics: ["grainReserve"] },
    hiddenNotes: ["SEALED_RELIEF_THREAD_NOTE"]
  });

  ensureWorldThreadState(worldState);
  const view = buildWorldThreadView(worldState);
  const promptSummary = summarizeWorldThreadsForPrompt(worldState);
  const entityThread = view.activeThreads.find((thread) => thread.sourceType === "world_entity");
  const serializedView = JSON.stringify(view);
  const serializedPrompt = JSON.stringify(promptSummary);

  assert.ok(entityThread);
  assert.equal(entityThread.kind, "world_entity_pressure");
  assert.ok(entityThread.relatedEntitySummaries.length >= 1);
  assert.ok(entityThread.relatedEntitySummaries.every((entity) => entity.id !== "hidden-relief-ledger"));
  assert.equal(serializedView.includes("SEALED_RELIEF_THREAD_SUMMARY"), false);
  assert.equal(serializedView.includes("SEALED_RELIEF_THREAD_NOTE"), false);
  assert.equal(serializedPrompt.includes("SEALED_RELIEF_THREAD_SUMMARY"), false);
  assert.equal(serializedPrompt.includes("SEALED_RELIEF_THREAD_NOTE"), false);
});

test("hidden world entity source threads are dropped from views, prompt summaries, and archives", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 5;
  worldState.worldEntities.entities.push({
    id: "hidden-source-entity",
    category: "fiscal",
    kind: "fiscal_channel",
    name: "Hidden Source Entity",
    status: "critical",
    visibility: "hidden",
    metrics: { influence: 88, pressure: 99, capacity: 10, trust: 5, deficit: 99 },
    publicSummary: "SEALED_SOURCE_ENTITY_SUMMARY",
    related: { metrics: ["treasury"] },
    hiddenNotes: ["SEALED_SOURCE_ENTITY_NOTE"]
  });
  worldState.worldThreads = {
    schemaVersion: 1,
    threads: [
      {
        id: "WT-hidden-source-entity",
        status: "active",
        kind: "world_entity_pressure",
        sourceType: "world_entity",
        sourceId: "hidden-source-entity",
        sourceLabel: "世界实体",
        title: "SEALED_SOURCE_THREAD_TITLE",
        summary: "SEALED_SOURCE_THREAD_SUMMARY",
        severity: 3,
        createdTurn: 4,
        lastUpdatedTurn: 4,
        visibility: "public",
        related: { entities: ["hidden-source-entity"], metrics: ["treasury"] }
      }
    ],
    recentResolved: [
      {
        id: "WT-hidden-source-resolved",
        kind: "world_entity_pressure",
        sourceType: "world_entity",
        sourceId: "hidden-source-entity",
        title: "SEALED_SOURCE_RESOLVED_TITLE",
        resolvedTurn: 4,
        outcome: "SEALED_SOURCE_RESOLVED_OUTCOME"
      }
    ]
  };

  const viewBeforeSync = buildWorldThreadView(worldState);
  const promptBeforeSync = summarizeWorldThreadsForPrompt(worldState);
  ensureWorldThreadState(worldState);
  const viewAfterSync = buildWorldThreadView(worldState);
  const serialized = JSON.stringify({
    viewBeforeSync,
    promptBeforeSync,
    worldThreads: worldState.worldThreads,
    viewAfterSync
  });

  assert.equal(serialized.includes("hidden-source-entity"), false);
  assert.equal(serialized.includes("Hidden Source Entity"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_ENTITY_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_ENTITY_NOTE"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_THREAD_TITLE"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_THREAD_SUMMARY"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_RESOLVED_TITLE"), false);
  assert.equal(serialized.includes("SEALED_SOURCE_RESOLVED_OUTCOME"), false);
});

test("world threads archive disappeared active sources as recent resolved", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 2;
  worldState.activeNpcRequest = {
    schemaVersion: 1,
    id: "REQ-archive-C01",
    status: "active",
    kind: "request",
    targetType: "character",
    targetId: "C01",
    sourceName: "顾文衡",
    title: "顾文衡有事相托",
    ask: "请你读经。",
    stakes: "办妥可进情分。",
    createdTurn: 1,
    dueTurn: 3,
    lastUpdatedTurn: 1
  };

  ensureWorldThreadState(worldState);
  assert.ok(worldState.worldThreads.threads.some((thread) => thread.sourceType === "active_npc_request"));

  worldState.turnCount = 3;
  worldState.activeNpcRequest = null;
  ensureWorldThreadState(worldState);

  assert.equal(worldState.worldThreads.threads.some((thread) => thread.sourceType === "active_npc_request"), false);
  assert.ok(worldState.worldThreads.recentResolved.some((thread) => thread.sourceId === "REQ-archive-C01"));
});

test("world thread sync does not archive hidden legacy rows into visible resolved history", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.worldThreads = {
    schemaVersion: 1,
    threads: [
      {
        id: "WT-hidden-legacy",
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
    recentResolved: [
      {
        id: "WT-hidden-resolved",
        title: "Resolved Hidden Palace Thread",
        kind: "faction_conflict",
        sourceType: "faction_pressure",
        sourceId: "hidden-resolved",
        resolvedTurn: 1,
        outcome: "sealed palace dossier",
        visibility: "hidden"
      }
    ]
  };

  ensureWorldThreadState(worldState);
  const view = buildWorldThreadView(worldState);

  assert.equal(JSON.stringify(worldState.worldThreads.recentResolved).includes("Hidden Palace Thread"), false);
  assert.equal(JSON.stringify(worldState.worldThreads.recentResolved).includes("sealed palace dossier"), false);
  assert.equal(JSON.stringify(view).includes("sealed impeachment dossier"), false);
  assert.equal(JSON.stringify(view).includes("Resolved Hidden Palace Thread"), false);
});

test("S88.6 domain consequence threads do not duplicate resolved echoes after visibility churn", () => {
  const worldState = createInitialState({ role: "official", playerName: "后果议题官" });
  worldState.turnCount = 30;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "world-thread-domain-echo",
      policyType: "market_regulation",
      policyLabel: "平抑米价回响",
      status: "accepted",
      publicSummary: "米铺照牌价出售，后续仍需观察民心。",
      publicSourceId: "world-thread-domain-public-source",
      stateDelta: { publicOrder: -5 },
      appliedAtTurn: 30
    }]
  };

  ensureWorldThreadState(worldState);
  const firstView = buildWorldThreadView(worldState);
  const firstThread = firstView.activeThreads.find((thread) => thread.sourceType === "domain_consequence");
  assert.ok(firstThread);
  assert.match(firstThread.sourceId, /^domainConsequenceEcho:/);

  worldState.player.role = "scholar";
  worldState.turnCount = 31;
  ensureWorldThreadState(worldState);
  const firstResolved = buildWorldThreadView(worldState).recentResolved
    .filter((thread) => thread.sourceType === "domain_consequence" && thread.sourceId === firstThread.sourceId);
  assert.equal(firstResolved.length, 1);

  worldState.player.role = "official";
  worldState.turnCount = 32;
  ensureWorldThreadState(worldState);
  assert.ok(buildWorldThreadView(worldState).activeThreads.some((thread) =>
    thread.sourceType === "domain_consequence" && thread.sourceId === firstThread.sourceId
  ));

  worldState.player.role = "scholar";
  worldState.turnCount = 33;
  ensureWorldThreadState(worldState);
  const secondResolved = buildWorldThreadView(worldState).recentResolved
    .filter((thread) => thread.sourceType === "domain_consequence" && thread.sourceId === firstThread.sourceId);

  assert.equal(secondResolved.length, 1);
  assert.equal(JSON.stringify(secondResolved).includes("world-thread-domain-public-source"), false);
});
