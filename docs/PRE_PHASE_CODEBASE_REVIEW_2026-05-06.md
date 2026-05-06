# Pre-Phase Codebase Review - 2026-05-06

This is a read-only audit before starting the next development phase. No runtime code was changed during the review.

## Scope

- Backend routes, state ownership, exam progression, promotion, anti-cheat, world tick, role/world coupling, and official career settlement.
- AI providers, JSON schemas, prompts, SSE streaming, Mock fallback, and provider smoke scripts.
- Frontend browser UI, save list, exam modal, streaming turn rendering, desktop/mobile layout, and accessibility risks.
- JSON session storage, save-list redaction, mutation serialization, and future SQLite migration boundary.
- Test scripts, acceptance docs, README, roadmap ledger, and phase handoff consistency.

Five read-only subagents reviewed focused slices in parallel. They did not edit files, stage, commit, push, create PRs, or revert changes.

## Blocking Findings

### P1 - Cross-origin save access bypasses save-list redaction

Location: `server.js`, `src/routes/game.js`

`server.js` enables default `cors()`, which allows arbitrary origins. `GET /api/game/saves` returns redacted metadata, but it also returns `sessionId`; a different local webpage can read the save ids and then call `GET /api/game/state/:sessionId` to retrieve full `worldState`, including essays, raw relationship ledgers, hidden contacts or factions, and other complete save data.

Recommended fix:

- Restrict CORS by default for local development, or only allow configured origins.
- Add route-level tests for hostile `Origin` requests against `/api/game/saves` and `/api/game/state/:sessionId`.
- Keep same-origin browser save loading working.

### P1 - Ordinary turns can persist illegal or closed exam triggers

Location: `src/routes/game.js`, `finalizeTurn()`

When provider output contains `examTrigger.shouldStart === true`, the turn route directly writes `worldState.activeExam` after `getExam()` and an optional calendar snapshot. It does not require a non-null legal level, does not call `canEnterExam()`, and still writes an active exam when `canOpenExamInCalendar()` fails.

Observed with a temporary provider probe: a scholar with no rank can make `POST /api/game/turn` persist `activeExam.level = "palace_exam"` with HTTP 200.

Recommended fix:

- Move or reuse the authority checks from `scripts/providerLongRun.js` in the route path.
- Only write `activeExam` when the exam level is the player's legal next exam and the calendar is open or an explicitly preserved open snapshot.
- Add route tests for illegal level skips, closed calendar triggers, and null trigger levels.

### P1 - Ordinary turns can overwrite an in-progress exam

Location: `src/routes/game.js`, `finalizeTurn()`

The same `examTrigger` branch rebuilds `worldState.activeExam` unconditionally. If the player already has an unanswered `activeExam.examQuestion`, another ordinary turn with an exam trigger can erase the `examId`, `examQuestion`, `status`, and writing state.

Recommended fix:

- Treat active writing exams as server-owned locks.
- Ignore or reject ordinary-turn exam triggers while an unanswered exam exists.
- Add a regression test where a provider trigger cannot erase an existing writing exam.

## High-Priority Findings

### P2 - SSE narrative extractor is not limited to top-level `narrative`

Location: `src/utils/streamingJson.js`

The extractor searches for the first `"narrative"` key anywhere in the streamed JSON. If a provider streams a nested key such as `statePatch.narrative` before the real top-level narrative, the browser can display text that later fails schema validation and is not persisted.

Recommended fix:

- Make the extractor track top-level object depth and only stream the top-level `narrative` field.
- Add a test proving nested `narrative` keys do not emit chunks.

### P2 - Visible SSE text can remain after server rejects the turn

Location: `public/app.js`

If `narrative_chunk` text has already rendered and the SSE stream later emits `error`, the visible text remains in the narrative history even though the server intentionally did not mutate or save state.

Recommended fix:

- Mark streamed text as pending until `final_state`.
- On stream error, remove the pending block or restyle it as uncommitted text with a clear failure message.

### P2 - Relationship prompt summaries leak hidden recent notes

Location: `src/game/relationships.js`, `src/ai/prompts.js`

`summarizeRelationshipLedger(..., { visibleOnly: true })` filters hidden contacts and factions, but returns `recentNotes` unfiltered. A hidden faction note can enter provider prompt context even though `buildRelationshipInspectionView()` correctly filters it for the browser.

Recommended fix:

- Reuse visible-note filtering for prompt summaries when `visibleOnly` is true.
- Add a test with a hidden faction note to ensure it is absent from prompt-facing summaries.

### P2 - Role/world coupling cooldowns are recorded but not enforced

Location: `src/game/roleWorldCoupling.js`

`runRoleWorldCouplingStep()` writes cooldowns such as `[effect.kind]: currentTurn + 6`, but does not check them before applying the next effect. Repeating the same role action can apply deterministic resource effects every turn.

Recommended fix:

- Check cooldown expiry before applying an effect.
- Still allow narrative/provider ordinary effects, but suppress repeated server-owned coupling effects while cooling down.
- Add focused cooldown tests.

### P2 - Initial year is not clamped at the API boundary

Location: `src/game/initialState.js`

`createInitialState()` accepts any finite numeric year, including negative or extreme values, before later systems clamp during ticks. Start state should obey the same boundary discipline as ordinary state patches.

Recommended fix:

- Clamp or reject invalid initial years before session creation.
- Add start-route tests for negative, zero, fractional, and very large years.

### P2 - Storage revision checks are only reliable in one Node process

Location: `src/storage/sessionStore.js`

`mutateSession()` passes the record it just read as both `previousRecord` and `expectedRevision`; `writeSessionUnlocked()` does not reread latest disk state when `previousRecord` is provided. The in-process queue prevents same-process lost writes, but cross-process writes or future adapter reuse can silently overwrite.

Recommended fix:

- For the JSON adapter, document this as a single-process guarantee or reread the latest revision before writing.
- For SQLite, enforce `WHERE session_id = ? AND revision = ?`.
- Add adapter contract tests for stale revision conflict behavior.

## Medium / UX / Documentation Findings

- `public/app.js`: start, restore, and manual save-load failures call `appendNarrative()` while the game panel may still be hidden, so errors can be invisible on the start screen.
- `public/index.html` / `public/app.js`: exam and save dialogs lack focus trapping, opener focus restoration, and initial focus management.
- `public/app.js`: closing the exam modal can silently lose an essay draft; reopening resets the textarea.
- `public/app.js`: `renderMeter()` uses `innerHTML` where local `textContent` composition would be safer and more consistent.
- `src/ai/index.js`: `streamTurn()` is not wrapped with the same retry and Mock fallback behavior as non-streaming provider methods; route fallback hides some cases, but direct calls do not match the broad fallback contract.
- `src/ai/schemas.js`: provider-facing model schemas are much wider than final schemas, especially for `statePatch` and `examTrigger.level`, increasing validation failures and fallback behavior.
- `docs/DEVELOPMENT_STEPS.md` and `docs/BROWSER_ACCEPTANCE.md`: several recent steps still use `current Sxx implementation commit` placeholders instead of real hashes. Recent hashes include S38.3 `752bab5`, S38.2 implementation `9278be3`, S37 `5cc4756`, S36 `dec6c9b`, S35 `b91a9e7`, and S34 `48c3cf0`.
- `package.json`: there is no aggregate `verify` or `acceptance` script for the expected pre-phase quality gate; `npm test`, AI eval, provider smoke, provider long-run smoke, and browser smoke are separate.

## Verification Run During Review

Main agent:

- `npm test` passed with 169 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `npm run smoke:provider:long` skipped successfully because no real-provider keys are configured.
- `npm run smoke:browser` passed with 14 screenshots checked.
- `git diff --check` passed.
- `git status --short` was clean before documentation was added.

Subagents additionally ran focused checks including browser helper tests, storage route tests, AI/provider tests, and provider no-key skip checks. One subagent saw a transient full-suite failure in `cleanupSessionTempFiles removes stale temp files...`; the main-agent full `npm test` run passed, and the subagent's focused rerun passed.

## Recommended Next Step

Before starting a new feature phase, fix the P1 items:

1. Restrict CORS or otherwise prevent cross-origin save enumeration plus full-state reads.
2. Harden `/api/game/turn` examTrigger handling so ordinary provider output cannot bypass exam gates or overwrite active writing exams.

After those are fixed, address the P2 streaming, hidden-note, role/world cooldown, initial-year, and storage revision findings as the next hardening slice.
