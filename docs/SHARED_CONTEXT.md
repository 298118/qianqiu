# Shared AI Development Context

This file is the handoff board shared by Codex and Claude Code.

Both tools must read this file at the start of every development session, after reading their own instruction file. Both tools must update this file whenever they make a meaningful project change, so the other tool can immediately see the current state without relying on chat history.

## Current Snapshot

- Repository status: phase-one playable vertical slice is implemented, accepted, and now archived as historical planning. Phase two has started; S23.1 local magistrate identity depth and S23.2 general identity depth are implemented, and the next active implementation target is S23.3 official identity depth.
- Canonical product brief: `docs/QIANQIU_DEVELOPMENT_BRIEF.md`.
- Shared implementation roadmap and progress ledger: `docs/DEVELOPMENT_STEPS.md`.
- Developer implementation map: `docs/ARCHITECTURE.md`.
- Phase-one acceptance record: `docs/PHASE_ONE_ACCEPTANCE.md`.
- Phase-one roadmap archive: `docs/PHASE_ONE_ROADMAP_ARCHIVE.md`.
- Codex entrypoint: `AGENTS.md`.
- Claude Code entrypoint: `CLAUDE.md`.
- Default development target: runnable Node.js + Express + pure HTML/CSS/JS game at `http://localhost:3000`.
- Default AI mode: `mock`, playable without API keys.
- Implemented API surface: `GET /api/health`, `POST /api/game/start`, `GET /api/game/state/:sessionId`, `POST /api/game/turn`, `POST /api/exam/question`, `POST /api/exam/submit`.
- Local session files are written under `data/sessions/*.json`, which remains ignored by Git.

## Active Decisions

- Use one shared context file for both Codex and Claude Code: `docs/SHARED_CONTEXT.md`.
- Use one shared step ledger for both Codex and Claude Code: `docs/DEVELOPMENT_STEPS.md`.
- `docs/DEVELOPMENT_STEPS.md` is now the phase-two active roadmap. The completed first-phase roadmap is archived in `docs/PHASE_ONE_ROADMAP_ARCHIVE.md`; first-phase acceptance details remain in `docs/PHASE_ONE_ACCEPTANCE.md`.
- The phase-two planning transition does not change the mandatory development workflow, Git discipline, Mock-default requirement, provider-optional requirement, or server-owned state/rules boundary.
- Every coherent project change must be committed locally with Git.
- The first runtime slice uses Express, CORS, and dotenv only; session ids use Node.js `crypto.randomUUID()` to avoid adding a separate id dependency this early.
- `AI_PROVIDER=mock` remains the default no-key mode. `AI_PROVIDER=openai`, `deepseek`, `claude`, or `anthropic` now creates a real provider when the matching API key is present.
- Real providers use local prompt builders in `src/ai/prompts.js`, JSON schemas in `src/ai/schemas.js`, and `src/utils/json.js` parsing before route handlers apply any state changes.
- OpenAI uses the Responses API through the `openai` SDK; DeepSeek uses the same SDK against `DEEPSEEK_BASE_URL` with OpenAI-compatible chat completions; Claude uses `@anthropic-ai/sdk` Messages API with `output_config.format`.
- Real provider calls use `AI_PROVIDER_TIMEOUT_MS` (default 30000), retry once on call/JSON/schema failure, then fall back to Mock for that method.
- State patch whitelist: `src/game/stateRules.js` defines allowed patch keys for top-level state and player fields. Only whitelisted fields can be modified by AI output.
- Numerical clamping: all numeric fields have defined min/max ranges in stateRules.js. Patches are clamped after merge.
- Event history: capped at 20 entries, oldest trimmed first.
- `POST /api/game/turn` now supports SSE when clients send `Accept: text/event-stream` or `?stream=1`. The route emits `state_preview`, `narrative_chunk`, `final_state`, and `error`; requests without SSE negotiation still return JSON for compatibility and tests.
- Frontend restores session from localStorage on page load.
- Mock provider `runTurn` recognizes scholar actions: study, teacher visit, travel/social, money/work, exam request, and rest.
- Mock provider scholar actions now separately handle study, teacher visits, travel/social, debate, money/work, exam request, and rest.
- Scholar daily actions may update `studiedBooks`, `teacher`, and `connections` in addition to numeric attributes; these still pass through the server-side patch whitelist in `src/game/stateRules.js`.
- The frontend now renders a scholar panel above the narrative with exam progress, next exam, current active exam, attribute meters, teacher, studied books, and connections.
- `src/game/exams.js` is the server-owned source of truth for exam levels, thresholds, word-count guidance, pass scores, and promotion mappings.
- `POST /api/exam/question` generates and saves a full `activeExam`; it reuses an existing unanswered exam instead of regenerating a new question.
- The frontend scholar panel can open the next exam directly, and a free-text exam trigger now auto-opens the exam writing modal after the turn response.
- `src/game/essayChecks.js` performs server-side local exam authenticity checks: short essays, modern/anachronistic terms, copied classic passages, and ghostwriting probability. Server penalties are applied after provider grading.
- `src/game/candidates.js` generates 4-8 virtual same-session exam candidates and builds the displayed ranking.
- `POST /api/exam/submit` grades the active essay, applies local penalties, saves the essay/result into `player.examHistory`, clears `activeExam`, and returns `score`, `authenticityCheck`, `virtualCandidates`, `ranking`, `promotionResult`, and `worldState`.
- `src/game/promotions.js` is the server-owned promotion and severe-cheating consequence module; providers only influence score and authenticity inputs.
- `POST /api/exam/submit` now applies promotion before saving the result: child/provincial/metropolitan passes set `player.examRank` to `秀才`/`举人`/`贡士`; palace pass sets `player.examRank = "进士"`, `player.role = "official"`, `player.roleLabel = "入仕官员"`, and records `palaceRank` plus `officeTitle`.
- Severe exam fraud, currently copied classic passages or any authenticity flag with `severity: "severe"`, forces failure, downgrades one rank where possible, clears palace/office fields, and reduces reputation and mentality.
- Role state fields now include `personalPower`, `courtControl`, `mandate`, `position`, `faction`, `influence`, and `integrity`; these are clamped/whitelisted through `src/game/stateRules.js`.
- Palace exam promotion now seeds official `position`, `faction`, `influence`, and `integrity` so the official loop has immediate state to render and update.
- Mock provider role loops now cover emperor relief/appointments/taxation/military/廷议, minister memorials/networking/政务/弹劾, and official 观政/断案/抚民/同年/贪墨 actions.
- The frontend reuses the former scholar panel area as a role panel for emperor, minister, and official views, showing key metrics,府库粮储,朝局派系,人脉, and action hints.
- The S12 UI polish remains buildless and dependency-free: CSS now carries the paper/ink/cinnabar/jade/indigo visual language, mobile uses a full-height single-column layout with sticky action input, and the exam modal adapts to small screens.
- The frontend now adds turn dividers in narrative history, exposes attribute-change reasons as hover titles, shows live exam character-count guidance without changing server scoring rules, and renders exam results as collapsible 五维评卷/监试复核/同场榜单 sections.
- `npm test` now runs Node.js' built-in test runner. The `test/` suite covers state patch boundaries, session JSON persistence, AI JSON schemas, exam gates, promotion/consequence rules, local essay integrity penalties, and virtual candidate ranking.
- `docs/MANUAL_ACCEPTANCE.md` is the end-to-end manual acceptance script for Mock mode, covering API smoke checks, the complete scholar-to-official path, exam integrity checks, and emperor/minister/official role loops.
- `docs/ARCHITECTURE.md` now records the current runtime shape, route ownership, API contracts, AI provider contracts, state fields, state patch rules, exam rules, persistence, and verification expectations for new developers.
- `docs/PHASE_ONE_ACCEPTANCE.md` records the first automated Mock-mode phase-one acceptance pass and known limitations.
- Faction state patches now merge only existing numeric faction keys instead of replacing the full factions object, so provider output cannot introduce arbitrary faction names through `statePatch.factions`.
- `src/utils/sse.js` owns SSE headers, event formatting, and narrative chunking for the turn route.
- S21.1 world tick contract lives in `docs/WORLD_TICK_CONTRACT.md`.
- Minimal world tick implementation should add `worldState.month`, advance one in-game month per successful `POST /api/game/turn`, roll month 12 to 1 with `year +1`, and keep `turnCount` to exactly one increment per player turn.
- World tick output remains server-owned and must flow through the same whitelist/clamp boundaries as provider patches. It may naturally adjust `year`, `month`, treasury, grain reserve, population, public order, corruption, army morale, border threat, and existing numeric faction keys, but it must not alter exam rank, active exams, promotion fields, session identity, or the complete scholar -> official path.
- S21.2 implemented `src/game/worldTick.js` as a pure module returning `{ statePatch, attributeChanges, events, summary }`. It advances `year/month`, computes deterministic monthly resource drift, emits concise world events, and does not mutate the input state or touch player promotion/exam fields.
- `worldState.month` now defaults to `1`, and `src/game/stateRules.js` whitelists/clamps `year` and `month`. `applyStatePatch(worldState, patch, { incrementTurnCount: false })` is available for S21.3 so a provider patch and a tick patch can share one player turn without double-counting `turnCount`.
- Provider turn schemas/prompts no longer expose `year` as a model patch key and still reject `month`; models can read compact calendar context, but calendar changes are reserved for server-owned tick patches.
- S21.3 route integration now runs `runWorldTick()` after provider state application and exam-trigger setup in `POST /api/game/turn`, applies the tick patch with `{ incrementTurnCount: false }`, appends provider events before tick events, and returns `worldTick: { summary, events, attributeChanges }` in JSON and SSE final payloads.
- The browser status strip now displays `year/month`, and turn handling appends concise `[月度]` feedback after provider narrative so players can see natural world movement without opening event history.
- S21.4 broadened `test/gameTurnTick.test.js` to cover route-level tick clamps, provider+tick event-history trimming, repeated Mock turns across multiple year rollovers, and the complete scholar -> official path after tick integration.
- S22.1 added `worldState.relationshipLedger` as a server-owned social memory layer for current characters and numeric factions. Entries record `stance`, `relationship`, `resentment`, `networkSource`, `recentIntent`, `visible`, and `lastUpdatedTurn`.
- `src/game/relationships.js` owns relationship ledger creation, normalization, legacy-session backfill, and compact summaries. `createInitialState()` seeds the ledger, and game/exam routes call `ensureRelationshipLedger()` after reading sessions so older JSON saves can continue.
- Relationship ledger values are clamped and normalized server-side: relationship is `-100..100`, resentment is `0..100`, text fields are short, invented character/faction ledger ids are dropped, and `recentNotes` is capped.
- Providers still cannot patch `relationshipLedger`. The turn schema rejects it and `applyStatePatch()` ignores it if present.
- S22.2 adds a controlled provider suggestion path: turn outputs may include top-level `relationshipChanges`, separate from `statePatch`, with existing visible `character`/`faction` target ids, `relationshipDelta` clamped to `-12..12`, `resentmentDelta` clamped to `-10..10`, and short optional `stance`, `recentIntent`, `note`, and `reason` fields.
- `src/game/relationships.js` now exports `applyRelationshipChanges()`; `POST /api/game/turn` applies provider relationship suggestions after the normal state patch increments `turnCount`, drops hidden/invented targets, updates `lastUpdatedTurn`, normalizes the ledger, and returns the applied changes as `relationshipChanges` in JSON and SSE payloads.
- Turn prompts now include a compact visible-only relationship ledger summary through `summarizeRelationshipLedger(..., { visibleOnly: true })`, so real providers can suggest social consequences without seeing hidden ledger entries.
- S22.3 makes Mock provider turns generate concrete `relationshipChanges` for scholar, emperor, minister, and official actions. Mock classifies the resolved action from its own `statePatch` and `examTrigger`, targets only currently visible relationship ledger entries, and still relies on the game route to apply and persist changes through `applyRelationshipChanges()`.
- The browser now appends concise `[人脉]` narrative feedback for applied relationship changes in both JSON and SSE turn paths.
- Durable S22 relationship contract: `docs/RELATIONSHIP_LEDGER_CONTRACT.md`.
- S23.1 adds magistrate-local player state fields: `countyName`, `localTreasury`, `localOrder`, `gentryRelations`, `banditPressure`, `pendingLawsuits`, `corveeBurden`, and `waterworks`.
- Magistrate local fields are included in the AI turn schema, prompt compact player context, and `applyStatePatch()` whitelist/clamp boundary. Numeric local fields are server-clamped, and promotion/exam/relationship-ledger authority remains server-owned.
- Mock magistrate turns now cover case hearings, money/grain work, gentry mediation, anti-bandit policing, corvee labor, waterworks, and routine yamen work.
- Mock magistrate turns generate concrete `relationshipChanges` through the same suggestion-only path as S22.3; the route still applies and persists them through `applyRelationshipChanges()`.
- The browser role panel now renders magistrate-specific status, action hints, county meters, county treasury, and local human-network feedback.
- S23.2 adds general-specific player state fields: `command`, `troops`, `supply`, `battleReputation`, `scouting`, and `campaignRisk`.
- General military fields are included in the AI turn schema, prompt compact player context, and `applyStatePatch()` whitelist/clamp boundary. Numeric military fields are server-clamped, and promotion/exam/relationship-ledger authority remains server-owned.
- Mock general turns now cover recruitment, supply/pay work, drill, scouting, fortification, campaign action, and routine camp work.
- Mock general turns generate concrete `relationshipChanges` through the same suggestion-only path as S22.3; the route still applies and persists them through `applyRelationshipChanges()`.
- The browser role panel now renders general-specific status, action hints, military meters, troop/supply counts, and border pressure.
- Tooling note: if `rg` resolves to the packaged Codex app path under `C:\Program Files\WindowsApps\OpenAI.Codex_...\app\resources`, Windows may deny execution. This workspace now shadows it with a working ripgrep 15.1.0 binary at `C:\Users\ZZZ\AppData\Local\OpenAI\Codex\bin\rg.exe`, which appears earlier on PATH.
- Any behavior/API/setup/architecture decision that affects future work must be recorded in this file or in the canonical development brief.
- Any roadmap step that starts, completes, blocks, or changes scope must be recorded in `docs/DEVELOPMENT_STEPS.md`.
- If the change is a short handoff note, update this file.
- If the change alters product scope, architecture, API contracts, state shape, prompts, setup, or acceptance criteria, update both this file and the relevant durable document.

## Handoff Protocol

At the start of each session:

1. Read the tool-specific entrypoint: `AGENTS.md` for Codex or `CLAUDE.md` for Claude Code.
2. Read this file.
3. Read `docs/QIANQIU_DEVELOPMENT_BRIEF.md` before planning or editing.
4. Read `docs/DEVELOPMENT_STEPS.md` and choose the next small step.
5. Run `git status --short`.
6. Respect any existing uncommitted changes.

Before finishing each coherent change:

1. Update this file with the new current state, decisions, verification notes, and next recommended step.
2. Update `docs/DEVELOPMENT_STEPS.md` with step status, completed work, verification, and commit hash.
3. Update `docs/QIANQIU_DEVELOPMENT_BRIEF.md` or README when the durable project contract changes.
4. Run the relevant verification command.
5. Commit the change locally.
6. Mention the commit hash in the final response.

## Latest Verification

- 2026-05-05: Documentation files were readable as UTF-8 through Node.js.
- 2026-05-05: Git repository initialized and documentation scaffold committed.
- 2026-05-05: Shared context bridge added; Node.js verification confirmed `AGENTS.md`, `CLAUDE.md`, README, and the development brief all link to `docs/SHARED_CONTEXT.md`.
- 2026-05-05: Development steps ledger added; Codex and Claude Code entrypoints now require updating `docs/DEVELOPMENT_STEPS.md` for every roadmap step.
- 2026-05-05: Roadmap step S00.1 recorded as completed in `docs/DEVELOPMENT_STEPS.md` with commit `8e3cee3`.
- 2026-05-05: `npm install` completed with 0 vulnerabilities.
- 2026-05-05: `npm start` served `http://localhost:3000`; `GET /api/health`, homepage load, `POST /api/game/start`, and `GET /api/game/state/:sessionId` were verified with PowerShell web requests.
- 2026-05-05: First runnable vertical slice committed as `c6e0537`.
- 2026-05-05: `POST /api/game/turn` verified with study action (academia +1), exam trigger (activeExam set to child_exam), and state restore. Error handling tested for empty input and missing sessionId. All tests pass.
- 2026-05-05: S06.1-S06.3 code committed as `9aa5263`; `node --check` passed for `src/ai/providers/mock.js`, `public/app.js`, and `src/routes/game.js`.
- 2026-05-05: Local server at `http://localhost:3000` verified homepage/app/style assets return 200. A six-turn API smoke test covered study, teacher visit, travel, debate, money/work, and exam request; it confirmed studied book, teacher, connections, `child_exam` trigger, saved `activeExam`, event history cap, and turn count.
- 2026-05-05: S07.1-S07.3 code committed as `47dae05`. Verified with `node --check` for `server.js`, `src/game/exams.js`, `src/routes/exam.js`, `src/ai/providers/mock.js`, and `public/app.js`. Temporary local server checks confirmed `/`, `/app.js`, and `/styles.css` return 200. API smoke tests confirmed `POST /api/exam/question` works both directly and after a free-text exam trigger, saves `activeExam.examQuestion`, and reuses the same `examId` for an unanswered exam.
- 2026-05-05: S08.1-S08.4 code committed as `9c8ca76`. Verified with `node --check` for `src/game/essayChecks.js`, `src/game/candidates.js`, `src/ai/providers/mock.js`, `src/routes/exam.js`, and `public/app.js`. Temporary server on port 3137 confirmed health, question generation, normal essay submission, 4-8 candidate ranking, `examHistory` persistence, `activeExam` clearing, and short/modern-term penalty flags.
- 2026-05-05: S09.1-S09.5 code committed as `bed515a`. Verified with `node --check` for `src/game/promotions.js`, `src/routes/exam.js`, `src/game/initialState.js`, and `public/app.js`; `git diff --check`; and a temporary Mock server on port 3142 that confirmed four-exam promotion from scholar to official plus severe-copy downgrade from `秀才` to no rank.
- 2026-05-05: S10.1-S10.3 code committed as `592b7a1`. Verified with `node --check` for `src/ai/providers/mock.js`, `src/game/initialState.js`, `src/game/stateRules.js`, `src/game/promotions.js`, and `public/app.js`; `git diff --check`; a temporary Mock server on port 3158 covering emperor relief, minister memorial, and official observation actions; and a direct promotion-to-official smoke test confirming official state seeding and official turn updates.
- 2026-05-05: S11.1-S11.4 code committed as `0d779a2`. Verified `node --check` for the new provider/schema/prompt/json files plus `src/ai/index.js`; Ajv accepted a valid turn payload; no-key OpenAI/DeepSeek/Claude configurations returned Mock; an unreachable OpenAI endpoint retried twice then returned Mock output; and a temporary Mock server on port 3171 returned health ok, created a session, and advanced one turn.
- 2026-05-05: S12.1-S12.3 UI polish committed as `7b4f349`. Verified `node --check public/app.js`, `node --check server.js`, `node --check src/routes/game.js`, `node --check src/routes/exam.js`, `git diff --check`, and a temporary Mock server on port 3188 confirming homepage/style/app assets, health, session creation, one turn, and `child_exam` question generation.
- 2026-05-05: S13.1-S13.3 quality gate committed as `4a70f5a`. Verified `node --check src/game/stateRules.js`, `node --check` for all new `test/*.test.js` files, `git diff --check`, and `npm test` with 15 passing tests.
- 2026-05-05: S14.1-S14.3 documentation and phase-one acceptance committed as `b67aadb`. Verified `npm install` with 0 vulnerabilities, `npm test` with 15 passing tests, and an automated temporary Mock server acceptance on port 3214 covering static assets, health, complete scholar -> official progression with four saved exam essays, exam integrity penalties for short/modern/copy submissions, and emperor/minister/official role loops. Playwright/browser screenshot automation was unavailable, so static assets plus API acceptance were verified and the manual browser checklist remains in `docs/MANUAL_ACCEPTANCE.md`.
- 2026-05-05: S04.4 SSE turn streaming code committed as `0fd8729`. Verified `node --check src/utils/sse.js`, `node --check src/routes/game.js`, `node --check public/app.js`, `node --check test/sse.test.js`, `git diff --check`, `npm test` with 18 passing tests, and a temporary Mock server on port 3226 confirming `POST /api/game/turn` returns SSE events with `Accept: text/event-stream` while preserving JSON fallback without the SSE accept header.
- 2026-05-05: Local `rg` execution was repaired by creating `C:\Users\ZZZ\AppData\Local\OpenAI\Codex\bin\rg.exe` from the working Codex local-cache ripgrep 15.1.0 binary. Verified `Get-Command rg`, `rg --version`, `rg --files`, and `rg "SSE" docs src public test`.
- 2026-05-05: Phase-one roadmap archived and phase-two roadmap opened in documentation. Verified `npm test` with 18 passing tests and `git diff --check`.
- 2026-05-05: S21.1 world tick contract documented in `docs/WORLD_TICK_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/QIANQIU_DEVELOPMENT_BRIEF.md`, and `docs/DEVELOPMENT_STEPS.md`. Verified `npm test` with 18 passing tests and `git diff --check`.
- 2026-05-05: S21.2 world tick module implemented in `src/game/worldTick.js`, with `worldState.month` defaulting to `1`, `year/month` patch whitelist and clamps, provider calendar patch rejection, and a no-double-turn-count patch option for future route integration. Verified `node --check` for changed runtime/test files, `npm test` with 23 passing tests, and `git diff --check`.
- 2026-05-05: S21.3 world tick route integration committed as `70b14fd`, implemented in `src/routes/game.js`, `public/app.js`, and `public/styles.css`, with route-level JSON/SSE tests in `test/gameTurnTick.test.js`. Verified `node --check src/routes/game.js`, `node --check public/app.js`, `node --check test/gameTurnTick.test.js`, `git diff --check`, and `npm test` with 25 passing tests.
- 2026-05-05: S21.4 automated world tick coverage committed as `543a966`, adding route-level clamps, provider+tick event-history trimming, 15 repeated Mock turns across year rollover, and the complete scholar -> official path after tick integration to `test/gameTurnTick.test.js`. Verified `node --check test/gameTurnTick.test.js`, `node --test test/gameTurnTick.test.js` with 6 passing tests, `git diff --check`, and `npm test` with 29 passing tests.
- 2026-05-05: S22.1 relationship ledger foundation committed as `296928f`, implemented in `src/game/relationships.js`, wired through initial state plus game/exam route legacy backfill, documented in `docs/RELATIONSHIP_LEDGER_CONTRACT.md`, and covered by `test/relationshipLedger.test.js` plus an AI schema rejection test. Verified `node --check src/game/relationships.js`, `node --check src/game/initialState.js`, `node --check src/routes/game.js`, `node --check src/routes/exam.js`, `node --check test/relationshipLedger.test.js`, `node --check test/aiSchemas.test.js`, focused `node --test` runs for relationship ledger and AI schemas, `git diff --check`, and `npm test` with 35 passing tests.
- 2026-05-05: S22.2 controlled relationship suggestion/prompt integration committed as `e5d2d51`, implemented in `src/game/relationships.js`, `src/ai/schemas.js`, `src/ai/prompts.js`, `src/routes/game.js`, and Mock provider output shape. Added `test/gameTurnRelationships.test.js`, expanded relationship ledger tests and AI schema tests, and documented the new contract in README, architecture, product brief, and relationship ledger contract. Verified `node --check` for changed runtime/test files, focused `node --test` runs for relationship ledger, AI schemas, and game turn relationship route coverage, `git diff --check`, and `npm test` with 39 passing tests.
- 2026-05-05: S22.3 Mock NPC/faction reactions implemented in `src/ai/providers/mock.js`, with browser `[人脉]` feedback in `public/app.js` and `public/styles.css`, plus route/direct Mock coverage in `test/mockRelationshipReactions.test.js`. Verified `node --check src/ai/providers/mock.js`, `node --check public/app.js`, `node --check test/mockRelationshipReactions.test.js`, focused relationship tests, `git diff --check`, and `npm test` with 41 passing tests.
- 2026-05-05: S23.1 local magistrate identity loop committed as `9adef5f`, implemented in `src/game/initialState.js`, `src/game/stateRules.js`, `src/ai/schemas.js`, `src/ai/prompts.js`, `src/ai/providers/mock.js`, `public/app.js`, and `test/magistrateRole.test.js`. Verified `node --check` for changed runtime/test files, focused `node --test` runs for magistrate, AI schema, and Mock relationship coverage, `git diff --check`, and `npm test` with 45 passing tests.
- 2026-05-05: S23.2 general identity loop implemented in `src/game/initialState.js`, `src/game/stateRules.js`, `src/ai/schemas.js`, `src/ai/prompts.js`, `src/ai/providers/mock.js`, `public/app.js`, and `test/generalRole.test.js`. Verified `node --check` for changed runtime/test files, focused `node --test` runs for general, AI schema, and magistrate coverage, `git diff --check`, and `npm test` with 49 passing tests.
- 2026-05-05: README was rewritten for GitHub publishing with a clear project overview, main updates, fixes/quality notes, technology stack, setup, configuration, API overview, structure, and documentation links. Verification for this publishing slice: `git diff --check` and `npm test` with 49 passing tests.

## Next Recommended Step

Recommended next step is S23.3: deepen the official identity loop while preserving the complete scholar -> official path, Mock default playability, and existing relationship ledger boundaries.
