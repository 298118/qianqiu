const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyCityPolicyOutcome,
  normalizeCityPolicyProposal,
  resolveCityPolicy
} = require("../src/game/cityPolicyResolver");
const { createInitialState } = require("../src/game/initialState");
const {
  assertRedactedStateSafe,
  buildPlayerStateEnvelope
} = require("../src/game/redactedState");
const {
  buildResolverInputContext,
  filterResolverInputForActor
} = require("../src/game/resolverInputContext");

function scopedEconomyEvidence(worldState, actorProfile) {
  const context = filterResolverInputForActor(
    buildResolverInputContext(worldState, { actorProfile }),
    actorProfile
  );
  const evidence = (context.economy || []).find((item) =>
    (item.scopeRefs || []).some((scopeRef) => actorProfile.jurisdictionRefs.includes(scopeRef))
  );
  assert.ok(evidence, "缺少辖区经济证据");
  return evidence;
}

test("S71.5 city policy normalizer strips hidden/raw text and private result refs", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清查知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const normalized = normalizeCityPolicyProposal({
    policyType: "relief",
    publicSummary: "SEALED_CITY_POLICY hiddenNotes rawSql /mnt/e/LSMNQ/data/sessions/secret.json sk-test-secret",
    evidenceRefs: ["evidence:economy:test"],
    privateResultRefs: ["raw_table:city"],
    statePatch: { treasury: 999999 }
  }, { actorProfile });
  const payload = JSON.stringify(normalized);

  assert.equal(normalized.publicSummary, "开仓赈济待服务器裁决。");
  assert.deepEqual(normalized.privateResultRefs, []);
  assert.equal(normalized.safetyFlags.length > 0, true);
  assert.doesNotMatch(payload, /SEALED_CITY_POLICY|hiddenNotes|rawSql|statePatch|sk-test-secret|\/mnt\/e\/LSMNQ/);
});

test("S71.5 rejected polluted city policy outcome keeps audit hidden-safe", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "风纪知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = scopedEconomyEvidence(worldState, actorProfile);
  const outcome = resolveCityPolicy(worldState, {
    policyType: "relief",
    evidenceRefs: [evidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "SEALED_CITY_POLICY provider proposal prompt_retrieval_index data/sessions/secret.json",
    worldState: { treasury: 999999 },
    rawSql: "update world_sessions set world_state_json='SEALED'"
  }, { actorProfile });
  const payload = JSON.stringify(outcome);

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /禁止来源|直写字段/);
  assert.equal(outcome.auditRecord.safety.proposalPayloadIncluded, false);
  assert.equal(outcome.auditRecord.safety.stateSnapshotIncluded, false);
  assert.equal(outcome.auditRecord.safety.sqlIncluded, false);
  assert.doesNotMatch(
    payload,
    /SEALED_CITY_POLICY|prompt_retrieval_index|world_sessions|world_state_json|data\/sessions|rawSql|statePatch|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S71.5 accepted city policy ledger stays out of redacted player state", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "赈济知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = scopedEconomyEvidence(worldState, actorProfile);
  const outcome = resolveCityPolicy(worldState, {
    policyType: "relief",
    evidenceRefs: [evidence.refId],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "按辖区钱粮证据开仓赈济。",
    intensity: 1
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  applyCityPolicyOutcome(worldState, outcome);
  assert.equal(worldState.cityPolicyLedger.records.length, 1);

  const envelope = buildPlayerStateEnvelope(worldState);
  const payload = JSON.stringify(envelope);

  assert.equal(envelope.worldState.cityPolicyLedger, undefined);
  assert.equal(envelope.worldState.eventHistory.length > 0, true);
  assert.doesNotMatch(payload, /cityPolicyLedger|auditRecord|rawSql|statePatch|SEALED_CITY_POLICY/);
  assertRedactedStateSafe(envelope);
});
