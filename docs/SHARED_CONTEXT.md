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
- AI providers: adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic. `AI_PROVIDER=mock` remains the default playable mode. `mimo-deepseek` is a minimal method-level route: MiMo handles start/turn/stream/question, DeepSeek handles exam grading.
- Storage: default JSON session files under `data/sessions/`. Optional `STORAGE_ADAPTER=sqlite` uses local `world_sessions`, audit tables, `geo_*`, `people_*`, `office_*`, `event_archive_index`, and `prompt_retrieval_index`. SQLite derived rows repair one way from `world_sessions.world_state_json`; raw business/audit rows are not route, prompt, browser, or server裁决 truth sources.
- Active roadmap: S54-S59 business-table work is complete and archived in `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`. Current work is S60+ in `docs/DEVELOPMENT_STEPS.md`: “超大动态世界数据库内容充实”专项，目标是把内容密度从约 55-65% 推到可支撑长期历史沙盘的规模。
- Current local `.env`: may contain user-supplied provider keys. `.env` is ignored by Git and must never be printed or committed.

## Core Invariants

- Keep the complete scholar path working: `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`.
- AI is a core world engine for Qianqiu, not a replaceable garnish. New gameplay, data domains, roles, offices, events, panels, or prompt retrieval work must design AI read scope, actor intelligence, tool permissions, proposal boundaries, server adjudication, audit records, and Mock/no-key fallback.
- Providers may suggest narrative, bounded `statePatch`, relationship changes, scoring JSON, and exam triggers. The server owns promotion, exam entry rules, anti-cheat penalties, persistence, protected state fields, official appointments, long-term system effects, time advancement, database writes, and visibility filtering.
- Validate AI JSON before applying it. State changes must go through whitelists, clamps, and server-owned follow-up modules.
- Game tunables such as rules, thresholds, time intervals, probabilities, UI caps, fixture sizes, and prompt budgets should not be scattered as magic numbers. Prefer named config modules such as `src/config/GameConfig.js` or domain-specific `src/game/*Config.js`, with units, ranges, and default intent made explicit.
- `GET /api/game/saves` must expose redacted metadata only. Full saves are read through `GET /api/game/state/:sessionId`.
- Local playability cannot depend on real model keys. Keyed provider checks must skip or fail in controlled, documented ways when keys are absent.
- Every coherent change must update this handoff and the step ledger, run relevant verification, and be committed.
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。

## Content Protection

当前专项尤其要保护内容边界：

- 只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- AI 不能执行 SQL，不能直接写 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`。
- 浏览器和 prompt 只读服务器生成的 view / capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密札考成和邻国真实虚实不得回填到当前 raw route `worldState`；如后续要保存完整 hidden 私档，先设计 API redaction 与角色视野分层。
- 大规模内容生成必须通过服务器 helper、seed、fixture、受限 proposal、schema、clamp、visibility filter 和 adapter transaction。
- S70 的 AI 工具方向是“模型请求工具、服务器执行工具”。Function calling、Structured Outputs、MCP connector 或未来内部 MCP 只能产生 tool call / proposal；通用外部工具和第三方 MCP 不得接触 raw session、raw table、hidden ledger、完整 prompt、key 或本地路径。

## Subagent Discipline

- The user has authorized Codex and Claude Code to use subagents for this repository as durable context.
- Implementation subagents may make scoped patches and run focused verification only.
- Subagents must not run `git add`, `git commit`, `git push`, or create PRs.
- The main agent owns integration, docs, final verification, and the single coherent commit.
- Any coherent change containing code, tests, runtime behavior, API/schema changes, prompts, or verification tooling requires at least one read-only pre-commit subagent review of the final diff and verification evidence.
- Pure documentation-only changes may skip that review gate only when low risk. Roadmap rewrites with content-safety risk should still get a read-only review.

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
- State rules, time, exams, promotions, official career, relationships, long-term events, world entities/threads: `src/game/`
- Geography, people, official postings, event archive, audit public projection: `src/game/worldGeography.js`, `src/game/worldPeople.js`, `src/game/officialPostings.js`, `src/game/eventArchive.js`, `src/game/auditPublicProjection.js`
- S60 scale fixture helper: `src/game/worldContentFixtures.js`
- Storage facade/adapters and SQLite derived tables: `src/storage/sessionStore.js`, `src/storage/jsonSessionAdapter.js`, `src/storage/sqliteSessionAdapter.js`, `src/storage/sqliteGeographyTables.js`, `src/storage/sqlitePeopleTables.js`, `src/storage/sqliteOfficialPostingTables.js`, `src/storage/sqliteEventArchiveTables.js`, `src/storage/sqlitePromptRetrievalTables.js`
- Browser app: `public/index.html`, `public/app.js`, `public/styles.css`

Durable contracts and acceptance records:

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_ACCEPTANCE.md`
- `docs/BROWSER_INFORMATION_PANEL_PLAN.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/REAL_PROVIDER_ACCEPTANCE.md`
- `docs/SESSION_STORAGE_MIGRATION_PLAN.md`
- `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`
- `docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md`
- `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`
- `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`
- `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`
- `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`
- `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`
- `docs/AI_CONTROL_AUDIT_MATRIX.md`
- `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`
- `docs/AI_ORCHESTRATION_ROADMAP.md`

## Archived Database Work

S49-S53 foundation is archived in `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`:

- storage adapter facade, optional SQLite session row, JSON import, event log and AI proposal audit.
- geography, people, official-posting, event archive and prompt retrieval projections.
- browser “局势簿” five-panel shell.

S54-S59 business-table work is archived in `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`:

- S54 `geo_*` tables and maintenance/parity tooling.
- S55 `people_*` visible bridge persistence and people-event audit links.
- S56 `office_*` derived rows with content-hash drift repair.
- S57 `event_archive_index` and audit public projection tooling.
- S58 `prompt_retrieval_index` and browser information parity smoke.
- S59.1 `smoke:dual-mode` dual-mode acceptance.

## Current Work Note

- 2026-05-08：开发规范已新增“避免魔法数字、优先配置化”要求。受保护治理锚点、活动路线图规范继承和开发 brief 均写明游戏规则、阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数应集中到具名配置模块，例如 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，并说明单位、范围和默认值意图。同步更新 `scripts/checkGovernanceDocs.js`，让治理检查保护该规则；本轮不改运行时行为、API、provider schema、存档格式、SQLite 表结构或玩家 UI。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和 `npm test`（447 tests）；只读子代理 Lovelace 复审无 P0/P1/P2，补强建议已采纳。
- 2026-05-08：S60.2 small 内容基线 fixture 已完成阶段性切片，S60.2 仍保持 `IN_PROGRESS`。新增 `src/game/worldContentFixtures.js`，以 `createInitialState()` 为 base 生成不接入 route 的 deterministic `small` 样本：6 国、24 城、12 路线、96 NPC、32 家族、160 关系、80 官职/官署目录行、48 任命行、64 事件/情报侧车和约 491 条安全 prompt retrieval 行。真正 private hidden canary 保持在 fixture 侧车，不写入当前 raw route `worldState`；`createCanaryPollutedWorldState()` 只供测试验证 hidden 行、hiddenNotes、hiddenIntent、raw table 名、假 key 和本地路径片段不会进入 view/prompt/retrieval。新增 `test/worldContentFixtures.test.js` 覆盖数量门槛、hidden-token、防泄漏、prompt 高相关预算、JSON/SQLite view parity 和删除 `prompt_retrieval_index` 行后的读档修复。已通过 `node --test test/worldContentFixtures.test.js`。下一步仍需扩 medium/large 或先处理事件档案/浏览器分页/普通回合 48 行 prompt 全局预算。
- 2026-05-08：S60.1 超大动态世界数据库内容契约已完成于本次提交。新增 `docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md`，固定开发小样本、默认可玩中样本、压力测试大样本三档规模，明确 seed catalog / 场景 seed pack / 每局动态安全账本 / 服务器 hidden 私档 / 玩家 view / prompt retrieval / 浏览器 projection / 审计公开 projection 分层。契约写明 S60.2 `small`、`medium`、`large` fixture 数量目标、全局 prompt budget、hidden canary、防泄漏、JSON/SQLite parity、读档单向修复和浏览器分页验收。同步 `docs/DEVELOPMENT_STEPS.md`、`docs/DYNAMIC_WORLD_DATABASE_PLAN.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/AI_CONTROL_AUDIT_MATRIX.md`、README 以及地理/人物/官职契约的 S60 cap 说明。本轮是文档契约改动，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构；采用只读子代理范围审查，提交前再做只读最终 diff 复核。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；未运行完整 `npm test`，因为本轮只改文档。
- 2026-05-08：S59.2 归档与上下文压缩已完成于 `fd8cf72`。新增 `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`，把 S54-S59 实现细节从活动台账迁出；`docs/DEVELOPMENT_STEPS.md` 已切换为 S60+ “超大动态世界数据库内容充实”路线图，并把原多 AI S60 顺延为 S70。当前内容保护边界写入本交接板：local-only、AI 不直写库、view-first、hidden 私档不回填 route、远程/账号/多人不进入规划。已通过 `npm run check:docs-governance`、`git diff --check`、focused 数据库套件 `node --test test/sessionStoreAdapterContract.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js`（66 tests）；只读子代理 Aristotle 完成复审，无 P0/P1/P2，两个 P3 文档洁癖项已修正。
- 2026-05-08：S70.0 AI 编排提前规划已加入活动路线图、开发 brief、AI 控制矩阵和治理锚点。新增 `docs/AI_ORCHESTRATION_ROADMAP.md`，固定“AI 是核心世界引擎”的长期规范，并规划 AI actor、职位分级工具、NPC mind、朝议/堂审/战役/会盟 scene、压力驱动事件生成、多模型 narrator/planner/critic/safety 编排、Mock/no-key 降级和红队验收。S70 仍排在 S67 后实施；当前只做文档规划，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`、`npm test`（443 tests）。

## Next Recommended Step

Continue S60.2: extend the deterministic content fixture beyond the current `small` baseline, or first add the missing event archive/browser pagination and ordinary-turn 48-row prompt budget gates needed before `medium` / `large` can be meaningful.
