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

const NPC_ACTIVE_REQUEST_RESPONSE_ACTION_CONFIG = Object.freeze({
  accept: Object.freeze({
    label: "应允受理",
    shortLabel: "应允",
    draftTemplate: "回应{npcName}的{typeLabel}：愿先受理此事，但资源、关系、婚姻、弹劾、背叛或后续任务均候服务器裁决。"
  }),
  refuse: Object.freeze({
    label: "婉拒",
    shortLabel: "拒绝",
    draftTemplate: "回应{npcName}的{typeLabel}：暂且婉拒，并说明公私边界、证据不足或礼法未明之处。"
  }),
  defer: Object.freeze({
    label: "暂缓",
    shortLabel: "暂缓",
    draftTemplate: "回应{npcName}的{typeLabel}：此事暂缓，先留书面摘要，不承诺资源、关系或制度后果。"
  }),
  investigate: Object.freeze({
    label: "查证",
    shortLabel: "查证",
    draftTemplate: "回应{npcName}的{typeLabel}：先查证身份、证据、契据和牵连人物，再交由服务器裁决后续。"
  }),
  report: Object.freeze({
    label: "呈报",
    shortLabel: "呈报",
    draftTemplate: "回应{npcName}的{typeLabel}：将线索上交或呈报，不私下收受财物、不私定罪责、不改隐藏事实。"
  })
});

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

const NPC_ACTIVE_REQUEST_FOLLOW_UP_SCHEMA_VERSION = "s88.7-npc-active-request-follow-up.v1";
const NPC_ACTIVE_REQUEST_FOLLOW_UP_TASK_SCHEMA_VERSION = "s88.7-npc-active-request-follow-up-task.v1";
const NPC_ACTIVE_REQUEST_FOLLOW_UP_RESOLUTION_SCHEMA_VERSION =
  "s88.7-npc-active-request-follow-up-resolution.v1";
const NPC_ACTIVE_REQUEST_FOLLOW_UP_EVIDENCE_SCHEMA_VERSION =
  "s88.7-npc-active-request-follow-up-evidence.v1";

const NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG = Object.freeze({
  help: Object.freeze({
    followUpKind: "social_help_review",
    taskRoute: "social_help_check",
    taskRouteLabel: "求助核验",
    title: "求助后续核验",
    publicSummary: "求助只登记为待核人情事项；身份、事实、资源和任务结果仍由服务器后续裁决。",
    nextStep: "核明来意、所需资源与可公开证据，再决定是否转入委派、案牍或普通回合行动。",
    resolutionStatus: "help_evidence_recorded",
    resolutionLabel: "求助核验已记",
    resolutionSummary: "服务器已把求助后续登记为公开核验记录；身份、资源、任务和人情结果仍未结算。",
    resolutionNextStep: "后续若转为委派、案牍或普通行动，仍须重新按公开证据和服务器规则裁决。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：先核明来意、所需资源和公开证据，只提出求助核验，不承诺任务或资源结果。",
    preferredActions: Object.freeze(["investigate", "accept", "refuse"]),
    taskIntentKeywords: Object.freeze(["求助", "核验", "所需资源", "公开证据", "人情"]),
    riskTags: Object.freeze(["人情牵连", "需核事实"])
  }),
  debt_collection: Object.freeze({
    followUpKind: "human_debt_review",
    taskRoute: "economy_debt_note",
    taskRouteLabel: "人情债核验",
    title: "钱债与人情债核验",
    publicSummary: "索债不会即时扣银；旧账、借贷、人情债和契据须先形成服务器可复核线索。",
    nextStep: "查契据、见证人与旧账来源，必要时转入囊箧、交易或人情月账的服务器结算。",
    resolutionStatus: "debt_note_recorded",
    resolutionLabel: "人情债线索已记",
    resolutionSummary: "服务器已把钱债与人情债登记为公开月账线索；银钱、物品和交易仍未结算。",
    resolutionNextStep: "后续只能通过囊箧、交易、人情月账或普通行动再由服务器核契据与证人。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：查验契据、见证人与旧账来源，只作为人情债核验线索，不直接扣银。",
    preferredActions: Object.freeze(["investigate", "defer", "refuse"]),
    taskIntentKeywords: Object.freeze(["索债", "人情债", "契据", "旧账", "见证人"]),
    riskTags: Object.freeze(["钱债争执", "人情债"])
  }),
  advice: Object.freeze({
    followUpKind: "advice_evidence_review",
    taskRoute: "policy_advice_evidence",
    taskRouteLabel: "献策证据",
    title: "献策证据复核",
    publicSummary: "献策只进入公开建议队列；政策、军务、案牍、科举或任免后果不因来函直接生效。",
    nextStep: "把建议作为普通回合草稿或专题证据，由服务器按身份权限和公开证据裁决。",
    resolutionStatus: "advice_evidence_recorded",
    resolutionLabel: "献策证据已记",
    resolutionSummary: "服务器已把献策后续整理为公开证据；政策、军务、案牍、科举或任免后果仍未生效。",
    resolutionNextStep: "后续若进入奏议、案牍、军议或普通行动，须由对应 resolver 重新裁决。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：把献策改写为公开证据和可审议草稿，后果仍候服务器按身份权限裁决。",
    preferredActions: Object.freeze(["investigate", "accept", "defer"]),
    taskIntentKeywords: Object.freeze(["献策", "证据", "建议", "草稿", "审议"]),
    riskTags: Object.freeze(["需核证据", "夹带私意"])
  }),
  petition: Object.freeze({
    followUpKind: "petition_obligation_review",
    taskRoute: "public_docket_evidence",
    taskRouteLabel: "请托案牍",
    title: "请托与公私边界复核",
    publicSummary: "请托只登记为待裁人情压力；官职、案件、钱粮、考试和任务不得被来函绕过。",
    nextStep: "核对所托事项是否属于当前身份权限，必要时改写为公开案牍、奏议或普通行动。",
    resolutionStatus: "petition_docket_recorded",
    resolutionLabel: "请托案牍已记",
    resolutionSummary: "服务器已把请托后续整理为公开案牍线索；官职、案件、钱粮、考试和任务仍未被绕过。",
    resolutionNextStep: "后续若提交案牍、奏议或普通行动，仍按身份权限、公私边界和公开证据裁决。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：核对所托事项、身份权限和公开证据，必要时只转成案牍或奏议草稿。",
    preferredActions: Object.freeze(["investigate", "defer", "refuse"]),
    taskIntentKeywords: Object.freeze(["请托", "案牍", "公私边界", "奏议", "所托事项"]),
    riskTags: Object.freeze(["人情压力", "公私边界"])
  }),
  bribe: Object.freeze({
    followUpKind: "integrity_risk_review",
    taskRoute: "integrity_watchlist",
    taskRouteLabel: "廉政线索",
    title: "廉政线索复核",
    publicSummary: "行贿来函不会成为已收财物；只能转为廉政风险、证据线索、拒收或呈报记录。",
    nextStep: "拒收并留痕，或把线索呈报/查证；不得让前端、AI 或按钮直接加银、转物或销案。",
    resolutionStatus: "integrity_watch_recorded",
    resolutionLabel: "廉政线索已记",
    resolutionSummary: "服务器已把行贿后续登记为廉政 watchlist；财物未收、银钱未加、案件未销。",
    resolutionNextStep: "后续只能按公开证据呈报、查证或进入风宪/案牍流程，不能由按钮结案。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：登记为廉政线索，拒收留痕并查证，不收财物、不销案。",
    preferredActions: Object.freeze(["report", "investigate", "refuse"]),
    taskIntentKeywords: Object.freeze(["行贿", "廉政", "拒收", "线索", "查证"]),
    riskTags: Object.freeze(["廉政风险", "禁收财物"])
  }),
  impeachment: Object.freeze({
    followUpKind: "impeachment_evidence_review",
    taskRoute: "censorate_watchlist",
    taskRouteLabel: "弹劾证据",
    title: "弹劾证据复核",
    publicSummary: "弹劾线索只形成公开证据复核；成案、处分、任免和清白结论仍由官场规则裁决。",
    nextStep: "核人证、物证与管辖权限，必要时写入奏议或官场行动，不能凭来函直接定罪。",
    resolutionStatus: "censorate_watch_recorded",
    resolutionLabel: "弹劾证据已记",
    resolutionSummary: "服务器已把弹劾后续登记为风宪证据 watchlist；成案、处分、任免和清白结论仍未裁定。",
    resolutionNextStep: "后续若上呈奏议或官场行动，仍须按人证、物证、管辖权限和官场 resolver 裁决。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：核人证、物证与管辖权限，只形成弹劾证据复核，不直接定罪处分。",
    preferredActions: Object.freeze(["investigate", "report", "refuse"]),
    taskIntentKeywords: Object.freeze(["弹劾", "风宪", "人证", "物证", "管辖"]),
    riskTags: Object.freeze(["证据不足", "党争牵连"])
  }),
  introduction: Object.freeze({
    followUpKind: "network_introduction_review",
    taskRoute: "network_visit_lead",
    taskRouteLabel: "人脉拜会",
    title: "引荐人脉复核",
    publicSummary: "引荐只成为可见人脉线索；关系落账、身份机会、座师同年与官场机会仍需服务器确认。",
    nextStep: "核引荐对象、场合和可见关系来源，再作为拜会草稿、师友线索或官场证据使用。",
    resolutionStatus: "network_visit_lead_recorded",
    resolutionLabel: "引荐拜会已记",
    resolutionSummary: "服务器已把引荐后续登记为公开拜会线索；关系落账、身份机会和座师同年仍未确认。",
    resolutionNextStep: "后续若拜会、投帖或进入官场/师友证据，仍须由服务器按公开关系裁决。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：核引荐对象、场合和公开关系来源，只拟拜会或师友线索，不直接落关系。",
    preferredActions: Object.freeze(["investigate", "accept", "defer"]),
    taskIntentKeywords: Object.freeze(["引荐", "人脉", "拜会", "师友", "关系来源"]),
    riskTags: Object.freeze(["门路待核", "名声牵连"])
  }),
  marriage_proposal: Object.freeze({
    followUpKind: "ritual_family_review",
    taskRoute: "ritual_family_check",
    taskRouteLabel: "礼法亲族",
    title: "礼法与亲族审查",
    publicSummary: "议婚只进入礼法、身份、亲族与公开关系审查；不会即时写配偶、谱系或嫁娶事实。",
    nextStep: "核年龄、亲族、婚姻状态和礼法障碍，后续只能通过服务器议婚流程推进。",
    resolutionStatus: "ritual_family_check_recorded",
    resolutionLabel: "礼法亲族已记",
    resolutionSummary: "服务器已把议婚后续登记为礼法亲族审查；配偶、谱系和嫁娶事实仍未写入。",
    resolutionNextStep: "后续只能通过服务器议婚流程复核年龄、亲族、婚姻状态和礼法障碍。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：核年龄、亲族、婚姻状态和礼法障碍，只进入议婚审查，不写配偶事实。",
    preferredActions: Object.freeze(["investigate", "defer", "refuse"]),
    taskIntentKeywords: Object.freeze(["议婚", "求婚", "礼法", "亲族", "婚姻状态"]),
    riskTags: Object.freeze(["礼法审查", "亲族意见"])
  }),
  betrayal: Object.freeze({
    followUpKind: "betrayal_risk_review",
    taskRoute: "relationship_risk_watchlist",
    taskRouteLabel: "背叛风险",
    title: "背叛风险查证",
    publicSummary: "背叛只作为风险线索；不得因 NPC、模型或前端输入直接定罪、抄家、处置人物或改 hidden truth。",
    nextStep: "先查证行迹、证据和公开关系，再决定呈报、调查或暂置，不把风险直接写成事实。",
    resolutionStatus: "relationship_risk_watch_recorded",
    resolutionLabel: "背叛风险已记",
    resolutionSummary: "服务器已把背叛后续登记为公开关系风险观察；定罪、处置人物和 hidden truth 仍未改变。",
    resolutionNextStep: "后续只能按公开行迹、证据和关系再呈报或调查，不能把风险直接写成事实。",
    taskDraftTemplate: "续办{npcName}的{typeLabel}：查证行迹、证据和公开关系，只列入背叛风险观察，不直接定罪。",
    preferredActions: Object.freeze(["investigate", "report", "refuse"]),
    taskIntentKeywords: Object.freeze(["背叛", "背约", "行迹", "关系风险", "观察"]),
    riskTags: Object.freeze(["背约风险", "需查证"])
  })
});

const NPC_ACTIVE_REQUEST_FOLLOW_UP_EVIDENCE_CONFIG = Object.freeze({
  social_help_check: Object.freeze({
    evidenceKind: "social_help_review",
    evidenceKindLabel: "求助核验线索",
    domain: "people",
    searchDomain: "people",
    topicSurfaceIds: Object.freeze(["npc-profile", "court-debate"]),
    title: "求助核验线索",
    summaryPrefix: "求助后续只形成可见人情核验"
  }),
  economy_debt_note: Object.freeze({
    evidenceKind: "human_debt_monthly_note",
    evidenceKindLabel: "人情债月账线索",
    domain: "economy",
    searchDomain: "reports",
    topicSurfaceIds: Object.freeze(["npc-profile", "memorial-review"]),
    title: "人情债月账线索",
    summaryPrefix: "钱债与人情债后续只形成月账解释线索"
  }),
  policy_advice_evidence: Object.freeze({
    evidenceKind: "advice_public_evidence",
    evidenceKindLabel: "献策公开证据",
    domain: "events",
    searchDomain: "reports",
    topicSurfaceIds: Object.freeze(["memorial-review", "court-debate"]),
    title: "献策公开证据",
    summaryPrefix: "献策后续只作为公开审议证据"
  }),
  public_docket_evidence: Object.freeze({
    evidenceKind: "petition_public_docket",
    evidenceKindLabel: "请托案牍线索",
    domain: "events",
    searchDomain: "reports",
    topicSurfaceIds: Object.freeze(["memorial-review", "court-debate", "trial"]),
    title: "请托案牍线索",
    summaryPrefix: "请托后续只形成公私边界案牍证据"
  }),
  integrity_watchlist: Object.freeze({
    evidenceKind: "integrity_watchlist",
    evidenceKindLabel: "廉政 watchlist",
    domain: "events",
    searchDomain: "events",
    topicSurfaceIds: Object.freeze(["memorial-review", "court-debate"]),
    title: "廉政 watchlist",
    summaryPrefix: "行贿后续只登记为廉政 watchlist"
  }),
  censorate_watchlist: Object.freeze({
    evidenceKind: "censorate_watchlist",
    evidenceKindLabel: "风宪 watchlist",
    domain: "events",
    searchDomain: "events",
    topicSurfaceIds: Object.freeze(["memorial-review", "court-debate"]),
    title: "风宪 watchlist",
    summaryPrefix: "弹劾后续只登记为风宪证据 watchlist"
  }),
  network_visit_lead: Object.freeze({
    evidenceKind: "network_visit_lead",
    evidenceKindLabel: "引荐拜会线索",
    domain: "people",
    searchDomain: "people",
    topicSurfaceIds: Object.freeze(["npc-profile", "court-debate"]),
    title: "引荐拜会线索",
    summaryPrefix: "引荐后续只形成拜会/同年师友线索"
  }),
  ritual_family_check: Object.freeze({
    evidenceKind: "ritual_family_review",
    evidenceKindLabel: "礼法亲族线索",
    domain: "people",
    searchDomain: "people",
    topicSurfaceIds: Object.freeze(["npc-profile"]),
    title: "礼法亲族线索",
    summaryPrefix: "议婚后续只形成礼法亲族审查线索"
  }),
  relationship_risk_watchlist: Object.freeze({
    evidenceKind: "relationship_risk_watchlist",
    evidenceKindLabel: "背叛风险 watchlist",
    domain: "people",
    searchDomain: "people",
    topicSurfaceIds: Object.freeze(["npc-profile", "court-debate"]),
    title: "背叛风险 watchlist",
    summaryPrefix: "背叛后续只登记为公开关系风险观察"
  })
});

const NPC_ACTIVE_REQUEST_CONFIG = Object.freeze({
  maxActiveRequests: 3,
  maxViewItems: 12,
  maxFollowUpTasks: 8,
  maxFollowUpEvidence: 12,
  maxFollowUpResolutions: 6,
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
  NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_EVIDENCE_CONFIG,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_EVIDENCE_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_RESOLUTION_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_FOLLOW_UP_TASK_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_RESPONSE_ACTION_CONFIG,
  NPC_ACTIVE_REQUEST_RESPONSE_ACTIONS,
  NPC_ACTIVE_REQUEST_SCHEMA_VERSION,
  NPC_ACTIVE_REQUEST_STATUS,
  NPC_ACTIVE_REQUEST_TYPE_CONFIG,
  NPC_ACTIVE_REQUEST_TYPES
};
