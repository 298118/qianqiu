const NPC_MIND_SCHEMA_VERSION = 1;

const NPC_MIND_LIMITS = Object.freeze({
  maxLlmNpcPerTenDay: 3,
  maxBackgroundNpcPerTenDay: 8,
  maxPromptContextItems: 8,
  maxProposalEvents: 3,
  maxMemoryCandidates: 4,
  maxTextLength: 160,
  salienceCooldownTurns: 2
});

const NPC_MIND_SCORE_WEIGHTS = Object.freeze({
  relationship: 0.32,
  resentment: 0.28,
  influence: 0.16,
  activeRequest: 0.14,
  recentTurn: 0.1
});

const NPC_MIND_PROPOSAL_TYPES = Object.freeze([
  "request",
  "assist",
  "obstruct",
  "warn",
  "memory"
]);

module.exports = {
  NPC_MIND_LIMITS,
  NPC_MIND_PROPOSAL_TYPES,
  NPC_MIND_SCHEMA_VERSION,
  NPC_MIND_SCORE_WEIGHTS
};
