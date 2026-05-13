const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  applyPressureEventOutcome,
  collectWorldPressureSignals,
  generatePressureEventCandidates,
  resolveAndApplyPressureEvents,
  resolvePressureEventCandidate
} = require("../src/game/worldPressureEventGenerator");

function firstCandidate(worldState) {
  const pressureContext = collectWorldPressureSignals(worldState);
  const candidate = generatePressureEventCandidates(worldState, {
    pressureContext,
    maxCandidates: 12
  }).find((entry) => entry.ruleId === "city_unrest");
  assert.ok(candidate, "缺少可冷却的压力事件候选");
  return { pressureContext, candidate };
}

test("S71.8 pressure event cooldown rejects repeated event spam for the same scope", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "冷却知县" });
  worldState.grainReserve = 360;
  worldState.publicOrder = 50;
  worldState.corruption = 76;
  const { pressureContext, candidate } = firstCandidate(worldState);
  const accepted = resolvePressureEventCandidate(worldState, candidate, { pressureContext });

  assert.equal(accepted.status, "accepted");
  applyPressureEventOutcome(worldState, accepted);

  const repeated = resolvePressureEventCandidate(worldState, candidate, {
    pressureContext: collectWorldPressureSignals(worldState)
  });
  assert.equal(repeated.status, "rejected");
  assert.match(repeated.rejectionReasons.join(" "), /冷却/);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);

  worldState.turnCount += candidate.cooldownTurns;
  const afterCooldown = resolvePressureEventCandidate(worldState, candidate, {
    pressureContext: collectWorldPressureSignals(worldState)
  });
  assert.equal(afterCooldown.rejectionReasons.join(" ").includes("冷却"), false);
});

test("S71.8 pressure event cooldown cannot be bypassed by model-supplied keys", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "绕冷却知县" });
  worldState.grainReserve = 330;
  worldState.publicOrder = 49;
  worldState.corruption = 79;
  const { pressureContext, candidate } = firstCandidate(worldState);
  const accepted = resolvePressureEventCandidate(worldState, candidate, { pressureContext });

  assert.equal(accepted.status, "accepted");
  applyPressureEventOutcome(worldState, accepted);

  const bypass = resolvePressureEventCandidate(worldState, {
    ...candidate,
    cooldownKey: `${candidate.cooldownKey}:provider-bypass`,
    score: 100,
    probability: 1,
    pressureScore: 100,
    priority: 100
  }, {
    pressureContext: collectWorldPressureSignals(worldState)
  });

  assert.equal(bypass.status, "rejected");
  assert.equal(bypass.cooldownKey, candidate.cooldownKey);
  assert.match(bypass.rejectionReasons.join(" "), /冷却/);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
});

test("S71.8 pressure event cooldown is anchored to the primary visible pressure source", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "换佐证知县" });
  worldState.grainReserve = 310;
  worldState.publicOrder = 47;
  worldState.corruption = 82;
  const { pressureContext, candidate } = firstCandidate(worldState);
  const accepted = resolvePressureEventCandidate(worldState, candidate, { pressureContext });
  const primaryRef = candidate.sourcePressureRefs[0];
  const alternateSupport = pressureContext.signals.find((signal) =>
    signal.ref !== primaryRef &&
    ["market", "local_docket", "events", "geography", "world_entity"].includes(signal.domain)
  );

  assert.ok(alternateSupport, "缺少可替换的公开佐证线索");
  assert.equal(accepted.status, "accepted");
  applyPressureEventOutcome(worldState, accepted);

  const changedSupport = resolvePressureEventCandidate(worldState, {
    ...candidate,
    sourcePressureRefs: [primaryRef, alternateSupport.ref],
    cooldownKey: `${candidate.cooldownKey}:alternate-support`,
    score: 100,
    probability: 1,
    pressureScore: 100,
    priority: 100
  }, {
    pressureContext: collectWorldPressureSignals(worldState)
  });

  assert.equal(changedSupport.status, "rejected");
  assert.equal(changedSupport.cooldownKey, candidate.cooldownKey);
  assert.match(changedSupport.rejectionReasons.join(" "), /冷却/);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
});

test("S71.8 pressure event batch resolver honors per-turn accepted event cap", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "上限知县" });
  worldState.grainReserve = 320;
  worldState.publicOrder = 48;
  worldState.corruption = 78;
  const result = resolveAndApplyPressureEvents(worldState, {
    maxCandidates: 12,
    maxEvents: 1
  });

  assert.equal(result.candidates.length > 1, true);
  assert.equal(result.acceptedOutcomes.length, 1);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
  assert.equal(worldState.eventHistory.length, 1);
  assert.equal(result.outcomes.some((outcome) =>
    outcome.status === "rejected" && outcome.rejectionReasons.join(" ").includes("成案数量")
  ), true);
});

test("S71.8 pressure event batch resolver counts events already accepted this turn", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "旬限知县" });
  worldState.grainReserve = 300;
  worldState.publicOrder = 46;
  worldState.corruption = 84;
  const first = resolveAndApplyPressureEvents(worldState, {
    maxCandidates: 12,
    maxEvents: 1
  });

  assert.equal(first.acceptedOutcomes.length, 1);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);

  worldState.worldPressureEventLedger.cooldowns = {};
  const second = resolveAndApplyPressureEvents(worldState, {
    maxCandidates: 12,
    maxEvents: 1
  });

  assert.equal(second.acceptedOutcomes.length, 0);
  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
  assert.equal(worldState.eventHistory.length, 1);
  assert.equal(second.outcomes.some((outcome) =>
    outcome.status === "rejected" && outcome.rejectionReasons.join(" ").includes("成案数量")
  ), true);
});
