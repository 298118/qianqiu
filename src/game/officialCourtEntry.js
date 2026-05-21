const {
  cleanOfficialFirstMonthText
} = require("./officialFirstMonth");
const {
  OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_LIMITS,
  OFFICIAL_COURT_ENTRY_SCHEMA_VERSION,
  OFFICIAL_COURT_ENTRY_TARGETS
} = require("./officialCourtEntryConfig");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanText(value, fallback = "", maxLength = OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength) {
  return cleanOfficialFirstMonthText(value, fallback, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function cleanList(values, limit, maxLength = OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength) {
  const result = [];
  const seen = new Set();
  for (const value of asArray(values)) {
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

function inactiveCourtEntry() {
  return {
    schemaVersion: OFFICIAL_COURT_ENTRY_SCHEMA_VERSION,
    active: false,
    id: null,
    title: "",
    publicSummary: "",
    targetSurfaces: [],
    memorialEntry: null,
    courtDebateEntry: null,
    assessmentTrace: null,
    superiorFollowUp: "",
    peerFollowUp: "",
    nextActions: [],
    authorityBoundary: OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY
  };
}

function buildTraceLabel(nextReviewInMonths) {
  if (nextReviewInMonths === null || nextReviewInMonths === undefined) return "考成期未明";
  const months = clampNumber(nextReviewInMonths, 0, 120, 0);
  if (months === 0) return "本月入考成";
  if (months === 1) return "尚余一月入考成";
  return `尚余${months}月入考成`;
}

function buildOfficialCourtEntryView(worldState = {}, career = {}, firstMonthExperience = null, options = {}) {
  const firstMonth = isPlainObject(firstMonthExperience) ? firstMonthExperience : {};
  const assignment = isPlainObject(firstMonth.assignment) ? firstMonth.assignment : {};
  const receipt = isPlainObject(firstMonth.receipt) ? firstMonth.receipt : {};
  if (firstMonth.active !== true || !assignment.title) return inactiveCourtEntry();

  const title = cleanText(assignment.title, "首月差事", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const assignmentId = cleanId(assignment.id, "first-month-assignment");
  const generatedAtTurn = clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
  const phaseLabel = cleanText(assignment.phaseLabel, "进度未明", 24);
  const riskLabel = cleanText(assignment.riskLabel, "风险未明", 24);
  const receiptTitle = cleanText(receipt.title, "官署回执", 48);
  const receiptSummary = cleanText(receipt.publicSummary, `${title}${phaseLabel}，${riskLabel}。`);
  const superiorFollowUp = cleanText(receipt.superiorFeedback, "上官只看公开进度、凭据和请裁边界。", 120);
  const peerFollowUp = cleanText(receipt.peerFeedback, "同僚只形成公开风向，不写入隐藏关系。", 120);
  const dossier = isPlainObject(career.assessmentDossier) ? career.assessmentDossier : {};
  const nextReviewInMonths = options.nextReviewInMonths === null || options.nextReviewInMonths === undefined
    ? null
    : clampNumber(options.nextReviewInMonths, 0, 120, 0);
  const traceLabel = buildTraceLabel(nextReviewInMonths);
  const signals = cleanList(firstMonth.assessmentSignals, OFFICIAL_COURT_ENTRY_LIMITS.maxSignals);
  const sourceRefs = [
    `officialCareer.assignment:${assignmentId}`,
    "officialCareer.firstMonthExperience",
    "officialCareer.assessmentDossier"
  ];
  const publicSummary = cleanText(
    `${receiptTitle}已把${title}整理为公开回署材料，可入奏折队列或朝议筹议；${traceLabel}，功绩${clampNumber(dossier.meritScore, 0, 100, 0)}、风险${clampNumber(dossier.riskScore, 0, 100, clampNumber(assignment.risk, 0, 100, 0))}仍待服务器裁决。`
  );
  const id = cleanId(`official-court-entry-first-month-${assignmentId}`, "official-court-entry-first-month");
  const memorialDraft = cleanText(
    `臣谨就${title}具奏：据${receiptTitle}说明公开进度、上官同僚所疑、考成风险与请裁事项，伏请交部院复核。`
  );
  const debateDraft = cleanText(
    `请付朝议筹议${title}后续章程，令相关部院分别陈明可行、不可行与待查三项。`
  );

  return {
    schemaVersion: OFFICIAL_COURT_ENTRY_SCHEMA_VERSION,
    active: true,
    id,
    title: cleanText(`首月回署：${title}`, "首月回署", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength),
    publicSummary,
    statusLabel: cleanText(`${phaseLabel} / ${riskLabel}`, "待筹议", 32),
    generatedAtTurn,
    sourceRefs: sourceRefs.slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs),
    targetSurfaces: OFFICIAL_COURT_ENTRY_TARGETS,
    memorialEntry: {
      surfaceId: "memorial-review",
      draftKind: "official_first_month_memorial",
      title: cleanText(`${title}奏折材料`, "首月奏折材料", 80),
      publicSummary: receiptSummary,
      draftText: memorialDraft
    },
    courtDebateEntry: {
      surfaceId: "court-debate",
      draftKind: "official_first_month_debate",
      title: cleanText(`${title}朝议题`, "首月朝议题", 80),
      publicSummary: cleanText(`${superiorFollowUp} ${peerFollowUp}`),
      draftText: debateDraft
    },
    assessmentTrace: {
      cycleId: cleanText(dossier.cycleId, "本任考成", 64),
      meritScore: clampNumber(dossier.meritScore, 0, 100, 0),
      riskScore: clampNumber(dossier.riskScore, 0, 100, clampNumber(assignment.risk, 0, 100, 0)),
      nextReviewInMonths,
      traceLabel,
      signals
    },
    superiorFollowUp,
    peerFollowUp,
    nextActions: [
      {
        id: "send-to-memorial-review",
        label: "入奏折队列",
        text: memorialDraft,
        targetSurfaceId: "memorial-review"
      },
      {
        id: "send-to-court-debate",
        label: "付朝议筹议",
        text: debateDraft,
        targetSurfaceId: "court-debate"
      },
      {
        id: "track-assessment",
        label: "续记考成",
        text: cleanText(`续记${title}入本任考成簿，列明${traceLabel}、功绩风险与仍须服务器裁决的后果。`),
        targetSurfaceId: "memorial-review"
      }
    ].slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxActions),
    authorityBoundary: OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY
  };
}

function buildOfficialCourtEntryEvidenceRows(courtEntry = {}) {
  if (!isPlainObject(courtEntry) || courtEntry.active !== true) return [];
  return [{
    id: cleanId(courtEntry.id, "official-court-entry"),
    sourceId: cleanId(courtEntry.id, "official-court-entry"),
    title: cleanText(courtEntry.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength),
    publicSummary: cleanText(courtEntry.publicSummary, "首月回署材料可入奏折或朝议筹议。"),
    statusLabel: cleanText(courtEntry.statusLabel, "待筹议", 32),
    visibility: "player_visible",
    confidence: 0.82,
    generatedAtTurn: clampNumber(courtEntry.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    relatedRefs: cleanList(courtEntry.sourceRefs, OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs, 96),
    scopeRefs: cleanList(
      asArray(courtEntry.targetSurfaces).map((target) => `surface:${target.surfaceId || target.label || ""}`),
      4,
      96
    )
  }];
}

module.exports = {
  buildOfficialCourtEntryEvidenceRows,
  buildOfficialCourtEntryView
};
