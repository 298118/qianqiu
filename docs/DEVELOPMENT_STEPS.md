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
| S73.10 | DONE | Codex + 子代理创意草案/只读视觉复审 | 全量立绘生产与入库 | S73.10.1 已锁定 336 张 planned 立绘矩阵；S73.10.2 已生成并审核 192 张玩家池立绘（72 张身份阶段 + 60 张女性风格补充 + 60 张男性风格补充），玩家可选池男女各 96 张；S73.10.3 已生成并审核 188 张通用 NPC 立绘；S73.10.4 已生成并审核 72 张重要 NPC 专属立绘；S73.10.5 已生成并审核 72 张状态/姿态与场景锚点立绘；S73.10.6 已刷新为 596 张 active 立绘的缩略图/压缩总括 QA，S73.10.7 已扩为 48 张年轻女性补充，并新增 60 张女性/偏女性单张高清重制覆盖；S74-S77 全部通过已审核 `portraitRef` 使用 |
| S73.10.1 | DONE | Codex + medium 子代理创意草案 | 立绘矩阵定稿 | 已新增 `docs/FRONTEND_PORTRAIT_MATRIX.md`、`public/assets/ui/portraits/portrait-pool-matrix-v1.json`、`scripts/frontendPortraitMatrix.js` 和 `qa:portrait-matrix`，锁定 336 张 planned 立绘、prompt 母版、fallback、懒加载和审核字段 |
| S73.10.2 | DONE | Codex + medium 子代理创意草案 | 玩家立绘池 | 已按矩阵生成 72 张玩家身份阶段立绘，并保留 60 张已审核女性玩家风格补充与 60 张已审核男性玩家风格补充，完成主图、缩略图、低清占位、视觉/安全审核、manifest 入库、QA sidecar 和台账登记；玩家可选池男女各 96 张 |
| S73.10.3 | DONE | Codex + medium 子代理创意草案 | 通用 NPC 立绘池 | 已生成并审核 188 张通用 NPC 立绘：一开始的 120 张矩阵通用 NPC 保留，20 张旧版源页作为 bonus 继续使用，48 张宫装/唐装女性风格扩展作为已审核补充池入库 |
| S73.10.4 | DONE | Codex + medium 子代理创意草案 | 重要 NPC 专属立绘池 | 已生成并审核 72 张重要 NPC 专属立绘，覆盖皇帝/后妃/摄政、台阁枢臣、封疆、名将、权臣、清流、宿敌、知己、宫廷谋主和边地使者；使用 `signature_npc_pool` 单独隔离，不混入通用头像池 |
| S73.10.5 | DONE | Codex + medium 子代理创意草案 | 状态姿态与场景锚点池 | 已生成并审核 72 张状态/姿态与场景锚点立绘：48 张状态姿态覆盖沉思、拱手、执卷、阅卷、持笏、执笔、按剑、疲惫、病中、肃立、含怒、微笑、惊疑、决断、受审和请罪；24 张场景锚点覆盖科举答卷、放榜相逢、县衙问案、朝议陈奏、军帐筹谋、书斋夜读、街市交涉和宫廷召见 |
| S73.10.6 | DONE | Codex + 只读差距扫描子代理 | 缩略图与压缩总括 QA | 已新增 `scripts/frontendPortraitCompressionQa.js`、`qa:portrait-compression` / `qa:portrait-compression:write` 和 `public/assets/ui/portraits/portrait-compression-qa-v1.json`，统一校验 596 张 active 立绘、其中 572 张 S73.10 立绘的主图、缩略图、低清占位、safeArea、focalPoint、移动裁切、文件预算和禁止 eager load |
| S73.10.7 | DONE | Codex | 年轻女性补充与单张高清重制 | 已将年轻成年女性补充池扩为 48 张，新增 60 张女性/偏女性单张高清覆盖，配套 `scripts/frontendSinglePortraitOverrides.js`、`qa:single-portrait-overrides` / `qa:single-portrait-overrides:write` 和 `public/assets/ui/portraits/portrait-single-override-qa-v1.json`；当前 artifacts 单张覆盖目录已有 181 张 PNG，本轮 24 张已入公开 manifest/runtime；已重制项对应的本地参考原图已删除以免误导后续队列 |
| S74.0 | DONE | Codex + 只读依赖审阅子代理 | 依赖治理与 React 默认前端契约 | 已安装精确版本 React、TypeScript、Vite、React Router、Zustand、Lucide、Vitest、Testing Library、jsdom 和类型声明包；新增 `docs/FRONTEND_REACT_MIGRATION_CONTRACT.md`，固定 S74.1 起接管默认 `/` |
| S74.1 | DONE | Codex + 只读探查子代理 | Vite/TypeScript 默认前端 | 已新增 `client/`、Vite/TS/Vitest 配置、最小 React Router 多页壳、Express history fallback 和 S74.1 focused browser smoke；`dist/client/` 构建输出接管默认 `/`，旧单页壳仅保留为迁移参考 |
| S74.2 | DONE | Codex + 只读探查子代理 | 安全 API client | 已新增 React 安全 API client、宽松 response 类型、会话 store 和最小页面接线；新前端只调用 start/saves/player-state/turn/exam/AI settings/connection-test 安全接口，普通读档不碰 raw state route |
| S74.3 | DONE | Codex + 只读探查子代理 | 前端状态层补全 | 已新增 Zustand UI 状态层，管理 route page、sessionId、安全玩家摘要、drawer/modal/surface、tab、action draft 和 display preferences；主卷行动草稿接入全局 store，不保存 raw session |
| S74.4 | DONE | Codex + 只读探查子代理 | 多页 shell 与 route registry | 已拆出 `AppShell`、`SurfaceHost`、overlay focus helper 和 surface registry，建立设置/存档/显示偏好抽屉、安全 modal、人物/圣旨/奏折/舆图专题层、Esc 关闭、焦点回收和滚动恢复 |
| S74.5 | DONE | Codex + 只读探查子代理 | 资产加载层 | 已新增 runtime fetch 的 `assetRegistry`、`useAssetRegistry` 和 `Portrait` 组件；人物页按 manifest 分页接入全部已审核人物页立绘，女性高清重制优先列前，未重制项继续使用已审核原图，未审核素材默认不可用 |
| S74.6 | DONE | Codex + 只读探查子代理 | S72 地图运行时桥 | 已新增 React `InkMapRuntimeBridge`，动态加载本地 Pixi vendor 与 `public/mapRenderer.js`，只读包装安全 `mapRuntimeView`；不依赖旧 `public/app.js`、旧 `mapPanel.js` DOM 单例、旧 `#action-input` 或旧局势簿 DOM |
| S74.7 | DONE | Codex + 只读探查子代理/只读复审子代理 | S74 默认入口验收 | 已完成默认入口验收与回退说明收口；默认 `/` React 前端可通过首页表单 Mock 开局，主要 session 路由刷新可恢复，client typecheck/test/build、新 smoke、docs governance 和完整 `npm test` 均通过 |
| S75.1 | DONE | Codex + medium 实施子代理/只读复审子代理 | 首页画卷布局 | React 首页已接入 S73 已审核画卷背景、透明云雾、题名册表单底、朱印/案卷素材和 reduced-motion 静态底；保留现有 Mock 开局表单与安全存档 metadata |
| S75.2 | DONE | Codex + medium 实施子代理/只读复审子代理 | 开局表单 | 朝代、年份、六类身份、姓名、书生家境、自定背景已接入现有 start API；书生家境由服务器归一化为公开字段，错误/loading/disabled 状态完整 |
| S75.3 | DONE | Codex + medium 实施子代理/只读复审子代理 | 朱印开始按钮 | 已实现玉玺/朱印按钮、盖章反馈、低动效替代和防重复提交 |
| S75.4 | DONE | Codex + medium 实施子代理尝试/只读复审子代理 | 右上角印匣 | 顶部右侧已收束为单一印匣入口，抽屉内以 tab 统一 AI 设置、旧案读档、返回首页、显示偏好和安全摘要，不暴露 key/prompt/path/raw |
| S75.5 | DONE | Codex + medium 实施子代理/只读复审子代理 | 案卷式存档/读档 | 首页与印匣旧案 tab 已复用案卷卡片显示完整安全 metadata、缺字段 fallback 和读档入口；读档继续只走 `player-state` 并进入主卷 |
| S75.6 | DONE | Codex + medium 实施子代理/只读复审子代理 | 返回首页与继续本局 | 返回首页保留当前安全 session 指针并清空临时 UI，首页显示继续本局入口，browser smoke 覆盖继续后递送一回合 |
| S75.7 | DONE | Codex + medium 实施子代理尝试/只读复审子代理 | 显示偏好 | 动效、字体大小、对比度、自动滚动和地图动效已通过白名单 schema 保存在本地安全偏好 |
| S75.8 | DONE | Codex + medium 实施子代理/只读复审子代理 | 底部奏折输入雏形 | 已新增固定底部 `MemorialComposer`、身份 placeholder、Enter 呈上、Shift+Enter 换行、“呈上”朱印按钮和本地规则“可行事”快捷区 |
| S75.9 | DONE | Codex + 只读复审子代理 | 快捷功能 AI 接入与完善 | 已接入安全 AI/Mock 快捷建议 endpoint、`quick_action` task、前端 loading/降级/刷新状态和 draft-only 行为 |
| S75.10 | DONE | Codex + 只读探查/复审子代理 | S75 浏览器验收 | 已扩展 React browser smoke，覆盖右上角印匣真实点击、tab 遍历、旧案 `player-state` 读档、印匣返回首页、继续本局、移动端印匣、低动效地图和 `--client react` 命令兼容 |
| S76.1 | DONE | Codex + medium 子代理创意发散/只读复审子代理 | 主游戏壳 | 主卷已整理为案卷状态条、叙事卷、按身份切换的已审核场景插画带、安全投影索引、图标功能页签和固定底部奏折；不新增 API，不改变服务器裁决 |
| S76.2 | DONE | Codex + medium 实施子代理尝试/只读复审子代理 | 书生面板 | 已新增 React `ScholarPanel`，接入书斋背景、读书簿、老师点评、师友、科期、文章练习和赶考/皇榜入口；按钮只写行动草稿，完整科举路径仍由服务器裁决 |
| S76.3 | DONE | Codex + medium 只读发散子代理/只读复审子代理 | 地方官面板 | 已新增 React `MagistratePanel`，接入县衙背景、案牍、公堂、钱粮、水利、盗匪、士绅关系和裁决边界；按钮只写行动草稿，审案/财赋/修堤/缉捕/考成仍由服务器裁决 |
| S76.4 | DONE | Codex + medium 实施子代理/只读复审子代理 | 入仕官员/大臣面板 | 已新增 React `OfficialMinisterPanel`，接入部院背景、官职履历、部院公文、同年座师、人脉、派系朝局风险、考成、弹劾和奏疏入口；按钮只写行动草稿，任免/奖惩/处分/弹劾成案/改考成仍由服务器裁决 |
| S76.5 | DONE | Codex + medium 实施子代理/只读复审子代理 | 将领面板 | 已新增 React `GeneralPanel`，接入将领边塞军帐背景、安全 `militaryDiplomacyView`、`officialPostingsView`、`mapRuntimeView`、`eventArchiveView`、`actorMemoryView` 和玩家公开摘要，展示军帐、粮饷、斥候、边患舆图、战报边议和军令边界；按钮只写行动草稿，不结算战役/调兵/外交 |
| S76.6 | DONE | Codex + medium 实施子代理/只读复审子代理 | 皇帝面板 | 已新增 React `EmperorPanel`，接入御案背景、奏折队列、朱批、圣旨草稿、朝议、任免候选、赏罚预留和御案边界；前端只写草稿/提案入口 |
| S76.7 | DONE | Codex + low/medium 子代理 + 只读复审子代理 | 科举考试全屏 | 已将 React 科举页升级为贡院/殿试全屏考试界面，接入已审核 `exam_page` 场景与试卷/朱印素材、中央试卷、考题、写作区、字数/草稿状态、考场记录、虚拟考生安全占位和交卷边界；取题/推进/交卷仍走现有考试 API，评分/舞弊/放榜/晋级/授官仍由服务器裁决 |
| S76.8 | DONE | Codex + low/medium 子代理 + 只读复审子代理 | 放榜全屏 | 已将 React 皇榜页升级为贡院外放榜全屏界面，接入已审核 `ranking_page` 放榜场景、皇榜黄纸底和朱砂墨迹素材，展示三鼎甲、服务器定榜名单、玩家高亮、评语、评分维度、防作弊检测、授官提示和榜单安全边界；榜次/评分/防弊/晋级/授官仍只读服务器结果，前端不排序、不补分、不推断授官 |
| S76.9 | DONE | Codex + low/medium 子代理 | 独立舆图页与地图重构 | 已将 S72 地图升级为独立 `/game/:sessionId/map` 舆图页，支持大画布、图层筛选、tooltip、局势簿跳转、行动草稿和资源失败 fallback |
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

本节已压缩为当前活动专项的关键里程碑。旧的逐日长流水不再在活动台账展开；需要追溯具体 diff、完整验证输出或中间风险时，优先查看 Git history、对应专题归档和 `docs/SHARED_CONTEXT.md` 的当轮交接记录。后续只追加会影响接手判断的信息：步骤状态、范围变化、关键验证、风险/遗留和下一步。

### 2026-05-18：台账压缩维护

- 范围：按用户要求压缩本节“进度记录”，保留 S73-S75 关键里程碑、当前 S76 下一步、安全边界和最新验收口径；删除重复的逐日实施细节。
- 性质：纯文档维护，不改运行时代码、API/schema、provider schema、SQLite schema、存档格式、AI 权限、素材 manifest 或前端行为。
- 子代理：低风险纯文档改动，跳过提交前子代理复审；已在共享上下文记录。
- 验证：本轮运行结果见当前提交说明；至少需通过 docs governance、documentation governance 和 `git diff --check`。
- 下一步：继续执行 S76.1 主游戏壳。

### 2026-05-18：S76.1 主游戏壳

- 范围：主卷前端重排为案卷状态条、场景插画带、叙事卷、案头安全投影索引、功能页签和固定底部 `MemorialComposer`。场景带优先从 `assetRegistry` 读取 `usage="game_main"` 的已审核场景资产，失败时回落到既有 `/assets/ui/scenes/` 已审核路径。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、科举晋级、官职任免或 canonical state 写入；功能页签只导航，快捷建议仍只写草稿，普通回合提交仍由服务器裁决。
- 子代理：按用户要求委派 medium 子代理做前端信息架构发散；提交前只读复审未发现 P0/P1，发现的 P2 草稿逐字自动刷新快捷建议风险已修正为自动刷新不携带草稿、草稿预览只在玩家显式刷新时发送，并补测试。
- 验证：已通过 `npm run typecheck:client`、`npm run test:client`、`node --test test/reactClientScaffold.test.js test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-1-game-shell`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（895 项通过、0 失败）。
- 下一步：S76.2 书生面板，继续保护完整科举路径。

### 2026-05-18：S76.2 书生面板

- 范围：新增 React `ScholarPanel` 并接入主卷书生身份分支，使用已审核 `role_background` 书斋背景，组合安全 `studyProfileView`、`examCalendarView` 和玩家公开摘要展示读书簿、老师点评、师友、保结前置、科期、文章练习、荐书、近课和赶考/皇榜入口。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、科举晋级、放榜、授官或 canonical state 写入；面板按钮只写底部奏折行动草稿，科举/皇榜入口只做路由跳转，赶考、入场、评卷、放榜、晋级和授官继续由服务器裁决。
- 子代理：按用户要求委派 medium 实施子代理负责前端组件小块；该子代理写入 `ScholarPanel.tsx` 后因并发写入风险被主代理关闭，未提交、未推送、未创建 PR，主代理已审阅并整合其产出。提交前只读复审已查看最终 diff 与验证证据，未发现 P0/P1/P2/P3。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`npm run test:client`、`node --test test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-2-scholar-panel`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（896 项通过、0 失败）；提交前只读复审未发现 P0/P1/P2/P3。
- 下一步：S76.3 地方官面板，围绕县衙、公堂、案牍、钱粮、水利、盗匪、词讼和士绅关系入口继续保持草稿-only 与服务器裁决边界。

### 2026-05-18：S76.3 地方官面板

- 范围：新增 React `MagistratePanel` 并接入主卷地方官身份分支，使用已审核 `role_background` 县衙素材，组合安全 `localAffairsDocketView`、`officialPostingsView`、`economicFiscalView` 和玩家公开摘要展示案牍总览、公堂词讼、钱粮仓储、水利盗警、士绅乡约、考成/风评/名望和裁决边界。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、官职任免、考成结算或 canonical state 写入；面板按钮只写底部奏折行动草稿，不提交回合、不调用 resolver、不结案、不征税或开仓、不直接修堤缉捕、不改考成，审案、财赋、水利、盗匪、士绅和持久化继续由服务器裁决。
- 子代理：按用户要求委派 medium 只读子代理做地方官面板信息架构/文案发散；主代理实现并整合。提交前只读复审未发现 P0/P1，P2 文档验证占位已修正，P3 截图中固定底部奏折覆盖为既有 composer 表现、无阻塞。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`npm run test:client`、`node --test test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-3-magistrate-panel`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（897 项通过、0 失败）。
- 下一步：S76.4 入仕官员/大臣面板，围绕官职履历、部院公文、同年座师、派系、考成、弹劾和奏疏入口继续保持草稿-only 与服务器裁决边界。

### 2026-05-18：S76.4 入仕官员/大臣面板

- 范围：新增 React `OfficialMinisterPanel` 并接入主卷 `official` / `minister` 身份分支，使用已审核 `role_background` 部院/大臣素材，组合安全 `officialCareerView`、`appointmentTrackView`、`officialPostingsView`、`actorMemoryView`、`aiControlAuditView` 和玩家公开摘要展示官职履历、部院公文、同年座师、人脉记忆、派系/朝局风险、考成、弹劾和奏疏入口。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、官职任免或 canonical state 写入；面板按钮只写底部奏折行动草稿，不提交回合、不调用 resolver、不推进时间、不直接任免、奖惩、处分、弹劾成案或改写考成，升降、铨选、考成、处分、派系影响和持久化继续由服务器裁决。
- 子代理：按用户要求委派 medium 实施子代理负责前端组件小块；该子代理只新增 `OfficialMinisterPanel.tsx`，未运行 Git 操作，主代理已审阅、接线、补样式和测试。提交前只读复审按最终 diff 与验证证据执行。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`npm run test:client`、`node --test test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-4-official-minister-panel`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（898 项通过、0 失败）。
- 下一步：S76.5 将领面板，围绕军帐、粮饷、斥候、边患、军令草案和战报入口继续保持草稿-only 与服务器战役/军务裁决边界。

### 2026-05-18：S76.5 将领面板

- 范围：新增 React `GeneralPanel` 并接入主卷将领身份分支，使用已审核 `role_background` 边塞军帐素材，组合安全 `militaryDiplomacyView`、`officialPostingsView`、`mapRuntimeView`、`eventArchiveView`、`actorMemoryView` 和玩家公开摘要展示军帐总览、粮饷与军心、斥候与情报、边患与舆图、战报与边议和军令边界。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、军务外交 resolver 或 canonical state 写入；面板按钮只写底部奏折行动草稿，不提交回合、不调用 resolver、不推进时间、不直接结算战役、调兵遣将、外交和战、统帅任免、粮饷拨付、赏罚或持久化，军令仍走普通自然语言行动或未来服务器 resolver。
- 子代理：按用户要求委派 medium 实施子代理负责前端组件小块；该子代理只新增 `GeneralPanel.tsx`，未运行 Git 操作，主代理已审阅、调整安全投影字段、接线、补样式和测试。提交前只读复审按最终 diff 与验证证据执行。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`npm run test:client`、`node --test test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-5-general-panel`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（899 项通过、0 失败）。
- 下一步：S76.6 皇帝面板，围绕御案、奏折队列、朱批、圣旨草稿、朝议和任免预留继续保持草稿/proposal-only 与服务器裁决边界。

### 2026-05-18：S76.6 皇帝面板

- 范围：新增 React `EmperorPanel` 并接入主卷皇帝身份分支，使用已审核 `role_background` 御案素材，组合安全 `officialPostingsView`、`eventArchiveView`、`actorMemoryView`、`aiControlAuditView`、`worldEntityView`、`worldThreadView`、`mapRuntimeView` 和玩家公开摘要展示御案朝仪、奏折队列、朱批拟稿、圣旨草稿、朝议、任免候选、赏罚预留和御案边界。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、官职任免或 canonical state 写入；面板按钮只写底部奏折行动草稿，不提交回合、不调用 resolver、不推进时间、不把朱批成案、圣旨生效、任免、赏罚、处分或持久化写成已发生事实，皇帝行动仍走普通自然语言回合并由服务器裁决。
- 子代理：按用户要求委派 medium 实施子代理负责皇帝面板组件小块；该子代理只新增 `EmperorPanel.tsx`，未运行 Git 操作，主代理已审阅、接线、补样式和测试。提交前只读复审按最终 diff 与验证证据执行。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`npm run test:client`、`node --test test/browserSmokeScript.test.js`、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-6-emperor-panel`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（900 项通过、0 失败）。
- 下一步：S76.7 科举考试全屏，围绕贡院号舍背景、试卷区、考题、写作区、阶段状态、虚拟考生和交卷朱印继续保护考试流程由服务器裁决。

### 2026-05-18：S76.7 科举考试全屏

- 范围：重构 React `ExamPage` 为贡院/殿试全屏考试界面，通过 manifest registry 优先读取已审核 `exam_page` 场景素材，失败时只回落到已审核 `/assets/ui/scenes/` 路径；页面展示贡院号舍/殿廷御试 hero、考试阶段与局部时间、取题试别、中央试卷、考题、要求、场内行动、长文写作区、字数/草稿状态、考场记录、虚拟考生安全占位、预览案卷提示、最近交卷提示和科举安全边界。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、科举规则或 canonical state 写入；取题、推进考场和交卷继续走现有 `/api/exam/question|progress|submit`，不触发普通回合、不调用 resolver、不推进全局时间、不直接显示弥封身份映射、考官隐藏意图、模型原始提案、未采纳评语、评分、放榜、晋级或授官事实。前端对考试名、考题、难度、要求和场内行动预览做安全文本过滤，避免 raw/provider/prompt/path/key/hidden 污染进入 DOM。
- 子代理：按用户要求委派 low 创意发散子代理做信息架构/文案建议，委派 medium 只读勘察子代理核对考试 API、安全 projection、素材和测试缺口，并委派 medium 实施子代理负责 `ExamPage.tsx` 结构小块；实施子代理未运行 Git 操作，主代理补安全过滤、类型、样式、测试、smoke 和文档。提交前只读复审未发现 P0/P1；P2 最近交卷考试名未过滤和 P3 移动端科举 smoke 缺口均已修复。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（23 项）、`npm run test:client`（58 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-7-exam-fullscreen`（含 `mobile-exam-fullscreen`）、`npm run smoke:exam-s69`、`npm run smoke:dual-mode -- --storage-only`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（901 项通过、0 失败）。
- 下一步：S76.8 放榜全屏，围绕皇榜黄纸底、三鼎甲朱砂章、排名列表、玩家高亮、考官评语、评分维度、防作弊结果和授官提示继续只读服务器 canonical ranking / 安全 view。

### 2026-05-19：S76.8 放榜全屏

- 范围：重构 React `RankingPage` 为贡院外放榜全屏界面，通过 manifest registry 优先读取已审核 `ranking_page` 放榜场景、`imperial_notice` 皇榜纸底和 `red_ink_smudge` 朱砂墨迹素材；页面展示三鼎甲朱砂章、服务器定榜名单、玩家高亮、榜名详情、考官公开评语、评分维度、防作弊检测、授官提示和皇榜安全边界。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、科举规则或 canonical state 写入；页面只读当前 `sessionId` 对应的 `lastExamResult.ranking`、考试历史 ranking、`examHonorView`、`examinerPanelView` 和 `appointmentTrackView` 安全投影，不访问 raw state/dev diagnostics，不在前端排序、补分、补榜、判防弊、判晋级或推断授官，不显示 provider/raw/prompt/path/key/hidden 污染文本、弥封身份映射、未采纳评语或模型原始提案。
- 子代理：按用户要求委派 low 创意发散子代理做放榜信息架构/视觉文案建议，委派 medium 只读勘察子代理核对前端数据来源、类型和测试缺口；子代理均未改文件、未运行 Git 操作。提交前只读复审先发现无 ranking 时前端补榜、无防弊结果默认“通过”、缺 place 从 index 推断和评分 key 偏离后端真实字段，均已修复；最终复审确认无阻塞项，剩余非殿试三鼎甲视觉风险也已修正为服务器 `honorTitle` 优先、仅殿试语境回退三鼎甲。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（24 项）、`npm run test:client`（60 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-8-ranking-fullscreen`（含 `desktop-ranking-fullscreen` / `mobile-ranking-fullscreen`）、`npm run smoke:exam-s69`、`npm run smoke:dual-mode -- --storage-only`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（902 项通过、0 失败）。
- 下一步：S76.9 独立舆图页与地图重构，将 S72 地图从主界面小面板升级为独立路由，继续只读 `mapRuntimeView` 安全投影并保护地图坐标不进入 prompt/服务器事实依据。

### 2026-05-19：S76.9 独立舆图页与地图重构

- 范围：`/game/:sessionId/map` 现在作为独立舆图页渲染，不再先铺主卷案台；`MapPage` 升级为“山河舆图”大画布页面，展示地点/驿路/近事统计、地点/驿路/近事图层筛选、局势簿摘录、入局势簿/回主卷跳转、公开近事“据此拟稿”和舆图安全边界。`InkMapRuntimeBridge` 继续复用 S72 `public/mapRenderer.js` / PixiJS 运行时，并新增前端显示层过滤、tooltip 关闭按钮、标签/tooltip/草稿文本安全清洗、重复 label key 防护和资源失败 fallback 文案。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、地图素材 manifest、服务器 resolver 或 canonical state 写入；舆图只读取当前 `sessionId` 的 `mapRuntimeView` 安全投影，不访问 raw state/dev diagnostics/provider payload/完整 prompt/本地路径/key/hidden 内容。地图坐标、`layoutPath` 和浏览器投影只用于画布布局、label 和 tooltip，不进入 prompt、AI 工具、服务器 resolver、行动事实、URL 或本地存储；图层筛选只改变前端显示，不改变服务器视野；舆图按钮只写行动草稿或导航，移动、查案、调兵、财政、外交、任免和持久化仍由主卷普通回合提交后服务器裁决。
- 子代理：按用户要求委派 low 创意发散子代理提供舆图信息架构、文案、移动端与 fallback 建议，委派 medium 只读勘察子代理核对 `MapPage`、`InkMapRuntimeBridge`、测试和 smoke 缺口；二者均未改文件、未运行 Git 操作。主代理实现、复看桌面/移动截图并修正移动端标题尺度。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（25 项）、`npm run test:client`（60 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-9-map-fullscreen`（含 `desktop-map-runtime` / `desktop-map-refresh` / `mobile-map-fullscreen`）、`npm run smoke:exam-s69`、`npm run smoke:dual-mode -- --storage-only`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（903 项通过、0 失败）；并人工复看 `s74-react-map-runtime-desktop.png` 与 `s76-map-fullscreen-mobile.png`。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S76.10 NPC 与玩家立绘接线，继续只使用 S73.10 已审核 `portraitRef`、缩略图、低清占位和 fallback，未审核或 hidden 人物不显示真实立绘。

### 当前最新完成节点

- S76.9 已完成独立舆图页与地图重构。`/game/:sessionId/map` 现在直接渲染“山河舆图”大画布，不再先显示主卷案台；页面读取安全 `mapRuntimeView`，提供地点/驿路/近事图层筛选、局势簿摘录、入局势簿/回主卷跳转、公开近事拟稿、tooltip 关闭、资源失败 fallback 和舆图安全边界；前端不把坐标写入 prompt/AI 工具/服务器裁决，不提交移动、查案、调兵、财政、外交、任免或持久化。
- S76.8 已完成放榜全屏。`RankingPage` 现在显示贡院外皇榜界面，读取已审核 `ranking_page` 场景、皇榜黄纸底和朱砂墨迹素材，组合服务器 ranking、`examHonorView`、`examinerPanelView` 和 `appointmentTrackView` 安全投影，展示三鼎甲、正榜、玩家高亮、考官评语、评分维度、防弊检测、授官提示和安全边界；前端不改榜次、不补评分、不判防弊、不推断授官。
- S76.7 已完成科举考试全屏。`ExamPage` 现在显示贡院/殿试全屏考试界面，读取已审核 `exam_page` 场景素材、试卷界栏和交卷朱印素材，保留现有取题、推进考场、交卷考试 API 接线，展示阶段、局部时间、中央试卷、考题、写作区、字数/草稿状态、考场记录、虚拟考生安全占位和安全边界；按钮只调用考试 API，不提交普通回合，不直接评分、判舞弊、放榜、晋级或授官。
- S76.6 已完成皇帝面板。皇帝身份主卷现在显示御案朝仪专题，读取 `officialPostingsView`、`eventArchiveView`、`actorMemoryView`、`aiControlAuditView`、`worldEntityView`、`worldThreadView`、`mapRuntimeView`、安全玩家摘要和已审核 `role_background` 资产，展示奏折队列、朱批拟稿、圣旨草稿、朝议、任免候选、赏罚预留和御案边界；按钮只写行动草稿，不直接让朱批成案、圣旨生效、任免、赏罚、处分、推进时间或持久化。
- S76.5 已完成将领面板。将领身份主卷现在显示军帐专题，读取 `militaryDiplomacyView`、`officialPostingsView`、`mapRuntimeView`、`eventArchiveView`、`actorMemoryView`、安全玩家摘要和已审核 `role_background` 资产，展示军帐、粮饷、斥候、边患舆图、战报边议和军令边界；按钮只写行动草稿，不直接结算战役、调兵遣将、外交和战、任免统帅、拨付粮饷、赏罚或推进时间。
- S76.4 已完成入仕官员/大臣面板。官员和大臣身份主卷现在显示部院官署专题，读取 `officialCareerView`、`appointmentTrackView`、`officialPostingsView`、`actorMemoryView`、`aiControlAuditView`、安全玩家摘要和已审核 `role_background` 资产，展示官职履历、部院公文、同年座师、人脉、派系朝局风险、考成、弹劾和奏疏入口；按钮只写行动草稿，不直接任免、奖惩、处分、弹劾成案、推进时间或改写考成。
- S76.3 已完成地方官面板。地方官身份主卷现在显示县衙专题，读取 `localAffairsDocketView`、`officialPostingsView`、`economicFiscalView`、安全玩家摘要和已审核 `role_background` 资产，展示案牍、公堂、钱粮、水利、盗匪、士绅关系和裁决边界；按钮只写行动草稿，不直接审结案件、征税开仓、修堤结算、缉捕归案、推进时间、改考成或任免。
- S76.2 已完成书生面板。书生身份主卷现在显示书斋专题，读取 `studyProfileView`、`examCalendarView`、安全玩家摘要和已审核 `role_background` 资产，展示读书簿、老师点评、师友、保结前置、科期、文章练习、荐书、近课和赶考/皇榜入口；按钮只写行动草稿，不直接取题、交卷、推进时间、改榜、晋级或授官。
- S76.1 已完成主游戏壳。主卷现在由案卷状态条、身份场景插画带、叙事卷、安全投影索引、舆图/人物/史册/科举/皇榜/朝议/印匣功能页签和底部奏折组成；场景资产通过 manifest registry 优先读取已审核 `game_main` 场景，失败时仅回落到已审核项目路径。
- S75.10 已完成 S75 浏览器总验收。`scripts/clientSmoke.js` 支持 `npm run smoke:browser -- --client react`，无 `--url` 时固定 Mock 开局；真实浏览器路径覆盖首页开局、右上角印匣真实点击、AI 设置/显示/安全/旧案 tab 遍历、旧案 `player-state` 读档、印匣返回首页、继续本局、底部奏折、S75.9 快捷建议、移动端印匣、低动效地图和 unsafe `/api/game/state/*` / `/api/dev/*` 防线。
- S75.9 已完成只读快捷行动建议。`POST /api/ai/quick-actions/:sessionId` 只生成可点击行动草稿，不提交普通回合、不调用 server resolver、不推进时间、不裁决结果、不写 canonical state；provider JSON 不合规或无 key 时降级本地规则。
- S75.1-S75.8 已完成首页与全局 shell：画卷首页、开局表单、朱印反馈、右上角印匣、案卷式存档/读档、返回首页与继续本局、显示偏好白名单持久化、底部 `MemorialComposer` 和本地快捷草稿。
- 当前下一步是 S76.10：NPC 与玩家立绘接线，人物显示继续通过已审核 `portraitRef`、缩略图和 fallback 懒加载，不显示未审核素材、不一次性加载全量池，也不泄漏 hidden 私档或未公开人物真值。

### S74 React 默认前端里程碑

- S74.0 完成 React/TypeScript/Vite/React Router/Zustand/Lucide 依赖治理与迁移契约。
- S74.1 新增 `client/`、Vite/TS/Vitest 配置、React Router 多页壳和 Express history fallback；`dist/client/` 接管默认 `/`。
- S74.2-S74.4 完成安全 API client、会话 store、UI store、`AppShell`、`SurfaceHost`、overlay focus helper 和 surface registry；普通读档只走 `player-state`，不接 raw state 或 dev diagnostics。
- S74.5 完成 manifest 驱动资产 registry 与 `Portrait`，人物页按分页懒加载已审核立绘；未审核或 planned 矩阵不进入 runtime。
- S74.6 完成 React `InkMapRuntimeBridge`，动态加载本地 Pixi vendor 与 `public/mapRenderer.js`，只读包装安全 `mapRuntimeView`，不依赖旧 `public/app.js` / `mapPanel.js` DOM 单例。
- S74.7 完成默认入口验收，顶部导航绑定当前安全 `sessionId`，React smoke 从 `/` Mock 开局并覆盖主要路由刷新恢复。

### S73 前端素材与立绘里程碑

- S73.0-S73.2 完成 S73-S77 前端水墨重构规划、React Router 多页 SPA 决策、UI manifest schema、素材台账和视觉资产指南。
- S73.3-S73.8 已生成、审核并登记 UI 材质、首页资产、场景插画、身份背景、立绘风格基准、动效/fallback 素材。
- S73.9 建立 `qa:frontend-assets`，统一校验 active 素材、透明素材、深浅底合成、chroma-key 色边、路径、尺寸、缩略图、fallback、审核状态和敏感字段。
- S73.10 完成全量玩家/NPC 立绘矩阵与入库：玩家池 192 张、通用 NPC 188 张、重要 NPC 专属 72 张、状态/场景锚点 72 张、年轻女性补充 48 张，并有 60 张女性/偏女性单张高清重制覆盖。
- 当前素材口径：`ink-ui-manifest.json` 中 active 素材 642 个；`portrait-compression-qa-v1.json` 覆盖 596 张 active 立绘，其中 572 张属于 S73.10 全量池/补充池。S74-S77 人物显示只能通过已审核 `portraitRef`、缩略图、低清占位和 fallback 懒加载。

### S72 与更早阶段

- S72 PixiJS 水墨地图已完成并归档到 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)。活动台账不再展开 S72.0-S72.8 的实现流水；后续地图只复用安全 `mapRuntimeView`、S72 素材/manifest 和运行时契约。
- S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排、S71 数据库玩法化均已归档；活动台账只保留当前前端水墨重构所需边界。

### 最近完整验证口径

S76.9 最新验收口径：

- `node --check scripts/clientSmoke.js`
- `npm run typecheck:client`
- `node --test test/reactClientScaffold.test.js`
- `npm run test:client`
- `node --test test/browserSmokeScript.test.js`
- `npm run build:client`
- `npm run smoke:browser -- --client react --screenshots artifacts/s76-9-map-fullscreen`（含 `desktop-map-runtime` / `desktop-map-refresh` / `mobile-map-fullscreen`）
- `npm run smoke:exam-s69`
- `npm run smoke:dual-mode -- --storage-only`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`（仅 CRLF/LF 提示）
- `npm test`（903 项通过、0 失败）

当前已知遗留：浏览器级 `prefers-reduced-motion` context 深测留给 S77.6；真实专题 `surface` 来源和完整专题 composer 留给 S76.11；S76.10 继续推进 NPC 与玩家立绘接线。
