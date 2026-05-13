const {
  TIME_SKIP_ACTIONS,
  TIME_SKIP_DEFAULT_STRATEGY,
  TIME_SKIP_HALF_MONTH_TICKS,
  TIME_SKIP_INTERRUPT_EVENT_TYPES,
  TIME_SKIP_MAX_TICKS,
  TIME_SKIP_PER_STEP_BUDGET,
  TIME_SKIP_SCHEMA_VERSION,
  TIME_SKIP_TICKS_PER_MONTH
} = require("./timeSkipConfig");
const { formatYearMonthPeriod } = require("./time");

const SENSITIVE_TIME_SKIP_TEXT_PATTERN = /(hidden|sealed|raw|rawProvider|provider proposal|prompt|api[_ -]?key|sk-[A-Za-z0-9_-]{4,}|tp-[A-Za-z0-9_-]{4,}|data[\\/](?:sessions|audit)|sqlite|event_log|ai_change_proposals|world_state_json|prompt_retrieval_index|file:\/\/|[A-Za-z]:[\\/]|\/(?:mnt|home|tmp|var|etc|Users|workspace)\b)/i;

const ACTION_PATTERNS = Object.freeze({
  study: /学习|读书|研读|温书|苦读|攻读|习经|看书|作文|制艺|八股|策论|经义/,
  convalesce: /养病|养伤|休养|调养|病中|卧病|养气|静养/,
  official_routine: /照旧处理|照常处理|按例处理|按旧例|旧例|任上|署务|文案|办差|差事|呈报|上官|本署|案牍|公务|政务/,
  routine: /照旧|照常|按例|度日|闲居|闭门|静居|休息|等待|跳过|过一段/
});

const SKIP_INTENT_PATTERN = /跳时|跳过|快进|略过|度过|过完|等到|一直到|闭门|照旧|照常|按例|旧例|一口气|连续/;

const CHINESE_NUMBER_VALUES = Object.freeze({
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanVisibleText(value, fallback = "", maxLength = 160) {
  const text = cleanText(value, "", maxLength);
  if (text && !SENSITIVE_TIME_SKIP_TEXT_PATTERN.test(text)) return text;
  const fallbackText = cleanText(fallback, "", maxLength);
  return fallbackText && !SENSITIVE_TIME_SKIP_TEXT_PATTERN.test(fallbackText) ? fallbackText : "";
}

function parseChineseNumber(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  if (Object.prototype.hasOwnProperty.call(CHINESE_NUMBER_VALUES, text)) {
    return CHINESE_NUMBER_VALUES[text];
  }
  if (text === "十") return 10;
  const tenIndex = text.indexOf("十");
  if (tenIndex !== -1) {
    const high = text.slice(0, tenIndex);
    const low = text.slice(tenIndex + 1);
    const tens = high ? CHINESE_NUMBER_VALUES[high] : 1;
    const ones = low ? CHINESE_NUMBER_VALUES[low] : 0;
    if (Number.isFinite(tens) && Number.isFinite(ones)) return tens * 10 + ones;
  }
  return null;
}

function durationMatch(text, regex) {
  const match = text.match(regex);
  if (!match) return null;
  return match;
}

function parseDuration(text) {
  const source = cleanText(text, "", 220);
  if (!source) return null;
  const normalized = source.replace(/\s+/g, "");

  const halfMonth = durationMatch(normalized, /(半个?月|半月)/);
  if (halfMonth) {
    return {
      amount: 0.5,
      unit: "month",
      ticks: TIME_SKIP_HALF_MONTH_TICKS,
      sourceText: halfMonth[0]
    };
  }

  const month = durationMatch(normalized, /([0-9一二两三四五六七八九十]+)(?:个)?月/);
  if (month) {
    const amount = parseChineseNumber(month[1]);
    if (amount) {
      return {
        amount,
        unit: "month",
        ticks: amount * TIME_SKIP_TICKS_PER_MONTH,
        sourceText: month[0]
      };
    }
  }

  const tenDay = durationMatch(normalized, /([0-9一二两三四五六七八九十]+)(?:个)?旬/);
  if (tenDay) {
    const amount = parseChineseNumber(tenDay[1]);
    if (amount) {
      return {
        amount,
        unit: "ten_day",
        ticks: amount,
        sourceText: tenDay[0]
      };
    }
  }

  const day = durationMatch(normalized, /([0-9一二两三四五六七八九十]+)(?:日|天)/);
  if (day) {
    const amount = parseChineseNumber(day[1]);
    if (amount) {
      return {
        amount,
        unit: "day",
        ticks: Math.max(1, Math.ceil(amount / 10)),
        sourceText: day[0]
      };
    }
  }

  return null;
}

function inferActionType(text, worldState = {}) {
  const source = cleanText(text, "", 220);
  const role = worldState?.player?.role;
  const canUseOfficialRoutine = ["official", "magistrate", "minister", "general", "emperor"].includes(role);
  for (const [actionType, pattern] of Object.entries(ACTION_PATTERNS)) {
    if (!pattern.test(source)) continue;
    if (actionType === "official_routine" && !canUseOfficialRoutine) return "routine";
    return actionType;
  }
  if (canUseOfficialRoutine) {
    return "official_routine";
  }
  return "routine";
}

function detectTimeSkipIntent(playerInput, context = {}) {
  const rawInput = cleanText(playerInput, "", 260);
  if (!rawInput) return null;

  const duration = parseDuration(rawInput);
  if (!duration) return null;

  const actionType = inferActionType(rawInput, context.worldState);
  const hasActionSignal = Boolean(ACTION_PATTERNS[actionType]?.test(rawInput));
  const hasSkipSignal = SKIP_INTENT_PATTERN.test(rawInput);
  if (!hasActionSignal && !hasSkipSignal) return null;

  const safeInput = cleanVisibleText(rawInput, "跳时请求已按可见意图清洗。", 140);
  return {
    detected: true,
    schemaVersion: TIME_SKIP_SCHEMA_VERSION,
    actionType,
    actionLabel: TIME_SKIP_ACTIONS[actionType]?.label || TIME_SKIP_ACTIONS.routine.label,
    requestedDuration: duration,
    ticks: duration.ticks,
    safeInput,
    confidence: hasActionSignal && hasSkipSignal ? 0.9 : 0.78,
    source: "deterministic_parser"
  };
}

function buildTickInstruction(intent, index) {
  const action = TIME_SKIP_ACTIONS[intent.actionType] || TIME_SKIP_ACTIONS.routine;
  const tickNumber = index + 1;
  return {
    index: tickNumber,
    actionType: intent.actionType,
    actionLabel: action.label,
    input: cleanVisibleText(
      `${action.label}（跳时第${tickNumber}旬）：${action.tickInput}`,
      `跳时第${tickNumber}旬照旧结算。`,
      140
    )
  };
}

function buildTimeSkipPlan(playerInput, aiRuntime = {}, options = {}) {
  const intent = options.intent || detectTimeSkipIntent(playerInput, options);
  if (!intent?.detected) {
    return {
      schemaVersion: TIME_SKIP_SCHEMA_VERSION,
      detected: false,
      status: "not_detected",
      reason: "未识别为跳时请求。"
    };
  }

  const routePolicy = aiRuntime?.routePolicy || {};
  const ticksForInstructions = Math.min(Math.max(0, intent.ticks), TIME_SKIP_MAX_TICKS);
  const tickInstructions = Array.from({ length: ticksForInstructions }, (_, index) =>
    buildTickInstruction(intent, index)
  );

  return {
    schemaVersion: TIME_SKIP_SCHEMA_VERSION,
    detected: true,
    status: "planned",
    source: intent.source || "deterministic_parser",
    plannerTaskType: TIME_SKIP_PER_STEP_BUDGET.plannerTaskType,
    strategy: TIME_SKIP_DEFAULT_STRATEGY,
    actionType: intent.actionType,
    actionLabel: intent.actionLabel,
    requestedDuration: intent.requestedDuration,
    requestedTicks: intent.ticks,
    ticks: intent.ticks,
    safeInput: intent.safeInput,
    confidence: intent.confidence,
    interruptPolicy: {
      eventTypes: [...TIME_SKIP_INTERRUPT_EVENT_TYPES],
      stopOnFirstInterrupt: true
    },
    perStepBudget: { ...TIME_SKIP_PER_STEP_BUDGET },
    routePolicySummary: {
      taskType: TIME_SKIP_PER_STEP_BUDGET.plannerTaskType,
      hasPolicy: Object.keys(routePolicy).length > 0
    },
    tickInstructions
  };
}

function hasActiveExam(activeExam) {
  return Boolean(activeExam);
}

function validateTimeSkipPlan(plan, worldState = {}) {
  const reasons = [];
  const warnings = [];

  if (!isPlainObject(plan) || plan.detected !== true) {
    reasons.push("未生成可执行跳时计划。");
  }

  if (hasActiveExam(worldState?.activeExam)) {
    reasons.push("当前已有考试场景或待取题考试，不能执行全局跳时。");
  }

  const ticks = Number(plan?.ticks);
  if (!Number.isFinite(ticks) || Math.round(ticks) !== ticks || ticks < 1) {
    reasons.push("跳时时长无效。");
  } else if (ticks > TIME_SKIP_MAX_TICKS) {
    reasons.push(`单次跳时最多${TIME_SKIP_MAX_TICKS}旬。`);
  }

  if (plan?.strategy && plan.strategy !== TIME_SKIP_DEFAULT_STRATEGY) {
    reasons.push("跳时策略不受支持。");
  }

  if (!Object.prototype.hasOwnProperty.call(TIME_SKIP_ACTIONS, plan?.actionType)) {
    reasons.push("跳时行动类型不受支持。");
  }

  if (SENSITIVE_TIME_SKIP_TEXT_PATTERN.test(JSON.stringify(plan || {}))) {
    warnings.push("跳时计划含敏感词，已要求使用服务器清洗文本。");
  }

  if (Array.isArray(plan?.tickInstructions) && Number.isFinite(ticks) && ticks <= TIME_SKIP_MAX_TICKS) {
    if (plan.tickInstructions.length !== ticks) {
      reasons.push("跳时逐旬指令数量与时长不一致。");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    plan
  };
}

function normalizeInterruption(value) {
  if (!value) return null;
  const type = cleanVisibleText(value.type, "unknown", 48) || "unknown";
  return {
    type,
    label: cleanVisibleText(value.label, "跳时中断", 60),
    reason: cleanVisibleText(value.reason, "出现需要玩家亲自处理的事件。", 180),
    todo: cleanVisibleText(value.todo, "请先处理此事，再决定是否继续跳时。", 180),
    tickIndex: Number.isFinite(Number(value.tickIndex)) ? Math.max(1, Math.round(Number(value.tickIndex))) : null
  };
}

function normalizeTickResult(output = {}, instruction = {}, index = 0, startedAt = Date.now()) {
  const payload = output.payload || output;
  const worldTick = output.worldTick || payload.worldTick || null;
  const timeAdvance = worldTick?.timeAdvance || null;
  const to = timeAdvance?.to || null;
  const dateLabel = cleanVisibleText(
    output.dateLabel || (to ? formatYearMonthPeriod({
      dynasty: output.dynasty || payload.worldState?.dynasty,
      ...to
    }) : ""),
    "",
    80
  );
  const monthlyBriefing = payload.playerMonthlyBriefing || output.playerMonthlyBriefing || null;
  const longTermEvents = payload.longTermEvents || output.longTermEvents || null;
  const officialCareer = payload.officialCareer || output.officialCareer || null;

  return {
    index: instruction.index || index + 1,
    actionType: instruction.actionType || output.actionType || "routine",
    actionLabel: cleanVisibleText(instruction.actionLabel || output.actionLabel, "跳时", 48),
    input: cleanVisibleText(instruction.input || output.input, "逐旬跳时", 140),
    dateLabel,
    cadence: worldTick?.cadence || null,
    completedMonth: Boolean(worldTick?.completedMonth),
    worldTickSummary: cleanVisibleText(worldTick?.summary, "", 180),
    events: Array.isArray(worldTick?.events)
      ? worldTick.events.map((event) => cleanVisibleText(event, "", 180)).filter(Boolean).slice(0, 3)
      : [],
    longTermSummary: cleanVisibleText(longTermEvents?.summary, "", 180),
    officialCareerSummary: cleanVisibleText(officialCareer?.summary, "", 180),
    playerMonthlyBriefingGenerated: Boolean(monthlyBriefing?.generated),
    playerMonthlyBriefingSummary: cleanVisibleText(monthlyBriefing?.summary, "", 180),
    attributeChangeCount: Array.isArray(payload.attributeChanges) ? payload.attributeChanges.length : 0,
    relationshipChangeCount: Array.isArray(payload.relationshipChanges) ? payload.relationshipChanges.length : 0,
    durationMs: Math.max(0, Date.now() - startedAt),
    interruption: normalizeInterruption(output.interruption),
    payload
  };
}

async function runTimeSkipTicks(worldState, plan, options = {}) {
  const validation = validateTimeSkipPlan(plan, worldState);
  if (!validation.ok) {
    return {
      executed: false,
      blocked: true,
      plan,
      validation,
      completedTicks: 0,
      requestedTicks: Number(plan?.ticks) || 0,
      tickResults: [],
      interrupted: false,
      interruption: null
    };
  }

  if (typeof options.runTick !== "function") {
    throw new Error("runTimeSkipTicks requires options.runTick");
  }

  const tickResults = [];
  let interruption = null;
  const instructions = plan.tickInstructions.slice(0, plan.ticks);

  for (let index = 0; index < instructions.length; index += 1) {
    const instruction = instructions[index];
    const startedAt = Date.now();
    const output = await options.runTick({ worldState, plan, tick: instruction, index });
    const normalized = normalizeTickResult(output, instruction, index, startedAt);
    const detectedInterruption = normalized.interruption || normalizeInterruption(
      typeof options.detectInterruption === "function"
        ? options.detectInterruption({ worldState, plan, tick: instruction, tickResult: normalized, tickResults })
        : null
    );
    if (detectedInterruption) {
      normalized.interruption = {
        ...detectedInterruption,
        tickIndex: detectedInterruption.tickIndex || instruction.index
      };
    }
    tickResults.push(normalized);
    if (normalized.interruption) {
      interruption = normalized.interruption;
      break;
    }
  }

  return {
    executed: true,
    blocked: false,
    plan,
    validation,
    completedTicks: tickResults.length,
    requestedTicks: plan.ticks,
    tickResults,
    interrupted: Boolean(interruption),
    interruption
  };
}

function buildSummarySentence(results, visibleTicks, actionLabel) {
  const requestedTicks = Number(results.requestedTicks || results.plan?.ticks || 0);
  const completedTicks = Number(results.completedTicks || visibleTicks.length || 0);
  const endLabel = visibleTicks.at(-1)?.dateLabel || "";
  const base = results.blocked
    ? "跳时未执行"
    : `跳时结算：${actionLabel}已推进${completedTicks}/${requestedTicks}旬`;
  const suffix = endLabel ? `，当前至${endLabel}` : "";
  if (results.interrupted && results.interruption?.reason) {
    return `${base}${suffix}；${results.interruption.reason}`;
  }
  return `${base}${suffix}。`;
}

function buildTimeSkipSummary(results = {}, aiRuntime = {}, options = {}) {
  const plan = results.plan || {};
  const actionLabel = cleanVisibleText(plan.actionLabel, "跳时", 48);
  const visibleTicks = Array.isArray(results.tickResults)
    ? results.tickResults.map((tick) => ({
      index: tick.index,
      actionLabel: cleanVisibleText(tick.actionLabel, actionLabel, 48),
      dateLabel: cleanVisibleText(tick.dateLabel, "", 80),
      cadence: tick.cadence || null,
      completedMonth: Boolean(tick.completedMonth),
      summary: cleanVisibleText(tick.worldTickSummary, "", 180),
      events: Array.isArray(tick.events)
        ? tick.events.map((event) => cleanVisibleText(event, "", 180)).filter(Boolean).slice(0, 2)
        : [],
      longTermSummary: cleanVisibleText(tick.longTermSummary, "", 180),
      officialCareerSummary: cleanVisibleText(tick.officialCareerSummary, "", 180),
      playerMonthlyBriefingGenerated: Boolean(tick.playerMonthlyBriefingGenerated),
      playerMonthlyBriefingSummary: cleanVisibleText(tick.playerMonthlyBriefingSummary, "", 180)
    }))
    : [];
  const interruption = normalizeInterruption(results.interruption);
  const route = options.route || null;

  const summary = buildSummarySentence({ ...results, interruption }, visibleTicks, actionLabel);
  return {
    schemaVersion: TIME_SKIP_SCHEMA_VERSION,
    executed: Boolean(results.executed && !results.blocked),
    blocked: Boolean(results.blocked),
    strategy: plan.strategy || TIME_SKIP_DEFAULT_STRATEGY,
    actionType: plan.actionType || "routine",
    actionLabel,
    requestedTicks: Number(results.requestedTicks || plan.ticks || 0),
    completedTicks: Number(results.completedTicks || visibleTicks.length || 0),
    interrupted: Boolean(interruption),
    interruption,
    summary: cleanVisibleText(summary, "跳时结算完成。", 220),
    nextTodo: interruption?.todo || (results.blocked
      ? cleanVisibleText(results.validation?.reasons?.[0], "请缩短跳时时长或处理当前场景后再试。", 160)
      : "可继续输入行动，服务器会按当前年月旬继续结算。"),
    ticks: visibleTicks,
    planner: {
      taskType: TIME_SKIP_PER_STEP_BUDGET.plannerTaskType,
      provider: cleanVisibleText(route?.provider || aiRuntime?.provider, "mock", 48),
      model: cleanVisibleText(route?.model || aiRuntime?.model, "", 80),
      maxOutputTokens: route?.maxOutputTokens || null,
      toolBudget: route?.toolBudget ?? 0
    }
  };
}

module.exports = {
  buildTimeSkipPlan,
  buildTimeSkipSummary,
  detectTimeSkipIntent,
  runTimeSkipTicks,
  validateTimeSkipPlan
};
