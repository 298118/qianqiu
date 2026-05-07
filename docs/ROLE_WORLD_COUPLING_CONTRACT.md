# Role / World Coupling Contract

S36 adds a server-owned role/world coupling step. Its job is to turn important role actions into durable world pressure before the world tick and any month-end long-term scheduler run.

## Ownership

- Persisted state lives at `worldState.roleWorldCoupling`.
- Implementation lives in `src/game/roleWorldCoupling.js`.
- Providers may read the compact prompt summary, but ordinary turns cannot patch `roleWorldCoupling`.
- The route applies coupling patches with:

```js
applyStatePatch(worldState, roleWorldCoupling.statePatch, {
  incrementTurnCount: false,
  allowServerOwnedPatchKeys: true
});
```

This preserves the rule that a player turn increments `turnCount` exactly once.

## Persisted State

```js
{
  schemaVersion: 1,
  recentImpacts: [
    {
      id: "RWC-0001-magistrate_waterworks",
      kind: "magistrate_waterworks",
      role: "magistrate",
      title: "水利入田",
      summary: "地方水利把县政成效转成粮储、民心与士绅观感。",
      year: 1644,
      month: 2,
      tenDayPeriod: 1,
      turn: 1,
      affectedPaths: ["grainReserve", "publicOrder"]
    }
  ],
  cooldowns: {
    magistrate_waterworks: 7
  },
  cooldownUnit: "ten_day"
}
```

`recentImpacts` is capped to the latest 8 records. S48.5 records the ten-day period so multiple impacts in the same month remain distinguishable. `cooldowns` are absolute turn numbers with `cooldownUnit: "ten_day"` and are derived from a short month-based guard (`monthsToTurns(2)` in the current implementation), so repeated large role/world effects are suppressed for about two months without treating one turn as one month. Missing legacy `cooldownUnit` is normalized as pre-S48 one-turn-one-month data and converted once into ten-day turns.

## Turn Order

`POST /api/game/turn` resolves one successful turn in this order:

1. Provider `statePatch`.
2. Provider `relationshipChanges`.
3. Exam trigger setup.
4. Active NPC request handling.
5. Role/world coupling.
6. `worldTick` ten-day advancement; full monthly settlement only on 下旬 rollover.
7. Long-term event scheduler only on month end.
8. Official career settlement.
9. Event append, session save, and response rendering.

S36 deliberately runs before `worldTick` so actions such as waterworks, campaigns, appointments, and impeachment can affect the same ten-day feedback and, on 下旬 rollover, that month-end natural drift and long-term-event scheduling.

## Implemented Coupling Kinds

- `magistrate_waterworks`: local waterworks improve grain reserve, population stability, public order, local order, waterworks, reputation, and scholar-official confidence, with a small corvee burden cost.
- `general_campaign`: campaign action spends treasury and grain, changes army morale, reduces border threat, changes campaign risk and battle reputation, and strengthens military-faction attention.
- `emperor_appointments`: imperial personnel cleanup reduces corruption, strengthens court control and mandate, raises scholar-official confidence, and angers eunuch networks.
- `minister_impeachment`: ministerial impeachment turns court speech into corruption pressure and faction consequences; clean cases reduce corruption while still disturbing public order.

The module is deterministic and intentionally compact. Later steps can add more kinds without changing provider authority.

## Route Payloads

Game and exam payloads include top-level `roleWorldCouplingView`.

Turn payloads additionally include:

```js
roleWorldCoupling: {
  summary: "string",
  events: ["string"],
  attributeChanges: [],
  outcome: null || {
    id: "string",
    kind: "string",
    role: "string",
    title: "string",
    summary: "string",
    year: 1644,
    month: 2,
    turn: 1,
    affectedPaths: []
  }
}
```

SSE `state_preview` and `final_state` include the same fields.

## Browser Contract

The browser does not add another persistent panel in S36. It renders coupling feedback as narrative entries:

```html
<p class="narrative-entry role-world-event" data-role-world-kind="magistrate_waterworks">
  [联动] ...
</p>
```

Existing status, role, relationship, long-term event, and official-career panels continue to show the resulting state changes.

## Verification

Focused coverage:

- `test/roleWorldCoupling.test.js`
- `test/gameTurnRoleWorldCoupling.test.js`
- `test/stateRules.test.js`
- `test/aiSchemas.test.js`
- `test/aiEvalFixtures.test.js`
- `test/browserSmokeScript.test.js`

Browser smoke now includes direct-start representative S36 journeys for magistrate, general, emperor, and minister roles, each checking a role-world feedback kind and an API state metric delta.
