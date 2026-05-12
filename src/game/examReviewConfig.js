const EXAM_REVIEW_SCHEMA_VERSION = 1;

const EXAM_REVIEW_LIMITS = Object.freeze({
  maxVisibleIncidents: 5,
  maxVisibleAuditFlags: 5,
  maxVisibleReviews: 6,
  maxScoreInputs: 5,
  maxPromptReviews: 3,
  textPreviewLength: 160,
  maxSingleReviewerDelta: 2,
  maxTotalReviewerDelta: 4,
  maxEventPenalty: 8
});

const EXAM_REVIEW_ACTORS = Object.freeze([
  {
    actor: "room_officer",
    label: "房官初评",
    authority: "只评脱敏卷面与取中尺度，不定榜。"
  },
  {
    actor: "co_examiner",
    label: "同考官复核",
    authority: "只复看疑点与文风分歧，不改名次。"
  },
  {
    actor: "chief_examiner",
    label: "主考酌定",
    authority: "只给榜前取舍意见，canonical ranking 仍归服务器。"
  },
  {
    actor: "audit_critic",
    label: "磨勘复核",
    authority: "只提示舞弊、错录和格式风险，处分归服务器。"
  }
]);

const EXAM_REVIEW_ACTOR_LABELS = Object.freeze(
  Object.fromEntries(EXAM_REVIEW_ACTORS.map((actor) => [actor.actor, actor.label]))
);

module.exports = {
  EXAM_REVIEW_ACTOR_LABELS,
  EXAM_REVIEW_ACTORS,
  EXAM_REVIEW_LIMITS,
  EXAM_REVIEW_SCHEMA_VERSION
};
