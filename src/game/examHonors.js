const {
  EXAM_HONOR_LIMITS,
  EXAM_HONOR_SCHEMA_VERSION,
  LEVEL_HONOR_TITLES,
  PALACE_TOP_TITLES
} = require("./examHonorsConfig");

const UNSAFE_PUBLIC_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping/gi,
  /raw provider|raw_provider|provider proposal|raw audit|raw_audit|prompt/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+/gi,
  /data\/sessions\/[^\s，。；]*|data\/audit\/[^\s，。；]*|\/mnt\/[^\s，。；]*|[A-Z]:\\[^\s，。；]*/gi
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = EXAM_HONOR_LIMITS.textPreviewLength) {
  if (typeof value !== "string") return fallback;
  let trimmed = value.trim().replace(/\s+/g, " ");
  for (const pattern of UNSAFE_PUBLIC_TEXT_PATTERNS) {
    trimmed = trimmed.replace(pattern, "已遮蔽");
  }
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getDateStamp(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function createInitialExamHonorLedger(worldState = {}) {
  return {
    schemaVersion: EXAM_HONOR_SCHEMA_VERSION,
    honors: [],
    achievements: [],
    updatedAtTurn: worldState.turnCount ?? 0
  };
}

function normalizeHonorRecord(record = {}, index = 0) {
  const date = isPlainObject(record.date) ? record.date : {};
  const title = cleanText(record.title, "科名次序", 48);
  const level = cleanText(record.level, "exam", 40);
  const place = record.place === null ? null : clampNumber(record.place, 1, 10000, 1);
  return {
    id: cleanText(record.id, `${level}-${title}-${date.year || "year"}-${place || index + 1}`, 96),
    level,
    examName: cleanText(record.examName, "科场", 48),
    title,
    titleType: cleanText(record.titleType, "placement", 32),
    place,
    classPlace: record.classPlace === null || record.classPlace === undefined
      ? null
      : clampNumber(record.classPlace, 1, 10000, 1),
    palaceRank: cleanText(record.palaceRank, "", 32) || null,
    rankLabel: cleanText(record.rankLabel, "", 64),
    score: record.score === null || record.score === undefined
      ? null
      : clampNumber(record.score, 0, 100, 0),
    passed: record.passed !== false,
    year: clampNumber(record.year ?? date.year, 1, 9999, 1644),
    month: clampNumber(record.month ?? date.month, 1, 12, 1),
    tenDayPeriod: clampNumber(record.tenDayPeriod ?? date.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(record.turnCount ?? date.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    publicSummary: cleanText(record.publicSummary, `${title}由服务器榜单写定。`),
    authorityBoundary: "名次荣誉由服务器从定榜顺序生成；AI、模型排序和考官建议不能直接授予。"
  };
}

function normalizeAchievement(record = {}, index = 0) {
  const title = cleanText(record.title, "科名成就", 48);
  return {
    id: cleanText(record.id, `achievement-${title}-${record.year || index + 1}`, 96),
    title,
    type: cleanText(record.type, "achievement", 32),
    year: clampNumber(record.year, 1, 9999, 1644),
    month: clampNumber(record.month, 1, 12, 1),
    tenDayPeriod: clampNumber(record.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(record.turnCount, 0, Number.MAX_SAFE_INTEGER, 0),
    relatedTitles: Array.isArray(record.relatedTitles)
      ? record.relatedTitles.map((item) => cleanText(item, "", 48)).filter(Boolean).slice(0, 6)
      : [],
    publicSummary: cleanText(record.publicSummary, `${title}已入科名簿。`),
    authorityBoundary: "成就只从服务器既有荣誉账本归纳，不采纳模型自封。"
  };
}

function ensureExamHonorLedgerState(worldState = {}) {
  if (!isPlainObject(worldState.examHonorLedger)) {
    worldState.examHonorLedger = createInitialExamHonorLedger(worldState);
  }
  const ledger = worldState.examHonorLedger;
  ledger.schemaVersion = EXAM_HONOR_SCHEMA_VERSION;
  ledger.honors = Array.isArray(ledger.honors)
    ? ledger.honors.map(normalizeHonorRecord)
    : [];
  ledger.achievements = Array.isArray(ledger.achievements)
    ? ledger.achievements.map(normalizeAchievement)
    : [];
  ledger.updatedAtTurn = clampNumber(ledger.updatedAtTurn, 0, Number.MAX_SAFE_INTEGER, worldState.turnCount ?? 0);
  return ledger;
}

function isPassingEntry(entry = {}, exam = {}) {
  if (!entry || entry.score === undefined || entry.score === null) return false;
  if (entry.rank === "落第") return false;
  if (exam.level === "palace_exam") return true;
  return Number(entry.score) >= Number(exam.passScore || 0);
}

function palaceInfoForPlace(place) {
  if (place <= PALACE_TOP_TITLES.length) {
    return {
      honorTitle: PALACE_TOP_TITLES[place - 1],
      titleType: "palace_top_three",
      palaceRank: "一甲",
      classPlace: place,
      rankLabel: `一甲第${place}名`
    };
  }
  const secondClassEnd = PALACE_TOP_TITLES.length + EXAM_HONOR_LIMITS.palaceSecondClassPlaces;
  if (place <= secondClassEnd) {
    const classPlace = place - PALACE_TOP_TITLES.length;
    return {
      honorTitle: classPlace === 1 ? "传胪" : null,
      titleType: classPlace === 1 ? "transmission_reader" : "palace_second_class",
      palaceRank: "二甲",
      classPlace,
      rankLabel: `二甲第${classPlace}名`
    };
  }
  const classPlace = place - secondClassEnd;
  return {
    honorTitle: null,
    titleType: "palace_third_class",
    palaceRank: "三甲",
    classPlace,
    rankLabel: `三甲第${classPlace}名`
  };
}

function placementInfoForEntry(entry = {}, exam = {}) {
  const place = clampNumber(entry.place, 1, 10000, 1);
  if (!isPassingEntry(entry, exam)) {
    return {
      honorTitle: null,
      titleType: "not_awarded",
      palaceRank: null,
      classPlace: null,
      rankLabel: entry.rank === "落第" ? "未取中" : `第${place}名`
    };
  }

  if (exam.level === "palace_exam") {
    return palaceInfoForPlace(place);
  }

  const levelConfig = LEVEL_HONOR_TITLES[exam.level];
  if (!levelConfig) {
    return {
      honorTitle: null,
      titleType: "placement",
      palaceRank: null,
      classPlace: place,
      rankLabel: `第${place}名`
    };
  }

  return {
    honorTitle: place === 1 ? levelConfig.first : null,
    titleType: place === 1 ? "level_first" : "placement",
    palaceRank: null,
    classPlace: place,
    rankLabel: place === 1 ? `${levelConfig.placementPrefix}第一名` : `${levelConfig.placementPrefix}第${place}名`
  };
}

function decorateExamRanking({ exam = {}, ranking = [] }) {
  if (!Array.isArray(ranking)) return [];
  return ranking.map((entry) => {
    const info = placementInfoForEntry(entry, exam);
    return {
      ...entry,
      rankLabel: info.rankLabel,
      honorTitle: info.honorTitle,
      honorType: info.titleType,
      palaceRank: info.palaceRank,
      classPlace: info.classPlace
    };
  });
}

function getPlayerRankingEntry(ranking = []) {
  return Array.isArray(ranking) ? ranking.find((entry) => entry.isPlayer) || null : null;
}

function applyCanonicalScoreRank(score = {}, exam = {}, ranking = []) {
  if (exam.level !== "palace_exam") return score;
  const playerEntry = getPlayerRankingEntry(ranking);
  if (!playerEntry?.palaceRank) return score;
  return {
    ...score,
    rank: playerEntry.palaceRank
  };
}

function createPlacementRecord({ worldState = {}, activeExam = {}, exam = {}, rankingEntry = {}, promotionResult = {} }) {
  if (!promotionResult?.passed || !rankingEntry) return null;
  const info = placementInfoForEntry(rankingEntry, exam);
  const place = clampNumber(rankingEntry.place, 1, 10000, 1);
  const score = rankingEntry.score === undefined ? null : clampNumber(rankingEntry.score, 0, 100, 0);
  const date = getDateStamp(worldState);
  const title = info.honorTitle || info.rankLabel;
  const examName = cleanText(activeExam.examName || exam.name || rankingEntry.examName, "科场", 48);
  const summary = info.honorTitle
    ? `${examName}放榜，服务器定${worldState.player?.name || "玩家"}为${info.honorTitle}（${info.rankLabel}）。`
    : `${examName}放榜，服务器定${worldState.player?.name || "玩家"}为${info.rankLabel}。`;

  return normalizeHonorRecord({
    id: [
      exam.level || activeExam.level || "exam",
      date.year,
      place,
      info.honorTitle || info.rankLabel
    ].join("-"),
    level: exam.level || activeExam.level,
    examName,
    title,
    titleType: info.titleType,
    place,
    classPlace: info.classPlace,
    palaceRank: info.palaceRank,
    rankLabel: info.rankLabel,
    score,
    passed: true,
    ...date,
    publicSummary: summary
  });
}

function hasHonorTitle(honors = [], level, title) {
  return honors.some((honor) => honor.level === level && honor.title === title);
}

function createTripleFirstAchievement(worldState = {}, honors = []) {
  if (
    !hasHonorTitle(honors, "provincial_exam", "解元") ||
    !hasHonorTitle(honors, "metropolitan_exam", "会元") ||
    !hasHonorTitle(honors, "palace_exam", "状元")
  ) {
    return null;
  }
  const date = getDateStamp(worldState);
  return normalizeAchievement({
    id: `triple-first-${date.year}-${date.turnCount}`,
    title: "三元及第",
    type: "triple_first",
    ...date,
    relatedTitles: ["解元", "会元", "状元"],
    publicSummary: "乡试、会试、殿试连得第一，服务器记为三元及第。"
  });
}

function resolveExamHonors({ worldState = {}, activeExam = {}, exam = {}, ranking = [], promotionResult = {} }) {
  const ledger = ensureExamHonorLedgerState(worldState);
  const playerEntry = getPlayerRankingEntry(ranking);
  const record = createPlacementRecord({
    worldState,
    activeExam,
    exam,
    rankingEntry: playerEntry,
    promotionResult
  });
  const addedHonors = [];
  const addedAchievements = [];

  if (record) {
    ledger.honors.push(record);
    addedHonors.push(record);
  }

  const tripleFirst = createTripleFirstAchievement(worldState, ledger.honors);
  if (tripleFirst && !ledger.achievements.some((achievement) => achievement.type === "triple_first")) {
    ledger.achievements.push(tripleFirst);
    addedAchievements.push(tripleFirst);
  }

  ledger.updatedAtTurn = worldState.turnCount ?? ledger.updatedAtTurn ?? 0;
  return {
    schemaVersion: EXAM_HONOR_SCHEMA_VERSION,
    playerRankingEntry: playerEntry || null,
    awardedHonors: addedHonors,
    currentHonor: addedHonors.at(-1) || null,
    currentAchievement: addedAchievements.at(-1) || null,
    examHonorView: buildExamHonorView(worldState),
    publicSummary: buildHonorResultSummary(addedHonors.at(-1) || null, addedAchievements.at(-1) || null)
  };
}

function buildHonorResultSummary(honor = null, achievement = null) {
  if (achievement) return achievement.publicSummary;
  if (honor) return honor.publicSummary;
  return "本场未新增特殊科名荣誉。";
}

function buildExamHonorSnapshot(result = {}) {
  return {
    schemaVersion: EXAM_HONOR_SCHEMA_VERSION,
    awards: Array.isArray(result.awardedHonors) ? result.awardedHonors.map(normalizeHonorRecord) : [],
    currentHonor: result.currentHonor ? normalizeHonorRecord(result.currentHonor) : null,
    currentAchievement: result.currentAchievement ? normalizeAchievement(result.currentAchievement) : null,
    publicSummary: cleanText(result.publicSummary, "本场科名荣誉已归档。"),
    authorityBoundary: "考试档案只保存服务器榜单生成的公开名次荣誉。"
  };
}

function buildExamHonorView(worldState = {}) {
  const ledger = isPlainObject(worldState.examHonorLedger)
    ? worldState.examHonorLedger
    : createInitialExamHonorLedger(worldState);
  const honors = Array.isArray(ledger.honors) ? ledger.honors.map(normalizeHonorRecord) : [];
  const achievements = Array.isArray(ledger.achievements) ? ledger.achievements.map(normalizeAchievement) : [];
  const latestHonor = honors.at(-1) || null;
  const latestAchievement = achievements.at(-1) || null;

  return {
    schemaVersion: EXAM_HONOR_SCHEMA_VERSION,
    honors: honors.slice(-EXAM_HONOR_LIMITS.maxVisibleHonors),
    achievements,
    currentAchievement: latestAchievement,
    latestHonor,
    publicSummary: latestAchievement?.publicSummary ||
      latestHonor?.publicSummary ||
      "科名荣誉簿尚无新记。",
    authorityBoundary: "科名荣誉只读服务器定榜顺序与考试履历；不读取模型排序、原始建议、隐藏札记、本地路径或密钥。"
  };
}

function summarizeExamHonorsForPrompt(worldState = {}) {
  const view = buildExamHonorView(worldState);
  return {
    schemaVersion: view.schemaVersion,
    honors: view.honors.slice(-EXAM_HONOR_LIMITS.maxPromptHonors).map((honor) => ({
      level: honor.level,
      title: honor.title,
      place: honor.place,
      rankLabel: honor.rankLabel,
      palaceRank: honor.palaceRank,
      year: honor.year
    })),
    currentAchievement: view.currentAchievement
      ? {
        title: view.currentAchievement.title,
        type: view.currentAchievement.type,
        year: view.currentAchievement.year,
        relatedTitles: view.currentAchievement.relatedTitles
      }
      : null,
    publicSummary: view.publicSummary,
    authorityBoundary: "prompt 只能读取公开科名荣誉摘要；不得要求模型自定解元、会元、状元、甲第、授官或 hidden 榜单。"
  };
}

module.exports = {
  applyCanonicalScoreRank,
  buildExamHonorSnapshot,
  buildExamHonorView,
  createInitialExamHonorLedger,
  decorateExamRanking,
  ensureExamHonorLedgerState,
  resolveExamHonors,
  summarizeExamHonorsForPrompt
};
