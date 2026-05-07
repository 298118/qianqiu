const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
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
