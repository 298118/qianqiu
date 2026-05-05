# Relationship Ledger Contract

S22.1 adds the first server-owned NPC and faction relationship ledger. The goal is to record social memory without letting model output rewrite hidden state directly.

## State Shape

`worldState.relationshipLedger` has this shape:

```json
{
  "characters": {
    "C01": {
      "id": "C01",
      "name": "display name",
      "role": "social role",
      "stance": "mentor",
      "relationship": 12,
      "resentment": 0,
      "networkSource": "county_school",
      "recentIntent": "Test the player's diligence and recommend steady study.",
      "visible": true,
      "lastUpdatedTurn": 0
    }
  },
  "factions": {
    "scholarOfficials": {
      "id": "scholarOfficials",
      "name": "Scholar-official faction",
      "stance": "orthodox_bureaucracy",
      "relationship": 8,
      "resentment": 3,
      "networkSource": "examination_and_memorial_network",
      "recentIntent": "Reward classical legitimacy and watch for factional recklessness.",
      "visible": true,
      "lastUpdatedTurn": 0
    }
  },
  "recentNotes": []
}
```

Numeric ranges:

- `relationship`: `-100..100`, where positive values mean trust or useful ties and negative values mean hostility.
- `resentment`: `0..100`, where higher values mean stored grievance or risk of retaliation.

Text fields are capped to short strings before persistence.

## Ownership

- `src/game/relationships.js` owns creation, normalization, legacy backfill, and compact summaries.
- `createInitialState()` creates the ledger from current `characters` and numeric `factions`.
- Game and exam routes call `ensureRelationshipLedger()` after reading older sessions so legacy saves can continue.
- The ledger only creates entries for existing character ids and existing numeric faction keys. Invented ledger ids are dropped during normalization.

## Provider Boundary

S22.1 deliberately does not add `relationshipLedger` to the provider `statePatch` contract.

- `src/ai/schemas.js` still rejects model attempts to patch `relationshipLedger`.
- `src/game/stateRules.js` still ignores `relationshipLedger` if a provider output includes it anyway.
- S22.2 should add a controlled relationship-change suggestion path, with the server owning final merge, clamping, visibility, and persistence.

## Next Work

S22.2 should expose compact relationship context in prompts and define a server-owned merge path for relationship suggestions. S22.3 should make Mock turns produce visible NPC/faction reactions.
