const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const {
  applyMilitaryDiplomacyOutcome,
  resolveAndApplyMilitaryDiplomacy,
  resolveCampaignOrDefense,
  resolveDiplomaticMove
} = require("../src/game/militaryDiplomacyResolver");

function visibleEvidence(worldState, actorProfile, domain, predicate = () => true) {
  const rows = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((entry) => entry.domain === domain && predicate(entry));
  assert.ok(rows.length, `缺少 ${domain} 可见证据`);
  return rows;
}

function strengthenFrontierIntel(worldState) {
  for (const frontier of worldState.worldGeography?.frontierZones || []) {
    frontier.intelConfidence = 90;
  }
  for (const country of worldState.worldGeography?.countries || []) {
    country.intelConfidence = 90;
    country.intelligenceReliability = 90;
  }
}

test("S71.7 military resolver applies accepted battle order with bounded state effects", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇将领" });
  strengthenFrontierIntel(worldState);
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const evidenceRefs = visibleEvidence(worldState, actorProfile, "military").slice(0, 2).map((entry) => entry.ref);
  const before = {
    grainReserve: worldState.grainReserve,
    armyMorale: worldState.armyMorale,
    borderThreat: worldState.borderThreat,
    supply: worldState.player.supply,
    campaignRisk: worldState.player.campaignRisk,
    battleReputation: worldState.player.battleReputation,
    eventCount: worldState.eventHistory.length
  };

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs,
    institutionalPath: "frontier_command",
    publicSummary: "据两处边面军情，拟接战会剿。",
    riskLevel: 4
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.deepEqual(outcome.rejectionReasons, []);
  assert.deepEqual(outcome.stateDelta, { grainReserve: -60, armyMorale: 2, borderThreat: -5 });
  assert.equal(JSON.stringify(worldState.militaryDiplomacyLedger || {}), "{}");

  applyMilitaryDiplomacyOutcome(worldState, outcome);

  assert.equal(worldState.grainReserve, before.grainReserve - 60);
  assert.equal(worldState.armyMorale, before.armyMorale + 2);
  assert.equal(worldState.borderThreat, before.borderThreat - 5);
  assert.equal(worldState.player.supply, before.supply - 35);
  assert.equal(worldState.player.campaignRisk, before.campaignRisk + 5);
  assert.equal(worldState.player.battleReputation, before.battleReputation + 3);
  assert.equal(worldState.militaryDiplomacyLedger.records.length, 1);
  assert.equal(worldState.militaryDiplomacyLedger.records[0].actionKind, "engage");
  assert.equal(worldState.eventHistory.length, before.eventCount + 1);
  assert.match(worldState.eventHistory.at(-1), /会战|服务器裁决|可见材料/);
  assert.equal(outcome.auditRecord.safety.serverAdjudicated, true);
  assert.equal(outcome.auditRecord.safety.proposalPayloadIncluded, false);
});

test("S71.7 diplomacy resolver adjudicates declare-war request without directly writing war truth", () => {
  const worldState = createInitialState({ role: "emperor", playerName: "御前" });
  strengthenFrontierIntel(worldState);
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const diplomacy = visibleEvidence(worldState, actorProfile, "diplomacy")[0];
  const military = visibleEvidence(worldState, actorProfile, "military")[0];
  const market = visibleEvidence(worldState, actorProfile, "market")[0];
  const before = {
    treasury: worldState.treasury,
    grainReserve: worldState.grainReserve,
    armyMorale: worldState.armyMorale,
    borderThreat: worldState.borderThreat
  };

  const outcome = resolveDiplomaticMove(worldState, {
    moveKind: "declare_war_request",
    evidenceRefs: [diplomacy.ref, military.ref, market.ref],
    institutionalPath: "imperial_edict",
    publicSummary: "据边情、军情与府库材料，请议宣战。",
    riskLevel: 5
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.equal(outcome.resolverKind, "diplomacy");
  assert.equal(outcome.actionKind, "declare_war_request");

  applyMilitaryDiplomacyOutcome(worldState, outcome);

  assert.equal(worldState.treasury, before.treasury - 90);
  assert.equal(worldState.grainReserve, before.grainReserve - 90);
  assert.equal(worldState.armyMorale, before.armyMorale + 3);
  assert.equal(worldState.borderThreat, before.borderThreat + 5);
  assert.equal(worldState.militaryDiplomacyLedger.records[0].resolverKind, "diplomacy");
  assert.equal(worldState.worldGeography?.frontierWarState, undefined);
  assert.equal(worldState.diplomaticTruth, undefined);
});

test("S71.7 military resolver can resolve and apply resupply from economy evidence", () => {
  const worldState = createInitialState({ role: "general", playerName: "筹粮将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const market = visibleEvidence(worldState, actorProfile, "market")[0];
  const military = visibleEvidence(worldState, actorProfile, "military")[0];
  const beforeGrain = worldState.grainReserve;
  const beforeSupply = worldState.player.supply;

  const outcome = resolveAndApplyMilitaryDiplomacy(worldState, {
    toolName: "military.propose_order",
    orderKind: "resupply",
    evidenceRefs: [market.ref, military.ref],
    publicSummary: "据粮道与边面材料调拨粮饷。",
    riskLevel: 2
  }, { actorProfile });

  assert.equal(outcome.status, "accepted");
  assert.equal(worldState.grainReserve, beforeGrain - 40);
  assert.equal(worldState.player.supply, beforeSupply + 40);
  assert.equal(worldState.militaryDiplomacyLedger.records[0].actionKind, "resupply");
  assert.doesNotMatch(JSON.stringify(outcome), /statePatch|worldState|rawSql/);
});
