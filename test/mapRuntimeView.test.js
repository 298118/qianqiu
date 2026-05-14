const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildMapActionDrafts,
  buildMapRuntimeView,
  sanitizeMapLayout
} = require("../src/game/mapRuntimeView");

function assertSafeMapRuntimePayload(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /SEALED_|hiddenNotes|hiddenIntent|raw provider|raw coordinate|coordinateTable|latitude|longitude|world_sessions|prompt_retrieval_index|event_log|E:\\LSMNQ|data\/sessions|file:\/\/|OPENAI_API_KEY|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+/i
  );
}

test("S72.2 map runtime view builds renderable safe refs without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "舆图运行时测试" });
  const before = JSON.stringify(worldState);
  const view = buildMapRuntimeView(worldState);
  const refIds = new Set(view.refs.map((ref) => ref.mapEntityRef));

  assert.equal(view.schemaVersion, 1);
  assert.equal(view.layoutVersion, "ink-layout-v1");
  assert.equal(view.assetSetId, "ink-map-v1");
  assert.deepEqual(view.mapBounds, {
    width: 2400,
    height: 1600,
    coordinateSpace: "normalized-image-space"
  });
  assert.equal(JSON.stringify(worldState), before);
  assert.ok(view.refs.length > 0);
  assert.ok(view.refs.every((ref) => ref.mapEntityRef.startsWith("map:")));
  assert.ok(view.refs.every((ref) => ref.layout.x >= 0 && ref.layout.x <= 1));
  assert.ok(view.refs.every((ref) => ref.layout.y >= 0 && ref.layout.y <= 1));
  assert.ok(refIds.has(view.viewportHint.centerRef));
  assert.equal(view.viewportHint.centerRef, view.playerFocusRef);
  assert.ok(Object.keys(view.actionDrafts).length > 0);
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view clamps unsafe layout and drops unsafe text", () => {
  const layout = sanitizeMapLayout({
    x: -12,
    y: 4,
    layer: "forged",
    importance: 88,
    labelAnchor: "bad"
  });
  assert.deepEqual(layout, {
    x: 0,
    y: 1,
    layer: "places",
    importance: 1,
    labelAnchor: "top"
  });

  const mapContextView = {
    schemaVersion: 1,
    generatedAtTurn: 4,
    mapEntityRefs: [
      {
        refId: "map:geography:city:city-beijing",
        entityType: "city",
        entityId: "city-beijing",
        label: "SEALED_CITY_NAME",
        summary: "raw provider C:\\LSMNQ\\data\\sessions\\secret.json",
        visibility: "public",
        pressure: 40
      },
      {
        refId: "map:geography:city:city-nanjing",
        entityType: "city",
        entityId: "sk-secret-fallback",
        label: "SEALED_FALLBACK_LABEL",
        summary: "可公开展示的节点。",
        visibility: "public",
        pressure: 20
      }
    ],
    mapEventHooks: []
  };
  const view = buildMapRuntimeView({ turnCount: 4 }, { mapContextView });

  assert.equal(view.refs.length, 1);
  assert.equal(view.refs[0].label, "city-beijing");
  assert.equal(view.refs.some((ref) => ref.mapEntityRef === "map:geography:city:city-nanjing"), false);
  assert.notEqual(view.refs[0].summary, "raw provider C:\\LSMNQ\\data\\sessions\\secret.json");
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view creates safe route paths and server-owned action drafts", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "舆图路线测试" });
  const view = buildMapRuntimeView(worldState);
  const canal = view.routes.find((route) => route.mapEntityRef === "map:geography:route:route-grand-canal-north");
  const routeDraft = canal && view.actionDrafts[canal.actionDraftRefs[0]];

  assert.ok(canal);
  assert.equal(canal.fromRef, "map:geography:city:city-nanjing");
  assert.equal(canal.toRef, "map:geography:city:city-beijing");
  assert.ok(canal.layoutPath.length >= 2);
  assert.ok(canal.layoutPath.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  assert.equal(canal.style.token, "water_route");
  assert.ok(routeDraft);
  assert.equal(routeDraft.requiresServerTurn, true);
  assert.match(routeDraft.actionText, /循.*行进/);
  assert.doesNotMatch(routeDraft.actionText, /POST|resolver|statePatch|SQL/i);
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map runtime view turns visible map hooks into capped event effects", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "舆图事势测试" });
  worldState.borderThreat = 88;
  worldState.publicOrder = 32;
  worldState.taxRate = 70;
  const view = buildMapRuntimeView(worldState);

  assert.ok(view.eventEffects.length > 0);
  assert.ok(view.eventEffects.length <= 12);
  assert.ok(view.eventEffects.every((effect) => effect.severity >= 0 && effect.severity <= 1));
  assert.ok(view.eventEffects.every((effect) => effect.targetRef.startsWith("map:")));
  assert.ok(view.eventEffects.every((effect) => effect.sourceRefs.every((sourceRef) => /^[A-Za-z0-9_.:-]+$/.test(sourceRef))));
  assertSafeMapRuntimePayload(view);
});

test("S72.2 map action drafts stay dictionary-shaped and require player confirmation", () => {
  const drafts = buildMapActionDrafts({
    refs: [
      {
        mapEntityRef: "map:geography:city:city-suzhou",
        entityType: "city",
        label: "苏州",
        affordances: ["inspect", "draft_travel_action"],
        actionDraftRefs: ["draft-travel-city-suzhou"]
      }
    ],
    routes: []
  });

  assert.deepEqual(Object.keys(drafts), ["draft-travel-city-suzhou"]);
  assert.equal(drafts["draft-travel-city-suzhou"].targetRef, "map:geography:city:city-suzhou");
  assert.equal(drafts["draft-travel-city-suzhou"].requiresServerTurn, true);
  assert.match(drafts["draft-travel-city-suzhou"].actionText, /前往苏州/);
});
