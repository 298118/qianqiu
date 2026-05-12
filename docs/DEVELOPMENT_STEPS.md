# 《千秋》活动路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。旧阶段细节已经归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。旧分卷归档和 S60 契约文件保留为跳转页。

当前活动路线图已交接到 S70：S68-S69 的书生主线科举、读书、评卷与授官制度已归档，S70.1 prompt pack 与工具协议、S70.2 actor 权限模型、S70.3 `game_ai_tools` 运行时、S70.4 NPC mind 基础、S70.5 制度场景 helper 和 S70.6 压力事件工具协议已落地，下一步进入 S70.7 刑名、财政、军事、外交与科举领域工具。S71 作为 S70 之后的数据库玩法化、维护、安全检索和 redacted API 专项，规划见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)。数据库方向继续只考虑本机 JSON/SQLite 持久化增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

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
- 关键决策不能只留在聊天记录里；会影响后续 Codex 或 Claude Code 接手的内容必须写入仓库文档。

### 子代理使用规则

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
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

数据库专项继续继承 S46.1 的依赖、插件与开源参考治理。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex/Claude 插件工作流或开源参考时，必须先按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、改善浏览器体验或提供成熟标准能力。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端继续保持无构建流程，除非本路线图或后续明确步骤批准升级。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 [docs/AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是否需要更新。

<!-- GOVERNANCE_REQUIRED_END -->

## 3. 当前边界与已归档摘要

当前活动工作从 S70.1 开始。S49-S67 的本地数据库与大世界内容实现细节已经迁入统一归档，S68-S69 科举深化已迁入科举归档，活动台账只保留索引和后续边界：

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S67 | DONE | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | DONE | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器面板和 Provider/Mock 验收 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

已归档的 S49-S69 不再逐行列入活动总览；需要追溯时阅读上方归档摘要、对应归档文件和下方进度记录。当前活动总览只保留 S70 及后续待推进步骤。

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S70.0 | DONE | AI 编排提前规划：固定 AI 核心地位、现实权力原型、工具调用路线、actor 权限层和 S70 子步骤 | 2026-05-08 | Codex / Web / 子代理 | 见 git history |
| S70.1 | DONE | AI 提示词与工具协议契约：prompt pack 分层、actor/scene contract、MCP-friendly tool envelope、proposal/result schema、request-adjudication、direct-write 禁止、strict schema、MiMo-V2.5-Pro 工具调用 smoke、失败降级和 provider 兼容策略 | 2026-05-12 | Codex / Web / 子代理 | `ba576a1` |
| S70.2 | DONE | AI actor 与权限模型：按书生、士绅、地方官、大臣、将领、皇帝、系统引擎划分读取范围和工具组 | 2026-05-12 | Codex / 子代理 | `636f30a` |
| S70.3 | DONE | 内部工具运行时：`game_ai_tools` registry、权限检查、read/proposal/request-adjudication runner、服务器 resolver、审计 hook 和 Mock runner | 2026-05-12 | Codex / 子代理 | `4f94de9` |
| S70.4 | DONE | NPC mind 与记忆：高显著度 NPC LLM loop、背景 NPC heuristic、目标/恩怨/人情债记忆演化 | 2026-05-12 | Codex / 子代理 | `e030dc5` |
| S70.5 | DONE | 制度 AI 与朝议/科场场景：官署、派系、大臣、谏官、老师、考官围绕奏折/弹章/政令/考卷推演 | 2026-05-12 | Codex / 子代理 | `029d65a` |
| S70.6 | DONE | 压力事件工具协议与 actor proposal：由城市、财政、军政、关系、情报压力提出事件候选，固定工具 envelope、权限、Mock/provider 基础和服务器成案语义 | 2026-05-12 | Codex / 子代理 | `3847c5a` |
| S70.7 | TODO | 刑名、财政、军事、外交与科举工具：案牍、赈济、军令、战役、和议、宣战、评卷、授官 proposal 与 resolver | - | - | S70.6 后 |
| S70.8 | TODO | 多模型路由与仲裁：narrator、actor_mind、planner、domain_specialist、critic、safety 分工与成本边界 | - | - | S70.7 后 |
| S70.9 | TODO | AI 设置与可观测性：按叙事、NPC、科举、政务、战争、记忆、critic/safety 配置模型路由、输出长度、并发、工具预算、审计面板和 hidden-safe 诊断 | - | - | S70.8 后 |
| S70.10 | TODO | 玩家官职月报与 AI 推动世界：每三旬生成职位化月报、上级态度、同僚风向、NPC 主动请求、下月风险和待裁决差事 | - | - | S70.9 后 |
| S70.11 | TODO | 自然语言跳时：解析“学习一月/养病半月/照旧处理一月”，拆为多旬 batch tick、事件中断和跳时总结 | - | - | S70.10 后 |
| S70.12 | TODO | 大模型记忆系统：actor memory ledger、fact/impression memory、月度 summary、安全检索、来源/置信度/可见性/衰减 | - | - | S70.11 后 |
| S70.13 | TODO | 地图系统 AI 接口预留：`mapContextView`、`mapEntityRef`、地图可见性、移动/行军/赴任/赶考/外交 proposal schema | - | - | S70.12 后 |
| S70.14 | TODO | 真实 MiMo 验收与 S70 归档：MiMo-required provider smoke、JSON/SQLite parity、Mock 开发安全网、hidden-token、越权工具、browser smoke 和归档 | - | - | S70.13 后 |
| S71.0 | TODO | 数据库玩法化专项契约：确认 S70 后接入点、resolver 输入清单、维护/检索/redacted API 边界和内容保护 | - | - | S70.14 后 |
| S71.1 | TODO | 数据库作为玩法 resolver 输入：财政、城市、NPC、官职、事件、情报 projection 进入服务器裁决上下文 | - | - | S71.0 后 |
| S71.2 | TODO | 本地 SQLite schema migration 与维护层：`schema_migrations`、备份、VACUUM、索引健康、体积提示和脱敏导出 | - | - | S71.1 后 |
| S71.3 | TODO | 安全全文检索 / 本地搜索：FTS5 或 fallback，只索引 player-facing projection，不索引 hidden/raw | - | - | S71.2 后 |
| S71.4 | TODO | Redacted player API 与开发诊断 API：保存 hidden 私档前先拆玩家可见 state 和 hidden-safe diagnostics | - | - | S71.3 后 |
| S71.5 | TODO | 财政与城市政策 resolver：征粮、赈济、修堤、平粜、清丈、钱粮差事等服务器裁决 | - | - | S71.4 后 |
| S71.6 | TODO | 地方案件与刑名 resolver：堂审、证据、士绅压力、胥吏阻力、判决后果和案牍归档 | - | - | S71.5 后 |
| S71.7 | TODO | 军务与外交 resolver：侦察、固守、调粮、练兵、会战、互市、和议、宣战 request 和服务器裁决 | - | - | S71.6 后 |
| S71.8 | TODO | 压力驱动事件生成器：从粮价、水利、腐败、边防、NPC 怨怼和情报压力生成事件候选 | - | - | S71.7 后 |
| S71.9 | TODO | 多 actor 场景运行时：朝议、堂审、会盟、战役 scene-local time 与 actor proposal 编排 | - | - | S71.8 后 |
| S71.10 | TODO | NPC 记忆账本：高显著 NPC 长期记忆、人情债、恩怨、家族风险和背景 NPC heuristic | - | - | S71.9 后 |
| S71.11 | TODO | AI 调动审计面板：工具摘要、拒绝原因、成本、公开结果和 hidden-safe 开发诊断，不泄漏 raw prompt/proposal | - | - | S71.10 后 |
| S71.12 | TODO | S71 验收与归档：JSON/SQLite parity、Mock/no-key、provider smoke、browser smoke、hidden-token 和完整书生路径回归 | - | - | S71.11 后 |

## 5. S68-S69：科举、读书、评卷与授官深化

S68-S69 是书生主线的深度专项，详细提前规划见 [IMPERIAL_EXAM_DEEPENING_ROADMAP.md](IMPERIAL_EXAM_DEEPENING_ROADMAP.md)。当前系统已经能完成四级科举和殿试入仕，但仍是压缩版；S68-S69 的目标是把读书、老师、科场、评卷、榜单和授官做成长期制度生涯，并在 S70 多 AI 编排前先固定科举场景的 AI 工具边界。

### S68-S69 设计基线

- 当前四级科举 API、Mock/no-key 路径和 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 必须继续可用。
- AI 可生成题目、点评、老师建议、考官批语、科场事件和授官 proposal；服务器继续拥有资格、考期、舞弊、评分复核、榜单、解元/会元/状元/榜眼/探花、授官、任免和持久化裁决。
- 明清科举制度作为主要原型，但只复刻能形成玩法的制度：县试、府试、院试、保结、搜检、贡院号舍、三场多日多卷、弥封、誊录、对读、磨勘、复核、房官/同考官/主考官阅卷、名次荣誉、馆选、庶吉士、观政、铨选、候缺、外放和籍贯回避。
- 读书系统要从“属性增长”升级为“文风和弱点画像”：经义、制艺、策论、律例、史学、时务、卷面、耐力、老师风格和同年网络都应可影响考试表现。
- 授官不再只是三档固定映射；殿试名次、甲第、官缺、朝局、皇帝偏好、老师/同年网络、籍贯回避、舞弊争议和个人声誉都应进入服务器 resolver。

### 推荐玩法方向

- AI 老师：按历次文卷弱点给读书计划、书目、小题、改文建议和是否愿意作保。
- 童试三关：`child_exam` 外层 API 保持不变，内部拆县试、府试、院试；保结、点名、搜检、县府/学政批语和失败原因进入读书计划。
- 乡试/会试三场：第一场经义/制艺，第二场官样文书或经史应用，第三场策论/时务；三场多日、多卷、号舍疲劳和科场事故都走 scene-local time。
- 多卷流程：草稿、墨卷、弥封卷、誊录朱卷、对读/磨勘卷、公开档案分层保存；玩家只看到脱敏批语和复核结果。
- 多考官评卷：房官/同考官/主考/critic AI 给候选批语和风险，服务器生成 canonical ranking。
- 名次荣誉：乡试解元、会试会元、殿试状元/榜眼/探花/传胪、三元等进入声望、同年关系、老师名望和事件档案。
- 授官轨迹：一甲进翰林、二甲馆选/庶吉士/观政、三甲铨选/外放/候缺等路径与 S63 官职生态、S70 AI 工具和后续朝局需求联动。

## 6. S70：AI 提示词、工具协议与多 AI 编排

S70 是 MiMo + DeepSeek 之后的 AI 编排专项。当前 `mimo-deepseek` 仍只是 provider 方法级路由：普通叙事、开局、流式回合和科举出题走 MiMo，科举评卷走 DeepSeek V4 Pro。完整 AI actor、工具调用、NPC 智力、事件生成、制度推演、narrator/planner/critic/safety 仲裁、成本边界、失败降级和可观测性排在 S68-S69 之后启动。

详细提前规划见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。S70 的核心目标不是让模型直接改库，而是让 AI 在服务器法度内变成“有身份、有记忆、有权限、有后果”的世界行动者网络；S68-S69 提供科场、老师、考官和授官 resolver 的先行用例。该文档第 13-16 节已扩展为后续 Codex 开发任务书，逐项写明执行规则、运行依赖、项目资料、玩法资料、测试资料、建议模块/函数、工具/route 接口、测试文件和验收重点。

### S70 设计基线

- AI 是《千秋》的核心世界引擎。后续新增玩法、角色、官署、城市、事件、经济、战争、外交、浏览器面板或 prompt 检索时，都必须设计 AI actor、可读摘要、可调用工具、proposal 边界、服务器裁决、审计和 Mock/no-key 降级。
- S70 之后的正式游玩体验按 AI-first 设计：真实 AI 是产品核心，MiMo-V2.5-Pro 是大面积 provider 候选；Mock/no-key 只保留为本地开发、CI、断网降级和 deterministic 回归样板，不能再作为玩法深度上限。
- 当玩家选择高质量模式时，系统可以接受更长输出、更高并发和更大 token 消耗；但仍要有场景级超时、重试、工具次数、并发和失败降级上限。
- 工具调用采用“模型请求、服务器执行”：OpenAI/Anthropic/DeepSeek 等 provider 的 function calling、structured output、MCP connector 或未来内部 MCP 只能产生 tool call / proposal / request-adjudication；真正读写世界仍由服务器 helper、schema、权限检查、clamp、visibility filter、resolver 和 adapter transaction 完成。
- 领域工具是 AI 参与感的入口，不是 SQL 代理。老师、考官、县令、大臣、将领或皇帝可以调用各自工具提出读书计划、批卷、案牍处置、军令、外交或诏令，但工具返回的是待裁决意图；只有服务器接受后才写 `worldState`、SQLite 派生表、事件档案、审计和 revision。
- 提示词工程是 S70 的一等架构面。S70.1 必须把 prompt pack 分层、actor 角色卡、scene contract、visible context capsule、tool policy、output contract、self-check、prompt version、fixture、provider prompt smoke 和 prompt 注入红队写成契约；提示词只能引导叙事、proposal、tool call 或 request-adjudication，不能成为隐藏裁决权。
- S70.1-S70.3 先实现内部 `game_ai_tools` registry；工具定义必须保持 MCP-friendly 形状，至少包含 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown` 和 `mockFallback`。后期如果工具数量、按身份裁剪和跨 provider 发现需求明显膨胀，再在 `game_ai_tools` 外层包装内部 MCP server，`tools/list` 只列 actor 可见工具，`tools/call` 仍走同一 permission / resolver / audit 链。
- MiMo-V2.5-Pro 是 S70 大面积使用的主力 provider 候选；S70.1 必须补 MiMo 专项工具调用 smoke，验证 `tools` schema、`tool_calls` 返回形状、`tool_choice`、多工具调用、工具结果回填、streaming、structured proposal、超长上下文成本和 Mock/no-key fallback，不得把 OpenAI-compatible 直接视为工具协议全量兼容。
- 权力按现实原型分层：书生只影响自身学业、关系、文章、名声和局部微事件；地方官能审案、赈济、征粮和治理辖区；大臣、将领和总督能提出跨区域政策、弹章、军令和调粮；皇帝可下诏、任免、诛罚、宣战或和议，但必须承受礼法、证据、财政、军心、士论、派系和执行链反噬。
- 大多数 NPC 不全量调用大模型。S70 先做高显著度 NPC、场景参与者、权力核心、玩家近关系和事件相关者的 AI mind；背景 NPC 走服务器启发式、批处理 proposal 和记忆摘要。
- 多模型只改变建议、叙事质量和审查力度，不改变服务器最终裁决权。多数模型同意也不能绕过 schema、白名单、hidden 过滤、科举晋级、官职任免、战争结局、数据库写入或审计规则。

### 推荐工具组

- Prompt pack 分层：`systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck`。每层都必须有版本、适用 scene/actor、输入预算、输出契约和红队 fixture。
- 工具定义字段：`name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown`、`mockFallback`；可选补 `readScope`、`proposalScope`、`authorityPredicate`、`riskTags` 和 failure contract。字段命名可在代码中映射为驼峰或 schema 常量，但文档契约必须保留这些语义。
- 只读工具：`world.read_visible_context`、`memory.read_actor_memory`、`law.read_ritual_legal_bounds`、`office.read_docket`、`intel.read_reports`、`market.read_prices`。
- Proposal 工具：`actor.propose_personal_action`、`relationship.propose_delta`、`event.propose_incident`、`office.propose_memorial`、`city.propose_policy`、`judicial.propose_case_resolution`、`military.propose_order`、`diplomacy.propose_move`、`ruler.propose_edict`。
- AI-first 体验工具：`career.propose_reward_or_promotion`、`career.request_discipline_adjudication`、`report.generate_player_monthly_briefing`、`time.request_skip_period`、`ai_settings.propose_route_policy`、`memory.propose_actor_memory`、`map.read_visible_map_context`、`map.propose_route_or_geopolitical_move`。这些工具让上级赏罚、月报、跳时、AI 设置、记忆和地图接口进入玩法，但仍只能提交 proposal 或 request-adjudication。
- 服务器裁决工具：`server.adjudicate_policy`、`server.resolve_case`、`server.apply_appointment`、`server.resolve_battle`、`server.apply_diplomacy`、`server.schedule_event_chain`、`server.apply_relationship_memory`、`server.write_audit_and_revision`。这些工具不是模型可直接执行的动作，而是服务器 resolver。

## 7. S71：数据库玩法化、维护、检索与安全 API

S71 详细规划见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)。它不抢占 S69，也不替代 S70；S70 先解决 prompt、actor 和工具协议，S71 再把 S49-S67 已有的国家、城市、NPC、官职、案牍、军务、财赋、事件链、情报和检索内容接进真实服务器玩法裁决。该文档第 11-13 节已扩展为后续 Codex 开发任务书，逐项写明依赖、所需资料、建议模块/函数、接口、测试与验收。

### S71 设计基线

- 数据库 projection 可以成为服务器 resolver 的输入，但不能成为 AI 的写入口。AI 只能读取可见摘要、提交 proposal 或 request-adjudication。
- 新增 `resolverInputContext` 或等价只读上下文层，从 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`intelligenceRumorView` 和 `eventArchiveView` 取安全输入，不读 raw SQLite table。
- 财政结算、地方政策、堂审案件、战役外交和事件成案必须由服务器 resolver 裁决，写入仍走 adapter transaction、事件档案和审计。
- 本地维护层应补 `schema_migrations`、备份、VACUUM、索引健康、数据库体积提示和安全导出；所有命令都要有 dry-run 或受控失败路径。
- 本地全文检索只索引 player-facing projection；FTS5 不可用时使用安全 fallback，不为搜索引入远程服务。
- 保存真正 hidden 私档之前，必须先提供 redacted player API 与 hidden-safe 开发诊断 API，不能把 hidden 私档回填当前普通 route `worldState`。
- AI actor 角色卡、NPC 记忆、朝议/堂审/会盟/战役场景和 AI 调动审计面板都必须继承 S70 工具协议：模型请求，服务器执行，工具调用不是已发生事实。
- S70.6 与 S71.8 的压力事件职责分开：S70.6 固定工具协议、actor proposal、Mock/provider 基础和权限语义；S71.8 才实现数据库 projection 驱动的压力信号采集、冷却、概率、服务器成案和事件档案写入。

### S71 推荐实现顺序

1. S71.0-S71.1：先落契约和 `resolverInputContext`，证明 JSON/SQLite 输入 parity 与 hidden-token 防线。
2. S71.2-S71.4：再补本地维护、安全搜索和 redacted API，为更深 hidden 私档留出干净边界。
3. S71.5-S71.8：把财政、城市、案件、军务、外交和压力事件做成服务器 resolver，而不是只展示态势。
4. S71.9-S71.12：接入多 actor 场景、NPC 记忆和 AI 调动审计面板，最后做 dual-mode、Mock/no-key、browser 和 provider smoke 归档。

## 8. 进度记录

### 2026-05-12

工具：Codex、子代理。

步骤：S70.6 压力事件工具协议与 actor proposal。

提交：`3847c5a`。

完成：

- 新增 `src/ai/eventToolDefinitions.js`，集中定义 `event.propose_incident` 和 `event.request_incident_adjudication` 的 strict input schema、actor 权限、resolver label、审计字段、actor cooldown、Mock fallback 和 provider compatibility 备注；默认 `createGameAiToolRegistry()` 已包含事件工具，书生看不到事件工具，地方官/高权 actor/系统引擎按权限可见。
- 新增 `src/game/aiEventProposalConfig.js` 与 `src/game/aiEventProposal.js`，提供可见压力源收集、事件 proposal normalize、actor 权限与 source 校验、pending/rejected resolver、hidden-safe 审计和 Mock/no-key deterministic 候选。压力源只来自服务器安全 view：地理城市/边面、地方案牍、经济财政、军务外交、公开情报、可见人物怨望、世界实体和事件档案。
- `src/game/aiToolResolvers.js` 接入事件 resolver；`src/ai/gameAiToolRunner.js` 收紧参数摘要脱敏，并把工具名清洗和参数清洗分离，避免 `server.*` 直接调用误判为未知工具。
- 新增 `test/aiEventProposal.test.js` 与 `test/aiEventProposalRedTeam.test.js`，覆盖 strict schema、默认 registry 权限过滤、pending 不改状态、runner cooldown、request-adjudication、Mock 候选域、hidden/raw/server/path 文本拒绝、private refs 清空、不可见压力源拒绝和书生越权拒绝。
- 同步 brief、AI 控制矩阵、工具协议契约、S70 编排路线图和共享上下文，记录 S70.6 只做事件候选协议，不提前实现 S71.8 压力成案生成器。

验证：

- 已通过：`node --check src/ai/eventToolDefinitions.js`、`node --check src/ai/gameAiTools.js`、`node --check src/ai/gameAiToolRunner.js`、`node --check src/game/aiToolResolvers.js`、`node --check src/game/aiEventProposal.js`、`node --check test/aiEventProposal.test.js`、`node --check test/aiEventProposalRedTeam.test.js`。
- 已通过：`node --test test/aiEventProposal.test.js test/aiEventProposalRedTeam.test.js`，7/7。
- 已通过：`node --test test/aiToolProtocolContract.test.js test/aiActorToolPermissions.test.js test/gameAiTools.test.js test/gameAiToolRunner.test.js test/aiEventProposal.test.js test/aiEventProposalRedTeam.test.js`，29/29。
- 已运行：`npm test`，全量 630 个子测试中 629 个通过，1 个既有 S67 性能阈值抖动失败：`dual-mode S67 scale regression records large fixture, prompt strategy, paging, repair and timing` 的 `sqliteReadRepairMs 4931.773 > 3000`。随后单独重跑 `node --test test/dualModeAcceptanceScript.test.js` 通过 6/6。

风险/遗留：

- S70.6 只固定 `event.propose_incident` / `event.request_incident_adjudication` 的协议、权限、可见来源、pending/rejected 语义和 Mock 候选；不接普通 turn 自动调度、不调用真实 provider、不写 session/SQLite、不写事件档案成案条目。
- 数据库 projection 压力采集、事件概率、冷却成案、服务器事件档案写入和 JSON/SQLite resolver parity 仍留给 S71.8。

下一步：

- 启动 S70.7：刑名、财政、军事、外交与科举领域工具，继续集中化领域 proposal/request-adjudication tool definitions，并保持 resolver pending 边界、actor 权限和 hidden-safe 红队。

### 2026-05-12

工具：Codex、子代理。

步骤：S70.5 制度 AI 与朝议/科场场景。

提交：`029d65a`。

完成：

- 新增 `src/game/institutionSceneConfig.js`，集中定义制度场景 schema version、朝议/科场 scene type、参与者预设、proposal type、轮次/提案/证据/文本上限。
- 新增 `src/game/institutionScenes.js`，提供 `createCourtDebateScene()`、`createExamReviewScene()`、`runInstitutionSceneRound()`、`collectInstitutionProposals()`、`resolveInstitutionSceneOutcome()` 与 `sanitizeInstitutionProposal()`。朝议参与者覆盖皇帝、吏部/堂官、御史和按议题选择的领域官署；科场评议覆盖房官、同考官、主考官和磨勘/复核 critic。
- 制度场景只读取服务器安全 projection：官署任所、案牍、财赋、军务、科场流程、多考官阅卷、科名荣誉、同年座师和授官轨迹公开摘要；考试相关摘要会再压缩清洗，避免 `provider` / `prompt` / 本地路径 / key 形状进入场景 context。
- `runInstitutionSceneRound()` 默认 Mock/no-key heuristic，每个参与者只产 scene-local proposal，不推进全局年月旬，不写 session/SQLite，不执行工具；`resolveInstitutionSceneOutcome()` 只返回 `pending_server_resolution`，把伪造参与者 proposal 丢弃，并把 actorId 锚回场景参与者。
- 新增 `test/institutionScenes.test.js`、`test/institutionSceneVisibility.test.js` 和 `test/examInstitutionScene.test.js`，覆盖朝议参与者、边务领域官署选择、科场评议参与者、scene-local time、不修改 worldState、工具调用丢弃、隐藏/source token 清洗、伪造参与者丢弃和 actor retarget 防护。
- 提交前只读复审提出 P2：独立 `source` / `path` / `key` / `hidden` / `raw` token 可能进入场景文本，AI 传入的 `requestedToolName` 可能残留内部工具意图，第二轮复审又指出 `server.*` 内部 resolver 名可从 topic、note、proposalId、publicPosition、evidenceRefs、visibleEffects 或 riskTags 旁路泄漏。已扩大制度场景文本清洗词表，并在 `sanitizeInstitutionProposal()` 中固定清空 `requestedToolName`，补回归测试。

验证：

- 已通过：`node --check src/game/institutionSceneConfig.js`、`node --check src/game/institutionScenes.js`、`node --check test/institutionScenes.test.js`、`node --check test/institutionSceneVisibility.test.js`、`node --check test/examInstitutionScene.test.js`。
- 已通过：`node --test test/institutionScenes.test.js test/institutionSceneVisibility.test.js test/examInstitutionScene.test.js`，4/4。

风险/遗留：

- S70.5 只建立制度场景的安全编排 helper 和 Mock/no-key proposal 收束，不把朝议/科场接入普通回合、不运行真实 provider、不写审计表或持久 actor memory；真实领域工具、压力事件和 resolver 仍留给 S70.6-S70.7。
- 当前朝议只覆盖奏议、弹章、政策/财赋/边务/刑名/工务意见候选；堂审、会盟、战役等更复杂 scene-local runtime 留给后续 S71.9 数据库玩法化阶段。

下一步：

- 启动 S70.6：压力事件工具协议与 actor proposal。先固定城市、财政、军务、关系、情报等压力提出事件候选时的工具 envelope、权限、Mock/provider 形状、服务器成案语义和安全测试。

### 2026-05-12

工具：Codex、子代理复审。

步骤：S70.4 NPC mind 与记忆基础。

提交：`e030dc5`。

完成：

- 新增 `src/game/npcMindConfig.js`，集中定义 NPC mind schema version、显著度权重、LLM/背景 NPC 数量上限、proposal event / memory candidate 上限与文本长度边界。
- 新增 `src/game/npcMind.js`，提供 `rankNpcSalience()`、`buildNpcMindPromptContext()`、`generateNpcMindProposal()`、`buildHeuristicProposal()`、`applyNpcMindProposal()`、`runBackgroundNpcHeuristic()` 和 `sanitizeNpcMindProposal()`。高显著 NPC 只从 `worldPeopleView`、`relationshipLedger` 的可见项、`activeNpcRequestView` 和 `eventArchiveView` 安全摘要构造上下文；hidden / 无效 NPC 不获得 actor profile / prompt context。
- Mock/no-key 默认走 deterministic heuristic：根据当前请托、怨望、情分、影响力和近期互动生成 `request` / `obstruct` / `assist` / `warn` / `memory` proposal。服务器应用 proposal 时只写可见关系变化、公开事件材料和 `player_visible` 记忆候选，不保存深层 private memory ledger，不写 SQLite，不执行工具。
- 新增 `test/npcMind.test.js`、`test/npcMindSalience.test.js` 和 `test/npcMindHiddenRedaction.test.js`，覆盖高显著 NPC 排序、背景 NPC heuristic、NPC mind prompt context、安全 proposal、服务器应用、active request pressure、hidden NPC 排除、unsafe 文本清洗、toolCalls 丢弃和记忆候选脱敏。
- 更新 brief、AI 控制矩阵、S70 路线图和共享上下文，记录 S70.4 是 NPC mind 基础与安全 proposal 样板；真正 actor memory ledger / private impression / 月度 summary 留给 S70.12。
- 提交前只读复审提出 P2：provider/aiClient 返回值可能跨 NPC retarget、`intentType` 未按契约枚举收口、独立本地路径/source token 清洗缺口。已强制 provider proposal 锚定当前 actor/context，用 `NPC_MIND_PROPOSAL_TYPES` 对非法 intent 回落到 `memory`，并对 NPC mind context 的 actor summary 再套 S70.4 清洗，补独立 `/home` / `/mnt` / `file://` 路径与单独 `provider` / `prompt` / `proposal` token 回归测试。复审另提出 P3：`salienceCooldownTurns` 当前为自动调度预留，S70.4 不接普通 turn 调度，留到 scheduler/LLM loop 接入时使用。

验证：

- 已通过：`node --check src/game/npcMindConfig.js`。
- 已通过：`node --check src/game/npcMind.js`。
- 已通过：`node --check test/npcMind.test.js && node --check test/npcMindSalience.test.js && node --check test/npcMindHiddenRedaction.test.js`。
- 已通过：`node --test test/npcMind.test.js test/npcMindSalience.test.js test/npcMindHiddenRedaction.test.js test/aiActorProfiles.test.js test/gameAiToolRunner.test.js`（23/23）。

风险/遗留：

- S70.4 不调用真实 provider，不接入普通 turn 自动调度，不保存深层 private memory；高显著 NPC 的真实 LLM loop 与多 actor 场景调度会在 S70.5/S70.8 后继续增强。
- 当前 memoryCandidates 是安全候选输出，尚未进入持久 `actorMemoryLedger`；S70.12 负责来源、置信度、可见性、衰减和 prompt 检索。

下一步：

- 启动 S70.5：制度 AI 与朝议/科场场景，用 S70.2 actor profile、S70.3 runner 和 S70.4 NPC proposal 形状组织朝议/科场多 actor scene-local round。

### 2026-05-12

工具：Codex、子代理复审。

步骤：S70.3 内部工具运行时。

提交：`4f94de9`。

完成：

- 新增 `src/ai/gameAiTools.js`，提供 `createGameAiToolRegistry()`、`registerGameAiTool()`、`listToolsForActor()` 和基础工具定义入口。registry 复用 S70.1 `validateToolDefinition()` 与 S70.2 `filterActorTools()`，拒绝重复注册、非 strict schema、`server.*` 模型可见工具和 provider-visible name 碰撞。
- 新增 `src/ai/gameAiToolRunner.js`，提供 `normalizeProviderToolCall()`、`runReadTool()`、`runProposalTool()`、`runRequestAdjudicationTool()`、`runGameAiTool()`、`buildToolResultForModel()` 和 hidden-safe tool audit record。runner 按 actor profile、tool type、权限、辖区、strict arguments schema 与本地 cooldown 执行；失败返回 `toolResult` 拒绝对象，不写世界状态。
- 新增 `src/game/aiToolResolvers.js`，先实现 `world.read_visible_context` 的服务器 read resolver，并为 proposal / request-adjudication 提供 pending resolver bridge。读取只组合服务器 view：地理、人物、官署、事件、情报、读书、科举、财赋与案牍摘要；不读 raw SQLite、raw audit、provider proposal、hidden 私档、本地路径或 key。
- 新增 `test/gameAiTools.test.js`、`test/gameAiToolRunner.test.js` 和 `test/gameAiToolAudit.test.js`，覆盖 registry 校验与 actor 可见工具列表、provider tool call 归一、read tool 安全摘要、越权/类型不匹配拒绝、pending proposal、cooldown、系统引擎事件 proposal、tool result 回填模型 payload 和审计脱敏。
- 更新 brief、AI 控制矩阵、S70 路线图和共享上下文，记录 S70.3 是内部工具运行时基础，不接普通 turn、不直接写状态或落库；领域工具和场景接入留给 S70.4-S70.7。
- 提交前只读复审提出 P1/P2/P3：工具结果回填必须保留原始 tool call id、`world.read_visible_context` schema 与 resolver domain 不一致、读取域未按 actor visibility 交叉过滤、未知/内部工具探测未写审计。已补 `modelFollowUpHint` / `buildToolResultForModel(result, toolCall)`、开放 `market` / `local_docket` schema enum、read runner 按 `actorProfile.visibilityProfile.readDomains` 过滤 domains，并为未知或 `server.*` 直接调用记录 hidden-safe 拒绝审计。

验证：

- 已通过：`node --check src/ai/gameAiTools.js`。
- 已通过：`node --check src/ai/gameAiToolRunner.js`。
- 已通过：`node --check src/game/aiToolResolvers.js`。
- 已通过：`node --check test/gameAiTools.test.js && node --check test/gameAiToolRunner.test.js && node --check test/gameAiToolAudit.test.js`。
- 已通过：`node --test test/gameAiTools.test.js test/gameAiToolRunner.test.js test/gameAiToolAudit.test.js test/aiActorProfiles.test.js test/aiActorToolPermissions.test.js test/aiToolProtocolContract.test.js`（修复复审问题后 29/29）。

风险/遗留：

- S70.3 暂不接入 `/api/game/turn` 或 provider adapters，不写 session、不写 SQLite、不创建真实领域后果；S70.4 起再让高显著 NPC / 制度场景 / 压力事件调用 runner。
- `event.propose_incident` 等领域工具目前只在测试中作为 registry fixture；正式领域定义集中化留给 S70.6-S70.7。

下一步：

- 启动 S70.4：NPC mind 与记忆基础。用 S70.2 actor profile 和 S70.3 runner 选择高显著 NPC，背景 NPC 走 heuristic，高显著 NPC 可生成安全 proposal / memory 候选。

### 2026-05-12

工具：Codex、子代理只读调研。

步骤：S70.2 AI actor 与权限模型。

提交：`636f30a`。

完成：

- 新增 `src/game/aiActorProfileConfig.js`，集中定义 S70 actor profile schema version、T0-T6 authority tier、actor type template、tool group、visibility preset 和 budget preset；书生、老师、考官、士绅/商贾、胥吏、地方官、大臣/御史、将领、皇帝/外邦君主与系统世界引擎都获得稳定默认权限口径。
- 新增 `src/game/aiActorProfiles.js`，提供 `buildPlayerAiActorProfile()`、`buildNpcAiActorProfile()`、`buildOfficeAiActorProfile()`、`buildSystemEngineActorProfile()`、`filterActorTools()`、`buildAiActorProfileView()` 和 `summarizeAiActorProfileForPrompt()`。profile 构造只复用玩家状态、`worldPeopleView`、`officialPostingsView`、`officialCareerView` 和官制 catalog 的可见 projection；hidden NPC、raw provider、raw audit、raw table、本地路径和 key 形状文本会被过滤，公开 view/prompt summary 不包含私档字段。
- `filterActorTools()` 复用 S70.1 `validateToolDefinition()`，按 actor type、authority tier、tool group、forbidden group 与辖区 ref 过滤模型可见工具；`server.*` 仍只作内部 resolver/audit label，不会进入 actor 可见工具列表。
- 新增 `test/aiActorProfiles.test.js` 与 `test/aiActorToolPermissions.test.js`，覆盖书生、入仕官员、地方官、皇帝、可见 NPC、hidden NPC、官署和系统引擎 profile，以及书生不能拿司法/军务/诏令工具、地方官必须辖区匹配、皇帝可请求强工具但不能看到 `server.*`、系统引擎只保留事件/读取工具。
- 更新 brief、AI 控制矩阵和共享上下文，记录 S70.2 只是权限模型与 allowlist，不执行工具、不写状态、不落库；真正 registry/runner 留给 S70.3。
- 提交前只读复审提出两个非阻断问题：系统引擎 T6 默认 allowlist 对 `memory` / `time` / `map` 过宽，NPC 公开边界文案含英文 hidden 红队词。已收紧 T6 只保留 `world_read` / `event` / `market` / `intel` / `report`，并改写公开边界文案与补充扫描测试。

验证：

- 已通过：`node --check src/game/aiActorProfileConfig.js`。
- 已通过：`node --check src/game/aiActorProfiles.js`。
- 已通过：`node --check test/aiActorProfiles.test.js`。
- 已通过：`node --check test/aiActorToolPermissions.test.js`。
- 已通过：`node --test test/aiActorProfiles.test.js test/aiActorToolPermissions.test.js test/aiToolProtocolContract.test.js`（16/16）。

风险/遗留：

- S70.2 不接入普通玩家回合、不执行工具、不写审计或 session；工具 registry、runner、resolver bridge、冷却与审计 hook 留给 S70.3。
- 当前 actor profile view 是后续 prompt/诊断安全入口样板，普通 route 尚未新增 `aiActorProfileView` 字段，以免在 runner 稳定前扩大 API surface。

下一步：

- 启动 S70.3：内部 `game_ai_tools` registry、read/proposal/request-adjudication runner、权限检查、Mock runner 和 hidden-safe 审计摘要。

### 2026-05-12

工具：Codex、Web 官方资料核验、子代理只读调研、子代理复审。

步骤：S70.1 AI 提示词与工具协议契约。

提交：`ba576a1`。

完成：

- 新增 [AI_PROMPT_ENGINEERING_CONTRACT.md](AI_PROMPT_ENGINEERING_CONTRACT.md)，把 S70 prompt pack 固定为 `systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck` 七层，并要求每类 prompt 登记 `promptId`、`promptVersion`、scene/actor、输入预算、输出 schema、Mock/no-key fallback、provider smoke 和红队 fixture。
- 新增 [AI_TOOL_PROTOCOL_CONTRACT.md](AI_TOOL_PROTOCOL_CONTRACT.md)，固定 `read`、`proposal`、`request_adjudication` 三类工具，定义模型可见 tool envelope、proposal/result/request-adjudication schema、`server.*` 只作内部 resolver bridge、strict `inputSchema`、provider-visible name 转换、审计、冷却、Mock fallback 和 MiMo 工具调用 smoke 策略。
- 新增 `src/ai/toolSchemas.js`，集中导出 tool envelope、proposal、request-adjudication、tool result 与 provider tool call shape schema；提供 `validateToolDefinition()`、strict input schema 检查、`toOpenAiChatFunctionTool()`、`toAnthropicToolDefinition()` 和 `world.read_visible_context` 样例定义，确保模型可见工具不暴露 SQL、raw table、raw state patch、hidden notes、本地路径或 key。
- 新增 `scripts/providerToolSmoke.js` 与 `npm run smoke:provider:tools`，直接用 MiMo chat completions/fetch 探测 `tools`、强制 `tool_choice`、`tool_calls` 参数形状和工具结果回填；无 `MIMO_API_KEY` 时明确 skip，`MIMO_REQUIRED=1` 或 `--required` 时缺 key fail，不写 session，也不把实验性工具 smoke 混进既有 S69 provider smoke。
- 新增 `test/aiToolProtocolContract.test.js` 和 `test/providerToolSmokeScript.test.js`，覆盖工具 envelope、provider name 转换、strict schema 拒绝、proposal/result 越权字段拒绝、MiMo 工具 smoke matrix、缺 key skip/required、fake fetch 强制工具与 roundtrip。
- 提交前只读复审提出两个 P2 和一个 P3：proposal/request arguments 只校验 envelope、顶层 `inputSchema` 未强制 object、provider-visible 工具名可能碰撞。已补 `validateToolProposal()` / `validateRequestAdjudication()` 按具体 tool definition 校验 arguments，强制顶层 object schema，禁止工具参数 schema 暴露 `rawSql`、`statePatch`、`worldState` 等字段，并新增 `buildProviderToolNameMap()` 碰撞检查；同时把 MiMo 错误体摘要改为更短并遮蔽 key/path 形状。第二轮复审指出 `patternProperties` 可绕过 forbidden argument property scan，已把 `patternProperties`、`propertyNames`、`dependencies`、`dependentSchemas`、`dependentRequired`、`unevaluatedProperties` 排除在首版 strict schema 子集之外，并补 `worldState` arguments 与 forward-slash/file URL 路径脱敏测试。
- 同步 README、brief、架构和 AI 控制矩阵，把 S70.1 记录为已落契约和最小工具 smoke；下一步切到 S70.2 actor 权限模型。

验证：

- 已通过：`node --check src/ai/toolSchemas.js`。
- 已通过：`node --check scripts/providerToolSmoke.js`。
- 已通过：`node --test test/aiToolProtocolContract.test.js`（修复后 8/8）。
- 已通过：`node --test test/providerToolSmokeScript.test.js`（修复后 7/7）。
- 已通过：`node --test test/aiToolProtocolContract.test.js test/providerToolSmokeScript.test.js test/aiSchemas.test.js test/prompts.test.js`（最终 45/45）。
- 已通过：`node --test test/providerSmokeScript.test.js test/mimoProvider.test.js test/providerToolSmokeScript.test.js`（最终 20/20）。
- 已通过：`npm run check:docs-governance`。
- 已通过：`npm run smoke:provider:tools`；本机 `.env` 有 MiMo key，因此实际跑通 MiMo forced tool call 与 tool-result roundtrip，未打印密钥。一次默认 30s 超时复跑出现 provider 响应抖动，随后用 `$env:AI_PROVIDER_TIMEOUT_MS='90000'; npm run smoke:provider:tools` 通过；无 key skip 分支已由 `test/providerToolSmokeScript.test.js` 覆盖。
- 已通过：`git diff --check`。

风险/遗留：

- S70.1 只落契约、schema 和 MiMo 工具形状 smoke，不接入普通玩家回合、不新增真正 `game_ai_tools` registry 或 resolver runner；这些留给 S70.2-S70.3。
- `npm run smoke:provider:tools` 在无 key 环境只验证 skip 分支；有 MiMo key 时可用 `MIMO_REQUIRED=1 npm run smoke:provider:tools` 固定真实返回形状。当前默认只跑 forced tool 与 tool-result roundtrip，`multi_tool`、`streaming` 和 schema failure 的真实 provider 兼容记录留给后续扩展。
- 外部官方资料已用于确认工具调用方向，但 provider 兼容性仍以本项目真实 smoke 为准，不把 OpenAI-compatible 视为 MiMo/DeepSeek 的全量工具保证。

下一步：

- 启动 S70.2：AI actor 与权限模型。优先新增 actor tier/role/tool group/visibility preset 配置，确保书生、老师、考官、县令、大臣、将领、皇帝和系统引擎只能列出各自可见工具。

### 2026-05-12

工具：Codex、子代理只读调研与复审。

步骤：S69.6 归档与交接。

提交：本次提交。

完成：

- 新增 [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)，把 S49-S53 本地数据库基础、S54-S59 本地 SQLite 业务表与双模式验收、S60-S67 超大动态世界内容充实和 S60 内容规模/可见性契约合并为一个追溯入口。
- 将 `LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`、`LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`、`HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md` 和 `HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md` 改为短跳转页，保留旧链接但避免继续维护四份分卷。
- 新增 [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)，归档 S68.1-S69.5 的科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器科举档案面板和 Provider/Mock 验收。
- 同步 README、brief、共享上下文、架构、动态数据库规划、AI 控制矩阵、数据库玩法化路线图和 S60 相关领域契约，把主入口改为统一归档，并把下一步切到 S70.1。
- 本轮只改文档归档与交接，不改运行时代码、API、provider schema、Mock 行为、存档格式或 SQLite 表结构。

验证：

- 已通过：`npm run check:docs-governance`。
- 已通过：`node --test test/documentationGovernance.test.js`。
- 已通过：`git diff --check`。
- 已完成只读子代理调研和提交前复审；复审未发现阻断问题。

风险/遗留：

- 统一归档内部保留了旧分卷原文，因此少量历史链接仍指向跳转页；这是为了保留原始归档语境，不影响后续主入口。
- SQLite 科举派生 parity、更长 provider long-run 和 hidden 私档 redaction 仍留给 S70/S71 后续步骤追踪。

下一步：

- 启动 S70.1：AI 提示词与工具协议契约，优先固定 prompt pack 分层、actor/scene contract、tool envelope、proposal/result schema、request-adjudication、strict schema 和 MiMo-V2.5-Pro 工具调用 smoke。

### 2026-05-12

工具：Codex、子代理只读调研与复审。

步骤：S69.5 Provider/Mock 验收。

提交：本次提交。

完成：

- 新增 `src/game/examProviderSanitizer.js`，在 `/api/exam/question` 和 `/api/exam/submit` 把真实 provider 的题面、要求、名位文本、五维评语、rank 和 detailed feedback 落盘前统一清洗，遮蔽 hidden token、raw provider/proposal、prompt/index/table 名、本地路径、`sk-` 与 `tp-` 形状凭据。
- `scripts/providerSmoke.js` 扩展 S69 验收：真实 provider smoke 除开局、普通回合、出题和评卷外，新增老师点评 turn，要求返回 `teacherFeedbackProposal.focus/advice/reason`；同时检查 provider 不得 patch `studyProfile`、`examProcedure`、`examHonorLedger`、`appointmentTrack`、`activeExam`、`examCalendar`、`player.examRank`、`player.officeTitle` 或 `player.examHistory`。
- 新增 `scripts/mockImperialExamAcceptance.js` 与 `npm run smoke:exam-s69`，用 Mock deterministic provider 完整跑通童试、乡试、会试、殿试到入仕，验证 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`relationshipView` / `worldPeopleView`、殿试 `appointmentTrackView` 和四次考试历史安全快照。
- 补充 `test/examProviderSanitizer.test.js`、`test/mockImperialExamAcceptanceScript.test.js`、`test/providerSmokeScript.test.js` 和 `test/aiControlRedTeam.test.js`，覆盖 provider 文本清洗、Mock 完整路径、老师点评 proposal、S69 server-owned patch 越权和考试 route 持久化前脱敏。
- 提交前只读复审发现 provider `examiner_reviews` 旧清洗不覆盖 `statePatch`、`appointmentTrack`、`retrievalContext`、`worldState`、`event_log`、`ai_change_proposals` 等 source token，已处理：`examReview` 复用 S69.5 清洗器，grade sanitizer 预清洗 provider review 字段，Mock 验收改为扫描字符串值并扩大 source-token/path 守卫，remote helper 对真实 provider 松散 `examiner_reviews` 文本字段做归一和 delta 夹断，避免非字符串 concern 让整次评卷 schema 失败。
- 同步 README、brief、AI 控制矩阵、真实 provider 验收文档和共享上下文，把下一步切到 S69.6 归档与交接。

验证：

- 已通过：`node --check src/game/examProviderSanitizer.js`、`node --check src/routes/exam.js`、`node --check scripts/providerSmoke.js`、`node --check scripts/mockImperialExamAcceptance.js`。
- 已通过：`node --check src/game/examReview.js`、`node --check src/game/examHonors.js`、`node --check src/game/appointmentTracks.js`、`node --check src/ai/providers/remoteHelpers.js`。
- 已通过：`node --test test/examProviderSanitizer.test.js test/mockImperialExamAcceptanceScript.test.js test/providerSmokeScript.test.js test/aiControlRedTeam.test.js`，22/22。
- 已通过：`node --test test/examReview.test.js test/examHonors.test.js test/appointmentTracks.test.js test/examHonorsRoute.test.js test/appointmentTracksRoute.test.js test/examNetworks.test.js`，15/15。
- 已通过：`node --test test/remoteHelpers.test.js test/aiSchemas.test.js`，17/17。
- 已通过：`npm run smoke:exam-s69`，Mock 路径完成 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam`，最终 `role=official`、初授翰林院修撰。
- 已通过：`npm run smoke:provider`，本机 keyed `mimo-deepseek` 完成真实 provider 开局、普通回合、老师点评、出题和评卷 smoke。
- 已通过：`npm run smoke:provider:route`，本机 keyed `mimo-deepseek` route health 通过，确认 route 连接诊断、streaming 能力、模型摘要和无 session 写入。
- 已通过：`npm run check:docs-governance`、`git diff --check`。
- 提交前只读子代理复审最终 diff 与验证证据，未发现阻断问题。

风险/遗留：

- S69.5 是 provider/Mock 验收与清洗守卫，不新增 SQLite 科举派生表，也不保存 hidden 科场私档、弥封身份映射、考官私意、raw provider proposal、完整 prompt、本地路径或 key。
- 本机有真实 `mimo-deepseek` key，因此本次实际跑了 keyed smoke；无 key 环境仍应把 provider network gate 的 no-key skip 视为有效本地结果。
- 更长 provider long-run、SQLite 科举派生 parity 和 S68-S69 文档归档留给 S69.6 或后续数据库专项。

下一步：

- 启动 S69.6：归档 S68-S69 科举深化实现，整理 brief/context/验收文档，并给 S70 prompt pack、工具协议和 actor 权限实施留下明确入口。

### 2026-05-12

工具：Codex、子代理只读调研与复审。

步骤：S69.4 浏览器科举档案面板。

提交：本次提交。

完成：

- `public/app.js` 新增 `currentAppointmentTrackView` 接线与 `#imperial-exam-archive-panel`，把读书簿、科场档案、多考官阅卷、榜单荣誉、同年/座师/考官和授官轨迹整合为侧栏玩家面板。
- 面板只读 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`relationshipView` / `worldPeopleView`、`appointmentTrackView` 和 `examHistory[]` 安全快照；不从 `worldState.studyProfile`、`worldState.activeExam.procedure`、`worldState.examHonorLedger`、`worldState.appointmentTrack`、raw audit、SQLite raw table、prompt 或 provider proposal 拼 UI。
- 考试结果弹窗与历次科场案卷补充 `appointmentTrackView` / `examHistory[].appointmentTrack` 的授官轨迹块，便于殿试后复看初授依据；`pickAppointmentTrackView()` 会在当前 route view 为空时回退历史安全快照，授官轨迹块也改用中文玩家公开边界文案，不原样展示后端 `authorityBoundary` 中的 provider/proposal/projection 等开发侧词。
- `public/styles.css` 补齐科举档案与授官轨迹响应式网格，`scripts/browserSmoke.js` 增加 `assertImperialExamArchivePanel()`、hidden-token/source-token 检查和横向溢出指标；`test/publicAppSource.test.js` 与 `test/browserSmokeScript.test.js` 增加源码和 helper 回归。
- 同步 README、architecture、brief、AI 控制矩阵、科举制度契约、科举深化路线图和共享上下文，把下一步切到 S69.5 Provider/Mock 验收。

验证：

- 已通过：`node --check public/app.js`、`node --check scripts/browserSmoke.js`、`node --check test/publicAppSource.test.js`、`node --check test/browserSmokeScript.test.js`。
- 已通过：`node --test test/publicAppSource.test.js`，4/4。
- 已通过：`node --test test/browserSmokeScript.test.js`，42/42。
- 已通过：`node --test test/publicAppSource.test.js test/browserSmokeScript.test.js`，46/46。
- 已通过：`node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js test/examHonorsRoute.test.js test/examNetworks.test.js test/eventArchive.test.js test/promptContextAssembler.test.js test/aiControlRedTeam.test.js`，35/35。
- 已通过：`npm run check:docs-governance`、`git diff --check`。
- 已通过：`npm run smoke:browser -- --screenshots artifacts/browser-smoke-s69-4`，browser smoke 覆盖桌面、移动、四级科举进度、殿试后入仕、移动最终档案、作弊结果、官员开局、官场履历、世界线和身份世界面板，14 张截图检查通过。
- 提交前只读子代理复审最终 diff，未发现 P0/P1/P2 阻断问题；后续建议可给考试结果/历史档案 modal 增加通用 hidden-token 文本扫描。

风险/遗留：

- 本步是浏览器整合与验收守卫，不新增服务器 route 字段、SQLite 科举派生表或真实 provider 题面/评卷验收。
- 若后续保存 hidden 科场私档，仍必须先做 redacted API / role visibility 分层；当前面板只组合已公开 route view 与安全历史快照。

下一步：

- 启动 S69.5：Provider/Mock 验收，覆盖真实 provider 出题/评卷/点评 smoke、Mock deterministic path、越权红队和无 key 可玩边界。

### 2026-05-12

工具：Codex、子代理只读调研与复审。

步骤：S69.3 授官路径深化。

提交：本次提交。

完成：

- 新增 `src/game/appointmentTracksConfig.js` 与 `src/game/appointmentTracks.js`，建立 server-owned `worldState.appointmentTrack`、`appointmentTrackView`、安全 `examHistory[].appointmentTrack` 快照和 capped prompt `appointmentTrack` 摘要。
- `/api/exam/submit` 在 canonical ranking、`examHonors`、`examNetworks` 和 `officialPostingsView` 完成后运行 `resolveInitialAppointmentTrack()`：一甲第一名初授翰林院修撰，一甲二三名初授翰林院编修，二甲优先馆选庶吉士并保留观政/部属候选，三甲按铨选外放、部属候补或候缺观政处理。
- 授官 resolver 读取公开籍贯与外任辖区做籍贯回避，选中结果写入 `player.role` / `player.officeTitle` / `officialCareer.currentPosting`，并向官场履历追加“初授”记录；旧三档 promotion 映射会被服务器最终授官结果覆盖。
- 事件档案新增 `appointment_result` 公开条目，审计公开摘要记录 `appointment_resolver` 结果，`stateRules` 把 `appointmentTrack` 列为 server-owned，prompt pack 明确吏部/皇帝/provider 只能提授官倾向，不能绕过官缺、回避、甲第或服务器任免。
- 根据只读复审 P2 处理补丁：开局 `nativePlace` / `hometown` / `origin` 会写入公开 `player.nativePlace` 和 `setup.nativePlace`，授官清洗遇到 hidden/raw/provider/prompt/key/path 标签时整段降级并覆盖 `data/sessions` 与 `data\\sessions` 相对路径，制度契约明确当前 `ministryProposal` / `emperorSignal` 是服务器合成摘要，未来 AI actor 仍 proposal-only。
- 同步 README、architecture、brief、AI 控制矩阵、科举制度契约、科举深化路线图和共享上下文，把下一步切到 S69.4 浏览器科举档案面板。

验证：

- 已通过：`node --check src/game/appointmentTracksConfig.js`、`node --check src/game/appointmentTracks.js`、`node --check src/routes/exam.js`、`node --check src/routes/game.js`、`node --check src/ai/promptContextAssembler.js`、`node --check src/game/eventArchive.js`、`node --check src/game/audit.js`、`node --check test/appointmentTracks.test.js`、`node --check test/appointmentTracksRoute.test.js`
- 已通过：`node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js`，5/5。
- 已通过：`node --test test/stateRules.test.js test/promptContextAssembler.test.js test/eventArchive.test.js test/aiControlRedTeam.test.js`，34/34。
- 已通过：`node --test test/officialCareer.test.js test/officialPostings.test.js test/examHonors.test.js test/examHonorsRoute.test.js test/examNetworks.test.js`，22/22。
- 已通过：`node --test test/prompts.test.js test/aiSchemas.test.js test/publicAppSource.test.js test/gameTurnOfficialCareer.test.js`，40/40。
- 已通过：`node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js test/examHonorsRoute.test.js test/examNetworks.test.js test/officialCareer.test.js test/officialPostings.test.js test/stateRules.test.js test/promptContextAssembler.test.js test/eventArchive.test.js test/aiControlRedTeam.test.js test/prompts.test.js test/aiSchemas.test.js test/publicAppSource.test.js test/gameTurnOfficialCareer.test.js`，97/97。
- 已通过：`node --check src/game/appointmentTracks.js`、`node --check src/game/initialState.js`、`node --check test/appointmentTracks.test.js`、`node --check test/gameStartRole.test.js`。
- 已通过：`node --test test/appointmentTracks.test.js test/gameStartRole.test.js test/appointmentTracksRoute.test.js`，12/12。
- 已通过：`node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js test/gameStartRole.test.js test/examHonorsRoute.test.js test/examNetworks.test.js test/officialCareer.test.js test/officialPostings.test.js test/stateRules.test.js test/promptContextAssembler.test.js test/eventArchive.test.js test/aiControlRedTeam.test.js test/prompts.test.js test/aiSchemas.test.js test/publicAppSource.test.js test/gameTurnOfficialCareer.test.js`，104/104。
- 已通过：`npm run check:docs-governance`。
- 已通过：`git diff --check`。
- 全量 `npm test` 在本机并发运行两次未全绿：第一次 556/557，通过后只剩 S67 `fixtureGenerationMs` 性能阈值 6917ms > 5000ms；第二次 555/557，剩同一性能阈值 8202ms > 5000ms，另有 `gameTurnTick` 完整书生路径 `fetch failed: bad port`。随后单独重跑失败点已通过：`node --test test/dualModeAcceptanceScript.test.js --test-name-pattern "dual-mode S67 scale regression records large fixture"` 实际执行该文件 6/6；`node --test test/gameTurnTick.test.js --test-name-pattern "complete scholar exam path still works after world tick integration"` 实际执行该文件 8/8。

风险/遗留：

- S69.3 只落服务器初授轨迹和 route/prompt/event 安全投影；浏览器尚未把读书簿、科场档案、榜单、同年考官和授官轨迹整合为完整科举档案面板，留给 S69.4。
- 当前不保存 raw 授官 proposal、hidden 卷件映射、考官 hidden intent、保结密注、内部审计、完整 prompt、本地路径或 key；若后续保存 hidden 科场私档，仍必须先设计 API redaction 与角色视野分层。
- SQLite 科举派生表 parity 和更大真实 provider smoke 仍留给 S69.5/S69.6 或后续数据库专项。
- 全量 `npm test` 在并发全套下仍有既有性能/端口抖动风险；本轮相关功能、权限、prompt、route 和两个失败点的单独回归均已通过。

下一步：

- 启动 S69.4：浏览器科举档案面板。前端只读 route view 和历史安全快照，不扫描 raw `worldState`、raw audit、SQLite raw table、prompt 或 provider proposal。

### 2026-05-12

工具：Codex、子代理只读复审。

步骤：S70.0 补充：AI 编排后续 Codex 开发任务书。

提交：本次提交。

完成：

- 扩展 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md) 第 13-16 节，把 S70 从方向性规划补成后续 Codex 可执行任务书。
- 明确 S70 优先不新增 npm 依赖，先使用现有 Node/Express/AJV/provider adapters/node:test/Playwright smoke；内部 MCP SDK、队列、schema 类型库等只有在确需时才走依赖治理。
- 按 S70.1-S70.14 逐步写清前置依赖、需要资料、具体模块/函数、工具/route 接口、测试文件和验收功能，覆盖 prompt/tool 契约、actor 权限、工具运行时、NPC mind、制度场景、事件 proposal、领域工具、多模型路由、AI 设置、月报、跳时、记忆、地图接口和真实 MiMo 验收。
- 同步 brief 与共享上下文，固定“详细任务书是开发入口，不改变 S69 当前实现节奏”的交接口径。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check -- docs/AI_ORCHESTRATION_ROADMAP.md docs/DEVELOPMENT_STEPS.md docs/QIANQIU_DEVELOPMENT_BRIEF.md docs/SHARED_CONTEXT.md`
- 已完成只读子代理复审；复审未发现 P0/P1/P2 阻断问题。

风险/遗留：

- 本轮是规划与任务书补充，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。
- S70 任务书列出的模块、脚本和测试是后续实施目标，不代表当前已存在。
- 真正执行 S70 仍应等 S69.3-S69.6 完成后启动；若提前做，只限契约或 fixture，不改运行时节奏。

下一步：

- 继续当前路线图的 S69.3 授官路径深化。进入 S70 后先做 S70.1 prompt/tool 契约和 MiMo 工具 smoke。

### 2026-05-12

工具：Codex。

步骤：S70.0 补充：AI-first 体验、月报、跳时、设置、记忆和地图接口规划。

提交：本次提交。

完成：

- 扩展 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)，把正式游玩体验改为 AI-first 设计方向：真实 AI 是核心，Mock/no-key 只作为开发安全网和回归样板。
- 新增权限增强工具方向：上级赏罚与升迁、纪律/诛罚裁决、玩家职位月报、自然语言跳时、AI 设置、actor 记忆和地图上下文/移动 proposal。
- 把 S70 子步骤扩展到 S70.14，新增玩家官职月报、跳时、大模型记忆、地图接口预留和真实 MiMo 验收；S71.0 顺延到 S70.14 后。
- 同步 brief 与共享上下文，明确“权限增强”仍是领域工具 + 服务器 resolver，不是放开 SQL、raw table 或 hidden 读取。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check -- docs/AI_ORCHESTRATION_ROADMAP.md docs/DEVELOPMENT_STEPS.md docs/QIANQIU_DEVELOPMENT_BRIEF.md docs/SHARED_CONTEXT.md`

风险/遗留：

- 本轮是规划与契约方向补充，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。
- “正式体验 AI-first / 真实 MiMo 验收”与现有本地 Mock 默认可玩治理需要在 S70 实施时分层落地：玩家正式模式可要求真实 AI，开发和 CI 仍保留 Mock 安全网。
- 当前工作区已有 S69.2、S71 和其它未提交改动；本轮提交必须只包含 S70 AI-first 规划相关文档。

下一步：

- 继续按当前路线图先完成 S69.3 授官路径深化；进入 S70 后优先落 `AI_PROMPT_ENGINEERING_CONTRACT`、`AI_TOOL_PROTOCOL_CONTRACT`、MiMo 工具 smoke 和 `game_ai_tools` registry。

### 2026-05-12

工具：Codex、子代理只读调研尝试。

步骤：S69.2 同年、座师与考官网络。

提交：本次提交。

完成：

- 新增 `src/game/examNetworksConfig.js` 与 `src/game/examNetworks.js`，建立 server-owned `examNetwork` 安全快照。`/api/exam/submit` 在 canonical ranking、`examHonors` 和 cohort 记录之后运行 `resolveExamNetwork()`，从服务器定榜顺序、公开荣誉和脱敏阅卷摘要派生同年、房官、主考/座师和殿试读卷官可见联系人。
- 新增联系人会写入 `characters -> relationshipLedger`，自然进入 `relationshipView` 和 `worldPeopleView`；考试历史保存安全 `examHistory[].examNetwork` 快照，事件档案新增 `exam_network` 公开条目，审计新增 `exam_network_recorded` public event。
- `src/ai/promptContextAssembler.js` 增加 capped `examNetwork` 摘要，`src/ai/promptPacks.js` 明确同年/座师/考官 durable 关系仍由服务器拥有；模型只能叙事或提点评，不能创造真实同年、座师、房官、主考或读卷官关系。
- 同步 README、architecture、brief、AI 控制矩阵、科举制度契约、科举深化路线图和共享上下文，把下一步切到 S69.3 授官路径深化。

验证：

- 已通过：`node --check src/game/examNetworks.js && node --check src/game/examNetworksConfig.js && node --check src/routes/exam.js && node --check src/game/eventArchive.js && node --check src/game/audit.js && node --check src/ai/promptContextAssembler.js && node --check src/ai/promptPacks.js`
- 已通过：`node --test test/examNetworks.test.js test/examHonors.test.js test/examHonorsRoute.test.js test/worldPeopleBridge.test.js test/relationshipLedger.test.js test/eventArchive.test.js test/promptContextAssembler.test.js test/prompts.test.js test/stateRules.test.js test/aiSchemas.test.js test/publicAppSource.test.js`，84/84。

风险/遗留：

- S69.2 只把公开同年、座师和考官网络写入可见关系与事件档案；授官路径、馆选、庶吉士、观政、铨选、外放、候缺和籍贯回避仍留给 S69.3。
- 当前不保存 hidden 榜单、弥封身份映射、考官 hidden intent、保结密注、模型原始建议或内部审计；若未来需要 hidden 科场私档，必须先设计 API redaction 与角色视野分层。
- 本轮首次子代理只读调研因账号配额 403 未返回；提交前只读复审已完成，未发现 P0/P1 阻断问题，确认 staged diff 不依赖未提交的 `.gitignore`、`docs/SCALE_OS_INTEGRATION_GUIDE.md` 或 `skills/`。残余风险为未跑完整浏览器端到端、SQLite parity 和旧存档污染 `examNetwork` 快照兼容清洗。
- 工作树仍存在与 S69.2 无关的未提交 `.gitignore`、`docs/SCALE_OS_INTEGRATION_GUIDE.md` 和 `skills/` 改动；本提交不应包含它们。

下一步：

- 启动 S69.3：授官路径深化。优先建立服务器授官 resolver，按一甲、二甲、三甲、官缺、籍贯回避、朝局压力、同年/座师网络和声誉裁决馆选/庶吉士/观政/铨选/部属/外放/候缺。

### 2026-05-12

工具：Codex、子代理只读复审。

步骤：S69.1 榜单与名次细化。

提交：本次提交。

完成：

- 新增 `src/game/examHonorsConfig.js` 与 `src/game/examHonors.js`，建立 server-owned `worldState.examHonorLedger`、`examHonorView`、安全 `examHistory[].examHonor` 快照和 capped prompt `examHonors` 摘要。
- `/api/exam/submit` 在 `buildRanking()` 生成服务器 canonical 同场顺序后调用 `decorateExamRanking()`，写定解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序；殿试 promotion 读取 canonical palace class，避免模型或原始分数字段绕过榜次确定甲第。考试历史、审计公开事件和事件档案摘要会记录服务器荣誉结果。
- `/api/game/start`、`GET /api/game/state/:sessionId`、普通/流式 `/api/game/turn`、`/api/exam/question` 和 `/api/exam/submit` 都返回 `examHonorView`；浏览器考试结果、考试档案和书生面板新增“科名荣誉”展示，只读 route view 或历史安全快照，不扫描 raw `worldState.examHonorLedger`。
- `src/ai/promptContextAssembler.js`、`src/ai/promptPacks.js` 和 `src/game/stateRules.js` 明确 `examHonorLedger` 为 server-owned；provider `ranking`、`virtual_candidates`、`examiner_reviews`、普通 `statePatch`、皇帝/吏部叙事都不能授予荣誉、改甲第、定官职或写隐藏榜单。
- 同步 README、architecture、brief、AI 控制矩阵和科举制度契约，把下一步切到 S69.2 同年、座师与考官网络。

验证：

- 已通过：`node --check src/game/examHonors.js && node --check src/game/examHonorsConfig.js && node --check src/routes/exam.js && node --check src/routes/game.js && node --check src/game/promotions.js && node --check src/game/audit.js && node --check src/game/eventArchive.js && node --check src/ai/promptContextAssembler.js && node --check src/ai/promptPacks.js && node --check public/app.js`
- 已通过：`node --test test/aiSchemas.test.js test/examHonors.test.js test/examHonorsRoute.test.js test/stateRules.test.js test/promptContextAssembler.test.js test/prompts.test.js test/publicAppSource.test.js`，57/57。

风险/遗留：

- S69.1 只建立榜单荣誉和甲第顺序的服务器账本；同年、座师、房官/主考公开关系和考官网络仍未写入可见关系或事件档案，留给 S69.2。
- 当前不保存 hidden 榜单、弥封身份映射、考官 hidden intent、保结密注、模型原始建议或内部审计；若未来需要 hidden 科场私档，必须先设计 API redaction 与角色视野分层。
- 工作树仍存在与 S69.1 无关的未提交 `.gitignore`、`docs/SCALE_OS_INTEGRATION_GUIDE.md` 和 `skills/` 改动；本提交不应包含它们。

下一步：

- 启动 S69.2：同年、座师与考官网络。优先从 canonical ranking、`examHonorView`、脱敏 `examinerPanelView` 和考试历史安全快照派生可见同年/座师/考官关系，写入 `relationshipView` / `worldPeopleView` / `eventArchiveView`，继续禁止 provider/raw proposal/hidden intent 成为关系事实。

### 2026-05-12

工具：Codex、子代理只读审阅、子代理复审。

步骤：S68.5 科场事件与多考官阅卷。

提交：本次提交。

完成：

- 新增 `src/game/examReviewConfig.js` 与 `src/game/examReview.js`，由服务器在本地反作弊后、榜单/晋级前解析科场事件和多考官阅卷。当前确定性事件覆盖夹带疑云、号舍病困、誊录误差和对读无大误；房官、同考官、主考官与磨勘 critic 只提供限幅 reviewer delta 与公开批语，provider `examiner_reviews` 一律作为脱敏未采纳 proposal 留痕。
- `/api/exam/submit` 改为先保存 `scoreBeforeExaminerReview`，再用 `resolveExamReview()` 的最终 score 生成虚拟考生、canonical ranking、晋级/处罚和考试履历；`player.examHistory[].examinerPanel` 与 `examProcedureView.examinerPanelView` 保存安全阅卷摘要。`/api/game/start`、`/api/game/state/:sessionId`、普通/流式 `/api/game/turn`、`/api/exam/question` 和 `/api/exam/submit` 都返回 `examinerPanelView`。
- `src/ai/schemas.js`、`src/ai/prompts.js`、`src/ai/promptPacks.js` 与 Mock provider 增加 proposal-only `examiner_reviews`；prompt 说明房官/同考官/主考官/critic 只能提交建议，不能定榜、处罚、授功名、改甲第或写官职。审计摘要记录模型考官建议数量、服务器分数调整和拒绝原因，不保存 raw provider proposal。
- `examProcedureView` 归档时合并阅卷 incident/audit/examinerPanel 摘要，`summarizeExamProcedureForPrompt()` 只暴露 capped `examinerPanel`；浏览器考试结果、考试档案和书生面板新增“多考官阅卷”展示，仍只读 route view。
- 同步 README、architecture、brief、AI 控制矩阵和共享上下文，把下一步切到 S69.1 榜单与名次细化。

验证：

- 已通过：逐项 `node --check public/app.js`、`node --check src/game/examReview.js`、`node --check src/game/examReviewConfig.js`、`node --check src/game/examProcedure.js`、`node --check src/routes/exam.js`、`node --check src/routes/game.js`、`node --check src/ai/schemas.js`
- 已通过：`node --test test/examReview.test.js`
- 已通过：`node --test test/aiSchemas.test.js test/publicAppSource.test.js`
- 已通过：`node --test test/aiControlRedTeam.test.js --test-name-pattern "exam submit"`、`node --test test/aiControlRedTeam.test.js test/auditRoute.test.js`
- 已通过：`node --test test/examReview.test.js test/examProcedure.test.js test/aiSchemas.test.js test/publicAppSource.test.js`
- 已通过：`node --test test/prompts.test.js test/promptContextAssembler.test.js`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已运行但未全量通过：`npm test` 为 542 项中 541 项通过，唯一失败为既有 S67.1 scale 性能门槛 `fixtureGenerationMs` 在全量并发测试中 8984.797ms 超过 5000ms；同一用例单独重跑 `node --test --test-name-pattern "dual-mode S67 scale regression" test/dualModeAcceptanceScript.test.js` 通过。

风险/遗留：

- S68.5 先把事件和多考官建议做成服务器阅卷复核切片；当前 canonical ranking 仍复用既有 `buildRanking()`，只是榜前输入分数更细。解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元荣誉留给 S69.1。
- 当前 provider `examiner_reviews` 只脱敏留痕，不驱动真实 AI 事件池或同年互动；更丰富的 AI actor 工具化仍排到 S70。若未来保存考官 hidden intent、弥封映射或内部审计，必须先设计 redacted API 与角色视野分层。
- 本轮工作树还存在与 S68.5 无关的未提交 `.gitignore`、`docs/SCALE_OS_INTEGRATION_GUIDE.md` 和 `skills/` 改动；本提交不应包含它们。

下一步：

- 启动 S69.1：榜单与名次细化，优先建立 server-owned `examHonorView` / honor ledger，固定解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元成就。

### 2026-05-11

工具：Codex、子代理只读调研、子代理复审。

步骤：S68.4 科场制度流程。

提交：9a53791。

完成：

- 新增 `src/game/examProcedureConfig.js` 与 `src/game/examProcedure.js`，建立 server-owned `activeExam.procedure` 与 route `examProcedureView`。外层 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam` API 保持不变；内部公开摘要展示童试县试/府试/院试三关，乡试/会试三场多卷，殿试御前策问，以及保结、报名、搜检、号舍、发题、草稿、誊清、交卷、弥封、誊录、对读、磨勘、放榜和归档。
- `/api/game/start`、`/api/game/state/:sessionId`、普通/流式 `/api/game/turn`、`/api/exam/question`、`/api/exam/progress` 和 `/api/exam/submit` 返回 `examProcedureView`；场内推进只同步 procedure phase 与卷件公开状态，不推进全局年月旬。交卷后 `completeExamProcedure()` 把安全快照写入 `player.examHistory[].examProcedure`，浏览器考试档案可直接展示。
- `src/ai/prompts.js` 与 `src/ai/promptContextAssembler.js` 增加 capped `examProcedure` 摘要；普通 provider patch 白名单继续禁止写 `activeExam`，并把 `examProcedure` 明确列为 server-owned top-level key。公开文本清洗会遮蔽 sealed/internal/key/path/raw-shaped 字符串，prompt/browser view 不暴露弥封身份映射、保结密注、考官私意、模型原始建议或内部审计。
- 浏览器新增“科场程式”面板，考试弹窗显示当前制度阶段，考试结果与历次档案展示科场流程、卷件生命周期和公开复核摘要；前端只读取 route `examProcedureView` 或已归档的 `examHistory[].examProcedure`，不从 raw `worldState.examProcedure` 或 raw audit 拼 UI。
- 同步 README、brief、architecture 和共享上下文，把下一步切到 S68.5 科场事件与多考官阅卷。

验证：

- 已通过：`node --check src/game/examProcedureConfig.js && node --check src/game/examProcedure.js && node --check src/routes/exam.js && node --check src/routes/game.js && node --check src/ai/prompts.js && node --check src/ai/promptContextAssembler.js && node --check public/app.js`
- 已通过：`node --test test/examProcedure.test.js test/examTravel.test.js test/stateRules.test.js test/aiSchemas.test.js test/publicAppSource.test.js test/prompts.test.js test/promptContextAssembler.test.js`，61/61。

风险/遗留：

- S68.4 只实现科场制度流程 projection、三关/三场摘要和安全卷件生命周期；尚未实现科场事件池、夹带/病倒/誊录误差的概率裁决、多考官 AI proposal、房官/主考偏好或服务器 ranking 细化。
- 当前 `activeExam.procedure` 只保存安全公开摘要，不保存弥封身份映射、考官 hidden intent 或内部复核真值。未来如果要保存 hidden 卷件真值，必须先做 route redaction 与角色视野分层。
- 当前 route 仍按本地开发威胁模型返回完整 `worldState`；S68.4 因此刻意不把 hidden 科场真值写入普通 `worldState`。

下一步：

- 启动 S68.5：科场事件与多考官阅卷，优先把夹带、病倒、誊录误差、考官偏好和房官/同考官/主考官 proposal 接到服务器 ranking/处罚之前，并保持 `examProcedureView` 只读脱敏摘要。

### 2026-05-11

工具：Codex、子代理只读调研、子代理复审。

步骤：S68.3 老师点评与书院/同窗互动。

提交：本次提交。

完成：

- 扩展 `studyProfile` / `studyProfileView`：新增 `teacherFeedback`、`smallExercises`、`recommendedBooks`、`academyNetwork.teacher`、`academyNetwork.academy`、`academyNetwork.classmates` 和 `academyNetwork.sponsorship`，继续由服务器归一化、裁剪和脱敏。
- `src/routes/game.js` 在普通回合 provider patch 后调用 `applyTeacherFeedbackProposal()` 和 `runStudyInteractionStep()`；AI 老师只能返回 `teacherFeedbackProposal` 文本点评 proposal，服务器清洗后才写读书簿。拜师、讲会、同窗互评、小题训练和求保结由服务器创建/更新可见老师、书院山长、同窗 `characters`，再通过 `applyRelationshipChanges()` 裁决关系账本。
- `src/game/examCalendar.js` 与 `src/game/examTravel.js` 把 `academyNetwork.sponsorship` 的脱敏 snapshot 带入 `teacherRecommendation` 和 `entryPreparation.sponsorship`；保结只影响准备摘要与风险提示，准考仍由 `canEnterExam()`、考期和服务器规则裁决。
- `src/ai/schemas.js`、`src/ai/providers/remoteHelpers.js`、`src/ai/prompts.js`、`src/ai/promptPacks.js` 和 Mock provider 增加 `teacherFeedbackProposal`；普通 provider patch 仍不能写 `studyProfile`、`player.teacher`、`player.position`、`relationshipLedger`、`characters`、名位、榜单或官职。提交前复审发现 `player.teacher` / `player.position` 若仍可由 provider patch 会污染 durable 师承身份或名位文本，已从普通 patch 白名单和 turn schema 移除，Mock 老师回合改为只提交点评 proposal，服务器互动/官职 resolver 才能设置默认可见老师和职位文本。
- 浏览器读书簿和侧栏师承展示都读取 route `studyProfileView`，展示老师点评、书院师友、保结摘要、小题和荐书；prompt context 只读取 capped `studyProfile` 摘要，顶层 player 不再暴露 raw `teacher`；审计只记录采纳点评的脱敏短摘要或拒绝原因。考试旅费中的 `entryPreparation.sponsorship.ready` 只按 sponsorship status 计算，不再混用声望或普通老师推荐。
- 同步 README、brief、architecture、AI 控制矩阵、科举深化路线图和共享上下文，把下一步切到 S68.4 科场制度流程。

验证：

- 已通过：`node --check src/game/studyProfileConfig.js && node --check src/game/studyProfile.js && node --check src/routes/game.js && node --check src/game/audit.js && node --check src/game/examCalendar.js && node --check src/game/examTravel.js && node --check src/ai/schemas.js && node --check src/ai/providers/remoteHelpers.js && node --check src/ai/prompts.js && node --check src/ai/promptPacks.js && node --check src/ai/providers/mock.js && node --check src/game/stateRules.js && node --check public/app.js`
- 已通过：`node --test test/studyProfile.test.js test/stateRules.test.js test/examCalendar.test.js test/aiSchemas.test.js test/remoteHelpers.test.js test/gameTurnRelationships.test.js test/prompts.test.js test/gameTurnTick.test.js test/examTravel.test.js test/promptContextAssembler.test.js test/publicAppSource.test.js test/auditRoute.test.js test/gameTurnOfficialCareer.test.js test/officialRole.test.js test/magistrateRole.test.js test/generalRole.test.js`，113/113。
- 已通过：`node --test test/prompts.test.js --test-name-pattern "turn prompt redacts polluted player teacher text"`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已通过：`node --test --test-name-pattern "dual-mode S67 scale regression" test/dualModeAcceptanceScript.test.js`
- 已运行但未全量通过：`npm test` 两次均为 528 项中 527 项通过，唯一失败为既有 S67.1 性能门槛 `sqliteReadRepairMs` 在全量并发测试中约 3.70s / 3.95s 超过 3s；同一用例单独重跑通过，S68.3 相关功能/路由/prompt/前端测试均已通过。
- 已完成：只读子代理复审。复审提出的 `player.teacher` / `player.position` provider patch 污染风险已修复，并补充 provider 老师 patch、position 越权、prompt raw teacher 和 sponsorship ready 语义回归测试。

风险/遗留：

- S68.3 只实现老师点评、书院/同窗关系和保结前置摘要；尚未实现 `examProcedureView`、县试/府试/院试、乡试/会试三场、多卷、搜检、号舍、弥封、誊录、对读、磨勘和复核 scene phases。
- `studyProfile` 仍保存在 JSON snapshot 的 `worldState` 中，没有新增 SQLite 业务表；未来如拆表，仍必须从 `world_sessions.world_state_json -> server views` 单向修复。
- 当前 route 仍按本地开发威胁模型返回完整 `worldState`；浏览器读书簿、prompt 和审计摘要已走 view / capped summary / 脱敏预览。

下一步：

- 启动 S68.4：科场制度流程，优先新增 `examProcedureView` 并把保结、搜检、号舍、弥封、誊录、对读、磨勘、复核压进 scene-local phases。

### 2026-05-11

工具：Codex、子代理只读调研、子代理复审。

步骤：S68.2 读书账本与学业计划。

提交：本次提交。

完成：

- 新增 `src/game/studyProfileConfig.js` 与 `src/game/studyProfile.js`，建立 server-owned `worldState.studyProfile` 和玩家可见 `studyProfileView`，覆盖经义根柢、制艺章法、策论时务、史事典故、律例判断、誊写卷面、科场耐力、最近日课、文卷强弱、老师建议、书目和下旬计划。
- `POST /api/game/start`、`GET /api/game/state/:sessionId`、`POST /api/game/turn`、SSE `final_state`、`POST /api/exam/question` 和 `POST /api/exam/submit` 都返回 `studyProfileView`；普通读书行动由服务器记入日课，交卷后按 `player.examHistory`、评分维度和本地复核刷新学业弱点和读书计划。
- `src/ai/promptContextAssembler.js` 只把 capped `studyProfile` 摘要给 provider；`src/game/stateRules.js` 把 `studyProfile` 列为 server-owned top-level key，普通 provider patch 不能写该账本。
- 浏览器书生面板新增读书计划展示，读取 route `studyProfileView`，不扫描 raw hidden ledger；同步 README、brief、architecture、AI 控制矩阵、科举深化路线图和共享上下文。
- 本轮按用户指令只完成 S68.2，不启动 S68.3。

验证：

- 已通过：`node --check src/game/studyProfileConfig.js && node --check src/game/studyProfile.js && node --check src/routes/game.js && node --check src/routes/exam.js && node --check public/app.js`
- 已通过：`node --test test/studyProfile.test.js test/stateRules.test.js test/publicAppSource.test.js test/gameTurnTick.test.js test/examTravel.test.js`
- 已通过：`node --test test/prompts.test.js test/promptContextAssembler.test.js`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已通过：`node --test --test-name-pattern "dual-mode S67 scale regression" test/dualModeAcceptanceScript.test.js`
- 已运行但未全量通过：`npm test` 两次均为 520 项中 519 项通过，唯一失败为既有 S67.1 性能门槛 `sqliteReadRepairMs` 在全量并发测试中约 4.43s 超过 3s；同一用例单独重跑通过，S68.2 相关功能/路由/prompt/前端测试均已通过。

风险/遗留：

- S68.2 只实现服务器生成的读书画像和基础计划；AI 老师的独立 proposal schema、书院/同窗互动、保结前置和关系裁决留给 S68.3。
- 目前 `studyProfile` 保存在 JSON snapshot 的 `worldState` 中，没有新增 SQLite 业务表；若未来拆表，仍必须从 `world_sessions.world_state_json -> server views` 单向修复，不允许 raw row 或 provider proposal 反向改写事实。
- 当前 route 仍按本地开发威胁模型返回完整 `worldState`；浏览器玩家面板与 prompt 已改走 `studyProfileView` / capped prompt summary。

下一步：

- 停在 S68.2。后续若用户明确继续，再启动 S68.3：老师点评与书院/同窗互动。

### 2026-05-11

工具：Codex、子代理只读调研、子代理复审。

步骤：S68.1 科举制度契约。

提交：本次文档提交。

完成：

- 新增 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)，固定 S68.1 科举制度契约：明清原型与游戏压缩、外层四级科举 API 兼容、童试县试/府试/院试、乡试/会试三场、多日多卷、保结、搜检、号舍、弥封、誊录、对读、磨勘、复核、多考官阅卷、榜单荣誉和授官 resolver。
- 明确未来 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`appointmentTrackView` 的 server-owned / view-first 方向；hidden 卷件映射、考官 hidden intent、保结 hidden notes 和 raw provider proposal 不得回填普通 route `worldState`、prompt 或浏览器。
- 同步 README、brief、架构说明、AI 控制矩阵、科举深化路线图和共享上下文，把 S68.1 标为已完成，并把下一步切到 S68.2 读书账本与学业计划。
- 本轮不改运行时代码、API、provider schema、Mock 行为、存档格式或 SQLite 表结构；当前四级科举和完整书生路径保持现状。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 完整 `npm test` 未运行；本轮是 S68.1 制度契约和文档同步，不改运行时代码、API、provider schema、Mock 行为、存档格式或 SQLite 表结构。

风险/遗留：

- S68.1 是制度契约，不提供新 UI 或新玩法；后续 S68.2-S69.5 必须按契约小步实现并补 Mock/no-key、provider、hidden-token 和越权红队。
- 如果未来保存真正 hidden 卷件、弥封映射或考官私档，必须先设计 redacted player API 与 view 分层，不能放入普通 route raw state。

下一步：

- 启动 S68.2：读书账本与学业计划。优先实现 `studyProfileView`、文卷弱点画像、日课/书目/老师建议和 Mock 可玩路径，继续保持 AI 点评 proposal-only 与服务器裁决。

### 2026-05-11

工具：Codex、子代理复审。

步骤：S67.2 内容充实阶段归档与下一阶段交接。

提交：本次文档提交。

完成：

- 新增当时的 S60-S67 内容归档，现已在 S69.6 并入 [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)，把 S60-S67 的内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报、prompt 策略、浏览器分页和 S67.1 scale 验收集中归档。
- 本文件已从 S60-S67 长实现台账压缩为当前活动路线图：归档索引、稳定边界、S68-S69 科举深化、S70 AI 编排和后续 TODO。
- S67.2 标记为 `DONE`，下一步切换为 S68.1 科举制度契约。
- S49-S53、S54-S59 和 S60-S67 的详细实现不再在活动台账重复展开；需要追溯时打开对应归档。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 已通过旧口径搜索：未发现仍把活动路线图指向 S60 内容期或 S67 启动项的残留表述。
- 已完成只读子代理提交前复审；复审确认未发现 P0/P1/P2，治理保护块、归档完整性、AI/hidden 边界和 S68.1 交接无阻断问题。

风险/遗留：

- S67.2 只改文档，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。
- 本轮压缩的是活动台账展示层；S60-S67 的安全边界、验收事实和追溯入口已迁入归档文档与 brief/README/共享上下文。
- 未运行完整 `npm test`；本轮为文档归档和路线图交接，不改运行时代码。

下一步：

- 启动 S68.1：科举制度契约，先固定县试/府试/院试、乡试/会试三场、多卷流转、保结/搜检/号舍/弥封/誊录/磨勘/复核和 AI/server 权限边界。
