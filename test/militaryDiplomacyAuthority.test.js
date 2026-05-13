const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { collectVisibleDomainEvidenceRefs } = require("../src/game/domainToolResolvers");
const { createInitialState } = require("../src/game/initialState");
const {
  resolveCampaignOrDefense,
  resolveDiplomaticMove
} = require("../src/game/militaryDiplomacyResolver");

function firstEvidence(worldState, actorProfile, domain) {
  const entry = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .find((item) => item.domain === domain);
  assert.ok(entry, `缺少 ${domain} 可见证据`);
  return entry;
}

function militaryRefs(worldState, actorProfile, count = 2) {
  const rows = [...collectVisibleDomainEvidenceRefs(worldState, actorProfile).values()]
    .filter((item) => item.domain === "military")
    .slice(0, count);
  assert.equal(rows.length, count, "军务证据不足");
  return rows.map((entry) => entry.ref);
}

test("S71.7 military resolver rejects scholar overreach without mutating state", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "寒窗士子" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const before = JSON.stringify(worldState);

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "scout",
    evidenceRefs: ["military:forged-frontier"],
    publicSummary: "书生越权遣哨。",
    riskLevel: 1
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /权限不足|军务工具组|可见 resolver 输入/);
  assert.deepEqual(JSON.parse(JSON.stringify(worldState)), JSON.parse(before));
  assert.deepEqual(outcome.stateDelta, {});
});

test("S71.7 diplomacy resolver rejects T4 actor declaring war", () => {
  const worldState = createInitialState({ role: "general", playerName: "边镇将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);
  const diplomacy = firstEvidence(worldState, actorProfile, "diplomacy");
  const military = firstEvidence(worldState, actorProfile, "military");
  const market = firstEvidence(worldState, actorProfile, "market");

  const outcome = resolveDiplomaticMove(worldState, {
    moveKind: "declare_war_request",
    evidenceRefs: [diplomacy.ref, military.ref, market.ref],
    institutionalPath: "imperial_edict",
    publicSummary: "边镇将领越级请战。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /等级不足/);
});

test("S71.7 high-risk battle orders require institutional path", () => {
  const worldState = createInitialState({ role: "general", playerName: "冒进将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs: militaryRefs(worldState, actorProfile),
    publicSummary: "未报制度路径即拟会战。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /制度路径/);
});

test("S71.7 battle orders reject insufficient grain, supply or troop resources", () => {
  const worldState = createInitialState({ role: "general", playerName: "乏粮将领" });
  worldState.grainReserve = 40;
  worldState.player.supply = 10;
  worldState.player.troops = 50;
  const actorProfile = buildPlayerAiActorProfile(worldState);

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "engage",
    evidenceRefs: militaryRefs(worldState, actorProfile),
    institutionalPath: "frontier_command",
    publicSummary: "粮储与本部兵力不足仍欲会战。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /资源不足/);
  assert.match(outcome.rejectionReasons.join(" "), /粮储|本部粮饷|本部兵力/);
});

test("S71.7 resource actions require economy or market evidence", () => {
  const worldState = createInitialState({ role: "general", playerName: "缺粮道证据将领" });
  const actorProfile = buildPlayerAiActorProfile(worldState);

  const outcome = resolveCampaignOrDefense(worldState, {
    orderKind: "resupply",
    evidenceRefs: [firstEvidence(worldState, actorProfile, "military").ref],
    publicSummary: "只凭边情调粮。"
  }, { actorProfile });

  assert.equal(outcome.status, "rejected");
  assert.match(outcome.rejectionReasons.join(" "), /钱粮|市场/);
});
