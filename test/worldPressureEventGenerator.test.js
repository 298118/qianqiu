const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyPressureEventOutcome,
  collectWorldPressureSignals,
  generatePressureEventCandidates,
  resolvePressureEventCandidate
} = require("../src/game/worldPressureEventGenerator");

function buildPressureState() {
  const worldState = createInitialState({ role: "magistrate", playerName: "清河县令" });
  worldState.publicOrder = 54;
  worldState.corruption = 72;
  worldState.grainReserve = 420;
  worldState.taxRate = 42;
  worldState.relationshipLedger.characters.C01.visible = true;
  worldState.relationshipLedger.characters.C01.relationship = -45;
  worldState.relationshipLedger.characters.C01.resentment = 90;
  worldState.relationshipLedger.characters.C01.recentIntent = "公开怨望，欲托乡绅呈诉。";
  return worldState;
}

test("S71.8 world pressure event generator turns DB projections into server-owned event candidates", () => {
  const worldState = buildPressureState();
  const pressureContext = collectWorldPressureSignals(worldState);
  const candidates = generatePressureEventCandidates(worldState, {
    pressureContext,
    maxCandidates: 16
  });
  const candidate = candidates.find((entry) => entry.ruleId === "city_unrest");
  const before = {
    grainReserve: worldState.grainReserve,
    publicOrder: worldState.publicOrder,
    corruption: worldState.corruption,
    eventCount: worldState.eventHistory.length
  };

  assert.equal(pressureContext.schemaVersion, "s71.worldPressureEvent.v1");
  assert.equal(pressureContext.safety.modelGenerated, false);
  assert.equal(pressureContext.safety.rawTablesIncluded, false);
  assert.equal(pressureContext.resolverInput.totalEvidenceRefs > 0, true);
  assert.equal(pressureContext.signals.length > 0, true);
  assert.ok(candidate, "缺少民生扰动候选");
  assert.equal(candidate.sourcePressureRefs.length >= 2, true);
  assert.equal(candidate.privateResultRefs.length, 0);
  assert.equal(candidate.score >= 58, true);
  assert.equal(candidate.probability >= 0.55, true);

  const outcome = resolvePressureEventCandidate(worldState, candidate, {
    pressureContext,
    resolverInput: pressureContext.resolverInput
  });

  assert.equal(outcome.status, "accepted");
  assert.deepEqual(outcome.rejectionReasons, []);
  assert.equal(JSON.stringify(worldState.worldPressureEventLedger || {}), "{}");
  assert.equal(Object.keys(outcome.stateDelta).every((key) =>
    ["treasury", "grainReserve", "population", "publicOrder", "taxRate", "corruption", "armyMorale", "borderThreat"].includes(key)
  ), true);

  applyPressureEventOutcome(worldState, outcome);

  assert.equal(worldState.grainReserve < before.grainReserve, true);
  assert.equal(worldState.publicOrder < before.publicOrder, true);
  assert.equal(worldState.corruption >= before.corruption, true);
  assert.equal(worldState.eventHistory.length, before.eventCount + 1);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
  assert.equal(worldState.worldPressureEventLedger.records[0].ruleId, "city_unrest");
  assert.match(worldState.eventHistory.at(-1), /服务器成案|公开线索/);
  assert.doesNotMatch(worldState.eventHistory.at(-1), /evidence:|sourcePressureRefs|rawSql|hiddenNotes|server\./);
  assert.equal(outcome.auditRecord.safety.serverAdjudicated, true);
  assert.equal(outcome.auditRecord.safety.deterministicProbability, true);
});

test("S71.8 generator includes NPC resentment pressure without model-supplied facts", () => {
  const worldState = buildPressureState();
  const pressureContext = collectWorldPressureSignals(worldState);
  const candidates = generatePressureEventCandidates(worldState, {
    pressureContext,
    maxCandidates: 24
  });
  const npcCandidate = candidates.find((entry) => entry.ruleId === "npc_petition");

  assert.ok(npcCandidate, "缺少人物怨望候选");
  assert.equal(npcCandidate.incidentKind, "npc_resentment");
  assert.equal(npcCandidate.sourceSignals.some((signal) => signal.domain === "people"), true);
  assert.equal(npcCandidate.authorityBoundary.includes("服务器"), true);
  assert.doesNotMatch(JSON.stringify(npcCandidate), /hiddenNotes|rawSql|statePatch|world_sessions/);
});
