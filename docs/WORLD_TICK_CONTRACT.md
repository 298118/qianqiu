# World Tick Contract

This document records the S21.1 contract for the phase-two world simulation loop. It is the handoff target for S21.2-S21.4 implementation.

## Goal

The world tick makes Qianqiu feel like a historical simulation that keeps moving even when the player acts locally. It must remain server-owned: providers may narrate and suggest player-action patches, but the server computes time, resource drift, systemic pressure, event history, and final state boundaries.

## Scope

S21 keeps the first implementation deliberately small:

- A tick runs after one successful `POST /api/game/turn` action.
- `POST /api/game/start`, `GET /api/game/state/:sessionId`, `POST /api/exam/question`, and `POST /api/exam/submit` do not run the minimal tick yet.
- The tick advances calendar time by one in-game month per valid free-text turn.
- One player turn increments `worldState.turnCount` exactly once, even when provider changes and tick changes both apply.
- The complete scholar path remains protected: scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official.

Later phase-two work may decide whether long exam submissions or role-specific projects should consume extra months, but that is outside the minimal S21 contract.

## S48 Time Specialty Addendum

S48 changes the long-term target from one ordinary turn per month to one ordinary turn per ten-day period, but the conversion is staged:

- S48.2 adds `src/game/time.js` and `worldState.tenDayPeriod` as server-owned calendar foundations. `1` means 上旬, `2` means 中旬, and `3` means 下旬.
- Initial sessions start at 正月上旬. Legacy saves that lack `tenDayPeriod` are normalized to 上旬 when read; the storage envelope version is not bumped.
- Save-list metadata, prompt compact state, provider long-run consistency checks, schemas, remote normalization and `applyStatePatch()` all treat `tenDayPeriod` like `turnCount/year/month`: provider suggestions cannot write it.
- S48.2 deliberately keeps `runWorldTick()` on the old monthly cadence. S48.3 will make ordinary turns advance 上旬 -> 中旬 -> 下旬 -> 下月上旬 and will restrict full monthly settlement to 下旬 rollover.

## State Additions

S21.2 should add:

- `worldState.month`: integer 1-12, default `1`.
- S48.2 later adds `worldState.tenDayPeriod`: integer 1-3, default `1` for 上旬.

The tick rolls `month` from 12 to 1 and increments `year` by 1 on rollover. `year` remains the coarse historical display field already used by prompts and UI.

## Natural Changes

The minimal tick may adjust only these top-level fields:

- `year`
- `month`
- `treasury`
- `grainReserve`
- `population`
- `publicOrder`
- `corruption`
- `armyMorale`
- `borderThreat`
- existing numeric `factions` keys
- `eventHistory` through appended events

The tick must not modify `player.examRank`, `player.role`, `activeExam`, `player.examHistory`, promotion fields, provider configuration, or session identity. It may read `player.role`, `player.integrity`, and recent events as inputs, but it should not make exam progression harder by silently draining scholar attributes, gold, or health in the minimal slice.

## Simulation Rules

The first implementation should favor deterministic, explainable formulas over randomness:

- Treasury rises with population and tax rate, then falls with army upkeep and corruption leakage.
- Grain reserve rises around harvest months and falls with population consumption.
- Public order drifts down under high tax, corruption, border threat, or grain shortage, and drifts up when grain and order are stable.
- Corruption drifts up slowly when public order is low or the treasury is large, and may drift down when player integrity is high in governing roles.
- Border threat rises when army morale is low or the army is small relative to population pressure, and falls when morale is strong.
- Faction values may drift by small amounts only for existing factions; no new faction keys may be introduced.

All numeric output must go through the same clamp ranges used by `src/game/stateRules.js`.

## Tick Result Shape

S21.2 should implement a pure module, likely `src/game/worldTick.js`, with a result shaped like:

```js
{
  statePatch: {
    month: 2,
    treasury: 1024,
    grainReserve: 790,
    publicOrder: 69
  },
  attributeChanges: [
    {
      path: "grainReserve",
      label: "粮储",
      before: 800,
      after: 790,
      reason: "月度耗粮"
    }
  ],
  events: [
    "二月，县中粮价微涨，里甲催输渐紧。"
  ],
  summary: "月度推演：粮储略降，民心未乱。"
}
```

`events` are the player-visible world feedback. They should be short, historically toned, and appended after provider events. A normal month should emit at most one event; threshold months may emit two. `eventHistory` remains capped by `MAX_EVENT_HISTORY`.

## Route Integration Contract

S21.3 should preserve this route order:

1. Read session.
2. Ask provider to resolve the player action.
3. Apply provider output through server patch rules.
4. Run the world tick against the updated state.
5. Apply tick output through the same whitelist and clamp rules without incrementing `turnCount` a second time.
6. Append provider events, then tick events.
7. Save session.
8. Return provider narrative plus tick feedback in JSON and SSE final payloads.

If implementation chooses to merge provider and tick patches before applying them, it still must preserve the same effective ordering and a single `turnCount` increment.

## Acceptance

S21.4 should add automated coverage for:

- month/year rollover from month 12 to month 1 with year +1;
- numeric clamps at treasury, grain, public order, corruption, morale, and border-threat boundaries;
- event history trimming when provider and tick events are both appended;
- deterministic Mock-mode stability for repeated turns;
- the complete scholar -> official path after tick integration.

Manual acceptance should confirm that a player sees concise world feedback without the tick drowning out the provider narrative.
