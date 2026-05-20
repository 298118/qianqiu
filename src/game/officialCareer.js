const { NUMERIC_RANGES, clamp } = require("./stateRules");
const { normalizeRelationshipLedger } = require("./relationships");
const {
  buildOfficialFirstMonthExperienceView,
  buildOfficialFirstMonthTurnEvent,
  hasUnsafeOfficialFirstMonthText
} = require("./officialFirstMonth");
const {
  getOfficeLadder,
  inferOfficeByTitle,
  listOutpostCandidates,
  listPromotionCandidates,
  listTransferCandidates,
  summarizeOfficeForPlayer
} = require("./officialCatalog");
const { TURNS_PER_MONTH, monthsToTurns } = require("./time");

const OFFICIAL_CAREER_SCHEMA_VERSION = 2;
const DEFAULT_REVIEW_CYCLE_MONTHS = 12;
const DEFAULT_ASSIGNMENT_DEADLINE_MONTHS = 4;
const MAX_ASSIGNMENT_DEADLINE_MONTHS = 24;
const DEFAULT_IMPEACHMENT_DEADLINE_MONTHS = 4;
const MAX_IMPEACHMENT_DEADLINE_MONTHS = 24;
const OUTCOME_COOLDOWN_MONTHS = 6;
const DEADLINE_UNIT_TEN_DAY = "ten_day";
const COOLDOWN_UNIT_TEN_DAY = "ten_day";
const MAX_CAREER_HISTORY = 8;
const MAX_ASSIGNMENTS = 6;
const MAX_ASSESSMENT_NOTES = 5;
const MAX_HIDDEN_NOTES = 5;
const MAX_EVENT_TEXT_LENGTH = 160;

const SCHOLAR_ROLE_LABEL = "书生";
const OFFICIAL_ROLE_LABEL = "入仕官员";

const OUTCOME_TYPES = new Set([
  "appointment",
  "transfer",
  "promotion",
  "outpost",
  "demotion",
  "impeachment",
  "punishment",
  "retention"
]);

const ASSIGNMENT_KINDS = new Set([
  "relief",
  "land_survey",
  "case_review",
  "riverworks",
  "military_supply",
  "salt_transport",
  "exam_supervision",
  "memorial_drafting",
  "audit",
  "personnel_review",
  "routine_office"
]);

const ASSIGNMENT_STATUSES = new Set(["active", "submitted", "resolved", "expired", "failed"]);
const ASSIGNMENT_SOURCE_TYPES = new Set(["superior", "bureau", "same_year", "censor", "local_petition", "self"]);
const RECOMMENDATION_TYPES = new Set(["court_nomination", "transfer", "outpost", "mourning_leave", "restoration"]);
const IMPEACHMENT_STAGES = new Set([
  "none",
  "risk_watch",
  "memorial_filed",
  "audit_open",
  "discipline_pending",
  "resolved"
]);

const ATTRIBUTE_LABELS = {
  "player.influence": "影响",
  "player.reputation": "声望",
  "player.mentality": "心性",
  "player.superiorFavor": "上官",
  "player.peerNetwork": "同年",
  "player.performanceMerit": "考成",
  "player.promotionProspect": "升迁",
  "player.impeachmentRisk": "弹劾",
  "player.cleanReputation": "清操"
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = MAX_EVENT_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (hasUnsafeOfficialFirstMonthText(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function normalizeTextArray(value, limit = MAX_HIDDEN_NOTES, maxLength = MAX_EVENT_TEXT_LENGTH) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanText(entry, "", maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function deadlineTurnFromMonths(worldState, months) {
  return currentTurn(worldState) + monthsToTurns(months);
}

function convertLegacyMonthTurn(rawDueTurn, worldState, fallbackMonths, maxMonths) {
  const turn = currentTurn(worldState);
  const parsed = Number(rawDueTurn);
  if (!Number.isFinite(parsed)) return deadlineTurnFromMonths(worldState, fallbackMonths);
  const legacyRemainingMonths = Math.max(0, Math.round(parsed) - turn);
  return clampNumber(
    turn + monthsToTurns(legacyRemainingMonths),
    turn,
    turn + monthsToTurns(maxMonths),
    deadlineTurnFromMonths(worldState, fallbackMonths)
  );
}

function clampDueTurn(rawDueTurn, worldState, fallbackMonths, maxMonths) {
  const turn = currentTurn(worldState);
  return clampNumber(
    rawDueTurn,
    turn,
    turn + monthsToTurns(maxMonths),
    deadlineTurnFromMonths(worldState, fallbackMonths)
  );
}

function normalizeDueTurn(rawDueTurn, worldState, fallbackMonths, maxMonths, unit) {
  if (unit === DEADLINE_UNIT_TEN_DAY) {
    return clampDueTurn(rawDueTurn, worldState, fallbackMonths, maxMonths);
  }
  return convertLegacyMonthTurn(rawDueTurn, worldState, fallbackMonths, maxMonths);
}

function normalizeAbsoluteTurnMap(turns, current, unit, maxMonths) {
  const normalized = {};
  if (!isPlainObject(turns)) return normalized;
  for (const [key, value] of Object.entries(turns)) {
    const cleanKey = cleanText(key, "", 64);
    if (!cleanKey) continue;
    if (unit === COOLDOWN_UNIT_TEN_DAY) {
      normalized[cleanKey] = clampNumber(value, 0, current + monthsToTurns(maxMonths), current);
      continue;
    }
    const parsed = Number(value);
    const legacyRemainingMonths = Number.isFinite(parsed)
      ? Math.max(0, Math.round(parsed) - current)
      : 0;
    normalized[cleanKey] = clampNumber(
      current + monthsToTurns(legacyRemainingMonths),
      0,
      current + monthsToTurns(maxMonths),
      current
    );
  }
  return normalized;
}

function formatTenDayDeadline(dueTurn, worldState) {
  if (dueTurn === null || dueTurn === undefined) return { turnsRemaining: null, deadlineLabel: "未定" };
  const remaining = Math.max(0, dueTurn - currentTurn(worldState));
  if (remaining === 0) {
    return { turnsRemaining: 0, deadlineLabel: `第${dueTurn}回，本旬须办` };
  }
  const months = Math.floor(remaining / TURNS_PER_MONTH);
  const periods = remaining % TURNS_PER_MONTH;
  const monthLabel = months > 0 && periods > 0
    ? `约${months}月又${periods}旬`
    : months > 0
      ? `约${months}月`
      : null;
  return {
    turnsRemaining: remaining,
    deadlineLabel: monthLabel
      ? `第${dueTurn}回，尚余${remaining}旬（${monthLabel}）`
      : `第${dueTurn}回，尚余${remaining}旬`
  };
}

function readRange(key, fallbackMin = Number.NEGATIVE_INFINITY, fallbackMax = Number.POSITIVE_INFINITY) {
  return NUMERIC_RANGES[key] || [fallbackMin, fallbackMax];
}

function readPlayerNumber(worldState, key, fallback) {
  const value = Number(worldState?.player?.[key]);
  const [min, max] = readRange(key);
  return clampNumber(value, min, max, fallback);
}

function shiftPlayer(worldState, key, delta) {
  const [min, max] = readRange(key);
  return clamp(readPlayerNumber(worldState, key, 0) + delta, min, max);
}

function readTopLevelNumber(worldState, key, fallback) {
  const value = Number(worldState?.[key]);
  const [min, max] = readRange(key);
  return clampNumber(value, min, max, fallback);
}

function normalizeHistoryEntry(raw) {
  if (!isPlainObject(raw)) return null;
  const type = OUTCOME_TYPES.has(raw.type) ? raw.type : null;
  const label = cleanText(raw.label, "");
  if (!type || !label) return null;

  return {
    id: cleanText(raw.id, `${type}-${raw.turn ?? 0}`, 96),
    type,
    label,
    status: raw.status === "pending" ? "pending" : "resolved",
    year: clampNumber(raw.year, 1, 9999, 1644),
    month: clampNumber(raw.month, 1, 12, 1),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, TURNS_PER_MONTH, 1),
    turn: clampNumber(raw.turn, 0, Number.MAX_SAFE_INTEGER, 0),
    officeTitleBefore: raw.officeTitleBefore === null
      ? null
      : cleanText(raw.officeTitleBefore, "", 80) || null,
    officeTitleAfter: raw.officeTitleAfter === null
      ? null
      : cleanText(raw.officeTitleAfter, "", 80) || null,
    reason: cleanText(raw.reason, label)
  };
}

function normalizeCooldowns(cooldowns, turn, unit) {
  return normalizeAbsoluteTurnMap(cooldowns, turn, unit, 40);
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function normalizeResolution(raw) {
  if (!isPlainObject(raw)) return null;
  const outcome = cleanText(raw.outcome, "", 40);
  const summary = cleanText(raw.summary, "", MAX_EVENT_TEXT_LENGTH);
  if (!outcome && !summary) return null;
  return {
    outcome: outcome || "记录",
    summary: summary || outcome,
    meritDelta: clampNumber(raw.meritDelta, -20, 20, 0),
    riskDelta: clampNumber(raw.riskDelta, -20, 20, 0),
    worldThreadHint: cleanText(raw.worldThreadHint, "", 80)
  };
}

function normalizeAssignment(raw, worldState) {
  if (!isPlainObject(raw)) return null;
  const turn = currentTurn(worldState);
  const kind = normalizeEnum(raw.kind, ASSIGNMENT_KINDS, "routine_office");
  const title = cleanText(raw.title, "", 80) || assignmentTitleForKind(kind);
  const inferredOffice = inferOfficeByTitle(raw.officeTitle || worldState?.player?.officeTitle || worldState?.officialCareer?.currentPosting);
  const bureauId = cleanText(raw.bureauId, "", 64) || inferredOffice?.bureauId || null;

  return {
    id: cleanText(raw.id, `ASG-${String(turn).padStart(4, "0")}-${kind}`, 96),
    title,
    kind,
    bureauId,
    sourceType: normalizeEnum(raw.sourceType, ASSIGNMENT_SOURCE_TYPES, "bureau"),
    sourceId: cleanText(raw.sourceId, "", 64) || bureauId || "official_office",
    status: normalizeEnum(raw.status, ASSIGNMENT_STATUSES, "active"),
    year: clampNumber(raw.year, 1, 9999, readTopLevelNumber(worldState, "year", 1644)),
    month: clampNumber(raw.month, 1, 12, readTopLevelNumber(worldState, "month", 1)),
    dueTurn: normalizeDueTurn(
      raw.dueTurn,
      worldState,
      DEFAULT_ASSIGNMENT_DEADLINE_MONTHS,
      MAX_ASSIGNMENT_DEADLINE_MONTHS,
      raw.deadlineUnit
    ),
    deadlineUnit: DEADLINE_UNIT_TEN_DAY,
    progress: clampNumber(raw.progress, 0, 100, 0),
    risk: clampNumber(raw.risk, 0, 100, 20),
    publicStake: clampNumber(raw.publicStake, 0, 100, 40),
    privatePressure: clampNumber(raw.privatePressure, 0, 100, 20),
    visibleSummary: cleanText(raw.visibleSummary, "", MAX_EVENT_TEXT_LENGTH) || `${title}尚在办理。`,
    hiddenNotes: normalizeTextArray(raw.hiddenNotes),
    relatedContacts: normalizeTextArray(raw.relatedContacts, 5, 64),
    relatedFactions: normalizeTextArray(raw.relatedFactions, 5, 64),
    resolution: normalizeResolution(raw.resolution)
  };
}

function normalizeAssignments(assignments, worldState) {
  if (!Array.isArray(assignments)) return [];
  return assignments
    .map((assignment) => normalizeAssignment(assignment, worldState))
    .filter(Boolean)
    .slice(-MAX_ASSIGNMENTS);
}

function normalizeAssessmentDossier(raw, worldState) {
  const source = isPlainObject(raw) ? raw : {};
  const turn = currentTurn(worldState);
  const year = readTopLevelNumber(worldState, "year", 1644);
  const playerMerit = readPlayerNumber(worldState, "performanceMerit", 0);
  const playerRisk = readPlayerNumber(worldState, "impeachmentRisk", 0);
  const pendingRecommendation = RECOMMENDATION_TYPES.has(source.pendingRecommendation)
    ? source.pendingRecommendation
    : null;

  return {
    cycleId: cleanText(source.cycleId, `${year}-career`, 64),
    meritScore: clampNumber(source.meritScore, 0, 100, playerMerit),
    riskScore: clampNumber(source.riskScore, 0, 100, playerRisk),
    lastUpdatedTurn: source.lastUpdatedTurn === null || source.lastUpdatedTurn === undefined
      ? null
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    notes: normalizeTextArray(source.notes, MAX_ASSESSMENT_NOTES),
    pendingRecommendation
  };
}

function normalizeImpeachmentProcedure(raw, worldState) {
  const source = isPlainObject(raw) ? raw : {};
  const turn = currentTurn(worldState);
  const stage = normalizeEnum(source.stage, IMPEACHMENT_STAGES, "none");
  return {
    stage,
    sourceType: cleanText(source.sourceType, "", 40) || null,
    sourceId: cleanText(source.sourceId, "", 64) || null,
    openedTurn: source.openedTurn === null || source.openedTurn === undefined
      ? null
      : clampNumber(source.openedTurn, 0, Number.MAX_SAFE_INTEGER, turn),
    dueTurn: source.dueTurn === null || source.dueTurn === undefined
      ? null
      : normalizeDueTurn(
        source.dueTurn,
        worldState,
        DEFAULT_IMPEACHMENT_DEADLINE_MONTHS,
        MAX_IMPEACHMENT_DEADLINE_MONTHS,
        source.deadlineUnit
      ),
    deadlineUnit: DEADLINE_UNIT_TEN_DAY,
    risk: clampNumber(source.risk, 0, 100, readPlayerNumber(worldState, "impeachmentRisk", 0)),
    visibleNotice: cleanText(source.visibleNotice, "", MAX_EVENT_TEXT_LENGTH),
    hiddenNotes: normalizeTextArray(source.hiddenNotes),
    lastUpdatedTurn: source.lastUpdatedTurn === null || source.lastUpdatedTurn === undefined
      ? null
      : clampNumber(source.lastUpdatedTurn, 0, Number.MAX_SAFE_INTEGER, turn)
  };
}

function assignmentTitleForKind(kind) {
  const titles = {
    relief: "赈务核销",
    land_survey: "清丈田亩",
    case_review: "案牍复核",
    riverworks: "河工督修",
    military_supply: "军需核算",
    salt_transport: "盐漕核算",
    exam_supervision: "科场监临",
    memorial_drafting: "奏疏文案",
    audit: "弹章查核",
    personnel_review: "考成复核",
    routine_office: "署中常务"
  };
  return titles[kind] || "署中差遣";
}

function inferBureauId(worldState, source = {}) {
  const title = worldState?.player?.officeTitle || source.currentPosting || worldState?.player?.position;
  const office = inferOfficeByTitle(title);
  if (office?.bureauId) return office.bureauId;
  return cleanText(source.bureauId, "", 64) || null;
}

function getCurrentPosting(worldState, source = {}) {
  if (worldState?.player?.role === "official" && worldState?.player?.officeTitle) {
    return worldState.player.officeTitle;
  }
  const sourcePosting = cleanText(source.currentPosting, "", 80);
  if (sourcePosting) {
    return sourcePosting;
  }
  return worldState?.player?.officeTitle || worldState?.player?.position || "未授";
}

function normalizeOfficialCareerState(worldState = {}) {
  const source = isPlainObject(worldState.officialCareer) ? worldState.officialCareer : {};
  const turn = currentTurn(worldState);
  const history = Array.isArray(source.careerHistory)
    ? source.careerHistory.map(normalizeHistoryEntry).filter(Boolean).slice(-MAX_CAREER_HISTORY)
    : [];
  const currentPosting = getCurrentPosting(worldState, source);
  const bureauId = inferBureauId(worldState, { ...source, currentPosting });
  const normalizationContext = {
    ...worldState,
    officialCareer: {
      ...source,
      currentPosting,
      bureauId
    }
  };

  return {
    schemaVersion: OFFICIAL_CAREER_SCHEMA_VERSION,
    tenureMonths: clampNumber(source.tenureMonths, 0, 600, 0),
    reviewCycleMonths: clampNumber(source.reviewCycleMonths, 6, 36, DEFAULT_REVIEW_CYCLE_MONTHS),
    lastReviewTurn: source.lastReviewTurn === null || source.lastReviewTurn === undefined
      ? null
      : clampNumber(source.lastReviewTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    lastReviewYear: source.lastReviewYear === null || source.lastReviewYear === undefined
      ? null
      : clampNumber(source.lastReviewYear, 1, 9999, readTopLevelNumber(worldState, "year", 1644)),
    currentPosting,
    bureauId,
    careerHistory: history,
    pendingOutcome: normalizeHistoryEntry(source.pendingOutcome) || null,
    cooldowns: normalizeCooldowns(source.cooldowns, turn, source.cooldownUnit),
    cooldownUnit: COOLDOWN_UNIT_TEN_DAY,
    assignments: normalizeAssignments(source.assignments, normalizationContext),
    assessmentDossier: normalizeAssessmentDossier(source.assessmentDossier, worldState),
    impeachmentProcedure: normalizeImpeachmentProcedure(source.impeachmentProcedure, worldState)
  };
}

function ensureOfficialCareerState(worldState) {
  if (!isPlainObject(worldState)) return worldState;
  worldState.officialCareer = normalizeOfficialCareerState(worldState);
  return worldState;
}

function getPostingIndex(title) {
  const normalized = cleanText(title, "", 80);
  if (!normalized) return -1;
  const ladder = getOfficeLadder().map((office) => office.title);
  const exact = ladder.indexOf(normalized);
  if (exact >= 0) return exact;
  return ladder.findIndex((posting) => normalized.includes(posting) || posting.includes(normalized));
}

function nextPosting(title) {
  const candidate = listPromotionCandidates(title, { limit: 1 })[0];
  if (candidate?.title) return candidate.title;
  const ladder = getOfficeLadder().map((office) => office.title);
  const index = getPostingIndex(title);
  return ladder[Math.min(ladder.length - 1, Math.max(0, index) + 1)] || "六部观政进士";
}

function previousPosting(title) {
  const ladder = getOfficeLadder().map((office) => office.title);
  const index = getPostingIndex(title);
  return ladder[Math.max(0, index <= 0 ? 0 : index - 1)] || "六部观政进士";
}

function pickIndexedPosting(candidates, worldState, fallback = "六部观政进士") {
  const list = candidates.map((office) => office.title || office).filter(Boolean);
  if (!list.length) return fallback;
  const index = Math.abs((readTopLevelNumber(worldState, "year", 1644) + currentTurn(worldState))) % list.length;
  return list[index];
}

function readLedgerScore(worldState, targetType, targetId) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const bucket = targetType === "character" ? ledger.characters : ledger.factions;
  const entry = bucket[targetId];
  if (!entry || entry.visible === false) return 0;
  return clampNumber(entry.relationship, -100, 100, 0);
}

function calculateCareerScores(worldState = {}) {
  const career = normalizeOfficialCareerState(worldState);
  const superiorFavor = readPlayerNumber(worldState, "superiorFavor", 0);
  const peerNetwork = readPlayerNumber(worldState, "peerNetwork", 0);
  const performanceMerit = readPlayerNumber(worldState, "performanceMerit", 0);
  const promotionProspect = readPlayerNumber(worldState, "promotionProspect", 0);
  const cleanReputation = readPlayerNumber(worldState, "cleanReputation", 0);
  const influence = readPlayerNumber(worldState, "influence", 0);
  const impeachmentRisk = readPlayerNumber(worldState, "impeachmentRisk", 0);
  const integrity = readPlayerNumber(worldState, "integrity", 60);
  const corruption = readTopLevelNumber(worldState, "corruption", 60);
  const superiorRelationship = readLedgerScore(worldState, "character", "C01");
  const scholarOfficialRelationship = readLedgerScore(worldState, "faction", "scholarOfficials");
  const relationshipBoost = Math.round((superiorRelationship + scholarOfficialRelationship) / 10);
  const activeAssignments = career.assignments.filter((assignment) => assignment.status === "active" || assignment.status === "submitted");
  const assignmentMeritBoost = activeAssignments.length
    ? Math.round(activeAssignments.reduce((sum, assignment) => sum + assignment.progress - assignment.risk * 0.35, 0) / activeAssignments.length / 10)
    : 0;
  const assignmentRiskBoost = activeAssignments.length
    ? Math.round(activeAssignments.reduce((sum, assignment) => sum + assignment.risk + assignment.privatePressure * 0.35, 0) / activeAssignments.length / 12)
    : 0;
  const procedureRiskBoost = career.impeachmentProcedure.stage === "none"
    ? 0
    : Math.round(career.impeachmentProcedure.risk / 9);

  const careerScore = clampNumber(
    superiorFavor * 0.22 +
    peerNetwork * 0.14 +
    performanceMerit * 0.28 +
    promotionProspect * 0.22 +
    cleanReputation * 0.08 +
    influence * 0.06 +
    relationshipBoost +
    assignmentMeritBoost,
    0,
    100,
    0
  );

  const riskScore = clampNumber(
    impeachmentRisk * 0.55 +
    (100 - cleanReputation) * 0.2 +
    (100 - integrity) * 0.15 +
    corruption * 0.1 +
    assignmentRiskBoost +
    procedureRiskBoost,
    0,
    100,
    0
  );

  return {
    careerScore,
    riskScore,
    superiorFavor,
    peerNetwork,
    performanceMerit,
    promotionProspect,
    cleanReputation,
    impeachmentRisk,
    integrity,
    corruption
  };
}

function getReviewReason(worldState, career, scores, nextTenureMonths) {
  if (worldState?.player?.role !== "official") return null;
  if (!worldState.player.officeTitle) return "appointment";
  if (scores.impeachmentRisk >= 88 || scores.riskScore >= 74) return "risk_review";
  if (
    scores.promotionProspect >= 84 &&
    scores.performanceMerit >= 68 &&
    scores.superiorFavor >= 58
  ) return "accelerated_review";
  if (
    nextTenureMonths >= career.reviewCycleMonths &&
    nextTenureMonths % career.reviewCycleMonths === 0 &&
    career.lastReviewTurn !== currentTurn(worldState)
  ) return "cycle_review";
  if (
    readTopLevelNumber(worldState, "month", 1) === 1 &&
    career.lastReviewYear !== readTopLevelNumber(worldState, "year", 1644) &&
    currentTurn(worldState) > 0
  ) return "annual_review";
  return null;
}

function classifyOfficialCareerOutcome(worldState, reason, scores) {
  const player = worldState.player || {};
  if (reason === "appointment") {
    return {
      type: "appointment",
      label: "实授",
      officeTitleAfter: player.palaceRank === "一甲" ? "翰林院编修" : "六部观政进士",
      reason: "候选观政期满，吏部具题实授，正式转入官场履历。"
    };
  }

  if (
    (scores.impeachmentRisk >= 96 || scores.riskScore >= 88) &&
    (scores.cleanReputation <= 38 || scores.integrity <= 42 || scores.corruption >= 88)
  ) {
    return {
      type: "punishment",
      label: "罚黜",
      officeTitleAfter: null,
      reason: "弹劾与稽核互相印证，清议难解，吏部按例罢黜听候。"
    };
  }

  if (scores.impeachmentRisk >= 88 || scores.riskScore >= 74) {
    return {
      type: "impeachment",
      label: "弹劾成案",
      officeTitleAfter: "候勘官员",
      reason: "台谏弹章成案，虽未即革职，升迁之路暂被封驳。"
    };
  }

  if (scores.careerScore >= 76 && scores.riskScore <= 64 && scores.performanceMerit >= 68) {
    return {
      type: "promotion",
      label: "升迁",
      officeTitleAfter: nextPosting(player.officeTitle || player.position),
      reason: "考成、上官与同年声气相合，吏部推为可用之员。"
    };
  }

  if (scores.performanceMerit <= 26 || scores.superiorFavor <= 24) {
    return {
      type: "demotion",
      label: "降调",
      officeTitleAfter: previousPosting(player.officeTitle || player.position),
      reason: "考成疲弱且上官保荐不足，部议降调以观后效。"
    };
  }

  if (scores.promotionProspect >= 62 && scores.cleanReputation >= 62 && readTopLevelNumber(worldState, "publicOrder", 70) <= 52) {
    return {
      type: "outpost",
      label: "外放",
      officeTitleAfter: pickIndexedPosting(listOutpostCandidates(player.officeTitle || player.position), worldState, "知县"),
      reason: "朝中认为清望尚可，宜外放地方以试实际抚治。"
    };
  }

  if (scores.promotionProspect >= 54 || scores.peerNetwork >= 55) {
    return {
      type: "transfer",
      label: "转任",
      officeTitleAfter: pickIndexedPosting(listTransferCandidates(player.officeTitle || player.position), worldState, "户部主事"),
      reason: "同年与部曹互相递话，调任他署以拓公事资历。"
    };
  }

  return {
    type: "retention",
    label: "留任",
    officeTitleAfter: player.officeTitle || player.position || "候选观政",
    reason: "本期功过未至升降，仍留原任，待后续考成。"
  };
}

function buildPlayerPatch(worldState, outcome) {
  const player = worldState.player || {};
  const patch = {};

  if (outcome.type === "appointment") {
    Object.assign(patch, {
      role: "official",
      roleLabel: OFFICIAL_ROLE_LABEL,
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      influence: shiftPlayer(worldState, "influence", 4),
      performanceMerit: shiftPlayer(worldState, "performanceMerit", 6),
      promotionProspect: shiftPlayer(worldState, "promotionProspect", 8),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", -2)
    });
  } else if (outcome.type === "promotion") {
    Object.assign(patch, {
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      influence: shiftPlayer(worldState, "influence", 8),
      reputation: shiftPlayer(worldState, "reputation", 4),
      performanceMerit: Math.max(48, shiftPlayer(worldState, "performanceMerit", -12)),
      promotionProspect: Math.max(42, shiftPlayer(worldState, "promotionProspect", -28)),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", 5)
    });
  } else if (outcome.type === "transfer") {
    Object.assign(patch, {
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      peerNetwork: shiftPlayer(worldState, "peerNetwork", 3),
      performanceMerit: Math.max(42, shiftPlayer(worldState, "performanceMerit", -5)),
      promotionProspect: Math.max(36, shiftPlayer(worldState, "promotionProspect", -12)),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", -4)
    });
  } else if (outcome.type === "outpost") {
    Object.assign(patch, {
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      faction: "外任清流",
      influence: shiftPlayer(worldState, "influence", 3),
      performanceMerit: Math.max(40, shiftPlayer(worldState, "performanceMerit", -8)),
      promotionProspect: Math.max(38, shiftPlayer(worldState, "promotionProspect", -14)),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", -5)
    });
  } else if (outcome.type === "demotion") {
    Object.assign(patch, {
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      influence: shiftPlayer(worldState, "influence", -6),
      reputation: shiftPlayer(worldState, "reputation", -3),
      superiorFavor: shiftPlayer(worldState, "superiorFavor", -5),
      performanceMerit: Math.min(34, shiftPlayer(worldState, "performanceMerit", 2)),
      promotionProspect: Math.min(28, shiftPlayer(worldState, "promotionProspect", -18)),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", -8)
    });
  } else if (outcome.type === "impeachment") {
    Object.assign(patch, {
      officeTitle: outcome.officeTitleAfter,
      position: outcome.officeTitleAfter,
      influence: shiftPlayer(worldState, "influence", -10),
      reputation: shiftPlayer(worldState, "reputation", -8),
      mentality: shiftPlayer(worldState, "mentality", -3),
      superiorFavor: shiftPlayer(worldState, "superiorFavor", -10),
      performanceMerit: Math.min(30, shiftPlayer(worldState, "performanceMerit", -16)),
      promotionProspect: Math.min(12, shiftPlayer(worldState, "promotionProspect", -40)),
      impeachmentRisk: Math.min(52, shiftPlayer(worldState, "impeachmentRisk", -32)),
      cleanReputation: shiftPlayer(worldState, "cleanReputation", -6)
    });
  } else if (outcome.type === "punishment") {
    Object.assign(patch, {
      role: "scholar",
      roleLabel: SCHOLAR_ROLE_LABEL,
      officeTitle: null,
      position: "革职闲居",
      faction: "士林",
      influence: 0,
      reputation: shiftPlayer(worldState, "reputation", -15),
      mentality: shiftPlayer(worldState, "mentality", -6),
      superiorFavor: 0,
      peerNetwork: Math.max(0, readPlayerNumber(worldState, "peerNetwork", 0) - 30),
      performanceMerit: 0,
      promotionProspect: 0,
      impeachmentRisk: 0,
      cleanReputation: shiftPlayer(worldState, "cleanReputation", -20)
    });
  } else if (outcome.type === "retention") {
    Object.assign(patch, {
      officeTitle: player.officeTitle || outcome.officeTitleAfter,
      position: player.officeTitle || outcome.officeTitleAfter,
      performanceMerit: shiftPlayer(worldState, "performanceMerit", 1),
      promotionProspect: shiftPlayer(worldState, "promotionProspect", 1),
      impeachmentRisk: shiftPlayer(worldState, "impeachmentRisk", -2)
    });
  }

  return patch;
}

function readPath(state, path) {
  if (path.startsWith("player.")) return state?.player?.[path.slice("player.".length)];
  return state?.[path];
}

function buildAttributeChanges(beforeState, statePatch) {
  const changes = [];
  for (const [key, after] of Object.entries(statePatch.player || {})) {
    const before = readPath(beforeState, `player.${key}`);
    if (typeof before !== "number" || typeof after !== "number" || before === after) continue;
    changes.push({
      path: `player.${key}`,
      label: ATTRIBUTE_LABELS[`player.${key}`] || key,
      before,
      after,
      reason: "官场结算"
    });
  }
  return changes;
}

function buildRelationshipChanges(worldState, outcome) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const changes = [];

  function push(targetType, targetId, config) {
    const bucket = targetType === "character" ? ledger.characters : ledger.factions;
    if (!bucket[targetId] || bucket[targetId].visible === false) return;
    changes.push({
      targetType,
      targetId,
      relationshipDelta: config.relationshipDelta,
      resentmentDelta: config.resentmentDelta,
      stance: config.stance,
      recentIntent: config.recentIntent,
      reason: config.reason
    });
  }

  if (outcome.type === "promotion" || outcome.type === "appointment") {
    push("character", "C01", {
      relationshipDelta: 3,
      resentmentDelta: -1,
      stance: "保举有功",
      recentIntent: "继续观察玩家能否守住新任。",
      reason: "Official career outcome improved superior confidence."
    });
    push("faction", "scholarOfficials", {
      relationshipDelta: 2,
      resentmentDelta: 0,
      stance: "清议推重",
      recentIntent: "把玩家视作可用的新进官员。",
      reason: "Official career outcome increased scholar-official approval."
    });
  } else if (outcome.type === "demotion" || outcome.type === "impeachment" || outcome.type === "punishment") {
    push("character", "C01", {
      relationshipDelta: -3,
      resentmentDelta: 4,
      stance: "弹章牵连",
      recentIntent: "与玩家保持距离以免受累。",
      reason: "Official career setback damaged superior confidence."
    });
    push("faction", "scholarOfficials", {
      relationshipDelta: -2,
      resentmentDelta: 2,
      stance: "清议疑惧",
      recentIntent: "等待后续勘问结果。",
      reason: "Official career setback hurt scholar-official standing."
    });
  } else if (outcome.type === "outpost" || outcome.type === "transfer") {
    push("faction", "scholarOfficials", {
      relationshipDelta: 1,
      resentmentDelta: -1,
      stance: "观其后效",
      recentIntent: "看玩家在新署能否办成实事。",
      reason: "Official career transfer kept the player inside bureaucratic attention."
    });
  }

  return changes;
}

function createHistoryEntry(worldState, career, outcome) {
  const turn = currentTurn(worldState);
  const officeTitleBefore = worldState.player?.officeTitle || career.currentPosting || null;
  return {
    id: `OC-${String(turn).padStart(4, "0")}-${outcome.type}`,
    type: outcome.type,
    label: outcome.label,
    status: "resolved",
    year: readTopLevelNumber(worldState, "year", 1644),
    month: readTopLevelNumber(worldState, "month", 1),
    tenDayPeriod: readTopLevelNumber(worldState, "tenDayPeriod", 1),
    turn,
    officeTitleBefore,
    officeTitleAfter: outcome.officeTitleAfter ?? null,
    reason: outcome.reason
  };
}

function classifyOfficialAction(input = "") {
  const text = cleanText(input, "", 240);
  if (!text) return null;

  if (/丁忧|守制|奔丧/.test(text)) {
    return {
      type: "mourning_leave",
      kind: "personnel_review",
      title: "丁忧去留具报",
      bureauId: "ministry_personnel",
      progressDelta: 20,
      riskDelta: 4,
      recommendation: "mourning_leave",
      note: "丁忧奏报会暂停仕途节奏，保留清望也可能错失官缺。"
    };
  }

  if (/起复|复官|召回|复任/.test(text)) {
    return {
      type: "restoration",
      kind: "personnel_review",
      title: "起复候议",
      bureauId: "ministry_personnel",
      progressDelta: 24,
      riskDelta: -3,
      recommendation: "restoration",
      note: "起复须有上官保结与旧案清楚，不能由一封来函即定。"
    };
  }

  // 官署首月面板的草稿会引用差事标题；先按标题关键词归入同一 kind，
  // 避免通用“考成/奏疏”文案把服务器差遣推进错分。
  if (/馆课|试艺|散馆|馆阁|制诰|修史|讲章/.test(text)) {
    return {
      type: "assignment",
      kind: "memorial_drafting",
      title: "馆阁文案",
      bureauId: "hanlin_academy",
      progressDelta: 18,
      riskDelta: 3,
      note: "馆阁文案先入回署稿，章法、避讳和上官问答都会影响清望。"
    };
  }

  if (/候缺|观政日课|初授履历|履历|日课|补缺|缺额|部议/.test(text)) {
    return {
      type: "assessment",
      kind: "personnel_review",
      title: "观政履历",
      bureauId: "ministry_personnel",
      progressDelta: 20,
      riskDelta: -1,
      recommendation: /补缺|缺额/.test(text) ? "appointment_review" : null,
      note: "观政履历只作为部议凭据，不能绕过吏部裁决或直接得缺。"
    };
  }

  if (/清册|点收|部曹|文移|交接|经手吏员/.test(text)) {
    return {
      type: "assignment",
      kind: "routine_office",
      title: "清册点收",
      bureauId: "ministry_personnel",
      progressDelta: 20,
      riskDelta: 2,
      note: "清册点收重在文移、缺页和交接时限，进度只进入本职差事与考成凭据。"
    };
  }

  if (/册籍|民情初访|访查民情|民情|户籍|士绅/.test(text)) {
    return {
      type: "assignment",
      kind: "land_survey",
      title: "册籍民情初访",
      bureauId: "ministry_personnel",
      progressDelta: 20,
      riskDelta: 7,
      note: "册籍民情只能形成公开查核线索，地方功过仍由服务器按后续差事裁决。"
    };
  }

  if (/弹劾|参劾|纠举|御史|贪官|贪墨官|劾奏|奏劾|查参|查账/.test(text)) {
    return {
      type: "impeachment",
      kind: "audit",
      title: "弹章查核",
      bureauId: "censorate",
      progressDelta: 26,
      riskDelta: 14,
      procedureStage: "memorial_filed",
      note: "弹章入台，清议与反噬会同时累积。"
    };
  }

  if (/考成|考绩|磨勘|铨选|荐举|升迁|迁转|功过|吏部|廷推/.test(text)) {
    return {
      type: "assessment",
      kind: "personnel_review",
      title: "考成复核",
      bureauId: "ministry_personnel",
      progressDelta: 22,
      riskDelta: -2,
      recommendation: /廷推|荐举|升迁/.test(text) ? "court_nomination" : null,
      note: "考成材料入卷，只能增加部议凭据，不能直接改官。"
    };
  }

  if (/赈济|赈灾|赈银|荒政|灾/.test(text)) {
    return {
      type: "assignment",
      kind: "relief",
      title: "赈银核销",
      bureauId: "ministry_revenue",
      progressDelta: 24,
      riskDelta: 8,
      note: "赈务牵连钱粮、民心和亏空，功过都会进入考成。"
    };
  }

  if (/清丈|田亩|地亩|鱼鳞册|赋役/.test(text)) {
    return {
      type: "assignment",
      kind: "land_survey",
      title: "清丈田亩",
      bureauId: "ministry_revenue",
      progressDelta: 22,
      riskDelta: 10,
      note: "清丈会触动士绅与税粮旧弊。"
    };
  }

  if (/断案|审案|平讼|疑狱|刑名|狱/.test(text)) {
    return {
      type: "assignment",
      kind: "case_review",
      title: "案牍复核",
      bureauId: "ministry_justice",
      progressDelta: 25,
      riskDelta: 6,
      note: "刑名差事重在旧例、供词与民情兼顾。"
    };
  }

  if (/河工|河堤|水利|修渠|工料/.test(text)) {
    return {
      type: "assignment",
      kind: "riverworks",
      title: "河工督修",
      bureauId: "ministry_works",
      progressDelta: 24,
      riskDelta: 9,
      note: "河工既耗钱粮，也最易暴露工料弊端。"
    };
  }

  if (/军需|边饷|兵饷|军粮|战报|边报/.test(text)) {
    return {
      type: "assignment",
      kind: "military_supply",
      title: "军需核算",
      bureauId: "ministry_war",
      progressDelta: 22,
      riskDelta: 9,
      note: "军需差事牵连边镇、饷银和战报虚实。"
    };
  }

  if (/盐漕|漕运|盐课|运河|仓场/.test(text)) {
    return {
      type: "assignment",
      kind: "salt_transport",
      title: "盐漕核算",
      bureauId: "ministry_revenue",
      progressDelta: 22,
      riskDelta: 11,
      note: "盐漕一线有大利，也有大弊。"
    };
  }

  if (/科场|监临|礼部|乡试|会试/.test(text)) {
    return {
      type: "assignment",
      kind: "exam_supervision",
      title: "科场监临",
      bureauId: "ministry_rites",
      progressDelta: 20,
      riskDelta: 5,
      note: "科场差事关乎士林清议。"
    };
  }

  if (/奏疏|上疏|条陈|封事|文书|制诰|修史|讲章/.test(text)) {
    return {
      type: "memorial",
      kind: "memorial_drafting",
      title: "奏疏文案",
      bureauId: "hanlin_academy",
      progressDelta: 18,
      riskDelta: 3,
      note: "奏疏文案能累积清望，也会暴露立场。"
    };
  }

  if (/调任|转任|迁调/.test(text)) {
    return {
      type: "transfer_request",
      kind: "personnel_review",
      title: "迁转呈议",
      bureauId: "ministry_personnel",
      progressDelta: 18,
      riskDelta: 2,
      recommendation: "transfer",
      note: "迁转呈议只入部议，不直接授官。"
    };
  }

  if (/外放|出守|知县|知府|地方/.test(text)) {
    return {
      type: "outpost_request",
      kind: "personnel_review",
      title: "外放呈议",
      bureauId: "ministry_personnel",
      progressDelta: 18,
      riskDelta: 2,
      recommendation: "outpost",
      note: "外放需看官缺、清望与地方风险。"
    };
  }

  return null;
}

function findMatchingAssignment(assignments, action) {
  return assignments.find((assignment) =>
    assignment.kind === action.kind &&
    (assignment.status === "active" || assignment.status === "submitted")
  );
}

function createAssignment(worldState, action) {
  const turn = currentTurn(worldState);
  const progress = clampNumber(action.progressDelta, 0, 100, 18);
  const risk = clampNumber(20 + action.riskDelta, 0, 100, 22);
  return normalizeAssignment({
    id: `ASG-${String(turn).padStart(4, "0")}-${action.kind}`,
    title: action.title,
    kind: action.kind,
    bureauId: action.bureauId,
    sourceType: action.type === "impeachment" ? "censor" : "bureau",
    sourceId: action.bureauId,
    status: progress >= 80 ? "submitted" : "active",
    year: readTopLevelNumber(worldState, "year", 1644),
    month: readTopLevelNumber(worldState, "month", 1),
    dueTurn: deadlineTurnFromMonths(worldState, DEFAULT_ASSIGNMENT_DEADLINE_MONTHS),
    deadlineUnit: DEADLINE_UNIT_TEN_DAY,
    progress,
    risk,
    publicStake: action.type === "impeachment" ? 55 : 45,
    privatePressure: action.type === "impeachment" ? 45 : 25,
    visibleSummary: action.note
  }, worldState);
}

function updateAssignments(worldState, assignments, action) {
  if (!action?.kind) return { assignments, event: null, assignment: null };
  const nextAssignments = assignments.map((assignment) => ({ ...assignment }));
  let assignment = findMatchingAssignment(nextAssignments, action);
  if (!assignment) {
    assignment = createAssignment(worldState, action);
    nextAssignments.push(assignment);
  } else {
    assignment.progress = clampNumber(assignment.progress + action.progressDelta, 0, 100, assignment.progress);
    assignment.risk = clampNumber(assignment.risk + action.riskDelta, 0, 100, assignment.risk);
    assignment.privatePressure = clampNumber(assignment.privatePressure + Math.max(0, action.riskDelta), 0, 100, assignment.privatePressure);
    assignment.visibleSummary = action.note || assignment.visibleSummary;
    if (assignment.progress >= 85) assignment.status = "submitted";
  }

  return {
    assignments: nextAssignments.slice(-MAX_ASSIGNMENTS),
    event: `[官场差遣] ${assignment.title}：${assignment.visibleSummary}`,
    assignment
  };
}

function updateAssessmentDossier(worldState, dossier, action, assignment) {
  if (!action) return dossier;
  const turn = currentTurn(worldState);
  const meritDelta = action.type === "impeachment" ? 3 : Math.max(1, Math.round((action.progressDelta || 0) / 5));
  const riskDelta = Math.max(-5, Math.min(10, action.riskDelta || 0));
  const baseMerit = Math.max(dossier.meritScore, readPlayerNumber(worldState, "performanceMerit", 0));
  const baseRisk = Math.max(dossier.riskScore, readPlayerNumber(worldState, "impeachmentRisk", 0));
  const note = assignment
    ? `${assignment.title}进度${assignment.progress}，风险${assignment.risk}。`
    : action.note;
  return normalizeAssessmentDossier({
    ...dossier,
    meritScore: baseMerit + meritDelta,
    riskScore: baseRisk + riskDelta,
    lastUpdatedTurn: turn,
    notes: [note, ...(dossier.notes || [])].filter(Boolean).slice(0, MAX_ASSESSMENT_NOTES),
    pendingRecommendation: action.recommendation || dossier.pendingRecommendation
  }, worldState);
}

function nextImpeachmentStage(currentStage, action) {
  if (action?.procedureStage) {
    if (currentStage === "none") return "risk_watch";
    if (currentStage === "risk_watch") return action.procedureStage;
    if (currentStage === "memorial_filed") return "audit_open";
    return currentStage;
  }
  return currentStage;
}

function updateImpeachmentProcedure(worldState, procedure, action) {
  const risk = readPlayerNumber(worldState, "impeachmentRisk", 0);
  if (!action && risk < 70 && procedure.stage === "none") return procedure;
  const turn = currentTurn(worldState);
  const stage = action?.type === "impeachment"
    ? nextImpeachmentStage(procedure.stage, action)
    : (risk >= 70 && procedure.stage === "none" ? "risk_watch" : procedure.stage);
  if (stage === procedure.stage && !action) return procedure;

  const visibleNotice = action?.type === "impeachment"
    ? "台谏弹章已有风声，查核未定。"
    : "清议间已有弹劾风闻。";
  return normalizeImpeachmentProcedure({
    ...procedure,
    stage,
    sourceType: action?.type === "impeachment" ? "censor" : procedure.sourceType,
    sourceId: action?.type === "impeachment" ? "censorate" : procedure.sourceId,
    openedTurn: procedure.openedTurn ?? turn,
    dueTurn: procedure.dueTurn ?? deadlineTurnFromMonths(worldState, DEFAULT_IMPEACHMENT_DEADLINE_MONTHS),
    deadlineUnit: DEADLINE_UNIT_TEN_DAY,
    risk: risk + (action?.riskDelta || 0),
    visibleNotice,
    hiddenNotes: [
      action?.note,
      ...(procedure.hiddenNotes || [])
    ].filter(Boolean).slice(0, MAX_HIDDEN_NOTES),
    lastUpdatedTurn: turn
  }, worldState);
}

function applyOutcomeToDomainState(worldState, career, outcome, historyEntry) {
  const office = inferOfficeByTitle(historyEntry.officeTitleAfter || outcome.officeTitleAfter || historyEntry.officeTitleBefore);
  const next = {
    ...career,
    bureauId: office?.bureauId || career.bureauId
  };

  if (outcome.type === "promotion" || outcome.type === "transfer" || outcome.type === "outpost" || outcome.type === "appointment") {
    next.assessmentDossier = normalizeAssessmentDossier({
      ...career.assessmentDossier,
      meritScore: Math.max(40, career.assessmentDossier.meritScore - 16),
      riskScore: Math.max(0, career.assessmentDossier.riskScore - 4),
      pendingRecommendation: null,
      notes: [`${outcome.label}已入履历：${historyEntry.officeTitleAfter || "无官"}`, ...career.assessmentDossier.notes].slice(0, MAX_ASSESSMENT_NOTES),
      lastUpdatedTurn: currentTurn(worldState)
    }, worldState);
  }

  if (outcome.type === "impeachment") {
    next.impeachmentProcedure = normalizeImpeachmentProcedure({
      ...career.impeachmentProcedure,
      stage: "discipline_pending",
      risk: Math.max(career.impeachmentProcedure.risk, 70),
      visibleNotice: "弹劾成案，部议候勘。",
      lastUpdatedTurn: currentTurn(worldState)
    }, worldState);
  } else if (outcome.type === "punishment" || outcome.type === "retention" || outcome.type === "demotion") {
    next.impeachmentProcedure = normalizeImpeachmentProcedure({
      ...career.impeachmentProcedure,
      stage: outcome.type === "punishment" ? "resolved" : career.impeachmentProcedure.stage,
      visibleNotice: outcome.type === "punishment" ? "处分已定。" : career.impeachmentProcedure.visibleNotice,
      lastUpdatedTurn: currentTurn(worldState)
    }, worldState);
  }

  return next;
}

function buildOfficialNetworkSummary(worldState) {
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const visibleCharacters = Object.values(ledger.characters || {}).filter((entry) => entry.visible !== false);
  const visibleFactions = Object.values(ledger.factions || {}).filter((entry) => entry.visible !== false);
  const playerConnections = Array.isArray(worldState?.player?.connections) ? worldState.player.connections : [];
  const sameYears = visibleCharacters.filter((entry) =>
    /同年|同榜|翰林|同僚/.test(`${entry.name || ""}${entry.role || ""}${entry.networkSource || ""}`)
  ).length + playerConnections.filter((entry) => /同年|同榜|翰林/.test(entry)).length;
  const superiors = visibleCharacters.filter((entry) =>
    /上官|给事|侍郎|尚书|督抚|司官/.test(`${entry.name || ""}${entry.role || ""}${entry.networkSource || ""}`)
  ).length;
  const rivals = visibleCharacters.filter((entry) =>
    entry.resentment >= 25 || /政敌|弹劾|台谏|攻讦/.test(`${entry.stance || ""}${entry.recentIntent || ""}${entry.note || ""}`)
  ).length;
  const censors = visibleCharacters.filter((entry) =>
    /御史|台谏|风宪|察院/.test(`${entry.name || ""}${entry.role || ""}${entry.networkSource || ""}`)
  ).length + visibleFactions.filter((entry) => /都察|台谏|士大夫/.test(`${entry.name || ""}${entry.id || ""}`)).length;
  const hiddenNotice = [
    ...Object.values(ledger.characters || {}),
    ...Object.values(ledger.factions || {})
  ].some((entry) => entry.visible === false);

  return {
    superiors,
    sameYears,
    rivals,
    censors,
    hiddenNotice
  };
}

function buildOfficialCareerView(worldState = {}) {
  const career = normalizeOfficialCareerState(worldState);
  const player = worldState.player || {};
  const active = player.role === "official";
  const latest = career.careerHistory.at(-1) || null;
  const scores = active ? calculateCareerScores(worldState) : { careerScore: 0, riskScore: 0 };
  const reviewCycleMonths = career.reviewCycleMonths || DEFAULT_REVIEW_CYCLE_MONTHS;
  const monthsIntoCycle = active ? career.tenureMonths % reviewCycleMonths : 0;
  const nextReviewInMonths = active ? Math.max(0, reviewCycleMonths - monthsIntoCycle) : null;
  const posting = active
    ? player.officeTitle || player.position || career.currentPosting || "候选观政"
    : null;
  const office = active ? inferOfficeByTitle(posting) : null;
  const officeSummary = active ? summarizeOfficeForPlayer(posting) : null;
  const activeAssignments = career.assignments.filter((assignment) => assignment.status === "active" || assignment.status === "submitted");
  const urgentAssignments = activeAssignments.filter((assignment) => assignment.dueTurn <= currentTurn(worldState) + 1);
  const firstMonthExperience = buildOfficialFirstMonthExperienceView(worldState, career);

  return {
    schemaVersion: OFFICIAL_CAREER_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active,
    currentPosting: posting,
    bureau: active && (office || officeSummary)
      ? {
        id: office?.bureauId || career.bureauId || null,
        name: officeSummary?.bureau || office?.bureauName || "未明衙门",
        officeTitle: officeSummary?.title || posting,
        duties: officeSummary?.duties || office?.duties || [],
        summary: officeSummary?.text || ""
      }
      : null,
    tenureMonths: active ? career.tenureMonths : 0,
    reviewCycleMonths,
    nextReviewInMonths: active && nextReviewInMonths === reviewCycleMonths ? reviewCycleMonths : nextReviewInMonths,
    careerScore: scores.careerScore,
    riskScore: scores.riskScore,
    assignmentSummary: active
      ? {
        activeCount: activeAssignments.length,
        urgentCount: urgentAssignments.length,
        latestTitle: activeAssignments.at(-1)?.title || null
      }
      : null,
    firstMonthExperience,
    assignments: active
      ? activeAssignments.map((assignment) => {
        const deadline = formatTenDayDeadline(assignment.dueTurn, worldState);
        return {
          id: assignment.id,
          title: assignment.title,
          kind: assignment.kind,
          bureauId: assignment.bureauId,
          status: assignment.status,
          dueTurn: assignment.dueTurn,
          deadlineUnit: assignment.deadlineUnit,
          turnsRemaining: deadline.turnsRemaining,
          deadlineLabel: deadline.deadlineLabel,
          progress: assignment.progress,
          risk: assignment.risk,
          publicStake: assignment.publicStake,
          privatePressure: assignment.privatePressure,
          visibleSummary: assignment.visibleSummary
        };
      })
      : [],
    assessment: active
      ? {
        cycleId: career.assessmentDossier.cycleId,
        meritScore: career.assessmentDossier.meritScore,
        riskScore: career.assessmentDossier.riskScore,
        pendingRecommendation: career.assessmentDossier.pendingRecommendation,
        nextReviewInMonths: active && nextReviewInMonths === reviewCycleMonths ? reviewCycleMonths : nextReviewInMonths,
        notes: career.assessmentDossier.notes
      }
      : null,
    networkSummary: active
      ? buildOfficialNetworkSummary(worldState)
      : null,
    procedureSummary: active
      ? {
        impeachmentStage: career.impeachmentProcedure.stage,
        visibleNotice: career.impeachmentProcedure.visibleNotice,
        risk: career.impeachmentProcedure.risk,
        dueTurn: career.impeachmentProcedure.dueTurn,
        deadlineUnit: career.impeachmentProcedure.deadlineUnit,
        turnsRemaining: formatTenDayDeadline(career.impeachmentProcedure.dueTurn, worldState).turnsRemaining,
        deadlineLabel: formatTenDayDeadline(career.impeachmentProcedure.dueTurn, worldState).deadlineLabel
      }
      : null,
    pendingReview: active && (
      !player.officeTitle ||
      scores.impeachmentRisk >= 80 ||
      scores.promotionProspect >= 80 ||
      nextReviewInMonths === 0 ||
      nextReviewInMonths === 1
    ),
    lastOutcome: latest,
    recentOutcomes: career.careerHistory.slice(-5)
  };
}

function summarizeOfficialCareerForPrompt(worldState = {}) {
  const view = buildOfficialCareerView(worldState);
  return {
    active: view.active,
    currentPosting: view.currentPosting,
    tenureMonths: view.tenureMonths,
    nextReviewInMonths: view.nextReviewInMonths,
    careerScore: view.careerScore,
    riskScore: view.riskScore,
    bureau: view.bureau
      ? {
        name: view.bureau.name,
        duties: view.bureau.duties
      }
      : null,
    assignments: (view.assignments || []).map((assignment) => ({
      title: assignment.title,
      status: assignment.status,
      deadlineLabel: assignment.deadlineLabel,
      progress: assignment.progress,
      risk: assignment.risk,
      visibleSummary: assignment.visibleSummary
    })).slice(0, 3),
    firstMonthExperience: view.firstMonthExperience?.active
      ? {
        assignmentTitle: view.firstMonthExperience.assignment?.title || null,
        phaseLabel: view.firstMonthExperience.assignment?.phaseLabel || null,
        riskLabel: view.firstMonthExperience.assignment?.riskLabel || null,
        receipt: view.firstMonthExperience.receipt?.publicSummary || "",
        nextActions: (view.firstMonthExperience.nextActions || []).map((action) => ({
          label: action.label,
          text: action.text
        })).slice(0, 3),
        authorityBoundary: view.firstMonthExperience.authorityBoundary
      }
      : null,
    assessment: view.assessment
      ? {
        meritScore: view.assessment.meritScore,
        riskScore: view.assessment.riskScore,
        pendingRecommendation: view.assessment.pendingRecommendation,
        notes: view.assessment.notes.slice(0, 3)
      }
      : null,
    procedureSummary: view.procedureSummary,
    lastOutcome: view.lastOutcome
      ? {
        type: view.lastOutcome.type,
        label: view.lastOutcome.label,
        officeTitleAfter: view.lastOutcome.officeTitleAfter
      }
      : null
  };
}

function runOfficialCareerStep(worldState = {}, input = "", options = {}) {
  const result = {
    statePatch: {},
    attributeChanges: [],
    relationshipChanges: [],
    events: [],
    outcome: null,
    summary: ""
  };

  if (!isPlainObject(worldState)) return result;
  const career = normalizeOfficialCareerState(worldState);
  const beforeState = JSON.parse(JSON.stringify(worldState));

  if (worldState.player?.role !== "official") {
    result.statePatch.officialCareer = {
      ...career,
      currentPosting: worldState.player?.officeTitle || worldState.player?.position || career.currentPosting
    };
    return result;
  }

  const isMonthEnd = options.isMonthEnd !== false;
  const nextTenureMonths = career.tenureMonths + (isMonthEnd ? 1 : 0);
  const action = classifyOfficialAction(input);
  const assignmentUpdate = updateAssignments(worldState, career.assignments, action);
  const nextAssessmentDossier = updateAssessmentDossier(
    worldState,
    career.assessmentDossier,
    action,
    assignmentUpdate.assignment
  );
  const nextImpeachmentProcedure = updateImpeachmentProcedure(worldState, career.impeachmentProcedure, action);
  const scores = calculateCareerScores(worldState);
  const reviewReason = (isMonthEnd || !worldState.player.officeTitle)
    ? getReviewReason(worldState, career, scores, nextTenureMonths)
    : null;
  const nextCareer = {
    ...career,
    tenureMonths: nextTenureMonths,
    currentPosting: worldState.player.officeTitle || worldState.player.position || career.currentPosting,
    bureauId: inferBureauId(worldState, career),
    assignments: assignmentUpdate.assignments,
    assessmentDossier: nextAssessmentDossier,
    impeachmentProcedure: nextImpeachmentProcedure,
    pendingOutcome: null
  };
  if (assignmentUpdate.event) {
    result.events.push(assignmentUpdate.event);
    const firstMonthEvent = buildOfficialFirstMonthTurnEvent(worldState, nextCareer, assignmentUpdate.assignment);
    if (firstMonthEvent) {
      result.events.push(firstMonthEvent);
    }
  }

  if (reviewReason) {
    const outcome = classifyOfficialCareerOutcome(worldState, reviewReason, scores);
    const historyEntry = createHistoryEntry(worldState, career, outcome);
    const playerPatch = buildPlayerPatch(worldState, outcome);
    historyEntry.officeTitleAfter = Object.prototype.hasOwnProperty.call(playerPatch, "officeTitle")
      ? playerPatch.officeTitle
      : outcome.officeTitleAfter ?? historyEntry.officeTitleBefore;
    nextCareer.currentPosting = historyEntry.officeTitleAfter || playerPatch.position || "革职闲居";
    nextCareer.lastReviewTurn = currentTurn(worldState);
    nextCareer.lastReviewYear = readTopLevelNumber(worldState, "year", 1644);
    nextCareer.careerHistory = [...career.careerHistory, historyEntry].slice(-MAX_CAREER_HISTORY);
    nextCareer.cooldowns = {
      ...career.cooldowns,
      [outcome.type]: deadlineTurnFromMonths(worldState, OUTCOME_COOLDOWN_MONTHS)
    };
    nextCareer.cooldownUnit = COOLDOWN_UNIT_TEN_DAY;
    Object.assign(nextCareer, applyOutcomeToDomainState(worldState, nextCareer, outcome, historyEntry));

    result.statePatch.player = playerPatch;
    result.relationshipChanges = buildRelationshipChanges(worldState, outcome);
    result.outcome = historyEntry;
    result.events.push(`[官场结算] ${worldState.player.name}${outcome.label}：${outcome.reason}`);
  }

  result.statePatch.officialCareer = normalizeOfficialCareerState({
    ...worldState,
    officialCareer: nextCareer
  });
  result.attributeChanges = buildAttributeChanges(beforeState, result.statePatch);
  result.summary = result.events.join(" ");
  return result;
}

module.exports = {
  OFFICIAL_CAREER_SCHEMA_VERSION,
  buildOfficialCareerView,
  calculateCareerScores,
  classifyOfficialCareerOutcome,
  ensureOfficialCareerState,
  normalizeOfficialCareerState,
  runOfficialCareerStep,
  summarizeOfficialCareerForPrompt
};
