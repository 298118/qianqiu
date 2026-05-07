const { getExam, getNextExamLevel } = require("./exams");
const { TRAVEL_PLANS } = require("./examTravel");
const { formatYearMonthPeriod, normalizeTenDayPeriod } = require("./time");

const EXAM_CALENDAR_VERSION = 1;
const MAX_MISSED_WINDOWS = 8;
const MAX_RECENT_SESSIONS = 8;
const MAX_RIVALS = 14;
const MAX_RIVAL_ATTEMPTS = 6;

const EXAM_CALENDAR_RULES = {
  child_exam: {
    windowMonths: [1, 2, 4, 7, 10],
    preparationMonths: 1,
    travelMonths: 0,
    teacherReputation: 0,
    localQuota: "县试常科，重在入门根基，名额较宽。",
    recommendationLabel: "塾师点名即可入场"
  },
  provincial_exam: {
    windowMonths: [8, 9],
    preparationMonths: 6,
    travelMonths: 1,
    teacherReputation: 18,
    localQuota: "乡试秋闱，举额有限，同省士子竞争最烈。",
    recommendationLabel: "须有塾师或乡里士林声名作保"
  },
  metropolitan_exam: {
    windowMonths: [2, 3],
    preparationMonths: 8,
    travelMonths: 2,
    teacherReputation: 28,
    localQuota: "会试春闱，天下举人会集京师，房考取舍严峻。",
    recommendationLabel: "须有举业师友与同年声援"
  },
  palace_exam: {
    windowMonths: [4],
    preparationMonths: 2,
    travelMonths: 0,
    teacherReputation: 34,
    localQuota: "殿试御前定甲第，通常不黜贡士，只分高下。",
    recommendationLabel: "须守贡士体面，谨慎应对御前策问"
  }
};

const MONTH_LABELS = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月"
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function currentYear(worldState) {
  return clampInt(worldState?.year, 1, 9999, 1644);
}

function currentMonth(worldState) {
  return clampInt(worldState?.month, 1, 12, 1);
}

function currentTenDayPeriod(worldState) {
  return normalizeTenDayPeriod(worldState?.tenDayPeriod, 1);
}

function getCalendarRule(level) {
  return EXAM_CALENDAR_RULES[level] || EXAM_CALENDAR_RULES.child_exam;
}

function monthLabel(month) {
  return MONTH_LABELS[Math.max(1, Math.min(12, month)) - 1] || `${month}月`;
}

function windowLabel(months) {
  return (months || []).map(monthLabel).join("、");
}

function normalizeMissedWindows(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(isPlainObject)
    .map((entry) => ({
      level: cleanText(entry.level, ""),
      examName: cleanText(entry.examName, ""),
      attemptedYear: clampInt(entry.attemptedYear, 1, 9999, 1644),
      attemptedMonth: clampInt(entry.attemptedMonth, 1, 12, 1),
      nextWindowYear: clampInt(entry.nextWindowYear, 1, 9999, 1644),
      nextWindowMonth: clampInt(entry.nextWindowMonth, 1, 12, 1),
      reason: cleanText(entry.reason, "错过本期考期。")
    }))
    .filter((entry) => entry.level)
    .slice(-MAX_MISSED_WINDOWS);
}

function normalizeRivalAttempt(attempt) {
  const source = isPlainObject(attempt) ? attempt : {};
  return {
    level: cleanText(source.level, ""),
    examName: cleanText(source.examName, ""),
    year: clampInt(source.year, 1, 9999, 1644),
    month: clampInt(source.month, 1, 12, 1),
    score: clampInt(source.score, 0, 100, 0),
    rank: cleanText(source.rank, ""),
    place: clampInt(source.place, 1, 999, 1),
    playerPlace: clampInt(source.playerPlace, 1, 999, 1),
    passed: Boolean(source.passed)
  };
}

function normalizeRival(entry) {
  const source = isPlainObject(entry) ? entry : {};
  const id = cleanText(source.id, "", 48);
  if (!id) return null;

  return {
    id,
    name: cleanText(source.name, "同场士子", 48),
    origin: cleanText(source.origin, "乡里", 48),
    background: cleanText(source.background, "科场旧识"),
    style: cleanText(source.style, "文风未详", 48),
    firstMetLevel: cleanText(source.firstMetLevel, ""),
    lastSeenLevel: cleanText(source.lastSeenLevel, ""),
    firstMetYear: clampInt(source.firstMetYear, 1, 9999, 1644),
    firstMetMonth: clampInt(source.firstMetMonth, 1, 12, 1),
    lastSeenYear: clampInt(source.lastSeenYear, 1, 9999, 1644),
    lastSeenMonth: clampInt(source.lastSeenMonth, 1, 12, 1),
    relationship: cleanText(source.relationship, "rival", 32),
    contactId: cleanText(source.contactId, "", 48) || null,
    visible: source.visible !== false,
    attempts: Array.isArray(source.attempts)
      ? source.attempts.map(normalizeRivalAttempt).filter((attempt) => attempt.level).slice(-MAX_RIVAL_ATTEMPTS)
      : []
  };
}

function normalizeRecentSessions(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(isPlainObject)
    .map((entry) => ({
      level: cleanText(entry.level, ""),
      examName: cleanText(entry.examName, ""),
      year: clampInt(entry.year, 1, 9999, 1644),
      month: clampInt(entry.month, 1, 12, 1),
      playerPlace: clampInt(entry.playerPlace, 1, 999, 1),
      candidateCount: clampInt(entry.candidateCount, 0, 100, 0),
      peerCount: clampInt(entry.peerCount, 0, 100, 0)
    }))
    .filter((entry) => entry.level)
    .slice(-MAX_RECENT_SESSIONS);
}

function normalizeExamCalendarState(source = {}) {
  const calendar = isPlainObject(source) ? source : {};
  const rivals = Array.isArray(calendar.rivals)
    ? calendar.rivals.map(normalizeRival).filter(Boolean).slice(-MAX_RIVALS)
    : [];
  const nextRivalNumber = Math.max(
    clampInt(calendar.nextRivalNumber, 1, 9999, 1),
    rivals.length + 1
  );

  return {
    schemaVersion: EXAM_CALENDAR_VERSION,
    missedWindows: normalizeMissedWindows(calendar.missedWindows),
    recentSessions: normalizeRecentSessions(calendar.recentSessions),
    rivals,
    nextRivalNumber
  };
}

function createInitialExamCalendar() {
  return normalizeExamCalendarState({});
}

function ensureExamCalendarState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.examCalendar = normalizeExamCalendarState(worldState.examCalendar);
  return worldState;
}

function addMonths(year, month, delta) {
  const zeroBased = (year * 12) + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

function compareWindow(first, second) {
  return (first.year * 12 + first.month) - (second.year * 12 + second.month);
}

function findNextWindow(year, month, months) {
  const sorted = [...months].sort((a, b) => a - b);
  const thisYear = sorted.find((candidate) => candidate >= month);
  if (thisYear) return { year, month: thisYear };
  return { year: year + 1, month: sorted[0] };
}

function findPreviousWindow(year, month, months) {
  const sorted = [...months].sort((a, b) => a - b);
  const previous = [...sorted].reverse().find((candidate) => candidate < month);
  if (previous) return { year, month: previous };
  return { year: year - 1, month: sorted[sorted.length - 1] };
}

function getExamWindowState(worldState, exam) {
  const rule = getCalendarRule(exam.level);
  const year = currentYear(worldState);
  const month = currentMonth(worldState);
  const firstWindowMonth = Math.min(...rule.windowMonths);
  const isOpen = rule.windowMonths.includes(month);
  const nextWindow = isOpen
    ? { year, month }
    : findNextWindow(year, month, rule.windowMonths);
  const previousWindow = findPreviousWindow(year, month, rule.windowMonths);
  const monthsUntil = Math.max(0, compareWindow(nextWindow, { year, month }));
  const status = isOpen ? "open" : month < firstWindowMonth ? "early" : "missed";

  return {
    isOpen,
    status,
    statusLabel: isOpen ? "本期正在开场" : status === "missed" ? "已误本期" : "尚未开场",
    currentYear: year,
    currentMonth: month,
    currentTenDayPeriod: currentTenDayPeriod(worldState),
    currentDateLabel: formatYearMonthPeriod(worldState),
    windowMonths: [...rule.windowMonths],
    windowLabel: windowLabel(rule.windowMonths),
    nextWindowYear: nextWindow.year,
    nextWindowMonth: nextWindow.month,
    nextWindowLabel: `${nextWindow.year}年${monthLabel(nextWindow.month)}`,
    monthsUntil,
    previousWindowYear: previousWindow.year,
    previousWindowMonth: previousWindow.month
  };
}

function buildTeacherRecommendation(player = {}, rule) {
  const reputation = clampInt(player.reputation, 0, 100, 0);
  const hasTeacher = Boolean(player.teacher);
  const ready = hasTeacher || reputation >= rule.teacherReputation;
  return {
    ready,
    hasTeacher,
    requiredReputation: rule.teacherReputation,
    currentReputation: reputation,
    label: rule.recommendationLabel,
    note: ready
      ? hasTeacher
        ? `${player.teacher}可为本场举业作保。`
        : "乡里声名足以弥补师长荐书。"
      : `声名未足，最好先拜师、游学或经营乡里口碑至${rule.teacherReputation}。`
  };
}

function buildFundingAdvice(player = {}, exam) {
  const plan = TRAVEL_PLANS[exam.level] || TRAVEL_PLANS.child_exam;
  const currentGold = clampInt(player.gold, 0, 100000, 0);
  const requiredGold = plan.baseCost;
  return {
    requiredGold,
    currentGold,
    shortfall: Math.max(0, requiredGold - currentGold),
    ready: currentGold >= requiredGold,
    note: currentGold >= requiredGold
      ? "盘费已可覆盖本场路费与纸墨。"
      : `盘费尚缺${requiredGold - currentGold}两，入场会转为疲惫与心态风险。`
  };
}

function createExamCalendarSnapshot(worldState, exam) {
  const rule = getCalendarRule(exam.level);
  const windowState = getExamWindowState(worldState, exam);
  const arrival = addMonths(windowState.currentYear, windowState.currentMonth, rule.travelMonths);
  const recommendation = buildTeacherRecommendation(worldState.player, rule);

  return {
    schemaVersion: EXAM_CALENDAR_VERSION,
    level: exam.level,
    examName: exam.name,
    ...windowState,
    preparationMonths: rule.preparationMonths,
    travelMonths: rule.travelMonths,
    arrivalYear: arrival.year,
    arrivalMonth: arrival.month,
    arrivalLabel: `${arrival.year}年${monthLabel(arrival.month)}`,
    localQuota: rule.localQuota,
    teacherRecommendation: recommendation,
    funding: buildFundingAdvice(worldState.player, exam)
  };
}

function canOpenExamInCalendar(worldState, exam) {
  const snapshot = createExamCalendarSnapshot(worldState, exam);
  if (snapshot.isOpen) {
    return { ok: true, snapshot };
  }

  return {
    ok: false,
    snapshot,
    reason: snapshot.status === "missed"
      ? `${exam.name}本期已过，请等${snapshot.nextWindowLabel}再入场。`
      : `${exam.name}尚未开场，下一期在${snapshot.nextWindowLabel}。`
  };
}

function recordMissedExamWindow(worldState, exam, snapshot, reason) {
  ensureExamCalendarState(worldState);
  if (!snapshot || snapshot.status !== "missed") return null;

  const entry = {
    level: exam.level,
    examName: exam.name,
    attemptedYear: snapshot.currentYear,
    attemptedMonth: snapshot.currentMonth,
    nextWindowYear: snapshot.nextWindowYear,
    nextWindowMonth: snapshot.nextWindowMonth,
    reason: reason || `${exam.name}本期已误。`
  };
  const duplicateKey = `${entry.level}:${entry.attemptedYear}:${entry.attemptedMonth}`;
  const existing = worldState.examCalendar.missedWindows.some((item) =>
    `${item.level}:${item.attemptedYear}:${item.attemptedMonth}` === duplicateKey
  );
  if (!existing) {
    worldState.examCalendar.missedWindows = normalizeMissedWindows([
      ...worldState.examCalendar.missedWindows,
      entry
    ]);
  }
  return entry;
}

function selectPersistentCandidateSeeds(worldState, exam) {
  ensureExamCalendarState(worldState);
  return worldState.examCalendar.rivals
    .filter((rival) => rival.visible !== false)
    .filter((rival) => rival.lastSeenLevel === exam.level || rival.relationship !== "lost")
    .sort((first, second) => {
      const firstAttempts = first.attempts?.length || 0;
      const secondAttempts = second.attempts?.length || 0;
      if (secondAttempts !== firstAttempts) return secondAttempts - firstAttempts;
      return `${first.name}${first.origin}`.localeCompare(`${second.name}${second.origin}`);
    })
    .slice(0, 3)
    .map((rival) => ({
      id: rival.id,
      name: rival.name,
      origin: rival.origin,
      background: rival.background,
      style: rival.style,
      relationship: rival.relationship,
      previousAttempts: rival.attempts.length
    }));
}

function createRivalId(calendar) {
  const id = `rival-${String(calendar.nextRivalNumber).padStart(3, "0")}`;
  calendar.nextRivalNumber += 1;
  return id;
}

function findRival(calendar, candidate) {
  return calendar.rivals.find((rival) => rival.id === candidate.id) ||
    calendar.rivals.find((rival) => rival.name === candidate.name && rival.origin === candidate.origin);
}

function preparePersistentExamCohort(worldState, exam, candidates) {
  ensureExamCalendarState(worldState);
  const calendar = worldState.examCalendar;
  const year = currentYear(worldState);
  const month = currentMonth(worldState);

  const persistentCandidates = candidates.map((candidate) => {
    let rival = findRival(calendar, candidate);
    const id = rival?.id || createRivalId(calendar);

    if (!rival) {
      rival = {
        id,
        name: cleanText(candidate.name, "同场士子", 48),
        origin: cleanText(candidate.origin, "乡里", 48),
        background: cleanText(candidate.background, "科场旧识"),
        style: cleanText(candidate.style, "文风未详", 48),
        firstMetLevel: exam.level,
        lastSeenLevel: exam.level,
        firstMetYear: year,
        firstMetMonth: month,
        lastSeenYear: year,
        lastSeenMonth: month,
        relationship: "rival",
        contactId: null,
        visible: true,
        attempts: []
      };
      calendar.rivals.push(rival);
    }

    rival.lastSeenLevel = exam.level;
    rival.lastSeenYear = year;
    rival.lastSeenMonth = month;
    if (candidate.style) rival.style = candidate.style;

    return {
      ...candidate,
      id: rival.id,
      persistent: true,
      rivalStatus: rival.relationship,
      previousAttempts: rival.attempts.length,
      contactId: rival.contactId || null
    };
  });

  return persistentCandidates;
}

function candidatePassed(candidate, exam) {
  const score = candidate.score?.overall_score ?? 0;
  if (exam.level === "palace_exam") return score > 0;
  return score >= Math.max(60, exam.passScore);
}

function addOfficialPeerContact(worldState, rival, rankEntry) {
  if (worldState.player?.role !== "official") return null;
  const contactId = rival.contactId || `exam-peer-${rival.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  rival.contactId = contactId;
  worldState.characters = Array.isArray(worldState.characters) ? worldState.characters : [];
  if (!worldState.characters.some((character) => character.id === contactId)) {
    worldState.characters.push({
      id: contactId,
      name: rival.name,
      role: "同年进士",
      loyalty: 52,
      ambition: rankEntry.place <= 2 ? 72 : 58,
      skill: Math.max(45, Math.min(95, rankEntry.score || 60)),
      alive: true
    });
  }
  worldState.relationshipLedger = isPlainObject(worldState.relationshipLedger)
    ? worldState.relationshipLedger
    : {};
  worldState.relationshipLedger.characters = isPlainObject(worldState.relationshipLedger.characters)
    ? worldState.relationshipLedger.characters
    : {};
  worldState.relationshipLedger.characters[contactId] = {
    id: contactId,
    name: rival.name,
    role: "同年进士",
    stance: rankEntry.place < rankEntry.playerPlace ? "同年竞争者" : "同年声援",
    relationship: rankEntry.place < rankEntry.playerPlace ? 8 : 18,
    resentment: rankEntry.place < rankEntry.playerPlace ? 10 : 3,
    networkSource: "科场同年",
    recentIntent: "在仕途初年观察玩家能否互为声援。",
    visible: true,
    lastUpdatedTurn: worldState.turnCount || 0
  };
  return contactId;
}

function recordExamCohortResult(worldState, exam, virtualCandidates, ranking) {
  ensureExamCalendarState(worldState);
  const calendar = worldState.examCalendar;
  const year = currentYear(worldState);
  const month = currentMonth(worldState);
  const playerEntry = ranking.find((entry) => entry.isPlayer) || { place: ranking.length };
  let peerCount = 0;

  for (const candidate of virtualCandidates) {
    const rival = calendar.rivals.find((entry) => entry.id === candidate.id);
    const rankEntry = ranking.find((entry) => entry.id === candidate.id);
    if (!rival || !rankEntry) continue;

    const passed = candidatePassed(candidate, exam);
    const beatPlayer = rankEntry.place < playerEntry.place;
    if (passed && exam.level === "palace_exam") {
      rival.relationship = "official_peer";
      addOfficialPeerContact(worldState, rival, { ...rankEntry, playerPlace: playerEntry.place });
      peerCount += 1;
    } else if (passed && !beatPlayer) {
      rival.relationship = "peer";
      peerCount += 1;
    } else if (beatPlayer) {
      rival.relationship = "rival";
    }

    const attempt = {
      level: exam.level,
      examName: exam.name,
      year,
      month,
      score: rankEntry.score,
      rank: rankEntry.rank,
      place: rankEntry.place,
      playerPlace: playerEntry.place,
      passed
    };
    rival.attempts = [...(rival.attempts || []), attempt].slice(-MAX_RIVAL_ATTEMPTS);
    rival.lastSeenLevel = exam.level;
    rival.lastSeenYear = year;
    rival.lastSeenMonth = month;
  }

  calendar.recentSessions = normalizeRecentSessions([
    ...calendar.recentSessions,
    {
      level: exam.level,
      examName: exam.name,
      year,
      month,
      playerPlace: playerEntry.place,
      candidateCount: virtualCandidates.length,
      peerCount
    }
  ]);
  calendar.rivals = calendar.rivals.map(normalizeRival).filter(Boolean).slice(-MAX_RIVALS);
  return {
    peerCount,
    playerPlace: playerEntry.place
  };
}

function buildExamCalendarView(worldState = {}) {
  ensureExamCalendarState(worldState);
  const level = getNextExamLevel(worldState.player?.examRank);
  const exam = level ? getExam(level) : null;
  const nextExam = exam ? createExamCalendarSnapshot(worldState, exam) : null;

  return {
    schemaVersion: EXAM_CALENDAR_VERSION,
    currentYear: currentYear(worldState),
    currentMonth: currentMonth(worldState),
    currentTenDayPeriod: currentTenDayPeriod(worldState),
    currentDateLabel: formatYearMonthPeriod(worldState),
    nextExam,
    missedWindows: worldState.examCalendar.missedWindows.slice(-3),
    recentSessions: worldState.examCalendar.recentSessions.slice(-4)
  };
}

function buildExamRivalView(worldState = {}) {
  ensureExamCalendarState(worldState);
  const rivals = worldState.examCalendar.rivals
    .filter((rival) => rival.visible !== false)
    .slice(-6)
    .reverse()
    .map((rival) => {
      const latest = rival.attempts[rival.attempts.length - 1] || null;
      return {
        id: rival.id,
        name: rival.name,
        origin: rival.origin,
        background: rival.background,
        style: rival.style,
        relationship: rival.relationship,
        contactId: rival.contactId || null,
        lastSeenLevel: rival.lastSeenLevel,
        lastSeenYear: rival.lastSeenYear,
        lastSeenMonth: rival.lastSeenMonth,
        attempts: rival.attempts.length,
        latest
      };
    });

  return {
    schemaVersion: EXAM_CALENDAR_VERSION,
    rivals,
    recentSessions: worldState.examCalendar.recentSessions.slice(-4)
  };
}

function summarizeExamCalendarForPrompt(worldState = {}) {
  const view = buildExamCalendarView(worldState);
  return {
    currentYear: view.currentYear,
    currentMonth: view.currentMonth,
    currentTenDayPeriod: view.currentTenDayPeriod,
    currentDateLabel: view.currentDateLabel,
    nextExam: view.nextExam
      ? {
        level: view.nextExam.level,
        status: view.nextExam.status,
        currentYear: view.nextExam.currentYear,
        currentMonth: view.nextExam.currentMonth,
        currentTenDayPeriod: view.nextExam.currentTenDayPeriod,
        currentDateLabel: view.nextExam.currentDateLabel,
        windowLabel: view.nextExam.windowLabel,
        nextWindowLabel: view.nextExam.nextWindowLabel,
        monthsUntil: view.nextExam.monthsUntil,
        preparationMonths: view.nextExam.preparationMonths,
        travelMonths: view.nextExam.travelMonths,
        teacherRecommendation: view.nextExam.teacherRecommendation
      }
      : null,
    rivals: buildExamRivalView(worldState).rivals.map((rival) => ({
      id: rival.id,
      name: rival.name,
      relationship: rival.relationship,
      lastSeenLevel: rival.lastSeenLevel,
      attempts: rival.attempts
    }))
  };
}

module.exports = {
  EXAM_CALENDAR_RULES,
  buildExamCalendarView,
  buildExamRivalView,
  canOpenExamInCalendar,
  createExamCalendarSnapshot,
  createInitialExamCalendar,
  ensureExamCalendarState,
  getCalendarRule,
  getExamWindowState,
  preparePersistentExamCohort,
  recordExamCohortResult,
  recordMissedExamWindow,
  selectPersistentCandidateSeeds,
  summarizeExamCalendarForPrompt
};
