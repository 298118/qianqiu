const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
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

test("world thread view filters hidden thread notes and normalizes legacy rows", () => {
  const worldState = createInitialState({ playerName: "Tester" });
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
        related: { characters: ["C01"], metrics: ["publicOrder"] }
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
  assert.equal(JSON.stringify(view).includes("sealed dossier"), false);
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
      progress: 45,
      risk: 60,
      publicStake: 70,
      privatePressure: 30,
      visibleSummary: "赈务牵连钱粮与亏空。",
      hiddenNotes: ["暗中有人遮掩亏空"]
    }
  ];
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
  assert.equal(sourceTypes.has("role_world_coupling"), true);
  const reliefThread = view.activeThreads.find((thread) => thread.title === "赈银核销");
  assert.ok(reliefThread);
  assert.equal(reliefThread.severity, 2);
  assert.equal(reliefThread.riskLabel, "有牵连");
  assert.equal(reliefThread.deadlineLabel, "第11回，尚余3回");
  assert.match(reliefThread.goal, /办结差事/);
  assert.ok(reliefThread.relatedLabels.offices.includes("户部"));
  assert.ok(reliefThread.relatedLabels.metrics.includes("考成"));
  assert.ok(reliefThread.interventionHints.some((hint) => hint.includes("差事")));
  assert.match(reliefThread.followUpHint, /官场模块/);
  assert.equal(JSON.stringify(view).includes("暗中有人遮掩亏空"), false);

  const promptSummary = summarizeWorldThreadsForPrompt(worldState);
  const promptBorderThread = promptSummary.activeThreads.find((thread) => thread.title === "边报连至");
  assert.ok(promptBorderThread);
  assert.match(promptBorderThread.goal, /边报/);
  assert.ok(promptBorderThread.interventionHints.length);
  assert.ok(promptBorderThread.relatedLabels.factions.includes("边镇武臣"));
  assert.equal(JSON.stringify(promptSummary).includes("暗中有人遮掩亏空"), false);
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
