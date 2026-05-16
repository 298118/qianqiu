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

当前活动路线图已进入 S73-S77 前端水墨重构专项。S72 的专项归档见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，规划源头见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。S73-S77 规划源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

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

S49-S67、本地数据库与大世界内容，S68-S69 科举深化，S70 AI 编排，S71 数据库玩法化和 S72 PixiJS 水墨地图都已迁入专题归档；当前活动工作从 S73-S77 前端水墨重构继续：

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S67 | DONE | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | DONE | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器面板和 Provider/Mock 验收 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |
| S70 | DONE | AI prompt/tool/actor/领域工具、多模型路由、AI 设置、月报、跳时、记忆、地图接口、MiMo AI-first smoke、JSON/SQLite parity 和 S70 归档 | [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) |
| S71 | DONE | 数据库 resolver 输入、SQLite 维护、安全搜索、redacted API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收归档 | [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md) |
| S72 | DONE | PixiJS 水墨地图、首批地图素材、局势簿联动、水墨动效、浏览器验收、安全回归和归档 | [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md) |
| S73-S77 | ACTIVE | 前端水墨重构：素材体系、React/Vite/React Router 多页迁移、首页/全局 shell、身份/场景专题、考试/放榜、独立舆图页、立绘管线、验收与归档 | [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。S70.12 起玩家 route response 内的兼容 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`，记忆与经历摘要只能通过安全 view 暴露。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

当前活动路线进入 S73-S77 前端水墨重构专项。S72 细节见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)；S73-S77 任务书见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。本节只保留当前专项小步骤、owner 和交接边界，不把 S49-S72 的 DONE 长表展开回活动台账。

| ID | 状态 | Owner | 目标 | 说明 |
| --- | --- | --- | --- | --- |
| S73.0 | DONE | Codex + medium 子代理 | 前端水墨重构规划 | 已新增 S73-S77 任务书，收束用户设想、创意发散、素材边界、安全边界和步骤拆分 |
| S73.0a | DONE | Codex + 只读子代理 | 详细蓝图、依赖路线与素材矩阵 | 已按用户补充要求把 S73-S77 扩展为可执行小步骤，记录 React/Vite 候选、素材矩阵、NPC 立绘安全边界和女性立绘安全边界；全量立绘口径已由 S73.0c 更新 |
| S73.0b | DONE | Codex | 多页信息架构与舆图页决策 | 已按用户要求确认旧前端单页壳会拥挤；S74 起改为 React Router 多页 SPA，地图重构为独立“舆图”页 |
| S73.0c | DONE | Codex | S73.10 台账补齐与全量立绘口径调整 | 已补齐 S73.10，并按用户要求改为 S73 内完成 300-400 张全量玩家/NPC 立绘池；S74-S77 必须通过已审核 `portraitRef` 使用 |
| S73.0d | DONE | Codex | 旧前端保留要求移除 | 已按用户要求确认重构可抛弃旧单页前端；S74 起新 React/Vite 前端直接接管默认 `/`，不再要求 `/ink-client/` 双入口、`/legacy.html` 或旧 `/` 保持可用 |
| S73.1 | DONE | Codex + 只读子代理 | 前端视觉资产指南 | 已新增 `FRONTEND_VISUAL_ASSET_GUIDE.md`，固定水墨/宣纸/奏折/身份/场景/立绘/动效/fallback 的尺寸、命名、颜色、裁切、审核和 manifest 前置标准 |
| S73.2 | DONE | Codex + 只读子代理 | UI manifest schema 与素材台账 | 已新增 `public/assets/ui/ink-ui-manifest.json` 草案、`FRONTEND_ASSET_LEDGER.md` 和 manifest 校验测试，覆盖审核状态、缩略图、fallback、性能、安全字段和 S73.10 立绘池懒加载规则 |
| S73.3 | DONE | Codex + medium 子代理创意草案 | UI 材质包 | 已生成并审核 16 个 UI 材质，覆盖宣纸、旧绢、奏折、竹简、卷轴、残纸、水渍、淡墨线、朱印按钮、印匣纹理、试卷界栏和皇榜纸底，已登记 manifest、缩略图和台账 |
| S73.4 | DONE | Codex + medium 子代理创意草案 | 首页资产包 | 已生成并审核 6 个首页资产，覆盖首页山水画卷、云雾层、题名册表单底、朱印开始按钮、首页案卷存档素材和低动效静态底，已登记 manifest、缩略图和台账 |
| S73.5 | DONE | Codex + medium 子代理创意草案 | 场景插画包 | 已生成并审核 10 张场景图，覆盖书斋、贡院号舍、放榜、殿试、县衙、公堂、军帐、御案、城市街巷和部院公文，已登记 manifest、缩略图和台账 |
| S73.6 | DONE | Codex + medium 子代理创意草案 | 身份背景包 | 已生成并审核 6 张身份背景，覆盖书生、地方官、入仕官员、大臣、将领和皇帝，已登记 manifest、缩略图、色彩权重、面板材料建议和台账 |
| S73.7 | DONE | Codex + medium 子代理创意草案 | 玩家/NPC 立绘风格基准 | 已生成并审核 24 张成人、端庄、高颜值、身份明确且不露骨的基准立绘，登记 `portraitRef`、缩略图、低清占位、manifest、QA sidecar 和台账 |
| S73.8 | DONE | Codex + medium 子代理创意草案 | 动效与 fallback 包 | 已生成并审核 8 个动效/fallback 素材，覆盖水墨云雾、墨迹扩散、朱印落章、纸页展开、榜文揭示、交卷朱封、淡墨擦拭和卷边揭页，已登记 manifest、缩略图、motion/reduced-motion 字段、QA sidecar 和台账 |
| S73.9 | DONE | Codex + 只读子代理差距分析 | 素材预览与 QA | 已新增 `scripts/frontendAssetQa.js`、`public/assets/ui/asset-qa-preview.html`、`public/assets/ui/asset-qa-report-v1.json` 和 `qa:frontend-assets` 命令，统一校验路径、尺寸、透明度、chroma-key 色边/深浅底合成、安全字段、审核状态、fallback 和未审核素材禁用 |
| S73.10 | IN_PROGRESS | Codex + 子代理创意草案/只读视觉复审 | 全量立绘生产与入库 | S73.10.1 已锁定 336 张 planned 立绘矩阵；S73.10.2 已生成并审核 192 张玩家池立绘（72 张身份阶段 + 60 张女性风格补充 + 60 张男性风格补充），玩家可选池男女各 96 张；S73.10.3 已生成并审核 188 张通用 NPC 立绘；后续继续生成重要 NPC、状态姿态和场景锚点，S74-S77 全部通过已审核 `portraitRef` 使用 |
| S73.10.1 | DONE | Codex + medium 子代理创意草案 | 立绘矩阵定稿 | 已新增 `docs/FRONTEND_PORTRAIT_MATRIX.md`、`public/assets/ui/portraits/portrait-pool-matrix-v1.json`、`scripts/frontendPortraitMatrix.js` 和 `qa:portrait-matrix`，锁定 336 张 planned 立绘、prompt 母版、fallback、懒加载和审核字段 |
| S73.10.2 | DONE | Codex + medium 子代理创意草案 | 玩家立绘池 | 已按矩阵生成 72 张玩家身份阶段立绘，并保留 60 张已审核女性玩家风格补充与 60 张已审核男性玩家风格补充，完成主图、缩略图、低清占位、视觉/安全审核、manifest 入库、QA sidecar 和台账登记；玩家可选池男女各 96 张 |
| S73.10.3 | DONE | Codex + medium 子代理创意草案 | 通用 NPC 立绘池 | 已生成并审核 188 张通用 NPC 立绘：一开始的 120 张矩阵通用 NPC 保留，20 张旧版源页作为 bonus 继续使用，48 张宫装/唐装女性风格扩展作为已审核补充池入库 |
| S74.0 | TODO | Codex + 只读依赖审阅子代理 | 依赖治理与 React 默认前端契约 | 通过治理后再安装 React、TypeScript、Vite、React Router、Zustand、Lucide、Vitest、Testing Library 和 jsdom；新增前端迁移契约，直接接管默认 `/` |
| S74.1 | TODO | Codex + 实施子代理 | Vite/TypeScript 默认前端 | 新增 `client/`、Vite config、TS config、client test config，构建输出接管默认浏览器入口；旧单页壳可替换或删除 |
| S74.2 | TODO | Codex + 实施子代理 | 安全 API client | 新前端只调用 start/saves/player-state/turn/exam/AI settings 安全接口，普通读档不碰 raw state route |
| S74.3 | TODO | Codex + 实施子代理 | 前端状态层 | 用轻量 store 保存 sessionId、安全 payload、drawer/modal/tab/action draft/display preferences，不保存 raw session |
| S74.4 | TODO | Codex + 实施子代理 | 多页 shell 与 route registry | 建立首页、主叙事、舆图、人物、史册、考试、放榜、朝议/官署、设置等路由和局部 surface host |
| S74.5 | TODO | Codex + 实施子代理 | 资产加载层 | 读取 UI manifest，按 role/scene/usage 懒加载素材、缩略图和 fallback，未审核素材默认不可用 |
| S74.6 | TODO | Codex | S72 地图运行时桥 | 旧 `public/app.js` 可替换或删除；新前端不依赖旧全局状态，地图桥只包装 S72 安全 map runtime |
| S74.7 | TODO | Codex | S74 默认入口验收 | 记录 Git revert/恢复上一提交的回退方式，验证默认 `/` 新前端能 Mock 开局，client typecheck/test/build 和新 smoke 通过 |
| S75.1 | TODO | Codex + 实施子代理 | 首页画卷布局 | React 首页显示“千秋”、水墨云雾、画卷背景和中央表单，支持桌面/移动和 reduced-motion |
| S75.2 | TODO | Codex + 实施子代理 | 开局表单 | 朝代、年份、身份、姓名、书生家境、自定义背景接入现有 start API，错误/loading/disabled 状态完整 |
| S75.3 | TODO | Codex + 实施子代理 | 朱印开始按钮 | 实现玉玺/朱印按钮、盖章反馈、低动效替代和防重复提交 |
| S75.4 | TODO | Codex + 实施子代理 | 右上角印匣 | 统一 AI 设置、存档/读档、返回首页、显示偏好和安全摘要，不暴露 key/prompt/path/raw |
| S75.5 | TODO | Codex + 实施子代理 | 案卷式存档/读档 | 存档列表显示 metadata，读档只走 `player-state`，进入新 GameScreen |
| S75.6 | TODO | Codex + 实施子代理 | 返回首页与继续本局 | 游戏中返回首页不删 session、不改服务器状态，首页可继续本局 |
| S75.7 | TODO | Codex + 实施子代理 | 显示偏好 | 动效、字体大小、对比度、自动滚动和地图动效保存在本地安全偏好 |
| S75.8 | TODO | Codex + 实施子代理 | 底部奏折输入雏形 | 固定竹简/奏折输入、身份 placeholder、Enter 提交、Shift+Enter 换行和“呈上”朱印按钮 |
| S75.9 | TODO | Codex | S75 浏览器验收 | 扩展 browser smoke 覆盖新首页、设置、存档、返回首页、继续本局、移动端和低动效 |
| S76.1 | TODO | Codex + 实施子代理 | 主游戏壳 | 顶栏、叙事卷、场景插画带、功能页签和底部奏折组成清爽主界面 |
| S76.2 | TODO | Codex + 实施子代理 | 书生面板 | 书斋、读书簿、老师点评、师友、科期、文章练习和赶考入口，保护完整科举路径 |
| S76.3 | TODO | Codex + 实施子代理 | 地方官面板 | 县衙/公堂、案牍、钱粮、水利、盗匪、词讼和士绅关系入口，行动只生成草稿 |
| S76.4 | TODO | Codex + 实施子代理 | 入仕官员/大臣面板 | 官职履历、部院公文、同年座师、派系、考成、弹劾和奏疏入口 |
| S76.5 | TODO | Codex + 实施子代理 | 将领面板 | 军帐、粮饷、斥候、边患、军令草案和战报入口，不让前端直接结算战役 |
| S76.6 | TODO | Codex + 实施子代理 | 皇帝面板 | 御案、奏折队列、朱批、圣旨草稿、朝议和任免预留；前端只做草稿/proposal 入口 |
| S76.7 | TODO | Codex + 实施子代理 | 科举考试全屏 | 贡院号舍背景、试卷区、考题、写作区、考试阶段、虚拟考生和交卷朱印 |
| S76.8 | TODO | Codex + 实施子代理 | 放榜全屏 | 皇榜、三鼎甲朱砂章、排名列表、玩家高亮、评语/评分/防作弊展开 |
| S76.9 | TODO | Codex + 实施子代理 | 独立舆图页与地图重构 | 将 S72 地图从主界面小面板升级为独立路由，支持大画布、图层筛选、tooltip、局势簿跳转、行动草稿和资源失败 fallback |
| S76.10 | TODO | Codex + 实施子代理 | NPC 与玩家立绘接线 | `Portrait` 只接 S73.10 已审核 `portraitRef` 和安全公开 view；未审核立绘不显示，不一次性加载全量池 |
| S76.11 | TODO | Codex | 专题 surface 扩展位 | 预留奏折、圣旨、朝议、堂审、军议、人物档案等 surface；无安全 projection 时只显示草稿/占位 |
| S76.12 | TODO | Codex | S76 验收 | 验证书生完整路径、代表身份行动、考试/放榜、地图、hidden/raw 防线和移动端 |
| S77.1 | TODO | Codex | 默认入口确认 | 确认 `/` 已由新 React 前端接管，刷新多页路由不 404；不要求 `/legacy.html`、`/ink-client/` 或旧单页壳可用 |
| S77.2 | TODO | Codex + 只读复审子代理 | Browser smoke 扩展 | 覆盖首页、设置、存档、返回首页、主游戏、地图、考试、放榜、身份行动、资源失败、低动效和移动端 |
| S77.3 | TODO | Codex + 只读复审子代理 | 视觉与像素检查 | 首页/地图/考试/放榜非空，桌面/移动无明显重叠，素材无现代元素、水印、乱码、露骨或幼态问题 |
| S77.4 | TODO | Codex + 只读复审子代理 | 安全污染防线 | DOM/localStorage/manifest/screenshot 不出现 key、本地路径、raw prompt/provider、hidden/raw 词样 |
| S77.5 | TODO | Codex | 性能与资源预算 | 首屏只加载必要素材，场景和 S73.10 全量立绘池按需加载，全量立绘不进首屏 bundle |
| S77.6 | TODO | Codex | 可访问性 | Enter/Shift+Enter/Esc/焦点回收、字体大小、对比度、低动效和按钮文本不溢出 |
| S77.7 | TODO | Codex | 文档与归档 | 更新 README、brief、共享上下文、活动台账并新增 `FRONTEND_INK_REDESIGN_ARCHIVE.md` |
| S77.8 | TODO | Codex + 只读复审子代理 | 总验收 | `npm test`、client typecheck/test/build、browser smoke、exam smoke、dual-mode、docs governance 和 diff check |

## 5. 进度记录

### 2026-05-15

工具：Codex，medium 子代理上下文核对，提交前只读复审。

步骤：S73.10.2b 玩家男性风格补充池。

提交：本次提交。

完成：

- 针对用户反馈“怎么全是女角色，男的呢”，额外新增 60 张玩家可选男性风格立绘，覆盖书院文士、唐风圆领袍、朝堂文官、宫廷贵胄、中枢重臣、边塞将领、禁军武官、士族公子、商贾东家和行旅策士等 10 类，每类 6 张。
- 这些图归入 `player_male_style_pool` 和 `portrait_pool_player_male_extra_s73_10`，不是 NPC 通用池；S73.10.2 玩家可选池现在为 192 张，其中男性 96 张、女性 96 张。
- 新增 `scripts/frontendPlayerMalePortraitAssets.js` 与 `qa:player-male-portraits` / `qa:player-male-portraits:write`，同步 `public/assets/ui/portraits/portrait-player-male-extra-qa-v1.json`、manifest、缩略图、低清占位、测试和素材台账。
- 开发规范已补充男性补充池的后续使用规则：玩家选角只能通过已审核 `portraitRef`、缩略图和 fallback 按需加载；男性池需突出成年男性肩颈、上身轮廓、冠服层次、身份姿态和服饰差异，同时保持端庄、完整衣着和历史水墨气质。

验证：

- 已完成：Codex 视觉审核 10 张男性补充源页，确认成人、男性气质明确、服饰完整、身份差异清楚，无现代物、水印、可读文字、露骨或幼态问题。
- 已通过：`npm run qa:player-male-portraits`。
- 已通过：`npm run qa:player-female-portraits`。
- 已通过：`npm run qa:player-portraits`。
- 已通过：`npm run qa:generic-npc-portraits`。
- 已通过：`npm run qa:portrait-matrix`。
- 已通过：`npm run qa:frontend-assets`，当前 QA 报告覆盖 450 个素材、19 个透明素材、0 errors、0 warnings。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，857 项通过、0 失败。

风险/遗留：

- S74-S77 玩家选角应把 `player_female_style_pool` 与 `player_male_style_pool` 都视为玩家池，不得把额外男性或女性补充池混入 NPC 通用池，也不得显示未审核源页。

下一步：

- 继续执行 S73.10.4 重要 NPC 专属池。

### 2026-05-15

工具：Codex，medium 子代理创意发散，提交前只读复审。

步骤：S73.10.2a 玩家女性立绘重置与风格补充。

提交：本次提交。

完成：

- 按用户反馈重置 S73.10.2 玩家身份阶段中的 36 张女性立绘，旧版女性图不再作为当前 manifest 目标；新版以完整服饰、上身衣料层次、腰封细腰、姿态和服饰层次强化成年女性特征，同时保持端庄历史气质。
- 额外新增 60 张玩家可选女性风格立绘，覆盖宫装贵人、女官、宫廷读书人、高阶宫人、唐装、士族、商贾和边关将领等 10 类，每类 6 张；这些图归入 `player_female_style_pool` 和 `portrait_pool_player_female_extra_s73_10`，不是 NPC 通用池。
- 新增 `scripts/frontendPlayerFemalePortraitAssets.js` 与 `qa:player-female-portraits` / `qa:player-female-portraits:write`，同步 `public/assets/ui/portraits/portrait-player-female-reset-qa-v1.json`、`portrait-player-pool-qa-v1.json`、manifest、缩略图、低清占位、测试和素材台账。
- 视觉/安全边界已写入开发规范：所有额外女性立绘必须是成年、端庄、完整衣着；可表现衣料层次、束腰和姿态差异，但不得低胸、透视、裸露、挑逗、幼态、现代化、水印或可读文字。

验证：

- 已完成：Codex 视觉审核 6 张女性重置源页和 10 张女性风格补充源页；原 `xiucai-juren` 源页因疑似伪文字已拒绝并重生成干净版本，拒绝源页未进入 runtime manifest。
- 已通过：`npm run qa:player-female-portraits`。
- 已通过：`npm run qa:player-portraits`。
- 已通过：`npm run qa:frontend-assets`。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，857 项通过、0 失败。
- 已完成：提交前只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 提醒的 standalone QA SHA 校验和 Markdown BOM 均已修正。

风险/遗留：

- S74-S77 玩家选角只能通过已审核 `portraitRef`、缩略图和 fallback 按需加载这 60 张额外女性玩家立绘；不得硬编码路径、不得把玩家补充池混入 NPC 通用池、不得显示未审核源页。

下一步：

- 继续执行 S73.10.4 重要 NPC 专属池。

### 2026-05-15

工具：Codex，medium 子代理创意发散，提交前只读复审。

步骤：S73.10.3 通用 NPC 立绘池。

提交：本次提交。

完成：

- 按用户要求继续由 medium 子代理做创意发散 prompt 草案，Codex 定稿通用 NPC、bonus 旧版源页和女性宫装/唐装扩展的出图、裁切、审核、manifest 与 QA 字段。
- 使用 `gpt-image-2` 生成并审核通用 NPC 立绘源页，裁切入库 188 张 1024x1536 WebP、384x576 缩略图和 64x96 低清占位：一开始的 120 张矩阵通用 NPC 完整保留，20 张旧版源页作为 `bonus_generic_npc` 继续使用，48 张宫装/唐装女性风格扩展作为 `female_style_pack` 补充池入库。
- 新增 `scripts/frontendGenericNpcPortraitAssets.js` 与 `qa:generic-npc-portraits` / `qa:generic-npc-portraits:write`，同步 `ink-ui-manifest.json`、`public/assets/ui/portraits/portrait-generic-npc-pool-qa-v1.json`、`public/assets/ui/asset-qa-report-v1.json` 和 `test/frontendInkAssetsManifest.test.js`；同时确认 S73.10.2 既有 60 张女性玩家风格补充继续作为已审核素材保留，不浪费已生成立绘。
- 女性风格扩展按用户反馈收束为宫装与唐装，不再新增医者、僧道、驿卒、武官女性组；角色为成年年轻至轻熟、苗条、上身服饰层次清楚、腰身收束，不露胸、不挑逗、不幼态、不发福化，并提高对比度、丰富色彩、降低噪点。
- 同步 README、brief、路线图、视觉规范、立绘矩阵、素材台账和共享上下文；本轮不安装依赖、不改游戏运行时代码、API、provider schema、SQLite schema、存档格式、AI 权限或游戏规则。

验证：

- 已完成：Codex 视觉审核 `artifacts/s73-10-review/generic-npc-matrix-120.png`、`artifacts/s73-10-review/generic-npc-bonus-20.png`、`artifacts/s73-10-review/generic-npc-female-style-48.png`，确认 120 张矩阵主体、20 张 bonus 和 48 张女性风格扩展均成人端庄、古代服饰、小尺寸可读，无现代器物、水印、可读文字、露骨、挑逗或幼态问题。
- 已通过：`npm run qa:generic-npc-portraits`。
- 已通过：`npm run qa:player-portraits`。
- 已通过：`npm run qa:player-female-portraits`。
- 已通过：`npm run qa:portrait-matrix`。
- 已通过：`npm run qa:frontend-assets`，当时 QA 报告覆盖 390 个素材、19 个透明素材、0 errors、0 warnings。
- 已通过：`npm run qa:frontend-assets`。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，857 项通过、0 失败。
- 已完成：提交前只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 提醒的 standalone QA SHA 校验和 Markdown BOM 均已修正。

风险/遗留：

- S73.10.3 已可通过 manifest 中已审核 `portraitRef` 使用；`portrait-pool-matrix-v1.json` 的 336 张 planned 目标不因额外补充池改变。
- rejected/candidate 源页只保存在开发产物目录，未进入 runtime manifest；S74-S77 仍不得硬编码图片路径、显示未审核立绘或一次性加载全量池。
- 下一步为 S73.10.4 重要 NPC 专属池，重要 NPC 仍不得混入通用头像池。

下一步：

- 执行 S73.10.4：生成重要 NPC 专属立绘池，继续保护 hidden 私档和未公开关系，专属角色只通过已审核 `portraitRef` 按公开视野使用。

### 2026-05-15

工具：Codex，medium 子代理创意发散，提交前只读复审。

步骤：S73.10.2 玩家立绘池。

提交：本次提交。

完成：

- 按用户要求继续由 medium 子代理做创意发散 prompt 草案，Codex 定稿 12 个身份阶段的出图 prompt、生成策略、视觉审核、安全审核和入库字段。
- 使用 `gpt-image-2` 生成 12 张 3x2 阶段源图页，覆盖书生、童试考生、秀才、举人、贡士、进士、初任官、地方官、京官、大臣、将领、皇帝/摄政；每阶段裁出 `m01/m02/m03/f01/f02/f03` 六个成人端庄变体。
- 新增 `scripts/frontendPlayerPortraitAssets.js` 与 `qa:player-portraits` / `qa:player-portraits:write`，把源图页裁切为 72 张 1024x1536 WebP、生成 384x576 缩略图和 64x96 低清占位，并写入 manifest 与 QA sidecar。
- 新增 `public/assets/ui/portraits/s73-10/` 玩家立绘、对应 `public/assets/ui/thumbs/` 缩略图、`public/assets/ui/portraits/placeholders/` 低清占位和 `public/assets/ui/portraits/portrait-player-pool-qa-v1.json`；`ink-ui-manifest.json` 当前 active 素材数从 70 增至 142。
- `test/frontendInkAssetsManifest.test.js` 扩展 S73.10.2 断言，校验玩家池数量、12 个身份阶段、每阶段 6 个变体、懒加载组、低清占位、缩略图、QA 哈希和安全字段；`asset-qa-report-v1.json` 当时已刷新到 142 个 active 素材、19 个透明素材、0 errors、0 warnings。
- 同步 README、brief、路线图、素材台账和共享上下文；本轮不安装依赖、不改游戏运行时代码、API、provider schema、SQLite schema、存档格式、AI 权限或游戏规则。

验证：

- 已完成：Codex 视觉审核 `artifacts/s73-10-player-contact-sheet.webp`，确认 72 张玩家立绘成人端庄、身份阶段递进清楚、无现代器物、无水印、无可读文字、无露骨/挑逗/幼态问题。
- 已通过：`npm run qa:player-portraits`。
- 已通过：`npm run qa:portrait-matrix`。
- 已通过：`npm run qa:frontend-assets:write`，生成 142 个素材、19 个透明素材、0 errors、0 warnings 的 QA 报告。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，856 项通过、0 失败。
- 已完成：提交前只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 提醒的历史 S73.9 “70 个 active 素材”表述已改为当时/当前口径。

风险/遗留：

- S73.10.2 玩家池已可通过 manifest 中已审核 `portraitRef` 使用；`portrait-pool-matrix-v1.json` 仍作为生产矩阵保留 planned 状态，不作为 runtime manifest。
- 后续 S73.10.3-S73.10.5 仍需生成通用 NPC、重要 NPC、状态姿态和场景锚点；S74-S77 仍不得硬编码图片路径、显示未审核立绘或一次性加载全量池。

下一步：

- 执行 S73.10.3：按矩阵生成 120 张通用 NPC 立绘池，继续使用 medium 子代理做创意发散，Codex 定稿 prompt、生成、视觉审核、manifest 入库和 QA。

### 2026-05-15

工具：Codex，medium 子代理创意发散，提交前只读复审。

步骤：S73.10.1 全量立绘矩阵定稿。

提交：本次提交。

完成：

- 按用户要求由 medium 子代理先做创意发散 prompt 草案，Codex 定稿矩阵、生产边界、审核字段和测试。
- 新增 `docs/FRONTEND_PORTRAIT_MATRIX.md`，把 S73.10 全量立绘池锁定为 336 张 planned 立绘：玩家身份阶段 72、通用 NPC 120、重要 NPC 72、状态姿态 48、场景锚点 24。
- 新增 `public/assets/ui/portraits/portrait-pool-matrix-v1.json`，逐条预置 `portraitRef`、usage、role、genderPresentation、ageBand、statusVariant、promptTemplateRef、生成目标路径、fallback、懒加载分组、safeArea、focalPoint 和审核字段；所有条目保持 `reviewStatus=planned`、`runtimeUsable=false`，不进入 `ink-ui-manifest.json` 可用资产集合。
- 新增 `scripts/frontendPortraitMatrix.js` 与 `qa:portrait-matrix` / `qa:portrait-matrix:write`，校验数量、分组、唯一 `portraitRef`、安全路径、prompt 母版非参数化、成人 ageBand、fallback、未生成不可用和矩阵文档存在。
- `test/frontendInkAssetsManifest.test.js` 扩展 S73.10.1 断言，确保矩阵不泄漏本地路径/key/远程 URL，不把 planned 立绘伪装成 manifest 可用素材，并检查创意 prompt 母版与安全交接文档。
- 同步 README、brief、路线图、素材台账和共享上下文；本轮不生成实际图片、不安装依赖、不改游戏运行时代码、API、provider schema、SQLite schema、存档格式、AI 权限或游戏规则。

验证：

- 已通过：`npm run qa:portrait-matrix`。
- 已通过：`npm run qa:frontend-assets`。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，855 项通过、0 失败。
- 已完成：提交前只读子代理复审最终 diff 与验证证据；首轮复审发现 P2 文档验证状态滞后和 P3 建议把重要 NPC 不混入通用池写成测试断言，均已修正，无剩余 P0/P1/P2。

风险/遗留：

- `portrait-pool-matrix-v1.json` 是生产矩阵，不是可用素材 manifest；S74-S77 仍只能读取 `ink-ui-manifest.json` 中已审核且 runtime usable 的 `portraitRef`。
- 336 张全量池仍需 S73.10.2-S73.10.8 分批生成、视觉/安全审核、缩略图、低清占位、manifest 入库和台账登记；下一步优先做 72 张玩家身份阶段立绘。

下一步：

- 执行 S73.10.2：按矩阵生成玩家身份阶段立绘池，继续使用 medium 子代理做创意草案，Codex 定稿 prompt、生成、视觉审核和入库。

### 2026-05-15

工具：Codex，只读子代理差距分析，提交前只读复审。

步骤：S73.9 素材预览与 QA。

提交：本次提交。

完成：

- 新增 `scripts/frontendAssetQa.js`，读取 `public/assets/ui/ink-ui-manifest.json`，校验全部 active 素材路径、尺寸、alpha、bytes、缩略图、审核状态、fallback、性能预算、立绘低清占位和敏感字段，并提供 `--write --pixel` 生成报告、`--check` 校验报告。
- 新增 `public/assets/ui/asset-qa-report-v1.json`，覆盖当前 70 个已审核素材和 19 个透明素材；透明素材统一记录宣纸底/深色底合成指标、可见 alpha、边界 alpha、高饱和绿/紫像素和硬 alpha 跳变，当前 0 errors、0 warnings。
- 新增 `public/assets/ui/asset-qa-preview.html`，可直接作为 S73/S74 资产预览页，按阶段/分类/搜索筛选 manifest 素材，透明素材同时显示宣纸底和深色底合成。
- `package.json` 新增 `qa:frontend-assets` 与 `qa:frontend-assets:write`；`test/frontendInkAssetsManifest.test.js` 扩展 S73.9 断言，确保 QA 报告覆盖全部 active 素材、全部透明素材 pixel QA、报告 hash 与 manifest 同步、预览页和脚本入口存在。
- 本轮不新增图片、不安装依赖、不改游戏运行时代码、API、provider schema、SQLite schema、存档格式、提示词或 AI 权限；QA pixel 采样复用现有 `playwright-core` 与本机 Chrome/Edge。

验证：

- 已通过：`node scripts/frontendAssetQa.js --write --pixel`，生成 70 个素材、19 个透明素材、0 errors、0 warnings 的 S73.9 QA 报告。
- 已通过：`npm run qa:frontend-assets`。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，853 项通过、0 失败。
- 已完成：只读子代理复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 提醒的“复审待完成”和完整验证证据记录已在本次 amend 中补齐。

风险/遗留：

- S73.9 是静态素材 QA 工具，不接入前端 runtime；S74.5 资产加载层仍需在 React 侧禁止未审核素材默认可用，并只通过 manifest/fallback 读取。
- `asset-qa-preview.html` 是本地预览入口，不是玩家界面；后续若移动裁切需要截图级 QA，可在 S77 浏览器/像素检查中继续扩展。

下一步：

- 执行 S73.10：在 S73 内完成 300-400 张全量玩家/NPC 立绘池生成、缩略图、压缩、视觉/安全审核、manifest 入库和台账登记。

### 2026-05-15

工具：Codex，medium 子代理创意发散，Codex 视觉审核，提交前只读复审。

步骤：S73.8 动效与 fallback 包。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/effects/` 的 8 个动效/fallback 素材和 `public/assets/ui/thumbs/` 的对应缩略图：水墨云雾缓入层、墨迹扩散圆晕、无字朱印落章、纸页展开横幅、榜文揭示纸幕、考试交卷朱封、淡墨分场擦拭和卷边揭页角标。
- 新增 `public/assets/ui/effects/effect-motion-qa-v1.json`，记录每个动效素材的安全项目路径、SHA-256、bytes、透明度、边界 alpha 指标、Codex 视觉审核摘要和 reduced-motion policy。
- `public/assets/ui/ink-ui-manifest.json` 继续保持 `assets_active`，登记 S73.8 动效素材的安全路径、缩略图、fallback、`reducedMotionFallback`、尺寸、safeArea、focalPoint、mobileCrop、`motion.type`、`motion.suggestedUse`、最长建议时长、性能预算、来源摘要、视觉审核和安全审核；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、AI 权限或游戏规则。

验证：

- 已通过：Codex 视觉审核，确认 8 个素材符合水墨/宣纸/奏折案头基调；无可读文字、水印、现代 UI/器物、本地路径、key、raw/hidden 内容或未公开剧情事实；榜文揭示素材不含实际名次、分数或评语。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 最新完整 `npm test` 已运行但未完全通过：独立工具调用读到 S73.7 旧口径导致 `70 !== 62`；已在最终提交事务中写回 S73.8 并通过聚焦验证，完整重跑留待 S73.9 或后续长跑复核。
- 已完成：提交前只读复审发现 P1/P2 旧口径风险，已修正 manifest、测试、台账和交接文档。

风险/遗留：

- S73.8 只提供静态关键帧/贴图和动效建议，运行时仍需在 S75-S77 阶段按 `prefers-reduced-motion` 或用户关闭动效设置禁用动画。
- 动效只作视觉反馈或转场遮罩，不改变游戏状态；交卷、榜单、分数、晋级、防作弊和服务器裁决仍由后端拥有。
- `ui-effect-page-curl-v1` 边界 alpha 触边是角标锚点设计，接入时必须避免遮挡正文、按钮或考试输入。

下一步：

- 执行 S73.9：素材预览与 QA。把 S73.4 透明素材经验、S73.7 立绘 QA 和 S73.8 动效 QA 收束成可复用预览/检查脚本。



工具：Codex，medium 子代理创意发散，Codex 视觉审核，提交前只读复审。

步骤：S73.7 玩家/NPC 立绘风格基准。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/portraits/` 的 24 张基准立绘和 `public/assets/ui/thumbs/` 的对应缩略图，覆盖玩家书生、举人/进士、初任官员、县令、吏员、部院郎官、大臣、将领、摄政/皇帝、老师、女书生、女官、宫廷人物、考官、商贾、士绅和市井人物。
- 新增 `public/assets/ui/portraits/placeholders/` 的 24 张 64x96 低清占位，并新增 `public/assets/ui/portraits/portrait-baseline-qa-v1.json` 记录压缩后 SHA-256、bytes、缩略图、低清占位和 Codex 视觉审核摘要。
- `public/assets/ui/ink-ui-manifest.json` 继续保持 `assets_active`，登记 S73.7 立绘的安全路径、`portraitRef`、缩略图、低清占位、fallback、尺寸、safeArea、focalPoint、mobileCrop、懒加载分组、性能预算、来源摘要、视觉审核和安全审核；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- `docs/FRONTEND_ASSET_LEDGER.md` 登记每个立绘的 `portraitRef`、身份/职业、性别呈现、成年分层、状态/情绪、路径、缩略图、低清占位、fallback、小尺寸可读性、成人端庄审核、现代/水印/乱码审核、manifest ledgerId 和懒加载分组。
- `test/frontendInkAssetsManifest.test.js` 扩展为校验 S73.7 active portrait 数量、阶段、分类、真实图片存在性、WebP 尺寸、性能预算、缩略图、低清占位、`portraitRef`、role token、成人分层、懒加载、QA sidecar 和安全字段。
- 更新 README、brief、路线图和共享上下文，记录 S73.7 已完成并把下一步指向 S73.8 动效与 fallback 包。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、AI 权限或游戏规则。

验证：

- 已通过：Codex 视觉审核，确认 24 张立绘均为成人端庄水墨淡彩风格，身份符号清楚，小尺寸可辨；无露骨、挑逗、幼态、现代物、水印、徽标、可读文字、本地路径、key、raw/hidden 内容或未公开剧情事实。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`（仅提示 `docs/FRONTEND_ASSET_LEDGER.md` 下次 Git 触碰时 CRLF 会替换为 LF，无 whitespace error）。
- 已通过：`npm test`（850 项通过、0 失败，耗时约 130 秒）。
- 待完成：提交前只读复审最终 diff 与验证证据。

风险/遗留：

- S73.7 使用极淡宣纸底而非强制透明，降低发丝、头冠和衣袖边缘抠图风险；S73.10 可继续评估是否为特定角色补透明版本。
- 本步是风格基准，不等同于全量池；S73.10 仍需完成 300-400 张全量玩家/NPC 立绘，并为重要 NPC 建立专属池。
- 立绘尚未接入运行时界面；S74.5/S76.10 通过资产加载层和 `Portrait` 组件按已审核 `portraitRef`、缩略图和 fallback 懒加载。

下一步：

- 执行 S73.8：动效与 fallback 包。生成并审核云雾、墨迹扩散、朱印落章、纸页展开、榜文揭示、交卷火漆印等动效或静态序列，并提供 reduced-motion 替代。

### 2026-05-14

工具：Codex，medium 子代理创意发散，Codex 视觉审核，待提交前只读复审。

步骤：S73.6 身份背景包。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/roles/` 的 6 个身份背景和 `public/assets/ui/thumbs/` 的对应缩略图：`role-scholar-study-v1.webp`、`role-magistrate-yamen-desk-v1.webp`、`role-official-duty-room-v1.webp`、`role-minister-palace-desk-v1.webp`、`role-general-frontier-tent-v1.webp`、`role-emperor-imperial-desk-v1.webp`。
- 视觉审核保留 6 张主包；地方官早稿因右下卷宗出现疑似伪文字未入库，Codex 重生成卷宗和盒面更干净的版本后再入库。
- `public/assets/ui/ink-ui-manifest.json` 继续保持 `assets_active`，登记 S73.6 身份背景的安全路径、缩略图、fallback、尺寸、safeArea、focalPoint、mobileCrop、reduced-motion fallback、性能预算、来源摘要、视觉审核、安全审核和 `roleStyle.colorWeightsPercent` / 面板材料建议；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- `docs/FRONTEND_ASSET_LEDGER.md` 登记每个身份背景素材的来源类型、工具/模型、prompt 摘要、负面约束摘要、后处理、许可说明、Codex 视觉审核、安全审核、色彩权重和面板材料建议。
- `test/frontendInkAssetsManifest.test.js` 扩展为校验 S73.6 active assets 的数量、阶段、分类、真实图片存在性、WebP 尺寸、性能预算、缩略图 bytes、role token、roleStyle、reduced-motion fallback、台账记录和安全字段。
- 更新 README、brief、路线图和共享上下文，记录 S73.6 已完成并把下一步指向 S73.7 玩家/NPC 立绘风格基准。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。

验证：

- 已通过：Codex 视觉审核，确认 6 个身份背景符合水墨、宣纸、身份层级、低对比留白和同批一致性；无可读文字、水印、现代 UI、本地路径、key、raw/hidden 内容或未公开剧情事实。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`（仅提示 `docs/FRONTEND_ASSET_LEDGER.md` 下次 Git 触碰时 CRLF 会替换为 LF，无 whitespace error）。
- 已通过：`npm test`（849 项通过、0 失败，耗时约 133 秒；首次 124 秒超时未产生日志，拉长超时后完整通过）。
- 已完成：提交前只读复审最终 diff 与验证证据，未发现 P0/P1/P2；复审确认 manifest/台账/测试覆盖 S73.6，且不与 S73.0d 默认入口新口径冲突。

风险/遗留：

- 身份背景尚未接入运行时界面；S74.5/S76 通过资产加载层和多页身份/场景界面按 usage/role 懒加载。
- S73.6 只做静态身份背景，不做人物立绘；S73.7 继续做 24-40 张成人、端庄、高颜值、身份明确且不露骨的玩家/NPC 立绘风格基准。

下一步：

- 执行 S73.7：玩家/NPC 立绘风格基准。继续把创意发散 prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、生图、视觉/安全审核、manifest/台账入库和提交。

### 2026-05-14

工具：Codex，提交前只读复审。

步骤：S73.0d 旧前端保留要求移除。

提交：本次提交。

完成：

- 按用户最新要求确认“既然是重构，以前旧的全都可以抛弃”，移除 S74-S77 中旧前端必须继续可用的规划约束。
- 将 S74 路线从 `/ink-client/` 并行前端岛改为新 React/Vite 多页前端直接接管默认 `/`；旧 `public/index.html`、`public/app.js` 和 `public/styles.css` 可在实施步骤中替换或删除。
- 移除 `/legacy.html`、旧 `/` 保持可用、S77 才切默认入口等交付要求；回退方式改为 Git revert 或恢复上一提交，不在产品里保留双入口。
- 保留 `npm install && npm start` 可运行、Mock 默认可玩、完整书生路径、S72 地图安全 runtime、AI proposal-only 和 hidden/raw 防线。
- 同步 README、brief、视觉资产指南、路线图和共享上下文，使后续 S74.0 依赖治理按“新前端直接接管默认入口”推进。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审本轮文档 diff 和验证证据。

风险/遗留：

- 本轮只改规划/交接文档，不删除旧前端文件、不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或验证脚本。
- 本条与 S73.6 身份背景收口同处当前工作树；已在提交前复核并拆分边界，S73.0d 只改规划口径，S73.6 继续作为素材/manifest/台账改动单独收口。

下一步：

- 继续收口或验证 S73.6 身份背景包；S74.0 开始时按新口径直接规划默认 `/` 前端，不再为旧单页壳保留交付入口。

### 2026-05-14

工具：Codex，medium 子代理创意发散，Codex 视觉审核，待提交前只读复审。

步骤：S73.5 场景插画包。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/scenes/` 的 10 个场景插画和 `public/assets/ui/thumbs/` 的对应缩略图：`scene-study-chamber-v1.webp`、`scene-exam-cell-v1.webp`、`scene-ranking-wall-v1.webp`、`scene-palace-exam-hall-v1.webp`、`scene-county-yamen-v1.webp`、`scene-courtroom-trial-v1.webp`、`scene-military-tent-v1.webp`、`scene-imperial-desk-v1.webp`、`scene-city-lanes-v1.webp`、`scene-bureau-documents-v1.webp`。
- 视觉审核保留 10 张主包；放榜早稿因榜纸边缘可能带印章/符号风险未入库，军帐早稿因管状军器灰区未入库，部院公文早稿因卷宗印章标记偏多未入库，均由 Codex 重生成更干净版本后再入库。
- `public/assets/ui/ink-ui-manifest.json` 继续保持 `assets_active`，登记 S73.5 场景资产的安全路径、缩略图、fallback、尺寸、safeArea、focalPoint、mobileCrop、reduced-motion fallback、性能预算、来源摘要、视觉审核和安全审核；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- `docs/FRONTEND_ASSET_LEDGER.md` 登记每个场景素材的来源类型、工具/模型、prompt 摘要、负面约束摘要、后处理、许可说明、Codex 视觉审核、安全审核、safeArea 和移动裁切说明。
- `test/frontendInkAssetsManifest.test.js` 扩展为校验 S73.5 active assets 的数量、阶段、分类、真实图片存在性、WebP 尺寸、性能预算、缩略图 bytes、场景 token、reduced-motion fallback、台账记录和安全字段。
- 更新 README、brief 和共享上下文，记录 S73.5 已完成并把下一步指向 S73.6 身份背景包。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。

验证：

- 已通过：Codex 视觉审核，确认 10 个场景素材符合水墨、宣纸、历史场景、低对比留白和同批一致性；无可读文字、水印、现代 UI、本地路径、key、raw/hidden 内容或未公开剧情事实。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`，仅提示 `docs/FRONTEND_ASSET_LEDGER.md` CRLF 将被 Git 规范化为 LF，无空白错误。
- 已通过：`npm test`，849 项通过、0 失败。
- 已完成：提交前只读复审最终 diff 与验证证据，未发现 P0/P1/P2；P3 建议把 S73.5 asset id 与 scene token 做成配对断言，已补入 `test/frontendInkAssetsManifest.test.js` 并重跑聚焦测试。

风险/遗留：

- 场景素材尚未接入运行时界面；S74.5/S76 通过资产加载层和多页身份/场景界面按 usage/scene 懒加载。
- 本轮只做静态场景图，不做转场动效；驿道赶考作为可选转场素材后置到 S73.8 或后续考试动效/转场包。

下一步：

- 执行 S73.6：身份背景包。继续按用户要求把创意发散 prompt 草案交给 medium 子代理，Codex 负责定稿、生图、视觉审核、manifest/台账入库和提交。

### 2026-05-14

工具：Codex，medium 子代理创意发散，Codex 视觉审核，提交前只读复审。

步骤：S73.4 首页资产包。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/home/` 的 6 个首页资产和 `public/assets/ui/thumbs/` 的对应缩略图：`home-scroll-landscape-v1.webp`、`home-mist-layer-v1.webp`、`home-register-form-paper-v1.webp`、`home-cinnabar-start-seal-v1.webp`、`home-archive-casefile-v1.webp`、`home-static-reduced-motion-v1.webp`。
- 透明素材经 chroma-key 去底、despill、alpha 软化和 WebP alpha 压缩；云雾层在提交前复审后改为基于 AI 雾层的柔化 alpha mask、低频雾团和边界渐隐，避免暗底切边；朱印首版空心感过强后重生成厚实无字版本。
- `public/assets/ui/ink-ui-manifest.json` 继续保持 `assets_active`，登记 S73.4 首页资产的安全路径、缩略图、fallback、尺寸、alpha、safeArea、focalPoint、mobileCrop、motion/reducedMotionFallback、性能预算、来源摘要、视觉审核和安全审核；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- `docs/FRONTEND_ASSET_LEDGER.md` 登记每个首页素材的来源类型、工具/模型、prompt 摘要、负面约束摘要、后处理、许可说明、Codex 视觉审核和安全审核结论。
- 新增 `public/assets/ui/home/home-transparency-qa-v1.json` 记录透明首页素材的 SHA-256、纸色/深色合成复审背景和色边/边界指标；`test/frontendInkAssetsManifest.test.js` 扩展为校验 S73.3 与 S73.4 active assets 的数量、阶段、分类、真实图片存在性、WebP 尺寸、alpha、性能预算、来源字段、缩略图 bytes、透明 QA sidecar 和台账记录。
- 更新 README、brief、路线图和共享上下文，记录 S73.4 已完成并把下一步指向 S73.5 场景插画包。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。

验证：

- 已通过：Codex 视觉审核 contact sheet，确认 6 个首页素材符合水墨、宣纸、画卷、题名册、朱印和案卷气质；无可读文字、水印、现代 UI、本地路径、key、raw/hidden 内容；`ui-home-mist-layer-v1` 按 `approved_with_limits` 限定为首页低透明度云雾叠加层。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`，仅提示 `docs/FRONTEND_ASSET_LEDGER.md` CRLF 将被 Git 规范化为 LF，无空白错误。
- 已通过：`npm test`，849 项通过、0 失败；此前一次完整运行遇到 `test/historicalEventArchive.test.js` 的 Node test runner `spawn EPERM` 瞬时错误，单跑该文件通过，随后完整重跑已通过。
- 已完成：提交前只读复审最终 diff 与验证证据；首轮复审发现 P2 透明首页素材 chroma-key / despill 残留和当前测试缺少像素级透明素材视觉质量覆盖，已重处理透明素材、刷新缩略图与 manifest bytes，并把 S73.9 QA 范围补入 chroma-key 色边/深浅底合成检查；最终只读复审确认新云雾层、透明 QA sidecar、测试和文档记录无剩余 P0/P1/P2。

风险/遗留：

- 首页素材尚未接入运行时界面；S74.5/S75 通过资产加载层和首页画卷布局按 usage 懒加载。
- `ui-home-mist-layer-v1` 仅作为低透明度云雾叠加使用，不单独承载信息；关闭动效时使用 `ui-home-static-reduced-motion-v1` 或 CSS fallback。S73.9 需要把本轮复审暴露出的透明素材色边检查做成更系统的素材预览/QA。
- S73.5 仍需生成书斋、贡院、放榜、殿试、县衙、公堂、军帐、御案、城市街巷等场景插画。

下一步：

- 执行 S73.5：场景插画包。继续按用户要求把创意发散 prompt 草案交给 medium 子代理，Codex 负责定稿、生图、视觉审核、manifest/台账入库和提交。

### 2026-05-14

工具：Codex，medium 子代理创意发散，Codex 视觉审核，提交前只读复审。

步骤：S73.3 UI 材质包。

提交：本次提交。

完成：

- 按用户要求把创意发散 / prompt 草案交给 medium 子代理，Codex 负责 prompt 定稿、`gpt-image-2` 生图、视觉审核、后处理、压缩、缩略图、manifest/台账入库和最终验证。
- 新增 `public/assets/ui/materials/` 与 `public/assets/ui/thumbs/` 的 16 个首批 UI 材质和对应缩略图，覆盖宣纸、旧绢、奏折纸面、竹简输入条、卷轴面板、残纸卡片、水渍叠加层、淡墨分隔线、角饰笔触、朱印按钮默认/按下态、印匣纹理、试卷界栏、皇榜纸底、朱砂墨迹和纸页边缘阴影。
- 透明素材经 chroma-key 去底、despill 和 WebP alpha 压缩；水渍素材初版偏绿后已重生成并本地校色为浅茶色，最终视觉审核通过。
- `public/assets/ui/ink-ui-manifest.json` 从 schema 草案进入 `assets_active`，登记 16 个素材的安全路径、缩略图、fallback、尺寸、alpha、safeArea、focalPoint、mobileCrop、性能预算、来源摘要、视觉审核和安全审核；未写入完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- `docs/FRONTEND_ASSET_LEDGER.md` 登记每个素材的来源类型、工具/模型、prompt 摘要、负面约束摘要、后处理、许可说明、Codex 视觉审核和安全审核结论。
- `test/frontendInkAssetsManifest.test.js` 扩展为校验真实图片存在性、WebP 尺寸、alpha、性能预算、审核状态、来源字段、缩略图和台账记录。
- 更新 README、brief、路线图和共享上下文，记录 S73.3 已完成并把下一步指向 S73.4 首页资产包。
- 本轮不安装新依赖、不改运行时代码、不改 API、provider schema、SQLite schema、存档格式、提示词或 AI 权限。

验证：

- 已通过：Codex 视觉审核 contact sheet，确认 16 个素材无可读文字、水印、现代 UI、本地路径、key、raw/hidden 内容；印匣、皇榜和角饰按 `approved_with_limits` 限定用途。
- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已通过：`npm test`，848 项通过、0 失败。
- 已完成：提交前只读复审最终 diff 与验证证据；复审发现 P2 `ui-water-stain-soft-v1` 缩略图 bytes 与 manifest 不一致，已修正并补充测试校验 `thumbnailBytes` 与实际文件大小一致，重跑 `test/frontendInkAssetsManifest.test.js` 通过；无剩余 P0/P1/P2。

风险/遗留：

- 首批 UI 材质尚未接入运行时界面；S74.5/S75-S76 通过资产加载层和 React 页面按 usage 懒加载。
- `ui-seal-box-texture-v1` 偏深，`ui-imperial-notice-paper-v1` 色彩偏暖，`ui-ink-corner-brush-v1` 带竹影意象，因此均标为 `approved_with_limits`，只在对应路由或局部装饰中使用。
- S73.4 仍需生成首页画卷、云雾层、题名册底、开始按钮和案卷存档素材。

下一步：

- 执行 S73.4：首页资产包。继续按用户要求把创意发散 prompt 草案交给 medium 子代理，Codex 负责定稿、生图、视觉审核、manifest/台账入库和提交。

### 2026-05-14

工具：Codex，提交前只读复审。

步骤：S67 规模验收性能波动维护。

提交：本次提交。

完成：

- 修正 S67 scale regression 性能字段语义：旧 `fixtureGenerationMs` 实际量到 `createWorldContentFixture({ size: "large" })` 外层总耗时，已拆为只量原始 fixture 数据生成的 `rawFixtureGenerationMs` 和报告型 `fixtureBuildMs`。
- `runScaleRegressionAcceptance()` 现在优先复用 `fixture.fixtureSummary.performanceBaseline`，不再对 event archive、prompt strategy、fixture page 等 baseline 工作重复测一遍后塞进生成耗时口径。
- S67 保持数量、防泄漏、分页 cap、prompt budget、SQLite read-repair parity、行为级耗时和 heap guard；`fixtureBuildMs` 不作为 full-suite 硬失败阈值，`informationPanelMs` 放宽到 5000ms 以吸收完整 `npm test` 并发资源竞争。
- 同步测试、README、brief、S49-S67 归档和共享上下文，记录旧 `fixtureGenerationMs` 名称不准确以及本轮拆分后的验收口径。

验证：

- 已通过：`node --test test/worldContentFixtures.test.js test/dualModeAcceptanceScript.test.js`。
- 已通过：临时运行 `runScaleRegressionAcceptance()`，观测 `rawFixtureGenerationMs`、`fixtureBuildMs`、event archive、prompt assembly、fixture page、information panel、SQLite read repair 和 heap 指标均可输出且无 hidden token 泄漏；临时 SQLite 文件已删除。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`npm test`，848 项通过、0 失败；其中完整并发环境下 `dual-mode S67 scale regression` 已通过。
- 已通过：`git diff --check`。
- 已完成：提交前只读复审最终 diff 与验证证据，未发现 S67 代码 diff 的 P0/P1/P2；复审指出工作树另有 S73.3 UI 素材/manifest/台账改动不属于本轮，主代理将用定向暂存排除这些文件。

风险/遗留：

- 本轮不降低 S67 large fixture 的数量、安全、分页、prompt budget 或 SQLite parity 门槛；只修正性能字段命名和完整测试并发下的误报口径。
- `fixtureBuildMs` 仍会出现在报告中，供后续真实性能调查使用；如果它持续异常升高，应单独分析生成器、baseline、SQLite 或 Node test runner 并发，而不是恢复旧字段名。
- 本轮完成时工作树可能仍保留未纳入提交的 S73.3 UI 素材相关文件，后续 S73.3 必须另做视觉审核、manifest/台账同步和素材测试后再提交。

下一步：

- 若本轮全量验证通过，继续执行 S73.3 UI 材质包；S74.0 前仍不得直接安装 React Router 或其他新依赖。

### 2026-05-14

工具：Codex，子代理只读前置分析，待提交前只读复审。

步骤：S73.2 UI 素材 manifest schema 与素材台账。

提交：本次提交。

完成：

- 新增 `public/assets/ui/ink-ui-manifest.json` 草案，固定 `ink-ui-v1` 的 schema、review policy、path policy、portrait policy、allowed review statuses、usage/role catalog、fallback catalog、planned asset groups 和空 `assets` 入库位。
- 新增 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)，建立 Manifest 草案记录、素材记录、立绘矩阵、参考素材记录、审核状态说明和后续入库检查；S73.2 不生成实际图片。
- 为 S73.10 全量 300-400 张玩家/NPC 立绘池预留 `portraitRef`、缩略图、低清占位、状态变体、懒加载分组、fallback、视觉审核和安全审核字段；manifest 明确立绘必须同时满足基础素材字段与立绘扩展字段，全量池只能懒加载，`maxInitialPortraits` 为 8，不能进入首屏全量 eager load。
- 新增 `test/frontendInkAssetsManifest.test.js`，校验 manifest 顶层契约、审核状态、fallback 已批准、S73.10 目标数量与懒加载策略、`assets` 当前为空，以及台账包含 fallback、立绘矩阵和第三方来源分类字段。
- 更新 README、brief、路线图和共享上下文，记录 S73.2 已完成并把下一步指向 S73.3 UI 材质包。
- 本轮不安装依赖、不生成素材、不改运行时代码、API、provider schema、SQLite schema、存档格式或提示词。

验证：

- 已通过：`node --test test/frontendInkAssetsManifest.test.js`。
- 已通过：`node --test test/mapAssetsManifest.test.js`。
- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已运行但未完全通过：`npm test`。失败项为既有 S67 large fixture 性能阈值波动，`fixtureGenerationMs 10975.641 > 10000`；本轮未改 S67 fixture、dual-mode 阈值或运行时生成逻辑。
- 已完成：提交前只读复审最终 diff 与验证证据，未发现 P0/P1/P2；复审建议的“立绘需继承基础素材字段”已补入 manifest、台账和测试。

风险/遗留：

- `ink-ui-manifest.json` 目前是 schema 草案，`assets` 暂为空；S73.3-S73.10 生成实际素材时必须逐项填充路径、缩略图、尺寸、fallback、审核状态和台账 id。
- 现有测试先校验 schema、安全字段和草案结构；等 S73.3+ 有实际图片后，需要扩展到图片存在性、尺寸、透明度、缩略图和 rejected/draft 禁用检查。

下一步：

- 执行 S73.3：生成 UI 材质包，首批宣纸、旧绢、奏折、竹简、卷轴、残纸、水渍、淡墨线、朱印按钮、印匣纹理、试卷界栏和皇榜纸底等素材，并登记 manifest 与台账。

### 2026-05-14

工具：Codex，提交前只读复审。

步骤：S73.0c S73.10 台账补齐与全量立绘口径调整。

提交：本次提交。

完成：

- 按用户指出的问题补齐活动台账中的 S73.10，避免路线图有步骤但台账缺行。
- 将 S73.10 从“长期分期”改为“S73 内全量立绘生产与入库”，目标为 300-400 张玩家/NPC 立绘完成生成、缩略图、压缩、视觉审核、安全审核、manifest 入库和台账登记。
- 明确 S73.7 只负责 24-40 张风格基准，S73.10 负责全量生产；张居正、魏忠贤等重要人物或拟史关键人物应进入专属立绘池，不再只作为远期预留。
- 明确 S74-S77 的人物显示都必须通过 S73.10 已审核 `portraitRef`、缩略图和 fallback 使用立绘；不得硬编码图片路径、不得显示未审核素材、不得一次性加载全量池。
- 同步视觉资产指南、README、brief、共享上下文和路线图，让后续 Codex 开发从 S73.2 开始时就按“全量立绘在 S73 完成，后续步骤全部使用”的口径推进。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审本轮文档 diff 和验证证据。

风险/遗留：

- 本轮仍是规划与交接文档，不生成实际立绘、不安装依赖、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或验证脚本。
- S73.10 的“全量完成”是资产生产与入库完成，不代表前端首屏加载全部素材；S76/S77 必须继续落实懒加载、缩略图和 fallback。

下一步：

- 执行 S73.2：新增 UI manifest schema 与前端素材台账，为 S73.3-S73.10 的素材入库、审核状态、缩略图、fallback、性能预算和安全字段提供可测试契约。

### 2026-05-14

工具：Codex，子代理只读要点分析。

步骤：S73.1 前端视觉资产指南。

提交：本次提交。

完成：

- 新增 [FRONTEND_VISUAL_ASSET_GUIDE.md](FRONTEND_VISUAL_ASSET_GUIDE.md)，把 S73-S77 前端水墨资产标准落成独立指南，覆盖阅读优先、目录命名、页面 usage、颜色材质、文字承载、文件规格、移动裁切、UI 材质、首页/场景/身份背景、立绘、动效、fallback、审核清单和 manifest/台账边界。
- 固定 S73-S77 正式 AI 生成素材由 Codex 使用 `gpt-image-2`；AI 生成或第三方候选素材入库前必须完成 Codex 视觉审核，未审核或未通过的素材不得进入 manifest 可用集合。
- 明确玩家与 NPC 立绘必须为成年、端庄、身份明确、高颜值但不露骨；女性角色可通过服饰剪裁、腰封、衣料层次和站姿体现优雅成熟女性身形比例，但不得幼态、挑逗或过度暴露。
- 为 S73.2 manifest 预置安全字段边界：manifest 只保存安全路径、尺寸、用途、缩略图、fallback、safeArea、focalPoint、移动裁切、审核状态和台账 id，不保存完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值。
- 更新 README、brief 和共享上下文，记录 S73.1 已完成并把下一步指向 S73.2 UI manifest schema 与前端素材台账。
- 本轮只改文档，不安装依赖、不生成素材、不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词或验证脚本。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：子代理只读分析 S73.1 应覆盖要点、风险和验证命令；提交前只读复审未发现 P0/P1/P2，P3 历史记录中 S73.1/S73.2 边界旧表述已修正。

风险/遗留：

- 本轮只是视觉资产规范，不生成 `public/assets/ui/`、manifest、缩略图或素材台账。
- 后续 S73.2 需要把本指南转成可测试的 `ink-ui-manifest.json` schema、`FRONTEND_ASSET_LEDGER.md` 字段和未审核素材禁用规则。

下一步：

- 执行 S73.2：新增 UI manifest schema 与前端素材台账，覆盖审核状态、缩略图、fallback、性能预算和安全字段。

### 2026-05-14

工具：Codex，官方 React Router/Vite 文档核对。

步骤：S73.0b 多页信息架构与舆图页决策。

提交：本次提交。

完成：

- 回答并固化用户判断：当前旧前端本质是单页游戏壳，继续把地图、科举、NPC、史册、设置、存档和多身份玩法塞在同一页会过于拥挤。
- 将 S74 之后的方向从“单页 shell + 内部状态切换”调整为“React Router 多页 SPA”：主叙事页保持轻量，地图、人物、史册/局势簿、科举考试、放榜、皇帝/朝议或官署公文进入独立页面。
- 将 `react-router` 从暂缓项移动到 S74.0 候选依赖；当时规划为 `/ink-client` 并行入口，现已由 S73.0d 改为默认 `/` 直接接管。S74.0 仍需要固定 Data Mode、`createBrowserRouter` / `RouterProvider`、URL 安全边界、默认路由刷新 fallback、动效和 Git 回退方式，不采用 React Router Framework Mode 接管 Express 后端。
- 将地图重构方向改为独立“舆图”页：主叙事页只保留地图入口或摘要，舆图页承载大画布、图层筛选、地点/路线/事件详情、局势簿跳转和行动草稿。
- 更新 roadmap、活动台账、brief、README 和共享上下文，保持 `mapRuntimeView` 只读、AI proposal-only、server 裁决、Mock 默认可玩和完整书生路径边界不变。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。

风险/遗留：

- 本轮只改规划/交接文档，不安装 React Router，不改 Express fallback、前端路由或地图运行时代码。
- S74.0 真正安装依赖前必须单独完成依赖治理和 package/lock 验证；S76.9 真正重构舆图页时仍需浏览器 smoke 验证 canvas 非空、动效流畅、资源失败 fallback 和 hidden/raw 防线。

下一步：

- 执行 S73.1：新增前端视觉资产指南；S74.0 前不得直接安装路由或框架依赖。

### 2026-05-14

工具：Codex，子代理只读规划建议，官方依赖文档核对。

步骤：S73.0a 前端水墨重构详细蓝图、依赖路线与素材分期。

提交：本次提交。

完成：

- 按用户反馈将 S73-S77 从高层规划扩展为可执行开发蓝图：每个大步骤都拆成多个小步骤，写清需要的依赖、资料、具体功能、验收命令、回滚边界和子代理分工。
- 将 S74 之后的技术路线调整为“React + TypeScript + Vite 渐进式接管”：本条当时规划为 `/ink-client/` 并行新前端岛，现已由 S73.0d 按用户要求改为 S74 起新前端直接接管默认 `/`，旧前端不再作为交付回滚入口。
- 记录建议引入 React、React DOM、TypeScript、Vite、Zustand、Lucide、Vitest、Testing Library、jsdom；当时暂缓 React Router，后续已由 S73.0b 按用户多页要求改为 S74.0 候选依赖；TanStack Query、`@pixi/react`、Tailwind/UI kit 和 SSR 框架仍暂缓。
- 将素材生成规划细化为 UI 材质包、首页资产、场景插画、身份背景、玩家/NPC 立绘、动效/fallback 和素材预览/QA；本条当时保留分期口径，现已由 S73.0c 更新为 S73.10 在 S73 内完成 300-400 张全量立绘池。
- 进一步收束女性立绘边界：全部为成年角色，端庄、服饰严整、高颜值、身份感强，可通过服饰剪裁、腰封、衣料层次和站姿体现优雅成熟女性身形比例；不得露骨、挑逗、幼态化或把身体部位当作卖点。
- 同步更新 brief、README 和共享上下文，使后续 Codex 接手时能直接从 S73.1 视觉资产指南开始。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理参与规划建议；提交前复审结果见本轮记录。

风险/遗留：

- 本轮仍是规划与交接文档，不安装依赖、不生成素材、不改运行时代码、API、provider schema、SQLite schema、存档格式或验证脚本。
- S74.0 真正安装前端框架依赖前，必须单独执行依赖治理、记录官方资料、验证 `npm install` / `npm start` 和 Git 回退方式；不再要求产品内保留旧前端双入口。

下一步：

- 执行 S73.1：新增前端视觉资产指南，先把视觉风格、素材规格、立绘审美/安全边界和审核流程落成独立文档。

### 2026-05-14

工具：Codex，medium 子代理创意发散，只读子代理提交前复审。

步骤：S73.0 前端水墨重构规划。

提交：本次提交。

完成：

- 按用户要求启动 S73-S77 前端水墨重构规划，并明确 S73 先做素材体系、manifest、台账和视觉审核，S74-S77 再推进信息架构、首页/global shell、身份/场景专题界面和验收归档。
- 让 medium 子代理做创意发散与 prompt 草案，Codex 收口为正式路线图和安全边界。
- 新增 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)，覆盖首页“千秋”画卷、水墨云雾、右上角设置/存档/读档/返回首页、底部奏折输入区、科举考试/放榜全屏、身份/场景专属面板、NPC/玩家立绘长期管线和验收矩阵。
- 将活动台账切换到 S73-S77，记录 S73.0 DONE、S73.1-S73.4、S74-S77 TODO。
- 更新 `docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `README.md`，同步当前活动方向、下一步 S73.1、Codex-only 生图审核责任、存档/AI 设置安全 API、S72 地图只读安全 view，以及成人、端庄、身份明确、俊美但不露骨的立绘边界。
- 本轮不改运行时代码、API、provider schema、SQLite schema、存档格式、提示词、验证脚本或素材文件。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成：只读子代理复审未发现 P0/P1；P2 brief 后段“当前活动方向”遗漏 S72/S73-S77 已修正，P3 共享上下文复审状态已闭环。

风险/遗留：

- 本轮是规划与交接文档，不生成实际素材、不改首页、不改主界面；S73.1 仍需新增正式视觉资产指南，manifest 草案和素材台账已拆到 S73.2。
- 3-4 百张立绘现已纳入 S73.10 全量生产与入库；生成与审核可按内部小批次推进，但 S73 结束时必须形成可供 S74-S77 使用的已审核 `portraitRef` 池，同时继续依赖懒加载、manifest 驱动和视觉审核。

下一步：

- 执行 S73.1：前端视觉资产指南；S73.2 再新增 UI manifest 草案和素材台账。

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
