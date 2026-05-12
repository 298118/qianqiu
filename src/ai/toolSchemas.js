const Ajv = require("ajv");
const { formatValidationErrors } = require("../utils/json");

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const TOOL_TYPES = Object.freeze(["read", "proposal", "request_adjudication"]);
const TOOL_RESULT_STATUSES = Object.freeze(["accepted", "rejected", "pending", "failed"]);
const FORBIDDEN_ARGUMENT_PROPERTY_NAMES = Object.freeze([
  "rawSql",
  "sql",
  "statePatch",
  "worldState",
  "rawTable",
  "rawAudit",
  "rawPrompt",
  "providerConfig",
  "localPath",
  "hiddenNotes",
  "hiddenIntent",
  "apiKey"
]);
const FORBIDDEN_SCHEMA_DYNAMIC_KEYWORDS = Object.freeze([
  "patternProperties",
  "propertyNames",
  "dependencies",
  "dependentSchemas",
  "dependentRequired",
  "unevaluatedProperties"
]);

const strictStringArraySchema = {
  type: "array",
  items: { type: "string" },
  default: []
};

const actorRefSchema = {
  type: "object",
  required: ["actorId", "actorType", "authorityTier"],
  additionalProperties: false,
  properties: {
    actorId: { type: "string" },
    actorType: { type: "string" },
    authorityTier: { type: "string" },
    officeId: { type: "string" },
    jurisdictionRefs: strictStringArraySchema
  }
};

const toolPermissionSchema = {
  type: "object",
  required: [
    "toolType",
    "authorityTiers",
    "actorTypes",
    "readScope",
    "proposalScope",
    "visibilityBoundary",
    "forbiddenScopes"
  ],
  additionalProperties: false,
  properties: {
    toolType: { type: "string", enum: TOOL_TYPES },
    authorityTiers: strictStringArraySchema,
    actorTypes: strictStringArraySchema,
    toolGroups: strictStringArraySchema,
    readScope: strictStringArraySchema,
    proposalScope: strictStringArraySchema,
    visibilityBoundary: { type: "string" },
    forbiddenScopes: strictStringArraySchema,
    requiresJurisdiction: { type: "boolean" },
    requiresEvidence: { type: "boolean" }
  }
};

const toolResolverSchema = {
  type: "object",
  required: ["kind", "name", "serverOwned"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["read_view", "proposal_resolver", "adjudication_resolver"] },
    name: { type: "string" },
    serverOwned: { type: "boolean", const: true },
    appliesState: { type: "boolean" },
    writesStorage: { type: "boolean" },
    transactionBoundary: { type: "string" }
  }
};

const toolAuditSchema = {
  type: "object",
  required: ["eventType", "summaryFields", "redactFields", "recordRejected"],
  additionalProperties: false,
  properties: {
    eventType: { type: "string" },
    summaryFields: strictStringArraySchema,
    redactFields: strictStringArraySchema,
    recordRejected: { type: "boolean" },
    publicProjection: { type: "string" }
  }
};

const toolCooldownSchema = {
  type: "object",
  required: ["scope", "turns"],
  additionalProperties: false,
  properties: {
    scope: { type: "string", enum: ["none", "actor", "scene", "jurisdiction", "world"] },
    turns: { type: "integer", minimum: 0 },
    cooldownKeyFields: strictStringArraySchema
  }
};

const mockFallbackSchema = {
  type: "object",
  required: ["mode", "fixtureId"],
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["deterministic", "reject", "pending"] },
    fixtureId: { type: "string" },
    publicSummary: { type: "string" }
  }
};

const providerCompatibilitySchema = {
  type: "object",
  required: ["openAiChat", "anthropic", "mcp"],
  additionalProperties: false,
  properties: {
    openAiChat: { type: "string", enum: ["supported", "disabled", "needs_probe"] },
    anthropic: { type: "string", enum: ["supported", "disabled", "needs_probe"] },
    mcp: { type: "string", enum: ["compatible", "internal_only"] },
    notes: { type: "string" }
  }
};

const toolEnvelopeSchema = {
  type: "object",
  required: [
    "name",
    "description",
    "inputSchema",
    "permission",
    "resolver",
    "audit",
    "cooldown",
    "mockFallback"
  ],
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      pattern: "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
    },
    description: { type: "string", minLength: 24 },
    inputSchema: { type: "object" },
    permission: toolPermissionSchema,
    resolver: toolResolverSchema,
    audit: toolAuditSchema,
    cooldown: toolCooldownSchema,
    mockFallback: mockFallbackSchema,
    riskTags: strictStringArraySchema,
    providerCompatibility: providerCompatibilitySchema
  }
};

const toolProposalSchema = {
  type: "object",
  required: [
    "proposalId",
    "toolName",
    "actorRef",
    "intent",
    "arguments",
    "visibility",
    "confidence",
    "evidenceRefs",
    "boundaryStatement"
  ],
  additionalProperties: false,
  properties: {
    proposalId: { type: "string" },
    toolName: { type: "string" },
    actorRef: actorRefSchema,
    intent: { type: "string" },
    arguments: { type: "object" },
    visibility: { type: "string", enum: ["player_visible", "actor_visible", "server_private"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidenceRefs: strictStringArraySchema,
    boundaryStatement: { type: "string" },
    requestedFollowUp: { type: "string" }
  }
};

const requestAdjudicationSchema = {
  type: "object",
  required: [
    "requestId",
    "domain",
    "toolName",
    "actorRef",
    "requestedAction",
    "arguments",
    "authorityBasis",
    "evidenceRefs",
    "riskDisclosure"
  ],
  additionalProperties: false,
  properties: {
    requestId: { type: "string" },
    domain: {
      type: "string",
      enum: ["office", "career", "judicial", "military", "diplomacy", "exam", "event", "time", "memory", "map"]
    },
    toolName: { type: "string" },
    actorRef: actorRefSchema,
    requestedAction: { type: "string" },
    arguments: { type: "object" },
    authorityBasis: { type: "string" },
    evidenceRefs: strictStringArraySchema,
    riskDisclosure: { type: "string" },
    visibleToPlayer: { type: "boolean" }
  }
};

const toolResultSchema = {
  type: "object",
  required: [
    "status",
    "toolName",
    "actorRef",
    "publicResult",
    "privateResultRefs",
    "appliedEventIds",
    "rejectionReasons",
    "counterCosts",
    "followUpHooks",
    "auditRef"
  ],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: TOOL_RESULT_STATUSES },
    toolName: { type: "string" },
    actorRef: actorRefSchema,
    publicResult: {
      type: "object",
      required: ["summary", "visibleChanges"],
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        visibleChanges: strictStringArraySchema
      }
    },
    privateResultRefs: strictStringArraySchema,
    appliedEventIds: strictStringArraySchema,
    rejectionReasons: strictStringArraySchema,
    counterCosts: strictStringArraySchema,
    followUpHooks: strictStringArraySchema,
    auditRef: { type: "string" },
    modelFollowUpHint: { type: "string" }
  }
};

const providerToolCallShapeSchema = {
  type: "object",
  required: ["provider", "model", "phase", "toolCalls", "rawShape"],
  additionalProperties: false,
  properties: {
    provider: { type: "string" },
    model: { type: "string" },
    phase: {
      type: "string",
      enum: ["single_tool", "forced_tool", "multi_tool", "tool_result_roundtrip", "streaming", "schema_failure"]
    },
    toolCalls: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "arguments"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          arguments: { type: "object" }
        }
      }
    },
    rawShape: {
      type: "object",
      required: ["choicesPath", "argumentsEncoding"],
      additionalProperties: false,
      properties: {
        choicesPath: { type: "string" },
        argumentsEncoding: { type: "string", enum: ["json_string", "object", "unknown"] },
        hasToolChoice: { type: "boolean" },
        hasStreamingDeltas: { type: "boolean" }
      }
    },
    notes: { type: "string" }
  }
};

const TOOL_SCHEMAS = {
  toolEnvelope: toolEnvelopeSchema,
  toolProposal: toolProposalSchema,
  requestAdjudication: requestAdjudicationSchema,
  toolResult: toolResultSchema,
  providerToolCallShape: providerToolCallShapeSchema
};

const validators = Object.fromEntries(
  Object.entries(TOOL_SCHEMAS).map(([name, schema]) => [name, ajv.compile(schema)])
);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getToolSchema(name) {
  const schema = TOOL_SCHEMAS[name];
  if (!schema) {
    throw new Error(`Unknown AI tool schema: ${name}`);
  }
  return schema;
}

function validateToolPayload(name, payload) {
  const validate = validators[name];
  if (!validate) {
    throw new Error(`Unknown AI tool schema validator: ${name}`);
  }
  if (!validate(payload)) {
    throw new Error(`AI tool ${name} JSON failed schema validation: ${formatValidationErrors(validate.errors)}`);
  }
  return payload;
}

function toProviderToolName(toolName) {
  return String(toolName || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function collectStrictSchemaErrors(schema, path = "inputSchema", errors = []) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push(`${path} must be an object schema`);
    return errors;
  }

  for (const keyword of FORBIDDEN_SCHEMA_DYNAMIC_KEYWORDS) {
    if (Object.prototype.hasOwnProperty.call(schema, keyword)) {
      errors.push(`${path} must not use dynamic schema keyword ${keyword}`);
    }
  }

  if (schema.type === "object") {
    if (schema.additionalProperties !== false) {
      errors.push(`${path} must set additionalProperties: false`);
    }
    const propertyNames = Object.keys(schema.properties || {});
    const required = new Set(schema.required || []);
    for (const propertyName of propertyNames) {
      if (!required.has(propertyName)) {
        errors.push(`${path}.${propertyName} must be listed in required for strict provider portability`);
      }
      collectStrictSchemaErrors(schema.properties[propertyName], `${path}.${propertyName}`, errors);
    }
  }

  if (schema.type === "array" && schema.items) {
    collectStrictSchemaErrors(schema.items, `${path}[]`, errors);
  }

  for (const keyword of ["anyOf", "oneOf"]) {
    if (Array.isArray(schema[keyword])) {
      schema[keyword].forEach((item, index) => collectStrictSchemaErrors(item, `${path}.${keyword}[${index}]`, errors));
    }
  }

  return errors;
}

function assertStrictInputSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || schema.type !== "object") {
    throw new Error("Tool input schema must be a top-level object schema.");
  }

  const errors = collectStrictSchemaErrors(schema);
  if (errors.length) {
    throw new Error(`Tool input schema is not strict: ${errors.join("; ")}`);
  }
}

function collectForbiddenInputSchemaProperties(schema, path = "inputSchema", findings = []) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return findings;
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      if (FORBIDDEN_ARGUMENT_PROPERTY_NAMES.includes(propertyName)) {
        findings.push(`${path}.${propertyName}`);
      }
      collectForbiddenInputSchemaProperties(propertySchema, `${path}.${propertyName}`, findings);
    }
  }

  if (schema.items) {
    collectForbiddenInputSchemaProperties(schema.items, `${path}[]`, findings);
  }

  for (const keyword of ["anyOf", "oneOf"]) {
    if (Array.isArray(schema[keyword])) {
      schema[keyword].forEach((item, index) => {
        collectForbiddenInputSchemaProperties(item, `${path}.${keyword}[${index}]`, findings);
      });
    }
  }

  return findings;
}

function assertNoForbiddenInputSchemaProperties(schema) {
  const findings = collectForbiddenInputSchemaProperties(schema);
  if (findings.length) {
    throw new Error(`Tool input schema exposes forbidden argument properties: ${findings.join(", ")}`);
  }
}

function validateToolDefinition(toolDefinition) {
  validateToolPayload("toolEnvelope", toolDefinition);
  if (toolDefinition.name.startsWith("server.")) {
    throw new Error("server.* tools are internal resolver labels and must not be model-visible tool names.");
  }
  if (toolDefinition.resolver.name && !toolDefinition.resolver.serverOwned) {
    throw new Error("Tool resolver must remain server-owned.");
  }
  assertStrictInputSchema(toolDefinition.inputSchema);
  assertNoForbiddenInputSchemaProperties(toolDefinition.inputSchema);
  return toolDefinition;
}

function validateToolArguments(toolDefinition, argumentsPayload) {
  validateToolDefinition(toolDefinition);
  const validate = ajv.compile(toolDefinition.inputSchema);
  if (!validate(argumentsPayload)) {
    throw new Error(`AI tool arguments failed schema validation: ${formatValidationErrors(validate.errors)}`);
  }
  return argumentsPayload;
}

function validateToolProposal(toolDefinition, proposal) {
  validateToolDefinition(toolDefinition);
  validateToolPayload("toolProposal", proposal);
  if (proposal.toolName !== toolDefinition.name) {
    throw new Error(`Tool proposal name mismatch: expected ${toolDefinition.name}, received ${proposal.toolName}.`);
  }
  validateToolArguments(toolDefinition, proposal.arguments);
  return proposal;
}

function validateRequestAdjudication(toolDefinition, request) {
  validateToolDefinition(toolDefinition);
  validateToolPayload("requestAdjudication", request);
  if (request.toolName !== toolDefinition.name) {
    throw new Error(`Tool adjudication request name mismatch: expected ${toolDefinition.name}, received ${request.toolName}.`);
  }
  validateToolArguments(toolDefinition, request.arguments);
  return request;
}

function buildProviderToolNameMap(toolDefinitions) {
  const nameMap = {};
  const collisions = [];

  for (const toolDefinition of toolDefinitions) {
    validateToolDefinition(toolDefinition);
    const providerName = toProviderToolName(toolDefinition.name);
    if (!providerName) {
      throw new Error(`Tool ${toolDefinition.name} has an empty provider-visible name.`);
    }
    if (nameMap[providerName] && nameMap[providerName] !== toolDefinition.name) {
      collisions.push(`${providerName}: ${nameMap[providerName]} / ${toolDefinition.name}`);
    }
    nameMap[providerName] = toolDefinition.name;
  }

  if (collisions.length) {
    throw new Error(`Provider-visible tool name collision: ${collisions.join("; ")}`);
  }

  return nameMap;
}

function toOpenAiChatFunctionTool(toolDefinition) {
  validateToolDefinition(toolDefinition);
  return {
    type: "function",
    function: {
      name: toProviderToolName(toolDefinition.name),
      description: toolDefinition.description,
      strict: true,
      parameters: cloneJson(toolDefinition.inputSchema)
    }
  };
}

function toAnthropicToolDefinition(toolDefinition) {
  validateToolDefinition(toolDefinition);
  return {
    name: toProviderToolName(toolDefinition.name),
    description: toolDefinition.description,
    input_schema: cloneJson(toolDefinition.inputSchema)
  };
}

function createVisibleContextReadToolDefinition() {
  return {
    name: "world.read_visible_context",
    description: "读取当前 actor 已被服务器裁剪过的国家、城市、人物、官职、事件与情报摘要；不得返回 raw table、hidden ledger、完整 prompt、本地路径或密钥。",
    inputSchema: {
      type: "object",
      required: ["domains", "query", "maxItems"],
      additionalProperties: false,
      properties: {
        domains: {
          type: "array",
          items: { type: "string", enum: ["geography", "people", "office", "events", "intel", "study", "exam"] }
        },
        query: { type: "string", description: "玩家行动或 actor 目标的短查询。" },
        maxItems: { type: "integer", minimum: 1, maximum: 12 }
      }
    },
    permission: {
      toolType: "read",
      authorityTiers: ["T1", "T2", "T3", "T4", "T5", "T6"],
      actorTypes: ["scholar", "teacher", "magistrate", "minister", "general", "emperor", "system_engine"],
      toolGroups: ["world_read"],
      readScope: ["server_route_views", "prompt_retrieval_summary"],
      proposalScope: [],
      visibilityBoundary: "只读 actor 可见 projection；不得读取 raw SQLite、raw audit、provider proposal 或 hidden 私档。",
      forbiddenScopes: ["sql", "raw_table", "raw_world_state_patch", "raw_audit", "hidden_notes", "provider_config", "local_path"],
      requiresJurisdiction: false,
      requiresEvidence: false
    },
    resolver: {
      kind: "read_view",
      name: "server.read_visible_context",
      serverOwned: true,
      appliesState: false,
      writesStorage: false,
      transactionBoundary: "none"
    },
    audit: {
      eventType: "ai_tool_read_visible_context",
      summaryFields: ["actorRef.actorId", "domains", "query", "maxItems"],
      redactFields: ["rawPrompt", "providerConfig", "localPath", "hiddenNotes"],
      recordRejected: true,
      publicProjection: "tool name, actor label, selected domains, item count"
    },
    cooldown: {
      scope: "scene",
      turns: 0,
      cooldownKeyFields: ["actorRef.actorId", "domains"]
    },
    mockFallback: {
      mode: "deterministic",
      fixtureId: "visible_context_minimal",
      publicSummary: "Mock 模式返回固定的安全可见摘要。"
    },
    riskTags: ["read_scope", "hidden_redaction"],
    providerCompatibility: {
      openAiChat: "needs_probe",
      anthropic: "needs_probe",
      mcp: "compatible",
      notes: "S70.1 smoke 先固定 MiMo/OpenAI-compatible chat completions 的实际 tool_calls 形状。"
    }
  };
}

const MIMO_TOOL_SMOKE_CASES = Object.freeze([
  {
    id: "forced_tool",
    description: "强制调用一个 read 工具，确认 tool_choice 和 tool_calls 返回形状。"
  },
  {
    id: "single_tool",
    description: "自动选择一个工具，确认模型不会把工具参数写成普通文本。"
  },
  {
    id: "multi_tool",
    description: "提供多个工具，观察 MiMo 是否会一次返回多个 tool_calls。"
  },
  {
    id: "tool_result_roundtrip",
    description: "把服务器工具结果回填给模型，确认下一轮能产出可读总结。"
  },
  {
    id: "streaming",
    description: "可选流式探针，确认 streaming delta 中的工具调用形状。"
  },
  {
    id: "schema_failure",
    description: "本地拒绝非 strict input schema；真实 provider 失败形状后续记录为兼容矩阵。"
  }
]);

module.exports = {
  MIMO_TOOL_SMOKE_CASES,
  TOOL_RESULT_STATUSES,
  TOOL_SCHEMAS,
  TOOL_TYPES,
  assertStrictInputSchema,
  buildProviderToolNameMap,
  createVisibleContextReadToolDefinition,
  getToolSchema,
  toAnthropicToolDefinition,
  toOpenAiChatFunctionTool,
  toProviderToolName,
  validateRequestAdjudication,
  validateToolArguments,
  validateToolDefinition,
  validateToolPayload,
  validateToolProposal
};
