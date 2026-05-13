# 《千秋》S70 AI 编排与权力工具规划

本文是 S70 的提前规划稿，承接 S60-S67 “超大动态世界数据库内容充实”和 S68-S69 科举深化之后的 AI 深化方向。目标不是让模型绕过服务器直接改库，而是把 AI 从“叙事与评分器”提升为“世界中有身份、有记忆、有权限、有后果的行动者网络”。

核心结论：**AI 是《千秋》的核心世界引擎，不是可替换装饰。** 后续新增角色、官署、城市、战争、外交、经济、事件、浏览器面板或 prompt 检索时，都必须说明：

- 哪些 AI actor 会读取这些信息。
- 这些 AI actor 能调用哪些工具。
- 工具能提出什么 proposal，不能碰什么字段。
- 服务器如何验证、裁决、落库、审计和降级。
- 玩家因身份、职位、地理、关系和情报来源能看到什么。
- 正式游玩体验默认以真实 AI 为核心；Mock/no-key 只作为开发安全网、CI 稳定器和降级样板，不能再作为玩法设计的上限。

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
9. **正式体验 AI-first，开发仍需安全网。** S70 之后的正式玩法、验收和内容设计优先按真实 AI 编排建设，尤其以 MiMo-V2.5-Pro 作为大面积 provider 候选；Mock/no-key 只保留为本地开发、CI、断网降级和回归样板，不再以“无 AI 也能完整体验”为产品目标。
10. **质量优先，可配置预算。** 用户明确选择高质量模式时，可以接受更长输出、更高并发和更大 token 消耗；服务器仍要有 per-scene 并发、工具次数、超时、重试和失败降级上限，防止单个回合卡死或无限调用。

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

任何工具协议、MCP server 或 adapter 都不得暴露通用 SQL、raw table update、raw session patch、raw audit insert 或 “write-anything” 能力。即使未来内部 MCP 用 `tools/call` 形式承载游戏工具，它也只能调用模型可见的受控领域入口，例如 `event.propose_incident` 或 `judicial.request_case_adjudication`，再由服务器内部 resolver 处理；不能让模型直接调用 `server.*`，也不能自由构造 `INSERT/UPDATE`、`statePatch.worldState` 或 raw table payload。

### 5.6 权限增强方向

增强 AI 权限不等于放开数据库，而是让高位 actor 能请求更强、更贴近职位的领域工具，并让服务器把请求变成有成本、有反噬、有执行链的世界后果。S70 后续应补强这些工具组：

- `career.propose_reward_or_promotion`：上级、吏部、皇帝可提出赏赐、升迁、加衔、记功或斥退；服务器按官缺、考成、资历、派系、证据、皇帝偏好和制度限制裁决。玩家当官后，如果上级或皇帝高兴，可以因此收到赏赐或升官，但不能绕过官制和反噬。
- `career.request_discipline_adjudication`：弹劾、降调、革职、下狱、赦免、诛罚等高影响请求。越高权力越能提出强动作，但无罪滥罚必须进入合法性、士论、派系、家族、军心和执行链后果。
- `report.generate_player_monthly_briefing`：只针对玩家生成职位相关月报，按三旬为一月汇总政务、案牍、财政、军务、上级态度、同僚风向、NPC 来信和下月风险。
- `time.request_skip_period`：把“学习一月”“闭门读书三旬”“养病半月”等自然语言意图交给服务器拆为多个旬 tick，AI 负责计划和总结，服务器负责逐旬结算、事件中断和月报触发。
- `ai_settings.read_route_policy` / `ai_settings.propose_route_policy`：玩家可配置叙事、NPC、科举、政务、战争、记忆、critic 等任务的模型路由、输出长度、并发、工具预算和安全严格度；真正生效仍由服务器校验。
- `memory.propose_actor_memory`：AI 可提出记忆摘要、恩怨、人情债、印象和长期目标变化；服务器按可见性、来源、置信度、衰减和 hidden 边界写入 memory ledger。
- `map.read_visible_map_context` / `map.propose_route_or_geopolitical_move`：为后续地图系统预留地理、辖区、行军、赶考、商路、边防和外交接口；AI 只读可见地图 projection 并提交移动/事件 proposal。

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

## 9. AI-first 体验：月报、跳时、设置、记忆与地图接口

本节回答 S70 之后“AI 到底还可以更深地做什么”。方向是：玩家几乎时时刻刻都在和 AI 推动的世界互动，AI 不只是回复文本，而是生成报告、推动 NPC、解释制度、提出工具调用、形成长期记忆，并为地图系统提供上下文。

### 9.1 AI 必选游玩与真实 MiMo 验收

- 正式游玩体验以真实 AI 为前提；无真实 AI 的 Mock 体验只保留为开发和 CI 的稳定通道。
- S70 后的 provider acceptance 要新增 MiMo-V2.5-Pro 真实 smoke：普通回合、长叙事、NPC mind、工具调用、月报、跳时总结、记忆提炼、critic/safety 和多工具回填。
- 单元测试仍可用 Mock 保证 deterministic；但玩法验收、长程回归、提示词评测和工具协议兼容要有 `MIMO_REQUIRED=1` 或等价开关，明确跑真实 MiMo。
- 不怕长输出和 token 消耗时，应提供“高质量/长文/高并发”配置，而不是把所有玩家锁进短回复模式。

### 9.2 玩家官职月报与 AI 推动世界

玩家当官后，每过三旬进入下月上旬时，服务器触发 `playerMonthlyBriefing`。月报只针对玩家，不要求给所有 NPC 生成完整月报；NPC 可用摘要记忆和批处理事件更新。

月报内容建议按职位裁剪：

- 书生/候缺：读书进度、师友来信、同年消息、科场风向、家计压力。
- 县令/知府：钱粮、案件、水利、治安、士绅、上级批示、胥吏风险。
- 部院官：部务、奏折、同僚派系、皇帝态度、御史弹章、升迁/降调机会。
- 将领/总督：军需、士气、边报、粮道、敌情可信度、请战/固守风险。
- 皇帝：朝局、财政、边患、民心、宗室、后宫/外戚、继承与大礼压力。

AI 在月报中不只总结，还要推动世界：提出下月风险、NPC 主动请求、可追问线索、待裁决差事和隐藏后果的公开端倪。服务器根据压力、冷却和角色可见性决定哪些进入真实事件。

### 9.3 自然语言跳时

如果玩家说“学习 1 个月”“闭门备考三旬”“养病到下月”“在任上先按旧例处理一月”，不应只推进一个普通回合。建议新增 `timeSkipPlan`：

- AI 解析玩家意图、目标、持续时间和是否允许中断。
- 服务器把一月拆为三次旬 tick，逐旬运行读书、政务、NPC、事件压力和长期事件结算。
- 若出现科考、弹劾、灾情、上级召见、亲友急信、战事等高优先级事件，服务器可中断跳时并让 AI 生成“中途被打断”的叙事。
- 跳时结束后生成合并总结：做了什么、属性/关系/政务变化、错过了什么、下月风险和可行动事项。

### 9.4 AI 设置面板

浏览器后续应有“AI 设置”，让玩家按需求配置不同 AI，而不是只选一个全局 provider。建议配置域：

- `narrativeModel`：普通叙事和长文反馈。
- `npcMindModel`：重要 NPC 思考、来信、争论。
- `examModel`：出题、老师点评、考官批语。
- `policyModel`：政务、财政、刑名、官场。
- `warDiplomacyModel`：战争、外交、边报。
- `memoryModel`：记忆压缩、长程总结、人物印象。
- `criticModel` / `safetyModel`：越权、hidden、工具参数和因果检查。

玩家可选预设：`balanced`、`quality_first`、`fast`、`long_context`、`mimo_full`。每个预设控制输出长短、并发数、工具调用上限、streaming、重试、temperature、max tokens 和是否启用 critic/safety 双检。服务器必须校验配置，不允许玩家通过设置启用隐藏工具、直写库或未授权 provider。

### 9.5 大模型记忆方案

记忆不能只靠把全部聊天塞进长上下文。建议分层：

- `hotContext`：当前场景、最近数回合、正在处理的差事和玩家刚说的话。
- `sessionSummary`：每月/每场景压缩一次的玩家经历摘要。
- `actorMemoryLedger`：重要 NPC 的公开记忆、私密印象、人情债、恩怨、目标、恐惧和派系压力。
- `factMemory`：服务器确认的事实，如官职、科名、赏罚、案件结果、婚姻、师承、战役。
- `impressionMemory`：AI/NPC 的主观印象，如“此人轻躁”“有恩于我家”“疑似结党”，必须带来源、置信度和可见性。
- `semanticRetrievalIndex`：从安全 projection、事件档案、月报和 actor memory 中建本地检索索引，prompt 只拿 capped 摘要。

记忆写入流程：AI 提出 memory proposal，服务器去重、压缩、标注来源/可见性/置信度/衰减，再写入 ledger。高权力 actor 可以读更多官方档案，但不能读玩家不可见 hidden truth；NPC 私密记忆也要按角色视野裁剪。

### 9.6 地图系统接口预留

地图系统后续可以晚做 UI，但 S70/S71 要先留数据和 AI 接口：

- `mapContextView`：玩家可见国家、地区、城市、道路、河流、边防、辖区、任所、考场、商路和军镇摘要。
- `mapEntityRef`：城市、军镇、书院、贡院、驿路、关隘、河段、边境点都用稳定 id 引用，避免 AI 只说散文地名。
- `mapVisibility`：按身份、职位、地理距离、情报来源和战争迷雾裁剪可见信息。
- `mapMovementProposal`：赶考、赴任、巡查、行军、押解、使节出行和商路活动都先提交 proposal，再由服务器按距离、天气、治安、军情和资源裁决。
- `mapEventHooks`：灾害、民变、边患、市场、案件、书院清议和官职任所都能落到地图 ref 上，方便后续 UI 展示和 AI 检索。

AI prompt 只读取 `mapContextView` 和 capped 地图检索，不读取 raw coordinate table 或 hidden enemy truth。地图先服务玩法因果，再服务可视化。

## 10. S70 子步骤建议

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
| S70.9 | AI 设置与可观测 | AI 设置面板、model route policy、tool call 摘要、成本/拒绝原因 | 玩家可按任务配置 AI；配置不能越权；开发者可追溯工具链 |
| S70.10 | 玩家官职月报与 AI 推动世界 | `playerMonthlyBriefingView`、月末 report tool、职位化月报 prompt | 每三旬触发一次；只针对玩家；月报能带出下月风险和 NPC 主动事件 |
| S70.11 | 自然语言跳时 | `timeSkipPlan`、多旬 batch tick、跳时中断、跳时总结 | “学习一月”等输入推进三旬；高优先级事件能中断；服务器逐旬结算 |
| S70.12 | 大模型记忆系统 | actor memory ledger、fact/impression memory、monthly summary、retrieval index | 记忆有来源/置信度/可见性/衰减；AI 只能 proposal；prompt 只读 capped 摘要 |
| S70.13 | 地图系统 AI 接口预留 | `mapContextView`、`mapEntityRef`、map visibility、movement/event proposal schema | 后续地图 UI 可接；AI 只读可见地图 projection；移动和地图事件由服务器裁决 |
| S70.14 | 真实 MiMo 验收与 S70 归档 | MiMo-required provider smoke、route tests、browser smoke、red-team fixture、归档文档 | 真实 MiMo 覆盖主要玩法；JSON/SQLite parity、Mock 开发安全网、hidden-token、越权工具全过 |

## 11. 红队与验收清单

- 书生 actor 试图调用 `ruler.propose_edict`，必须拒绝且记录越权。
- 县令 actor 试图宣战、任免尚书或调边军，必须拒绝。
- 将领 actor 未获授权擅自出兵，服务器可允许“抗命 proposal”，但要触发军纪、军需和政治风险，而不是直接改战争状态。
- 皇帝 actor 无罪处死清流大臣，工具可成案，但必须产生合法性、士林、派系、家族和执行链后果。
- AI proposal 或 tool arguments 夹带 `worldState` raw patch、SQL、raw table payload、hidden notes、provider key、本地路径或 prompt，必须脱敏并拒绝。
- 工具被伪装成 SQL 代理、raw session patch 或 raw audit insert，必须在 registry 层拒绝，不能进入 resolver。
- MiMo-V2.5-Pro 必须通过 provider smoke：无工具、单工具、强制工具、多工具、工具结果回填、streaming、schema 失败和 Mock/no-key fallback 都要可复现；若返回形状与 OpenAI 不一致，adapter 负责归一化或禁用对应能力。
- 真实 MiMo 验收必须覆盖月报、跳时、多 actor 场景、记忆提炼、长输出和并发工具调用；失败时要返回可读错误，不得静默改状态。
- Prompt 红队必须覆盖 prompt injection、玩家要求忽略系统约束、hidden-token 泄漏、完整 prompt 泄漏、低可信传闻当事实、critic/safety 直接裁决、actor 角色卡被玩家覆盖、长上下文塞入 raw table 和模型凭空创建证据。
- 玩家通过 AI 设置尝试开启隐藏工具、关闭服务器裁决、直接写库或读取 hidden/raw 数据，必须被拒绝并记录。
- 跳时必须逐旬运行服务器结算；不能由模型一句“一个月后”直接跳过长期事件、考期、上级命令或危机中断。
- 多 NPC 批量生成不能超过预算；超过时退回 heuristic。
- MCP 或外部工具如果进入 S70 后期，必须默认 approval / allowlist / logging，不可把 raw session 或 hidden ledger 发给第三方。
- 所有 S70 工具都必须在 JSON 与 SQLite 模式下得到同等 player-facing view。

## 12. 和当前路线图的关系

S60-S67 先把世界数据库内容做厚，S70 再让 AI actor 使用这些内容。顺序很重要：没有足够的国家、城市、NPC、官职、事件、情报和检索索引，AI 编排只会变成漂亮但空心的多模型路由。

S70 实施前仍必须保持：

- JSON/Mock 默认可玩。
- 完整书生入仕路径不破坏。
- AI 不执行 SQL，不直接写 canonical 状态、业务表或审计表；领域工具只能提交 proposal / request-adjudication，由服务器 resolver 与 adapter transaction 落地。
- 浏览器和 prompt 只读服务器 projection。
- hidden 私档、邻国虚实、密札和未公开关系不回填 raw route state。
- 所有新增工具、依赖、provider 能力和审计入口同步更新 [AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。

## 13. 后续 Codex 开发执行规则

S70 后续开发应按“一个子步骤一个 coherent change”推进。每一步开始前继续读 `AGENTS.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `docs/DEVELOPMENT_STEPS.md`，再检查 `git status --short`。S69 未完成时，不要穿插实现会改变运行时的 S70 功能；如果只补契约、测试 fixture 或调研资料，也要在共享上下文写明“不改变 S69 节奏”。

开发节奏建议：

1. S70.1-S70.3 先落 prompt/tool/actor 基础设施，不急着做复杂剧情。
2. S70.4-S70.7 再把 NPC、制度场景、压力事件和领域工具接上。
3. S70.8-S70.9 做多模型路由、AI 设置、可观测和成本边界。
4. S70.10-S70.13 做玩家月报、跳时、记忆和地图接口这些 AI-first 体验。
5. S70.14 做真实 MiMo 验收、回归、归档和交接。

每个实现步骤必须同步：

- `docs/DEVELOPMENT_STEPS.md`：开始可标 `IN_PROGRESS`，完成后标 `DONE` 并写验证命令和提交哈希。
- `docs/SHARED_CONTEXT.md`：写当前状态、关键边界、验证结果、下一步建议。
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md`：若 API、状态字段、工具协议、provider、AI 设置、记忆、地图或验收标准变化，必须同步。
- `docs/AI_CONTROL_AUDIT_MATRIX.md`：凡新增 AI 可读摘要、工具、proposal、resolver、审计或浏览器面板，都要检查并更新。
- README：若新增环境变量、脚本、provider smoke、AI 设置或启动/测试方式，必须同步。

代码改动提交前必须请只读子代理复审最终 diff 与验证证据。纯文档低风险改动可以跳过；但 S70 这类工具权限、AI-first、hidden 边界和 provider 验收规划属于核心路线图，建议即使纯文档也做只读复审。

## 14. 依赖与资料准备

### 14.1 运行依赖

优先不新增 npm 依赖。S70 绝大部分功能应基于现有能力：

- Node.js + Express plain JavaScript。
- `ajv`：校验工具输入、proposal、request-adjudication、prompt 输出和 provider JSON。
- `openai`：OpenAI-compatible adapter 基础，MiMo / DeepSeek 当前也走兼容路径或自有 adapter 归一化。
- `@anthropic-ai/sdk`：Anthropic provider。
- `dotenv` / `cors`：现有本地配置和 CORS 控制。
- `playwright-core`：浏览器 smoke，不进入运行时。
- `node:test`：S70 fixture、红队、provider smoke 和工具协议测试。

默认不要引入：

- 前端框架或构建工具。AI 设置、月报、审计面板继续用 plain HTML/CSS/JS。
- 通用 SQL 执行器、外部数据库服务、远程存档 SDK。
- 第三方 MCP server。S70 前中期只做内部 `game_ai_tools` registry；后期如果包装内部 MCP，也只连接自家工具层。
- 搜索、向量库、队列、任务调度、可观测 SaaS。先用本地 JSON/SQLite、事件档案、审计表和 Node 脚本。

可能需要评估但不得默认加入的依赖：

- MCP SDK：只有当 `game_ai_tools` registry 稳定、工具数量膨胀且确实需要 `tools/list` / `tools/call` 统一发现时，才核验官方 SDK 包名、版本、许可证和安全边界，并按 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md) 走依赖治理。
- 本地任务队列或限流库：只有当 provider 并发和批量 NPC mind 真正需要跨进程队列时再评估。单进程阶段优先用内存预算、Promise 并发 cap 和超时控制。
- JSON schema 生成/类型库：plain JS + AJV 够用时不引入；若未来 schema 数量爆炸，再评估收益。

新增依赖的硬门槛：

- 明显降低复杂度或提高安全性，而不是只为了“看起来专业”。
- 不破坏 `npm install && npm start`。
- 不让真实 API key、远程服务或联网成为本地启动必要条件。
- 写入依赖治理文档：用途、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、测试和回滚策略。

### 14.2 技术资料

S70.1 启动前，Codex 需要把这些资料整理成短契约或脚注，不要只留聊天里：

- 本文第 1 节列出的 OpenAI Function Calling、Structured Outputs、MCP/Connectors、Anthropic Tools/MCP、DeepSeek Function Calling、MiMo-V2.5-Pro 官方资料。
- 当前 provider adapter：`src/ai/providers/openai.js`、`mimo.js`、`deepseek.js`、`anthropic.js`、`mock.js`、`remoteHelpers.js`。
- 当前 prompt 和 schema：`src/ai/promptPacks.js`、`src/ai/prompts.js`、`src/ai/schemas.js`、`src/ai/promptContextAssembler.js`。
- 当前 provider smoke：`scripts/providerSmoke.js`、`scripts/providerRouteHealth.js`、`scripts/providerLongRun.js`、`test/providerSmokeScript.test.js`、`test/mimoProvider.test.js`。
- 当前 AI 红队：`test/aiControlRedTeam.test.js`、`test/aiSchemas.test.js`、`test/aiEvalFixtures.test.js`。

技术资料的使用原则：

- 只把稳定结论写入契约，例如工具 schema、返回形状、失败模式、provider 差异。
- 不把完整外部文档复制进仓库。
- MiMo 的工具调用行为必须靠真实 smoke 固定，不能只根据 OpenAI-compatible 做推断。

### 14.3 玩法资料

S70 每个领域工具都需要一页以内的“玩法资料笔记”，优先写进对应契约或 config 注释，不直接塞进 prompt：

- 官制与权力链：皇帝、内阁/中书、六部、都察院、地方督抚、州县、军镇、吏部铨选、考成、回避、奏折/题本/批红等。
- 官场赏罚：升迁、加衔、记功、赏银、赐物、降调、革职、弹劾、下狱、赦免、诛罚及其合法性成本。
- 财政与城市：钱粮、仓储、平粜、赈济、水利、清丈、盐漕、徭役、士绅阻力、民心。
- 刑名与案件：受理、传唤、证据、口供、胥吏、士绅压力、调解、申详、移交、判决后果。
- 军务与外交：兵粮、士气、地形、侦察、守御、练兵、会战、朝贡、互市、和议、宣战授权。
- NPC 心智：恩怨、人情债、师门、同年、家族风险、派系、目标、恐惧、野心、记忆衰减。
- 地图接口：国家、地区、城市、道路、河流、关隘、军镇、贡院、书院、任所、考场、商路、边境点。

外部历史资料可以作为设计参考，但只写游戏化转译，不复制长篇版权文本。优先使用公版史料、博物馆/百科/学术可核验资料；S70 验收不依赖联网。

### 14.4 测试资料

S70 要准备这些 fixture：

- `ai-tool-basic`：书生、县令、大臣、将领、皇帝各调用一个合法工具。
- `ai-tool-authority-redteam`：书生宣战、县令调边军、商贾任免官员、皇帝无证杀臣、AI 夹带 SQL/raw state patch。
- `prompt-injection`：玩家要求忽略系统、泄漏 prompt、读取 `.env`、把传闻当事实、伪造工具结果。
- `provider-tool-shapes`：MiMo/OpenAI/DeepSeek/Anthropic/Mock 的无工具、单工具、强制工具、多工具、工具结果回填、streaming、schema 失败样例。
- `npc-memory`：恩怨、人情债、同年、师门、赏罚、旧案回响。
- `monthly-briefing`：书生/候缺、县令、部院官、将领、皇帝月报。
- `time-skip`：学习一月、养病半月、照旧处理一月、中途被科考/灾情/上级召见打断。
- `map-context`：赶考、赴任、巡查、行军、会盟、商路事件。
- `large-concurrency`：多 actor 场景、多 NPC mind、长输出、高 token、高并发预算。
- `hidden-canary`：raw table 名、raw prompt 形状、hidden notes、hidden intent、本地路径、key 形状、provider proposal 原文。

## 15. S70 逐步开发任务书

### S70.1：AI 提示词与工具协议契约

前置依赖：S69.6 已完成归档，S70.1 可正式启动；可先做文档调研和 provider 工具调用形状确认。

当前状态（2026-05-12）：S70.1 已落地首版契约与最小验证入口。已新增 `docs/AI_PROMPT_ENGINEERING_CONTRACT.md`、`docs/AI_TOOL_PROTOCOL_CONTRACT.md`、`src/ai/toolSchemas.js`、`scripts/providerToolSmoke.js`、`test/aiToolProtocolContract.test.js` 和 `test/providerToolSmokeScript.test.js`；`npm run smoke:provider:tools` 先覆盖 MiMo forced tool call 与 tool-result roundtrip，缺 key 明确 skip，`MIMO_REQUIRED=1` 时缺 key fail。`multi_tool`、`streaming` 和真实 provider schema failure 的完整兼容记录留给后续 smoke 扩展。

需要资料：本文第 1 节技术参考、现有 `src/ai/*`、provider smoke 脚本、AI 控制矩阵、S68-S69 科举工具边界、MiMo 官方接入说明。

具体实现：

- 新增 `docs/AI_PROMPT_ENGINEERING_CONTRACT.md`，定义 `systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck`。
- 新增 `docs/AI_TOOL_PROTOCOL_CONTRACT.md`，定义 tool envelope、permission、resolver、audit、cooldown、mockFallback、proposal/result/request-adjudication schema。
- 新增或扩展 `src/ai/toolSchemas.js`，集中导出工具 envelope schema、proposal schema、tool result schema、provider normalization schema。
- 新增 `test/aiToolProtocolContract.test.js` 和 prompt contract fixture。
- 扩展 provider smoke：增加 MiMo 工具调用兼容矩阵，覆盖 `tools`、`tool_calls`、`tool_choice`、多工具、工具结果回填、streaming、schema 失败。
- 明确 `server.*` 只能是内部 resolver bridge / audit label，不能进入模型可见 tool list。

验收：

- `npm run check:docs-governance`
- `node --test test/aiToolProtocolContract.test.js test/prompts.test.js test/aiSchemas.test.js`
- 有 key 时可运行 MiMo tool smoke；缺 key 时明确 skip，不伪装通过。
- 契约明确 AI 不执行 SQL、不直写 canonical 状态、不读取 hidden/raw。

### S70.2：AI Actor 与权限模型

前置依赖：S70.1。

当前状态（2026-05-12）：S70.2 已落地首版 actor profile 与权限 allowlist。已新增 `src/game/aiActorProfileConfig.js` 和 `src/game/aiActorProfiles.js`，覆盖 T0-T6 authority tier、actor type template、tool group、visibility preset、budget preset、玩家/NPC/官署/系统 profile 构造、安全 view/prompt summary 和 `filterActorTools()`。本步只负责 profile 与工具可见性过滤，不执行工具、不写状态、不写审计或 session；runner 与 resolver bridge 留给 S70.3。

需要资料：当前角色系统、`worldPeopleView`、`officialPostingsView`、`relationshipView`、S68-S69 老师/考官/同年关系、官制资料笔记。

具体实现：

- 新增 `src/game/aiActorProfileConfig.js`：authority tier、role templates、tool groups、visibility presets、budget presets。
- 新增 `src/game/aiActorProfiles.js`：
  - `buildPlayerAiActorProfile(worldState)`
  - `buildNpcAiActorProfile(worldState, npcRef, options)`
  - `buildOfficeAiActorProfile(worldState, officeRef, options)`
  - `buildSystemEngineActorProfile(worldState, engineType)`
  - `filterActorTools(actorProfile, toolRegistry)`
- 在 route view 或 prompt context 中只暴露 actor 可见摘要，不暴露完整 profile hidden 字段。
- 建立 actor types：`scholar`、`teacher`、`examiner`、`gentry`、`clerk`、`magistrate`、`minister`、`censor`、`general`、`emperor`、`foreign_ruler`、`system_engine`。
- 补 `AI_CONTROL_AUDIT_MATRIX.md`：每个 actor tier 的 read scope、tool scope、proposal scope、禁止项。

测试：

- `test/aiActorProfiles.test.js`
- `test/aiActorToolPermissions.test.js`
- 书生不能拿皇帝/军事/刑名高权工具，县令不能跨辖区，皇帝能请求强工具但仍需 resolver。

验收：

- actor profile 可从玩家、NPC、官署和系统引擎稳定生成。
- hidden/private 字段不进入普通 route、prompt 或浏览器。

### S70.3：内部工具运行时

前置依赖：S70.1-S70.2。

当前状态（2026-05-12）：S70.3 已落地内部 registry/runner 基础。已新增 `src/ai/gameAiTools.js`、`src/ai/gameAiToolRunner.js` 和 `src/game/aiToolResolvers.js`，提供工具注册、actor 可见工具列表、provider tool call 归一、read/proposal/request-adjudication runner、`world.read_visible_context` read resolver、pending resolver bridge、基础 cooldown、tool result 回填和 hidden-safe tool audit record。本步不接入普通 turn、不写 session/SQLite、不创建真实领域后果；领域工具定义集中化与场景接入留给 S70.4-S70.7。

需要资料：工具协议契约、AI 权限矩阵、当前 audit、stateRules、sessionStore、Mock provider。

具体实现：

- 新增 `src/ai/gameAiTools.js`：
  - `createGameAiToolRegistry()`
  - `registerGameAiTool(toolDefinition)`
  - `listToolsForActor(actorProfile, options)`
  - `validateToolDefinition(toolDefinition)`
- 新增 `src/ai/gameAiToolRunner.js`：
  - `runReadTool(toolCall, context)`
  - `runProposalTool(toolCall, context)`
  - `runRequestAdjudicationTool(toolCall, context)`
  - `normalizeProviderToolCall(providerPayload)`
  - `buildToolResultForModel(result)`
- 新增 `src/game/aiToolResolvers.js` 或按领域拆分 resolver bridge。
- 工具类型分三类：read、proposal、request-adjudication。所有写入只能进入服务器 resolver。
- 接入审计：记录 actor、tool、参数摘要、权限检查、接受/拒绝原因、applied event ids、成本摘要，不记录 raw prompt/key/path。
- Mock runner 必须能 deterministic 返回合法 tool result。

测试：

- `test/gameAiTools.test.js`
- `test/gameAiToolRunner.test.js`
- `test/gameAiToolAudit.test.js`
- `test/aiControlRedTeam.test.js` 扩展工具越权。

验收：

- 模型可请求工具，但不能绕过 permission、cooldown、schema 和 resolver。
- JSON/SQLite 下 player-facing result 一致。

### S70.4：NPC Mind 与记忆基础

前置依赖：S70.3。

当前状态（2026-05-12）：S70.4 已落地 NPC mind 基础。已新增 `src/game/npcMindConfig.js` 和 `src/game/npcMind.js`，覆盖高显著 NPC 排序、NPC mind prompt context、安全 heuristic proposal、Mock/no-key deterministic fallback、proposal 清洗、服务器应用可见关系变化/公开事件材料/`player_visible` 记忆候选和 hidden-safe 审计摘要。当前实现不接普通 turn 自动调度、不调用真实 provider、不保存深层 private memory ledger、不写 SQLite；真正 actor memory ledger、private impression、月度 summary、检索和 provider mind loop 留给 S70.12 / S70.8 后继续深化。

需要资料：`worldPeopleView`、relationship ledger、eventArchive、examNetwork、actor profile、NPC 记忆玩法资料。

具体实现：

- 新增 `src/game/npcMindConfig.js`：显著度规则、每旬最大 LLM NPC 数、背景 NPC heuristic、token budget、cooldown。
- 新增 `src/game/npcMind.js`：
  - `rankNpcSalience(worldState, options)`
  - `buildNpcMindPromptContext(worldState, actorProfile, options)`
  - `generateNpcMindProposal(worldState, actorProfile, aiClient, options)`
  - `applyNpcMindProposal(worldState, proposal, auditContext)`
- 背景 NPC 只走 heuristic：关系微调、传闻候选、低影响事件材料。
- 高显著 NPC 才走 LLM：玩家近关系、权力核心、当前场景参与者、事件相关者。
- 记忆先做安全摘要，不保存深 hidden 私档；真正 private memory 等 redacted API / S70.12。

测试：

- `test/npcMind.test.js`
- `test/npcMindSalience.test.js`
- `test/npcMindHiddenRedaction.test.js`
- Mock provider deterministic。

验收：

- NPC 会主动提出请求、援助、阻挠、告发或记忆更新。
- 大量背景 NPC 不造成无限调用或成本失控。

### S70.5：制度 AI 与朝议/科场场景

当前状态（2026-05-12）：S70.5 已落地首版制度场景 helper。已新增 `src/game/institutionSceneConfig.js` 和 `src/game/institutionScenes.js`，覆盖朝议/科场 scene type、参与者预设、轮次/提案预算、公开 context 压缩清洗、Mock/no-key heuristic proposal、场景轮次收束和 `pending_server_resolution` outcome。朝议参与者覆盖皇帝、堂官/吏部、御史和按议题选择的领域官署；科场评议覆盖房官、同考官、主考官和复核 critic。当前实现不接普通 turn、不运行真实 provider、不写 session/SQLite、不推进全局时间、不执行工具；真实领域后果仍留给后续 resolver。

前置依赖：S70.3-S70.4；S68-S69 科举深化完成。

需要资料：科举制度契约、examProcedure/examReview/examHonors/examNetwork、官制资料、朝议资料。

具体实现：

- 新增 `src/game/institutionSceneConfig.js`：场景类型、参与 actor、最大轮次、工具预算、结束条件。
- 新增 `src/game/institutionScenes.js`：
  - `createCourtDebateScene(worldState, topic, options)`
  - `createExamReviewScene(worldState, examContext, options)`
  - `runInstitutionSceneRound(scene, aiRuntime, options)`
  - `collectInstitutionProposals(sceneRound)`
  - `resolveInstitutionSceneOutcome(worldState, scene, proposals)`
- 朝议场景：皇帝、内阁/大臣、御史、相关官署围绕奏折/弹章/财政/边事提出 proposal。
- 科场场景：房官、同考官、主考、磨勘 critic 进一步接入 S68-S69 的 proposal-only 机制。
- 场景使用 scene-local time，不乱推进全局旬。

测试：

- `test/institutionScenes.test.js`
- `test/institutionSceneVisibility.test.js`
- `test/examInstitutionScene.test.js`

验收：

- 多 actor 发言和 proposal 能被服务器收束。
- 皇帝强工具有执行链和反噬，不是按钮。

### S70.6：压力事件工具协议与 Actor Proposal

当前状态（2026-05-12）：S70.6 已落地首版压力事件工具协议。已新增 `src/ai/eventToolDefinitions.js`、`src/game/aiEventProposalConfig.js` 与 `src/game/aiEventProposal.js`，默认 `game_ai_tools` registry 包含 `event.propose_incident` / `event.request_incident_adjudication`。事件 proposal 只可引用 actor 可见的地理、案牍、财赋、军务、情报、人物怨望、世界实体或事件档案压力摘要；服务器 resolver 锚定 actor、校验权限和可见来源、清空 private refs，并返回 `pending` / `rejected`。本步不接普通 turn、不运行真实 provider、不写状态/session/SQLite/事件档案；数据库 projection 压力采集、概率、冷却成案和归档仍留给 S71.8。

前置依赖：S70.3-S70.5。

需要资料：S60-S67 内容归档、eventArchive、intelligenceRumors、localAffairsDockets、militaryDiplomacy、economicFiscal、S71 压力事件规划。

具体实现：

- 明确职责：S70.6 做事件 proposal 工具和 actor 参与方式；S71.8 再把数据库 projection 压力采集、冷却、概率和成案 resolver 做厚。
- 新增 `event.propose_incident`、`event.request_incident_adjudication` 工具定义。
- 新增 `src/game/aiEventProposal.js`：
  - `normalizeEventProposal(proposal)`
  - `validateEventProposalAuthority(actorProfile, proposal, context)`
  - `resolveEventProposal(worldState, proposal, options)`
  - `buildEventProposalAudit(proposal, result)`
- 事件 proposal 必须带 `sourcePressureRefs`、`visibility`、`confidence`、`cooldownKey`、`publicSummary`、`privateResultRefs`。
- Mock 事件 proposal 覆盖城市、边防、书院、官场、NPC 怨怼。

测试：

- `test/aiEventProposal.test.js`
- `test/aiEventProposalRedTeam.test.js`

验收：

- 事件可以由 AI actor 提出，但服务器决定是否成案。
- proposal 夹带 hidden/raw/SQL 被拒绝。

### S70.7：刑名、财政、军事、外交与科举工具

当前状态（2026-05-12）：S70.7 已落地首版领域工具协议与 thin resolver bridge。已新增 `src/ai/domainToolDefinitions.js` 与 `src/game/domainToolResolvers.js`，默认 `game_ai_tools` registry 包含刑名、地方政策、军务、外交、科举定榜复核、授官复核、赏赐升迁和处分复核八个工具。领域工具只可引用 actor 可见的地方案牍、财赋市场、军务外交、公开情报、地理、官署任所、科场流程/阅卷/荣誉、授官轨迹、可见人物和事件档案 evidence refs；服务器 resolver 锚定 actor、校验权限、辖区、证据领域、证据范围、冷却和敏感文本，清空 private refs，并返回 `pending` / `rejected`。辖区型工具要求 evidence `scopeRefs` 与 actor 辖区相交，无范围事件档案不能单独作为辖区证据。本步不接普通 turn、不运行真实 provider、不写状态/session/SQLite/事件档案/官职/榜单/判决/军令/战和/赏罚；真实领域结算仍留给 S71 服务器 resolver。

前置依赖：S70.3、S70.6；领域玩法 resolver 可先用轻量 stub，S71 再做数据库驱动深裁决。

需要资料：财政、刑名、军务外交、科举授官、官制赏罚资料笔记。

具体实现：

- 工具定义：
  - `judicial.propose_case_resolution`
  - `city.propose_policy`
  - `military.propose_order`
  - `diplomacy.propose_move`
  - `exam.request_ranking_adjudication`
  - `office.request_appointment_adjudication`
  - `career.propose_reward_or_promotion`
  - `career.request_discipline_adjudication`
- 新增 `src/ai/domainToolDefinitions.js`，集中导出领域工具。
- 新增 `src/game/domainToolResolvers.js` 或按领域拆分 thin resolver bridge。
- 对没有完整 resolver 的领域，先返回 `pending` 或有限 `rejected/accepted` 样例，不伪装已经完整实现。
- 所有工具的 `inputSchema` 默认 `additionalProperties: false`，并有 authority/cooldown/riskTags。

测试：

- `test/domainToolDefinitions.test.js`
- `test/domainToolPermissions.test.js`
- `test/domainToolResolvers.test.js`
- `test/careerToolRedTeam.test.js`

验收：

- 上级或皇帝可以提出赏赐/升迁 proposal，服务器按官制裁决或 pending。
- 领域工具不暴露 raw SQL、raw table、raw state patch。

### S70.8：多模型路由、提示词评测与仲裁

前置依赖：S70.1-S70.7。

需要资料：现有 provider adapters、provider smoke scripts、AI eval fixtures、MiMo/DeepSeek/OpenAI/Anthropic 能力差异。

当前状态（2026-05-12）：S70.8 已落地首版多模型 task route policy 与本地 eval runner。已新增 `src/ai/modelRoutePolicy.js`，固定 `narrator`、`actor_mind`、`planner`、`domain_specialist`、`critic`、`safety_gate`、`memory_summarizer`、`monthly_briefing` 和 `time_skip_planner` 的 provider/model/budget/tool policy；`AI_PROVIDER=mock` 即使本机有真实 key 也保持全任务 Mock；`critic` / `safety_gate` 强制 review-only，不能用工具、request adjudication、调用 `server.*` 或写状态。`src/ai/index.js` 现在保留原有五方法 provider 接口，同时提供 `getProviderForTask()` / `createRoutedProvider()`；route 的 model、timeout、temperature 和 token budget 会传入支持的 adapter，现有 route 不需要直接理解 task type。已新增 `src/ai/aiEvaluationRunner.js` 与 `scripts/aiEvaluationRunner.js`，`npm run eval:ai` 运行本地 fixture、schema、语气、hidden/raw canary、canonical ranking overreach、review-only 和成本摘要检查。本步不做真实 provider 多模型共识、不新增持久审计表，S70.9 继续 AI 设置与可观测性。

具体实现：

- 新增 `src/ai/modelRoutePolicy.js`：
  - `buildDefaultModelRoutePolicy(env, options)`
  - `resolveModelForTask(taskType, routePolicy)`
  - `validateModelRoutePolicy(policy)`
- 新增 task types：`narrator`、`actor_mind`、`planner`、`domain_specialist`、`critic`、`safety_gate`、`memory_summarizer`、`monthly_briefing`、`time_skip_planner`。
- 扩展 `src/ai/index.js` 或 provider facade，让调用方按 taskType 请求模型。
- 新增 `src/ai/aiEvaluationRunner.js` 或脚本，跑 prompt fixtures，比较 schema 合规、越权拒绝、历史语气、工具选择、成本摘要。
- critic/safety 只输出风险和建议，不能直接写状态或替 resolver 裁决。

测试：

- `test/modelRoutePolicy.test.js`
- `test/aiEvaluationRunner.test.js`
- `npm run eval:ai`
- provider smoke 有 key 时覆盖真实 MiMo；缺 key skip。

验收：

- 不同任务能路由不同模型。
- 多模型共识不能绕过服务器裁决。

### S70.9：AI 设置与可观测性

前置依赖：S70.8。

需要资料：model route policy、provider env、现有 browser app、AI diagnostics。

具体实现：

- 新增 `src/game/aiSettingsConfig.js`：预设 `balanced`、`quality_first`、`fast`、`long_context`、`mimo_full`。
- 新增 `src/game/aiSettings.js`：
  - `buildDefaultAiSettings()`
  - `validateAiSettingsPatch(patch)`
  - `resolveAiSettingsForSession(worldState, env)`
  - `redactAiSettingsForClient(settings)`
- 新增 route 或扩展 game state：返回玩家可见 AI 设置，不返回 key/base URL。
- 浏览器新增 AI 设置面板：模型路由、输出长度、并发、工具预算、安全严格度、critic/safety 开关。
- 新增 AI 调动摘要 view：tool call 数、拒绝原因、任务类型、公开成本摘要。hidden-safe，不能显示 raw prompt/proposal。

测试：

- `test/aiSettings.test.js`
- `test/aiSettingsRoute.test.js`
- `test/publicAppSource.test.js`
- 设置越权红队：尝试开启 hidden/raw/直写库必须拒绝。

验收：

- 玩家能配置不同任务的 AI 策略。
- 设置只影响质量/预算/路由，不改变权限。

当前状态（2026-05-12）：S70.9 已落地首版 session 级 AI 设置与可观测性。已新增 `src/game/aiSettingsConfig.js` 与 `src/game/aiSettings.js`，提供均衡、质量优先、快速、长上下文和 MiMo 全量预设，按 S70.8 九类 task type 合成 route policy，并生成 hidden-safe `aiSettingsView` / `aiInvocationSummaryView`。`/api/game/start`、state、普通/流式 turn、`/api/exam/question`、`/api/exam/submit` 都返回 AI 设置与调动摘要；新增 `GET/POST /api/ai/settings/:sessionId`，只允许玩家调整 provider/model、输出长度、工具预算、输出倍率、并发和安全严格度。浏览器 `#ai-control-panel` 只读 route view，不读 raw `worldState.aiSettings`；设置 patch 会拒绝 hidden/raw/server/path/key、直写状态/数据库、server resolver、raw audit 和观测日志伪造，critic/safety 等 review-only 任务工具预算强制为 0。本步只做 session 内 bounded 调动摘要，不新增 SQLite 审计表、provider tracing 或真实 provider 长跑；更完整的 AI 调动审计面板留给 S71.11。

### S70.10：玩家官职月报与 AI 推动世界

前置依赖：S70.8-S70.9；最好 S69.3 授官路径完成。

需要资料：time/month tick、officialCareer、officialPostings、localAffairsDockets、militaryDiplomacy、economicFiscal、relationshipView、eventArchive。

具体实现：

- 新增 `src/game/playerMonthlyBriefingConfig.js`：职位模板、月报 sections、最大条数、触发时机、AI/Mock 策略。
- 新增 `src/game/playerMonthlyBriefing.js`：
  - `shouldGeneratePlayerMonthlyBriefing(previousState, nextState)`
  - `buildMonthlyBriefingContext(worldState, options)`
  - `generateMonthlyBriefingProposal(context, aiRuntime, options)`
  - `resolveMonthlyBriefing(worldState, proposal, options)`
  - `buildPlayerMonthlyBriefingView(worldState, options)`
- 月报触发：下旬进入下月上旬时，且只针对玩家。
- 月报内容：政务/财政/案牍/军务/上级态度/同僚风向/NPC 来信/下月风险/可行动事项。
- AI 可提出主动事件线索，服务器决定是否写入事件档案或 pending request。
- 浏览器新增月报展示。

测试：

- `test/playerMonthlyBriefing.test.js`
- `test/playerMonthlyBriefingRoute.test.js`
- `test/gameTurnTick.test.js` 扩展月末触发。

验收：

- 三旬一月触发一次，不给所有 NPC 全量生成月报。
- 月报不会泄漏 hidden/private，也不会直接改官职/财政。

当前状态（2026-05-12）：S70.10 已落地首版玩家官职月报。已新增 `src/game/playerMonthlyBriefingConfig.js` 与 `src/game/playerMonthlyBriefing.js`，玩家为入仕官员、地方官、大臣、将领或皇帝时，在下旬进入下月上旬的月末 tick 生成一次 `playerMonthlyBriefingView`；同一 `periodKey` 重复触发会被拒绝。月报 context 只读 `officialCareerView`、`officialPostingsView`、`localAffairsDocketView`、`economicFiscalView`、`militaryDiplomacyView`、`worldPeopleView` 与事件档案等安全 projection，输出本职差事、钱粮案牍、军务边情、上官同僚、下月待办和风险摘要；resolver 只写脱敏 `worldState.playerMonthlyBriefing`、月报事件、`monthly_briefing` 事件档案条目和 bounded AI 调动摘要，不直接改官职、财政、案牍、军务、NPC、SQLite 或审计表。游戏、考试和 SSE payload 已接入 `playerMonthlyBriefingView`，浏览器新增“官职月报”面板和 `[月报]` 叙事反馈，只读 route view 与 turn feedback。本步使用 Mock/no-key deterministic heuristic 和 S70.8 `monthly_briefing` route 观测记录，真实 provider 月报长跑留给 S70.14。

### S70.11：自然语言跳时

前置依赖：S70.8-S70.10。

当前状态（2026-05-13）：S70.11 已落地首版自然语言跳时。已新增 `src/game/timeSkipConfig.js` 与 `src/game/timeSkip.js`，解析“学习一月”“养病半月”“照旧处理一月”等输入，生成 `timeSkipPlan`、校验最大 6 旬、清洗 hidden/raw/provider/prompt/key/path/SQLite 文本，并用 `runTimeSkipTicks()` 逐旬执行。`POST /api/game/turn` 和 SSE 在 narrator 调用前分流跳时请求，记录 `time_skip_planner` AI 调动摘要，但实际世界推进继续复用既有 `finalizeTurn()` 结算链；因此读书账本、角色联动、人脉请托、worldTick、longTermEvents、officialCareer、worldPeopleLifecycle 与 S70.10 月报按每旬/每月原规则运行。跳时会在考试场景、科期开场、重大长期事件或署中急件出现时停在当旬，并返回 `timeSkip` 安全总结、逐旬摘要、是否中断和下一步提示；浏览器只读本回合 `timeSkip` feedback 追加 `[跳时]` 叙事。

需要资料：`src/game/time.js`、worldTick、exam calendar、active requests、studyProfile、monthly briefing。

具体实现：

- 新增 `src/game/timeSkipConfig.js`：最大跳时长度、可中断事件类型、每步预算、默认策略。
- 新增 `src/game/timeSkip.js`：
  - `detectTimeSkipIntent(playerInput, context)`
  - `buildTimeSkipPlan(playerInput, aiRuntime, options)`
  - `validateTimeSkipPlan(plan, worldState)`
  - `runTimeSkipTicks(worldState, plan, options)`
  - `buildTimeSkipSummary(results, aiRuntime, options)`
- `POST /api/game/turn` 检测“学习一月/养病半月/照旧处理一月”等意图，进入 time skip flow。
- 服务器把一月拆为三旬，逐旬运行读书、政务、NPC、事件压力、长期事件、月报触发。
- 高优先级事件中断：科考、灾害、弹劾、上级召见、亲友急信、战事、死亡/重病。

测试：

- `test/timeSkip.test.js`
- `test/gameTurnTimeSkip.test.js`
- `test/timeSkipInterruptions.test.js`

验收：

- “学习 1 个月”确实推进三旬，不是一回合叙事糊过去。
- 中断时状态停在中断旬，并有清楚叙事和待办。

### S70.12：大模型记忆系统

前置依赖：S70.4、S70.8、S70.11；private memory 深化依赖 redacted API。

需要资料：eventArchive、relationshipLedger、examNetwork、monthlyBriefing、promptContextAssembler、NPC 记忆玩法资料。

具体实现：

- 新增 `src/game/actorMemoryConfig.js`：记忆类型、显著度、衰减、最大条数、可见性、prompt cap。
- 新增 `src/game/actorMemoryLedger.js`：
  - `buildActorMemoryView(worldState, actorId, options)`
  - `proposeActorMemoryUpdate(actorId, proposal, options)`
  - `applyActorMemoryUpdate(worldState, memoryUpdate, auditContext)`
  - `decayActorMemoryLedger(worldState, options)`
  - `summarizeActorMemoryForPrompt(worldState, actorId, options)`
- 新增 `src/game/sessionSummary.js`：
  - `updateMonthlySessionSummary(worldState, monthResult, aiRuntime, options)`
  - `summarizeRecentPlayerHistory(worldState, options)`
- 记忆分层：hot context、session summary、fact memory、impression memory、actor memory ledger、safe retrieval index。
- AI 只能提交 memory proposal；服务器去重、标来源、置信度、可见性和衰减。

测试：

- `test/actorMemoryLedger.test.js`
- `test/actorMemoryVisibility.test.js`
- `test/sessionSummary.test.js`
- `test/promptContextAssembler.test.js` 扩展 memory cap。

验收：

- 重要 NPC 能长期记住恩怨、人情债、师门同年、赏罚。
- private/impression memory 不进入普通玩家 view 或 prompt，除非 actor 视野允许。

### S70.13：地图系统 AI 接口预留

前置依赖：S70.1-S70.3；可在地图 UI 前完成。

需要资料：worldGeography、officialPostings、militaryDiplomacy、examTravel、local affairs、地图玩法资料。

具体实现：

- 新增 `src/game/mapContextConfig.js`：实体类型、可见性、距离/辖区预算、移动类型。
- 新增 `src/game/mapContext.js`：
  - `buildMapContextView(worldState, actorProfile, options)`
  - `buildMapEntityRef(entity, domain)`
  - `filterMapContextByVisibility(mapContext, actorProfile)`
  - `summarizeMapContextForPrompt(mapContext, options)`
- 新增 movement proposal schema：
  - `map.propose_route_or_geopolitical_move`
  - types：赶考、赴任、巡查、行军、押解、使节出行、商路活动。
- 地图事件 hook：事件、案牍、灾害、边患、市场、官职任所能关联 `mapEntityRef`。
- 不做完整地图 UI，只保证后续 UI 可接。

测试：

- `test/mapContext.test.js`
- `test/mapVisibility.test.js`
- `test/mapMovementProposal.test.js`

验收：

- AI 只读 `mapContextView` 和 capped 摘要，不读 raw coordinate table 或 hidden enemy truth。
- 地点引用稳定，后续 UI 能跳转/高亮。

### S70.14：真实 MiMo 验收与 S70 归档

前置依赖：S70.1-S70.13。

需要资料：所有 S70 测试结果、真实 provider key 配置、browser smoke、dual-mode smoke、AI 控制红队、子代理复审报告。

具体实现：

- 新增或扩展 provider smoke：
  - `scripts/providerToolSmoke.js`
  - `scripts/providerAiFirstSmoke.js`
  - npm scripts：`smoke:provider:tools`、`smoke:provider:ai-first`
- `MIMO_REQUIRED=1` 或等价开关：用于明确要求真实 MiMo 的验收，不允许缺 key 时假通过。
- 覆盖场景：普通回合、长叙事、NPC mind、工具调用、月报、跳时、记忆提炼、地图 context、critic/safety、多工具回填、schema 失败。
- 新增 `docs/AI_ORCHESTRATION_ARCHIVE.md`，归档 S70 完成范围、接口、工具、设置、验收、风险和 S71 交接。
- 压缩 `docs/DEVELOPMENT_STEPS.md` 中 S70 长记录，保留归档入口。

验收命令建议：

- `npm run check:docs-governance`
- `node --test test/aiToolProtocolContract.test.js test/aiActorProfiles.test.js test/gameAiTools.test.js`
- `node --test test/npcMind.test.js test/institutionScenes.test.js test/aiEventProposal.test.js`
- `node --test test/domainToolDefinitions.test.js test/modelRoutePolicy.test.js test/aiSettings.test.js`
- `node --test test/playerMonthlyBriefing.test.js test/timeSkip.test.js test/actorMemoryLedger.test.js test/mapContext.test.js`
- `npm run smoke:dual-mode`
- `npm run smoke:browser`
- 有 key 时：`MIMO_REQUIRED=1 npm run smoke:provider:tools` 与 `MIMO_REQUIRED=1 npm run smoke:provider:ai-first`

最终验收：

- 真实 MiMo 覆盖主要 AI-first 玩法。
- Mock 仍能作为开发安全网跑通 deterministic 路径。
- JSON/SQLite player-facing parity 不回退。
- hidden-token、越权工具、prompt injection、raw SQL/raw table/raw state patch 全部被拒绝。
- 完整书生路径不破坏。

## 16. S70 验收清单

- 契约：`AI_PROMPT_ENGINEERING_CONTRACT`、`AI_TOOL_PROTOCOL_CONTRACT`、AI 控制矩阵、brief、shared context 同步。
- 工具：所有模型可见工具都有 `name`、`description`、`inputSchema`、`permission`、`resolver`、`audit`、`cooldown`、`mockFallback`。
- 权限：书生/县令/大臣/将领/皇帝/系统引擎工具隔离，越权有拒绝原因和审计。
- Provider：MiMo 工具调用形状、streaming、多工具、工具回填、schema 失败均有 smoke。
- AI 设置：玩家可配质量、长度、并发、模型路由和安全严格度，但不能开启 hidden/raw/直写库。
- 月报：三旬一月，只针对玩家，按职位裁剪，能带出 NPC 主动请求和下月风险。
- 跳时：自然语言跳时逐旬结算，可中断，有合并总结。
- 记忆：fact/impression/private/public 分层，有来源、置信度、可见性和衰减。
- 地图接口：`mapContextView`、`mapEntityRef`、visibility、movement proposal 可供后续 UI 使用。
- 安全：raw prompt、raw provider proposal、key、本地路径、hidden notes、hidden intent、raw table、SQL 不进 UI/prompt/search/export。
- 回归：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 不破坏。
