const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const { buildPlayerAiActorProfile } = require("../src/game/aiActorProfiles");
const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { createVisibleContextReadToolDefinition } = require("../src/ai/toolSchemas");
const {
  listProviderVisibleToolsForActor,
  runGameToolLoop
} = require("../src/ai/tools/gameToolLoop");
const { normalizeToolCalls } = require("../src/ai/tools/toolCallNormalizer");

function loopProposalToolDefinition() {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name: "event.loop_proposal",
    description: "提交一个 S92 工具循环测试用事件 proposal；服务器只返回待裁决，不改写世界事实。",
    inputSchema: {
      type: "object",
      required: ["publicSummary", "evidenceRefs", "riskDisclosure", "cooldownKey"],
      additionalProperties: false,
      properties: {
        publicSummary: { type: "string" },
        evidenceRefs: {
          type: "array",
          items: { type: "string" }
        },
        riskDisclosure: { type: "string" },
        cooldownKey: { type: "string" }
      }
    },
    permission: {
      ...base.permission,
      toolType: "proposal",
      authorityTiers: ["T4"],
      actorTypes: ["minister"],
      toolGroups: ["event"],
      readScope: ["eventArchiveView"],
      proposalScope: ["loop_event_candidate"],
      requiresEvidence: false
    },
    resolver: {
      kind: "proposal_resolver",
      name: "server.pending_proposal",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    mockFallback: {
      mode: "pending",
      fixtureId: "s92_loop_proposal_pending",
      publicSummary: "Mock 模式只返回待裁决。"
    }
  };
}

function loopAdjudicationToolDefinition() {
  const base = createVisibleContextReadToolDefinition();
  return {
    ...base,
    name: "career.loop_adjudication",
    description: "提交一个 S92 工具循环测试用任免复核 request-adjudication；服务器只返回待裁决。",
    inputSchema: {
      type: "object",
      required: ["requestedAction", "evidenceRefs", "authorityBasis", "riskDisclosure"],
      additionalProperties: false,
      properties: {
        requestedAction: { type: "string" },
        evidenceRefs: {
          type: "array",
          items: { type: "string" }
        },
        authorityBasis: { type: "string" },
        riskDisclosure: { type: "string" }
      }
    },
    permission: {
      ...base.permission,
      toolType: "request_adjudication",
      authorityTiers: ["T4"],
      actorTypes: ["minister"],
      toolGroups: ["career"],
      readScope: ["officialPostingsView", "eventArchiveView"],
      proposalScope: ["loop_adjudication_request"],
      requiresEvidence: false
    },
    resolver: {
      kind: "adjudication_resolver",
      name: "server.pending_adjudication",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    mockFallback: {
      mode: "pending",
      fixtureId: "s92_loop_adjudication_pending",
      publicSummary: "Mock 模式只返回待裁决。"
    }
  };
}

function loopRegistry() {
  return createGameAiToolRegistry([
    createVisibleContextReadToolDefinition(),
    loopProposalToolDefinition(),
    loopAdjudicationToolDefinition()
  ]);
}

function ministerContext() {
  const worldState = createInitialState({ role: "minister", playerName: "部院官" });
  return {
    worldState,
    actorProfile: buildPlayerAiActorProfile(worldState),
    toolRegistry: loopRegistry(),
    toolAuditRecords: []
  };
}

test("S92.4 mock tool loop runs read, proposal and adjudication in order", async () => {
  const context = ministerContext();
  const before = JSON.stringify(context.worldState);

  const result = await runGameToolLoop({
    worldState: context.worldState,
    actorProfile: context.actorProfile,
    toolRegistry: context.toolRegistry,
    toolAuditRecords: context.toolAuditRecords,
    budget: {
      mayUseTools: true,
      toolBudget: 3,
      mayRequestAdjudication: true
    },
    modelSteps: [
      {
        toolCalls: [
          {
            id: "call-read",
            function: {
              name: "world_read_visible_context",
              arguments: "{\"domains\":[\"events\"],\"query\":\"近事\",\"maxItems\":2}"
            }
          },
          {
            id: "call-proposal",
            name: "event.loop_proposal",
            arguments: {
              publicSummary: "请将粮价议题列为候复材料。",
              evidenceRefs: ["eventArchiveView:grain"],
              riskDisclosure: "只作候复，不作事实。",
              cooldownKey: "grain-loop"
            }
          },
          {
            id: "call-adjudication",
            name: "career.loop_adjudication",
            arguments: {
              requestedAction: "复核一条任免候选。",
              evidenceRefs: ["officialPostingsView:posting-player-current"],
              authorityBasis: "部院只可请求复核。",
              riskDisclosure: "服务器未裁决前不成事实。"
            }
          }
        ]
      }
    ]
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(result.toolExecutionOrder, [
    "world_read_visible_context",
    "event_loop_proposal",
    "career_loop_adjudication"
  ]);
  assert.equal(result.toolCounts.allowed, 3);
  assert.equal(result.toolCounts.used, 3);
  assert.equal(result.toolCounts.executed, 3);
  assert.equal(result.toolMessages.length, 3);
  assert.equal(result.toolResults[0].status, "accepted");
  assert.equal(result.toolResults[1].status, "pending");
  assert.equal(result.toolResults[2].status, "pending");
  assert.equal(result.toolResults[1].publicResult.summary.includes("待裁决"), true);
  assert.equal(JSON.stringify(context.worldState), before);
  assert.equal(context.toolAuditRecords.length, 3);
});

test("S92.4 tool loop enforces budget and rejects overflow without executing it", async () => {
  const context = ministerContext();
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
            id: "call-read",
            name: "world.read_visible_context",
            arguments: {
              domains: ["events"],
              query: "近事",
              maxItems: 1
            }
          },
          {
            id: "call-overflow",
            name: "event.loop_proposal",
            arguments: {
              publicSummary: "超预算候选。",
              evidenceRefs: ["eventArchiveView:overflow"],
              riskDisclosure: "不得执行。",
              cooldownKey: "overflow"
            }
          }
        ]
      }
    ]
  });

  assert.equal(result.status, "tool_budget_exhausted");
  assert.equal(result.toolCounts.attempted, 2);
  assert.equal(result.toolCounts.used, 1);
  assert.equal(result.toolCounts.executed, 1);
  assert.equal(result.toolCounts.rejected, 1);
  assert.equal(result.toolResults[0].status, "accepted");
  assert.equal(result.toolResults[1].status, "rejected");
  assert.match(result.toolResults[1].rejectionReasons.join(" "), /预算/);
  assert.equal(context.toolAuditRecords.length, 2);
});

test("S92.4 oversized tool batches are capped to one safe overflow or budget rejection", async () => {
  const rawCalls = Array.from({ length: 30 }, (_, index) => ({
    id: `call-${index}`,
    name: "world.read_visible_context",
    arguments: {
      domains: ["events"],
      query: `近事 ${index}`,
      maxItems: 1
    }
  }));
  const normalized = normalizeToolCalls({ toolCalls: rawCalls }, { maxCalls: 3 });

  assert.equal(normalized.toolCalls.length, 3);
  assert.equal(normalized.rejectedCalls.length, 1);
  assert.equal(normalized.items.length, 4);
  assert.equal(normalized.rejectedCalls[0].overflowCount, 27);

  const context = ministerContext();
  const result = await runGameToolLoop({
    ...context,
    budget: {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: true
    },
    modelSteps: [{ toolCalls: rawCalls }]
  });

  assert.equal(result.status, "tool_budget_exhausted");
  assert.equal(result.toolMessages.length, 2);
  assert.equal(result.toolResults.length, 2);
  assert.equal(result.toolCounts.attempted, 2);
  assert.equal(result.toolCounts.rejected, 1);
});

test("S92.4 tool loop rejects adjudication when the task policy disallows it", async () => {
  const context = ministerContext();
  const result = await runGameToolLoop({
    ...context,
    budget: {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: false
    },
    modelSteps: [
      {
        toolCalls: [
          {
            id: "call-no-adjudication",
            name: "career.loop_adjudication",
            arguments: {
              requestedAction: "复核一条任免候选。",
              evidenceRefs: ["officialPostingsView:posting-player-current"],
              authorityBasis: "部院只可请求复核。",
              riskDisclosure: "服务器未裁决前不成事实。"
            }
          }
        ]
      }
    ]
  });

  assert.equal(result.status, "ok");
  assert.equal(result.toolCounts.used, 1);
  assert.equal(result.toolCounts.executed, 0);
  assert.equal(result.toolCounts.rejected, 1);
  assert.equal(result.toolResults[0].status, "rejected");
  assert.match(result.toolResults[0].rejectionReasons.join(" "), /裁决/);
  assert.equal(context.toolAuditRecords.length, 1);
});

test("S92.4 tool loop can drive a mock provider step until final payload", async () => {
  const context = ministerContext();
  const providerSteps = [
    {
      toolCalls: [
        {
          id: "call-provider-read",
          name: "world.read_visible_context",
          arguments: {
            domains: ["events"],
            query: "近事",
            maxItems: 1
          }
        }
      ]
    },
    {
      finalPayload: {
        narrative: "已据可见摘要作答。",
        pendingNotFact: true
      }
    }
  ];
  const provider = {
    async generateOrRequestTools({ stepIndex, tools, toolResults }) {
      assert.equal(Array.isArray(tools), true);
      if (stepIndex === 1) {
        assert.equal(toolResults.length, 1);
        assert.equal(toolResults[0].status, "accepted");
      }
      return providerSteps[stepIndex] || { finalPayload: { narrative: "止。" } };
    }
  };

  const result = await runGameToolLoop({
    ...context,
    provider,
    budget: {
      mayUseTools: true,
      toolBudget: 1,
      mayRequestAdjudication: true
    }
  });

  assert.equal(result.status, "ok");
  assert.equal(result.finalPayload.narrative, "已据可见摘要作答。");
  assert.equal(result.toolCounts.executed, 1);
  assert.equal(result.toolResults[0].status, "accepted");
});

test("S92.4 provider-visible tool list exposes schemas only, not server internals", () => {
  const context = ministerContext();
  const providerTools = listProviderVisibleToolsForActor(context.actorProfile, context.toolRegistry);
  const serialized = JSON.stringify(providerTools);

  assert.equal(providerTools.length, 3);
  assert.match(serialized, /world_read_visible_context/);
  for (const forbiddenField of [
    "resolver",
    "permission",
    "audit",
    "cooldown",
    "mockFallback"
  ]) {
    assert.equal(serialized.includes(`"${forbiddenField}"`), false, forbiddenField);
  }

  for (const forbidden of [
    "server.",
    "rawSql",
    "worldState",
    "statePatch",
    "hiddenNotes",
    "apiKey",
    "localPath"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
