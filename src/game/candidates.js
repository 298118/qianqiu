const GIVEN_NAMES = ["砚舟", "季常", "伯言", "怀瑾", "修然", "听泉", "文衡", "子谦"];
const FAMILY_NAMES = ["沈", "陆", "许", "林", "赵", "韩", "顾", "周"];
const ORIGINS = ["苏州府", "绍兴府", "应天府", "湖广", "河南府", "江西", "山东", "福建"];
const BACKGROUNDS = [
  "书院高材，长于经义",
  "寒门苦读，文气谨严",
  "乡绅子弟，策论开阔",
  "塾师门下，章句稳实",
  "游学多年，见闻颇广",
  "临场沉着，少有浮词"
];
const STYLE_PROFILES = [
  {
    key: "classicist",
    label: "经义谨严",
    voice: "多引经传，句法端整",
    strength: "义理稳实",
    weakness: "机锋略少"
  },
  {
    key: "policy",
    label: "策论明快",
    voice: "重在时务，条陈分明",
    strength: "议政切实",
    weakness: "辞采稍平"
  },
  {
    key: "ornate",
    label: "辞采丰赡",
    voice: "铺陈典雅，转折有致",
    strength: "文气华赡",
    weakness: "落笔稍繁"
  },
  {
    key: "restrained",
    label: "沉着平正",
    voice: "少作险语，持论中和",
    strength: "结构平稳",
    weakness: "锋芒不足"
  }
];

const EXAM_ESSAY_PATTERNS = {
  child_exam: {
    titlePrefix: "童试经义",
    topic: "明伦修身",
    opening: "破题先明本心，继言读书当以正己为先。",
    middle: "其文据四书义理，申言孝弟、谨信与乡里之教。",
    closing: "末归于士子入学之本，愿以朴学立身。"
  },
  provincial_exam: {
    titlePrefix: "乡试策论",
    topic: "理财安民",
    opening: "开篇论郡县之治，在宽民力而谨度支。",
    middle: "其文分盐粮、徭役、仓储三端，略陈缓急先后。",
    closing: "末以吏治清明为本，谓财用足而民心可定。"
  },
  metropolitan_exam: {
    titlePrefix: "会试制艺",
    topic: "经术致用",
    opening: "起讲扣题甚紧，先立圣贤垂训之旨。",
    middle: "中股承转较密，兼论修辞、立诚与经世之用。",
    closing: "收束复归章法，显出科场制艺之矩度。"
  },
  palace_exam: {
    titlePrefix: "殿试对策",
    topic: "安边恤民",
    opening: "对策先陈天下大势，言边备与民生相为表里。",
    middle: "其文请慎择守臣、核实军储，并宽州县催科。",
    closing: "末称治道贵在久任责成，使朝廷威信下达。"
  }
};

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getExamCenter(exam) {
  if (exam.level === "child_exam") return 58;
  if (exam.level === "provincial_exam") return 65;
  if (exam.level === "metropolitan_exam") return 70;
  return 78;
}

function getEssayPattern(exam) {
  return EXAM_ESSAY_PATTERNS[exam.level] || EXAM_ESSAY_PATTERNS.child_exam;
}

function getScoreBand(score, exam) {
  if (score >= Math.max(85, exam.passScore + 12)) return "上乘";
  if (score >= Math.max(70, exam.passScore)) return "可取";
  if (score >= 55) return "未稳";
  return "落第";
}

function countEssayWords(text) {
  return text.replace(/\s+/g, "").length;
}

function createCandidateEssay({ candidate, exam, index, score, style }) {
  const pattern = getEssayPattern(exam);
  const title = `${pattern.titlePrefix}：${pattern.topic}`;
  const body = [
    `${candidate.name}此卷以“${pattern.topic}”为眼，${style.voice}。`,
    pattern.opening,
    pattern.middle,
    `${candidate.background}，故议论处多见${style.strength}；然${style.weakness}，间有未尽开展处。`,
    `${pattern.closing}第${index + 1}卷气象${score >= exam.passScore ? "尚能压场" : "仍欠火候"}。`
  ].join("");

  return {
    title,
    body,
    excerpt: body.slice(0, 54),
    wordCount: countEssayWords(body)
  };
}

function createExaminerComment(score, style, exam) {
  const band = getScoreBand(score, exam);
  if (band === "上乘") {
    return `此卷${style.label}，立意明白，转折有法，可列前茅。`;
  }
  if (band === "可取") {
    return `此卷${style.label}，大体切题，虽有小疵，仍堪录取。`;
  }
  if (band === "未稳") {
    return `此卷${style.label}，章法尚存，议论未能尽透，须酌置榜后。`;
  }
  return `此卷${style.label}，语意散弱，未合本场取中尺度。`;
}

function resolveStyle(seed, index, turnCount) {
  if (seed?.style) {
    const existing = STYLE_PROFILES.find((style) => style.label === seed.style || style.key === seed.style);
    if (existing) return existing;
  }
  return STYLE_PROFILES[(index + turnCount) % STYLE_PROFILES.length];
}

function generateVirtualCandidates(worldState, exam, playerScore, options = {}) {
  const persistentCandidates = Array.isArray(options.persistentCandidates) ? options.persistentCandidates : [];
  const count = Math.max(randomBetween(4, 8), persistentCandidates.length);
  const center = getExamCenter(exam);
  const competitiveness = Math.max(center, Math.min(86, playerScore + randomBetween(-8, 8)));
  const turnCount = worldState.turnCount || 0;

  return Array.from({ length: count }, (_, index) => {
    const score = clampScore(competitiveness + randomBetween(-16, 15) + index - Math.floor(count / 2));
    const seed = persistentCandidates[index] || null;
    const style = resolveStyle(seed, index, turnCount);
    const candidate = {
      id: seed?.id || `candidate-${index + 1}`,
      name: seed?.name || `${FAMILY_NAMES[index % FAMILY_NAMES.length]}${GIVEN_NAMES[index % GIVEN_NAMES.length]}`,
      origin: seed?.origin || ORIGINS[index % ORIGINS.length],
      background: seed?.background || BACKGROUNDS[(index + turnCount) % BACKGROUNDS.length]
    };
    const essay = createCandidateEssay({ candidate, exam, index, score, style });

    return {
      ...candidate,
      score: {
        overall_score: score,
        rank: score >= Math.max(60, exam.passScore) ? "取中" : "落第"
      },
      essay,
      style: style.label,
      persistent: Boolean(seed),
      rivalStatus: seed?.relationship || null,
      previousAttempts: seed?.previousAttempts || 0,
      contactId: seed?.contactId || null,
      examinerComment: createExaminerComment(score, style, exam),
      strengths: [style.strength, score >= exam.passScore ? "切合本场题旨" : "尚有可观句法"],
      weaknesses: [style.weakness, score >= exam.passScore ? "细处仍可锤炼" : "论证未能展开"]
    };
  });
}

function buildRanking(playerEntry, candidates) {
  return [playerEntry, ...candidates]
    .sort((a, b) => {
      const diff = b.score.overall_score - a.score.overall_score;
      if (diff !== 0) return diff;
      return a.isPlayer ? -1 : 1;
    })
    .map((entry, index) => ({
      place: index + 1,
      id: entry.id,
      name: entry.name,
      origin: entry.origin,
      background: entry.background,
      score: entry.score.overall_score,
      rank: entry.score.rank,
      isPlayer: Boolean(entry.isPlayer),
      style: entry.style || null,
      persistent: Boolean(entry.persistent),
      rivalStatus: entry.rivalStatus || null,
      previousAttempts: entry.previousAttempts || 0,
      contactId: entry.contactId || null,
      essayTitle: entry.essay?.title || null,
      essayExcerpt: entry.essay?.excerpt || null,
      examinerComment: entry.examinerComment || null,
      strengths: entry.strengths || [],
      weaknesses: entry.weaknesses || []
    }));
}

module.exports = {
  buildRanking,
  generateVirtualCandidates
};
