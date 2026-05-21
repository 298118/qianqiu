const OFFICIAL_COURT_ENTRY_SCHEMA_VERSION = "s88.4-official-court-entry.v1";

const OFFICIAL_COURT_ENTRY_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxShortTextLength: 96,
  maxSignals: 4,
  maxActions: 4,
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

module.exports = {
  OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_LIMITS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_STATUSES,
  OFFICIAL_COURT_ENTRY_SCHEMA_VERSION,
  OFFICIAL_COURT_ENTRY_TARGETS
};
