const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { resolveCityPolicy } = require("../src/game/cityPolicyResolver");
const { createInitialState } = require("../src/game/initialState");
const {
  buildResolverInputContext,
  filterResolverInputForActor
} = require("../src/game/resolverInputContext");

function filteredContext(worldState, actorProfile) {
  return filterResolverInputForActor(
    buildResolverInputContext(worldState, { actorProfile }),
    actorProfile
  );
}

function firstEvidence(worldState, actorProfile, domain, predicate = () => true) {
  const context = filteredContext(worldState, actorProfile);
  const evidence = (context[domain] || []).find(predicate);
  assert.ok(evidence, `缺少 ${domain} 证据`);
  return evidence;
}

test("S71.5 city policy rejects scholar overreach without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗士子" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const before = JSON.stringify(worldState);
  const evidence = firstEvidence(worldState, actorProfile, "geography");

  const outcome = resolveCityPolicy(worldState, {
    policyType: "tax_collection",
    evidenceRefs: [evidence.refId],
    publicSummary: "书生越权征粮。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /权限不足|城市政策工具组/);
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), JSON.parse(before));
  assert.deepEqual(outcome.stateDelta, {});
});

test("S71.5 city policy rejects local magistrate evidence outside jurisdiction", () => {
  const localWorld = createInitialState({ role: "magistrate", playerName: "广州知县" });
  const broadWorld = createInitialState({ role: "minister", playerName: "部院堂官" });
  const actorProfile = buildPlayerAiActorProfile(localWorld);
  const actorScopes = new Set(actorProfile.jurisdictionRefs);
  const foreignEvidence = firstEvidence(broadWorld, actorProfile, "economy", (item) =>
    (item.scopeRefs || []).length > 0 &&
    !(item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );

  const outcome = resolveCityPolicy(broadWorld, {
    policyType: "relief",
    evidenceRefs: [foreignEvidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "挪用本县权限处置外辖灾赈。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /不属于当前 actor 辖区/);
});

test("S71.5 city policy rejects insufficient treasury or grain resources", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "穷县知县" });
  worldState.treasury = 40;
  worldState.grainReserve = 50;
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = firstEvidence(worldState, actorProfile, "economy", (item) =>
    (item.scopeRefs || []).some((scopeRef) => actorProfile.jurisdictionRefs.includes(scopeRef))
  );

  const outcome = resolveCityPolicy(worldState, {
    policyType: "relief",
    evidenceRefs: [evidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "库空粮少仍欲开仓大赈。",
    intensity: 1
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /府库不足|粮储不足/);
});
