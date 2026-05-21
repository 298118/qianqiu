// @ts-check

const {
  sanitizeExamPreparationCalendarForView,
  sanitizeEntryPreparationForView
} = require("./examTravel");
const { sanitizeExamAftermathView } = require("./examAftermath");
const { buildExamProcedureView } = require("./examProcedure");
const { sanitizeExamSceneTimeForView } = require("./examSceneTime");

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
  "providerResponse",
  "provider_response",
  "providerRequest",
  "provider_request",
  "providerRaw",
  "provider_raw",
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

function sanitizeExamProcedureSnapshot(procedure = null, activeExam = {}) {
  if (!isPlainObject(procedure)) return procedure;
  return buildExamProcedureView({
    activeExam: {
      ...activeExam,
      procedure
    }
  }, { procedure });
}

function sanitizeExamPreparationSnapshots(clientState) {
  if (clientState.examCalendar) {
    clientState.examCalendar = sanitizeExamPreparationCalendarForView(clientState.examCalendar);
  }
  if (isPlainObject(clientState.activeExam)) {
    if (clientState.activeExam.entryPreparation) {
      clientState.activeExam.entryPreparation = sanitizeEntryPreparationForView(clientState.activeExam.entryPreparation);
    }
    if (clientState.activeExam.examCalendar) {
      clientState.activeExam.examCalendar = sanitizeExamPreparationCalendarForView(clientState.activeExam.examCalendar);
    }
    if (clientState.activeExam.sceneTime) {
      clientState.activeExam.sceneTime = sanitizeExamSceneTimeForView(clientState.activeExam.sceneTime);
    }
    if (clientState.activeExam.procedure) {
      clientState.activeExam.procedure = sanitizeExamProcedureSnapshot(
        clientState.activeExam.procedure,
        clientState.activeExam
      );
    }
    if (clientState.activeExam.examProcedureView) {
      clientState.activeExam.examProcedureView = sanitizeExamProcedureSnapshot(
        clientState.activeExam.examProcedureView,
        clientState.activeExam
      );
    }
  }
  if (isPlainObject(clientState.player) && Array.isArray(clientState.player.examHistory)) {
    clientState.player.examHistory = clientState.player.examHistory.map((entry) => {
      if (!isPlainObject(entry)) return entry;
      const output = { ...entry };
      if (entry.entryPreparation) {
        output.entryPreparation = sanitizeEntryPreparationForView(entry.entryPreparation);
      }
      if (entry.examCalendar) {
        output.examCalendar = sanitizeExamPreparationCalendarForView(entry.examCalendar);
      }
      if (entry.examAftermath) {
        output.examAftermath = sanitizeExamAftermathView(entry.examAftermath);
      }
      if (entry.sceneTime) {
        output.sceneTime = sanitizeExamSceneTimeForView(entry.sceneTime);
      }
      if (entry.examStartedAt) {
        output.examStartedAt = sanitizeExamSceneTimeForView({ startedAt: entry.examStartedAt }).startedAt;
      }
      if (entry.examSubmittedAt) {
        output.examSubmittedAt = sanitizeExamSceneTimeForView({ updatedAt: entry.examSubmittedAt }).updatedAt;
      }
      if (entry.examProcedure) {
        output.examProcedure = sanitizeExamProcedureSnapshot(entry.examProcedure, {
          level: entry.level,
          examName: entry.examName,
          sceneTime: entry.sceneTime
        });
      }
      return output;
    });
  }
}

function buildClientWorldState(worldState = {}) {
  const clientState = stripInternalClientWorldStateFields(cloneJson(worldState)) || {};
  sanitizeExamPreparationSnapshots(clientState);
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
  delete clientState.officialCourtConsequences;
  delete clientState.officialCourtResponses;
  return clientState;
}

module.exports = {
  buildClientWorldState,
  isForbiddenClientWorldStateKey
};
