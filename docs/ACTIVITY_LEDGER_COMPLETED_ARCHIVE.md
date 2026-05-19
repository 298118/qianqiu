# 《千秋》已完成活动台账归档

本文件归档 2026-05-19 之前已完成并写入 `docs/DEVELOPMENT_STEPS.md` 的活动台账流水，供追溯 S73-S78 等已完成节点的详细记录使用。

当前接手应优先阅读：

- `docs/SHARED_CONTEXT.md`
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
- `docs/DEVELOPMENT_STEPS.md`

本归档只保存历史完成记录，不作为新的活动路线图入口。后续已完成步骤如再次从活动台账移出，可追加到本文件或拆成专题归档。

---
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
- S73-S77 前端水墨重构、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、立绘管线、安全/性能/可访问性和总验证：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。规划源头仍见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。

S72 的专项归档见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，规划源头见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。S73-S77 已归档，规划源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

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

S49-S67、本地数据库与大世界内容，S68-S69 科举深化，S70 AI 编排，S71 数据库玩法化、S72 PixiJS 水墨地图和 S73-S77 前端水墨重构都已迁入专题归档；后续活动应从新的小步骤继续：

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S67 | DONE | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | DONE | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器面板和 Provider/Mock 验收 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |
| S70 | DONE | AI prompt/tool/actor/领域工具、多模型路由、AI 设置、月报、跳时、记忆、地图接口、MiMo AI-first smoke、JSON/SQLite parity 和 S70 归档 | [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) |
| S71 | DONE | 数据库 resolver 输入、SQLite 维护、安全搜索、redacted API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收归档 | [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md) |
| S72 | DONE | PixiJS 水墨地图、首批地图素材、局势簿联动、水墨动效、浏览器验收、安全回归和归档 | [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md) |
| S73-S77 | DONE | 前端水墨重构：素材体系、React/Vite/React Router 多页迁移、首页/全局 shell、身份/场景专题、考试/放榜、独立舆图页、立绘管线、安全/性能/可访问性和验收归档 | [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。S70.12 起玩家 route response 内的兼容 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`，记忆与经历摘要只能通过安全 view 暴露。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

S73-S77 前端水墨重构专项已完成并归档。S72 细节见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)；S73-S77 完成范围见 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，任务书源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。本节只保留当前专项小步骤、owner 和交接边界，不把 S49-S72 的 DONE 长表展开回活动台账。

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
| S75.7 | DONE | Codex + medium 实施子代理尝试/只读复审子代理 | 显示偏好 | 动效、字体大小、正文字体、对比度、自动滚动和地图动效已通过白名单 schema 保存在本地安全偏好 |
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
| S76.10 | DONE | Codex + low 创意发散子代理 + medium 只读勘察子代理 | NPC 与玩家立绘接线 | 开局页已接入案主立绘选择，人物页改为本局公开人物谱牒；只使用已审核 `portraitRef`、缩略图、低清占位和 fallback，通用 NPC 不抽重要 NPC 专属池，不暴露全量素材池 |
| S76.11 | DONE | Codex + low 创意发散子代理 + medium 只读勘察子代理 | 专题 surface 扩展位 | 已扩展奏折、圣旨、朝议、堂审、军议、人物档案等 registry-backed surface；每个专题显示安全数据来源、占位状态和裁决边界，无安全 projection 时只显示草稿/占位；S78 已在此基础上深化为可审阅、可拟稿、可写入底部奏折的专题玩法 |
| S78 | DONE | Codex + low/medium 只读勘察子代理 + 只读复审子代理 | 官署专题玩法化 | 已新增 `topicSurfaceView` 安全投影、`topic_draft` AI task、`GET /api/game/topic-surface/:sessionId/:surfaceId`、`POST /api/ai/topic-draft/:sessionId`、六类专题三栏工作台、Mock/provider 草稿和安全降级；AI 只拟稿，不推进时间、不调用 resolver、不写 canonical state |
| S76.12 | DONE | Codex + 只读勘察/复审子代理 | S76 验收 | 已完成 S76 总验收：browser smoke 补强大臣直启、六类专题逐项打开和 S76 截图产物；完整书生科举路径由 `smoke:exam-s69` 验证到入仕；S77 继续安全、性能、可访问性与归档 |
| S77.1 | DONE | Codex + 只读勘察子代理/只读复审子代理 | 默认入口确认 | 已新增 `scripts/ensureClientBuild.js` 并接入 `prestart`，缺失或陈旧 `dist/client` 会自动构建、已最新则跳过；多页 React Router history fallback 和旧 `/legacy.html` / `/ink-client` 文件不存在已纳入测试 |
| S77.2 | DONE | Codex + low/medium 勘察子代理 + 只读复审子代理 | Browser smoke 扩展 | 已在既有 React smoke 覆盖首页、设置、存档、返回首页/继续本局、主游戏普通回合、地图、考试、放榜、身份行动、低动效偏好和移动端基础上，新增多页 history back/forward 与地图运行时资源失败 fallback 验收 |
| S77.3 | DONE | Codex + low/medium 勘察子代理 + 只读复审子代理 | 视觉与像素检查 | 已补强 React smoke 的背景/地图/立绘像素与资源检查、通用可见文本重叠扫描和玩家文案开发口径扫描；引入自托管 Noto Serif SC 解决 Linux/CI 中文方框字，人工复看 S77.3 截图集未发现明显重叠、现代元素、水印、乱码、露骨或幼态问题 |
| S77.4 | DONE | Codex + low 只读勘察子代理 + 只读复审子代理 | 安全污染防线 | React smoke 已统一扫描 DOM、localStorage/sessionStorage、manifest runtime 字段和截图产物名中的 key、本地路径、raw prompt/provider、hidden/raw 词样；读档仍只走 `player-state`，舆图只读 `mapRuntimeView`，科举/皇榜不展示弥封映射或考官隐藏意图词样 |
| S77.5 | DONE | Codex + 只读子代理 | 性能与资源预算 | 已新增精简 runtime manifest、client 构建产物预算和浏览器资源预算；可见人物用已审核主图保证清晰，全量立绘池仍按当前页范围懒加载 |
| S77.6 | DONE | Codex + low/medium 创意/前端子代理 + 只读复审子代理 | 可访问性与字体系统 | 已新增自托管字体选择、`bodyFont` 本地白名单、考试/皇榜/金榜题名艺术字、浏览器级 reduced-motion 深测和按钮/链接内部文本溢出守护 |
| S77.7 | DONE | Codex + 只读勘察子代理 | 文档与归档 | 已更新 README、brief、共享上下文、活动台账，并新增 `FRONTEND_INK_REDESIGN_ARCHIVE.md` |
| S77.8 | DONE | Codex + 只读复审子代理 | 总验收 | 已通过 `npm test`、client typecheck/test/build、browser smoke、exam smoke、dual-mode、docs governance 和 diff check |

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

### 2026-05-19：S76.10 NPC 与玩家立绘接线

- 范围：开局页新增案主立绘选择，候选来自已审核 manifest runtime 池，按身份阶段筛选玩家池并保持女性高清重制优先、无重制时使用已审核原图；`POST /api/game/start` 接受并保存安全 `portraitRef`。人物页由“立绘素材目录”改为当前案卷人物谱牒，读取 `worldState.player` 与安全 `worldPeopleView.npcs/relationships`，每页最多 8 人，玩家优先使用已选立绘，NPC 只从通用 NPC 池按公开身份/性别匹配；缺失、污染或未入 registry 的 ref 使用纸底 fallback。
- 安全：本轮不新增 provider schema、SQLite schema、AI 权限、服务器 resolver 或 canonical 裁决规则；新增后端 `portraitRef` 只允许安全 `portrait-...` id，不接受本地路径、远程 URL、key/path/raw/provider/prompt/hidden 等污染片段。`redactedState` 玩家白名单仅暴露清洗后的 `portraitRef`，`worldPeopleSchemas` 只把可见 NPC 的安全 `portraitRef` 投影给前端。前端只把 `portraitRef` 当 opaque id 交给 registry 命中，不拼路径、不展示未审核素材、不暴露全量素材池数量，不把重要 NPC 专属池随机混入通用 NPC。
- 子代理：按用户要求委派 low 创意发散子代理提供人物谱牒布局、女性重制优先和通用/专属池边界建议；委派 medium 只读勘察子代理核对 `Portrait`、registry、`worldPeopleView`、redacted player state、测试和 smoke 缺口。二者均未改文件、未运行 Git 操作。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js test/gameStartRole.test.js test/redactedState.test.js test/worldPeopleSchemas.test.js`（46 项）、`npm run test:client`（62 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-10-people-portraits`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（906 项通过、0 失败）。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败；提交前只读复审先发现旧档污染 `portraitRef` 清洗和人物谱牒总量上限缺口，均已修复并补测试，最终复审未发现 P0/P1/P2/P3。
- 下一步：S76.11 已提供专题 surface 扩展位；S78 将在同一入口上深化为真实材料、证据勾选、AI 草稿和底部奏折写入闭环，同时继续保持安全 projection 与服务器裁决边界。

### 2026-05-19：S76.11 专题 surface 扩展位

- 范围：扩展 React `LocalSurface` 与 `surfaceRegistry`，补齐奏折队列、拟圣旨、朝议、堂审、军议、人物档案和既有舆图筛选的安全数据来源、占位状态、裁决边界与草稿模板；`SurfaceHost` 统一展示这些说明并继续只把按钮写入底部奏折草稿。`CourtPage` 升级为“朝议与官署”专题入口页，分组呈现御案/台阁、官署/军帐和公开人物入口。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；专题层不读取 raw state、dev diagnostics、provider payload、完整 prompt、本地路径、key、hidden 私档、未公开关系或内部审计原文。无安全 projection 时只显示占位，不伪造奏折队列、诏令生效、朝议发言、判词、敌情真值、兵力实数或人物 hidden 真值；按钮只调用 `openSurface` / `setActionDraft`，不提交普通回合、不调用 resolver、不推进时间、不写数据库。
- 子代理：按用户要求委派 low 创意发散子代理提供六类专题定位、中文文案和安全 draft 模板；委派 medium 只读勘察子代理核对现有 surface 流、最小改动文件、测试/smoke 缺口和安全风险。二者均未改文件、未运行 Git 操作。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（27 项）、`npm run test:client`（62 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-11-topic-surfaces`（含 `desktop-topic-surfaces`）、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（907 项通过、0 失败）。本轮先因 Vitest 缺少 npm optional dependency `@rolldown/binding-linux-x64-gnu` 启动失败，已运行 `npm install` 修复本地依赖后重跑通过；Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S76.12 S76 验收，围绕完整书生路径、代表身份行动、考试/放榜、地图、专题 surface、hidden/raw 防线和移动端做总验收。

### 2026-05-19：S78 官署专题玩法化

- 范围：在 S76.11 六类入口基础上新增统一 `topicSurfaceView` 安全投影，并把奏折队列、拟圣旨、朝议、堂审、军议和人物公开档案升级为三栏工作台：材料栏显示玩家可见议题、证据、人物摘要和上一轮公开结果；筹议栏提供证据勾选、立场/文体选择、风险提示和场景发言摘要；草稿栏可请求 AI/Mock 拟稿、玩家改稿并写入底部奏折。
- API/AI：新增只读 `GET /api/game/topic-surface/:sessionId/:surfaceId` 与 `POST /api/ai/topic-draft/:sessionId`，新增 `topic_draft` AI task、prompt pack、schema、模型路由和 Mock fallback。`topic-draft` 只生成标题、正文、引用证据、风险和下一步建议，不提交普通回合、不推进时间、不调用 resolver、不写 canonical state；真实后果仍由 `POST /api/game/turn` 以及现有 `cityPolicyResolver`、`judicialCaseResolver`、`militaryDiplomacyResolver`、`sceneRuntime` 等服务器裁决链拥有。
- 安全：服务端只给当前 surface 的安全 view、玩家公开身份、可见 evidence refs、允许草稿动作和文体要求；响应会校验证据白名单、结构化 JSON、污染词、伪造裁决/任免/结案/胜利等成案话术，并在坏 JSON、越权证据、provider 异常或污染文本时降级本地草稿。前端 store 只保存专题 view 与草稿响应，不接 raw state、开发诊断、provider payload、完整 prompt、本地路径、key 或未公开人物真值。
- 子代理：按项目规则委派 low/medium 只读勘察子代理拆分前端 surface/API 接线与后端安全投影/AI 协议；提交前只读复审发现 P2 裸 `provider/prompt` 草稿污染词缺口和 P3 军议/拟旨地图来源名不一致，均已修复并补回归测试。子代理未提交、未推送、未创建 PR。
- 验证：已通过聚焦 `node --check`、`node --test test/topicSurfaceView.test.js test/topicDraftRoute.test.js test/modelRoutePolicy.test.js test/prompts.test.js test/aiSettings.test.js test/aiSettingsRoute.test.js test/aiSchemas.test.js`（74 项）、`npm run typecheck:client`、`npm run test:client`（63 项）、`node --test test/reactClientScaffold.test.js`（27 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、完整 `npm test`（925 项通过）、`npm run smoke:browser -- --client react --screenshots artifacts/s78-topic-surfaces`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`（仅 CRLF/LF 提示）；初次 S78 browser smoke 因脚本仍检查旧 resolver 字样失败，已改为接受 S78 服务器裁决边界并重跑通过。
- 下一步：S76.12 已完成，进入 S77 总验收，继续覆盖默认入口确认、安全污染防线、性能资源预算、可访问性、视觉像素检查和前端水墨重构归档。

### 2026-05-19：S76.12 S76 验收

- 范围：完成 S76 总验收收口。`scripts/clientSmoke.js` 补强 S76 browser smoke：大臣身份现在与入仕官员分开直启验证，六类官署专题 surface 会逐项打开检查材料/筹议/草稿三栏和裁决边界，仍只对朝议执行一次 AI/Mock 拟稿与写入底部奏折以控制时长；快捷建议按钮点击加入小范围重试，避免 Mock 建议刷新时的 DOM 替换竞态误报。公开 UI manifest 顶层说明改为普通中文安全描述，不再在浏览器可读 manifest 里列出敏感词样；前端素材 QA 与立绘压缩 QA 已刷新对应 manifest hash。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入。React smoke 继续拦截 `/api/game/state/*` 与 `/api/dev/*`，各身份面板和专题按钮只写草稿、不提交普通回合、不推进时间、不调用 resolver；结构化污染扫描覆盖 `artifacts/s76-frontend-ink` 文件名和 `ink-ui-manifest.json`，避免 key/path/raw prompt/provider payload/hiddenNotes 等泄漏形状进入公开产物。
- 子代理：按项目规则委派只读勘察子代理检查 S76.12 覆盖；其确认完整科举路径由 `smoke:exam-s69` 覆盖，React smoke 覆盖六类身份、考试/放榜、舆图、人物谱牒、专题 surface、移动端和 unsafe 防线，并建议补强大臣直启与六类专题逐项打开。子代理未改文件、未运行 Git 操作。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`npm run test:client`（63 项）、`node --test test/reactClientScaffold.test.js`（27 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s76-frontend-ink`（覆盖 desktop-minister-panel 与六类专题逐项打开）、`npm run smoke:exam-s69`（`child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`）、`npm run smoke:dual-mode -- --storage-only`、`npm run qa:frontend-assets`、`npm run qa:portrait-compression`、`node --test test/frontendInkAssetsManifest.test.js`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、结构化污染扫描、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（925 项通过、0 失败）。初次 browser smoke 因快捷建议按钮刷新竞态失败，已改为重试后通过；初次素材 QA 因 manifest hash 失效失败，已刷新 sidecar 后通过；一次朴素文本污染扫描误扫 PNG 二进制与审核摘要，已改为结构化扫描后通过。
- 下一步：进入 S77，总验收重点放在默认入口确认、安全污染防线、性能资源预算、可访问性、视觉像素检查和前端水墨重构归档。

### 2026-05-19：S77.1 默认入口确认

- 范围：新增 `scripts/ensureClientBuild.js` 并把 `package.json` 的 `prestart` 改为运行该脚本。脚本检查 `dist/client/index.html` 是否缺失，或是否早于 `client/`、`vite.config.mjs`、`tsconfig.client.json`、`package.json`、`package-lock.json`；缺失/陈旧时自动运行 `npm run build:client`，已最新时跳过，保证 `npm install && npm start` 不因缺 React 构建产物坏掉。
- 入口确认：`server.js` 既有 Express fallback 继续只对 HTML GET/HEAD 前端路由返回 React shell，并排除 `/api`、`/assets`、`/client-assets`、`/vendor`、`/mapRenderer.js`、`/mapPanel.js` 与带扩展名资源；`test/reactClientScaffold.test.js` 已显式覆盖 `/game/:sessionId`、`map`、`people`、`archive`、`exam`、`ranking`、`court`、`settings` 刷新 fallback，并确认产品内没有 `public/legacy.html`、`public/ink-client` 或根级 `ink-client` 旧双入口文件。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；旧 `public/index.html`、`public/app.js`、`public/styles.css` 仍仅作迁移参考，不恢复产品内 `/legacy.html` 或 `/ink-client/` 双入口。
- 子代理：只读勘察子代理确认 S77.1 主要缺口是构建兜底命名机制、fallback/旧入口文件测试和台账同步；提交前只读复审未发现 P0/P1，指出的 P2/P3 文档收口滞后已修正。
- 验证：已通过 `node --check scripts/ensureClientBuild.js`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（29 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`node scripts/ensureClientBuild.js`、`npm run typecheck:client`、`npm run test:client`（63 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s77-1-default-entry`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（927 项通过、0 失败）。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S77.2 浏览器 smoke 扩展，继续加深默认入口、多页前进后退、资源失败、低动效和移动端验收。

### 2026-05-19：S77.2 浏览器 smoke 扩展

- 范围：在 `scripts/clientSmoke.js` 中新增 `assertHistoryBackForward()` 与 `assertMapResourceFailureFallback()`。React browser smoke 现在从舆图页进入人物页后执行浏览器 `goBack()` / `goForward()`，分别断言回到当前 session 舆图和前进到当前 session 人物谱牒，继续检查 React entry、ready selector、无横向溢出和 unsafe API 防线；另开临时页面拦截 `/vendor/pixi.min.js` 与 `/mapRenderer.js`，验证地图运行时资源失败时显示安全中文 fallback、不渲染坏 canvas、不泄漏 hidden/raw/provider/path/key 形状、不触碰 `/api/game/state/*` 或 `/api/dev/*`。`test/reactClientScaffold.test.js` 新增 S77.2 源码守护测试，锁住 history 和资源失败 smoke 覆盖。
- 覆盖口径：S77.2 沿用 S76.12/S77.1 已有覆盖：首页开局、设置抽屉、旧案存档/读档、返回首页/继续本局、主游戏普通回合、独立舆图、人物谱牒、史册、科举考试、放榜、六类身份代表草稿行动、专题 surface、应用显示偏好低动效和移动端首页/印匣/奏折/考试/放榜/舆图。本轮新增的是缺口项：浏览器历史栈和地图运行时脚本失败 fallback；浏览器级 `prefers-reduced-motion` 深测仍留给 S77.6 可访问性步骤。
- 子代理：按用户要求使用 low 子代理做 S77.2 覆盖差距勘察，medium 子代理做前端体验/资源 fallback/history/reduced-motion 建议；二者均只读，未改文件、未运行 Git 操作。提交前只读最终 diff 复审未发现 P0/P1/P2，提出的 P3 文档收口建议已修正。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（30 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run typecheck:client`、`npm run test:client`（63 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s77-2-browser-smoke`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（928 项通过、0 失败）；Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S77.3 视觉与像素检查，重点复核首页、地图、考试、放榜、人物谱牒和专题 surface 的桌面/移动截图非空、无明显重叠、素材基调一致；随后继续 S77.4 安全污染防线、S77.5 性能资源预算、S77.6 可访问性、S77.7 归档和 S77.8 总验证。

### 2026-05-19：S77.3 视觉与像素检查

- 范围：`scripts/clientSmoke.js` 新增 S77.3 视觉断言：已审核背景资源加载与像素非空检查、PixiJS 舆图 canvas 像素采样、人物谱牒缩略图资源可取与布局检查、可见文本/控件粗重叠扫描、玩家可见开发口径词扫描；快捷建议点击改为按当前可见建议 slip 重取，避免 Mock 建议刷新导致等待旧文案；地图标签、顶栏和固定底部奏折等刻意布局不纳入通用重叠误报。`test/reactClientScaffold.test.js` 新增 S77.3 源码守护与纯函数测试。
- 字体与文案：人工复看初版 S77.3 首页截图发现 Linux/WSL 缺 CJK 系统字体时中文显示为方框；本轮新增 runtime 依赖 `@fontsource/noto-serif-sc@^5.2.9`，在 React 入口只导入简体中文 400/700/900 三个字重，许可证 OFL-1.1，避免不同环境中文缺字。玩家可见安全说明改为“内部推演细节、连接凭据、私密材料”等产品语气，不再把“完整提示词/本地路径/密钥/内部审计原文”等敏感词样展示给玩家。
- 依赖/插件记录：名称 `@fontsource/noto-serif-sc`；类型 runtime dependency；版本 `^5.2.9`，未使用 `latest`；引入步骤 S77.3；用途为自托管 Noto Serif SC 简体中文字体，替代对操作系统中文字体的隐式依赖；影响范围 browser/client build/tests/docs；许可证 OFL-1.1；维护状态为 Fontsource 官方包，npm 发布清晰；安全与隐私不引入网络、密钥、遥测或原生编译，只有字体文件进入 client bundle；备选方案为继续依赖系统字体或复制本机 Windows 字体，前者导致方框字，后者授权边界不合适；Mock/no-key 无影响；安装与运行影响为 `npm install` 多安装一个字体包，构建输出增加三个字体资源；回滚策略为移除依赖、`client/src/main.tsx` 字体 import 和 lockfile 记录；文档落点为本记录、依赖治理、README、brief 与共享上下文；决策为保留。
- 人工视觉复看：复看 `artifacts/s77-3-visual-pixel` 的首页、主卷、舆图、人物谱牒、考试、放榜、专题 surface、印匣、六类身份面板和移动端首页/奏折/考试/放榜/舆图截图；中文已正常渲染，桌面/移动未见明显文本重叠或按钮遮挡，首页/考试/放榜背景与舆图 canvas 非空，人物缩略图使用已审核 `/assets/ui/` 资源；未见现代元素、水印、乱码、露骨或幼态问题。地图地名局部拥挤属于舆图标注层，不影响主流程文字或控件。
- 子代理：按用户要求委派 low 子代理做视觉复核口径发散，medium 子代理做自动化缺口勘察；二者只读、未改文件、未运行 Git 操作。提交前只读复审按最终 diff 和验证证据执行。
- 验证：已通过 `npm install`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（31 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run typecheck:client`、`npm run test:client`（63 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s77-3-visual-pixel`、`npm audit --omit=dev`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`、完整 `npm test`（929 项通过、0 失败）和提交前只读复审。首次 `npm run test:client` 曾因本机 rolldown npm optional binding 缺失启动失败，已运行 `npm install` 修复本地依赖后通过；多轮 browser smoke 曾暴露快捷建议刷新竞态、地图标签/顶栏重叠误报、lazy 立绘加载等待过严、考试 hero 状态切换和专题 surface 安全文案敏感词样，均已修正并重跑通过。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S77.4 安全污染防线，继续扫描 DOM、localStorage、manifest 和截图产物中 key、本地路径、raw prompt/provider、hidden/raw 词样，并保持读档只走 redacted player API、地图只读 `mapRuntimeView`、考试不暴露弥封与考官隐藏意图。

### 2026-05-19：S77.4 安全污染防线

- 范围：`scripts/clientSmoke.js` 新增统一安全污染扫描 helper，React smoke 现在在每个页面检查 DOM 文本、表单值和关键 `data-*` 属性，并在主流程中扫描 `localStorage` / `sessionStorage`、运行时 manifest 安全字段和截图产物名，阻断 key、本地路径、raw prompt/provider、hidden/raw、`/api/game/state` 与 `/api/dev` 词样。manifest 扫描只检查运行时会使用的路径、id、usage、fallback、review status、lazy-load 等字段，不把审核说明当作浏览器运行时数据源；`assetRegistry` 也会拒绝 active manifest 暴露 `source.localHighResSourcePath`。科举/皇榜玩家文案改为“已公开考试快照/榜文”口径，不在 DOM 展示弥封映射、考官隐藏意图或模型原始提案等内部词样。
- 安全：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；普通读档仍只走 `GET /api/game/player-state/:sessionId`，S77.4 smoke 继续监听 unsafe API 请求，地图仍只读 `mapRuntimeView`，考试/放榜仍由服务器裁决。
- 子代理：low 只读子代理完成 S77.4 缺口扫描，指出 DOM 属性、storage、manifest、截图产物、考试静态文案和 `localHighResSourcePath` registry 缺口；未改文件、未运行 Git 操作。提交前只读复审发现的 Unix/macOS 本地路径漏扫、考试/放榜交互态未统一调用 S77.4 扫描和尾部下一步口径滞后均已修正。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（32 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run typecheck:client`、`npm run test:client`（64 项）、`npm run build:client`、`npm run smoke:browser -- --client react --screenshots artifacts/s77-4-security-pollution`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（930 项通过、0 失败）；首次 `npm run test:client -- --runInBand` 因 Vitest 不支持该参数失败，随后按项目脚本原样重跑通过。一次提交前 browser smoke 曾因 Unix 路径正则误扫 `/assets/ui/home/...` 失败，已改为只匹配路径边界后的本地路径并重跑通过。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S77.5 性能与资源预算，重点确认首屏只加载必要素材，场景/立绘按需加载，全量立绘不进入首屏 bundle。

### 2026-05-19：S77.5 性能与资源预算

- 范围：新增 `scripts/frontendRuntimeManifest.js` 和 `public/assets/ui/ink-ui-runtime-manifest.json`，React `assetRegistry` 改读精简 runtime manifest；浏览器运行时不再读取 2.4MB 级完整素材 manifest，精简文件约 0.69MB，只保留路径、usage、fallback、review status、portraitRef、懒加载和运行时必要字段，不包含审核说明、本地母版路径、性能报告或生成记录。新增 `scripts/clientBuildBudget.js` 与 `budget:client`，`npm run smoke:browser` 现在先检查 runtime manifest 新鲜度，再在 Vite build 后检查 JS/CSS/字体/client-assets 预算，并阻止 `public/assets/ui` 大图、S72 地图运行时或立绘池被打进 `dist/client/client-assets`。
- 浏览器资源预算：`scripts/clientSmoke.js` 新增 S77.5 resource timing 分类和断言：首页不请求完整 `ink-ui-manifest.json`，不加载 `/vendor/pixi.min.js` 或 `/mapRenderer.js`；舆图页必须按需加载 Pixi 与 mapRenderer；人物页等可见立绘稳定加载后再计量，不得越过当前页公开人物范围拉取全量立绘池。按用户最新偏好，人物立绘以清晰为先：当前可见人物和首页案主候选使用已审核主图，预算统计覆盖 `/assets/ui/portraits/` 下所有非 placeholder 主图，限制首页最多 6 张、人物页最多 8 张，以及不得一次性请求全量 S73.10 主图。
- 安全/边界：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；普通读档仍只走 `GET /api/game/player-state/:sessionId`，地图仍只读 `mapRuntimeView`，专题草稿仍是 S78 draft-only。完整素材 manifest 继续是素材生产/QA 源头，runtime manifest 是由脚本生成的浏览器投影。
- 子代理：Anscombe 只读勘察了 S77.5 现有守护和建议断言，未改文件、未运行 Git 操作；Beauvoir 提交前只读复审未发现 P0/P1，提出的 P2 主图统计漏根目录、人物页预算快照过早、smoke 未检查 runtime manifest 新鲜度和 README 旧口径均已修正。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --check scripts/frontendRuntimeManifest.js`、`node --check scripts/clientBuildBudget.js`、`node scripts/frontendRuntimeManifest.js`、`node --test test/reactClientScaffold.test.js`（34 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run typecheck:client`、`npm run test:client`（65 项）、`node --test test/frontendInkAssetsManifest.test.js`（16 项）、`npm run smoke:browser -- --client react --screenshots artifacts/s77-5-resource-budget`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅 CRLF/LF 提示）和完整 `npm test`（932 项通过、0 失败）。Vite 构建仍保留既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 下一步：S77.6 可访问性，重点补浏览器级 `prefers-reduced-motion`、键盘路径、焦点回收、字体大小/对比度和按钮文本溢出。

### 2026-05-19：S77.6 可访问性与字体系统

- 范围：新增 `@fontsource/zcool-xiaowei`、`@fontsource/long-cang` 和 `@fontsource/ma-shan-zheng` runtime 字体依赖，均只导入简体中文 400 子集并与既有 `@fontsource/noto-serif-sc` 一起自托管。`displayPreferenceStorage` 在 `qianqiu.displayPreferences.v1` 中新增 `bodyFont` 白名单，允许 `serif-classic`、`song-xiaowei`、`kai-longcang`、`brush-mashan` 四值；旧本地设置缺字段时回落默认，不写入存档、服务器 canonical state、AI prompt、provider schema 或 SQLite。
- 前端体验：印匣“显示”tab 新增“正文字体”选择，`AppShell` 输出 `data-body-font`，全局 CSS 通过字体变量控制正文、按钮、输入框和常规面板。考试页题头/交卷朱印、皇榜标题、三鼎甲和玩家取中时的“金榜题名”层由游戏固定使用艺术字，并用 CSS 墨晕、朱砂圈名、淡金题字表现；低动效时静态呈现，不新增图片资产。
- 可访问性守护：继续保护 Enter 提交、Shift+Enter 换行、Esc 关闭、焦点回收、大字和高对比度；`scripts/clientSmoke.js` 新增浏览器级 `prefers-reduced-motion: reduce` context 深测，并补按钮、链接和可点击控件内部文字溢出扫描。构建和浏览器资源预算同步放宽字体上限，同时保留 S77.5 硬边界：首页不请求完整 manifest、不加载地图运行时、不一次性拉取全量立绘池。
- 安全/边界：本轮不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；放榜高光只根据服务器安全 projection 中的玩家榜单行或已通过结果展示，不在前端补榜、判防弊、推断授官或改排名。
- 子代理：前期 low/medium 子代理已提供字体与场景艺术字方向建议；提交前只读复审发现 P2：放榜页旧逻辑会用同名榜行推断玩家高光。已修正为只信服务器 `isPlayer: true`，缺玩家行时只允许 `promotionResult.passed === true` 显示通过高光，并补“同名但未标记不高亮”回归测试；二次只读复审确认无 P0/P1/P2，子代理均未改文件、未运行 Git 操作。
- 验证：已通过 `npm install`、`node --check scripts/clientSmoke.js`、`node --check scripts/clientBuildBudget.js`、`npm run typecheck:client`、`npm run test:client`（66 项）、`node --test test/reactClientScaffold.test.js`（35 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run build:client`、`node scripts/clientBuildBudget.js`、`npm run smoke:browser -- --client react --screenshots artifacts/s77-6-accessibility-fonts`、`npm audit --omit=dev`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`（仅换行提示）和完整 `npm test`（933 项通过、0 失败）。本轮调高字体总量与 client-assets 总预算以匹配自托管字体真实产物，且把人物页资源预算前的立绘等待改为先滚入人物列表、只等待视口内 lazy 立绘，避免字体排版变化导致视口外图片阻塞 smoke。
- 下一步：S77.7 文档与归档、S77.8 总验证；若继续扩展字体，只能走同一依赖治理、资源预算和可访问性降级流程。

### 2026-05-19：S77.7 文档与归档

- 范围：新增 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，将 S73-S77 的素材体系、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、安全投影、资源预算、可访问性和验收入口收束为专题归档；README、brief、共享上下文和本活动台账均改为“S73-S77 已完成归档”口径，`FRONTEND_INK_REDESIGN_ROADMAP.md` 保留为规划源头。
- 文档同步：README API 概览补齐 `POST /api/ai/quick-actions/:sessionId`、`GET /api/game/topic-surface/:sessionId/:surfaceId` 和 `POST /api/ai/topic-draft/:sessionId`；归档中特别标清 S78 是基于 S76.11 surface 的相邻后续，不把 S78 的玩法责任混入 S77 验收边界。
- 边界：本轮不新增运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state 写入；所有后续前端玩法仍必须沿用安全 projection、proposal-only、服务器裁决、Mock/no-key fallback 和资源预算守门。
- 子代理：Raman 只读梳理了归档清单、同步要点和风险，未改文件、未运行 Git 操作；提交前还将执行只读复审最终 diff 与验证证据。
- 验证：随 S77.8 总验证统一记录。
- 下一步：完成 S77.8 总验证，随后后续玩法从 S79 或新的明确小步骤开题。

### 2026-05-19：S77.8 总验证

- 范围：对 S73-S77 前端水墨重构归档后的默认入口、前端构建、React 测试、浏览器 smoke、完整书生科举链、JSON/SQLite storage-only 双模式、文档治理和 diff hygiene 做总验收。本轮不新增运行时代码、后端 API、provider schema、SQLite schema、AI 权限或服务器 resolver。
- 浏览器结果：`npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink` 通过；运行时 manifest 检查为 642 assets、3 fallbacks、689022/2396314 bytes；build budget 为 JS 458.8 KiB、CSS 58.1 KiB、fonts 26288.4 KiB、client-assets 26805.4 KiB。smoke 覆盖默认首页 Mock 开局、当前 session 导航、印匣、显示偏好、旧案读档、返回首页/继续本局、普通回合、舆图、人物、史册、考试、放榜、朝议专题、六类身份面板、移动端、浏览器级 reduced-motion、history back/forward、地图资源失败 fallback、视觉像素、资源预算和安全污染扫描。Vite 继续输出既有 `/assets/ui/...` 运行时资源解析提示，不是新失败。
- 科举与双模式：`npm run smoke:exam-s69` 通过，完整跑通 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`，最终角色为 `official`、官职为翰林院修撰；`npm run smoke:dual-mode -- --storage-only` 通过，JSON/SQLite 导入、地理修复、安全审计 projection、S70 AI-first parity、large fixture、prompt 策略、局势簿分页、SQLite 读修复、性能门槛和 hidden-token 防线均为 ok。
- 其他验证：已通过 `node --check scripts/clientSmoke.js`、`node --check scripts/clientBuildBudget.js`、`npm test`（933 项）、`npm run typecheck:client`、`npm run test:client`（66 项）、`npm run build:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和最终 `git diff --check`。
- 子代理：Raman 只读梳理归档清单；提交前只读复审最终 diff 与验证证据后再提交。子代理均未改文件、未运行 Git 操作。
- 下一步：S73-S77 前端水墨重构已完成归档；后续官署专题、地图、长期档案、多 actor 朝议、素材补丁或视觉改动应从 S79 或新的明确小步骤开题，并继续沿用安全 projection、proposal-only、服务器裁决、资源预算和可访问性守门。

### 当前最新完成节点

- S77.7 已完成文档与归档。新增 `docs/FRONTEND_INK_REDESIGN_ARCHIVE.md`，README、brief、共享上下文和活动台账已统一为 S73-S77 已归档口径。
- S77.8 已完成总验证。`npm test`、client typecheck/test/build、React browser smoke、Mock 科举链、JSON/SQLite storage-only 双模式、docs governance、documentation governance 和 diff check 均通过。
- S77.6 已完成可访问性与字体系统。React 入口新增三套自托管艺术/正文字体，显示偏好新增 `bodyFont` 本地白名单，印匣“显示”tab 可选择正文字体；考试、皇榜和金榜题名使用固定艺术字和低动效可降级 CSS 特效；browser smoke 覆盖浏览器级 reduced-motion 与按钮/链接内部文本溢出。
- S77.5 已完成性能与资源预算。React 运行时改读精简 `ink-ui-runtime-manifest.json`；`npm run smoke:browser` 新增构建产物预算和真实浏览器资源预算；当前可见人物为清晰体验加载已审核主图，但首页/人物页仍按可见数量设上限，全量立绘池不进入首屏或一次性请求。
- S77.4 已完成安全污染防线。React smoke 现在统一扫描 DOM、浏览器存储、运行时 manifest 安全字段和截图产物名，阻断 key、本地路径、raw prompt/provider、hidden/raw 词样；科举/皇榜不再把弥封映射、考官隐藏意图或模型原始提案词样作为玩家可见文案。
- S77.3 已完成视觉与像素检查。React smoke 现在覆盖首页/考试/放榜已审核背景加载与像素非空、舆图 canvas 像素采样、人物缩略图资源、可见文本/控件粗重叠和玩家可见开发口径词扫描；React 入口自托管 Noto Serif SC 简体中文字重，避免无 CJK 系统字体环境出现方框字；S77.3 截图集人工复看通过。
- S77.2 已完成浏览器 smoke 扩展。React smoke 在既有首页、设置、存档/读档、返回首页/继续本局、普通回合、地图、考试、放榜、身份行动、低动效偏好和移动端覆盖基础上，新增 `goBack()` / `goForward()` 多页历史栈断言，以及拦截 PixiJS/mapRenderer 脚本的地图运行时资源失败 fallback 验收。
- S76.12 已完成 S76 总验收。React browser smoke 现在覆盖书生、地方官、入仕官员、大臣、将领、皇帝六类身份代表草稿行动，逐个打开奏折队列、拟圣旨、朝议、堂审、军议、人物档案六类专题，并继续覆盖考试/放榜、独立舆图、人物谱牒、移动端和 unsafe API 防线；完整书生科举晋级链由 `npm run smoke:exam-s69` 验证到入仕。
- S78 已完成官署专题玩法化。`/game/:sessionId/court` 的奏折队列、拟圣旨、朝议、堂审、军议和人物档案六类入口现在读取 `topicSurfaceView` 安全投影，显示真实玩家可见材料、证据 ref、人物公开摘要、可选草稿模板和上一轮公开结果；`topic_draft` 只读 AI/Mock 草稿可生成标题、正文、引用证据、风险和下一步建议，并允许玩家改稿后写入底部奏折。专题草稿不提交回合、不调用 resolver、不推进时间、不写 canonical state，普通后果继续由 `/api/game/turn` 和服务器裁决链处理。
- S76.11 已完成专题 surface 扩展位，是 S78 玩法化的入口基础。`/game/:sessionId/court` 已提供奏折队列、拟圣旨、朝议、堂审、军议、人物档案六类入口；每个 registry-backed surface 都显示安全数据来源、占位状态和裁决边界。
- S76.10 已完成 NPC 与玩家立绘接线。开局页可从已审核玩家池选择案主立绘，女性候选优先高清重制；`portraitRef` 由服务端安全清洗后进入玩家可见状态。人物页现在只显示当前案卷的案主与公开可见 NPC，按页懒加载最多 8 人，NPC 只从通用 NPC 池按公开身份匹配，不抽重要 NPC 专属池，不显示未审核素材、不暴露全量素材池数量。
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
- S73-S77 已完成归档与总验证；后续玩法从 S79 或新的明确小步骤开题。

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

- S73-S77 前端水墨重构已完成并归档到 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。活动台账不再展开 S73-S77 的实现流水；后续前端、素材、地图或专题玩法应从新的小步骤继续。
- S72 PixiJS 水墨地图已完成并归档到 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)。活动台账不再展开 S72.0-S72.8 的实现流水；后续地图只复用安全 `mapRuntimeView`、S72 素材/manifest 和运行时契约。
- S49-S67 本地数据库与大世界内容、S68-S69 科举深化、S70 AI 编排、S71 数据库玩法化均已归档；活动台账只保留后续接手所需边界。

### 最近完整验证口径

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
- 结构化污染扫描由 `npm run smoke:browser` 覆盖 DOM、storage、runtime manifest、安全字段和 `artifacts/s77-frontend-ink` 截图产物名；完整素材 manifest 仍由 `qa:frontend-assets` 与 manifest 测试守门。

当前已知遗留：S73-S77 已完成归档与总验证；S78 已完成真实专题 `surface` 来源、AI 草稿和完整专题 composer 闭环，后续可在 S79 继续加深数值影响、长期档案追踪和更细的多 actor 朝议表现。
