# Shared AI Development Context

This file is the handoff board shared by Codex and Claude Code.

Both tools must read this file at the start of every development session, after reading their own instruction file. Both tools must update this file whenever they make a meaningful project change, so the other tool can immediately see the current state without relying on chat history.

## Current Snapshot

- Repository status: first playable vertical slice is implemented. The app installs with npm, starts an Express server, serves a plain HTML/CSS/JS frontend, and can create/read/Mock-play a scholar session with free-text actions.
- Canonical product brief: `docs/QIANQIU_DEVELOPMENT_BRIEF.md`.
- Shared implementation roadmap and progress ledger: `docs/DEVELOPMENT_STEPS.md`.
- Codex entrypoint: `AGENTS.md`.
- Claude Code entrypoint: `CLAUDE.md`.
- Default development target: runnable Node.js + Express + pure HTML/CSS/JS game at `http://localhost:3000`.
- Default AI mode: `mock`, playable without API keys.
- Implemented API surface: `GET /api/health`, `POST /api/game/start`, `GET /api/game/state/:sessionId`, `POST /api/game/turn`.
- Local session files are written under `data/sessions/*.json`, which remains ignored by Git.

## Active Decisions

- Use one shared context file for both Codex and Claude Code: `docs/SHARED_CONTEXT.md`.
- Use one shared step ledger for both Codex and Claude Code: `docs/DEVELOPMENT_STEPS.md`.
- Every coherent project change must be committed locally with Git.
- The first runtime slice uses Express, CORS, and dotenv only; session ids use Node.js `crypto.randomUUID()` to avoid adding a separate id dependency this early.
- Non-`mock` AI providers are configured but not implemented yet; `src/ai/index.js` falls back to Mock when another provider is requested.
- State patch whitelist: `src/game/stateRules.js` defines allowed patch keys for top-level state and player fields. Only whitelisted fields can be modified by AI output.
- Numerical clamping: all numeric fields have defined min/max ranges in stateRules.js. Patches are clamped after merge.
- Event history: capped at 20 entries, oldest trimmed first.
- `POST /api/game/turn` is non-streaming JSON for now; SSE streaming is S04.4.
- Frontend restores session from localStorage on page load.
- Mock provider `runTurn` recognizes scholar actions: study, teacher visit, travel/social, money/work, exam request, and rest.
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

## Next Recommended Step

Implement the next gameplay slice:

- S06.1-S06.3: Expand Mock provider to better recognize scholar daily actions and update all relevant attributes. Add scholar-specific panel in frontend showing exam progress, stats, teacher, books, connections.
- S07.1: Define exam levels, thresholds, question types, and promotion mappings in `src/game/exams.js`.
