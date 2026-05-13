const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyCityPolicyOutcome,
  resolveAndApplyCityPolicy,
  resolveCityPolicy
} = require("../src/game/cityPolicyResolver");
const { createInitialState } = require("../src/game/initialState");
const {
  buildResolverInputContext,
  filterResolverInputForActor
} = require("../src/game/resolverInputContext");

function cityPolicyContext(worldState, actorProfile) {
  return filterResolverInputForActor(
    buildResolverInputContext(worldState, { actorProfile }),
    actorProfile
  );
}

function scopedEvidence(worldState, actorProfile, domain = "economy") {
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  const context = cityPolicyContext(worldState, actorProfile);
  const evidence = (context[domain] || []).find((item) =>
    (item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );
  assert.ok(evidence, `缺少 ${domain} 辖区证据`);
  return evidence;
}

test("S71.5 city policy resolver applies accepted relief with bounded fiscal and public-order effects", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "广州知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = scopedEvidence(worldState, actorProfile, "economy");
  const before = {
    treasury: worldState.treasury,
    grainReserve: worldState.grainReserve,
    publicOrder: worldState.publicOrder,
    corruption: worldState.corruption,
    eventCount: worldState.eventHistory.length
  };

  const outcome = resolveCityPolicy(worldState, {
    policyType: "relief",
    evidenceRefs: [evidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "广州灾赈核发，拟开仓济民。",
    intensity: 1
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.deepEqual(outcome.rejectionReasons, []);
  assert.deepEqual(outcome.stateDelta, {
    treasury: -90,
    grainReserve: -120,
    publicOrder: 8,
    corruption: -1
  });
  assert.equal(JSON.stringify(worldState.cityPolicyLedger || {}), "{}");

  applyCityPolicyOutcome(worldState, outcome);

  assert.equal(worldState.treasury, before.treasury - 90);
  assert.equal(worldState.grainReserve, before.grainReserve - 120);
  assert.equal(worldState.publicOrder, before.publicOrder + 8);
  assert.equal(worldState.corruption, before.corruption - 1);
  assert.equal(worldState.cityPolicyLedger.records.length, 1);
  assert.equal(worldState.eventHistory.length, before.eventCount + 1);
  assert.match(worldState.eventHistory.at(-1), /开仓赈济|服务器裁决/);
  assert.equal(outcome.auditRecord.safety.serverAdjudicated, true);
  assert.equal(outcome.auditRecord.safety.proposalPayloadIncluded, false);
});

test("S71.5 city policy resolver can resolve and apply land survey without provider writes", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = scopedEvidence(worldState, actorProfile, "economy");
  const beforeTreasury = worldState.treasury;
  const beforeOrder = worldState.publicOrder;
  const beforeCorruption = worldState.corruption;

  const outcome = resolveAndApplyCityPolicy(worldState, {
    policyType: "land_survey",
    evidenceRefs: [evidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "按本县案牍清丈田亩，复核税粮旧册。",
    intensity: 1,
    expectedBenefits: ["补足钱粮"],
    counterCosts: ["士绅阻力上升"]
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.equal(worldState.treasury, beforeTreasury + 110);
  assert.equal(worldState.publicOrder, beforeOrder - 2);
  assert.equal(worldState.corruption, beforeCorruption - 3);
  assert.equal(worldState.player.performanceMerit > 0, true);
  assert.equal(worldState.cityPolicyLedger.records[0].policyType, "land_survey");
  assert.doesNotMatch(JSON.stringify(outcome), /statePatch|worldState|rawSql/);
});
