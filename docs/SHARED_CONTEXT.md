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
- Active roadmap: S49-S53、S54-S59、S60-S67 已完成并归档。S68.1 科举制度契约、S68.2 读书账本基础、S68.3 老师/书院/同窗互动、S68.4 科场制度流程、S68.5 科场事件/多考官阅卷、S69.1 榜单名次荣誉与 S69.2 同年座师网络已完成；后续应从 S69.3 授官路径深化开始，再推进科举档案面板和 provider/Mock 验收，最后进入 S70 AI prompt pack、工具协议、actor 权限和多 AI 编排。
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
- S68.2-S68.3 的 `studyProfile` / `studyProfileView` 是服务器拥有的读书账本、学业计划、老师点评与书院/同窗互动 projection。普通读书行动可由服务器记入日课；拜师、讲会、同窗互评、小题训练和求保结由服务器更新可见师友关系、老师点评、小题、荐书和 `academyNetwork.sponsorship` 保结稳度；考试提交后按 `player.examHistory`、评分维度和本地复核刷新文卷强弱、老师建议、老师复盘、书目与下旬计划。prompt 只读取 capped `studyProfile` 摘要，浏览器只读 route `studyProfileView`。普通 provider patch 不能写 `studyProfile`、`player.teacher` 或 `player.position`，师承身份、名位文本与关系事实只能由服务器读书/官职 resolver 解析；`teacherFeedbackProposal` 也只能提交文本点评 proposal，不能借读书建议直接授名位、改榜、改官职、创造真实关系或写隐藏事实。
- S68.4 的 `activeExam.procedure` / `examProcedureView` 是服务器拥有的科场制度流程 projection。入场取题、场内推进和交卷归档会同步童试县试/府试/院试摘要、乡试/会试三场多卷、保结、搜检、号舍、发题、草稿、誊清、交卷、弥封、誊录、对读、磨勘、放榜和归档公开状态；交卷后安全快照进入 `player.examHistory[].examProcedure`。prompt 只读取 capped `examProcedure` 摘要，浏览器只读 route `examProcedureView` 或历史安全快照。普通 provider patch 不能写 `examProcedure`、`activeExam`、卷件生命周期、榜单、名次或官职；当前实现不保存弥封身份映射、保结密注、考官私意、模型原始建议或内部审计，若未来需要 hidden 卷件真值必须先设计 API redaction 与角色视野分层。
- S68.5 的 `examinerPanelView` 是服务器拥有的科场事件与多考官阅卷 projection。交卷时服务器在本地反作弊后、虚拟考生/榜单/晋级前运行 `resolveExamReview()`，把夹带疑云、号舍病困、誊录误差、房官/同考官/主考官/磨勘 critic 建议和 provider `examiner_reviews` 整理为脱敏公开摘要；只有服务器自身 reviewer delta 和事件 delta 会按配置限幅进入最终 score，provider 考官建议一律未采纳留痕。浏览器考试结果、考试档案和书生面板只读 `examinerPanelView` 或 `examProcedureView.examinerPanelView`，prompt 只读 capped `examinerPanel` 摘要；仍不保存弥封映射、考官 hidden intent、保结 hidden notes、raw proposal、raw audit、本地路径或 key。
- S69.1 的 `examHonorLedger` / `examHonorView` 是服务器拥有的榜单名次荣誉 projection。交卷时服务器先生成 canonical ranking，再由 `examHonors` 写定解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元及第；殿试 promotion 读取 canonical palace class，考试历史保存安全 `examHonor` 快照。`/api/game/start`、`GET /api/game/state/:sessionId`、普通/流式 `/api/game/turn`、`/api/exam/question` 和 `/api/exam/submit` 都返回 `examHonorView`；prompt 只读 capped `examHonors` 摘要，浏览器只读 route view 或历史快照。provider `ranking`、`virtual_candidates`、`examiner_reviews`、普通 `statePatch`、皇帝/吏部叙事都不能授予荣誉、改甲第、定官职或写 hidden 榜单。
- S69.2 的 `examNetwork` 是服务器拥有的同年、座师与考官网络安全快照。交卷时服务器在 canonical ranking、荣誉和 cohort 记录完成后运行 `resolveExamNetwork()`，从定榜顺序、公开荣誉和脱敏阅卷摘要派生同年、房官、主考/座师、殿试读卷官等可见联系人，写入 `characters -> relationshipLedger -> relationshipView/worldPeopleView`，并把安全 `examHistory[].examNetwork` 快照纳入事件档案 `exam_network` 条目和 capped prompt `examNetwork` 摘要。provider `examiner_reviews`、普通 `relationshipChanges`、raw proposal、弥封映射、考官 hidden intent、保结密注或 hidden 榜单不能创建 durable 同年/座师/考官事实。
- S70 工具方向是“模型请求工具、服务器执行工具”。Function calling、Structured Outputs、MCP connector 或未来内部 MCP 只能产生 tool call / proposal / request-adjudication；真正落库由服务器 resolver 和 adapter transaction 完成。
- S70.1-S70.3 先实现内部 `game_ai_tools` registry；工具定义保持 MCP-friendly，至少包含 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown` 和 `mockFallback`。
- S70 之后的正式体验按 AI-first 规划：真实 AI 是产品核心，MiMo-V2.5-Pro 是大面积 provider 候选，Mock/no-key 只作为开发、CI、断网降级和 deterministic 回归样板。新增的上级赏罚/升迁、玩家月报、自然语言跳时、AI 设置、actor 记忆和地图接口都只能通过 proposal / request-adjudication / server resolver 落地，不得放开 SQL、raw table、hidden truth 或直写库。

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
- State rules, time, exams, promotions, exam procedure/review/honors/networks, study profile, official career, relationships, long-term events, world entities/threads: `src/game/`
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

- 2026-05-12：按用户要求补充 S70 AI-first 体验规划，不改当前 S69 实现节奏。`docs/AI_ORCHESTRATION_ROADMAP.md` 已扩展正式 AI 必选方向、权限增强工具、玩家官职月报、自然语言跳时、AI 设置面板、大模型记忆分层和后续地图接口；`docs/DEVELOPMENT_STEPS.md` 将 S70 扩到 S70.14，并把真实 MiMo 验收、月报、跳时、记忆和地图接口列为后续 TODO。关键边界：增强 AI 权限是增强领域工具和服务器 resolver，不是让模型执行 SQL、直写 canonical 状态或读取 hidden/raw。验证已跑 docs governance、documentation governance test 和目标文档 `git diff --check`；本轮纯规划文档变更，跳过子代理复审，但路线图边界已在本交接板明确。
- 2026-05-12：S69.2 同年、座师与考官网络已实现，提交待本次收束。新增 `src/game/examNetworksConfig.js` 与 `src/game/examNetworks.js`，`/api/exam/submit` 在 canonical ranking、`examHonors` 和 cohort 记录完成后调用 `resolveExamNetwork()`，从服务器定榜顺序派生同年、房官、主考/座师和殿试读卷官可见联系人，写入 `characters -> relationshipLedger`，从而进入 `relationshipView` 和 `worldPeopleView`；考试历史保存安全 `examNetwork` 快照，事件档案新增 `exam_network` 条目，prompt context 新增 capped `examNetwork` 摘要。已通过语法检查和聚焦测试：`node --test test/examNetworks.test.js test/examHonors.test.js test/examHonorsRoute.test.js test/worldPeopleBridge.test.js test/relationshipLedger.test.js test/eventArchive.test.js test/promptContextAssembler.test.js test/prompts.test.js test/stateRules.test.js test/aiSchemas.test.js test/publicAppSource.test.js`（84/84）。本步仍不保存 hidden 榜单、弥封身份映射、考官 hidden intent、保结密注、模型原始建议或内部审计；授官路径深化仍留给 S69.3。子代理只读调研因账号配额 403 未返回；提交前只读复审已完成，未发现阻塞问题，确认关系事实只从服务器定榜和配置派生。残余缺口为未跑完整浏览器端到端、SQLite parity 和旧存档污染 `examNetwork` 快照清洗。

## Next Recommended Step

启动 S69.3：授官路径深化。优先在殿试后用服务器 resolver 区分一甲翰林、二甲馆选/庶吉士/观政、三甲铨选/部属/外放/候缺和籍贯回避，把 `examHonorView`、`examNetwork`、官缺与朝局压力作为输入，但继续禁止吏部/皇帝/模型 proposal 直接写官职事实。
