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
- AI providers: adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic. `AI_PROVIDER=mock` remains the default playable mode. DeepSeek supports task-specific model overrides; MiMo uses Xiaomi MiMo OpenAI-compatible chat completions with `MIMO_MODEL=mimo-v2.5-pro` for the MiMo-V2.5-Pro 1M long-context model; `AI_PROVIDER=mimo-deepseek` routes start/turn/stream/question to MiMo and essay grading to DeepSeek V4 Pro.
- Storage: `src/storage/sessionStore.js` is the route-facing facade. Default adapter is `src/storage/jsonSessionAdapter.js`, storing JSON session records under `data/sessions/*.json` with schema envelope, redacted metadata, nested `worldState`, atomic temp writes, revision checks, and per-session lock. Optional `src/storage/sqliteSessionAdapter.js` is selected by `STORAGE_ADAPTER=sqlite`, using local `world_sessions` rows and JSON `world_state_json`; S54.2 also syncs normalized geography rows into local `geo_*` tables through `src/storage/sqliteGeographyTables.js`, S55.2 syncs normalized visible `worldPeople` bridge rows into local `people_*` tables through `src/storage/sqlitePeopleTables.js`, S55.3 records server people events with local `people_*.last_event_id` links, S56.2/S56.3 syncs normalized safe `officialPostings` projection rows into local `office_*` tables through `src/storage/sqliteOfficialPostingTables.js`, and S57.1 syncs sanitized `eventArchiveView` rows into local `event_archive_index` through `src/storage/sqliteEventArchiveTables.js`. SQLite read repair still flows one way from `world_sessions.world_state_json` to derived business rows; S56.3/S57.1 add content-hash drift detection for same `row_id` / same revision pollution and old missing-hash rows in `office_*` / `event_archive_index`. Raw `people_*` / `office_*` / `event_archive_index` rows are not route state, prompt, browser, appointment, or audit sources. Local audit records use JSON sidecars or SQLite `event_log` / `ai_change_proposals`. JSON remains default. No remote save, account, multiplayer, cloud sync, or hosted DB scope.
- Active roadmap: local dynamic database specialty in `docs/DEVELOPMENT_STEPS.md`. S49-S53 foundation is complete and archived in `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`; S54 geography split, S55 people persistence/event association, S56 official-posting persistence/reference hardening, and S57.1 safe event archive index/pagination are complete. Remaining work continues with audit-to-public event projection tooling, SQLite prompt retrieval, and full dual-mode hardening while preserving JSON/default route contracts.
- Current local `.env`: configured with real user-supplied DeepSeek and MiMo Token Plan keys; `AI_PROVIDER=mimo-deepseek` is the intended local real-provider mode. `.env` is ignored by Git and must never be printed or committed.

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
- Session storage facade/adapters: `src/storage/sessionStore.js`, `src/storage/jsonSessionAdapter.js`, `src/storage/sqliteSessionAdapter.js`, `src/storage/sqliteGeographyTables.js`, `src/storage/sqlitePeopleTables.js`, `src/storage/sqliteOfficialPostingTables.js`, `src/storage/sqliteEventArchiveTables.js`, `src/storage/sessionRecord.js`, `src/storage/sessionAudit.js`
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

- S54.1: DONE. Geography SQLite business table contract is recorded in `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`; no runtime tables or route fields were added.
- S54.2: DONE. SQLite mode persists normalized geography business rows in `geo_*` tables and repairs missing/stale rows from `world_state_json` on read; JSON adapter remains unchanged.
- S54.3: DONE at `54505b3`. Geography import/repair/export tooling and JSON/SQLite route/prompt/browser parity checks are in place.
- S55.1: DONE. People/household/asset/estate/relationship SQLite table contract is recorded in `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`; no runtime tables or route fields were added.
- S55.2: DONE. SQLite mode now creates/syncs `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships` from the normalized visible `worldPeople` bridge, repairs missing/stale/mismatched rows from `world_state_json`, and deletes people rows with the session. JSON/default route shape remains unchanged.
- S55.3: DONE. `src/game/worldPeopleEvents.js` now turns server-applied visible people deltas into safe public event summaries and `world_people` audit records; ordinary turns connect relationship changes and active request outcomes, while SQLite keeps `people_*.last_event_id` links out of route `worldPeopleView` / prompt surfaces.
- S56.1: DONE. Official posting SQLite table contract is recorded in `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`; no runtime tables or route fields were added.
- S56.2: DONE. SQLite mode now creates/syncs `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers` from the normalized safe `officialPostings` projection, repairs missing/stale/mismatched rows from `world_state_json`, and deletes/imports those rows with the session. JSON/default route shape remains unchanged.
- S56.3: DONE. `office_*` rows now carry `metadata_json.contentHash`; read repair detects same `row_id` / same revision content pollution and old missing-hash rows, then rebuilds from `world_state_json` without exposing hidden city/person refs or using raw rows as appointment state.
- S57.1: DONE. `eventArchiveView` has pagination metadata and SQLite mode syncs sanitized public items into `event_archive_index`; prompt recent-event retrieval, top-level prompt `recentEvents`, and save-load narrative replay read the same safe archive projection instead of raw `eventHistory` text.
- S57.2: add audit-to-public event projection tooling without exposing raw audit.
- S58: let `promptContextAssembler` use SQLite indexes in SQLite mode while keeping JSON fallback and hidden-row tests.
- S59: harden full JSON/SQLite integration, then compress the completed S54+ details into a future archive.

## Current Work Note

- 2026-05-08：S57.1 安全事件索引与事件档案分页已完成于本次提交。`src/game/eventArchive.js` 新增 `buildEventArchiveIndexItems()` 与分页 metadata，默认 `eventArchiveView.items[]` 仍可直接渲染，同时提供 `pagination` / `pageCounts`；`GET /api/game/state/:sessionId` 支持 `eventArchivePage` / `eventArchivePageSize` 查询。新增 `src/storage/sqliteEventArchiveTables.js`，SQLite 模式创建并同步 `event_archive_index`，只保存 `eventArchiveView` 已脱敏的 public projection，并用 `metadata_json.contentHash` 检测缺 hash、错 id、陈旧 revision 或同 id/同 revision 内容污染；读档仍按 `world_sessions.world_state_json -> eventArchiveView -> event_archive_index` 单向修复，不读取 raw `event_log` / `ai_change_proposals`，也不让 raw index row 反向成为 route/prompt/browser 来源。`src/ai/promptContextAssembler.js` 的近事检索和 `src/ai/prompts.js` 顶层 `recentEvents` 都改读安全事件档案条目，`public/app.js` 的事件档案与读档叙事回放也只读 route `eventArchiveView`。已通过 `node --check src\game\eventArchive.js src\storage\sqliteEventArchiveTables.js src\storage\sqliteSessionAdapter.js src\ai\promptContextAssembler.js src\ai\prompts.js src\routes\game.js public\app.js`、`node --test test\eventArchive.test.js test\promptContextAssembler.test.js test\gameTurnEventArchive.test.js test\sessionStoreAdapterContract.test.js test\prompts.test.js test\publicAppSource.test.js`（77 tests）、`npm run check:docs-governance`、`git diff --check`、`npm test`（425 tests）；Meitner 完成前置只读梳理，未编辑文件或运行 Git 写入命令。Planck 首轮提交前只读复审发现 3 个问题（prompt 顶层 raw 近事、读档 raw 叙事回放、README 过期限制），均已修复并补回归；Archimedes 最终只读复审确认代码侧无 P0/P1/P2，并发现 1 个 P2 文档口径问题，已修正 brief 中 S57.1/S57.2 剩余方向。下一步 S57.2 做审计到公开事件 projection 的本地工具与脱敏测试。
- 2026-05-08：S56.3 跨域引用完整性与安全 view 已完成于本次提交。`src/storage/sqliteOfficialPostingTables.js` 为每条 `office_*` 派生行写入 `metadata_json.contentHash` 内容指纹，并在读档 repair status 中加入 `contentMismatches`；当同 `row_id` / 同 revision 的业务列被 hidden NPC、hidden city、hidden route/frontier refs 或其他 raw 内容污染，或旧 S56.2 行缺少指纹时，SQLite 仍按 `world_sessions.world_state_json -> office_*` 单向重建。`test/sessionStoreAdapterContract.test.js` 新增同数量/同 id/同 revision 内容篡改和旧行缺 hash 升级探针，确认 `officialPostingsView`、prompt、retrieval 不泄漏 `SEALED_SQLITE_*`、hidden NPC/城市/路线/边面 id，raw 表修回服务器可见 projection。JSON/default route shape、Mock 可玩性、`player.officeTitle`、`officialCareer` 和完整 scholar -> official 路径不变。已通过 `node --check src\storage\sqliteOfficialPostingTables.js test\sessionStoreAdapterContract.test.js`、`node --test test\sessionStoreAdapterContract.test.js`（49 tests）、官职/storage/prompt/red-team focused suite（110 tests）、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（420 tests）；Franklin 完成前置只读梳理，Feynman 完成提交前只读复审，二者均未编辑文件或运行 Git 写入命令。Feynman 发现 1 个 P2 文档口径问题，已修正 `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`。下一步 S57.1 开始安全事件索引与事件档案分页，继续不暴露 raw audit。
- 2026-05-08：S56.2 官职任所 SQLite 持久化与桥接 parity 已完成于本次提交。新增 `src/storage/sqliteOfficialPostingTables.js`，SQLite 模式创建并同步 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers`；`sqliteSessionAdapter` 在写入 session row 前按 geo -> people -> official 顺序规范化，写入后同 transaction 同步 `office_*`，读档时从 `world_sessions.world_state_json` 单向修复缺失、陈旧、同数量错 `row_id` 或 raw hidden 行污染，导入和删除也同步维护官职任所行。JSON adapter、route payload、`officialCareerView`、`officialPostingsView`、prompt/retrieval 和浏览器仍只读服务器可见 projection；raw `office_*` rows 不会反向改写 `player.officeTitle`、`officialCareer`、任命/考成/迁转或 hidden 私档。已通过 `node --check src\storage\sqliteOfficialPostingTables.js src\storage\sqliteSessionAdapter.js test\sessionStoreAdapterContract.test.js`、`node --test test\sessionStoreAdapterContract.test.js`（47 tests）、官职/storage/prompt/red-team focused suite（108 tests）、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（418 tests）；Ampere 完成前置只读梳理，Huygens 完成提交前只读复审且未发现 P0/P1/P2，二者均未编辑文件或运行 Git 写入命令。下一步 S56.3 继续细化跨域城市/NPC 引用完整性与安全 view 降级，并在后续 SQLite 检索前补同 `row_id` / 同 revision 内容篡改探针或内容指纹。
- 2026-05-07：S56.1 官职域 SQLite 表契约已完成于本次提交。`docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md` 新增 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers` 的公共列、字段分类、可见性、holder/地理/人物引用、AI 权限、hidden 边界和 S56.2/S56.3 parity 验收点；同步 README、产品 brief、architecture、动态数据库规划、AI 控制矩阵和本交接板。本轮纯文档契约，不改运行时代码、不创建 SQLite 官职任所表、不新增 route 字段；当前 `worldState.officialPostings` 仍只保存可见 bridge projection，hidden 官员私档、密札考成、未公开迁转、raw `office_*` 行和后续 `last_event_id` 不得回填进 route raw `worldState`、prompt 或浏览器。已通过官职任所/官场/prompt/red-team focused suite：`node --test test/officialPostingSchemas.test.js test/officialPostings.test.js test/gameTurnOfficialPostings.test.js test/officialCareer.test.js test/officialCatalog.test.js test/prompts.test.js test/promptContextAssembler.test.js test/stateRules.test.js test/auditRoute.test.js test/aiControlRedTeam.test.js`（61 tests）、`npm run check:docs-governance`、`git diff --check`。Locke 完成前置只读梳理，未编辑文件或运行 Git 写入命令；其建议已纳入契约：SQLite raw row 不得成为官职任免、`player.officeTitle` 或 `scholar -> official` 连续性的裁决源。
- 2026-05-07：S55.3 NPC 生命周期与人物事件集成已完成于本次提交。新增 `src/game/worldPeopleEvents.js`，以服务器已应用后的可见 `worldPeople` 前后快照生成安全人物事件；普通回合实际接入关系升降和 active request 接受/拒绝/逾期结果，写入结构化 `world_people` 审计事件和 SQLite people row 关联，公开 `eventHistory` 顺序仍由叙事、active request、tick、长期事件和官场系统控制。`sessionAudit` context 与 JSON/SQLite adapter 新增 `peopleEventLinks`，SQLite `people_*` 同步会把安全 `eventId` 写入目标人物/关系/家族/资产/田产的 `last_event_id`，后续无人物事件写入或读档修复时从既有安全 `event_log` 关联保留该 id；该 id 不回写 route raw `worldState.worldPeople`、`worldPeopleView`、prompt `worldPeople` summary 或 `retrievalContext.people`。财富/田产/迁居/生死/家庭/官职履历的 helper 分类已覆盖可见 delta，等待后续服务器模块产生实际 `worldPeople` 变动后使用同一路径；S57 仍负责 raw audit 外的安全事件索引/分页 projection。已通过新增/受影响文件 `node --check`、`node --test test\worldPeopleEvents.test.js`、`node --test test\gameTurnRelationships.test.js`、`node --test test\sessionStoreAdapterContract.test.js`（39 tests）。Sagan 和 Helmholtz 完成前置只读梳理，均未编辑文件或运行 Git 写入命令；Sagan 建议以 `finalizeTurn()` 为写入点，Helmholtz 建议 `last_event_id` 只落 SQLite/审计关联、不回写 route `worldPeople`。
- 2026-05-07：S55.2 `worldPeople` SQLite 持久化与桥接 parity 已完成于本次提交。新增 `src/storage/sqlitePeopleTables.js`，SQLite 模式创建并同步 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships`；`sqliteSessionAdapter` 在写入 session row 前规范化 `worldPeople`，写入后同步 `people_*` 行，读档时按 `world_sessions.world_state_json` 修复缺失、陈旧、同数量错 `row_id` 或被 raw hidden 行污染的派生表，删除/导入也同步 people rows。该实现只持久化服务器过滤后的可见 bridge projection，不从 raw `people_*` 反向回填 route state、prompt 或浏览器；`relationshipLedger`、`activeNpcRequest` 和 `relationshipChanges` 仍由服务器裁决、夹断和过滤。已通过 `node --check src\storage\sqlitePeopleTables.js src\storage\sqliteSessionAdapter.js test\sessionStoreAdapterContract.test.js`、`node --test test\sessionStoreAdapterContract.test.js`（38 tests）、focused people/storage/prompt/red-team suite（89 tests）、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（406 tests）。Wegener 已完成前置只读梳理，建议并已覆盖 hidden raw `people_*` row、可见 bridge 缺失、同数量错行、relationship mutate、stale revision、import/delete 和 JSON/SQLite `worldPeopleView`/prompt parity 探针；Boole 提交前只读复审发现 1 个 P2：同 id hidden relationship `recentNotes` 可能通过 bridge 合并泄漏，已修复 `mergeRows()` 并补同 id hidden `rel-player-npc-C01` 的 view/prompt/SQLite 防泄漏探针。S55.3 已在上方完成记录中接续实现。
- 2026-05-07：S55.1 人物域 SQLite 表契约已完成于本次提交。`docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md` 新增 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships` 的公共列、表字段、可见性、引用修复、AI 权限、hidden 私档边界和 S55.2/S55.3 parity 验收点；同步 README、产品 brief、architecture、动态数据库规划、AI 控制矩阵和本交接板。本轮纯文档契约，不改运行时代码、不创建 SQLite 人物表、不新增 route 字段；当前 `worldState.worldPeople` 仍只保存可见桥接 projection，hidden NPC 私档、资产真数、隐藏意图和密札备注不得回填进 route raw `worldState`。已通过 `node --test test/worldPeopleSchemas.test.js test/worldPeopleBridge.test.js test/relationshipLedger.test.js test/activeNpcRequests.test.js test/prompts.test.js test/promptContextAssembler.test.js test/aiControlRedTeam.test.js test/auditRoute.test.js`（51 tests）、`npm run check:docs-governance`、`git diff --check`。Curie 已完成现有人物/关系/hidden 边界只读梳理；Cicero 提交前只读复审未发现 P0/P1/P2，建议 S55.2 第一批测试覆盖 hidden raw `people_*` row、损坏引用和可见 bridge 缺失三种 raw-table fallback 探针；S55.2 已在上方完成记录中接续实现。
- 2026-05-07：README 已重写为面向 GitHub 首页的项目说明，集中说明本轮主要更新、修复、安全边界、项目特点、优势、快速启动、provider 配置、JSON/SQLite 存储模式、常用命令、API 和重要文档入口。此轮为低风险纯文档发布准备，不改运行时代码、测试、API、provider schema、存档格式或路线图状态；按治理规则跳过只读子代理提交前复审，并通过 `npm run check:docs-governance` 与 `git diff --check` 后提交推送。
- 2026-05-07：S54.3 地理导入/修复/导出工具已完成于提交 `54505b3`。新增 `scripts/sqliteGeographyTool.js` 与 `npm run storage:geography:sqlite`，支持 `import`、`status`、`repair`、`export`；`import` 复用 JSON -> SQLite 导入并同步 `geo_*`，`--dry-run` 不打开或创建 SQLite；`status` 和 `repair --dry-run` 只读报告 drift，正式 `repair` 以 `world_sessions.world_state_json` 修复地理业务表；`export` 只输出脱敏 debug dump，包含 `worldGeographyView`、prompt geography summary、retrieval geography 和计数，不输出 hidden notes、数据库路径、prompt、key 或 raw provider response。`scripts/browserSmoke.js` 新增 `--storage-adapter sqlite --sqlite-db <path>`，让 browser smoke helper、临时 Mock 服务器和清理逻辑共用 SQLite adapter。新增 `test/sqliteGeographyTool.test.js` 与 `test/geographyStorageParity.test.js`，并扩展 `test/browserSmokeScript.test.js`。已通过 `node --check` 新增/修改脚本与测试、工具/parity/browser helper focused tests、69-test storage/tool focused、37-test geography/prompt/route focused、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（398 tests）；Dirac 提交前只读复审未发现 P0/P1/P2，确认 dry-run/repair/export/browser SQLite helper/S54.2 修复语义均无阻塞。S55.1 下一步是人物、家族、资产、田产、关系 SQLite 表契约。
- 2026-05-07：S54.2 地理 SQLite 持久化 adapter 已完成于提交 `5acf894`。新增 `src/storage/sqliteGeographyTables.js`，SQLite 模式会创建并同步 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`；`sqliteSessionAdapter` 在同一 transaction 内写 `world_sessions.world_state_json`、审计记录和 `geo_*` 行，读取时在 transaction 内重读当前 session，并按 `world_state_json` 修复缺失/陈旧/同数量错 `row_id` 地理行，删除 session 时清理地理行。JSON adapter、route payload、prompt schema 和浏览器 view 均不变；prompt/UI 仍只读服务器 projection，不读 raw table。已通过 `node --check` storage/test 文件、`node --test test/sessionStoreAdapterContract.test.js`（30 tests）、地理/prompt/storage focused 86 tests、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（393 tests）。Kepler 首轮只读复审发现 2 个 P2，均已修复并补测试；第二轮最终复审未发现 P0/P1/P2。
- 2026-05-07：S54.1 地理 SQLite 业务表契约已完成于本次提交。`docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md` 新增 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions` 的公共列、字段分类、引用修复、hidden 边界和 S54.2/S54.3 parity 验收点；同步产品 brief、AI 控制矩阵和本交接板。本轮纯文档契约，不改运行时代码、不新增 route 字段、不创建 SQLite 表，JSON 默认、SQLite local-only、AI 不直写 SQL/table rows、prompt/UI 只读服务器 view 的边界不变。已通过 `node --test test/worldGeographySeeds.test.js test/worldGeography.test.js test/promptContextAssembler.test.js test/prompts.test.js test/stateRules.test.js test/aiSchemas.test.js test/remoteHelpers.test.js`、`npm run check:docs-governance`、`git diff --check`；Fermat 完成字段/风险核对，Laplace 基于最终 diff 与验证证据做提交前只读复审，未发现 P0/P1/P2。S54.2 实现时要保持现有 `role_visible` 粗规则和 `world_sessions.world_state_json` / `geo_*` 同事务同步。
- 2026-05-07：MiMo provider 集成提交 `80a0c07`。本轮新增 `mimo` 与 `mimo-deepseek` provider、诊断和 smoke 脚本支持、MiMo/Hybrid 单元测试、remote turn relationship 建议归一化、README/brief/architecture/AI 控制矩阵/真实 provider 验收更新，并把完整多 AI 协作编排排到 S54-S59 之后。官方 MiMo 文档和真实 route health 确认 API 模型 ID 应为 `mimo-v2.5-pro`；直接用 `mimo-v2.5-pro[1m]` 发送普通问答也返回 `Not supported model`，1M 应作为长上下文能力说明而不是 request model 字段。官方文档还确认 OpenAI-compatible `/chat/completions`、Token Plan `tp-...` key、token-plan Base URL 与普通 `sk-...` key 不可混用；也记录 Token Plan 场景限制，公开部署或非 Coding 自定义后端应先确认授权或改用普通 API key。只读复审提出的 Token Plan 默认 URL 与 MiMo key 提示问题已修正，并补充 `MIMO_API_KEY` / `tp-...` 在事件档案与浏览器 smoke 隐藏 token 扫描中的覆盖。已通过聚焦测试、`npm test`、`npm run check:docs-governance`、`git diff --check`、keyed route health `npm run smoke:provider:route -- --provider mimo` / `--provider mimo-deepseek`，以及真实混合烟测 `npm run smoke:provider -- --provider mimo-deepseek --stream`；最终只读复审未发现阻塞问题。
- 2026-05-07：数据库专项规划压缩提交 `5ab5350`。S49-S53 已完成基础归档到 `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`，活动台账改为 S54-S59 剩余 SQLite 业务表拆分，并已同步 README、产品 brief、architecture、动态数据库规划、相关契约和本交接板。该变更为纯文档，但涉及路线图重写和内容保护，已运行 `npm run check:docs-governance`、`git diff --check` 并执行只读复审；复审 P2 已修正。后续从 S54.1 地理 SQLite 业务表契约开始。

## Next Recommended Step

Start S57.2: build audit-to-public event projection tooling and redaction tests. Keep `event_archive_index` as a safe `eventArchiveView` derivative, preserve JSON/default Mock playability, and do not expose raw audit, prompt text, provider proposals, local paths, hidden notes, or database internals.
