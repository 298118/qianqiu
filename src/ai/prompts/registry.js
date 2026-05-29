// @ts-check

const {
  PROMPT_PACKS,
  buildPromptInstructions
} = require("../promptPacks");
const { SCHEMAS } = require("../schemas");
const { MODEL_TASK_TYPES } = require("../modelRoutePolicy");
const { assertPublicAiProviderEnvelope } = require("../providerSafety");
const {
  COMMON_PROMPT_FORBIDDEN_FIELDS,
  DRAFT_ONLY_FORBIDDEN_FIELDS
} = require("./fragments/forbiddenBoundaries");
const { topicDraftPromptRegistryEntry } = require("./packs/topicDraft");
const { worldTurnPromptRegistryEntry } = require("./packs/worldTurn");

const PROMPT_REGISTRY_SCHEMA_VERSION = "s92.6-prompt-registry.v1";

const REQUIRED_PROMPT_REGISTRY_FIELDS = Object.freeze([
  "packName",
  "legacyPackName",
  "promptId",
  "promptVersion",
  "sceneType",
  "actorTypes",
  "taskType",
  "schemaName",
  "fixtures",
  "supportsTools",
  "qualityRubrics",
  "forbiddenFields"
]);

const PROMPT_REGISTRY_ENTRIES = Object.freeze([
  worldTurnPromptRegistryEntry,
  topicDraftPromptRegistryEntry
]);

const PROMPT_REGISTRY_BY_PACK = new Map(
  PROMPT_REGISTRY_ENTRIES.map((entry) => [entry.packName, entry])
);

const SENSITIVE_FIXTURE_TEXT_PATTERNS = Object.freeze([
  /\b(?:sk|tp)-[A-Za-z0-9_-]{6,}\b/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/i,
  /providerPayload|rawProviderPayload|rawPrompt|fullPrompt|worldState|statePatch|hiddenNotes/i,
  /\bserver\.[A-Za-z0-9_.-]+/i,
  /rawSql|rawAudit|rawTable|world_state_json/i,
  /[A-Za-z]:[\\/][^\s"'<>]*/i,
  /(?:file:\/\/)?(?:\/Users|\/home|\/tmp|\/var|\/mnt|\/opt|\/workspace)\/[^\s"'<>]*/i,
  /data[\\/](?:sessions|audit)/i
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function compactText(value, fallback = "", maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim() || fallback;
  return text.slice(0, maxLength);
}

function collectStringValues(value, bucket = []) {
  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStringValues(entry, bucket);
    return bucket;
  }
  if (isPlainObject(value)) {
    for (const entry of Object.values(value)) collectStringValues(entry, bucket);
  }
  return bucket;
}

function collectMissingRequiredFields(entry) {
  return REQUIRED_PROMPT_REGISTRY_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(entry, field)) return true;
    if (entry[field] === undefined || entry[field] === null || entry[field] === "") return true;
    if (Array.isArray(entry[field]) && entry[field].length === 0) return true;
    return false;
  });
}

function findUnsafeFixtureText(fixture) {
  const texts = collectStringValues(fixture);
  return texts
    .flatMap((text) => SENSITIVE_FIXTURE_TEXT_PATTERNS
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.toString()))
    .filter((hit, index, hits) => hits.indexOf(hit) === index);
}

function validateFixture(fixture, entry) {
  const issues = [];
  if (!isPlainObject(fixture)) {
    return [`${entry.packName} fixture must be an object`];
  }
  for (const field of ["fixtureId", "kind", "summary", "tags", "checks"]) {
    if (!Object.prototype.hasOwnProperty.call(fixture, field)) {
      issues.push(`${entry.packName} fixture ${fixture.fixtureId || "(unknown)"} missing ${field}`);
    }
  }
  if (!Array.isArray(fixture.tags) || !fixture.tags.length) {
    issues.push(`${entry.packName} fixture ${fixture.fixtureId || "(unknown)"} needs non-empty tags`);
  }
  if (!Array.isArray(fixture.checks) || !fixture.checks.length) {
    issues.push(`${entry.packName} fixture ${fixture.fixtureId || "(unknown)"} needs non-empty checks`);
  }
  const unsafeHits = findUnsafeFixtureText(fixture);
  if (unsafeHits.length) {
    issues.push(`${entry.packName} fixture ${fixture.fixtureId || "(unknown)"} contains unsafe fixture text: ${unsafeHits.join(", ")}`);
  }
  return issues;
}

function validateRubrics(entry) {
  const issues = [];
  const rubrics = Array.isArray(entry.qualityRubrics) ? entry.qualityRubrics : [];
  const totalWeight = rubrics.reduce((sum, rubric) => sum + (Number(rubric.weight) || 0), 0);
  if (totalWeight !== 100) {
    issues.push(`${entry.packName} qualityRubrics weight must sum to 100, got ${totalWeight}`);
  }
  for (const rubric of rubrics) {
    if (!rubric.id || !rubric.description) {
      issues.push(`${entry.packName} quality rubric missing id or description`);
    }
  }
  return issues;
}

function validateForbiddenFields(entry) {
  const issues = [];
  const fields = Array.isArray(entry.forbiddenFields) ? entry.forbiddenFields : [];
  const required = entry.taskType === "topic_draft" || entry.sceneType === "topic_draft"
    ? DRAFT_ONLY_FORBIDDEN_FIELDS
    : COMMON_PROMPT_FORBIDDEN_FIELDS;
  const missing = required.filter((field) => !fields.includes(field));
  if (missing.length) {
    issues.push(`${entry.packName} forbiddenFields missing required boundaries: ${missing.join(", ")}`);
  }
  return issues;
}

function validatePromptRegistryEntry(entry) {
  const issues = [];
  if (!isPlainObject(entry)) return ["prompt registry entry must be an object"];

  const missing = collectMissingRequiredFields(entry);
  if (missing.length) issues.push(`${entry.packName || "(unknown)"} missing required fields: ${missing.join(", ")}`);

  const legacyPack = PROMPT_PACKS[entry.legacyPackName || entry.packName];
  if (!legacyPack) {
    issues.push(`${entry.packName} references unknown legacy prompt pack ${entry.legacyPackName || entry.packName}`);
  } else if (legacyPack.schemaName !== entry.schemaName) {
    issues.push(`${entry.packName} schemaName ${entry.schemaName} does not match legacy schemaName ${legacyPack.schemaName}`);
  }

  if (!String(entry.promptId || "").startsWith("qianqiu.")) {
    issues.push(`${entry.packName} promptId must start with qianqiu.`);
  }
  if (!SCHEMAS[entry.schemaName]) {
    issues.push(`${entry.packName} references unknown schemaName ${entry.schemaName}`);
  }
  if (!MODEL_TASK_TYPES.includes(entry.taskType)) {
    issues.push(`${entry.packName} references unknown taskType ${entry.taskType}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}\.s\d+\.\d+\.v\d+$/.test(String(entry.promptVersion || ""))) {
    issues.push(`${entry.packName} promptVersion must use YYYY-MM-DD.sXX.Y.vN`);
  }
  if (!Array.isArray(entry.actorTypes) || !entry.actorTypes.length) {
    issues.push(`${entry.packName} actorTypes must be a non-empty array`);
  }
  if (typeof entry.supportsTools !== "boolean") {
    issues.push(`${entry.packName} supportsTools must be boolean for v2 registry doctor`);
  }
  if (!Array.isArray(entry.forbiddenFields)) {
    issues.push(`${entry.packName} forbiddenFields must be an array`);
  } else {
    issues.push(...validateForbiddenFields(entry));
  }

  issues.push(...validateRubrics(entry));
  for (const fixture of Array.isArray(entry.fixtures) ? entry.fixtures : []) {
    issues.push(...validateFixture(fixture, entry));
  }

  return issues;
}

function listPromptRegistryEntries() {
  return PROMPT_REGISTRY_ENTRIES.map((entry) => ({ ...entry }));
}

function listPromptRegistryPackNames() {
  return [...PROMPT_REGISTRY_BY_PACK.keys()].sort();
}

function getPromptRegistryEntry(packName) {
  const entry = PROMPT_REGISTRY_BY_PACK.get(packName);
  if (!entry) {
    throw new Error(`Unknown prompt registry pack: ${packName}`);
  }
  return { ...entry };
}

function buildRegistryPromptInstructions(packName) {
  const entry = getPromptRegistryEntry(packName);
  return buildPromptInstructions(entry.legacyPackName || entry.packName);
}

function validatePromptRegistry() {
  const promptIds = new Map();
  const duplicateFailures = [];
  for (const entry of PROMPT_REGISTRY_ENTRIES) {
    if (!entry.promptId) continue;
    const existing = promptIds.get(entry.promptId);
    if (existing) {
      duplicateFailures.push({
        packName: entry.packName || "(unknown)",
        issue: `${entry.packName} promptId duplicates ${existing}: ${entry.promptId}`
      });
    }
    promptIds.set(entry.promptId, entry.packName);
  }

  const failures = PROMPT_REGISTRY_ENTRIES.flatMap((entry) =>
    validatePromptRegistryEntry(entry).map((issue) => ({
      packName: entry.packName || "(unknown)",
      issue
    }))
  ).concat(duplicateFailures);
  return {
    ok: failures.length === 0,
    schemaVersion: PROMPT_REGISTRY_SCHEMA_VERSION,
    registeredPackCount: PROMPT_REGISTRY_ENTRIES.length,
    failures
  };
}

function summarizePromptRegistry() {
  const summary = {
    ok: true,
    schemaVersion: PROMPT_REGISTRY_SCHEMA_VERSION,
    registeredPackCount: PROMPT_REGISTRY_ENTRIES.length,
    packs: PROMPT_REGISTRY_ENTRIES.map((entry) => ({
      packName: entry.packName,
      promptId: entry.promptId,
      promptVersion: entry.promptVersion,
      sceneType: entry.sceneType,
      taskType: entry.taskType,
      schemaName: entry.schemaName,
      actorTypeCount: entry.actorTypes.length,
      fixtureCount: entry.fixtures.length,
      qualityRubricCount: entry.qualityRubrics.length,
      forbiddenFieldCount: entry.forbiddenFields.length,
      supportsTools: entry.supportsTools
    }))
  };
  assertPublicAiProviderEnvelope(summary);
  return summary;
}

function buildPromptRegistryDoctorResult() {
  const validation = validatePromptRegistry();
  const summary = summarizePromptRegistry();
  return {
    ...summary,
    ok: validation.ok,
    failures: validation.failures.map((failure) => ({
      packName: compactText(failure.packName, "(unknown)", 96),
      issue: compactText(failure.issue, "prompt registry issue", 240)
    }))
  };
}

module.exports = {
  PROMPT_REGISTRY_ENTRIES,
  PROMPT_REGISTRY_SCHEMA_VERSION,
  REQUIRED_PROMPT_REGISTRY_FIELDS,
  SENSITIVE_FIXTURE_TEXT_PATTERNS,
  buildPromptRegistryDoctorResult,
  buildRegistryPromptInstructions,
  findUnsafeFixtureText,
  getPromptRegistryEntry,
  listPromptRegistryEntries,
  listPromptRegistryPackNames,
  summarizePromptRegistry,
  validatePromptRegistry,
  validatePromptRegistryEntry
};
