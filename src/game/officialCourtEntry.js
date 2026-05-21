const {
  cleanOfficialFirstMonthText
} = require("./officialFirstMonth");
const {
  OFFICIAL_COURT_ENTRY_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_AI_READ_SCOPE,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_AUTHORITY_BOUNDARY,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_SCHEMA_VERSION,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_SERVER_ADJUDICATION,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGE_LABELS,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGES,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUS_LABELS,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUSES,
  OFFICIAL_COURT_ENTRY_FOLLOW_UP_TOOL_PERMISSIONS,
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
    latestFollowUp: null,
    followUpHistory: [],
    followUpScenePreview: null,
    followUpNextActions: [],
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

function normalizeFollowUpStage(value, fallback = "bureau_review") {
  const stage = cleanId(value, fallback);
  return OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGES.includes(stage) ? stage : fallback;
}

function followUpStageLabel(stage) {
  return OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGE_LABELS[stage] ||
    OFFICIAL_COURT_ENTRY_FOLLOW_UP_STAGE_LABELS.bureau_review;
}

function normalizeFollowUpStatus(value, fallback = "referred_to_bureau") {
  const status = cleanId(value, fallback);
  return OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUSES.includes(status) ? status : fallback;
}

function followUpStatusLabel(status) {
  return OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUS_LABELS[status] ||
    OFFICIAL_COURT_ENTRY_FOLLOW_UP_STATUS_LABELS.referred_to_bureau;
}

function normalizeFollowUpParticipants(participants = []) {
  return asArray(participants)
    .map((participant, index) => {
      if (!isPlainObject(participant)) return null;
      const roleLabel = cleanText(participant.roleLabel || participant.label || participant.actorLabel, "", 48);
      const publicPosition = cleanText(
        participant.publicPosition || participant.summary || participant.position,
        "",
        OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
      );
      if (!roleLabel || !publicPosition) return null;
      return {
        actorId: cleanId(participant.actorId || participant.id, `court-follow-up-actor-${index + 1}`),
        roleLabel,
        publicPosition,
        evidenceRefs: cleanList(participant.evidenceRefs || participant.sourceRefs, 3, 96)
      };
    })
    .filter(Boolean)
    .slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxFollowUpActors);
}

function normalizeFollowUpProposals(proposals = []) {
  return asArray(proposals)
    .map((proposal, index) => {
      if (!isPlainObject(proposal)) {
        const text = cleanText(proposal, "", OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength);
        return text ? {
          id: `court-follow-up-proposal-${index + 1}`,
          actorLabel: "公开意见",
          proposalKind: "procedural_note",
          publicPosition: text
        } : null;
      }
      const actorLabel = cleanText(proposal.actorLabel || proposal.roleLabel || proposal.label, "公开意见", 48);
      const publicPosition = cleanText(
        proposal.publicPosition || proposal.summary || proposal.text,
        "",
        OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
      );
      if (!publicPosition) return null;
      return {
        id: cleanId(proposal.id, `court-follow-up-proposal-${index + 1}`),
        actorLabel,
        proposalKind: cleanId(proposal.proposalKind || proposal.kind, "procedural_note"),
        publicPosition,
        evidenceRefs: cleanList(proposal.evidenceRefs || proposal.sourceRefs, 3, 96)
      };
    })
    .filter(Boolean)
    .slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxFollowUpProposals);
}

function normalizeOfficialCourtEntryFollowUp(raw = {}, worldState = {}) {
  if (!isPlainObject(raw)) return null;
  const turn = clampNumber(raw.generatedAtTurn ?? raw.turn, 0, Number.MAX_SAFE_INTEGER, currentTurn(worldState));
  const entryId = cleanId(raw.entryId || raw.courtEntryId, "official-court-entry");
  const resolutionId = cleanId(raw.resolutionId, "");
  const stage = normalizeFollowUpStage(raw.stage, "bureau_review");
  const status = normalizeFollowUpStatus(raw.status, "referred_to_bureau");
  const stageLabel = cleanText(raw.stageLabel, followUpStageLabel(stage), 40);
  const statusLabel = cleanText(raw.statusLabel, followUpStatusLabel(status), 40);
  const title = cleanText(raw.title, `${stageLabel}：首月奏议`, OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const publicSummary = cleanText(
    raw.publicSummary || raw.summary,
    "",
    OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
  );
  if (!title || !publicSummary) return null;

  const participantSummaries = normalizeFollowUpParticipants(raw.participantSummaries);
  const proposalSummaries = normalizeFollowUpProposals(raw.proposalSummaries);
  return {
    schemaVersion: OFFICIAL_COURT_ENTRY_FOLLOW_UP_SCHEMA_VERSION,
    id: cleanId(raw.id, `OCEF-${String(turn).padStart(4, "0")}-${stage}`),
    entryId,
    resolutionId,
    assignmentId: cleanId(raw.assignmentId, "first-month-assignment"),
    stage,
    stageLabel,
    status,
    statusLabel,
    title,
    publicSummary,
    participantSummaries,
    proposalSummaries,
    serverDecision: cleanText(
      raw.serverDecision,
      OFFICIAL_COURT_ENTRY_FOLLOW_UP_SERVER_ADJUDICATION,
      OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
    ),
    meritDelta: clampNumber(raw.meritDelta, -4, 4, 0),
    riskDelta: clampNumber(raw.riskDelta, -4, 4, 0),
    progressDelta: clampNumber(raw.progressDelta, 0, 12, 0),
    generatedAtTurn: turn,
    year: clampNumber(raw.year, 1, 9999, clampNumber(worldState.year, 1, 9999, 1644)),
    month: clampNumber(raw.month, 1, 12, clampNumber(worldState.month, 1, 12, 1)),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, 3, clampNumber(worldState.tenDayPeriod, 1, 3, 1)),
    sourceRefs: cleanList(raw.sourceRefs, OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs, 96),
    consequenceRefs: cleanList(raw.consequenceRefs, OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs, 96),
    nextStep: cleanText(
      raw.nextStep,
      "后续仍按普通回合补证、复核和考成结算。",
      OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength
    ),
    aiReadScope: cleanList(
      raw.aiReadScope || OFFICIAL_COURT_ENTRY_FOLLOW_UP_AI_READ_SCOPE,
      OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs,
      96
    ),
    actorIntelligence: cleanText(
      raw.actorIntelligence,
      "皇帝、部院、台谏和上官只按玩家可见公开材料形成中间意见。",
      OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
    ),
    toolPermissions: cleanText(
      raw.toolPermissions,
      OFFICIAL_COURT_ENTRY_FOLLOW_UP_TOOL_PERMISSIONS,
      OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
    ),
    serverAdjudication: cleanText(
      raw.serverAdjudication,
      OFFICIAL_COURT_ENTRY_FOLLOW_UP_SERVER_ADJUDICATION,
      OFFICIAL_COURT_ENTRY_LIMITS.maxTextLength
    ),
    authorityBoundary: OFFICIAL_COURT_ENTRY_FOLLOW_UP_AUTHORITY_BOUNDARY
  };
}

function normalizeOfficialCourtEntryFollowUps(followUps = [], worldState = {}) {
  return asArray(followUps)
    .map((followUp) => normalizeOfficialCourtEntryFollowUp(followUp, worldState))
    .filter(Boolean)
    .slice(-OFFICIAL_COURT_ENTRY_LIMITS.maxFollowUpHistory);
}

function latestFollowUpForEntry(entryId, followUps = []) {
  const id = cleanId(entryId, "");
  if (!id) return null;
  return normalizeOfficialCourtEntryFollowUps(followUps)
    .filter((followUp) => followUp.entryId === id)
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

function classifyOfficialCourtEntryFollowUpSubmission(input = "", courtEntry = {}, firstMonthExperience = {}) {
  const text = cleanText(input, "", 360);
  if (!text || courtEntry.active !== true || !isPlainObject(courtEntry.latestResolution)) return null;
  const assignmentTitle = cleanText(firstMonthExperience.assignment?.title, "", 80);
  const entryTitle = cleanText(courtEntry.title, "", 80);
  const latestTitle = cleanText(courtEntry.latestResolution.title, "", 80);
  const touchesEntry = /近次裁决|后续|跟进|覆奏|复核|批示|摘报|御前|部院|朝议|廷议|考成观察/.test(text) ||
    [assignmentTitle, entryTitle, latestTitle].filter(Boolean).some((title) => text.includes(title));
  if (!touchesEntry) return null;

  if (/御前|御览|摘报|批示|批红|圣裁|留中/.test(text)) {
    return { stage: "imperial_note", label: "御前摘报" };
  }
  if (/部院覆奏|覆奏|部院复核|部议|转部核议|相关部院|司官核/.test(text)) {
    return { stage: "bureau_review", label: "部院覆奏" };
  }
  if (/考成观察|考成复核|考成追踪|续入考成|继续考成|考成簿/.test(text)) {
    return { stage: "assessment_watch", label: "考成观察" };
  }
  if (/朝议跟进|廷议跟进|朝议后|廷议后|诸臣|会商|筹议后续|可行、不可行|可行不可行|待查/.test(text)) {
    return { stage: "court_deliberation", label: "朝议跟进" };
  }
  return null;
}

function bureauForAssignment(assignment = {}) {
  const bureauId = cleanId(assignment.bureauId, "");
  const kind = cleanId(assignment.kind, "");
  const byId = {
    hanlin_academy: "翰林院",
    ministry_personnel: "吏部",
    ministry_revenue: "户部",
    ministry_rites: "礼部",
    ministry_justice: "刑部",
    ministry_war: "兵部",
    ministry_works: "工部",
    censorate: "都察院"
  };
  if (byId[bureauId]) return { id: bureauId, label: byId[bureauId] };
  if (kind === "military_supply") return { id: "ministry_war", label: "兵部" };
  if (kind === "exam_supervision" || kind === "memorial_drafting") return { id: "ministry_rites", label: "礼部" };
  if (kind === "case_review") return { id: "ministry_justice", label: "刑部" };
  if (kind === "riverworks") return { id: "ministry_works", label: "工部" };
  if (kind === "relief" || kind === "land_survey" || kind === "salt_transport") return { id: "ministry_revenue", label: "户部" };
  return { id: "ministry_personnel", label: "吏部" };
}

function buildFollowUpParticipantSummaries({ stage, assignment, latestResolution, sourceRefs }) {
  const bureau = bureauForAssignment(assignment);
  const title = cleanText(assignment.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const statusLabel = cleanText(latestResolution.statusLabel, "近次裁决", 40);
  const participantsByStage = {
    court_deliberation: [
      {
        actorId: "imperial-desk",
        roleLabel: "御前",
        publicPosition: `御前只准诸臣围绕${title}列可行、不可行与待查，不据${statusLabel}直接授官赏罚。`
      },
      {
        actorId: bureau.id,
        roleLabel: bureau.label,
        publicPosition: `${bureau.label}先核公开凭据、经手人和限期，再决定是否覆奏。`
      },
      {
        actorId: "censorate",
        roleLabel: "台谏",
        publicPosition: `台谏只盯避嫌、浮报和民情反噬，弹劾成案仍须后续服务器规则。`
      }
    ],
    bureau_review: [
      {
        actorId: bureau.id,
        roleLabel: bureau.label,
        publicPosition: `${bureau.label}承接${statusLabel}，要求补齐可核证据和回署文移。`
      },
      {
        actorId: "current-superior",
        roleLabel: "上官",
        publicPosition: `上官只按首月进度、风险和署中问答出具公开回话。`
      },
      {
        actorId: "censorate",
        roleLabel: "台谏",
        publicPosition: "台谏保留观察，未见公开实据前不成处分或弹劾。"
      }
    ],
    imperial_note: [
      {
        actorId: "imperial-desk",
        roleLabel: "御前",
        publicPosition: `御前收作摘报，只给部院和台谏后续核议边界，不直接改官职。`
      },
      {
        actorId: bureau.id,
        roleLabel: bureau.label,
        publicPosition: `${bureau.label}须把${title}的功过、风险和待查项拆开覆奏。`
      },
      {
        actorId: "censorate",
        roleLabel: "台谏",
        publicPosition: "台谏只记录可见风险，等待公开凭据和后续回合。"
      }
    ],
    assessment_watch: [
      {
        actorId: "ministry_personnel",
        roleLabel: "吏部",
        publicPosition: `吏部把${title}列为考成观察，不据单次奏议定升降。`
      },
      {
        actorId: bureau.id,
        roleLabel: bureau.label,
        publicPosition: `${bureau.label}继续保存回署凭据，待考成期合并结算。`
      },
      {
        actorId: "censorate",
        roleLabel: "台谏",
        publicPosition: "台谏仅保留风险标记，不把观察等同成案。"
      }
    ]
  };
  return normalizeFollowUpParticipants(
    (participantsByStage[stage] || participantsByStage.bureau_review).map((participant) => ({
      ...participant,
      evidenceRefs: sourceRefs
    }))
  );
}

function chooseFollowUpDecision(submission = {}, latestResolution = {}, assignment = {}, dossier = {}) {
  const stage = normalizeFollowUpStage(submission.stage, "bureau_review");
  const resolutionStatus = normalizeResolutionStatus(latestResolution.status, "referred_to_bureau");
  const progress = clampNumber(assignment.progress, 0, 100, 0);
  const risk = Math.max(
    clampNumber(assignment.risk, 0, 100, 20),
    clampNumber(dossier.riskScore, 0, 100, 0)
  );
  if (resolutionStatus === "returned_for_evidence" || (resolutionStatus === "held_for_inquiry" && risk >= 48)) {
    return {
      status: "returned_for_evidence",
      meritDelta: 0,
      riskDelta: 1,
      progressDelta: 1,
      nextStep: "先补公开凭据、上官问答和经手文移，再择期重入朝议或部院覆奏。"
    };
  }
  if (stage === "imperial_note") {
    return {
      status: "imperial_noted",
      meritDelta: progress >= 60 ? 1 : 0,
      riskDelta: risk >= 58 ? 1 : -1,
      progressDelta: 2,
      nextStep: "御前只作摘报留览，仍令部院按公开凭据复核，不直接任免赏罚。"
    };
  }
  if (stage === "assessment_watch" || resolutionStatus === "recorded_for_assessment") {
    return {
      status: "recorded_for_assessment",
      meritDelta: progress >= 55 ? 1 : 0,
      riskDelta: risk >= 58 ? 1 : 0,
      progressDelta: 2,
      nextStep: "继续写入本任考成观察，待考成期合并服务器结算。"
    };
  }
  if (stage === "court_deliberation") {
    return {
      status: "deliberated",
      meritDelta: progress >= 55 ? 1 : 0,
      riskDelta: risk >= 62 ? 1 : 0,
      progressDelta: 3,
      nextStep: "朝议只成公开意见，后续仍须部院覆奏或补据复核。"
    };
  }
  return {
    status: "referred_to_bureau",
    meritDelta: progress >= 50 ? 1 : 0,
    riskDelta: risk >= 60 ? 1 : -1,
    progressDelta: 4,
    nextStep: "相关部院待覆，下一步补齐公开凭据、限期和经手人。"
  };
}

function buildFollowUpProposalSummaries(participants = [], stage = "bureau_review") {
  const proposalKind = stage === "assessment_watch" ? "career_follow_up" : "procedural_note";
  return normalizeFollowUpProposals(participants.map((participant) => ({
    actorLabel: participant.roleLabel,
    proposalKind,
    publicPosition: participant.publicPosition,
    evidenceRefs: participant.evidenceRefs
  })));
}

function buildFollowUpSummary({ submission, assignment, latestResolution, statusLabel, decision }) {
  const title = cleanText(assignment.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const latestLabel = cleanText(latestResolution.statusLabel, "近次裁决", 40);
  const stageLabel = cleanText(submission.label || followUpStageLabel(submission.stage), "部院覆奏", 40);
  const effect = decision.meritDelta || decision.riskDelta || decision.progressDelta
    ? `考成中间影响为功绩${decision.meritDelta >= 0 ? "+" : ""}${decision.meritDelta}、风险${decision.riskDelta >= 0 ? "+" : ""}${decision.riskDelta}、进度+${decision.progressDelta}`
    : "暂不改考成数值";
  return cleanText(
    `${statusLabel}：${title}承接近次${latestLabel}进入${stageLabel}，皇帝、部院、台谏只形成公开中间意见；${effect}，不直接任免、奖惩、处分或成弹劾。`
  );
}

function resolveOfficialCourtEntryFollowUpSubmission(worldState = {}, career = {}, courtEntry = {}, firstMonthExperience = {}, input = "") {
  const submission = classifyOfficialCourtEntryFollowUpSubmission(input, courtEntry, firstMonthExperience);
  if (!submission) return null;
  const latestResolution = isPlainObject(courtEntry.latestResolution)
    ? courtEntry.latestResolution
    : latestResolutionForEntry(courtEntry.id, career.courtEntryResolutions);
  if (!latestResolution) return null;
  const assignment = isPlainObject(firstMonthExperience.assignment) ? firstMonthExperience.assignment : {};
  const dossier = isPlainObject(career.assessmentDossier) ? career.assessmentDossier : {};
  const decision = chooseFollowUpDecision(submission, latestResolution, assignment, dossier);
  const statusLabel = followUpStatusLabel(decision.status);
  const turn = currentTurn(worldState);
  const existingCount = normalizeOfficialCourtEntryFollowUps(career.courtEntryFollowUps, worldState).length + 1;
  const assignmentId = cleanId(assignment.id || latestResolution.assignmentId, "first-month-assignment");
  const entryId = cleanId(courtEntry.id || latestResolution.entryId, `official-court-entry-first-month-${assignmentId}`);
  const sourceRefs = [
    `officialCareer.courtEntry:${entryId}`,
    latestResolution.id ? `officialCareer.courtEntryResolution:${latestResolution.id}` : "",
    `officialCareer.assignment:${assignmentId}`,
    `stage:${submission.stage}`
  ].filter(Boolean);
  const participantSummaries = buildFollowUpParticipantSummaries({
    stage: submission.stage,
    assignment,
    latestResolution,
    sourceRefs
  });
  const proposalSummaries = buildFollowUpProposalSummaries(participantSummaries, submission.stage);
  const publicSummary = buildFollowUpSummary({ submission, assignment, latestResolution, statusLabel, decision });
  return normalizeOfficialCourtEntryFollowUp({
    id: `OCEF-${String(turn).padStart(4, "0")}-${submission.stage}-${existingCount}`,
    entryId,
    resolutionId: latestResolution.id,
    assignmentId,
    stage: submission.stage,
    stageLabel: submission.label,
    status: decision.status,
    statusLabel,
    title: `${submission.label}：${assignment.title || courtEntry.title || "首月奏议"}`,
    publicSummary,
    participantSummaries,
    proposalSummaries,
    serverDecision: `${submission.label}只写入首月奏议后续公开记录；官缺、奖惩、处分、弹劾和长期世界后果仍由后续服务器规则结算。`,
    meritDelta: decision.meritDelta,
    riskDelta: decision.riskDelta,
    progressDelta: decision.progressDelta,
    generatedAtTurn: turn,
    year: worldState.year,
    month: worldState.month,
    tenDayPeriod: worldState.tenDayPeriod,
    sourceRefs,
    consequenceRefs: [
      "worldThread:official_court_follow_up",
      "eventArchive:official_court_follow_up",
      "playerMonthlyBriefing:official_duties"
    ],
    nextStep: decision.nextStep
  }, worldState);
}

function buildFollowUpScenePreview({ title, latestResolution, latestFollowUp, assignment }) {
  if (!latestResolution) return null;
  const sourceRefs = [
    latestResolution.id ? `officialCareer.courtEntryResolution:${latestResolution.id}` : "",
    assignment?.id ? `officialCareer.assignment:${assignment.id}` : ""
  ].filter(Boolean);
  const participants = latestFollowUp?.participantSummaries?.length
    ? latestFollowUp.participantSummaries
    : buildFollowUpParticipantSummaries({
      stage: latestResolution.status === "recorded_for_assessment" ? "assessment_watch" : "bureau_review",
      assignment,
      latestResolution,
      sourceRefs
    });
  return {
    sceneType: "official_court_follow_up",
    title: cleanText(`${title}后续朝议`, "首月奏议后续", 80),
    serverAdjudicated: Boolean(latestFollowUp),
    latestStage: latestFollowUp?.stage || null,
    participantLabels: participants
      .map((participant) => cleanText(participant.roleLabel, "", 48))
      .filter(Boolean)
      .slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxFollowUpActors),
    proposalBudget: {
      maxRounds: 1,
      maxActors: Math.max(1, participants.length)
    },
    authorityBoundary: OFFICIAL_COURT_ENTRY_FOLLOW_UP_AUTHORITY_BOUNDARY
  };
}

function buildFollowUpNextActions({ title, latestResolution }) {
  if (!latestResolution) return [];
  const cleanTitle = cleanText(title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength);
  const statusLabel = cleanText(latestResolution.statusLabel, "近次裁决", 40);
  return [
    {
      id: "court-follow-up",
      label: "朝议跟进",
      text: cleanText(`就${cleanTitle}按近次裁决${statusLabel}作朝议跟进，令诸臣只列可行、不可行和待查事项。`),
      targetSurfaceId: "court-debate"
    },
    {
      id: "bureau-reply",
      label: "部院覆奏",
      text: cleanText(`请相关部院就${cleanTitle}承接近次裁决${statusLabel}覆奏，列明公开凭据、经手人、限期和仍须服务器裁决之处。`),
      targetSurfaceId: "memorial-review"
    },
    {
      id: "imperial-digest",
      label: "御前摘报",
      text: cleanText(`拟御前摘报${cleanTitle}：只摘近次裁决${statusLabel}、部院疑点、台谏风险和后续普通回合可办事项。`),
      targetSurfaceId: "edict-draft"
    },
    {
      id: "assessment-watch",
      label: "考成观察",
      text: cleanText(`续作${cleanTitle}考成观察，承接近次裁决${statusLabel}，只记录公开功绩、风险和后续待核证据。`),
      targetSurfaceId: "assessment-trace"
    }
  ].slice(0, OFFICIAL_COURT_ENTRY_LIMITS.maxActions);
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
  const followUpHistory = normalizeOfficialCourtEntryFollowUps(career.courtEntryFollowUps, worldState)
    .filter((followUp) => followUp.entryId === id)
    .slice(-OFFICIAL_COURT_ENTRY_LIMITS.maxFollowUpHistory);
  const latestFollowUp = latestFollowUpForEntry(id, followUpHistory);
  const followUpScenePreview = buildFollowUpScenePreview({
    title,
    latestResolution,
    latestFollowUp,
    assignment
  });
  const followUpNextActions = buildFollowUpNextActions({ title, latestResolution });

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
    latestFollowUp,
    followUpHistory,
    followUpScenePreview,
    followUpNextActions,
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
  const latestFollowUp = isPlainObject(courtEntry.latestFollowUp) ? courtEntry.latestFollowUp : null;
  const summaryParts = [
    courtEntry.publicSummary,
    latest ? `近次裁决：${latest.publicSummary}` : "",
    latestFollowUp ? `后续批复：${latestFollowUp.publicSummary}` : ""
  ].filter(Boolean);
  return [{
    id: cleanId(courtEntry.id, "official-court-entry"),
    sourceId: cleanId(courtEntry.id, "official-court-entry"),
    title: cleanText(courtEntry.title, "首月回署材料", OFFICIAL_COURT_ENTRY_LIMITS.maxShortTextLength),
    publicSummary: cleanText(
      summaryParts.join(" "),
      "首月回署材料可入奏折或朝议筹议。"
    ),
    statusLabel: cleanText(latestFollowUp?.statusLabel || latest?.statusLabel || courtEntry.statusLabel, "待筹议", 32),
    visibility: "player_visible",
    confidence: 0.82,
    generatedAtTurn: clampNumber(latestFollowUp?.generatedAtTurn || latest?.generatedAtTurn || courtEntry.generatedAtTurn, 0, Number.MAX_SAFE_INTEGER, 0),
    relatedRefs: cleanList([
      ...(Array.isArray(courtEntry.sourceRefs) ? courtEntry.sourceRefs : []),
      ...(Array.isArray(latestFollowUp?.sourceRefs) ? latestFollowUp.sourceRefs : [])
    ], OFFICIAL_COURT_ENTRY_LIMITS.maxSourceRefs, 96),
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
  normalizeOfficialCourtEntryFollowUp,
  normalizeOfficialCourtEntryFollowUps,
  normalizeOfficialCourtEntryResolution,
  normalizeOfficialCourtEntryResolutions,
  resolveOfficialCourtEntryFollowUpSubmission,
  resolveOfficialCourtEntrySubmission
};
