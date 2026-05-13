const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  assertRedactedStateSafe,
  buildPlayerStateEnvelope
} = require("../src/game/redactedState");
const {
  applyPressureEventOutcome,
  collectWorldPressureSignals,
  generatePressureEventCandidates,
  resolvePressureEventCandidate
} = require("../src/game/worldPressureEventGenerator");

function pressureContextWithHiddenExtra(worldState) {
  return collectWorldPressureSignals(worldState, {
    extraEvidence: [{
      refId: "evidence:intel:hidden-pressure",
      sourceView: "intelligenceRumorView",
      sourceId: "hidden-pressure",
      domain: "intel",
      visibility: "server_hidden",
      confidence: 0.99,
      label: "SEALED_HIDDEN_BORDER_TRUTH",
      summary: "hiddenNotes 密档边情 rawSql /mnt/e/LSMNQ/data/sessions/secret.json sk-test-secret",
      relatedRefs: ["server.secret"],
      scopeRefs: ["hidden-frontier"],
      generatedAtTurn: worldState.turnCount
    }]
  });
}

test("S71.8 hidden/private pressure evidence is dropped before candidate generation", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇将领" });
  const pressureContext = pressureContextWithHiddenExtra(worldState);
  const candidates = generatePressureEventCandidates(worldState, {
    pressureContext,
    maxCandidates: 12
  });
  const serialized = JSON.stringify({ pressureContext, candidates });

  assert.equal(pressureContext.signals.some((signal) => signal.ref.includes("hidden-pressure")), false);
  assert.equal(candidates.length > 0, true);
  assert.doesNotMatch(
    serialized,
    /SEALED_HIDDEN_BORDER_TRUTH|hiddenNotes|rawSql|server\.secret|sk-test-secret|data\/sessions|\/mnt\/e\/LSMNQ/
  );
});

test("S71.8 polluted pressure event candidate is rejected and sanitized", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "红队知县" });
  const pressureContext = collectWorldPressureSignals(worldState);
  const visibleRef = pressureContext.signals[0].ref;
  const outcome = resolvePressureEventCandidate(worldState, {
    ruleId: "rumor_wave",
    candidateId: "server.resolve_event_chain",
    incidentKind: "rumor_pressure",
    sourcePressureRefs: [visibleRef],
    sourceDomains: ["intel"],
    affectedRefs: [visibleRef],
    publicSummary: "SEALED_EVENT hiddenNotes rawSql /mnt/e/LSMNQ/secret.env",
    publicClues: ["server.secret truth"],
    confidence: 1,
    severity: 5,
    priority: 99,
    pressureScore: 100,
    cooldownKey: "server.schedule_event_chain",
    privateResultRefs: ["server.secret_row", "/mnt/e/private"],
    riskTags: ["rawSql"],
    statePatch: { publicOrder: 100 }
  }, { pressureContext });
  const serialized = JSON.stringify(outcome);

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /禁止来源|隐藏事实|原始材料|直写字段/);
  assert.deepEqual(outcome.privateResultRefs, []);
  assert.deepEqual(worldState.eventHistory, []);
  assert.doesNotMatch(
    serialized,
    /SEALED_EVENT|hiddenNotes|rawSql|server\.resolve|server\.schedule|server\.secret|statePatch|\/mnt\/e\/LSMNQ|\/mnt\/e\/private/
  );
});

test("S71.8 resolver ignores forged score fields and enforces visible rule shape", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "伪分知县" });
  const pressureContext = collectWorldPressureSignals(worldState);
  const visibleRef = pressureContext.signals[0].ref;
  const outcome = resolvePressureEventCandidate(worldState, {
    ruleId: "city_unrest",
    candidateId: "pressure-event:city_unrest:forged",
    incidentKind: "city_pressure",
    sourcePressureRefs: [visibleRef],
    sourceDomains: ["geography", "market", "local_docket", "events"],
    affectedRefs: [visibleRef],
    publicSummary: "民生扰动伪造候选。",
    confidence: 1,
    severity: 5,
    priority: 100,
    pressureScore: 100,
    score: 100,
    probability: 1,
    cooldownKey: "provider-forged-new-key"
  }, { pressureContext });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /来源数量|重新构造|主压力来源/);
  assert.deepEqual(outcome.stateDelta, {});
  assert.deepEqual(worldState.eventHistory, []);
});

test("S71.8 direct apply keeps state writes whitelisted and public text sanitized", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "直写防线" });
  const before = {
    turnCount: worldState.turnCount,
    publicOrder: worldState.publicOrder,
    eventCount: worldState.eventHistory.length
  };

  applyPressureEventOutcome(worldState, {
    status: "accepted",
    outcomeId: "direct-unsafe-outcome",
    ruleId: "rumor_wave",
    incidentKind: "rumor_pressure",
    label: "传闻流动",
    sourcePressureRefs: ["visible:rumor"],
    sourceDomains: ["intel"],
    affectedRefs: ["visible:rumor"],
    publicSummary: "hiddenNotes rawSql /mnt/e/LSMNQ/secret.env sk-test-secret",
    evidenceSummary: "server.secret",
    severity: 5,
    score: 100,
    probability: 1,
    cooldownKey: "direct-safe-key",
    cooldownTurns: 2,
    stateDelta: {
      publicOrder: -3,
      turnCount: 99,
      worldState: 1000
    },
    publicEvent: {
      summary: "hiddenNotes rawSql /mnt/e/LSMNQ/secret.env sk-test-secret"
    }
  });

  assert.equal(worldState.turnCount, before.turnCount);
  assert.equal(worldState.publicOrder, before.publicOrder - 3);
  assert.equal(worldState.eventHistory.length, before.eventCount + 1);
  assert.doesNotMatch(
    worldState.eventHistory.at(-1),
    /hiddenNotes|rawSql|\/mnt\/e\/LSMNQ|sk-test-secret|server\.secret/
  );
  assert.deepEqual(worldState.worldPressureEventLedger.records[0].stateDelta, { publicOrder: -3 });
});

test("S71.8 accepted pressure event ledger stays out of redacted player state", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "脱敏知县" });
  const pressureContext = collectWorldPressureSignals(worldState);
  const candidate = generatePressureEventCandidates(worldState, {
    pressureContext,
    maxCandidates: 12
  }).find((entry) => entry.ruleId === "city_unrest");
  assert.ok(candidate, "缺少民生扰动候选");

  const outcome = resolvePressureEventCandidate(worldState, candidate, { pressureContext });
  assert.equal(outcome.status, "accepted");
  applyPressureEventOutcome(worldState, outcome);

  const envelope = buildPlayerStateEnvelope(worldState);
  const payload = JSON.stringify(envelope);

  assert.equal(worldState.worldPressureEventLedger.records.length, 1);
  assert.equal(envelope.worldState.worldPressureEventLedger, undefined);
  assert.equal(envelope.worldState.eventHistory.length > 0, true);
  assert.doesNotMatch(payload, /worldPressureEventLedger|auditRecord|sourcePressureRefs|rawSql|hiddenNotes|server\./);
  assertRedactedStateSafe(envelope);
});
