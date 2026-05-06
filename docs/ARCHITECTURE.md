# Qianqiu Developer Architecture

This document is the short implementation map for developers continuing the phase-one codebase. The longer product and process source of truth remains [docs/QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md).

## Runtime Shape

Qianqiu is intentionally buildless in phase one:

- Backend: Node.js + Express in `server.js`.
- Frontend: plain HTML/CSS/JS in `public/`.
- Storage: local JSON files under `data/sessions/`.
- AI: adapter-based providers behind `src/ai/index.js`.
- Tests: Node.js built-in `node --test`.
- Browser smoke: `playwright-core` driving an installed Chrome/Edge browser through `scripts/browserSmoke.js`.

The app should stay runnable with:

```bash
npm install
npm start
```

Then visit `http://localhost:3000`. Mock mode is the default local path.

## Request Flow

```mermaid
flowchart TD
  Browser["Browser UI: public/app.js"] --> Routes["Express routes"]
  Routes --> Store["sessionStore JSON files"]
  Routes --> Provider["AI provider adapter"]
  Provider --> Schemas["JSON parse + Ajv schema validation"]
  Routes --> Rules["stateRules / exams / promotions / essayChecks"]
  Rules --> Store
  Store --> Browser
```

Important route ownership:

- `src/routes/game.js` creates sessions, reads sessions, and advances free-text turns.
- `src/routes/exam.js` generates saved exam questions and submits essays.
- `src/game/stateRules.js` is the only way provider state patches should be merged.
- `src/game/exams.js` owns exam levels, gates, thresholds and next-exam mapping.
- `src/game/promotions.js` owns rank changes, official promotion and severe-cheating consequences.
- `src/game/essayChecks.js` owns local anti-cheat checks and score penalties.
- `src/game/candidates.js` owns virtual same-field candidates, inspectable candidate essay profiles, and ranking.
- `src/game/examTravel.js` owns server-side exam entry preparation costs, travel events, and funded/shortfall effects.
- `src/game/relationships.js` owns NPC/faction relationship ledger creation, normalization, legacy backfill, compact prompt summaries, and the S32.1/S32.2 player-facing relationship inspection view.
- `src/game/activeRequests.js` owns the S32.3 server-scheduled active NPC/faction request loop. Providers may suggest narrative and relationship consequences, but they do not create, replace, resolve, or expire `worldState.activeNpcRequest`.
- `src/game/longTermEvents.js` owns the S33 server-scheduled long-term event queue for seasonal, disaster, border, court, local case-chain, and cross-month consequence events. Providers may read a compact summary for narrative context, but they do not create, replace, resolve, or expire `worldState.longTermEvents`.

## API Contract

### `GET /api/health`

Returns:

```json
{
  "ok": true,
  "aiProvider": "mock"
}
```

### `POST /api/game/start`

Request fields:

- `dynasty`
- `year`
- `role`
- `playerName`
- `background`
- `customSetting`

As of S31.3, `role` is normalized and validated in `src/game/initialState.js`. Missing or blank role values default to `scholar`; unsupported roles return `400`. The accepted enum is `scholar`, `emperor`, `minister`, `general`, `magistrate`, and `official`, and the browser start form exposes all six values.

Returns `201` with `sessionId`, `worldState`, `relationshipView`, `activeNpcRequestView`, `longTermEventView`, and opening `narrative`.

### `GET /api/game/state/:sessionId`

Reads the JSON session file and returns `sessionId`, `worldState`, the player-facing `relationshipView`, `activeNpcRequestView`, and `longTermEventView`.

### `POST /api/game/turn`

Request:

```json
{
  "sessionId": "uuid",
  "input": "研读《论语》三日"
}
```

Returns SSE when the request includes `Accept: text/event-stream`:

```text
event: state_preview
data: {"sessionId":"uuid","status":"accepted"}

event: narrative_chunk
data: {"text":"..."}

event: state_preview
data: {"sessionId":"uuid","attributeChanges":[],"relationshipChanges":[],"examTrigger":{},"worldTick":{}}

event: final_state
data: {"sessionId":"uuid","narrative":"...","attributeChanges":[],"relationshipChanges":[],"examTrigger":{},"worldTick":{},"worldState":{}}
```

If a provider/session error happens after the stream has opened, the route writes:

```text
event: error
data: {"error":"...","statusCode":500}
```

Requests without SSE negotiation still return plain JSON for tests and compatibility:

```json
{
  "sessionId": "uuid",
  "narrative": "...",
  "attributeChanges": [],
  "relationshipChanges": [],
  "examTrigger": {
    "shouldStart": false,
    "level": null,
    "reason": ""
  },
  "worldTick": {
    "summary": "月度推演：粮储略降，民心暂稳，边患暂稳。",
    "events": ["二月，户部核算钱粮，民间风声暂稳。"],
    "attributeChanges": []
  },
  "relationshipView": {
    "schemaVersion": 1,
    "contacts": [],
    "factions": [],
    "recentNotes": [],
    "hiddenNotice": ""
  },
  "activeNpcRequestView": null,
  "activeNpcRequestEvents": [],
  "longTermEventView": {
    "schemaVersion": 1,
    "activeEvents": [],
    "recentResolved": []
  },
  "longTermEvents": {
    "summary": "",
    "events": [],
    "attributeChanges": [],
    "scheduled": [],
    "resolved": []
  },
  "worldState": {}
}
```

### `POST /api/exam/question`

Request:

```json
{
  "sessionId": "uuid",
  "level": "child_exam"
}
```

`level` may be omitted; the server derives the next eligible exam from `player.examRank`. The route saves a complete `worldState.activeExam`, reuses an existing unanswered exam for the same level, and rejects attempts to open a different exam while another question is active.

Returns `examId`, exam metadata, requirements, readiness, `relationshipView`, `activeNpcRequestView`, `longTermEventView`, and `worldState`.

### `POST /api/exam/submit`

Request:

```json
{
  "sessionId": "uuid",
  "examId": "child_exam-uuid",
  "essay": "..."
}
```

The server checks authenticity, asks the provider for grading, applies local penalties, builds virtual candidates with inspectable essay profiles, applies promotion or cheating consequences, appends the essay result to `player.examHistory`, clears `activeExam`, saves the session and returns the result plus `relationshipView`, `activeNpcRequestView`, `longTermEventView`, and `worldState`. The response includes `examQuestion`, `essay`, and `entryPreparation` so the browser can render the just-submitted archive directly.

## AI Provider Contract

Providers expose four methods:

- `startGame(worldState)`
- `runTurn(worldState, input)`
- optional `streamTurn(worldState, input, { onTextDelta })` for real-provider turn token streaming
- `generateExamQuestion(worldState, exam)`
- `gradeExamEssay(worldState, exam, essay, authenticityCheck)`

Provider outputs must match the schemas in `src/ai/schemas.js`:

- `opening`: `{ narrative, events }`
- `turn`: `{ narrative, statePatch, attributeChanges, relationshipChanges, events, examTrigger }`
- `examQuestion`: exam level, name, question, type, difficulty, requirements, word count, pass score and promotion rank
- `grade`: five score dimensions, `overall_score`, rank, detailed feedback, authenticity echo, candidates and ranking placeholders

Real provider adapters parse model text through `src/utils/json.js`, validate with Ajv, retry once on ordinary non-streaming failure, then fall back to Mock for that method. The model never owns final game state. It can suggest `statePatch`; the server whitelists and clamps it. Ordinary turn schemas now reject direct patches to server-owned fields such as `activeExam`, `characters`, `eventHistory`, `player.examRank`, and `player.examHistory`.

S25.2 adds optional turn token streaming for OpenAI Responses, DeepSeek chat completions, and Anthropic Messages. `streamTurn()` buffers the full model JSON and still returns the same validated `turn` payload as `runTurn()`. During SSE requests, `src/routes/game.js` uses `src/utils/streamingJson.js` to extract only the top-level `narrative` string from the streamed JSON text and send it as `narrative_chunk`. State patches, relationship changes, world tick, persistence, and `final_state` still happen only after the full JSON passes schema validation. If visible provider narrative has already been sent and the stream then fails, the route emits an `error` event and does not write the session; if no visible narrative was sent, it can fall back to the normal turn path.

For turn responses, providers may also suggest top-level `relationshipChanges`. These are not state patches. They are bounded social-memory deltas for existing visible relationship ledger ids, and the server is free to clamp or ignore them before persistence. Mock now emits these suggestions for scholar, emperor, minister, general, magistrate, and official actions so local play can exercise social memory without real model keys.

### Real-Provider Smoke

`scripts/providerSmoke.js` is the optional S25.1 smoke entrypoint for keyed environments:

```bash
npm run smoke:provider
npm run smoke:provider -- --provider deepseek
npm run smoke:provider -- --stream --provider deepseek
```

The script calls real provider factories directly instead of `getProvider()`, so failures are not hidden by Mock fallback. It exercises the four provider methods that correspond to start, turn, question, and submit/grade, then prints a short schema-validated summary. With `--stream`, it also exercises `streamTurn()` and reports streamed raw-character count plus validated narrative. It does not start the Express server and does not write session JSON files. With `AI_PROVIDER=mock`, it auto-runs only providers whose required key is present; if no real-provider keys are configured, it skips with exit code 0.

### AI Output Eval Fixtures

S25.3 adds a no-network fixture gate for provider-shaped output:

```bash
npm run eval:ai
```

The focused test is `test/aiEvalFixtures.test.js`, with fixture data in `testdata/aiEvalFixtures.js` so Node's test runner does not treat fixture data as a test file. It parses raw model-like text through `src/utils/json.js`, validates final payloads through `src/ai/schemas.js`, checks restrained historical tone heuristics, verifies unsafe turn authority claims are rejected, rejects ordinary turn attempts to patch server-owned fields such as `activeExam`, `characters`, `eventHistory`, `player.examRank`, or `player.examHistory`, and confirms patch application clamps numeric fields plus known faction scores. This gate is offline and should remain separate from keyed provider smoke runs.

### Browser Smoke

S26.1 adds `scripts/browserSmoke.js` as the focused browser acceptance entrypoint:

```bash
npm run smoke:browser
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
```

The script uses `playwright-core` with an installed Chrome or Edge executable. It resolves `BROWSER_EXECUTABLE_PATH`, `--browser <path>`, or common platform install paths. Without `--url`, it starts `server.js` in Mock mode on a free local port, verifies the page loads, creates a scholar game through the real form, checks that `localStorage["qianqiu.sessionId"]` is written, reloads the page, opens a fresh page to confirm the saved session restores into the game view, verifies the session is readable through `GET /api/game/state/:sessionId`, and then removes the smoke session JSON file.

S26.2 extends the same journey with DOM and screenshot-level UI acceptance. It asserts desktop and mobile layout boundaries for the status strip, role panel, narrative, and action input surface; opens the exam modal through the scholar panel; submits a Mock-mode essay; checks the result detail sections, ranking, candidate essay profiles, and historical exam archive; and captures PNG screenshots for each representative state. S32.2 additionally verifies the relationship panel: visible contact/faction rows, hidden-entry non-leakage, a Mock scholar relationship update, direct official-start faction visibility, and relationship-panel horizontal overflow. S32.3 verifies the active-request panel from `activeNpcRequestView`, including target ids/types, required fields, hidden target/text non-leakage, and active-request horizontal overflow on desktop, restored, fresh-page, and mobile journeys. Screenshots are validated in memory by default and can be saved with `--screenshots <dir>`. Browser smoke stays separate from `npm test` so normal automated tests do not require a local GUI browser.

`docs/BROWSER_ACCEPTANCE.md` is the durable browser acceptance record. It lists the automated coverage, the latest verified S32.3 result, screenshot artifact policy, and the manual fallback areas that remain intentionally human-checked.

## State Model

`createInitialState()` in `src/game/initialState.js` returns a `worldState` with:

- Global fields: `sessionId`, `year`, `month`, `dynasty`, `turnCount`, `treasury`, `grainReserve`, `population`, `publicOrder`, `taxRate`, `corruption`, `armySize`, `armyMorale`, `borderThreat`.
- Factions: `factions.eunuchs`, `factions.scholarOfficials`, `factions.militaryLords`.
- Narrative, relationship, event, and exam fields: `characters`, `relationshipLedger`, `activeNpcRequest`, `longTermEvents`, `eventHistory`, `activeExam`, `setup`.
- Player identity: `player.role`, `roleLabel`, `name`, `health`, `gold`.
- Scholar fields: `examRank`, `palaceRank`, `officeTitle`, `academia`, `literaryTalent`, `adaptability`, `mentality`, `reputation`, `examHistory`, `teacher`, `studiedBooks`, `connections`.
- Role fields: `personalPower`, `courtControl`, `mandate`, `position`, `faction`, `influence`, `integrity`.
- Official fields: `superiorFavor`, `peerNetwork`, `performanceMerit`, `promotionProspect`, `impeachmentRisk`, `cleanReputation`.
- General fields: `command`, `troops`, `supply`, `battleReputation`, `scouting`, `campaignRisk`.
- Magistrate fields: `countyName`, `localTreasury`, `localOrder`, `gentryRelations`, `banditPressure`, `pendingLawsuits`, `corveeBurden`, `waterworks`.

`relationshipLedger` is the S22.1 server-owned social memory layer. It records current character and faction entries with `stance`, `relationship`, `resentment`, `networkSource`, `recentIntent`, `visible`, and `lastUpdatedTurn`. Character entries are keyed by current `characters[].id`; faction entries are keyed by existing numeric `factions` keys.

Allowed roles currently include `scholar`, `emperor`, `minister`, `general`, `magistrate`, and `official`. S31.3 rejects unsupported start roles before session creation and keeps direct browser starts for `official` enabled because Mock gameplay, initial state, and role-panel rendering all support that loop. The scholar -> exam -> official path is still treated as the critical route.

## State Patch Rules

As of S31.2, `applyStatePatch(worldState, statePatch, options)` enforces:

- Only whitelisted top-level and `player` keys can be changed.
- Numeric fields are clamped to ranges in `NUMERIC_RANGES`.
- `eventHistory` is trimmed to the latest 20 entries.
- `statePatch.factions` may only update existing numeric faction keys; providers cannot invent arbitrary faction names.
- Existing faction scores patched by providers are clamped to `0..100`.
- `turnCount` increments when a turn patch is applied.
- Ordinary provider patches use the provider-facing whitelist and ignore server-owned fields such as `activeExam`, `activeNpcRequest`, `longTermEvents`, `characters`, `eventHistory`, `year`, `month`, `player.examRank`, and `player.examHistory` even if a non-schema provider includes them.
- Server-owned follow-up patches may pass `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }` so internal code can apply fields such as the world tick calendar without double-counting one player turn.
- `relationshipLedger` is not an allowed provider patch key. The AI schema rejects it, and `applyStatePatch()` ignores it if a non-schema provider tries to include it anyway.
- Provider social-memory effects must go through top-level `relationshipChanges`, which `src/routes/game.js` applies through `applyRelationshipChanges()` after the ordinary turn patch increments `turnCount`.

Do not bypass this module when applying provider output.

## Relationship Ledger Contract

The S22 relationship contract is recorded in [docs/RELATIONSHIP_LEDGER_CONTRACT.md](RELATIONSHIP_LEDGER_CONTRACT.md).

`createInitialState()` creates `worldState.relationshipLedger` from the starting character list and known numeric factions. Game and exam routes call `ensureRelationshipLedger()` after reading sessions so older JSON saves are backfilled before they are returned or written again.

The ledger is deliberately server-owned. It normalizes text fields, clamps relationship values to `-100..100`, clamps resentment to `0..100`, drops invented character/faction ledger ids, and preserves only short `recentNotes`.

S22.2 adds the controlled relationship-suggestion path and prompt summary. Turn prompts include a compact visible-only relationship summary. Provider `relationshipChanges` suggestions are processed at most five per turn; they must target existing visible entries, use `relationshipDelta` clamped to `-12..12`, use `resentmentDelta` clamped to `-10..10`, and may only update short `stance`, `recentIntent`, and note text. Applied changes are returned in JSON and SSE payloads as `relationshipChanges`.

S22.3 makes Mock produce concrete relationship suggestions after it classifies the resolved action from its own `statePatch` and `examTrigger`. S23.1 extends that Mock reaction path to magistrate actions, S23.2 extends it to general actions, and S23.3 deepens the official reactions around superiors, peers, clean-name standing, impeachment and informal brokerage. The suggestions still target only visible ledger entries and still pass through `applyRelationshipChanges()` in the route before persistence. The browser appends concise `[人脉]` lines for applied changes.

S32.1 adds `buildRelationshipInspectionView(worldState)` and top-level `relationshipView` payloads for game start, game state reads, game turns, exam questions, and exam submissions. This view is the supported browser contract for contact and faction inspection: it includes visible contacts and factions, readable relationship and resentment bands, stance, source, recent intent, and last-updated turn, while omitting hidden ids, names, counts, placeholders, and hidden-entry notes.

S32.2 renders that contract in `public/app.js` as the `#relationship-panel` inside the scholar/role panel. The browser UI should consume top-level `relationshipView` for player-facing contact inspection; the raw `worldState.relationshipLedger` is only a compatibility/developer-inspection fallback. Relationship contact cards expose stable `data-contact-type`, `data-contact-id`, `data-relationship`, and `data-resentment` attributes for browser acceptance while localizing default faction names, stance, source, and recent intent strings for display.

## Active NPC Request Contract

S32.3 adds the first minimal active NPC/faction request loop. The persisted state is `worldState.activeNpcRequest`, and the player-facing route contract is top-level `activeNpcRequestView`.

Server rules:

- `src/game/activeRequests.js` schedules, normalizes, resolves, expires, and renders active request views.
- Requests are scheduled only for currently visible relationship ledger entries. Hidden targets are omitted from `activeNpcRequestView` and are cleared if older session state points to them.
- The route runs active request handling after provider state patches and provider relationship suggestions, then before `runWorldTick()`. Event history order is provider events, active-request events, then world-tick events.
- Accept/refuse/expire outcomes are applied through `applyRelationshipChanges()` with bounded server-authored deltas. Provider output cannot patch `activeNpcRequest`.
- JSON and SSE turn payloads return `activeNpcRequestView`, `activeNpcRequestEvents`, and merged `relationshipChanges`.

The browser renders active requests as `#active-request-panel` from top-level `activeNpcRequestView` and does not scan the raw ledger or raw request state for normal display. Stable card attributes include `data-request-id`, `data-request-kind`, `data-target-type`, `data-target-id`, `data-request-status`, and `data-due-turn`.

## Long-Term Event Scheduler Contract

S33 adds `worldState.longTermEvents`, documented in [docs/LONG_TERM_EVENTS_CONTRACT.md](LONG_TERM_EVENTS_CONTRACT.md). It is a server-owned queue with `schemaVersion`, active `queue`, turn-number `cooldowns`, and capped `recentResolved` records.

Server rules:

- `src/game/longTermEvents.js` normalizes legacy scheduler state, builds `longTermEventView`, and runs deterministic scheduler steps.
- The first event families cover `seasonal_harvest_audit`, `disaster_grain_shortage`, `border_alarm`, `court_faction_strife`, `local_case_chain`, and `social_repercussion`, with a relief-audit follow-up for unresolved disaster pressure.
- The route runs the scheduler after active requests and after the monthly world tick has advanced the calendar. Scheduler month/year conditions therefore read the post-tick calendar.
- Scheduler state patches go through `applyStatePatch(..., { incrementTurnCount: false, allowServerOwnedPatchKeys: true })`.
- Scheduler-authored social consequences go through `applyRelationshipChanges()` and do not mutate the raw relationship ledger directly.
- JSON and SSE turn payloads return `longTermEventView` plus `longTermEvents: { summary, events, attributeChanges, scheduled, resolved }`.

The browser currently renders long-term event feedback as `[大势]` narrative lines. It does not add a separate long-term event panel in S33.

## Official Role Loop

S23.3 deepens the post-palace official career loop without letting ordinary turns grant a new office title or role promotion. Official state lives under `player` and passes through the normal AI schema plus `applyStatePatch()` whitelist/clamp boundary.

Official state fields:

- `superiorFavor`: how favorably direct superiors view the player's usefulness and discipline, clamped to `0..100`.
- `peerNetwork`: strength of同年/colleague support, clamped to `0..100`.
- `performanceMerit`: current考成 merit record, clamped to `0..100`.
- `promotionProspect`: chance-like career momentum toward future升迁, clamped to `0..100`; it does not itself change `officeTitle`.
- `impeachmentRisk`: exposure to counterattack, audit, and弹劾 risk, clamped to `0..100`.
- `cleanReputation`: public清操/clean-name standing, clamped to `0..100`.

Palace-exam promotion now seeds these fields and appends a visible official superior contact (`C02`) while preserving the complete scholar -> official path. Mock official turns recognize assessment/promotion work, impeachment, observation under superiors, casework, relief/farming, peer networking, bribery, and routine office work. These actions may update official career fields and limited global fields such as `corruption`, `publicOrder`, `grainReserve`, `population`, and existing numeric factions. Relationship consequences remain suggestions only and are applied through the route-owned relationship ledger merge.

## General Role Loop

S23.2 adds a dedicated military command loop without changing the complete scholar -> official path. General state lives under `player` and passes through the normal AI schema plus `applyStatePatch()` whitelist/clamp boundary.

General state fields:

- `command`, `battleReputation`, `scouting`, `campaignRisk`: command and campaign condition meters, clamped to `0..100`.
- `troops` and `supply`: local command strength and military stores, clamped to `0..1000000`.

Mock general turns recognize six action families: recruitment, supply/pay work, drill, scouting, fortification, and campaign action. These actions may update local military player fields and limited global fields such as `treasury`, `grainReserve`, `armySize`, `armyMorale`, `borderThreat`, `publicOrder`, and existing numeric factions. Relationship consequences are still suggestions only and are applied through the route-owned relationship ledger merge.

## Magistrate Role Loop

S23.1 adds the first dedicated local magistrate loop without changing the complete scholar -> official path. Magistrate state lives under `player` and passes through the normal AI schema plus `applyStatePatch()` whitelist/clamp boundary.

Magistrate state fields:

- `countyName`: display name for the current county.
- `localTreasury`: county-level cash reserve, clamped to `0..100000`.
- `localOrder`, `gentryRelations`, `banditPressure`, `pendingLawsuits`, `corveeBurden`, `waterworks`: local condition meters, clamped to `0..100`.

Mock magistrate turns recognize six action families: case hearings, money/grain work, gentry mediation, anti-bandit policing, corvee labor, and waterworks. These actions may update both local player fields and limited global world fields such as `treasury`, `grainReserve`, `population`, `publicOrder`, `corruption`, and existing numeric factions. Relationship consequences are still suggestions only and are applied through the route-owned relationship ledger merge.

## Phase-Two World Tick Contract

S21.1 defines the server-owned simulation boundary in [docs/WORLD_TICK_CONTRACT.md](WORLD_TICK_CONTRACT.md). S21.2 implements the pure module in `src/game/worldTick.js`; S21.3 wires that module into `POST /api/game/turn`.

The contract for S21.2-S21.4 is:

- Add `worldState.month` as a top-level calendar field, defaulting to `1`.
- Run one minimal tick after each successful `POST /api/game/turn` action.
- Advance one in-game month per valid free-text turn; roll month 12 to 1 and increment `year`.
- Let the server, not the provider, compute natural changes to treasury, grain reserve, population, public order, corruption, army morale, border threat, and existing numeric faction keys.
- Keep `turnCount` to one increment per player turn even when provider output and tick output both change state.
- Apply tick changes through the same whitelist/clamp boundary used for provider patches.
- Return short visible tick feedback as `worldTick` in JSON/SSE payloads and append tick events after provider events.
- Do not touch exam rank, active exam, exam history, role promotion, session identity, or the complete scholar -> official path.

`runWorldTick(worldState)` returns `{ statePatch, attributeChanges, events, summary }` without mutating `worldState`. Its first deterministic formulas cover treasury revenue/upkeep/leakage, grain consumption/harvest, population drift, public order, corruption, army morale, border threat, and small known-faction drift.

Route integration order is provider patch first, provider relationship suggestions, exam trigger setup when requested, active NPC request handling, `runWorldTick()` against the updated state, tick patch with `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }`, long-term event scheduling/resolution, then provider events followed by active-request events, tick events, and long-term event events. The browser renders the current month in the status strip and appends concise monthly and `[大势]` feedback below the provider narrative.

Provider turn schemas and prompts do not expose `year` or `month` as allowed model patch keys; calendar changes are reserved for server-owned patches.

## Exam Rules

The exam path is:

```text
寒窗 -> 童试 -> 秀才 -> 乡试 -> 举人 -> 会试 -> 贡士 -> 殿试 -> 进士 -> 入仕官员
```

Exam levels:

| Level | Name | Required Rank | Promotion | Pass |
| --- | --- | --- | --- | --- |
| `child_exam` | 童试 | none | 秀才 | 60 |
| `provincial_exam` | 乡试 | 秀才 | 举人 | 68 |
| `metropolitan_exam` | 会试 | 举人 | 贡士 | 74 |
| `palace_exam` | 殿试 | 贡士 | 进士 / official | normally not failed unless severe cheating |

Promotion is applied in `src/game/promotions.js`, not by the provider. Palace exam assigns `player.role = "official"`, a palace rank, an office title, `position`, `faction`, `influence`, `integrity`, and the initial S23.3 official career meters.

Exam entry preparation is applied in `POST /api/exam/question` by `src/game/examTravel.js`, not by the provider. It charges level-specific travel/preparation cost, converts unfunded shortfall into small clamped `player.health`, `mentality`, `adaptability`, or `reputation` effects, stores `activeExam.entryPreparation`, and appends a concise travel event. It uses `applyStatePatch(..., { incrementTurnCount: false })`, so taking a question does not advance `turnCount` or `year/month`. Existing unanswered exams are reused without retroactive travel cost.

Virtual candidates now include `essay`, `style`, `examinerComment`, `strengths`, and `weaknesses`. These fields are server-generated in Mock/default local play and saved into exam history with the ranking, allowing the browser to show 同场文卷 and later review them through 考试档案.

## Persistence

Session files are written to `data/sessions/{sessionId}.json`. Session ids must match a UUID-like safe pattern before the path is built. `data/sessions/*.json` is ignored by Git; only `data/sessions/.gitkeep` should be committed.

## Verification

Use:

```bash
npm test
```

Route-level tests that start temporary Express servers use `test-helpers/fetchSafeServer.js`. The helper retries if `app.listen(0)` lands on a port that Node's Fetch implementation rejects as unsafe.

For the focused no-network AI output fixture gate, use:

```bash
npm run eval:ai
```

For keyed provider smoke, use:

```bash
npm run smoke:provider
npm run smoke:provider -- --stream --provider openai
```

For local browser acceptance, use:

```bash
npm run smoke:browser
```

For local acceptance, run the checklist in [docs/MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md). Browser automation coverage lives in [docs/BROWSER_ACCEPTANCE.md](BROWSER_ACCEPTANCE.md). Phase milestones are recorded in [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md) and [docs/PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md); every accepted slice should also update `docs/SHARED_CONTEXT.md` and `docs/DEVELOPMENT_STEPS.md`.
