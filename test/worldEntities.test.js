const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  createNpcActiveRequest,
  runNpcActiveRequestStep
} = require("../src/game/npcActiveRequests");
const {
  applyWorldEntityInfluences,
  buildWorldEntityView,
  deriveWorldEntityInfluences,
  ensureWorldEntityState,
  normalizeWorldEntityState,
  summarizeWorldEntitiesForPrompt
} = require("../src/game/worldEntities");

test("initial state carries a server-owned multi-entity world model", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const view = buildWorldEntityView(worldState);
  const categories = new Set(view.groups.map((group) => group.category));
  const kinds = new Set(view.groups.flatMap((group) => group.entities.map((entity) => entity.kind)));

  assert.equal(worldState.worldEntities.schemaVersion, 1);
  assert.ok(worldState.worldEntities.entities.length >= 10);
  assert.equal(categories.has("court"), true);
  assert.equal(categories.has("local"), true);
  assert.equal(categories.has("academy"), true);
  assert.equal(categories.has("military"), true);
  assert.equal(categories.has("fiscal"), true);
  assert.equal(categories.has("relief"), true);
  assert.equal(kinds.has("court_office"), true);
  assert.equal(kinds.has("local_gentry"), true);
  assert.equal(kinds.has("academy_circle"), true);
  assert.equal(kinds.has("frontier_garrison"), true);
  assert.equal(kinds.has("fiscal_channel"), true);
  assert.equal(kinds.has("relief_operation"), true);
  assert.ok(view.highlights.length > 0);
});

test("world entity normalization fills base entities and clamps legacy rows", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.worldEntities = {
    schemaVersion: 99,
    entities: [
      { id: "", name: "bad" },
      {
        id: "court-ministry-revenue",
        category: "unknown",
        kind: "bad",
        name: "户部改写",
        status: "bad",
        metrics: {
          influence: 999,
          pressure: -50,
          capacity: 101,
          trust: -1,
          deficit: 66
        },
        publicSummary: "户部公开账册。",
        hiddenNotes: ["不应进入摘要"]
      },
      {
        id: "custom-relief",
        category: "relief",
        kind: "relief_operation",
        name: "自定义赈棚",
        status: "critical",
        visibility: "public",
        metrics: { pressure: 88, capacity: 20, trust: 25, deficit: 90 },
        publicSummary: "灾民暂聚城外。",
        interventionHints: ["开仓", "查册"]
      }
    ],
    recentNotes: ["第一条", "第二条"]
  };

  const normalized = normalizeWorldEntityState(worldState);
  const revenue = normalized.entities.find((entity) => entity.id === "court-ministry-revenue");
  const custom = normalized.entities.find((entity) => entity.id === "custom-relief");

  assert.equal(normalized.schemaVersion, 1);
  assert.ok(normalized.entities.some((entity) => entity.id === "academy-county-school"));
  assert.equal(revenue.category, "court");
  assert.equal(revenue.kind, "court_office");
  assert.equal(revenue.metrics.influence, 100);
  assert.equal(revenue.metrics.pressure, 0);
  assert.equal(revenue.metrics.capacity, 100);
  assert.equal(revenue.metrics.trust, 0);
  assert.equal(revenue.metrics.deficit, 66);
  assert.equal(custom.status, "critical");
  assert.deepEqual(normalized.recentNotes, ["第一条", "第二条"]);
});

test("world entity view and prompt summary filter hidden entities and hidden notes", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.worldEntities.recentNotes.push("SEALED_RECENT_ENTITY_NOTE");
  worldState.worldEntities.entities.push({
    id: "hidden-salt-ledger",
    category: "fiscal",
    kind: "fiscal_channel",
    name: "Hidden Salt Ledger",
    status: "critical",
    visibility: "hidden",
    metrics: { influence: 90, pressure: 95, capacity: 10, trust: 5, deficit: 99 },
    publicSummary: "sealed salt book",
    related: { factions: ["eunuchs"], offices: ["ministry_revenue"], metrics: ["treasury"] },
    interventionHints: ["do not show"],
    hiddenNotes: ["SEALED_ENTITY_TOKEN"]
  });

  ensureWorldEntityState(worldState);
  const view = buildWorldEntityView(worldState);
  const promptSummary = summarizeWorldEntitiesForPrompt(worldState);
  const serializedView = JSON.stringify(view);
  const serializedPrompt = JSON.stringify(promptSummary);

  assert.equal(serializedView.includes("Hidden Salt Ledger"), false);
  assert.equal(serializedView.includes("sealed salt book"), false);
  assert.equal(serializedView.includes("SEALED_ENTITY_TOKEN"), false);
  assert.equal(serializedView.includes("SEALED_RECENT_ENTITY_NOTE"), false);
  assert.equal(serializedPrompt.includes("Hidden Salt Ledger"), false);
  assert.equal(serializedPrompt.includes("sealed salt book"), false);
  assert.equal(serializedPrompt.includes("SEALED_ENTITY_TOKEN"), false);
  assert.equal(serializedPrompt.includes("SEALED_RECENT_ENTITY_NOTE"), false);
  assert.match(serializedPrompt, /户部/);
  assert.ok(promptSummary.highlights.length <= 6);
});

test("server-owned entity influences update metrics, status, and hidden notes safely", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  worldState.turnCount = 6;
  const before = worldState.worldEntities.entities.find((entity) => entity.id === "relief-granary-operation");

  const impacts = applyWorldEntityInfluences(worldState, [
    {
      entityId: "relief-granary-operation",
      sourceType: "long_term_event",
      sourceId: "LTE-flood",
      metricsDelta: { pressure: 99, capacity: -99, trust: -4, deficit: 99 },
      publicNote: "水灾赈册压来",
      hiddenNote: "SEALED_RELIEF_CAUSE"
    }
  ]);
  const after = worldState.worldEntities.entities.find((entity) => entity.id === "relief-granary-operation");
  const view = buildWorldEntityView(worldState);
  const promptSummary = summarizeWorldEntitiesForPrompt(worldState);

  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].sourceType, "long_term_event");
  assert.ok(after.metrics.pressure > before.metrics.pressure);
  assert.ok(after.metrics.pressure <= 100);
  assert.ok(after.metrics.capacity < before.metrics.capacity);
  assert.notEqual(after.status, "stable");
  assert.equal(after.lastUpdatedTurn, 6);
  assert.ok(after.hiddenNotes.includes("SEALED_RELIEF_CAUSE"));
  assert.equal(JSON.stringify(view).includes("SEALED_RELIEF_CAUSE"), false);
  assert.equal(JSON.stringify(promptSummary).includes("SEALED_RELIEF_CAUSE"), false);
  assert.ok(worldState.worldEntities.recentNotes.includes("水灾赈册压来"));
});

test("server-owned entity impacts strip unsafe public source ids", () => {
  const worldState = createInitialState({ playerName: "Source Guard" });

  const impacts = applyWorldEntityInfluences(worldState, [
    {
      entityId: "court-censorate",
      sourceType: "active_npc_request",
      sourceId: "data/sessions/secret/rawLedger-safe_search_index-providerPayload",
      metricsDelta: { pressure: 1 },
      publicNote: "公开压力留痕"
    },
    {
      entityId: "academy-same-year-circle",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:debate:4",
      metricsDelta: { trust: 1 },
      publicNote: "论道余波"
    }
  ]);
  const serialized = JSON.stringify(impacts);

  assert.equal(impacts[0].sourceId, "");
  assert.equal(impacts[1].sourceId, "npc-relationship-resolution:npc-scholar-peer-shen:debate:4");
  assert.doesNotMatch(serialized, /data\/sessions|rawLedger|safe_search_index|providerPayload/);
});

test("S88.7 world entity impact source refs strip configured secret fragments", () => {
  const previousSecret = process.env.QIANQIU_TEST_SECRET_KEY;
  process.env.QIANQIU_TEST_SECRET_KEY = "secret-fragment-12345";
  try {
    const worldState = createInitialState({ playerName: "Secret Source Guard" });
    worldState.turnCount = 20;

    const impacts = applyWorldEntityInfluences(worldState, [
      {
        entityId: "court-censorate",
        sourceType: "active_npc_request",
        sourceId: "npc-request-secret-fragment-12345-public",
        metricsDelta: { pressure: 1 },
        publicNote: "公开压力留痕"
      }
    ]);
    const view = buildWorldEntityView(worldState);
    const serialized = JSON.stringify({ impacts, view });

    assert.equal(impacts[0].sourceId, "");
    assert.ok(view.recentImpacts.some((impact) =>
      impact.entityId === "court-censorate" && impact.sourceRef === ""
    ));
    assert.doesNotMatch(serialized, /secret-fragment-12345|fragment-12345|secret-fragment/);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.QIANQIU_TEST_SECRET_KEY;
    } else {
      process.env.QIANQIU_TEST_SECRET_KEY = previousSecret;
    }
  }
});

test("S88.7 world entity impacts persist capped public evidence rows", () => {
  const worldState = createInitialState({ playerName: "实体证据", role: "scholar" });
  worldState.turnCount = 21;

  const impacts = applyWorldEntityInfluences(worldState, [
    {
      entityId: "academy-same-year-circle",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-scholar-peer-shen:debate:21",
      metricsDelta: { trust: 2, pressure: -1 },
      publicNote: "论道余波进入同年文社"
    },
    {
      entityId: "court-censorate",
      sourceType: "active_npc_request",
      sourceId: "data/sessions/rawLedger-providerPayload-safe_search_index",
      metricsDelta: { pressure: 2 },
      publicNote: "来函后续已登记为风宪证据观察"
    },
    {
      entityId: "local-gentry-county",
      sourceType: "npc_relationship_action",
      sourceId: "npc-relationship-resolution:npc-gentry:marriage:21",
      metricsDelta: { pressure: 1 },
      publicNote: "hidden_dossier provider_payload /mnt/e/secret"
    }
  ]);
  const view = buildWorldEntityView(worldState);
  const promptSummary = summarizeWorldEntitiesForPrompt(worldState);
  const serialized = JSON.stringify({ impacts, view, promptSummary });

  assert.equal(impacts.length, 3);
  assert.ok(view.recentImpacts.length >= 2);
  assert.ok(view.recentImpacts.some((impact) =>
    impact.sourceType === "npc_relationship_action" &&
    impact.sourceRef === "npc-relationship-resolution:npc-scholar-peer-shen:debate:21" &&
    impact.topicSurfaceIds.includes("npc-profile") &&
    /论道余波|同年文社|信任/.test(`${impact.title}${impact.publicSummary}${impact.affectedMetricLabels.join("")}`)
  ));
  assert.ok(view.recentImpacts.some((impact) =>
    impact.sourceType === "active_npc_request" &&
    impact.entityId === "court-censorate" &&
    impact.sourceRef === "" &&
    impact.relatedRefs.some((ref) => ref === "worldEntity:court-censorate")
  ));
  assert.equal(view.recentImpacts.some((impact) => /hidden_dossier|provider_payload|\/mnt\/e/.test(impact.publicSummary)), false);
  assert.ok(promptSummary.recentImpacts.some((impact) => /论道余波|同年文社/.test(impact.publicSummary)));
  assert.doesNotMatch(serialized, /data\/sessions|rawLedger|providerPayload|provider_payload|safe_search_index|hidden_dossier|\/mnt\/e|sk-[A-Za-z0-9_-]{6,}/);
});

test("S88.7 world entity recent impact normalization caps and filters hidden legacy rows", () => {
  const worldState = createInitialState({ playerName: "实体证据上限" });
  worldState.turnCount = 32;
  worldState.worldEntities.recentImpacts = Array.from({ length: 30 }, (_, index) => ({
    id: `legacy-impact-${index}`,
    sourceType: "npc_relationship_action",
    entityId: index === 0 ? "hidden-entity" : "academy-same-year-circle",
    title: `旧关系压力${index}`,
    publicSummary: `旧公开关系压力 ${index}`,
    affectedMetricLabels: ["压力上升"],
    generatedAtTurn: index
  }));
  worldState.worldEntities.entities.push({
    id: "hidden-entity",
    category: "academy",
    kind: "academy_circle",
    name: "SEALED_HIDDEN_ENTITY",
    status: "critical",
    visibility: "hidden",
    metrics: { influence: 90, pressure: 90, capacity: 10, trust: 10, deficit: 0 },
    publicSummary: "SEALED_HIDDEN_SUMMARY"
  });

  const normalized = normalizeWorldEntityState(worldState);
  const view = buildWorldEntityView({ ...worldState, worldEntities: normalized });
  const serialized = JSON.stringify(view);

  assert.equal(normalized.recentImpacts.length, 24);
  assert.equal(normalized.recentImpacts.some((impact) => impact.entityId === "hidden-entity"), false);
  assert.equal(normalized.recentImpacts[0].id, "legacy-impact-6");
  assert.equal(normalized.recentImpacts.at(-1).id, "legacy-impact-29");
  assert.doesNotMatch(serialized, /SEALED_HIDDEN_ENTITY|SEALED_HIDDEN_SUMMARY/);
});

test("deriveWorldEntityInfluences maps applied state, relationship, role, NPC, and official sources", () => {
  const before = createInitialState({ playerName: "Tester", role: "official" });
  const after = createInitialState({ playerName: "Tester", role: "official" });
  after.borderThreat = 82;
  after.publicOrder = 48;
  after.player.performanceMerit = 55;

  const influences = deriveWorldEntityInfluences(after, {
    stateDeltas: [{
      before,
      after,
      sourceType: "provider_state",
      reason: "AI 叙事落到服务器允许的世界指标"
    }],
    relationshipChanges: [{
      targetType: "faction",
      targetId: "militaryLords",
      name: "边镇武臣",
      relationship: { before: 0, after: 6, delta: 6 },
      resentment: { before: 0, after: 1, delta: 1 }
    }],
    activeNpcRequest: { resolved: true },
    worldTick: { cadence: "monthly", completedMonth: true, attributeChanges: [] },
    roleWorldCoupling: {
      outcome: { id: "RWC-test", kind: "general_campaign" },
      attributeChanges: [{ path: "borderThreat", before: 82, after: 79, reason: "角色世界联动" }]
    },
    longTermEvents: {
      scheduled: [{ id: "LTE-test", type: "disaster" }],
      resolved: [],
      attributeChanges: [{ path: "grainReserve", before: 800, after: 650, reason: "长期事件" }]
    },
    officialCareer: {
      events: ["[官场差遣] 督办赈灾，核销赈银账册"],
      outcome: { id: "OC-test", type: "appointment" },
      attributeChanges: [{ path: "player.performanceMerit", before: 45, after: 55, reason: "官场结算" }]
    }
  });
  const sourceTypes = new Set(influences.map((influence) => influence.sourceType));
  const entityIds = new Set(influences.map((influence) => influence.entityId));

  assert.equal(sourceTypes.has("provider_state"), true);
  assert.equal(sourceTypes.has("relationship"), true);
  assert.equal(sourceTypes.has("active_npc_request"), true);
  assert.equal(sourceTypes.has("role_world_coupling"), true);
  assert.equal(sourceTypes.has("long_term_event"), true);
  assert.equal(sourceTypes.has("official_career"), true);
  assert.equal(entityIds.has("military-frontier-garrison"), true);
  assert.equal(entityIds.has("relief-granary-operation"), true);
  assert.equal(entityIds.has("court-ministry-personnel"), true);
});

test("S88.7 NPC active request resolver traces influence world entities without raw ledger leakage", () => {
  const worldState = createInitialState({ playerName: "来函实体", role: "magistrate" });
  worldState.turnCount = 5;
  const created = createNpcActiveRequest(worldState, "bribe");
  assert.equal(created.ok, true);
  const npcActiveRequests = runNpcActiveRequestStep(worldState, "上交廉政线索", {
    responseAction: "report"
  });

  const influences = deriveWorldEntityInfluences(worldState, { npcActiveRequests });
  const serialized = JSON.stringify(influences);

  assert.ok(influences.some((influence) =>
    influence.sourceType === "active_npc_request" &&
    influence.entityId === "court-censorate"
  ));
  assert.match(serialized, /npc-active-resolution/);
  assert.doesNotMatch(serialized, /npcActiveRequestLedger|hiddenDossier|privateSignalTags|rawProvider|sk-[A-Za-z0-9_-]{6,}/);
});

test("S88.7 NPC active request follow-up resolutions influence public entity pressure only", () => {
  const worldState = createInitialState({ playerName: "后续实体", role: "magistrate" });
  worldState.turnCount = 7;
  createNpcActiveRequest(worldState, "impeachment");
  runNpcActiveRequestStep(worldState, "呈报弹劾线索", { responseAction: "report" });
  const followUp = runNpcActiveRequestStep(worldState, "续办弹劾证据，核人证物证与管辖权限");

  const influences = deriveWorldEntityInfluences(worldState, { npcActiveRequests: followUp });
  const serialized = JSON.stringify(influences);

  assert.ok(influences.some((influence) =>
    influence.sourceType === "active_npc_request" &&
    influence.entityId === "court-censorate" &&
    /风宪|证据/.test(influence.publicNote)
  ));
  assert.match(serialized, /npc-active-follow-up-resolution/);
  assert.doesNotMatch(serialized, /npcActiveRequestLedger|hiddenDossier|privateSignalTags|providerPayload|safe_search_index|statePatch|rawProvider|sk-[A-Za-z0-9_-]{6,}/);
});

test("S88.7 NPC relationship action traces influence world entities without visual or hidden refs", () => {
  const worldState = createInitialState({ playerName: "交游实体", role: "scholar" });
  const influences = deriveWorldEntityInfluences(worldState, {
    npcInteractionRecords: [{
      recordId: "npc-interaction:public-duel",
      actionType: "duel",
      resolverTrace: {
        resolver: "npc_relationship_action_resolver",
        publicResolutionRef: "npc-relationship-resolution:npc-scholar-peer-shen:duel:4",
        actionType: "duel",
        status: "server_adjudicated",
        publicSourceRefs: [
          "npcInteractionView:npc-interaction:public-duel",
          "npcRelationshipActionEligibilityView:npc-scholar-peer-shen:duel",
          "npcInteractionLedger:raw-secret"
        ],
        boundaries: {
          serverOwnsOutcome: true,
          privateNpcDossierRedacted: true
        }
      }
    }]
  });
  const serialized = JSON.stringify(influences);

  assert.ok(influences.some((influence) =>
    influence.sourceType === "npc_relationship_action" &&
    influence.entityId === "military-wall-beacons"
  ));
  assert.ok(influences.some((influence) =>
    influence.sourceType === "npc_relationship_action" &&
    influence.entityId === "local-gentry-county"
  ));
  assert.match(serialized, /npc-relationship-resolution/);
  assert.doesNotMatch(serialized, /npcInteractionLedger|npcRelationshipActionEligibilityView|hiddenDossier|privateSignalTags|rawProvider|providerPayload|sk-[A-Za-z0-9_-]{6,}/);
});

test("S88.7 blocked NPC relationship actions do not create entity pressure", () => {
  const worldState = createInitialState({ playerName: "交游挡板", role: "magistrate" });
  const influences = deriveWorldEntityInfluences(worldState, {
    npcInteractionRecords: [{
      recordId: "npc-interaction:blocked-marriage",
      actionType: "marriage",
      resolverTrace: {
        resolver: "npc_relationship_action_resolver",
        publicResolutionRef: "npc-relationship-resolution:npc-gentry:marriage:8",
        actionType: "marriage",
        status: "server_blocked",
        disposition: "blocked_by_server_eligibility",
        boundaries: {
          serverOwnsOutcome: true,
          privateNpcDossierRedacted: true
        }
      }
    }]
  });

  assert.deepEqual(influences, []);
});

test("deriveWorldEntityInfluences respects scene and month-end cadence", () => {
  const worldState = createInitialState({ playerName: "Tester" });
  const longTermContext = {
    scheduled: [{ id: "LTE-cadence", type: "disaster" }],
    resolved: [],
    attributeChanges: [{ path: "grainReserve", before: 800, after: 650, reason: "长期事件" }]
  };

  const sceneInfluences = deriveWorldEntityInfluences(worldState, {
    worldTick: {
      cadence: "scene",
      completedMonth: false,
      attributeChanges: [{ path: "grainReserve", before: 800, after: 780, reason: "科场局部" }]
    },
    longTermEvents: longTermContext
  });

  const tenDayInfluences = deriveWorldEntityInfluences(worldState, {
    worldTick: {
      cadence: "ten_day",
      completedMonth: false,
      attributeChanges: [{ path: "grainReserve", before: 800, after: 790, reason: "旬度推演" }]
    },
    longTermEvents: longTermContext
  });

  const monthlyInfluences = deriveWorldEntityInfluences(worldState, {
    worldTick: {
      cadence: "monthly",
      completedMonth: true,
      attributeChanges: [{ path: "grainReserve", before: 800, after: 650, reason: "月度推演" }]
    },
    longTermEvents: longTermContext
  });

  assert.deepEqual(sceneInfluences, []);
  assert.equal(tenDayInfluences.some((influence) => influence.sourceType === "world_tick"), true);
  assert.equal(tenDayInfluences.some((influence) => influence.sourceType === "long_term_event"), false);
  assert.equal(monthlyInfluences.some((influence) => influence.sourceType === "world_tick"), true);
  assert.equal(monthlyInfluences.some((influence) => influence.sourceType === "long_term_event"), true);
});
