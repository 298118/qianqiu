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
- Active roadmap: S49-S53、S54-S59、S60-S67 已完成并归档。S68.1 科举制度契约已完成；下一步是 S68.2 读书账本与学业计划，随后推进 S68-S69 科举、读书、评卷与授官深化，再进入 S70 AI prompt pack、工具协议、actor 权限和多 AI 编排。
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
- State rules, time, exams, promotions, official career, relationships, long-term events, world entities/threads: `src/game/`
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

- 2026-05-11：S68.1 科举制度契约已完成于本次文档变更。新增 `docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md`，固定明清原型与游戏压缩、外层四级科举 API 兼容、童试县试/府试/院试、乡试/会试三场、多日多卷、保结、搜检、号舍、弥封、誊录、对读、磨勘、复核、多考官阅卷、榜单荣誉、授官 resolver、建议 view、AI actor 权限、服务器裁决边界、Mock/provider 降级、审计和红队清单。同步 README、brief、架构、AI 控制矩阵、科举深化路线图和步骤台账。本轮不改运行时代码、API、provider schema、Mock 行为、存档格式或 SQLite 表结构；当前完整书生路径仍按既有实现运行。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；完整 `npm test` 未运行，因为本轮是制度契约文档变更。提交前只读子代理复审未发现 P0/P1，已按 P2 建议修正 README 导语和路线图旧时态。下一步是 S68.2。

## Next Recommended Step

Start S68.2：读书账本与学业计划。优先实现 `studyProfileView`、文卷弱点画像、经史书目/日课、老师建议与 Mock/no-key fallback，并保持 AI 点评 proposal-only、属性和关系变化由服务器裁决。
