const {
  EXAM_AFTERMATH_AUTHORITY_BOUNDARY,
  EXAM_AFTERMATH_LIMITS,
  EXAM_AFTERMATH_NEXT_STEPS,
  EXAM_AFTERMATH_SCHEMA_VERSION
} = require("./examAftermathConfig");
const { cleanPreparationText } = require("./examTravel");

const UNSAFE_AFTERMATH_TEXT_PATTERN =
  /\b(?:provider|statePatch|state[_ -]?patch|worldState|world[_ -]?state)\b/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = EXAM_AFTERMATH_LIMITS.maxVisibleText) {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    if (UNSAFE_AFTERMATH_TEXT_PATTERN.test(text)) return fallback;
  }
  return cleanPreparationText(value, fallback, maxLength);
}

function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function readLatestHistory(worldState = {}) {
  return Array.isArray(worldState.player?.examHistory)
    ? worldState.player.examHistory.at(-1) || null
    : null;
}

function getDateStamp(worldState = {}, source = {}) {
  return {
    year: clampNumber(source.year ?? source.date?.year ?? worldState.year, 1, 9999, 1644),
    month: clampNumber(source.month ?? source.date?.month ?? worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(source.tenDayPeriod ?? source.date?.tenDayPeriod ?? worldState.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(source.turnCount ?? source.date?.turnCount ?? worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function getPlayerRankingEntry(ranking = []) {
  return Array.isArray(ranking) ? ranking.find((entry) => isPlainObject(entry) && entry.isPlayer === true) || null : null;
}

function normalizeContact(contact = {}, fallbackKind = "exam_contact", index = 0) {
  if (!isPlainObject(contact)) return null;
  const id = cleanText(contact.id, `${fallbackKind}-${index}`, 96);
  const name = cleanText(contact.name, fallbackKind === "same_year" ? "同年" : "座师", 48);
  if (!id || !name) return null;
  return {
    id,
    name,
    role: cleanText(contact.role, fallbackKind === "same_year" ? "同年" : "科场考官", 48),
    relationKind: cleanText(contact.relationKind, fallbackKind, 40),
    stance: cleanText(contact.stance, fallbackKind === "same_year" ? "同年往来" : "科场师承", 80),
    relationship: clampNumber(contact.relationship, -100, 100, 0),
    publicSummary: cleanText(contact.publicSummary, "科场关系只显示公开摘要。")
  };
}

function normalizeContacts(list = [], fallbackKind = "exam_contact") {
  return (Array.isArray(list) ? list : [])
    .map((contact, index) => normalizeContact(contact, fallbackKind, index))
    .filter(Boolean)
    .slice(0, EXAM_AFTERMATH_LIMITS.maxContacts);
}

function readHonorTitle(examHonor = {}, rankingEntry = {}, promotionResult = {}) {
  if (isPlainObject(examHonor.currentAchievement) && examHonor.currentAchievement.title) {
    return cleanText(examHonor.currentAchievement.title, "", 48);
  }
  if (isPlainObject(examHonor.currentHonor) && examHonor.currentHonor.title) {
    return cleanText(examHonor.currentHonor.title, "", 48);
  }
  if (examHonor.title) return cleanText(examHonor.title, "", 48);
  return cleanText(rankingEntry.honorTitle || rankingEntry.rankLabel || promotionResult.rank, "", 48);
}

function readRankLabel(rankingEntry = {}, promotionResult = {}) {
  return cleanText(rankingEntry.rankLabel || rankingEntry.honorTitle || rankingEntry.rank || promotionResult.rank, "等第未公开", 64);
}

function readOfficeTitle(appointmentTrack = {}, promotionResult = {}) {
  const latestDecision = isPlainObject(appointmentTrack.latestDecision) ? appointmentTrack.latestDecision : {};
  const latestTrack = isPlainObject(appointmentTrack.latestTrack) ? appointmentTrack.latestTrack : appointmentTrack;
  return cleanText(
    latestDecision.officeTitle || latestTrack.officeTitle || promotionResult.officeTitle,
    "",
    64
  );
}

function readFirstAssignment(worldState = {}, appointmentTrack = {}) {
  const latestDecision = isPlainObject(appointmentTrack.latestDecision) ? appointmentTrack.latestDecision : {};
  const assignment = Array.isArray(worldState.officialCareer?.assignments)
    ? worldState.officialCareer.assignments[0]
    : null;
  return cleanText(
    assignment?.title || latestDecision.firstAssignmentTitle || "",
    "",
    72
  );
}

function buildNextActions({ level, passed, sameYearContacts, examinerContacts, officeTitle, firstAssignment }) {
  const actions = [];
  if (!passed) {
    actions.push(...EXAM_AFTERMATH_NEXT_STEPS.failed);
  } else {
    actions.push(...(EXAM_AFTERMATH_NEXT_STEPS[level] || EXAM_AFTERMATH_NEXT_STEPS.child_exam));
    if (examinerContacts[0]) {
      actions.push(`具帖拜谢${examinerContacts[0].name}，只问公开读书或赴任规矩。`);
    }
    if (sameYearContacts[0]) {
      actions.push(`约${sameYearContacts[0].name}互通近况，维持同年公开往来。`);
    }
    if (officeTitle) {
      actions.push(`赴${officeTitle}报到，先问本职差遣。`);
    }
    if (firstAssignment) {
      actions.push(`先办理“${firstAssignment}”，等待服务器裁决结果。`);
    }
  }
  return actions
    .map((action) => cleanText(action, "", 96))
    .filter(Boolean)
    .slice(0, EXAM_AFTERMATH_LIMITS.maxNextActions);
}

function sanitizeExamAftermathView(view = null) {
  if (!isPlainObject(view)) return null;
  const sameYearContacts = normalizeContacts(view.sameYearContacts, "same_year");
  const examinerContacts = normalizeContacts(view.examinerContacts, "examiner");
  const date = isPlainObject(view.date) ? view.date : {};
  return {
    schemaVersion: EXAM_AFTERMATH_SCHEMA_VERSION,
    source: cleanText(view.source, "server_exam_aftermath", 48),
    level: cleanText(view.level, "exam", 40),
    examName: cleanText(view.examName, "科场", 48),
    date: {
      year: clampNumber(date.year, 1, 9999, 1644),
      month: clampNumber(date.month, 1, 12, 1),
      tenDayPeriod: clampNumber(date.tenDayPeriod, 1, 3, 1),
      turnCount: clampNumber(date.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
    },
    passed: view.passed === true,
    score: view.score === null || view.score === undefined ? null : clampNumber(view.score, 0, 100, 0),
    rankLabel: cleanText(view.rankLabel, "等第未公开", 64),
    honorTitle: cleanText(view.honorTitle, "", 48),
    officeTitle: cleanText(view.officeTitle, "", 64),
    firstAssignmentTitle: cleanText(view.firstAssignmentTitle, "", 72),
    sameYearCount: clampNumber(view.sameYearCount ?? sameYearContacts.length, 0, 1000, sameYearContacts.length),
    examinerCount: clampNumber(view.examinerCount ?? examinerContacts.length, 0, 1000, examinerContacts.length),
    sameYearContacts,
    examinerContacts,
    publicSummary: cleanText(view.publicSummary, "放榜后过渡由服务器整理。"),
    nextActions: (Array.isArray(view.nextActions) ? view.nextActions : [])
      .map((action) => cleanText(action, "", 96))
      .filter(Boolean)
      .slice(0, EXAM_AFTERMATH_LIMITS.maxNextActions),
    authorityBoundary: EXAM_AFTERMATH_AUTHORITY_BOUNDARY
  };
}

function buildExamAftermathView(worldState = {}, context = {}) {
  const latestHistory = context.historyEntry || readLatestHistory(worldState) || {};
  const activeExam = context.activeExam || {};
  const exam = context.exam || {};
  const promotionResult = context.promotionResult || latestHistory.promotionResult || {};
  const ranking = context.ranking || latestHistory.ranking || [];
  const rankingEntry = getPlayerRankingEntry(ranking) || {};
  const examNetwork = context.examNetwork || latestHistory.examNetwork || {};
  const examHonor = context.examHonor || latestHistory.examHonor || {};
  const appointmentTrack = context.appointmentTrack || latestHistory.appointmentTrack || {};
  const score = context.score || latestHistory.score || {};
  const passed = promotionResult.passed === true;
  const sameYearContacts = normalizeContacts(examNetwork.sameYearContacts, "same_year");
  const examinerContacts = normalizeContacts(examNetwork.examinerContacts, "examiner");
  const level = cleanText(exam.level || activeExam.level || latestHistory.level, "exam", 40);
  const examName = cleanText(activeExam.examName || exam.name || latestHistory.examName || examHonor.examName, "科场", 48);
  const honorTitle = readHonorTitle(examHonor, rankingEntry, promotionResult);
  const rankLabel = readRankLabel(rankingEntry, promotionResult);
  const officeTitle = readOfficeTitle(appointmentTrack, promotionResult);
  const firstAssignmentTitle = readFirstAssignment(worldState, appointmentTrack);
  const scoreValue = score.overall_score ?? rankingEntry.score ?? null;
  const networkText = `同年${sameYearContacts.length}人、座师/考官${examinerContacts.length}人`;
  const publicSummary = passed
    ? `${examName}放榜后，服务器定${rankLabel}${honorTitle ? `（${honorTitle}）` : ""}，整理${networkText}${officeTitle ? `，并接入${officeTitle}` : ""}。`
    : `${examName}放榜后未取中，服务器只保留公开复盘，不新增同年或座师关系。`;
  return sanitizeExamAftermathView({
    schemaVersion: EXAM_AFTERMATH_SCHEMA_VERSION,
    source: "server_exam_aftermath",
    level,
    examName,
    date: getDateStamp(worldState, latestHistory),
    passed,
    score: scoreValue,
    rankLabel,
    honorTitle,
    officeTitle,
    firstAssignmentTitle,
    sameYearCount: sameYearContacts.length,
    examinerCount: examinerContacts.length,
    sameYearContacts,
    examinerContacts,
    publicSummary,
    nextActions: buildNextActions({
      level,
      passed,
      sameYearContacts,
      examinerContacts,
      officeTitle,
      firstAssignment: firstAssignmentTitle
    }),
    authorityBoundary: EXAM_AFTERMATH_AUTHORITY_BOUNDARY
  });
}

function buildLatestExamAftermathView(worldState = {}) {
  const latestHistory = readLatestHistory(worldState);
  if (!latestHistory) return null;
  if (latestHistory.examAftermath) {
    return sanitizeExamAftermathView(latestHistory.examAftermath);
  }
  return buildExamAftermathView(worldState, { historyEntry: latestHistory });
}

module.exports = {
  buildExamAftermathView,
  buildLatestExamAftermathView,
  sanitizeExamAftermathView
};
