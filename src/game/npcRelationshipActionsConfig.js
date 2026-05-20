const NPC_RELATIONSHIP_ACTION_SCHEMA_VERSION = "s85.4-npc-relationship-actions.v1";

const NPC_RELATIONSHIP_ACTION_TYPES = Object.freeze([
  "debate",
  "duel",
  "courtship",
  "marriage"
]);

const NPC_RELATIONSHIP_ACTION_CONFIG = Object.freeze({
  debate: Object.freeze({
    label: "论道",
    requestLabel: "请论道",
    minimumCloseness: -100,
    minimumTrust: 0,
    relationshipDelta: 1,
    trustDelta: 1,
    hostilityDelta: 0,
    riskTags: Object.freeze(["声望较量", "言辞得失"]),
    outcomeSummary: "论道已由服务器记录为公开交游；声望与关系只作小幅安全调整。"
  }),
  duel: Object.freeze({
    label: "切磋",
    requestLabel: "请切磋",
    minimumCloseness: 0,
    minimumTrust: 20,
    relationshipDelta: 1,
    trustDelta: 0,
    hostilityDelta: 1,
    riskTags: Object.freeze(["伤损风险", "身份禁忌"]),
    outcomeSummary: "切磋只登记为待复核武艺较量；胜负、伤损和赏罚不得由前端或 AI 直接写入。"
  }),
  courtship: Object.freeze({
    label: "求爱",
    requestLabel: "递情",
    minimumCloseness: 18,
    minimumTrust: 30,
    relationshipDelta: 1,
    trustDelta: 0,
    hostilityDelta: 0,
    riskTags: Object.freeze(["礼法边界", "亲族意见"]),
    outcomeSummary: "求爱只登记为礼法边界内的意向；不会即时订婚、扣礼物或改婚姻谱系。"
  }),
  marriage: Object.freeze({
    label: "婚姻",
    requestLabel: "议婚",
    minimumCloseness: 30,
    minimumTrust: 45,
    relationshipDelta: 1,
    trustDelta: 1,
    hostilityDelta: 0,
    riskTags: Object.freeze(["媒妁审查", "亲族合议", "身份差距"]),
    outcomeSummary: "议婚已登记为正式扩展位；服务器未即时写 spouseIds，后续须接家族与礼法裁决。"
  })
});

const NPC_RELATIONSHIP_ACTION_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxRiskTags: 6,
  maxBlockers: 6,
  maxViewItems: 8
});

module.exports = {
  NPC_RELATIONSHIP_ACTION_CONFIG,
  NPC_RELATIONSHIP_ACTION_LIMITS,
  NPC_RELATIONSHIP_ACTION_SCHEMA_VERSION,
  NPC_RELATIONSHIP_ACTION_TYPES
};
