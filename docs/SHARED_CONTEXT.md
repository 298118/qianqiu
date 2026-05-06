# Shared AI Development Context

This is the compact handoff board shared by Codex and Claude Code. Detailed history lives in `docs/DEVELOPMENT_STEPS.md`, phase archives, and focused contract documents.

## Read First

Every development session must read these files before planning or editing:

1. `AGENTS.md` or `CLAUDE.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

## Current Snapshot

- Product: browser + Node.js historical simulation text game **Qianqiu / 千秋**.
- Runtime target: `npm install && npm start`, then open `http://localhost:3000`.
- Frontend: plain HTML/CSS/JS, no build step.
- Backend: Node.js + Express, plain JavaScript.
- AI providers: adapter-based Mock/OpenAI/DeepSeek/Anthropic. `AI_PROVIDER=mock` remains the default playable mode. DeepSeek supports task-specific model overrides: V4 Pro is recommended for opening/grading, and V4 Flash for ordinary turn/streaming/question generation.
- Storage: JSON session records under `data/sessions/*.json`, using a `storageSchemaVersion: 1` envelope with redacted metadata, nested `worldState`, atomic temp writes, revision checks, and a per-session local lock file.
- Active roadmap: fourth phase in `docs/DEVELOPMENT_STEPS.md`; third phase is frozen in `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`.
- Current local `.env`: configured for DeepSeek with a real user-supplied key and task model split. `.env` is ignored by Git and must never be printed or committed.

## Core Invariants

- Keep the complete scholar path working: `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`.
- Providers may suggest narrative, bounded `statePatch`, relationship changes, scoring JSON, and exam triggers. The server owns promotion, exam entry rules, anti-cheat penalties, persistence, protected state fields, official appointments, long-term system effects, and visibility filtering.
- Validate AI JSON before applying it. State changes must go through whitelists, clamps, and server-owned follow-up modules.
- `GET /api/game/saves` must expose redacted metadata only. Full saves are read through `GET /api/game/state/:sessionId`.
- Local playability cannot depend on real model keys. Keyed provider checks must skip or fail in controlled, documented ways when keys are absent.
- Every coherent change must update this handoff and the step ledger, run relevant verification, and be committed.

## Subagent Discipline

- The user has authorized subagents for this repository as durable context.
- Implementation subagents may make scoped patches and run focused verification only.
- Subagents must not run `git add`, `git commit`, `git push`, or create PRs.
- The main agent owns integration, docs, final verification, and the single coherent commit.
- Any coherent change containing code, tests, runtime behavior, API/schema changes, prompts, or verification tooling requires at least one read-only pre-commit subagent review of the final diff and verification evidence.
- Pure documentation-only changes may skip that review gate only when low risk, and the skip must be recorded.

## Implemented Surface

API:

- `GET /api/health`
- `POST /api/game/start`
- `GET /api/game/saves`
- `GET /api/game/state/:sessionId`
- `POST /api/game/turn`
- `POST /api/ai/connection-test`
- `POST /api/exam/question`
- `POST /api/exam/submit`

Important modules:

- AI adapters/prompts/schemas: `src/ai/`
- Prompt-pack contracts: `src/ai/promptPacks.js`
- AI diagnostics: `src/ai/diagnostics.js`, `src/routes/ai.js`
- State boundary/clamping: `src/game/stateRules.js`
- Initial state and allowed roles: `src/game/initialState.js`
- Exam rules: `src/game/exams.js`
- Exam calendar/rivals: `src/game/examCalendar.js`
- Essay authenticity checks: `src/game/essayChecks.js`
- Promotion rules: `src/game/promotions.js`
- Relationship ledger/views: `src/game/relationships.js`
- Active NPC requests: `src/game/activeRequests.js`
- Long-term events: `src/game/longTermEvents.js`
- Official career outcomes: `src/game/officialCareer.js`
- Role/world coupling: `src/game/roleWorldCoupling.js`
- JSON session store: `src/storage/sessionStore.js`
- SSE helpers: `src/utils/sse.js`, `src/utils/streamingJson.js`
- Browser app: `public/index.html`, `public/app.js`, `public/styles.css`

Durable contracts and acceptance records:

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_ACCEPTANCE.md`
- `docs/REAL_PROVIDER_ACCEPTANCE.md`
- `docs/SESSION_STORAGE_MIGRATION_PLAN.md`
- `docs/OFFICIAL_CAREER_CONTRACT.md`
- `docs/EXAM_CALENDAR_CONTRACT.md`
- `docs/ROLE_WORLD_COUPLING_CONTRACT.md`
- `docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md`

## Recent Completed Scope

- S31-S39.1: third-phase layout/state-boundary hardening, relationship UI, active NPCs, long-term events, official-career outcomes, exam calendar, role/world coupling, real-provider long-run script, browser full journey, storage hardening, save-list UI, and pre-phase audit fixes.
- S40.1: third-phase planning archived to `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`; active roadmap reset to fourth phase without changing development rules.
- S40.2: `POST /api/ai/connection-test` added for no-session provider diagnostics; start page now has an `AI 连接` panel and tests cover Mock success, missing real-provider key, error redaction, route behavior, and DeepSeek task-model summaries.

## Fourth-Phase Priorities

- S41: prompt packs and AI orchestration contracts for world turns, opening, exams, grading, official career, court, minister/faction, local magistrate, and frontier/military play.
- S42: deeper official-career gameplay: offices, bureaus, assignments,考成, patronage, same-year networks, impeachment, transfer, promotion, outpost, punishment, and long-term UI/archives.
- S43: World Threads that unify NPC requests, long-term events, official outcomes, role/world coupling, local cases, border affairs, and faction conflicts into trackable cross-month issues.
- S44: AI invocation/control audit matrix defining which systems AI may generate, suggest, sort, or explain, and which remain server-decided.
- S45: multi-entity world model for court offices, local gentry, academies, military fronts, fiscal channels, and disaster relief.
- S46: dependency/plugin governance; allowed when useful, documented, licensed, tested, and reversible.
- S47: provider/browser acceptance expansion around route-level connection tests and explicit keyed health checks.
- S47.2: DeepSeek context-cache planning. Future prompt packs should maximize stable reusable prefixes and record `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`, while never reducing necessary game context or narrative quality just to raise cache hits.

## Current S41 Notes

- S41.1 adds `src/ai/promptPacks.js` as the prompt-pack contract registry for `world_turn`, `opening`, `exam_question`, `exam_grading`, `official_career`, `emperor_court`, `minister_faction`, `local_magistrate`, and `general_frontier`.
- Provider schema names stay unchanged (`opening`, `turn`, `examQuestion`, `grade`) so DeepSeek task model routing and existing JSON schemas are not widened in this step.
- `src/ai/prompts.js` now attaches `promptPack` metadata and uses pack-specific stable instruction prefixes; ordinary turns select role-specific packs by `worldState.player.role`.
- The stable prefix keeps system identity, JSON strictness, server-owned boundaries, hidden-information limits, tone contract, and allowed patch keys ahead of dynamic world state, matching the S47.2 cache plan.
- S41.2 expands offline eval fixtures/red-team cases for prompt-pack outputs, hidden-info leakage, modern terms, strict JSON, and overreach. Runtime provider parsing remains permissive through `parseJsonFromText()`; strict JSON is an eval target for prompt output quality.
- Hidden relationship entries are tested against prompt input for opening, ordinary turns, exam question, and grading tasks. Hidden faction ids may still appear as top-level world/faction state when already part of public world metrics; the hidden-info test is about ledger names, notes, hidden contacts, and hidden intents.

## Verification Defaults

Use focused checks first, then broaden when behavior crosses module boundaries:

- `node --check <changed runtime/test files>`
- `node --test <focused tests>`
- `npm run eval:ai`
- `npm test`
- `npm run smoke:provider` and `npm run smoke:provider:long` for no-key skip/provider checks when relevant.
- `npm run smoke:browser` when browser behavior or full scholar path risk changes.
- `git diff --check`

## Handoff Notes

- Keep this file compressed. Add only state that a future agent needs to decide the next move.
- Put chronological detail in `docs/DEVELOPMENT_STEPS.md`.
- Put stable API/architecture/product changes in README, `docs/QIANQIU_DEVELOPMENT_BRIEF.md`, or the relevant contract file.
- Do not leave decisions only in chat.

## Current Work Note

- 2026-05-06: S40.1-S40.2 implementation/docs commit is `7927c02`. Verification passed: focused `node --check`, focused AI diagnostics/provider tests, `$env:AI_PROVIDER='mock'; npm test` with 197 tests, DeepSeek no-session diagnostic through ignored `.env` with `ok=true`, `$env:AI_PROVIDER='mock'; npm run smoke:browser`, and `git diff --check`. Read-only pre-commit subagent review found no blocking issues. Residuals: browser smoke does not yet click the `AI 连接` button, and error redaction covers exact configured secret values rather than transformed/partial variants.
- 2026-05-06: Added a documentation-only S47.2 planning update for DeepSeek context caching. Based on the official docs, cache hits depend on fully reused persisted prefixes and usage reports hit/miss tokens. The project plan now says to stabilize prompt prefixes and collect cache telemetry without sacrificing game effect. Pre-commit subagent review skipped as low-risk documentation-only; `git diff --check` is sufficient.
- 2026-05-06: S41.1 implementation commit is `383881a`. Verification passed: focused `node --check`, `node --test test\prompts.test.js`, `node --test test\aiEvalFixtures.test.js`, `node --test test\remoteHelpers.test.js`, `node --test test\deepseekProvider.test.js`, `npm run eval:ai`, focused `node --test test\examTravel.test.js`, `$env:AI_PROVIDER='mock'; npm test` rerun with 201 tests, and `git diff --check`. First full-suite run had one transient `test\examTravel.test.js` 500/200 failure that did not reproduce in focused or full reruns. Read-only pre-commit subagent review found no blockers; its two P3 notes were addressed before commit.
- 2026-05-06: S41.2 implementation is pending local commit. Verification passed: `node --check testdata\aiEvalFixtures.js`, `node --check test\aiEvalFixtures.test.js`, `node --check test\prompts.test.js`, `node --test test\prompts.test.js`, `node --test test\aiEvalFixtures.test.js`, `npm run eval:ai`, `node --test test\remoteHelpers.test.js test\deepseekProvider.test.js`, `$env:AI_PROVIDER='mock'; npm test` with 207 tests, and `git diff --check`. Read-only pre-commit subagent review found no blockers; its three P3 notes were addressed before commit.

## Next Recommended Step

After committing S41.2, move to S42.1 official-career depth contract or S44.1 AI control audit matrix. The strongest sequence is probably S42.1 next, with S44.1 before larger AI-controlled world systems.
