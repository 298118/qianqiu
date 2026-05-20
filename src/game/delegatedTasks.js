const {
  DELEGATED_TASK_AUTHORITY_SOURCES,
  DELEGATED_TASK_SCHEMA_VERSION,
  DELEGATED_TASK_STATUSES,
  DELEGATED_TASK_TYPES,
  LAND_SURVEY_TASK_TEMPLATE
} = require("./delegatedTasksConfig");
const { ensureNpcRoster, getNpcForServer } = require("./npcRoster");

const UNSAFE_TASK_TEXT_PATTERN =
  /(hiddenNotes|hiddenIntent|hiddenDossier|raw[_ -]?(?:provider|audit|table|ledger|prompt)|\b(?:provider|prompt|proposal)\b|retrievalContext|statePatch|worldState|prompt_retrieval_index|event_archive_index|world_sessions|api[_ -]?key|OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|data[\\/](?:sessions|audit)|ai_change_proposals|event_log|sqlite|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/][^\s"'<>]+|(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt)\/[^\s"'<>]+)/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || UNSAFE_TASK_TEXT_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 120);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function uniqueCleanList(values, limit = 12, maxLength = 96) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, "", maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function countNonEmptyTexts(values = []) {
  return (Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()).length;
}

function sanitizeDelegatedTaskPlan(plan = {}) {
  const taskType = cleanText(plan.taskType, "generic", 48);
  const planSummary = cleanText(plan.planSummary, "", 260);
  const riskTags = uniqueCleanList(plan.riskTags, 6, 32);
  const successFactors = uniqueCleanList(plan.successFactors, 6, 48);
  const errors = [];

  if (!planSummary) errors.push("unsafe_or_empty_delegated_task_plan");
  if (countNonEmptyTexts(plan.riskTags) > riskTags.length) errors.push("unsafe_delegated_task_risk_tags");
  if (countNonEmptyTexts(plan.successFactors) > successFactors.length) errors.push("unsafe_delegated_task_success_factors");

  return {
    ok: errors.length === 0,
    errors,
    taskType,
    planSummary,
    riskTags,
    successFactors,
    suggestedDueTurns: clampNumber(plan.suggestedDueTurns, 1, 12, 3)
  };
}

function currentDate(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function addTenDayPeriods(date, periods) {
  let year = date.year;
  let month = date.month;
  let tenDayPeriod = date.tenDayPeriod + clampNumber(periods, 0, 36, 0);
  while (tenDayPeriod > 3) {
    tenDayPeriod -= 3;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return {
    year,
    month,
    tenDayPeriod,
    turn: date.turn + clampNumber(periods, 0, 36, 0)
  };
}

function normalizeTaskType(value) {
  const taskType = cleanText(value, "", 48);
  return DELEGATED_TASK_TYPES.includes(taskType) ? taskType : "";
}

function normalizeAuthoritySource(value) {
  const authoritySource = cleanText(value, "", 64);
  return DELEGATED_TASK_AUTHORITY_SOURCES.includes(authoritySource) ? authoritySource : "";
}

function normalizeStatus(value, fallback = "active") {
  const status = cleanText(value, fallback, 40);
  return DELEGATED_TASK_STATUSES.includes(status) ? status : fallback;
}

function createInitialDelegatedTaskLedger(worldState = {}) {
  return {
    schemaVersion: DELEGATED_TASK_SCHEMA_VERSION,
    ownerActorId: cleanId(worldState.player?.id || "player", "player"),
    nextTaskNumber: 1,
    tasks: []
  };
}

function ensureDelegatedTaskLedger(worldState = {}) {
  if (!isPlainObject(worldState.delegatedTaskLedger) || worldState.delegatedTaskLedger.schemaVersion !== DELEGATED_TASK_SCHEMA_VERSION) {
    worldState.delegatedTaskLedger = createInitialDelegatedTaskLedger(worldState);
  }
  return worldState.delegatedTaskLedger;
}

function hasAny(values = [], required = []) {
  const valueSet = new Set(values);
  return required.some((value) => valueSet.has(value));
}

function validateDelegatedTaskRequest(worldState = {}, request = {}, options = {}) {
  const errors = [];
  const taskType = normalizeTaskType(request.taskType || options.template?.taskType);
  const authoritySource = normalizeAuthoritySource(request.authoritySource || options.template?.authoritySource);
  const assigneeActorId = cleanId(request.assigneeActorId, "");
  const issuerActorId = cleanId(request.issuerActorId || worldState.player?.id || "player", "player");
  const npc = getNpcForServer(worldState, assigneeActorId, options);
  const template = options.template || (taskType === LAND_SURVEY_TASK_TEMPLATE.taskType ? LAND_SURVEY_TASK_TEMPLATE : null);
  const budget = clampNumber(request.budget, 0, 100000, 0);
  const availableLocalTreasury = clampNumber(worldState.player?.localTreasury, 0, 100000, 0);

  if (!taskType) errors.push("task_type_invalid");
  if (!authoritySource) errors.push("authority_source_invalid");
  if (!assigneeActorId || !npc) errors.push("assignee_not_found");
  if (issuerActorId !== cleanId(worldState.player?.id || "player", "player")) errors.push("issuer_not_player");
  if (budget > availableLocalTreasury) errors.push("budget_exceeds_local_treasury");

  if (taskType === "land_survey") {
    if (worldState.player?.role !== "magistrate") errors.push("authority_role_mismatch");
    if (authoritySource !== "yamen_authority") errors.push("authority_source_mismatch");
    if (npc && !hasAny(npc.roleTags, LAND_SURVEY_TASK_TEMPLATE.requiredRoleTags)) errors.push("assignee_lacks_land_survey_role");
    if (npc && !hasAny(npc.availableInteractions, LAND_SURVEY_TASK_TEMPLATE.requiredInteractions)) errors.push("assignee_cannot_be_delegated");
    if (budget < LAND_SURVEY_TASK_TEMPLATE.minBudget) errors.push("budget_too_low");
    if (availableLocalTreasury < LAND_SURVEY_TASK_TEMPLATE.minBudget) errors.push("local_treasury_insufficient");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      taskType,
      authoritySource,
      assigneeActorId,
      issuerActorId,
      budget,
      title: cleanText(request.title || template?.title, "委派任务", 80),
      commandText: cleanText(request.commandText, "", 220),
      targetRef: cleanId(request.targetRef, ""),
      cadence: cleanText(request.cadence || template?.cadence, "next_month", 40),
      template
    }
  };
}

function createDelegatedTask(worldState = {}, request = {}, options = {}) {
  ensureNpcRoster(worldState, options);
  const ledger = ensureDelegatedTaskLedger(worldState);
  const validation = validateDelegatedTaskRequest(worldState, request, options);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      task: null,
      delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
    };
  }

  const normalized = validation.normalized;
  const template = normalized.template || {};
  const taskNumber = clampNumber(ledger.nextTaskNumber, 1, Number.MAX_SAFE_INTEGER, 1);
  const startTime = currentDate(worldState);
  const dueTime = addTenDayPeriods(startTime, template.dueAfterTenDayPeriods || 3);
  const task = {
    taskId: `delegated-task:${taskNumber}`,
    issuerActorId: normalized.issuerActorId,
    assigneeActorId: normalized.assigneeActorId,
    authoritySource: normalized.authoritySource,
    taskType: normalized.taskType,
    title: normalized.title,
    commandText: normalized.commandText,
    targetRef: normalized.targetRef,
    startTime,
    dueTime,
    cadence: normalized.cadence,
    status: "active",
    requiredItems: uniqueCleanList(request.requiredItems || template.requiredItems, 8, 96),
    budgetAccountRefs: uniqueCleanList(request.budgetAccountRefs || template.budgetAccountRefs, 8, 96),
    budget: normalized.budget,
    riskFactors: uniqueCleanList(request.riskFactors || template.riskFactors, 8, 80),
    successFactors: uniqueCleanList(request.successFactors || template.successFactors, 8, 80),
    serverPlan: {
      queue: cleanText(template.serverPlan?.queue, "monthly_resolution", 60),
      resolver: cleanText(template.serverPlan?.resolver, "server.delegatedTask.generic", 80),
      adjudication: "server_owned",
      aiTaskTypes: uniqueCleanList(template.serverPlan?.aiTaskTypes, 4, 60)
    },
    aiNarrativeProposal: null,
    result: null,
    auditRefs: []
  };
  ledger.tasks.push(task);
  ledger.nextTaskNumber = taskNumber + 1;
  return {
    ok: true,
    errors: [],
    task,
    delegatedTaskView: buildDelegatedTaskLedgerView(worldState)
  };
}

function createLandSurveyDelegatedTask(worldState = {}, request = {}, options = {}) {
  return createDelegatedTask(worldState, {
    ...request,
    taskType: "land_survey",
    authoritySource: request.authoritySource || LAND_SURVEY_TASK_TEMPLATE.authoritySource,
    title: request.title || LAND_SURVEY_TASK_TEMPLATE.title
  }, {
    ...options,
    template: LAND_SURVEY_TASK_TEMPLATE
  });
}

function updateDelegatedTaskStatus(worldState = {}, taskId, status, patch = {}) {
  const ledger = ensureDelegatedTaskLedger(worldState);
  const id = cleanId(taskId, "");
  const task = ledger.tasks.find((row) => row.taskId === id);
  if (!task) return null;
  task.status = normalizeStatus(status, task.status);
  if (patch.result !== undefined && isPlainObject(patch.result)) {
    task.result = {
      summary: cleanText(patch.result.summary, "", 180),
      outcome: cleanText(patch.result.outcome, task.status, 40),
      followUpActionRefs: uniqueCleanList(patch.result.followUpActionRefs, 6, 96)
    };
  }
  if (patch.aiNarrativeProposal !== undefined) {
    task.aiNarrativeProposal = cleanText(patch.aiNarrativeProposal, "", 240) || null;
  }
  task.auditRefs = uniqueCleanList([...(task.auditRefs || []), ...(patch.auditRefs || [])], 12, 96);
  return task;
}

function toTaskView(task = {}, worldState = {}) {
  const assignee = getNpcForServer(worldState, task.assigneeActorId);
  return {
    taskId: task.taskId,
    taskType: task.taskType,
    title: task.title,
    status: normalizeStatus(task.status),
    issuerActorId: task.issuerActorId,
    assignee: assignee
      ? {
        npcId: assignee.npcId,
        displayName: assignee.displayName,
        title: assignee.publicProfile.title,
        portraitRef: assignee.portraitRef
      }
      : { npcId: task.assigneeActorId, displayName: "未知执行人", title: "", portraitRef: "" },
    authoritySource: task.authoritySource,
    startTime: task.startTime,
    dueTime: task.dueTime,
    cadence: task.cadence,
    requiredItems: task.requiredItems || [],
    budgetAccountRefs: task.budgetAccountRefs || [],
    budget: clampNumber(task.budget, 0, 100000, 0),
    riskFactors: task.riskFactors || [],
    successFactors: task.successFactors || [],
    result: task.result
      ? {
        summary: cleanText(task.result.summary, "", 180),
        outcome: cleanText(task.result.outcome, task.status, 40),
        followUpActionRefs: uniqueCleanList(task.result.followUpActionRefs, 6, 96)
      }
      : null,
    auditRefs: uniqueCleanList(task.auditRefs, 8, 96),
    safeguards: {
      serverOwnsResolution: true,
      privateNpcProfileRedacted: true,
      internalPlanRedacted: true,
      rawAiDraftRedacted: true
    }
  };
}

function buildDelegatedTaskLedgerView(worldState = {}, options = {}) {
  const ledger = ensureDelegatedTaskLedger(worldState);
  const status = cleanText(options.status, "", 40);
  const filtered = ledger.tasks.filter((task) => !status || task.status === status);
  return {
    schemaVersion: DELEGATED_TASK_SCHEMA_VERSION,
    ownerActorId: ledger.ownerActorId,
    totalItems: filtered.length,
    items: filtered.map((task) => toTaskView(task, worldState)),
    allowedTaskTypes: DELEGATED_TASK_TYPES,
    allowedStatuses: DELEGATED_TASK_STATUSES,
    safeguards: {
      browserCannotResolveTasks: true,
      serverOwnsAuthorityAndResources: true,
      privateNpcProfileRedacted: true
    }
  };
}

module.exports = {
  buildDelegatedTaskLedgerView,
  createDelegatedTask,
  createInitialDelegatedTaskLedger,
  createLandSurveyDelegatedTask,
  ensureDelegatedTaskLedger,
  sanitizeDelegatedTaskPlan,
  updateDelegatedTaskStatus,
  validateDelegatedTaskRequest
};
