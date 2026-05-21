const OFFICIAL_COURT_ENTRY_SCHEMA_VERSION = "s88.4-official-court-entry.v1";

const OFFICIAL_COURT_ENTRY_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxShortTextLength: 96,
  maxSignals: 4,
  maxActions: 4,
  maxFollowUpActors: 4,
  maxFollowUpHistory: 6,
  maxFollowUpProposals: 4,
  maxSourceRefs: 6,
  maxResolutionHistory: 6
});

const OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY =
  "首月回署材料只能进入奏折队列、朝议筹议和考成追踪的安全投影；AI 与前端只拟文案，不能直接改官职、定奖惩、成弹劾或写隐藏状态。";

const OFFICIAL_COURT_ENTRY_TARGETS = Object.freeze([
  Object.freeze({
    surfaceId: "memorial-review",
    label: "奏折队列",
    draftKind: "official_first_month_memorial"
  }),
  Object.freeze({
    surfaceId: "court-debate",
    label: "朝议筹议",
    draftKind: "official_first_month_debate"
  })
]);

const OFFICIAL_COURT_ENTRY_RESOLUTION_STATUSES = Object.freeze([
  "accepted_for_review",
  "referred_to_bureau",
  "held_for_inquiry",
  "returned_for_evidence",
  "recorded_for_assessment"
]);

const OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS = Object.freeze({
  accepted_for_review: "准入复核",
  referred_to_bureau: "转部核议",
  held_for_inquiry: "留中补查",
  returned_for_evidence: "驳回补据",
  recorded_for_assessment: "续入考成"
});

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_SCHEMA_VERSION = "s88.4-official-court-follow-up.v1";

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_AUTHORITY_BOUNDARY =
  "首月奏议后续只记录朝议、部院覆奏、御前摘报和考成观察的公开中间态；AI 与前端不能直接任免、奖惩、处分、成弹劾、拨钱粮或写隐藏状态。";

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGES = Object.freeze([
  "court_deliberation",
  "bureau_review",
  "imperial_note",
  "assessment_watch"
]);

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGE_LABELS = Object.freeze({
  court_deliberation: "朝议跟进",
  bureau_review: "部院覆奏",
  imperial_note: "御前摘报",
  assessment_watch: "考成观察"
});

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUSES = Object.freeze([
  "deliberated",
  "referred_to_bureau",
  "imperial_noted",
  "returned_for_evidence",
  "recorded_for_assessment"
]);

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUS_LABELS = Object.freeze({
  deliberated: "已成朝议",
  referred_to_bureau: "部院待覆",
  imperial_noted: "御前留览",
  returned_for_evidence: "补据再议",
  recorded_for_assessment: "入考成观察"
});

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_AI_READ_SCOPE = Object.freeze([
  "officialCareerView.courtEntry",
  "officialCareerView.courtEntries",
  "eventArchiveView.official_court_entry",
  "playerMonthlyBriefingView",
  "officialPostingsView",
  "actorMemoryView.public"
]);

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_TOOL_PERMISSIONS =
  "多 actor 只能生成公开意见、证据引用和后续草稿；不能调用任免、处分、弹劾成案、财政、军事、持久化读写或内部查询工具。";

const OFFICIAL_COURT_ENTRY_FOLLOW_UP_SERVER_ADJUDICATION =
  "服务器按近次奏议裁决、首月差事进度、风险和公开证据生成中间态记录；长期奖惩、官缺、处分和世界后果仍由后续规则结算。";

module.exports = {
  OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_AI_READ_SCOPE,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_SCHEMA_VERSION,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_SERVER_ADJUDICATION,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGE_LABELS,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGES,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUS_LABELS,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUSES,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_TOOL_PERMISSIONS,
  OFFICIAL_COURT_ENTRY_LIMITS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_STATUSES,
  OFFICIAL_COURT_ENTRY_SCHEMA_VERSION,
  OFFICIAL_COURT_ENTRY_TARGETS
};
