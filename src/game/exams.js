const { randomUUID } = require("crypto");

const EXAM_SEQUENCE = ["child_exam", "provincial_exam", "metropolitan_exam", "palace_exam"];

// The server owns exam gates and promotion mappings; providers only draft questions and grading prose.
const EXAMS = {
  child_exam: {
    level: "child_exam",
    name: "童试",
    stageLabel: "寒窗赴童试",
    requiredRank: null,
    promotionRank: "秀才",
    nextLevel: "provincial_exam",
    questionType: "经义简答",
    wordCount: { min: 200, max: 400 },
    passScore: 60,
    difficulty: "入门",
    threshold: {
      academia: 12,
      literaryTalent: 10,
      mentality: 8,
      reputation: 0
    },
    focus: "四书五经义理、章句训诂、端正文气"
  },
  provincial_exam: {
    level: "provincial_exam",
    name: "乡试",
    stageLabel: "秀才赴乡试",
    requiredRank: "秀才",
    promotionRank: "举人",
    nextLevel: "metropolitan_exam",
    questionType: "策论",
    wordCount: { min: 500, max: 800 },
    passScore: 68,
    difficulty: "进阶",
    threshold: {
      academia: 28,
      literaryTalent: 24,
      mentality: 20,
      reputation: 12
    },
    focus: "经世策论、民生财赋、地方治理"
  },
  metropolitan_exam: {
    level: "metropolitan_exam",
    name: "会试",
    stageLabel: "举人赴会试",
    requiredRank: "举人",
    promotionRank: "贡士",
    nextLevel: "palace_exam",
    questionType: "八股文",
    wordCount: { min: 800, max: 1500 },
    passScore: 74,
    difficulty: "高阶",
    threshold: {
      academia: 45,
      literaryTalent: 40,
      mentality: 34,
      reputation: 24
    },
    focus: "制艺章法、破题承题、经义与辞章并重"
  },
  palace_exam: {
    level: "palace_exam",
    name: "殿试",
    stageLabel: "贡士赴殿试",
    requiredRank: "贡士",
    promotionRank: "进士",
    nextLevel: null,
    questionType: "时政策论",
    wordCount: { min: 700, max: 1200 },
    passScore: 0,
    difficulty: "廷试",
    threshold: {
      academia: 50,
      literaryTalent: 42,
      mentality: 42,
      reputation: 28
    },
    focus: "朝廷时政、治国方略、君臣问对"
  }
};

function getExam(level) {
  return EXAMS[level] || null;
}

function listExams() {
  return EXAM_SEQUENCE.map((level) => EXAMS[level]);
}

function getNextExamLevel(examRank) {
  if (examRank === null || examRank === undefined) return "child_exam";
  if (examRank === "秀才") return "provincial_exam";
  if (examRank === "举人") return "metropolitan_exam";
  if (examRank === "贡士") return "palace_exam";
  return null;
}

function getExamRequirements(exam) {
  const passText = exam.level === "palace_exam" ? "殿试定甲第，通常不黜落" : `总评${exam.passScore}以上`;
  return [
    `题型：${exam.questionType}`,
    `建议篇幅：${exam.wordCount.min}-${exam.wordCount.max}字`,
    `取中参考：${passText}`,
    `考核重点：${exam.focus}`
  ];
}

function createExamId(level) {
  return `${level}-${randomUUID()}`;
}

function canEnterExam(player, level) {
  const exam = getExam(level);
  if (!exam) {
    return { ok: false, reason: "未知考试等级。" };
  }

  if (!player || (player.role !== "scholar" && player.role !== "official")) {
    return { ok: false, reason: "当前身份不能参加科举考试。" };
  }

  if (player.role === "official") {
    return { ok: false, reason: "你已入仕，不必再循科举旧路。" };
  }

  const nextLevel = getNextExamLevel(player.examRank);
  if (nextLevel !== level) {
    const nextExam = getExam(nextLevel);
    return {
      ok: false,
      reason: nextExam ? `当前应参加${nextExam.name}。` : "当前科举路径已完成。"
    };
  }

  if (exam.requiredRank !== player.examRank) {
    return {
      ok: false,
      reason: exam.requiredRank ? `须先取得${exam.requiredRank}身份。` : "当前身份不符。"
    };
  }

  return { ok: true, reason: "" };
}

function summarizeReadiness(player, exam) {
  const threshold = exam.threshold;
  const missing = Object.entries(threshold)
    .filter(([key, value]) => value > 0 && (player[key] || 0) < value)
    .map(([key, value]) => ({ key, value, current: player[key] || 0 }));

  return {
    ready: missing.length === 0,
    missing
  };
}

module.exports = {
  EXAM_SEQUENCE,
  EXAMS,
  canEnterExam,
  createExamId,
  getExam,
  getExamRequirements,
  getNextExamLevel,
  listExams,
  summarizeReadiness
};
