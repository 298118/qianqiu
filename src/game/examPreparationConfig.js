const EXAM_PREPARATION_SCHEMA_VERSION = 1;

const EXAM_PREPARATION_LIMITS = Object.freeze({
  maxCauses: 4,
  maxSuggestedActions: 4,
  maxVisibleText: 140
});

const EXAM_PREPARATION_AUTHORITY_BOUNDARY =
  "备考压力由服务器按盘费、保结、旅程、身心和读书计划派生；AI 与前端只能读取摘要或生成建议，不能准考、定榜、晋级或授官。";

const EXAM_PREPARATION_PRESSURE = Object.freeze({
  baseByDistance: Object.freeze({
    local: 8,
    provincial: 16,
    capital: 24,
    palace: 20
  }),
  shortfallMax: 34,
  travelMonthWeight: 8,
  sponsorshipPenalty: Object.freeze({
    ready: 0,
    conditional: 8,
    not_ready: 22,
    not_recorded: 14
  }),
  readinessMissingWeight: 6,
  lowAttributeThreshold: 62,
  lowAttributeWeight: 10,
  criticalAttributeThreshold: 45,
  criticalAttributeWeight: 18,
  bands: Object.freeze([
    Object.freeze({
      key: "steady",
      min: 0,
      label: "从容",
      summary: "盘费、保结与心态大体可支撑入场，按读书计划稳住章法即可。"
    }),
    Object.freeze({
      key: "watch",
      min: 30,
      label: "留意",
      summary: "入场准备已有一两处牵挂，宜先补盘费、保结或弱项日课。"
    }),
    Object.freeze({
      key: "strained",
      min: 55,
      label: "吃紧",
      summary: "备考压力偏高，旅费、保结、身体或心神会影响场内稳定。"
    }),
    Object.freeze({
      key: "severe",
      min: 75,
      label: "危急",
      summary: "临考压力已重，若不先稳盘费、保结与身心，入场后容易失常。"
    })
  ])
});

module.exports = {
  EXAM_PREPARATION_AUTHORITY_BOUNDARY,
  EXAM_PREPARATION_LIMITS,
  EXAM_PREPARATION_PRESSURE,
  EXAM_PREPARATION_SCHEMA_VERSION
};
