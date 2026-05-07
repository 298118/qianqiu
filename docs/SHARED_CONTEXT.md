# Shared AI Development Context

This is the compact handoff board shared by Codex and Claude Code. Detailed history lives in `docs/DEVELOPMENT_STEPS.md`, phase archives, and focused contract documents.

## Read First

Every development session must read these files before planning or editing:

1. `AGENTS.md` or `CLAUDE.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

Stable governance is protected in `docs/DEVELOPMENT_GOVERNANCE.md`; do not weaken it when rewriting handoff, roadmap, or brief files.

## Current Snapshot

- Product: browser + Node.js historical simulation text game **Qianqiu / 千秋**.
- Runtime target: `npm install && npm start`, then open `http://localhost:3000`.
- Frontend: plain HTML/CSS/JS, no build step.
- Backend: Node.js + Express, plain JavaScript.
- AI providers: adapter-based Mock/OpenAI/DeepSeek/Anthropic. `AI_PROVIDER=mock` remains the default playable mode. DeepSeek supports task-specific model overrides: V4 Pro is recommended for opening/grading, and V4 Flash for ordinary turn/streaming/question generation.
- Storage: `src/storage/sessionStore.js` is the route-facing facade. Default adapter is `src/storage/jsonSessionAdapter.js`, storing JSON session records under `data/sessions/*.json` with schema envelope, redacted metadata, nested `worldState`, atomic temp writes, revision checks, and per-session lock. Optional `src/storage/sqliteSessionAdapter.js` is selected by `STORAGE_ADAPTER=sqlite`, using local `world_sessions` rows and JSON `world_state_json`; local audit records use JSON sidecars or SQLite `event_log` / `ai_change_proposals`. JSON remains default. No remote save, account, multiplayer, cloud sync, or hosted DB scope.
- Active roadmap: local dynamic database specialty in `docs/DEVELOPMENT_STEPS.md`. S49-S53 foundation is complete and archived in `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`; active work now starts at S54, splitting remaining geography, people, official posting, and safe event data into local SQLite business tables while preserving JSON/default route contracts.
- Current local `.env`: configured for DeepSeek with a real user-supplied key and task model split. `.env` is ignored by Git and must never be printed or committed.

## Core Invariants

- Keep the complete scholar path working: `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`.
- Providers may suggest narrative, bounded `statePatch`, relationship changes, scoring JSON, and exam triggers. The server owns promotion, exam entry rules, anti-cheat penalties, persistence, protected state fields, official appointments, long-term system effects, time advancement, database writes, and visibility filtering.
- Validate AI JSON before applying it. State changes must go through whitelists, clamps, and server-owned follow-up modules.
- `GET /api/game/saves` must expose redacted metadata only. Full saves are read through `GET /api/game/state/:sessionId`.
- Local playability cannot depend on real model keys. Keyed provider checks must skip or fail in controlled, documented ways when keys are absent.
- Every coherent change must update this handoff and the step ledger, run relevant verification, and be committed.
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。

## Subagent Discipline

- The user has authorized Codex and Claude Code to use subagents for this repository as durable context.
- Implementation subagents may make scoped patches and run focused verification only.
- Subagents must not run `git add`, `git commit`, `git push`, or create PRs.
- The main agent owns integration, docs, final verification, and the single coherent commit.
- Any coherent change containing code, tests, runtime behavior, API/schema changes, prompts, or verification tooling requires at least one read-only pre-commit subagent review of the final diff and verification evidence.
- Pure documentation-only changes may skip that review gate only when low risk, and the skip must be recorded. For roadmap rewrites with content-safety risk, prefer a read-only review even when no code changes.

## Implemented Surface

API:

- `GET /api/health`
- `POST /api/game/start`
- `GET /api/game/saves`
- `GET /api/game/state/:sessionId`
- `POST /api/game/turn`
- `POST /api/ai/connection-test`
- `POST /api/exam/question`
- `POST /api/exam/progress`
- `POST /api/exam/submit`

Important modules:

- AI adapters/prompts/schemas: `src/ai/`
- Prompt-pack contracts: `src/ai/promptPacks.js`
- Prompt context assembler: `src/ai/promptContextAssembler.js`
- AI diagnostics: `src/ai/diagnostics.js`, `src/routes/ai.js`
- State boundary/clamping: `src/game/stateRules.js`
- Time helpers / 时间基础: `src/game/time.js`
- Initial state and allowed roles: `src/game/initialState.js`
- Exam rules: `src/game/exams.js`
- Exam scene time / 科场局部时间: `src/game/examSceneTime.js`
- Exam calendar/rivals: `src/game/examCalendar.js`
- Essay authenticity checks: `src/game/essayChecks.js`
- Promotion rules: `src/game/promotions.js`
- Relationship ledger/views: `src/game/relationships.js`
- Active NPC requests: `src/game/activeRequests.js`
- Long-term events: `src/game/longTermEvents.js`
- Official career outcomes: `src/game/officialCareer.js`
- Static geography seed catalog: `src/game/worldGeographySeeds.js`
- Per-session geography ledger / 天下地理账本: `src/game/worldGeography.js`
- World People schema/bridge: `src/game/worldPeopleSchemas.js`, `src/game/worldPeople.js`
- Official Posting schema/bridge: `src/game/officialPostingSchemas.js`, `src/game/officialPostings.js`
- Event archive view / 事件档案安全 projection: `src/game/eventArchive.js`
- Role/world coupling: `src/game/roleWorldCoupling.js`
- World Entities / 多实体世界模型: `src/game/worldEntities.js`
- World Threads / 世界议程索引: `src/game/worldThreads.js`
- Session storage facade/adapters: `src/storage/sessionStore.js`, `src/storage/jsonSessionAdapter.js`, `src/storage/sqliteSessionAdapter.js`, `src/storage/sessionRecord.js`, `src/storage/sessionAudit.js`
- Local audit builders: `src/game/audit.js`
- SSE helpers: `src/utils/sse.js`, `src/utils/streamingJson.js`
- Browser app: `public/index.html`, `public/app.js`, `public/styles.css`

Durable contracts and acceptance records:

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_ACCEPTANCE.md`
- `docs/BROWSER_INFORMATION_PANEL_PLAN.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/REAL_PROVIDER_ACCEPTANCE.md`
- `docs/SESSION_STORAGE_MIGRATION_PLAN.md`
- `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`
- `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`
- `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`
- `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`
- `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`
- `docs/OFFICIAL_CAREER_CONTRACT.md`
- `docs/EXAM_CALENDAR_CONTRACT.md`
- `docs/ROLE_WORLD_COUPLING_CONTRACT.md`
- `docs/WORLD_ENTITIES_CONTRACT.md`
- `docs/WORLD_THREADS_CONTRACT.md`
- `docs/AI_CONTROL_AUDIT_MATRIX.md`
- `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`
- Historical archives: `docs/QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md`, `docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md`, `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`, `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`

## Archived S48 Time Project

- S48 time-specialty work is complete and archived in `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`.
- Ordinary global turns now advance by ten-day periods: `上旬 -> 中旬 -> 下旬 -> 下月上旬`; full monthly settlement only happens on lower-to-next-month rollover.
- `worldState.tenDayPeriod` is server-owned; old saves default to 上旬; browser surfaces display “年月旬”.
- Exam writing uses `activeExam.sceneTime` and `/api/exam/progress`; scene-local actions do not advance global turn/month/ten-day period.
- Future dense scenes such as court debates, hearings, combat, travel incidents, and assignment finales should use scene-local time instead of forcing one input to equal ten days.

## Archived S49-S53 Database Foundation

Detailed foundation notes are compressed into `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`.

Completed scope:

- S49: local database plan, storage adapter facade, optional SQLite session row, JSON import, event log and AI proposal audit.
- S50: geography seed catalog, per-session `worldGeography`, `worldGeographyView`, and prompt summary.
- S51: NPC/household/asset/estate/relationship schema, `worldPeople` visible bridge, `worldPeopleView`, and prompt summary.
- S52: official bureau/office/jurisdiction/posting/assessment/transfer schema, `officialPostings` visible bridge, `officialPostingsView`, and prompt summary.
- S53: retrieval-style prompt context assembler, browser information panel plan,局势簿 shell, geography/posting/people/official/event archive panels, and safe `eventArchiveView`.

Stable safety decisions:

- JSON default and Mock playability stay protected.
- SQLite scope is local-only; no remote saves, accounts, multiplayer, cloud conflict resolution, or hosted database.
- AI cannot execute SQL or directly write business tables; server modules own schema, clamp, visibility, promotion, appointment, event, and transaction rules.
- Prompt/UI read server-built projections only. Raw audit, provider proposals, prompts, local paths, keys, hidden notes, hidden intent, hidden relationships, and undisclosed postings stay out of player-facing payloads.

## Active Local Database Project

Current active roadmap: S54-S59 in `docs/DEVELOPMENT_STEPS.md`.

Next planned slices:

- S54.1: define geography SQLite business table contract for countries, regions, cities, routes, frontier zones, and office jurisdictions.
- S54.2/S54.3: persist geography business rows in SQLite mode and add import/repair/export plus JSON/SQLite `worldGeographyView` parity.
- S55: define and persist people/household/asset/estate/relationship tables while preserving hidden filtering and existing relationship lifecycle.
- S56: define and persist official posting tables, preserving server-owned appointments and scholar -> official continuity.
- S57: add a safe event index/projection for event archive and prompt retrieval without exposing raw audit.
- S58: let `promptContextAssembler` use SQLite indexes in SQLite mode while keeping JSON fallback and hidden-row tests.
- S59: harden full JSON/SQLite integration, then compress the completed S54+ details into a future archive.

## Current Work Note

- 2026-05-07：数据库专项规划压缩提交 `5ab5350`。S49-S53 已完成基础归档到 `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`，活动台账改为 S54-S59 剩余 SQLite 业务表拆分，并已同步 README、产品 brief、architecture、动态数据库规划、相关契约和本交接板。该变更为纯文档，但涉及路线图重写和内容保护，已运行 `npm run check:docs-governance`、`git diff --check` 并执行只读复审；复审 P2 已修正。后续从 S54.1 地理 SQLite 业务表契约开始。

## Next Recommended Step

Finish the current documentation compression commit, then start S54.1: geography SQLite business table contract. Keep JSON/default Mock playability, SQLite local-only scope, AI-no-SQL, and route-view-only browser/prompt surfaces as the baseline.
