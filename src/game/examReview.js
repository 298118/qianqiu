const {
  EXAM_REVIEW_ACTOR_LABELS,
  EXAM_REVIEW_ACTORS,
  EXAM_REVIEW_LIMITS,
  EXAM_REVIEW_SCHEMA_VERSION
} = require("./examReviewConfig");
const { scoreToRank } = require("./essayChecks");

const UNSAFE_PUBLIC_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping/gi,
  /raw provider|raw_provider|provider proposal|raw audit|raw_audit|prompt/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]+/gi,
  /data\/sessions\/[^\s，。；]*|data\/audit\/[^\s，。；]*|\/mnt\/[^\s，。；]*|[A-Z]:\\[^\s，。；]*/gi
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = EXAM_REVIEW_LIMITS.textPreviewLength) {
  if (typeof value !== "string") return fallback;
  let trimmed = value.trim().replace(/\s+/g, " ");
  for (const pattern of UNSAFE_PUBLIC_TEXT_PATTERNS) {
    trimmed = trimmed.replace(pattern, "已遮蔽");
  }
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cloneScore(score = {}) {
  return {
    ...score,
    content_quality: { ...(score.content_quality || {}) },
    argument_strength: { ...(score.argument_strength || {}) },
    literary_style: { ...(score.literary_style || {}) },
    classical_format: { ...(score.classical_format || {}) },
    historical_appropriateness: { ...(score.historical_appropriateness || {}) }
  };
}

function buildReviewSeed(worldState = {}, activeExam = {}, essay = "", score = {}) {
  const player = worldState.player || {};
  const text = `${worldState.sessionId || ""}|${activeExam.examId || ""}|${activeExam.level || ""}|${essay.length}|${score.overall_score ?? 0}|${worldState.turnCount || 0}|${player.academia || 0}|${player.mentality || 0}`;
  let seed = 0;
  for (const char of text) {
    seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  }
  return seed;
}

function chooseEvent(seed, candidates) {
  return candidates[seed % candidates.length];
}

function createIncident(type, label, summary, options = {}) {
  return {
    type,
    label,
    severity: options.severity || "info",
    scoreDelta: clampNumber(
      options.scoreDelta,
      -EXAM_REVIEW_LIMITS.maxEventPenalty,
      EXAM_REVIEW_LIMITS.maxEventPenalty,
      0
    ),
    publicSummary: cleanText(summary, label)
  };
}

function resolveExamIncidents(worldState = {}, activeExam = {}, essay = "", authenticityCheck = {}, score = {}) {
  const player = worldState.player || {};
  const procedure = activeExam.procedure || {};
  const seed = buildReviewSeed(worldState, activeExam, essay, score);
  const incidents = [];
  const auditFlags = [];
  let scoreDelta = 0;

  const flags = Array.isArray(authenticityCheck.flags) ? authenticityCheck.flags : [];
  const hasSevereLocalFlag = Boolean(
    authenticityCheck.copy_detection?.is_copy ||
    flags.some((flag) => flag.severity === "severe")
  );
  const hasMajorLocalFlag = flags.some((flag) => flag.severity === "major");

  if (hasSevereLocalFlag) {
    const incident = createIncident(
      "contraband_suspicion",
      "夹带疑云",
      "磨勘见本卷有重犯嫌疑，服务器按本地反作弊规则先行裁断。",
      { severity: "severe", scoreDelta: -EXAM_REVIEW_LIMITS.maxEventPenalty }
    );
    incidents.push(incident);
    auditFlags.push({
      type: "exam_review_contraband",
      label: "夹带疑云",
      severity: "severe",
      penalty: EXAM_REVIEW_LIMITS.maxEventPenalty,
      publicSummary: "夹带、照抄或代笔等重犯疑点不由考官好评抵消。"
    });
    scoreDelta -= EXAM_REVIEW_LIMITS.maxEventPenalty;
  }

  const endurance = Number(worldState.studyProfile?.dimensions?.examEndurance ?? player.mentality ?? 0);
  if (endurance < 55 || player.health < 45) {
    const incident = createIncident(
      "sudden_illness",
      "号舍病困",
      "号舍久坐后气力不济，卷面后段稍见浮急，服务器只作小幅公开扣减。",
      { severity: "notice", scoreDelta: -3 }
    );
    incidents.push(incident);
    scoreDelta += incident.scoreDelta;
  } else if ((seed % 7) === 0 && activeExam.level !== "palace_exam") {
    const event = chooseEvent(seed, [
      ["cell_noise", "邻号扰动", "邻号咳嗽漏雨扰心，所幸未动摇本卷主旨。"],
      ["candle_shortage", "烛火不足", "夜间烛火将尽，誊清略显仓促。"]
    ]);
    incidents.push(createIncident(event[0], event[1], event[2], { severity: "info", scoreDelta: 0 }));
  }

  const copying = Number(worldState.studyProfile?.dimensions?.calligraphyCopying ?? player.literaryTalent ?? 0);
  if (copying < 58 && activeExam.level !== "palace_exam") {
    const incident = createIncident(
      "transcription_error",
      "誊录误差",
      "朱卷对读时见个别字句疑误，已由服务器复核为轻微卷面影响。",
      { severity: "notice", scoreDelta: -2 }
    );
    incidents.push(incident);
    auditFlags.push({
      type: "transcription_error",
      label: "誊录误差",
      severity: "notice",
      penalty: 2,
      publicSummary: "对读只公开误差结论，不暴露誊录人、房号或内部定位。"
    });
    scoreDelta += incident.scoreDelta;
  } else if (procedure.rollLifecycle?.transcribed || activeExam.level !== "child_exam") {
    incidents.push(createIncident(
      "collation_clear",
      "对读无大误",
      "朱卷对读未见足以改判的大误，卷件照常送阅。",
      { severity: "info", scoreDelta: 0 }
    ));
  }

  if (hasMajorLocalFlag && !hasSevereLocalFlag) {
    auditFlags.push({
      type: "exam_review_local_flag",
      label: "本地复核疑点",
      severity: "major",
      penalty: 0,
      publicSummary: "监试疑点已先由本地反作弊扣分，多考官不得重复处分。"
    });
  }

  return {
    incidents: incidents.slice(-EXAM_REVIEW_LIMITS.maxVisibleIncidents),
    auditFlags: auditFlags.slice(-EXAM_REVIEW_LIMITS.maxVisibleAuditFlags),
    scoreDelta: clampNumber(scoreDelta, -EXAM_REVIEW_LIMITS.maxEventPenalty, EXAM_REVIEW_LIMITS.maxEventPenalty, 0)
  };
}

function buildServerReviewProposals({ worldState = {}, activeExam = {}, exam = {}, score = {}, incidents = [] }) {
  const player = worldState.player || {};
  const dimensions = worldState.studyProfile?.dimensions || {};
  const overall = clampNumber(score.overall_score, 0, 100, 0);
  const formScore = Number(score.classical_format?.score ?? dimensions.eightLeggedForm ?? 0);
  const policyScore = Number(score.argument_strength?.score ?? dimensions.policyInsight ?? 0);
  const styleScore = Number(score.literary_style?.score ?? player.literaryTalent ?? 0);
  const hasPenaltyIncident = incidents.some((incident) => Number(incident.scoreDelta) < 0);
  const levelName = activeExam.examName || exam.name || "本场";

  return [
    {
      actor: "room_officer",
      suggestedScoreDelta: formScore >= 76 ? 1 : formScore < 56 ? -1 : 0,
      recommendation: overall >= exam.passScore ? "荐卷" : "酌置",
      comment: formScore >= 76
        ? `${levelName}房官谓章法尚整，可入复看。`
        : `${levelName}房官谓章法仍有松处，宜酌置榜后。`,
      concern: formScore < 56 ? "制艺章法不稳" : ""
    },
    {
      actor: "co_examiner",
      suggestedScoreDelta: hasPenaltyIncident ? -1 : styleScore >= 78 ? 1 : 0,
      recommendation: hasPenaltyIncident ? "复核" : "可取",
      comment: hasPenaltyIncident
        ? "同考官请先看科场事故与卷面疑点，再入榜前定序。"
        : "同考官以为文气未悖题旨，可从房官意见。",
      concern: hasPenaltyIncident ? "科场事故影响卷面" : ""
    },
    {
      actor: "chief_examiner",
      suggestedScoreDelta: policyScore >= 82 && activeExam.level !== "child_exam" ? 1 : 0,
      recommendation: overall >= Math.max(exam.passScore || 0, 74) ? "前列候选" : "榜中酌录",
      comment: policyScore >= 82
        ? "主考重其经世条理，但仍交服务器按名额和复核定榜。"
        : "主考只留取舍意见，名次仍俟服务器榜前定序。",
      concern: ""
    },
    {
      actor: "audit_critic",
      suggestedScoreDelta: hasPenaltyIncident ? -1 : 0,
      recommendation: hasPenaltyIncident ? "带疑点入磨勘" : "准入定序",
      comment: hasPenaltyIncident
        ? "磨勘只记录公开疑点，处分以服务器规则为准。"
        : "磨勘未见额外重犯，准按服务器总分定序。",
      concern: hasPenaltyIncident ? "公开疑点已入复核" : ""
    }
  ];
}

function sanitizeProviderReviews(reviews = []) {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .filter(isPlainObject)
    .slice(0, EXAM_REVIEW_LIMITS.maxVisibleReviews)
    .map((review) => ({
      actor: cleanText(review.actor, "provider_examiner", 40),
      label: cleanText(review.label, EXAM_REVIEW_ACTOR_LABELS[review.actor] || "模型考官建议", 48),
      recommendation: cleanText(review.recommendation, "建议", 48),
      suggestedScoreDelta: clampNumber(
        review.suggestedScoreDelta ?? review.scoreDelta,
        -EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
        EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
        0
      ),
      comment: cleanText(review.comment || review.publicComment, "模型只提供阅卷建议。"),
      concern: cleanText(review.concern || review.risk, "", 96),
      source: "provider_proposal",
      accepted: false,
      rejectionReason: "模型考官建议不直接定榜、定名次或写处罚；服务器只保留脱敏摘要。"
    }));
}

function sanitizeServerReview(review = {}) {
  const actor = cleanText(review.actor, "room_officer", 40);
  return {
    actor,
    label: EXAM_REVIEW_ACTOR_LABELS[actor] || cleanText(review.label, "阅卷建议", 48),
    recommendation: cleanText(review.recommendation, "建议", 48),
    suggestedScoreDelta: clampNumber(
      review.suggestedScoreDelta,
      -EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
      EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
      0
    ),
    comment: cleanText(review.comment, "阅卷建议已脱敏。"),
    concern: cleanText(review.concern, "", 96),
    source: "server_resolver",
    accepted: true,
    authorityBoundary: EXAM_REVIEW_ACTORS.find((actorConfig) => actorConfig.actor === actor)?.authority ||
      "阅卷建议不能决定榜单、功名或官职。"
  };
}

function sumAcceptedReviewerDelta(reviews = []) {
  const total = reviews
    .filter((review) => review.accepted)
    .reduce((sum, review) => sum + (Number(review.suggestedScoreDelta) || 0), 0);
  return clampNumber(
    total,
    -EXAM_REVIEW_LIMITS.maxTotalReviewerDelta,
    EXAM_REVIEW_LIMITS.maxTotalReviewerDelta,
    0
  );
}

function applyScoreDelta(score = {}, exam = {}, delta = 0, reason = "") {
  const adjusted = cloneScore(score);
  const original = clampNumber(score.overall_score, 0, 100, 0);
  const nextOverall = clampNumber(original + delta, 0, 100, original);
  adjusted.overall_score = nextOverall;
  adjusted.rank = scoreToRank(nextOverall, exam);
  if (delta !== 0) {
    const prefix = score.detailed_feedback || "";
    const sign = delta > 0 ? `加${delta}` : `扣${Math.abs(delta)}`;
    adjusted.detailed_feedback = `${prefix}\n科场阅卷复核：${reason || "多考官建议与科场事故"}，服务器${sign}分后定为${nextOverall}分。`.trim();
  }
  return adjusted;
}

function buildScoreInputs(score = {}, adjustedScore = {}, incidents = [], reviews = []) {
  const inputs = [{
    source: "provider_grade",
    label: "模型五维初评",
    score: clampNumber(score.overall_score, 0, 100, 0),
    publicSummary: "模型只给初评分与评语，不能生成 canonical ranking。"
  }];

  const incidentDelta = incidents.reduce((sum, incident) => sum + (Number(incident.scoreDelta) || 0), 0);
  if (incidentDelta !== 0) {
    inputs.push({
      source: "exam_incidents",
      label: "科场事件裁决",
      scoreDelta: clampNumber(incidentDelta, -EXAM_REVIEW_LIMITS.maxEventPenalty, EXAM_REVIEW_LIMITS.maxEventPenalty, 0),
      publicSummary: "夹带疑云、病困或誊录误差只由服务器裁决为公开扣分。"
    });
  }

  const reviewerDelta = sumAcceptedReviewerDelta(reviews);
  if (reviewerDelta !== 0) {
    inputs.push({
      source: "examiner_panel",
      label: "多考官建议",
      scoreDelta: reviewerDelta,
      publicSummary: "房官、同考官和主考只给建议，服务器限幅采纳。"
    });
  }

  inputs.push({
    source: "server_final",
    label: "服务器定分",
    score: clampNumber(adjustedScore.overall_score, 0, 100, 0),
    publicSummary: "最终分数、晋级、处罚和榜单由服务器写定。"
  });

  return inputs.slice(0, EXAM_REVIEW_LIMITS.maxScoreInputs);
}

function buildExaminerPanelView(panel = null) {
  if (!isPlainObject(panel)) return null;
  const roomReviews = Array.isArray(panel.roomReviews) ? panel.roomReviews : [];
  const scoreInputs = Array.isArray(panel.scoreInputs) ? panel.scoreInputs : [];
  return {
    schemaVersion: EXAM_REVIEW_SCHEMA_VERSION,
    level: cleanText(panel.level, "child_exam", 40),
    examName: cleanText(panel.examName, "考试", 48),
    roomReviews: roomReviews.slice(0, EXAM_REVIEW_LIMITS.maxVisibleReviews).map((review) => ({
      actor: cleanText(review.actor, "examiner", 40),
      label: cleanText(review.label, "阅卷建议", 48),
      recommendation: cleanText(review.recommendation, "建议", 48),
      suggestedScoreDelta: clampNumber(
        review.suggestedScoreDelta,
        -EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
        EXAM_REVIEW_LIMITS.maxSingleReviewerDelta,
        0
      ),
      comment: cleanText(review.comment, "阅卷建议已脱敏。"),
      concern: cleanText(review.concern, "", 96),
      source: cleanText(review.source, "server_resolver", 32),
      accepted: review.accepted === true,
      rejectionReason: cleanText(review.rejectionReason, "", 120),
      authorityBoundary: cleanText(review.authorityBoundary, "考官建议不能决定榜单、功名或官职。", 120)
    })),
    scoreInputs: scoreInputs.slice(0, EXAM_REVIEW_LIMITS.maxScoreInputs).map((input) => ({
      source: cleanText(input.source, "server", 40),
      label: cleanText(input.label, "定分输入", 48),
      score: input.score === undefined ? null : clampNumber(input.score, 0, 100, 0),
      scoreDelta: input.scoreDelta === undefined ? 0 : clampNumber(input.scoreDelta, -20, 20, 0),
      publicSummary: cleanText(input.publicSummary, "服务器整理的公开定分摘要。")
    })),
    incidents: (Array.isArray(panel.incidents) ? panel.incidents : [])
      .slice(0, EXAM_REVIEW_LIMITS.maxVisibleIncidents)
      .map((incident) => ({
        type: cleanText(incident.type, "incident", 40),
        label: cleanText(incident.label, "科场事件", 48),
        severity: cleanText(incident.severity, "info", 24),
        scoreDelta: clampNumber(incident.scoreDelta, -EXAM_REVIEW_LIMITS.maxEventPenalty, EXAM_REVIEW_LIMITS.maxEventPenalty, 0),
        publicSummary: cleanText(incident.publicSummary, "科场事件已脱敏。")
      })),
    auditFlags: (Array.isArray(panel.auditFlags) ? panel.auditFlags : [])
      .slice(0, EXAM_REVIEW_LIMITS.maxVisibleAuditFlags)
      .map((flag) => ({
        type: cleanText(flag.type, "audit", 40),
        label: cleanText(flag.label, "复核疑点", 48),
        severity: cleanText(flag.severity, "notice", 24),
        penalty: clampNumber(flag.penalty, 0, 100, 0),
        publicSummary: cleanText(flag.publicSummary, "复核疑点已脱敏。")
      })),
    disputeSummary: cleanText(panel.disputeSummary, "阅卷分歧只留公开摘要。"),
    serverDecision: cleanText(panel.serverDecision, "服务器综合初评、科场事件、复核和名额后定分定榜。"),
    authorityBoundary: "examinerPanelView 只展示脱敏多考官建议；房官、同考官、主考官和模型不能直接定榜、处罚、授功名或写官职。"
  };
}

function summarizeExaminerPanelForPrompt(panel = null) {
  const view = buildExaminerPanelView(panel);
  if (!view) return null;
  return {
    schemaVersion: view.schemaVersion,
    level: view.level,
    roomReviews: view.roomReviews.slice(0, EXAM_REVIEW_LIMITS.maxPromptReviews).map((review) => ({
      actor: review.actor,
      label: review.label,
      recommendation: review.recommendation,
      concern: review.concern,
      accepted: review.accepted
    })),
    scoreInputs: view.scoreInputs,
    incidents: view.incidents.slice(0, 3),
    auditFlags: view.auditFlags.slice(0, 3),
    disputeSummary: view.disputeSummary,
    serverDecision: view.serverDecision,
    authorityBoundary: "prompt 只能读取公开阅卷摘要；不得要求弥封映射、考官 hidden intent、raw proposal、榜单越权或官职写入。"
  };
}

function resolveExamReview({ worldState = {}, activeExam = {}, exam = {}, essay = "", grade = {}, score = {}, authenticityCheck = {} }) {
  const incidentResult = resolveExamIncidents(worldState, activeExam, essay, authenticityCheck, score);
  const serverReviews = buildServerReviewProposals({
    worldState,
    activeExam,
    exam,
    score,
    incidents: incidentResult.incidents
  }).map(sanitizeServerReview);
  const providerReviews = sanitizeProviderReviews(grade.examiner_reviews);
  const allReviews = [...serverReviews, ...providerReviews].slice(0, EXAM_REVIEW_LIMITS.maxVisibleReviews);
  const reviewerDelta = sumAcceptedReviewerDelta(serverReviews);
  const totalDelta = clampNumber(
    incidentResult.scoreDelta + reviewerDelta,
    -(EXAM_REVIEW_LIMITS.maxEventPenalty + EXAM_REVIEW_LIMITS.maxTotalReviewerDelta),
    EXAM_REVIEW_LIMITS.maxEventPenalty + EXAM_REVIEW_LIMITS.maxTotalReviewerDelta,
    0
  );
  const adjustedScore = applyScoreDelta(
    score,
    exam,
    totalDelta,
    "科场事件、多考官建议和磨勘复核"
  );
  const scoreInputs = buildScoreInputs(score, adjustedScore, incidentResult.incidents, serverReviews);
  const positiveReviews = serverReviews.filter((review) => review.suggestedScoreDelta > 0).length;
  const negativeReviews = serverReviews.filter((review) => review.suggestedScoreDelta < 0).length;
  const rejectedProviderCount = providerReviews.length;
  const disputeSummary = positiveReviews && negativeReviews
    ? "房官与磨勘意见有分歧，服务器按限幅规则折中。"
    : rejectedProviderCount
      ? "模型考官建议已脱敏留痕，但未直接采纳为定榜事实。"
      : "多考官意见未见重大分歧，服务器照复核后分数定序。";
  const serverDecision = `服务器以${adjustedScore.overall_score}分作为榜前定序输入；provider ranking、虚拟考生和考官建议均不得成为 canonical 榜单。`;
  const panel = buildExaminerPanelView({
    level: activeExam.level || exam.level,
    examName: activeExam.examName || exam.name,
    roomReviews: allReviews,
    scoreInputs,
    incidents: incidentResult.incidents,
    auditFlags: incidentResult.auditFlags,
    disputeSummary,
    serverDecision
  });

  return {
    schemaVersion: EXAM_REVIEW_SCHEMA_VERSION,
    score: adjustedScore,
    scoreDelta: totalDelta,
    incidents: panel.incidents,
    auditFlags: panel.auditFlags,
    examinerPanel: panel,
    rejectedProviderReviewCount: rejectedProviderCount
  };
}

module.exports = {
  buildExaminerPanelView,
  resolveExamReview,
  summarizeExaminerPanelForPrompt
};
