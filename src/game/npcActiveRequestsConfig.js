const NPC_ACTIVE_REQUEST_SCHEMA_VERSION = "s85.3-npc-active-requests.v1";

const NPC_ACTIVE_REQUEST_TYPES = Object.freeze([
  "help",
  "debt_collection",
  "advice",
  "petition",
  "bribe",
  "impeachment",
  "introduction",
  "marriage_proposal",
  "betrayal"
]);

const NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS = Object.freeze([
  "accept",
  "refuse",
  "defer",
  "investigate",
  "report"
]);

const NPC_ACTIVE_REQUEST_STATUS = Object.freeze([
  "active",
  "deferred",
  "under_review",
  "reported",
  "refused",
  "expired",
  "converted_to_risk",
  "accepted_pending_server_resolution"
]);

const NPC_ACTIVE_REQUEST_TYPE_CONFIG = Object.freeze({
  help: Object.freeze({
    label: "求助",
    titleSuffix: "前来求助",
    ask: "请你在公私边界内出手相助，先核事实、身份与所需资源。",
    stakes: "允诺后仍须服务器校验权限、资源与后续任务；拒绝会损情分。",
    preferredRoleTags: Object.freeze(["mentor", "county_deputy", "student", "field_agent"]),
    preferredSignalTags: Object.freeze(["避祸", "重义"]),
    riskTags: Object.freeze(["人情牵连", "需核事实"]),
    dueTurns: 4
  }),
  debt_collection: Object.freeze({
    label: "索债",
    titleSuffix: "催讨旧债",
    ask: "对方称有旧账、借贷或人情债未清，要求你表态。",
    stakes: "服务器只记录催讨与回应，不会让模型或前端直接扣银。",
    preferredRoleTags: Object.freeze(["merchant", "gentry", "landholder", "yamen_runner"]),
    preferredSignalTags: Object.freeze(["求财", "亲族压力"]),
    riskTags: Object.freeze(["钱债争执", "需验契据"]),
    dueTurns: 3
  }),
  advice: Object.freeze({
    label: "献策",
    titleSuffix: "递来策议",
    ask: "对方献上一条处置建议，请你采纳、搁置或另行核验。",
    stakes: "献策只进入公开摘要；政策、案牍、军务或科举后果仍由服务器裁决。",
    preferredRoleTags: Object.freeze(["teacher", "registrar", "gentry", "exam_peer"]),
    preferredSignalTags: Object.freeze(["求名", "重义"]),
    riskTags: Object.freeze(["需核证据", "可能夹带私意"]),
    dueTurns: 5
  }),
  petition: Object.freeze({
    label: "请托",
    titleSuffix: "递来请托",
    ask: "对方请求你照拂一桩人事、案牍或地方事务。",
    stakes: "请托不得绕过官职、案件、钱粮或考试规则；只能先登记为待裁请求。",
    preferredRoleTags: Object.freeze(["gentry", "county_deputy", "mentor", "student"]),
    preferredSignalTags: Object.freeze(["护短", "求名"]),
    riskTags: Object.freeze(["人情压力", "公私边界"]),
    dueTurns: 4
  }),
  bribe: Object.freeze({
    label: "行贿",
    titleSuffix: "暗递礼意",
    ask: "对方以礼物或银钱试探，请你决定拒绝、上交或转入调查。",
    stakes: "服务器不会即时收受贿赂；可转为廉政风险、证据线索或拒绝记录。",
    preferredRoleTags: Object.freeze(["gentry", "landholder", "merchant", "yamen_runner"]),
    preferredSignalTags: Object.freeze(["求财", "护短", "可能欺瞒"]),
    riskTags: Object.freeze(["廉政风险", "禁收财物"]),
    dueTurns: 2
  }),
  impeachment: Object.freeze({
    label: "弹劾",
    titleSuffix: "请求弹劾",
    ask: "对方递来弹劾线索，盼你核验后上呈或驳回。",
    stakes: "弹劾不会由 NPC 或模型直接成案；必须等待服务器证据与权限裁决。",
    preferredRoleTags: Object.freeze(["gentry", "registrar", "official", "mentor"]),
    preferredSignalTags: Object.freeze(["避祸", "求名", "可能欺瞒"]),
    riskTags: Object.freeze(["证据不足", "党争牵连"]),
    dueTurns: 4
  }),
  introduction: Object.freeze({
    label: "引荐",
    titleSuffix: "愿作引荐",
    ask: "对方愿为你牵线师友、上官、同年或地方人物。",
    stakes: "引荐只能成为可见人脉线索；关系落账和身份机会仍由服务器裁决。",
    preferredRoleTags: Object.freeze(["mentor", "gentry", "registrar", "exam_peer"]),
    preferredSignalTags: Object.freeze(["求名", "重义"]),
    riskTags: Object.freeze(["门路待核", "名声牵连"]),
    dueTurns: 5
  }),
  marriage_proposal: Object.freeze({
    label: "求婚",
    titleSuffix: "试探议婚",
    ask: "对方或其亲族试探婚姻、联姻或媒妁之事。",
    stakes: "求婚只进入礼法审查与公开请求；不会即时写 spouseIds 或成婚事实。",
    preferredRoleTags: Object.freeze(["gentry", "exam_peer", "mentor", "student"]),
    preferredSignalTags: Object.freeze(["亲族压力", "求名"]),
    riskTags: Object.freeze(["礼法审查", "亲族意见"]),
    dueTurns: 6
  }),
  betrayal: Object.freeze({
    label: "背叛",
    titleSuffix: "露出反复",
    ask: "对方行迹反常，可能转向、泄密或背弃旧约，请你查证或处置。",
    stakes: "背叛只作为风险 proposal；服务器不会让模型直接定罪、抄家或改 hidden truth。",
    preferredRoleTags: Object.freeze(["yamen_runner", "gentry", "landholder", "exam_peer"]),
    preferredSignalTags: Object.freeze(["可能欺瞒", "避祸", "求财"]),
    riskTags: Object.freeze(["背约风险", "需查证"]),
    dueTurns: 3
  })
});

const NPC_ACTIVE_REQUEST_CONFIG = Object.freeze({
  maxActiveRequests: 3,
  maxViewItems: 12,
  maxRecentEvents: 16,
  maxEvidenceRefs: 6,
  maxRiskTags: 6,
  textMaxLength: 180,
  scheduleEveryTurns: 2,
  scheduleTurnOffset: 1,
  defaultDueTurns: 4,
  relationshipDeltaRange: Object.freeze([-6, 6]),
  requestTypeSequence: NPC_ACTIVE_REQUEST_TYPES
});

module.exports = {
  NPC_ACTIVE_REQUEST_CONFIG,
  NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
  NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_STATUS,
  NPC_ACTIVE_REQUEST_TYPE_CONFIG,
  NPC_ACTIVE_REQUEST_TYPES
};
