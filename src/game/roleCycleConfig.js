const ROLE_CYCLE_SCHEMA_VERSION = "s88.5-role-cycle.v1";

const ROLE_CYCLE_LIMITS = Object.freeze({
  maxMatrixRoles: 6,
  maxItemsPerRole: 5,
  maxRiskSignals: 4,
  maxNextActions: 4,
  maxMetrics: 4,
  maxEntryPoints: 4,
  maxEvidenceRefsPerItem: 3,
  maxEvidenceRefsPerRole: 12,
  maxSourceViews: 8,
  maxTextLength: 180,
  maxShortTextLength: 80,
  maxIdLength: 96
});

const ROLE_CYCLE_ROLES = Object.freeze([
  "scholar",
  "magistrate",
  "official",
  "minister",
  "general",
  "emperor"
]);

const ROLE_CYCLE_ROLE_CONFIGS = Object.freeze({
  scholar: Object.freeze({
    roleLabel: "书生",
    authorityTier: "T1",
    loopLabel: "读书日课与科期",
    statusLabel: "温书待科",
    sourceViews: Object.freeze(["studyProfileView", "examCalendarView", "examProcedureView"]),
    defaultSummary: "本旬以读书、请益、备科和文章练习为主。",
    defaultAction: "按读书簿完成一课文章，携给老师圈点，再复核下一科期。"
  }),
  magistrate: Object.freeze({
    roleLabel: "地方官",
    authorityTier: "T3",
    loopLabel: "案牍钱粮与地方治理",
    statusLabel: "署中听事",
    sourceViews: Object.freeze(["localAffairsDocketView", "economicFiscalView", "marketPriceView", "npcEconomyView", "domainConsequenceView"]),
    defaultSummary: "本旬以刑名、钱粮、水利、盗警、乡约和灾赈为主。",
    defaultAction: "升堂梳理本旬案牍，先列公开证据、经手人和限期。"
  }),
  official: Object.freeze({
    roleLabel: "入仕官员",
    authorityTier: "T3",
    loopLabel: "本职差使与考成",
    statusLabel: "署中承差",
    sourceViews: Object.freeze([
      "officialCareerView",
      "courtResponseView",
      "courtConsequenceView",
      "domainConsequenceView",
      "playerMonthlyBriefingView"
    ]),
    defaultSummary: "本旬以本职差遣、回署材料、奏折朝议和考成风险为主。",
    defaultAction: "整理本职差遣的公开凭据、回执和下一步呈报草稿。"
  }),
  minister: Object.freeze({
    roleLabel: "大臣",
    authorityTier: "T4",
    loopLabel: "票拟覆奏与部务朝议",
    statusLabel: "部院待议",
    sourceViews: Object.freeze([
      "courtResponseView",
      "courtConsequenceView",
      "domainConsequenceView",
      "officialPostingsView",
      "economicFiscalView",
      "worldThreadView"
    ]),
    defaultSummary: "本旬以票拟覆奏、部务排程、财赋朝议和风宪风险为主。",
    defaultAction: "拟一份部院票拟，列公开凭据、会同衙门和需御前复核之处。"
  }),
  general: Object.freeze({
    roleLabel: "将领",
    authorityTier: "T4",
    loopLabel: "军帐粮道与边患",
    statusLabel: "军前候报",
    sourceViews: Object.freeze(["militaryDiplomacyView", "officialPostingsView", "mapRuntimeView", "eventArchiveView", "domainConsequenceView"]),
    defaultSummary: "本旬以粮饷、斥候、军心、边患和战报为主。",
    defaultAction: "拟一份军前回报，先列粮道、斥候、军心和边患公开情报。"
  }),
  emperor: Object.freeze({
    roleLabel: "皇帝",
    authorityTier: "T5",
    loopLabel: "御案奏议与天下调度",
    statusLabel: "御前临览",
    sourceViews: Object.freeze([
      "courtResponseView",
      "courtConsequenceView",
      "domainConsequenceView",
      "officialPostingsView",
      "worldThreadView",
      "economicFiscalView",
      "militaryDiplomacyView"
    ]),
    defaultSummary: "本旬以御案奏议、朱批留览、任免候选、赏罚预留和天下议题为主。",
    defaultAction: "草拟一道御前批示，先令相关衙门核公开凭据并列后续复核节点。"
  })
});

const ROLE_CYCLE_AI_READ_SCOPE = Object.freeze([
  "roleCycleView.currentRole",
  "roleCycleView.roleMatrix",
  "roleCycleView.currentRole.items",
  "roleCycleView.currentRole.items.evidenceRefs",
  "roleCycleView.currentRole.riskSignals",
  "roleCycleView.currentRole.nextActions",
  "roleCycleView.currentRole.entryPoints",
  "roleCycleView.aiReadScope.allowedSourceViews"
]);

const ROLE_CYCLE_TOOL_PERMISSIONS =
  "AI 只能读取身份循环安全 view 与列明来源，生成叙事、公开意见、行动草稿和待裁决建议；不能直接执行任免、调兵、财政拨付、审案定谳、考试晋级、NPC 行动或持久化写入。";

const ROLE_CYCLE_PROPOSAL_BOUNDARIES = Object.freeze([
  "身份循环只整理当前身份可见事务、风险、待办和草稿入口。",
  "跨身份矩阵只列角色职责和当前安全投影计数，不补造其他身份的内部案源。",
  "所有资源、身份、交易、NPC 行动、军政、财赋、考试和官场结果仍候服务器裁决。"
]);

const ROLE_CYCLE_SERVER_ADJUDICATION =
  "普通回合仍由既有服务器 resolver、账本和安全 projection 裁决；roleCycleView 不新增持久账本，不把前端草稿或 AI 建议当成已发生结果。";

module.exports = {
  ROLE_CYCLE_AI_READ_SCOPE,
  ROLE_CYCLE_LIMITS,
  ROLE_CYCLE_PROPOSAL_BOUNDARIES,
  ROLE_CYCLE_ROLE_CONFIGS,
  ROLE_CYCLE_ROLES,
  ROLE_CYCLE_SCHEMA_VERSION,
  ROLE_CYCLE_SERVER_ADJUDICATION,
  ROLE_CYCLE_TOOL_PERMISSIONS
};
