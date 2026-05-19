const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  DEVELOPER_DIAGNOSTICS_SOURCE,
  REDACTED_STATE_SOURCE,
  assertRedactedStateSafe,
  buildDeveloperDiagnostics,
  buildPlayerStateEnvelope,
  buildPlayerVisibleState,
  redactDiagnosticValue,
  redactPlayerRouteViews
} = require("../src/game/redactedState");
const { createSessionRecord } = require("../src/storage/sessionRecord");

function createPollutedWorldState() {
  const worldState = createInitialState({
    role: "official",
    playerName: "脱敏巡按"
  });
  Object.assign(worldState, {
    turnCount: 9,
    eventHistory: [
      "巡按奉命查核府县钱粮。",
      "SEALED_REDACTED_EVENT event_log ai_change_proposals sk-redacted-route-secret"
    ],
    hiddenNotes: "SEALED_TOP_LEVEL_HIDDEN",
    rawProviderPayload: "provider prompt world_state_json"
  });
  worldState.player.officeTitle = "巡按御史";
  worldState.player.portraitRef = "portrait-s76-10-player-scholar-f01-v1";
  worldState.player.hiddenIntent = "SEALED_PLAYER_INTENT";
  worldState.player.examHistory.push({
    level: "provincial",
    title: "乡试中式",
    hiddenNotes: "SEALED_EXAM_HISTORY",
    publicSummary: "乡试名列前茅。"
  });
  worldState.characters.push({
    id: "hidden-character",
    name: "SEALED_CHARACTER",
    hiddenIntent: "SEALED_CHARACTER_INTENT"
  });
  worldState.relationshipLedger.privateNotes = ["SEALED_RELATIONSHIP_NOTE"];
  worldState.actorMemoryLedger = {
    actors: {
      npc: {
        hiddenNotes: "SEALED_MEMORY_NOTE"
      }
    }
  };
  worldState.sessionSummary = {
    privateSummary: "SEALED_SESSION_SUMMARY"
  };
  return worldState;
}

test("S71.4 buildPlayerVisibleState keeps only allowlisted player-visible fields", () => {
  const worldState = createPollutedWorldState();
  const state = buildPlayerVisibleState(worldState);
  const serialized = JSON.stringify(state);

  assert.equal(state.sessionId, worldState.sessionId);
  assert.equal(state.player.name, "脱敏巡按");
  assert.equal(state.player.officeTitle, "巡按御史");
  assert.equal(state.player.portraitRef, "portrait-s76-10-player-scholar-f01-v1");
  assert.equal(state.characters, undefined);
  assert.equal(state.relationshipLedger, undefined);
  assert.equal(state.actorMemoryLedger, undefined);
  assert.equal(state.sessionSummary, undefined);
  assert.equal(state.hiddenNotes, undefined);
  assert.doesNotMatch(serialized, /SEALED_|event_log|ai_change_proposals|world_state_json|sk-redacted-route-secret|hiddenIntent|rawProviderPayload/);
});

test("S76.10 buildPlayerVisibleState applies portraitRef-specific redaction", () => {
  const worldState = createInitialState({ playerName: "立绘脱敏", role: "scholar" });
  worldState.player.portraitRef = "portrait-s73-10-player-capital-official-f01-v1";
  assert.equal(buildPlayerVisibleState(worldState).player.portraitRef, "portrait-s73-10-player-capital-official-f01-v1");

  worldState.player.portraitRef = "portrait-http-v1";
  const state = buildPlayerVisibleState(worldState);
  const envelope = buildPlayerStateEnvelope(worldState);
  assert.equal(state.player.portraitRef, null);
  assert.equal(envelope.worldState.player.portraitRef, null);
  assert.doesNotMatch(JSON.stringify(envelope), /portrait-http-v1|http\[redacted-path\]/);
});

test("S71.4 buildPlayerStateEnvelope returns safe metadata and redaction boundary", () => {
  const worldState = createPollutedWorldState();
  const record = createSessionRecord(worldState, {
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    revision: 3
  });
  const envelope = buildPlayerStateEnvelope(record);
  const serialized = JSON.stringify(envelope);

  assert.equal(envelope.source, REDACTED_STATE_SOURCE);
  assert.equal(envelope.sessionId, worldState.sessionId);
  assert.equal(envelope.revision, 3);
  assert.equal(envelope.metadata.playerName, "脱敏巡按");
  assert.equal(envelope.worldState.player.officeTitle, "巡按御史");
  assert.equal(envelope.redaction.playerVisibleOnly, true);
  assert.equal(envelope.redaction.rawStateIncluded, false);
  assertRedactedStateSafe(envelope);
  assert.doesNotMatch(serialized, /SEALED_|event_log|ai_change_proposals|world_state_json|prompt_retrieval_index|safe_search_index|sk-redacted-route-secret/);
});

test("S71.4 developer diagnostics expose statistics without raw hidden material", () => {
  const worldState = createPollutedWorldState();
  const record = createSessionRecord(worldState, {
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    revision: 5
  });
  const diagnostics = buildDeveloperDiagnostics(record, {
    storageAdapter: {
      name: "sqlite",
      searchSafeSearchIndex() {},
      listAuditEvents() {},
      listAiProposals() {}
    }
  });
  const serialized = JSON.stringify(diagnostics);

  assert.equal(diagnostics.source, DEVELOPER_DIAGNOSTICS_SOURCE);
  assert.equal(diagnostics.storage.adapter, "sqlite");
  assert.equal(diagnostics.storage.features.safeSearch, true);
  assert.equal(diagnostics.storage.features.auditRead, true);
  assert.equal(diagnostics.counts.eventHistory, 2);
  assert.equal(diagnostics.safety.stateSnapshotIncluded, false);
  assert.equal(diagnostics.safety.auditRowsIncluded, false);
  assert.ok(diagnostics.resolverInputSummary);
  assert.equal(diagnostics.ai.controlAudit.schemaVersion, "s71.11-ai-control-audit.v1");
  assert.equal(diagnostics.ai.controlAudit.safety.promptTextIncluded, false);
  assert.equal(diagnostics.ai.controlAudit.safety.databaseRowsIncluded, false);
  assert.doesNotMatch(serialized, /SEALED_|event_log|ai_change_proposals|world_state_json|prompt_retrieval_index|safe_search_index|rawProviderPayload|sk-redacted-route-secret/);
});

test("S71.4 redactDiagnosticValue strips unsafe keys and values recursively", () => {
  const redacted = redactDiagnosticValue({
    ok: true,
    nested: {
      hiddenNotes: "SEALED_DIRECT_NOTE",
      visible: "地方诊断摘要",
      path: "/mnt/e/LSMNQ/data/sessions/secret.json",
      key: "sk-redacted-route-secret"
    }
  });
  const serialized = JSON.stringify(redacted);

  assert.equal(redacted.ok, true);
  assert.equal(redacted.nested.visible, "地方诊断摘要");
  assert.equal(redacted.nested.hiddenNotes, undefined);
  assert.equal(redacted.nested.path, undefined);
  assert.equal(redacted.nested.key, undefined);
  assert.doesNotMatch(serialized, /SEALED_DIRECT_NOTE|\/mnt\/e\/LSMNQ|sk-redacted-route-secret/);
});

test("S71.4 redactPlayerRouteViews cleans legacy route view canaries while keeping safe AI labels", () => {
  const clean = redactPlayerRouteViews({
    aiSettingsView: {
      providerOptions: [
        {
          provider: "mock",
          requiresKey: false
        }
      ],
      taskRoutes: [
        {
          taskType: "narrator",
          provider: "mock",
          model: "mock",
          maxOutputTokens: 1800
        }
      ]
    },
    relationshipView: {
      contacts: [
        {
          id: "hidden-character",
          name: "SEALED_CHARACTER",
          hiddenIntent: "SEALED_CHARACTER_INTENT"
        },
        {
          id: "visible-character",
          name: "顾文衡"
        }
      ]
    }
  });
  const serialized = JSON.stringify(clean);

  assert.equal(clean.aiSettingsView.taskRoutes[0].provider, "mock");
  assert.equal(clean.aiSettingsView.taskRoutes[0].maxOutputTokens, 1800);
  assert.equal(clean.aiSettingsView.providerOptions[0].requiresKey, false);
  assert.deepEqual(clean.relationshipView.contacts, [
    {
      id: "visible-character",
      name: "顾文衡"
    }
  ]);
  assert.doesNotMatch(serialized, /SEALED_|hiddenIntent|rawProvider|prompt_retrieval_index/);
});
