const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyJudicialCaseOutcome,
  normalizeCaseProposal,
  resolveJudicialCase
} = require("../src/game/judicialCaseResolver");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const {
  assertRedactedStateSafe,
  buildPlayerStateEnvelope
} = require("../src/game/redactedState");

function scopedDocket(worldState, actorProfile) {
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()].find((item) =>
    item.domain === "local_docket" &&
    (item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );
  assert.ok(entry, "缺少辖区案牍证据");
  return entry;
}

function peopleEvidence(worldState, actorProfile) {
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === "people");
  assert.ok(entry, "缺少可见人物证据");
  return entry;
}

test("S71.6 judicial normalizer strips hidden/raw text and private result refs", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "慎刑知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const normalized = normalizeCaseProposal({
    caseAction: "judge",
    publicSummary: "SEALED_CASE hiddenNotes rawSql /mnt/e/LSMNQ/data/sessions/secret.json sk-test-secret",
    evidenceRefs: ["local_docket:test"],
    privateResultRefs: ["hidden:evidence"],
    statePatch: { publicOrder: 999 }
  }, { actorProfile });
  const payload = JSON.stringify(normalized);

  assert.equal(normalized.publicSummary, "判决待服务器裁决。");
  assert.deepEqual(normalized.privateResultRefs, []);
  assert.equal(normalized.safetyFlags.length > 0, true);
  assert.doesNotMatch(payload, /SEALED_CASE|hiddenNotes|rawSql|statePatch|sk-test-secret|\/mnt\/e\/LSMNQ/);
});

test("S71.6 polluted judicial outcome rejects and keeps audit hidden-safe", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "风宪知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const docket = scopedDocket(worldState, actorProfile);
  const person = peopleEvidence(worldState, actorProfile);
  const outcome = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: [docket.ref, person.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "SEALED_CASE provider proposal prompt_retrieval_index data/sessions/secret.json",
    worldState: { publicOrder: 999 },
    rawSql: "update world_sessions set world_state_json='SEALED'"
  }, { actorProfile });
  const payload = JSON.stringify(outcome);

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /禁止来源|隐藏证据|直写字段/);
  assert.equal(outcome.auditRecord.safety.proposalPayloadIncluded, false);
  assert.equal(outcome.auditRecord.safety.stateSnapshotIncluded, false);
  assert.equal(outcome.auditRecord.safety.sqlIncluded, false);
  assert.doesNotMatch(
    payload,
    /SEALED_CASE|prompt_retrieval_index|world_sessions|world_state_json|data\/sessions|rawSql|statePatch|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/
  );
});

test("S71.6 accepted judicial ledger stays out of redacted player state and public docket hides evidence refs", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "明刑知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const docket = scopedDocket(worldState, actorProfile);
  const person = peopleEvidence(worldState, actorProfile);
  const outcome = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: [docket.ref, person.ref],
    targetRefs: [person.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "据辖区案牍与人证判决。",
    caseSeverity: 3
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.equal(JSON.stringify(outcome.publicDocket).includes(docket.ref), false);
  assert.equal(JSON.stringify(outcome.publicDocket).includes(docket.id), false);
  assert.equal(JSON.stringify(outcome.publicDocket).includes(person.id), false);
  assert.equal(JSON.stringify(outcome.publicEvent).includes(docket.ref), false);
  assert.equal(JSON.stringify(outcome.publicEvent).includes(docket.id), false);
  assert.equal(JSON.stringify(outcome.publicEvent).includes(person.id), false);
  applyJudicialCaseOutcome(worldState, outcome);
  assert.equal(worldState.judicialCaseLedger.records.length, 1);

  const envelope = buildPlayerStateEnvelope(worldState);
  const payload = JSON.stringify(envelope);

  assert.equal(envelope.worldState.judicialCaseLedger, undefined);
  assert.equal(envelope.worldState.eventHistory.length > 0, true);
  assert.doesNotMatch(payload, /judicialCaseLedger|auditRecord|rawSql|statePatch|SEALED_CASE/);
  assertRedactedStateSafe(envelope);
});
