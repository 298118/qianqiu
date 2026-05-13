const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  AI_CONTROL_AUDIT_SCHEMA_VERSION,
  buildAiControlAuditDiagnostics,
  buildAiControlAuditView
} = require("../src/game/aiControlAudit");
const { recordAiInvocation } = require("../src/game/aiSettings");

const FORBIDDEN_AUDIT_TEXT =
  /(SEALED_|rawPrompt|providerPayload|statePatch|server\.|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+|\/(?:mnt|home|srv|etc|private|run)\/|file:\/\/|world_state_json|ai_change_proposals|event_log|prompt_retrieval_index|actorMemoryLedger)/i;

function assertHiddenSafe(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, FORBIDDEN_AUDIT_TEXT);
}

test("S71.11 AI control audit view summarizes invocations and public results safely", () => {
  const worldState = createInitialState({
    dynasty: "明",
    year: 1644,
    role: "official",
    playerName: "审计官"
  });
  worldState.turnCount = 7;
  worldState.eventHistory.push("奉命赈济流民，仓廪稍稳。");
  worldState.eventHistory.push("rawPrompt providerPayload server.resolve_case /mnt/e/LSMNQ/sketch sk-testsecret");

  recordAiInvocation(worldState, {
    taskType: "narrator",
    route: {
      taskType: "narrator",
      provider: "mock",
      model: "mock",
      maxOutputTokens: 900,
      toolBudget: 2
    },
    status: "completed",
    durationMs: 36,
    toolCallCount: 2,
    rejectedToolCallCount: 1,
    rejectionReasons: ["server.resolve_case rawPrompt /mnt/e/secret sk-testsecret"]
  });

  const view = buildAiControlAuditView(worldState);

  assert.equal(view.schemaVersion, AI_CONTROL_AUDIT_SCHEMA_VERSION);
  assert.equal(view.generatedAtTurn, 7);
  assert.ok(view.publicPanel.publicResultCount >= 1);
  assert.equal(view.publicPanel.rejectedToolCallCount, 1);
  assert.equal(view.developerPanel.toolCallSummary.recentToolCalls, 2);
  assert.equal(view.developerPanel.recentInvocations.at(-1).label, "叙事");
  assert.equal(view.developerPanel.safety.promptTextIncluded, false);
  assert.equal(view.developerPanel.safety.databaseRowsIncluded, false);
  assertHiddenSafe(view);
});

test("S71.11 AI control audit redacts unsafe caller-supplied summary fields", () => {
  const worldState = createInitialState({
    role: "magistrate",
    playerName: "脱敏验收"
  });
  const unsafeInvocationSummary = {
    routeCostSummary: {
      taskCount: 9,
      maxOutputTokens: 1200,
      maxToolCalls: 3,
      providers: ["mock", "/srv/app/qianqiu/key", "path=/srv/app/qianqiu/provider-key"],
      unavailableProviders: ["server.resolve_case", "model:/etc/qianqiu/provider.json"],
      reviewerOnlyTasks: ["safety_gate"]
    },
    toolCallSummary: {
      recentToolCalls: 4,
      recentRejectedToolCalls: 2,
      rejectionReasons: [
        "server.resolve_case rawPrompt providerPayload file:///srv/app/qianqiu/cache.json sk-testsecret",
        "path=/srv/app/qianqiu/model.bin model:/etc/qianqiu/provider.json cache='/private/tmp/qianqiu/cache.json'",
        "证据不足"
      ]
    },
    recentInvocations: [
      {
        taskType: "server.resolve_case",
        label: "rawPrompt providerPayload",
        provider: "path=/srv/app/qianqiu/provider",
        model: "model:/etc/qianqiu/model.bin",
        status: "rejected",
        durationMs: 18,
        maxOutputTokens: 800,
        toolCallCount: 4,
        rejectedToolCallCount: 2,
        recordedTurn: 3
      }
    ]
  };
  const view = buildAiControlAuditView(worldState, {
    aiInvocationSummaryView: unsafeInvocationSummary
  });

  assert.deepEqual(view.developerPanel.routeCostSummary.providers, ["mock"]);
  assert.deepEqual(view.developerPanel.routeCostSummary.unavailableProviders, []);
  assert.equal(view.developerPanel.toolCallSummary.rejectionReasons.includes("证据不足"), true);
  assert.equal(view.developerPanel.recentInvocations[0].taskType, "narrator");
  assert.equal(view.developerPanel.recentInvocations[0].label, "AI 调动");
  assert.equal(view.developerPanel.recentInvocations[0].provider, "mock");
  assertHiddenSafe(view);

  const diagnostics = buildAiControlAuditDiagnostics(worldState, {
    aiInvocationSummaryView: unsafeInvocationSummary
  });
  assert.equal(diagnostics.schemaVersion, AI_CONTROL_AUDIT_SCHEMA_VERSION);
  assertHiddenSafe(diagnostics);
});
