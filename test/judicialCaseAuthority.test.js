const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { resolveJudicialCase } = require("../src/game/judicialCaseResolver");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");

function firstEvidence(worldState, actorProfile, domain, predicate = () => true) {
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === domain && predicate(item));
  assert.ok(entry, `缺少 ${domain} 证据`);
  return entry;
}

test("S71.6 judicial resolver rejects scholar overreach without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗士子" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const before = JSON.stringify(worldState);

  const outcome = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: ["events:forged-case"],
    publicSummary: "书生越权断案。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /权限不足|刑名工具组|证据/);
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), JSON.parse(before));
  assert.deepEqual(outcome.stateDelta, {});
});

test("S71.6 judicial resolver rejects conviction with insufficient evidence", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "慎刑知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  const docket = firstEvidence(worldState, actorProfile, "local_docket", (item) =>
    (item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );

  const outcome = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: [docket.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "仅凭一件案牍即拟定罪。",
    caseSeverity: 3
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /证据不足|可信度不足/);
});

test("S71.6 local magistrate cannot judge a major case outside jurisdiction", () => {
  const localWorld = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const broadWorld = createInitialState({ role: "minister", playerName: "部院堂官" });
  const actorProfile = buildPlayerAiActorProfile(localWorld);
  const actorScopes = new Set(actorProfile.jurisdictionRefs || []);
  const foreignDocket = firstEvidence(broadWorld, actorProfile, "local_docket", (item) =>
    (item.scopeRefs || []).length > 0 &&
    !(item.scopeRefs || []).some((scopeRef) => actorScopes.has(scopeRef))
  );
  const person = firstEvidence(broadWorld, actorProfile, "people");

  const outcome = resolveJudicialCase(broadWorld, {
    caseAction: "judge",
    evidenceRefs: [foreignDocket.ref, person.ref],
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "县令越辖判外府重案。",
    caseSeverity: 5
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /不属于当前 actor 辖区/);
});

test("S71.6 high officials need institutional path for direct major punishment", () => {
  const worldState = createInitialState({ role: "minister", playerName: "刑部堂官" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const docket = firstEvidence(worldState, actorProfile, "local_docket");
  const person = firstEvidence(worldState, actorProfile, "people");

  const missingPath = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: [docket.ref, person.ref],
    publicSummary: "部院直接判地方重案，却无制度路径。",
    caseSeverity: 5
  }, { actorProfile });
  const withPath = resolveJudicialCase(worldState, {
    caseAction: "judge",
    evidenceRefs: [docket.ref, person.ref],
    institutionalPath: "ministry_review",
    publicSummary: "刑部会审后照例判决。",
    caseSeverity: 5
  }, { actorProfile });

  assert.equal(missingPath.status, "rejected");
  assert.match(missingPath.rejectionReasons.join(" "), /制度路径/);
  assert.equal(withPath.status, "accepted");
});

test("S71.6 punitive case actions require visible docket evidence", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "慎刑知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const nonDocketEvidence = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((item) => item.domain !== "local_docket" && item.sourceView !== "localAffairsDocketView.dockets");
  assert.equal(nonDocketEvidence.length >= 2, true, "缺少非案牍证据 fixture");

  const outcome = resolveJudicialCase(worldState, {
    caseAction: "fine",
    evidenceRefs: nonDocketEvidence.slice(0, 3).map((item) => item.ref),
    jurisdictionRef: actorProfile.jurisdictionRefs[0],
    publicSummary: "只凭人物传闻和泛事件拟罚银。",
    caseSeverity: 2
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /案牍证据/);
});
