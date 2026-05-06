const { NUMERIC_RANGES, clamp } = require("./stateRules");
const { normalizeRelationshipLedger } = require("./relationships");

const OFFICIAL_CAREER_SCHEMA_VERSION = 1;
const DEFAULT_REVIEW_CYCLE_MONTHS = 12;
const MAX_CAREER_HISTORY = 8;
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

const POSTING_LADDER = [
  "六部观政进士",
  "翰林院庶吉士",
  "翰林院编修",
  "翰林院修撰",
  "六部主事",
  "监察御史",
  "按察司佥事",
  "知府",
  "布政司参议",
  "六部郎中",
  "都察院佥都御史",
  "六部侍郎"
];

const TRANSFER_POSTINGS = [
  "户部主事",
  "礼部主事",
  "都察院经历",
  "翰林院检讨"
];

const OUTPOST_POSTINGS = [
  "清河县知县",
  "苏州府推官",
  "湖广按察司佥事",
  "河南府同知"
];

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
  return trimmed.slice(0, maxLength);
}

function currentTurn(worldState) {
  return clampNumber(worldState?.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
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

function normalizeCooldowns(cooldowns, turn) {
  const normalized = {};
  if (!isPlainObject(cooldowns)) return normalized;
  for (const [key, value] of Object.entries(cooldowns)) {
    const cleanKey = cleanText(key, "", 64);
    if (!cleanKey) continue;
    normalized[cleanKey] = clampNumber(value, 0, turn + 120, turn);
  }
  return normalized;
}

function getCurrentPosting(worldState, source = {}) {
  const sourcePosting = cleanText(source.currentPosting, "", 80);
  if (sourcePosting && !(sourcePosting === "未授" && worldState?.player?.role === "official" && worldState?.player?.officeTitle)) {
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
    currentPosting: getCurrentPosting(worldState, source),
    careerHistory: history,
    pendingOutcome: normalizeHistoryEntry(source.pendingOutcome) || null,
    cooldowns: normalizeCooldowns(source.cooldowns, turn)
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
  const exact = POSTING_LADDER.indexOf(normalized);
  if (exact >= 0) return exact;
  return POSTING_LADDER.findIndex((posting) => normalized.includes(posting) || posting.includes(normalized));
}

function nextPosting(title) {
  const index = getPostingIndex(title);
  return POSTING_LADDER[Math.min(POSTING_LADDER.length - 1, Math.max(0, index) + 1)];
}

function previousPosting(title) {
  const index = getPostingIndex(title);
  return POSTING_LADDER[Math.max(0, index <= 0 ? 0 : index - 1)];
}

function pickIndexedPosting(list, worldState) {
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

  const careerScore = clampNumber(
    superiorFavor * 0.22 +
    peerNetwork * 0.14 +
    performanceMerit * 0.28 +
    promotionProspect * 0.22 +
    cleanReputation * 0.08 +
    influence * 0.06 +
    relationshipBoost,
    0,
    100,
    0
  );

  const riskScore = clampNumber(
    impeachmentRisk * 0.55 +
    (100 - cleanReputation) * 0.2 +
    (100 - integrity) * 0.15 +
    corruption * 0.1,
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
      officeTitleAfter: pickIndexedPosting(OUTPOST_POSTINGS, worldState),
      reason: "朝中认为清望尚可，宜外放地方以试实际抚治。"
    };
  }

  if (scores.promotionProspect >= 54 || scores.peerNetwork >= 55) {
    return {
      type: "transfer",
      label: "转任",
      officeTitleAfter: pickIndexedPosting(TRANSFER_POSTINGS, worldState),
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
    turn,
    officeTitleBefore,
    officeTitleAfter: outcome.officeTitleAfter ?? null,
    reason: outcome.reason
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

  return {
    schemaVersion: OFFICIAL_CAREER_SCHEMA_VERSION,
    generatedAtTurn: currentTurn(worldState),
    active,
    currentPosting: active
      ? player.officeTitle || player.position || career.currentPosting || "候选观政"
      : null,
    tenureMonths: active ? career.tenureMonths : 0,
    reviewCycleMonths,
    nextReviewInMonths: active && nextReviewInMonths === reviewCycleMonths ? reviewCycleMonths : nextReviewInMonths,
    careerScore: scores.careerScore,
    riskScore: scores.riskScore,
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
    lastOutcome: view.lastOutcome
      ? {
        type: view.lastOutcome.type,
        label: view.lastOutcome.label,
        officeTitleAfter: view.lastOutcome.officeTitleAfter
      }
      : null
  };
}

function runOfficialCareerStep(worldState = {}) {
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

  const nextTenureMonths = career.tenureMonths + 1;
  const scores = calculateCareerScores(worldState);
  const reviewReason = getReviewReason(worldState, career, scores, nextTenureMonths);
  const nextCareer = {
    ...career,
    tenureMonths: nextTenureMonths,
    currentPosting: worldState.player.officeTitle || worldState.player.position || career.currentPosting,
    pendingOutcome: null
  };

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
      [outcome.type]: currentTurn(worldState) + 6
    };

    result.statePatch.player = playerPatch;
    result.relationshipChanges = buildRelationshipChanges(worldState, outcome);
    result.outcome = historyEntry;
    result.events = [`[官场结算] ${worldState.player.name}${outcome.label}：${outcome.reason}`];
    result.summary = result.events.join(" ");
  }

  result.statePatch.officialCareer = normalizeOfficialCareerState({
    ...worldState,
    officialCareer: nextCareer
  });
  result.attributeChanges = buildAttributeChanges(beforeState, result.statePatch);
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
