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
- Providers may suggest narrative, bounded `statePatch`, relationship changes, scoring JSON, exam triggers, or identity-scoped domain tool proposals. The server owns promotion, exam entry rules, anti-cheat penalties, persistence, protected state fields, official appointments, long-term system effects, time advancement, database writes, and visibility filtering.
- Validate AI JSON before applying it. State changes must go through whitelists, clamps, and server-owned follow-up modules.
- Game tunables such as rules, thresholds, time intervals, probabilities, UI caps, fixture sizes, and prompt budgets should not be scattered as magic numbers. Prefer named config modules such as `src/config/GameConfig.js` or domain-specific `src/game/*Config.js`, with units, ranges, and default intent made explicit.
- `GET /api/game/saves` must expose redacted metadata only. Full saves are read through `GET /api/game/state/:sessionId`.
- Local playability cannot depend on real model keys. Keyed provider checks must skip or fail in controlled, documented ways when keys are absent.
- Every coherent change must update this handoff and the step ledger, run relevant verification, and be committed.
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。

## Content Protection

当前专项尤其要保护内容边界：

- 只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- AI 可以通过身份受限的领域工具提交 proposal / request-adjudication，以增强 NPC、官署、考官、将领、皇帝和系统世界引擎的参与感；但 AI 不能执行 SQL，不能直接写 canonical 状态、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`，工具调用也不能被当作已经发生的世界事实。
- 浏览器和 prompt 只读服务器生成的 view / capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密札考成和邻国真实虚实不得回填到当前 raw route `worldState`；如后续要保存完整 hidden 私档，先设计 API redaction 与角色视野分层。
- 大规模内容生成必须通过服务器 helper、seed、fixture、受限 proposal、resolver、schema、clamp、visibility filter 和 adapter transaction；AI tool runner 只能进入这些服务器入口，不能成为 SQL 代理。
- S63.2 新增的地方案牍是服务器可见 projection：AI 可以读取 capped `localAffairsDocketView` / `events.localDockets` 摘要并解释钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束压力，但不能写城市指标、官场考成、任免、`event_archive_index`、`prompt_retrieval_index` 或 SQLite 原始表。
- S64.1 新增的外交军务态势是服务器可见 projection：AI 可以读取 capped `militaryDiplomacyView` / `events.militaryReports` 摘要并解释边镇、驻军、粮道、战备、邻国使节和边患预警，但不能宣战、和议、调兵、任免统帅、结算战役、公开 hidden 情报真值、写 `worldGeography`、`worldPeople`、`officialPostings`、`geo_*`、`people_*`、`office_*`、`event_archive_index` 或 `prompt_retrieval_index`。
- S64.2 新增的经济财政态势是服务器可见 projection：AI 可以读取 capped `economicFiscalView` / `events.economicReports` 摘要并解释税赋、府库、粮储、粮价、盐漕商路、地方库银、赈济、债务、腐败和市场预警，但不能直接裁决征收、拨银、开仓、平粜、赈济、盐引、漕运、矿冶、追赃、债务清偿、市场价格、官场考成、数据库写入或 hidden 情报真值。
- S65.1 新增的历史事件链是服务器可见 projection：AI 可以读取 `historicalEventArchiveView.publicChains` 与 capped `events.eventChains` 公共卷宗摘要并解释自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣之间的因果线索；`sealedChains` 只有服务器显式 `includeSealed` 才生成，不能进入普通玩家路由、浏览器、prompt retrieval 或 SQLite prompt 索引。AI 不得直接成案、结算事件链、写审计或写数据库。
- S68-S69 科举深化规划把童试县试/府试/院试、乡试/会试三场多日多卷、保结、搜检、号舍、弥封、誊录、对读、磨勘、复核、房官/同考官/主考官阅卷和馆选/观政/铨选/外放写成后续专项；AI 老师、同年、考官、吏部和皇帝只能提交题目、点评、事件、批语或授官 proposal，服务器仍拥有资格、舞弊、榜单、名次、授官、任免和持久化裁决。
- S70 的 AI 工具方向是“模型请求工具、服务器执行工具”。Function calling、Structured Outputs、MCP connector 或未来内部 MCP 只能产生 tool call / proposal / request-adjudication；真正落库由服务器 resolver 和 adapter transaction 完成。通用外部工具和第三方 MCP 不得接触 raw session、raw table、hidden ledger、完整 prompt、key 或本地路径。
- S70 提示词工程是一等架构面。S70.1 必须定义 prompt pack 分层：`systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck`；每层要有版本、scene/actor 适用范围、输入预算、输出 schema、Mock/no-key fallback、provider smoke 和 prompt injection / hidden-token 红队。提示词不得成为隐藏裁决权，只能引导叙事、proposal、tool call 或 request-adjudication。
- S70.1-S70.3 先实现内部 `game_ai_tools` registry；工具定义保持 MCP-friendly，至少包含 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown` 和 `mockFallback`。后期如果工具数量、按身份裁剪和跨 provider 发现需求明显膨胀，再在 `game_ai_tools` 外层包装内部 MCP server；`tools/list` 只列 actor 可见工具，`tools/call` 仍走同一 permission / resolver / audit 链。
- MiMo-V2.5-Pro 是 S70 大面积使用的主力 provider 候选；S70.1 必须补 MiMo 专项工具调用 smoke，验证 `tools` schema、`tool_calls` 返回形状、`tool_choice`、多工具调用、工具结果回填、streaming、structured proposal、超长上下文成本和 Mock/no-key fallback，不得把 OpenAI-compatible 直接视为工具协议全量兼容。
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
- Geography, people, official postings, local affairs dockets, military diplomacy, economic fiscal projection, historical event archive, event archive, audit public projection: `src/game/worldGeography.js`, `src/game/worldPeople.js`, `src/game/officialPostings.js`, `src/game/localAffairsDockets.js`, `src/game/militaryDiplomacy.js`, `src/game/economicFiscal.js`, `src/game/historicalEventArchive.js`, `src/game/eventArchive.js`, `src/game/auditPublicProjection.js`
- S60/S62 scale fixture and population helpers: `src/game/worldContentFixtures.js`, `src/game/worldPeoplePopulation.js`
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
- `docs/IMPERIAL_EXAM_DEEPENING_ROADMAP.md`

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

- 2026-05-08：S70 已补 AI 提示词工程与上下文编排规划。`docs/AI_ORCHESTRATION_ROADMAP.md` 现在把提示词工程写成一等架构面，并补入 prompt pack 分层：`systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck`；S70.1 目标扩展为“AI 提示词与工具协议契约”，后续需新增 `docs/AI_PROMPT_ENGINEERING_CONTRACT.md` 或等价契约，覆盖 prompt version、scene/actor 适用范围、上下文预算、输出 schema、provider prompt smoke、Mock/no-key parity、prompt injection 红队和 hidden-token 防泄漏。本轮只改文档规划，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构；低风险文档补充，未启用提交前子代理复审。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；未运行完整 `npm test`。
- 2026-05-08：S65.1 事件模板与历史档案生成系统已完成于本次提交。新增 `src/game/historicalEventArchiveConfig.js` 与 `src/game/historicalEventArchive.js`，从服务器可见 `localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`officialPostingsView`、`worldPeopleView` 和玩家科举履历组合自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣事件链。游戏 start/state/turn/SSE 与考试 question/progress/submit payload 现返回只含公开链的 `historicalEventArchiveView`；`sealedChains` 必须由服务器显式 `includeSealed` 才生成，不进入普通玩家路由、浏览器、prompt retrieval 或 SQLite prompt 索引。`eventArchiveView` 新增 `historical_event_chain` 条目，`promptContextAssembler` / SQLite `prompt_retrieval_index` 新增 `events.eventChains` compact rows；普通 prompt budget 下事件链压成极短公共卷宗提示，高相关检索保留更完整字段。S65.1 不新增 SQLite STRICT 表列、不新增 provider schema、不让 AI 直接成案、结算事件链、写审计或写数据库。small fixture 的 route-safe prompt 检索总行数增至约 586 行，测试天花板同步调到 610，普通 prompt 仍控制在 48 行 / 约 20,000 字符以内。另修复 `scripts/browserSmoke.js` 在 Linux/WSL 上模拟 Windows 浏览器候选路径时使用 POSIX 分隔符的问题。已通过 focused 历史事件档案/事件档案/prompt/SQLite/路由/fixture/docs-governance 测试、`node --test test/browserSmokeScript.test.js`、`git diff --check` 和 `npm test`（500 tests）。下一步建议启动 S65.2 情报、传闻与可见性系统。
- 2026-05-08：S64.2 经济、财政、粮储与市场演化已完成于本次提交。新增 `src/game/economicFiscalConfig.js` 与 `src/game/economicFiscal.js`，从可见 `worldGeographyView`、`officialPostingsView`、`localAffairsDocketView`、`worldEntityView` 和 `worldPeopleView` 派生 `economicFiscalView`：覆盖户部钱粮总账、城市粮储市价、盐漕商路、地方库银赈济、债务亏空/腐败风险和财赋市场预警；书生默认不读取完整财赋市场态势，地方官/入仕官员/大臣/皇帝/将领按角色 cap 读取。游戏 start/state/turn/SSE 与考试 question/progress/submit payload 现返回该 view；`eventArchiveView` 新增 `economic_fiscal` 安全条目；`promptContextAssembler` 与 `prompt_retrieval_index` 新增 `economicFiscal` / `events.economicReports` compact rows，SQLite 读档仍从 `world_sessions.world_state_json -> server views` 单向修复。该切片不新增 SQLite STRICT 表列、不改变 provider schema、不让 AI 裁决征税、拨银、赈济、盐漕、债务、腐败、粮价、市价、官场考成或持久化写入。提交前复审曾发现可见财赋/案牍字段若被污染成 raw table、prompt index、key/token 或本地路径形状会进入 projection；已加固 `economicFiscal`、`eventArchive`、`localAffairsDockets` 和 `militaryDiplomacy` 文本过滤，并补 route/prompt/archive 回归。S64.2 让 small fixture 的 route-safe prompt 检索总行数增至约 570 行，测试天花板同步调到 580；普通 prompt 仍由预算控制在 48 行 / 约 20,000 字符以内。已通过 focused 经济财赋/事件档案/prompt/SQLite/路由/fixture/红队测试、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和 `npm test`（493 tests）；最终只读复审子代理 Aristotle 确认无 P0/P1/P2/P3。下一步建议启动 S65.1 事件模板与历史档案生成系统。
- 2026-05-08：S70 已补 MCP-friendly 工具定义与后期内部 MCP server 策略。`docs/AI_ORCHESTRATION_ROADMAP.md`、`docs/DEVELOPMENT_STEPS.md` 和开发 brief 现在明确：S70.1-S70.3 先做内部 `game_ai_tools` registry，工具定义至少保留 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown`、`mockFallback` 语义；后期如果工具数量、按身份裁剪和跨 provider 发现需求膨胀，再在 `game_ai_tools` 外层包装内部 MCP server。内部 MCP 的 `tools/list` 只列 actor 可见工具，`tools/call` 仍进入同一 permission / resolver / audit 链。本轮只改文档规划，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构；低风险文档补充，未启用提交前子代理复审。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；未运行完整 `npm test`。
- 2026-05-08：S70 已补 MiMo-V2.5-Pro 工具调用外部技术参考与验收要求。`docs/AI_ORCHESTRATION_ROADMAP.md` 现在引用 Xiaomi MiMo-V2.5-Pro 官方页，把其 1M context、agentic/long-horizon 与大量 tool calls 能力作为 S70 技术依据；同时明确 MiMo 是主力大面积 provider 候选，但 S70.1 必须用 provider smoke 验证 `tools` schema、`tool_calls` 返回形状、`tool_choice`、多工具调用、工具结果回填、streaming、structured proposal、超长上下文成本和 Mock/no-key fallback，不能把 OpenAI-compatible 直接当作 OpenAI 工具协议全量兼容。本轮只改文档规划，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构；低风险文档补充，未启用提交前子代理复审。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；未运行完整 `npm test`。
- 2026-05-08：S64.1 外交、边防与军事数据库内容已完成于本次提交。新增 `src/game/militaryDiplomacyConfig.js` 与 `src/game/militaryDiplomacy.js`，从可见 `worldGeographyView`、`worldPeopleView` 和 `officialPostingsView` 派生 `militaryDiplomacyView`：边防战区、驻军、粮道、邻国使节往来与边患预警按角色 cap、地理/任所相关性和情报可信度过滤；书生默认不读取完整军务外交态势。游戏 start/state/turn/SSE 与考试 question/progress/submit payload 现返回该 view；`eventArchiveView` 新增 `military_diplomacy` 安全条目；`promptContextAssembler` 与 `prompt_retrieval_index` 新增 `militaryDiplomacy` / `events.militaryReports` compact rows，SQLite 读档仍从 `world_sessions.world_state_json -> server views` 单向修复。该切片不新增 SQLite STRICT 表列、不改变 provider schema、不让 AI 宣战、和议、调兵、任免统帅、结算战役或公开 hidden 情报。S64.1 让 small fixture 的 route-safe prompt 检索总行数增至约 547 行，测试天花板同步调到 560；普通 prompt 仍由预算控制在 48 行 / 约 20,000 字符以内。已通过 focused 军务/事件档案/prompt/SQLite/路由/fixture 测试、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和 `npm test`（484 tests）；提交前只读复审子代理 Avicenna 未发现 P0/P1/P2。下一步建议启动 S64.2 经济、财政、粮储与市场演化。
- 2026-05-08：S70 AI 工具与数据库写入边界已改为“领域工具 proposal + 服务器事务落库”口径。AI 仍不能执行 SQL、不能直接写 canonical 状态/业务表/审计表，但允许老师、考官、NPC、县令、大臣、将领、皇帝和系统世界引擎按身份调用领域工具提交 proposal 或 request-adjudication；服务器 resolver 负责权限、schema、可见性、规则、审计和 adapter transaction。同步更新治理锚点、开发 brief、活动台账、动态数据库规划、AI 编排路线图和 AI 控制矩阵；本轮只改文档，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和文档范围 `git diff --check`；未运行完整 `npm test`，因为本轮只改文档规划。
- 2026-05-08：S68.0 科举、读书、评卷与授官深化提前规划已加入活动路线图和 brief，并新增 `docs/IMPERIAL_EXAM_DEEPENING_ROADMAP.md`。规划把书生主线从现有四级考试链深化为制度生涯：读书画像、AI 老师点评、保结、童试县试/府试/院试、乡试/会试三场多日多卷、贡院号舍、弥封、誊录、对读、磨勘、复核、房官/同考官/主考官多层评卷、解元/会元/状元/榜眼/探花/传胪/三元、馆选、庶吉士、观政、铨选、候缺、外放和籍贯回避。S68-S69 排在 S67 后、S70 前，作为多 AI 工具编排的科举先行样板；本轮只改文档规划，不改运行时代码、API、provider schema、存档格式、SQLite 表结构或玩家 UI。后续实现必须继续保护完整 scholar path、Mock/no-key、AI 不直写榜单/官职/授官和服务器最终裁决。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读复审子代理 Popper 发现的 S68 子步骤编号不一致已修正，复查无 P0/P1/P2；未运行完整 `npm test`，因为本轮只改文档规划。
- 2026-05-08：S63.2 地方事务与案牍事件模板已完成于本次提交。新增 `src/game/localAffairsDocketConfig.js` 和 `src/game/localAffairsDockets.js`，集中案牍模板、严重度阈值、辖区 cap、prompt/archive cap，并从可见 `worldGeographyView` 城市指标与 `officialPostingsView` 任所/辖区派生 `localAffairsDocketView`。案牍覆盖钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束；书生默认不可见，地方官/入仕官员/大臣/皇帝/将领按行政身份读取 capped 辖区案牍。游戏 start/state/turn/SSE 和考试 payload 现返回 `localAffairsDocketView`；`eventArchiveView` 新增 `local_docket` 安全条目；`promptContextAssembler` 与 `prompt_retrieval_index` 新增 `events.localDockets` compact rows，SQLite 读档仍只从 `world_sessions.world_state_json -> server views` 单向修复。该切片不写 `worldGeography`、`officialCareer`、`officialPostings`、`geo_*`、`office_*`、`event_archive_index` 或 `prompt_retrieval_index`，也不让案牍直接结算地方事务或官场考成。已通过 focused 案牍/事件档案/prompt/SQLite/路由测试、`test/worldContentFixtures.test.js`、`test/sessionStoreAdapterContract.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（476 tests）；提交前只读复审子代理 Bacon 未发现 P0/P1/P2。下一步建议启动 S64.1 外交、边防与军事数据库内容。
- 2026-05-08：S63.1 官职生态与任命池已完成于本次提交。新增 `src/game/officialEcosystemConfig.js`，集中任命池行 ID、复核 turn、空缺压力权重、阈值、候补官缺和可见 NPC 选择标签。`src/game/officialPostings.js` 现在会在玩家当前任所之外幂等派生上级堂官、属官/胥吏/幕友/同僚接口、空缺、候补迁转、补授/试署/外放、丁忧、起复和弹劾候勘压力；这些行进入 `officialPostingsView`、SQLite `office_*` 派生行和 capped prompt retrieval，但不改变 `officialCareer`、`player.officeTitle`、升降补缺、起复处分或真实任命事实。`officialPostingSchemas` 为 posting 增加 capped `assignmentIds`；`eventArchiveView` 排除 `assessment-s63-*` 任命池压力，避免把官缺候补案牍误写成公开历史事件，真实任所考成仍可生成 `official_assessment`。S63.1 `role_visible` 官缺线索只对行政身份开放，书生默认不读任命池；AI 仍不能写 `officialPostings`、`office_*`、任免、起复、处分或补缺结果。已通过 `node --test test/officialPostings.test.js test/officialPostingSchemas.test.js`、`node --test test/sqlitePromptRetrieval.test.js`、`node --test test/promptContextAssembler.test.js test/prompts.test.js`、`node --test test/worldContentFixtures.test.js`、`node --test test/sessionStoreAdapterContract.test.js`、`node --test test/eventArchive.test.js test/gameTurnEventArchive.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（468 tests）；提交前只读复审子代理 Popper 未发现 P0/P1/P2，P3 建议是后续补 brief 清晰度与 S66.2 浏览器 hidden-token smoke。下一步建议启动 S63.2 地方事务与案牍事件模板。
- 2026-05-08：S62.2 NPC 生命周期与资产流动已完成于 `15e532c`。新增 `src/game/worldPeopleLifecycle.js` 与 `src/game/worldPeopleLifecycleConfig.js`：服务器在月末或显式 force 时 deterministic 推进可见 NPC 健康/年龄、丧事、迁居、官职履历状态、财富/欠账、家族债压、资产估值/欠账、田产租谷/纠纷、人情债、怨望和庇护关系；年度/force 场景可生成公开婚姻谱系。`src/routes/game.js` 已在普通回合 `worldTick`、长期事件和官场结算之后运行 helper，再进入既有 `buildWorldPeopleEventBatch()`，所以可见人物变化继续通过 `world_people` 审计和 SQLite `people_*` 派生行 `last_event_id` 追踪；新增婚姻/关系行会生成 `relationship_created` 公开审计事件。AI 仍不能 patch `worldPeople`、写 raw `people_*`、公开 hidden 私档或裁决资产真数/隐藏动机/死亡/任免；helper 写回前会经 `normalizeWorldPeopleState()` 过滤，玩家 UI/prompt 仍只读 capped `worldPeopleView`。已通过 focused node checks、`node --test test/worldPeopleLifecycle.test.js`、`node --test test/gameTurnRelationships.test.js`、`node --test test/gameTurnTick.test.js`、`node --test test/worldPeopleEvents.test.js`、`node --test test/worldPeoplePopulation.test.js`、`node --test test/sessionStoreAdapterContract.test.js`、`node --test test/sqlitePromptRetrieval.test.js test/worldContentFixtures.test.js test/worldPeopleSchemas.test.js test/worldPeopleBridge.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（467 tests）。下一步建议启动 S63.1 官职生态与任命池，或在 S66.2 做人物谱牒浏览器搜索/筛选/分页。
- 2026-05-08：S62.1 NPC 人口生成与家族谱系已完成于 `ceae352`。新增 `src/game/worldPeoplePopulation.js`，用 deterministic profile 生成可见 NPC、家族和关系 projection，覆盖官员、胥吏、士绅、商贾、军官、书院师友、同年、亲族和邻国使者。S60/S62 规模 fixture 的 small route-safe 人物样本与 medium/large storage-only 侧车改用同一生成器：small 继续只写入当前 raw route 可安全返回的 `worldPeople` projection，medium/large 可达 480/2000 NPC 与 160/700 家族等总量但不突破 route cap。谱系补父母、配偶、子女、姻亲标签和家族成员引用；关系补家门、婚姻、门生故旧、同乡、同年和派系网络。`measureWorldContentFixture()` 现在报告人物谱系覆盖指标。AI 仍只能读取 capped `worldPeopleView` / prompt retrieval 摘要，不能新造 hidden NPC、写 `people_*`、公开 hidden 私档或裁决婚姻/升迁；本轮不新增 SQLite 表列、provider schema、玩家 API 形状或资产真数。已通过 focused node check、`node --test test/worldPeoplePopulation.test.js`、`node --test test/worldContentFixtures.test.js`、`node --test test/worldPeopleSchemas.test.js test/worldPeopleBridge.test.js test/sqlitePromptRetrieval.test.js`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（462 tests）。下一步建议启动 S62.2 生命周期与资产流动，或把 S62.1 生成的人物 projection 交给 S66.2 做真实浏览器搜索/筛选/分页。
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

Start S65.2 intelligence, rumor, and visibility rules. S66.2 can later use the S62/S63/S64/S65 projections plus the S60.2 fixture/page helper to build real browser search, filtering, pagination, and hidden-token smoke for large information panels.
