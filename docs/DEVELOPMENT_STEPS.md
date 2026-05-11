# 《千秋》活动路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。旧阶段细节已经归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S53 本地数据库基础：[LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。
- S54-S59 本地 SQLite 业务表与双模式验收：[LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md)。
- S60-S67 超大动态世界数据库内容充实：[HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md](HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md)，内容契约见 [HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)。

当前活动路线图从 S68 开始：先深化书生主线的科举、读书、评卷与授官制度，再进入 S70 的 AI prompt pack、工具协议、actor 权限和多 AI 编排。数据库方向继续只考虑本机 JSON/SQLite 持久化增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

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

当前活动工作从 S68.1 开始。S49-S67 的本地数据库与大世界内容实现细节已经迁入归档文档，活动台账只保留索引和后续边界：

| 范围 | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S53 | DONE | storage adapter、SQLite session row、本地审计、地理/人物/官职任所 projection、prompt context、浏览器局势簿 | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S54-S59 | DONE | 地理/人物/官职任所业务派生表、安全事件档案索引、prompt 检索索引、维护工具、浏览器 parity 和 dual-mode 验收 | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S60-S67 | DONE | 大世界内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/UI 分页和规模验收 | [HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md](HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md) |

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。
- AI 可以通过身份受限的领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。

## 4. 活动路线图总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S67.2 | DONE | 内容充实阶段归档与下一阶段交接 | 2026-05-11 | Codex / 子代理复审 | 本次提交 |
| S68.0 | DONE | 科举、读书、评卷与授官深化提前规划：制度细节、AI 老师/考官、名次荣誉、馆选铨选和验收矩阵 | 2026-05-08 | Codex / 子代理 | 见 git history |
| S68.1 | TODO | 科举制度契约：明清原型、游戏压缩、保结/搜检/弥封/誊录/磨勘/复核/号舍流程与 AI/server 权限 | - | - | S67.2 后可启动 |
| S68.2 | TODO | 读书账本与学业计划：经史书目、日课、文卷弱点、心态、师承、服务器 `studyProfileView` | - | - | S68.1 后 |
| S68.3 | TODO | 老师点评与书院/同窗互动：个性化读书计划、小题训练、荐书、保结前置和关系账本 | - | - | S68.2 后 |
| S68.4 | TODO | 科场制度流程：童试县试/府试/院试；乡试/会试三场、多日、多卷；保结、搜检、贡院号舍、弥封、誊录、对读、磨勘、复核 scene phases | - | - | S68.3 后 |
| S68.5 | TODO | 科场事件与多考官阅卷：夹带、病倒、誊录误差、考官偏好、房官/同考官/主考官 proposal 和服务器 ranking/处罚 | - | - | S68.4 后 |
| S69.1 | TODO | 榜单与名次细化：解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和服务器 canonical ranking | - | - | S68.5 后 |
| S69.2 | TODO | 同年、座师与考官网络：房官、主考、座师、门生、同年关系进入可见关系和事件档案 | - | - | S69.1 后 |
| S69.3 | TODO | 授官路径深化：一甲翰林、二甲馆选/庶吉士/观政、三甲铨选/部属/外放/候缺和籍贯回避 resolver | - | - | S69.2 后 |
| S69.4 | TODO | 浏览器科举档案面板：读书簿、科场档案、榜单、同年考官、授官轨迹和 hidden-token smoke | - | - | S69.3 后 |
| S69.5 | TODO | Provider/Mock 验收：真实 provider 出题/评卷/点评 smoke、Mock deterministic 路径和越权红队 | - | - | S69.4 后 |
| S69.6 | TODO | S68-S69 归档与交接：科举深化实现归档、brief/context/验收更新和 S70 衔接建议 | - | - | S69.5 后 |
| S70.0 | DONE | AI 编排提前规划：固定 AI 核心地位、现实权力原型、工具调用路线、actor 权限层和 S70 子步骤 | 2026-05-08 | Codex / Web / 子代理 | 见 git history |
| S70.1 | TODO | AI 提示词与工具协议契约：prompt pack 分层、actor/scene contract、MCP-friendly tool envelope、proposal/result schema、request-adjudication、direct-write 禁止、strict schema、MiMo-V2.5-Pro 工具调用 smoke、失败降级和 provider 兼容策略 | - | - | S69 后启动 |
| S70.2 | TODO | AI actor 与权限模型：按书生、士绅、地方官、大臣、将领、皇帝、系统引擎划分读取范围和工具组 | - | - | S70.1 后 |
| S70.3 | TODO | 内部工具运行时：`game_ai_tools` registry、权限检查、read/proposal/request-adjudication runner、服务器 resolver、审计 hook 和 Mock runner | - | - | S70.2 后 |
| S70.4 | TODO | NPC mind 与记忆：高显著度 NPC LLM loop、背景 NPC heuristic、目标/恩怨/人情债记忆演化 | - | - | S70.3 后 |
| S70.5 | TODO | 制度 AI 与朝议/科场场景：官署、派系、大臣、谏官、老师、考官围绕奏折/弹章/政令/考卷推演 | - | - | S70.4 后 |
| S70.6 | TODO | 压力驱动事件生成器：由城市、财政、军政、关系、情报压力生成额外事件候选并由服务器成案 | - | - | S70.5 后 |
| S70.7 | TODO | 刑名、财政、军事、外交与科举工具：案牍、赈济、军令、战役、和议、宣战、评卷、授官 proposal 与 resolver | - | - | S70.6 后 |
| S70.8 | TODO | 多模型路由与仲裁：narrator、actor_mind、planner、domain_specialist、critic、safety 分工与成本边界 | - | - | S70.7 后 |
| S70.9 | TODO | AI 调动可观测性：工具调用摘要、拒绝原因、成本、审计面板和 hidden-safe 开发诊断 | - | - | S70.8 后 |
| S70.10 | TODO | S70 大世界验收与归档：Mock/no-key、JSON/SQLite parity、hidden-token、越权工具、provider smoke 和归档 | - | - | S70.9 后 |

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

详细提前规划见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。S70 的核心目标不是让模型直接改库，而是让 AI 在服务器法度内变成“有身份、有记忆、有权限、有后果”的世界行动者网络；S68-S69 提供科场、老师、考官和授官 resolver 的先行用例。

### S70 设计基线

- AI 是《千秋》的核心世界引擎。后续新增玩法、角色、官署、城市、事件、经济、战争、外交、浏览器面板或 prompt 检索时，都必须设计 AI actor、可读摘要、可调用工具、proposal 边界、服务器裁决、审计和 Mock/no-key 降级。
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
- 服务器裁决工具：`server.adjudicate_policy`、`server.resolve_case`、`server.apply_appointment`、`server.resolve_battle`、`server.apply_diplomacy`、`server.schedule_event_chain`、`server.apply_relationship_memory`、`server.write_audit_and_revision`。这些工具不是模型可直接执行的动作，而是服务器 resolver。

## 7. 进度记录

### 2026-05-11

工具：Codex、子代理复审。

步骤：S67.2 内容充实阶段归档与下一阶段交接。

提交：本次文档提交。

完成：

- 新增 [HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md](HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md)，把 S60-S67 的内容契约、规模 fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报、prompt 策略、浏览器分页和 S67.1 scale 验收集中归档。
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
