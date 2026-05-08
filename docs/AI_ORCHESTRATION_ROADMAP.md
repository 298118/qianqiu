# 《千秋》S70 AI 编排与权力工具规划

本文是 S70 的提前规划稿，承接 S60-S67 “超大动态世界数据库内容充实”和 S68-S69 科举深化之后的 AI 深化方向。目标不是让模型绕过服务器直接改库，而是把 AI 从“叙事与评分器”提升为“世界中有身份、有记忆、有权限、有后果的行动者网络”。

核心结论：**AI 是《千秋》的核心世界引擎，不是可替换装饰。** 后续新增角色、官署、城市、战争、外交、经济、事件、浏览器面板或 prompt 检索时，都必须说明：

- 哪些 AI actor 会读取这些信息。
- 这些 AI actor 能调用哪些工具。
- 工具能提出什么 proposal，不能碰什么字段。
- 服务器如何验证、裁决、落库、审计和降级。
- 玩家因身份、职位、地理、关系和情报来源能看到什么。

## 1. 外部技术参考

截至 2026-05-08，官方文档可支撑本项目采用“模型请求工具、服务器执行工具”的架构：

- OpenAI Function Calling 说明模型可以通过 JSON schema 定义的 function tools 连接应用数据与动作；模型返回 tool call，应用代码执行工具并把结果交回模型。见 [OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling)。
- OpenAI Structured Outputs 比 JSON mode 更强，强调 schema adherence；对象需要 `additionalProperties: false`，不支持的 schema 会报错。见 [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。
- OpenAI MCP/Connectors 支持在 Responses API 中接入 remote MCP server 或 connector，并提供 `allowed_tools`、审批、延迟加载和风险提示。见 [OpenAI MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)。
- MCP 官方架构把工具、资源和提示词作为 server primitives；工具经 `tools/list` 发现，经 `tools/call` 执行，底层是 JSON-RPC，可走 stdio 或 Streamable HTTP。见 [MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture)。
- Anthropic 工具定义同样使用 `input_schema`，强调详细工具描述、少而强的工具、命名空间和高信号返回；Claude Messages API 当前 MCP connector 通过 beta header 接远程 HTTP MCP，且只支持 MCP 工具调用。见 [Anthropic Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) 与 [Anthropic MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)。
- DeepSeek API 支持 OpenAI-compatible function calling；官方文档也明确模型本身不执行具体函数。其 strict mode 是 beta，需要 beta base URL，要求工具 schema 更严格。见 [DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling/)。
- Xiaomi MiMo-V2.5-Pro 官方发布页强调该模型面向 agentic、长程任务和大规模工具调用，具备 1M token context window，并在官方案例中展示数百到上千次 tool calls 的长程执行能力；页面也说明可在 API Platform 中用 `mimo-v2.5-pro` model tag 接入。见 [Xiaomi MiMo-V2.5-Pro](https://mimo.xiaomi.com/mimo-v2-5-pro/)。

对《千秋》的取舍：

- 第一优先级是现有 adapter 内的自定义 function calling / structured proposal，不急于把游戏运行时暴露成外部 MCP。
- MiMo-V2.5-Pro 是《千秋》S70 的主力大面积 provider 候选；S70.1 必须把它列为一等兼容对象，单独验证 `tools` schema、`tool_calls` 返回形状、`tool_choice`、多工具调用、工具结果回填、streaming 下工具调用行为、structured proposal 稳定性、超长上下文成本和失败降级。不能把 “OpenAI-compatible” 直接等同于 OpenAI 工具协议全量兼容。
- MCP 更适合 S70 后期把大量游戏工具统一成一个可发现、可裁剪的内部协议层；只连接自家工具服务器或明确可信服务，不让第三方 MCP 直接接触存档。
- S70.1-S70.3 前期先实现 `game_ai_tools` 内部 registry；工具定义格式要尽量贴近 MCP / function calling，可稳定包含 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown` 和 `mockFallback`。后期如果工具数量、按身份裁剪和跨 provider 发现需求明显膨胀，再在 `game_ai_tools` 外层包装内部 MCP server，而不是重写工具系统。
- Web search、外部文件检索、代码执行、浏览器控制等通用工具不进入普通玩家回合。游戏运行时只使用本地世界、服务器 view、受控历史资料和本地工具，避免出戏、泄漏和不可复现。
- 若未来新增 SDK、MCP server、外部 connector 或 tracing 工具，必须先走 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md)。

## 2. 现实原型：权力不是按钮，而是执行链

历史世界里的“能做什么”不是由模型聪明程度决定，而由名分、职位、辖区、资源、情报、法理、执行链和后果共同决定。S70 要把这套现实原型做成 AI 权限系统。

皇帝可以下诏，但诏令要经过内阁/中书、六部、地方官、军镇、士绅、财政和民心的执行链；随意杀无罪大臣会带来士林寒心、谏官弹劾、宗室疑惧、边将观望、天命下降、后续政策执行力降低。县令可以审案、征粮、赈济和拘捕本县嫌犯，但不能调动边军或擅改国策。书生几乎只能影响自身学业、人际、名声、文章和局部事件，却可以通过文章、师友、请托、科举和舆论逐步扩大影响。

S70 的基本玩法张力：

- **职位给工具，不给无成本成功。** 高位 NPC 可调用强工具，但工具会触发合法性、证据、财政、军心、民心、派系和执行阻力检查。
- **信息不等于真相。** 不同 AI actor 根据身份得到不同 report；书生听传闻，县令看案牍，御史看弹章，皇帝看奏报和密札，但都可能被误导。
- **每个 AI actor 都有记忆和利益。** NPC 会记住恩怨、风险、亲族、人情债、派系压力和职业目标。
- **世界变化有因果链。** 事件不是随机段子，而来自城市压力、财政缺口、派系冲突、边防紧张、人物野心、自然灾害和历史记忆。

## 3. S70 架构原则

1. **AI 调工具，服务器执法。** 模型只返回 tool call、structured proposal 或 request-adjudication；服务器根据 actor 身份、权限、辖区、证据、冷却、资源和状态边界决定是否执行。
2. **领域工具提供参与感，但不是 SQL 代理。** `game_ai_tools` 只暴露 read view、proposal 和 request-adjudication；老师、考官、县令、大臣、将领、皇帝和系统世界引擎都可以“提出动作”，但不能把 tool call 当成已发生事实。
3. **写库只能在服务器事务中发生。** 任何 `worldState`、SQLite 派生表、审计表和 revision 写入仍由服务器 helper / resolver / adapter transaction 完成；AI 不执行 SQL，不直接写 canonical 状态、业务表或审计表。
4. **工具定义保持 MCP 友好。** 每个工具至少包含 `name`、`description`、`inputSchema`、`permission`、`resolver` 和 `mockFallback`，并按需要补 `readScope`、`proposalScope`、`authorityPredicate`、`auditEventType`、`cooldown`、`riskTags` 和 failure contract；这样前期可走内部 registry，后期可平滑映射到 MCP `tools/list` / `tools/call`。
5. **提示词工程是一等架构面。** S70 不只优化措辞，而要把 prompt pack、actor 角色卡、scene contract、工具策略、输出 schema、上下文预算、红队语料和 provider smoke 全部版本化；提示词不得成为隐藏裁决权，仍只产生叙事、proposal、tool call 或 request-adjudication。
6. **AI actor 按身份加载工具。** 不把皇帝工具给书生，不把刑名工具给商贾，不把军事调度工具给县令。大工具库后期可用 tool search / MCP allowlist 延迟加载。
7. **大多数 NPC 不每旬全量调用大模型。** 高显著度 NPC、场景参与者、权力核心、玩家近关系和事件相关者使用 LLM mind；背景 NPC 用服务器启发式、记忆摘要和批处理 proposal。
8. **每次高影响工具调用都可追溯。** 记录 actor、可见输入摘要、tool name、arguments 摘要、服务器接受/拒绝原因、applied event id、后果和成本。
9. **Mock/no-key 仍完整可玩。** Mock actor mind、规则式 NPC 和 deterministic tool runner 必须覆盖 S70 主流程，真实 provider 只增强质量。

## 4. AI Actor 与权力分级

S70 需要新增 `aiActorProfile` 或等价 schema，挂到 player、NPC、官署、国家、军镇和事件引擎。建议字段：

- `actorId`、`actorType`、`role`、`officeId`、`jurisdictionRefs`
- `authorityTier`、`allowedToolGroups`、`forbiddenToolGroups`
- `personality`、`ideologyTags`、`ambition`、`riskTolerance`、`loyalty`、`fear`
- `publicMemory`、`privateMemory`、`obligations`、`resentments`、`currentGoals`
- `visibilityProfile`、`intelConfidence`、`knownRefs`
- `modelPolicy`：mock / heuristic / small-model / full-LLM / reviewer-only
- `budgetPolicy`：每旬最大调用数、最大 token、是否允许流式、失败降级

权限分级建议：

| 等级 | 典型 actor | 可调用工具 | 服务器限制 |
| --- | --- | --- | --- |
| T0 背景民人 | 路人、普通农户、边缘 NPC | 记忆更新、传闻生成、自身行动 proposal | 不直接改世界指标，只能成为事件材料 |
| T1 书生/亲友 | 玩家书生、同窗、塾师、寒门士子 | 学习、拜访、投诗文、请托、结交、传闻询问 | 只影响自身、关系、名声和局部微事件 |
| T2 士绅/商贾/吏员 | 地方大户、商帮、胥吏、书院山长 | 赞助、拖延、告发、串联、市场和地方舆情 proposal | 需要地理/关系范围，不能直接任免或司法定罪 |
| T3 地方官/低阶军官 | 县令、知府、巡检、千总 | 审案、征粮、赈济、水利、拘捕、地方奏报、局部兵备 | 受辖区、证据、财政、上级、民心和法律限制 |
| T4 部院/御史/总督/将领 | 尚书、侍郎、御史、总督、总兵 | 弹劾、预算、任命建议、调粮、征调、军令、跨区域差遣 | 需要制度路径、皇命/上级授权、军需和派系阻力检查 |
| T5 皇帝/摄政/外邦君主 | 皇帝、太后摄政、邻国君主 | 诏令、任免、赦免、诛罚、宣战、和议、税制、大礼、继承 | 权力最强但后果最重；礼法、财政、军心、士论和执行链反噬 |
| T6 系统世界引擎 | 事件生成器、天灾/市场/边患 engine | 事件候选、压力传播、长期因果、自然演化 | 不代表任何角色；只由服务器 tick 调度 |

## 5. 工具面设计

工具命名建议保持领域化、少而强，避免每个字段一个工具。

### 5.0 工具定义格式

S70 前期的 `game_ai_tools` registry 不必直接实现 MCP server，但工具对象要保持 MCP / function calling 友好，避免后期迁移时重写：

```text
name                 // 稳定命名，如 office.propose_memorial
description          // 给模型看的短说明，写清何时使用、何时不要使用
inputSchema          // JSON schema / strict schema，默认 additionalProperties: false
permission           // actor tier、职位、辖区、关系、冷却、资源和情报可见性要求
resolver             // 服务器裁决入口；模型永远不能直接执行写库动作
audit                // tool name、actor、参数摘要、接受/拒绝、公开结果和 hidden ref
cooldown             // 防止每旬/每场景反复滥用
mockFallback         // 无 key / Mock 模式下的 deterministic 行为
```

后期如果工具数量爆炸，再把 `game_ai_tools` 外层包装成内部 MCP server：`tools/list` 只返回当前 actor 可见且可用的工具，`tools/call` 仍只进入同一个 permission / resolver / audit 链。内部 MCP server 不得暴露 raw session、raw table、hidden ledger、完整 prompt、key、本地路径或通用 SQL。

### 5.1 只读工具

- `world.read_visible_context`：读取 actor 可见的国家、城市、官职、人物、事件、情报摘要。
- `memory.read_actor_memory`：读取 actor 自身公开记忆、私密动机、人情债和近期目标。
- `law.read_ritual_legal_bounds`：读取礼法、律例、官制、科举、军令和身份限制摘要。
- `office.read_docket`：读取官署案牍、待办差事、上级压力和考成指标。
- `intel.read_reports`：读取奏报、密札、传闻、边报和可信度。
- `market.read_prices`：读取粮价、盐漕、税赋、商路和地方财政压力。

### 5.2 Proposal 工具

- `actor.propose_personal_action`：读书、拜访、递帖、求援、结怨、逃避、联姻等个人行动。
- `relationship.propose_delta`：提出可见关系、人情债、怨怼、庇护和派系倾向变化。
- `event.propose_incident`：生成额外局部事件、传闻、案由、边报、灾情或市场波动候选。
- `office.propose_memorial`：拟奏折、题本、弹章、咨文、批复和考成材料。
- `city.propose_policy`：征粮、赈济、修堤、清丈、平粜、剿匪、审案和徭役安排。
- `judicial.propose_case_resolution`：提出审理方向、证据缺口、判决建议和社会后果。
- `military.propose_order`：侦察、固守、调粮、练兵、出击、撤军和会战计划。
- `diplomacy.propose_move`：朝贡、互市、扣使、和议、威慑、结盟、离间和宣战建议。
- `ruler.propose_edict`：高位 actor 提出诏令、任免、赦免、刑罚、税制和国家战略。

### 5.3 Request-adjudication 工具

这类工具用于增强 AI 参与感：模型可以请求“请服务器裁决这件事”，但不能绕过 resolver。它适合高影响玩法，例如皇帝下诏、县令审案、将领请战、考官荐卷、吏部拟授官。返回结果必须是 `pending`、`accepted` 或 `rejected`，并附公开结果、隐藏后果引用和拒绝理由。

建议命名：

- `ruler.request_edict_adjudication`
- `office.request_appointment_adjudication`
- `judicial.request_case_adjudication`
- `military.request_campaign_adjudication`
- `diplomacy.request_treaty_adjudication`
- `exam.request_ranking_adjudication`

### 5.4 服务器裁决工具

这些不是模型可直接执行的工具，而是服务器 resolver。AI 只能请求，服务器决定。

- `server.adjudicate_policy`
- `server.resolve_case`
- `server.apply_appointment`
- `server.resolve_battle`
- `server.apply_diplomacy`
- `server.schedule_event_chain`
- `server.apply_relationship_memory`
- `server.write_audit_and_revision`

返回值统一含：

```text
accepted | rejected | pending
publicResult
privateResultRefs
appliedEventIds
rejectionReasons
counterCosts
followUpHooks
```

### 5.5 禁止把工具包装成直写库

任何工具协议、MCP server 或 adapter 都不得暴露通用 SQL、raw table update、raw session patch、raw audit insert 或 “write-anything” 能力。即使未来内部 MCP 用 `tools/call` 形式承载游戏工具，它也只能调用受控领域入口，例如 `event.propose_incident` 或 `server.resolve_case`，不能让模型自由构造 `INSERT/UPDATE`、`statePatch.worldState` 或 raw table payload。

## 6. 提示词工程与上下文编排

S70 的提示词工程目标是让 AI 更懂《千秋》的制度、身份、权限、语气和世界因果，同时更少越权、更少泄漏、更少胡乱改库。每个重要 prompt 都应有版本、适用场景、输入预算、输出契约和回归样例。

### 6.1 Prompt Pack 分层

建议把 S70 prompt pack 拆为可组合层，而不是每个场景手写一整段：

- `systemContract`：固定服务器裁决权、AI 不直写库、hidden 不可泄漏、工具只返回 proposal/request-adjudication。
- `actorCard`：身份、职位、辖区、性格、目标、记忆、恐惧、派系、人情债、可读范围和可调用工具。
- `sceneContract`：朝议、堂审、科场、战役、会盟、日常回合等场景目标、时间尺度、可用证据和结束条件。
- `visibleContextCapsule`：只放服务器 view / retrieval summary / capped event archive，不放 raw table、raw audit、hidden ledger 或完整 prompt。
- `toolPolicy`：本场景允许工具、禁止工具、调用前提、参数边界和失败降级。
- `outputContract`：JSON schema、strict proposal、评分维度、叙事字段、拒绝理由和 uncertainty 字段。
- `selfCheck`：输出前自检是否越权、泄漏 hidden、伪造事实、跳过 resolver、夹带 SQL/raw patch 或把传闻当真相。

### 6.2 版本化与评测

- 每类 prompt 要有 `promptId`、`promptVersion`、`sceneType`、`actorType`、`modelPolicy`、`outputSchemaVersion` 和变更记录。
- S70.1 要新增 `docs/AI_PROMPT_ENGINEERING_CONTRACT.md` 或等价契约，定义 prompt pack 分层、命名、输入预算、输出 schema、fixture 和 provider smoke。
- 每次改 prompt 都要有 focused fixtures：普通回合、官场、科举、案牍、战役、外交、皇帝诏令、NPC 私怨、低可信传闻和 hidden-token 泄漏。
- Prompt 评测不只看“文采”，还要看 schema 合规、身份边界、工具选择、拒绝越权、历史语气、可解释性、token 成本和 Mock/no-key parity。

### 6.3 上下文压缩与检索

- 长上下文模型不等于可以塞 raw 世界。prompt context 仍必须由服务器按身份、职位、地理、关系、情报可信度和场景目标排序裁剪。
- `promptContextAssembler` 后续要支持 scene-aware budget：普通回合短摘要，朝议/堂审/战役给关键证据链，科举给题目、文卷、批语和制度阶段。
- 每个 context capsule 要保留 ref / source / confidence，方便模型承认不确定，避免把传闻、密札、敌国虚实或低可信边报说成事实。
- MiMo-V2.5-Pro 的 1M context 用于长程记忆和复杂场景复盘，但仍要设置硬预算、摘要层级和高相关窗口，避免成本失控和注意力稀释。

### 6.4 Prompt 安全与注入红队

- 玩家输入、NPC 原话、奏折、案卷、密札和外部文本都必须作为 data，不得覆盖 system/developer contract。
- 红队样例必须覆盖：玩家要求模型忽略服务器、直接升官/授爵/杀人/宣战、输出 SQL、泄漏 hidden notes、读取 `.env`、暴露完整 prompt、伪造工具结果、把低可信传闻当圣旨。
- 对高权力 actor，prompt 需要强调“可以提出强动作，但必须接受合法性、证据、财政、军心、士论和执行链后果”，避免皇帝/将领工具变成无成本按钮。
- 对 critic/safety prompt，要让它只输出风险、拒绝原因和修正建议，不能直接改状态或替 resolver 做最终裁决。

### 6.5 历史语气与角色差异

- 提示词要让不同 actor 有不同语言与思考方式：书生重文章、师友和前程；县令重案牍、钱粮和地方压力；大臣重章程、派系和国体；将领重军需、地形和士气；皇帝重名分、制衡和合法性。
- 语气应有古代历史氛围，但以可读为先；prompt 不应鼓励堆砌文言空话，也不应把所有 NPC 写成同一种“古风旁白”。
- 老师、考官、谏官、胥吏、士绅、商贾、边将、邻国使者要有不同的评价尺度和利益偏差，靠 actorCard 与 sceneContract 共同约束。

## 7. 深层玩法方向

### 7.1 NPC 智力与记忆

NPC 不只是对白对象，而是会推理自身处境的 actor。每个重要 NPC 有短期目标、长期野心、恐惧、利益网络和记忆账本。玩家若救过某家族，后代、门生、同年会在多年后回响；玩家若错杀清官，士林记忆会进入弹章、书院舆论和皇权合法性。

### 7.2 官僚机器与执行阻力

皇帝和高官的强工具不直接等于成功。每条政令要经过“拟旨/票拟/部议/执行/地方反馈/审计”的链条。AI 大臣可争论、拖延、曲解或上疏反对。玩家可通过换人、赦免、施恩、威慑、整顿财政或公开证据降低阻力。

### 7.3 合法性、证据与滥权后果

生杀予夺是强玩法，但必须有法理成本。无证处死大臣会触发：

- `mandate` 下降、士林恐惧或愤怒。
- 谏官/御史/宗室/外戚的后续事件。
- 官僚执行力下降，奏报失真增加。
- 被杀者派系、家族、门生和地方基础形成长期怨怼。
- 若被杀者确有罪证，可能提升威慑、清廉声望或短期朝局控制。

### 7.4 事件生成器

S70 的事件不是随机“支线”，而是从数据库压力抽取因果：

- 城市粮价高 + 水利差 + 县令贪腐 -> 民变/逃荒/士绅请愿。
- 边镇粮道差 + 邻国继承危机 -> 试探性入寇或使节求援。
- 书院声望高 + 冤案未雪 -> 清议、联名上书、科场文章风向。
- 皇帝多次越法杀戮 + 军心低 -> 边将观望、宗室谋划或政变谣言。

AI 可生成候选事件的文本、人物动机和局部细节；服务器根据压力、冷却、概率、角色视野和审计规则决定是否成案。

### 7.5 朝议、堂审、会盟与战役场景

重大事件进入 scene-local time：

- 朝议：多个 AI 大臣按职位、派系、证据和利益发言，皇帝/玩家可追问、采纳或压制。
- 堂审：原告、被告、证人、胥吏、士绅和地方官都有各自 AI 立场，证据工具决定判决空间。
- 会盟：使节、边将、礼官和翻译围绕贡礼、边界、贸易和人质谈判。
- 战役：将领 AI 提出战略，军需和地形工具给出硬约束，服务器 resolver 判定胜负和伤亡。

## 8. 多模型协作编排

S70 不应只有一个万能模型。建议角色：

- `narrator`：叙事、古风文气、玩家反馈。
- `actor_mind`：NPC/机构行动意图。
- `planner`：为高影响 actor 选择目标和工具。
- `domain_specialist`：科举、刑名、财政、军事、外交、礼法等专题推演。
- `critic`：检查因果、历史语气、角色越权和工具参数。
- `safety_gate`：检查隐藏信息泄漏、直写库、越权工具、敏感外部工具调用。
- `mock_resolver`：无 key 环境下给出可测试的 deterministic 行为。

编排模式：

- 普通回合：`retrieval -> narrator/tool proposal -> server resolver -> narrator final`。
- NPC 批量旬度：`salience ranking -> selected actor_mind calls -> server batch resolver -> event archive`。
- 高影响政令：`planner -> domain_specialist -> critic/safety -> server resolver -> public/private aftermath`。
- 战争/外交：`intel -> planner -> opposing_actor_mind -> domain_specialist -> server resolver`。

## 9. S70 子步骤建议

| ID | 目标 | 主要产物 | 验收重点 |
| --- | --- | --- | --- |
| S70.1 | AI 提示词与工具协议契约 | `docs/AI_PROMPT_ENGINEERING_CONTRACT.md`、`docs/AI_TOOL_PROTOCOL_CONTRACT.md`、prompt pack 分层、tool envelope schema、proposal/result schema、request-adjudication schema、MiMo-V2.5-Pro 工具调用兼容矩阵 | 提示词有版本/场景/actor/输出契约；模型只能请求工具；服务器执行；禁止 direct-write/SQL/table patch；schema/strict/fallback 明确；MiMo 工具 smoke 固定真实返回形状 |
| S70.2 | AI actor 与权限模型 | actor profile schema、authority tier、allowed tool groups | 书生/县令/大臣/将领/皇帝工具隔离，hidden 视野隔离 |
| S70.3 | 内部工具运行时 | `game_ai_tools` registry、read/proposal/request-adjudication runner、resolver bridge、audit hook | 无 AI 直写 SQL/table；所有工具有权限、冷却、审计和服务器事务 |
| S70.4 | NPC mind 与记忆 | 高显著度 NPC LLM loop、背景 NPC heuristic、记忆摘要 | NPC 有目标和恩怨，成本可控，Mock 可玩 |
| S70.5 | 制度 AI 与朝议场景 | 官署/派系/朝议 actor、奏折/弹章/廷议 scene | 皇帝强工具有执行链和反噬 |
| S70.6 | 事件生成器 | 压力驱动事件候选、因果链、事件冷却 | 额外事件来自数据库压力，不泄漏 hidden |
| S70.7 | 刑名、财政、军事、外交工具 | case/policy/battle/diplomacy proposal 与 resolver | 县令不越权，战役有军需约束，外交有情报可信度 |
| S70.8 | 多模型路由、提示词评测与仲裁 | narrator/planner/critic/safety/model policy、prompt fixture matrix、provider prompt smoke | MiMo-V2.5-Pro/DeepSeek/Anthropic/OpenAI 适配一致，提示词成本/质量/安全可比较，失败降级清楚 |
| S70.9 | 可观测与浏览器调试 | AI 调动审计面板、tool call 摘要、成本/拒绝原因 | 玩家不见 hidden，开发者可追溯工具链 |
| S70.10 | 大世界验收与归档 | route tests、provider smoke、browser smoke、red-team fixture、归档文档 | JSON/SQLite parity、Mock/no-key、hidden-token、越权工具全过 |

## 10. 红队与验收清单

- 书生 actor 试图调用 `ruler.propose_edict`，必须拒绝且记录越权。
- 县令 actor 试图宣战、任免尚书或调边军，必须拒绝。
- 将领 actor 未获授权擅自出兵，服务器可允许“抗命 proposal”，但要触发军纪、军需和政治风险，而不是直接改战争状态。
- 皇帝 actor 无罪处死清流大臣，工具可成案，但必须产生合法性、士林、派系、家族和执行链后果。
- AI proposal 或 tool arguments 夹带 `worldState` raw patch、SQL、raw table payload、hidden notes、provider key、本地路径或 prompt，必须脱敏并拒绝。
- 工具被伪装成 SQL 代理、raw session patch 或 raw audit insert，必须在 registry 层拒绝，不能进入 resolver。
- MiMo-V2.5-Pro 必须通过 provider smoke：无工具、单工具、强制工具、多工具、工具结果回填、streaming、schema 失败和 Mock/no-key fallback 都要可复现；若返回形状与 OpenAI 不一致，adapter 负责归一化或禁用对应能力。
- Prompt 红队必须覆盖 prompt injection、玩家要求忽略系统约束、hidden-token 泄漏、完整 prompt 泄漏、低可信传闻当事实、critic/safety 直接裁决、actor 角色卡被玩家覆盖、长上下文塞入 raw table 和模型凭空创建证据。
- 多 NPC 批量生成不能超过预算；超过时退回 heuristic。
- MCP 或外部工具如果进入 S70 后期，必须默认 approval / allowlist / logging，不可把 raw session 或 hidden ledger 发给第三方。
- 所有 S70 工具都必须在 JSON 与 SQLite 模式下得到同等 player-facing view。

## 11. 和当前路线图的关系

S60-S67 先把世界数据库内容做厚，S70 再让 AI actor 使用这些内容。顺序很重要：没有足够的国家、城市、NPC、官职、事件、情报和检索索引，AI 编排只会变成漂亮但空心的多模型路由。

S70 实施前仍必须保持：

- JSON/Mock 默认可玩。
- 完整书生入仕路径不破坏。
- AI 不执行 SQL，不直接写 canonical 状态、业务表或审计表；领域工具只能提交 proposal / request-adjudication，由服务器 resolver 与 adapter transaction 落地。
- 浏览器和 prompt 只读服务器 projection。
- hidden 私档、邻国虚实、密札和未公开关系不回填 raw route state。
- 所有新增工具、依赖、provider 能力和审计入口同步更新 [AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。
