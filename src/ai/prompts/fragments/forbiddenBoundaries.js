// @ts-check

const COMMON_PROMPT_FORBIDDEN_FIELDS = Object.freeze([
  "rawPrompt",
  "fullPrompt",
  "providerPayload",
  "rawProviderPayload",
  "headers",
  "apiKey",
  "key",
  "token",
  "baseURL",
  "baseUrl",
  "localPath",
  "hiddenNotes",
  "hiddenIntent",
  "rawAudit",
  "rawSql",
  "rawTable",
  "worldState",
  "world_state_json",
  "server.*"
]);

const DRAFT_ONLY_FORBIDDEN_FIELDS = Object.freeze([
  ...COMMON_PROMPT_FORBIDDEN_FIELDS,
  "statePatch",
  "examTrigger",
  "relationshipChanges",
  "memoryProposals",
  "request_adjudication"
]);

module.exports = {
  COMMON_PROMPT_FORBIDDEN_FIELDS,
  DRAFT_ONLY_FORBIDDEN_FIELDS
};
