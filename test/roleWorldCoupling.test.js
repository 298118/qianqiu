const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { applyRelationshipChanges } = require("../src/game/relationships");
const { applyStatePatch } = require("../src/game/stateRules");
const {
  buildRoleWorldCouplingView,
  classifyRoleWorldAction,
  normalizeRoleWorldCouplingState,
  runRoleWorldCouplingStep
} = require("../src/game/roleWorldCoupling");

function applyRoleWorldResult(worldState, result) {
  applyStatePatch(worldState, result.statePatch, {
    incrementTurnCount: false,
    allowServerOwnedPatchKeys: true
  });
  return applyRelationshipChanges(worldState, result.relationshipChanges);
}

test("initial role-world coupling state is empty and normalizes legacy data", () => {
  const worldState = createInitialState({ playerName: "Tester" });

  assert.deepEqual(worldState.roleWorldCoupling, {
    schemaVersion: 1,
    recentImpacts: [],
    cooldowns: {}
  });
  assert.deepEqual(buildRoleWorldCouplingView(worldState).recentImpacts, []);

  worldState.roleWorldCoupling = {
    schemaVersion: 99,
    recentImpacts: [
      { kind: "", title: "" },
      {
        kind: "magistrate_waterworks",
        role: "magistrate",
        title: "Waterworks",
        summary: "old impact",
        year: 1644,
        month: 13,
        turn: 3,
        affectedPaths: ["grainReserve"]
      }
    ],
    cooldowns: { magistrate_waterworks: 999999 }
  };

  const normalized = normalizeRoleWorldCouplingState(worldState);

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.recentImpacts.length, 1);
  assert.equal(normalized.recentImpacts[0].month, 12);
  assert.equal(normalized.cooldowns.magistrate_waterworks <= worldState.turnCount + 120, true);
});

test("role-world classifier recognizes representative role actions", () => {
  assert.equal(
    classifyRoleWorldAction(createInitialState({ role: "magistrate" }), "waterworks along the canal"),
    "magistrate_waterworks"
  );
  assert.equal(
    classifyRoleWorldAction(createInitialState({ role: "general" }), "lead a campaign at the border"),
    "general_campaign"
  );
  assert.equal(
    classifyRoleWorldAction(createInitialState({ role: "emperor" }), "appoint clean officials"),
    "emperor_appointments"
  );
  assert.equal(
    classifyRoleWorldAction(createInitialState({ role: "minister" }), "impeach corrupt clerks"),
    "minister_impeachment"
  );
  assert.equal(classifyRoleWorldAction(createInitialState({ role: "scholar" }), "study"), null);
});

test("magistrate waterworks produce server-owned world and relationship consequences without mutation", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "Tester" });
  const before = JSON.parse(JSON.stringify(worldState));

  const result = runRoleWorldCouplingStep(worldState, "waterworks along the canal");

  assert.deepEqual(worldState, before);
  assert.equal(result.outcome.kind, "magistrate_waterworks");
  assert.ok(result.statePatch.grainReserve > worldState.grainReserve);
  assert.ok(result.statePatch.publicOrder > worldState.publicOrder);
  assert.ok(result.statePatch.player.waterworks > worldState.player.waterworks);
  assert.ok(result.relationshipChanges.some((change) => change.targetId === "C01"));

  const appliedRelationships = applyRoleWorldResult(worldState, result);

  assert.equal(worldState.roleWorldCoupling.recentImpacts.at(-1).kind, "magistrate_waterworks");
  assert.ok(worldState.relationshipLedger.characters.C01.relationship > before.relationshipLedger.characters.C01.relationship);
  assert.ok(appliedRelationships.some((change) => change.targetId === "C01"));
  assert.equal(worldState.turnCount, 0);
});

test("general campaign consequences clamp resources and affect military factions", () => {
  const worldState = createInitialState({ role: "general", playerName: "Tester" });
  worldState.treasury = 20;
  worldState.grainReserve = 20;
  worldState.player.scouting = 15;
  worldState.player.supply = 100;
  worldState.borderThreat = 3;

  const result = runRoleWorldCouplingStep(worldState, "campaign before supplies are ready");
  applyRoleWorldResult(worldState, result);

  assert.equal(result.outcome.kind, "general_campaign");
  assert.equal(worldState.treasury, 0);
  assert.equal(worldState.grainReserve, 0);
  assert.equal(worldState.borderThreat >= 0, true);
  assert.ok(worldState.factions.militaryLords > 30);
  assert.equal(worldState.roleWorldCoupling.recentImpacts.at(-1).affectedPaths.includes("borderThreat"), true);
});

test("emperor appointments and minister impeachment reshape court factions", () => {
  const emperorState = createInitialState({ role: "emperor", playerName: "Tester" });
  const emperor = runRoleWorldCouplingStep(emperorState, "appoint clean officials");
  applyRoleWorldResult(emperorState, emperor);

  assert.equal(emperor.outcome.kind, "emperor_appointments");
  assert.ok(emperorState.corruption < 60);
  assert.ok(emperorState.factions.scholarOfficials > 40);
  assert.ok(emperorState.factions.eunuchs < 50);

  const ministerState = createInitialState({ role: "minister", playerName: "Tester" });
  const minister = runRoleWorldCouplingStep(ministerState, "impeach corrupt clerks");
  const relationshipChanges = applyRoleWorldResult(ministerState, minister);

  assert.equal(minister.outcome.kind, "minister_impeachment");
  assert.ok(ministerState.corruption < 60);
  assert.ok(ministerState.factions.scholarOfficials > 40);
  assert.ok(relationshipChanges.some((change) => change.targetId === "scholarOfficials"));
});
