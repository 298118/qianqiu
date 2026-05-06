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

## Relationship Inspection View

S32.1 adds a player-facing inspection contract through `buildRelationshipInspectionView(worldState)`.
This is a presentation view, not the persisted ledger. It normalizes the current ledger, filters out hidden entries, and returns only the fields the browser contact panel should consume.

Game and exam route payloads now include top-level `relationshipView` beside `worldState`:

```json
{
  "relationshipView": {
    "schemaVersion": 1,
    "generatedAtTurn": 3,
    "contacts": [
      {
        "type": "character",
        "id": "C01",
        "name": "display name",
        "role": "teacher",
        "stance": "trusted mentor",
        "relationship": 24,
        "relationshipLabel": "friendly",
        "resentment": 0,
        "resentmentLabel": "quiet",
        "networkSource": "county_school",
        "recentIntent": "Recommend cautious study.",
        "lastUpdatedTurn": 3
      }
    ],
    "factions": [
      {
        "type": "faction",
        "id": "scholarOfficials",
        "name": "Scholar-official faction",
        "stance": "orthodox_bureaucracy",
        "relationship": 8,
        "relationshipLabel": "neutral",
        "resentment": 3,
        "resentmentLabel": "quiet",
        "networkSource": "examination_and_memorial_network",
        "recentIntent": "Reward classical legitimacy.",
        "lastUpdatedTurn": 0
      }
    ],
    "recentNotes": [],
    "hiddenNotice": "Some relationships remain outside the player's current knowledge."
  }
}
```

Inspection rules:

- `contacts` contains only visible character ledger entries.
- `factions` contains only visible faction ledger entries.
- Hidden entries do not create placeholder rows, ids, names, exact counts, faction labels, or notes.
- The raw `visible` boolean is not part of the inspection entry. Visibility is an input to filtering, not a field the panel should display.
- `relationshipLabel` and `resentmentLabel` are derived from clamped numeric values so the UI can display readable bands without inventing its own thresholds.
- `recentNotes` is filtered to notes that begin with a currently visible entry name. Notes that could belong to hidden entries are omitted until the note store becomes target-keyed.
- `hiddenNotice` is generic and contains no target-specific information. It is empty when every normalized ledger entry is visible.

The S32.2 browser implementation renders `relationshipView` in the scholar/role panel as the player-facing `人脉簿`; it should not read raw `worldState.relationshipLedger` for normal UI.
The raw ledger remains in saved session state and in current local route `worldState` payloads for compatibility with existing tests and developer inspection, but player-facing UI code should treat `relationshipView` as the supported contract.

## Mock Reactions

S22.3 makes Mock turns produce visible NPC/faction reactions through the same suggestion path:

- `src/ai/providers/mock.js` classifies the resolved Mock action from its own `statePatch` and `examTrigger`, then builds top-level `relationshipChanges`.
- Scholar actions can affect the visible mentor character and the scholar-official faction; hidden factions such as eunuchs remain hidden from scholar-mode Mock suggestions.
- Emperor, minister, general, magistrate, and official actions can affect visible court, military, or local factions according to the action type, including relief, taxation, appointments, military work, memorials, networking, recruitment, supply work, drilling, scouting, fortification, campaign action, county casework, money/grain pressure, gentry mediation, anti-bandit policing, waterworks, welfare, and bribery.
- Mock still does not mutate `relationshipLedger` directly. The game route applies these suggestions through `applyRelationshipChanges()` after the ordinary turn patch increments `turnCount`.
- The browser appends concise `[人脉]` feedback lines for applied changes, while the canonical persisted memory remains `worldState.relationshipLedger`.
