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

function generateVirtualCandidates(worldState, exam, playerScore) {
  const count = randomBetween(4, 8);
  const center = getExamCenter(exam);
  const competitiveness = Math.max(center, Math.min(86, playerScore + randomBetween(-8, 8)));

  return Array.from({ length: count }, (_, index) => {
    const score = clampScore(competitiveness + randomBetween(-16, 15) + index - Math.floor(count / 2));
    return {
      id: `candidate-${index + 1}`,
      name: `${FAMILY_NAMES[index % FAMILY_NAMES.length]}${GIVEN_NAMES[index % GIVEN_NAMES.length]}`,
      origin: ORIGINS[index % ORIGINS.length],
      background: BACKGROUNDS[(index + worldState.turnCount) % BACKGROUNDS.length],
      score: {
        overall_score: score,
        rank: score >= Math.max(60, exam.passScore) ? "取中" : "落第"
      }
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
      isPlayer: Boolean(entry.isPlayer)
    }));
}

module.exports = {
  buildRanking,
  generateVirtualCandidates
};
