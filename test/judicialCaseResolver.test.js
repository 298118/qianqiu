const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const {
  applyJudicialCaseOutcome,
  buildCaseEvidenceContext,
  resolveAndApplyJudicialCase,
  resolveJudicialCase
} = require("../src/game/judicialCaseResolver");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");

function evidence(worldState, actorProfile, domain, predicate = () => true) {
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === domain && predicate(item));
  assert.ok(entry, `缺少 ${domain} 可见证据`);
  return entry;
}

function localDocketEvidence(worldState, actorProfile) {
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  return evidence(worldState, actorProfile, "local_docket", (item) =>
    (item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );
}

test("S71.6 judicial resolver applies accepted verdict with bounded public-order and case effects", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "刑名知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const docket = localDocketEvidence(worldState, actorProfile);
  const person = evidence(worldState, actorProfile, "people");
  const before = {
    publicOrder: worldState.publicOrder,
    corruption: worldState.corruption,
    pendingLawsuits: worldState.player.pendingLawsuits,
    eventCount: worldState.eventHistory.length
  };

  const outcome = resolveJudicialCase(worldState, {
    caseAction: "judge",
    caseId: "case-local-judicial-001",
    evidenceRefs: [docket.ref, person.ref],
    targetRefs: [person.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "据辖区案牍与堂上人证拟照例判决。",
    caseSeverity: 3
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.deepEqual(outcome.rejectionReasons, []);
  assert.deepEqual(outcome.stateDelta, { publicOrder: 5, corruption: -1 });
  assert.equal(JSON.stringify(worldState.judicialCaseLedger || {}), "{}");
  assert.equal(JSON.stringify(outcome.publicDocket).includes(docket.ref), false);
  assert.match(outcome.publicDocket.evidenceSummary, /2条可见材料/);

  applyJudicialCaseOutcome(worldState, outcome);

  assert.equal(worldState.publicOrder, before.publicOrder + 5);
  assert.equal(worldState.corruption, before.corruption - 1);
  assert.equal(worldState.player.pendingLawsuits, before.pendingLawsuits - 3);
  assert.equal(worldState.judicialCaseLedger.records.length, 1);
  assert.equal(worldState.eventHistory.length, before.eventCount + 1);
  assert.match(worldState.eventHistory.at(-1), /判决|服务器裁决|可见材料/);
  assert.equal(outcome.auditRecord.safety.serverAdjudicated, true);
  assert.equal(outcome.auditRecord.safety.proposalPayloadIncluded, false);
});

test("S71.6 judicial resolver can resolve and apply mediation without provider writes", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "息讼知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const docket = localDocketEvidence(worldState, actorProfile);
  const beforeOrder = worldState.publicOrder;
  const beforeLawsuits = worldState.player.pendingLawsuits;

  const outcome = resolveAndApplyJudicialCase(worldState, {
    caseAction: "mediate",
    evidenceRefs: [docket.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "以辖区词讼案牍调停息讼。",
    caseSeverity: 2
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.equal(worldState.publicOrder, beforeOrder + 3);
  assert.equal(worldState.player.pendingLawsuits, beforeLawsuits - 2);
  assert.equal(worldState.judicialCaseLedger.records[0].caseAction, "mediate");
  assert.doesNotMatch(JSON.stringify(outcome), /statePatch|worldState|rawSql/);
});

test("S71.6 judicial evidence context tolerates empty case id", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "慎刑知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const caseContext = buildCaseEvidenceContext(worldState, "", { actorProfile });

  assert.ok(caseContext.context);
  assert.ok(caseContext.evidenceByRef instanceof Map);
  assert.equal(caseContext.context.scene.intentType, "judicial_case");
});
