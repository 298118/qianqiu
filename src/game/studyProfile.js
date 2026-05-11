const {
  STUDY_ACTION_PATTERNS,
  STUDY_DIMENSIONS,
  STUDY_INTERACTION_PATTERNS,
  STUDY_PROFILE_LIMITS,
  STUDY_PROFILE_SCHEMA_VERSION,
  STUDY_SPONSORSHIP_THRESHOLDS
} = require("./studyProfileConfig");
const { applyRelationshipChanges, ensureRelationshipLedger } = require("./relationships");
const { clamp } = require("./stateRules");
const { formatYearMonthPeriod } = require("./time");

const STUDY_NETWORK_CHARACTER_IDS = Object.freeze({
  teacher: "C01",
  classmate: "S68_CLASSMATE_01",
  academyMentor: "S68_ACADEMY_MENTOR"
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = STUDY_PROFILE_LIMITS.maxVisibleText) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

const SENSITIVE_STUDY_TEXT_PATTERN = /(hidden|sealed|provider proposal|rawProvider|prompt|api[_ -]?key|sk-[A-Za-z0-9_-]{4,}|tp-[A-Za-z0-9_-]{4,}|data[\\/](?:sessions|audit)|sqlite|event_log|ai_change_proposals)/i;

function cleanVisibleText(value, fallback = "", maxLength = STUDY_PROFILE_LIMITS.maxVisibleText) {
  const text = cleanText(value, "", maxLength);
  if (text && !SENSITIVE_STUDY_TEXT_PATTERN.test(text)) return text;
  const fallbackText = cleanText(fallback, "", maxLength);
  return fallbackText && !SENSITIVE_STUDY_TEXT_PATTERN.test(fallbackText) ? fallbackText : "";
}

function cleanProposalText(value, fallback = "", maxLength = STUDY_PROFILE_LIMITS.maxVisibleText) {
  return cleanVisibleText(value, fallback, maxLength);
}

function uniquePush(list, item, key = (value) => value, limit = 12) {
  if (!item) return list;
  const marker = key(item);
  if (!marker || list.some((entry) => key(entry) === marker)) return list;
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

function newestPush(list, item, key = (value) => value, limit = 12) {
  if (!item) return list;
  const marker = key(item);
  if (marker) {
    const existingIndex = list.findIndex((entry) => key(entry) === marker);
    if (existingIndex !== -1) list.splice(existingIndex, 1);
  }
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

function clampMetric(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clamp(Math.round(numeric), 0, 100);
}

function average(values = []) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return 0;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function scoreValue(score, key) {
  if (!score || !key) return null;
  if (key === "overall_score") return Number.isFinite(score.overall_score) ? score.overall_score : null;
  const dimension = score[key];
  return Number.isFinite(dimension?.score) ? dimension.score : null;
}

function buildDimensionValue(player = {}, entries = [], dimension = {}) {
  const attributeAverage = average(
    (dimension.sourceAttributes || []).map((key) =>
      Number.isFinite(player[key]) ? player[key] : null
    )
  );
  const recentScores = entries
    .map((entry) => scoreValue(entry.score, dimension.examScoreKey))
    .filter((value) => Number.isFinite(value))
    .slice(-3);
  const scoreAverage = average(recentScores);
  const hasScores = recentScores.length > 0;
  const weighted = hasScores
    ? attributeAverage * 0.55 + scoreAverage * 0.45
    : attributeAverage;
  return clampMetric(weighted);
}

function createInitialStudyProfile(worldState = {}) {
  const player = worldState.player || {};
  const teacherName = cleanVisibleText(player.teacher, "顾文衡", 48);
  return {
    schemaVersion: STUDY_PROFILE_SCHEMA_VERSION,
    generatedAtTurn: worldState.turnCount || 0,
    updatedAt: null,
    strengths: [],
    weaknesses: [],
    dimensions: Object.fromEntries(
      Object.entries(STUDY_DIMENSIONS).map(([key, config]) => [
        key,
        buildDimensionValue(player, [], config)
      ])
    ),
    teacherAdvice: [
      {
        id: "teacher-initial-foundation",
        source: "server",
        teacherName,
        focus: "经义根柢",
        advice: "先稳四书章句，每旬择一题拟纲，不急求浮词。",
        reason: "初入寒窗，服务器按当前学业属性生成基础日课。",
        proposedByAi: false,
        turn: worldState.turnCount || 0
      }
    ],
    teacherFeedback: [],
    recentExercises: [],
    smallExercises: [],
    recommendedBooks: [],
    academyNetwork: {
      teacher: {
        characterId: "C01",
        name: teacherName,
        style: "谨守经义，先端章法",
        relationshipStatus: "初识",
        publicSummary: "乡中塾师可点拨经义章法；是否保结仍由服务器按声望、师生情分和考试阶段裁决。"
      },
      academy: {
        id: "county_school",
        name: "县学讲席",
        level: "县学",
        resources: ["四书旧注", "程文讲义"],
        reputation: clampMetric((player.reputation || 0) + 20),
        publicSummary: "县学讲席提供基础经义、制艺章法与同窗切磋。"
      },
      classmates: [],
      sponsorship: {
        status: "not_ready",
        score: 0,
        guarantorId: "C01",
        guarantorName: teacherName,
        publicSummary: "尚未形成保结，须先稳师承、声望与同窗口碑。",
        nextStep: "拜访老师、参加讲会或请同窗互评文章。",
        lastUpdatedTurn: worldState.turnCount || 0
      }
    },
    nextPlan: {
      id: "study-plan-initial",
      title: "寒窗启蒙日课",
      focus: "经义根柢",
      items: ["晨读四书章句", "午后摘录疑义", "暮间拟一段破题"],
      bookList: ["《论语》", "《孟子》"],
      serverDecision: "服务器生成的默认读书计划；AI 老师后续只能提交建议。",
      proposedByAi: false,
      turn: worldState.turnCount || 0
    },
    summary: "学业账本已立，先以经义根柢和制艺章法为本。",
    authorityBoundary: "studyProfileView 由服务器从可见学业、行动和考试档案派生；AI 老师只能建议计划或点评，不能直接授名位、改榜、改官职或写账本。"
  };
}

function normalizeStudyProfile(profile, worldState = {}) {
  const initial = createInitialStudyProfile(worldState);
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return initial;
  }

  const normalized = {
    schemaVersion: STUDY_PROFILE_SCHEMA_VERSION,
    generatedAtTurn: Number.isFinite(profile.generatedAtTurn)
      ? Math.max(0, Math.round(profile.generatedAtTurn))
      : initial.generatedAtTurn,
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : initial.updatedAt,
    dimensions: {
      ...initial.dimensions
    },
    strengths: [],
    weaknesses: [],
    teacherAdvice: [],
    teacherFeedback: [],
    recentExercises: [],
    smallExercises: [],
    recommendedBooks: [],
    academyNetwork: normalizeAcademyNetwork(profile.academyNetwork, worldState),
    nextPlan: profile.nextPlan && typeof profile.nextPlan === "object" ? profile.nextPlan : initial.nextPlan,
    summary: initial.summary,
    authorityBoundary: initial.authorityBoundary
  };

  for (const key of Object.keys(STUDY_DIMENSIONS)) {
    normalized.dimensions[key] = clampMetric(profile.dimensions?.[key] ?? initial.dimensions[key]);
  }

  const normalizeListItem = (item) => {
    if (typeof item === "string") return cleanVisibleText(item);
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const next = {};
    for (const key of ["id", "label", "detail", "source", "focus", "advice", "reason", "teacherName", "level", "examName", "type", "title", "summary", "dimension", "dateLabel"]) {
      if (key in item) next[key] = cleanVisibleText(item[key]);
    }
    if (Number.isFinite(item.score)) next.score = clampMetric(item.score);
    if (Number.isFinite(item.delta)) next.delta = clamp(Math.round(item.delta), -100, 100);
    next.turn = Number.isFinite(item.turn) ? Math.max(0, Math.round(item.turn)) : worldState.turnCount || 0;
    next.proposedByAi = item.proposedByAi === true;
    return next;
  };

  normalized.strengths = (Array.isArray(profile.strengths) ? profile.strengths : [])
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxStrengths);
  normalized.weaknesses = (Array.isArray(profile.weaknesses) ? profile.weaknesses : [])
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxWeaknesses);
  normalized.teacherAdvice = (Array.isArray(profile.teacherAdvice) ? profile.teacherAdvice : initial.teacherAdvice)
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxTeacherAdvice);
  normalized.teacherFeedback = (Array.isArray(profile.teacherFeedback) ? profile.teacherFeedback : initial.teacherFeedback)
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxTeacherFeedback);
  normalized.recentExercises = (Array.isArray(profile.recentExercises) ? profile.recentExercises : [])
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxRecentExercises);
  normalized.smallExercises = (Array.isArray(profile.smallExercises) ? profile.smallExercises : initial.smallExercises)
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxSmallExercises);
  normalized.recommendedBooks = (Array.isArray(profile.recommendedBooks) ? profile.recommendedBooks : initial.recommendedBooks)
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxRecommendedBooks);

  if (normalized.nextPlan && typeof normalized.nextPlan === "object") {
    normalized.nextPlan = normalizeStudyPlan(normalized.nextPlan, worldState);
  }
  normalized.summary = cleanVisibleText(profile.summary, initial.summary, 180);
  return normalized;
}

function normalizeStudyPlan(plan = {}, worldState = {}) {
  const items = Array.isArray(plan.items)
    ? plan.items.map((item) => cleanVisibleText(item, "", 80)).filter(Boolean)
    : [];
  const bookList = Array.isArray(plan.bookList)
    ? plan.bookList.map((item) => cleanVisibleText(item, "", 48)).filter(Boolean)
    : [];
  return {
    id: cleanVisibleText(plan.id, `study-plan-${worldState.turnCount || 0}`, 80),
    title: cleanVisibleText(plan.title, "下旬读书日课", 80),
    focus: cleanVisibleText(plan.focus, "经义根柢", 48),
    items: items.slice(0, STUDY_PROFILE_LIMITS.maxPlanItems),
    bookList: bookList.slice(0, STUDY_PROFILE_LIMITS.maxBooks),
    serverDecision: cleanVisibleText(
      plan.serverDecision,
      "服务器裁决读书计划；AI 只可提出建议。",
      120
    ),
    proposedByAi: plan.proposedByAi === true,
    turn: Number.isFinite(plan.turn) ? Math.max(0, Math.round(plan.turn)) : worldState.turnCount || 0
  };
}

function normalizeStringList(items, limit, maxLength = 48) {
  return (Array.isArray(items) ? items : [])
    .map((item) => cleanVisibleText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeClassmate(entry = {}, worldState = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const id = cleanVisibleText(entry.characterId || entry.id, "", 64);
  const name = cleanVisibleText(entry.name, "", 48);
  if (!id || !name) return null;
  return {
    characterId: id,
    name,
    style: cleanVisibleText(entry.style, "同窗切磋", 48),
    relationshipStatus: cleanVisibleText(entry.relationshipStatus, "初识", 48),
    publicSummary: cleanVisibleText(entry.publicSummary, `${name}可与玩家互评文章。`, 120),
    lastUpdatedTurn: Number.isFinite(entry.lastUpdatedTurn)
      ? Math.max(0, Math.round(entry.lastUpdatedTurn))
      : worldState.turnCount || 0
  };
}

function normalizeAcademyNetwork(network = {}, worldState = {}) {
  const initial = createInitialStudyProfile({
    ...worldState,
    studyProfile: null
  }).academyNetwork;
  const source = network && typeof network === "object" && !Array.isArray(network)
    ? network
    : {};
  const teacher = source.teacher && typeof source.teacher === "object" ? source.teacher : {};
  const academy = source.academy && typeof source.academy === "object" ? source.academy : {};
  const sponsorship = source.sponsorship && typeof source.sponsorship === "object" ? source.sponsorship : {};
  const score = clampMetric(sponsorship.score ?? initial.sponsorship.score);

  return {
    teacher: {
      characterId: cleanVisibleText(teacher.characterId, initial.teacher.characterId, 64),
      name: cleanVisibleText(teacher.name, worldState.player?.teacher || initial.teacher.name, 48),
      style: cleanVisibleText(teacher.style, initial.teacher.style, 80),
      relationshipStatus: cleanVisibleText(teacher.relationshipStatus, initial.teacher.relationshipStatus, 48),
      publicSummary: cleanVisibleText(teacher.publicSummary, initial.teacher.publicSummary, 140)
    },
    academy: {
      id: cleanVisibleText(academy.id, initial.academy.id, 64),
      name: cleanVisibleText(academy.name, initial.academy.name, 64),
      level: cleanVisibleText(academy.level, initial.academy.level, 48),
      resources: normalizeStringList(academy.resources || initial.academy.resources, 5, 48),
      reputation: clampMetric(academy.reputation ?? initial.academy.reputation),
      publicSummary: cleanVisibleText(academy.publicSummary, initial.academy.publicSummary, 140)
    },
    classmates: (Array.isArray(source.classmates) ? source.classmates : initial.classmates)
      .map((entry) => normalizeClassmate(entry, worldState))
      .filter(Boolean)
      .slice(-STUDY_PROFILE_LIMITS.maxClassmates),
    sponsorship: {
      status: ["ready", "conditional", "not_ready"].includes(sponsorship.status)
        ? sponsorship.status
        : score >= STUDY_SPONSORSHIP_THRESHOLDS.ready
          ? "ready"
          : score >= STUDY_SPONSORSHIP_THRESHOLDS.conditional
            ? "conditional"
            : "not_ready",
      score,
      guarantorId: cleanVisibleText(sponsorship.guarantorId, initial.sponsorship.guarantorId, 64),
      guarantorName: cleanVisibleText(sponsorship.guarantorName, worldState.player?.teacher || initial.sponsorship.guarantorName, 48),
      publicSummary: cleanVisibleText(sponsorship.publicSummary, initial.sponsorship.publicSummary, 140),
      nextStep: cleanVisibleText(sponsorship.nextStep, initial.sponsorship.nextStep, 120),
      lastUpdatedTurn: Number.isFinite(sponsorship.lastUpdatedTurn)
        ? Math.max(0, Math.round(sponsorship.lastUpdatedTurn))
        : worldState.turnCount || 0
    }
  };
}

function ensureStudyProfileState(worldState = {}) {
  if (worldState.player && typeof worldState.player.teacher === "string") {
    const cleanedTeacher = cleanVisibleText(worldState.player.teacher, "", 48);
    worldState.player.teacher = cleanedTeacher || null;
  }
  worldState.studyProfile = normalizeStudyProfile(worldState.studyProfile, worldState);
  return worldState.studyProfile;
}

function latestExamEntries(worldState = {}, limit = STUDY_PROFILE_LIMITS.maxRecentExercises) {
  const history = Array.isArray(worldState.player?.examHistory)
    ? worldState.player.examHistory
    : [];
  return history.slice(-limit);
}

function dimensionTrendLabel(value) {
  if (value >= 80) return "强";
  if (value >= 65) return "平";
  return "弱";
}

function weaknessFromFlag(flag = {}, entry = {}, index = 0) {
  const type = cleanText(flag.type || flag.label, "exam_flag", 48);
  const labels = {
    too_short: "篇幅不足",
    anachronism: "不合时代语境",
    copy: "照抄疑云",
    ghostwriting: "代笔疑云"
  };
  const label = labels[type] || cleanText(flag.label, "监试疑点", 48);
  return {
    id: `flag-${entry.examId || entry.level || "exam"}-${type}-${index}`,
    label,
    detail: cleanText(flag.detail, "本场复核提示需要订正。", 100),
    source: "exam_audit",
    level: entry.level || null,
    examName: entry.examName || "",
    turn: entry.sceneTime?.submittedAtTurn ?? entry.sceneTime?.turnCount ?? 0
  };
}

function strengthsAndWeaknessesFromEntries(entries = []) {
  const strengths = [];
  const weaknesses = [];

  for (const entry of entries) {
    for (const [dimensionKey, config] of Object.entries(STUDY_DIMENSIONS)) {
      const score = scoreValue(entry.score, config.examScoreKey);
      if (!Number.isFinite(score)) continue;
      const base = {
        source: "exam_score",
        dimension: dimensionKey,
        level: entry.level || null,
        examName: entry.examName || "",
        score: Math.round(score),
        turn: entry.sceneTime?.submittedAtTurn ?? entry.sceneTime?.turnCount ?? 0
      };
      if (score < config.lowThreshold) {
        uniquePush(weaknesses, {
          ...base,
          id: `weak-${dimensionKey}-${entry.examId || entry.level || "exam"}`,
          label: config.weakLabel,
          detail: `${entry.examName || "本场"}${config.label}${Math.round(score)}分，低于本阶训练线。`
        }, (item) => item.id, STUDY_PROFILE_LIMITS.maxWeaknesses);
      } else if (score >= config.highThreshold) {
        uniquePush(strengths, {
          ...base,
          id: `strong-${dimensionKey}-${entry.examId || entry.level || "exam"}`,
          label: config.strongLabel,
          detail: `${entry.examName || "本场"}${config.label}${Math.round(score)}分，可作为后续文章长处。`
        }, (item) => item.id, STUDY_PROFILE_LIMITS.maxStrengths);
      }
    }

    const flags = Array.isArray(entry.authenticityCheck?.flags) ? entry.authenticityCheck.flags : [];
    flags.forEach((flag, index) => {
      uniquePush(weaknesses, weaknessFromFlag(flag, entry, index), (item) => item.id, STUDY_PROFILE_LIMITS.maxWeaknesses);
    });
    if (entry.authenticityCheck?.copy_detection?.is_copy) {
      uniquePush(weaknesses, {
        id: `flag-${entry.examId || entry.level || "exam"}-copy-detection`,
        label: "照抄疑云",
        detail: "本场被本地复核标记为近似旧文，后续须重练自出机杼。",
        source: "exam_audit",
        level: entry.level || null,
        examName: entry.examName || "",
        turn: entry.sceneTime?.submittedAtTurn ?? entry.sceneTime?.turnCount ?? 0
      }, (item) => item.id, STUDY_PROFILE_LIMITS.maxWeaknesses);
    }
  }

  return {
    strengths: strengths.slice(-STUDY_PROFILE_LIMITS.maxStrengths),
    weaknesses: weaknesses.slice(-STUDY_PROFILE_LIMITS.maxWeaknesses)
  };
}

function inferActionFocus(input = "") {
  const text = cleanText(input, "", 200);
  for (const [dimensionKey, pattern] of Object.entries(STUDY_ACTION_PATTERNS)) {
    if (pattern.test(text)) return dimensionKey;
  }
  if (/研读|读书|阅读|翻阅|诵读|学习|苦读|钻研|攻读|温书|习经/.test(text)) {
    return "classicsFoundation";
  }
  if (/拜师|拜访|请教|求教|访师|问学|投师|塾师/.test(text)) {
    return "eightLeggedForm";
  }
  if (/游学|结交|交友|清谈|雅集|讲会|访友|同窗|辩论|论辩|辩经|驳论|策问|讲论/.test(text)) {
    return "policyInsight";
  }
  if (/谋生|赚钱|代写|抄书|书信|做工|润笔|写序/.test(text)) {
    return "calligraphyCopying";
  }
  return null;
}

function inferStudyInteractionType(input = "") {
  const text = cleanText(input, "", 200);
  for (const [type, pattern] of Object.entries(STUDY_INTERACTION_PATTERNS)) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function ensureStudyNetworkCharacters(worldState = {}, interactionType = "") {
  if (!Array.isArray(worldState.characters)) worldState.characters = [];
  const ensureCharacter = (character) => {
    const exists = worldState.characters.some((entry) => entry?.id === character.id);
    if (!exists) worldState.characters.push(character);
  };

  const teacherName = cleanVisibleText(worldState.player?.teacher, "顾文衡", 48);
  const teacher = worldState.characters.find((entry) => entry?.id === STUDY_NETWORK_CHARACTER_IDS.teacher);
  if (teacher) {
    teacher.name = cleanVisibleText(worldState.player?.teacher, teacher.name || teacherName, 48);
    teacher.role = teacher.role || "乡中塾师";
  }

  if (["classmate", "academySeminar", "smallExercise", "sponsorship"].includes(interactionType)) {
    ensureCharacter({
      id: STUDY_NETWORK_CHARACTER_IDS.classmate,
      name: "沈砚舟",
      role: "书院同窗",
      loyalty: 48,
      ambition: 45,
      skill: 58,
      alive: true
    });
  }

  if (interactionType === "academySeminar") {
    ensureCharacter({
      id: STUDY_NETWORK_CHARACTER_IDS.academyMentor,
      name: "陈山长",
      role: "书院山长",
      loyalty: 55,
      ambition: 34,
      skill: 76,
      alive: true
    });
  }
}

function labelForFocus(key) {
  return STUDY_DIMENSIONS[key]?.label || "经义根柢";
}

function relationshipStatusFromValue(value = 0) {
  if (value >= 60) return "深相期许";
  if (value >= 20) return "相与亲厚";
  if (value >= 0) return "初有往来";
  return "尚待修复";
}

function buildSmallExerciseForFocus(focusKey, worldState = {}, source = "server") {
  const exercises = {
    classicsFoundation: "小题：取四书一句，先明题眼，再以两句收束本旨。",
    eightLeggedForm: "小题：限时作破题、承题各一段，先求脉络分明。",
    policyInsight: "策问：以本县钱粮或灾赈为题，列三条可行之策。",
    historicalAllusion: "史例：选一则前代兴废事，练习不堆典而能入题。",
    legalJudgment: "案牍：拆一则刑名小案，分法、情、势三层判断。",
    calligraphyCopying: "誊写：按朱卷行款誊旧文一页，圈出涂改处。",
    examEndurance: "限时：按号舍时辰拟纲成篇，记录疲惫与心浮处。"
  };
  return {
    id: `small-exercise-${focusKey}-${worldState.turnCount || 0}`,
    type: "small_exercise",
    title: `${labelForFocus(focusKey)}小题训练`,
    focus: labelForFocus(focusKey),
    summary: exercises[focusKey] || exercises.classicsFoundation,
    source,
    proposedByAi: false,
    turn: worldState.turnCount || 0,
    dateLabel: formatYearMonthPeriod(worldState)
  };
}

function buildTeacherFeedbackForInteraction(type, focusKey, worldState = {}) {
  const teacherName = cleanVisibleText(worldState.player?.teacher, "顾文衡", 48);
  const focus = labelForFocus(focusKey);
  const messages = {
    teacherFeedback: "先生就旧文逐段圈点，许你先稳题眼，再添辞采。",
    academySeminar: "讲席上山长命你把论点说清，同窗再以时务相诘。",
    classmate: "同窗互评文章，指出空泛处，也替你添一则可用史例。",
    smallExercise: "老师把小题拆成拟纲、破题、誊清三步，不许贪多。",
    sponsorship: "先生愿先观你三旬日课，再决定是否出具保结荐书。"
  };
  return {
    id: `teacher-feedback-${type}-${worldState.turnCount || 0}`,
    type,
    source: "server",
    teacherName,
    focus,
    advice: messages[type] || messages.teacherFeedback,
    reason: "服务器按玩家行动、可见师友关系和学业画像生成点评；AI 老师后续只能提交 proposal。",
    proposedByAi: false,
    turn: worldState.turnCount || 0
  };
}

function normalizeTeacherFeedbackProposal(proposal = {}, worldState = {}) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return null;
  const focusKey = STUDY_DIMENSIONS[proposal.focusKey] ? proposal.focusKey : null;
  const focus = focusKey ? labelForFocus(focusKey) : cleanProposalText(proposal.focus, "", 48);
  const advice = cleanProposalText(proposal.advice, "", 120);
  if (!focus || !advice) return null;
  const teacherName = cleanProposalText(
    proposal.teacherName,
    cleanVisibleText(worldState.player?.teacher, "顾文衡", 48),
    48
  );
  return {
    id: cleanProposalText(proposal.id, `teacher-proposal-${worldState.turnCount || 0}`, 80),
    type: "teacher_feedback_proposal",
    source: "ai_teacher_proposal",
    teacherName,
    focus,
    advice,
    reason: cleanProposalText(proposal.reason, "AI 老师建议经服务器采纳为可见点评。", 120),
    proposedByAi: true,
    turn: worldState.turnCount || 0
  };
}

function applyTeacherFeedbackProposal(worldState = {}, proposal = {}) {
  if (worldState.player?.role !== "scholar") {
    return { accepted: false, reason: "老师点评 proposal 仅适用于书生读书场景。", feedback: null };
  }
  const profile = ensureStudyProfileState(worldState);
  const normalized = normalizeTeacherFeedbackProposal(proposal, worldState);
  if (!normalized) {
    return { accepted: false, reason: "老师点评 proposal 不合 schema 或含敏感文本。", feedback: null };
  }
  newestPush(profile.teacherFeedback, normalized, (item) => item.id, STUDY_PROFILE_LIMITS.maxTeacherFeedback);
  newestPush(profile.teacherAdvice, {
    id: `${normalized.id}-advice`,
    source: normalized.source,
    teacherName: normalized.teacherName,
    focus: normalized.focus,
    advice: normalized.advice,
    reason: normalized.reason,
    proposedByAi: true,
    turn: normalized.turn
  }, (item) => item.id, STUDY_PROFILE_LIMITS.maxTeacherAdvice);
  profile.updatedAt = new Date().toISOString();
  profile.generatedAtTurn = worldState.turnCount || 0;
  return { accepted: true, reason: "服务器采纳为点评文本，不改变资格、关系、名位或官职。", feedback: normalized };
}

function sponsorshipStatus(score) {
  if (score >= STUDY_SPONSORSHIP_THRESHOLDS.ready) return "ready";
  if (score >= STUDY_SPONSORSHIP_THRESHOLDS.conditional) return "conditional";
  return "not_ready";
}

function updateSponsorship(profile = {}, worldState = {}, relationshipChanges = []) {
  const teacherRelationship = relationshipChanges
    .filter((change) => change.targetType === "character" && change.targetId === STUDY_NETWORK_CHARACTER_IDS.teacher)
    .at(-1)?.relationship?.after;
  const classmateRelationship = relationshipChanges
    .filter((change) => change.targetType === "character" && change.targetId === STUDY_NETWORK_CHARACTER_IDS.classmate)
    .at(-1)?.relationship?.after;
  const teacherValue = Number.isFinite(teacherRelationship)
    ? teacherRelationship
    : worldState.relationshipLedger?.characters?.[STUDY_NETWORK_CHARACTER_IDS.teacher]?.relationship || 0;
  const classmateValue = Number.isFinite(classmateRelationship)
    ? classmateRelationship
    : worldState.relationshipLedger?.characters?.[STUDY_NETWORK_CHARACTER_IDS.classmate]?.relationship || 0;
  const reputation = clampMetric(worldState.player?.reputation || 0);
  const scholarship = average(Object.values(profile.dimensions || {}));
  const score = clampMetric(
    teacherValue * 0.35 +
    Math.max(classmateValue, 0) * 0.15 +
    reputation * 0.25 +
    scholarship * 0.25
  );
  const status = sponsorshipStatus(score);
  const teacherName = cleanVisibleText(
    worldState.player?.teacher || profile.academyNetwork?.teacher?.name,
    "顾文衡",
    48
  );
  const summaries = {
    ready: `${teacherName}已可为本场举业作保；仍须由考试报名与考期规则裁定能否入场。`,
    conditional: `${teacherName}已有作保意思，但还要看近日文章、同窗口碑与盘费。`,
    not_ready: "保结未稳，宜先拜师请益、参加讲会或请同窗互评文章。"
  };
  const nextSteps = {
    ready: "备齐盘费与履历，待考期开场后由服务器报名裁决。",
    conditional: "再交一篇改定文章，并让同窗或山长留下可见评语。",
    not_ready: "拜访老师、参加书院讲会或完成小题训练。"
  };

  profile.academyNetwork.sponsorship = {
    status,
    score,
    guarantorId: STUDY_NETWORK_CHARACTER_IDS.teacher,
    guarantorName: teacherName,
    publicSummary: summaries[status],
    nextStep: nextSteps[status],
    lastUpdatedTurn: worldState.turnCount || 0
  };
  return profile.academyNetwork.sponsorship;
}

function runStudyInteractionStep(worldState = {}, input = "", options = {}) {
  const interactionType = inferStudyInteractionType(input);
  if (!interactionType || worldState.player?.role !== "scholar") {
    return { changed: false, events: [], attributeChanges: [], relationshipChanges: [] };
  }

  ensureStudyNetworkCharacters(worldState, interactionType);
  if (!worldState.player.teacher && ["teacherFeedback", "smallExercise", "sponsorship"].includes(interactionType)) {
    worldState.player.teacher = cleanVisibleText(
      worldState.characters.find((entry) => entry?.id === STUDY_NETWORK_CHARACTER_IDS.teacher)?.name,
      "顾文衡",
      48
    );
  }
  ensureRelationshipLedger(worldState);
  const profile = ensureStudyProfileState(worldState);
  const focusKey = inferActionFocus(input) || lowestDimensions(profile, 1)[0]?.key || "classicsFoundation";
  const beforeDimension = profile.dimensions[focusKey] || 0;
  const relationshipSuggestions = [];
  const teacherName = cleanVisibleText(
    worldState.player?.teacher || profile.academyNetwork.teacher.name,
    "顾文衡",
    48
  );

  if (["teacherFeedback", "smallExercise", "sponsorship"].includes(interactionType)) {
    relationshipSuggestions.push({
      targetType: "character",
      targetId: STUDY_NETWORK_CHARACTER_IDS.teacher,
      relationshipDelta: interactionType === "sponsorship" ? 4 : 3,
      resentmentDelta: -1,
      stance: "mentor",
      recentIntent: interactionType === "sponsorship" ? "考察保结与荐书风险" : "督促读书与改文",
      note: interactionType === "sponsorship" ? "询问保结，老师先看日课与品行。" : "请益改文，师生情分稍进。",
      reason: "S68.3 师长互动服务器裁决"
    });
  }

  if (["classmate", "academySeminar", "smallExercise"].includes(interactionType)) {
    relationshipSuggestions.push({
      targetType: "character",
      targetId: STUDY_NETWORK_CHARACTER_IDS.classmate,
      relationshipDelta: interactionType === "classmate" ? 4 : 2,
      resentmentDelta: 0,
      stance: "classmate_peer",
      recentIntent: "互评文章并观察科场竞争",
      note: "同窗互评文章，士林往来更熟。",
      reason: "S68.3 同窗互动服务器裁决"
    });
  }

  if (interactionType === "academySeminar") {
    relationshipSuggestions.push({
      targetType: "character",
      targetId: STUDY_NETWORK_CHARACTER_IDS.academyMentor,
      relationshipDelta: 3,
      resentmentDelta: 0,
      stance: "academy_patron",
      recentIntent: "观察讲会文章与书院声望",
      note: "参加书院讲会，山长留下评语。",
      reason: "S68.3 书院互动服务器裁决"
    });
  }

  const relationshipChanges = applyRelationshipChanges(worldState, relationshipSuggestions);
  profile.academyNetwork = normalizeAcademyNetwork(profile.academyNetwork, worldState);

  if (worldState.player?.teacher) {
    profile.academyNetwork.teacher.name = cleanVisibleText(worldState.player.teacher, teacherName, 48);
  }
  const teacherEntry = worldState.relationshipLedger?.characters?.[STUDY_NETWORK_CHARACTER_IDS.teacher];
  if (teacherEntry) {
    profile.academyNetwork.teacher.relationshipStatus = relationshipStatusFromValue(teacherEntry.relationship);
    profile.academyNetwork.teacher.publicSummary = `${profile.academyNetwork.teacher.name}与玩家情分${profile.academyNetwork.teacher.relationshipStatus}，可给点评、荐书或保结建议；事实仍由服务器裁决。`;
  }

  const classmateEntry = worldState.relationshipLedger?.characters?.[STUDY_NETWORK_CHARACTER_IDS.classmate];
  if (classmateEntry) {
    newestPush(profile.academyNetwork.classmates, {
      characterId: classmateEntry.id,
      name: classmateEntry.name,
      style: "同窗互评",
      relationshipStatus: relationshipStatusFromValue(classmateEntry.relationship),
      publicSummary: `${classmateEntry.name}常在书院互评文章，既可相助，也会形成科场竞争。`,
      lastUpdatedTurn: worldState.turnCount || 0
    }, (item) => item.characterId, STUDY_PROFILE_LIMITS.maxClassmates);
  }

  const academyEntry = worldState.relationshipLedger?.characters?.[STUDY_NETWORK_CHARACTER_IDS.academyMentor];
  if (academyEntry) {
    profile.academyNetwork.academy.name = "鹿鸣书院讲席";
    profile.academyNetwork.academy.level = "书院";
    profile.academyNetwork.academy.resources = ["四书旧注", "程文讲义", "策论会讲"];
    profile.academyNetwork.academy.reputation = clampMetric(profile.academyNetwork.academy.reputation + 4);
    profile.academyNetwork.academy.publicSummary = `${academyEntry.name}主持讲会，能提供书目、小题和同窗互评。`;
  }

  const feedback = buildTeacherFeedbackForInteraction(interactionType, focusKey, worldState);
  newestPush(profile.teacherFeedback, feedback, (item) => item.id, STUDY_PROFILE_LIMITS.maxTeacherFeedback);
  newestPush(profile.teacherAdvice, {
    id: `teacher-advice-interaction-${interactionType}-${worldState.turnCount || 0}`,
    source: "server",
    teacherName,
    focus: labelForFocus(focusKey),
    advice: feedback.advice,
    reason: "S68.3 师友互动生成的可见老师建议；关系与资格由服务器裁决。",
    proposedByAi: false,
    turn: worldState.turnCount || 0
  }, (item) => item.id, STUDY_PROFILE_LIMITS.maxTeacherAdvice);

  const exercise = buildSmallExerciseForFocus(focusKey, worldState);
  newestPush(profile.smallExercises, exercise, (item) => item.id, STUDY_PROFILE_LIMITS.maxSmallExercises);

  const config = STUDY_DIMENSIONS[focusKey] || STUDY_DIMENSIONS.classicsFoundation;
  for (const book of config.bookRecommendations || []) {
    newestPush(profile.recommendedBooks, {
      id: `book-${focusKey}-${book}`,
      type: "book_recommendation",
      title: book,
      focus: config.label,
      summary: `${teacherName}荐读${book}，用于补${config.label}。`,
      source: "server",
      proposedByAi: false,
      turn: worldState.turnCount || 0
    }, (item) => item.title, STUDY_PROFILE_LIMITS.maxRecommendedBooks);
  }

  const dimensionGain = interactionType === "smallExercise" ? 2 : 1;
  const afterDimension = clampMetric(beforeDimension + dimensionGain);
  profile.dimensions[focusKey] = afterDimension;
  const sponsorship = updateSponsorship(profile, worldState, relationshipChanges);
  profile.nextPlan = buildNextPlan(worldState, profile);
  profile.summary = buildStudySummary(profile);
  profile.generatedAtTurn = worldState.turnCount || 0;
  profile.updatedAt = new Date().toISOString();

  const attributeChanges = [];
  if (afterDimension !== beforeDimension) {
    attributeChanges.push({
      path: `studyProfile.dimensions.${focusKey}`,
      label: labelForFocus(focusKey),
      before: beforeDimension,
      after: afterDimension,
      reason: "师友讲习"
    });
  }
  attributeChanges.push({
    path: "studyProfile.academyNetwork.sponsorship.score",
    label: "保结稳度",
    before: options.previousSponsorshipScore ?? null,
    after: sponsorship.score,
    reason: "保结前置"
  });

  return {
    changed: true,
    events: [
      `${worldState.player?.name || "玩家"}经师友讲习更新读书簿：${feedback.advice}`,
      `${worldState.player?.name || "玩家"}保结前置状态：${sponsorship.publicSummary}`
    ],
    attributeChanges,
    relationshipChanges,
    interactionType,
    sponsorship
  };
}

function applyStudyAction(worldState = {}, input = "", result = {}, options = {}) {
  const focusKey = inferActionFocus(input);
  if (!focusKey) return { changed: false, events: [], attributeChanges: [] };

  const profile = ensureStudyProfileState(worldState);
  const config = STUDY_DIMENSIONS[focusKey];
  const before = profile.dimensions[focusKey] || 0;
  const patchPlayer = result.statePatch?.player || {};
  const playerBefore = options.playerBefore || worldState.player || {};
  const relatedGain = (config.sourceAttributes || []).reduce((total, key) => {
    const beforeValue = Number(playerBefore?.[key]);
    const afterValue = Number(patchPlayer[key]);
    if (!Number.isFinite(beforeValue) || !Number.isFinite(afterValue)) return total;
    return total + Math.max(0, afterValue - beforeValue);
  }, 0);
  const gain = Math.max(1, Math.min(4, relatedGain || 1));
  const after = clampMetric(before + gain);
  profile.dimensions[focusKey] = after;
  profile.generatedAtTurn = worldState.turnCount || 0;
  profile.updatedAt = new Date().toISOString();

  const exercise = {
    id: `study-action-${worldState.turnCount || 0}-${focusKey}`,
    type: "daily_lesson",
    title: config.label,
    summary: cleanVisibleText(input, "读书日课", 100),
    focus: config.label,
    dimension: focusKey,
    delta: after - before,
    source: "player_action",
    turn: worldState.turnCount || 0,
    dateLabel: formatYearMonthPeriod(worldState)
  };
  uniquePush(profile.recentExercises, exercise, (item) => item.id, STUDY_PROFILE_LIMITS.maxRecentExercises);
  profile.nextPlan = buildNextPlan(worldState, profile);
  profile.summary = buildStudySummary(profile);

  if (after === before) return { changed: false, events: [], attributeChanges: [] };
  return {
    changed: true,
    events: [`${worldState.player?.name || "玩家"}读书账本记入${config.label}日课。`],
    attributeChanges: [{
      path: `studyProfile.dimensions.${focusKey}`,
      label: config.label,
      before,
      after,
      reason: "读书账本"
    }]
  };
}

function updateStudyProfileAfterExam(worldState = {}, examContext = {}) {
  const profile = ensureStudyProfileState(worldState);
  const entries = latestExamEntries(worldState);
  const player = worldState.player || {};
  const dimensions = {};
  for (const [key, config] of Object.entries(STUDY_DIMENSIONS)) {
    dimensions[key] = buildDimensionValue(player, entries, config);
  }
  profile.dimensions = dimensions;

  const observed = strengthsAndWeaknessesFromEntries(entries);
  profile.strengths = observed.strengths;
  profile.weaknesses = observed.weaknesses;

  const latest = entries.at(-1);
  if (latest) {
    const exercise = {
      id: `exam-${latest.examId || latest.level || Date.now()}`,
      type: "exam_essay",
      title: `${latest.examName || "科场"}文卷`,
      summary: `${latest.score?.overall_score ?? "-"}分，${latest.score?.rank || "未定等第"}`,
      focus: latest.examQuestion ? cleanText(latest.examQuestion, latest.examName || "科场", 80) : latest.examName || "科场",
      level: latest.level || null,
      examName: latest.examName || "",
      source: "exam_history",
      turn: worldState.turnCount || 0,
      dateLabel: formatYearMonthPeriod(worldState)
    };
    uniquePush(profile.recentExercises, exercise, (item) => item.id, STUDY_PROFILE_LIMITS.maxRecentExercises);
  }

  profile.teacherAdvice = buildTeacherAdvice(worldState, profile, examContext);
  const feedback = buildTeacherFeedbackForInteraction(
    examContext.promotionResult?.passed ? "teacherFeedback" : "smallExercise",
    lowestDimensions(profile, 1)[0]?.key || "classicsFoundation",
    worldState
  );
  newestPush(profile.teacherFeedback, {
    ...feedback,
    id: `teacher-feedback-exam-${examContext.examId || worldState.turnCount || 0}`,
    focus: examContext.examName || feedback.focus,
    advice: examContext.promotionResult?.passed
      ? "本场虽有进益，仍须把考官批语归入日课，免得长处无根。"
      : "本场短处已明，先用小题补破口，再谈下次入场。",
    reason: "服务器按交卷评分、复核结果与学业画像生成老师复盘。"
  }, (item) => item.id, STUDY_PROFILE_LIMITS.maxTeacherFeedback);
  updateSponsorship(profile, worldState, []);
  profile.nextPlan = buildNextPlan(worldState, profile);
  profile.summary = buildStudySummary(profile);
  profile.generatedAtTurn = worldState.turnCount || 0;
  profile.updatedAt = new Date().toISOString();
  return profile;
}

function lowestDimensions(profile = {}, limit = 2) {
  return Object.entries(profile.dimensions || {})
    .map(([key, value]) => ({ key, value: clampMetric(value), config: STUDY_DIMENSIONS[key] }))
    .filter((item) => item.config)
    .sort((first, second) => first.value - second.value || first.config.label.localeCompare(second.config.label))
    .slice(0, limit);
}

function highestDimensions(profile = {}, limit = 2) {
  return Object.entries(profile.dimensions || {})
    .map(([key, value]) => ({ key, value: clampMetric(value), config: STUDY_DIMENSIONS[key] }))
    .filter((item) => item.config)
    .sort((first, second) => second.value - first.value || first.config.label.localeCompare(second.config.label))
    .slice(0, limit);
}

function buildTeacherAdvice(worldState = {}, profile = {}, examContext = {}) {
  const player = worldState.player || {};
  const teacherName = cleanVisibleText(player.teacher, "乡中塾师", 48);
  const weak = lowestDimensions(profile, 3);
  const advice = [];

  weak.forEach((item, index) => {
    advice.push({
      id: `teacher-advice-${item.key}-${worldState.turnCount || 0}-${index}`,
      source: "server",
      teacherName,
      focus: item.config.label,
      advice: adviceForDimension(item.key),
      reason: item.value < 65
        ? `${item.config.label}现为${item.value}，宜列入下旬日课。`
        : `${item.config.label}尚可再稳。`,
      proposedByAi: false,
      turn: worldState.turnCount || 0
    });
  });

  const score = examContext.score || {};
  const promotion = examContext.promotionResult || {};
  if (Number.isFinite(score.overall_score)) {
    advice.push({
      id: `teacher-advice-exam-${examContext.examId || worldState.turnCount || 0}`,
      source: "server",
      teacherName,
      focus: examContext.examName || "本场文卷",
      advice: promotion.passed
        ? "虽已取中，仍须把本场批语抄入札记，勿让长处流为空名。"
        : "落第不可只怨命数，应逐条拆解失分处，先补最短一门。",
      reason: `本场总评${score.overall_score}分，服务器据评分与复核生成后续读书建议。`,
      proposedByAi: false,
      turn: worldState.turnCount || 0
    });
  }

  return advice.slice(-STUDY_PROFILE_LIMITS.maxTeacherAdvice);
}

function adviceForDimension(key) {
  const map = {
    classicsFoundation: "每日晨读四书章句，摘出题眼，再以一句经义收束。",
    eightLeggedForm: "隔日练破题、承题、起讲，先求章法整齐，再求辞采。",
    policyInsight: "读一则地方钱粮或灾赈旧案，拟三条可行策。",
    historicalAllusion: "选史事两则，练习以一典入题，不可堆砌。",
    legalJudgment: "读律例和案牍小段，分清法、情、势三层。",
    calligraphyCopying: "每日小楷一页，按卷面格式誊清，减少涂改。",
    examEndurance: "按号舍时辰限时成篇，兼顾饮食作息与静心。"
  };
  return map[key] || "按老师所批短处，分旬补课。";
}

function buildNextPlan(worldState = {}, profile = {}) {
  const weakest = lowestDimensions(profile, 1)[0];
  const key = weakest?.key || "classicsFoundation";
  const config = STUDY_DIMENSIONS[key];
  const itemsByKey = {
    classicsFoundation: ["晨读四书章句", "摘录题眼与义理", "晚间拟经义短答"],
    eightLeggedForm: ["破题一则", "承题起讲各一段", "誊清旧文并圈改章法"],
    policyInsight: ["读钱粮或灾赈旧案", "拟三策提纲", "请师友驳难一回"],
    historicalAllusion: ["温史事两则", "各作一段入题例证", "删去浮泛辞藻"],
    legalJudgment: ["读律例短条", "拆一件刑名案牍", "写法情势三层判断"],
    calligraphyCopying: ["小楷临帖一页", "按朱卷格式誊文", "检查涂改与行款"],
    examEndurance: ["限时拟纲", "静坐调息", "模拟号舍半日作答"]
  };
  return {
    id: `study-plan-${key}-${worldState.turnCount || 0}`,
    title: `${config.label}补课`,
    focus: config.label,
    items: (itemsByKey[key] || itemsByKey.classicsFoundation).slice(0, STUDY_PROFILE_LIMITS.maxPlanItems),
    bookList: Array.from(new Set(config.bookRecommendations || [])).slice(0, STUDY_PROFILE_LIMITS.maxBooks),
    serverDecision: "服务器按当前弱点画像生成；真实 AI 老师后续只能提交 proposal。",
    proposedByAi: false,
    turn: worldState.turnCount || 0
  };
}

function buildStudySummary(profile = {}) {
  const weak = lowestDimensions(profile, 1)[0];
  const strong = highestDimensions(profile, 1)[0];
  if (!weak || !strong) return "读书画像待补。";
  return `长处在${strong.config.label}（${dimensionTrendLabel(strong.value)}），短处在${weak.config.label}（${dimensionTrendLabel(weak.value)}）。`;
}

function buildStudyProfileView(worldState = {}) {
  const profile = ensureStudyProfileState(worldState);
  const view = cloneJson(profile);
  view.academyNetwork = normalizeAcademyNetwork(view.academyNetwork, worldState);
  view.generatedAtTurn = worldState.turnCount || 0;
  view.dateLabel = formatYearMonthPeriod(worldState);
  view.dimensionLabels = Object.fromEntries(
    Object.entries(STUDY_DIMENSIONS).map(([key, config]) => [key, config.label])
  );
  view.strengths = (view.strengths || []).slice(-STUDY_PROFILE_LIMITS.maxStrengths);
  view.weaknesses = (view.weaknesses || []).slice(-STUDY_PROFILE_LIMITS.maxWeaknesses);
  view.teacherAdvice = (view.teacherAdvice || []).slice(-STUDY_PROFILE_LIMITS.maxTeacherAdvice);
  view.teacherFeedback = (view.teacherFeedback || []).slice(-STUDY_PROFILE_LIMITS.maxTeacherFeedback);
  view.recentExercises = (view.recentExercises || []).slice(-STUDY_PROFILE_LIMITS.maxRecentExercises);
  view.smallExercises = (view.smallExercises || []).slice(-STUDY_PROFILE_LIMITS.maxSmallExercises);
  view.recommendedBooks = (view.recommendedBooks || []).slice(-STUDY_PROFILE_LIMITS.maxRecommendedBooks);
  view.nextPlan = view.nextPlan ? normalizeStudyPlan(view.nextPlan, worldState) : null;
  view.aiReadScope = "AI 老师、出题与评卷只能读取本 view 的可见摘要；不得读取原始审计、模型原始建议、隐藏札记、完整提示词、本地路径或密钥。";
  return view;
}

function summarizeStudyProfileForPrompt(worldState = {}) {
  const view = buildStudyProfileView(worldState);
  return {
    schemaVersion: view.schemaVersion,
    generatedAtTurn: view.generatedAtTurn,
    summary: view.summary,
    dimensions: view.dimensions,
    strengths: (view.strengths || []).map((item) => ({
      label: item.label,
      detail: item.detail,
      source: item.source
    })),
    weaknesses: (view.weaknesses || []).map((item) => ({
      label: item.label,
      detail: item.detail,
      source: item.source
    })),
    teacherAdvice: (view.teacherAdvice || []).map((item) => ({
      focus: item.focus,
      advice: item.advice,
      reason: item.reason
    })),
    teacherFeedback: (view.teacherFeedback || []).map((item) => ({
      focus: item.focus,
      advice: item.advice,
      source: item.source,
      proposedByAi: item.proposedByAi === true
    })),
    smallExercises: (view.smallExercises || []).map((item) => ({
      title: item.title,
      focus: item.focus,
      summary: item.summary
    })),
    recommendedBooks: (view.recommendedBooks || []).map((item) => ({
      title: item.title,
      focus: item.focus,
      summary: item.summary
    })),
    academyNetwork: view.academyNetwork ? {
      teacher: view.academyNetwork.teacher,
      academy: view.academyNetwork.academy,
      classmates: view.academyNetwork.classmates,
      sponsorship: view.academyNetwork.sponsorship
    } : null,
    nextPlan: view.nextPlan ? {
      title: view.nextPlan.title,
      focus: view.nextPlan.focus,
      items: view.nextPlan.items,
      bookList: view.nextPlan.bookList,
      serverDecision: view.nextPlan.serverDecision
    } : null,
    authority: "只读学业画像；AI 可据此点评或建议读书计划，属性、关系、考试资格和名位仍由服务器裁决。"
  };
}

module.exports = {
  applyTeacherFeedbackProposal,
  applyStudyAction,
  buildStudyProfileView,
  createInitialStudyProfile,
  ensureStudyProfileState,
  runStudyInteractionStep,
  summarizeStudyProfileForPrompt,
  updateStudyProfileAfterExam
};
