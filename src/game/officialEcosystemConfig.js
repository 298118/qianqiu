const OFFICIAL_ECOSYSTEM_CONFIG = Object.freeze({
  rowIds: Object.freeze({
    superiorPosting: "posting-s63-superior-current",
    officeInterfacePosting: "posting-s63-office-interface-current",
    restorationPosting: "posting-s63-restoration-pending",
    impeachmentPosting: "posting-s63-impeachment-watch",
    restorationTransfer: "transfer-s63-restoration-pending",
    mourningTransfer: "transfer-s63-mourning-vacancy",
    impeachmentAssessment: "assessment-s63-impeachment-watch",
    interfaceAssessment: "assessment-s63-office-interface-current"
  }),
  reviewTurns: Object.freeze({
    superior: 18,
    officeInterface: 9,
    vacancyBase: 6,
    vacancyStep: 3,
    restoration: 12,
    impeachment: 4
  }),
  scoreDefaults: Object.freeze({
    superiorPerformance: 68,
    superiorRisk: 16,
    interfacePerformance: 55,
    interfaceRisk: 28,
    vacancyReputation: 50,
    restorationPerformance: 52,
    restorationRisk: 34,
    impeachmentPerformance: 35,
    impeachmentRisk: 72
  }),
  vacancyOfficeIds: Object.freeze([
    "county_magistrate",
    "prefecture_judge",
    "ministry_revenue_principal",
    "censorate_investigating_censor"
  ]),
  superiorOfficeByBureau: Object.freeze({
    hanlin_academy: "hanlin_editor",
    ministry_personnel: "ministry_personnel_director",
    ministry_revenue: "ministry_revenue_director",
    ministry_rites: "ministry_personnel_director",
    ministry_war: "ministry_personnel_director",
    ministry_justice: "censorate_assistant_censor",
    ministry_works: "ministry_revenue_director",
    censorate: "censorate_assistant_censor",
    provincial_admin: "provincial_admin_councillor",
    provincial_judicial: "provincial_judicial_assistant",
    prefecture_county: "prefecture_magistrate"
  }),
  interfaceOfficeByBureau: Object.freeze({
    ministry_revenue: "ministry_revenue_deputy_director",
    ministry_personnel: "ministry_personnel_principal",
    ministry_justice: "prefecture_judge",
    censorate: "censorate_investigating_censor",
    prefecture_county: "prefecture_assistant"
  }),
  pressureThresholds: Object.freeze({
    highVacancyPressure: 60,
    highLawsuitPressure: 55,
    lowTaxCapacity: 45,
    highDisasterRisk: 58,
    highMilitaryPressure: 55,
    highGentryInfluence: 64
  }),
  vacancyPressureWeights: Object.freeze({
    lawsuits: 0.25,
    disasterRisk: 0.2,
    militaryPressure: 0.2,
    lowTaxCapacity: 0.2,
    gentryInfluence: 0.15
  }),
  visibleNpcRankPatterns: Object.freeze({
    superior: Object.freeze(["上官", "在任官员", "官员", "御史"]),
    clerk: Object.freeze(["胥吏", "幕友", "同僚", "属官"]),
    gentry: Object.freeze(["士绅", "书院师友", "商贾"]),
    candidate: Object.freeze(["候补", "在任官员", "官员", "同年"])
  })
});

module.exports = {
  OFFICIAL_ECOSYSTEM_CONFIG
};
