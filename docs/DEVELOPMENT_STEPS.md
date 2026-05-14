# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的活动路线图与进度台账。已完成路线不再在本文件展开长表或逐日实现记录；需要追溯时阅读对应归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。旧分卷归档和 S60 契约文件保留为跳转页。
- S68-S69 科举、读书、评卷、榜单、同年座师、授官和 Provider/Mock 验收：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)。规划源头仍见 [IMPERIAL_EXAM_DEEPENING_ROADMAP.md](IMPERIAL_EXAM_DEEPENING_ROADMAP.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。规划源头仍见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。
- S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力事件、多 actor 场景、NPC 记忆账本、AI 调动审计和验收：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)。规划源头仍见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。

当前活动路线图已完成到 S72 归档。S72 的专项归档见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，规划源头见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。后续新开发应从新的小步骤继续，远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

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

当前活动工作已完成到 S72 归档。S49-S67、本地数据库与大世界内容，S68-S69 科举深化，S70 AI 编排，S71 数据库玩法化和 S72 PixiJS 水墨地图都已迁入专题归档；活动台账只保留索引和后续边界：

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S67 | DONE | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | DONE | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器面板和 Provider/Mock 验收 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |
| S70 | DONE | AI prompt/tool/actor/领域工具、多模型路由、AI 设置、月报、跳时、记忆、地图接口、MiMo AI-first smoke、JSON/SQLite parity 和 S70 归档 | [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) |
| S71 | DONE | 数据库 resolver 输入、SQLite 维护、安全搜索、redacted API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收归档 | [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。S70.12 起玩家 route response 内的兼容 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`，记忆与经历摘要只能通过安全 view 暴露。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

当前活动路线已完成到 S72 PixiJS 水墨地图专项归档。专项细节见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md) 和 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)；本节只保留已完成步骤、owner 和交接边界，不把 S49-S71 的 DONE 长表展开回活动台账。

| ID | 状态 | Owner | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| S72.0 | DONE | Codex | PixiJS 水墨地图规划与协作切换 | 已完成协作切换说明、专项路线图和素材台账模板；历史细节见专项归档 |
| S72.0a | DONE | Codex | 细化实施规格 | 已扩展专项路线图、补素材指南、创建项目指引与上下文排除规则；历史细节见专项归档 |
| S72.1 | DONE | Codex | PixiJS 依赖治理与地图 runtime 契约 | 已固定 `pixi.js@7.4.3` UMD、本地 vendor 优先、固定 CDN fallback、`mapRuntimeView` 字段、DOM/app/CSS 接线和验收边界 |
| S72.2 | DONE | Codex | 后端地图 runtime view、布局契约与测试 | 已基于 `mapContextView` 扩展安全 `mapRuntimeView`、显示 layout seed、route payload 和测试 |
| S72.3 | DONE | Codex | 水墨地图素材生成、manifest 与台账 | 已完成首批底图/纸纹/路线/涟漪/图标素材生成、视觉审核、alpha 后处理、manifest、台账和 manifest 安全测试 |
| S72.4 | DONE | Codex | PixiJS 地图 shell 与图层系统 | 已接入本地 PixiJS vendor、固定 CDN fallback、地图 renderer/panel、manifest-driven 素材加载、tooltip/label、行动草稿回填和资源失败 fallback |
| S72.5 | DONE | Codex | 地图与游戏系统深度联动 | 已完成地点、路线和事件点击选中态，tooltip 只读安全 `mapRuntimeView` ref/sourceRefs，可跳转已公开渲染的局势簿卡片 |
| S72.6 | DONE | Codex | 水墨动效与视觉 polish | 已完成路线墨线呼吸、事件涟漪扩散、朱砂双圈选中态、tooltip/fallback 案头舆图视觉、reduced-motion 与可见性暂停守卫 |
| S72.7 | DONE | Codex | 验收、安全与性能回归 | 已扩展 browser smoke 覆盖 PixiJS canvas 非空、资源失败静态降级、reduced-motion、桌面/窄屏无溢出、hidden/raw 防线和完整 Mock 主线 |
| S72.7a | DONE | Codex | 协作模式切换为 Codex-only | 已停止后续 Gemini CLI 协作，并同步 `AGENTS.md`、`CLAUDE.md`、治理、brief、路线图、运行时契约、素材指南和共享上下文 |
| S72.8 | DONE | Codex | S72 专项归档 | 已将完成范围、风险和后续地图玩法迁入归档，不再保留进行中小步骤 |

## 5. 进度记录

### 2026-05-14

工具：Codex。

步骤：S72.8 S72 PixiJS 水墨地图专项归档。

提交：本次归档提交。

完成：

- 新增 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，把 S72.0-S72.8 的完成范围、步骤索引、稳定边界、验证入口和后续方向集中到独立归档。
- 将 `docs/DEVELOPMENT_STEPS.md` 收束为当前索引与后续边界：S72 活动小步骤全部改为 `DONE`，S72.8 不再保留 `TODO`。
- 压缩当前活动台账，使其不再保留 S72 进行中的长表和实现记录，避免下一位接手误判 S72 仍在推进。
- 更新 `docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `README.md` 的 S72 表述，使其改为“已完成归档”口径。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。

风险/遗留：

- 历史实现细节不在活动台账重复展开，后续追溯应阅读 `docs/PIXIJS_INK_MAP_ARCHIVE.md`、专题路线图和 Git history。
- 本轮是纯文档归档与压缩；未运行浏览器或回归测试，因为未改运行时代码。

下一步：

- 进入新的小步骤或后续专项，不再继续展开 S72 活动台账。

### 2026-05-14

工具：Codex。

步骤：S72.0 PixiJS 水墨地图规划与 Gemini 协作切换。

提交：本次提交。

完成：

- 按用户要求将当前活动协作从 Claude Code 交接改为 Codex + Gemini CLI：Codex 负责后端、素材、审核、文档同步和提交；Gemini CLI 负责前端 PixiJS patch，但不运行 `git add`、`git commit`、`git push` 或创建 PR。
- 确认 PixiJS 作为长期地图运行时，用于水墨手绘地图、流畅动效、大量图层和后续深度玩法联动。
- 新增 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，记录 S72 目标、非目标、Codex/Gemini 分工、后端 view 契约、前端 PixiJS 图层、素材策略、小步骤和验收标准。
- 新增 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)，作为 AI 生成素材、历史地图参考和后处理记录的台账模板。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审，未发现 P0/P1/P2；P3 建议已补充依赖治理措辞、CDN/local fallback 要求和素材台账字段。
- 已运行但未完全通过：`npm test`。失败项为 `test/dualModeAcceptanceScript.test.js` 中 S67 大规模 fixture 性能阈值，`fixtureGenerationMs` 为 `11122.608`，超过既有 `10000` 阈值；其余 830 项通过。本轮只改文档与规划，未改 S67 fixture 或运行时代码。

风险/遗留：

- 规划已选择 PixiJS，但实际接入依赖方式还未决定；S72.1 必须先走依赖治理。
- 历史地图仅作参考或个人游玩临时素材来源，仍需登记来源与许可，避免后续公开时无法回溯。
- `docs/DEVELOPMENT_GOVERNANCE.md` 的受保护治理锚点仍保留历史 Codex/Claude Code 文案；当前活动交接以本台账、`AGENTS.md` 和 `docs/SHARED_CONTEXT.md` 的 Codex/Gemini 说明为准。
- 完整 `npm test` 触发既有 S67 性能阈值失败；后续若性能门槛持续波动，应单独处理 S67 fixture 生成耗时或验收阈值，不与 S72 地图规划混在同一提交中。

下一步：

- 执行 S72.1：Codex 固定 PixiJS 依赖治理、地图 runtime view 草案和 Gemini 前端 patch 边界；Gemini 在契约明确后再开始 S72.4 前端地图 shell。

### 2026-05-14

工具：Codex。

步骤：S72.0a 细化 Codex/Gemini 实施规格。

提交：本次提交。

完成：

- 扩展 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)：新增后端 `mapRuntimeView` 草案、建议文件、后端测试点、前端 PixiJS 文件/图层/接口、动效与性能预算、视觉规范、Gemini 交付格式和首个只读前端约束任务。
- 新增 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)：细化 AI 生图流程、prompt 模板、历史参考素材查找关键词、许可记录、manifest 草案、文件规格、质量验收和 Gemini 素材边界。
- 更新 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)，指向素材指南。
- 新增根目录 [GEMINI.md](../GEMINI.md)，作为 Gemini CLI 项目开发指引；新增 `.geminiignore`，排除 `.env`、存档、审计、SQLite、产物、依赖和日志目录。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审，未发现 P0/P2；P1 台账验证状态已由“待运行”改为实际结果，P3 已调整 `.geminiignore` 以保留 `.env.example` 可读。

风险/遗留：

- `GEMINI.md` 是 Gemini CLI 官方项目上下文文件口径；没有创建 `.gemini` 项目指引文件。`.geminiignore` 只用于排除上下文文件。
- S72.1 仍需正式完成 PixiJS 依赖治理；本轮没有引入 PixiJS 依赖。

下一步：

- 执行 S72.1：先让 Gemini 按 `GEMINI.md` 的首个建议任务做只读前端约束报告；Codex 再固定 PixiJS 依赖治理、`mapRuntimeView` 契约和素材首批清单。

### 2026-05-14

工具：Codex。

步骤：S72 地图素材生成与视觉审核规则补充。

提交：本次提交。

完成：

- 按用户要求固定 S72 AI 生图来源：地图 AI 生成素材统一由 Codex 使用 `gpt-image-2` 完成，不使用其他 AI 生图工具作为正式素材来源。
- 补充 Codex 视觉审核准入：AI 生成素材和第三方优秀素材入库前，都要审核游戏基调、历史/水墨适配、同批一致性、缩放可读性、现代元素/水印/误生成文字和 hidden/raw/path/key 污染风险。
- 更新 `docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/MAP_ASSET_GUIDE.md`、`docs/MAP_ASSET_LEDGER.md`、`GEMINI.md`、`AGENTS.md`、`docs/SHARED_CONTEXT.md` 和 brief 中的 S72 素材职责说明。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。

风险/遗留：

- 本轮是纯文档准入规则补充；实际素材生成、视觉审核和 manifest 更新仍归 S72.3。
- 纯文档改动，未执行子代理复审。

下一步：

- 执行 S72.1：先收 Gemini 只读前端约束报告，再固定 PixiJS 依赖治理和 `mapRuntimeView` 契约。

### 2026-05-14

工具：Codex，Gemini 只读前端约束报告，子代理只读复审。

步骤：S72.1 PixiJS 依赖治理与地图 runtime 契约。

提交：本次提交。

依赖/插件记录：

- 名称：`pixi.js`。
- 类型：browser vendor runtime，不作为 npm dependency 提交。
- 版本或范围：固定 `7.4.3`。
- 是否使用 `latest` 及理由：不使用。2026-05-14 通过 `npm view pixi.js version` 确认最新主版本为 `8.18.1`；S72 固定 7 系列最后版本 `7.4.3`，因为它有稳定 UMD bundle，适合当前无构建、传统 script 加载方式。
- 引入步骤：S72.1 只批准版本与加载策略；S72.4 才能提交 `public/vendor/pixi.min.js` 和前端接线。
- 负责人/工具：Codex 负责治理、后端契约、素材审核和最终提交；Gemini CLI 提供前端约束报告和后续 patch，可按任务修改/新增前端文件，但不运行 Git 命令。
- 用途：水墨地图 canvas 渲染、图层合成、marker、route、pressure effect、hit testing 和后续动效。
- 影响范围：browser/docs；本轮不改 server、storage、AI provider、`package.json` 或安装流程。
- 许可证：MIT。
- 安全与隐私：本地 vendor 不需要 key、账户、telemetry、postinstall、原生编译或二进制；固定 CDN fallback 只在本地 vendor 失败时触发。
- Mock/no-key 影响：无。缺 PixiJS 或缺素材时地图面板必须静态降级，不阻断文字主流程。
- 验证命令：`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`。
- 回滚策略：删除 S72 地图 vendor/script/DOM/CSS 接线和 `mapRuntimeView` route 接线，保留现有文字游戏与 `mapContextView` 安全接口。
- 文档落点：[PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)、[PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)、本台账、[SHARED_CONTEXT.md](SHARED_CONTEXT.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md)、根目录 [GEMINI.md](../GEMINI.md)。
- 决策：批准 `pixi.js@7.4.3` UMD、本地 vendor 优先、固定 CDN fallback、无 build step。
- 后续复查：若未来升级 PixiJS 8 或改用 npm/bundler，必须重新走依赖治理并更新 README、brief、browser smoke 和回滚策略。

完成：

- 新增 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，把 Gemini 报告沉淀为正式契约：地图 DOM 插入在 `#scholar-panel` 与 `#narrative` 之间，`app.js` 只保存 `currentMapRuntimeView` 并调用 `window.QianqiuMapRenderer`，action draft 只回填 `#action-input`，玩家仍通过现有行动按钮提交。
- 固定 `mapRuntimeView` schema：`schemaVersion`、`generatedAtTurn`、`assetSetId`、`viewportHint`、`mapBounds`、`layers`、`refs`、`routes`、`eventEffects`、字典式 `actionDrafts` 和 `hiddenNotice`；自然语言行动草稿必须由服务器预渲染，前端不得拼接。
- 固定前端 CSS 约束：地图作为独立 grid row；S72.7 验收后高度收束为 `clamp(200px, 24vh, 280px)`，并限制桌面游戏态书生信息面板高度以保护 narrative / action 区域。DOM overlay 默认 `pointer-events: none`，标签/tooltip 必须截断或边界检测，`prefers-reduced-motion` 时停止 CSS 动画并通知 Pixi ticker 降级。
- 固定首版素材库契约：`assetSetId` 为 `ink-map-v1`，manifest 路径为 `public/assets/maps/ink-map-manifest.json`，素材仍归 S72.3 使用 `gpt-image-2` 生成、视觉审核和登记。
- 更新 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)、[SHARED_CONTEXT.md](SHARED_CONTEXT.md)、brief 和 `GEMINI.md`，让 S72.2/S72.4 可直接按契约接手。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审，未发现 P0/P1/P2；确认依赖治理、hidden/raw 边界、无 build step 和 Gemini Git 禁止规则未被删弱。复审建议已纳入契约：S72.2 应确保 `viewportHint.centerRef` 解析到带有效 layout 的可渲染 ref，否则使用安全 fallback。

风险/遗留：

- S72.1 只固定契约，不提交 `public/vendor/pixi.min.js`，不生成地图素材，不返回真实 `mapRuntimeView`。
- S72.4 接入 CDN fallback 后会有可选外网请求；默认本地 vendor 优先，离线游玩不应依赖 CDN。
- 宽屏地图/叙事分列暂不作为 S72.4 首版硬门槛，避免一次性重写现有游戏主布局；S72.6 可作为 polish 继续增强。

下一步：

- 执行 S72.2：Codex 按契约实现后端 `mapRuntimeView`、layout seed、route payload 和测试，继续确保 JSON/Mock 默认可玩、hidden/raw 不外泄。

### 2026-05-14

工具：Codex。

步骤：Gemini CLI 协作口径修正。

提交：本次提交。

完成：

- 按用户澄清修正 S72 Gemini CLI 权限表述：Gemini 不是全程只读；除明确只读任务外，Gemini 可以修改代码、增加 scoped 前端文件，或维护必要前端上下文说明。
- 明确真正禁止的是运行 `git add`、`git commit`、`git push`、创建 PR、回滚他人改动、改后端裁决逻辑或引入未审核素材。
- 更新 `AGENTS.md`、`GEMINI.md`、`docs/SHARED_CONTEXT.md`、`docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md` 和本台账。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本、素材文件或 `package.json`。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。

风险/遗留：

- 本轮是纯文档协作口径修正；实际前端 patch 仍从 S72.4 开始，Codex 仍需审查 diff 后提交。
- 纯文档低风险改动，未执行子代理复审。

下一步：

- 执行 S72.2：Codex 继续实现后端 `mapRuntimeView`；S72.4 再让 Gemini 按契约修改前端文件。

### 2026-05-14

工具：Codex，子代理只读接线点分析，子代理只读提交前复审。

步骤：S72.2 后端地图 runtime view、布局契约与测试。

提交：本次提交。

完成：

- 新增 `src/game/mapRuntimeConfig.js`、`src/game/mapVisualLayoutSeed.js` 和 `src/game/mapRuntimeView.js`，从安全 `mapContextView` 派生 `mapRuntimeView`，包含显示 layout、layer/style token、route path、event effect 和服务器预渲染 action draft。
- `mapRuntimeView` 只使用显示坐标；坐标 clamp 到 `0..1`，`viewportHint.centerRef` 回退到当前可渲染安全 ref，action draft 只写入玩家输入框并要求普通回合确认，不直接执行 resolver 或改状态。
- `POST /api/game/start`、`GET /api/game/state/:sessionId`、`GET /api/game/player-state/:sessionId`、`POST /api/game/turn`、SSE `state_preview`/`final_state`、`POST /api/exam/question`、`POST /api/exam/progress` 和 `POST /api/exam/submit` 均返回 `mapRuntimeView`。
- `scripts/dualModeAcceptance.js` 的 S70 AI-first parity visible payload 加入 `mapRuntimeView`，确保 JSON/SQLite round trip 下地图 runtime 投影一致。
- 更新 README、brief、架构文档、AI 控制矩阵、S72 路线图和共享上下文，明确 `mapRuntimeView` 不进入 prompt、AI 工具或服务器裁决事实。
- 本轮不改 PixiJS 前端文件、不提交 `public/vendor/pixi.min.js`、不生成素材、不改 provider schema、SQLite schema、存档格式或 `package.json`。

验证：

- 已通过：`node --test test/mapRuntimeView.test.js`。
- 已通过：`node --test test/mapRuntimeRoute.test.js`。
- 已通过：`node --test test/mapContext.test.js test/mapVisibility.test.js test/mapMovementProposal.test.js test/gameTurnWorldGeography.test.js test/examTravel.test.js test/redactedState.test.js test/dualModeAcceptanceScript.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`git diff --check`。
- 已通过：`npm run smoke:dual-mode -- --storage-only`，S70 parity 输出包含 `mapRuntimeRefs: 55`。
- 已通过：`npm test`，839 项通过、0 失败；此前首次完整运行遇到 `test/serverCors.test.js` 的 Node test runner transient deserialization error，单跑该文件通过，后续完整重跑已通过。
- 已完成：只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 台账状态提示已修正。

风险/遗留：

- `mapRuntimeView` 已满足后端和 route 契约，但前端 PixiJS shell、vendor、canvas 非空、资源失败 fallback 与地图素材仍未接入。
- S72.3 仍需由 Codex 使用 `gpt-image-2` 生成并视觉审核 `ink-map-v1` 素材，更新 manifest 和素材台账。
- S72.4 才让 Gemini CLI 在已提交后端契约和已审核素材范围内修改前端文件；Gemini 不运行 Git 命令。

下一步：

- 执行 S72.3：生成、审核并登记首批水墨地图素材与 manifest；随后进入 S72.4 PixiJS 地图 shell。

### 2026-05-14

工具：Codex，medium 子代理创意发散，Codex 视觉审核，待提交前只读复审。

步骤：S72.3 水墨地图素材生成、manifest 与台账。

提交：本次提交。

完成：

- 按用户要求将创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、素材生成、视觉审核、后处理和入库。
- 新增 `public/assets/maps/ink-map-manifest.json`，登记 `ink-map-v1` 的底图、纸纹、路线笔触、事件涟漪、图标、route/effect token 映射和安全 license 摘要。
- 新增首批项目素材：`ink-world-base-v1.webp`、`paper-texture-v1.webp`、`route-brush-v1.png`、`ink-ripple-red-v1.png`、`ink-ripple-blue-v1.png`，以及府城、县城、贡院、驿站、关隘、军镇、商埠、案牍和诏令 9 个透明图标。
- 对 chroma-key 源图做本地 alpha 移除、图标切图、碎片清理、尺寸压缩与可读性复审；Codex 视觉审核确认首批素材符合文人案头舆图气质，无文字/水印/现代 UI/本地路径/key/hidden/raw 内容。
- 更新 `docs/MAP_ASSET_LEDGER.md`，记录 prompt 摘要、生成工具、后处理、许可说明、Codex 视觉审核结论和项目路径；本轮未使用第三方或历史地图参考素材。
- 新增 `test/mapAssetsManifest.test.js`，校验 manifest 本地安全路径、尺寸、alpha、token 引用和敏感字段过滤。
- 更新 README、brief、S72 路线图和共享上下文，说明 S72.3 已为 S72.4 前端地图 shell 提供首批素材。
- 本轮不改 PixiJS 前端、不提交 `public/vendor/pixi.min.js`、不改 provider schema、SQLite schema、存档格式或 `package.json`。

验证：

- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，最新完整运行 840 项通过、0 失败；此前一次完整运行出现 S67 large fixture 性能阈值波动和 `test/npcMindSalience.test.js` spawn EPERM，两个失败项单跑均通过。
- 已完成：只读子代理复审最终 diff 与验证证据，未发现 P0/P1；P2 台账尺寸错配已修正，P3 图标尺寸测试收紧为 256x256。

风险/遗留：

- 首批图标偏具象，适合 S72.4 首版可读性；后续 S72.6 可继续生成更抽象的印章式变体。
- 底图没有真实地名和 canonical 坐标语义，只作为 PixiJS 显示底层；地图标签、选中态和交互仍由 S72.4 前端实现。
- S72.4 仍需提交 PixiJS vendor、地图 shell、资源失败 fallback、canvas 非空和桌面/窄屏浏览器验证。

下一步：

- 执行 S72.4：Gemini CLI 基于 `mapRuntimeView` 和 `ink-map-v1` 素材实现 PixiJS 地图 shell，Codex 审查前端 diff 并提交。

### 2026-05-14

工具：Gemini CLI 前端 patch，Codex 审核、浏览器验证与收口。

步骤：S72.4 PixiJS 地图 shell 与图层系统。

提交：本次提交。

完成：

- 审核 Gemini 的 S72.4 前端 patch，并修复初审发现的脚本未加载、本地 vendor 缺失、隐式全局变量、未加载 S72.3 素材、Pixi 显示对象清理和 tooltip 边界处理问题。
- 新增 `public/vendor/pixi.min.js` 和 `public/vendor/pixi-LICENSE.txt`，固定 `pixi.js@7.4.3` UMD 本地优先；`index.html` 按契约加载本地 vendor、固定 CDN fallback、`mapRenderer.js`、`mapPanel.js` 和 `app.js`。
- 新增 `public/mapRenderer.js`，创建 PixiJS 图层，读取 `public/assets/maps/ink-map-manifest.json` 并加载底图、图标和事件涟漪；素材缺失时回退到基础 Graphics 渲染，重复 update 会销毁旧显示对象。
- 新增 `public/mapPanel.js` 和地图 CSS，提供地图 DOM shell、label、tooltip、资源失败/等待 fallback、`prefers-reduced-motion` 降级和行动草稿按钮；行动草稿只把服务器给出的 `actionDraft.actionText` 填入 `#action-input`，仍需玩家点击现有行动按钮提交。
- 新增 `test/mapFrontendShell.test.js`，校验本地 Pixi vendor/许可证、HTML 脚本顺序、地图脚本语法、manifest-driven 加载和 `app.js` 只读 `payload.mapRuntimeView` 接线。
- 更新 README、brief、S72 路线图和共享上下文，记录 S72.4 已完成并把下一步指向 S72.5。

验证：

- 已通过：`node --test test/mapFrontendShell.test.js test/mapAssetsManifest.test.js test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`git diff --check`。
- 已通过：临时 `PORT=3100 node server.js` 浏览器验证；默认 Mock 开局后地图面板可见、canvas 挂载、底图/图标/事件涟漪渲染、tooltip 可打开、行动草稿可回填输入框、控制台无错误。
- 已通过：`node --test test/dualModeAcceptanceScript.test.js`；完整 `npm test` 本轮运行 841 项通过、1 项失败，失败为既有 S67 large fixture 性能阈值波动 `fixtureGenerationMs 10482.177 > 10000`，该失败项随后单跑通过。
- 已完成：只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 提醒不要暂存浏览器验证残留的 session lock/tmp，本轮最终候选未包含此类文件。

风险/遗留：

- 地图图标和涟漪首版偏大、偏具象，适合 S72.4 可读性；S72.6 可继续做贴图尺寸、路线笔触和动效 polish。
- S72.4 只完成地图 shell 与行动草稿桥接；S72.5 仍需把点击地点/路线/事件与局势簿、行动草稿和服务器 proposal 深度联动。

### 2026-05-14

工具：Gemini CLI 前端 patch，Codex 审核、修正、浏览器验证与收口。

步骤：S72.5 地图与游戏系统深度联动。

提交：本次提交。

完成：

- 审核 Gemini 的 S72.5 前端联动 patch，并保留 `S72.5_DELIVERY_REPORT.md` 作为本轮 Gemini 交付说明。
- `public/mapRenderer.js` 新增统一选中态：地点、路线和事件涟漪点击都会在 selection 图层绘制安全视觉高亮；事件点击只把安全 `mapRuntimeView` target ref 与 `sourceRefs` 交给 tooltip，不读取 raw state 或后端内部行；事件贴图使用小范围 hitArea，避免透明外框抢占周边 marker 点击。
- 修正素材异步加载完成后的重绘路径，改走 `mapPanel` 现有 update 回调清理 DOM overlay，避免 label 因 renderer 自己二次 update 而重复。
- 根据只读子代理复审修正隐藏 tab 跳转的 stale DOM 边界：地图“查阅局势簿”只在当前已渲染的局势簿 DOM 内切换 tab 可见性，不触发 `app.js` 的分页重置与重渲染。
- `public/mapPanel.js` 的 tooltip 现在可从 `mapEntityRef`、`sourceRef` 和事件 `sourceRefs` 匹配已公开渲染的 `data-entity-id` / `data-event-id` 局势簿卡片；点击“查阅局势簿”会在局势簿现有 DOM 内切换 tab 可见性、重新定位已连接卡片并短暂高亮，避免旧 DOM 引用失效。
- 行动草稿仍只读取服务器 `actionDrafts` 字典，把 `actionDraft.actionText` 写入 `#action-input`，不自动提交、不调用 `POST /api/game/turn`、不伪造 proposal result、不直写 canonical 状态。
- 新增 `test/mapFrontendShell.test.js` 的 S72.5 源码回归断言，覆盖路线/地点选中态、事件安全 `sourceRefs`、局势簿安全卡片查找、DOM 内 tab 激活、行动草稿只回填输入框。
- 更新 README、brief、S72 路线图和共享上下文，记录 S72.5 已完成并把下一步指向 S72.6。

验证：

- 已通过：`node --test test/mapFrontendShell.test.js`。
- 已通过：`node --test test/mapFrontendShell.test.js test/mapAssetsManifest.test.js test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`。
- 已通过：`node --check public/mapPanel.js`。
- 已通过：`node --check public/mapRenderer.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：临时 `PORT=3100 node server.js` 浏览器验证；默认 Mock 开局后 canvas 非空、地图标签不重复、点击“大明”显示“查阅局势簿”、切到局势簿卡片并高亮、点击“赴童试”行动草稿只回填 `#action-input`、控制台无错误。
- 已通过：`node --test test/dualModeAcceptanceScript.test.js`。
- 已运行但未完全通过：`npm test`。失败项为既有 S67 large fixture 性能阈值波动，`fixtureGenerationMs 10658.028 > 10000`；本轮未改 S67 fixture，随后单跑 `test/dualModeAcceptanceScript.test.js` 已通过。
- 已完成：只读子代理复审最终 diff 与验证证据，未发现 P0/P1；P2 stale DOM 边界已修正，残余风险已记录。

风险/遗留：

- 事件涟漪首版仍以目标地点/路线为 tooltip 锚点；后续若局势簿为更多事件源提供稳定 `data-event-id`，S72.6/S72.7 可继续加强事件档案定位覆盖。
- 地图前端联动自动化仍以源码回归断言和本轮浏览器手测为主，隐藏 tab / 分页非首页的 DOM fixture 可在 S72.7 安全回归中继续补强。
- marker 图标自身仍使用 sprite 默认交互区域；若后续图标透明边距变大，S72.6 可为 marker 也补明确 hitArea。
- S72.5 不新增后端 proposal resolver；地图行动仍是自然语言草稿入口，真实移动、办案、军务、财政和外交后果继续由普通回合服务器裁决。

下一步：

- 执行 S72.6：水墨动效与视觉 polish，重点检查路线流动、事件涟漪、marker 状态、缩放/窄屏、资源失败降级和 reduced-motion。

### 2026-05-14

工具：Gemini CLI 前端 patch，Codex 审核、修正、测试、浏览器验证与收口。

步骤：S72.6 水墨动效与视觉 polish。

提交：本次提交。

完成：

- 审核 Gemini 的 S72.6 前端 polish patch，并保留 `S72.6_DELIVERY_REPORT.md` 作为本轮 Gemini 交付说明。
- `public/mapRenderer.js` 新增路线墨线 alpha 呼吸、事件涟漪 scale/alpha 扩散、事件动效按 severity 优先和动画数量上限；开启 `prefers-reduced-motion: reduce` 时不创建新增动画，且 tick 直接退出。
- 修正 Gemini patch 中会导致脚本语法失败的末尾残片，并修正路线对象没有 `baseScale` 却被通用 tick 写 scale 的 `NaN` 风险；路线现在只改 alpha，不重算路径几何。
- 地图 renderer 接入 `IntersectionObserver` 与 `visibilitychange` 守卫，地图离屏或浏览器 tab 隐藏时跳过 `onTick` 动效更新；销毁时清理 resize、intersection、visibility 和 media query 监听器。
- 选中态改为深朱砂双圈，tooltip、行动草稿按钮、局势簿跳转按钮和资源 fallback 面板改为更贴近案头舆图的纸色渐变、硬边与浅朱砂分隔线。
- `test/mapFrontendShell.test.js` 新增 S72.6 源码回归断言，覆盖动画上限、可见性守卫、路线/涟漪动效分支和朱砂选中态。
- 本轮不改后端逻辑、API/schema、SQLite 逻辑、provider schema、prompt 或正式地图素材。

验证：

- 已通过：`node --check public/mapRenderer.js`。
- 已通过：`node --test test/mapFrontendShell.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：本地 `AI_PROVIDER=mock PORT=3100 node server.js` 浏览器验证；桌面端 canvas 非空、地图点击显示 tooltip、朱砂双圈选中态可见、控制台无错误；窄屏端主布局与长文本无明显溢出，地图 canvas 存在且控制台无错误。
- 已运行但未完全通过：`npm test`。失败项为既有 S67 large fixture 性能阈值波动，`fixtureGenerationMs 10274.08 > 10000`；本轮未改 S67 fixture，随后单跑 `node --test test/dualModeAcceptanceScript.test.js` 已通过。
- 已完成：只读子代理最终 diff 复审，未发现 P0/P1/P2；P3 提醒 `S72.6_DELIVERY_REPORT.md` 仍是未跟踪文件，本轮提交会一并纳入。

风险/遗留：

- 本轮动效为轻量 alpha/scale，不引入 shader 或额外库；更细的纸面毛边晕染可留给后续素材或 S72 之后的视觉专项。
- S72.6 继续保持地图前端只读 `mapRuntimeView`，地图行动仍只回填自然语言草稿，不直写状态、不调用 resolver。

下一步：

- 执行 S72.7：做地图验收、安全与性能回归，覆盖浏览器 smoke、canvas 非空、资源失败降级、hidden/raw 不外泄和完整主线不回退。

### 2026-05-14

工具：Codex，子代理只读差距分析。

步骤：S72.7 验收、安全与性能回归。

提交：本次提交。

完成：

- 扩展 `scripts/browserSmoke.js`，把 PixiJS 地图纳入真实浏览器验收：桌面、恢复读档、新页面恢复、窄屏、资源失败和 `prefers-reduced-motion` 场景均检查地图面板、canvas 非空、label 数、动画数量、hidden/raw 文本防线和布局溢出。
- `public/mapRenderer.js` 新增只读 debug state、资源加载失败可观测状态、`preserveDrawingBuffer` 验收支持和无 manifest 时的纸色静态底层；资源失败时仍绘制基础舆图，不阻断文字主流程。
- `public/mapPanel.js` 对未知 `mapRuntimeView.schemaVersion` 进入等待降级，并暴露只读 debug state 给 browser smoke；仍只使用服务器 `mapRuntimeView` 和 action draft。
- `public/styles.css` 将地图高度收束为 `clamp(200px, 24vh, 280px)`，并把桌面游戏态书生信息面板限制为可滚动摘要区，修复 S72.7 browser smoke 捕获的 narrative / action 区域重叠。
- 更新 README、brief、运行时契约、S72 路线图和共享上下文，记录 S72.7 验收范围与下一步 S72.8 归档。

验证：

- 已通过：`node --check public/mapRenderer.js`。
- 已通过：`node --check public/mapPanel.js`。
- 已通过：`node --test test/browserSmokeScript.test.js test/mapFrontendShell.test.js test/mapAssetsManifest.test.js test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`。
- 已通过：`npm run smoke:browser -- --screenshots artifacts/s72-browser-smoke`，覆盖 desktop、mobile、four-exam-progression、mobile-final-archive、cheating-result、official-start、official-career、world-thread、role-world、pixi-map、map-resource-fallback 和 map-reduced-motion。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`npm run smoke:dual-mode -- --storage-only`。
- 已通过：`git diff --check`。
- 已通过：`node --test test/dualModeAcceptanceScript.test.js`。
- 已运行但未完全通过：`npm test`。失败项为既有 S67 large fixture 性能阈值波动，`informationPanelMs 3258.724 > 3000`；本轮未改 S67 fixture 或局势簿分页生成逻辑，随后单跑失败文件已通过。

风险/遗留：

- `preserveDrawingBuffer` 用于让 browser smoke 可做 canvas 像素级非空验收；当前地图规模较小，性能风险可接受，后续若地图复杂度显著增加，可用专门测试入口替代生产开关。
- S72.7 不新增地图 resolver 或后端行动后果；地图仍只是安全 view、tooltip、局势簿跳转和自然语言行动草稿入口。

下一步：

- 执行 S72.8：归档 S72 PixiJS 水墨地图专项，压缩活动台账，记录后续地图玩法方向与剩余风险。

### 2026-05-14

工具：Codex。

步骤：S72.8 S72 PixiJS 水墨地图专项归档。

提交：本次归档提交。

完成：

- 新增 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，把 S72.0-S72.8 的完成范围、步骤索引、稳定边界、验证入口和后续方向集中到独立归档。
- 将 `docs/DEVELOPMENT_STEPS.md` 收束为当前索引与后续边界：S72 活动小步骤全部改为 `DONE`，S72.8 不再保留 `TODO`。
- 压缩当前活动台账，使其不再保留 S72 进行中的长表和实现记录，避免下一位接手误判 S72 仍在推进。
- 更新 `docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `README.md` 的 S72 表述，使其改为“已完成归档”口径。
- 本轮不改运行时代码、API、provider schema、存档格式、SQLite 表结构、提示词、验证脚本或 AI 权限。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。

风险/遗留：

- 历史实现细节不在活动台账重复展开，后续追溯应阅读 `docs/PIXIJS_INK_MAP_ARCHIVE.md`、专题路线图和 Git history。
- 本轮是纯文档归档与压缩；未运行浏览器或回归测试，因为未改运行时代码。

下一步：

- 进入新的小步骤或后续专项，不再继续展开 S72 活动台账。
