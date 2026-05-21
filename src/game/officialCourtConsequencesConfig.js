const OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION = "s88.4-official-court-consequence.v1";

const OFFICIAL_COURT_CONSEQUENCE_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxShortTextLength: 96,
  maxSignals: 10,
  maxSources: 8,
  maxActions: 4,
  maxSourceRefs: 8
});

const OFFICIAL_COURT_CONSEQUENCE_KINDS = Object.freeze([
  "assessment_pressure",
  "impeachment_watch",
  "merit_trace",
  "evidence_gap",
  "court_attention"
]);

const OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS = Object.freeze({
  assessment_pressure: "考成压力",
  impeachment_watch: "风宪观察",
  merit_trace: "功绩留痕",
  evidence_gap: "凭据缺口",
  court_attention: "朝廷关注"
});

const OFFICIAL_COURT_CONSEQUENCE_STATUSES = Object.freeze([
  "signal_recorded",
  "assessment_noted",
  "watchlist",
  "evidence_pending",
  "monthly_trace"
]);

const OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS = Object.freeze({
  signal_recorded: "信号已记",
  assessment_noted: "入考成观察",
  watchlist: "列风宪观察",
  evidence_pending: "待补公开凭据",
  monthly_trace: "月报可摘"
});

const OFFICIAL_COURT_CONSEQUENCE_AUTHORITY_BOUNDARY =
  "官场长期后果信号只把奏议裁决、跟进批复和跨身份回应整理为考成、风宪、月报与议程的公开中间态；服务器可做微量考成/风险观察，但不直接调整官缺、落成赏罚、写处分终局、动用财赋、形成奏议终局或风宪定案。";

const OFFICIAL_COURT_CONSEQUENCE_AI_READ_SCOPE = Object.freeze([
  "courtConsequenceView.pendingSources",
  "courtConsequenceView.recentSignals",
  "officialCareerView.assessment",
  "officialCareerView.courtEntry",
  "courtResponseView.recentResponses",
  "eventArchiveView.official_court_follow_up",
  "eventArchiveView.official_court_response",
  "worldThreadView.official_court_consequence"
]);

const OFFICIAL_COURT_CONSEQUENCE_TOOL_PERMISSIONS =
  "AI 只能读取服务器安全 view、公开事件档案和世界议程，生成长期后果观察、补据清单和月报草稿；不能调用官缺调整、处分终局、风宪定案、财政款项、军事、内部查询、持久化写入或内部状态工具。";

const OFFICIAL_COURT_CONSEQUENCE_SERVER_ADJUDICATION =
  "普通回合或月末由服务器按公开奏议链路、近次回应、考成簿和风宪风险生成后果信号；正式官职升降、赏罚处分、风宪定案、财赋动用和世界终局仍由后续服务器规则裁决。";

module.exports = {
  OFFICIAL_COURT_CONSEQUENCE_AI_READ_SCOPE,
  OFFICIAL_COURT_CONSEQUENCE_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_CONSEQUENCE_KIND_LABELS,
  OFFICIAL_COURT_CONSEQUENCE_KINDS,
  OFFICIAL_COURT_CONSEQUENCE_LIMITS,
  OFFICIAL_COURT_CONSEQUENCE_SCHEMA_VERSION,
  OFFICIAL_COURT_CONSEQUENCE_SERVER_ADJUDICATION,
  OFFICIAL_COURT_CONSEQUENCE_STATUS_LABELS,
  OFFICIAL_COURT_CONSEQUENCE_STATUSES,
  OFFICIAL_COURT_CONSEQUENCE_TOOL_PERMISSIONS
};
