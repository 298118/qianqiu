const OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION = "s88.4-official-court-response.v1";

const OFFICIAL_COURT_RESPONSE_LIMITS = Object.freeze({
  maxTextLength: 180,
  maxShortTextLength: 96,
  maxItems: 6,
  maxResponses: 8,
  maxActions: 4,
  maxSourceRefs: 8
});

const OFFICIAL_COURT_RESPONSE_ROLES = Object.freeze([
  "emperor",
  "minister",
  "official",
  "bureau"
]);

const OFFICIAL_COURT_RESPONSE_ROLE_LABELS = Object.freeze({
  emperor: "御前",
  minister: "部院",
  official: "本官",
  bureau: "有司"
});

const OFFICIAL_COURT_RESPONSE_KINDS = Object.freeze([
  "vermilion_note",
  "bureau_reply",
  "court_comment",
  "evidence_request",
  "assessment_note"
]);

const OFFICIAL_COURT_RESPONSE_KIND_LABELS = Object.freeze({
  vermilion_note: "朱批留览",
  bureau_reply: "部院覆奏",
  court_comment: "朝议回应",
  evidence_request: "补据请核",
  assessment_note: "考成观察"
});

const OFFICIAL_COURT_RESPONSE_STATUSES = Object.freeze([
  "draft_recorded",
  "requested_evidence",
  "referred_to_bureau",
  "noted_by_throne",
  "held_for_deliberation",
  "assessment_watch"
]);

const OFFICIAL_COURT_RESPONSE_STATUS_LABELS = Object.freeze({
  draft_recorded: "回应已记",
  requested_evidence: "请补公开凭据",
  referred_to_bureau: "交部院覆奏",
  noted_by_throne: "御前留览",
  held_for_deliberation: "留待朝议",
  assessment_watch: "入考成观察"
});

const OFFICIAL_COURT_RESPONSE_AUTHORITY_BOUNDARY =
  "跨身份奏议回应只记录御前、部院、本官和有司围绕公开材料形成的中间态；AI 与前端只能拟文案，服务器只写安全回应账本，不直接任免、奖惩、处分、拨钱粮、采纳奏折或成弹劾。";

const OFFICIAL_COURT_RESPONSE_AI_READ_SCOPE = Object.freeze([
  "courtResponseView.responseItems",
  "courtResponseView.recentResponses",
  "eventArchiveView.official_court_entry",
  "eventArchiveView.official_court_follow_up",
  "eventArchiveView.official_court_response",
  "worldThreadView.official_court_follow_up",
  "worldThreadView.official_court_response",
  "officialPostingsView.public"
]);

const OFFICIAL_COURT_RESPONSE_TOOL_PERMISSIONS =
  "AI 只能读取服务器清洗后的奏议回应 view、事件档案和公开议程，生成草稿与公开意见；不能调用任免、处分、成弹劾、财政、军事、内部查询、持久化写入或内部状态工具。";

const OFFICIAL_COURT_RESPONSE_SERVER_ADJUDICATION =
  "普通回合提交跨身份回应时，服务器按公开奏议、近次批复、玩家身份和关键词写入受限回应记录；长期世界后果、官缺、奖惩、处分和弹劾仍由后续规则裁决。";

module.exports = {
  OFFICIAL_COURT_RESPONSE_AI_READ_SCOPE,
  OFFICIAL_COURT_RESPONSE_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_RESPONSE_KIND_LABELS,
  OFFICIAL_COURT_RESPONSE_KINDS,
  OFFICIAL_COURT_RESPONSE_LIMITS,
  OFFICIAL_COURT_RESPONSE_ROLE_LABELS,
  OFFICIAL_COURT_RESPONSE_ROLES,
  OFFICIAL_COURT_RESPONSE_SCHEMA_VERSION,
  OFFICIAL_COURT_RESPONSE_SERVER_ADJUDICATION,
  OFFICIAL_COURT_RESPONSE_STATUS_LABELS,
  OFFICIAL_COURT_RESPONSE_STATUSES,
  OFFICIAL_COURT_RESPONSE_TOOL_PERMISSIONS
};
