const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const { runGameToolLoop } = require("../src/ai/tools/gameToolLoop");
const {
  parseProjectedToolContent,
  projectToolResultForModel
} = require("../src/ai/tools/toolResultProjector");

function scholarContext() {
  const worldState = createInitialState({ role: "scholar", playerName: "守界士子" });
  return {
    worldState,
    actorProfile: buildPlayerAiActorProfile(worldState),
    toolRegistry: createGameAiToolRegistry([createVisibleContextReadToolDefinition()]),
    toolAuditRecords: []
  };
}

function assertNoSensitiveText(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "server.",
    "server.*",
    "rawSql",
    "worldState",
    "statePatch",
    "hiddenNotes",
    "hiddenIntent",
    "apiKey",
    "localPath",
    "providerPayload",
    "rawProviderPayload",
    "rawPrompt",
    "fullPrompt",
    "sk-testSECRET",
    "tp-testSECRET",
    "data/sessions",
    "C:\\Users\\ZZZ\\secret"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
}

test("S92.4 tool loop projects internal tool attempts without server or raw leakage", async () => {
  const context = scholarContext();
  const result = await runGameToolLoop({
    ...context,
    budget: {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: true
    },
    modelSteps: [
      {
        toolCalls: [
          {
            id: "call-internal",
            name: "server.resolve_case",
            arguments: {
              rawSql: "UPDATE world_sessions SET world_state_json='{}'",
              apiKey: "sk-testSECRET",
              localPath: "C:\\Users\\ZZZ\\secret\\.env",
              hiddenNotes: "SEALED"
            }
          }
        ]
      }
    ]
  });

  assert.equal(result.toolResults[0].status, "rejected");
  assert.equal(result.toolMessages[0].name, "tool_result");
  assertNoSensitiveText(result);
  assertNoSensitiveText(context.toolAuditRecords);
});

test("S92.4 malformed provider arguments are rejected without echoing raw text", async () => {
  const context = scholarContext();
  const result = await runGameToolLoop({
    ...context,
    budget: {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: true
    },
    modelSteps: [
      {
        toolCalls: [
          {
            id: "call-bad-json",
            function: {
              name: "world_read_visible_context",
              arguments: "{\"query\":\"rawPrompt sk-testSECRET C:\\\\Users\\\\ZZZ\\\\secret\""
            }
          }
        ]
      }
    ]
  });

  assert.equal(result.toolResults[0].status, "rejected");
  assert.match(result.toolResults[0].rejectionReasons.join(" "), /JSON object|形状/);
  assertNoSensitiveText(result);
  assertNoSensitiveText(context.toolAuditRecords);
});

test("S92.4 model tool result projection contains only public result, rejection, audit and hint", () => {
  const projection = projectToolResultForModel({
    status: "pending",
    toolName: "event.loop_proposal",
    actorRef: {
      actorId: "player:P1",
      actorType: "minister",
      authorityTier: "T4",
      jurisdictionRefs: []
    },
    publicResult: {
      summary: "候选已入待裁决。",
      visibleChanges: ["公开摘要一条。"]
    },
    privateResultRefs: ["hiddenNotes:sealed", "data/sessions/private.json"],
    appliedEventIds: ["hidden-event-1"],
    rejectionReasons: ["仍候服务器复核。"],
    counterCosts: ["rawPrompt should not appear"],
    followUpHooks: ["server.resolve_case"],
    auditRef: "ai-tool-audit:public-1",
    modelFollowUpHint: "call-public-1"
  }, {
    id: "call-public-1"
  });
  const content = parseProjectedToolContent(projection);

  assert.deepEqual(Object.keys(content).sort(), [
    "auditRef",
    "modelFollowUpHint",
    "publicResult",
    "rejectionReasons",
    "status"
  ]);
  assert.deepEqual(Object.keys(content.publicResult).sort(), ["summary", "visibleChanges"]);
  assert.equal(content.status, "pending");
  assert.equal(content.auditRef, "ai-tool-audit:public-1");
  assertNoSensitiveText(projection);
});
