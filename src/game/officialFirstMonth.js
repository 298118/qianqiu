const {
  OFFICIAL_FIRST_MONTH_AUTHORITY_BOUNDARY,
  OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK,
  OFFICIAL_FIRST_MONTH_KIND_FEEDBACK,
  OFFICIAL_FIRST_MONTH_LIMITS,
  OFFICIAL_FIRST_MONTH_PROGRESS_BANDS,
  OFFICIAL_FIRST_MONTH_RISK_BANDS,
  OFFICIAL_FIRST_MONTH_SCHEMA_VERSION,
  OFFICIAL_FIRST_MONTH_UNSAFE_TEXT_PATTERNS
} = require("./officialFirstMonthConfig");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function hasUnsafeOfficialFirstMonthText(value) {
  if (typeof value !== "string") return false;
  return OFFICIAL_FIRST_MONTH_UNSAFE_TEXT_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function cleanText(value, fallback = "", maxLength = OFFICIAL_FIRST_MONTH_LIMITS.maxTextLength) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text || hasUnsafeOfficialFirstMonthText(text)) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanList(values, limit, maxLength = OFFICIAL_FIRST_MONTH_LIMITS.maxShortTextLength) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const result = [];
  for (const value of source) {
    const text = isPlainObject(value)
      ? cleanText(value.publicSummary || value.summary || value.title || value.label || value.text, "", maxLength)
      : cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function chooseBand(value, bands) {
  const score = clampNumber(value, 0, 100, 0);
  return bands.find((band) => score >= band.min) || bands.at(-1);
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function getTurnsRemaining(assignment, worldState) {
  if (!Number.isFinite(Number(assignment?.dueTurn))) return null;
  return Math.max(0, clampNumber(assignment.dueTurn, 0, Number.MAX_SAFE_INTEGER, 0) - currentTurn(worldState));
}

function isFirstMonthAssignment(assignment, career = {}) {
  const id = cleanId(assignment?.id, "");
  const summary = cleanText(assignment?.visibleSummary, "", OFFICIAL_FIRST_MONTH_LIMITS.maxTextLength);
  const title = cleanText(assignment?.title, "", OFFICIAL_FIRST_MONTH_LIMITS.maxShortTextLength);
  if (id.includes("first-month")) return true;
  if (/首月/.test(`${title}${summary}`)) return true;
  if (clampNumber(career.tenureMonths, 0, 600, 99) <= 1 && assignment?.status !== "resolved") return true;
  return false;
}

function selectFirstMonthAssignment(assignments, career = {}) {
  if (!Array.isArray(assignments)) return null;
  const candidates = assignments
    .filter((assignment) => isPlainObject(assignment))
    .map((assignment, index) => ({
      assignment,
      index,
      firstMonth: isFirstMonthAssignment(assignment, career),
      active: assignment.status === "active" || assignment.status === "submitted"
    }))
    .filter((entry) => entry.firstMonth);
  if (!candidates.length) return null;
  return candidates.sort((first, second) => {
    if (first.active !== second.active) return first.active ? -1 : 1;
    return first.index - second.index;
  })[0].assignment;
}

function feedbackForKind(kind) {
  const key = cleanId(kind, "");
  return OFFICIAL_FIRST_MONTH_KIND_FEEDBACK[key] || OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK;
}

function buildDeadlineLabel(assignment, worldState) {
  const remaining = getTurnsRemaining(assignment, worldState);
  if (remaining === null) return "限期未明";
  if (remaining === 0) return "本旬须回";
  if (remaining === 1) return "尚余一旬";
  return `尚余${remaining}旬`;
}

function buildAssessmentSignals({ assignment, career, progressBand, riskBand }) {
  const dossier = isPlainObject(career.assessmentDossier) ? career.assessmentDossier : {};
  const signals = [
    `${progressBand.label}：${progressBand.summary}`,
    `${riskBand.label}：${riskBand.summary}`,
    `考成簿功绩${clampNumber(dossier.meritScore, 0, 100, 0)}，风险${clampNumber(dossier.riskScore, 0, 100, clampNumber(assignment.risk, 0, 100, 0))}。`,
    ...cleanList(dossier.notes, OFFICIAL_FIRST_MONTH_LIMITS.maxNotes, OFFICIAL_FIRST_MONTH_LIMITS.maxShortTextLength)
  ];
  return cleanList(signals, OFFICIAL_FIRST_MONTH_LIMITS.maxNotes + 2);
}

function buildNextActions({ assignment, feedback, progressBand, riskBand, deadlineLabel }) {
  const title = cleanText(assignment.title, "首月差事", OFFICIAL_FIRST_MONTH_LIMITS.maxShortTextLength);
  const base = cleanList(feedback.nextActions, OFFICIAL_FIRST_MONTH_LIMITS.maxNextActions);
  const actions = [
    {
      id: "receipt",
      label: "拟回堂官",
      text: `就${title}拟回堂官札，说明${progressBand.label}、${riskBand.label}、${deadlineLabel}与请裁事项。`
    },
    {
      id: "memorial",
      label: "拟具奏疏",
      text: `臣谨就${title}呈明公开凭据、经手进度与考成风险，请服务器裁决后果。`
    },
    ...base.map((text, index) => ({
      id: `action-${index + 1}`,
      label: index === 0 ? "补公开凭据" : index === 1 ? "问同僚旧例" : "续办差遣",
      text
    }))
  ];
  const seen = new Set();
  return actions
    .map((action) => ({
      id: cleanId(action.id, "action"),
      label: cleanText(action.label, "拟行动", 32),
      text: cleanText(action.text, "", OFFICIAL_FIRST_MONTH_LIMITS.maxTextLength)
    }))
    .filter((action) => {
      if (!action.text || seen.has(action.text)) return false;
      seen.add(action.text);
      return true;
    })
    .slice(0, OFFICIAL_FIRST_MONTH_LIMITS.maxNextActions);
}

function buildOfficialFirstMonthExperienceView(worldState = {}, career = {}) {
  const player = isPlainObject(worldState.player) ? worldState.player : {};
  const active = player.role === "official";
  const assignments = Array.isArray(career.assignments) ? career.assignments : [];
  const assignment = active ? selectFirstMonthAssignment(assignments, career) : null;

  if (!active || !assignment) {
    return {
      schemaVersion: OFFICIAL_FIRST_MONTH_SCHEMA_VERSION,
      active: false,
      assignment: null,
      receipt: null,
      assessmentSignals: [],
      nextActions: [],
      monthlyBriefingHint: "",
      authorityBoundary: OFFICIAL_FIRST_MONTH_AUTHORITY_BOUNDARY
    };
  }

  const title = cleanText(assignment.title, "首月官署差事", OFFICIAL_FIRST_MONTH_LIMITS.maxShortTextLength);
  const kind = cleanId(assignment.kind, "routine_office");
  const progress = clampNumber(assignment.progress, 0, 100, 0);
  const risk = clampNumber(assignment.risk, 0, 100, 20);
  const progressBand = chooseBand(progress, OFFICIAL_FIRST_MONTH_PROGRESS_BANDS);
  const riskBand = chooseBand(risk, OFFICIAL_FIRST_MONTH_RISK_BANDS);
  const feedback = feedbackForKind(kind);
  const deadlineLabel = buildDeadlineLabel(assignment, worldState);
  const visibleSummary = cleanText(
    assignment.visibleSummary,
    `${title}由服务器按授官轨迹派生并随普通回合推进。`
  );
  const superiorFeedback = cleanText(feedback.superiorFocus, OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK.superiorFocus);
  const peerFeedback = cleanText(feedback.colleagueFocus, OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK.colleagueFocus);
  const receiptTitle = cleanText(feedback.receiptNoun, OFFICIAL_FIRST_MONTH_DEFAULT_FEEDBACK.receiptNoun, 48);

  return {
    schemaVersion: OFFICIAL_FIRST_MONTH_SCHEMA_VERSION,
    active: true,
    assignment: {
      id: cleanId(assignment.id, "first-month-assignment"),
      title,
      kind,
      bureauId: cleanId(assignment.bureauId, ""),
      status: cleanId(assignment.status, "active"),
      phase: progressBand.id,
      phaseLabel: progressBand.label,
      riskLevel: riskBand.id,
      riskLabel: riskBand.label,
      progress,
      risk,
      publicStake: clampNumber(assignment.publicStake, 0, 100, 40),
      privatePressure: clampNumber(assignment.privatePressure, 0, 100, 20),
      deadlineLabel,
      turnsRemaining: getTurnsRemaining(assignment, worldState),
      visibleSummary,
      relatedContacts: cleanList(assignment.relatedContacts, OFFICIAL_FIRST_MONTH_LIMITS.maxContacts, 64),
      relatedFactions: cleanList(assignment.relatedFactions, OFFICIAL_FIRST_MONTH_LIMITS.maxContacts, 64)
    },
    receipt: {
      title: receiptTitle,
      statusLabel: progressBand.label,
      publicSummary: cleanText(`${title}${progressBand.label}，${riskBand.label}，${deadlineLabel}。${visibleSummary}`),
      superiorFeedback,
      peerFeedback,
      bureauReply: cleanText(`官署回执只确认${title}的公开进度与请裁事项，不直接改变官职、奖惩或弹劾结果。`)
    },
    assessmentSignals: buildAssessmentSignals({ assignment, career, progressBand, riskBand }),
    nextActions: buildNextActions({ assignment, feedback, progressBand, riskBand, deadlineLabel }),
    monthlyBriefingHint: cleanText(
      `月末月报会把${title}的进度、风险、上官同僚反馈和回署事项纳入“本职差事”“上官同僚”“下月可行”。`
    ),
    authorityBoundary: OFFICIAL_FIRST_MONTH_AUTHORITY_BOUNDARY
  };
}

function buildOfficialFirstMonthTurnEvent(worldState = {}, career = {}, assignment = null) {
  const view = buildOfficialFirstMonthExperienceView(worldState, {
    ...career,
    assignments: assignment ? [assignment] : career.assignments
  });
  if (!view.active || !view.receipt) return "";
  return `[官署回执] ${view.receipt.title}：${view.receipt.publicSummary}`;
}

module.exports = {
  buildOfficialFirstMonthExperienceView,
  buildOfficialFirstMonthTurnEvent,
  cleanOfficialFirstMonthText: cleanText,
  hasUnsafeOfficialFirstMonthText
};
