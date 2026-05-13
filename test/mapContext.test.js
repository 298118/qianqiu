const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildMapContextView,
  buildMapEntityRef,
  summarizeMapContextForPrompt
} = require("../src/game/mapContext");

test("S70.13 map context builds stable safe map refs without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "地图接口测试官" });
  const before = JSON.stringify(worldState);
  const view = buildMapContextView(worldState);
  const serialized = JSON.stringify(view);

  assert.equal(view.schemaVersion, 1);
  assert.equal(JSON.stringify(worldState), before);
  assert.ok(view.mapEntityRefs.some((ref) => ref.refId === "map:geography:city:city-beijing"));
  assert.ok(view.mapEntityRefs.some((ref) => ref.refId === "map:geography:route:route-grand-canal-north"));
  assert.ok(view.mapEntityRefs.some((ref) => ref.refId === "map:exam:exam_travel:exam-travel-child_exam"));
  assert.ok(view.mapEntityRefs.every((ref) => ref.refId.startsWith("map:")));
  assert.doesNotMatch(serialized, /SEALED_|hiddenNotes|raw provider|raw coordinate|coordinateTable|latitude|longitude|\/mnt\/|sk-test/i);
});

test("S70.13 map event hooks attach dockets, border, market and posting rows to mapEntityRef", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "御前地图测试" });
  worldState.borderThreat = 88;
  worldState.taxRate = 70;
  worldState.publicOrder = 35;
  const view = buildMapContextView(worldState);
  const hookTypes = new Set(view.mapEventHooks.map((hook) => hook.sourceType));

  assert.equal(view.mapEventHooks.length > 0, true);
  assert.equal(hookTypes.has("official_posting"), true);
  assert.equal(hookTypes.has("border_incident"), true);
  assert.equal([...hookTypes].some((type) => ["local_docket", "disaster_docket"].includes(type)), true);
  assert.equal(hookTypes.has("market_incident"), true);
  for (const hook of view.mapEventHooks) {
    assert.ok(hook.mapEntityRefs.length > 0);
    assert.ok(hook.mapEntityRefs.every((ref) => ref.refId.startsWith("map:")));
  }
});

test("S70.13 prompt summary caps map refs and keeps only safe projection fields", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇地图测试" });
  const summary = summarizeMapContextForPrompt(buildMapContextView(worldState));
  const serialized = JSON.stringify(summary);

  assert.equal(summary.source, "mapContextView");
  assert.ok(summary.places.length <= 10);
  assert.ok(summary.routes.length <= 5);
  assert.ok(summary.frontiers.length <= 5);
  assert.match(serialized, /mapContextView|地图|server|route|map:/i);
  assert.doesNotMatch(serialized, /worldState|raw_table|coordinateTable|hidden enemy|SEALED_|\/mnt\//i);
});

test("S70.13 buildMapEntityRef drops unsafe labels and preserves jump targets for safe refs", () => {
  const unsafe = buildMapEntityRef({
    id: "route-hidden",
    name: "SEALED_ROUTE_NAME",
    publicSummary: "SEALED raw provider /mnt/e/secret"
  }, "geography", { entityType: "route" });
  const safe = buildMapEntityRef({
    id: "city-safe",
    name: "安全城邑",
    publicSummary: "公开城邑摘要。"
  }, "geography", { entityType: "city" });

  assert.equal(unsafe, null);
  assert.equal(safe.refId, "map:geography:city:city-safe");
  assert.deepEqual(safe.jumpTarget, {
    sourceView: "worldGeographyView.cities",
    id: "city-safe"
  });
});
