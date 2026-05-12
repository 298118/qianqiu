const {
  buildProviderToolNameMap,
  createVisibleContextReadToolDefinition,
  validateToolDefinition
} = require("./toolSchemas");
const { createEventToolDefinitions } = require("./eventToolDefinitions");
const { filterActorTools } = require("../game/aiActorProfiles");

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeToolName(name) {
  return String(name || "").trim();
}

function createBaseGameAiToolDefinitions() {
  return [
    createVisibleContextReadToolDefinition(),
    ...createEventToolDefinitions()
  ];
}

function createGameAiToolRegistry(initialTools = createBaseGameAiToolDefinitions()) {
  const toolsByName = new Map();

  function registerGameAiTool(toolDefinition, options = {}) {
    validateToolDefinition(toolDefinition);
    const name = normalizeToolName(toolDefinition.name);
    if (!options.replace && toolsByName.has(name)) {
      throw new Error(`AI game tool already registered: ${name}`);
    }
    toolsByName.set(name, cloneJson(toolDefinition));
    return getTool(name);
  }

  function getTool(name) {
    const tool = toolsByName.get(normalizeToolName(name));
    return tool ? cloneJson(tool) : null;
  }

  function listAllTools() {
    return [...toolsByName.values()].map(cloneJson);
  }

  function listToolsForActor(actorProfile, options = {}) {
    return filterActorTools(actorProfile, listAllTools(), options).map(cloneJson);
  }

  function buildProviderNameMap() {
    return buildProviderToolNameMap(listAllTools());
  }

  for (const toolDefinition of initialTools || []) {
    registerGameAiTool(toolDefinition);
  }

  return {
    registerGameAiTool,
    getTool,
    listAllTools,
    listToolsForActor,
    buildProviderNameMap
  };
}

function registerGameAiTool(registry, toolDefinition, options = {}) {
  if (!registry || typeof registry.registerGameAiTool !== "function") {
    throw new Error("A game AI tool registry is required.");
  }
  return registry.registerGameAiTool(toolDefinition, options);
}

function listToolsForActor(actorProfile, toolRegistry, options = {}) {
  if (toolRegistry && typeof toolRegistry.listToolsForActor === "function") {
    return toolRegistry.listToolsForActor(actorProfile, options);
  }
  return filterActorTools(actorProfile, toolRegistry, options);
}

module.exports = {
  createBaseGameAiToolDefinitions,
  createGameAiToolRegistry,
  listToolsForActor,
  registerGameAiTool
};
