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
  maxVisibleExaminerReviews: 6,
  maxVisibleActions: 4,
  maxPhaseFeedbackNotes: 3,
  maxPromptAuditFlags: 3,
  maxPromptIncidents: 3,
  maxPromptExaminerReviews: 3,
  textPreviewLength: 160
});

const EXAM_PROCEDURE_PHASE_FEEDBACK = Object.freeze({
  question_release: Object.freeze({
    publicSummary: "题纸既发，先辨题眼、限定破题，不急于下笔。",
    environmentSummary: "入号舍后的声息、搜检和压力只作公开场内摘要；卷面成败仍由交卷后服务器评分裁决。",
    focusNotes: Object.freeze(["先审题立意", "按经义根柢拟纲", "不把场内行动当作评卷结果"])
  }),
  drafting: Object.freeze({
    publicSummary: "提纲已入草稿，宜把首段题眼、承转和用典次序稳定下来。",
    environmentSummary: "号舍疲劳与备考压力会影响文气，但只形成公开风险提示，不即时改分。",
    focusNotes: Object.freeze(["补足经义依据", "检查是否偏题", "保留誊清时间"])
  }),
  fair_copy: Object.freeze({
    publicSummary: "墨卷将成，宜校读句读、避开涂改，准备誊清交卷。",
    environmentSummary: "誊清阶段只显示公开收束提示；弥封、誊录、对读和磨勘仍在交卷后服务器流程。",
    focusNotes: Object.freeze(["校定句读", "少改大段", "准备交卷"])
  }),
  submission: Object.freeze({
    publicSummary: "卷件已送交场内流程，等待弥封与誊录公开摘要。",
    environmentSummary: "交卷后不再由前端推进场内成果；评分、复核、榜次和晋级全部由服务器裁决。",
    focusNotes: Object.freeze(["等待弥封", "等待誊录", "等待放榜"])
  }),
  closed: Object.freeze({
    publicSummary: "本场已归档，科场反馈转为放榜、复盘与下场准备。",
    environmentSummary: "归档摘要只保留公开流程、评分与关系过渡，不含弥封映射、考官私意或模型原文。",
    focusNotes: Object.freeze(["查阅榜单", "听取老师复盘", "整理下场准备"])
  }),
  default: Object.freeze({
    publicSummary: "科场流程按服务器阶段推进，当前只显示公开反馈。",
    environmentSummary: "场内反馈不替代准考、评分、晋级、榜单或授官裁决。",
    focusNotes: Object.freeze(["按科场规程推进"])
  })
});

const EXAM_PROCEDURE_PHASE_FEEDBACK_BOUNDARY =
  "入场后反馈由服务器按 sceneTime、科场阶段、备考压力和公开行动摘要派生；AI 与前端只能读取或写草稿，不能改分、处罚、榜次、晋级、弥封映射或官职。";

module.exports = {
  EXAM_PROCEDURE_LIMITS,
  EXAM_PROCEDURE_PHASE_FEEDBACK,
  EXAM_PROCEDURE_PHASE_FEEDBACK_BOUNDARY,
  EXAM_PROCEDURE_PHASES,
  EXAM_PROCEDURE_PROFILE,
  EXAM_PROCEDURE_SCHEMA_VERSION,
  EXAM_SCENE_TO_PROCEDURE_PHASE
};
