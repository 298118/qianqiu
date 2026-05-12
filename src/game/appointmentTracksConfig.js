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

module.exports = {
  APPOINTMENT_TRACK_LIMITS,
  APPOINTMENT_TRACK_METER_DELTAS,
  APPOINTMENT_TRACK_PRIORITY,
  APPOINTMENT_TRACK_SCHEMA_VERSION
};
