const LOCAL_AFFAIRS_DOCKET_SCHEMA_VERSION = 1;

const LOCAL_AFFAIRS_DOCKET_CONFIG = Object.freeze({
  maxDockets: 18,
  maxPromptDockets: 8,
  maxArchiveDockets: 6,
  focusJurisdictionLimits: Object.freeze({
    magistrate: 1,
    official: 1,
    minister: 2,
    emperor: 3,
    general: 1
  }),
  severityThresholds: Object.freeze({
    watch: 45,
    strained: 62,
    urgent: 78,
    critical: 90
  }),
  maxAssessmentDelta: Object.freeze({
    minorMerit: 2,
    majorMerit: 4,
    minorRisk: 4,
    majorRisk: 8
  }),
  templates: Object.freeze([
    {
      id: "revenue",
      domain: "revenue",
      domainLabel: "钱粮",
      title: "钱粮奏销",
      actionLabel: "清厘钱粮、核册催征",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "taxCapacity", label: "税粮能力", direction: "inverse", weight: 0.45 },
        { source: "city", key: "grainStock", label: "仓储", direction: "inverse", weight: 0.25 },
        { source: "city", key: "marketPriceStress", label: "市价", direction: "direct", weight: 0.3 }
      ]),
      assessmentTags: Object.freeze(["钱粮", "库银", "仓储"]),
      maxMeritDelta: 3,
      maxRiskDelta: 6
    },
    {
      id: "judicial",
      domain: "judicial",
      domainLabel: "刑名",
      title: "刑名词讼",
      actionLabel: "清理积案、核认证据",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "lawsuits", label: "词讼", direction: "direct", weight: 0.65 },
        { source: "localMetrics", key: "publicOrder", label: "治安", direction: "inverse", weight: 0.35 }
      ]),
      assessmentTags: Object.freeze(["刑名", "词讼", "治安"]),
      maxMeritDelta: 3,
      maxRiskDelta: 6
    },
    {
      id: "relief",
      domain: "relief",
      domainLabel: "灾赈",
      title: "灾赈核发",
      actionLabel: "查灾报、核赈册、稳粮价",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "disasterRisk", label: "灾患", direction: "direct", weight: 0.45 },
        { source: "city", key: "grainStock", label: "粮储", direction: "inverse", weight: 0.25 },
        { source: "city", key: "marketPriceStress", label: "粮价", direction: "direct", weight: 0.3 }
      ]),
      assessmentTags: Object.freeze(["灾赈", "民心", "粮储"]),
      maxMeritDelta: 4,
      maxRiskDelta: 8
    },
    {
      id: "waterworks",
      domain: "waterworks",
      domainLabel: "水利",
      title: "水利修防",
      actionLabel: "查堤工、修闸坝、核工料",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "waterworks", label: "水利", direction: "inverse", weight: 0.75 },
        { source: "localMetrics", key: "disasterRisk", label: "灾患", direction: "direct", weight: 0.25 }
      ]),
      assessmentTags: Object.freeze(["水利", "工料", "灾防"]),
      maxMeritDelta: 4,
      maxRiskDelta: 7
    },
    {
      id: "banditry",
      domain: "banditry",
      domainLabel: "盗匪",
      title: "盗匪缉捕",
      actionLabel: "巡缉盗匪、整饬保甲",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "militaryPressure", label: "兵备盗警", direction: "direct", weight: 0.65 },
        { source: "localMetrics", key: "publicOrder", label: "治安", direction: "inverse", weight: 0.35 }
      ]),
      assessmentTags: Object.freeze(["盗匪", "保甲", "兵备"]),
      maxMeritDelta: 3,
      maxRiskDelta: 8
    },
    {
      id: "corvee",
      domain: "corvee",
      domainLabel: "徭役",
      title: "徭役工派",
      actionLabel: "平派徭役、核工役册",
      metricRefs: Object.freeze([
        { source: "city", key: "corveeBurden", label: "徭役", direction: "direct", weight: 0.65 },
        { source: "localMetrics", key: "publicOrder", label: "民情", direction: "inverse", weight: 0.2 },
        { source: "localMetrics", key: "gentryInfluence", label: "士绅", direction: "direct", weight: 0.15 }
      ]),
      assessmentTags: Object.freeze(["徭役", "工派", "民情"]),
      maxMeritDelta: 3,
      maxRiskDelta: 6
    },
    {
      id: "gentry",
      domain: "gentry",
      domainLabel: "士绅",
      title: "士绅公议",
      actionLabel: "约束豪右、调停乡约",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "gentryInfluence", label: "士绅", direction: "direct", weight: 0.65 },
        { source: "localMetrics", key: "lawsuits", label: "词讼", direction: "direct", weight: 0.2 },
        { source: "city", key: "marketPriceStress", label: "市价", direction: "direct", weight: 0.15 }
      ]),
      assessmentTags: Object.freeze(["士绅", "乡约", "舆情"]),
      maxMeritDelta: 2,
      maxRiskDelta: 6
    },
    {
      id: "epidemic",
      domain: "epidemic",
      domainLabel: "疫病",
      title: "疫病防治",
      actionLabel: "稽查疫报、施药安民",
      metricRefs: Object.freeze([
        { source: "localMetrics", key: "disasterRisk", label: "灾疫", direction: "direct", weight: 0.35 },
        { source: "city", key: "populationScale", label: "人烟", direction: "direct", weight: 0.25 },
        { source: "city", key: "marketPriceStress", label: "市价", direction: "direct", weight: 0.2 },
        { source: "localMetrics", key: "publicOrder", label: "秩序", direction: "inverse", weight: 0.2 }
      ]),
      assessmentTags: Object.freeze(["疫病", "医药", "民心"]),
      maxMeritDelta: 4,
      maxRiskDelta: 8
    }
  ]),
  termClosure: Object.freeze({
    id: "term_closure",
    domain: "term_closure",
    domainLabel: "任所收束",
    title: "任所收束",
    actionLabel: "清结差事、预备考成复核",
    metricRefs: Object.freeze([
      { source: "posting", key: "reviewDuePressure", label: "复核期", direction: "direct", weight: 0.35 },
      { source: "posting", key: "impeachmentRisk", label: "风评风险", direction: "direct", weight: 0.35 },
      { source: "posting", key: "performanceScore", label: "绩效", direction: "inverse", weight: 0.3 }
    ]),
    assessmentTags: Object.freeze(["任所", "差事", "考成"]),
    maxMeritDelta: 4,
    maxRiskDelta: 8
  })
});

module.exports = {
  LOCAL_AFFAIRS_DOCKET_CONFIG,
  LOCAL_AFFAIRS_DOCKET_SCHEMA_VERSION
};
