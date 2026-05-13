const ACTOR_MEMORY_SCHEMA_VERSION = 1;

const ACTOR_MEMORY_TYPES = Object.freeze({
  fact: Object.freeze({
    label: "事实",
    defaultSalience: 52,
    decayPerMonth: 2
  }),
  impression: Object.freeze({
    label: "印象",
    defaultSalience: 48,
    decayPerMonth: 3
  }),
  favor: Object.freeze({
    label: "人情",
    defaultSalience: 68,
    decayPerMonth: 1
  }),
  grievance: Object.freeze({
    label: "怨怼",
    defaultSalience: 72,
    decayPerMonth: 1
  }),
  obligation: Object.freeze({
    label: "债约",
    defaultSalience: 70,
    decayPerMonth: 1
  }),
  current_goal: Object.freeze({
    label: "目标",
    defaultSalience: 62,
    decayPerMonth: 2
  }),
  family_risk: Object.freeze({
    label: "家族风险",
    defaultSalience: 64,
    decayPerMonth: 2
  }),
  fear: Object.freeze({
    label: "畏惧",
    defaultSalience: 60,
    decayPerMonth: 2
  }),
  ambition: Object.freeze({
    label: "野心",
    defaultSalience: 60,
    decayPerMonth: 2
  }),
  exam_network: Object.freeze({
    label: "科场人脉",
    defaultSalience: 66,
    decayPerMonth: 1
  }),
  reward_punishment: Object.freeze({
    label: "赏罚",
    defaultSalience: 70,
    decayPerMonth: 1
  }),
  official: Object.freeze({
    label: "官场",
    defaultSalience: 60,
    decayPerMonth: 2
  }),
  monthly_summary: Object.freeze({
    label: "月度摘要",
    defaultSalience: 56,
    decayPerMonth: 2
  })
});

const ACTOR_MEMORY_VISIBILITIES = Object.freeze([
  "public",
  "player_visible",
  "relationship_visible"
]);

const ACTOR_MEMORY_REJECTED_VISIBILITIES = Object.freeze([
  "actor_private",
  "private",
  "hidden",
  "server_hidden",
  "gm_only"
]);

const ACTOR_MEMORY_SOURCE_TYPES = Object.freeze([
  "ai_memory_proposal",
  "relationship_change",
  "npc_mind",
  "npc_memory_heuristic",
  "scene_runtime",
  "active_request",
  "study_interaction",
  "exam_network",
  "monthly_briefing",
  "session_summary",
  "official_career",
  "server_turn"
]);

const ACTOR_MEMORY_LIMITS = Object.freeze({
  maxActors: 32,
  maxMemoriesPerActor: 10,
  maxRecentUpdates: 16,
  maxPromptActors: 6,
  maxPromptMemoriesPerActor: 4,
  maxViewActors: 12,
  maxViewMemoriesPerActor: 6,
  maxSummaryLength: 160,
  maxSourceLabelLength: 80,
  maxSourceRefs: 5,
  maxTags: 6,
  maxNpcMemoryProposals: 8,
  maxNpcMemoryPerActorPerTurn: 3,
  minNpcMemorySalience: 24,
  minSalience: 5,
  maxSalience: 100,
  minPromptSalience: 12,
  maxConfidence: 1,
  minConfidence: 0
});

const SESSION_SUMMARY_SCHEMA_VERSION = 1;

const SESSION_SUMMARY_LIMITS = Object.freeze({
  maxMonthlySummaries: 12,
  maxHighlights: 6,
  maxPromptSummaries: 4,
  maxViewSummaries: 6,
  maxSummaryLength: 180,
  maxHighlightLength: 120,
  maxSourceRefs: 6
});

module.exports = {
  ACTOR_MEMORY_LIMITS,
  ACTOR_MEMORY_REJECTED_VISIBILITIES,
  ACTOR_MEMORY_SCHEMA_VERSION,
  ACTOR_MEMORY_SOURCE_TYPES,
  ACTOR_MEMORY_TYPES,
  ACTOR_MEMORY_VISIBILITIES,
  SESSION_SUMMARY_LIMITS,
  SESSION_SUMMARY_SCHEMA_VERSION
};
