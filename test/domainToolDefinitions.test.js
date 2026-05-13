const test = require("node:test");
const assert = require("node:assert/strict");

const { createDomainToolDefinitions } = require("../src/ai/domainToolDefinitions");
const { createGameAiToolRegistry } = require("../src/ai/gameAiTools");
const { validateToolDefinition } = require("../src/ai/toolSchemas");
const { CITY_POLICY_ACTIONS } = require("../src/game/cityPolicyResolverConfig");
const { JUDICIAL_CASE_ACTIONS } = require("../src/game/judicialCaseConfig");
const {
  DIPLOMACY_MOVE_ACTIONS,
  MILITARY_ORDER_ACTIONS
} = require("../src/game/militaryDiplomacyResolverConfig");

const EXPECTED_DOMAIN_TOOLS = [
  "judicial.propose_case_resolution",
  "city.propose_policy",
  "military.propose_order",
  "diplomacy.propose_move",
  "exam.request_ranking_adjudication",
  "office.request_appointment_adjudication",
  "career.propose_reward_or_promotion",
  "career.request_discipline_adjudication"
];

test("S70.7 domain tool definitions are strict, server-owned and default registry-visible", () => {
  const definitions = createDomainToolDefinitions();
  const names = definitions.map((definition) => definition.name);

  assert.deepEqual(names, EXPECTED_DOMAIN_TOOLS);
  for (const definition of definitions) {
    assert.equal(validateToolDefinition(definition), definition);
    assert.equal(definition.inputSchema.additionalProperties, false);
    assert.deepEqual(
      [...definition.inputSchema.required].sort(),
      Object.keys(definition.inputSchema.properties).sort()
    );
    assert.equal(definition.inputSchema.properties.privateResultRefs.maxItems, 0);
    assert.equal(definition.resolver.serverOwned, true);
    assert.equal(definition.resolver.appliesState, false);
    assert.equal(definition.resolver.writesStorage, false);
    assert.equal(definition.permission.requiresEvidence, true);
    assert.equal(definition.permission.forbiddenScopes.includes("raw_table"), true);
    assert.equal(definition.permission.forbiddenScopes.includes("server_resolver"), true);
  }

  const registry = createGameAiToolRegistry();
  for (const name of EXPECTED_DOMAIN_TOOLS) {
    assert.ok(registry.getTool(name), `默认 registry 缺少 ${name}`);
  }
  const cityTool = registry.getTool("city.propose_policy");
  assert.deepEqual(
    [...cityTool.inputSchema.properties.policyKind.enum].sort(),
    Object.keys(CITY_POLICY_ACTIONS).sort()
  );
  const judicialTool = registry.getTool("judicial.propose_case_resolution");
  assert.deepEqual(
    [...judicialTool.inputSchema.properties.caseAction.enum].sort(),
    Object.keys(JUDICIAL_CASE_ACTIONS).sort()
  );
  const militaryTool = registry.getTool("military.propose_order");
  assert.deepEqual(
    [...militaryTool.inputSchema.properties.orderKind.enum].sort(),
    Object.keys(MILITARY_ORDER_ACTIONS).sort()
  );
  const diplomacyTool = registry.getTool("diplomacy.propose_move");
  assert.deepEqual(
    [...diplomacyTool.inputSchema.properties.moveKind.enum].sort(),
    Object.keys(DIPLOMACY_MOVE_ACTIONS).sort()
  );
  assert.equal(Object.keys(registry.buildProviderNameMap()).length, registry.listAllTools().length);
});

test("S70.7 request-adjudication tools use adjudication resolver labels without exposing server tools", () => {
  const definitions = createDomainToolDefinitions();
  const requestTools = definitions.filter((definition) => definition.permission.toolType === "request_adjudication");

  assert.deepEqual(requestTools.map((definition) => definition.name), [
    "exam.request_ranking_adjudication",
    "office.request_appointment_adjudication",
    "career.request_discipline_adjudication"
  ]);
  for (const definition of requestTools) {
    assert.equal(definition.resolver.name, "server.request_domain_tool_adjudication");
    assert.equal(definition.resolver.kind, "adjudication_resolver");
    assert.equal(definition.name.startsWith("server."), false);
  }
});
