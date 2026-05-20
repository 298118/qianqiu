const {
  EXAM_PREPARATION_AUTHORITY_BOUNDARY,
  EXAM_PREPARATION_LIMITS,
  EXAM_PREPARATION_PRESSURE,
  EXAM_PREPARATION_SCHEMA_VERSION
} = require("./examPreparationConfig");

const TRAVEL_PLANS = {
  child_exam: {
    distance: "local",
    baseCost: 2,
    event: "县城入场、赁席与笔墨纸费",
    fullPayEffects: { adaptability: 1 },
    shortfallEffects: { health: -1, mentality: -2 }
  },
  provincial_exam: {
    distance: "provincial",
    baseCost: 8,
    event: "赴省城道路迟滞、客栈拥挤",
    fullPayEffects: { mentality: 1, reputation: 1 },
    shortfallEffects: { health: -3, mentality: -4, adaptability: -1 }
  },
  metropolitan_exam: {
    distance: "capital",
    baseCost: 18,
    event: "长途入京、风雨与舟车劳顿",
    fullPayEffects: { adaptability: 1, reputation: 1 },
    shortfallEffects: { health: -5, mentality: -5, adaptability: -2 }
  },
  palace_exam: {
    distance: "palace",
    baseCost: 10,
    event: "京中寓居、朝服与殿试礼仪准备",
    fullPayEffects: { mentality: 1, reputation: 2 },
    shortfallEffects: { health: -2, mentality: -4, reputation: -1 }
  }
};

const PLAYER_PATCH_KEYS = ["gold", "health", "mentality", "adaptability", "reputation"];

const UNSAFE_PREPARATION_TEXT_PATTERN =
  /(SEALED_[A-Z0-9_]+|sealed[_ -]?mapping|hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|raw[_ -]?(?:provider|prompt|audit|ledger|table)|provider[_ -]?(?:payload|response|request|raw|proposal)|provider proposal|prompt(?:Text|_text)?|prompt_retrieval_index|event_log|world_sessions|statePatch|state_patch|worldState|world_state|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|api[_ -]?key|sk-[A-Za-z0-9_-]{4,}|tp-[A-Za-z0-9_-]{4,}|data[\\/](?:sessions|audit)|[A-Za-z]:[\\/]|\/mnt\/|\/home\/|\/tmp\/)/i;
function isUnsafePreparationKey(key) {
  const normalized = String(key || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("hidden") || normalized.includes("sealedmapping")) return true;
  if (normalized === "raw" || normalized.startsWith("raw")) return true;
  if (
    normalized === "provider" ||
    normalized.includes("providerpayload") ||
    normalized.includes("providerresponse") ||
    normalized.includes("providerrequest") ||
    normalized.includes("providerproposal") ||
    normalized.includes("providerraw")
  ) {
    return true;
  }
  if (normalized.includes("prompt")) return true;
  if (normalized.includes("requestbody") || normalized.includes("responsebody") || normalized.includes("baseurl")) return true;
  if (
    normalized === "key" ||
    normalized.includes("apikey") ||
    normalized.includes("secretkey") ||
    normalized.includes("accesskey") ||
    normalized.includes("privatekey") ||
    normalized.includes("publickey")
  ) {
    return true;
  }
  if (normalized.includes("secret") || normalized.includes("token") || normalized.includes("password") || normalized.includes("credential")) {
    return true;
  }
  return normalized.includes("statepatch") || normalized.includes("worldstate");
}

function getTravelPlan(level) {
  return TRAVEL_PLANS[level] || TRAVEL_PLANS.child_exam;
}

function cleanText(value, fallback = "", maxLength = EXAM_PREPARATION_LIMITS.maxVisibleText) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim().replace(/\s+/g, " ");
  if (!text || UNSAFE_PREPARATION_TEXT_PATTERN.test(text)) return fallback;
  return text.slice(0, maxLength);
}

const cleanPreparationText = cleanText;

function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizePublicJson(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePublicJson(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (isPlainObject(value)) {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isUnsafePreparationKey(key)) continue;
      const cleaned = sanitizePublicJson(entry, depth + 1);
      if (cleaned === undefined) continue;
      output[key] = cleaned;
    }
    return output;
  }
  if (typeof value === "string") return cleanText(value, "", EXAM_PREPARATION_LIMITS.maxVisibleText);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

function sanitizeEffectsForView(effects = {}) {
  if (!isPlainObject(effects)) return {};
  const output = {};
  for (const key of PLAYER_PATCH_KEYS) {
    if (typeof effects[key] === "number" && Number.isFinite(effects[key])) {
      output[key] = clampNumber(effects[key], -100, 100, 0);
    }
  }
  return output;
}

function sanitizeSponsorshipForView(sponsorship = null) {
  if (!isPlainObject(sponsorship)) return null;
  return {
    status: cleanText(sponsorship.status, "not_recorded", 32),
    score: clampNumber(sponsorship.score, 0, 100, 0),
    guarantorName: cleanText(sponsorship.guarantorName || sponsorship.teacherName, "", 48),
    ready: sponsorship.ready === true,
    publicSummary: cleanText(sponsorship.publicSummary, "", EXAM_PREPARATION_LIMITS.maxVisibleText)
  };
}

function sanitizePreparationPressureForView(pressure = null) {
  if (!isPlainObject(pressure)) return null;
  return {
    schemaVersion: EXAM_PREPARATION_SCHEMA_VERSION,
    source: cleanText(pressure.source, "server_entry_preparation", 48),
    level: cleanText(pressure.level, "child_exam", 40),
    examName: cleanText(pressure.examName, "考试", 48),
    score: clampNumber(pressure.score, 0, 100, 0),
    band: cleanText(pressure.band, "steady", 24),
    label: cleanText(pressure.label, "从容", 24),
    summary: cleanText(pressure.summary, "备考压力由服务器整理。"),
    studyFocus: cleanText(pressure.studyFocus, "经义根柢", 48),
    causes: (Array.isArray(pressure.causes) ? pressure.causes : [])
      .map((cause) => cleanText(cause, "", 96))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxCauses),
    suggestedActions: (Array.isArray(pressure.suggestedActions) ? pressure.suggestedActions : [])
      .map((action) => cleanText(action, "", 96))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxSuggestedActions),
    authorityBoundary: EXAM_PREPARATION_AUTHORITY_BOUNDARY
  };
}

function sanitizeEntryFeedbackForView(feedback = null) {
  if (!isPlainObject(feedback)) return null;
  return {
    schemaVersion: EXAM_PREPARATION_SCHEMA_VERSION,
    pressureScore: clampNumber(feedback.pressureScore, 0, 100, 0),
    pressureLabel: cleanText(feedback.pressureLabel, "从容", 24),
    publicSummary: cleanText(feedback.publicSummary, "入场准备由服务器整理。"),
    entrySearchSummary: cleanText(feedback.entrySearchSummary, "入场搜检只显示公开摘要。"),
    cellSummary: cleanText(feedback.cellSummary, "号舍记录只显示公开摘要。"),
    visibleNextActions: (Array.isArray(feedback.visibleNextActions) ? feedback.visibleNextActions : [])
      .map((action) => cleanText(action, "", 72))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxSuggestedActions)
  };
}

function sanitizeExamPreparationCalendarForView(calendar = null) {
  const cleaned = sanitizePublicJson(calendar);
  return isPlainObject(cleaned) ? cleaned : null;
}

function sanitizeEntryPreparationForView(preparation = null) {
  if (!isPlainObject(preparation)) return null;
  return {
    requiredGold: clampNumber(preparation.requiredGold, 0, 100000, 0),
    paidGold: clampNumber(preparation.paidGold, 0, 100000, 0),
    shortfall: clampNumber(preparation.shortfall, 0, 100000, 0),
    fullyFunded: preparation.fullyFunded === true,
    distance: cleanText(preparation.distance, "local", 32),
    travelMonths: clampNumber(preparation.travelMonths, 0, 60, 0),
    event: cleanText(preparation.event, "", EXAM_PREPARATION_LIMITS.maxVisibleText),
    effects: sanitizeEffectsForView(preparation.effects),
    sponsorship: sanitizeSponsorshipForView(preparation.sponsorship),
    appliedAtTurn: clampNumber(preparation.appliedAtTurn, 0, 1000000, 0),
    appliedAtYear: clampNumber(preparation.appliedAtYear, 0, 10000, 0),
    appliedAtMonth: clampNumber(preparation.appliedAtMonth, 1, 12, 1),
    examCalendar: sanitizeExamPreparationCalendarForView(preparation.examCalendar),
    preparationPressure: sanitizePreparationPressureForView(preparation.preparationPressure),
    entryFeedback: sanitizeEntryFeedbackForView(preparation.entryFeedback)
  };
}

function readStudyPlanFocus(worldState = {}) {
  const plan = worldState.studyProfile?.nextPlan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return {
      focus: "经义根柢",
      action: "按读书簿复看四书题眼，先稳破题与承题。"
    };
  }
  const focus = cleanText(plan.focus, "经义根柢", 48);
  const firstItem = Array.isArray(plan.items)
    ? plan.items.map((item) => cleanText(item, "", 72)).find(Boolean)
    : "";
  return {
    focus,
    action: firstItem || `按${focus}弱项补一轮日课。`
  };
}

function pressureBand(score) {
  return EXAM_PREPARATION_PRESSURE.bands
    .filter((band) => score >= band.min)
    .at(-1) || EXAM_PREPARATION_PRESSURE.bands[0];
}

function lowAttributePressure(player, key, label, causes) {
  const value = Number(player[key]);
  if (!Number.isFinite(value)) return 0;
  if (value < EXAM_PREPARATION_PRESSURE.criticalAttributeThreshold) {
    causes.push(`${label}${Math.round(value)}，临场承压甚重。`);
    return EXAM_PREPARATION_PRESSURE.criticalAttributeWeight;
  }
  if (value < EXAM_PREPARATION_PRESSURE.lowAttributeThreshold) {
    causes.push(`${label}${Math.round(value)}，宜先调息稳住。`);
    return EXAM_PREPARATION_PRESSURE.lowAttributeWeight;
  }
  return 0;
}

function buildPreparationPressure({
  worldState,
  exam,
  examCalendar,
  plan,
  requiredGold,
  paidGold,
  shortfall,
  sponsorshipStatus,
  readiness
}) {
  const player = worldState.player || {};
  const causes = [];
  const suggestedActions = [];
  const studyPlan = readStudyPlanFocus(worldState);
  let score = EXAM_PREPARATION_PRESSURE.baseByDistance[plan.distance] || 10;

  if (shortfall > 0) {
    const shortfallRatio = requiredGold > 0 ? shortfall / requiredGold : 0;
    score += Math.round(shortfallRatio * EXAM_PREPARATION_PRESSURE.shortfallMax);
    causes.push(`盘费缺${shortfall}/${requiredGold}两，旅途疲惫会入场内风险。`);
    suggestedActions.push("先筹措盘费或缩减行装，避免临场心浮。");
  } else {
    causes.push(`盘费已足，支出${paidGold}/${requiredGold}两。`);
  }

  const sponsorshipPenalty = EXAM_PREPARATION_PRESSURE.sponsorshipPenalty[sponsorshipStatus] ??
    EXAM_PREPARATION_PRESSURE.sponsorshipPenalty.not_recorded;
  score += sponsorshipPenalty;
  if (sponsorshipStatus === "ready") {
    causes.push("保结已具，可随场入册。");
  } else if (sponsorshipStatus === "conditional") {
    causes.push("保结尚有条件，入场前仍须稳住师承声望。");
    suggestedActions.push("请老师复核保结与近作，补齐具结把握。");
  } else {
    causes.push("保结未稳，只作公开准备摘要，不替代准考裁决。");
    suggestedActions.push("先拜见老师或同窗互评，争取公开保结。");
  }

  const travelMonths = clampNumber(examCalendar?.travelMonths, 0, 24, 0);
  if (travelMonths > 0) {
    score += Math.min(24, travelMonths * EXAM_PREPARATION_PRESSURE.travelMonthWeight);
    causes.push(`行程约${travelMonths}月，旅途劳顿会影响卷面稳定。`);
  }

  const readinessSource = isPlainObject(readiness) ? readiness : exam?.readiness;
  const readinessMissing = Array.isArray(readinessSource?.missing) ? readinessSource.missing.length : 0;
  if (readinessMissing > 0) {
    score += Math.min(24, readinessMissing * EXAM_PREPARATION_PRESSURE.readinessMissingWeight);
    causes.push(`准考准备仍有${readinessMissing}项缺口。`);
  }

  score += lowAttributePressure(player, "health", "体力", causes);
  score += lowAttributePressure(player, "mentality", "心神", causes);
  score += lowAttributePressure(player, "adaptability", "应变", causes);

  suggestedActions.push(studyPlan.action);
  if (!suggestedActions.some((action) => /调息|心/.test(action))) {
    suggestedActions.push("入场前少应酬，先稳心神与睡眠。");
  }
  suggestedActions.push("题纸既发后先审题立意，再拟纲成文。");

  const pressureScore = clampNumber(score, 0, 100, 0);
  const band = pressureBand(pressureScore);
  return {
    schemaVersion: EXAM_PREPARATION_SCHEMA_VERSION,
    source: "server_entry_preparation",
    level: exam.level,
    examName: cleanText(exam.name || exam.examName, "考试", 48),
    score: pressureScore,
    band: band.key,
    label: band.label,
    summary: band.summary,
    studyFocus: studyPlan.focus,
    causes: causes
      .map((cause) => cleanText(cause, "", 96))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxCauses),
    suggestedActions: suggestedActions
      .map((action) => cleanText(action, "", 96))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxSuggestedActions),
    authorityBoundary: EXAM_PREPARATION_AUTHORITY_BOUNDARY
  };
}

function buildEntryFeedback(preparationPressure, fullyFunded) {
  const score = preparationPressure?.score || 0;
  const label = preparationPressure?.label || "从容";
  const focus = preparationPressure?.studyFocus || "经义根柢";
  const funding = fullyFunded ? "盘费已足" : "盘费不足";
  return {
    schemaVersion: EXAM_PREPARATION_SCHEMA_VERSION,
    pressureScore: score,
    pressureLabel: label,
    publicSummary: `${funding}，${label}入场；临场先守${focus}，再按题拟纲。`,
    entrySearchSummary: score >= 55
      ? "入场搜检未见夹带，但备考压力偏高，监临点名后宜先稳心神。"
      : "入场搜检未见夹带，点名入席。备考压力在可控范围内。",
    cellSummary: score >= 55
      ? "号舍已定，旅费、保结或身心压力会影响卷面稳定，先审题再动笔。"
      : "号舍已定，先审题、拟纲、誊清，勿因场面扰乱章法。",
    visibleNextActions: (preparationPressure?.suggestedActions || [])
      .map((action) => cleanText(action, "", 72))
      .filter(Boolean)
      .slice(0, EXAM_PREPARATION_LIMITS.maxSuggestedActions)
  };
}

function addDelta(target, key, delta) {
  target[key] = (target[key] || 0) + delta;
}

function buildPlayerPatch(player, effects, paid) {
  const patch = {};
  for (const key of PLAYER_PATCH_KEYS) {
    if (typeof player[key] === "number") {
      patch[key] = player[key];
    }
  }

  patch.gold = Math.max(0, (player.gold || 0) - paid);

  for (const [key, delta] of Object.entries(effects)) {
    addDelta(patch, key, delta);
  }

  return patch;
}

function createEntryPreparation(worldState, exam, examCalendar = null, options = {}) {
  const player = worldState.player || {};
  const plan = getTravelPlan(exam.level);
  const recommendation = examCalendar?.teacherRecommendation || null;
  const sponsorshipStatus = recommendation?.sponsorshipStatus || "not_recorded";
  const availableGold = Math.max(0, player.gold || 0);
  const requiredGold = plan.baseCost;
  const paidGold = Math.min(availableGold, requiredGold);
  const shortfall = requiredGold - paidGold;
  const fullyFunded = shortfall === 0;
  const effects = fullyFunded ? plan.fullPayEffects : plan.shortfallEffects;
  const statePatch = { player: buildPlayerPatch(player, effects, paidGold) };
  const preparationPressure = buildPreparationPressure({
    worldState,
    exam,
    examCalendar,
    plan,
    requiredGold,
    paidGold,
    shortfall,
    sponsorshipStatus,
    readiness: options.readiness
  });
  const entryFeedback = buildEntryFeedback(preparationPressure, fullyFunded);
  const preparation = {
    requiredGold,
    paidGold,
    shortfall,
    fullyFunded,
    distance: plan.distance,
    travelMonths: examCalendar?.travelMonths ?? 0,
    event: plan.event,
    effects,
    sponsorship: recommendation
      ? {
        status: sponsorshipStatus,
        score: recommendation.sponsorshipScore || 0,
        guarantorName: recommendation.guarantorName || "",
        ready: sponsorshipStatus === "ready" || sponsorshipStatus === "conditional",
        publicSummary: recommendation.note || ""
      }
      : null,
    appliedAtTurn: worldState.turnCount || 0,
    appliedAtYear: worldState.year,
    appliedAtMonth: worldState.month,
    examCalendar: examCalendar || null,
    preparationPressure,
    entryFeedback
  };
  const fundingText = fullyFunded
    ? `盘费已足，支出${paidGold}/${requiredGold}两`
    : `盘费不足，仅支出${paidGold}/${requiredGold}两，缺口化为疲惫与临场心浮`;

  return {
    statePatch,
    entryPreparation: preparation,
    events: [
      `${player.name || "玩家"}赶赴${exam.name}：${plan.event}；${fundingText}。`
    ]
  };
}

module.exports = {
  buildEntryFeedback,
  buildPreparationPressure,
  cleanPreparationText,
  createEntryPreparation,
  getTravelPlan,
  sanitizeExamPreparationCalendarForView,
  sanitizeEntryPreparationForView,
  sanitizeEntryFeedbackForView,
  sanitizePreparationPressureForView,
  TRAVEL_PLANS
};
