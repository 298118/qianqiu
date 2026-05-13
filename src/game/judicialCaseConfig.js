const JUDICIAL_CASE_SCHEMA_VERSION = 1;

const JUDICIAL_CASE_RECORD_LIMIT = 16;

const JUDICIAL_CASE_ALLOWED_TIERS = Object.freeze(["T2", "T3", "T4", "T5"]);
const JUDICIAL_CASE_TIER_ORDER = Object.freeze(["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);

const JUDICIAL_CASE_EVIDENCE_DOMAINS = Object.freeze(["local_docket", "events", "people", "offices", "office"]);

const JUDICIAL_CASE_EVIDENCE_CREDIBILITY = Object.freeze({
  local_docket: 0.86,
  events: 0.66,
  people: 0.72,
  offices: 0.76,
  office: 0.76
});

const JUDICIAL_CASE_INSTITUTIONAL_PATHS = Object.freeze([
  "county_docket",
  "prefectural_review",
  "provincial_review",
  "ministry_review",
  "censorate_review",
  "imperial_rescript",
  "transfer_order"
]);

const JUDICIAL_CASE_ACTION_ALIASES = Object.freeze({
  accept: "accept",
  register: "accept",
  receive: "accept",
  summon: "summon",
  subpoena: "summon",
  investigate: "investigate",
  verify: "investigate",
  mediate: "mediate",
  fine: "fine",
  detain: "detain",
  dismiss: "dismiss",
  judge: "judge",
  verdict: "judge",
  sentence: "judge",
  convict: "judge",
  escalate: "escalate",
  submit_review: "escalate",
  transfer: "transfer",
  handoff: "transfer",
  defer: "defer",
  delay: "defer"
});

const JUDICIAL_CASE_ACTIONS = Object.freeze({
  accept: Object.freeze({
    label: "受理",
    summaryVerb: "受理成案",
    minimumAuthorityTier: "T2",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    stateDelta: Object.freeze({ publicOrder: 1 }),
    playerDelta: Object.freeze({ pendingLawsuits: 1, performanceMerit: 1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 1, obligation: 1 }),
    clerkResistance: 1,
    riskTags: Object.freeze(["case_acceptance", "docket"])
  }),
  summon: Object.freeze({
    label: "传唤",
    summaryVerb: "传唤到案",
    minimumAuthorityTier: "T2",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    stateDelta: Object.freeze({ publicOrder: 1 }),
    playerDelta: Object.freeze({ performanceMerit: 1, impeachmentRisk: 1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 2, obligation: 0 }),
    clerkResistance: 2,
    riskTags: Object.freeze(["summons", "procedure"])
  }),
  investigate: Object.freeze({
    label: "查证",
    summaryVerb: "复认证据",
    minimumAuthorityTier: "T2",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    stateDelta: Object.freeze({ publicOrder: 2, corruption: -1 }),
    playerDelta: Object.freeze({ performanceMerit: 1, cleanReputation: 1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 1, obligation: 0 }),
    clerkResistance: 2,
    riskTags: Object.freeze(["evidence_review", "procedure"])
  }),
  mediate: Object.freeze({
    label: "调解",
    summaryVerb: "堂上调停",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.5,
    stateDelta: Object.freeze({ publicOrder: 3 }),
    playerDelta: Object.freeze({ pendingLawsuits: -2, performanceMerit: 1, gentryRelations: 2 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: -2, obligation: 2 }),
    clerkResistance: 1,
    riskTags: Object.freeze(["mediation", "relationship"])
  }),
  fine: Object.freeze({
    label: "罚银",
    summaryVerb: "断令罚银",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.95,
    stateDelta: Object.freeze({ treasury: 30, publicOrder: 1 }),
    playerDelta: Object.freeze({ pendingLawsuits: -1, cleanReputation: -1, impeachmentRisk: 1, gentryRelations: -1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 4, obligation: -1 }),
    clerkResistance: 3,
    riskTags: Object.freeze(["fine", "punishment"])
  }),
  detain: Object.freeze({
    label: "羁押",
    summaryVerb: "羁押候审",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 0.95,
    stateDelta: Object.freeze({ publicOrder: 3, corruption: -1 }),
    playerDelta: Object.freeze({ pendingLawsuits: -1, cleanReputation: 1, impeachmentRisk: 2, gentryRelations: -2 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 6, obligation: -2 }),
    clerkResistance: 4,
    riskTags: Object.freeze(["detention", "punishment"])
  }),
  dismiss: Object.freeze({
    label: "驳回",
    summaryVerb: "驳回词讼",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.5,
    stateDelta: Object.freeze({ publicOrder: -2 }),
    playerDelta: Object.freeze({ pendingLawsuits: -1, impeachmentRisk: 1, gentryRelations: -1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 3, obligation: -1 }),
    clerkResistance: 1,
    riskTags: Object.freeze(["dismissal", "procedure"])
  }),
  judge: Object.freeze({
    label: "判决",
    summaryVerb: "照例判决",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 2,
    minimumEvidenceScore: 1,
    stateDelta: Object.freeze({ publicOrder: 5, corruption: -1 }),
    playerDelta: Object.freeze({ pendingLawsuits: -3, performanceMerit: 2, cleanReputation: 1, impeachmentRisk: 1, gentryRelations: -2 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 5, obligation: -2 }),
    clerkResistance: 4,
    majorCase: true,
    riskTags: Object.freeze(["verdict", "punishment", "major_case"])
  }),
  escalate: Object.freeze({
    label: "申详",
    summaryVerb: "申详上司",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.5,
    stateDelta: Object.freeze({ publicOrder: 1 }),
    playerDelta: Object.freeze({ pendingLawsuits: -1, performanceMerit: 1, superiorFavor: 1, impeachmentRisk: -1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 1, obligation: 0 }),
    clerkResistance: 2,
    riskTags: Object.freeze(["escalation", "institutional_path"])
  }),
  transfer: Object.freeze({
    label: "移交",
    summaryVerb: "移交管辖",
    minimumAuthorityTier: "T3",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.5,
    stateDelta: Object.freeze({ publicOrder: 1 }),
    playerDelta: Object.freeze({ pendingLawsuits: -1, superiorFavor: 1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 1, obligation: 0 }),
    clerkResistance: 2,
    riskTags: Object.freeze(["transfer", "jurisdiction"])
  }),
  defer: Object.freeze({
    label: "缓审",
    summaryVerb: "留案缓审",
    minimumAuthorityTier: "T2",
    minimumEvidenceRefs: 1,
    minimumEvidenceScore: 0.45,
    stateDelta: Object.freeze({ publicOrder: -1 }),
    playerDelta: Object.freeze({ pendingLawsuits: 1, impeachmentRisk: 1 }),
    evidenceDomains: JUDICIAL_CASE_EVIDENCE_DOMAINS,
    relationshipDelta: Object.freeze({ resentment: 2, obligation: 0 }),
    clerkResistance: 1,
    riskTags: Object.freeze(["defer", "backlog"])
  })
});

module.exports = {
  JUDICIAL_CASE_ACTION_ALIASES,
  JUDICIAL_CASE_ACTIONS,
  JUDICIAL_CASE_ALLOWED_TIERS,
  JUDICIAL_CASE_EVIDENCE_CREDIBILITY,
  JUDICIAL_CASE_EVIDENCE_DOMAINS,
  JUDICIAL_CASE_INSTITUTIONAL_PATHS,
  JUDICIAL_CASE_RECORD_LIMIT,
  JUDICIAL_CASE_SCHEMA_VERSION,
  JUDICIAL_CASE_TIER_ORDER
};
