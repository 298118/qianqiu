const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile
} = require("../src/game/aiActorProfiles");
const { buildMapContextView } = require("../src/game/mapContext");

test("S70.13 scholar map context keeps public geography and exam travel but hides role-only areas", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗地图测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const view = buildMapContextView(worldState, actorProfile);
  const refIds = new Set(view.mapEntityRefs.map((ref) => ref.refId));
  const serialized = JSON.stringify(view);

  assert.equal(refIds.has("map:geography:city:city-beijing"), true);
  assert.equal(refIds.has("map:exam:exam_travel:exam-travel-child_exam"), true);
  assert.equal(refIds.has("map:geography:city:city-guangzhou"), false);
  assert.equal(refIds.has("map:geography:country:country-joseon"), false);
  assert.equal(view.movementTypes.map((type) => type.type).includes("exam_travel"), true);
  assert.equal(serialized.includes("SEALED_LIAODONG_SMUGGLING_ROUTE"), false);
});

test("S70.13 general map context can see military refs and movement types through actor visibility", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇地图测试" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const view = buildMapContextView(worldState, actorProfile);
  const refTypes = new Set(view.mapEntityRefs.map((ref) => ref.entityType));
  const movementTypes = new Set(view.movementTypes.map((type) => type.type));

  assert.equal(refTypes.has("military_report"), true);
  assert.equal(refTypes.has("frontier_zone"), true);
  assert.equal(movementTypes.has("military_march"), true);
  assert.equal(movementTypes.has("envoy_travel"), true);
  assert.equal(view.mapEventHooks.some((hook) => hook.sourceType === "border_incident"), true);
});

test("S70.13 map context filters hooks by actor profile when world state role is broader", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "广域世界" });
  const scholarActor = buildPlayerAiActorProfile(createInitialState({ role: "scholar", playerName: "窄视野" }));
  const view = buildMapContextView(worldState, scholarActor);
  const hookTypes = new Set(view.mapEventHooks.map((hook) => hook.sourceType));

  assert.equal([...view.mapEntityRefs].some((ref) => ref.domain === "military"), false);
  assert.equal([...view.mapEntityRefs].some((ref) => ref.domain === "economic"), false);
  assert.equal(hookTypes.has("border_incident"), false);
  assert.equal(hookTypes.has("market_incident"), false);
  assert.equal(hookTypes.has("official_posting"), false);
  assert.equal(view.movementTypes.map((type) => type.type).includes("exam_travel"), true);
});

test("S70.13 system engine can read safe geography but cannot receive map movement affordances", () => {
  const worldState = createInitialState({ role: "minister", playerName: "系统调度地图" });
  const actorProfile = buildSystemEngineActorProfile(worldState, "pressure_events");
  const view = buildMapContextView(worldState, actorProfile);

  assert.ok(view.mapEntityRefs.some((ref) => ref.domain === "geography"));
  assert.equal(view.actorScope.mapToolVisible, false);
  assert.deepEqual(view.movementTypes, []);
});
