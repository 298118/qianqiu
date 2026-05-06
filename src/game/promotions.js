const { getNextExamLevel } = require("./exams");
const { clamp } = require("./stateRules");

const SCHOLAR_ROLE_LABEL = "书生";
const OFFICIAL_ROLE_LABEL = "入仕官员";
const RANK_ORDER = [null, "秀才", "举人", "贡士", "进士"];

const PASS_REPUTATION_GAIN = {
  child_exam: 3,
  provincial_exam: 6,
  metropolitan_exam: 8,
  palace_exam: 12
};

const PALACE_OUTCOMES = {
  "一甲": {
    rank: "一甲进士及第",
    palaceRank: "一甲",
    officeTitle: "翰林院修撰",
    reputationGain: 16
  },
  "二甲": {
    rank: "二甲进士出身",
    palaceRank: "二甲",
    officeTitle: "翰林院庶吉士",
    reputationGain: 12
  },
  "三甲": {
    rank: "三甲同进士出身",
    palaceRank: "三甲",
    officeTitle: "六部观政进士",
    reputationGain: 9
  }
};

const PALACE_OFFICIAL_SEEDS = {
  "一甲": {
    superiorFavor: 58,
    peerNetwork: 48,
    performanceMerit: 38,
    promotionProspect: 52,
    impeachmentRisk: 12,
    cleanReputation: 78
  },
  "二甲": {
    superiorFavor: 50,
    peerNetwork: 42,
    performanceMerit: 34,
    promotionProspect: 42,
    impeachmentRisk: 16,
    cleanReputation: 74
  },
  "三甲": {
    superiorFavor: 44,
    peerNetwork: 36,
    performanceMerit: 30,
    promotionProspect: 34,
    impeachmentRisk: 20,
    cleanReputation: 70
  }
};

function snapshotPlayer(player) {
  return {
    role: player.role,
    roleLabel: player.roleLabel,
    examRank: player.examRank ?? null,
    palaceRank: player.palaceRank ?? null,
    officeTitle: player.officeTitle ?? null,
    position: player.position ?? null,
    faction: player.faction ?? null,
    influence: player.influence ?? 0,
    integrity: player.integrity ?? 0,
    superiorFavor: player.superiorFavor ?? 0,
    peerNetwork: player.peerNetwork ?? 0,
    performanceMerit: player.performanceMerit ?? 0,
    promotionProspect: player.promotionProspect ?? 0,
    impeachmentRisk: player.impeachmentRisk ?? 0,
    cleanReputation: player.cleanReputation ?? 0,
    reputation: player.reputation ?? 0,
    mentality: player.mentality ?? 0
  };
}

function hasSevereCheating(authenticityCheck) {
  const flags = authenticityCheck.flags || [];
  return Boolean(
    authenticityCheck.copy_detection?.is_copy ||
    flags.some((flag) => flag.severity === "severe")
  );
}

function getPreviousRank(rank) {
  const index = RANK_ORDER.indexOf(rank ?? null);
  if (index <= 0) return null;
  return RANK_ORDER[index - 1];
}

function getPalaceOutcome(score) {
  return PALACE_OUTCOMES[score.rank] || PALACE_OUTCOMES["三甲"];
}

function seedOfficialCareerFields(player, palaceOutcome) {
  const seed = PALACE_OFFICIAL_SEEDS[palaceOutcome.palaceRank] || PALACE_OFFICIAL_SEEDS["三甲"];
  player.superiorFavor = clamp(player.superiorFavor ?? seed.superiorFavor, 0, 100);
  player.peerNetwork = clamp(player.peerNetwork ?? seed.peerNetwork, 0, 100);
  player.performanceMerit = clamp(player.performanceMerit ?? seed.performanceMerit, 0, 100);
  player.promotionProspect = clamp(player.promotionProspect ?? seed.promotionProspect, 0, 100);
  player.impeachmentRisk = clamp(player.impeachmentRisk ?? seed.impeachmentRisk, 0, 100);
  player.cleanReputation = clamp(player.cleanReputation ?? seed.cleanReputation, 0, 100);
}

function ensureOfficialPostingCharacter(worldState) {
  const characters = Array.isArray(worldState.characters) ? worldState.characters : [];
  if (!characters.some((character) => character.id === "C02")) {
    characters.push({
      id: "C02",
      name: "赵给事",
      role: "署中上官",
      loyalty: 56,
      ambition: 44,
      skill: 78,
      alive: true
    });
  }
  worldState.characters = characters;
}

function applySevereCheatingConsequence(player, before) {
  const rankAfter = getPreviousRank(before.examRank);
  const rankChanged = rankAfter !== before.examRank;

  player.examRank = rankAfter;
  player.palaceRank = null;
  player.officeTitle = null;
  player.position = "寒窗士子";
  player.faction = "士林";
  player.influence = clamp((player.influence || 0) - 10, 0, 100);
  player.reputation = clamp((player.reputation || 0) - 12, 0, 100);
  player.mentality = clamp((player.mentality || 0) - 4, 0, 100);

  if (before.role === "official" || before.officeTitle) {
    player.superiorFavor = 0;
    player.peerNetwork = 0;
    player.performanceMerit = 0;
    player.promotionProspect = 0;
    player.impeachmentRisk = 0;
    player.cleanReputation = 0;
  }

  if (player.role === "official") {
    player.role = "scholar";
    player.roleLabel = SCHOLAR_ROLE_LABEL;
  }

  return {
    type: rankChanged ? "downgrade" : "rejection",
    label: rankChanged ? "黜落降档" : "黜落本场",
    rankBefore: before.examRank,
    rankAfter,
    reputationPenalty: 12,
    mentalityPenalty: 4
  };
}

function applyExamPromotion(worldState, exam, score, authenticityCheck) {
  // Promotion and fraud consequences are server-owned; provider output can only influence score/check inputs.
  const player = worldState.player;
  const before = snapshotPlayer(player);
  const severeCheat = hasSevereCheating(authenticityCheck);
  const passed = exam.level === "palace_exam"
    ? !severeCheat
    : score.overall_score >= exam.passScore && !severeCheat;

  if (severeCheat) {
    const consequence = applySevereCheatingConsequence(player, before);
    return {
      passed: false,
      applied: true,
      rank: null,
      nextLevel: getNextExamLevel(player.examRank),
      severeCheat: true,
      consequence,
      before,
      after: snapshotPlayer(player),
      reason: consequence.type === "downgrade"
        ? `监试定为严重作伪，黜落本场，并由${before.examRank}降回${player.examRank || "寒窗"}。`
        : "监试定为严重作伪，黜落本场，声望受损。"
    };
  }

  if (!passed) {
    return {
      passed: false,
      applied: false,
      rank: null,
      nextLevel: exam.level,
      severeCheat: false,
      consequence: null,
      before,
      after: snapshotPlayer(player),
      reason: "分数未达取中线，名位暂不改变。"
    };
  }

  if (exam.level === "palace_exam") {
    const palaceOutcome = getPalaceOutcome(score);
    player.examRank = "进士";
    player.palaceRank = palaceOutcome.palaceRank;
    player.role = "official";
    player.roleLabel = OFFICIAL_ROLE_LABEL;
    player.officeTitle = palaceOutcome.officeTitle;
    player.position = palaceOutcome.officeTitle;
    player.faction = "新科进士";
    player.influence = clamp((player.influence || 0) + 24, 0, 100);
    player.integrity = clamp(player.integrity ?? 72, 0, 100);
    player.reputation = clamp((player.reputation || 0) + palaceOutcome.reputationGain, 0, 100);
    seedOfficialCareerFields(player, palaceOutcome);
    ensureOfficialPostingCharacter(worldState);

    return {
      passed: true,
      applied: true,
      rank: palaceOutcome.rank,
      nextLevel: null,
      severeCheat: false,
      consequence: null,
      officeTitle: palaceOutcome.officeTitle,
      palaceRank: palaceOutcome.palaceRank,
      before,
      after: snapshotPlayer(player),
      reason: `殿试定为${palaceOutcome.rank}，初授${palaceOutcome.officeTitle}，转入官员身份。`
    };
  }

  player.examRank = exam.promotionRank;
  player.reputation = clamp((player.reputation || 0) + (PASS_REPUTATION_GAIN[exam.level] || 3), 0, 100);

  return {
    passed: true,
    applied: true,
    rank: exam.promotionRank,
    nextLevel: exam.nextLevel,
    severeCheat: false,
    consequence: null,
    before,
    after: snapshotPlayer(player),
    reason: `取中${exam.promotionRank}，可继续准备下一场科举。`
  };
}

module.exports = {
  applyExamPromotion,
  hasSevereCheating
};
