# Shared AI Development Context

This file is the handoff board shared by Codex and Claude Code.

Both tools must read this file at the start of every development session, after reading their own instruction file. Both tools must update this file whenever they make a meaningful project change, so the other tool can immediately see the current state without relying on chat history.

## Current Snapshot

- Repository status: phase-one playable vertical slice is implemented and accepted for the default Mock path. The app installs with npm, starts an Express server, serves a polished plain HTML/CSS/JS frontend, can create/read/Mock-play a scholar session with richer daily scholar actions, complete the scholar exam path into official status, play basic Mock loops for emperor, minister, and officials, stream turn feedback over SSE, and optionally use OpenAI, DeepSeek, or Claude providers with Mock fallback.
- Canonical product brief: `docs/QIANQIU_DEVELOPMENT_BRIEF.md`.
- Shared implementation roadmap and progress ledger: `docs/DEVELOPMENT_STEPS.md`.
- Developer implementation map: `docs/ARCHITECTURE.md`.
- Phase-one acceptance record: `docs/PHASE_ONE_ACCEPTANCE.md`.
- Codex entrypoint: `AGENTS.md`.
- Claude Code entrypoint: `CLAUDE.md`.
- Default development target: runnable Node.js + Express + pure HTML/CSS/JS game at `http://localhost:3000`.
- Default AI mode: `mock`, playable without API keys.
- Implemented API surface: `GET /api/health`, `POST /api/game/start`, `GET /api/game/state/:sessionId`, `POST /api/game/turn`, `POST /api/exam/question`, `POST /api/exam/submit`.
- Local session files are written under `data/sessions/*.json`, which remains ignored by Git.

## Active Decisions

- Use one shared context file for both Codex and Claude Code: `docs/SHARED_CONTEXT.md`.
- Use one shared step ledger for both Codex and Claude Code: `docs/DEVELOPMENT_STEPS.md`.
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

## Next Recommended Step

Phase one is accepted for Mock mode and S04.4 SSE streaming is now implemented. Recommended next step is to define the phase-two roadmap, with likely candidates:

- Add browser automation or screenshot-based UI acceptance once a browser runner is available.
- Expand general and magistrate Mock role loops.
- Run real-provider smoke tests when API keys are available.
