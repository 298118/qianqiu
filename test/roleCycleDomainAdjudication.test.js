const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  ROLE_CYCLE_DOMAIN_DUPLICATE_WINDOW_TURNS,
  classifyRoleCycleDomainIntent,
  runRoleCycleDomainAdjudicationStep,
  selectEvidenceRefs
} = require("../src/game/roleCycleDomainAdjudication");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");

const HIGH_RISK_MILITARY_BYPASS_TERMS = [
  "接战",
  "交战",
  "动员",
  "请战",
  "扣使",
  "扣留",
  "拔寨",
  "夺城",
  "截杀",
  "冲阵",
  "邀击",
  "掩杀",
  "火攻",
  "合战",
  "索战",
  "轻进",
  "detain envoy",
  "war request",
  "flank",
  "raid"
];

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
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据战事档案开军议，先调粮后发兵攻取边堡。"
    ),
    null
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "据舆图与战事档案开军议，遣哨后奇袭敌营。"
    ),
    null
  );
  assert.equal(
    classifyRoleCycleDomainIntent(
      createInitialState({ role: "general" }),
      "Use the war council to resupply and mobilize for battle."
    ),
    null
  );
});

test("S88.6 role-cycle military classifier blocks high-risk terms mixed into scout or resupply drafts", () => {
  for (const term of HIGH_RISK_MILITARY_BYPASS_TERMS) {
    assert.equal(
      classifyRoleCycleDomainIntent(
        createInitialState({ role: "general" }),
        `据战事档案开军议，先调粮道补给，再${term}。`
      ),
      null,
      `resupply bypass term should be blocked: ${term}`
    );
    assert.equal(
      classifyRoleCycleDomainIntent(
        createInitialState({ role: "general" }),
        `据舆图开军议，遣哨侦察后${term}。`
      ),
      null,
      `scout bypass term should be blocked: ${term}`
    );
  }
});

test("S88.6 role-cycle domain adjudication rejects inactive-role cross-domain phrases", () => {
  const scholarState = createInitialState({ role: "scholar", playerName: "越权书生" });
  const scholar = runRoleCycleDomainAdjudicationStep(
    scholarState,
    "据舆图与战事档案开军议，先调粮道补给。"
  );

  assert.equal(scholar.outcome, null);
  assert.equal(scholarState.militaryDiplomacyLedger, undefined);

  const ministerState = createInitialState({ role: "minister", playerName: "越权大臣" });
  const minister = runRoleCycleDomainAdjudicationStep(
    ministerState,
    "本旬先处置广州粮储市价，平粜稳价。"
  );

  assert.equal(minister.outcome, null);
  assert.equal(ministerState.cityPolicyLedger, undefined);

  const emperorState = createInitialState({ role: "emperor", playerName: "越权皇帝" });
  const emperor = runRoleCycleDomainAdjudicationStep(
    emperorState,
    "据舆图与战事档案开军议，先遣哨核边面。"
  );

  assert.equal(emperor.outcome, null);
  assert.equal(emperorState.militaryDiplomacyLedger, undefined);
  assert.equal(classifyRoleCycleDomainIntent(ministerState, "据战事档案开军议，先调粮道补给。"), null);
});

test("S88.6 official postings cannot silently borrow magistrate or general role-cycle resolvers", () => {
  const countyOfficialState = createInitialState({ role: "official", playerName: "知县官员" });
  countyOfficialState.player.officeTitle = "知县";
  countyOfficialState.player.position = "知县";
  const countyProfile = buildPlayerAiActorProfile(countyOfficialState);

  assert.equal(countyProfile.actorType, "magistrate");
  assert.equal(
    classifyRoleCycleDomainIntent(
      countyOfficialState,
      "本旬先处置广州粮储市价，平粜稳价。"
    ),
    null
  );
  const countyResult = runRoleCycleDomainAdjudicationStep(
    countyOfficialState,
    "本旬先处置广州粮储市价，平粜稳价。"
  );
  assert.equal(countyResult.outcome, null);
  assert.equal(countyOfficialState.cityPolicyLedger, undefined);

  const militaryOfficialState = createInitialState({ role: "official", playerName: "武职官员" });
  militaryOfficialState.player.officeTitle = "游击将军";
  militaryOfficialState.player.position = "游击将军";
  const militaryProfile = buildPlayerAiActorProfile(militaryOfficialState);

  assert.equal(militaryProfile.actorType, "general");
  assert.equal(
    classifyRoleCycleDomainIntent(
      militaryOfficialState,
      "据战事档案开军议，先调粮道补给。"
    ),
    null
  );
  const militaryResult = runRoleCycleDomainAdjudicationStep(
    militaryOfficialState,
    "据战事档案开军议，先调粮道补给。"
  );
  assert.equal(militaryResult.outcome, null);
  assert.equal(militaryOfficialState.militaryDiplomacyLedger, undefined);
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

test("S88.6 role-cycle adjudication records verified topic draft echo audit refs", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "后果审计知县" });
  const echoRef = "domainConsequenceEcho:abc123";
  const result = runRoleCycleDomainAdjudicationStep(
    worldState,
    "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。",
    {
      draftContext: {
        surfaceId: "trial",
        draftKind: "investigate_case",
        evidenceRefs: ["evidence:events:domainConsequenceEcho:abc123"],
        canonicalEchoRefs: [echoRef, "forged-ref"],
        generatedAtTurn: 0,
        status: "verified"
      }
    }
  );
  const ledgerRecord = worldState.cityPolicyLedger.records[0];
  const serialized = JSON.stringify(result);

  assert.equal(result.outcome.status, "accepted");
  assert.deepEqual(result.outcome.canonicalEchoRefs, [echoRef]);
  assert.deepEqual(ledgerRecord.canonicalEchoRefs, [echoRef]);
  assert.equal(ledgerRecord.topicDraftContext.surfaceId, "trial");
  assert.equal(ledgerRecord.topicDraftContext.status, "verified");
  assert.equal(JSON.stringify(result).includes("forged-ref"), false);
  assert.doesNotMatch(serialized, /outcomeId|role-cycle:/);
});

test("S88.6 role-cycle city policy duplicate guard suppresses repeated ordinary-turn triggers", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "重复知县" });
  worldState.turnCount = 10;
  const input = "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。";
  const first = runRoleCycleDomainAdjudicationStep(worldState, input);
  const afterFirst = {
    treasury: worldState.treasury,
    publicOrder: worldState.publicOrder,
    performanceMerit: worldState.player.performanceMerit,
    eventCount: worldState.eventHistory.length,
    ledgerCount: worldState.cityPolicyLedger.records.length
  };

  const duplicate = runRoleCycleDomainAdjudicationStep(worldState, input);
  const serialized = JSON.stringify(duplicate);

  assert.equal(first.outcome.status, "accepted");
  assert.equal(duplicate.outcome.status, "duplicate_recent");
  assert.equal(duplicate.outcome.resolver, "city_policy");
  assert.equal(duplicate.outcome.intent, "market_regulation");
  assert.equal(duplicate.attributeChanges.length, 0);
  assert.equal(worldState.cityPolicyLedger.records.length, afterFirst.ledgerCount);
  assert.equal(worldState.eventHistory.length, afterFirst.eventCount);
  assert.equal(worldState.treasury, afterFirst.treasury);
  assert.equal(worldState.publicOrder, afterFirst.publicOrder);
  assert.equal(worldState.player.performanceMerit, afterFirst.performanceMerit);
  assert.doesNotMatch(serialized, /auditRecord|stateDelta|playerDelta|rawSql|worldState|cityPolicyLedger|outcomeId|role-cycle:/);

  worldState.turnCount += ROLE_CYCLE_DOMAIN_DUPLICATE_WINDOW_TURNS + 1;
  const afterCooldown = runRoleCycleDomainAdjudicationStep(worldState, input);

  assert.equal(afterCooldown.outcome.status, "accepted");
  assert.equal(worldState.cityPolicyLedger.records.length, afterFirst.ledgerCount + 1);
});

test("S88.6 role-cycle duplicate guard ignores legacy rows without explicit actor identity", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "旧账知县" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const [marketRef] = selectEvidenceRefs(worldState, actorProfile, ["market"], [], 1);
  worldState.turnCount = 30;
  worldState.cityPolicyLedger = {
    records: [{
      outcomeId: "legacy-without-actor-ref",
      policyType: "market_regulation",
      policyLabel: "市价旧账",
      status: "accepted",
      evidenceRefs: [marketRef],
      publicSummary: "缺 actorRef 的旧账不能阻断当前玩家首次处置。",
      appliedAtTurn: 30
    }]
  };
  const beforeCount = worldState.cityPolicyLedger.records.length;

  const result = runRoleCycleDomainAdjudicationStep(
    worldState,
    "本旬先处置广州粮储市价：核公开材料、经手人、期限和需回报事项。"
  );

  assert.equal(result.outcome.status, "accepted");
  assert.equal(worldState.cityPolicyLedger.records.length, beforeCount + 1);
  assert.equal(worldState.cityPolicyLedger.records.at(-1).actorRef.actorId, actorProfile.actorId);
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

test("S88.6 role-cycle military duplicate guard suppresses repeated scout and resupply triggers", () => {
  const scoutState = createInitialState({ role: "general", playerName: "重复巡边" });
  scoutState.turnCount = 20;
  const scoutInput = "据舆图与战事档案开军议，先遣哨核边面。";
  const scoutFirst = runRoleCycleDomainAdjudicationStep(scoutState, scoutInput);
  const afterScout = {
    borderThreat: scoutState.borderThreat,
    scouting: scoutState.player.scouting,
    eventCount: scoutState.eventHistory.length,
    ledgerCount: scoutState.militaryDiplomacyLedger.records.length
  };
  const scoutDuplicate = runRoleCycleDomainAdjudicationStep(scoutState, scoutInput);

  assert.equal(scoutFirst.outcome.status, "accepted");
  assert.equal(scoutDuplicate.outcome.status, "duplicate_recent");
  assert.equal(scoutDuplicate.outcome.intent, "scout");
  assert.equal(scoutState.militaryDiplomacyLedger.records.length, afterScout.ledgerCount);
  assert.equal(scoutState.eventHistory.length, afterScout.eventCount);
  assert.equal(scoutState.borderThreat, afterScout.borderThreat);
  assert.equal(scoutState.player.scouting, afterScout.scouting);

  const resupplyState = createInitialState({ role: "general", playerName: "重复筹粮" });
  resupplyState.turnCount = 22;
  const resupplyInput = "据战事档案开军议，先调粮道补给。";
  const resupplyFirst = runRoleCycleDomainAdjudicationStep(resupplyState, resupplyInput);
  const afterResupply = {
    grainReserve: resupplyState.grainReserve,
    supply: resupplyState.player.supply,
    ledgerCount: resupplyState.militaryDiplomacyLedger.records.length
  };
  const resupplyDuplicate = runRoleCycleDomainAdjudicationStep(resupplyState, resupplyInput);
  const serialized = JSON.stringify(resupplyDuplicate);

  assert.equal(resupplyFirst.outcome.status, "accepted");
  assert.equal(resupplyDuplicate.outcome.status, "duplicate_recent");
  assert.equal(resupplyDuplicate.outcome.intent, "resupply");
  assert.equal(resupplyState.militaryDiplomacyLedger.records.length, afterResupply.ledgerCount);
  assert.equal(resupplyState.grainReserve, afterResupply.grainReserve);
  assert.equal(resupplyState.player.supply, afterResupply.supply);
  assert.doesNotMatch(serialized, /auditRecord|stateDelta|playerDelta|rawSql|worldState|militaryDiplomacyLedger|outcomeId|role-cycle:/);
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
