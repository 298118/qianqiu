# Long-Term Event Scheduler Contract

This document records the S33 contract for Qianqiu's server-owned long-term event scheduler.

## Goal

The scheduler turns the monthly world tick into a small historical event almanac. It tracks cross-month pressures such as seasonal harvest audits, disasters, border alarms, court faction conflict, local case chains, and delayed consequences. Providers may see a compact summary for narrative context, but they do not create, replace, resolve, expire, or directly patch scheduler state.

## Persisted State

`worldState.longTermEvents` is server-owned:

```js
{
  schemaVersion: 1,
  queue: [
    {
      schemaVersion: 1,
      id: "LTE-0008-seasonal_harvest_audit",
      key: "seasonal_harvest_audit",
      type: "seasonal",
      status: "active",
      targetType: "world",
      targetId: "",
      title: "秋粮核验",
      summary: "秋粮入簿，地方与户部核报仓储盈亏。",
      severity: 1,
      createdTurn: 8,
      startedYear: 1644,
      startedMonth: 8,
      durationMonths: 1,
      remainingMonths: 1,
      cooldownKey: "seasonal_harvest_audit",
      cooldownTurns: 10,
      visibility: "public"
    }
  ],
  cooldowns: {
    seasonal_harvest_audit: 18
  },
  recentResolved: []
}
```

Rules:

- `queue` is capped at 5 active events.
- `recentResolved` is capped at 8 records.
- Event text is normalized to short player-facing strings.
- Invalid legacy events are dropped during normalization.
- Cooldowns are turn numbers; an event cannot be scheduled again before its cooldown expires.
- Hidden events may exist in state later, but S33.2 only exposes public active events through the view.

## Route Order

`POST /api/game/turn` uses this order:

1. Read and normalize session relationship and long-term event state.
2. Ask provider to resolve the player action.
3. Apply provider state patch through ordinary provider boundaries.
4. Apply provider relationship suggestions through `applyRelationshipChanges()`.
5. Apply exam trigger setup if the provider requested an exam.
6. Run the active NPC request step.
7. Run and apply the monthly world tick.
8. Run the long-term event step against the post-tick calendar and state.
9. Apply long-term event patches through server-owned patch boundaries without incrementing `turnCount`.
10. Apply scheduler-authored relationship suggestions through `applyRelationshipChanges()`.
11. Append provider events, active-request events, world-tick events, then long-term event events.
12. Save and return route payloads.

This means the scheduler reads the month/year after the tick advances them. For example, a turn from month 7 to month 8 can schedule `seasonal_harvest_audit` immediately after the tick.

## Output Contract

Game and exam route payloads include:

- `longTermEventView`: player-facing active/resolved event summary.

Turn payloads also include:

```js
{
  longTermEvents: {
    summary: "秋粮核验：秋粮入簿，地方与户部核报仓储盈亏。",
    events: ["秋粮核验：秋粮入簿，地方与户部核报仓储盈亏。"],
    attributeChanges: [],
    scheduled: [{ key: "seasonal_harvest_audit", title: "秋粮核验" }],
    resolved: []
  }
}
```

The browser appends these events as `[大势]` narrative feedback. S33 does not add a new standalone panel.

## Authority Boundary

The scheduler may produce bounded patches to:

- `treasury`
- `grainReserve`
- `population`
- `publicOrder`
- `corruption`
- `armyMorale`
- `borderThreat`
- existing numeric `factions` keys
- selected role-local numeric fields, such as magistrate local meters, when the event type requires it

The scheduler must not change:

- `sessionId`
- `activeExam`
- `characters`
- `player.examRank`
- `player.examHistory`
- `player.role`
- palace rank or office title
- raw `relationshipLedger`

Social consequences must be emitted as relationship suggestions and applied through `applyRelationshipChanges()`.

## Implemented Event Families

S33.2 ships deterministic first-pass families:

- `seasonal_harvest_audit`: scheduled in month 8, resolves with modest grain/public-order/faction effects.
- `disaster_grain_shortage`: triggered by low grain reserve or very low public order, can create a follow-up relief audit.
- `border_alarm`: triggered by high border threat, costs treasury and increases military pressure.
- `court_faction_strife`: triggered by high corruption or wide faction imbalance.
- `local_case_chain`: triggered for magistrates with high lawsuits or bandit pressure.
- `social_repercussion`: triggered by recent refused or expired active requests.

All event selection is deterministic and priority-ordered so tests can assert behavior without random seeds.

## Verification

Focused coverage lives in:

- `test/longTermEvents.test.js`
- `test/gameTurnLongTermEvents.test.js`
- existing route and state-boundary tests

Recommended commands:

```bash
node --test test/longTermEvents.test.js
node --test test/gameTurnLongTermEvents.test.js
node --test test/gameTurnTick.test.js test/gameTurnRelationships.test.js test/stateRules.test.js
npm test
git diff --check
```
