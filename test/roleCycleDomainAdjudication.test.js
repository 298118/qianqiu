const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  classifyRoleCycleDomainIntent,
  runRoleCycleDomainAdjudicationStep,
  selectEvidenceRefs
} = require("../src/game/roleCycleDomainAdjudication");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");

test("S88.5.3 role-cycle domain classifier recognizes low-risk follow-up intents", () => {
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "magistrate" }),
      "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。"
    ),
    "magistrate_market_policy"
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据舆图与战事档案开军议，先遣哨核边面。"
    ),
    "general_war_council_scout"
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据战事档案开军议，先调粮道补给。"
    ),
    "general_war_council_resupply"
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据舆图会战出击。"
    ),
    null
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据舆图夜袭进兵。"
    ),
    null
  );
});

test("S88.5.3 read-only role-cycle entry phrases do not mutate resolver ledgers", () => {
  const magistrateState = createInitialState({ role: "magistrate", playerName: "阅市知县" });
  const magistrate = runRoleCycleDomainAdjudicationStep(magistrateState, "查市价与牙行回报。");

  assert.equal(magistrate.outcome, null);
  assert.equal(magistrateState.cityPolicyLedger, undefined);

  const grainReviewState = createInitialState({ role: "magistrate", playerName: "阅案知县" });
  const grainReview = runRoleCycleDomainAdjudicationStep(grainReviewState, "查看平粜旧案，复核稳价记录。");

  assert.equal(grainReview.outcome, null);
  assert.equal(grainReviewState.cityPolicyLedger, undefined);

  const genericCouncilState = createInitialState({ role: "general", playerName: "阅图将领" });
  const genericCouncil = runRoleCycleDomainAdjudicationStep(genericCouncilState, "据舆图开军议。");

  assert.equal(genericCouncil.outcome, null);
  assert.equal(genericCouncilState.militaryDiplomacyLedger, undefined);

  const archiveReviewState = createInitialState({ role: "general", playerName: "阅档将领" });
  const archiveReview = runRoleCycleDomainAdjudicationStep(archiveReviewState, "开军议查看战事档案。");

  assert.equal(archiveReview.outcome, null);
  assert.equal(archiveReviewState.militaryDiplomacyLedger, undefined);

  const resupplyReviewState = createInitialState({ role: "general", playerName: "阅粮将领" });
  const resupplyReview = runRoleCycleDomainAdjudicationStep(resupplyReviewState, "开军议查看补给记录。");

  assert.equal(resupplyReview.outcome, null);
  assert.equal(resupplyReviewState.militaryDiplomacyLedger, undefined);

  const scoutReviewState = createInitialState({ role: "general", playerName: "阅哨将领" });
  const scoutReview = runRoleCycleDomainAdjudicationStep(scoutReviewState, "翻看侦察案卷。");

  assert.equal(scoutReview.outcome, null);
  assert.equal(scoutReviewState.militaryDiplomacyLedger, undefined);
});

test("S88.5.3 magistrate market entry resolves through city policy with visible market evidence", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "市价知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const refs = selectEvidenceRefs(worldState, actorProfile, ["market"], [], 1);

  assert.equal(refs.length, 1);
  assert.equal(refs[0].startsWith("market:"), true);

  const result = runRoleCycleDomainAdjudicationStep(
    worldState,
    "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。"
  );
  const serialized = JSON.stringify(result);

  assert.equal(result.outcome.status, "accepted");
  assert.equal(result.outcome.resolver, "city_policy");
  assert.equal(result.outcome.intent, "market_regulation");
  assert.equal(result.outcome.evidenceRefs.every((ref) => ref.startsWith("market:")), true);
  assert.equal(worldState.cityPolicyLedger.records.length, 1);
  assert.equal(worldState.cityPolicyLedger.records[0].policyType, "market_regulation");
  assert.ok(result.attributeChanges.some((change) => change.reason === "角色循环服务器裁决"));
  assert.match(worldState.eventHistory.at(-1), /市价整肃|服务器裁决/);
  assert.doesNotMatch(serialized, /auditRecord|stateDelta|playerDelta|rawSql|worldState|cityPolicyLedger/);
});

test("S88.5.3 general war-council entry resolves scout and resupply through military resolver", () => {
  const scoutState = createInitialState({ role: "general", playerName: "巡边将领" });
  const scout = runRoleCycleDomainAdjudicationStep(
    scoutState,
    "据舆图与战事档案开军议，先遣哨核边面。"
  );

  assert.equal(scout.outcome.status, "accepted");
  assert.equal(scout.outcome.resolver, "military_diplomacy");
  assert.equal(scout.outcome.intent, "scout");
  assert.equal(scoutState.militaryDiplomacyLedger.records[0].actionKind, "scout");
  assert.ok(scout.attributeChanges.some((change) => change.path === "player.scouting"));

  const resupplyState = createInitialState({ role: "general", playerName: "筹粮将领" });
  const resupply = runRoleCycleDomainAdjudicationStep(
    resupplyState,
    "据战事档案开军议，先调粮道补给。"
  );

  assert.equal(resupply.outcome.status, "accepted");
  assert.equal(resupply.outcome.intent, "resupply");
  assert.ok(resupply.outcome.evidenceRefs.some((ref) => ref.startsWith("market:")));
  assert.ok(resupply.outcome.evidenceRefs.some((ref) => ref.startsWith("military:")));
  assert.equal(resupplyState.militaryDiplomacyLedger.records[0].actionKind, "resupply");
});

test("S88.5.3 npc economy review stays read-only and creates no resolver ledger", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "月账知县" });
  const beforeEvents = worldState.eventHistory.length;
  const result = runRoleCycleDomainAdjudicationStep(worldState, "查看人物月账与赊欠回报。");

  assert.equal(result.outcome.status, "read_only");
  assert.equal(result.outcome.resolver, "npc_economy");
  assert.equal(worldState.cityPolicyLedger, undefined);
  assert.equal(worldState.militaryDiplomacyLedger, undefined);
  assert.equal(worldState.eventHistory.length, beforeEvents);
  assert.deepEqual(result.attributeChanges, []);
});
