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
- S61 新增的国家/城市深度指标是服务器可见 projection 字段：AI 可以读取 capped view/prompt 摘要并解释财政、军备、税粮、市价、士绅、水利、灾害、驻军和书院压力，但不能写 `worldGeography`、`geo_*`、外交/战争/城市治理结果或 hidden 情报真值。

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

- 2026-05-08：S60.2 内容基线与规模验收 fixture 已收束为 `DONE`，本轮提交补齐 medium/large 与普通 prompt budget。`src/game/worldContentFixtures.js` 现在支持 `small` / `medium` / `large` 三档：small 仍用 route-safe `worldState` 跑 JSON/SQLite parity 和读档修复；medium/large 通过 storage-only 侧车达到 10 国/96 城/480 NPC/1800 prompt rows 与 14 国/300 城/2000 NPC/10000 prompt rows 等契约总量，不突破当前 `worldGeography`、`worldPeople`、`officialPostings` route/view cap，也不把 hidden 私档回填 raw state。新增 `buildWorldContentFixturePage()` 作为大样本分页/搜索基线，输出已按 collection allowlist 脱敏；事件/情报侧车引用真实 fixture 城市；`promptContextAssembler` 新增普通/高相关 retrieval budget，普通自由回合 `buildTurnTask()` 使用 48 行 / 约 20000 字符预算，高相关验收保持 72 行 / 约 30000 字符。S60.2 台账记录了最小性能基线：fixture generation、ordinary prompt assembly、event archive pagination、fixture page，以及 small JSON write / SQLite write / SQLite read-repair。已通过 `node --test test/worldContentFixtures.test.js`、`node --test test/promptContextAssembler.test.js`、`node --test test/prompts.test.js`、`node --test test/sqlitePromptRetrieval.test.js test/sessionStoreAdapterContract.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（460 tests）；提交前只读复审中 Kuhn / Popper 发现的 P2 已修复，Fermat 最终确认无 P0/P1/P2。下一步建议启动 S62.1 NPC 人口与家族谱系；真实浏览器大数据量搜索/筛选面板仍归 S66.2，性能压力门槛归 S67.1。
- 2026-05-08：S61 国家/邻国与城市/区域深度内容包已收束完成，主提交 `aa8c75b` 补上了上一轮遗留的 S61.2 尾项。`worldGeography` 城市深度指标现在以 seed 为基线，随财政、粮储、治安、腐败和军情压力由服务器幂等刷新；同一 `turnCount` 的 route view 不会反复漂移，进入新回合或旧档补刷时才重新派生。补充回归包括 raw `officialPostings.assessmentRecords` 污染不会进入 `eventArchiveView`、地方官 `banditPressure` 优先进入任所 `militaryPressure`、SQLite `prompt_retrieval_index` 修复污染的 S61 任所考成行、SQLite `event_archive_index` 修复污染的 `official_assessment` 行。S61.2 已在活动台账中标为 `DONE`；更大 fixture、浏览器分页搜索和大数据量信息面板归入 S60.2/S66/S67，不再算 S61 未完成项。已通过 `node --test test/worldGeography.test.js`、`node --test test/officialPostings.test.js`、`node --test test/eventArchive.test.js test/sqlitePromptRetrieval.test.js`、`node --test test/sessionStoreAdapterContract.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（456 tests）；提交前只读复审子代理 Carver 未发现 P0/P1/P2 或需提交前处理的 P3。
- 2026-05-08：S61.2 城市与区域深度内容包继续推进了“任所考成与事件档案”切片，主提交 `112a35c`。`officialPostings` 的任所 `localMetrics` 现在优先读取 S61 城市深度 projection：税基、市价、词讼、水利、士绅、灾害、驻军和书院等字段会进入可见任所压力；地方官玩家自有地方指标仍优先。玩家当前任所考成 `publicFinding` / `publicSummary` 会追加“任所奏报”公开摘要，但不改变 `meritScore`、`riskScore`、`recommendation` 或任何任免/升降裁决。`eventArchiveView` 新增 `official_assessment` 来源，只从 `buildOfficialPostingsView()` 的可见 `assessmentRecords` 派生安全事件档案条目，不读 raw `officialPostings`、raw `geo_*`、SQLite 表或审计 proposal。已通过 `node --test test/officialPostings.test.js`、`node --test test/eventArchive.test.js`、`node --test test/gameTurnEventArchive.test.js`、`node --test test/sqlitePromptRetrieval.test.js`、`node --test test/prompts.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（450 tests）。只读最终复审子代理 Einstein 未发现阻断提交的问题；余留非阻断建议是后续补 raw `officialPostings.assessmentRecords` 污染回归和地方官 `banditPressure` 优先级断言。
- 2026-05-08：S61.1 国家与邻国深度内容包已完成；S61.2 城市与区域深度内容包已启动并保持 `IN_PROGRESS`。新增 `src/game/worldGeographyConfig.js` 集中 S61 国家/城市深度指标默认值、字段 keys 和文本上限；`worldGeography` 国家行新增财政压力、军备、国威、正统性、继承风险、外交张力、贡贸活跃度、情报可靠度、政策压力标签、外交态势和情报摘要；城市行新增人口规模、税基、粮储、市价、士绅、词讼、徭役、水利、灾害、交通、驻军、书院和城市情报摘要。这些字段进入 `worldGeographyView`、capped prompt summary、`retrievalContext.geography` 与 `prompt_retrieval_index`；SQLite `geo_countries` / `geo_cities` 用 `metadata_json.s61CountryDepth` / `metadata_json.s61CityDepth` 保存安全派生摘要，不新增 STRICT 表列以兼容旧本地库。提交前只读子代理 Ohm 发现旧 SQLite `prompt_retrieval_index` 行若 contentHash 自洽但 payload 停在 S61 前，会缺少新指标；已改为对照当前服务器 expected row hash 触发重建，并补 `test/sqlitePromptRetrieval.test.js` 复现。最终只读子代理 Averroes 确认无 P0/P1/P2，余留 P3 为该回归测试可后续从正则任一命中加强为逐字段断言。S60 small fixture 已补 S61 指标和 hidden canary 污染输入。已通过 `node --test test/worldGeography.test.js`、`node --test test/worldGeographySeeds.test.js`、`node --test test/worldContentFixtures.test.js`、`node --test test/sqlitePromptRetrieval.test.js`、`node --test test/sessionStoreAdapterContract.test.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和修复后的 `npm test`（449 tests）。
- 2026-05-08：开发规范已新增“避免魔法数字、优先配置化”要求。受保护治理锚点、活动路线图规范继承和开发 brief 均写明游戏规则、阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数应集中到具名配置模块，例如 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，并说明单位、范围和默认值意图。同步更新 `scripts/checkGovernanceDocs.js`，让治理检查保护该规则；本轮不改运行时行为、API、provider schema、存档格式、SQLite 表结构或玩家 UI。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和 `npm test`（447 tests）；只读子代理 Lovelace 复审无 P0/P1/P2，补强建议已采纳。
- 2026-05-08：S60.2 small 内容基线 fixture 曾先完成阶段性切片。该切片新增 `src/game/worldContentFixtures.js`，以 `createInitialState()` 为 base 生成不接入 route 的 deterministic `small` 样本：6 国、24 城、12 路线、96 NPC、32 家族、160 关系、80 官职/官署目录行、48 任命行、64 事件/情报侧车和约 491 条安全 prompt retrieval 行。真正 private hidden canary 保持在 fixture 侧车，不写入当前 raw route `worldState`；`createCanaryPollutedWorldState()` 只供测试验证 hidden 行、hiddenNotes、hiddenIntent、raw table 名、假 key 和本地路径片段不会进入 view/prompt/retrieval。后续同日收束提交已把 S60.2 推进为 DONE。
- 2026-05-08：S60.1 超大动态世界数据库内容契约已完成于本次提交。新增 `docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md`，固定开发小样本、默认可玩中样本、压力测试大样本三档规模，明确 seed catalog / 场景 seed pack / 每局动态安全账本 / 服务器 hidden 私档 / 玩家 view / prompt retrieval / 浏览器 projection / 审计公开 projection 分层。契约写明 S60.2 `small`、`medium`、`large` fixture 数量目标、全局 prompt budget、hidden canary、防泄漏、JSON/SQLite parity、读档单向修复和浏览器分页验收。同步 `docs/DEVELOPMENT_STEPS.md`、`docs/DYNAMIC_WORLD_DATABASE_PLAN.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/AI_CONTROL_AUDIT_MATRIX.md`、README 以及地理/人物/官职契约的 S60 cap 说明。本轮是文档契约改动，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构；采用只读子代理范围审查，提交前再做只读最终 diff 复核。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；未运行完整 `npm test`，因为本轮只改文档。
- 2026-05-08：S59.2 归档与上下文压缩已完成于 `fd8cf72`。新增 `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`，把 S54-S59 实现细节从活动台账迁出；`docs/DEVELOPMENT_STEPS.md` 已切换为 S60+ “超大动态世界数据库内容充实”路线图，并把原多 AI S60 顺延为 S70。当前内容保护边界写入本交接板：local-only、AI 不直写库、view-first、hidden 私档不回填 route、远程/账号/多人不进入规划。已通过 `npm run check:docs-governance`、`git diff --check`、focused 数据库套件 `node --test test/sessionStoreAdapterContract.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js`（66 tests）；只读子代理 Aristotle 完成复审，无 P0/P1/P2，两个 P3 文档洁癖项已修正。
- 2026-05-08：S70.0 AI 编排提前规划已加入活动路线图、开发 brief、AI 控制矩阵和治理锚点。新增 `docs/AI_ORCHESTRATION_ROADMAP.md`，固定“AI 是核心世界引擎”的长期规范，并规划 AI actor、职位分级工具、NPC mind、朝议/堂审/战役/会盟 scene、压力驱动事件生成、多模型 narrator/planner/critic/safety 编排、Mock/no-key 降级和红队验收。S70 仍排在 S67 后实施；当前只做文档规划，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`、`npm test`（443 tests）。

## Next Recommended Step

Start S62.1 NPC population and family genealogy. S66.2 can later use the finished S60.2 fixture/page helper to build real browser search, filtering, pagination, and hidden-token smoke for large information panels.
