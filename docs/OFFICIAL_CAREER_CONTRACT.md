# Official Career Outcome Contract

S34 defines the server-owned official career outcome engine. It turns the post-palace official loop from meter movement into concrete career results: appointment, transfer, promotion, external posting, demotion, impeachment case, punishment, or retention.

## Authority Boundary

Ordinary AI/provider turns may still update bounded official career meters through `statePatch.player`:

- `superiorFavor`
- `peerNetwork`
- `performanceMerit`
- `promotionProspect`
- `impeachmentRisk`
- `cleanReputation`
- other already-whitelisted non-title player/world meters

Providers must not directly write:

- `worldState.officialCareer`
- `player.role`
- `player.roleLabel`
- `player.officeTitle`
- `player.examRank`
- `player.palaceRank`
- `player.examHistory`

The route applies ordinary provider patches through the provider-facing whitelist. The official outcome engine then runs as a server follow-up and applies title/role/career-history changes with `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }`.

## Persisted State

`worldState.officialCareer` is server-owned:

```json
{
  "schemaVersion": 1,
  "tenureMonths": 0,
  "reviewCycleMonths": 12,
  "lastReviewTurn": null,
  "lastReviewYear": null,
  "currentPosting": "未授",
  "careerHistory": [],
  "pendingOutcome": null,
  "cooldowns": {}
}
```

`careerHistory` is capped to the latest 8 records. Each resolved record contains:

- `id`
- `type`
- `label`
- `status`
- `year`
- `month`
- `turn`
- `officeTitleBefore`
- `officeTitleAfter`
- `reason`

Supported `type` values are `appointment`, `transfer`, `promotion`, `outpost`, `demotion`, `impeachment`, `punishment`, and `retention`.

## Route Order

`POST /api/game/turn` now resolves in this order:

1. Provider turn output.
2. Provider-facing `applyStatePatch()`.
3. Provider relationship suggestions through `applyRelationshipChanges()`.
4. Exam trigger setup.
5. Active NPC request handling.
6. Monthly world tick.
7. Long-term event scheduler.
8. Official career outcome engine.
9. Event history append in provider -> active request -> world tick -> long-term event -> official career order.
10. Session persistence.

Game and exam routes return top-level `officialCareerView`. Turn routes also return `officialCareer: { summary, events, attributeChanges, outcome }`.

SSE `state_preview` and `final_state` include the same official career fields. Browser UI renders turn feedback as `[官场结算]` narrative lines.

## Settlement Rules

The engine runs only while `player.role === "official"`.

It increments `officialCareer.tenureMonths` by one per successful official turn. It may settle when:

- the player has no `officeTitle`, causing first real appointment;
- impeachment risk is severe enough for immediate review;
- promotion momentum, merit, and superior favor are high enough for accelerated review;
- the review cycle reaches 12 official months;
- the post-tick calendar reaches a new year and the current year has not been reviewed.

Inputs include official meters, public corruption, and visible relationship ledger scores for the superior/contact and scholar-official faction. The model can influence these inputs, but the server chooses the actual career result.

## Outcomes

- `appointment`: grants a first concrete office such as `六部观政进士`.
- `promotion`: advances the official posting ladder and resets part of promotion momentum.
- `transfer`: moves to another central office without a full rank rise.
- `outpost`: sends the player to an external/local post while keeping the broad official role.
- `demotion`: lowers title/influence after poor merit or favor.
- `impeachment`: marks a formal impeachment case and sharply reduces promotion prospects.
- `punishment`: severe scandal can remove the player from office and return role display to `书生`.
- `retention`: records a review with no title change.

Relationship consequences are returned as bounded suggestions and merged through `applyRelationshipChanges()`. The official engine does not mutate the raw relationship ledger directly.

## Browser Contract

The browser consumes `officialCareerView`, not raw provider text. It renders `#official-career-panel` only when the player is an official. Stable selectors include:

- `#official-career-panel`
- `.official-career-current`
- `.official-career-history`
- `.official-career-outcome`
- `data-outcome-id`
- `data-outcome-type`
- `data-outcome-status`
- `data-office-title`
- `data-outcome-turn`

Browser smoke checks direct official start, deterministic first appointment, official career panel fields, current-outcome marking, screenshot capture, and horizontal overflow.

## Verification

Focused coverage:

- `test/officialCareer.test.js`
- `test/gameTurnOfficialCareer.test.js`
- `test/officialRole.test.js`
- `test/browserSmokeScript.test.js`

Full S34 verification should include:

```powershell
node --check src\game\officialCareer.js
node --check src\routes\game.js
node --check src\routes\exam.js
node --check public\app.js
node --check scripts\browserSmoke.js
node --test test\officialCareer.test.js test\gameTurnOfficialCareer.test.js test\officialRole.test.js
npm test
npm run smoke:browser -- --screenshots artifacts/browser-smoke/s34
git diff --check
```
