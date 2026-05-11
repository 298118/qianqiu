const {
  STUDY_ACTION_PATTERNS,
  STUDY_DIMENSIONS,
  STUDY_PROFILE_LIMITS,
  STUDY_PROFILE_SCHEMA_VERSION
} = require("./studyProfileConfig");
const { clamp } = require("./stateRules");
const { formatYearMonthPeriod } = require("./time");

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = "", maxLength = STUDY_PROFILE_LIMITS.maxVisibleText) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function uniquePush(list, item, key = (value) => value, limit = 12) {
  if (!item) return list;
  const marker = key(item);
  if (!marker || list.some((entry) => key(entry) === marker)) return list;
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
        teacherName: player.teacher || "乡中塾师",
        focus: "经义根柢",
        advice: "先稳四书章句，每旬择一题拟纲，不急求浮词。",
        reason: "初入寒窗，服务器按当前学业属性生成基础日课。",
        proposedByAi: false,
        turn: worldState.turnCount || 0
      }
    ],
    recentExercises: [],
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
    recentExercises: [],
    nextPlan: profile.nextPlan && typeof profile.nextPlan === "object" ? profile.nextPlan : initial.nextPlan,
    summary: initial.summary,
    authorityBoundary: initial.authorityBoundary
  };

  for (const key of Object.keys(STUDY_DIMENSIONS)) {
    normalized.dimensions[key] = clampMetric(profile.dimensions?.[key] ?? initial.dimensions[key]);
  }

  const normalizeListItem = (item) => {
    if (typeof item === "string") return cleanText(item);
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const next = {};
    for (const key of ["id", "label", "detail", "source", "focus", "advice", "reason", "teacherName", "level", "examName", "type", "title", "summary", "dimension", "dateLabel"]) {
      if (key in item) next[key] = cleanText(item[key]);
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
  normalized.recentExercises = (Array.isArray(profile.recentExercises) ? profile.recentExercises : [])
    .map(normalizeListItem)
    .filter(Boolean)
    .slice(-STUDY_PROFILE_LIMITS.maxRecentExercises);

  if (normalized.nextPlan && typeof normalized.nextPlan === "object") {
    normalized.nextPlan = normalizeStudyPlan(normalized.nextPlan, worldState);
  }
  normalized.summary = cleanText(profile.summary, initial.summary, 180);
  return normalized;
}

function normalizeStudyPlan(plan = {}, worldState = {}) {
  const items = Array.isArray(plan.items)
    ? plan.items.map((item) => cleanText(item, "", 80)).filter(Boolean)
    : [];
  const bookList = Array.isArray(plan.bookList)
    ? plan.bookList.map((item) => cleanText(item, "", 48)).filter(Boolean)
    : [];
  return {
    id: cleanText(plan.id, `study-plan-${worldState.turnCount || 0}`, 80),
    title: cleanText(plan.title, "下旬读书日课", 80),
    focus: cleanText(plan.focus, "经义根柢", 48),
    items: items.slice(0, STUDY_PROFILE_LIMITS.maxPlanItems),
    bookList: bookList.slice(0, STUDY_PROFILE_LIMITS.maxBooks),
    serverDecision: cleanText(
      plan.serverDecision,
      "服务器裁决读书计划；AI 只可提出建议。",
      120
    ),
    proposedByAi: plan.proposedByAi === true,
    turn: Number.isFinite(plan.turn) ? Math.max(0, Math.round(plan.turn)) : worldState.turnCount || 0
  };
}

function ensureStudyProfileState(worldState = {}) {
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
    summary: cleanText(input, "读书日课", 100),
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
  const teacherName = player.teacher || "乡中塾师";
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
  view.generatedAtTurn = worldState.turnCount || 0;
  view.dateLabel = formatYearMonthPeriod(worldState);
  view.dimensionLabels = Object.fromEntries(
    Object.entries(STUDY_DIMENSIONS).map(([key, config]) => [key, config.label])
  );
  view.strengths = (view.strengths || []).slice(-STUDY_PROFILE_LIMITS.maxStrengths);
  view.weaknesses = (view.weaknesses || []).slice(-STUDY_PROFILE_LIMITS.maxWeaknesses);
  view.teacherAdvice = (view.teacherAdvice || []).slice(-STUDY_PROFILE_LIMITS.maxTeacherAdvice);
  view.recentExercises = (view.recentExercises || []).slice(-STUDY_PROFILE_LIMITS.maxRecentExercises);
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
  applyStudyAction,
  buildStudyProfileView,
  createInitialStudyProfile,
  ensureStudyProfileState,
  summarizeStudyProfileForPrompt,
  updateStudyProfileAfterExam
};
