import type { AiProviderName, AiTaskType, JsonObject, JsonValue } from "./serverContracts";

const AI_PROVIDER_NAMES = new Set<AiProviderName>([
  "mock",
  "openai",
  "deepseek",
  "mimo",
  "mimo-deepseek",
  "anthropic"
]);

const AI_TASK_TYPES = new Set<AiTaskType>([
  "narrator",
  "actor_mind",
  "planner",
  "domain_specialist",
  "critic",
  "safety_gate",
  "memory_summarizer",
  "monthly_briefing",
  "time_skip_planner",
  "quick_action",
  "topic_draft",
  "background_claim_parser",
  "npc_dialogue",
  "npc_private_planner",
  "trade_negotiator",
  "delegated_task_planner",
  "delegated_task_reporter",
  "inventory_effect_explainer"
]);

export function isJsonObject(value: JsonValue | unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isAiProviderName(value: unknown): value is AiProviderName {
  return typeof value === "string" && AI_PROVIDER_NAMES.has(value as AiProviderName);
}

export function isAiTaskType(value: unknown): value is AiTaskType {
  return typeof value === "string" && AI_TASK_TYPES.has(value as AiTaskType);
}

export function sanitizeContractId(value: unknown, fallback = ""): string {
  const text = String(value ?? "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_.:-]/g, "")
    .slice(0, 120);
  return text || fallback;
}
