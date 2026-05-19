# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的活动路线图与进度台账。活动台账只保留接手下一步所必需的边界、最新状态和验证入口；已完成路线不再在本文件展开长表或逐日实现记录。

需要追溯已完成流水时阅读 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。需要追溯专题实现时优先阅读对应归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。旧分卷归档和 S60 契约文件保留为跳转页。
- S68-S69 科举、读书、评卷、榜单、同年座师、授官和 Provider/Mock 验收：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)。规划源头仍见 [IMPERIAL_EXAM_DEEPENING_ROADMAP.md](IMPERIAL_EXAM_DEEPENING_ROADMAP.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。规划源头仍见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。
- S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力事件、多 actor 场景、NPC 记忆账本、AI 调动审计和验收：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)。规划源头仍见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。
- S72 PixiJS 水墨地图：[PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)。规划源头见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。
- S73-S77 前端水墨重构、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、立绘管线、安全/性能/可访问性和总验证：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。规划源头仍见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。

2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

## 1. 开发规范继承

<!-- GOVERNANCE_REQUIRED_START -->

开发规范不变。继续保持：

- 稳定开发治理锚点见 [docs/DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md)；重写路线图或交接文档时不得删弱其中的必守规则，并运行 `npm run check:docs-governance`。
- `npm install && npm start` 可运行，默认打开 `http://localhost:3000`。
- Mock AI 默认完整可玩，真实 provider 只作为可选配置。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
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
- 前端继续保持无构建流程，除非本路线图或后续明确步骤批准升级。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 [docs/AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是否需要更新。

<!-- GOVERNANCE_REQUIRED_END -->

## 3. 当前边界与归档索引

S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排、S71 数据库玩法化、S72 PixiJS 水墨地图和 S73-S77 前端水墨重构都已迁入专题归档。S78 官署专题玩法化已完成并记录在本文件和共享上下文中；后续若扩展为更大的专题阶段，可拆出专门归档。

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S67 | DONE | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | DONE | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器面板和 Provider/Mock 验收 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |
| S70 | DONE | AI prompt/tool/actor/领域工具、多模型路由、AI 设置、月报、跳时、记忆、地图接口、MiMo AI-first smoke、JSON/SQLite parity 和 S70 归档 | [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) |
| S71 | DONE | 数据库 resolver 输入、SQLite 维护、安全搜索、redacted API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收归档 | [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md) |
| S72 | DONE | PixiJS 水墨地图、首批地图素材、局势簿联动、水墨动效、浏览器验收、安全回归和归档 | [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md) |
| S73-S77 | DONE | 前端水墨重构：素材体系、React/Vite/React Router 多页迁移、首页/全局 shell、身份/场景专题、考试/放榜、独立舆图页、立绘管线、安全/性能/可访问性和验收归档 | [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md) |
| S78 | DONE | 官署专题玩法化：六类专题读取安全 `topicSurfaceView`，支持 `topic_draft` 只读 AI/Mock 草稿、证据引用和底部奏折闭环；普通后果仍由 `/api/game/turn` 与服务器裁决链处理 | [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。S70.12 起玩家 route response 内的兼容 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`，记忆与经历摘要只能通过安全 view 暴露。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

S79 已进入前端打磨与高清女性立绘入库阶段。范围由用户于 2026-05-19 确认：先修本轮 UI 复查暴露的前端正确性、路由壳和烟测缺口，再把 `artifacts/codex-generated-female-portrait-png-recovery/likely-portrait-masters/` 中 194 张高清女性 PNG 母版全部纳入游戏，不因性能顾虑浪费素材；游戏内立绘右上角必须提供放大标志，允许玩家查看高清大图。

| ID | 状态 | Owner | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| S79 | DONE | Codex | 前端打磨与高清女性立绘入库 | 已完成前端正确性修复、194 张 recovered 女性高清母版入库、游戏内立绘放大查看器与验证收束；保持 Mock/JSON 默认可玩、书生科举链不破坏、安全 projection 与服务器裁决边界不变。 |
| S79.1 | DONE | Codex | 前端正确性、路由壳与 smoke 缺口修复 | 已修复 `ExamPage` 对 `wordCount` `{min,max}` 的渲染崩溃，补强考试 smoke 真实断言；`/exam`、`/ranking`、`/court`、`/settings` 改走轻量 `sessionRouteShell`，不再被主卷/身份栏压到页面下方。 |
| S79.2 | DONE | Codex | 194 张 recovered 女性高清母版入库管线 | 已为 `likely-portrait-masters` 的 194 张唯一 PNG 建立稳定 ID、来源记录、视觉/安全审核、高清运行时 WebP、缩略图、低清占位、manifest、QA sidecar 和脚本；原始 `artifacts/` 母版仍不直接提交或暴露给前端。 |
| S79.3 | DONE | Codex | 游戏内高清立绘使用与放大查看 | 已在 `Portrait` 可欣赏立绘右上角加入放大标志；首页选角、人物谱牒和人物档案专题公开立绘均通过已审核 `portraitRef` 与 runtime manifest 读取高清主图。只读高清查看器由 `SurfaceHost` 托管，支持 Esc、遮罩关闭、焦点回收、移动端适配和滚动锁定，不写 canonical state、URL、localStorage/sessionStorage、行动草稿或 AI prompt。 |
| S79.4 | DONE | Codex | 验证、文档同步与提交 | 已同步 brief、素材台账、共享上下文和本台账；已运行 client typecheck/test、React smoke、素材 QA、manifest 测试、docs governance、documentation governance、diff check 和完整 `npm test`。提交 hash 随本次 coherent change 见 Git 历史。 |

## 5. 当前最新完成节点

- S78 已完成官署专题玩法化。`/game/:sessionId/court` 的奏折队列、拟圣旨、朝议、堂审、军议和人物档案六类入口现在读取 `topicSurfaceView` 安全投影，显示真实玩家可见材料、证据 ref、人物公开摘要、可选草稿模板和上一轮公开结果；`topic_draft` 只读 AI/Mock 草稿可生成标题、正文、引用证据、风险和下一步建议，并允许玩家改稿后写入底部奏折。专题草稿不提交回合、不调用 resolver、不推进时间、不写 canonical state，普通后果继续由 `/api/game/turn` 和服务器裁决链处理。
- S73-S77 已完成归档与总验证。归档见 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，历史完成台账流水见 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。
- S77.8 最新验收通过 `npm test`、client typecheck/test/build、React browser smoke、Mock 科举链、JSON/SQLite storage-only 双模式、docs governance、documentation governance 和 diff check。
- S72 及更早阶段均已迁入专题归档。活动台账不再展开完成流水；需要追溯时使用本文件顶部归档索引。

## 6. 最近完整验证口径

S77.8 最新验收口径：

- `node --check scripts/clientSmoke.js`
- `node --check scripts/clientBuildBudget.js`
- `npm test`（933 项通过，包含 `test/reactClientScaffold.test.js` 与 `test/browserSmokeScript.test.js`）
- `npm run typecheck:client`
- `npm run test:client`（66 项通过）
- `npm run build:client`
- `npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink`
- `npm run smoke:exam-s69`
- `npm run smoke:dual-mode -- --storage-only`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

补充素材/manifest 回归入口：

- `npm run qa:frontend-assets`
- `npm run qa:portrait-compression`
- `node --test test/frontendInkAssetsManifest.test.js`
- 结构化污染扫描由 `npm run smoke:browser` 覆盖 DOM、storage、runtime manifest、安全字段和截图产物名；完整素材 manifest 仍由 `qa:frontend-assets` 与 manifest 测试守门。

## 7. 本轮台账归档记录

### 2026-05-19：完成 S79.3 游戏内高清立绘放大查看

- 范围：为游戏内可欣赏立绘增加右上角放大标志，并实现只读高清大图查看器；覆盖首页选角、人物谱牒和人物档案专题中的公开立绘位。
- 实现：`Portrait` 继续优先使用已审核 runtime 主图 `portrait.path`，新增 `Maximize2` 放大按钮；`uiState` 新增瞬时 `activePortraitViewer`，只保存 `portraitRef` 与 label；`SurfaceHost` 新增 `PortraitViewerHost`，统一处理 Esc、遮罩关闭、焦点回收、滚动锁定、移动端尺寸和 fallback。`npc-profile` 人物档案专题新增公开立绘条，只展示当前安全案卷中已有且命中 runtime registry 的 `portraitRef`，不从全量素材池补人、不推断 hidden 人物。
- 安全边界：查看器只读 `/assets/ui/` 运行时主图路径，不引用 artifacts 母版，不写 canonical state、URL、localStorage/sessionStorage、行动草稿或 AI prompt，不展示 raw audit、provider payload、完整 prompt、本地路径、key、hidden notes 或 hidden intent。点击人物档案专题内的放大按钮时，查看器覆盖在专题层上，关闭后仍回到原专题语境。
- 验证：已通过 `npm run typecheck:client`、`npm run test:client -- --run client/src/components/Portrait.test.tsx client/src/state/uiState.test.ts client/src/__tests__/App.test.tsx`（51 项）、`node --test test/reactClientScaffold.test.js`（37 项）、`node --check scripts/clientSmoke.js`、`npm run test:client`（67 项）、`npm test`（936 项）、`npm run qa:runtime-manifest`、`npm run qa:portrait-compression`、`npm run qa:frontend-assets`、`node --test test/frontendInkAssetsManifest.test.js`、`npm run build:client` 和 `npm run smoke:browser -- --screenshots artifacts/s79-3-portrait-viewer-smoke`。首次 browser smoke 因新增断言把既有 `qianqiu.displayPreferences.v1` key 误判为 viewer 写入而失败，已收窄断言并重跑通过。
- 子代理：只读 explorer Singer 勘察 `Portrait`、人物页、专题 surface、CSS 和测试接入点，建议由 `Portrait` 触发、`SurfaceHost` 统一托管查看器，并提醒首页选角按钮需 `stopPropagation()`、查看器不得写 storage/URL/prompt；未编辑文件、未运行 Git 写操作。提交前只读复审 Hegel 未发现 P0/P1 安全问题，指出人物档案专题上方关闭高清查看器后焦点可能不回到放大按钮的 P2；已改为按 overlay 层保存焦点返回目标，并补嵌套专题查看器焦点回收测试后重跑通过。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：S79 已收束；后续可进入新的小步骤，继续从安全 projection 与已审核资产层扩展前端玩法。

### 2026-05-19：完成 S79.2 Recovered 女性高清母版入库管线

- 范围：把 `artifacts/codex-generated-female-portrait-png-recovery/likely-portrait-masters/` 中 194 张唯一 PNG 母版全部按稳定 `portrait-s79-2-recovered-female-###-v1` ID 入库，派生公开 1024x1536 高清 WebP、384x576 缩略图和 64x96 低清占位。
- 实现：新增 `scripts/frontendRecoveredFemalePortraitAssets.js`、`qa:recovered-female-portraits` / `qa:recovered-female-portraits:write` 和 `public/assets/ui/portraits/portrait-recovered-female-pool-qa-v1.json`；新增 `public/assets/ui/portraits/s79-2/` 主图、对应 `thumbs` 与 `placeholders`，并刷新 `ink-ui-manifest.json`、`ink-ui-runtime-manifest.json`、`asset-qa-report-v1.json` 与 `portrait-compression-qa-v1.json`。
- 资产事实：S79.2 新增 `recovered_female_highres_pool` / `portrait_pool_recovered_female_s79_2` 共 194 张；185 张源图原尺寸为 1024x1536，9 张相近竖版源图等比置入 1024x1536。当前 manifest 为 836 个 active 素材，其中 active 立绘 790 张；portrait compression QA 覆盖 790 张 active 立绘，S73.10 仍为 572 张。
- 视觉与安全：Codex 生成 4 张 contact sheet 并用视觉理解复看 194 张，确认整体为成年女性古风竖版立绘，服饰完整，脸部、发髻、衣料层次、腰封和姿态清楚，与现有 S73.10 女性池兼容；未见明显水印、现代 UI、大面积可读文字、露骨、挑逗或幼态问题。公开 manifest/runtime manifest 只记录 `/assets/ui/` 派生产物和 `localHighResSource=kept_outside_public_manifest` 标记，QA sidecar 只记录源文件名、源 SHA-256 和源尺寸，不暴露 artifacts 路径。
- 边界：本轮不改后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state、prompt 或游戏规则；S79.3 才接游戏内放大标志和只读高清查看器。
- 子代理：只读 explorer Schrodinger 检查现有立绘管线并建议新增独立 S79.2 脚本、sidecar 与 QA 命令；只读 explorer Beauvoir 盘点 194 张源图的数量、SHA、尺寸分布和 recovery manifest 顺序。两者均未编辑文件、未运行 Git 写操作。提交前只读复审 Archimedes 查看最终 diff、manifest/QA/test/doc 计数和验证证据，未发现 P0/P1/P2/P3。
- 验证：已通过 `node --check scripts/frontendRecoveredFemalePortraitAssets.js`、`npm run qa:recovered-female-portraits`、`npm run qa:runtime-manifest`、`npm run qa:portrait-compression`、`npm run qa:frontend-assets`、`node --test test/frontendInkAssetsManifest.test.js`、`node --test test/reactClientScaffold.test.js`、`npm run typecheck:client`、`npm run test:client`（66 项）、`npm run build:client`、`npm run smoke:browser -- --screenshots artifacts/s79-2-recovered-female-smoke`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 LF/CRLF 提示）和完整 `npm test`（935 项通过、0 失败）。S79.2 后 runtime manifest 为 937342 bytes，仍剥离 authoring-only 字段；React scaffold 与 browser smoke 的 runtime manifest 预算已按高清池索引调整为 1,050,000 bytes。
- 下一步：进入 S79.3，在游戏内可欣赏立绘右上角增加放大标志，并实现不写 canonical state、URL、localStorage/sessionStorage 或 AI prompt 的只读高清大图查看器。

### 2026-05-19：完成 S79.1 前端正确性、路由壳与 smoke 缺口修复

- 范围：完成 `ExamPage` 对考试 `wordCount` 数字或 `{min,max,target,recommended}` 对象的安全显示，补强 `scripts/clientSmoke.js` 的取题后真实页面断言，并把 `/game/:sessionId/exam|ranking|court|settings` 从主卷叙事、身份面板和底部奏折壳下方移到轻量子路由壳中。
- 实现：新增 `ExamWordCount` 前端类型和 `formatWordCountLabel`；取题后必须继续显示 `.examFullScreen`、考题、文章输入、字数栏和交卷按钮，错误页不再被 smoke 漏报。`GamePage` 新增 `sessionRouteShell` 和复用页签组件，`CourtPage`/`SettingsPage` 独立标题改为 `h1`；`/map` 仍保留既有独立地图壳，`/people` 与 `/archive` 暂不变。
- 边界：不改后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state；本轮只处理 React 前端、smoke、聚焦测试和文档同步。
- 子代理：只读 explorer Mendel 检查了 route/AppShell/GamePage 嵌套与最小修改建议，未编辑文件、未运行 Git 写操作；代码完成后还需按规则做提交前只读复审最终 diff。
- 验证：已通过 `npm run typecheck:client`、`npm run test:client`（66 项）、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（36 项）、`npm run smoke:browser -- --screenshots artifacts/s79-1-route-shell-smoke`、`npm test`（934 项）、`npm run smoke:exam-s69`、`npm run check:docs-governance` 和 `node --test test/documentationGovernance.test.js`。一次 `npm run test:client -- --runInBand` 因 Vitest 不支持该参数失败，已用项目原生命令重跑通过。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：进入 S79.2，建立 194 张 recovered 女性高清 PNG 母版的入库、审核、manifest 与 QA 管线。

### 2026-05-19：登记 S79 前端打磨与高清女性立绘入库计划

- 范围：把本轮 UI 复查与用户新增要求登记为 S79。已知前端打磨点包括考试页 `wordCount` 对象渲染崩溃、考试 smoke 对错误页的漏报、若干子路由被主卷/身份栏压在下方、AI 设置表单重复，以及后续可进一步收束的资源预算口径。
- 资产事实：`artifacts/codex-generated-female-portrait-png-recovery/likely-portrait-masters/` 当前有 194 张 `.png`，总量约 572MB，SHA 均唯一；其中 185 张为 `1024x1536`，其余 9 张为相近竖版高清尺寸。S79.2 必须全部入库使用，不得只挑一部分，也不得只生成缩略图后闲置高清母版。
- 关键决策：用户明确要求“务必要高清使用，不要在乎性能”。因此 S79 的立绘主展示以高清运行时主图为准，缩略图和低清占位只服务列表预览、占位、QA 或渐进加载；涉及人物/选角/档案等可欣赏场景时，应优先呈现高清图。既有首屏资源预算仍保护首页初始化，但 portrait-heavy 页面与大图查看器的预算需按回合制游戏和高清欣赏口径重新定义。
- 交互要求：游戏内可欣赏立绘右上角新增放大标志，建议使用既有 `lucide-react` 图标；点击后打开只读大图查看器，展示高清图、人物/池来源标签和必要的关闭控件，支持 Esc、遮罩关闭、焦点回收、滚动锁定、移动端安全区域和无障碍标签。查看器不得写 canonical state、URL、localStorage/sessionStorage 或 AI prompt。
- 边界：本次仅登记规划文档，不新增运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 写入或 runtime 素材；后续真正入库仍必须走 manifest、视觉/安全审核、QA sidecar 和 `/assets/ui/` 安全路径。
- 子代理：本轮是低风险纯规划文档登记，按规则跳过子代理复审并记录；S79 后续只要包含代码、测试、脚本、素材、manifest、QA 或验证工具改动，暂存和提交前必须委派只读子代理复审最终 diff 与验证证据。
- 验证：已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 下一步：从 S79.1 开始，先修考试页与 smoke 漏报，再进入 S79.2 的 194 张高清女性母版入库，最后接 S79.3 的高清使用与放大查看体验。

### 2026-05-19：已完成活动台账归档

- 范围：新增 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)，保存本次整理前 `docs/DEVELOPMENT_STEPS.md` 的完整完成流水；本文件瘦身为当前边界、归档索引、最新完成节点、最近验证口径和下一步入口。
- 边界：纯文档整理，不新增运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 写入、素材或资源预算。
- 子代理：低风险纯文档整理，跳过子代理复审；本说明与 `docs/SHARED_CONTEXT.md` 均记录该决定。
- 验证：运行 `npm run check:docs-governance` 与 `node --test test/documentationGovernance.test.js`。
- 下一步：后续工作从 S79 或新的明确小步骤开题，并继续沿用安全 projection、proposal-only、服务器裁决、Mock/no-key fallback、资源预算和可访问性守门。
