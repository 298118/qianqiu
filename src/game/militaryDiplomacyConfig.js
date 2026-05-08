const MILITARY_DIPLOMACY_SCHEMA_VERSION = 1;

const MILITARY_DIPLOMACY_CONFIG = Object.freeze({
  maxTheaters: 6,
  maxGarrisons: 8,
  maxSupplyLines: 6,
  maxDiplomaticContacts: 6,
  maxIncidents: 6,
  maxPromptReports: 8,
  maxRetrievalReports: 18,
  maxArchiveIncidents: 5,
  textLimit: 180,
  garrisonCityThreshold: 58,
  thresholds: Object.freeze({
    watch: 45,
    strained: 62,
    urgent: 78,
    critical: 90
  }),
  theaterWeights: Object.freeze({
    frontierPressure: 0.42,
    diplomaticTension: 0.22,
    supplyRisk: 0.18,
    readinessGap: 0.18
  }),
  readinessWeights: Object.freeze({
    cityGarrison: 0.42,
    armyMorale: 0.3,
    countryReadiness: 0.28
  }),
  garrisonWeights: Object.freeze({
    cityGarrison: 0.56,
    armyMorale: 0.28,
    disasterSafety: 0.16
  }),
  supplyWeights: Object.freeze({
    routeRisk: 0.42,
    grainStress: 0.28,
    marketStress: 0.18,
    trafficLoad: 0.12
  }),
  roleAccess: Object.freeze({
    scholar: Object.freeze({
      theaterLimit: 0,
      contactLimit: 0,
      notice: "书生默认只能听见零散边报，不读取完整军务外交态势。"
    }),
    magistrate: Object.freeze({
      theaterLimit: 1,
      contactLimit: 1,
      notice: "地方官只读取与辖区或公开边报相关的有限军务线索。"
    }),
    official: Object.freeze({
      theaterLimit: 2,
      contactLimit: 2,
      notice: "入仕官员只读取与本官署职责、任所或公开奏报相关的军务外交摘要。"
    }),
    minister: Object.freeze({
      theaterLimit: 4,
      contactLimit: 4,
      notice: "大臣可读取跨区域军务外交摘要，但不能直接裁决战和。"
    }),
    general: Object.freeze({
      theaterLimit: 5,
      contactLimit: 3,
      notice: "将领可读取边镇、粮道、战备和侦报摘要；服务器仍裁决军令和战果。"
    }),
    emperor: Object.freeze({
      theaterLimit: 6,
      contactLimit: 6,
      notice: "皇帝可读取最高层军务外交摘要；宣战、和议、调兵和任免仍需服务器裁决。"
    })
  })
});

module.exports = {
  MILITARY_DIPLOMACY_CONFIG,
  MILITARY_DIPLOMACY_SCHEMA_VERSION
};
