# Shared AI Development Context

这是 Codex 与 Gemini CLI 当前共用的精简交接板。详细历史请看 `docs/DEVELOPMENT_STEPS.md`、各阶段归档和专题契约文档；本文件只保留接手下一步所必需的状态、规则和内容保护边界。

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
- Frontend: plain HTML/CSS/JS，无 build step。Backend: Node.js + Express，plain JavaScript。
- AI providers: adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic。`AI_PROVIDER=mock` 仍是默认可玩模式，即使本机存在真实 provider key 也不会自动改走真实模型；`mimo-deepseek` 下 narrator/科举出题仍优先 MiMo，domain_specialist/科举评卷和 critic/safety 在 DeepSeek key 可用时走 DeepSeek。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地 `schema_migrations`、`world_sessions`、audit tables、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index`。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复；raw business/audit rows 不是 route、prompt、browser、搜索或服务器裁决 truth source。
- Roadmap status: S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排和 S71 数据库玩法化均已完成并归档。S72 PixiJS 水墨地图专项已完成 S72.1 依赖治理与 runtime 契约，任务书见 `docs/PIXIJS_INK_MAP_ROADMAP.md`，运行时契约见 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`，素材指南见 `docs/MAP_ASSET_GUIDE.md`，素材台账见 `docs/MAP_ASSET_LEDGER.md`。
- Current collaboration: Codex 负责后端地图 view/API/schema、AI/server 权限、素材生成与台账、Gemini diff 审核、最终文档同步和提交；S72 地图 AI 生图统一由 Codex 使用 `gpt-image-2` 完成，AI 生成素材和第三方入库候选素材都必须由 Codex 做视觉审核，确认游戏基调、历史/水墨适配、可读性和同批一致性；Gemini CLI 负责前端 PixiJS patch、图层、动效、交互和浏览器验证说明，可以按任务修改或新增 scoped frontend 文件和必要前端上下文说明，但不得运行 `git add`、`git commit`、`git push` 或创建 PR，也不得自行生成或引入未经审核登记的素材。
- Gemini context: 仓库根目录 `GEMINI.md` 是 Gemini CLI 的项目开发指引；`.geminiignore` 用于排除 `.env`、存档、审计、数据库、产物和依赖目录，避免 Gemini 读取敏感或大体积本地文件。
- Current local `.env`: 可能含用户提供的 provider keys。`.env` 被 Git 忽略，不能打印或提交。

## Core Invariants

- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 是《千秋》的核心世界引擎，不是可替换装饰。新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI read scope、actor intelligence、tool permissions、proposal boundaries、server adjudication、audit records 和 Mock/no-key fallback。
- Provider 只能建议叙事、受限 `statePatch`、关系变化、评分 JSON、考试触发或身份受限领域工具 proposal；服务器拥有晋级、考试资格、作弊处罚、持久化、保护字段、官职任免、长期事件、时间推进、数据库写入和可见性过滤。
- AI JSON 必须先验证再应用；状态变化必须经过白名单、clamp 和 server-owned follow-up modules。
- 游戏规则、阈值、时间间隔、概率、UI caps、fixture 规模和 prompt budgets 等可调参数不得散落为 magic numbers；优先放入 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，写明单位、范围和默认意图。
- `GET /api/game/saves` 只返回脱敏 metadata；普通浏览器读档优先通过 `GET /api/game/player-state/:sessionId` 读取 redacted player state 和清洗后的 route views，`GET /api/game/state/:sessionId` 仅作为短期开发兼容快照。
- 本地可玩性不能依赖真实模型 key；有 key 的 provider 检查必须在缺 key 时受控 skip 或 fail。
- 每个 coherent change 必须更新本交接板和步骤台账，运行相关验证，并用 Git 提交。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文；代码标识符、API/协议名、第三方术语和命令输出可保留英文。

## Content Protection

- 当前范围只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- AI 可以通过身份受限领域工具提交 proposal / request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`，工具调用也不能被当作已经发生的世界事实。
- 浏览器和 prompt 只读服务器生成的 view / capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。S70.12 起游戏/考试 route response 内的兼容 `worldState` 也会剥离 raw `actorMemoryLedger` 与 `sessionSummary`。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密档事件链和隐藏情报真值不得回填当前 raw route `worldState`。如果后续要保存完整 hidden 私档，先设计 API redaction 与角色视野分层。
- 玩家可见 projection 边界：`informationPanelPageView`、`safeWorldSearchView`、`actorMemoryView`、`sessionSummaryView`、`mapContextView`、`aiControlAuditView` 和 `server_player_visible_state_projection` 都只暴露清洗后的公开摘要、snippet、ref、confidence、visibility 和 bounded audit summary；不返回内部行、审计原文、provider 输出、完整 prompt、本地路径、key、hidden notes 或 hidden intent。
- 本机开发诊断 `GET /api/dev/session-diagnostics/:sessionId` 默认关闭，production 强制关闭，只在 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback 且 Origin 为空或本机 loopback Origin 通过时返回安全统计；不返回 raw state、raw audit、provider payload、prompt、本地路径、key、SQLite 原始行或 hidden ledger。
- S70/S71 领域工具与 resolver 边界：`cityPolicyResolver`、`judicialCaseResolver`、`militaryDiplomacyResolver`、`worldPressureEventGenerator`、`sceneRuntime`、NPC 记忆和 AI 调动审计均由服务器拥有裁决与 apply；`server.*` 只能是内部 resolver/audit label，不能进入模型可见工具列表或 provider schema。
- S68-S69 科举深化继续保持 proposal-only：老师、保人、同年、考官、吏部和皇帝只能提交题目、点评、事件、批语、复核疑点或授官 proposal；服务器仍拥有资格、舞弊、榜单、名次、授官、任免和持久化裁决。外层 API 保持 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`，浏览器/prompt 只读 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`examNetwork`、`appointmentTrackView` 和考试历史安全快照。

## Subagent Discipline

- 用户已授权 Codex 在本仓库使用子代理，除非后续指令撤销，否则视为长期项目上下文。当前协作对象 Gemini CLI 不是 Git 提交者；它可以修改或新增 scoped 前端文件并交付 patch、上下文说明与验证报告，Codex 负责审查 diff、验证、暂存和提交。
- 实施子代理只能做 scoped patches 和 focused verification；不得运行 `git add`、`git commit`、`git push` 或创建 PR。
- 主代理负责整合、最终验证、共享文档同步和唯一 coherent commit。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须至少委派一个只读子代理审查最终 diff 与验证证据。
- 低风险纯文档改动可跳过子代理复审；路线图重写或内容安全边界变更即使是文档，也应做只读复审。

## Implemented Surface

API:

- `GET /api/health`
- `POST /api/game/start`
- `GET /api/game/saves`
- `GET /api/game/player-state/:sessionId`
- `GET /api/game/state/:sessionId`
- `GET /api/game/search/:sessionId`
- `POST /api/game/turn`
- `POST /api/ai/connection-test`
- `GET /api/ai/settings/:sessionId`
- `POST /api/ai/settings/:sessionId`
- `GET /api/dev/session-diagnostics/:sessionId`（默认关闭，仅本机开发诊断）
- `POST /api/exam/question`
- `POST /api/exam/progress`
- `POST /api/exam/submit`

Important module areas:

- AI adapters/prompts/schemas/tool contracts、actor 权限、内部工具运行时、NPC mind、制度场景、事件/领域/地图工具：`src/ai/`、`src/game/aiActorProfiles.js`、`src/ai/gameAiToolRunner.js`、`src/game/npcMind.js`、`src/game/institutionScenes.js`、`src/game/domainToolResolvers.js`。
- 财政/城市政策、刑名案件、军务/外交、压力事件、scene runtime、NPC 记忆、AI 设置和 AI 调动审计：`src/game/cityPolicyResolver.js`、`src/game/judicialCaseResolver.js`、`src/game/militaryDiplomacyResolver.js`、`src/game/worldPressureEventGenerator.js`、`src/game/sceneRuntime.js`、`src/game/actorMemoryLedger.js`、`src/game/aiSettings.js`、`src/game/aiControlAudit.js`。
- State rules、time、exams、promotions、exam procedure/review/honors/networks/appointment tracks、study profile、official career、relationships、long-term events、world entities/threads：`src/game/`。
- Redacted player state、本机开发诊断、安全本地搜索、事件档案、prompt retrieval、SQLite migration/maintenance 与 storage adapters：`src/game/redactedState.js`、`src/routes/dev.js`、`src/game/safeWorldSearch.js`、`src/game/eventArchive.js`、`src/storage/`。
- Browser app: `public/index.html`、`public/app.js`、`public/styles.css`。

## Archives And Contracts

各阶段规划源头不在本文件展开，追溯路线图源头时优先查看 `docs/DEVELOPMENT_STEPS.md` 顶部归档索引。

- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
- `docs/DEVELOPMENT_STEPS.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_CONTROL_AUDIT_MATRIX.md`
- `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`
- `docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md`
- `docs/IMPERIAL_EXAM_DEEPENING_ARCHIVE.md`
- `docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md`
- `docs/AI_PROMPT_ENGINEERING_CONTRACT.md`
- `docs/AI_TOOL_PROTOCOL_CONTRACT.md`
- `docs/AI_ORCHESTRATION_ARCHIVE.md`
- `docs/DATABASE_RESOLVER_INPUT_CONTRACT.md`
- `docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md`
- `docs/DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md`
- `docs/PIXIJS_INK_MAP_ROADMAP.md`
- `docs/MAP_ASSET_GUIDE.md`
- `docs/MAP_ASSET_LEDGER.md`
- `GEMINI.md`

## Current Work Note

- 2026-05-14：按用户要求归档活动台账中的已完成路线并压缩共享上下文。`docs/DEVELOPMENT_STEPS.md` 已改为只保留治理保护块、归档索引、当前边界、空活动总览和本轮记录；DONE 的 S68-S71 长表与长进度记录不再留在活动台账。`docs/SHARED_CONTEXT.md` 已压缩为必读状态、核心边界、内容保护、实现入口和归档入口。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2，确认治理规则、归档入口和 hidden/raw 内容保护边界未被删弱。
- 2026-05-14：按用户新要求启动 S72 PixiJS 水墨地图专项规划，并把当前活动协作从 Claude Code 交接切换为 Codex + Gemini CLI。Codex 负责后端、素材、审核与 Git 提交；Gemini CLI 负责前端 PixiJS patch 且不做 Git 提交。新增 `docs/PIXIJS_INK_MAP_ROADMAP.md` 和 `docs/MAP_ASSET_LEDGER.md`，`docs/DEVELOPMENT_STEPS.md` 已写明 S72.0-S72.8 owner 与验收边界。本轮仍不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限；S72.1 前不得直接接入 PixiJS 依赖。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2。完整 `npm test` 已运行但未全过，唯一失败为既有 S67 大规模 fixture 性能阈值：`fixtureGenerationMs 11122.608 > 10000`，其余 830 项通过；本轮未改 S67 fixture 或运行时代码。
- 2026-05-14：按用户要求细化 S72 给 Codex/Gemini 直接开发使用。`docs/PIXIJS_INK_MAP_ROADMAP.md` 已扩展为后端 `mapRuntimeView` 草案、前端 PixiJS 文件/图层/接口/动效/性能规格、素材清单、Gemini 交付格式和首个只读任务；新增 `docs/MAP_ASSET_GUIDE.md`，细化 AI 生图、历史参考查找、manifest、许可记录、文件规格和验收；新增根目录 `GEMINI.md` 作为 Gemini CLI 项目指引，并新增 `.geminiignore` 排除敏感和大体积本地文件但保留 `.env.example` 可读。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P2，P1 台账验证状态已修正。
- 2026-05-14：按用户要求补强 S72 地图素材准入规则。AI 生图统一限定为 Codex 使用 `gpt-image-2`；AI 生成素材和第三方优秀素材入库前都必须由 Codex 使用视觉能力审核游戏基调、历史/水墨适配、缩放可读性、现代元素/水印/误生成文字和同批一致性。已同步 `AGENTS.md`、`GEMINI.md`、`docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/MAP_ASSET_GUIDE.md`、`docs/MAP_ASSET_LEDGER.md`、`docs/DEVELOPMENT_STEPS.md` 和 brief。本轮只改文档，不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词或验证脚本；验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 2026-05-14：按用户转交的 Gemini S72.1 前端约束报告完成 PixiJS 依赖治理与 runtime 契约。新增 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`，固定 `pixi.js@7.4.3` UMD、本地 `public/vendor/pixi.min.js` 优先、固定 CDN fallback、无 build step、不进入 `package.json`；固定 `mapRuntimeView` 字段、字典式 `actionDrafts`、DOM 插入点、`app.js` 最小接线、地图高度/overlay/reduced-motion 约束和 `ink-map-v1` manifest 边界。同步更新路线图、活动台账、brief 和 `GEMINI.md`。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2。
- 2026-05-14：按用户澄清修正 Gemini CLI 协作口径。Gemini 不是全程只读；除 S72.1 前置报告这类明确只读任务外，Gemini 可以按任务修改代码、增加前端文件或维护必要前端上下文说明。限制点是不得运行 `git add`、`git commit`、`git push` 或创建 PR；Codex 审核 diff、运行验证、同步文档并提交。本轮只改文档，不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`；验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。

## Next Recommended Step

执行 S72.2：Codex 按 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md` 实现后端 `mapRuntimeView`、layout seed、route payload 和测试；S72.3 再生成并登记 `ink-map-v1` 素材，Gemini CLI 在后端契约和素材可用后进入 S72.4 前端 PixiJS 地图 shell。继续保持 JSON/Mock 默认可玩、SQLite local-only、AI proposal-only、server resolver 裁决、hidden/raw 不外泄和完整书生路径不回退。
