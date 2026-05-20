const EXAM_AFTERMATH_SCHEMA_VERSION = 1;

const EXAM_AFTERMATH_LIMITS = Object.freeze({
  maxContacts: 4,
  maxNextActions: 4,
  maxVisibleText: 160
});

const EXAM_AFTERMATH_AUTHORITY_BOUNDARY =
  "放榜后过渡只读服务器定榜、科名荣誉、公开同年座师和授官轨迹；AI 与前端不能补名次、造关系、定官职或写 hidden 私档。";

const EXAM_AFTERMATH_NEXT_STEPS = Object.freeze({
  failed: Object.freeze([
    "复盘本场弱项，先请老师评改一篇同题文章。",
    "整理盘费、保结和读书计划，等待下一场公开科期。"
  ]),
  child_exam: Object.freeze([
    "以新进生员身份续读经义，先稳岁试与乡试章法。",
    "拜谢学政与塾师，只作公开礼数往来。"
  ]),
  provincial_exam: Object.freeze([
    "具帖拜会座师与房师，询问会试前读书章程。",
    "联络同年互看近作，筹备会试盘费与行程。"
  ]),
  metropolitan_exam: Object.freeze([
    "拜谢会试座师，整理殿试对策题纲。",
    "与同年互通殿试规矩，只按公开礼数往来。"
  ]),
  palace_exam: Object.freeze([
    "按授官轨迹赴部报到，先处理首月差事。",
    "拜会同年、读卷官与官署同僚，询问初仕规矩。"
  ])
});

module.exports = {
  EXAM_AFTERMATH_AUTHORITY_BOUNDARY,
  EXAM_AFTERMATH_LIMITS,
  EXAM_AFTERMATH_NEXT_STEPS,
  EXAM_AFTERMATH_SCHEMA_VERSION
};
