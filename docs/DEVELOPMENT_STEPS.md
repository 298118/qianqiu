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
- S89 React 产品 polish、CSS token/keyframe/surface 收敛和预算稳定压缩归档：[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。

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
- S88 已作为阶段性打磨归档到 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)；S89.1-S89.68 已作为完成流水压缩到 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。继续打磨时应新开可审查小步骤，不要把旧长流水复制回本文件。

## 4. 活动路线图总览

当前活动小步骤只保留下一步候选。接手者应先确认用户意图、工作树状态和预算风险，再把选定步骤改为 `IN_PROGRESS`。

| ID | 状态 | 目标 | 范围 / 下一步 |
| --- | --- | --- | --- |
| S90.1 | DONE | CSS 物理拆文件第二阶段与预算恢复 | 首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和对应移动端样式已迁到页面级 import，`global.css` 仅保留 token/base/shell/controls/overlay/motion/全局移动布局；source canary 继续读取产品样式全集保护既有 selector，并新增全局启动样式图预算守门。 |
| S90.2 | DONE | route 空态一致性与跨页读法继续 polish | 已完成舆图读图/地点状态/路线暗示/tooltip 操作、人物/高清立绘/科举/皇榜读法、全局壳、右上角印匣/设置入口、`SurfaceHost` 专题层、错误/loading/empty 状态和基础控件反馈 polish；只消费安全 view 与本地草稿，不新增裁决权。 |
| S90.3 | TODO | S89 前端 polish 专题归档 | 如需要更完整追溯，可把 S89.1-S89.68 从 Git history 和压缩索引整理为独立专题归档；避免重新引入逐项长流水。 |

## 5. 最新状态

- S89.1-S89.68 已完成并迁出活动台账。压缩归档见 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。
- 最新实现步骤 S90.1/S90.2：React 产品级前端 polish 与 CSS 启动预算恢复已完成。CSS 全局启动 import 图已从约 200 KiB 拆分到约 80 KiB，产品样式全集仍由 source canary 覆盖；体验 polish 覆盖舆图读图、地点/驿路/近事续卷、人物/立绘、科举/皇榜、全局壳、印匣/设置、专题层状态、错误空态和基础控件反馈。
- S90.1/S90.2 不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、已审核 runtime 资产引用和本地偏好/草稿/专题状态。
- 最近完整运行态验证来自 S90.1/S90.2：`npm run typecheck:client`、`npm run typecheck:server`、`npm run build:client`、`npm run budget:client`、`npm run qa:runtime-manifest`、`node --test test/reactClientScaffold.test.js`、串行 Vitest、`npm run check:docs-governance`、`npm test` 和 `npm run smoke:browser -- --screenshots artifacts/s90-polish-smoke` 均通过；详见本节记录与 Git history。

## 6. 最近完整验证口径

最新运行态完整验证锚点来自 S90.1/S90.2：

- `node --check scripts/clientSmoke.js`
- `node --test test/reactClientScaffold.test.js`（100 tests）
- `npm run typecheck:client`
- `npm run typecheck:server`
- `npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 134 tests）
- `npm run qa:runtime-manifest`
- `npm run build:client`
- `npm run budget:client`
- `npm run check:docs-governance`
- `git diff --check`
- `npm test`（1214 tests）
- `npm run smoke:browser -- --screenshots artifacts/s90-polish-smoke`

## 7. 近期进度记录

### 2026-05-27：S90.1/S90.2 React 产品级前端 polish 完成

- 范围：S90.1 已把首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和对应移动端样式迁到页面级 import，`global.css` 仅保留 token、base、shell、controls、overlay、motion 和全局移动布局，source canary 新增全局启动样式图预算守门并继续用产品样式全集覆盖历史 selector。S90.2 已整合舆图读图指引、地点状态、路线暗示、掌中 tooltip 操作，人物详情“来函 / 礼法 / 交易 / 委派”读法、人物卡候回音提示、高清立绘“画卷三读”、科举入场-落墨-候批、皇榜题名-同年座师-授官过渡，以及印匣/设置、专题层状态、错误空态和基础控件反馈。
- 子代理：按用户要求拆分为舆图、人物/立绘/科举/皇榜、全局壳/设置三个实施子代理。三个实施子代理均未提交、未推送、未创建 PR；主代理已接管整合，修复舆图类型谓词错误和立绘测试异步重渲染断言。提交前只读子代理复审已完成，无阻塞发现，复审代理仅运行只读轻量检查并认可主代理完整验证证据。
- 边界：不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、已审核 runtime 资产引用和本地偏好/草稿/专题状态。
- 验证：已通过 `npm run typecheck:client`、`npm run typecheck:server`、`npm run build:client`、`npm run budget:client`、`npm run qa:runtime-manifest`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1`、`npm run check:docs-governance`、`git diff --check`、`npm test` 和 `npm run smoke:browser -- --screenshots artifacts/s90-polish-smoke`。浏览器 smoke 覆盖首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置、移动端和低动效路径。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：上下文压缩与 S89 完成台账归档

- 范围：压缩 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，把 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 中 S89.1-S89.68 的 DONE 表格和近期流水迁出，并在 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 增加 S89 压缩归档入口。
- 边界：纯文档维护，不改运行时代码、前端行为、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审，并在共享上下文记录。
- 验证：已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 提交：随本次 coherent 文档提交完成；最终哈希见 Git history 和本轮回复。
