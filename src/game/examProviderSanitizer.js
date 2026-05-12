const SCORE_DIMENSION_KEYS = Object.freeze([
  "content_quality",
  "argument_strength",
  "literary_style",
  "classical_format",
  "historical_appropriateness"
]);

const UNSAFE_PROVIDER_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping/gi,
  /raw[_ -]?(?:provider|audit|proposal|table|ledger)|provider proposal|prompt_retrieval_index|event_archive_index|world_sessions|appointmentTrack|retrievalContext|worldState|statePatch|prompt/gi,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/gi,
  /\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\b/gi,
  /sk-[A-Za-z0-9_-]{4,}|tp-[A-Za-z0-9_-]{4,}/gi,
  /data[\\/](?:sessions|audit)[^\s"'<>，。；]*/gi,
  /(?:event_log|ai_change_proposals)/gi,
  /[A-Za-z]:\\[^\s"'<>，。；]*/g,
  /\b(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>，。；]*/g
]);

function cleanProviderText(value, fallback = "", maxLength = 240) {
  if (typeof value !== "string") return fallback;
  let text = value.trim().replace(/\s+/g, " ");
  for (const pattern of UNSAFE_PROVIDER_TEXT_PATTERNS) {
    text = text.replace(pattern, "已遮蔽");
  }
  text = text.trim();
  if (!text || /^已遮蔽[，。、；\s]*$/.test(text)) return fallback;
  return text.slice(0, maxLength);
}

function cleanStringList(items = [], fallbackItems = [], maxItems = 8, maxLength = 120) {
  const source = Array.isArray(items) ? items : [];
  const cleaned = source
    .map((item) => cleanProviderText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);

  if (cleaned.length) return cleaned;
  return (Array.isArray(fallbackItems) ? fallbackItems : [])
    .map((item) => cleanProviderText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeExamQuestionPayload(question = {}, exam = {}) {
  return {
    ...question,
    level: cleanProviderText(question.level, exam.level || "child_exam", 40),
    examName: cleanProviderText(question.examName, exam.name || "科举", 60),
    examQuestion: cleanProviderText(
      question.examQuestion,
      `${exam.name || "科举"}题：试论修身读书与经世济民之要。`,
      1200
    ),
    questionType: cleanProviderText(question.questionType, exam.questionType || "essay", 48),
    difficulty: cleanProviderText(question.difficulty, exam.difficulty || "normal", 48),
    requirements: cleanStringList(question.requirements, exam.requirements, 8, 120),
    promotionRank: cleanProviderText(question.promotionRank, exam.promotionRank || "", 48)
  };
}

function sanitizeScoreDimension(dimension = {}) {
  if (!dimension || typeof dimension !== "object" || Array.isArray(dimension)) {
    return dimension;
  }

  return {
    ...dimension,
    comment: cleanProviderText(dimension.comment, "评语已由服务器清洗。", 220)
  };
}

function sanitizeProviderReview(review = {}) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return review;
  }

  return {
    ...review,
    actor: cleanProviderText(review.actor, review.actor === undefined ? undefined : "provider_examiner", 40),
    label: cleanProviderText(review.label, review.label === undefined ? undefined : "模型考官建议", 48),
    recommendation: cleanProviderText(review.recommendation, review.recommendation === undefined ? undefined : "建议", 48),
    comment: cleanProviderText(review.comment, review.comment === undefined ? undefined : "模型只提供阅卷建议。", 220),
    publicComment: cleanProviderText(
      review.publicComment,
      review.publicComment === undefined ? undefined : "模型只提供阅卷建议。",
      220
    ),
    concern: cleanProviderText(review.concern, review.concern === undefined ? undefined : "", 96),
    risk: cleanProviderText(review.risk, review.risk === undefined ? undefined : "", 96)
  };
}

function sanitizeExamGradePayload(grade = {}) {
  const score = grade.score && typeof grade.score === "object" && !Array.isArray(grade.score)
    ? { ...grade.score }
    : {};

  for (const key of SCORE_DIMENSION_KEYS) {
    if (score[key]) {
      score[key] = sanitizeScoreDimension(score[key]);
    }
  }

  if ("rank" in score) {
    score.rank = cleanProviderText(score.rank, "取中", 48);
  }
  if ("detailed_feedback" in score) {
    score.detailed_feedback = cleanProviderText(
      score.detailed_feedback,
      "模型评语只作评分输入，服务器另行复核。",
      800
    );
  }

  return {
    ...grade,
    score,
    examiner_reviews: Array.isArray(grade.examiner_reviews)
      ? grade.examiner_reviews.map(sanitizeProviderReview)
      : grade.examiner_reviews
  };
}

module.exports = {
  cleanProviderText,
  sanitizeExamGradePayload,
  sanitizeExamQuestionPayload
};
