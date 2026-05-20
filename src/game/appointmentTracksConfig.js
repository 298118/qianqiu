const APPOINTMENT_TRACK_SCHEMA_VERSION = 1;

const APPOINTMENT_TRACK_LIMITS = Object.freeze({
  maxRecords: 8,
  maxVisibleRecords: 5,
  maxPromptRecords: 3,
  maxCandidateTracks: 6,
  maxAvoidanceChecks: 6,
  textPreviewLength: 180
});

const APPOINTMENT_TRACK_PRIORITY = Object.freeze({
  topHanlin: 100,
  firstClassHanlinEditor: 94,
  secondClassShujishi: 86,
  secondClassObservation: 66,
  centralVacancy: 62,
  thirdClassOutpost: 78,
  thirdClassCentral: 64,
  pendingSelection: 48
});

const APPOINTMENT_TRACK_METER_DELTAS = Object.freeze({
  top_hanlin_compiler: Object.freeze({
    superiorFavor: 8,
    peerNetwork: 6,
    performanceMerit: 4,
    promotionProspect: 10,
    cleanReputation: 3
  }),
  top_hanlin_editor: Object.freeze({
    superiorFavor: 7,
    peerNetwork: 6,
    performanceMerit: 4,
    promotionProspect: 9,
    cleanReputation: 3
  }),
  second_shujishi: Object.freeze({
    superiorFavor: 5,
    peerNetwork: 7,
    performanceMerit: 3,
    promotionProspect: 8,
    cleanReputation: 2
  }),
  second_observation: Object.freeze({
    superiorFavor: 3,
    peerNetwork: 4,
    performanceMerit: 3,
    promotionProspect: 5,
    cleanReputation: 1
  }),
  ministry_appointee: Object.freeze({
    superiorFavor: 4,
    peerNetwork: 3,
    performanceMerit: 5,
    promotionProspect: 5,
    cleanReputation: 1
  }),
  outpost_appointee: Object.freeze({
    superiorFavor: 2,
    peerNetwork: 2,
    performanceMerit: 7,
    promotionProspect: 4,
    cleanReputation: 2,
    impeachmentRisk: -2
  }),
  pending_selection: Object.freeze({
    superiorFavor: 1,
    peerNetwork: 2,
    performanceMerit: 1,
    promotionProspect: 2
  })
});

const APPOINTMENT_FIRST_MONTH_ASSIGNMENTS = Object.freeze({
  top_hanlin_compiler: Object.freeze({
    title: "御前讲章初稿",
    kind: "memorial_drafting",
    sourceType: "superior",
    sourceId: "hanlin_academy",
    progress: 18,
    risk: 16,
    publicStake: 58,
    privatePressure: 22,
    deadlineMonths: 1,
    visibleSummary: "首月须拟御前讲章与馆阁制诰小稿，清望、章法与上官眼色都会入考成。",
    relatedContacts: Object.freeze(["署中上官", "同年进士"]),
    relatedFactions: Object.freeze(["翰林清议"])
  }),
  top_hanlin_editor: Object.freeze({
    title: "馆阁讲章校订",
    kind: "memorial_drafting",
    sourceType: "superior",
    sourceId: "hanlin_academy",
    progress: 18,
    risk: 17,
    publicStake: 56,
    privatePressure: 22,
    deadlineMonths: 1,
    visibleSummary: "首月须校订馆阁讲章并试拟制诰，既是清贵起步，也是同僚观望。",
    relatedContacts: Object.freeze(["署中上官", "同年进士"]),
    relatedFactions: Object.freeze(["翰林清议"])
  }),
  second_shujishi: Object.freeze({
    title: "馆课试艺与散馆预备",
    kind: "memorial_drafting",
    sourceType: "bureau",
    sourceId: "hanlin_academy",
    progress: 16,
    risk: 20,
    publicStake: 52,
    privatePressure: 24,
    deadlineMonths: 1,
    visibleSummary: "首月入馆先试馆课，文章、师友声气和散馆前程都会进入官场账本。",
    relatedContacts: Object.freeze(["座师", "同年进士"]),
    relatedFactions: Object.freeze(["馆选士林"])
  }),
  second_observation: Object.freeze({
    title: "观政清册点收",
    kind: "routine_office",
    sourceType: "bureau",
    sourceId: "ministry_personnel",
    progress: 14,
    risk: 18,
    publicStake: 44,
    privatePressure: 18,
    deadlineMonths: 1,
    visibleSummary: "首月观政须点收部曹清册，熟悉文移与同僚次第，不能凭科名空转。",
    relatedContacts: Object.freeze(["吏部司官", "同年进士"]),
    relatedFactions: Object.freeze(["部曹清议"])
  }),
  ministry_appointee: Object.freeze({
    title: "部曹清册点收",
    kind: "routine_office",
    sourceType: "bureau",
    sourceId: "ministry_personnel",
    progress: 16,
    risk: 21,
    publicStake: 48,
    privatePressure: 22,
    deadlineMonths: 1,
    visibleSummary: "首月补入部曹，先点收清册与往来文移，差错会直接影响上官观感。",
    relatedContacts: Object.freeze(["吏部司官", "同年进士"]),
    relatedFactions: Object.freeze(["部曹清议"])
  }),
  outpost_appointee: Object.freeze({
    title: "到任册籍与民情初访",
    kind: "land_survey",
    sourceType: "bureau",
    sourceId: "ministry_personnel",
    progress: 15,
    risk: 28,
    publicStake: 64,
    privatePressure: 30,
    deadlineMonths: 1,
    visibleSummary: "首月外放须点验册籍、访查民情与士绅旧弊，功过很快进入地方考成。",
    relatedContacts: Object.freeze(["地方胥吏", "同年进士"]),
    relatedFactions: Object.freeze(["地方士绅"])
  }),
  pending_selection: Object.freeze({
    title: "候缺观政日课",
    kind: "personnel_review",
    sourceType: "bureau",
    sourceId: "ministry_personnel",
    progress: 12,
    risk: 14,
    publicStake: 40,
    privatePressure: 16,
    deadlineMonths: 1,
    visibleSummary: "首月候缺仍须呈交观政日课，等缺不是空等，部议会看履历与日课。",
    relatedContacts: Object.freeze(["吏部司官", "同年进士"]),
    relatedFactions: Object.freeze(["部曹清议"])
  })
});

module.exports = {
  APPOINTMENT_FIRST_MONTH_ASSIGNMENTS,
  APPOINTMENT_TRACK_LIMITS,
  APPOINTMENT_TRACK_METER_DELTAS,
  APPOINTMENT_TRACK_PRIORITY,
  APPOINTMENT_TRACK_SCHEMA_VERSION
};
