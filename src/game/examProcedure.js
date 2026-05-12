const { getExam } = require("./exams");
const {
  EXAM_PROCEDURE_LIMITS,
  EXAM_PROCEDURE_PHASES,
  EXAM_PROCEDURE_PROFILE,
  EXAM_PROCEDURE_SCHEMA_VERSION,
  EXAM_SCENE_TO_PROCEDURE_PHASE
} = require("./examProcedureConfig");
const {
  buildExaminerPanelView,
  summarizeExaminerPanelForPrompt
} = require("./examReview");

const PHASE_BY_KEY = new Map(EXAM_PROCEDURE_PHASES.map((phase) => [phase.key, phase]));
const PHASE_INDEX = new Map(EXAM_PROCEDURE_PHASES.map((phase, index) => [phase.key, index]));
const UNSAFE_PUBLIC_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent/gi,
  /raw provider|raw_provider|provider proposal|raw audit|raw_audit/gi,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/gi,
  /data\/sessions|\/mnt\/|[A-Z]:\\/gi
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = EXAM_PROCEDURE_LIMITS.textPreviewLength) {
  if (typeof value !== "string") return fallback;
  let trimmed = value.trim().replace(/\s+/g, " ");
  for (const pattern of UNSAFE_PUBLIC_TEXT_PATTERNS) {
    trimmed = trimmed.replace(pattern, "已遮蔽");
  }
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getProfile(level) {
  return EXAM_PROCEDURE_PROFILE[level] || EXAM_PROCEDURE_PROFILE.child_exam;
}

function getPhase(key, fallback = "eligibility_check") {
  return PHASE_BY_KEY.get(key) || PHASE_BY_KEY.get(fallback) || EXAM_PROCEDURE_PHASES[0];
}

function getPhaseIndex(key) {
  return PHASE_INDEX.get(key) ?? 0;
}

function pickSubStage(level, scenePhase) {
  const profile = getProfile(level);
  const subStages = Array.isArray(profile.subStages) ? profile.subStages : [];
  if (!subStages.length) {
    return { key: "main_exam", label: "本场", paperType: getExam(level)?.questionType || "科题" };
  }

  if (subStages.length === 1) return subStages[0];
  const sceneIndex = {
    entry: 0,
    question_review: 0,
    outline: 0,
    drafting: 1,
    fair_copy: 2,
    submitted: subStages.length - 1
  }[scenePhase] ?? 0;
  return subStages[Math.min(sceneIndex, subStages.length - 1)];
}

function buildPapers(level) {
  const profile = getProfile(level);
  const subStages = Array.isArray(profile.subStages) ? profile.subStages : [];
  return subStages.map((stage, index) => ({
    sessionIndex: index + 1,
    sessionCount: profile.sessionCount || subStages.length || 1,
    subStage: stage.key,
    subStageLabel: stage.label,
    paperType: stage.paperType,
    status: index === 0 ? "in_progress" : "pending",
    publicSummary: `${stage.label}以${stage.paperType}为主，成绩并入本场服务器总评。`
  }));
}

function summarizeSponsorship(activeExam = {}) {
  const sponsorship = activeExam.entryPreparation?.sponsorship || {};
  const status = sponsorship.status || "not_ready";
  const ready = status === "ready" || sponsorship.ready === true;
  return {
    status,
    ready,
    score: clampNumber(sponsorship.score, 0, 100, 0),
    guarantorName: cleanText(sponsorship.guarantorName || sponsorship.teacherName || "", "", 48),
    publicSummary: cleanText(
      sponsorship.publicSummary,
      ready ? "保结已具，可随场入册。" : "保结尚未十足，只作入场准备摘要，不替代准考资格。"
    )
  };
}

function buildEntrySearch(activeExam = {}) {
  const readiness = activeExam.readiness || {};
  const missing = Array.isArray(readiness.missing) ? readiness.missing.length : 0;
  return {
    status: missing ? "cautioned" : "clear",
    publicSummary: missing
      ? "入场搜检未见夹带，但学力准备仍有欠缺，心态须稳。"
      : "入场搜检未见夹带，点名入席。"
  };
}

function buildCell(activeExam = {}) {
  const profile = getProfile(activeExam.level);
  const subStage = pickSubStage(activeExam.level, activeExam.sceneTime?.phase || activeExam.scenePhase);
  return {
    status: "assigned",
    subStage: subStage.key,
    subStageLabel: subStage.label,
    publicSummary: profile.cellSummary
  };
}

function buildRollLifecycle(phaseKey = "eligibility_check", options = {}) {
  const phaseIndex = getPhaseIndex(phaseKey);
  return {
    draftRoll: phaseIndex >= getPhaseIndex("drafting"),
    inkRoll: phaseIndex >= getPhaseIndex("submission"),
    sealed: phaseIndex >= getPhaseIndex("sealing"),
    transcribed: phaseIndex >= getPhaseIndex("transcription"),
    collated: phaseIndex >= getPhaseIndex("collation"),
    audited: phaseIndex >= getPhaseIndex("audit_review"),
    publicSummary: options.publicSummary || "卷件流程只显示公开摘要；弥封身份映射、考官私意和原始复核材料不入玩家视图。"
  };
}

function createIncident(type, label, detail) {
  return {
    type,
    label,
    publicSummary: cleanText(detail, label)
  };
}

function buildInitialIncidents(activeExam = {}) {
  const incidents = [];
  const sponsorship = activeExam.entryPreparation?.sponsorship;
  if (sponsorship?.status && sponsorship.status !== "ready") {
    incidents.push(createIncident("sponsorship", "保结未稳", "保结只作入场准备摘要，仍需服务器按资格和考期准入。"));
  }
  if (activeExam.entryPreparation && activeExam.entryPreparation.fullyFunded === false) {
    incidents.push(createIncident("travel_shortfall", "盘费不足", "赶考盘费不足已折入健康、心态或应变风险。"));
  }
  return incidents;
}

function normalizeProcedure(procedure = {}, activeExam = {}) {
  const level = cleanText(procedure.level || activeExam.level, "child_exam", 40);
  const profile = getProfile(level);
  const scenePhase = activeExam.sceneTime?.phase || activeExam.scenePhase || "entry";
  const mappedPhase = EXAM_SCENE_TO_PROCEDURE_PHASE[scenePhase] || procedure.phase || "eligibility_check";
  const phase = getPhase(procedure.phase || mappedPhase);
  const subStage = pickSubStage(level, scenePhase);
  const papers = Array.isArray(procedure.papers) && procedure.papers.length
    ? procedure.papers
    : buildPapers(level);

  return {
    schemaVersion: EXAM_PROCEDURE_SCHEMA_VERSION,
    level,
    examName: cleanText(procedure.examName || activeExam.examName || getExam(level)?.name || "考试", "考试", 48),
    phase: phase.key,
    phaseLabel: phase.label,
    subStage: cleanText(procedure.subStage || subStage.key, subStage.key, 48),
    subStageLabel: cleanText(procedure.subStageLabel || subStage.label, subStage.label, 48),
    sessionIndex: clampNumber(procedure.sessionIndex, 1, profile.sessionCount || 1, subStage === pickSubStage(level, scenePhase) ? (
      Math.max(1, (profile.subStages || []).findIndex((stage) => stage.key === subStage.key) + 1)
    ) : 1),
    sessionCount: clampNumber(procedure.sessionCount, 1, 9, profile.sessionCount || 1),
    paperType: cleanText(procedure.paperType || subStage.paperType || getExam(level)?.questionType || "科题", "科题", 64),
    sponsorship: isPlainObject(procedure.sponsorship) ? procedure.sponsorship : summarizeSponsorship(activeExam),
    entrySearch: isPlainObject(procedure.entrySearch) ? procedure.entrySearch : buildEntrySearch(activeExam),
    cell: isPlainObject(procedure.cell) ? procedure.cell : buildCell(activeExam),
    rollLifecycle: isPlainObject(procedure.rollLifecycle) ? procedure.rollLifecycle : buildRollLifecycle(phase.key),
    papers,
    incidents: Array.isArray(procedure.incidents) ? procedure.incidents : buildInitialIncidents(activeExam),
    auditFlags: Array.isArray(procedure.auditFlags) ? procedure.auditFlags : [],
    examinerPanel: isPlainObject(procedure.examinerPanel) ? procedure.examinerPanel : null,
    resultSummary: cleanText(procedure.resultSummary, "", 160),
    visibleNextActions: Array.isArray(procedure.visibleNextActions) ? procedure.visibleNextActions : [],
    authorityBoundary: "examProcedureView 由服务器从 activeExam、sceneTime、入场准备和交卷复核派生；AI 不得写准考、弥封映射、榜单、名次或官职。"
  };
}

function syncProcedureToScene(activeExam = {}, targetPhase = null) {
  if (!isPlainObject(activeExam)) return null;
  const existing = isPlainObject(activeExam.procedure) ? activeExam.procedure : {};
  const scenePhase = activeExam.sceneTime?.phase || activeExam.scenePhase || "entry";
  const phaseKey = targetPhase || EXAM_SCENE_TO_PROCEDURE_PHASE[scenePhase] || existing.phase || "eligibility_check";
  const subStage = pickSubStage(activeExam.level, scenePhase);
  const profile = getProfile(activeExam.level);
  const subStageIndex = Math.max(0, (profile.subStages || []).findIndex((stage) => stage.key === subStage.key));
  const procedure = normalizeProcedure({
    ...existing,
    phase: phaseKey,
    subStage: subStage.key,
    subStageLabel: subStage.label,
    sessionIndex: subStageIndex + 1,
    sessionCount: profile.sessionCount || 1,
    paperType: subStage.paperType,
    sponsorship: summarizeSponsorship(activeExam),
    entrySearch: buildEntrySearch(activeExam),
    cell: buildCell(activeExam),
    rollLifecycle: buildRollLifecycle(phaseKey)
  }, activeExam);

  procedure.papers = (procedure.papers || buildPapers(activeExam.level)).map((paper, index) => {
    let status = "pending";
    if (index < subStageIndex || phaseKey === "submission") status = "completed";
    if (index === subStageIndex && phaseKey !== "submission") status = "in_progress";
    return { ...paper, status };
  });
  procedure.visibleNextActions = buildVisibleNextActions(procedure);
  activeExam.procedure = procedure;
  return procedure;
}

function initializeExamProcedure(activeExam = {}) {
  return syncProcedureToScene(activeExam, activeExam.examQuestion ? "question_release" : "cell_entry");
}

function advanceExamProcedurePhase(activeExam = {}) {
  return syncProcedureToScene(activeExam);
}

function buildVisibleNextActions(procedure = {}) {
  const phase = procedure.phase;
  if (phase === "cell_entry" || phase === "question_release") {
    return ["审题立意", "拟定提纲", "稳住号舍心神"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
  }
  if (phase === "drafting") {
    return ["完成草稿", "补足经义依据", "转入誊清"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
  }
  if (phase === "fair_copy") {
    return ["校读句读", "誊清墨卷", "准备交卷"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
  }
  if (phase === "submission") {
    return ["等待弥封", "等待誊录", "等待放榜"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
  }
  if (getPhaseIndex(phase) >= getPhaseIndex("sealing")) {
    return ["查阅公开复核", "等待榜示"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
  }
  return ["按科场规程推进"].slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions);
}

function buildAuditFlags(authenticityCheck = {}, score = {}) {
  const flags = Array.isArray(authenticityCheck.flags) ? authenticityCheck.flags : [];
  if (!flags.length) {
    return [{
      type: "clear",
      label: "未见重犯",
      severity: "info",
      publicSummary: "监试复核未见明显作伪，卷件照常入榜。"
    }];
  }

  return flags.slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleAuditFlags).map((flag) => ({
    type: cleanText(flag.type, "audit", 40),
    label: cleanText(flag.label, "复核疑点", 48),
    severity: cleanText(flag.severity, "notice", 24),
    publicSummary: cleanText(flag.detail, `${flag.label || "复核疑点"}影响本场评分。`),
    penalty: clampNumber(flag.penalty, 0, 100, 0),
    scoreAfterReview: clampNumber(score.overall_score, 0, 100, 0)
  }));
}

function completeExamProcedure(activeExam = {}, options = {}) {
  if (!isPlainObject(activeExam)) return null;
  if (activeExam.sceneTime && activeExam.sceneTime.phase === "submitted") {
    activeExam.sceneTime.phase = "submitted";
    activeExam.scenePhase = "submitted";
  }
  const procedure = syncProcedureToScene(activeExam, "closed");
  const score = options.score || {};
  procedure.phase = "closed";
  procedure.phaseLabel = getPhase("closed").label;
  procedure.rollLifecycle = buildRollLifecycle("closed", {
    publicSummary: "墨卷已交，弥封、誊录、对读、磨勘和放榜均以服务器公开摘要归档。"
  });
  procedure.auditFlags = [
    ...buildAuditFlags(options.authenticityCheck, score),
    ...(Array.isArray(options.reviewResult?.auditFlags) ? options.reviewResult.auditFlags : [])
  ].slice(-EXAM_PROCEDURE_LIMITS.maxVisibleAuditFlags);
  const reviewIncidents = Array.isArray(options.reviewResult?.incidents) ? options.reviewResult.incidents : [];
  procedure.incidents = [
    ...(Array.isArray(procedure.incidents) ? procedure.incidents : []),
    ...reviewIncidents,
    createIncident("sealing", "弥封完成", "卷面已弥封，玩家视图不显示姓名映射。"),
    createIncident("transcription", "誊录对读", "朱卷誊录与对读只保留公开结论，不暴露誊录人或内部差错定位。"),
    createIncident("ranking", "榜前磨勘", "服务器结合评分、反作弊和同场排名生成 canonical 榜次。")
  ].slice(-EXAM_PROCEDURE_LIMITS.maxVisibleIncidents);
  procedure.examinerPanel = buildExaminerPanelView(options.reviewResult?.examinerPanel);
  procedure.papers = (procedure.papers || buildPapers(activeExam.level)).map((paper) => ({
    ...paper,
    status: "completed"
  }));
  const playerPlace = Array.isArray(options.ranking)
    ? options.ranking.find((entry) => entry.isPlayer)?.place
    : null;
  procedure.resultSummary = [
    score.overall_score !== undefined ? `总评${score.overall_score}分` : "",
    playerPlace ? `榜列第${playerPlace}` : "",
    options.reviewResult?.scoreDelta ? `阅卷复核${options.reviewResult.scoreDelta > 0 ? "加" : "扣"}${Math.abs(options.reviewResult.scoreDelta)}分` : "",
    options.promotionResult?.passed ? `取中${options.promotionResult.rank}` : options.promotionResult?.consequence?.label
  ].filter(Boolean).join("，") || "本场结果已归档。";
  procedure.visibleNextActions = ["查阅榜单", "听取老师复盘", "整理下场准备"];
  activeExam.procedure = procedure;
  return procedure;
}

function buildExamProcedureView(worldState = {}, options = {}) {
  const activeExam = worldState.activeExam;
  const source = options.procedure || activeExam?.procedure;
  if (!source && !activeExam) return null;
  const procedure = normalizeProcedure(source || {}, activeExam || {});
  return sanitizeProcedureForView(procedure);
}

function sanitizeProcedureForView(procedure = {}) {
  const phase = getPhase(procedure.phase);
  const incidents = Array.isArray(procedure.incidents) ? procedure.incidents : [];
  const auditFlags = Array.isArray(procedure.auditFlags) ? procedure.auditFlags : [];
  return {
    schemaVersion: EXAM_PROCEDURE_SCHEMA_VERSION,
    level: cleanText(procedure.level, "child_exam", 40),
    examName: cleanText(procedure.examName, "考试", 48),
    phase: phase.key,
    phaseLabel: phase.label,
    subStage: cleanText(procedure.subStage, "", 48),
    subStageLabel: cleanText(procedure.subStageLabel, "", 48),
    sessionIndex: clampNumber(procedure.sessionIndex, 1, 9, 1),
    sessionCount: clampNumber(procedure.sessionCount, 1, 9, 1),
    paperType: cleanText(procedure.paperType, "科题", 64),
    sponsorship: sanitizeSponsorship(procedure.sponsorship),
    entrySearch: sanitizeStatusBlock(procedure.entrySearch, "待搜检"),
    cell: sanitizeStatusBlock(procedure.cell, "待入号舍"),
    rollLifecycle: sanitizeRollLifecycle(procedure.rollLifecycle),
    papers: sanitizePapers(procedure.papers),
    incidents: incidents.slice(-EXAM_PROCEDURE_LIMITS.maxVisibleIncidents).map((incident) => ({
      type: cleanText(incident.type, "incident", 40),
      label: cleanText(incident.label, "科场记录", 48),
      severity: cleanText(incident.severity, "info", 24),
      scoreDelta: incident.scoreDelta === undefined ? 0 : clampNumber(incident.scoreDelta, -20, 20, 0),
      publicSummary: cleanText(incident.publicSummary || incident.detail, "科场记录已脱敏。")
    })),
    auditFlags: auditFlags.slice(-EXAM_PROCEDURE_LIMITS.maxVisibleAuditFlags).map((flag) => ({
      type: cleanText(flag.type, "audit", 40),
      label: cleanText(flag.label, "复核记录", 48),
      severity: cleanText(flag.severity, "notice", 24),
      publicSummary: cleanText(flag.publicSummary || flag.detail, "复核记录已脱敏。"),
      penalty: clampNumber(flag.penalty, 0, 100, 0),
      scoreAfterReview: flag.scoreAfterReview === undefined ? null : clampNumber(flag.scoreAfterReview, 0, 100, 0)
    })),
    examinerPanelView: buildExaminerPanelView(procedure.examinerPanel),
    resultSummary: cleanText(procedure.resultSummary, "", 160),
    visibleNextActions: (Array.isArray(procedure.visibleNextActions) ? procedure.visibleNextActions : [])
      .map((action) => cleanText(action, "", 48))
      .filter(Boolean)
      .slice(0, EXAM_PROCEDURE_LIMITS.maxVisibleActions),
    authorityBoundary: "只展示服务器整理的科场流程摘要；不含弥封身份映射、保结密注、考官私意、模型原始建议或内部审计。"
  };
}

function sanitizeSponsorship(sponsorship = {}) {
  return {
    status: cleanText(sponsorship.status, "not_ready", 32),
    ready: sponsorship.ready === true || sponsorship.status === "ready",
    score: clampNumber(sponsorship.score, 0, 100, 0),
    guarantorName: cleanText(sponsorship.guarantorName, "", 48),
    publicSummary: cleanText(sponsorship.publicSummary, "保结只作公开准备摘要，不替代服务器准考裁决。")
  };
}

function sanitizeStatusBlock(block = {}, fallback) {
  return {
    status: cleanText(block.status, "pending", 32),
    subStage: cleanText(block.subStage, "", 48),
    subStageLabel: cleanText(block.subStageLabel, "", 48),
    publicSummary: cleanText(block.publicSummary, fallback)
  };
}

function sanitizeRollLifecycle(rollLifecycle = {}) {
  return {
    draftRoll: rollLifecycle.draftRoll === true,
    inkRoll: rollLifecycle.inkRoll === true,
    sealed: rollLifecycle.sealed === true,
    transcribed: rollLifecycle.transcribed === true,
    collated: rollLifecycle.collated === true,
    audited: rollLifecycle.audited === true,
    publicSummary: cleanText(rollLifecycle.publicSummary, "卷件流程只显示公开摘要。")
  };
}

function sanitizePapers(papers = []) {
  return (Array.isArray(papers) ? papers : []).slice(0, 3).map((paper, index) => ({
    sessionIndex: clampNumber(paper.sessionIndex, 1, 9, index + 1),
    sessionCount: clampNumber(paper.sessionCount, 1, 9, papers.length || 1),
    subStage: cleanText(paper.subStage, `session_${index + 1}`, 48),
    subStageLabel: cleanText(paper.subStageLabel, `第${index + 1}场`, 48),
    paperType: cleanText(paper.paperType, "科题", 64),
    status: cleanText(paper.status, "pending", 32),
    publicSummary: cleanText(paper.publicSummary, "本卷并入服务器总评。")
  }));
}

function summarizeExamProcedureForPrompt(worldState = {}) {
  const view = buildExamProcedureView(worldState);
  if (!view) return null;
  return {
    schemaVersion: view.schemaVersion,
    level: view.level,
    phase: view.phase,
    phaseLabel: view.phaseLabel,
    subStageLabel: view.subStageLabel,
    sessionIndex: view.sessionIndex,
    sessionCount: view.sessionCount,
    paperType: view.paperType,
    sponsorshipStatus: view.sponsorship.status,
    entrySearchStatus: view.entrySearch.status,
    rollLifecycle: view.rollLifecycle,
    incidents: view.incidents.slice(-EXAM_PROCEDURE_LIMITS.maxPromptIncidents),
    auditFlags: view.auditFlags.slice(-EXAM_PROCEDURE_LIMITS.maxPromptAuditFlags),
    examinerPanel: summarizeExaminerPanelForPrompt(view.examinerPanelView),
    authorityBoundary: "prompt 只能读取公开科场流程摘要；不得要求或推断弥封身份映射、考官私心、保结密注、内部审计、模型原始建议、路径或密钥。"
  };
}

module.exports = {
  advanceExamProcedurePhase,
  buildExamProcedureView,
  completeExamProcedure,
  initializeExamProcedure,
  summarizeExamProcedureForPrompt
};
