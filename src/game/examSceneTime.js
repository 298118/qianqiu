const { formatYearMonthPeriod, normalizeCalendar } = require("./time");
const { cleanPreparationText } = require("./examTravel");

const EXAM_SCENE_PHASES = Object.freeze([
  { key: "entry", label: "入场", elapsedHours: 0 },
  { key: "question_review", label: "发题审题", elapsedHours: 1 },
  { key: "outline", label: "拟纲", elapsedHours: 2 },
  { key: "drafting", label: "作答", elapsedHours: 4 },
  { key: "fair_copy", label: "誊清", elapsedHours: 6 },
  { key: "submitted", label: "交卷", elapsedHours: 8 }
]);

const PHASE_INDEX = new Map(EXAM_SCENE_PHASES.map((phase, index) => [phase.key, index]));
const PHASE_BY_KEY = new Map(EXAM_SCENE_PHASES.map((phase) => [phase.key, phase]));
const LAST_WRITING_PHASE = "fair_copy";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createGlobalDateStamp(worldState = {}) {
  const calendar = normalizeCalendar(worldState);
  return {
    ...calendar,
    turnCount: Math.max(0, Math.round(Number(worldState.turnCount) || 0)),
    label: formatYearMonthPeriod(worldState)
  };
}

function getPhase(key, fallback = "entry") {
  return PHASE_BY_KEY.get(key) || PHASE_BY_KEY.get(fallback) || EXAM_SCENE_PHASES[0];
}

function clampSceneTurnCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function resolvePhaseKey(activeExam = {}, fallback = "entry") {
  return activeExam.sceneTime?.phase || activeExam.scenePhase || fallback;
}

function attachExamSceneTime(activeExam, worldState, phaseKey = "entry", options = {}) {
  if (!isPlainObject(activeExam)) return null;

  const previousSceneTime = isPlainObject(activeExam.sceneTime) ? activeExam.sceneTime : {};
  const phase = getPhase(phaseKey, previousSceneTime.phase || "entry");
  const stamp = createGlobalDateStamp(worldState);
  const turnCount = clampSceneTurnCount(previousSceneTime.turnCount ?? activeExam.sceneTurnCount) +
    (options.incrementSceneTurn ? 1 : 0);
  const previousHours = Number(previousSceneTime.elapsedHours ?? activeExam.sceneElapsedHours);
  const elapsedHours = Math.max(
    phase.elapsedHours,
    Number.isFinite(previousHours) ? Math.max(0, Math.round(previousHours)) : 0
  );
  const startedAt = previousSceneTime.startedAt || activeExam.globalStartedAt || stamp;
  const sceneTime = {
    type: "exam",
    phase: phase.key,
    phaseLabel: phase.label,
    turnCount,
    elapsedHours,
    startedAt,
    updatedAt: stamp
  };

  if (typeof options.input === "string" && options.input.trim()) {
    sceneTime.lastInput = options.input.trim().slice(0, 120);
  }

  activeExam.sceneTime = sceneTime;
  activeExam.scenePhase = phase.key;
  activeExam.scenePhaseLabel = phase.label;
  activeExam.sceneTurnCount = turnCount;
  activeExam.sceneElapsedHours = elapsedHours;
  activeExam.globalStartedAt = startedAt;
  activeExam.globalUpdatedAt = stamp;

  return sceneTime;
}

function getNextPhaseKey(currentKey, input = "") {
  const currentIndex = PHASE_INDEX.get(currentKey) ?? 0;
  const cappedNextIndex = Math.min(currentIndex + 1, PHASE_INDEX.get(LAST_WRITING_PHASE));
  const text = input.trim();
  let targetIndex = cappedNextIndex;

  if (/誊|清稿|抄录|缮写|定稿/.test(text)) {
    targetIndex = PHASE_INDEX.get("fair_copy");
  } else if (/作答|作文|成文|下笔|书写|写/.test(text)) {
    targetIndex = PHASE_INDEX.get("drafting");
  } else if (/拟纲|提纲|破题|承题|布局|章法/.test(text)) {
    targetIndex = PHASE_INDEX.get("outline");
  } else if (/审题|看题|读题|思索|立意/.test(text)) {
    targetIndex = PHASE_INDEX.get("question_review");
  }

  const finalIndex = Math.max(cappedNextIndex, targetIndex);
  return EXAM_SCENE_PHASES[Math.min(finalIndex, PHASE_INDEX.get(LAST_WRITING_PHASE))].key;
}

function summarizeQuestion(activeExam = {}) {
  if (typeof activeExam.examQuestion !== "string") return "";
  const firstLine = activeExam.examQuestion.split(/\r?\n/).find((line) => line.trim()) || "";
  return firstLine.trim().slice(0, 48);
}

function buildExamSceneNarrative(activeExam = {}, input = "", sceneTime = {}) {
  const examName = activeExam.examName || "本场考试";
  const phaseLabel = sceneTime.phaseLabel || getPhase(sceneTime.phase).label;
  const question = summarizeQuestion(activeExam);
  const questionNote = question ? `题意仍在案前：“${question}”。` : "";
  const action = input.trim();
  const actionNote = action ? `你将“${action.slice(0, 48)}”收束为场内一步。` : "你凝神收束场内一步。";

  if (sceneTime.phase === "outline") {
    return `${examName}号舍之中，${actionNote}${questionNote}你先分清题眼，拟定起承转合，暂不惊动场外年月。`;
  }
  if (sceneTime.phase === "drafting") {
    return `${examName}席上灯影渐稳，${actionNote}${questionNote}腹稿开始落纸，文气由散入整，场外仍停在入场时的旬日。`;
  }
  if (sceneTime.phase === "fair_copy") {
    return `${examName}将近收束，${actionNote}${questionNote}你校定句读，准备誊清交卷，全局年月旬不因此推进。`;
  }
  if (sceneTime.phase === "submitted") {
    return `${examName}卷成封送，${actionNote}本场局部时间记为${phaseLabel}，等待放榜。`;
  }

  return `${examName}场中，${actionNote}${questionNote}你沉心审题，局部阶段推进至${phaseLabel}，全局年月旬不变。`;
}

function advanceExamScenePhase(activeExam, worldState, input) {
  const currentKey = resolvePhaseKey(activeExam, activeExam?.examQuestion ? "question_review" : "entry");
  const nextKey = getNextPhaseKey(currentKey, input);
  const sceneTime = attachExamSceneTime(activeExam, worldState, nextKey, {
    incrementSceneTurn: true,
    input
  });
  const narrative = buildExamSceneNarrative(activeExam, input, sceneTime);
  const event = `${activeExam.examName || "考试"}场内推进至${sceneTime.phaseLabel}，全局时间仍为${sceneTime.updatedAt.label}。`;

  return {
    sceneTime,
    narrative,
    event
  };
}

function markExamSceneSubmitted(activeExam, worldState, input = "交卷") {
  const sceneTime = attachExamSceneTime(activeExam, worldState, "submitted", {
    input
  });
  activeExam.globalSubmittedAt = sceneTime.updatedAt;
  return sceneTime;
}

function buildExamSceneFeedback(worldState, sceneTime, event) {
  const stamp = createGlobalDateStamp(worldState);
  return {
    cadence: "scene",
    label: "场景",
    completedMonth: false,
    timeAdvance: {
      from: stamp,
      to: stamp
    },
    summary: `科场局部推进至${sceneTime.phaseLabel}，全局时间仍为${stamp.label}。`,
    events: event ? [event] : [],
    attributeChanges: []
  };
}

function clampPublicNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function sanitizeSceneDateStampForView(stamp = null) {
  if (!isPlainObject(stamp)) return null;
  return {
    dynasty: cleanPreparationText(stamp.dynasty, "明", 24),
    year: clampPublicNumber(stamp.year, 0, 10000, 1644),
    month: clampPublicNumber(stamp.month, 1, 12, 1),
    tenDayPeriod: clampPublicNumber(stamp.tenDayPeriod, 1, 3, 1),
    turnCount: clampPublicNumber(stamp.turnCount, 0, 1000000, 0),
    label: cleanPreparationText(stamp.label, "", 80)
  };
}

function sanitizeExamSceneTimeForView(sceneTime = null) {
  if (!isPlainObject(sceneTime)) return null;
  const output = {
    type: "exam",
    phase: cleanPreparationText(sceneTime.phase, "entry", 40),
    phaseLabel: cleanPreparationText(sceneTime.phaseLabel, "入场", 40),
    turnCount: clampPublicNumber(sceneTime.turnCount, 0, 1000000, 0),
    elapsedHours: clampPublicNumber(sceneTime.elapsedHours, 0, 240, 0),
    startedAt: sanitizeSceneDateStampForView(sceneTime.startedAt),
    updatedAt: sanitizeSceneDateStampForView(sceneTime.updatedAt)
  };
  const safeInput = cleanPreparationText(sceneTime.lastInput, "", 120);
  if (safeInput) {
    output.lastInput = safeInput;
  }
  return output;
}

module.exports = {
  EXAM_SCENE_PHASES,
  advanceExamScenePhase,
  attachExamSceneTime,
  buildExamSceneFeedback,
  createGlobalDateStamp,
  markExamSceneSubmitted,
  sanitizeExamSceneTimeForView
};
