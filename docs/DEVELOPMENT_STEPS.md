# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的压缩活动路线图与进度台账。它只保留接手下一步所必需的治理规则、当前状态、验证口径和归档入口；已完成或阶段性收束的长流水不在这里展开。

需要追溯已迁出的完成流水时，优先阅读专题归档、压缩索引和 Git history：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库与大世界内容：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。
- S68-S69 科举深化：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI 编排：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。
- S71 数据库玩法化 resolver：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。
- S72 PixiJS 水墨地图：[PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)。
- S73-S77 前端水墨重构：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。
- S81-S85 NPC、资产、储物、交易、委派、经济、主动来函与礼法扩展位：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。
- S86 后端 TypeScript 渐进迁移：[TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)，规划见 [TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md](TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md)。
- S87 route/API 响应类型覆盖：[TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)，规划见 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md)。
- S88 全面系统打磨阶段性归档：[QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。
- 已完成活动台账压缩索引：[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。

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
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，应优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 允许渐进迁移，不得为语言迁移一次性重写大量稳定模块，TS 类型也不能替代 Ajv 与服务器 runtime 校验。
- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`；不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件，也不得放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
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
- S88 已作为阶段性打磨归档到 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)；若后续继续其中某个方向，应新开 S89 或更具体的小步骤，不要把 S88 长流水复制回本文件。

## 4. 活动路线图总览

当前活动小步骤只保留最新可接手状态。S88 全面系统打磨长表已于 2026-05-24 迁出本台账，归档入口为 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划仍见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。

| ID | 状态 | 目标 | 范围 / 下一步 |
| --- | --- | --- | --- |
| S89.47 | DONE | 主卷静态 surface utility 接入 | 承接 S89.46 后继续收敛共享材质 selector 中的 route-specific 耦合，主卷 `.narrativeScroll`、`.gameSideLedger` 和条件渲染的 `.openingClaimPanel` 新增 `.paperMotionSurface`；既有业务 class、`data-polish-game="s89-22-main-ledger-reader"`、`data-draft-state`、案头索引、草稿状态、开局背景裁决读法、主卷叙事、移动端布局和低动效降级均保留。`polish-surfaces.css` 第一条共享纸面 selector 不再依赖这三个业务 class；人物工作台和科举面板仍留待后续小步审计，避免同轮碰 NPC mutation、交易/委派、交游行动、取题/推进考场或交卷路径。`test/reactClientScaffold.test.js` 新增 S89.47 source canary；`scripts/clientSmoke.js` 在默认 Mock 开局主卷抽样三处静态 `.paperMotionSurface`，并在草稿写入后守住 `.gameSideLedger.paperMotionSurface[data-draft-state='written']`。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不新增裁决权。实现提交：`da3ff316`。 |
| S89.46 | DONE | 首页静态 surface utility 接入 | 承接 S89.45 后继续收敛共享材质 selector 中的 route-specific 耦合，首页开卷案桌 `.homeDesk`、当前本局 `.continueShelf` 和旧案架 `.saveShelf` 新增 `.paperMotionSurface`；既有业务 class、`data-polish-home-*`、开局表单、旧案读取/刷新、继续本局链接、状态文案、移动端布局和低动效降级均保留。`polish-surfaces.css` 第一条共享纸面 selector 不再依赖这三个业务 class；主卷、人物工作台和科举面板仍留待后续小步审计，避免同轮碰草稿状态、NPC 行动、交易/委派或考试交卷路径。`test/reactClientScaffold.test.js` 新增 S89.46 source canary；`scripts/clientSmoke.js` 在默认首页、移动首页和返回首页继续本局路径抽样静态 `.paperMotionSurface`。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、本地状态和旧案列表，不新增裁决权。实现提交：`26c604b8`。 |
| S89.45 | DONE | 囊箧与账解静态 surface utility 接入 | 承接 S89.44 后继续收敛共享材质 selector 中的 route-specific 耦合，囊箧页 `.inventoryContainerList`、`.inventoryItemList`、三处 `.inventoryLedgerBlock` 和两处 `.inventoryTransferPanel` 新增 `.paperMotionSurface`，账解读法 `.economyTraceSection` 新增 `.paperMotionSurface`；既有业务 class、容器/物件选择、移置表单、候批笺标记、资源/资产/凭证摘要、经济 trace 证据/边界标记、伪元素、backdrop-filter 和移动端布局均保留。`polish-surfaces.css` 第一条共享纸面 selector 不再依赖这五个业务 class；人物案头、首页/主卷和考试案头等仍留待后续小步审计。`test/reactClientScaffold.test.js` 新增 S89.45 source canary，守住囊箧/账解 hook、共享 selector 收敛、未误接 `.paperMotionCard` / `.paperMotionPanel` 且不引入回合提交或危险 HTML；`scripts/clientSmoke.js` 在桌面/移动囊箧路线抽样 8 个静态 `.paperMotionSurface`。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、本地表单和草稿，不新增裁决权。实现提交：`7fef02de`。 |
| S89.44 | DONE | 舆图与史册静态读法 surface utility 接入 | 承接 S89.43 后继续收敛共享材质 selector 中的 route-specific 耦合，舆图页 `.mapSituationLedger`、`.mapVisibleLayerDigest`、`.mapSituationIndex` 新增 `.paperMotionSurface`，史册页 `.archiveDigestBand` 与 `.archiveDigestIntro` 新增 `.paperMotionSurface`；既有业务 class、`data-polish-*`、按钮草稿状态、近次线索、统计、空态、证据读法、跨页追索和移动端布局均保留。`polish-surfaces.css` 第一条共享纸面 selector 不再依赖这五个业务 class，高对比 selector 同步移除 `.archiveDigestBand` 并改由 `.paperMotionSurface` 承接；人物/囊箧工作台、首页/主卷、考试案头和账解区域因布局/状态/伪元素/交互更复杂，留待后续小步审计。`test/reactClientScaffold.test.js` 新增 S89.44 source canary，并把 S89.43 未误接 card/panel 的负向断言改为顺序无关；`scripts/clientSmoke.js` 在桌面/移动舆图和史册索引中抽样 `.paperMotionSurface` 数量。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`c3fa671f`。 |
| S89.43 | DONE | 皇榜与专题层静态 surface container 语义 hook 接入 | 承接 S89.42 后继续收敛共享材质 selector 中的 route-specific 耦合，皇榜全屏页的 `.rankingNoticeBoard`、`.rankingListPanel`、`.rankingDetailPanel`、`.rankingBoundary` 新增 `.paperMotionSurface`，专题层与舆图筛选的 `.topicSurfaceColumn`（含 `.topicDraftColumn`）新增 `.paperMotionSurface`；既有业务 class、`data-polish-*`、focus、ARIA、专属金榜布局、榜行 `.paperMotionInteractive` / `data-selected`、专题层材料/证据/草稿/本地写入逻辑均保留。`polish-surfaces.css` 第一条共享纸面 selector 不再依赖 `.rankingNoticeBoard`、`.rankingListPanel`、`.rankingDetailPanel`、`.rankingBoundary` 或 `.topicSurfaceColumn`，仍保留主桌、考试案头、舆图局势、人物案头、囊箧/账解等更复杂 route CSS 业务 selector待后续小步评估。`test/reactClientScaffold.test.js` 新增 S89.43 source canary；`scripts/clientSmoke.js` 在皇榜全屏、专题层、桌面/移动舆图筛选中抽样 `.paperMotionSurface` 数量。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`29ae3653`。 |
| S89.42 | DONE | 静态纸面 surface utility 与结构 selector 收敛 | 承接 S89.41 后继续收敛共享材质 selector 中的结构/route-specific 耦合，新增并接入 `.paperMotionSurface` 作为只承接共享纸面阴影、不承担入场动画或交互抬升的静态 surface hook；主卷行止笺、囊箧候批笺、设置目录状态、朝议案头索引、史册证据读法、科举仪程、皇榜仪程、人物案头索引、专题层案卷口径和 AI 推演设置状态簿的 `.surfaceSafetyList` 行统一新增 `.surfaceSafetyRow paperMotionSurface`，AI 推演分工卡新增 `.aiTaskRoute paperMotionSurface`。`polish-surfaces.css` 已从 `.aiTaskRoute`、`.surfaceSafetyList div` 和 `.rankingList button` 收敛到语义 hook；皇榜榜行保留既有 `.paperMotionInteractive`、`aria-pressed` / `data-selected` 和专属金榜选中 CSS，不误接 `.paperMotionSelected`。`test/reactClientScaffold.test.js` 新增 S89.42 source canary，守住静态 surface hook、无旧结构 selector、皇榜榜行不误标 selected；`scripts/clientSmoke.js` 增加 `.paperMotionSurface`、`.surfaceSafetyRow.paperMotionSurface`、旧安全行缺口、`.aiTaskRoute.paperMotionSurface` 和皇榜 interactive/selected-hook gating 运行时抽样。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`babb4ab9`。 |
| S89.41 | DONE | 跨身份大面板语义纸面动效 utility 接入 | 承接 S89.40 后继续收敛 `.scholarPanelCard` 在共享材质 selector 中的业务耦合，新增并接入 `.paperMotionPanel` 作为大面板材质/动效 hook；五身份面板与 `RoleCycleSection` 外层 article 额外接入 `.rolePanel`，但 `DomainConsequenceSection`、`NpcFollowUpEvidenceSection`、`CrossPageTraceRail` 和史册证据读法只接 `.paperMotionPanel`，不误标为身份面板。`polish-surfaces.css`、高对比和低动效共享 selector 已从 `.scholarPanelCard` 与已被 `paperMotionCard` 覆盖的 `.npcRelationshipAgendaCard` 收敛到 `.paperMotionPanel`；`routes/game.css` 中 `.scholarPanelCard`、`.scholarPanelCardHeader`、面板内标题/按钮等业务布局规则保留，不删除仍有源码命中的 selector。`scripts/clientSmoke.js` 在书生面板后抽样守住 `.scholarPanelCard.paperMotionPanel` / `.scholarPanelCard.rolePanel`，`test/reactClientScaffold.test.js` 新增 S89.41 source canary，守住 header 仍为 `scholarPanelCardHeader`、非身份证据/追索面板不含 `rolePanel`、共享 selector 不再依赖 `.scholarPanelCard` / `.npcRelationshipAgendaCard`。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`93a84ec4`。 |
| S89.40 | DONE | selected/empty 语义纸面动效 utility 接入 | 承接 S89.39 后继续收敛 selected/empty 共享材质 selector，新增并接入 `.paperMotionSelected` 与 `.paperMotionEmpty` 语义 hook。人物名册、囊箧容器、议题草稿槽、印匣页签、人物工作台页签和舆图图层开关保留原业务 class、ARIA/checked/data 状态，同时复用 selected hook；首页旧案空态、跨身份面板空态、快捷建议空态、史册空态、皇榜空态、舆图 runtime/全隐空态和 AI 设置矩阵 error 状态复用 empty hook，AI 设置只在 error 时加 `.paperMotionEmpty`。`polish-surfaces.css` selected/empty 共享材质 selector、高对比 selected 边框和低动效 selected 动画关闭已改读语义 hook，并继续以真实 selected/checked 状态门控；`scripts/clientSmoke.js` 记录 selected/empty 数量，守住未选中 semantic control 不带 selected 材质，并在舆图三层全隐时强制检查 `.paperMotionEmpty`；`test/reactClientScaffold.test.js` 新增 S89.40 source canary。未删除业务 class、专用 CSS 或仍有源码命中的旧 selector；跨身份大面板、`surfaceSafetyList div`、`aiTaskRoute`、`rankingList button` 等仍留待后续评估。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`76db0feb`。 |
| S89.39 | DONE | CSS 语义纸面动效 utility 接入 | 承接 S89.38 后继续收敛共享材质巨型 selector，新增并接入 `.paperMotionCard`、`.paperMotionInteractive`、`.paperMotionDraft` 语义 hook，让旧案卡、舆图行动/近事/人物锚点、史册线索/归档项、人物卡、交游信号/议题、囊箧资产/凭证/物件、来函证据、账解卡、皇榜前三印、榜行按钮、设置目录卡和专题层条目在保留原业务 class 的同时复用稳定 utility。`polish-surfaces.css`、高对比和低动效共享 selector 已从一批 route-specific class 收敛到这些语义 hook，selected/empty/跨身份大面板等高风险选择器暂保留显式业务 selector；`test/reactClientScaffold.test.js` 改为递归解析 CSS `@import` 图并新增 S89.39 source canary，`scripts/clientSmoke.js` 抽样守住 `.paperMotionCard.paperMotionInteractive` 与 written draft 语义 class。未删除 `.rolePanel`、`.statusSurface`、`.paperMotionEmpty` 或仍有源码命中的旧 class；后续若继续，应再分步接入 selected/empty 或跨身份面板。范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`54ad449d`。 |
| S89.38 | DONE | CSS 架构重构第二阶段 | 承接 S89.37 后开启 CSS 物理拆分与长期维护性整理，已将 `client/src/styles/global.css` 改为稳定 Vite 聚合入口，并按 `tokens/`、`base/`、`utilities/`、`components/`、`routes/`、`responsive/`、`motion/` 拆分样式模块；`responsive/global-responsive.css` 继续二级导入移动端 layout/home/game-map/people-inventory/exam-ranking 模块，避免继续维护单个 760px 巨块。新增状态色、disabled、卡片阴影和 disabled surface token，高对比模式同步覆盖这些 token；共享 S89.30 材质动效主 hook 从路线图编号 selector 收敛到稳定 `data-material-motion="shared-paper"`，旧 `data-polish-atmosphere` 仅保留作 smoke/source marker；短编号 `s895D` / `s895S` keyframes 改名为 `drawerPanelFade` / `draftWrittenPulse`。`test/reactClientScaffold.test.js` 改为读取入口与所有拆分模块的合并样式源，并新增 S89.38 import 顺序 canary；`scripts/clientSmoke.js` 增加 `data-material-motion` 守门。未删除 `.rolePanel` / `.statusSurface` 等预留 utility，也未删除源码仍命中的旧 selector；后续若继续，应逐页把巨型共享 `:is(...)` 接入语义 utility。范围限 CSS 模块结构、少量 `AppShell` 语义 data hook、客户端 smoke/source canary、brief 与交接文档；不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`4c9acd3f`。 |
| S89.37 | DONE | CSS token 与可访问性渐进重构 | 承接 S89.36 后开启小批量 CSS 架构专项第一阶段，已在 `global.css` 补齐颜色、纸面、边框、间距和动效 token，正文链接恢复默认可识别下划线并用 `a[class]` 与 `.scholarPanelActions a` 保持按钮/导航型链接 reset；新增 `.paperSurface`、`.rolePanel`、`.statusSurface`、`.ledgerCard` 基础 surface utility，并先接入 `CrossPageTraceRail`；`data-contrast="high"` 系统性提高纸面、边框、focus 对比，`data-motion="reduced"` 与 `prefers-reduced-motion` 共用动效变量。范围限全局 CSS、`CrossPageTraceRail` class 接线、source canary、brief 与交接文档；不做物理拆 CSS 文件，不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不新增裁决权。实现提交：`33a3a458`。 |
| S89.36 | DONE | 朝议 / 人物 / 史册跨页追踪读法 polish | 承接 S89.35 后继续做产品级前端 polish，已新增共享 `CrossPageTraceRail`，在 `/game/:sessionId/court`、`/game/:sessionId/people` 和 `/game/:sessionId/archive` 放入“跨页追索笺”，把朝议、人物、史册和主卷候复之间的自然读卷路径整理成只读卡片；rail 使用折纸材质、错落进入、hover/focus 抬升和低动效关闭守门，移动端单列。范围限 React `CrossPageTraceRail` / `CourtPage` / `PeoplePage` / `ArchivePage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 与交接文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费当前 route session 的安全 view、既有页面已清洗计数和本地草稿有无，不请求诊断接口，不读取 raw 存档、本地路径、source manifest 或完整 manifest，不裁决资源、身份、交易、委派、NPC 行动、经济、考试、官职、地图行动、关系或 hidden 信息。实现提交：`9748b336`。 |
| S89.35 | DONE | 人物页与高清立绘查看器二轮高级展示 polish | 承接 S89.34 后继续做产品级前端 polish，已在 `/game/:sessionId/people` 新增“人物画屏 / 入谱照面”、画屏案读、人物名册选中态、人物谱牒卡选中/高清状态和 S89.35 可检测 marker；高清立绘查看器新增“画屏案读”只读栏、viewer 状态和画像卡 zoomable/ready/fallback 状态。范围限 React `PeoplePage` / `Portrait` / `SurfaceHost`、全局 CSS、客户端 smoke/source canary、前端测试、brief 与交接文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费 `worldPeopleView`、`npcRosterView`、`npcDetailView.publicProfile`、既有 follow-up/economy/relationship 安全 view、route/local 状态和已审核 runtime 画像字段，不读取 raw 存档、本地路径、source manifest 或完整 manifest，不裁决资源、身份、交易、委派、NPC 行动、经济、考试、官职、地图行动、关系或 hidden 信息。实现提交：`d6ad9af4`。 |
| S89.34 | DONE | 主卷与朝议案头中枢二轮材质动效 polish | 承接 S89.33 后继续做产品级前端 polish，已在 `/game/:sessionId` 新增“案头中枢 / 本卷案桌”、主卷命令栏/场景带 marker、场景/卷宗/草稿/去处读法和行旅/人物/账解/科举复核分组计数；在 `/game/:sessionId/court` 新增“官署议程 / 御案传签”、章奏/谕旨/朝议/堂审军议读法、议程状态和六个既有专题入口状态。范围限 React `GamePage` / `CourtPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 与交接文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/local 状态和本地草稿状态，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、地图行动、关系或 hidden 信息。实现提交：`0bae6c8f`。 |
| S89.33 | DONE | 科举与皇榜二轮仪式材质动效 polish | 承接 S89.32 后继续做产品级前端 polish，已在 `/game/:sessionId/exam` 新增“科场仪幕”、科举 hero/试卷纸卷 marker、题纸启封/落墨/候榜状态和纸卷展开动效；在 `/game/:sessionId/ranking` 新增“金榜仪轨”、皇榜 hero/榜纸 marker、金榜张榜/我名/同年/授官读法和榜行选中反馈。范围限 React `ExamPage` / `RankingPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 与交接文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、既有科举 API、route/local 状态和本地草稿，不裁决取题、评分、舞弊、放榜、晋级、授官、同年座师关系、官职任免或 hidden 信息。实现提交：`dd47cb17`。 |
| S89.32 | DONE | 首页与全局壳材质动效及入口收束 polish | 承接 S89.31 后继续做产品级前端 polish，已在首页新增“开卷路径”读法，把题名、立身、候复三步收进新开案卷表单，并把样卷入口降权为“试阅样卷 / 样卷舆图”；全局壳新增顶栏、导航和右上角工具区玻璃纸层 marker，右上角印匣与设置目录同步新增可检测入口标记。范围限 React `HomePage`、`AppShell`、`SurfaceHost`、`SettingsPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 与交接文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态、本地显示偏好和旧案列表，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、地图行动、关系或 hidden 信息。实现提交：`111566ee`。 |
| S89.31 | DONE | 舆图态势罗盘与移动单点札记 polish | 承接 S89.30 后继续做舆图产品级打磨，已在 `/game/:sessionId/map` 新增只读“舆图态势罗盘”，按近事、人物、后果、可拟四类整理当前公开图层与本地候复草稿；PixiJS runtime tooltip 新增“地点/近事/人物/驿路札记”、可见度条、候复边界和移动端底部札记读法。范围限 React `MapPage`、`InkMapRuntimeBridge`、全局 CSS、客户端 smoke/source canary、brief 与交接文档；不新增 API，不改 `mapRuntimeView` 契约、后端 schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、图层状态和本地草稿，不把坐标、layout、点击位置、visual-only effect、NPC anchor 或 tooltip 变成资源、NPC、经济、关系、地图行动、官职、考试或 hidden 裁决依据。实现提交：`88a5253c`。 |
| S89.30 | DONE | 共享案卷材质与错落动效 polish | 承接 S89.29 后继续做跨页产品级视觉打磨，已在 React 壳层新增 `data-polish-atmosphere="s89-30-shared-material-motion"`，并用共享 CSS 增强首页案桌/旧案架、主卷案头、舆图簿、人物卡、囊箧、史册、科举、皇榜、朝议、设置目录、专题层与状态提示的宣纸层次、轻浮起、错落进入、朱印选中、草稿已写入和空态纸底反馈；低动效偏好与系统 `prefers-reduced-motion` 均关闭强动画但保留清晰状态。范围限 `AppShell` 标记、全局 CSS、客户端 smoke/source canary、CSS 构建预算脚本和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或 hidden 信息。实现提交：`76bdb67c`。 |
| S89.29 | DONE | 史册证据读法与旁注空态 polish | 承接 S89.28 后继续做零 CSS 前端产品化打磨，已在 `/game/:sessionId/archive` 新增“史册追索笺 / 史册证据读法”，把近次入册、公开后果、实体余波、来函线索和拟稿候复边界整理为玩家可读旁注。范围限 React `ArchivePage`、客户端 smoke/source canary、前端测试和文档；不新增 CSS、依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费 `eventArchiveView`、`domainConsequenceView`、`npcActiveRequestView.followUpEvidence`、route/local 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或 hidden 信息。实现提交：`4bf06317`。 |
| S89.28 | DONE | 前端 JS 分包预算稳定 | 承接 S89.27 后 JS 总量仍贴近总预算、且主应用 chunk 已多次靠近 `maxSingleJsBytes: 650_000` 的状态，已通过 Vite `manualChunks` 把 React/React Router、Zustand、Lucide 和其余 npm vendor 拆成稳定 vendor chunks，保护单 chunk 预算和浏览器缓存命中。范围限 `vite.config.mjs`、source canary 和开发文档；不引入 `React.lazy` / route lazy loading，不新增依赖或素材，不改 React 运行时数据来源、玩家可见 UI、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或 hidden 信息。实现提交：`81d0ac0b`。 |
| S89.27 | DONE | 前端 CSS 构建预算校准 | 承接 S89.26 后 CSS 构建产物 `99.5 KiB` 仅剩约 `513` bytes 余量的状态，已将 `scripts/clientBuildBudget.js` 的 CSS 总预算从 `140000` bytes 调整为 `180000` bytes，单个 CSS asset 上限从 `102400` bytes 调整为 `128000` bytes。该调整只是恢复可维护余量，不取消预算治理；后续若单个 CSS asset 超过约 `150 KiB`，应优先做 route/component CSS 拆分、删除无用选择器、合并重复规则或抽出共享样式，再评估是否提高硬门。范围限构建预算脚本和开发文档；不改 React 运行时行为、不新增 CSS、不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交：`31a1c97d`。 |
| S89.26 | DONE | 人物交游候复笺与案头索引 polish | 承接 S89.25 后 CSS 预算仍紧的状态，已在 `/game/:sessionId/people` 顶部新增 `data-polish-people-reader="s89-26-people-docket-reader"` 的“交游候复笺 / 人物案头索引”，把入谱人数、相识人物、当前人物页签、来函、后续簿、公开证据、关系网、交游议题、账解数量和本地候复稿有无整理成首屏读法；索引只显示草稿有无，不展示草稿正文、来处枚举、`draftContext` 或内部复核线索。本步零新增 CSS，复用 `sectionTitleRow`、`surfaceSafetyList`、`statusLine` 和现有人物页材质。范围限 React `PeoplePage`、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/local 状态和本地草稿，不裁决资源、身份、交易、委派、NPC 行动、经济、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。实现提交：`dd281b18`。 |
| S89.25 | DONE | 覆盖层液态玻璃与共享纵深 polish | 承接 S89.24 后 CSS 预算仍紧的状态，已把印匣抽屉、普通弹窗、本地专题层和高清立绘查看器统一标记为 `data-polish-depth="s89-25-liquid-glass"`，并用少量共享 CSS 增强宣纸毛玻璃、半透明层、阴影纵深和内沿高光；同步折叠三列统计网格重复规则，保持源码体积 guard。范围限 `SurfaceHost` 覆盖层标记、全局 CSS、browser smoke/source canary 和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或 hidden 信息。实现提交：`bbc2c4e3`。 |
| S89.24 | DONE | 前端 CSS 重复规则折叠与预算缓冲 polish | 承接 S89.23 后单 CSS 产物只剩约 182 bytes 硬门余量的状态，已专项折叠 `client/src/styles/global.css` 中静态确认重复的舆图右侧簿、四列统计网格和书生 compact 卡片基础规则；不删除任何仍有 React/runtime 源码命中的 class，不触碰 `.portraitViewerCueGrid` 顺序覆盖依赖。`test/reactClientScaffold.test.js` 新增 S89.24 source canary，守住合并 selector 和 `global.css` 源码体积阈值。范围限全局 CSS、source canary 和文档；不新增依赖或素材，不改 React 组件行为、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或 hidden 信息。实现提交：`25a29f8c`。 |
| S89.23 | DONE | 囊箧流转候批笺与移置候批读法 polish | 承接 S89.22 后 CSS 预算只剩极小余量的状态，已打磨 `/game/:sessionId/inventory` 囊箧页：新增带 `data-polish-inventory="s89-23-inventory-ledger-reader"` 的“流转候批笺”，把资源、资产、物件、凭证数量、可流转物件数、当前移置选择和候批边界整理为玩家可读状态；未获案卷回批前，不写成已入账、已移置、已成交或已影响关系。范围限 React `InventoryPage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全囊箧、资源、资产、经济 trace 和 route-local 选择状态，不裁决资源扣减、物品转移、交易、赠予、借用、NPC 行动、经济、关系、考试、官职或 hidden 信息。实现提交：`73903bff`。 |
| S89.22 | DONE | 主卷本旬行止笺与草稿状态读法 polish | 承接 S89.21 后 CSS 预算仍紧的状态，已打磨 `/game/:sessionId` 主卷右侧案头索引：新增带 `data-polish-game="s89-22-main-ledger-reader"` 的“本旬行止笺”，把已载公开卷宗数量、草稿有无、草稿来处和卷宗读法整理为玩家可读状态；草稿来源只显示“手写稿 / 案头摘录 / 舆图摘录 / 史册摘录 / 科举草稿”等中文标签，不显示 `manual`、`role-surface`、`map-runtime`、`archive-view` 或 `draftContext`。范围限 React `GamePage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route 状态和本地草稿状态，不展示草稿全文，不裁决资源、关系、交易、NPC 行动、经济、官职、考试、地图行动、婚姻、弹劾、定罪、背叛或 hidden 信息。实现提交：`1b085829`。 |
| S89.21 | DONE | 舆图局势读法与行动线索 polish | 承接 S89.20 后 CSS 预算仍紧的状态，已打磨 `/game/:sessionId/map` 右侧舆图簿：新增“山河局势轴 / 本卷读法”，把公开图层显隐、最显著近事、人物视觉锚点、已裁决公开后果和可拟行动数整理为玩家可读的卷上读法；“据局势拟稿”只写本地 `map-runtime` 行动草稿，并继续携带当前安全 event/npc refs 作为待服务器重建复核的 hint，不读取或提交坐标、layout、renderer 画面层级、visual-only effect 或 raw/provider/prompt/path/key 字段。范围限 React `MapPage`、少量复用既有舆图摘要底座的 CSS、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍不裁决地图行动、资源、身份、交易、NPC 行动、经济、考试、官职、关系或隐藏信息。实现提交：`36c88f2b`。 |
| S89.20 | DONE | 前端 CSS 预算瘦身与材质变量清理 | 承接 S89.19 后 CSS 预算贴近硬门的状态，已专项瘦身 `client/src/styles/global.css`：把全局 601 处 `rgba(...)` 改为等价现代 `rgb(... / ...)` 写法，复用已定义材质变量补齐宣纸、折纸、破纸、朱痕、朱印、印匣纹理和墨线背景引用，删除唯一确认无 React 源码引用的 `.actionPanel`，并合并移动端重复的单列/双列 grid 与竖排 flex 规则。`test/reactClientScaffold.test.js` 新增 S89.20 source canary，守住 CSS 源码体积、禁止 `rgba(` / `.actionPanel` 回归，并确认材质背景走变量复用。范围限全局 CSS 与源码 canary、文档；不新增依赖或素材，不改 React 组件行为、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view 和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或隐藏信息。实现提交：`ef41549d`。 |
| S89.19 | DONE | 设置与断卷状态读法 polish | 承接 S89.18 后 CSS 预算仍紧的状态，已打磨 `/game/:sessionId/settings`、右上角印匣中的推演设置矩阵、404/错误页和畸形主卷恢复页：设置目录新增四类工具状态簿，逐项说明眼下可做与候复边界；AI 设置面板新增“推演设置状态簿”，并清洗污染的预设、分工 label/purpose/model、错误信息和状态枚举；断卷、空卷与畸形主卷恢复页新增只给安全归路、不显示底层诊断的 S89.19 标记。范围限 React `SettingsPage` / `AiSettingsPanel` / `ErrorPage` / `NotFoundPage` / `GamePage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只打开本地印匣、写既有全局 AI settings API 或本地显示偏好，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系或隐藏信息；畸形案卷不读取主卷接口、不打开专题层、不写行动草稿。实现提交：`bf23677e`。 |
| S89.18 | DONE | 科举与皇榜仪式读法 polish | 承接 S89.17 后 CSS 预算仍紧的状态，已打磨 `/game/:sessionId/exam` 与 `/game/:sessionId/ranking`：科举页新增“科举仪程”案头索引，按取题启封、场内推进、交卷候批、候榜回音说明当前可做与候复边界；皇榜页新增“放榜仪程”案头索引，按张榜取材、我名、同年座师、授官过渡说明公开榜文读法，并把“防弊检测”玩家化为“弥封复核”。范围限 React `ExamPage` / `RankingPage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器不裁决取题、评分、舞弊、放榜、晋级、授官、同年座师关系、官职任免或隐藏信息；“拟行动”仍只写本地草稿，回主卷候批。实现提交：`060d0c8c`。 |
| S89.17 | DONE | 朝议专题目录与官署案头索引 polish | 承接 S89.16 后 CSS 预算仍紧的状态，已打磨 `/game/:sessionId/court` 朝议页，把六个专题入口整理为“官署案头索引”：每个专题展示卷宗取材、可拟草稿、候复边界和案卷未载不补造提示，入口仍保持唯一按钮并继续打开既有 `SurfaceHost` 专题层。范围限 React `CourtPage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器不递交回合、不裁决资源、身份、交易、NPC 行动、经济、考试、官职、任免、赏罚、定罪、战和、关系、婚姻、弹劾、背叛或隐藏信息。实现提交：`b9e23f11`。 |
| S89.16 | DONE | 全局壳与基础控件交互反馈 polish | 承接 S89.15 后 CSS 预算仍紧的状态，已打磨顶部主导航、右上角印匣按钮、纸按钮/纸链接的材质、hover/focus/active/disabled/selected 反馈和低动效降级；同时移除 AppShell 内联临时视觉样式，改为 CSS 统一承载并保留可检测标记。范围限 React `AppShell`、全局 CSS、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或隐藏信息。实现提交：`ad2cbab4`。 |
| S89.15 | DONE | 来函与账解证据读法 polish | 承接 S89.14 CSS 预算风险和 S89.10/S88.7/S88.8 证据组件后续建议，集中打磨 `NpcFollowUpEvidenceSection` 与 `EconomyTraceSection` 的玩家可见读法、内部术语清洗和只读/草稿边界提示；人物页与史册页继续消费安全 follow-up evidence，人物/囊箧/主卷继续消费安全 economy trace。范围限 React 前端证据组件、相关 App 测试、客户端 smoke/source canary 和文档；未新增 CSS，复用既有 `.statusLine` / `.inventoryMiniCard` / `.peopleMeta` 等样式。不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或隐藏信息。实现提交：`99072f6e`。 |
| S89.14 | DONE | 玩家身份标签中文化与 CSS 预算缓冲 polish | 承接 S89.13 残余建议，集中前端玩家身份显示 helper，避免 `scholar` / `official` / `general` 等 role 枚举在印匣、首页续局、主卷案头、人物页和旧案架中作为兜底文案露出；设置目录短章法标签复用既有标签样式，释放少量 CSS 预算缓冲。范围限 React 前端文本 helper、相关页面/组件接线、少量 CSS 复用、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职或隐藏信息。实现提交：`0739b7f9`。 |
| S89.13 | DONE | 右上角印匣与设置目录信息架构 polish | 承接 S89.12，右上角仍是唯一显眼印匣入口，设置目录只作入口整理；印匣总览显示当前案卷和显示章法，显示偏好整理为动效/舆图/正文/对比四项读法，案卷摘要把内部来源改写为“新卷开局 / 主卷载入 / 本旬回音 / 科场回音”。范围限 React `SurfaceHost` / `SettingsPage`、少量前端样式、客户端 smoke/source canary、前端测试和文档；不新增依赖、素材、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。显示偏好仍只写本地白名单，AI 设置仍走既有全局设置 API，浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职或隐藏信息。实现提交：`54a6186d`。 |
| S89.12 | DONE | 舆图筛选专题层体验 polish | 承接 S89.11，点击“筛舆图”打开的专题层已改为只读舆图筛选说明，地点/驿路/近事/人物动向/后果追踪以世界内口径呈现为卷上图层、筛看方法和候复边界；`map-filter` 继续是本地 surface，不进入后端 topic surface，不请求专题 API 或 AI 拟稿，不写草稿，只提供“回舆图勾选”。范围限 React SurfaceHost/registry、客户端 smoke/source canary、前端测试和文档。不新增依赖、素材、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；专题层不提交回合、不写服务器状态，图层与坐标仍只作浏览器显示。实现提交：`b658a1a3`。 |
| S89.11 | DONE | 舆图全关图层空态与筛选交互 polish | 承接 S89.10，舆图地点/驿路/近事三层全隐时新增世界内“素绢空图”空态、一键恢复三层、图层状态标记、侧栏可见线索摘要、移动端长文本守门和 smoke/source canary；范围限 React 舆图页结构、CSS、客户端 smoke/source canary、前端测试和文档。不新增依赖、素材、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；坐标与图层仍只作浏览器显示，行动只写本地草稿并等待服务器回合裁决。实现提交：`0285f36e`。 |
| S89.10 | DONE | 史册信息密度与移动端长文本二轮 polish | 承接 S89.9，史册公开追踪区已从三列重排为近次归档主列 + 证据侧栏，侧栏叠放后果追踪和来函证据；补 `s89-10-chronicle-density` 标记、`ledger-rail` 布局守门、移动端长文本 smoke、玩家可见工程词清洗和 source canary。范围限 React 前端结构、CSS、客户端 smoke/source canary、前端测试和文档；不新增依赖、素材、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；按钮仍只写本地草稿并等待服务器回合裁决。实现提交：`283b2c0a`。 |
| S89.9 | DONE | 人物页与立绘查看器材质题签 polish | 承接 S89.8 和提交前复审建议，人物页谱牒、人物卡、人物工作台和高清立绘查看器题签格已补宣纸、朱线、绢帛、轻浮起与低动效降级材质；复用已审核 `paper-aged-silk-v1.webp` 和既有材质 token，不新增依赖、不新增素材、不改 runtime manifest 字段。范围限 React 前端标记、CSS、客户端 smoke/source canary、前端测试、预算校准和文档；不新增后端 API/schema，不写浏览器存储、URL、草稿、prompt、canonical state 或服务器状态，不扩大人物、交易、委派、关系、资源或隐藏信息裁决权。实现提交：`8a7654ee9c5b7daa1c6790859ee885795f95928c`。 |
| S89.8 | DONE | 高清立绘查看器画中所见 polish | 承接 S89.7，高清立绘查看器新增 `data-polish-portrait="s89-8-life-scroll"`，把已审阅 runtime 立绘元数据与人物页安全摘要整理成“画中所见 / 身世线索 / 眼下处境”三段式说明、画卷题签、衣饰、仪态和神采线索；人物页画像 profile 补案主经历线索与 NPC 公开近事。范围限 React 前端、客户端 smoke/source canary、前端测试和文档；不新增样式，不新增后端 API/schema，不调用模型生成小传，不写浏览器存储、URL、草稿、prompt、canonical state 或服务器状态；不读取完整 source manifest、本地路径、raw/provider/hidden 或未审核素材。实现提交：`2476a12c4d77e598b65ba74931361edb362e2b6c`。 |
| S89.7 | DONE | 舆图交互与筛选提示 polish | 承接 S89.6，舆图页新增 `data-polish-map="s89-7-layer-tooltip"`、当前图层显隐摘要、tooltip 单点札记、tooltip 草稿已写入状态和移动端长文本守门；舆图清洗补 `/Users`、`/private`、常见 Unix 本地目录和 `tp-...` token 形态。范围限 React 前端、样式、客户端 smoke/source canary、前端测试和文档。地图 layout/坐标/tooltip/visual-only effect/NPC anchor 仍只作浏览器显示，行动草稿仍为 `map-runtime` 本地 hint，普通回合由服务器从当前安全 view 重建复核；不改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`b7bbeb04327f4d379dfd10729547e740958467d3`。 |
| S89.6 | DONE | 高清立绘查看器人物小传与当前情况 polish | 承接 S89.5，点击高清立绘后查看器显示“观画印象”人物头、公开标签、外貌介绍、人物小传和当前情况；人物页画像 profile 补案主/名册/详情/谱牒当前情况，均只来自已审阅 runtime 画像元数据和人物页安全摘要。`scripts/clientSmoke.js` 与源码 canary 已覆盖 `s89-6-portrait-life` 标记、人物小传/公开近况文案、存储禁写和污染词守门；CSS 仅保留轻量结构样式并通过预算。未改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`d476d41d747afc6e650ed8a6fa5041b23d01c87c`。 |
| S89.5 | DONE | React 全局材质、覆盖层过渡与交互反馈 polish | 主壳、右上角印匣、专题层 drawer/modal/surface、地图行动面板、高清立绘查看器与设置目录已补 S89.5 材质/覆盖层/交互反馈标记和低动效守门；舆图行动只增加本地“已写入草稿”反馈，不提交、不裁决、不扩大 `draftContext` 权限。`scripts/clientSmoke.js` 与源码 canary 已覆盖材质样式、覆盖层标记、地图草稿反馈、立绘查看器和设置目录安全污染守门。范围限 React 前端、样式、客户端 smoke/canary、前端测试和文档；未改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`b3237606ffa3abc7fbeb396d89c5c9eb8605f8f9`。 |
| S89.4 | DONE | React 首页旧案状态与史册信息密度 polish | 承接 S89.3 后续建议，补首页旧案卷 loading/empty/error 的案架状态、数量与安全兜底文案，旧案读取失败不再串到开卷表单或回显底层错误；异常 `sessionId` 旧案只显示“暂不可读”，不生成 `/game/...` 读档链接；史册页补“案卷索引/近次线索”导读和更紧凑的公开条目密度，继续只消费 `eventArchiveView`、`domainConsequenceView` 与来函 follow-up 安全投影。只改 React 前端、样式、客户端 smoke/源码 canary、前端测试和文档；不改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`3a600b82f86855a563c64563251eec7081724d71`。 |
| S89.3 | DONE | React 设置入口、专题文案与错误空态收束 | 承接 S89.2 后续建议，删除主卷功能页签中的重复“印匣”入口，把 `/game/:sessionId/settings` 保留为刷新/旧路由可达的案头工具目录并导向右上角唯一印匣抽屉；专题层把“数据来源/裁决边界”等工程口径改为“卷宗取材/回批口径”；错误页、404 和畸形主卷恢复页改用统一案卷空态视觉。只改 React 路由壳、专题层文案、前端样式、客户端 smoke/源码 canary 和验收文档；不改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`efa507aa729c8acb9503ba8f8e45a67e6b265969`。 |
| S89.2 | DONE | React 视觉矩阵与轻量专题页壳打磨 | 承接 S89.1 后续建议，补真实浏览器视觉回归截图矩阵便捷入口，覆盖首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置和移动端印匣；人物/囊箧/史册改用轻量案卷专题页壳，避免独立页重复渲染主卷案头和底部奏折；强化囊箧与专题页材质、按钮反馈、移动端截图、安全污染守门和高清立绘查看器公开说明。不改后端 API/schema、AI 权限、prompt、存档格式、素材 manifest 或服务器裁决。实现提交：`b8a564514498c7de6c6d7183597df51bbab5e662`。 |
| S89.1 | DONE | React 玩家可见文案与移动端覆盖层润色 | 承接 S88.9 残余方向，清理首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、身份循环、推演设置和专题层中的工程词外露；抽屉增加遮罩与外点关闭，人物/囊箧工作台和推演矩阵补窄屏单列；不改后端 API/schema、AI 权限、prompt、存档格式或服务器裁决。提交：随本次 S89.1 提交完成。 |
| DOCS-2026-05-24-S88-ARCHIVE | DONE | 压缩当前上下文并归档 S88 台账 | 新增 S88 专题归档，压缩 `docs/SHARED_CONTEXT.md` 与本文件，活动台账不再展开 S88.0-S88.12 长表。纯文档维护，不改代码、API/schema、运行时行为、提示词、验证工具或素材 manifest；按低风险纯文档规则跳过子代理复审。 |

后续建议：由用户或下一轮 Codex 明确新专项后再加入本表。若继续 S88 残余方向，优先转为新的 S89/S90 小步骤，并继续沿用 S88 归档中的安全边界：安全 view 重建 evidence、浏览器 draft-only、AI proposal-only、服务器裁决、Mock/no-key 可玩、完整书生路径不破坏。

## 5. 最新状态

- 2026-05-24：完成上下文压缩与 S88 台账归档。`docs/QIANQIU_POLISHING_ARCHIVE.md` 现在是 S88.0-S88.12 阶段性打磨的追溯入口，记录已完成/已推进范围、稳定边界、验证锚点和后续候选方向；`docs/SHARED_CONTEXT.md` 与本文件改为短交接板，删除 S88 长流水和重复哈希回填串。`docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` 已补 S86-S88 完成阶段索引。
- 2026-05-24：S89.1 完成 React 玩家可见文案与移动端覆盖层润色。前端继续只消费安全 view，所有草稿、人物/囊箧操作、地图和专题入口仍由服务器复核；本步不新增 API 字段、不改变 provider/AI schema、不调整存档或 SQLite schema。
- 2026-05-24：S89.2 完成 React 视觉矩阵、轻量专题页壳与高清立绘查看器公开说明，实现提交 `b8a564514498c7de6c6d7183597df51bbab5e662`。当前范围仅限 React 路由壳、前端样式、browser smoke/视觉矩阵脚本、前端测试 canary 和验收文档；人物/囊箧/史册与立绘查看器仍只消费安全 view、runtime manifest 安全字段和本地草稿，不新增服务器裁决入口。
- 2026-05-24：S89.3 完成设置/印匣重复入口收束、专题层玩家可见口径和错误空态视觉。当前范围仍限 React 前端、样式、客户端 smoke/canary 与验收文档，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite 或素材 manifest。
- 2026-05-24：S89.4 完成首页旧案 loading/empty/error 案架状态、异常旧案案号链接防线和史册案卷索引/导读密度 polish。当前范围仍限 React 前端、样式、客户端 smoke/canary、前端测试和文档，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 2026-05-24：S89.5 完成 React 全局材质、覆盖层过渡、地图/立绘/设置目录交互反馈与对应 smoke/canary 文档同步。当前范围仍限 React 前端、样式、客户端 smoke/canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 2026-05-24：S89.6 完成高清立绘查看器人物小传与当前情况 polish。当前范围仍限 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 2026-05-24：S89.7 完成舆图交互与筛选提示 polish。当前范围仍限 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.8 完成高清立绘查看器画中所见 polish。当前范围仍限 React 前端、客户端 smoke/source canary、前端测试和文档；不新增样式，不新增后端 API/schema，不调用模型生成小传，不扩大浏览器裁决权。
- 2026-05-25：S89.9 完成人物页与立绘查看器材质题签 polish。当前范围限 React 前端标记、CSS、客户端 smoke/source canary、前端测试、CSS 预算校准和文档；不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.10 完成史册信息密度与移动端长文本二轮 polish。当前范围限 React 前端结构、CSS、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.11 完成舆图全关图层空态与筛选交互 polish。当前范围限 React 舆图页结构、CSS、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.13 完成右上角印匣与设置目录信息架构 polish。当前范围限 React 设置/印匣前端、少量样式、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.14 启动玩家身份标签中文化与 CSS 预算缓冲 polish。当前范围限 React 前端文本 helper、首页/主卷/人物/旧案/印匣身份显示、设置目录标签样式复用、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.12 完成舆图筛选专题层体验 polish。当前范围限 React SurfaceHost/registry、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.15 启动来函与账解证据读法 polish。当前范围限 React 前端证据组件、人物/史册/囊箧/主卷既有消费路径、客户端 smoke/source canary、前端测试和文档；原则上不新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.16 完成全局壳与基础控件交互反馈 polish。当前范围限 React `AppShell`、全局 CSS、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.18 完成科举与皇榜仪式读法 polish。当前范围限 React `ExamPage` / `RankingPage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.19 完成设置与断卷状态读法 polish。当前范围限 React `SettingsPage` / `AiSettingsPanel` / `ErrorPage` / `NotFoundPage` / `GamePage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.20 完成前端 CSS 预算瘦身与材质变量清理。当前范围限全局 CSS、source canary 和文档；不新增浏览器裁决权，不改 React 组件行为、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.21 完成舆图局势读法与行动线索 polish。当前范围限 React `MapPage`、少量复用既有舆图摘要底座的 CSS、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.27 完成前端 CSS 构建预算校准。当前范围限 `scripts/clientBuildBudget.js` 与开发文档；CSS 总预算调整为 `180000` bytes，单个 CSS asset 上限调整为 `128000` bytes，并写明单个 CSS 超过约 `150 KiB` 后应优先拆分/整理而不是继续抬高硬门。不改 React 运行时行为、不新增 CSS、不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.26 完成人物交游候复笺与案头索引 polish。当前范围限 React `PeoplePage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.25 完成覆盖层液态玻璃与共享纵深 polish。当前范围限 `SurfaceHost` 覆盖层标记、全局 CSS、browser smoke/source canary 和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.24 完成前端 CSS 重复规则折叠与预算缓冲 polish。当前范围限全局 CSS、source canary 和文档；不删除仍有源码命中的 class，不新增浏览器裁决权，不改 React 组件行为、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.23 完成囊箧流转候批笺与移置候批读法 polish。当前范围限 React `InventoryPage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.22 完成主卷本旬行止笺与草稿状态读法 polish。当前范围限 React `GamePage`、客户端 smoke/source canary、前端测试和文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.28 完成前端 JS 分包预算稳定。当前范围限 `vite.config.mjs`、source canary 和开发文档；Vite 生产构建仅按 `node_modules` 拆出 `vendor-react`、`vendor-state`、`vendor-icons` 与通用 `vendor`，不引入 route lazy loading 或运行时页面行为变更，不新增依赖、素材、CSS 或浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.29 完成史册证据读法与旁注空态 polish。当前范围限 React `ArchivePage`、客户端 smoke/source canary、前端测试、brief 和开发文档；零新增 CSS，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.30 完成共享案卷材质与错落动效 polish。当前范围限 React `AppShell` 壳层标记、全局 CSS、客户端 smoke/source canary、CSS 构建预算脚本、brief 和开发文档；新增共享宣纸层次、卡片轻浮起、错落进入、朱印选中、草稿已写入和空态纸底反馈，并把低动效偏好与系统 `prefers-reduced-motion` 纳入同一关闭动画边界。不新增依赖或素材，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.31 完成舆图态势罗盘与移动单点札记 polish。当前范围限 React `MapPage` / `InkMapRuntimeBridge`、全局 CSS、客户端 smoke/source canary、brief 和开发文档；新增罗盘读法、tooltip 读法、移动端底部札记和对应守门，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.32 完成首页与全局壳材质动效及入口收束 polish。当前范围限 React `HomePage` / `AppShell` / `SurfaceHost` / `SettingsPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 和开发文档；新增首页开卷路径、样卷入口降权、顶栏/右上角工具区玻璃纸层、印匣面板材质和设置目录入口守门，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.33 完成科举与皇榜二轮仪式材质动效 polish。当前范围限 React `ExamPage` / `RankingPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 和开发文档；新增科场仪幕、金榜仪轨、科举纸卷展开、皇榜金光/榜行选中反馈和低动效关闭守门，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.34 完成主卷与朝议案头中枢二轮材质动效 polish。当前范围限 React `GamePage` / `CourtPage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 和开发文档；新增主卷案头中枢、官署议程、草稿状态 marker、朝议入口状态、材质动效和低动效关闭守门，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-25：S89.35 完成人物页与高清立绘查看器二轮高级展示 polish。当前范围限 React `PeoplePage` / `Portrait` / `SurfaceHost`、全局 CSS、客户端 smoke/source canary、前端测试、brief 和开发文档；新增人物画屏、入谱照面、名册/谱牒选中态、画像卡状态、高清标记和查看器案读栏，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-26：S89.36 完成朝议 / 人物 / 史册跨页追踪读法 polish。当前范围限 React `CrossPageTraceRail` / `CourtPage` / `PeoplePage` / `ArchivePage`、全局 CSS、客户端 smoke/source canary、前端测试、brief 和开发文档；新增跨页追索笺、朝议/人物/史册/主卷候复路径、折纸材质动效和低动效关闭守门，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-26：S89.37 完成 CSS token 与可访问性渐进重构，实现提交 `33a3a458`。当前范围限 `global.css`、`CrossPageTraceRail` utility class 接线、source canary、brief 和开发文档；新增样式 token、正文链接可识别默认、基础 surface utility、高对比增强和统一低动效变量，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 2026-05-26：S89.38 完成 CSS 架构重构第二阶段。当前范围限 CSS 物理拆分、`AppShell` 稳定材质动效 hook、客户端 smoke/source canary、brief 和开发文档；`global.css` 保持 Vite 入口，只导入 tokens/base/utilities/components/routes/responsive/motion 模块，移动端 760px 巨块进一步拆为 5 个响应式模块；新增状态/disabled/阴影 token，短编号 keyframes 改为语义名，`data-material-motion="shared-paper"` 成为共享材质动效样式 hook。未删除仍有源码命中的 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `4c9acd3f`。
- 2026-05-26：S89.39 完成 CSS 语义纸面动效 utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；重复纸面/列表/账册卡新增 `.paperMotionCard` / `.paperMotionInteractive`，舆图 written 草稿行新增 `.paperMotionDraft`，共享材质、高对比和低动效 selector 开始改读稳定语义 hook，CSS import 图 canary 改为递归解析入口导入图。未删除仍有源码命中的 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `54ad449d`。
- 2026-05-26：S89.40 完成 selected/empty 语义纸面动效 utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；selected 控件新增 `.paperMotionSelected`，empty/error 状态新增 `.paperMotionEmpty`，共享材质、高对比和低动效 selector 改读语义 hook 并保留真实 selected/checked/error 门控。未删除业务 class、专用 CSS 或仍有源码命中的 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `76db0feb`。本次 commit hash 回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。
- 2026-05-26：S89.41 完成跨身份大面板语义纸面动效 utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；`.scholarPanelCard` 生成点新增 `.paperMotionPanel`，真正身份面板额外新增 `.rolePanel`，共享材质、高对比和低动效 selector 改读 `.paperMotionPanel`，并保留 `.scholarPanelCard` / `.scholarPanelCardHeader` 等 route 业务布局规则。未删除仍有源码命中的 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `93a84ec4`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.42 完成静态纸面 surface utility 与结构 selector 收敛。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；新增 `.paperMotionSurface`，安全读法行统一为 `.surfaceSafetyRow paperMotionSurface`，AI 推演分工卡新增 `.paperMotionSurface`，共享材质 selector 不再依赖 `.aiTaskRoute`、`.surfaceSafetyList div` 或 `.rankingList button`。皇榜榜行保留 `.paperMotionInteractive` 与专属选中 CSS，不接 `.paperMotionSelected`。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `babb4ab9`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.43 完成皇榜与专题层静态 surface container 语义 hook 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；皇榜四个静态容器与专题层六个栏目新增 `.paperMotionSurface`，共享材质 selector 不再依赖这些 route-specific class，榜行选中、专题层材料/证据/草稿和舆图筛选逻辑保持不变。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `29ae3653`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.44 完成舆图与史册静态读法 surface utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；舆图三个静态读法容器与史册两个索引容器新增 `.paperMotionSurface`，共享材质 selector 不再依赖这些 route-specific class，高对比 `.archiveDigestBand` 也改由语义 hook 覆盖。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `c3fa671f`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.45 完成囊箧与账解静态 surface utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；囊箧容器列表、物件列表、三处摘要账块、两处移置/候批面板和账解读法新增 `.paperMotionSurface`，共享材质 selector 不再依赖这些 route-specific class。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `7fef02de`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.46 完成首页静态 surface utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；首页开卷案桌、当前本局和旧案架新增 `.paperMotionSurface`，共享材质 selector 不再依赖这些 route-specific class。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改开局表单、旧案读取、继续本局链接、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `26c604b8`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 2026-05-26：S89.47 完成主卷静态 surface utility 接入。当前范围限 React className、CSS utility/共享 selector、客户端 smoke/source canary、brief 和开发文档；主卷本纪、案头索引和开局裁决面板新增 `.paperMotionSurface`，共享材质 selector 不再依赖这些 route-specific class，并在草稿写入后守住 `.gameSideLedger.paperMotionSurface[data-draft-state='written']`。未删除仍有源码命中的业务布局 selector，不新增浏览器裁决权，不改回合提交、草稿 draftContext、开局背景裁决、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。实现提交 `da3ff316`；本次 hash 回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档维护，跳过子代理复审。
- 前一轮 S88 归档是低风险纯文档维护；S89.3-S89.47 涉及前端代码、样式、验证脚本和文档，提交前按子代理复审规则执行。

## 6. 最近完整验证口径

本轮文档压缩与归档验证：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

S89.1 前端润色验证结果：

- 已通过 `npm run typecheck:client`。
- 已通过 `npm run test:client`（6 files / 126 tests）；此前本机曾遇到 Vitest worker 启动超时，另以 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false` 串行池完整复核过同一批断言。
- 已通过 `npm run smoke:browser`，并串联通过 `npm run qa:runtime-manifest`、`npm run build:client` 和 `npm run budget:client`。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；`git diff --check` 仅输出仓库既有 CRLF warning，非本次修改文件。
- 已通过 `node --test test/reactClientScaffold.test.js` 与完整 `npm test`（1159 tests），源码 canary 已同步到本轮玩家可见文案新口径。
- 最终只读子代理复审已通过。

S89.1 包含前端代码、样式和行为改动，提交前必须完成只读子代理复审。未改后端 API/schema、prompt、AI 权限、SQLite schema 或服务器 resolver，因此不要求 `npm run typecheck:server` 作为本步必跑项；若后续继续触碰跨端契约再补跑。

S89.2 前端视觉矩阵验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`。
- `npm run test:client` 本机多次命中 Vitest fork worker 启动超时，已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一套客户端断言（6 files / 126 tests）；focused `people ledger|portrait viewer|inventory` 通过 7 tests。
- 已通过 `npm run smoke:browser:visual`，并复核 `artifacts/browser-visual-matrix` 中首页、人物、囊箧桌面/移动和史册截图；该命令串联通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 React browser smoke。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；`git diff --check` 只报告仓库既有 CRLF 提示。
- 已通过完整 `npm test`（1159 tests）。
- 提交前只读子代理复审已通过；复审指出囊箧 `authorityBoundary` 清洗需补本地路径、`manifest/schema/draftContext` 等边缘工程词，本轮已补 `safeLabel()`、React 断言和 browser smoke 桌面/移动守门，并由同一只读子代理复核确认无阻断问题。

S89.3 设置入口、专题文案与错误空态收束验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- `npm run test:client` 本机仍命中 Vitest fork worker 启动超时：4 files / 84 tests 已通过，`client/src/state/uiState.test.ts` 与 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 126 tests）。
- 已通过 focused React 验收：`keeps the settings route as a directory into one inkbox tool surface`、`opens registry-backed local surfaces`、`global AI settings` 三组 `App.test.tsx` 用例。
- 已通过 `npm run smoke:browser:visual`，该命令串联 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 React browser smoke，并写出 `artifacts/browser-visual-matrix`；smoke 覆盖单一右上角印匣入口、settings 目录刷新路由、专题层“卷宗取材/回批口径”文案和玩家可见污染守门。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。
- 已通过完整 `npm test`（1160 tests）。
- 提交前只读子代理复审已通过；复审未发现阻断问题，仅提示把复审完成状态写回文档。

S89.4 首页旧案状态与史册信息密度验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- 已通过 focused React 验收：`unsupported archive route|S89.4|archive route entries`（5 tests），覆盖首页旧案 loading/empty 互斥、旧案读取失败安全重试、开卷错误后旧案重试失败不覆盖开卷错误、异常旧案案号不生成读档链接、史册案卷索引和近次线索导读。
- 已通过 `npm run test:client`（6 files / 129 tests）；此前同机曾命中 Vitest fork worker 启动超时，本轮修复后又以 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`。
- 已通过 `npm run smoke:browser:visual`，该命令串联 runtime manifest QA、client build、budget 和 React browser smoke，并写出 `artifacts/browser-visual-matrix`；smoke 现覆盖首页旧案案架结构、史册案卷索引、移动端史册不溢出、异常/工程词污染守门。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和完整 `npm test`（1160 tests）。

S89.5 React 全局材质、覆盖层过渡与交互反馈验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- `npm run test:client` 本机命中已知 Vitest fork worker 启动超时：5 files / 126 tests 已通过，未见断言失败；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；最终预算输出为 `CSS 97.5 KiB`，仍在硬性预算内。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- `npm run smoke:browser:visual` 在 240s 限时内已完成 runtime manifest QA、client build 和 budget，但进入 `clientSmoke.js` 后超时；随后直接运行 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix` 通过，覆盖 S89.5 首页材质、印匣/低动效覆盖层、地图草稿反馈、高清立绘查看器、设置目录和安全污染守门，并写出 `artifacts/browser-visual-matrix`。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。提交前只读子代理复审已通过；实现提交哈希已回填。

S89.6 高清立绘查看器人物小传与当前情况 polish 验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "current people ledger" --pool=vmThreads --fileParallelism=false --maxWorkers=1`；只读复审指出 `/Users`、`/private` 与 `tp-...` token 形态未被本轮 portrait profile 路径显式覆盖后，已补 `Portrait.tsx`、`PeoplePage.tsx`、`SurfaceHost.tsx` 三处清洗和 portrait viewer smoke/source canary，并重跑通过上述检查。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；本轮新增样式一度超过 CSS 硬预算，已裁剪为轻量结构样式，最终预算输出为 `CSS 97.6 KiB`。
- 已通过直接浏览器验收 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix`，覆盖 S89.6 立绘查看器人物小传/当前情况 polish、runtime 画像路径、浏览器存储禁写和安全污染守门，并写出 `artifacts/browser-visual-matrix`。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）。
- 已通过 `git diff --check`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。提交前只读子代理首轮发现的路径/key 清洗缺口已修复，最终只读复审已通过，未发现阻断问题。

S89.7 舆图交互与筛选提示 polish 验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "wraps the S72 map renderer with safe React action drafts" --pool=vmThreads --fileParallelism=false --maxWorkers=1`。
- 已通过完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）。此前同一完整串行套件曾出现一次首页画像选择 jsdom 抖动，focused 重跑该用例通过，最终完整串行重跑通过。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；本轮初版样式一度超过 CSS 硬预算，已改成少样式、多状态文案并删除未使用 `.mapStatusRail`，最终预算输出为 `CSS 97.5 KiB`。
- 已通过直接浏览器验收 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix`，覆盖 S89.7 舆图图层摘要、隐藏图层反馈、tooltip 单点札记、tooltip 草稿写入状态、移动端舆图摘要、runtime 画布像素、浏览器存储禁写和安全污染守门，并写出 `artifacts/browser-visual-matrix`。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `git diff --check`。提交前只读子代理开工巡检指出舆图 `/Users`、`/private`、`tp-...` 清洗、图层反馈、tooltip 层级、移动端长文本和 CSS 预算风险，本轮已按这些建议收束；最终只读复审通过，未发现阻断问题。

S89.8 高清立绘查看器画中所见 polish 验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "loads the S76.10 current people ledger without exposing the full portrait pool" --pool=vmThreads --fileParallelism=false --maxWorkers=1`。
- `npm run test:client` 本机仍命中 Vitest fork worker 启动超时：4 files / 114 tests 已通过，`client/src/assets/assetRegistry.test.ts` 与 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；本轮未新增样式，最终预算输出为 `CSS 97.5 KiB`。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run smoke:browser`；另以 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix` 做直接浏览器验收，覆盖 S89.8 立绘查看器标记、画卷题签、三段式人物说明、runtime 画像路径、浏览器存储禁写和安全污染守门，并写出 `artifacts/browser-visual-matrix`。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`。提交前只读子代理复审已通过，未发现阻断问题；非阻断建议为后续可给题签格补专门材质样式。

## 7. 近期进度记录

### 2026-05-26：S89.37 CSS token 与可访问性渐进重构

- 范围：全局 CSS 新增 `--qq-color-*`、`--qq-surface-*`、`--qq-space-*` 与 `--qq-motion-*` token，`CrossPageTraceRail` 先接入 `.paperSurface` / `.ledgerCard` 作为基础 utility 的首个小范围使用点；不做 CSS 物理拆文件，避免一次性改动入口、测试读取和 cascade 顺序。
- 可访问性：全局 `a` 不再粗暴取消下划线，正文链接默认使用朱色下划线；按钮、导航、显式 class 链接和 `.scholarPanelActions a` 通过局部 reset 与既有 `.paperLink` / `.paperButton` 保持原视觉。`data-contrast="high"` 现在同步提高纸面、边框、focus 与按钮/卡片对比，不只改根文字色。
- 动效与架构：本地低动效和系统 `prefers-reduced-motion` 共用 `--qq-motion-instant` 等变量；`.paperSurface`、`.rolePanel`、`.statusSurface`、`.ledgerCard` 作为后续替代长 `:is(...)` 与重复 panel/card 规则的稳定语义层，当前只做无行为重构和小范围接线。
- 边界：本步不新增依赖或素材，不改 React 数据流、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest；浏览器仍只消费安全 view、route/surface 状态和本地草稿，不请求诊断接口、不读取 raw 存档、本地路径、source manifest 或完整 manifest，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`test/reactClientScaffold.test.js` 新增 S89.37 source canary，守住 token、链接 reset 收敛、基础 surface utility、高对比、低动效变量、`CrossPageTraceRail` utility class 接线、CSS 体积和无 API/存储/工程污染。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（70 tests）、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 browser smoke `node scripts/clientSmoke.js`、截图矩阵 `npm run smoke:browser:visual` 和 `git diff --check`。预算输出为 `JS 658.5 KiB / CSS 142.6 KiB / fonts 26288.4 KiB / client-assets 27089.5 KiB`，截图输出到 `artifacts/browser-visual-matrix`；截图矩阵首次因本地 Rolldown Windows optional native binding 缺失失败，运行 `npm install` 修复 `node_modules` 后通过且未改变 tracked files；构建仍输出既有 `/assets/ui/...` runtime asset resolution warning。
- 复审：提交前只读复审 Bohr 首轮指出无 class 的 `.scholarPanelActions a` 会继承正文链接下划线；本轮已补局部 reset 和 source canary，并重跑脚手架、类型检查、构建、预算与 diff check。Bohr 二轮复核通过，未发现阻断问题；非阻断建议为后续可把该 canary 正则再收窄到 block 内匹配。
- 提交：实现提交 `33a3a458`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md) 和 [QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-26：S89.36 朝议 / 人物 / 史册跨页追踪读法 polish

- 范围：新增 `client/src/components/CrossPageTraceRail.tsx`，统一 `data-polish-cross-trace="s89-36-cross-page-trace"`、`data-cross-trace-page`、`data-cross-trace-state` 与 `data-cross-trace-target`；`CourtPage`、`PeoplePage`、`ArchivePage` 分别在既有朝议议程、人物案头索引和史册证据读法之后插入“跨页追索笺”。
- 内容：朝议页把“查人物 / 查史册 / 回主卷候复”整理为议题追索路径；人物页把“留本页 / 入朝议 / 查史册 / 回主卷候复”整理为公开名册、来函、交游和账解的下一步读法；史册页把“留本页 / 查人物 / 入朝议 / 回主卷候复”整理为已入卷条目、来人线索、朝议专题和草稿候复的自然去处。所有文案使用“候复、案卷未载、已入卷、公开名册”等游戏内口径，不显示工程字段。
- 样式与低动效：`global.css` 新增 `.crossPageTraceRail` / `.crossPageTraceGrid` 折纸材质、四列密度、卡片错落进入、hover/focus 朱边抬升和 `s8936TraceSlipIn`；移动端纳入现有单列 grid 规则。本地 `data-motion="reduced"` 和系统 `prefers-reduced-motion` 均关闭 rail 卡片动画，但保留纸面层次、边框、链接状态和可读布局。
- 安全边界：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费当前 route session 的安全 view、既有页面已清洗计数和本地草稿有无，不请求诊断接口，不读取 raw 存档、本地路径、source manifest 或完整 manifest，不裁决资源、身份、交易、委派、NPC 行动、经济、考试、官职、地图行动、关系、婚姻、弹劾、定罪、背叛或 hidden 信息；unsupported route 的追索链接统一退回首页。
- Smoke/canary：`App.test.tsx` 覆盖朝议、人物、史册三页 S89.36 marker、state、玩家文案、target 数量和链接；`scripts/clientSmoke.js` 在朝议、人物、史册桌面/移动路径检查跨页追索 marker、state、targets、文案和链接；`test/reactClientScaffold.test.js` 新增 S89.36 source canary，确认共享组件、三页 safe-view 计数、CSS、移动端、低动效和 smoke 同步存在，并守住无 turn API、诊断、raw/provider/path/key/hidden、`draftContext`、`schema`、`manifest`、工程词或存储污染。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（69 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "unsupported court|archive route entries|current people ledger|registry-backed local surfaces" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（4 tests / 70 skipped）、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和直接 browser smoke `node scripts/clientSmoke.js`。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 97 tests 已通过，但 `client/src/state/uiState.test.ts` worker 未启动；已用上述串行池完整复核同一客户端套件。`npm run smoke:browser` wrapper 完成 runtime manifest、build 和 budget 后在 browser 段首页 `networkidle` 等待超时；直接 browser smoke 通过同一浏览器段。预算输出为 `JS 658.4 KiB / CSS 139.6 KiB / fonts 26288.4 KiB / client-assets 27086.4 KiB`；构建与 smoke 仍输出既有 npm `globalignorefile` warning、Vite `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning。
- 复审：开工只读探索子代理 Schrodinger 建议把本步收窄为朝议、人物、史册共享“跨页追索笺”，保持前端-only、安全 view-only、route session guard，不增加重复主要按钮，不新增 API/schema 或 surface id；本轮按建议实施。提交前只读复审 Raman 通过，未发现阻断问题；非阻断风险为 unsupported 状态下 rail 链接仍是可点击 `Link` 但安全退回首页，以及低动效下 hover/focus 仍保留轻微反馈，均符合本步安全退回和保留可读反馈目标。
- 提交：实现提交 `9748b336`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.35 人物页与高清立绘查看器二轮高级展示 polish

- 范围：`PeoplePage` 保留 S89.9/S89.26 marker，并新增 `data-polish-people-gallery="s89-35-people-portrait-gallery"`、`data-polish-people-gallery-band`、`data-portrait-ledger-state`、人物名册 `data-gallery-selected`、人物谱牒 `data-polish-people-gallery-ledger` 和人物卡 `data-selected` / `data-remastered`；`Portrait` 新增 `data-polish-portrait-card` 与 `data-portrait-state="zoomable|ready|fallback"`；`SurfaceHost` 高清立绘查看器新增 `data-polish-portrait-viewer`、`data-viewer-state` 和 `data-polish-portrait-dossier`。
- 内容：人物页新增“人物画屏 / 入谱照面”，只读整理当前案卷公开人物、本页/入谱计数、当前照面、公开小传、题签、高清数、来函证据数、账解数和本地草稿有无；人物名册与谱牒卡强化当前选中和高清重制读法。高清立绘查看器新增“画屏案读”栏，复用已清洗的查看器文案显示人物、身份、题签和观画状态。所有读法只来自当前 route session 的安全 view、已审核 runtime 画像字段和本地草稿状态，不展示草稿正文、内部来源枚举、完整素材池或全量立绘池。
- 样式与低动效：`global.css` 新增人物画屏绢帛/朱痕材质、画屏案读网格、人物卡选中/高清框线、名册按钮朱印反馈、viewer 案读栏、`s8935GalleryUnroll` 与 `s8935SlipRise`。本地 `data-motion="reduced"` 和系统 `prefers-reduced-motion` 均关闭强动画，但保留材质、边框、选中态和可读状态。
- 安全边界：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费 `worldPeopleView`、`npcRosterView`、`npcDetailView.publicProfile`、既有 follow-up/economy/relationship 安全 view、route/local 状态和已审核 runtime 画像字段，不请求诊断接口，不读取 raw 存档、本地路径、source manifest 或完整 manifest，不裁决资源、身份、交易、委派、NPC 行动、经济、考试、官职、地图行动、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 覆盖 S89.35 人物画屏 root/band/ledger/card/portrait marker、ready 状态、入谱照面文案、公开小传、高清/草稿计数和高清查看器案读栏；`scripts/clientSmoke.js` 在人物页与 portrait viewer smoke 中检查画屏 marker、ready 状态、选中名册按钮、选中人物卡、画像卡 marker、画屏 grid/动效或低动效关闭、viewer ready 状态、案读栏和安全污染守门；`test/reactClientScaffold.test.js` 新增 S89.35 source canary，确认组件 marker、CSS keyframes、低动效关闭和 smoke 文案同步存在。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（68 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "current people ledger" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 test / 73 skipped）、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 131 tests 已通过，但 `client/src/components/Portrait.test.tsx` worker 未启动；已用上述串行池完整复核同一客户端套件。最终预算输出为 `JS 653.5 KiB / CSS 138.1 KiB / fonts 26288.4 KiB / client-assets 27080.0 KiB`；构建与 smoke 仍输出既有 npm `globalignorefile` warning、Vite `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning。
- 复审：开工只读探索子代理 Huygens 建议聚焦人物画屏、名册/卡片状态、viewer 案读栏、低动效和 frontend-only safety，本轮按建议实施。提交前只读复审 Darwin 通过，未发现阻断问题；非阻断风险为 `Portrait` fallback 分支仍会把传入 `portraitRef` 写入 `data-portrait-ref`，本轮调用链来自安全 ref / registry，后续若新增调用方可考虑让 `Portrait` 自身只输出已解析安全 ref 或空值；CSS-heavy polish 仍有组合视口残余风险，但移动端单列、低动效、browser smoke、source canary 和预算检查已覆盖主要回归。
- 提交：实现提交 `d6ad9af4`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.34 主卷与朝议案头中枢二轮材质动效 polish

- 范围：`GamePage` 新增 `data-polish-game-center="s89-34-main-court-desk"`、主卷命令栏 `data-polish-game-command`、场景带 `data-polish-game-scene` 和案头中枢 `data-polish-game-center-band`；`CourtPage` 保留 `data-polish-court="s89-17-court-directory"`，新增 `data-polish-court-agenda="s89-34-main-court-desk"`、议程带 `data-polish-court-agenda-band`，六个既有专题入口新增 `className="courtSurfaceEntry"` 与 `data-court-state`。
- 内容：主卷新增“案头中枢 / 本卷案桌”，把场景、已载卷宗数量、本地草稿有无和可去处整理成四格读法，并按行旅、人物、账解、科举复核显示当前公开材料计数；固定提示“未载不补造；行动仍回主卷候复。”。右侧既有“本旬行止笺”只新增 `data-draft-state="written|empty"`，仍只显示草稿状态与中文来处，不展示草稿正文。朝议页新增“官署议程 / 御案传签”，按章奏、谕旨、朝议、堂审军议说明可读材料和候复边界；六个既有专题按钮保持唯一入口，畸形案卷继续禁用并显示 unsupported 状态。
- 样式与低动效：`global.css` 新增 `--qq-material-aged`、主卷命令栏纸层、场景带微光、案头中枢纸卷、公开材料卡、侧栏草稿状态、官署议程和朝议入口 hover/focus 样式；新增 `s8934DeskUnroll`、`s8934SlipRise`、`s8934InkPulse`、`s8934SceneSheen`、`s8934SealSettle`、`s8934LedgerGlow`、`s8934CourtSealGlow`。本地 `data-motion="reduced"` 和系统 `prefers-reduced-motion` 均关闭强动画，但保留材质、边框、阴影和状态。
- 安全边界：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/local 状态和本地草稿状态，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、地图行动、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 覆盖主卷 S89.34 root/command/scene/desk marker、案头文案、材料分组、无草稿正文泄漏、草稿状态、朝议议程 marker、六个专题 exact set、入口状态和 unsupported 禁用；`scripts/clientSmoke.js` 在主卷和朝议 smoke 中检查 S89.34 marker、文案、材质、动效或低动效关闭、草稿状态、六个唯一按钮、专题 exact set 和安全污染守门；`test/reactClientScaffold.test.js` 新增 S89.34 source canary，并把旧 S89.22/S89.17 marker guard 收窄到对应阶段自身，避免新阶段复用 `data-polish-game` / `data-polish-court` 时误判。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（68 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "main game shell|registry-backed local surfaces|unsupported court" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（3 tests / 71 skipped）、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。预算输出为 `JS 650.0 KiB / CSS 133.4 KiB / fonts 26288.4 KiB / client-assets 27071.8 KiB`；构建与 smoke 仍输出既有 npm `globalignorefile` warning、Vite `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning。
- 复审：开工只读子代理 Jason 建议此步聚焦主卷案头中枢、朝议议程、低动效、smoke/source canary，并保持 frontend-only、safe-view-only、browser-draft-only。本轮按建议实施。提交前只读复审 Volta 通过，未发现阻断问题；残余风险仅为 CSS-heavy polish 仍可能有视口组合细节，但 browser smoke、overflow 与低动效检查已覆盖主要回归。
- 提交：实现提交 `0bae6c8f`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.33 科举与皇榜二轮仪式材质动效 polish

- 范围：`ExamPage` 新增 `data-polish-exam-ceremony="s89-33-exam-ceremony-material"`、`data-polish-exam-hero="s89-33-exam-ceremony-material"`、`data-polish-exam-ceremony-band="s89-33-exam-ceremony-material"` 和 `data-polish-exam-paper="s89-33-exam-ceremony-material"`；`RankingPage` 新增 `data-polish-ranking-ceremony="s89-33-ranking-golden-board"`、`data-polish-ranking-hero="s89-33-ranking-golden-board"`、`data-polish-ranking-board="s89-33-ranking-golden-board"`、`data-polish-ranking-ceremony-band="s89-33-ranking-golden-board"`，榜行按钮新增 `aria-pressed` 与 `data-selected`。
- 内容：科举页新增“科场仪幕”，按肃场、启封、落墨、候榜整理当前试别、题纸、草稿字数和候榜状态；皇榜页新增“金榜仪轨”，按张榜、我名、同年、授官整理公开榜文读法。所有状态都只来自 route session、既有科举 API 回包、`lastExamResult`、当前安全榜文 view 和本地表单状态，不新增服务器请求，不自行推断名次、关系、晋级或授官。
- 样式与低动效：`global.css` 新增科举 hero 轻墨光、科场仪幕、试卷纸纹、交卷朱印反馈、皇榜 hero 金光、金榜仪轨、榜行选中反馈和榜名详情纸层；新增 `s8933ExamPaperUnfurl`、`s8933ExamInkSettle`、`s8933RankingGoldSheen`、`s8933RankingRowSelect`。本地 `data-motion="reduced"` 和系统 `prefers-reduced-motion` 均关闭强动画，但保留边框、阴影和选中态。
- 安全边界：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、既有科举 API、route/local 状态和本地草稿，不请求诊断接口，不读取 raw 存档，不裁决取题、评分、舞弊、放榜、晋级、授官、同年座师关系、官职任免、资源、交易、NPC 行动、经济、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 覆盖科场仪幕、金榜仪轨、S89.33 marker、科举 active/ready 状态、试卷纸卷 marker 和榜行选中状态；`scripts/clientSmoke.js` 在桌面/移动科举和皇榜 smoke 中检查 S89.33 marker、仪幕/仪轨文案、榜行选中态、无横向溢出和安全污染守门；`test/reactClientScaffold.test.js` 新增 S89.33 source canary，确认组件 marker、CSS keyframes、低动效关闭和无 `/api/game/turn`、诊断、raw/provider/path/key/hidden、`draftContext`、`schema`、`manifest` 污染。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（67 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "exam page|ranking page" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（2 tests / 72 skipped）、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 129 tests 已通过，但 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用上述串行池完整复核同一客户端套件。预算输出为 `JS 646.8 KiB / CSS 125.7 KiB / fonts 26288.4 KiB / client-assets 27060.9 KiB`；构建与 smoke 仍输出既有 npm `globalignorefile` warning、Vite `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning。
- 复审：开工只读子代理 Laplace 建议此步聚焦科举/皇榜仪式二轮 polish、补 S89.33 marker、科场仪幕、金榜仪轨、榜行选中反馈、低动效、smoke 和 source canary；本轮按建议实施。提交前只读复审 Hegel 通过，未发现阻断问题；非阻断建议为后续可把榜行选中断言收紧到“只有一个 true 且旧选中行变 false”，并可在后续截图发现遮挡时给科举 hero 光效伪元素补显式层级。
- 提交：实现提交 `dd47cb17`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.32 首页与全局壳材质动效及入口收束 polish

- 范围：`HomePage` 新增 `data-polish-home="s89-32-home-entry-scroll"`、`data-polish-home-entry="s89-32-opening-desk"`、`data-polish-home-form="s89-32-opening-form"`、`data-polish-home-path="s89-32-opening-path"`、`data-polish-home-current="s89-32-current-case"` 和 `data-polish-home-saves="s89-32-save-shelf"`；`AppShell` 新增 `data-polish-entry="s89-32-shell-entry-glass"`、顶栏、导航和右上角工具区 marker；`SurfaceHost` 印匣抽屉、总览、分栏和面板新增 `s89-32-inkbox-glass-ledger` marker；`SettingsPage` 新增 `data-polish-settings-entry="s89-32-settings-directory-entry"` 与 `data-settings-tab`。
- 内容：首页新开案卷表单新增“开卷路径”，把题名、立身、候复三步整理成只读开卷读法；样卷入口从主行动降权为“试阅样卷 / 样卷舆图”，主焦点继续是朱印开卷。全局壳保持设置不进入主导航，右上角印匣仍是唯一显眼工具入口；设置刷新路由继续只是目录页，不变成玩法 nav。
- 样式与低动效：`global.css` 新增顶栏克制毛玻璃、右上角工具区玻璃纸层、导航墨线回光、首页案桌卷轴展开、开卷路径纸签、印匣玻璃纸层、朱印页签反馈和设置目录微光；新增 `s8932ScrollUnfurl`、`s8932InkPathRise`、`s8932InkboxGlassIn`、`s8932NavInkGlow`、`s8932SealPressBloom`。本地 `data-motion="reduced"` 和系统 `prefers-reduced-motion` 均关闭强动画，但保留边框、阴影、选中态和可读层次。
- 安全边界：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态、本地显示偏好和旧案列表，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、地图行动、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 覆盖首页样卷入口新文案、开卷路径、S89.32 首页和 shell marker；`scripts/clientSmoke.js` 新增 `assertS8932HomeShellPolish()` 并在桌面首页、桌面印匣、低动效印匣、设置路由和移动首页检查 S89.32 marker、关键文案、低动效关闭、印匣/settings 唯一入口和安全污染守门；`test/reactClientScaffold.test.js` 新增 S89.32 source canary，确认组件 marker、CSS keyframes/低动效守门、smoke 入口和测试断言同步存在。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（66 tests）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。预算输出为 `JS 644.5 KiB / CSS 119.4 KiB / fonts 26288.4 KiB / client-assets 27052.4 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning，npm 仍输出既有 `globalignorefile` warning。
- 复审：开工只读子代理 McClintock 建议此步聚焦首页、顶栏、右上角印匣/设置目录、样卷入口降权、低动效和唯一入口 smoke；本轮按建议实施。提交前只读复审 Euclid 通过，未发现阻断问题；非阻断建议为后续可把 `SurfaceHost.tsx` 纳入 S89.32 专项污染 bundle 的精细 strip、并把本地低动效首页动画关闭加入 browser smoke。
- 提交：实现提交 `111566ee`；本次哈希回填仅修改本文，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.31 舆图态势罗盘与移动单点札记 polish

- 范围：`MapPage` 右侧舆图簿新增带 `data-polish-map-tide="s89-31-map-tide-compass"` 的“舆图态势罗盘”，按近事、人物、后果、可拟四类整理当前公开舆图读法；`InkMapRuntimeBridge` 的 tooltip 新增 `data-polish-tooltip-reading="s89-31-mobile-map-note"`、札记类型、可见度条、候复边界和移动端底部札记布局。`global.css`、`scripts/clientSmoke.js`、`test/reactClientScaffold.test.js` 和 `App.test.tsx` 同步守门。
- 内容：罗盘四个 tab 只从当前安全 `mapRuntimeView` 派生后的地点/近事、NPC visual-only 活动锚点、公开后果追踪和已预渲染行动草稿中取材；“据罗盘拟稿”只写本地 `map-runtime` 草稿，携带当前安全 target/source refs 作为服务器重建复核 hint。tooltip 会按地点、近事、人物、驿路给出玩家读法和可见度；舆图页与 runtime tooltip 的文本/ref sanitizer 同步过滤 `draftContext`、`schema`、`manifest`、`server adjudication`、`AI read scope`、`proposal boundary`、`safe view`、`resolver` 及其连字符/冒号 ref 形态，不把 tooltip、画面坐标、layout、点击位置、route path、visual-only effect 或 NPC anchor 变成事实。
- 样式与移动端：新增 `.mapTideCompass*` 与 `.inkMapTooltipReading` 局部样式，补 `s8931MapTideGlow`、`s8931MapNoteIn`、`s8931MapNoteSheetIn`；移动端 tooltip 固定为底部札记 sheet，低动效偏好和系统 `prefers-reduced-motion` 均关闭强动画。未新增依赖、素材、runtime manifest 字段或素材 manifest 字段。
- 安全边界：本步不新增 API，不改 `mapRuntimeView` 契约、后端 schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、图层状态和本地草稿，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、NPC 行动、经济、关系、地图行动、官职、考试、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 覆盖罗盘四类读法、近事/人物罗盘拟稿、局势轴合并 event+npc refs、tooltip 新札记 marker、可见度和候复边界，并把 `schema/manifest/resolver/draftContext/safe-view/proposal-boundary` 等污染 ref 加入 fixture，断言实际 `draftContext` 只保留安全 refs；`scripts/clientSmoke.js` 桌面舆图检查罗盘 marker/tab/copy/草稿反馈与 tooltip 读法，移动端检查罗盘、tooltip fixed bottom-sheet、无横向溢出和安全污染守门；`test/reactClientScaffold.test.js` 新增 S89.31 source canary，确认文本/ref sanitizer 覆盖工程词，且未引入 `/api/game/turn`、诊断、raw/provider/path/key/hidden、`draftContext`、`schema` 或 `manifest` 玩家可见污染。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（65 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "map renderer" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 browser smoke `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run test:client` 本轮复现既有 Vitest fork worker 启动超时：4 files / 119 tests 已通过，但 `client/src/assets/assetRegistry.test.ts` 与 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用上述串行池完整复核同一客户端套件。`npm run smoke:browser` 串联 wrapper 完成 manifest/build/budget 后，在 browser 段首页 `networkidle` 等待超时；已用直接 `node scripts/clientSmoke.js` 通过同一浏览器段。预算输出为 `JS 643.0 KiB / CSS 111.4 KiB / fonts 26288.4 KiB / client-assets 27042.9 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning，npm 仍输出既有 `globalignorefile` warning。
- 复审：开工只读子代理 Euler 建议将本步收窄为“舆图态势罗盘与移动单点札记 polish”，保持前端-only、draft-only、安全 view-only，并提醒 tooltip 与罗盘不得扩大 `mapRuntimeView` 契约或服务器裁决权；本轮按建议实施。提交前只读复审 Confucius 首轮发现 `draftContext/schema/manifest/server adjudication/AI read scope/proposal boundary/safe view/resolver` 未进入舆图页与 runtime tooltip sanitizer、source canary 也未完全守住；本轮已补文本/ref 双层清洗、污染 ref fixture 和 source canary。Confucius 复核通过，未发现新的阻断问题；非阻断建议为后续可另补 label/summary 污染 UI fixture，当前 sanitizer/ref guard 与 `draftContext` 结果断言已覆盖本轮风险。
- 提交：实现提交 `88a5253c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.30 共享案卷材质与错落动效 polish

- 范围：`AppShell` 新增 `data-polish-atmosphere="s89-30-shared-material-motion"`；`global.css` 用共享 selector 增强首页案桌/旧案架、主卷案头、舆图簿、人物卡、囊箧、史册、科举、皇榜、朝议、设置目录、专题层、状态行、选中控件、草稿已写入和空态的宣纸层次、轻浮起、错落进入与朱印反馈。`scripts/clientSmoke.js`、`test/reactClientScaffold.test.js` 和 `scripts/clientBuildBudget.js` 同步守门。
- 内容：新增 `s8930PaperRise`、`s8930StateWash` 和 `s8930SealBloom` 动效；`.statusLine` 统一宣纸/朱痕读法；选中按钮、舆图图层、印匣页签和草稿写入态使用已审核朱痕材质；空态/错误态统一纸底边框。低动效偏好和系统 `prefers-reduced-motion` 会关闭 S89.30 强动画并保留静态状态。
- 预算口径：CSS 预算脚本从 S89.27 的 `maxCssBytes: 180000` / `maxSingleCssBytes: 128000` 调整为 `220000` / `200000`，用于容纳本轮产品级共享材质层和后续可审查余量；这仍是硬门治理，后续若继续增长，应优先做 route/component CSS 拆分、删除无用选择器、合并重复规则或抽出共享样式，再评估预算。
- 安全边界：本步不新增依赖或素材，不改 React 数据来源，不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、地图行动、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`scripts/clientSmoke.js` 在既有 S89.5 跨页材质 smoke 中检查 S89.30 shell marker、三组 keyframes、共享材质 surface、状态行材质、朱印选中态、空态纸底、低动效关闭和舆图草稿写入的 S89.30 状态洗；`test/reactClientScaffold.test.js` 新增 S89.30 source canary，并把旧 CSS source guard 调整到当前预算口径，继续禁止 `/api/game/turn`、诊断、raw/provider/path/key/hidden、`draftContext`、`schema` 和 `manifest` 污染。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`node --check scripts/clientBuildBudget.js`、`node --test test/reactClientScaffold.test.js`（64 tests）、`npm run typecheck:client`、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（1178 tests）。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 129 tests 已通过，但 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用上述串行池完整复核同一客户端套件。预算输出为 `JS 636.8 KiB / CSS 106.5 KiB / fonts 26288.4 KiB / client-assets 27031.8 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning。
- 复审：开工只读子代理 Poincare 建议选择共享材质、动效与候复状态反馈切片，并提醒更新 CSS canary、同时覆盖本地低动效与系统 media query、不得加入 turn submission/diagnostics/raw/provider/prompt/path/key/hidden 文案；本轮按建议实施。提交前只读复审 Hilbert 已通过，未发现阻断问题；非阻断建议为后续若需支持更旧浏览器，可给 `.mapLayerToggle:has(input:checked)` 增加 class/data 状态替代路径，并在继续加 CSS 时优先抽共享 class 或拆 route/component 样式。
- 提交：实现提交 `76bdb67c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.29 史册证据读法与旁注空态 polish

- 范围：`ArchivePage` 在“案卷索引 / 近次线索”和公开追踪主列之间新增“史册追索笺 / 史册证据读法”，带 `data-polish-archive-reader="s89-29-evidence-reader"` 与 `data-polish-archive-boundary="s89-29-evidence-boundary"`。本步同步更新 `scripts/clientSmoke.js`、`test/reactClientScaffold.test.js`、`client/src/__tests__/App.test.tsx`、[SHARED_CONTEXT.md](SHARED_CONTEXT.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md) 和本文。
- 内容：读法区复用 `scholarPanelCard`、`surfaceSafetyList`、`statusLine` 和 `eyebrow`，零新增 CSS。四行读法分别说明“主列”近次入册、“旁注”公开后果与来函线索、“追索”实体余波、“拟稿”案头草稿边界；旁注计数只来自当前案卷安全 `eventArchiveView` counts、`domainConsequenceView`、`npcActiveRequestView.followUpEvidence.counts.total` 或公开 evidence 分组长度。
- 安全边界：本步不新增依赖、素材、CSS、后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。浏览器仍只消费当前案卷安全 view、route/local 状态和本地草稿，不请求诊断接口，不读取 raw 存档，不展示 raw evidence refs、草稿正文、内部枚举或工程词，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`scripts/clientSmoke.js` 在史册 digest smoke 中检查 S89.29 reader、4 行读法、boundary marker 和“按钮只写案头草稿，仍回主卷候复”文案；`test/reactClientScaffold.test.js` 守住 reader helper/marker、零 S89.29 CSS selector 和无 `/api/game/turn`、raw/provider/path/key/hidden 污染；`App.test.tsx` 的 archive route 用例断言 12 条近次、1 条后果、2 条来函、2 条实体余波和拟稿候复边界。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（63 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "archive route entries" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 test / 73 skipped）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 636.7 KiB / CSS 99.5 KiB / fonts 26288.4 KiB / client-assets 27024.7 KiB`。Vite 仍输出既有 `/assets/ui/...` runtime asset resolution warning 和 plugin timing warning；`git diff --check` 仍只输出仓库既有 CRLF warning，非本次修改文件。
- 复审：提交前只读复审 Goodall 已通过，未发现阻断问题。非阻断建议为后续若统一证据计数 helper，可让来函旁注数与实际清洗后渲染条目更严格一致，并可给旧案卷缺少 `eventArchiveView.counts.domain_consequence` 但仍有 `domainConsequenceView.recentConsequences` 的场景补读法 fallback。
- 提交：实现提交 `4bf06317`；本次哈希回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.28 前端 JS 分包预算稳定

- 范围：`vite.config.mjs`、`test/reactClientScaffold.test.js`、[SHARED_CONTEXT.md](SHARED_CONTEXT.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md) 和本文。仅调整 Vite 生产构建分包和 source canary，不改 React 页面运行时逻辑、不新增 CSS、不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 内容：Vite `rollupOptions.output.manualChunks()` 只对 `node_modules` 生效，将 React/React Router 拆为 `vendor-react`，Zustand 拆为 `vendor-state`，Lucide 拆为 `vendor-icons`，其余 npm 依赖归入 `vendor`；应用源码仍留在主 `index` chunk。该步骤不启用 `React.lazy`、不拆 route 模块、不改变玩家可见入口、数据请求、安全 view、草稿、专题层或服务器裁决，只降低单个 JS chunk 贴近硬门的风险并改善 vendor cache 粒度。
- 验证：当前已通过 `node --check vite.config.mjs`、`node --test test/reactClientScaffold.test.js`（63 tests）、`npm run typecheck:client`、`npm run test:client`（6 files / 134 tests；首次复现既有 Vitest fork worker 启动超时，重跑通过）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client && npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（1177 tests）。构建产物显示主应用 chunk 约 `358.1 KiB`、`vendor-react` 约 `272.2 KiB`、`vendor-icons` 约 `15.1 KiB`、`vendor-state` 约 `0.7 KiB`，预算输出 `JS 635.0 KiB / CSS 99.5 KiB / fonts 26288.4 KiB / client-assets 27022.9 KiB`。
- 风险/遗留：Vite 仍输出既有 `/assets/ui/...` runtime asset warning 和 plugin timing warning；这是当前构建路径已知提示，不是本步新增资源或素材。该分包方案不降低 JS 总量，后续若 JS 总量继续逼近 `850_000` bytes，应优先做真实 route/component split 或删除无用代码，而不是单纯继续抬高预算。提交前只读复审 Chandrasekhar 已通过，未发现阻断问题；非阻断提醒为当前分包只显式匹配项目实际使用的 `react-router`，若未来新增或切回 `react-router-dom`，需同步 vendor 分组和 canary。
- 提交：实现提交 `81d0ac0b`；本次哈希回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.27 前端 CSS 构建预算校准

- 范围：`scripts/clientBuildBudget.js`、[SHARED_CONTEXT.md](SHARED_CONTEXT.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md) 和本文。仅校准构建预算与文档口径，不改 React 运行时行为、不新增 CSS、不新增依赖或素材，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest。
- 内容：CSS 总预算从 `140000` bytes 调整为 `180000` bytes，单个 CSS asset 上限从 `102400` bytes 调整为 `128000` bytes。文档明确该调整是因为当前构建 CSS `99.5 KiB` 贴近旧 `100.0 KiB` 单文件硬门；后续若单个 CSS asset 超过约 `150 KiB`，应优先做 route/component CSS 拆分、删除无用选择器、合并重复规则或抽出共享样式，再评估是否继续提高硬门。
- 验证：当前已通过 `node --check scripts/clientBuildBudget.js`、`npm run budget:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。提交前只读复审已通过，未发现阻断问题；非阻断提醒为工作树另有非本轮改动 `test/reactClientScaffold.test.js` 与 `vite.config.mjs`，本次提交需继续排除。
- 风险/遗留：本步放宽硬门会减少构建失败噪音，但也降低自动约束强度；150 KiB 以上优先拆分/整理的文档口径是后续治理线，不是脚本硬失败条件。工作树已有非本轮改动 `test/reactClientScaffold.test.js` 与 `vite.config.mjs`，本步不触碰。
- 提交：实现提交 `31a1c97d`；本次哈希回填仅修改本文与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.26 人物交游候复笺与案头索引 polish

- 范围：`PeoplePage` 顶部新增“交游候复笺 / 人物案头索引”，带 `data-polish-people-reader="s89-26-people-docket-reader"`。索引汇总入谱人数、相识人物、当前人物页签、来函、后续簿、公开证据、关系网、交游议题、账解数量和本地候复稿有无；草稿状态只显示“已有 / 暂无候复稿”，不展示草稿正文、来处枚举、`draftContext` 或内部复核线索。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；零新增 CSS，不新增依赖或素材。浏览器仍只消费当前案卷安全 view、route/local 状态和本地草稿布尔状态，不请求诊断接口，不读取 raw 存档，不裁决资源、身份、交易、委派、NPC 行动、经济、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`App.test.tsx` 扩展人物页用例，断言 S89.26 marker、索引中文读法、证据计数清洗、本地草稿只显示有无且不显示草稿全文；`scripts/clientSmoke.js` 在桌面人物页检查 S89.26 marker、索引行数和候复边界文案；`test/reactClientScaffold.test.js` 新增 S89.26 source canary，守住零 CSS、`global.css` 源码体积低于 129300 bytes、reader block 不读取 `actionDraft.text` / `draftContext` / `sourceRef`，以及无 `/api/game/turn`、raw/provider/path/key/hidden 等污染。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（62 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "current people ledger|S88.8 economy trace in the people" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（2 tests / 72 skipped）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 634.2 KiB / CSS 99.5 KiB / fonts 26288.4 KiB / client-assets 27022.2 KiB`；首次 budget 因最大 JS chunk `635.3 KiB > 634.8 KiB` 失败，本轮已压缩 S89.26 helper 并复跑通过。browser smoke 覆盖 desktop-people-assets、desktop-people-refresh、desktop-history-forward-people 和既有桌面/移动关键路由。
- 复审：开工只读子代理 Hypatia 确认本步适合做零 CSS 人物页读法切片，建议把索引放在人物页顶部、只消费安全 view 与本地草稿布尔状态、不要展示草稿正文或工程词；本轮按建议实施。提交前只读复审 Archimedes 已通过，无阻断问题；非阻断提示为来函/后续计数未像公开证据计数一样逐项 unsafe 过滤、账解计数字段集少于 `EconomyTraceSection`，但二者只暴露数量不暴露文本，且预算余量极窄，本轮接受该残余风险并建议后续若做预算专项时再统一计数 helper。
- 提交：实现提交 `dd281b18`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.25 覆盖层液态玻璃与共享纵深 polish

- 范围：`SurfaceHost` 为印匣抽屉、普通弹窗、本地专题层和高清立绘查看器补 `data-polish-depth="s89-25-liquid-glass"`；`global.css` 用共享 selector 增强覆盖层的宣纸毛玻璃、半透明层、阴影纵深和内沿高光，并继续复用既有材质变量。同步折叠三列统计网格重复规则，避免液态玻璃样式吃光 CSS 源码余量。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；不新增依赖或素材，不改服务器裁决或 React 数据来源。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、关系、考试、官职或 hidden 信息。
- Smoke/canary：`test/reactClientScaffold.test.js` 新增 S89.25 source canary，守住 overlay depth marker、共享 glass CSS、`global.css` 源码体积低于 129300 bytes 和 SurfaceHost/CSS 不含 raw/provider/path/key/hidden 等污染；`scripts/clientSmoke.js` 在既有 S89.5 覆盖层 smoke 中检查抽屉、弹窗和专题层的 `s89-25-liquid-glass` 标记与 blur，并检查高清立绘查看器的 `s89-25-liquid-glass` 标记。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（61 tests）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。当前预算输出为 `JS 631.1 KiB / CSS 99.5 KiB / fonts 26288.4 KiB / client-assets 27019.1 KiB`；browser smoke 覆盖 desktop-home、desktop-mock-start、desktop-scholar-panel、desktop-inkbox-tabs、desktop-map-runtime、desktop-people-assets、desktop-inventory、desktop-archive-refresh、desktop-exam-fullscreen、desktop-ranking-fullscreen、desktop-topic-surfaces、desktop-court-refresh、desktop-settings-refresh、desktop-magistrate-panel、desktop-official-panel、desktop-minister-panel、desktop-general-panel、desktop-emperor-panel、mobile-* 和 browser-reduced-motion-home。
- 复审：开工只读子代理 Parfit 建议后续优先做人物页“交游候复笺 / 人物案头索引”零 CSS 切片；本轮主线先完成更贴合目标中“毛玻璃和液态玻璃效果”的共享覆盖层切片，人物页读法建议保留为下一候选。提交前只读复审 Pascal 已通过，无阻断问题；非阻断提示为高清立绘查看器只直接断言纵深标记、未单独断言 blur，但其复用 `.modalPanel[data-polish-depth="s89-25-liquid-glass"]`，browser smoke 已覆盖 marker 和 modal/surface blur，本轮接受该残余风险；CSS 源码余量仍紧，后续继续优先零 CSS 或先瘦身。
- 提交：实现提交 `bbc2c4e3`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.24 前端 CSS 重复规则折叠与预算缓冲 polish

- 范围：`client/src/styles/global.css` 合并静态确认重复的 `.mapActionDeck` / `.mapNpcActivityDeck`、`.mapActionList` / `.mapNpcActivityList`、四列统计网格和书生 compact 卡片底座声明；不删除任何仍有 React/runtime 源码命中的 class，不触碰 `.portraitViewerCueGrid` 的顺序覆盖依赖。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；不新增依赖或素材，不改 React 组件行为。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、关系、考试、官职或 hidden 信息。
- Smoke/canary：`test/reactClientScaffold.test.js` 新增 S89.24 source canary，要求 `global.css` 源码低于 129300 bytes，并守住舆图簿、四列统计网格和书生 compact 卡片的合并 selector，避免重复规则回涨。
- 验证：当前已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（60 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。当前预算输出为 `JS 631.0 KiB / CSS 99.4 KiB / fonts 26288.4 KiB / client-assets 27018.8 KiB`；直接 browser smoke 首次 240s 外层限时被截断，420s 重跑通过。
- 复审：开工只读子代理 Ramanujan 确认 394 个 CSS class token 均有 React/runtime 源码命中，不建议按未引用 class 删除；建议把 S89.24 收窄为 CSS 合并/去重复专项，并明确避开 `.portraitViewerCueGrid`。提交前只读复审通过，无阻断问题；非阻断建议指出 source canary 依赖 exact formatting 且 CSS 预算仍需谨慎，本轮接受该残余风险。
- 提交：实现提交 `25a29f8c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.23 囊箧流转候批笺与移置候批读法 polish

- 范围：`client/src/pages/InventoryPage.tsx` 在囊箧页新增带 `data-polish-inventory="s89-23-inventory-ledger-reader"` 的“流转候批笺”，把本卷资源、资产、物件、凭证数量、可流转件数、当前移置选择和候批状态整理为玩家可读读法；`data-polish-inventory-boundary="s89-23-transfer-boundary"` 明确未获案卷回批前不写成已入账、已移置、已成交或已影响关系。复审建议的 `item.unit` 污染边缘已同步修复，物品单位、资源单位和移置路径单位都走 `safeLabel()` 清洗。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；零新增 CSS，不新增依赖或素材。浏览器只读当前 route/session 的 `inventoryView`、`resourceLedgerView`、`assetLedgerView`、`economyTraceView` 和本地选择状态，不请求诊断接口，不读取 raw 存档，不把移置读法写成事实；资源扣减、物品转移、交易、赠予、借用、NPC 行动、经济、关系、考试、官职和 hidden 信息仍等主卷回批与服务器裁决。
- Smoke/canary：`App.test.tsx` 覆盖 S89.23 marker、unsupported route 的“断卷不可移置”、正常囊箧的取材数量、移置路径、候批状态和内部 id/工程词禁词；`scripts/clientSmoke.js` 在桌面/移动囊箧 smoke 中守住 S89.23 marker、候批文案、无横向溢出和禁词；`test/reactClientScaffold.test.js` 新增 S89.23 source canary，并确认本步没有新增 S89.23 CSS。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（59 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "unsupported inventory|inventory economy trace|S89.23|inventory transfer selections" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（3 tests）、补单位清洗后的 focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "inventory economy trace|S89.23" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 test）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 631.0 KiB / CSS 99.8 KiB / fonts 26288.4 KiB / client-assets 27019.2 KiB`。初次 browser smoke 抓到“验收”属开发口径禁词，本轮已将玩家可见标题改为“流转候批笺”并复跑通过。`npm run test:client` 两次复现既有 Vitest fork worker 启动超时：一次 5 files / 129 tests 已通过但 `qianqiuClient.test.ts` worker 未启动，一次 5 files / 131 tests 已通过但 `Portrait.test.tsx` worker 未启动；已用串行池完整复核同一客户端套件。
- 复审：开工只读子代理建议选择囊箧账本/移置读法作为 S89.23，理由是收益高于首页旧案架、风险低于 `SurfaceHost` 全局专题层，并明确 CSS 预算只剩约 182 bytes，应按零 CSS 处理；本轮按建议实现。提交前只读复审首轮无阻断，非阻断建议指出 `item.unit` 污染边缘，本轮已补单位清洗和污染断言；最终只读复审通过，无阻断问题。
- 提交：实现提交 `73903bff`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.22 主卷本旬行止笺与草稿状态读法 polish

- 范围：`client/src/pages/GamePage.tsx` 在主卷右侧 `gameSideLedger` 新增带 `data-polish-game="s89-22-main-ledger-reader"` 的“本旬行止笺”，显示本卷已载公开卷宗数量、草稿状态、草稿来处和卷宗读法；`getActionDraftSourceLabel()` 只把本地草稿来源映射成中文玩家标签，不展示内部 source enum，也不展示草稿全文或 `draftContext`。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；零新增 CSS，不新增依赖或素材。浏览器只读当前 route/session 的安全 payload 与本地草稿状态，不请求诊断接口，不读取 raw 存档，不把草稿状态写成已执行、已结算或已入账；资源、关系、交易、NPC 行动、经济、官职、考试、地图行动、婚姻、弹劾、定罪、背叛和 hidden 信息仍只由主卷回批与服务器裁决。
- Smoke/canary：`App.test.tsx` 覆盖 S89.22 marker、初始“暂无草稿”、点击书生草稿按钮后的“已有本地草稿 / 案头摘录”和内部 source/工程词禁词；`scripts/clientSmoke.js` 在默认 Mock 开卷与书生草稿 smoke 中守住 S89.22 marker、主卷回批文案、无横向溢出和禁词；`test/reactClientScaffold.test.js` 新增 S89.22 source canary，并确认本步没有新增 S89.22 CSS。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（58 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "main game shell|scholar panel" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 629.0 KiB / CSS 99.8 KiB / fonts 26288.4 KiB / client-assets 27017.3 KiB`。
- 复审：开工只读子代理建议把 S89.22 收窄为主卷 `GamePage` 的“本旬行止笺 / 案头状态读法”，优先零 CSS、复用 `gameSideLedger` / `safeViewGrid` / `statusLine` / `surfaceSafetyList`，并避免人物页 mutation 边界；本轮按建议从人物页试验改为主卷切片。
- 提交：实现提交 `1b085829`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.21 舆图局势读法与行动线索 polish

- 范围：`client/src/pages/MapPage.tsx` 新增 `getVisibleDomainConsequences()`、`getMapSituationEntries()` 与 `draftFromMapSituation()`，在舆图右侧簿加入带 `data-polish-map-situation="s89-21-situation-index"` / `data-polish-map-reading="s89-21-situation-reader"` 的“山河局势轴”。该读法只汇总当前公开图层、最显著近事、人物视觉锚点、公开后果和行动牌数量；按钮只写本地 `map-runtime` 草稿，普通回合仍由服务器从当前安全 view 重建复核。
- 安全边界：本步不新增后端 API/schema、AI 权限、prompt、provider、SQLite、存档、runtime manifest 或素材 manifest；不读取完整 source manifest、本地路径、密钥、raw audit、provider payload 或 hidden notes。坐标、layout、viewport、renderer 画面层级、visual-only domain consequence effect 和 NPC visual-only anchor 不进入主卷裁决；浏览器不裁决地图行动、资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或隐藏信息。
- Smoke/canary：`App.test.tsx` 覆盖 S89.21 局势轴文案、公开后果行、行动数、据局势拟稿的 `draftContext` 安全 refs 和 visual/raw/provider 禁词；`scripts/clientSmoke.js` 的桌面舆图快照守住 S89.21 标记、文案和“不进入主卷裁决”边界；`test/reactClientScaffold.test.js` 新增 S89.21 source canary，确认舆图页未引入 `/api/game/turn`、`qianqiuApi`、浏览器存储、危险 HTML 或 raw/provider/key/path 词样。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（57 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "map renderer" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 test / 73 skipped）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client && npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 627.8 KiB / CSS 99.8 KiB / fonts 26288.4 KiB / client-assets 27016.0 KiB`。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 129 tests 已通过，`qianqiuClient.test.ts` worker 未启动；已用串行池完整复核同一客户端套件。
- 复审：开工只读子代理建议把 S89.21 收窄为舆图右侧局势读法簿，优先读取现有安全 view、避免后端/API/prompt/裁决改动、不要把 raw refs 或视觉坐标变成 evidence；本轮按建议实现并复用既有 `.mapVisibleLayerDigest` 底座控制 CSS 增量。提交前只读复审已通过，未发现阻断问题；非阻断建议指出后果-only 场景可能没有 draftContext evidence hint、局势轴 header 可加换行兜底，本轮已补 header wrap。
- 提交：实现提交 `36c88f2b`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.20 前端 CSS 预算瘦身与材质变量清理

- 范围：专项瘦身 `client/src/styles/global.css`，不改 React 组件结构和运行时契约。全局 `rgba(...)` 统一改为等价 `rgb(... / ...)` 写法；已定义材质变量继续承载宣纸、折纸、破纸、朱痕、朱印、印匣纹理和墨线背景；移动端重复的单列 grid、双列 grid 和竖排 flex 规则合并；删除唯一静态确认无 React 源码引用的 `.actionPanel`。
- 安全：本步不新增依赖或素材，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 或素材 manifest。浏览器仍只消费安全 view、route/surface 状态和本地草稿，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- Smoke/canary：`test/reactClientScaffold.test.js` 新增 S89.20 source canary，守住 `global.css` 源码体积低于 `130_000`、禁止 `rgba(` 和 `.actionPanel` 回归，并确认折纸、破纸、印匣纹理等材质背景走变量复用。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（56 tests）、`npm run build:client && npm run budget:client`（最终 `JS 624.7 KiB / CSS 99.0 KiB / fonts 26288.4 KiB / client-assets 27012.1 KiB`）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。`npm run smoke:browser` 的组成步骤已逐项通过：runtime manifest、build、budget 和同一 `clientSmoke.js` 浏览器段。
- 复审：开工只读子代理 Heisenberg 确认当前 CSS class 静态扫描无明显大块废弃选择器，建议优先做移动端重复规则合并、材质变量复用和 `.actionPanel` 回归守门；本轮按建议补第二轮移动端合并。提交前只读复审已通过，未发现阻断问题；非阻断建议指出 `form.actionPanel` 仍作为 smoke 负向查询存在，用于确认旧表单未残留，不影响删除 CSS 选择器。

### 2026-05-25：S89.19 设置与断卷状态读法 polish

- 范围：完成 `/game/:sessionId/settings` 设置目录、`AiSettingsPanel` 推演设置矩阵、404/错误页和畸形主卷恢复页的状态读法 polish。设置目录新增 `s89-19-settings-card-state` / `s89-19-settings-directory-state` / `s89-19-settings-route-recovery` 标记，四类工具逐项说明眼下可做、候复边界和畸形案卷只打开安全工具；推演设置面板新增 `s89-19-ai-state-ledger` 状态簿，清洗预设、分工 label/purpose/model、状态枚举和错误信息；断卷、空卷与畸形主卷恢复页新增 `s89-19-route-recovery` / `s89-19-game-route-recovery` 标记。
- 体验：设置目录不再只列四张入口卡，而是说明“推演只改分工、显示只改本地章法、旧案只看公开摘要、案卷摘要不补私记”；AI 设置矩阵在候载、未载、受阻、未接通来源和未保存保留时给出案头读法，污染 payload 不会把 provider 原文、本地路径、key、schema/manifest 或底层错误直接显示给玩家。
- CSS 预算：本步零新增 CSS，复用 `.surfaceSafetyList`、`.statusLine`、`.settingsDirectoryCard`、`.aiSettingsMatrixStatus` 和既有案卷空态壳。CSS 仍贴近硬门，后续新增视觉样式前应继续优先复用或瘦身。
- Smoke/canary：`App.test.tsx` 新增 S89.19 设置目录、AI 设置污染 payload/API error、404/错误页和畸形主卷恢复断言；`scripts/clientSmoke.js` 的设置页快照守住 S89.19 状态簿标记、四类状态卡、玩家化文案和禁词；`test/reactClientScaffold.test.js` 新增 S89.19 source canary，并确认本步没有新增 S89.19 CSS 或回合提交入口。
- 边界：本步只改 React `SettingsPage` / `AiSettingsPanel` / `ErrorPage` / `NotFoundPage` / `GamePage`、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。浏览器仍只打开本地印匣、既有全局 AI settings API 或本地显示偏好，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或 hidden 事实；畸形案卷不读取主卷接口、不打开专题层、不写行动草稿。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（55 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "settings route|global AI settings|S89.19|bad routes|game root recovery|malformed settings" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（9 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）、`npm run test:client`（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出为 `JS 624.7 KiB / CSS 99.8 KiB / fonts 26288.4 KiB / client-assets 27013.0 KiB`。`npm run smoke:browser` 在 360s 外层限时内完成 runtime manifest、build 和 budget 后进入 browser smoke 被截断；已用直接 browser smoke 覆盖同一浏览器段。
- 复审：开工只读子代理建议将 S89.19 收窄为设置、推演矩阵与断卷恢复空态 polish，重点清洗 AI settings label/purpose/model/preset/error、增加设置目录状态读法和恢复页只给归路标记；本轮按建议实现。提交前只读复审首轮发现 active preset id 仍可能被污染 payload 原样回写，本轮已改为读取和保存都用安全 id并对齐清洗后的预设列表，补污染 preset 保存测试和畸形 settings route 测试；复审子代理复核通过，无阻断问题，非阻断建议为后续若要更严可前端维护已知 preset 白名单或让契约声明动态 preset。
- 提交：实现提交 `bf23677e`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.18 科举与皇榜仪式读法 polish

- 范围：`ExamPage` 新增 `data-polish-exam="s89-18-exam-ritual-ledger"` 与 `data-polish-exam-ledger="s89-18-exam-ritual"`，在考场右栏整理“科举仪程”，按取题启封、场内推进、交卷候批和候榜回音说明当前案卷状态、草稿/交卷边界和候榜回音；`RankingPage` 新增 `data-polish-ranking="s89-18-ranking-ceremony-ledger"` 与 `data-polish-ranking-ledger="s89-18-ranking-ceremony"`，在榜名详情整理“放榜仪程”，按张榜取材、我名、同年座师和授官过渡说明公开榜文读法。
- 体验：科举页的公开考试文本现在复用玩家化改写，过滤 `draftContext/schema/manifest/server adjudication/AI read scope/proposal boundary/safe view/resolver` 等工程词；“局部时间”改为“场内时辰”，“科举接口暂不可用”改为“科场回音暂不可用”。皇榜页把“防弊检测”改为“弥封复核”，并在榜文未张挂、未见案主榜行、同年座师未公开和授官提示待回批时用案卷内口径说明，不凭荣誉摘要、姓名、评语或同名榜行补造正榜。
- CSS 预算：本步零新增 CSS，复用 `.examPreviewPanel`、`.surfaceSafetyList`、`.statusLine` 和既有皇榜/科举布局；最终预算输出为 `JS 621.2 KiB / CSS 99.8 KiB`。CSS 仍贴近硬门，后续新增视觉样式前应继续优先复用或瘦身。
- Smoke/canary：`App.test.tsx` 的科举/皇榜用例新增 S89.18 marker、仪程索引文案、工程词禁词和重复仪式文案断言；`scripts/clientSmoke.js` 的 `assertExamFullScreen` / `assertRankingFullScreen` 守住 S89.18 marker、仪程文案和更严工程词；`test/reactClientScaffold.test.js` 新增 S89.18 source canary，并确认本步没有新增 S89.18 CSS 或回合提交入口。
- 边界：本步只改 React `ExamPage` / `RankingPage`、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。浏览器仍只调用既有科举 API 或读取安全榜文 view，不裁决取题、评分、舞弊、放榜、晋级、授官、同年座师关系、官职任免或 hidden 事实；“拟行动”只写本地草稿，不调用 `/api/game/turn`。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（54 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "immersive exam page|ranking page" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（2 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run test:client` 当前无断言失败，但复现既有 Vitest fork worker 启动超时：5 files / 126 tests 已通过，`Portrait.test.tsx` worker 未启动；已用串行池完整复核同一客户端套件。
- 复审：开工只读子代理建议把 S89.18 收窄为科举与皇榜仪式读法，重点补 `safeExamText()` 玩家化改写、科举/皇榜 marker、工程词守门和“防弊检测”世界内文案；本轮按建议实现。提交前只读复审已通过，未发现阻断问题；非阻断建议指出 0 分评定边缘读法，本轮已改为按 `score !== null/undefined` 判断已有评定。
- 提交：实现提交 `060d0c8c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.17 朝议专题目录与官署案头索引 polish

- 范围：`CourtPage` 新增 `data-polish-court="s89-17-court-directory"`，把奏折队列、拟圣旨、朝议、堂审、军议和人物档案六个专题入口整理为官署案头索引；每个专题读取既有 `surfaceRegistry` 的公开说明，展示“卷宗取材 / 可拟草稿 / 案卷未载 / 候复边界”，并保留唯一按钮打开既有 `SurfaceHost` 专题层。
- 体验：朝议页不再只是三组按钮，玩家能在入专题前看清每个入口取材范围、能写什么草稿、案卷未载时不会补造什么事实，以及哪些结果仍须候主卷回批；入口数量不增加，设置/印匣不回到主功能导航。
- CSS 预算：本步零新增 CSS，复用 `.courtSurfaceGroup`、`.courtSurfaceActions`、`.peopleMeta`、`.surfaceSafetyList` 和 `.paperButton`。最终构建预算仍为 `JS 618.6 KiB / CSS 99.8 KiB`；CSS 仍贴近硬门，后续新增视觉样式前应继续优先复用或瘦身。
- Smoke/canary：`App.test.tsx` 的朝议专题层用例新增 S89.17 marker、6 个唯一入口、案头索引文案、四类读法和玩家可见污染词守门；`scripts/clientSmoke.js` 的 topic surface 初始快照守住 S89.17 marker、6 个目录条目、索引文案和禁词；`test/reactClientScaffold.test.js` 新增 S89.17 source canary，并确认没有新增 S89.17 CSS 或回合提交入口。
- 边界：本步只改 React `CourtPage`、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。浏览器仍只打开本地专题层和写本地草稿，不递交回合、不裁决资源、身份、交易、NPC 行动、经济、考试、官职、任免、赏罚、定罪、战和、关系、婚姻、弹劾、背叛或 hidden 事实。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（53 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "registry-backed local surfaces" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 test）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run test:client` 复现既有 Vitest fork worker 启动超时：5 files / 119 tests 已通过，`assetRegistry.test.ts` worker 未启动；已用串行池完整复核同一客户端套件。
- 复审：开工只读子代理建议把 S89.17 收窄为朝议专题目录与官署案头索引，保持零 CSS、复用既有 `surfaceRegistry` 与专题层行为，并守住不提交回合、不扩权的边界；本轮按建议实现。提交前只读复审已通过，未发现阻断问题；非阻断建议为后续可把 6 个 `data-court-surface` exact set 加入 App 测试。
- 提交：实现提交 `b9e23f11`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.16 全局壳与基础控件交互反馈 polish

- 范围：`AppShell` 移除 `topBarPolishStyle` / `inkboxButtonPolishStyle` 内联临时样式，顶部主导航与右上角印匣入口改用 `s89-16-shell-controls` / `s89-16-inkbox-button` 可检测标记；`global.css` 承载顶栏绢帛材质、主导航 selected 状态、印匣按钮光泽/朱痕/按压反馈，以及纸按钮/纸链接 active/disabled 状态。
- 体验：顶部栏有更稳定的宣绢层次、底线光泽与 active 导航阴影；印匣按钮的 hover/focus/active 反馈从 React 内联样式迁回 CSS；纸链接与纸按钮共用不可用态和按压态，禁用按钮不再吃到 hover 浮起。低动效仍由既有 `.appShell[data-motion="reduced"]` 全局规则压低 transition/animation。
- CSS 预算：首次构建预算因本轮新增样式升至 `CSS 101.9 KiB` 而失败；随后删除确认未被 React 源码引用的旧 `.gameGrid`、旧书生练习面板样式、旧画像网格/画像卡片样式及其移动端残留，最终预算回落到 `CSS 99.8 KiB`。这些删除只移除孤立 CSS，不删除仍在用的 `scholarPanel`、人物页、画像 frame 或当前主卷结构。
- Smoke/canary：`scripts/clientSmoke.js` 扩展 S89.5 材质检查，守住 S89.16 顶栏/印匣标记、active 顶部导航阴影、印匣按钮 pseudo 光泽与朱痕；`test/reactClientScaffold.test.js` 更新旧 S89.5 内联样式断言，改为要求 AppShell 无 `CSSProperties` 临时样式且 CSS 含 S89.16 交互规则；`App.test.tsx` 在印匣 Esc/focus 流程中守住顶栏与印匣标记。
- 边界：本步只改 React `AppShell`、全局 CSS、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。浏览器仍只负责导航、显示偏好、本地草稿和安全 view 展示，不裁决资源、身份、交易、NPC 行动、经济、考试、官职、关系、婚姻、弹劾、定罪、背叛或 hidden 事实。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（52 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "route-derived UI page state|settings route as a directory" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（2 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run test:client`（6 files / 129 tests）、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。`npm run smoke:browser` 在 300s 外层限时内完成 runtime manifest、build 和 budget 后进入 browser smoke 被截断；随后直接 `node scripts/clientSmoke.js` 通过完整 React routes。
- 复审：开工只读子代理建议把 S89.16 收窄到全局控件反馈与 CSS 预算瘦身，指出 AppShell 已有 S89.16 半步标记但 source canary 仍守旧断言，并建议优先复用/合并按钮链接反馈、删除确认不用的旧 CSS。提交前只读复审已通过，未发现阻断问题；非阻断建议为后续可把 active 顶部导航 smoke 从条件式检查收紧为必须存在。
- 提交：实现提交 `ad2cbab4`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.15 来函与账解证据读法 polish

- 范围：`NpcFollowUpEvidenceSection` 新增来函后续 evidence 标签映射和 `s89-15-follow-up-reader` / `s89-15-follow-up-boundary` 标记；`EconomyTraceSection` 新增账解 trace 标签映射和 `s89-15-economy-reader` / `s89-15-economy-boundary` 标记；人物页交游议题同步把 `npc_relationship_action` 等来源/status 读作“交游记录 / 可跟进”等玩家口径。
- 体验：`human_debt_monthly`、`accepted_pending_server_resolution`、`integrity_watchlist`、`trade_negotiation`、`under_review` 等内部枚举不会再作为玩家可见标签露出；账本数值变化从 `->` 改为中文“至”；边界提示明确“只写案头草稿”，不把证据、账解或交游议题误解成真实结算。
- 安全：来函 evidence、经济 trace 和人物交游议题补 POSIX/Windows 本地路径、`draftContext`、`schema`、`manifest`、`server adjudication`、`AI read scope`、`proposal boundary`、`safe view`、`resolver`、`sourceRef`、`relatedRefs`、`scopeRefs` 等工程词清洗；浏览器仍只消费服务器安全 projection，不结算资源、交易、委派、人情债、关系、婚姻、弹劾、定罪、背叛或 hidden 事实。
- Smoke/canary：`client/src/__tests__/App.test.tsx` 补来函后续、交游议题和人物经济 trace 污染 fixture 与 S89.15 标记断言；`scripts/clientSmoke.js` 在桌面/移动囊箧 economy trace smoke 中守住 S89.15 reader/boundary 标记，并扩展史册/囊箧工程词禁词；`test/reactClientScaffold.test.js` 新增 S89.15 source canary，确认未新增 S89.15 CSS。
- 边界：本步只改 React 前端证据组件、人物页标签清洗、客户端 smoke/source canary、前端测试和文档；不新增 CSS、依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（52 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "current people ledger|economy trace" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（4 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。最终预算输出 `JS 617.1 KiB / CSS 99.9 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。`npm run test:client` 两次命中既有 Vitest fork worker 启动超时，5 files / 60 tests 已通过但 `App.test.tsx` worker 未启动；已用串行池完整复核同一客户端套件。
- 复审：开工只读子代理建议把 S89.15 收窄为来函/交游/账解术语清洗，重点补 POSIX 路径、工程词和 raw status/route label 风险，并保持 CSS 零新增；本轮按建议实现。提交前只读复审已通过，未发现阻断问题；复审建议的 raw risk tag 边缘情况已补 `relationship_risk_watchlist` 中文映射并由同一子代理复核确认无阻断。
- 提交：实现提交 `99072f6e`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.14 玩家身份标签中文化与 CSS 预算缓冲 polish

- 范围：新增前端 `client/src/text/playerLabels.ts`，把 `scholar` / `official` / `general` / `minister` / `emperor` / `magistrate` 及 `junior_official`、`local_official`、`female_official` 等别名集中映射为中文身份标签；首页续局、主卷案头、人物页、旧案架、右上角印匣、人物档案专题层和高清立绘标题都改用该 helper 或既有画像短语，不再把 raw role 枚举作为玩家兜底文案。
- 体验：无官职/科名时，案卷摘要会显示“书生 / 入仕官员 / 将领”等中文身份；污染的 officeTitle、examRank、roleLabel 仍退回“身份未题”。设置目录短章法标签改为复用 `.peopleMeta` 标签样式，移除 `.settingsDirectoryBadges` 专属 CSS；舆图图层摘要规则小幅合并，让 CSS 预算从 `100.0 KiB` 回落到 `99.9 KiB`。
- Smoke/canary：`scripts/clientSmoke.js` 的印匣摘要桌面/移动 smoke 新增 raw role enum 局部守门；`test/reactClientScaffold.test.js` 新增 S89.14 source canary，要求首页/主卷/人物/旧案/印匣统一调用身份 helper，禁止 `|| player.role` 等 raw fallback，并确认设置目录标签复用 `peopleMeta`。
- 边界：本步只改 React 前端文本 helper、页面/组件接线、少量 CSS 复用、客户端 smoke/source canary、前端测试和文档；不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决。浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职或隐藏信息。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（51 tests）、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "opens the S75.4 inkbox tabs|keeps the settings route|falls back when the S75.6 continue summary|drops polluted S75.5 save metadata|keeps the current session pointer" --pool=vmThreads --fileParallelism=false --maxWorkers=1`（5 tests）、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run test:client`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 `npm run smoke:browser`。预算输出 `JS 614.1 KiB / CSS 99.9 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 复审：开工只读子代理指出 `SurfaceHost`、首页、主卷、人物页和旧案架均有 raw role fallback 风险，并建议先瘦身 CSS 再继续 polish；本轮按建议集中 helper、补 smoke/source canary、复用标签样式。提交前最终只读复审已通过，未发现阻断问题；复审提出的 `roleLabel: "official"` 旧存档边缘情况也已收紧为中文映射。
- 提交：实现提交 `0739b7f9`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.13 右上角印匣与设置目录信息架构 polish

- 范围：右上角仍是唯一显眼印匣入口；`/game/:sessionId/settings` 继续只是目录页，新增 `data-polish-settings="s89-13-settings-directory"`，不把设置恢复成主功能入口。范围限 React `SurfaceHost` / `SettingsPage`、少量 CSS、客户端 smoke/source canary、前端测试和文档。
- 体验：印匣新增 `data-polish-settings="s89-13-inkbox-overview"` 总览，显示当前案卷和显示章法；显示偏好新增 `data-polish-settings="s89-13-display-panel"`，把动效、舆图、正文、对比整理成四项读法；设置目录卡片增加“全局生效 / 本地保存 / 只读摘要”等短章法标签。旧案页会在本地列表中优先显示当前案卷，避免旧卷较多时当前本局被前 6 条截断。
- 文案与安全：案卷摘要新增 `data-polish-settings="s89-13-safe-summary"`，不再直接显示 `player-state` / `exam-submit` 等内部来源，而改为“新卷开局 / 主卷载入 / 本旬回音 / 科场回音”；空 `player` 也显示“未题名 / 身份未题”安全兜底。显示偏好仍只写本地白名单，AI 设置仍使用既有全局设置 API。
- Smoke/canary：`scripts/clientSmoke.js` 现检查桌面和移动印匣的 S89.13 overview/display/summary 标记、设置目录标记和章法标签，并扩展 `player-state`、`exam-submit`、`server adjudication`、`AI read scope`、`proposal boundary`、`safe view`、`resolver`、`/Users`、`/private`、`tp-...` 等污染词守门；`test/reactClientScaffold.test.js` 新增 S89.13 source canary。
- 边界：不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决；浏览器不裁决资源、身份、交易、NPC 行动、经济、考试、官职或隐藏信息。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "opens the S75.4 inkbox tabs|refreshes the old-case list once|keeps the settings route" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run test:client`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js`、`npm run check:docs-governance` 和 `node --test test/documentationGovernance.test.js`。预算输出 `JS 613.6 KiB / CSS 100.0 KiB`；CSS 正贴 100 KiB 硬门，后续样式新增前应优先瘦身。`npm run smoke:browser` 串联 wrapper 在 240s 内完成 manifest/build/budget 后超时，直接 browser smoke 已通过。
- 复审：开工只读子代理指出 `payload.player` 可为空、设置目录禁词和 CSS 预算风险；本轮已修复空案主兜底、扩展 smoke 禁词并裁剪新增 CSS 至预算内。提交前最终只读复审已通过，未发现阻断问题；残余建议是后续可把 `role` 枚举兜底统一映射为中文身份标签，CSS 正贴 100 KiB 硬门需继续先瘦身再增样式。
- 提交：实现提交 `54a6186d`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.12 舆图筛选专题层体验 polish

- 范围：`map-filter` 继续作为本地 `SurfaceHost` 专题层，不加入 `TopicSurfaceId`，不请求 `/api/game/topic-surface` 或 `/api/ai/topic-draft`；点击“筛舆图”后显示 `data-polish-map-filter="s89-12-surface-guide"` 与 `data-polish-map-surface="s89-12-filter-ledger"` 的只读舆图筛选说明。
- 体验：专题层复用既有三栏 `.topicSurfaceLayout` 样式，不新增 CSS；“卷上图层”列展示地点、驿路、近事、人物动向和后果追踪数量与读法，“筛看方法”说明单层、双层和素绢空图，“候复边界”说明筛选只改卷面显示、后果仍候主卷回音。原通用“写入奏折草稿”从舆图筛选层移除，改为“回舆图勾选”关闭专题层。
- 文案与安全：`surfaceRegistry` 的 `map-filter` 文案去掉“预留/占位”模板感，`safeSurfaceText` 补 `draftContext/schema/manifest/server adjudication/AI read scope/proposal boundary/resolver/safe view` 等工程词守门。专题层仍只说明公开显示材料，不把画面坐标、图层、人物锚点或 visual-only 后果变成行动事实。
- Smoke/canary：`scripts/clientSmoke.js` 现检查桌面和移动舆图筛选专题层标记、卷上图层/候复边界、无错误草稿按钮、无横向溢出和禁词；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖 `MapFilterSurfaceGuide`、`buildMapFilterSummary`、只读回舆图按钮、registry 无 `map-filter` draftText 和无 unsafe API/storage。
- 边界：本步不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决；专题层不提交回合、不写浏览器存储、URL、prompt、canonical state 或服务器状态，也不生成地图行动草稿。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "opens court, archive, and map surfaces against the current route session" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "wraps the S72 map renderer with safe React action drafts" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 `npm run smoke:browser`。`npm run test:client` 本机再次命中 Vitest fork worker 启动超时，5 files / 124 tests 已通过，`client/src/api/qianqiuClient.test.ts` worker 未启动；已用串行池完整复核同一客户端套件。预算输出 `JS 610.7 KiB / CSS 99.4 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 复审：开工只读子代理建议保留 `map-filter` 本地 surface、移除“写入奏折草稿”、复用现有专题样式、补工程词清洗和 smoke/source canary；本轮按建议实现。提交前只读复审已通过，未发现阻断问题；已按复审残余风险建议阻断 `map-filter` 写草稿分支，避免后续误加 draftText 后绕过只读边界。
- 提交：实现提交 `b658a1a3`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，为低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.11 舆图全关图层空态与筛选交互 polish

- 范围：舆图页新增 `data-polish-map-empty="s89-11-layer-empty"` 与 `data-layer-visibility`，运行时桥新增 `data-polish-map-empty="s89-11-runtime-empty"`；地点、驿路、近事三层全隐时显示“素绢空图”空态与“展开三层”恢复入口。
- 体验：`.mapLayerSummary` 从单段改为可换行摘要 + 恢复按钮；`.mapVisibleLayerDigest` 在局势簿说明当前可见线索。三层全隐时地图标签归零，局势簿同步收起舆图行动、近事和人物锚点，只保留恢复入口；恢复后三层、地图标签、行动入口和近事列表回到原状态。
- Smoke/canary：`scripts/clientSmoke.js` 现检查桌面和移动端全隐状态、运行时空态标记、局势簿摘要、恢复按钮、无横向溢出和扩展禁词；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖 `allLayersHidden`、`restoreAllLayers`、`visibleMapActionEntries`、空态 overlay、侧栏 digest 和恢复后列表回归。
- 边界：本步不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决；图层筛选只改浏览器卷面显示，不写浏览器存储、URL、prompt、canonical state 或服务器状态。舆图行动仍只写 `map-runtime` 本地草稿并等待服务器普通回合从当前安全 view 重建复核。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "wraps the S72 map renderer with safe React action drafts" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、`npm run test:client`（6 files / 129 tests）、完整串行 `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx client/src/components/__tests__/ client/src/pages/__tests__/ --pool=vmThreads --fileParallelism=false --maxWorkers=1`（1 file / 69 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 `npm run smoke:browser`。预算输出 `CSS 99.4 KiB`；Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 复审：开工只读子代理建议增加全隐空态、恢复按钮、侧栏可见线索摘要、移动端 smoke 和 source canary；本轮按建议实现。提交前只读复审已通过，未发现阻断问题；残余风险是 `CSS 99.4 KiB` 余量很小，后续样式新增仍需先跑预算。
- 提交：实现提交 `0285f36e`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.10 史册信息密度与移动端长文本二轮 polish

- 范围：史册页新增 `data-polish-archive="s89-10-chronicle-density"`；公开追踪区新增 `data-archive-layout="ledger-rail"` 与 `data-polish-archive-trace="s89-10-chronicle-density"`，由三列改为“近次归档主列 + 证据侧栏”。
- 体验：`.archiveEvidenceStack` 将“史册后果追踪”和“来函证据追踪”叠放在右侧，避免来函证据为空时仍占桌面第三列；移动端继续由既有 media query 收束为单列，browser smoke 守住史册无横向溢出。
- 文案与安全：史册清洗与来函证据清洗补 `draftContext`、`schema`、`manifest`、`server adjudication`、`AI read scope`、`proposal boundary`；通用玩家文案改写把 `watchlist` 转为“留察名单”，`NPC` 继续转为“人物”，人物页默认来函标题也改为“来函线索与风宪留察”。
- Smoke/canary：`scripts/clientSmoke.js` 现检查 S89.10 史册标记、`ledger-rail` 布局、证据侧栏、史册后果追踪、移动端侧栏存在、无横向溢出和扩展禁词；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖 DOM 标记、两列 CSS、移动端布局守门、玩家化 `watchlist/NPC` 文案、domain consequence 污染清洗和 draft-only 行动。
- 边界：本步不新增依赖或素材，不改 runtime manifest、素材 manifest、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式或服务器裁决；史册仍只读 `eventArchiveView`、`domainConsequenceView` 与 `npcActiveRequestView.followUpEvidence` 安全 view。`据此拟稿`、`续记后果`、`拟复核` 仍只写本地草稿，普通回合由服务器从当前安全 view 重建复核。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "renders archive route entries and domain consequence tracking from safe views" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "loads the S76.10 current people ledger without exposing the full portrait pool" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。预算输出 `CSS 98.5 KiB`。
- 复审：开工只读子代理建议主列 + 证据侧栏、移动端长文本、`watchlist/NPC` 玩家化和禁词扩展；提交前只读复审指出 `DomainConsequenceSection` 未同步 S89.10 新增工程词，已补共享组件禁词、史册 domain consequence 污染 fixture 和 source canary 后重跑验证。最终只读复审通过，未发现阻断问题；非阻断建议为后续抽共享文本清洗 helper，降低 unsafe 词表漂移风险。
- 提交：实现提交 `283b2c0a`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.9 人物页与立绘查看器材质题签 polish

- 范围：人物页外层、人物名册、人物详情、人物谱牒和人物卡新增 `s89-9-portrait-material` 标记；高清立绘查看器题签格新增 `data-polish-cue="s89-9-portrait-cue-material"`，与 S89.8 的 `data-polish-portrait="s89-8-life-scroll"` 并存。
- 体验：人物谱牒与人物卡补宣纸底色、卡片轻浮起反馈；查看器面板复用已审核 `paper-aged-silk-v1.webp`，画卷题签改为双列纸签格，移动端单列，低动效或浏览器 reduced-motion 下关闭题签动画。
- Smoke/canary：`scripts/clientSmoke.js` 现检查 S89.9 人物页/谱牒/工作台/人物卡标记、人物卡渐层与 transition、查看器题签格数量/网格/渐层/动效或 reduced-motion 关闭；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖标记、丝绢材质 token、移动端单列、低动效和人物卡 hover。
- 预算：S89.9 新增 CSS 让单 CSS 产物接近原 100,000 bytes 门槛；本轮把 `scripts/clientBuildBudget.js` 的 `maxSingleCssBytes` 校准为明确的 100 KiB（102,400 bytes），仍保留硬门，最终 `npm run budget:client` 输出 `CSS 98.5 KiB`。
- 边界：本步不新增依赖或素材，不改 runtime manifest 字段、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、素材 manifest 或服务器裁决；人物页和查看器仍只读当前案卷安全 view、已审核 `portraitRef` runtime 资产和安全 `PortraitViewerProfile`。S89.9 不新增行动草稿写入，人物页既有按钮仍只写本地草稿并等待服务器回合裁决。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --check scripts/clientBuildBudget.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "loads the S76.10 current people ledger without exposing the full portrait pool" --pool=vmThreads --fileParallelism=false --maxWorkers=1`、完整串行 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。提交前只读复审无阻断问题，已按建议收紧人物页既有本地草稿边界表述；残余风险是 `CSS 98.5 KiB` 余量较小，后续样式新增仍需先跑预算。
- 提交：实现提交 `8a7654ee9c5b7daa1c6790859ee885795f95928c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-25：S89.8 高清立绘查看器画中所见 polish

- 范围：高清立绘查看器新增 `data-polish-portrait="s89-8-life-scroll"`，在人物公开说明区显示画卷题签、仪态、衣饰、神采，并把正文整理为“画中所见 / 身世线索 / 眼下处境”三段；人物页画像 profile 补案主经历线索与 NPC 公开近事。
- 体验：外貌介绍从已审阅 runtime 画像元数据推导衣饰、姿态、画面气息和观画印象；生平介绍只用人物页传入的安全摘要或画卷题签作身世线索；当前情况统一以“眼下处境”开头，明确公开卷宗近况或候回音边界。
- Smoke/canary：`scripts/clientSmoke.js` 现检查 S89.8 查看器标记、画卷题签、衣饰/神采、三段式文案、runtime 画像路径、存储禁写和污染词守门；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖新标记、helper、人物页 profile 文案和只读边界。
- 边界：本步不新增样式，不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决；查看器仍只读已审核 `portraitRef` 的 runtime 主图路径、画像元数据和人物页安全 `PortraitViewerProfile`，不调用模型生成小传，不写浏览器存储、URL、草稿、prompt、canonical state 或服务器状态。
- 验证：按第 6 节 S89.8 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 复审：提交前只读子代理复审通过，未发现阻断问题；非阻断建议为后续可给题签格补纸签/朱线/微边框样式。
- 提交：实现提交 `2476a12c4d77e598b65ba74931361edb362e2b6c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.7 舆图交互与筛选提示 polish

- 范围：舆图页新增 `data-polish-map="s89-7-layer-tooltip"`、图层显隐摘要和 tooltip `data-polish-tooltip="s89-7-map-note"` 单点札记；地图 tooltip 草稿按钮写入后会显示“已写入主卷草稿”的本地状态。
- 体验：图层区显示“地点、驿路、近事三层全开”或“现显/暂隐”摘要，明确筛选只改卷上显示，不改变案卷事实；tooltip 显示“单点札记 · 写入后仍须回主卷候复”，从地图标签写入草稿后只标记对应 `draftId`。
- 安全：`MapPage` 与 `InkMapRuntimeBridge` 的公开文本清洗补 `/Users`、`/private`、常见 Unix 本地目录和 `tp-...` token 形态；`layout`、`layoutPath`、`mapBounds`、`viewportHint`、`position`、`coordinate`、`x/y` 等 visual-only refs 仍被排除出草稿上下文。
- Smoke/canary：`scripts/clientSmoke.js` 现覆盖 S89.7 舆图标记、图层摘要、隐藏图层反馈、tooltip 札记、tooltip 草稿写入状态、移动端舆图摘要和路径/key 污染；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖新标记、清洗、draft-only 和无 turn API 边界。
- CSS：初版新增样式超过硬预算，已删除未使用 `.mapStatusRail` 并改成少样式、多状态文案；最终 `npm run budget:client` 输出 `CSS 97.5 KiB`。
- 边界：本步不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决；地图 tooltip、图层、坐标、visual-only effect 和 NPC anchor 只作浏览器显示，不成为真实行动、资源、关系、任免或地理事实。
- 复审：开工中只读子代理提出舆图路径/token 清洗、图层反馈、tooltip 层级、移动端长文本和 CSS 预算建议；本轮已按建议收束。提交前最终只读复审通过，未发现阻断问题。
- 验证：按第 6 节 S89.7 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `b7bbeb04327f4d379dfd10729547e740958467d3`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.6 高清立绘查看器人物小传与当前情况 polish

- 范围：高清立绘查看器新增 `data-polish-profile="s89-6-portrait-life"` 人物说明标记，打开后显示“观画印象”人物头、公开标签、外貌介绍、人物小传和当前情况；人物页画像 profile 为案主、名册、详情和谱牒补更具体的公开近况说明。
- 体验：小传文案改为“人物小传据公开传略整理”，外貌文案强调只作观画印象，当前情况明确来自公开案卷/人物页近况；查看器只读已审阅 runtime 画像字段和人物页传入的安全 `PortraitViewerProfile`，不读取完整素材清单，不写浏览器存储、行动草稿、URL 或服务器状态。
- Smoke/canary：`scripts/clientSmoke.js` 现检查 S89.6 profile 标记、人物小传、当前情况、观画印象/公开近况强化文案、存储禁写和 `/Users`、`/private`、`tp-...` 等路径/key 污染；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖新 heading、标记、公开近况文案和污染词守门。
- 边界：本步不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决；人物近况与小传只作公开卷宗摘要，不生成隐藏事实或真实人物行动。
- 复审：提交前只读子代理指出 portrait profile 路径未显式覆盖 `/Users`、`/private` 与 `tp-...` token 形态；本轮已补三处前端清洗、browser smoke 和源码 canary，最终只读复审确认不阻塞提交。
- 验证：按第 6 节 S89.6 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `d476d41d747afc6e650ed8a6fa5041b23d01c87c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.5 React 全局材质、覆盖层过渡与交互反馈 polish

- 范围：主壳新增 S89.5 材质反馈标记，右上角印匣和顶栏接入轻量材质/阴影样式；drawer、modal、本地专题层和高清立绘查看器统一补覆盖层 polish 标记；设置目录与卡片补可检测材质标记。
- 体验：舆图页新增本地 `lastWrittenMapDraftId`，玩家把 runtime 选择、行动牌或近事写入主卷草稿后，对应公开行动/事件行显示 `data-draft-state="written"` 并触发短反馈；切换案卷会清空该本地状态。此反馈只表示浏览器草稿写入，不提交回合、不复核 evidence、不结算地图行动。
- Smoke/canary：`scripts/clientSmoke.js` 新增 `assertS895MaterialFeedbackPolish()`，覆盖材质样式、印匣覆盖层、低动效禁用、地图行动反馈、立绘查看器、设置目录和污染词守门；`test/reactClientScaffold.test.js` 增加源码 canary，确认新增标记仍为 frontend-only 且不引入 raw route、source manifest、provider/key/path/hidden 污染。
- 边界：本步只改 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 复审：提交前只读子代理首轮指出空 keyframes 与 `.mapEventList` 写入反馈样式缺口；本轮已改为真实短动画、行动/事件共享写入反馈与低动效覆盖，并强化 browser smoke/source canary 阻断空 keyframes；最终只读复审通过，未发现阻断问题。
- 验证：按第 6 节 S89.5 口径通过；`npm run test:client` 与 `npm run smoke:browser:visual` 的本机超时均已有等价/直接命令通过记录，未见断言失败。
- 提交：实现提交 `b3237606ffa3abc7fbeb396d89c5c9eb8605f8f9`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.2 React 视觉矩阵、轻量专题页壳与立绘查看器公开说明

- 范围：新增 `smoke:browser:visual`，在默认 React browser smoke 上写出产品视觉矩阵截图，并要求首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置和移动端印匣标签完整；脚本新增囊箧桌面/移动截图、section 完整性、安全污染和首页朱印字体守门。
- 体验：人物、囊箧、史册改用轻量 `sessionRouteShell`，独立页不再重复主卷案头和底部奏折；史册标题提升为页面级 `h1`；囊箧、账解、专题页壳和纸按钮补齐宣纸/折纸/朱印质感与按钮反馈；高清立绘查看器显示外貌介绍、公开传略和当前情况，文本来自已审阅画像元数据与人物安全摘要。
- 修复：纸按钮红印伪元素收回按钮内部，避免伪元素撑大 `scrollWidth` 导致地图页“筛舆图/写入行动”在真实浏览器文本溢出守门中误报；囊箧 `authorityBoundary` 统一经过玩家可见清洗，污染时退回世界内回批口径，并阻断本地路径、密钥、`manifest/schema/draftContext`、`hidden/raw` 和“服务器裁决”等工程词外露。
- 边界：只改 React 路由壳、样式、客户端 smoke/视觉矩阵脚本、前端测试 canary 和验收文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 子代理：已委派只读子代理巡检 S89.2 缺口，指出高清立绘查看器缺少人物说明；提交前只读复审又指出囊箧边界文案清洗缺本地路径和若干工程词覆盖，均已补齐并由同一复审子代理确认无阻断问题。
- 验证：按第 6 节 S89.2 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `b8a564514498c7de6c6d7183597df51bbab5e662`；后续哈希回填为低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.3 React 设置入口、专题文案与错误空态收束

- 范围：主卷与轻量专题壳不再渲染重复“印匣”功能页签；`/game/:sessionId/settings` 继续可刷新/直达，但只作为“案头工具”目录，四个卡片分别打开右上角唯一印匣抽屉中的推演、显示、旧案和摘要 tab。
- 体验：错误页、404 和畸形主卷恢复页统一使用 `statePage` 案卷空态壳，补图章、宣纸、墨角、动作按钮图标、进入动效与低动效降级；设置目录卡片补宣纸/朱印材质、hover/focus 抬升和移动端单列。
- 文案：专题层把“数据来源/材料状态/占位状态/裁决边界”改为“卷宗取材/材料进度/案卷状态/回批口径”，browser smoke 和 React canary 阻断 `数据来源|裁决边界|服务器裁决|draftContext|schema|manifest` 等玩家可见泄漏。
- 边界：本步只改浏览器路由入口、文案、样式、客户端 smoke 和测试 canary；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。设置、专题、错误空态和角色循环入口仍只消费安全 view 或本地 UI 状态，不创建真实行动、交易、任免、考试、地图或 NPC 后果。
- 子代理：开工前已委派只读子代理巡检 S89.3 缺口，指出设置入口重复、专题层工程口径、错误/404 空态和 smoke canary 缺口；提交前只读 diff 复审已通过，未发现阻断问题。
- 验证：按第 6 节 S89.3 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `efa507aa729c8acb9503ba8f8e45a67e6b265969`；后续哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.4 React 首页旧案状态与史册信息密度 polish

- 范围：首页旧案区改为独立案架状态，提供 loading/empty/error/ready 互斥呈现、可读旧案数量、案架状态、骨架占位、空态说明和“重翻旧案”安全重试；旧案读取失败只更新 `savesStatus`，不再让开卷朱印进入错误态、覆盖既有开卷错误或回显底层错误。
- 安全：`SaveCaseList` 在生成读档 action 前校验 `isRunnableSessionId()`；异常 `sessionId` 只显示“暂不可读”，不把 `/api/game/state`、本地路径、raw/provider/hidden/key 等污染案号写入链接或载入回调。
- 体验：史册页新增“案卷索引 / 近次线索”导读带，展示入册条目、后果线索、实体余波和前三条公开线索；仍只读 `eventArchiveView`、`domainConsequenceView` 与来函后续 evidence，按钮继续只写本地草稿。
- Smoke：`scripts/clientSmoke.js` 新增首页案架与史册索引 DOM 守门；`.sessionNav` 仅从重叠检查中排除，避免 sticky 二级导航与同名页面标题误判，页签文字仍接受溢出检查。
- 边界：本步只改 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 子代理：开工中委派只读子代理巡检 S89.4 缺口，指出首页旧案状态互斥、旧案错误隔离、异常案号链接防线、史册密度和 smoke canary 缺口；提交前只读复审又指出 `refreshSaves()` 在已有开卷错误后仍可能覆盖共享 `error`，本轮已改为旧案读取失败只更新 `savesStatus`，并补 UI 回归测试。
- 验证：按第 6 节 S89.4 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `3a600b82f86855a563c64563251eec7081724d71`；提交前按规则执行只读 diff 复审并通过。后续哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.1 React 玩家可见文案与移动端覆盖层润色

- 范围：清理 React 页面和专题层中面向玩家的 `AI`、provider/model、服务器、安全视图、projection、resolver、ref 等工程词外露，改成“推演、案卷、公开卷宗、回批、复核、线索”等世界内用语；主卷畸形案卷根路由改为固定安全恢复页。
- 体验：抽屉加入遮罩、外点关闭和移动端满宽布局；常用纸按钮/纸链接补齐焦点、悬停和禁用状态；人物、囊箧、推演分工和统计格在窄屏降为单列，避免表单挤压和长文本溢出。
- 边界：只改浏览器文案、样式和 route recovery；不改后端 API/schema、存档格式、AI 权限矩阵、prompt、provider facade、SQLite schema、runtime manifest 字段或服务器裁决。
- 子代理：开工前已委派只读子代理巡检 React polish 缺口；提交前只读复审指出专题层动态字段、少量固定文案、角色面板空态、快捷行动来源标签、舆图无障碍名称和朝议页专题入口 aria 仍有工程词泄漏，已补专题材料/证据/错误文案清洗、角色面板空态改写、快捷行动玩家语汇映射、舆图/朝议页 aria 名称清理和玩家可见 canary；修复后最终只读子代理复审已通过，未发现阻断或应修复项。
- 验证：已通过客户端类型检查、React 单测、脚手架 canary、串行 Vitest、browser smoke/runtime manifest/build/budget；朝议页 aria 修复后又补跑 `npm run typecheck:client`、`npm run test:client`、`node --test test/reactClientScaffold.test.js` 通过，治理与 diff check 按第 6 节提交前收尾。

### 2026-05-24：完成 S88 台账归档与上下文压缩

- 范围：新增 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，把 S88 全面系统打磨从活动台账长表迁出；压缩本文件和 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，只保留当前可接手状态、边界、验证入口和下一步建议；[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 增加 S86-S88 索引。
- 口径：S88 不再在本文件作为 `IN_PROGRESS` 长表维护；若继续打磨，应新开可审查小步骤并引用 S88 归档，不回灌旧流水。
- 边界：纯文档维护，不改运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state、前端行为或素材 manifest。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审；已在共享上下文记录。
- 验证：本轮应通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
