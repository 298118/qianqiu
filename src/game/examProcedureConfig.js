const EXAM_PROCEDURE_SCHEMA_VERSION = 1;

const EXAM_PROCEDURE_PHASES = Object.freeze([
  { key: "eligibility_check", label: "验明资格" },
  { key: "sponsorship", label: "保结具结" },
  { key: "registration", label: "报名点册" },
  { key: "entry_search", label: "入场搜检" },
  { key: "cell_entry", label: "入号舍" },
  { key: "question_release", label: "发题审题" },
  { key: "drafting", label: "草稿成文" },
  { key: "fair_copy", label: "誊清墨卷" },
  { key: "submission", label: "交卷封送" },
  { key: "sealing", label: "弥封" },
  { key: "transcription", label: "誊录朱卷" },
  { key: "collation", label: "对读校勘" },
  { key: "audit_review", label: "磨勘复核" },
  { key: "ranking", label: "榜前定序" },
  { key: "announcement", label: "放榜" },
  { key: "closed", label: "归档" }
]);

const EXAM_PROCEDURE_PROFILE = Object.freeze({
  child_exam: Object.freeze({
    sessionCount: 3,
    subStages: Object.freeze([
      { key: "county_exam", label: "县试", paperType: "经义章句" },
      { key: "prefectural_exam", label: "府试", paperType: "经义小题" },
      { key: "academy_exam", label: "院试", paperType: "学政策问" }
    ]),
    cellSummary: "童试合并县试、府试、院试三关，县学点名后入席作答。",
    procedureNote: "外层仍为童试一次 API，内部以三关摘要记录资格、批语和最终秀才名位。"
  }),
  provincial_exam: Object.freeze({
    sessionCount: 3,
    subStages: Object.freeze([
      { key: "session_1", label: "第一场", paperType: "经义制艺" },
      { key: "session_2", label: "第二场", paperType: "经史应用" },
      { key: "session_3", label: "第三场", paperType: "策论时务" }
    ]),
    cellSummary: "秋闱三场同在贡院号舍完成，场内疲劳与卷面稳定并入服务器复核。",
    procedureNote: "三场多日压缩为一次提交，保留三卷摘要，服务器合成为乡试榜次。"
  }),
  metropolitan_exam: Object.freeze({
    sessionCount: 3,
    subStages: Object.freeze([
      { key: "session_1", label: "第一场", paperType: "制艺章法" },
      { key: "session_2", label: "第二场", paperType: "官样文书" },
      { key: "session_3", label: "第三场", paperType: "时政策论" }
    ]),
    cellSummary: "春闱三场同在京师贡院号舍完成，房官与主考复看留给后续评卷步骤。",
    procedureNote: "三场多卷先以安全流程摘要入档，最终仍由服务器定贡士资格。"
  }),
  palace_exam: Object.freeze({
    sessionCount: 1,
    subStages: Object.freeze([
      { key: "palace_policy", label: "御前策问", paperType: "时政策问" }
    ]),
    cellSummary: "殿试入廷对策，不设贡院号舍；弥封誊录以御前读卷摘要呈现。",
    procedureNote: "殿试仍保留快速入仕链路，甲第和授官由服务器裁决。"
  })
});

const EXAM_SCENE_TO_PROCEDURE_PHASE = Object.freeze({
  entry: "cell_entry",
  question_review: "question_release",
  outline: "drafting",
  drafting: "drafting",
  fair_copy: "fair_copy",
  submitted: "submission"
});

const EXAM_PROCEDURE_LIMITS = Object.freeze({
  maxVisibleIncidents: 6,
  maxVisibleAuditFlags: 6,
  maxVisibleActions: 4,
  maxPromptAuditFlags: 3,
  maxPromptIncidents: 3,
  textPreviewLength: 160
});

module.exports = {
  EXAM_PROCEDURE_LIMITS,
  EXAM_PROCEDURE_PHASES,
  EXAM_PROCEDURE_PROFILE,
  EXAM_PROCEDURE_SCHEMA_VERSION,
  EXAM_SCENE_TO_PROCEDURE_PHASE
};
