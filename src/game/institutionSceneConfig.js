const INSTITUTION_SCENE_SCHEMA_VERSION = 1;

const INSTITUTION_SCENE_TYPES = Object.freeze({
  courtDebate: "court_debate",
  examReview: "exam_review"
});

const INSTITUTION_SCENE_LIMITS = Object.freeze({
  maxParticipants: 6,
  maxRounds: 2,
  maxContextItems: 6,
  maxProposalsPerRound: 8,
  maxEvidenceRefs: 6,
  maxVisibleEffects: 6,
  maxTextLength: 180,
  maxTranscriptLines: 8
});

const INSTITUTION_SCENE_PROPOSAL_TYPES = Object.freeze([
  "memorial",
  "censure",
  "imperial_signal",
  "policy_review",
  "fiscal_warning",
  "frontier_warning",
  "exam_comment",
  "exam_audit_risk",
  "procedural_note",
  "defer_to_resolver"
]);

const COURT_DEBATE_PARTICIPANTS = Object.freeze([
  {
    participantRole: "emperor",
    actorType: "emperor",
    officeRef: { officeId: "emperor" },
    roleLabel: "御前裁断",
    defaultProposalType: "imperial_signal"
  },
  {
    participantRole: "personnel_minister",
    actorType: "minister",
    officeRef: "ministry_personnel_director",
    roleLabel: "吏部议拟",
    defaultProposalType: "memorial"
  },
  {
    participantRole: "censor",
    actorType: "censor",
    officeRef: "censorate_investigating_censor",
    roleLabel: "台谏纠核",
    defaultProposalType: "censure"
  },
  {
    participantRole: "domain_office",
    actorType: "minister",
    officeRef: "ministry_revenue_director",
    roleLabel: "相关部院",
    defaultProposalType: "policy_review"
  }
]);

const EXAM_REVIEW_PARTICIPANTS = Object.freeze([
  {
    participantRole: "room_officer",
    actorType: "examiner",
    officeRef: "hanlin_examiner",
    roleLabel: "房官初评",
    defaultProposalType: "exam_comment"
  },
  {
    participantRole: "co_examiner",
    actorType: "examiner",
    officeRef: "ministry_rites_principal",
    roleLabel: "同考官复核",
    defaultProposalType: "exam_comment"
  },
  {
    participantRole: "chief_examiner",
    actorType: "examiner",
    officeRef: "hanlin_editor",
    roleLabel: "主考酌定",
    defaultProposalType: "procedural_note"
  },
  {
    participantRole: "audit_critic",
    actorType: "censor",
    officeRef: "censorate_investigating_censor",
    roleLabel: "磨勘复核",
    defaultProposalType: "exam_audit_risk"
  }
]);

module.exports = {
  COURT_DEBATE_PARTICIPANTS,
  EXAM_REVIEW_PARTICIPANTS,
  INSTITUTION_SCENE_LIMITS,
  INSTITUTION_SCENE_PROPOSAL_TYPES,
  INSTITUTION_SCENE_SCHEMA_VERSION,
  INSTITUTION_SCENE_TYPES
};
