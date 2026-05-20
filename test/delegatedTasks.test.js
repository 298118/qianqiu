const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { ensureNpcRoster } = require("../src/game/npcRoster");
const {
  buildDelegatedTaskLedgerView,
  createLandSurveyDelegatedTask,
  updateDelegatedTaskStatus,
  validateDelegatedTaskRequest
} = require("../src/game/delegatedTasks");

function assertTaskViewSafe(view) {
  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /hiddenDossier|trueAssets|secretRelationships|serverPlan|aiNarrativeProposal|隐田|赌债|姻亲|raw provider|statePatch|worldState/);
}

test("S81.3 land survey delegation validates magistrate authority, assignee, and resource budget", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  ensureNpcRoster(worldState);

  const valid = validateDelegatedTaskRequest(worldState, {
    taskType: "land_survey",
    authoritySource: "yamen_authority",
    assigneeActorId: "npc:magistrate:registrar-lu",
    budget: 18
  });
  assert.equal(valid.ok, true);

  const wrongRole = createInitialState({ role: "scholar" });
  ensureNpcRoster(wrongRole);
  const invalid = validateDelegatedTaskRequest(wrongRole, {
    taskType: "land_survey",
    authoritySource: "yamen_authority",
    assigneeActorId: "npc:scholar:mentor-gu",
    budget: 18
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("authority_role_mismatch"));
  assert.ok(invalid.errors.includes("assignee_lacks_land_survey_role"));

  const poorBudget = validateDelegatedTaskRequest(worldState, {
    taskType: "land_survey",
    authoritySource: "yamen_authority",
    assigneeActorId: "npc:magistrate:registrar-lu",
    budget: 2
  });
  assert.equal(poorBudget.ok, false);
  assert.ok(poorBudget.errors.includes("budget_too_low"));

  const overBudgetState = createInitialState({ role: "magistrate" });
  overBudgetState.player.localTreasury = 20;
  ensureNpcRoster(overBudgetState);
  const overBudget = validateDelegatedTaskRequest(overBudgetState, {
    taskType: "land_survey",
    authoritySource: "yamen_authority",
    assigneeActorId: "npc:magistrate:registrar-lu",
    budget: 21
  });
  assert.equal(overBudget.ok, false);
  assert.ok(overBudget.errors.includes("budget_exceeds_local_treasury"));

  const genericOverBudget = validateDelegatedTaskRequest(overBudgetState, {
    taskType: "purchase",
    authoritySource: "personal_request",
    assigneeActorId: "npc:magistrate:registrar-lu",
    budget: 21
  });
  assert.equal(genericOverBudget.ok, false);
  assert.ok(genericOverBudget.errors.includes("budget_exceeds_local_treasury"));
});

test("S81.3 magistrate land survey sample creates an active ledger task", () => {
  const worldState = createInitialState({ role: "magistrate", playerName: "清丈知县" });
  worldState.year = 1644;
  worldState.month = 2;
  worldState.tenDayPeriod = 3;
  ensureNpcRoster(worldState);

  const result = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:registrar-lu",
    targetRef: "geo:county:qinghe:east-village",
    commandText: "丈量东乡田亩，核对鱼鳞册与实耕。",
    budget: 24
  });

  assert.equal(result.ok, true);
  assert.equal(result.task.taskType, "land_survey");
  assert.equal(result.task.authoritySource, "yamen_authority");
  assert.equal(result.task.status, "active");
  assert.equal(result.task.dueTime.month, 3);
  assert.equal(result.task.dueTime.tenDayPeriod, 3);
  assert.equal(worldState.delegatedTaskLedger.tasks.length, 1);
  assert.equal(result.delegatedTaskView.items[0].assignee.displayName, "陆知事");
  assertTaskViewSafe(result.delegatedTaskView);
});

test("S81.3 delegated task status view exposes safe completion report only", () => {
  const worldState = createInitialState({ role: "magistrate" });
  ensureNpcRoster(worldState);
  const created = createLandSurveyDelegatedTask(worldState, {
    assigneeActorId: "npc:magistrate:bailiff-zhou",
    targetRef: "geo:county:qinghe:north-village",
    commandText: "随同丈量北乡田亩。",
    budget: 16
  });
  assert.equal(created.ok, true);

  updateDelegatedTaskStatus(worldState, created.task.taskId, "completed", {
    result: {
      summary: "北乡田亩初清，发现数处册实不符，可请书吏复核。",
      outcome: "completed",
      followUpActionRefs: ["followup:review-land-register"]
    },
    aiNarrativeProposal: "raw provider proposal should not appear",
    auditRefs: ["audit:delegated-task:land-survey:1"]
  });

  const view = buildDelegatedTaskLedgerView(worldState, { status: "completed" });
  assert.equal(view.totalItems, 1);
  assert.equal(view.items[0].status, "completed");
  assert.equal(view.items[0].result.outcome, "completed");
  assert.equal(view.items[0].safeguards.serverOwnsResolution, true);
  assertTaskViewSafe(view);
});
