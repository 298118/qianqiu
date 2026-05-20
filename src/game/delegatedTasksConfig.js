const DELEGATED_TASK_SCHEMA_VERSION = "s81.3-delegated-tasks.v1";

const DELEGATED_TASK_TYPES = Object.freeze([
  "land_survey",
  "audit_accounts",
  "patrol_arrest",
  "lecture",
  "purchase",
  "scout",
  "dispatch_message",
  "recruit",
  "collect_grain"
]);

const DELEGATED_TASK_STATUSES = Object.freeze([
  "draft",
  "pending_validation",
  "active",
  "blocked",
  "overdue",
  "completed",
  "failed",
  "cancelled"
]);

const DELEGATED_TASK_AUTHORITY_SOURCES = Object.freeze([
  "personal_request",
  "academy_seniority",
  "yamen_authority",
  "office_authority",
  "military_command",
  "imperial_decree"
]);

const LAND_SURVEY_TASK_TEMPLATE = Object.freeze({
  taskType: "land_survey",
  title: "丈量田亩",
  authoritySource: "yamen_authority",
  requiredRoleTags: Object.freeze(["registrar", "bailiff", "field_agent", "county_deputy"]),
  requiredInteractions: Object.freeze(["delegate"]),
  requiredItems: Object.freeze(["item:yamen:land-register", "item:yamen:measuring-rope"]),
  budgetAccountRefs: Object.freeze(["resource:yamen:clerical-expenses"]),
  minBudget: 12,
  cadence: "next_month",
  dueAfterTenDayPeriods: 3,
  riskFactors: Object.freeze(["士绅阻力", "册实不符", "差役索费", "民怨上升"]),
  successFactors: Object.freeze(["执行人熟悉版籍", "官署经费足额", "知县权威", "乡约配合"]),
  serverPlan: Object.freeze({
    queue: "monthly_resolution",
    resolver: "server.delegatedTask.landSurvey",
    adjudication: "server_owned",
    aiTaskTypes: Object.freeze(["delegated_task_planner", "delegated_task_reporter"])
  })
});

module.exports = {
  DELEGATED_TASK_AUTHORITY_SOURCES,
  DELEGATED_TASK_SCHEMA_VERSION,
  DELEGATED_TASK_STATUSES,
  DELEGATED_TASK_TYPES,
  LAND_SURVEY_TASK_TEMPLATE
};
