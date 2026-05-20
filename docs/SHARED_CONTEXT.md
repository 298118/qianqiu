# Shared AI Development Context

这是 Codex 当前使用的压缩交接板。它只保留接手下一步必须知道的状态、边界、验证入口和内容保护规则；阶段细节请追溯 `docs/DEVELOPMENT_STEPS.md` 顶部归档索引和各专题归档。

## Read First

每次开发会话开始前必须读取：

1. `AGENTS.md` 或 `CLAUDE.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

稳定治理锚点见 `docs/DEVELOPMENT_GOVERNANCE.md`。重写 brief、路线图或交接文档时不得删弱受保护规则，并运行 `npm run check:docs-governance`；完整测试中的 `test/documentationGovernance.test.js` 也会守门。

## Current Snapshot

- Product: browser + Node.js historical simulation text game **Qianqiu / 千秋**。
- Runtime target: `npm install && npm start`，默认 `AI_PROVIDER=mock`，打开 `http://localhost:3000` 即可本地游玩。
- Frontend: S74.1 起 React + TypeScript + Vite 构建产物接管默认 `/`；源码在 `client/`，生产构建在 `dist/client/`。React Router Data Mode 管理首页、主卷、舆图、人物、史册、科举、皇榜、朝议和设置等路由。旧 `public/index.html`、`public/app.js`、`public/styles.css`、`public/mapPanel.js` 只作迁移参考；`public/assets/`、`public/vendor/`、`public/mapRenderer.js` 继续提供已审核素材和 S72 地图 runtime。
- Backend: Node.js + Express，plain JavaScript。AI provider 为 adapter-based Mock/OpenAI/DeepSeek/MiMo/MiMo+DeepSeek/Anthropic；真实 provider 只作为可选配置，不能成为启动门槛。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地 `schema_migrations`、`world_sessions`、audit tables、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index`。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复，不是玩家 API、prompt 或服务器裁决的 raw truth source。
- Roadmap status: S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排、S71 数据库玩法化、S72 PixiJS 水墨地图、S73-S77 前端水墨重构、S78 官署专题玩法化、S79 前端修复与高清立绘使用、S80 服务端全局 AI 设置均已完成并归档或压缩记录。S81-S84 NPC、资产、储物、交易与委派首轮闭环已完成；S85 经济长期关系、预留玩法、总验收与归档仍待施工。规划源头见 `docs/NPC_INVENTORY_SYSTEM_ROADMAP.md`，执行契约见 `docs/NPC_INVENTORY_SYSTEM_CONTRACT.md`。
- Current collaboration: 2026-05-14 起停止 Gemini CLI 协作。后续开发、素材生成/审核、验证、文档同步和 Git 提交由 Codex 负责；用户已授权本仓库使用 Codex 子代理，实施子代理不得提交，提交前复审子代理必须只读。
- Current local `.env`: 可能含用户 provider keys。`.env` 被 Git 忽略，不能打印、复制到文档或提交。

## Core Invariants

- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 是《千秋》的核心世界引擎，不是可替换装饰。新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须定义 AI read scope、actor intelligence、tool permissions、proposal boundaries、server adjudication、audit records 和 Mock/no-key fallback。
- Provider 只能建议叙事、受限 `statePatch`、关系变化、评分 JSON、考试触发或身份受限领域工具 proposal；服务器拥有晋级、考试资格、作弊处罚、持久化、保护字段、官职任免、长期事件、时间推进、数据库写入和可见性过滤。
- AI JSON 必须先验证再应用；状态变化必须经过白名单、clamp 和 server-owned follow-up modules。
- 游戏规则、阈值、时间间隔、概率、UI caps、fixture 规模和 prompt budgets 等可调参数不得散落为 magic numbers；优先放入 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，写明单位、范围和默认意图。
- 每个 coherent change 必须更新本交接板和步骤台账，运行相关验证，并用 Git 提交。低风险纯文档改动可跳过子代理复审；涉及代码、测试、运行时、API/schema、提示词或验证工具时，提交前必须做只读子代理复审。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文；代码标识符、API/协议名、第三方术语和命令输出可保留英文。

## Content Protection

- 当前范围只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- AI 可以通过身份受限领域工具提交 proposal / request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`，工具调用也不能被当作已经发生的世界事实。
- 浏览器和 prompt 只读服务器生成的安全 view / capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。游戏/考试 route response 内的兼容 `worldState` 也必须剥离 raw `actorMemoryLedger` 与 `sessionSummary`。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密档事件链和隐藏情报真值不得回填当前 raw route `worldState`。若后续保存完整 hidden 私档，先设计 API redaction 与角色视野分层。
- 玩家可见 projection 边界包括 `informationPanelPageView`、`safeWorldSearchView`、`actorMemoryView`、`sessionSummaryView`、`mapContextView`、`mapRuntimeView`、`aiControlAuditView` 和 `server_player_visible_state_projection`；它们只暴露清洗后的公开摘要、snippet、ref、confidence、visibility、显示布局或 bounded audit summary。`mapRuntimeView` 坐标只供浏览器地图 runtime 使用，不进入 prompt context、AI 工具或服务器 resolver 的事实依据。
- 本机开发诊断 `GET /api/dev/session-diagnostics/:sessionId` 默认关闭，production 强制关闭，只在 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback 且 Origin 为空或本机 loopback Origin 通过时返回安全统计；不返回 raw state、raw audit、provider payload、prompt、本地路径、key、SQLite 原始行或 hidden ledger。
- 前端重构后的浏览器只能组合安全 route view、redacted player state、AI 设置 view、地图 runtime view、考试安全快照、已审核 `portraitRef` 和 runtime manifest。不得读取 raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes 或 hidden intent；不得显示未审核素材、硬编码本地路径或一次性加载全量立绘池。
- S73-S79 立绘资产要求成年、端庄、身份明确、高颜值但不露骨；女性角色可用服饰剪裁、腰封、衣料层次和站姿体现优雅成熟女性身形比例，但不得性化未成年人、幼态化、挑逗或过度暴露。重要 NPC 专属池使用 `signature_npc_pool`，不得被随机通用头像系统抽取。

## Implemented Surface

- Core APIs: `GET /api/health`、`POST /api/game/start`、`GET /api/game/saves`、`GET /api/game/player-state/:sessionId`、兼容 `GET /api/game/state/:sessionId`、`GET /api/game/search/:sessionId`、`GET /api/game/topic-surface/:sessionId/:surfaceId`、`GET /api/game/inventory/:sessionId`、`POST /api/game/inventory-transfer/:sessionId`、`GET /api/game/npcs/:sessionId`、`GET /api/game/npc/:sessionId/:npcId`、`POST /api/game/npc-interaction/:sessionId`、`POST /api/game/trade/:sessionId`、`POST /api/game/npc-command/:sessionId`、`POST /api/game/turn`、`POST /api/exam/question|progress|submit`。
- AI APIs: `POST /api/ai/connection-test`、`GET/POST /api/ai/settings/global`、兼容 `GET/POST /api/ai/settings/:sessionId`、`POST /api/ai/quick-actions/:sessionId`、`POST /api/ai/topic-draft/:sessionId`。AI 设置矩阵当前覆盖 18 类任务，新增 `background_claim_parser`、`npc_dialogue`、`npc_private_planner`、`trade_negotiator`、`delegated_task_planner`、`delegated_task_reporter`、`inventory_effect_explainer`。
- Main code areas: AI adapters/prompts/schemas/tools in `src/ai/`; server-owned game rules, exams, official career, resolver input, redacted state, memory, settings, audit and topic surfaces in `src/game/`; storage adapters and migrations in `src/storage/`; React app in `client/`; reviewed visual assets and runtime manifests in `public/assets/`.
- Recent validation baseline: S81-S84 已通过 focused Node tests（资产/背包/NPC/委派、交易结算边界、NPC/交易/委派 AI 文本安全、SQLite 派生表与 adapter、NPC/背包 routes、AI settings/schema/prompt/provider、player-state redaction、SQLite maintenance、session adapter contract）、`npm run typecheck:client`、`npm run test:client -- --pool=vmForks --maxWorkers=2`、`npm run build:client`、`AI_PROVIDER=mock npm run smoke:browser`、完整 `npm test`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；提交前需完成只读子代理复审。

## Archives And Contracts

优先追溯入口：

- `docs/DEVELOPMENT_GOVERNANCE.md`
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
- `docs/DEVELOPMENT_STEPS.md`
- `docs/NPC_INVENTORY_SYSTEM_ROADMAP.md`
- `docs/NPC_INVENTORY_SYSTEM_CONTRACT.md`
- `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_CONTROL_AUDIT_MATRIX.md`
- `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`
- `docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md`
- `docs/IMPERIAL_EXAM_DEEPENING_ARCHIVE.md`
- `docs/AI_ORCHESTRATION_ARCHIVE.md`
- `docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md`
- `docs/PIXIJS_INK_MAP_ARCHIVE.md`
- `docs/FRONTEND_INK_REDESIGN_ARCHIVE.md`
- `docs/FRONTEND_VISUAL_ASSET_GUIDE.md`
- `docs/FRONTEND_ASSET_LEDGER.md`
- `docs/MAP_ASSET_LEDGER.md`

## Current Work Note

- 2026-05-20：推进完成 S81-S84 NPC、资产、储物、交易与委派首轮闭环，实现提交 `4c007f00`。新增 S81-S84 执行契约、资产/资源/背包/NPC/交互/交易/委派/开局背景裁决领域模块，`POST /api/game/start` 接入 `background_claim_parser` 并由服务器兑现或折算宣称；新增 inventory、NPC list/detail、NPC interaction、trade、npc-command 安全 API；SQLite 新增安全派生表并接入 adapter/maintenance；React 新增“囊箧” route、人物 NPC 工作台、对话/交易/委派 tabs 与主卷开局裁决摘要。交易 API 现在把 AI `accepted` 视为议价文本，不直接写银钱/物品；NPC/交易/委派 AI 文本在即时响应前也会被服务端清洗和拒绝；委派创建响应只返回安全 task view，SQLite legacy 交易派生行也补了 actor fallback。Bacon、Linnaeus、Pasteur、Turing 分别完成小步 patches，均未提交；主代理整合验证和文档同步。第一次只读复审 Epicurus 发现的交易结算和 AI 文本泄漏 P1 已修复并补测，第二次复审 Hegel 未发现 P0/P1，指出的非阻断项已收口；最终只读复审 Russell 未发现 P0/P1，记录 S85 可继续收紧全局错误脱敏和畸形 legacy trade actor fallback。
- 2026-05-20：按用户追问补充 S81-S85 全量小步骤台账，已把 S81.1-S81.5、S82.1-S82.5、S83.1-S83.5、S84.1-S84.8、S85.1-S85.6 全部写入 `docs/DEVELOPMENT_STEPS.md`。用户明确本轮不用子代理审核；本轮为低风险文档台账补充，跳过子代理复审，已通过 docs governance、documentation governance 和 diff check。
- 2026-05-20：按用户要求新增 S81-S85 NPC、资产与储物系统规划，详见 `docs/NPC_INVENTORY_SYSTEM_ROADMAP.md`；活动台账已加入 S81-S85 TODO，开发治理新增“前后端分离和大步骤拆分”受保护规则，并同步 `scripts/checkGovernanceDocs.js`、brief 与 `AGENTS.md`。本轮为规划/治理改动，需通过 docs governance、documentation governance、diff check，并因修改检查脚本执行只读复审。
- 2026-05-20：按用户要求压缩 `docs/SHARED_CONTEXT.md` 和 `docs/DEVELOPMENT_STEPS.md`，只保留接手下一步必要的状态、边界、验证入口和归档索引；新增“不要最小实现点/最小改动点，追求完整丰富实现”的开发规范，并写入 `docs/DEVELOPMENT_GOVERNANCE.md`、本文件、活动台账、brief 与 `AGENTS.md`。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（940 项）和 `git diff --check`；提交前只读复审 Anscombe 未发现 P0/P1/P2。

## Next Recommended Step

进入 S85：先补长期 tick 与基础市场价格，让 NPC 资产、库存、债务、人情债、交易承诺和委派任务随旬/月演化；再补 NPC 私人目标与主动请求、论道/切磋/求爱/婚姻正式扩展位，最后做 S81-S85 JSON/SQLite/Mock/browser/docs 总验收与归档。继续保持前端只消费安全 API/view，所有资源、价格、关系和任务结果由服务器裁决。
