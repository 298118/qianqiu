const {
  cleanOfficialFirstMonthText
} = require("./officialFirstMonth");
const {
  OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_LIMITS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS,
  OFFICIAL_COURT_ENTRY_RESOLUTION_STATUSES,
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
    latestResolution: null,
    resolutionHistory: [],
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

function normalizeResolutionStatus(value, fallback = "referred_to_bureau") {
  const status = cleanId(value, fallback);
  return OFFICIAL_COURT_ENTRY_RESOLUTION_STATUSES.includes(status) ? status : fallback;
}

function statusLabelForResolution(status) {
  return OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS[status] || OFFICIAL_COURT_ENTRY_RESOLUTION_LABELS.referred_to_bureau;
}

function normalizeSurfaceId(value, fallback = "memorial-review") {
  const surfaceId = cleanId(value, fallback);
  if (surfaceId === "court-debate" || surfaceId === "memorial-review" || surfaceId === "assessment-trace") {
    return surfaceId;
  }
  return fallback;
}

function normalizeSubmissionKind(value, surfaceId) {
  const kind = cleanId(value, "");
  const allowed = new Set([
    "official_first_month_memorial",
    "official_first_month_debate",
    "official_first_month_assessment"
  ]);
  if (allowed.has(kind)) return kind;
  if (surfaceId === "court-debate") return "official_first_month_debate";
  if (surfaceId === "assessment-trace") return "official_first_month_assessment";
  return "official_first_month_memorial";
}

function currentTurn(worldState = {}) {
  return clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function normalizeOfficialCourtEntryResolution(raw = {}, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const turn = clampNumber(raw.generatedAtTurn ?? raw.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const surfaceId = normalizeSurfaceId(raw.surfaceId, "memorial-review");
  const submissionKind = normalizeSubmissionKind(raw.submissionKind || raw.draftKind, surfaceId);
  const status = normalizeResolutionStatus(raw.status, "referred_to_bureau");
  const statusLabel = cleanText(raw.statusLabel, statusLabelForResolution(status), 40);
  const entryId = cleanId(raw.entryId || raw.courtEntryId, "official-court-entry");
  const title = cleanText(raw.title, `${statusLabel}：首月回署材料`, OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const publicSummary = cleanText(raw.publicSummary || raw.summary, "", OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength);
  if (!title || !publicSummary) return null;

  return {
    schemaVersion: `${OFFICIAL_COURT_ENTRY_SCHEMA_VERSION}.resolution`,
    id: cleanId(raw.id, `OCER-${String(turn).padStart(4, "0")}-${surfaceId}`),
    entryId,
    assignmentId: cleanId(raw.assignmentId, "first-month-assignment"),
    surfaceId,
    submissionKind,
    status,
    statusLabel,
    title,
    publicSummary,
    serverDecision: cleanText(
      raw.serverDecision,
      "服务器只记录本次呈上处理，不直接任免、处分或成弹劾。",
      OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
    ),
    meritDelta: clampNumber(raw.meritDelta, -6, 6, 0),
    riskDelta: clampNumber(raw.riskDelta, -6, 6, 0),
    progressDelta: clampNumber(raw.progressDelta, 0, 20, 0),
    generatedAtTurn: turn,
    year: clampNumber(raw.year, 1, 9999, clampNumber(worldState.year, 1, 9999, 1644)),
    month: clampNumber(raw.month, 1, 12, clampNumber(worldState.month, 1, 12, 1)),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, 3, clampNumber(worldState.tenDayPeriod, 1, 3, 1)),
    sourceRefs: cleanList(raw.sourceRefs, OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs, 96),
    nextStep: cleanText(
      raw.nextStep,
      "后续仍按普通回合补证、复核和考成结算。",
      OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength
    ),
    authorityBoundary: OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY
  };
}

function normalizeOfficialCourtEntryResolutions(resolutions = [], worldState = {}) {
  return asArray(resolutions)
    .map((resolution) => normalizeOfficialCourtEntryResolution(resolution, worldState))
    .filter(Boolean)
    .slice(-OFFICIAL_COURT_ENTRY_LIMITS.maxResolutionHistory);
}

function latestResolutionForEntry(entryId, resolutions = []) {
  const id = cleanId(entryId, "");
  if (!id) return null;
  return normalizeOfficialCourtEntryResolutions(resolutions)
    .filter((resolution) => resolution.entryId === id)
    .sort((first, second) => first.generatedAtTurn - second.generatedAtTurn)
    .at(-1) || null;
}

function classifyOfficialCourtEntrySubmission(input = "", courtEntry = {}, firstMonthExperience = {}) {
  const text = cleanText(input, "", 360);
  if (!text || courtEntry.active !== true) return null;
  const assignmentTitle = cleanText(firstMonthExperience.assignment?.title, "", 80);
  const entryTitle = cleanText(courtEntry.title, "", 80);
  const memorialTitle = cleanText(courtEntry.memorialEntry?.title, "", 80);
  const debateTitle = cleanText(courtEntry.courtDebateEntry?.title, "", 80);
  const touchesEntry = /首月|回署|官署回执|奏折队列|朝议筹议|考成追踪|考成簿/.test(text) ||
    [assignmentTitle, entryTitle, memorialTitle, debateTitle].filter(Boolean).some((title) => text.includes(title));
  if (!touchesEntry) return null;

  if (/朝议|廷议|筹议|廷推|会商|诸臣|部院分别陈明|可行、不可行|可行不可行|待查/.test(text)) {
    return {
      surfaceId: "court-debate",
      submissionKind: "official_first_month_debate",
      label: "朝议筹议"
    };
  }
  if (/续记|续入|入本任考成|考成簿|考成追踪|功绩风险/.test(text)) {
    return {
      surfaceId: "assessment-trace",
      submissionKind: "official_first_month_assessment",
      label: "考成追踪"
    };
  }
  if (/奏折|具奏|奏疏|上疏|呈明|交部院复核|入奏折|批红|转部|复核/.test(text)) {
    return {
      surfaceId: "memorial-review",
      submissionKind: "official_first_month_memorial",
      label: "奏折队列"
    };
  }
  return null;
}

function chooseResolutionDecision(submission = {}, assignment = {}, dossier = {}) {
  const progress = clampNumber(assignment.progress, 0, 100, 0);
  const risk = clampNumber(assignment.risk, 0, 100, 20);
  const merit = clampNumber(dossier.meritScore, 0, 100, 0);
  if (submission.surfaceId === "assessment-trace") {
    return {
      status: "recorded_for_assessment",
      meritDelta: progress >= 55 ? 2 : 1,
      riskDelta: risk >= 50 ? 1 : 0,
      progressDelta: 3,
      nextStep: "下旬继续补公开凭据，待考成期由服务器合并结算。"
    };
  }
  if (submission.surfaceId === "court-debate") {
    if (risk >= 55) {
      return {
        status: "held_for_inquiry",
        meritDelta: 1,
        riskDelta: 2,
        progressDelta: 2,
        nextStep: "先补上官问答和同僚旧例，再择期复议。"
      };
    }
    if (progress >= 55 || merit >= 58) {
      return {
        status: "referred_to_bureau",
        meritDelta: 2,
        riskDelta: -1,
        progressDelta: 6,
        nextStep: "交相关部院列可行、不可行与待查三项，后续仍走普通回合。"
      };
    }
    return {
      status: "returned_for_evidence",
      meritDelta: 1,
      riskDelta: 1,
      progressDelta: 3,
      nextStep: "补齐公开进度、经手人和限期，再提交朝议。"
    };
  }
  if (progress >= 70 && risk <= 35) {
    return {
      status: "accepted_for_review",
      meritDelta: 3,
      riskDelta: -2,
      progressDelta: 7,
      nextStep: "准入奏折队列，由部院复核公开凭据后再入长期考成。"
    };
  }
  if (risk >= 55) {
    return {
      status: "held_for_inquiry",
      meritDelta: 1,
      riskDelta: 2,
      progressDelta: 2,
      nextStep: "留中补查风险来源，不据此直接成弹劾或处分。"
    };
  }
  if (progress >= 35 || merit >= 50) {
    return {
      status: "referred_to_bureau",
      meritDelta: 2,
      riskDelta: 0,
      progressDelta: 5,
      nextStep: "转交本衙门复核文案、限期和经手凭据。"
    };
  }
  return {
    status: "returned_for_evidence",
    meritDelta: 1,
    riskDelta: 1,
    progressDelta: 3,
    nextStep: "补公开凭据后再入奏折队列。"
  };
}

function buildResolutionSummary({ submission, assignment, statusLabel, decision }) {
  const title = cleanText(assignment.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const progress = clampNumber(assignment.progress, 0, 100, 0);
  const risk = clampNumber(assignment.risk, 0, 100, 20);
  const surface = cleanText(submission.label, "奏折队列", 40);
  const effect = decision.meritDelta || decision.riskDelta
    ? `考成微调为功绩${decision.meritDelta >= 0 ? "+" : ""}${decision.meritDelta}、风险${decision.riskDelta >= 0 ? "+" : ""}${decision.riskDelta}`
    : "暂不改考成数值";
  return cleanText(
    `${statusLabel}：${title}已入${surface}服务器裁决，公开进度${progress}、风险${risk}；${effect}，不直接任免、奖惩、处分或成弹劾。`
  );
}

function resolveOfficialCourtEntrySubmission(worldState = {}, career = {}, courtEntry = {}, firstMonthExperience = {}, input = "") {
  const submission = classifyOfficialCourtEntrySubmission(input, courtEntry, firstMonthExperience);
  if (!submission) return null;
  const assignment = isPlainObject(firstMonthExperience.assignment) ? firstMonthExperience.assignment : {};
  const dossier = isPlainObject(career.assessmentDossier) ? career.assessmentDossier : {};
  const decision = chooseResolutionDecision(submission, assignment, dossier);
  const statusLabel = statusLabelForResolution(decision.status);
  const turn = currentTurn(worldState);
  const existingCount = normalizeOfficialCourtEntryResolutions(career.courtEntryResolutions, worldState).length + 1;
  const assignmentId = cleanId(assignment.id, "first-month-assignment");
  const entryId = cleanId(courtEntry.id, `official-court-entry-first-month-${assignmentId}`);
  const title = cleanText(`${statusLabel}：${assignment.title || courtEntry.title || "首月回署材料"}`);
  const publicSummary = buildResolutionSummary({ submission, assignment, statusLabel, decision });
  return normalizeOfficialCourtEntryResolution({
    id: `OCER-${String(turn).padStart(4, "0")}-${submission.surfaceId}-${existingCount}`,
    entryId,
    assignmentId,
    surfaceId: submission.surfaceId,
    submissionKind: submission.submissionKind,
    status: decision.status,
    statusLabel,
    title,
    publicSummary,
    serverDecision: `${statusLabel}只写入公开回署裁决记录；长期奖惩、任免、弹劾和最终考成仍由后续服务器规则结算。`,
    meritDelta: decision.meritDelta,
    riskDelta: decision.riskDelta,
    progressDelta: decision.progressDelta,
    generatedAtTurn: turn,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs: [
      `officialCareer.courtEntry:${entryId}`,
      `officialCareer.assignment:${assignmentId}`,
      `surface:${submission.surfaceId}`,
      "officialCareer.assessmentDossier"
    ],
    nextStep: decision.nextStep
  }, worldState);
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
  const resolutionHistory = normalizeOfficialCourtEntryResolutions(career.courtEntryResolutions, worldState)
    .filter((resolution) => resolution.entryId === id)
    .slice(-OFFICIAL_COURT_ENTRY_LIMITS.maxResolutionHistory);
  const latestResolution = latestResolutionForEntry(id, resolutionHistory);

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
    latestResolution,
    resolutionHistory,
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
        targetSurfaceId: "assessment-trace"
      }
    ].slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxActions),
    authorityBoundary: OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY
  };
}

function buildOfficialCourtEntryEvidenceRows(courtEntry = {}) {
  if (!isPlainObject(courtEntry) || courtEntry.active !== true) return [];
  const latest = isPlainObject(courtEntry.latestResolution) ? courtEntry.latestResolution : null;
  return [{
    id: cleanId(courtEntry.id, "official-court-entry"),
    sourceId: cleanId(courtEntry.id, "official-court-entry"),
    title: cleanText(courtEntry.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength),
    publicSummary: cleanText(
      latest ? `${courtEntry.publicSummary} 近次裁决：${latest.publicSummary}` : courtEntry.publicSummary,
      "首月回署材料可入奏折或朝议筹议。"
    ),
    statusLabel: cleanText(latest?.statusLabel || courtEntry.statusLabel, "待筹议", 32),
    visibility: "player_visible",
    confidence: 0.82,
    generatedAtTurn: clampNumber(latest?.generatedAtTurn || courtEntry.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
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
  buildOfficialCourtEntryView,
  normalizeOfficialCourtEntryResolution,
  normalizeOfficialCourtEntryResolutions,
  resolveOfficialCourtEntrySubmission
};
