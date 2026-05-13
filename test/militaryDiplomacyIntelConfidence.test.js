const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const { resolveCampaignOrDefense } = require("../src/game/militaryDiplomacyResolver");
const { buildResolverInputContext } = require("../src/game/resolverInputContext");

function lowConfidenceEvidence(refId, sourceId, summary) {
  return {
    refId,
    sourceView: "militaryDiplomacyView",
    sourceId,
    domain: "military",
    visibility: "public",
    confidence: 0.2,
    label: "低可信边报",
    summary,
    relatedRefs: [],
    scopeRefs: ["frontier-low-confidence"],
    generatedAtTurn: 0
  };
}

function evidence(refId, sourceView, sourceId, domain, confidence, summary) {
  return {
    refId,
    sourceView,
    sourceId,
    domain,
    visibility: "public",
    confidence,
    label: summary,
    summary,
    relatedRefs: [],
    scopeRefs: ["frontier-low-confidence"],
    generatedAtTurn: 0
  };
}

function militaryRefs(worldState, actorProfile) {
  return [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((entry) => entry.domain === "military");
}

test("S71.7 high-risk battle rejects low-confidence frontier reports", () => {
  const worldState = createInitialState({ role: "general", playerName: "慎战将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const extraEvidence = [
    lowConfidenceEvidence("evidence:military:low-frontier-a", "low-frontier-a", "边卒传闻未核。"),
    lowConfidenceEvidence("evidence:military:low-frontier-b", "low-frontier-b", "商旅言敌骑将至，未有印信。")
  ];
  const resolverInputContext = buildResolverInputContext(worldState, { actorProfile });
  resolverInputContext.military = extraEvidence.map((entry) => ({
    ...entry,
    freshness: "current"
  }));

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs: extraEvidence.map((entry) => entry.refId),
    institutionalPath: "frontier_command",
    publicSummary: "只据低可信边报拟会战。",
    riskLevel: 4
  }, { actorProfile, resolverInputContext });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /证据可信度不足|低可信边报/);
  assert.equal(outcome.auditRecord.evidenceConfidence, 0.2);
  assert.equal(outcome.auditRecord.safety.hiddenIncluded, false);
});

test("S71.7 high-risk battle rejects low-confidence S70 military bridge evidence", () => {
  const worldState = createInitialState({ role: "general", playerName: "慎战将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const refs = militaryRefs(worldState, actorProfile).slice(0, 2);
  assert.ok(refs.every((entry) => Number(entry.confidence) < 0.58));

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs: refs.map((entry) => entry.ref),
    institutionalPath: "frontier_command",
    publicSummary: "据两条低可信边面材料拟会战。",
    riskLevel: 4
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /低可信边报|军务态势可信度不足/);
  assert.ok(outcome.auditRecord.evidenceConfidence < 0.58);
});

test("S71.7 high-risk battle rejects low-confidence military evidence despite strong side evidence", () => {
  const worldState = createInitialState({ role: "general", playerName: "慎战将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const extraEvidence = [
    evidence("evidence:military:low-frontier", "militaryDiplomacyView", "low-frontier", "military", 0.2, "低可信边报。"),
    evidence("evidence:geography:strong-frontier", "worldGeographyView", "strong-frontier", "geography", 0.95, "边地形势清晰。"),
    evidence("evidence:economy:strong-grain", "economicFiscalView", "strong-grain", "economy", 0.95, "钱粮核验充分。")
  ];
  const resolverInputContext = buildResolverInputContext(worldState, { actorProfile, extraEvidence });
  resolverInputContext.military = [{
    ...extraEvidence[0],
    freshness: "current"
  }];

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs: extraEvidence.map((entry) => entry.refId),
    institutionalPath: "frontier_command",
    publicSummary: "据一条低可信军情和强旁证拟会战。",
    riskLevel: 4
  }, { actorProfile, resolverInputContext });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /军务态势可信度不足/);
  assert.ok(outcome.auditRecord.evidenceScore > 1);
  assert.ok(outcome.auditRecord.evidenceConfidence > 0.58);
});
