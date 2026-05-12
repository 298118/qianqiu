const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MIMO_TOOL_SMOKE_CASES,
  assertStrictInputSchema,
  buildProviderToolNameMap,
  createVisibleContextReadToolDefinition,
  toAnthropicToolDefinition,
  toOpenAiChatFunctionTool,
  toProviderToolName,
  validateRequestAdjudication,
  validateToolDefinition,
  validateToolPayload,
  validateToolProposal
} = require("../src/ai/toolSchemas");

function actorRef() {
  return {
    actorId: "player_scholar",
    actorType: "scholar",
    authorityTier: "T1",
    jurisdictionRefs: []
  };
}

test("S70.1 tool envelope accepts strict MCP-friendly definitions", () => {
  const definition = createVisibleContextReadToolDefinition();

  assert.equal(validateToolDefinition(definition), definition);
  assert.equal(definition.resolver.serverOwned, true);
  assert.equal(definition.permission.forbiddenScopes.includes("sql"), true);
  assert.equal(definition.permission.forbiddenScopes.includes("raw_table"), true);
});

test("S70.1 provider tool adapters keep internal names out of provider-visible names", () => {
  const definition = createVisibleContextReadToolDefinition();
  const openAiTool = toOpenAiChatFunctionTool(definition);
  const anthropicTool = toAnthropicToolDefinition(definition);

  assert.equal(toProviderToolName("world.read_visible_context"), "world_read_visible_context");
  assert.equal(openAiTool.type, "function");
  assert.equal(openAiTool.function.name, "world_read_visible_context");
  assert.equal(openAiTool.function.strict, true);
  assert.equal(openAiTool.function.parameters.additionalProperties, false);
  assert.equal(anthropicTool.name, "world_read_visible_context");
  assert.equal(anthropicTool.input_schema.additionalProperties, false);
});

test("S70.1 rejects server-visible or non-strict model tool schemas", () => {
  const serverTool = {
    ...createVisibleContextReadToolDefinition(),
    name: "server.resolve_case"
  };
  assert.throws(() => validateToolDefinition(serverTool), /server\.\*/);

  const looseTool = {
    ...createVisibleContextReadToolDefinition(),
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" }
      }
    }
  };
  assert.throws(() => validateToolDefinition(looseTool), /additionalProperties/);

  const optionalTool = {
    ...createVisibleContextReadToolDefinition(),
    inputSchema: {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        maxItems: { type: "integer" }
      }
    }
  };
  assert.throws(() => validateToolDefinition(optionalTool), /must be listed in required/);

  const primitiveTool = {
    ...createVisibleContextReadToolDefinition(),
    inputSchema: { type: "string" }
  };
  assert.throws(() => validateToolDefinition(primitiveTool), /top-level object schema/);

  const rawPatchTool = {
    ...createVisibleContextReadToolDefinition(),
    inputSchema: {
      type: "object",
      required: ["statePatch"],
      additionalProperties: false,
      properties: {
        statePatch: {
          type: "object",
          required: [],
          additionalProperties: false,
          properties: {}
        }
      }
    }
  };
  assert.throws(() => validateToolDefinition(rawPatchTool), /forbidden argument properties/);

  const patternTool = {
    ...createVisibleContextReadToolDefinition(),
    inputSchema: {
      type: "object",
      required: [],
      additionalProperties: false,
      patternProperties: {
        "^rawSql$": { type: "string" }
      },
      properties: {}
    }
  };
  assert.throws(() => validateToolDefinition(patternTool), /patternProperties/);
});

test("S70.1 proposal and adjudication helpers validate arguments against tool schemas", () => {
  const definition = createVisibleContextReadToolDefinition();
  const baseProposal = {
    proposalId: "proposal-1",
    toolName: definition.name,
    actorRef: actorRef(),
    intent: "读取一组安全可见上下文。",
    arguments: {
      domains: ["exam", "people"],
      query: "科举与同窗",
      maxItems: 3
    },
    visibility: "player_visible",
    confidence: 0.55,
    evidenceRefs: ["eventArchiveView:market-1"],
    boundaryStatement: "只提交读取请求，服务器决定返回哪些可见摘要。"
  };

  assert.equal(validateToolPayload("toolProposal", baseProposal), baseProposal);
  assert.equal(validateToolProposal(definition, baseProposal), baseProposal);
  assert.throws(
    () => validateToolProposal(definition, {
      ...baseProposal,
      arguments: {
        ...baseProposal.arguments,
        rawSql: "UPDATE world_sessions SET world_state_json = '{}'"
      }
    }),
    /arguments failed schema validation/
  );
  assert.throws(
    () => validateToolProposal(definition, {
      ...baseProposal,
      arguments: {
        ...baseProposal.arguments,
        worldState: { player: { role: "emperor" } }
      }
    }),
    /arguments failed schema validation/
  );
  assert.throws(
    () => validateToolProposal(definition, {
      ...baseProposal,
      toolName: "event.propose_incident"
    }),
    /name mismatch/
  );

  const adjudication = {
    requestId: "request-1",
    domain: "event",
    toolName: definition.name,
    actorRef: actorRef(),
    requestedAction: "请求服务器返回可见摘要。",
    arguments: {
      domains: ["events"],
      query: "县学讲会",
      maxItems: 2
    },
    authorityBasis: "书生只能读取公开摘要。",
    evidenceRefs: ["eventArchiveView:case-1"],
    riskDisclosure: "不足则返回空摘要。",
    visibleToPlayer: true
  };
  assert.equal(validateToolPayload("requestAdjudication", adjudication), adjudication);
  assert.equal(validateRequestAdjudication(definition, adjudication), adjudication);
  assert.throws(
    () => validateRequestAdjudication(definition, {
      ...adjudication,
      arguments: {
        ...adjudication.arguments,
        statePatch: { player: { officeTitle: "模型授官" } }
      }
    }),
    /arguments failed schema validation/
  );
  assert.throws(
    () => validateRequestAdjudication(definition, {
      ...adjudication,
      arguments: {
        ...adjudication.arguments,
        worldState: { activeExam: { level: "palace_exam" } }
      }
    }),
    /arguments failed schema validation/
  );
});

test("S70.1 provider-visible tool names must be collision-free", () => {
  const definition = createVisibleContextReadToolDefinition();
  assert.deepEqual(buildProviderToolNameMap([definition]), {
    world_read_visible_context: "world.read_visible_context"
  });

  const first = { ...definition, name: "foo.bar_baz" };
  const second = { ...definition, name: "foo_bar.baz" };
  assert.throws(() => buildProviderToolNameMap([first, second]), /collision/);
});

test("S70.1 tool results are server outcomes, not model state patches", () => {
  const result = {
    status: "accepted",
    toolName: "world.read_visible_context",
    actorRef: actorRef(),
    publicResult: {
      summary: "已返回书生可见摘要。",
      visibleChanges: []
    },
    privateResultRefs: [],
    appliedEventIds: [],
    rejectionReasons: [],
    counterCosts: [],
    followUpHooks: [],
    auditRef: "audit-1"
  };

  assert.equal(validateToolPayload("toolResult", result), result);
  assert.throws(
    () => validateToolPayload("toolResult", {
      ...result,
      statePatch: {
        player: { officeTitle: "模型授官" }
      }
    }),
    /schema validation/
  );
});

test("S70.1 MiMo tool smoke matrix tracks required compatibility probes", () => {
  const caseIds = MIMO_TOOL_SMOKE_CASES.map((item) => item.id);
  for (const id of [
    "forced_tool",
    "single_tool",
    "multi_tool",
    "tool_result_roundtrip",
    "streaming",
    "schema_failure"
  ]) {
    assert.equal(caseIds.includes(id), true);
  }
});

test("S70.1 contract docs exist and record prompt/tool boundaries", () => {
  const promptContract = fs.readFileSync(
    path.join(__dirname, "..", "docs", "AI_PROMPT_ENGINEERING_CONTRACT.md"),
    "utf8"
  );
  const toolContract = fs.readFileSync(
    path.join(__dirname, "..", "docs", "AI_TOOL_PROTOCOL_CONTRACT.md"),
    "utf8"
  );

  for (const marker of [
    "systemContract",
    "actorCard",
    "sceneContract",
    "visibleContextCapsule",
    "toolPolicy",
    "outputContract",
    "selfCheck"
  ]) {
    assert.match(promptContract, new RegExp(marker));
  }

  for (const marker of [
    "name",
    "description",
    "inputSchema",
    "permission",
    "resolver",
    "audit",
    "cooldown",
    "mockFallback",
    "request-adjudication",
    "server.*"
  ]) {
    assert.match(toolContract, new RegExp(marker.replace("*", "\\*")));
  }
});
