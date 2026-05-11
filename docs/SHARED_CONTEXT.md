# Shared AI Development Context

这是 Codex 与 Claude Code 共用的精简交接板。详细历史请看 `docs/DEVELOPMENT_STEPS.md`、各阶段归档和专题契约文档。

## Read First

每次开发会话开始前必须读取：

1. `AGENTS.md` 或 `CLAUDE.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

稳定治理锚点见 `docs/DEVELOPMENT_GOVERNANCE.md`。重写路线图、交接文档或 brief 时不得删弱其中的必守规则，并运行 `npm run check:docs-governance`。

## Current Snapshot

- Product: browser + Node.js historical simulation text game **Qianqiu / 千秋**。
- Runtime target: `npm install && npm start`，然后打开 `http://localhost:3000`。
- Frontend: plain HTML/CSS/JS，无 build step。
- Backend: Node.js + Express，plain JavaScript。
- AI providers: adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic。`AI_PROVIDER=mock` 仍是默认可玩模式；`mimo-deepseek` 只是方法级最小路由，MiMo 负责 start/turn/stream/question，DeepSeek 负责 exam grading。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地 `world_sessions`、audit tables、`geo_*`、`people_*`、`office_*`、`event_archive_index` 和 `prompt_retrieval_index`。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复；raw business/audit rows 不是 route、prompt、browser 或服务器裁决 truth source。
- Active roadmap: S49-S53、S54-S59、S60-S67 已完成并归档。S68.1 科举制度契约与 S68.2 读书账本基础已完成；按用户指令本轮完成 S68.2 即停下，不启动 S68.3。后续若继续，应从 S68.3 老师点评与书院/同窗互动开始，再推进 S68-S69 科举、读书、评卷与授官深化，最后进入 S70 AI prompt pack、工具协议、actor 权限和多 AI 编排。
- Current local `.env`: 可能含用户提供的 provider keys。`.env` 被 Git 忽略，不能打印或提交。

## Core Invariants

- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 是《千秋》的核心世界引擎，不是可替换装饰。新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI read scope、actor intelligence、tool permissions、proposal boundaries、server adjudication、audit records 和 Mock/no-key fallback。
- Provider 只能建议叙事、受限 `statePatch`、关系变化、评分 JSON、考试触发或身份受限领域工具 proposal；服务器拥有晋级、考试资格、作弊处罚、持久化、保护字段、官职任免、长期事件、时间推进、数据库写入和可见性过滤。
- AI JSON 必须先验证再应用；状态变化必须经过白名单、clamp 和 server-owned follow-up modules。
- 游戏规则、阈值、时间间隔、概率、UI caps、fixture 规模和 prompt budgets 等可调参数不得散落为 magic numbers；优先放入 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，写明单位、范围和默认意图。
- `GET /api/game/saves` 只返回脱敏 metadata；完整存档通过 `GET /api/game/state/:sessionId` 读取。
- 本地可玩性不能依赖真实模型 key；有 key 的 provider 检查必须在缺 key 时受控 skip 或 fail。
- 每个 coherent change 必须更新本交接板和步骤台账，运行相关验证，并用 Git 提交。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文；代码标识符、API/协议名、第三方术语和命令输出可保留英文。

## Content Protection

- 当前范围只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- AI 可以通过身份受限领域工具提交 proposal / request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`，工具调用也不能被当作已经发生的世界事实。
- 浏览器和 prompt 只读服务器生成的 view / capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密档事件链和隐藏情报真值不得回填当前 raw route `worldState`。如果后续要保存完整 hidden 私档，先设计 API redaction 与角色视野分层。
- S66.1 的 `retrievalContext.strategy` 是只读上下文编排元数据，不是权限层。普通/high profile 仍约束在 48/72 行与约 20,000/30,000 字符；AI 仍不得写数据库、裁决事件、任免、战和、财政结算或公开 hidden。
- S66.2 的 `informationPanelPageView` 是浏览器局势簿分页 projection，只从服务器 route views 与安全事件档案条目生成；它不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes 或 hidden intent。
- S68.1 的科举制度契约见 `docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md`。S68-S69 科举深化中，外层四级科举 API 继续保持 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`，内部再扩县试/府试/院试、乡试/会试三场、多卷生命周期、保结、搜检、号舍、弥封、誊录、对读、磨勘、复核、多考官 proposal、榜单荣誉和授官 resolver。AI 老师、保人、同年、考官、吏部和皇帝只能提交题目、点评、事件、批语、复核疑点或授官 proposal；服务器仍拥有资格、舞弊、榜单、名次、授官、任免和持久化裁决。
- S68.2 的 `studyProfile` / `studyProfileView` 是服务器拥有的读书账本与学业计划 projection。普通读书行动可由服务器记入日课，考试提交后按 `player.examHistory`、评分维度和本地复核刷新文卷强弱、老师建议、书目与下旬计划；prompt 只读取 capped `studyProfile` 摘要，浏览器只读 route `studyProfileView`。普通 provider patch 不能写 `studyProfile`，也不能借读书建议直接授名位、改榜、改官职或写隐藏事实。
- S70 工具方向是“模型请求工具、服务器执行工具”。Function calling、Structured Outputs、MCP connector 或未来内部 MCP 只能产生 tool call / proposal / request-adjudication；真正落库由服务器 resolver 和 adapter transaction 完成。
- S70.1-S70.3 先实现内部 `game_ai_tools` registry；工具定义保持 MCP-friendly，至少包含 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown` 和 `mockFallback`。

## Subagent Discipline

- 用户已授权 Codex 和 Claude Code 在本仓库使用子代理，除非后续指令撤销，否则视为长期项目上下文。
- 实施子代理只能做 scoped patches 和 focused verification；不得运行 `git add`、`git commit`、`git push` 或创建 PR。
- 主代理负责整合、最终验证、共享文档同步和唯一 coherent commit。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须至少委派一个只读子代理审查最终 diff 与验证证据。
- 低风险纯文档改动可跳过子代理复审；路线图重写或内容安全边界变更即使是文档，也应做只读复审。

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
- State rules, time, exams, promotions, study profile, official career, relationships, long-term events, world entities/threads: `src/game/`
- Geography, people, official postings, local affairs dockets, military diplomacy, economic fiscal projection, historical event archive, intelligence rumors, event archive, information panel paging, audit public projection: `src/game/worldGeography.js`, `src/game/worldPeople.js`, `src/game/officialPostings.js`, `src/game/localAffairsDockets.js`, `src/game/militaryDiplomacy.js`, `src/game/economicFiscal.js`, `src/game/historicalEventArchive.js`, `src/game/intelligenceRumors.js`, `src/game/eventArchive.js`, `src/game/informationPanelPage.js`, `src/game/auditPublicProjection.js`
- S60/S62 scale fixture and population helpers: `src/game/worldContentFixtures.js`, `src/game/worldPeoplePopulation.js`
- Storage facade/adapters and SQLite derived tables: `src/storage/sessionStore.js`, `src/storage/jsonSessionAdapter.js`, `src/storage/sqliteSessionAdapter.js`, `src/storage/sqliteGeographyTables.js`, `src/storage/sqlitePeopleTables.js`, `src/storage/sqliteOfficialPostingTables.js`, `src/storage/sqliteEventArchiveTables.js`, `src/storage/sqlitePromptRetrievalTables.js`
- Browser app: `public/index.html`, `public/app.js`, `public/styles.css`

## Archives And Contracts

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_ACCEPTANCE.md`
- `docs/BROWSER_INFORMATION_PANEL_PLAN.md`
- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/REAL_PROVIDER_ACCEPTANCE.md`
- `docs/SESSION_STORAGE_MIGRATION_PLAN.md`
- `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`
- `docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`：S49-S53 本地数据库基础。
- `docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`：S54-S59 本地 SQLite 业务表、索引、维护工具和 dual-mode acceptance。
- `docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md`：S60 内容规模、seed 分层、可见性与 fixture 验收契约。
- `docs/HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md`：S60-S67 内容充实、prompt 策略、局势簿分页和 scale acceptance 归档。
- `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`
- `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`
- `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`
- `docs/AI_CONTROL_AUDIT_MATRIX.md`
- `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`
- `docs/IMPERIAL_EXAM_DEEPENING_ROADMAP.md`
- `docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md`
- `docs/AI_ORCHESTRATION_ROADMAP.md`

## Current Work Note

- 2026-05-11：S68.2 读书账本与学业计划基础已完成。新增 `src/game/studyProfileConfig.js` 和 `src/game/studyProfile.js`，在 `worldState.studyProfile` 下保存服务器拥有的学业画像，并通过 `studyProfileView` 暴露经义根柢、制艺章法、策论时务、史事典故、律例判断、誊写卷面、科场耐力、最近日课、文卷强弱、老师建议、书目和下旬计划。`src/routes/game.js` 在 start/state/turn/SSE 中返回 view，并在普通读书行动后记账；`src/routes/exam.js` 在 question/submit 中返回 view，并在交卷后按评分和复核刷新弱点；`src/ai/promptContextAssembler.js` 只给 provider capped `studyProfile` 摘要；`public/app.js` 新增书生读书面板；`src/game/stateRules.js` 拒绝普通 provider patch 写 `studyProfile`。已同步 README、brief、architecture、AI 控制矩阵、科举深化路线图和步骤台账。已通过聚焦检查、治理检查、`git diff --check` 和 S67 scale 单用例；`npm test` 两次均为 520 项中 519 项通过，唯一失败为既有 S67.1 `sqliteReadRepairMs` 全量并发性能阈值波动（单用例通过）。提交前已执行只读子代理复审。本轮按用户指令完成 S68.2 后停止，不启动 S68.3。

## Next Recommended Step

Stop after S68.2 per user instruction. 后续若用户明确继续，再启动 S68.3：老师点评与书院/同窗互动，重点补 AI 老师 proposal schema、荐书/小题训练、保结前置、书院与同窗关系，并继续让关系、名位和持久化事实由服务器裁决。
