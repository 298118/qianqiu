const MODERN_TERMS = [
  "AI", "ChatGPT", "互联网", "网络", "手机", "电脑", "电报", "火车", "飞机",
  "共和国", "社会主义", "宪法", "选举", "公司", "银行", "股票", "现代科学"
];

const CLASSIC_PASSAGES = [
  "学而时习之不亦说乎",
  "有朋自远方来不亦乐乎",
  "君子务本本立而道生",
  "民惟邦本本固邦宁",
  "大学之道在明明德",
  "天将降大任于是人也",
  "人之初性本善性相近习相远",
  "礼之用和为贵",
  "先天下之忧而忧后天下之乐而乐"
];

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeEssayText(essay) {
  return String(essay || "").replace(/\s+/g, "");
}

function countEssayCharacters(essay) {
  return normalizeEssayText(essay).length;
}

function findModernTerms(essay) {
  const lowerEssay = String(essay || "").toLowerCase();
  return MODERN_TERMS.filter((term) => lowerEssay.includes(term.toLowerCase()));
}

function findCopiedPassage(essay) {
  const normalized = normalizeEssayText(essay).replace(/[，。！？；：“”‘’、,.!?;:"']/g, "");
  return CLASSIC_PASSAGES.find((passage) => {
    const firstIndex = normalized.indexOf(passage);
    if (firstIndex === -1) return false;
    const secondIndex = normalized.indexOf(passage, firstIndex + passage.length);
    const passageRatio = passage.length / Math.max(1, normalized.length);
    return secondIndex !== -1 || passageRatio > 0.35;
  }) || "";
}

function estimateGhostwritingProbability(player, essayLength, essay) {
  const playerLevel = (
    (player.academia || 0) +
    (player.literaryTalent || 0) +
    (player.adaptability || 0) +
    (player.mentality || 0)
  ) / 4;
  const ornateTerms = ["窃以为", "伏惟", "臣闻", "夫", "盖", "是以", "谨按", "不揣固陋"];
  const ornateHits = ornateTerms.filter((term) => essay.includes(term)).length;
  const lengthPressure = essayLength > 900 && playerLevel < 26 ? 0.35 : 0;
  const stylePressure = ornateHits >= 5 && playerLevel < 22 ? 0.3 : 0;
  const lowFoundationPressure = playerLevel < 15 && essayLength > 450 ? 0.2 : 0;
  return Math.min(0.95, Number((lengthPressure + stylePressure + lowFoundationPressure).toFixed(2)));
}

function checkEssayAuthenticity({ essay, exam, player }) {
  const characterCount = countEssayCharacters(essay);
  const minimumUsefulLength = Math.max(60, Math.floor(exam.wordCount.min * 0.35));
  const modernTerms = findModernTerms(essay);
  const copiedPassage = findCopiedPassage(essay);
  const ghostwritingProbability = estimateGhostwritingProbability(player, characterCount, essay);
  const flags = [];

  if (characterCount < minimumUsefulLength) {
    flags.push({
      type: "too_short",
      label: "篇幅过短",
      severity: "major",
      penalty: Math.min(35, Math.max(18, Math.ceil((minimumUsefulLength - characterCount) / 3))),
      detail: `正文约${characterCount}字，低于本场最低有效篇幅${minimumUsefulLength}字。`
    });
  }

  if (modernTerms.length) {
    flags.push({
      type: "anachronism",
      label: "时代错语",
      severity: "major",
      penalty: Math.min(28, modernTerms.length * 8),
      detail: `出现不合时宜词语：${modernTerms.join("、")}。`
    });
  }

  if (copiedPassage) {
    flags.push({
      type: "copy",
      label: "疑似照抄",
      severity: "severe",
      penalty: 100,
      detail: `疑似直接照抄经典片段：“${copiedPassage}”。`
    });
  }

  if (ghostwritingProbability > 0.7) {
    flags.push({
      type: "ghostwriting",
      label: "疑似代笔",
      severity: "major",
      penalty: 20,
      detail: "文章铺陈与当前学力、文采差距过大，按代笔嫌疑扣分。"
    });
  }

  return {
    characterCount,
    flags,
    copy_detection: {
      is_copy: Boolean(copiedPassage),
      similar_passage: copiedPassage
    },
    anachronism_detection: {
      has_anachronism: modernTerms.length > 0,
      details: modernTerms
    },
    style_consistency: {
      consistent: ghostwritingProbability <= 0.7,
      note: ghostwritingProbability > 0.7 ? "风格显著超出当前履历。" : "风格与当前履历未见明显冲突。"
    },
    ghostwriting_probability: ghostwritingProbability
  };
}

function scoreToRank(score, exam) {
  if (exam.level === "palace_exam") {
    if (score >= 88) return "一甲";
    if (score >= 74) return "二甲";
    return "三甲";
  }

  if (score >= 88) return "一等";
  if (score >= exam.passScore) return "取中";
  return "落第";
}

function applyAuthenticityPenalties(score, authenticityCheck, exam) {
  const nextScore = { ...score };
  const penalties = authenticityCheck.flags || [];
  let overall = Number(score.overall_score) || 0;

  if (authenticityCheck.copy_detection?.is_copy) {
    overall = 0;
  } else {
    for (const flag of penalties) {
      overall -= flag.penalty || 0;
    }
  }

  overall = clampScore(overall);

  for (const key of [
    "content_quality",
    "argument_strength",
    "literary_style",
    "classical_format",
    "historical_appropriateness"
  ]) {
    if (nextScore[key] && typeof nextScore[key].score === "number") {
      nextScore[key] = {
        ...nextScore[key],
        score: clampScore(nextScore[key].score - Math.min(25, penalties.length * 5))
      };
    }
  }

  nextScore.overall_score = overall;
  nextScore.rank = scoreToRank(overall, exam);
  if (penalties.length) {
    const penaltyText = penalties.map((flag) => `${flag.label}扣${flag.penalty}分`).join("；");
    nextScore.detailed_feedback = `${score.detailed_feedback || ""}\n监试复核：${penaltyText}。`.trim();
  }

  return nextScore;
}

module.exports = {
  applyAuthenticityPenalties,
  checkEssayAuthenticity,
  countEssayCharacters,
  scoreToRank
};
