const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const {
  applyMilitaryDiplomacyOutcome,
  resolveCampaignOrDefense
} = require("../src/game/militaryDiplomacyResolver");
const { buildPlayerStateEnvelope } = require("../src/game/redactedState");
const { createSessionRecord } = require("../src/storage/sessionRecord");

function militaryEvidence(worldState, actorProfile) {
  const rows = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((entry) => entry.domain === "military")
    .slice(0, 2);
  assert.equal(rows.length, 2, "军务证据不足");
  return rows;
}

test("S71.7 military resolver rejects hidden or raw proposal payloads", () => {
  const worldState = createInitialState({ role: "general", playerName: "脱敏将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidenceRefs = militaryEvidence(worldState, actorProfile).map((entry) => entry.ref);

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs,
    institutionalPath: "frontier_command",
    publicSummary: "SEALED_SECRET_FRONTIER rawSql /mnt/e/LSMNQ/data/sessions/leak.json",
    hiddenNotes: "SEALED_SECRET_FRONTIER",
    statePatch: { borderThreat: 0 },
    privateResultRefs: ["hidden:frontier-truth"]
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /隐藏情报|原始材料|直写字段/);
  assert.doesNotMatch(JSON.stringify(outcome), /SEALED_SECRET_FRONTIER|\/mnt\/e\/LSMNQ|hidden:frontier-truth/);
});

test("S71.7 public event and redacted player state do not expose resolver internals", () => {
  const worldState = createInitialState({ role: "general", playerName: "公开摘要将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidence = militaryEvidence(worldState, actorProfile);
  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "scout",
    evidenceRefs: evidence.map((entry) => entry.ref),
    institutionalPath: "frontier_command",
    publicSummary: "按可见军情侦察。"
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  const publicSerialized = JSON.stringify({
    publicResolution: outcome.publicResolution,
    publicEvent: outcome.publicEvent
  });
  for (const entry of evidence) {
    assert.equal(publicSerialized.includes(entry.ref), false);
    assert.equal(publicSerialized.includes(entry.id), false);
  }

  applyMilitaryDiplomacyOutcome(worldState, outcome);
  const envelope = buildPlayerStateEnvelope(createSessionRecord(worldState, {
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    revision: 1
  }));
  const serialized = JSON.stringify(envelope);

  assert.equal(worldState.militaryDiplomacyLedger.records.length, 1);
  assert.equal(envelope.worldState.militaryDiplomacyLedger, undefined);
  assert.doesNotMatch(serialized, /militaryDiplomacyLedger|auditRecord|rawSql|statePatch|SEALED_/);
});
