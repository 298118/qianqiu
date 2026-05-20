const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RAW_LEDGER_KEYS,
  defineAiConnectionTestResponse,
  defineExamQuestionResponse,
  defineGameStartResponse,
  defineGameStateResponse,
  defineGameTurnResponse,
  definePlayerStateResponse
} = require("../src/routes/routeResponses");

const sessionId = "00000000-0000-4000-8000-000000000087";

test("S87 route response helpers reject raw ledger keys in public worldState", () => {
  for (const key of RAW_LEDGER_KEYS) {
    assert.throws(
      () => defineGameTurnResponse({
        sessionId,
        worldState: {
          sessionId,
          [key]: {}
        }
      }),
      new RegExp(key)
    );
  }
});

test("S88.1 AI connection response helper rejects raw provider fields", () => {
  for (const key of ["rawProviderPayload", "rawPrompt", "requestBody", "baseURL", "statePatch", "worldState"]) {
    assert.throws(
      () => defineAiConnectionTestResponse({
        ok: false,
        provider: "mock",
        [key]: "forged"
      }),
      new RegExp(key)
    );
  }

  assert.throws(
    () => defineAiConnectionTestResponse({
      ok: false,
      provider: "mock",
      diagnostics: {
        rawProviderPayload: "forged"
      }
    }),
    /diagnostics\.rawProviderPayload/
  );
});

test("S87 route response helpers accept safe public envelopes", () => {
  assert.equal(defineGameStartResponse({
    sessionId,
    worldState: { sessionId },
    narrative: "开局。"
  }).sessionId, sessionId);

  assert.equal(defineGameStateResponse({
    sessionId,
    worldState: { sessionId }
  }).sessionId, sessionId);

  assert.equal(definePlayerStateResponse({
    schemaVersion: "s71.4-player-state.v1",
    source: "server_player_visible_state_projection",
    sessionId,
    storageSchemaVersion: null,
    revision: null,
    createdAt: null,
    updatedAt: null,
    metadata: null,
    worldState: { sessionId, player: {} },
    redaction: {
      playerVisibleOnly: true,
      rawStateIncluded: false,
      omittedSections: []
    }
  }).source, "server_player_visible_state_projection");

  assert.equal(defineExamQuestionResponse({
    sessionId,
    examId: "exam:child:s87",
    level: "child_exam",
    examName: "童试",
    examQuestion: "试题",
    worldState: { sessionId }
  }).examId, "exam:child:s87");
});
