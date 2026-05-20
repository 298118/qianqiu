// @ts-check

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

const FORBIDDEN_CLIENT_WORLD_STATE_KEYS = Object.freeze([
  "hidden",
  "hiddenNotes",
  "hidden_notes",
  "hiddenIntent",
  "hidden_intent",
  "sealedMapping",
  "sealed_mapping",
  "privateNotes",
  "private_notes",
  "raw",
  "rawAudit",
  "raw_audit",
  "rawLedger",
  "raw_ledger",
  "rawProvider",
  "raw_provider",
  "rawProviderPayload",
  "raw_provider_payload",
  "rawPrompt",
  "raw_prompt",
  "rawSql",
  "raw_sql",
  "rawTable",
  "raw_table",
  "rawRow",
  "raw_row",
  "providerPayload",
  "provider_payload",
  "providerProposal",
  "provider_proposal",
  "prompt",
  "promptText",
  "prompt_text",
  "instructions",
  "requestBody",
  "request_body",
  "responseBody",
  "response_body",
  "baseURL",
  "baseUrl",
  "apiKey",
  "api_key",
  "secret",
  "token",
  "password",
  "credential",
  "statePatch",
  "state_patch",
  "worldState",
  "world_state"
]);

const FORBIDDEN_CLIENT_WORLD_STATE_KEY_SET = new Set(
  FORBIDDEN_CLIENT_WORLD_STATE_KEYS.map((key) => key.toLowerCase())
);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isForbiddenClientWorldStateKey(key) {
  return FORBIDDEN_CLIENT_WORLD_STATE_KEY_SET.has(String(key || "").toLowerCase());
}

function stripInternalClientWorldStateFields(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripInternalClientWorldStateFields(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return value;

  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isForbiddenClientWorldStateKey(key)) continue;
    const cleaned = stripInternalClientWorldStateFields(entry);
    if (cleaned === undefined) continue;
    output[key] = cleaned;
  }
  return output;
}

function buildClientWorldState(worldState = {}) {
  const clientState = stripInternalClientWorldStateFields(cloneJson(worldState)) || {};
  delete clientState.actorMemoryLedger;
  delete clientState.sessionSummary;
  delete clientState.assetLedger;
  delete clientState.resourceLedger;
  delete clientState.inventoryLedger;
  delete clientState.npcRoster;
  delete clientState.delegatedTaskLedger;
  delete clientState.npcInteractionLedger;
  delete clientState.tradeLedger;
  delete clientState.openingBackgroundClaims;
  delete clientState.marketPriceLedger;
  delete clientState.npcEconomyLedger;
  delete clientState.npcActiveRequestLedger;
  return clientState;
}

module.exports = {
  buildClientWorldState,
  isForbiddenClientWorldStateKey
};
