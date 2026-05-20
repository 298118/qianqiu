const STUDY_PROFILE_SCHEMA_VERSION = 1;
const STUDY_PLAN_SCHEMA_VERSION = 1;

const STUDY_DIMENSIONS = Object.freeze({
  classicsFoundation: {
    label: "经义根柢",
    sourceAttributes: Object.freeze(["academia"]),
    examScoreKey: "content_quality",
    lowThreshold: 62,
    highThreshold: 82,
    weakLabel: "经义根柢未稳",
    strongLabel: "经义根柢扎实",
    bookRecommendations: Object.freeze(["《论语》", "《孟子》", "《大学》", "《中庸》"])
  },
  eightLeggedForm: {
    label: "制艺章法",
    sourceAttributes: Object.freeze(["literaryTalent"]),
    examScoreKey: "classical_format",
    lowThreshold: 62,
    highThreshold: 82,
    weakLabel: "破题承转散乱",
    strongLabel: "制艺章法谨严",
    bookRecommendations: Object.freeze(["八股程文选", "破题讲义"])
  },
  policyInsight: {
    label: "策论时务",
    sourceAttributes: Object.freeze(["adaptability"]),
    examScoreKey: "argument_strength",
    lowThreshold: 64,
    highThreshold: 84,
    weakLabel: "策论时务空泛",
    strongLabel: "策论时务切实",
    bookRecommendations: Object.freeze(["《资治通鉴》", "地方志", "奏议选"])
  },
  historicalAllusion: {
    label: "史事典故",
    sourceAttributes: Object.freeze(["academia", "literaryTalent"]),
    examScoreKey: "literary_style",
    lowThreshold: 60,
    highThreshold: 82,
    weakLabel: "史例辞采不足",
    strongLabel: "史例辞采可观",
    bookRecommendations: Object.freeze(["《史记》", "《资治通鉴》"])
  },
  legalJudgment: {
    label: "律例判断",
    sourceAttributes: Object.freeze(["adaptability"]),
    examScoreKey: "historical_appropriateness",
    lowThreshold: 64,
    highThreshold: 84,
    weakLabel: "律例与时代语境须谨慎",
    strongLabel: "时代语境稳妥",
    bookRecommendations: Object.freeze(["《大明律》", "刑名案牍选"])
  },
  calligraphyCopying: {
    label: "誊写卷面",
    sourceAttributes: Object.freeze(["literaryTalent", "mentality"]),
    examScoreKey: "classical_format",
    lowThreshold: 66,
    highThreshold: 85,
    weakLabel: "卷面格式不稳",
    strongLabel: "卷面较稳",
    bookRecommendations: Object.freeze(["馆阁小楷帖", "朱卷格式例"])
  },
  examEndurance: {
    label: "科场耐力",
    sourceAttributes: Object.freeze(["mentality", "health"]),
    examScoreKey: "overall_score",
    lowThreshold: 60,
    highThreshold: 82,
    weakLabel: "科场耐力不足",
    strongLabel: "临场心性坚稳",
    bookRecommendations: Object.freeze(["号舍日课", "静坐札记"])
  }
});

const STUDY_PROFILE_LIMITS = Object.freeze({
  maxStrengths: 4,
  maxWeaknesses: 5,
  maxTeacherAdvice: 5,
  maxTeacherFeedback: 5,
  maxRecentExercises: 5,
  maxSmallExercises: 6,
  maxRecommendedBooks: 6,
  maxClassmates: 4,
  maxPlanItems: 4,
  maxBooks: 6,
  maxPlanRhythm: 3,
  maxPlanCheckpoints: 4,
  maxPlanRiskNotes: 4,
  maxPlanNextActions: 4,
  maxVisibleText: 120
});

const STUDY_PLAN_CADENCE = Object.freeze({
  reviewTenDayPeriods: 3,
  targetGainByIntensity: Object.freeze({
    urgent_repair: 12,
    repair: 9,
    steady: 6,
    polish: 4
  }),
  intensityBands: Object.freeze([
    Object.freeze({
      key: "urgent_repair",
      maxScore: 54,
      label: "补破",
      summary: "短处明显，先用三旬把破口补住。"
    }),
    Object.freeze({
      key: "repair",
      maxScore: 64,
      label: "补弱",
      summary: "弱项已露，三旬内先稳章法与根基。"
    }),
    Object.freeze({
      key: "steady",
      maxScore: 79,
      label: "稳进",
      summary: "根基尚可，按旬推进并留一轮复盘。"
    }),
    Object.freeze({
      key: "polish",
      maxScore: 100,
      label: "润色",
      summary: "长处可用，重在临场章法和卷面收束。"
    })
  ]),
  rhythmSlots: Object.freeze([
    Object.freeze({ id: "morning", label: "晨课", template: "读{book}，摘{focus}题眼一则。" }),
    Object.freeze({ id: "midday", label: "午课", template: "按{focus}作短纲，限时成段。" }),
    Object.freeze({ id: "evening", label: "暮课", template: "誊清旧文，圈出一处可改处。" })
  ]),
  checkpointSlots: Object.freeze([
    Object.freeze({ id: "first_period", label: "上旬复核", template: "交一则{focus}短答给老师圈点。" }),
    Object.freeze({ id: "second_period", label: "中旬互评", template: "请同窗驳难一回，留下公开评语。" }),
    Object.freeze({ id: "third_period", label: "下旬定稿", template: "把{focus}弱处写入考前札记。" })
  ])
});

const STUDY_INTERACTION_PATTERNS = Object.freeze({
  sponsorship: /保结|作保|具结|互结|廪保|荐书|推荐|保人/,
  teacherFeedback: /拜师|拜访|请教|求教|访师|问学|投师|塾师|先生|老师|批改|改文|点评|评点/,
  academySeminar: /书院|县学|府学|讲会|会讲|山长|讲席|藏书/,
  classmate: /同窗|同年|同学|友朋|结交|交友|访友|雅集|清谈/,
  smallExercise: /小题|拟题|破题|承题|策问|限时|模拟|练题|习作|改题|驳论|论辩|辩经|讲论/
});

const STUDY_SPONSORSHIP_THRESHOLDS = Object.freeze({
  ready: 70,
  conditional: 45
});

const STUDY_ACTION_PATTERNS = Object.freeze({
  classicsFoundation: /经义|四书|五经|论语|孟子|大学|中庸|诗经|尚书|礼记|春秋|易经|章句|训诂/,
  eightLeggedForm: /八股|制艺|破题|承题|起讲|起股|中股|后股|束股|程文|章法/,
  policyInsight: /策论|时务|民生|财赋|军政|吏治|灾赈|边防|漕运|钱粮/,
  historicalAllusion: /史记|通鉴|史|典故|本朝|前代|汉唐|宋元|兴亡/,
  legalJudgment: /律例|刑名|案牍|断案|律|法度|条例/,
  calligraphyCopying: /小楷|誊写|抄书|卷面|格式|书法|临帖/,
  examEndurance: /静坐|养气|心性|耐力|号舍|作息|病|疲|休整/
});

module.exports = {
  STUDY_ACTION_PATTERNS,
  STUDY_DIMENSIONS,
  STUDY_INTERACTION_PATTERNS,
  STUDY_PLAN_CADENCE,
  STUDY_PLAN_SCHEMA_VERSION,
  STUDY_PROFILE_LIMITS,
  STUDY_SPONSORSHIP_THRESHOLDS,
  STUDY_PROFILE_SCHEMA_VERSION
};
