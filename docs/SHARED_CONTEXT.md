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
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。

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
- World Entities / 多实体世界模型: `src/game/worldEntities.js`
- World Threads / 世界议程索引: `src/game/worldThreads.js`
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
- `docs/QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md` 和 `docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md` 是按需查阅归档；日常启动跳过，只有追溯旧实现笔记或旧验证细节时再读。

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

## Current S42 Notes

- S42.1 defines the deep official-career contract in `docs/OFFICIAL_CAREER_CONTRACT.md`.
- S42.2 implementation commit is `9980c6e`. It centralizes static offices/bureaus in `src/game/officialCatalog.js`; `worldState.officialCareer.schemaVersion = 2` adds `bureauId`, `assignments`, `assessmentDossier`, and `impeachmentProcedure` while normalizing old v1 state.
- `runOfficialCareerStep(worldState, input)` now classifies official actions for relief, land survey, case review, riverworks, military supply, salt transport, exam supervision, memorial drafting, personnel review, transfer/outpost requests, mourning leave, restoration, and impeachment/audit. These actions advance server-owned assignments, assessment notes, and impeachment stages before any canonical settlement outcome.
- Important field boundary: `player.officeTitle` is the server-owned concrete office; `player.position` is a soft posture/narrative location; `worldState.officialCareer.currentPosting` is the normalized server-owned career location used by views.
- Official-player `player.position` provider patches are filtered when they look like real office appointments, closing the S42.1 hidden-appointment gap while preserving soft posture text.
- `officialCareerView` exposes `bureau`, `assignmentSummary`, visible `assignments`, `assessment`, `networkSummary`, and `procedureSummary`; hidden assignment/procedure notes do not enter prompt summaries or player-facing views.
- S42.3 expands the browser official-career panel from that view. `#official-career-panel` now has scan-friendly 官署、差事、考成、关系与风险、履历档案 sections and stable selectors/data attributes for browser smoke: `data-current-posting`, `data-impeachment-stage`, `data-bureau-id`, `data-assignment-*`, `data-pending-recommendation`, and `data-outcome-*`.
- AI may generate narrative, memorial/letter tone, rumors, visible reactions, and bounded meter suggestions, but must not decide appointments, dismissals, assessment results, discipline, restoration, or hidden-information disclosure.

## Current S43 Notes

- S43.1 adds `docs/WORLD_THREADS_CONTRACT.md` and `src/game/worldThreads.js`.
- `worldState.worldThreads.schemaVersion = 1` is a server-owned derived issue ledger with capped `threads` and `recentResolved`; legacy/missing state is normalized without bumping the storage envelope.
- Current thread sources are active NPC requests, long-term events, official assignments, official outcomes, role/world impacts, frontier pressure, faction pressure, and local case pressure.
- `worldThreadView` is returned by game start/state/turn and exam question/submit routes, and `summarizeWorldThreadsForPrompt()` is included in `compactWorldState()` as `worldThreads`.
- S43.2 enriches visible threads with `goal`, `deadlineLabel`, `riskLabel`, `riskTone`, `relatedLabels`, `interventionHints`, and `followUpHint`, then renders them in the browser as `#world-thread-panel`.
- Providers may read visible thread summaries for narrative context, but ordinary `statePatch.worldThreads` is rejected/ignored like other server-owned ledgers. Hidden thread rows, hidden relationship data, and official hidden notes are excluded from views and prompt summaries.
- The browser panel only suggests free-text intervention directions and recent resolved rows; it does not add one-click resolution or replace active request, long-term event, official-career, or role/world coupling settlement.

## Current S44 Notes

- S44.1 adds `docs/AI_CONTROL_AUDIT_MATRIX.md` as the system-level AI authority matrix.
- The matrix defines AI permissions as 可生成、可建议、可排序、可评分、可解释、不可写、不可裁决, and keeps “model may influence” separate from “server persists/decides.”
- Covered systems: AI diagnostics, opening, ordinary turns, SSE streaming, world tick, exam trigger, exam question, exam grading, virtual candidates/ranking, relationships, active NPC requests, long-term events, official career, role/world coupling, World Threads, saves, hidden information, and browser display.
- Current threat model remains local development/same-machine browser. Game state routes still return full `worldState`; player-facing UI must use server-built views for hidden filtering. A future remote/untrusted-client deployment needs a redacted state API.
- Ordinary real-provider calls may fallback to Mock for local playability. Route-level connection diagnostics and provider smoke scripts remain the authority for real-provider configuration health.
- S44.2 adds the first red-team/eval baseline. `test/aiControlRedTeam.test.js` covers mixed overreach provider bundles, hidden relationship targets, illegal exam triggers, provider-owned exam candidates/rankings, local anti-cheat vs AI grading conflicts, severe cheating blocking promotion, and streaming failure no-persist behavior.
- `src/game/stateRules.js` now normalizes more hallucinated official appointment strings in provider `player.position` patches, including whitespace, traditional variants, and common English title phrases.
- `src/ai/diagnostics.js` redacts long configured key fragments, and `src/routes/game.js` redacts SSE `error` messages before sending provider failures to the browser.

## Current S45 Notes

- S45.1 adds `docs/WORLD_ENTITIES_CONTRACT.md` and `src/game/worldEntities.js`.
- `worldState.worldEntities.schemaVersion = 1` is a server-owned multi-entity ledger for 朝廷衙门、地方士绅、书院同门、军镇边墙、商税盐漕 and 灾荒赈务.
- Initial entities cover 吏部、户部、都察院、地方士绅、河工案牍、县学书院、同年文社、边镇军镇、边墙堡寨、盐漕通道、田赋商税 and 灾荒赈务. Entity metrics are game-facing pressure/capacity/trust/deficit indicators clamped to `0..100`, not historical quantitative claims.
- Game and exam routes return `worldEntityView`; prompt `compactWorldState()` includes capped visible `worldEntities` summaries. Hidden entities and `hiddenNotes` do not enter views or prompt summaries.
- S45.2 adds server-owned `deriveWorldEntityInfluences()` / `applyWorldEntityInfluences()` and turn `worldEntityImpacts`. Allowed provider state changes can influence entities only after the route compares applied before/after state; provider `statePatch.worldEntities` remains rejected or ignored by schema/eval/remote normalization/state boundary/route red-team tests.
- World tick, visible relationships, active NPC requests, long-term events, role/world coupling, and official-career events/outcomes now feed bounded entity pressure/trust/capacity changes. World Threads can derive high-pressure `world_entity` threads and include `relatedEntitySummaries` from visible `worldEntityView` only.
- S45 still does not add a browser entity panel or let entities replace source-system settlement. `role_visible` currently behaves like non-hidden visibility until a later role-scoped view cut.

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

- 2026-05-07: S45.2 implementation/docs commit is `24aef7b`. Added server-owned world-entity influence derivation/application, turn `worldEntityImpacts`, high-pressure `world_entity` World Threads, and visible `relatedEntitySummaries` on threads. Verification passed: focused `node --check`, focused world-entity/world-thread/route/prompt/state-boundary tests, `npm run eval:ai`, `$env:AI_PROVIDER='mock'; npm test` with 252 tests, and `git diff --check`. Read-only explorer Sartre mapped S45.2 integration points without editing files or running Git writes. Read-only pre-commit review by Volta found one P1 hidden `world_entity` source leak through legacy thread `sourceId`/`recentResolved`; `normalizeThread()`, `normalizeResolvedThread()`, and view `related.entities` now require visible entity sources, regression coverage was added, and follow-up review approved the diff for commit. Follow-up documentation-only hash backfill is low risk and skips subagent review; verification is `git diff --check`.
- 2026-05-07: S45.1 implementation/docs commit is `7341990`. Added `worldEntities` server-owned ledger, `worldEntityView`, prompt summaries, S45 contract docs, and tests for hidden filtering plus provider forge rejection. Verification passed: focused `node --check`, focused world-entity/state/prompt/route/AI-boundary tests, `npm run eval:ai`, `node --test test\examTravel.test.js`, `node --test test\gameTurnLongTermEvents.test.js`, `$env:AI_PROVIDER='mock'; npm test` with 247 tests, and `git diff --check`. Full-suite runs hit two transient Windows atomic rename failures (`ENOENT` in `test\examTravel.test.js`, then `EPERM` in `test\gameTurnLongTermEvents.test.js` after a small view hardening patch); focused reruns and the final full rerun passed. Read-only explorer Socrates mapped integration points without editing files or running Git writes. Read-only pre-commit review by Ampere found no blockers; residual risk is that `role_visible` currently behaves like non-hidden visibility until S45.2 adds role-scoped filters. Follow-up documentation-only hash backfill is low risk and skips subagent review; verification is `git diff --check`.
- 2026-05-07: S44.2 implementation/docs commit is `43c610c`. Added `test/aiControlRedTeam.test.js`, S44 mixed authority eval fixtures, stronger official-position forgery guards, key-fragment redaction, and SSE provider-error redaction. Verification passed: focused `node --check`, focused S44/state/diagnostics/eval/streaming/exam/official/relationship/world-thread tests, `npm run eval:ai`, `$env:AI_PROVIDER='mock'; npm test` with 240 tests, and `git diff --check`. Read-only explorer Leibniz mapped existing coverage and highlighted SSE error redaction plus exam-question sanity clamp as risks; SSE error redaction was fixed in this slice, while exam-question route-level clamp remains a future hardening item. Read-only pre-commit review by Ohm found no blockers, ran `node --test test\aiControlRedTeam.test.js test\stateRules.test.js test\aiDiagnostics.test.js test\aiEvalFixtures.test.js` with 26 tests passing, and approved the S44.2 diff for commit. Follow-up documentation-only hash backfill is low risk and skips subagent review; verification is `git diff --check`.
- 2026-05-07: S44.1 documentation matrix commit is `91da506`. Added `docs/AI_CONTROL_AUDIT_MATRIX.md`, linked it from README/architecture/product brief, and updated the roadmap. Verification: `git diff --check`. This is documentation-only; no code tests were run. Read-only exploratory subagent Banach mapped the existing AI/server boundary evidence and S44.2 test gaps without editing files or running Git writes. Read-only pre-commit review by Gibbs found one P3 wording gap around browser raw `worldState` fallback; the matrix now states that fallback is only for old payload/development compatibility and adds it to S44.2 hidden-leak coverage. A follow-up documentation-only hash backfill commit was low risk and skipped subagent review; verification was `git diff --check`.
- 2026-05-07: S43.2 implementation/docs commit is `5c8310a`. `worldThreadView` now derives goal/deadline/risk/related/intervention/follow-up fields; the browser renders `#world-thread-panel` from the route view only; browser smoke helpers assert card selectors, field completeness, hidden text leaks, and world-thread overflow. Verification passed: focused `node --check`, focused world-thread/browser-smoke/route/prompt/schema/provider tests, `npm run eval:ai`, `$env:AI_PROVIDER='mock'; npm run smoke:browser` with `world-thread` UI acceptance and 14 screenshots, and final `$env:AI_PROVIDER='mock'; npm test` with 234 tests. One interim full rerun hit Windows `EPERM rename`; focused `test\gameTurnTick.test.js` and the following full rerun passed. Read-only explorer Carson mapped the front-end and smoke-test entry points without editing files or running Git writes. Read-only pre-commit review by Hooke found one P3 smoke selector gap for `data-risk`; it was fixed with stricter selector coverage and follow-up review approved. A follow-up documentation-only hash backfill commit was low risk and skipped subagent review; verification was `git diff --check`.
- 2026-05-07: S43.1 implementation/docs commit is `301ff98`. Added `src/game/worldThreads.js`, `docs/WORLD_THREADS_CONTRACT.md`, `worldState.worldThreads`, `worldThreadView` route payloads, prompt `worldThreads` summaries, and provider/server boundary tests forbidding ordinary `statePatch.worldThreads`. Verification passed: focused `node --check`, `node --test test\worldThreads.test.js` with 5 tests, `node --test test\gameTurnWorldThreads.test.js`, focused state/schema/prompt/provider tests, `npm run eval:ai`, focused turn integration tests, `$env:AI_PROVIDER='mock'; npm test` with 232 tests, and `git diff --check`. Read-only exploratory subagent Wegener mapped S43.1 integration points and did not edit files or run Git writes. Read-only pre-commit review by Arendt found one P1 leak where legacy hidden `recentResolved` rows could surface; `normalizeResolvedThread()` now drops hidden rows, regression coverage was added, and follow-up review approved the fix. A follow-up documentation-only hash backfill commit was low risk and skipped subagent review; verification was `git diff --check`.
- 2026-05-06: 压缩必读上下文：`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 的 S11-S38.3 历史实现笔记迁入 `docs/QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md`；`docs/DEVELOPMENT_STEPS.md` 的第四阶段早期详细进度记录迁入 `docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md`。日常启动仍只读四件套，归档文件只在追溯旧决策或旧验证时读取。低风险纯文档搬迁，跳过提交前只读子代理审查；验证：`git diff --check`。
- 2026-05-06: 纯文档开发规范更新已把“项目输出优先中文”写入 `AGENTS.md`、`CLAUDE.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `docs/DEVELOPMENT_STEPS.md`。这是低风险纯文档改动，跳过提交前只读子代理审查；验证：`git diff --check`。
- 2026-05-06: S40.1-S40.2 implementation/docs commit is `7927c02`. Verification passed: focused `node --check`, focused AI diagnostics/provider tests, `$env:AI_PROVIDER='mock'; npm test` with 197 tests, DeepSeek no-session diagnostic through ignored `.env` with `ok=true`, `$env:AI_PROVIDER='mock'; npm run smoke:browser`, and `git diff --check`. Read-only pre-commit subagent review found no blocking issues. Residuals: browser smoke does not yet click the `AI 连接` button, and error redaction covers exact configured secret values rather than transformed/partial variants.
- 2026-05-06: Added a documentation-only S47.2 planning update for DeepSeek context caching. Based on the official docs, cache hits depend on fully reused persisted prefixes and usage reports hit/miss tokens. The project plan now says to stabilize prompt prefixes and collect cache telemetry without sacrificing game effect. Pre-commit subagent review skipped as low-risk documentation-only; `git diff --check` is sufficient.
- 2026-05-06: S41.1 implementation commit is `383881a`. Verification passed: focused `node --check`, `node --test test\prompts.test.js`, `node --test test\aiEvalFixtures.test.js`, `node --test test\remoteHelpers.test.js`, `node --test test\deepseekProvider.test.js`, `npm run eval:ai`, focused `node --test test\examTravel.test.js`, `$env:AI_PROVIDER='mock'; npm test` rerun with 201 tests, and `git diff --check`. First full-suite run had one transient `test\examTravel.test.js` 500/200 failure that did not reproduce in focused or full reruns. Read-only pre-commit subagent review found no blockers; its two P3 notes were addressed before commit.
- 2026-05-06: S41.2 implementation commit is `2c45949`. Verification passed: `node --check testdata\aiEvalFixtures.js`, `node --check test\aiEvalFixtures.test.js`, `node --check test\prompts.test.js`, `node --test test\prompts.test.js`, `node --test test\aiEvalFixtures.test.js`, `npm run eval:ai`, `node --test test\remoteHelpers.test.js test\deepseekProvider.test.js`, `$env:AI_PROVIDER='mock'; npm test` with 207 tests, and `git diff --check`. Read-only pre-commit subagent review found no blockers; its three P3 notes were addressed before commit.
- 2026-05-06: S42.1 contract/documentation commit is `fd4b805`. It defines the deep official-career domain and syncs README, architecture, product brief, roadmap, and handoff. Verification passed: `node --test test\officialCareer.test.js test\officialRole.test.js test\gameTurnOfficialCareer.test.js test\examRules.test.js test\gameStartRole.test.js` with 23 tests, and `git diff --check`. A read-only exploratory subagent checked existing official-career code/UI/tests and scholar -> official constraints before edits; a separate read-only pre-commit review found no blockers.
- 2026-05-06: S42.2 implementation commit is `9980c6e`. Verification passed: `node --check src\game\officialCareer.js`, `node --check src\game\officialCatalog.js`, `node --check src\game\stateRules.js`, focused `node --test test\officialCatalog.test.js test\officialCareer.test.js test\officialRole.test.js test\gameTurnOfficialCareer.test.js test\stateRules.test.js` with 28 tests, `$env:AI_PROVIDER='mock'; npm test` with 219 tests, and `git diff --check`. Read-only pre-commit review found one P1 `player.position` forgery gap; it was fixed with normalized office-title filtering and added tests, and follow-up review approved.
- 2026-05-06: S42.3 renders the S42.2 `officialCareerView` into expanded browser 官场档案 sections, extends official-career smoke helpers/tests, and documents the S42.3 browser contract. Verification for this slice: `node --check public\app.js`, `node --check scripts\browserSmoke.js`, `node --test test\browserSmokeScript.test.js` with 26 tests, `$env:AI_PROVIDER='mock'; npm run smoke:browser` with 14 screenshots checked, `$env:AI_PROVIDER='mock'; npm test` with 222 tests, and `git diff --check`. Initial pre-commit review found smoke gaps around assignment kind/status correlation and placeholder official sections; both were fixed with record-level assignment checks and `data-view-ready` assertions. One first full-suite rerun hit a transient Windows `EPERM rename`; focused `test\examTravel.test.js` and the following full rerun passed.

## Next Recommended Step

Start S46.1 dependency/plugin governance template or a small S45 follow-up for role-scoped entity visibility/UI noise control.
