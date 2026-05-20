# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的压缩活动路线图与进度台账。它只保留接手下一步所必需的治理规则、当前状态、最新验证口径和近期完成节点；已完成流水不在这里展开。

需要追溯完整完成流水时阅读 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。需要追溯专题实现时优先阅读对应归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。
- S68-S69 科举、读书、评卷、榜单、同年座师、授官和 Provider/Mock 验收：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。
- S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力事件、多 actor 场景、NPC 记忆账本、AI 调动审计和验收：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。
- S72 PixiJS 水墨地图：[PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。
- S73-S77 前端水墨重构、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、立绘管线、安全/性能/可访问性和总验证：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。

2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

## 1. 开发规范继承

<!-- GOVERNANCE_REQUIRED_START -->

开发规范不变。继续保持：

- 稳定开发治理锚点见 [docs/DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md)；重写路线图或交接文档时不得删弱其中的必守规则，并运行 `npm run check:docs-governance`。
- `npm install && npm start` 可运行，默认打开 `http://localhost:3000`。
- Mock AI 默认完整可玩，真实 provider 只作为可选配置。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档应按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- AI 是《千秋》的核心世界引擎，不是可替换装饰；新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI 的读取范围、角色智能、工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级。
- AI 可以生成叙事、题目、评分建议、关系建议、受限 `statePatch`，或通过身份受限的领域工具提交 structured proposal / tool call；AI 不得执行 SQL，不得直接写 canonical 状态、业务表或审计表。服务器继续拥有时间推进、状态边界、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为魔法数字；新增或调整时优先集中到具名配置模块，例如 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。
- 每个 coherent change 必须更新 `docs/SHARED_CONTEXT.md`，必要时同步 README、产品 brief、架构/契约文档，并用 Git 提交。
- 关键决策不能只留在聊天记录里；会影响后续 Codex 接手的内容必须写入仓库文档。

### 子代理使用规则

- 用户已明确授权 Codex 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
- 对路线图阶段或步骤簇，应在可拆分为独立小步骤时主动使用子代理；不要把“较大步骤”理解为只能交给一个超大实现任务，优先按 `Sxx.y` 这类可审查粒度拆分。
- 子代理实施任务必须有清晰职责边界和文件/模块归属；多个实施子代理并行时，写入范围应尽量互不重叠。
- 每个实施子代理提示词必须明确：不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得回滚他人改动；最终报告列出改动文件和验证命令。
- 子代理只产出受限 patch 与聚焦验证报告；主代理负责整合、最终验证、共享文档同步和唯一的连贯提交。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须委派至少一个只读子代理审查最终 diff 与验证证据。主代理需向复审子代理提供 diff 与验证摘要；复审子代理只报告风险、遗漏、测试缺口和建议，不得编辑文件，也不得运行 Git 命令。
- 低风险纯文档改动可跳过子代理复审，但必须在 `docs/SHARED_CONTEXT.md` 或最终回复说明。
- 如果子代理意外创建提交，主代理必须把它视为未复审工作：检查 diff 和测试，在交接记录中说明事故，并避免继续让该子代理提交。

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，选择第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具和提交说明或哈希。
2. 在“进度记录”追加一条记录，写清完成内容、验证命令、风险/遗留和下一步。
3. 更新 `docs/SHARED_CONTEXT.md`。
4. 如果改动影响产品范围、架构、API、状态字段、提示词、设置或验收标准，同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关契约文档。
5. 确认新增文档、交接记录、路线图条目、领域逻辑注释和玩家可见文案优先使用中文；确需保留英文时应是代码/API/协议/第三方术语、命令输出或外部工具清晰度所需。
6. 运行相关验证命令。
7. 对非低风险纯文档改动执行只读子代理提交前审查。
8. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交或随当前文档提交完成。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖、插件与开源参考策略

当前专项继续继承 S46.1 的依赖、插件与开源参考治理。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex 工作流或开源参考时，必须先按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、改善浏览器体验或提供成熟标准能力。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端以 React + TypeScript + Vite 的 `client/` 源码和 `dist/client/` 构建产物为默认交付入口；后续框架或构建链调整必须先进入活动路线图和依赖治理记录。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 [docs/AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是否需要更新。

<!-- GOVERNANCE_REQUIRED_END -->

## 3. 当前边界与归档索引

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- AI 可以通过身份受限领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。
- S73-S79 人物与素材显示必须通过已审核 `portraitRef`、缩略图、低清占位、精简 runtime manifest 和 fallback 使用；不得显示未审核素材、不得硬编码本地路径、不得一次性拉取全量立绘池。

## 4. 活动路线图总览

当前活动专项为 S81-S85 NPC、资产与储物系统，规划源头见 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)。本专项必须坚持前后端分离：S81-S83 以后端数据契约、存储、AI schema、Mock fallback 和安全 API 为主；S84 集中做 React 前端体验；S85 做经济、长期关系、预留玩法和总验收整合。

| ID | 状态 | Owner | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| S81 | TODO | Codex | 后端数据契约与存储地基 | 建立开局背景、资产、资源、物品、NPC、委派任务 canonical schema、配置、JSON/SQLite 存储、派生表和安全 view；不做前端大界面。 |
| S82 | TODO | Codex | 开局背景兑现与资产落账 | 新增 `background_claim_parser` AI/Mock 解析、服务器裁决、资源/房产/书籍/仆役/债务/风险落账，以及 `openingBackgroundClaimsView`。 |
| S83 | TODO | Codex | NPC 名册、阶段人口与 AI 对话后端 | 将世界人物、科举同窗、官署属员、军营人物、家族亲属和立绘池整合为可交互 NPC 名册，提供 NPC 列表/详情/交互安全 API。 |
| S84 | TODO | Codex | 前端 NPC、背包仓库、交易与委派体验 | 在稳定 API 之上实现 React 背包仓库页、NPC 详情 surface、交易面板、委派任务面板和浏览器 smoke；前端不裁决资源或任务结果。 |
| S85 | TODO | Codex | 经济、长期关系与总验收 | 接入月末 tick、市场价格、NPC 私人目标、长期任务、论道/切磋/求爱/婚姻扩展位，并完成 JSON/SQLite/Mock/browser/docs 总验收与归档。 |
| S79 | DONE | Codex | 前端打磨与高清女性立绘入库 | 已完成前端正确性修复、194 张 recovered 女性高清母版入库、游戏内只读高清立绘放大查看器与安全/素材验证。 |
| S80 | DONE | Codex | 服务端全局 AI 设置与保存反馈 | 已完成 `GET/POST /api/ai/settings/global`、本地运行时设置文件、全局优先 AI route policy、共享 11 类任务矩阵面板和旧 session 设置入口兼容。 |
| PLAN-S81-S85 | DONE | Codex | NPC 与储物系统规划 | 新增 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，把用户需求和 Codex 建议固化为 S81-S85 可施工路线图，并把前后端分离/大步骤拆分写入治理规范。 |
| DOCS-2026-05-20 | DONE | Codex | 压缩上下文与台账，强化完整实现规范 | 本轮压缩 `docs/SHARED_CONTEXT.md` 与本文件，新增“不要最小实现点/最小改动点，追求完整丰富实现”的受保护开发规范，并同步 brief、AGENTS 与治理检查脚本。 |

## 5. 最新状态

- S80 当前基线：全局 AI 设置覆盖所有当前和未来案卷的 AI 路由；设置页和印匣共用 11 类任务矩阵，服务端 presets 为唯一来源，保存成功后以前端收到的服务端返回值回填表单。全局设置只保存 provider/model/预算/温度/安全控制，不保存 key、base URL、prompt、raw provider payload 或本地路径；缺 key 的真实 provider 不能作为可生效全局路由保存。
- S81-S85 当前规划：NPC、资产、储物和交易委派专项已经进入活动路线图。下一步从 S81.1 后端契约开始，先定义 state 字段、API response、AI schema、SQLite 派生表、Mock fallback 和安全 view，再拆分后端/AI/前端/验证施工。
- S79 当前基线：React 子路由壳、考试 smoke、recovered 女性高清立绘入库、runtime manifest、压缩 QA 和只读高清查看器已收束。查看器只读 `/assets/ui/` runtime 主图，不写 canonical state、URL、localStorage/sessionStorage、行动草稿或 AI prompt。
- S78 及更早阶段均已迁入专题归档。活动台账不再展开完成流水；需要追溯时使用本文件顶部归档索引。

## 6. 最近完整验证口径

S80 最新完整口径：

- `npm run typecheck:client`
- `npm run test:client`
- `node --test test/aiSettings.test.js test/aiSettingsRoute.test.js test/reactClientScaffold.test.js`
- `npm run build:client`
- `npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`

本轮 DOCS-2026-05-20 文档压缩与治理守门改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

本轮 PLAN-S81-S85 规划与治理规范改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

补充素材/manifest 回归入口仍保留：

- `npm run qa:frontend-assets`
- `npm run qa:portrait-compression`
- `node --test test/frontendInkAssetsManifest.test.js`
- `npm run smoke:browser` 覆盖 DOM、storage、runtime manifest、安全字段和截图产物名污染扫描。

## 7. 近期进度记录

### 2026-05-20：完成 PLAN-S81-S85 NPC、资产与储物系统规划

- 范围：按用户需求新增 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，规划 S81-S85：后端数据契约与存储地基、开局背景兑现与资产落账、NPC 名册与 AI 对话后端、React NPC/背包/交易/委派体验、经济长期关系与总验收。
- 保护：明确 AI 权力扩大为解析、扮演、提案和回禀，canonical state、资源扣减、交易、物品归属、委派结果、官职/科举和持久化仍由服务器裁决；JSON 默认可玩，SQLite 只做本机派生查询和可修复 projection。
- 开发规范：已把“复杂功能必须坚持前后端分离和大步骤拆分”写入 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 受保护段落和本文件受保护段落；S81-S83 以后端/API/数据/AI 为主，S84 集中前端体验，S85 做系统整合与总验收。
- 依赖与数据库：规划默认沿用 Node.js + Express、React + TypeScript + Vite、Ajv、Zustand、Lucide 和 `node:sqlite`；如 S84 后续确需 `@tanstack/react-query` 或 `@dnd-kit/core`，必须先走依赖治理。SQLite 规划新增资产、资源、背包、NPC、交互、委派和交易派生表，均从 `world_sessions.world_state_json` 单向修复。
- 验证：本轮应通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；因同步治理检查脚本，提交前执行只读复审。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：从 S81.1 开始，先写可执行契约和测试骨架，再实现 `assetLedger`、`inventoryLedger`、`npcRoster`、`delegatedTasks` 与 SQLite 派生表；不要先做前端假状态。

### 2026-05-20：完成 DOCS-2026-05-20 上下文压缩与完整实现规范

- 范围：压缩 `docs/SHARED_CONTEXT.md` 与 `docs/DEVELOPMENT_STEPS.md`，只保留接手下一步必要的状态、边界、归档索引、验证入口和当前建议；新增用户要求的开发规范，明确后续开发和维护不追求“最小实现点”或“最小改动点”，而追求完整、丰富、功能强大的游戏实现。
- 保护：稳定治理锚点、子代理纪律、Mock 默认可玩、完整书生路径、AI proposal-only、服务器裁决、magic numbers/配置集中、中文协作输出和本地-only 内容边界均保留；新增规范同时写入 `docs/DEVELOPMENT_GOVERNANCE.md` 的受保护段落和本文件受保护段落。
- 同步：已同步 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/SHARED_CONTEXT.md`、`AGENTS.md` 与 `scripts/checkGovernanceDocs.js`。由于检查脚本属于验证工具，本轮按非纯低风险文档处理，提交前执行只读子代理复审。
- 验证：已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（940 项）和 `git diff --check`；提交前只读复审 Anscombe 未发现 P0/P1/P2。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：新功能步骤应以完整玩家体验和完整系统闭环为目标，再拆成可审查的 coherent changes；不要只做临时占位或“最小能跑”的半成品。

### 2026-05-19：完成 S80 服务端全局 AI 设置与保存反馈

- 范围：建立服务端全局 AI 设置，保存后覆盖所有当前和未来案卷的 AI 路由；设置页与印匣共用 11 类任务矩阵，显示保存状态、保存时间、失败原因、provider key 可用性和每类任务生效状态。
- 实现：新增 `GET/POST /api/ai/settings/global` 与运行时文件 `data/settings/ai-global-settings.json`；旧 `GET/POST /api/ai/settings/:sessionId` 只保留兼容，仍校验案卷存在但读写同一份全局设置。`resolveAiSettingsForSession` 全局优先，开局、普通/流式回合、考试出题/评卷、快捷建议和专题拟稿共用 route policy。
- 安全：全局保存拒绝 hidden/raw/server/path/key、观测日志伪造和缺 key 的真实 provider；落盘只保存安全路由/预算/温度/控制字段。
- 验证：通过 client typecheck/test、focused Node tests、client build、React browser smoke、docs governance、documentation governance、diff check 和完整 `npm test`。提交前只读复审发现的禁用字段别名静默忽略问题已修复并补测。

### 2026-05-19：完成 S79 前端打磨与高清女性立绘使用

- 范围：修复考试页 `wordCount` 对象显示与 smoke 漏报，收束子路由壳；将 194 张 recovered 女性高清母版入库为公开 runtime WebP、缩略图和低清占位；新增游戏内只读高清立绘查看器。
- 边界：不改后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 或游戏规则。公开 manifest/runtime manifest 只登记 `/assets/ui/` 派生产物，不暴露 artifacts 母版路径。
- 验证：通过 client typecheck/test、React scaffold、browser smoke、素材 QA、runtime manifest、portrait compression、frontend asset QA、manifest tests、docs governance、documentation governance、diff check 和完整 `npm test`。

### 2026-05-19：完成活动台账归档

- 范围：新增 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)，保存本次整理前 `docs/DEVELOPMENT_STEPS.md` 的完整完成流水；本文件瘦身为当前边界、归档索引、最新完成节点、最近验证口径和下一步入口。
- 边界：纯文档整理，不新增运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 写入、素材或资源预算。
- 验证：通过 `npm run check:docs-governance` 与 `node --test test/documentationGovernance.test.js`。
