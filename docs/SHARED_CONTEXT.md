# Shared AI Development Context

This is the handoff board shared by Codex and Claude Code. It is intentionally compact; detailed history lives in `docs/DEVELOPMENT_STEPS.md`, phase archives, and focused contract documents.

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
- AI providers: adapter-based Mock/OpenAI/DeepSeek/Anthropic. `AI_PROVIDER=mock` remains the default playable mode.
- Storage: JSON session records under `data/sessions/*.json`, currently using a `storageSchemaVersion: 1` envelope with redacted metadata, nested `worldState`, atomic temp writes, revision checks, and a per-session local lock file.
- Active roadmap: third phase in `docs/DEVELOPMENT_STEPS.md`; S39.1 audit hardening is implemented in `b344217`.
- Latest review artifact: `docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md`.
- Latest committed review baseline before S39: `9fa4b26 docs: record pre-phase codebase review`.

## Core Invariants

- Keep the complete scholar path working: `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`.
- Providers may suggest narrative, bounded `statePatch`, relationship changes, scoring JSON, and exam triggers. The server owns promotion, exam entry rules, anti-cheat penalties, persistence, protected state fields, and long-term system effects.
- Validate AI JSON before applying it. State changes must go through whitelists, clamps, and server-owned follow-up modules.
- `GET /api/game/saves` must expose redacted metadata only. Full saves are read through `GET /api/game/state/:sessionId`.
- Local playability cannot depend on real model keys. Keyed provider checks must skip successfully when keys are absent.
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
- `POST /api/exam/question`
- `POST /api/exam/submit`

Important modules:

- AI adapters/prompts/schemas: `src/ai/`
- State boundary/clamping: `src/game/stateRules.js`
- Initial state and allowed roles: `src/game/initialState.js`
- Exam rules: `src/game/exams.js`
- Exam calendar/rivals: `src/game/examCalendar.js`
- Exam travel/preparation: `src/game/examTravel.js`
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

- S31: desktop game-state layout repair, ordinary-turn server-owned field boundary, explicit start-role validation.
- S32: visible relationship inspection view, browser relationship panel, server-owned active NPC request loop.
- S33: server-owned long-term event scheduler.
- S34: official career outcome engine.
- S35: exam calendar windows and persistent same-field rivals.
- S36: role/world coupling feedback and server-owned effects.
- S37: keyed real-provider long-run acceptance script.
- S38.1: complete browser scholar-to-official journey plus cheating sample.
- S38.2: JSON storage envelope, atomic writes, per-session mutation queue, save-list API.
- S38.3: browser save-list UI and smoke coverage.
- Pre-S39: read-only codebase review recorded nine security/state/streaming/storage findings.
- S39.1: fixed the pre-phase audit findings around CORS, `examTrigger`, streaming narrative safety, failed-SSE rollback, hidden relationship notes, role/world cooldowns, initial year clamping, and JSON revision/lock behavior.

## Current S39 Hardening Result

S39.1 addresses `docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md` before new feature work.

Runtime changes:

- `server.js` now uses a restrictive default CORS policy. Extra development origins use `CORS_ALLOWED_ORIGINS`.
- `/api/game/turn` now validates ordinary-turn `examTrigger` through `canEnterExam()` and `canOpenExamInCalendar()`, and cannot overwrite an active writing exam.
- `src/utils/streamingJson.js` extracts only the top-level `narrative`; nested fields are ignored.
- `public/app.js` removes pending streamed text if SSE ends with `error` or without `final_state`.
- Visible-only relationship summaries filter hidden-entry recent notes before prompt/UI exposure.
- Role/world coupling cooldowns are checked before applying repeated same-kind effects.
- Initial years are clamped through `stateRules` before persistence.
- JSON writes acquire a per-session lock, reread the latest disk revision, and reject stale expected revisions before atomic replacement.
- `scripts/browserSmoke.js` now covers failed-SSE rollback in the browser.
- `test-helpers/fetchSafeServer.js` includes Fetch blocked port `4190`, found during full CORS test verification.

Verification for S39.1 commit `b344217`:

- Focused `node --check` for changed runtime/test files.
- Focused `node --test` for CORS, exam triggers, streaming JSON/SSE, relationships, role-world coupling, start roles, and session storage passed with 55 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm run smoke:provider` and `npm run smoke:provider:long` skipped successfully because no real-provider keys are configured.
- `npm test` passed with 185 tests.
- `npm run smoke:browser` passed with failed-SSE rollback coverage, complete scholar-to-official path, cheating sample, role-world journeys, and 14 screenshots checked.
- `git diff --check` passed.
- Read-only pre-commit review found no blocking issues. Residual risks: JSON lock files remain local-filesystem best effort, failed-SSE rollback is smoke-covered rather than unit-covered, and any configured CORS extra Origin is trusted to read local APIs.

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

## Current Publish Note

- 2026-05-06: README has been rewritten in the current README publish commit as a GitHub-facing project overview through third phase S39.1, covering main updates, fixes, hardening, technology stack, setup, APIs, verification commands, documents, and known limitations. This is documentation-only publish prep; pre-commit subagent review was skipped as low risk and recorded here.

## Next Recommended Step

Push the current `main` branch to GitHub after the README refresh commit, then continue with the storage adapter/SQLite boundary from `docs/SESSION_STORAGE_MIGRATION_PLAN.md` or the next long-term simulation depth slice.
