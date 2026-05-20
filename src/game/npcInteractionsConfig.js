const NPC_INTERACTION_LEDGER_SCHEMA_VERSION = "s83.npc-interactions.v1";

const NPC_INTERACTION_TYPES = Object.freeze([
  "talk",
  "inquire",
  "gift",
  "request",
  "summon",
  "delegate",
  "trade"
]);

const NPC_INTERACTION_CONFIG = Object.freeze({
  maxInteractionRecords: 120,
  maxInteractionViewItems: 30,
  maxTextLength: 220,
  interactionTypes: NPC_INTERACTION_TYPES
});

module.exports = {
  NPC_INTERACTION_CONFIG,
  NPC_INTERACTION_LEDGER_SCHEMA_VERSION,
  NPC_INTERACTION_TYPES
};
