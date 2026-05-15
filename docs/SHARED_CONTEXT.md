# Shared AI Development Context

这是 Codex 当前使用的精简交接板。详细历史请看 `docs/DEVELOPMENT_STEPS.md`、各阶段归档和专题契约文档；本文件只保留接手下一步所必需的状态、规则和内容保护边界。

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
- Frontend: 当前发布入口仍是 plain HTML/CSS/JS，无 build step；S74.0 已规划可在依赖治理通过后引入 React + TypeScript + Vite + React Router Data Mode 并行多页前端岛，S77 验收后才切默认入口。Backend: Node.js + Express，plain JavaScript。
- AI providers: adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic。`AI_PROVIDER=mock` 仍是默认可玩模式，即使本机存在真实 provider key 也不会自动改走真实模型；`mimo-deepseek` 下 narrator/科举出题仍优先 MiMo，domain_specialist/科举评卷和 critic/safety 在 DeepSeek key 可用时走 DeepSeek。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地 `schema_migrations`、`world_sessions`、audit tables、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index`。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复；raw business/audit rows 不是 route、prompt、browser、搜索或服务器裁决 truth source。
- S67 scale acceptance: `rawFixtureGenerationMs` 只表示 large fixture 原始数据生成，`fixtureBuildMs` 是外层构建总耗时报告字段；完整 `npm test` 并发下的资源波动不再用旧 `fixtureGenerationMs` 名义硬失败。数量、防泄漏、分页 cap、prompt budget、SQLite read-repair parity、行为级耗时和 heap guard 仍是硬门。
- Roadmap status: S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排、S71 数据库玩法化和 S72 PixiJS 水墨地图均已完成并归档。当前活动路线进入 S73-S77 前端水墨重构，任务书见 `docs/FRONTEND_INK_REDESIGN_ROADMAP.md`；S73.0a 已把规划细化为素材矩阵、React/Vite 迁移路线、身份/场景专题和小步骤验收，S73.0b 已按用户要求改为 React Router 多页 SPA 并把地图重构为独立“舆图”页，S73.0c 已补齐 S73.10 并改为 S73 内完成 300-400 张全量玩家/NPC 立绘池，S73.1 已新增 `docs/FRONTEND_VISUAL_ASSET_GUIDE.md` 固定前端视觉资产标准，S73.2 已新增 `public/assets/ui/ink-ui-manifest.json` 和 `docs/FRONTEND_ASSET_LEDGER.md` 固定前端素材 manifest/台账 schema，S73.3 已生成并审核 16 个 UI 材质素材，S73.4 已生成并审核 6 个首页资产，S73.5 已生成并审核 10 个场景插画，均已写入缩略图、manifest 和台账记录。S72 归档见 `docs/PIXIJS_INK_MAP_ARCHIVE.md`。
- Current collaboration: 2026-05-14 起停止与 Gemini CLI 协作，后续开发全部由 Codex 承担。Codex 负责后端、前端、AI/server 权限、素材生成与台账、视觉审核、最终文档同步、验证和 Git 提交；S73-S77 的 AI 生图统一由 Codex 使用 `gpt-image-2` 完成，AI 生成素材和第三方入库候选素材都必须由 Codex 做视觉审核，确认游戏基调、历史/水墨适配、可读性和同批一致性。
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
- 玩家可见 projection 边界：`informationPanelPageView`、`safeWorldSearchView`、`actorMemoryView`、`sessionSummaryView`、`mapContextView`、`mapRuntimeView`、`aiControlAuditView` 和 `server_player_visible_state_projection` 都只暴露清洗后的公开摘要、snippet、ref、confidence、visibility、显示布局或 bounded audit summary；不返回内部行、审计原文、provider 输出、完整 prompt、本地路径、key、hidden notes 或 hidden intent。`mapRuntimeView` 的显示坐标只供浏览器地图 runtime 使用，不进入 prompt context、AI 工具或服务器 resolver 的事实依据。
- 本机开发诊断 `GET /api/dev/session-diagnostics/:sessionId` 默认关闭，production 强制关闭，只在 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback 且 Origin 为空或本机 loopback Origin 通过时返回安全统计；不返回 raw state、raw audit、provider payload、prompt、本地路径、key、SQLite 原始行或 hidden ledger。
- S70/S71 领域工具与 resolver 边界：`cityPolicyResolver`、`judicialCaseResolver`、`militaryDiplomacyResolver`、`worldPressureEventGenerator`、`sceneRuntime`、NPC 记忆和 AI 调动审计均由服务器拥有裁决与 apply；`server.*` 只能是内部 resolver/audit label，不能进入模型可见工具列表或 provider schema。
- S68-S69 科举深化继续保持 proposal-only：老师、保人、同年、考官、吏部和皇帝只能提交题目、点评、事件、批语、复核疑点或授官 proposal；服务器仍拥有资格、舞弊、榜单、名次、授官、任免和持久化裁决。外层 API 保持 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`，浏览器/prompt 只读 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`examNetwork`、`appointmentTrackView` 和考试历史安全快照。
- S73-S77 前端重构只能组合安全 route view、redacted player state、AI 设置 view、地图 runtime view 和考试安全快照；新增身份/场景/NPC/设置界面不得读取 raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes 或 hidden intent。S73.10 必须在 S73 内完成 300-400 张全量玩家/NPC 立绘池的生成、缩略图、压缩、视觉/安全审核、manifest 入库和台账登记；S74-S77 的人物显示只能通过已审核 `portraitRef`、缩略图和 fallback 使用，不得硬编码路径、不得显示未审核素材、不得一次性加载全量池。玩家与 NPC 立绘要求成年、端庄、身份明确、高颜值但不露骨；女性角色可用服饰剪裁、腰封、衣料层次和站姿体现优雅成熟女性身形比例，但不得性化未成年人、不得幼态化、不得挑逗或过度暴露。

## Subagent Discipline

- 用户已授权 Codex 在本仓库使用子代理，除非后续指令撤销，否则视为长期项目上下文。Gemini CLI 协作已停止，后续实施、复审、验证和提交均由 Codex 及 Codex 子代理完成。
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
- 地图接口与运行时投影：`src/game/mapContext.js`、`src/game/mapRuntimeConfig.js`、`src/game/mapVisualLayoutSeed.js`、`src/game/mapRuntimeView.js`、`src/game/mapToolResolvers.js`。
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
- `docs/PIXIJS_INK_MAP_ARCHIVE.md`
- `docs/PIXIJS_INK_MAP_ROADMAP.md`
- `docs/FRONTEND_INK_REDESIGN_ROADMAP.md`
- `docs/FRONTEND_VISUAL_ASSET_GUIDE.md`
- `docs/FRONTEND_ASSET_LEDGER.md`
- `docs/MAP_ASSET_GUIDE.md`
- `docs/MAP_ASSET_LEDGER.md`

## Current Work Note

- 2026-05-14：按用户要求归档活动台账中的已完成路线并压缩共享上下文。`docs/DEVELOPMENT_STEPS.md` 已改为只保留治理保护块、归档索引、当前边界、空活动总览和本轮记录；DONE 的 S68-S71 长表与长进度记录不再留在活动台账。`docs/SHARED_CONTEXT.md` 已压缩为必读状态、核心边界、内容保护、实现入口和归档入口。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2，确认治理规则、归档入口和 hidden/raw 内容保护边界未被删弱。
- 2026-05-14：按用户新要求启动 S72 PixiJS 水墨地图专项规划，并把当前活动协作从 Claude Code 交接切换为 Codex + Gemini CLI。Codex 负责后端、素材、审核与 Git 提交；Gemini CLI 负责前端 PixiJS patch 且不做 Git 提交。新增 `docs/PIXIJS_INK_MAP_ROADMAP.md` 和 `docs/MAP_ASSET_LEDGER.md`，`docs/DEVELOPMENT_STEPS.md` 已写明 S72.0-S72.8 owner 与验收边界。本轮仍不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限；S72.1 前不得直接接入 PixiJS 依赖。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2。完整 `npm test` 已运行但未全过，唯一失败为既有 S67 大规模 fixture 性能阈值：`fixtureGenerationMs 11122.608 > 10000`，其余 830 项通过；本轮未改 S67 fixture 或运行时代码。
- 2026-05-14：按用户要求细化 S72 给 Codex/Gemini 直接开发使用。`docs/PIXIJS_INK_MAP_ROADMAP.md` 已扩展为后端 `mapRuntimeView` 草案、前端 PixiJS 文件/图层/接口/动效/性能规格、素材清单、Gemini 交付格式和首个只读任务；新增 `docs/MAP_ASSET_GUIDE.md`，细化 AI 生图、历史参考查找、manifest、许可记录、文件规格和验收；新增根目录 `GEMINI.md` 作为 Gemini CLI 项目指引，并新增 `.geminiignore` 排除敏感和大体积本地文件但保留 `.env.example` 可读。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P2，P1 台账验证状态已修正。
- 2026-05-14：按用户要求补强 S72 地图素材准入规则。AI 生图统一限定为 Codex 使用 `gpt-image-2`；AI 生成素材和第三方优秀素材入库前都必须由 Codex 使用视觉能力审核游戏基调、历史/水墨适配、缩放可读性、现代元素/水印/误生成文字和同批一致性。已同步 `AGENTS.md`、`GEMINI.md`、`docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/MAP_ASSET_GUIDE.md`、`docs/MAP_ASSET_LEDGER.md`、`docs/DEVELOPMENT_STEPS.md` 和 brief。本轮只改文档，不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词或验证脚本；验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 2026-05-14：按用户转交的 Gemini S72.1 前端约束报告完成 PixiJS 依赖治理与 runtime 契约。新增 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`，固定 `pixi.js@7.4.3` UMD、本地 `public/vendor/pixi.min.js` 优先、固定 CDN fallback、无 build step、不进入 `package.json`；固定 `mapRuntimeView` 字段、字典式 `actionDrafts`、DOM 插入点、`app.js` 最小接线、地图高度/overlay/reduced-motion 约束和 `ink-map-v1` manifest 边界。同步更新路线图、活动台账、brief 和 `GEMINI.md`。本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1/P2。
- 2026-05-14：按用户澄清修正 Gemini CLI 协作口径。Gemini 不是全程只读；除 S72.1 前置报告这类明确只读任务外，Gemini 可以按任务修改代码、增加前端文件或维护必要前端上下文说明。限制点是不得运行 `git add`、`git commit`、`git push` 或创建 PR；Codex 审核 diff、运行验证、同步文档并提交。本轮只改文档，不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`；验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 2026-05-14：执行并完成 S72.2 后端地图 runtime view。新增 `src/game/mapRuntimeConfig.js`、`src/game/mapVisualLayoutSeed.js`、`src/game/mapRuntimeView.js`，从安全 `mapContextView` 派生 `mapRuntimeView`，包含显示 layout、layer/style token、route path、event effect 和服务器预渲染 action draft；显示坐标只服务浏览器 UI，不进入 prompt、AI 工具或服务器裁决。`POST /api/game/start`、`GET /api/game/state/:sessionId`、`GET /api/game/player-state/:sessionId`、`POST /api/game/turn`、SSE `state_preview`/`final_state`、`POST /api/exam/question|progress|submit` 均返回该安全投影；dual-mode S70 AI-first parity 也比较 `mapRuntimeView`。本轮不改 PixiJS 前端、素材 manifest、provider schema、SQLite schema 或 `package.json`。验证已通过新增/相关 Node 测试、dual-mode script、docs governance 和 diff check；提交前已进行只读子代理复审。
- 2026-05-14：执行并完成 S72.3 首批水墨地图素材。按用户要求先让 medium 子代理做创意发散/prompt 草案，Codex 负责 prompt 定稿、生成、视觉审核和入库。新增 `public/assets/maps/ink-map-manifest.json`、水墨底图、宣纸纹理、路线笔触、红/青事件涟漪和 9 个透明地图图标；所有素材均由 Codex 视觉审核，确认无文字、水印、现代 UI、本地路径、key、hidden/raw 内容，并登记到 `docs/MAP_ASSET_LEDGER.md`。新增 `test/mapAssetsManifest.test.js` 校验 manifest 本地路径、尺寸、alpha 和敏感字段；本轮不改 PixiJS 前端、provider schema、SQLite schema、存档格式或 `package.json`。
- 2026-05-14：审核并收口 Gemini S72.4 前端地图 patch。新增本地 `public/vendor/pixi.min.js` 与 MIT license 说明、`public/mapRenderer.js` 和 `public/mapPanel.js`，`index.html` 按契约加载 PixiJS vendor、固定 CDN fallback、地图 renderer/panel 和 `app.js`；`app.js` 只保存并传递 `payload.mapRuntimeView`，地图点击只把服务器预渲染 `actionDraft.actionText` 回填到行动输入框。`mapRenderer` 读取 `public/assets/maps/ink-map-manifest.json` 并加载 S72.3 底图、图标和涟漪素材，缺 PixiJS 或素材失败时降级显示，不阻断文字主流程。新增 `test/mapFrontendShell.test.js` 防回归；浏览器临时端口验证 canvas 非空、tooltip/action draft 可用、控制台无错误。
- 2026-05-14：审查并收口 Gemini S72.5 前端联动 patch。`public/mapRenderer.js` 现在在地点、路线和事件涟漪点击时统一绘制选中圈，事件点击只携带安全 `mapRuntimeView` ref/sourceRefs 给 tooltip，且事件贴图 hitArea 不再用透明外框抢占周边 marker；素材异步加载完成后改走 panel 更新回调，避免 DOM 标签重复。`public/mapPanel.js` 只从安全 ref/sourceRefs 匹配已渲染的 `data-entity-id` / `data-event-id` 局势簿卡片，点击“查阅局势簿”会在局势簿现有 DOM 内切换 tab 可见性、重新定位已连接卡片并短暂高亮。行动草稿仍只把服务器 `actionDraft.actionText` 写入 `#action-input`，不自动提交、不调用后端 resolver、不直写状态；新增 `test/mapFrontendShell.test.js` 回归断言防止 unsafe selector、前端自行 turn fetch 和选中态漏接。验证已通过地图/manifest/runtime/route 聚焦测试、docs governance、`git diff --check`、浏览器临时端口手测和 `node --test test/dualModeAcceptanceScript.test.js`；完整 `npm test` 仅遇到既有 S67 large fixture 性能阈值波动 `fixtureGenerationMs 10658.028 > 10000`，单跑失败文件已通过。
- 2026-05-14：审查并收口 Gemini S72.6 前端 polish patch。`public/mapRenderer.js` 新增路线墨线 alpha 呼吸、事件涟漪 scale/alpha 扩散、深朱砂双圈选中态、`prefers-reduced-motion` 降级，以及 `IntersectionObserver`/`visibilitychange` 可见性守卫；Codex 修正了 Gemini patch 中会导致脚本语法失败的末尾残片，并修正路线动效被通用 tick 写入 `baseScale` 导致 `NaN` 的风险。`public/styles.css` 将 tooltip、行动草稿按钮和 fallback 面板调整为纸色渐变、硬边与浅朱砂分隔线。新增 `test/mapFrontendShell.test.js` S72.6 回归断言，并保留 `S72.6_DELIVERY_REPORT.md` 作为 Gemini 交付说明。本轮不改后端、API/schema、SQLite、provider schema、prompt 或素材 manifest；验证已通过前端/manifest/runtime 聚焦测试、docs governance、`git diff --check`、本地 Mock 浏览器桌面/窄屏检查和单跑 `test/dualModeAcceptanceScript.test.js`。完整 `npm test` 仅遇到既有 S67 large fixture 性能阈值波动 `fixtureGenerationMs 10274.08 > 10000`，单跑失败文件已通过；只读子代理复审未发现 P0/P1/P2。
- 2026-05-14：执行并完成 S72.7 PixiJS 地图验收、安全与性能回归。`scripts/browserSmoke.js` 现在真实检查地图面板、canvas 像素非空、label、动画数量、hidden/raw 文本、资源失败静态降级、`prefers-reduced-motion` 禁用动效、恢复读档/新页面恢复和桌面/窄屏布局。S72.7 browser smoke 捕获并修复了地图/书生面板挤压叙事区的问题：地图高度收束为 `clamp(200px, 24vh, 280px)`，桌面游戏态书生信息面板改为较短的可滚动摘要区，`narrative` 不再用固定 100% 高度。`public/mapRenderer.js` 新增只读 debug state、资源失败可观测状态、纸色 fallback base 和 `preserveDrawingBuffer` 以支持 canvas 非空验收；`public/mapPanel.js` 对未知 schemaVersion 降级等待并销毁旧 renderer/canvas，避免旧地图残留。本轮不改后端 API/schema、SQLite、provider schema、prompt 或素材 manifest；地图仍只读安全 `mapRuntimeView`，行动草稿仍需玩家提交普通回合。已通过聚焦 node tests、`npm run smoke:browser -- --screenshots artifacts/s72-browser-smoke`、docs governance、dual-mode storage-only、`git diff --check`；完整 `npm test` 仅遇到既有 S67 large fixture 性能阈值波动 `informationPanelMs 3258.724 > 3000`，随后单跑 `node --test test/dualModeAcceptanceScript.test.js` 已通过。提交前只读子代理复审最初发现 P2 旧 canvas 残留问题，已修复；无剩余 P0/P1/P2。
- 2026-05-14：按用户要求停止与 Gemini CLI 共同开发，后续开发全部改为 Codex-only。已同步 `AGENTS.md`、`CLAUDE.md`、治理锚点、brief、路线图、S72 契约/素材文档和本交接板；删除 Gemini 专用上下文入口 `GEMINI.md` 与 `.geminiignore`。历史记录中已经发生的 Gemini patch 作为事实保留，但不再作为未来协作模式。本轮只改文档、治理检查脚本和 Gemini 专用上下文文件，不改运行时代码、API、provider schema、SQLite schema、素材 manifest 或提示词；纯文档/治理改动，已进行只读子代理复审。
- 2026-05-14：按用户要求完成 S72 PixiJS 水墨地图专项归档。新增 `docs/PIXIJS_INK_MAP_ARCHIVE.md`，并把 `docs/DEVELOPMENT_STEPS.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `README.md` 的 S72 口径统一改为“已完成归档”；`docs/SHARED_CONTEXT.md` 也已更新为归档后的下一步建议。本轮仍不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限；验证完成后将按 Git 提交收口。
- 2026-05-14：按用户要求启动 S73-S77 前端水墨重构规划。已让 medium 子代理做创意发散/prompt 草案，Codex 收口为 `docs/FRONTEND_INK_REDESIGN_ROADMAP.md`，将用户提出的水墨、手绘、泛黄宣纸/奏折、首页画卷、右上角设置、存档/读档/返回首页、底部奏折输入、科举/放榜全屏、身份/场景专属面板、NPC/玩家立绘长期管线拆成 S73 素材、S74 信息架构拆分、S75 首页 shell、S76 身份/场景专题界面、S77 验收归档。S73-S77 继续纯 HTML/CSS/JS、Mock 默认可玩、S72 地图只读安全 view、存档/AI 设置安全 API 和完整书生路径不回退；立绘边界收束为成人、端庄、身份明确、俊美但不露骨。本轮只改规划/交接文档，不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词、验证脚本或素材文件。验证已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；只读子代理复审未发现 P0/P1，P2 brief 后段活动方向遗漏已修正，P3 复审状态已闭环。
- 2026-05-14：按用户反馈补强 S73-S77 规划。`docs/FRONTEND_INK_REDESIGN_ROADMAP.md` 已重写为详细开发蓝图：S73 拆成视觉资产指南、manifest/台账、UI 材质、首页资产、场景插画、身份背景、玩家/NPC 立绘基准、动效/fallback 和素材预览/QA；S74 调整为 React + TypeScript + Vite 渐进式接管，先通过依赖治理和 `/ink-client/` 并行前端岛，不在 S77 前切默认入口；S75-S77 拆出首页、印匣、存档/读档、返回首页、底部奏折、身份专属面板、考试/放榜、舆图、立绘接线、安全/性能/可访问性验收。此条中的立绘范围已由 S73.0c 更新为 S73.10 在 S73 内完成 300-400 张全量立绘池。女性立绘边界更新为成年、端庄、高颜值、身份感强，可通过服饰剪裁和姿态体现优雅成熟女性身形比例，但不得露骨、挑逗、幼态或过度暴露。本轮仍只改规划/交接文档，不安装依赖、不生成素材、不改运行时代码或 API。
- 2026-05-14：按用户进一步确认，当前旧前端是单页游戏壳，继续堆地图、科举、NPC、史册、设置和多身份面板会拥挤；S73.0b 已将新前端方向改为 React Router 多页 SPA。S74.0 候选依赖新增 `react-router`，采用 Data Mode（`createBrowserRouter` / `RouterProvider`，`basename: "/ink-client"`），不用 Framework Mode 接管 Express；推荐路由包括首页、主叙事、独立舆图、人物、史册/局势簿、科举考试、放榜、皇帝/朝议或官署公文、设置/存档。地图重构为独立“舆图”页，主叙事页只保留入口或摘要；`mapRuntimeView` 仍只供浏览器渲染，不进入 prompt、AI 工具或服务器裁决。本轮仍只改规划/交接文档。
- 2026-05-14：执行 S73.1 前端视觉资产指南。新增 `docs/FRONTEND_VISUAL_ASSET_GUIDE.md`，固定 S73-S77 资产的阅读优先原则、目录命名、页面 usage、颜色材质、文件规格、移动裁切、UI 材质、首页/场景/身份背景、成人端庄立绘边界、动效与 reduced-motion、fallback、审核清单、manifest/台账安全字段和第三方来源记录要求。S73-S77 正式 AI 生图继续限定为 Codex 使用 `gpt-image-2`，AI 生成或第三方候选素材入库前必须完成 Codex 视觉审核；未审核或未通过素材不得进入 manifest 可用集合。本轮只改文档，不安装依赖、不生成素材、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或验证脚本；子代理已做只读要点分析，提交前只读复审未发现 P0/P1/P2，P3 历史记录中 S73.1/S73.2 边界旧表述已修正。
- 2026-05-14：按用户指出“台账缺 S73.10，立绘可以在 S73 全部完成且后续步骤都要使用”，执行 S73.0c 文档修正。`docs/DEVELOPMENT_STEPS.md` 已补齐 S73.10，`docs/FRONTEND_INK_REDESIGN_ROADMAP.md` 与 `docs/FRONTEND_VISUAL_ASSET_GUIDE.md` 已把 S73.10 从长期分期改为 S73 内全量立绘生产与入库：300-400 张玩家/NPC 立绘需完成生成、缩略图、压缩、视觉/安全审核、manifest 入库和台账登记；S73.7 只做风格基准，S74-S77 必须通过已审核 `portraitRef` 使用 S73.10 立绘池，仍按需懒加载且不得显示未审核素材。本轮仍只改规划/交接文档，不生成实际立绘、不安装依赖、不改运行时代码或 API。
- 2026-05-14：执行 S73.2 前端素材 manifest schema 与素材台账。新增 `public/assets/ui/ink-ui-manifest.json` 草案和 `docs/FRONTEND_ASSET_LEDGER.md`，固定素材字段、审核状态、fallback、usage/role catalog、路径策略、性能字段、缩略图/占位图、安全裁切和 S73.10 全量立绘池的 `portraitRef`、状态/情绪变体、缩略图、低清占位、fallback 与懒加载字段；新增 `test/frontendInkAssetsManifest.test.js` 防止 manifest 进入远程/本地绝对路径、密钥或敏感运行数据，并校验台账关键字段。本轮不生成实际图片、不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式或提示词；验证已通过聚焦素材/地图 manifest 测试、docs governance、documentation governance 和 `git diff --check`。完整 `npm test` 已运行但未全过，失败为既有 S67 large fixture 性能阈值波动 `fixtureGenerationMs 10975.641 > 10000`；本轮未改 S67 fixture、dual-mode 阈值或运行时生成逻辑。提交前只读复审未发现 P0/P1/P2；复审建议的“立绘需继承基础素材字段”已补入 manifest、台账和测试。
- 2026-05-14：执行 S67 规模验收性能波动维护。`scripts/dualModeAcceptance.js` 不再输出旧 `fixtureGenerationMs`；`src/game/worldContentFixtures.js` 的 fixture summary 改为 `rawFixtureGenerationMs`，S67 scale 报告另给 `fixtureBuildMs`。`runScaleRegressionAcceptance()` 复用 fixture 自带 performance baseline，保留 large fixture 数量、防泄漏、分页 cap、prompt budget、SQLite read-repair parity、行为级耗时和 heap guard；`fixtureBuildMs` 作为报告字段，`informationPanelMs` 阈值放宽到 5000ms 以吸收 full-suite 并发资源竞争。本轮不改 API、存档 schema、provider schema、SQLite schema、prompt 或游戏状态规则；验证完成后按 Git 提交收口。
- 2026-05-14：执行 S73.3 UI 材质包。按用户要求由 medium 子代理做创意发散 prompt 草案，Codex 定稿并用 `gpt-image-2` 生成 16 个首批 UI 材质：宣纸、旧绢、奏折纸面、竹简输入条、卷轴面板、残纸卡片、水渍叠加层、淡墨分隔线、角饰笔触、朱印按钮默认/按下态、印匣纹理、试卷界栏、皇榜纸底、朱砂墨迹和纸页边缘阴影。素材已保存到 `public/assets/ui/materials/`，缩略图保存到 `public/assets/ui/thumbs/`；透明素材经 chroma-key 去底、despill 与 WebP alpha 压缩，水渍初版偏绿后已重生成并校色。`ink-ui-manifest.json` 进入 `assets_active`，台账逐项记录来源、prompt 摘要、后处理、许可说明、视觉审核和安全审核；测试已扩展到图片存在性、尺寸、alpha、性能预算、`thumbnailBytes` 和安全字段。验证已通过素材/地图 manifest 测试、docs governance、documentation governance、`npm test` 和 `git diff --check`；提交前只读复审发现的缩略图 bytes P2 已修正，无剩余 P0/P1/P2。本轮不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。
- 2026-05-14：执行 S73.4 首页资产包。按用户要求由 medium 子代理做创意发散 prompt 草案，Codex 定稿并用 `gpt-image-2` 生成 6 个首页素材：首页水墨山水画卷、云雾透明层、题名册/户籍册表单底、无字朱印开始按钮、首页案卷存档素材和 reduced-motion 静态底。素材已保存到 `public/assets/ui/home/`，缩略图保存到 `public/assets/ui/thumbs/`；透明素材经 chroma-key 去底、despill、alpha 软化与 WebP alpha 压缩，云雾层已调为暖灰低对比，朱印首版空心感过强后已重生成厚实无字版本。提交前只读复审发现 P2 透明素材仍有 chroma-key 色边/切口风险，Codex 已重处理册页、朱印和案卷透明边缘，并把云雾层改为基于 AI 雾层的柔化 alpha mask、低频雾团和边界渐隐；已刷新缩略图和 manifest bytes，并新增 `public/assets/ui/home/home-transparency-qa-v1.json` 记录透明素材 SHA-256、纸色/深色合成复审背景和色边/边界指标。S73.9 QA 范围已补入纸色/深色合成与高饱和绿/紫色边检查。`ink-ui-manifest.json` 继续保持 `assets_active`，台账逐项记录来源、prompt 摘要、后处理、许可说明、视觉审核和安全审核；测试已扩展到 S73.4 图片存在性、尺寸、alpha、性能预算、`thumbnailBytes`、透明 QA sidecar 和安全字段。验证已通过 `node --test test/frontendInkAssetsManifest.test.js`、`node --test test/mapAssetsManifest.test.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF 提示）和 `npm test`（849 项通过、0 失败；此前一次完整运行遇到 `test/historicalEventArchive.test.js` 的 Node test runner `spawn EPERM` 瞬时错误，单跑该文件通过，随后完整重跑已通过）。最终只读复审确认无剩余 P0/P1/P2。本轮不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。
- 2026-05-14：执行 S73.5 场景插画包。按用户要求由 medium 子代理做创意发散 prompt 草案，Codex 定稿并用 `gpt-image-2` 生成 10 个场景插画：书斋、贡院号舍、放榜、殿试、县衙、公堂、军帐、御案、城市街巷和部院公文。素材已保存到 `public/assets/ui/scenes/`，缩略图保存到 `public/assets/ui/thumbs/`；放榜、军帐和部院公文早稿因伪文字/军器灰区/印章标记风险未入库，已重生成更干净版本。`ink-ui-manifest.json` 继续保持 `assets_active`，台账逐项记录来源、prompt 摘要、后处理、许可说明、视觉审核、安全审核、safeArea 和移动裁切；`test/frontendInkAssetsManifest.test.js` 已扩展到 S73.5 场景数量、阶段、分类、尺寸、缩略图 bytes、场景 token 和安全字段。本轮不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或 AI 权限；验证完成后按 Git 提交收口。

## Next Recommended Step

执行 S73.6：身份背景包。继续沿用“medium 子代理创意发散 prompt 草案，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、压缩、缩略图、manifest/台账入库和提交”的分工，为书生、地方官、入仕官员、大臣、将领、皇帝准备专属背景、色彩权重和面板材料建议。S74.0 前不得直接安装 React Router 或其他新依赖；继续保持 JSON/Mock 默认可玩、SQLite local-only、AI proposal-only、server resolver 裁决、地图前端只读安全 view 和完整书生路径不回退。
