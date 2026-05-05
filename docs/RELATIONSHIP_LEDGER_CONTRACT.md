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

Providers still must not write `relationshipLedger` through `statePatch`.

- `src/ai/schemas.js` rejects model attempts to patch `relationshipLedger`.
- `src/game/stateRules.js` ignores `relationshipLedger` if a non-schema provider output includes it anyway.

S22.2 adds a controlled top-level `relationshipChanges` suggestion path to the turn schema:

```json
{
  "relationshipChanges": [
    {
      "targetType": "character",
      "targetId": "C01",
      "relationshipDelta": 3,
      "resentmentDelta": -1,
      "stance": "trusted mentor",
      "recentIntent": "Recommend cautious study.",
      "reason": "The player paid a respectful teacher visit."
    }
  ]
}
```

Server merge rules:

- Suggestions are deltas, not absolute ledger replacements.
- `targetType` must be `character` or `faction`.
- `targetId` must already exist in the current normalized ledger.
- Provider suggestions can only affect visible entries; hidden entries stay server-owned.
- At most five suggestions are processed per turn.
- `relationshipDelta` is clamped to `-12..12`; `resentmentDelta` is clamped to `-10..10`.
- Optional `stance`, `recentIntent`, and note text are length-capped before persistence.
- `lastUpdatedTurn` is written by the server after the ordinary turn patch increments `turnCount`.
- The route returns the normalized applied changes as `relationshipChanges` in JSON and SSE final payloads.

`src/ai/prompts.js` includes a compact visible-only relationship summary in turn prompt context so real providers can suggest consequences without seeing hidden ledger entries.

## Next Work

S22.3 should make Mock turns produce visible NPC/faction reactions through this suggestion path.
