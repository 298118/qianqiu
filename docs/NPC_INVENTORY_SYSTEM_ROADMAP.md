# S81-S85 NPC、资产与储物系统专项规划

本文件把 2026-05-20 用户提出的 NPC 系统、背包仓库、开局背景兑现、交易、委派任务和后续经济系统需求整理为可施工路线图。它是 S81-S85 的规划源头；活动台账只保留执行索引，具体契约以本文为准。

## 1. 目标体验

本专项要把《千秋》的“自由文本行动”推进为“AI 驱动的社会与物产模拟”。玩家不再只面对抽象叙事，而是在每个身份阶段都能看见人、物、资产、权力凭证和可委派事务。

核心体验如下：

- 开局背景真正落账。玩家写“家有房屋两座，白银一万两”，服务器应在校验后生成宅院、银两账本、可能的地契、亲族或仆役关系，以及富户身份带来的税务、盗匪、借贷、攀附或风评风险。
- 每个阶段都有大量可交互 NPC。书生遇到老师、同窗、书院掌柜和同场考生；地方官遇到胥吏、幕友、差役、士绅、商贾和案犯；官员遇到同僚、上司、属官、座师、门生和政敌；将领遇到副将、校尉、斥候、军需官和边民；皇帝遇到阁臣、近臣、后宫、宗室、边将和使节。
- NPC 不只是头像。每个重要或活跃 NPC 应有身份、立绘、公开履历、关系态度、可交易物、能力倾向、短期目标、长期动机、可见记忆、隐藏私档和场景可用行动。
- 玩家可以与 NPC 交谈、交易、赠礼、委派、召见、询问、请托和回绝；论道、切磋、求爱、婚姻先做数据与 UI 扩展位，后续再接玩法。
- 玩家指挥 NPC 的行动会进入任务账本。比如知府命令书吏“丈量田亩”，下月应有执行、阻力、花费、舞弊、成败、回报和后续事件，而不是立即一句叙事结束。
- 玩家和 NPC 都有背包、仓库、账本和权力凭证。银两、黄金、功绩、官声、皇恩、人情债等进入资源账本；书籍、任免文书、官印、兵符、玉玺、地契、兵器、药材等作为物品或权力凭证储存、转移、损毁、查验和触发效果。

## 2. 必守边界

- 前后端分离：后端先交付数据契约、API、AI schema、服务器 resolver、JSON/SQLite 存储和 Mock/no-key fallback；前端只能消费安全 API 与安全 view，不在浏览器内补判资源、交易、任免、委派结果或隐藏事实。
- 大步骤拆分：S81-S85 必须按后端/数据、AI/prompt、前端体验、验证/文档分层推进；同一 coherent change 可以包含契约和必要测试，但不得把大范围后端规则、前端重构、素材入库和数据库迁移混成不可审查的一团。
- AI 权力扩大但不直写状态。AI 可以解析背景、扮演 NPC、提出交易、建议委派结果、生成对话和整理记忆；服务器负责合理性校验、资源扣减、物品归属、任务结果、关系变化、晋级任免、经济数值、持久化和审计。
- JSON 默认路径必须继续完整可玩；SQLite 只作为本机增强和派生查询层，不引入远程存档、账号、多人与云端同步。
- 浏览器、prompt 和玩家 API 只读服务器安全 projection，不暴露 raw `worldState`、raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes、hidden intent、hidden inventory truth 或 SQLite 原始行。
- 完整书生路径 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 不能被资产、NPC 或交易系统破坏。

## 3. 技术栈与依赖决策

本专项默认沿用当前成熟栈：

- 后端：Node.js + Express，plain JavaScript，按 `src/game/*` 领域模块拆分 resolver、view builder、配置和测试。
- 前端：React + TypeScript + Vite，React Router Data Mode，Zustand UI/session store，Lucide 图标，继续放在 `client/`，生产构建输出 `dist/client/`。
- 校验：继续使用 Ajv 与现有 AI schema/tool schema 模式，新增 schema 放在 `src/ai/schemas.js`、`src/ai/toolSchemas.js` 或更贴近专项的模块。
- 存储：默认 JSON session snapshot；SQLite 使用 Node.js 内置 `node:sqlite` 与现有 adapter，新增派生表必须能从 `world_sessions.world_state_json` 单向修复。
- 视觉资产：继续使用已审核 `portraitRef`、runtime manifest、缩略图、低清占位和 `Portrait` 组件；重要 NPC 使用 `signature_npc_pool`，通用 NPC 使用通用池，未公开人物不得暴露未审核或隐藏素材。

本专项暂不强制新增第三方框架。后续若确实需要更复杂的前端异步缓存或拖拽整理体验，可在 S84 按依赖治理评估：

- `@tanstack/react-query`：仅当 NPC、背包、仓库、交易、委派多 surface 的请求失效和缓存明显超过当前 Zustand + API client 能力时考虑。
- `@dnd-kit/core`：仅当正式决定做拖拽式仓库/背包整理，而不是表格、筛选和按钮式转移时考虑。

新增依赖必须先更新 `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`，说明用途、替代方案、许可证、维护状态、安全影响、Mock/no-key 影响、测试覆盖和回滚策略。

## 4. 后端领域模型

### 4.1 开局背景契约

新增 `openingBackgroundClaims`，由 AI 或 Mock 解析玩家自由背景，输出结构化 claims，再由服务器裁决为 canonical state。

建议字段：

- `claimId`：稳定 ID。
- `claimType`：`wealth`、`property`、`kinship`、`retainer`、`education`、`office`、`military`、`artifact`、`debt`、`reputation`、`risk`。
- `claimSummary`：玩家宣称的安全摘要；原始背景文本不进入玩家 API、prompt 回显、SQLite 派生表或安全 view。
- `requestedValue`：玩家宣称数值或物件。
- `plausibility`：`accepted`、`scaled`、`converted_to_risk`、`rejected`。
- `serverDecision`：服务器说明。
- `grantedRefs`：落账后的资产、物品、NPC、关系或事件引用。
- `riskRefs`：因富贵、禁物、夸张身份或人情债生成的风险。

裁决示例：

- “白银一万两”：可按身份、朝代、地区上限部分兑现为 `resourceAccount.silver`，并生成富户风评、亲族借贷、盗警或税务风险。
- “房屋两座”：生成两项 `estate` 资产和对应 `deed` 地契物品，可附带修缮成本、佃户或邻里纠纷。
- “藏有玉玺”：普通身份不得直接获得真玉玺，可转为赝品、传闻、禁物线索或危险事件。
- “已是进士”：若玩家选择书生，不能绕过科举晋级；可转为“家中期望极高”“曾受名师指点”“误传身份”或降低为功课基础。

### 4.2 资产、资源与物品

新增三类互相关联的账本：

- `assetLedger`：房屋、田产、铺面、船只、马匹、作坊、书斋、府库、军械库等长期资产。
- `resourceLedger`：白银、黄金、铜钱、粮食、功绩、官声、民望、皇恩、军功、人情债、学望等可计量资源。
- `inventoryLedger`：玩家和 NPC 的随身背包、家宅仓库、官署库房、军中辎重、宫中内库和特殊容器。

物品基础字段：

- `itemId`、`templateId`、`name`、`category`、`subtype`。
- `ownerActorId`、`custodianActorId`、`containerId`、`locationRef`。
- `quantity`、`unit`、`quality`、`rarity`、`durability`、`condition`。
- `legalStatus`：`ordinary`、`restricted`、`official_seal`、`military_token`、`imperial_artifact`、`contraband`。
- `transferPolicy`：`tradeable`、`giftable`、`lendable`、`bound_to_office`、`bound_to_actor`、`server_only`。
- `effects`：读书、考试、官署、军务、医药、礼物、威望、开局风险等效果引用。
- `provenance`：来源、交易、赏赐、任命、继承、伪造或查封记录。
- `visibility`：玩家可见、公示、传闻、隐藏或角色限定。

重点物品类型：

- 书籍：四书五经、时文选本、律例、地理志、兵书、策论集、名师批本。
- 文书：任命文书、保结文书、路引、契约、地契、账本、奏折副本、案卷。
- 权力凭证：官印、关防、兵符、令牌、玉玺、诏书、勘合。
- 财物：银锭、金锭、铜钱、珠宝、布匹、盐引、粮票。
- 日用与专业物：笔墨纸砚、药材、兵器、甲胄、马匹、船只、测田工具。

### 4.3 NPC 名册与隐藏私档边界

新增 `npcRoster`，把既有世界人物、书院师友、官职任所、NPC 记忆账本和立绘池整合为玩家当前阶段可交互名册。

NPC 分层：

- `ambient`：短期或场景 NPC，轻记忆，可交易或对话少量信息。
- `active`：长期活跃 NPC，有关系、容器、目标、月度行动、可委派任务。
- `signature`：核心 NPC，有专属立绘、深记忆、隐藏动机、长期事件链。

NPC 字段：

- `npcId`、`sourceRef`、`displayName`、`roleTags`、`stageTags`、`portraitRef`。
- `publicProfile`：公开身份、籍贯、当前任所、关系摘要、可见能力。
- `relationship`：亲疏、信任、敬畏、敌意、人情债、师承、同年、婚姻等。
- `inventoryRefs`、`assetRefs`、`resourceAccountRefs`。
- `availableInteractions`：交谈、交易、赠礼、委派、召见、请托、论道、切磋、求爱等。
- `hiddenDossier`：隐藏动机、资产真数、秘密关系、未公开任务，只能由服务器本地 resolver 和 Mock/local deterministic planner 读取；外部 provider、浏览器、prompt 安全 view 和 SQLite 派生表不得读取完整私档。
- `privateSignalTags`：由服务器从 `hiddenDossier` 派生的脱敏标签，例如“求财”“避祸”“亲族压力”“可能欺瞒”，可在严格 budget 下供身份受限 AI 任务参考；这些标签只是非事实、不可逆、软倾向信号，外部 provider 不得把它们当作隐藏真相或确定动机，也不得包含资产真数、秘密姓名、未公开关系、隐藏事件原文或可反推私档的细节。

### 4.4 NPC 对话、交易与委派

新增 `npcInteractionLedger`、`tradeLedger` 和 `delegatedTaskLedger`。

交互类型：

- `talk`：闲谈、问询、试探、安抚、威吓。
- `trade`：购买、出售、议价、赠礼、借贷、典当。
- `command`：任命、差遣、丈田、查案、巡捕、递送、侦查、采购。
- `request`：请托、求援、求学、请保、引荐。
- `debate`、`duel`、`courtship`、`marriage`：先预留 schema、UI 入口和权限边界。

委派任务字段：

- `taskId`、`issuerActorId`、`assigneeActorId`、`authoritySource`。
- `taskType`：丈田、查账、巡捕、讲学、采买、侦查、传令、募兵、催粮等。
- `startTime`、`dueTime`、`cadence`、`status`。
- `requiredItems`、`budgetAccountRefs`、`riskFactors`、`successFactors`。
- `serverPlan`、`aiNarrativeProposal`、`result`、`auditRefs`。

“知府命手下丈田”应成为标准验收样例：

1. 玩家从地方官 NPC 面板选择书吏或差役，下达“丈量某乡田亩”。
2. 服务器验证玩家是否有辖区、官职、可用手下、经费、工具和时间。
3. 任务进入下月结算队列。
4. 月末根据 NPC 能力、忠诚、地方阻力、士绅关系、经费和风险计算成败。
5. 回报生成田亩清册、税粮调整建议、舞弊线索、民怨或士绅反弹。
6. 前端显示 NPC 回禀，玩家可继续追问、奖惩、复核或立案。

## 5. API 与安全 View

后端必须先提供安全 API，再由前端接入。

建议新增 API：

- `GET /api/game/inventory/:sessionId`：返回玩家可见资产、资源账本、背包、仓库、重要凭证和容器摘要。
- `POST /api/game/inventory-transfer/:sessionId`：玩家请求在随身、家宅、官署、军中等可见容器之间转移物品；服务器校验归属、权限、重量、合法性和绑定状态。
- `GET /api/game/npcs/:sessionId`：返回当前身份和场景可见 NPC 列表、分页、筛选、stage tags 和安全关系摘要。
- `GET /api/game/npc/:sessionId/:npcId`：返回单个 NPC 玩家可见档案、可用交互、交易摘要和近期记忆。
- `POST /api/game/npc-interaction/:sessionId`：交谈、询问、赠礼、请托和预留玩法入口；AI 可生成对话，服务器裁决关系与记忆。
- `POST /api/game/npc-command/:sessionId`：创建或处理委派任务；服务器校验 authority、资源和时间。
- `POST /api/game/trade/:sessionId`：发起交易、议价、接受或拒绝交易；服务器校验价格、库存、归属、合法性和双方意愿。

建议新增安全 view：

- `openingBackgroundClaimsView`
- `assetLedgerView`
- `resourceLedgerView`
- `inventoryView`
- `npcRosterView`
- `npcDetailView`
- `npcInteractionView`
- `tradeOfferView`
- `delegatedTaskView`

这些 view 只暴露玩家可知内容、摘要、数量上限、分页 metadata、可解释边界和 route refs；不得暴露隐藏私档、资产真数、未公开关系、模型原始 proposal、完整 prompt 或 SQLite 原始表名/行。

## 6. SQLite 派生表规划

JSON snapshot 仍是默认 canonical；SQLite 新表只做本机派生查询、维护和安全 projection。所有表都必须能从 `world_sessions.world_state_json` 修复，且不得成为浏览器或 AI prompt 的 raw truth source。

建议新增初始化模块：

- `src/storage/sqliteAssetTables.js`
- `src/storage/sqliteInventoryTables.js`
- `src/storage/sqliteNpcInteractionTables.js`

建议派生表：

- `asset_accounts`：玩家/NPC/机构长期资产摘要。
- `resource_accounts`：银两、黄金、粮食、功绩、官声等账本摘要。
- `inventory_containers`：随身、家宅、官署、军中、内库等容器。
- `inventory_items`：可见物品索引、数量、类别、归属、容器和安全标题。
- `npc_profiles`：可见 NPC 名册、阶段标签、立绘引用和公开身份。
- `npc_relationship_edges`：玩家可见关系边摘要。
- `npc_interaction_events`：脱敏交互事件摘要。
- `delegated_tasks`：委派任务状态、执行人、到期时间和公开结果摘要。
- `trade_offers`：当前可见交易报价、状态和安全物品引用。

索引至少覆盖：

- `(session_id, owner_actor_id)`
- `(session_id, container_id)`
- `(session_id, npc_id)`
- `(session_id, status, due_year, due_month, due_ten_day_period)`
- `(session_id, category, visibility)`

维护命令应扩展 `storage:sqlite:status|health|export-safe`，报告新派生表计数、修复状态、漂移数量和安全导出摘要。

## 7. AI 权限矩阵

新增 AI 任务类型时必须进入全局 AI 设置矩阵，并有 Mock fallback：

- `background_claim_parser`：读取开局表单和自由背景，输出 claims，不直接授予资产。
- `npc_dialogue`：读取 NPC 玩家可见档案、关系摘要和场景契约，输出对话、情绪和有限关系建议。
- `npc_private_planner`：默认由服务器本地 resolver 或 Mock/local deterministic planner 使用完整 `hiddenDossier` 生成下一旬/下月意图 proposal；外部 provider 只能读取服务器脱敏后的 `privateSignalTags`、公开关系和场景压力，不能读取隐藏私档、资产真数、秘密关系或未公开任务。
- `trade_negotiator`：读取双方可见物品、资源账本和价格边界，生成议价文案与交易 proposal。
- `delegated_task_planner`：读取委派任务、执行人能力、资源和公开阻力，生成执行计划 proposal。
- `delegated_task_reporter`：在服务器已裁决结果后，生成 NPC 回禀、奏报或口头汇报。
- `inventory_effect_explainer`：解释书籍、文书、凭证、药物、兵器等物品效果，不修改状态。

AI 输出必须经过 schema 校验、敏感词清洗、权限校验、数值 clamp、server-owned resolver 和 audit 记录后才能影响 canonical state。

## 8. 前端体验规划

前端从 S84 开始集中接入稳定 API，不在 S81-S83 期间提前写本地假状态。

核心界面：

- 开局册页：保留自由背景，新增“背景兑现预览”反馈，在开局后展示服务器裁决后的资产、人脉、风险和被缩放/拒绝的宣称。
- 人物谱牒升级：按“身边人、书院、考场、官署、军营、朝堂、市井、家族”分组；NPC 卡片展示立绘、身份、关系、可交互状态和最近记忆。
- NPC 详情 surface：使用 `SurfaceHost`，包含档案、对话、交易、委派、赠礼、关系、预留玩法 tabs。
- 背包与仓库页：显示资源账本、重要凭证、随身背包、家宅仓库、官署库房、军中辎重；支持筛选、转移、查看效果、来源记录和合法性提醒。
- 交易面板：左右账本、报价、议价文本、接受/拒绝、赠礼和借贷入口；所有价格和结果等后端返回。
- 委派任务页：显示待办、执行中、逾期、已完成任务；点击任务可看执行人、资源、风险、回禀和后续行动入口。

体验原则：

- 工具按钮使用图标和短标签，复杂含义用 tooltip。
- 一屏展示可扫读摘要，详情进入 surface，不把玩家塞进长表格。
- 移动端优先保持底部奏折与 NPC/物品 surface 可用，不横向溢出。
- 所有玩家可见文案使用中文历史语气，避免现代后台管理系统口吻。

## 9. S81-S85 执行步骤

### S81 后端数据契约与存储地基

目标：不做前端大界面，先建立开局背景、资产、资源、物品、NPC 与委派任务的 canonical schema、配置、JSON/SQLite 存储和安全 view 契约。

建议子步骤：

- S81.1：新增 `docs/NPC_INVENTORY_SYSTEM_CONTRACT.md` 或在本文基础上拆出机器可执行契约，固定 state 字段、API response、AI schema、SQLite 表、Mock fallback 与安全 view。
- S81.2：新增 `src/game/assetLedgerConfig.js`、`src/game/assetLedger.js`、`src/game/inventoryLedgerConfig.js`、`src/game/inventoryLedger.js`，定义资源账本、容器、物品模板和重要凭证。
- S81.3：新增 `src/game/npcRosterConfig.js`、`src/game/npcRoster.js`、`src/game/delegatedTasksConfig.js`、`src/game/delegatedTasks.js`，先提供 deterministic fixture 与 view builder。
- S81.4：新增 SQLite 派生表模块和 adapter 同步/删除/修复逻辑，覆盖 JSON/SQLite parity 测试。
- S81.5：新增 focused tests，覆盖非法物品、绑定凭证、资源 clamp、hidden 私档过滤、SQLite repair、防泄漏和完整书生路径不变。

验收建议：

- `node --test test/assetLedger.test.js test/inventoryLedger.test.js test/npcRoster.test.js test/delegatedTasks.test.js`
- `node --test test/sessionStoreAdapterContract.test.js`
- `npm run smoke:exam-s69`
- `npm run check:docs-governance`

### S82 开局背景兑现与资产落账

目标：让玩家自由背景通过 AI/Mock 解析为 claims，并由服务器安全落账为资产、资源、物品、NPC、风险和事件。

建议子步骤：

- S82.1：新增 `background_claim_parser` AI task、schema、prompt pack、Mock provider 输出和红队 fixture。
- S82.2：改造 `POST /api/game/start`，保留兼容字段，把 `customSetting` 送入开局背景解析，服务器按身份与配置裁决 claims。
- S82.3：实现背景宣称上限、缩放、拒绝、转风险规则；房屋、田产、银两、书籍、仆役、亲族、债务、禁物和虚假身份都要有明确处理。
- S82.4：把 accepted/scaled/rejected claims 写入 `openingBackgroundClaimsView`、事件档案和安全审计；不得保存污染原文。
- S82.5：前端只做小范围开局结果展示：开局成功后在首页或主卷首屏显示“背景兑现”摘要，不做完整背包页。

验收建议：

- 开局输入“房屋两座，白银一万两”后，玩家可见资产中确有两处宅产和银两账本，且伴随合理风险。
- 开局输入“私藏玉玺/已是进士/统兵十万”不会越权授予皇权、功名或军权。
- Mock 无 key 可稳定复现 claims 与落账。

### S83 NPC 名册、阶段人口与 AI 对话后端

目标：把现有世界人物、立绘池、科举同窗、官署属员、军务人物和关系账本整合为当前阶段可交互 NPC 名册，并提供后端对话 API。

建议子步骤：

- S83.1：按身份与阶段生成 NPC 名册：书院/科场、地方官署、部院朝堂、军营边塞、宫廷内廷、市井商贸和家族亲属。
- S83.2：接入 `portraitRef` 分配规则：重要 NPC 优先 signature pool，普通 NPC 用 generic pool，场景/姿态可用 state variant，不暴露未审核素材。
- S83.3：实现 `GET /api/game/npcs/:sessionId` 与 `GET /api/game/npc/:sessionId/:npcId`，返回分页、筛选、关系摘要、可交互动作和安全档案。
- S83.4：实现 `POST /api/game/npc-interaction/:sessionId` 的交谈/询问/赠礼基础；AI 扮演 NPC，但关系变化、物品扣减和记忆写入由服务器裁决。
- S83.5：把 NPC 交互写入 actor memory、session summary、event archive 和 AI control audit 的安全摘要。

验收建议：

- 书生能看到同窗、老师、书院相关 NPC 和考场同试者。
- 地方官能看到师爷、书吏、差役、士绅、商户、案犯或证人。
- NPC 对话不暴露 hidden notes、hidden intent、完整 prompt、provider payload 或 raw SQLite。
- Mock 与真实 provider 路径共享 schema，真实 provider 缺 key 时降级明确。

### S84 前端 NPC、背包仓库、交易与委派体验

目标：在后端 API 稳定后集中做 React 前端，不把服务器逻辑搬到浏览器。

建议子步骤：

- S84.1：扩展 `client/src/api/qianqiuApi.ts` 与类型，接入 inventory、npc list、npc detail、interaction、trade、command API。
- S84.2：新增背包/仓库 route 或 surface，显示资源账本、重要物品、容器、物品详情、来源和转移入口。
- S84.3：升级人物谱牒和 NPC 详情 surface，支持按阶段筛选、立绘、对话、赠礼、交易、委派和预留 tabs。
- S84.4：新增交易面板，展示双方可交易物、报价、议价、赠礼、接受/拒绝，所有价格和可行性以后端返回为准。
- S84.5：新增委派任务面板，支持选择 NPC、填写命令、查看执行中任务、下月回报和后续行动草稿。
- S84.6：新增浏览器 smoke，覆盖桌面/移动、无横向溢出、资源懒加载、NPC 立绘可见、背包污染扫描、交易/委派不越权和低动效。

验收建议：

- 前端不调用 unsafe `/api/game/state/*` 或 dev diagnostics。
- 前端不在 localStorage/sessionStorage 存完整背包、NPC 私档、交易明细或 prompt。
- 点击交易、赠礼、委派后，只通过安全 API 获取服务器结果；不在浏览器自行扣银、改关系或完成任务。

### S85 经济、长期关系与总验收

目标：把 NPC、资产、背包、交易和委派接入长期世界循环，为后续经济系统、婚姻系统、论道和比武扩展打地基。

建议子步骤：

- S85.1：扩展月末 tick，让 NPC 资产、库存、价格、债务、人情债、委派任务、交易承诺和关系记忆随旬/月演化。
- S85.2：实现基础市场价格和身份价格差异：书籍、粮食、药材、马匹、兵器、文书、礼物、房产维护和官署经费。
- S85.3：完善 NPC 私人目标与任务主动性：NPC 可主动求助、索债、献策、请托、行贿、弹劾、引荐、求婚或背叛，但都走服务器裁决。
- S85.4：为论道、切磋、求爱、婚姻加入正式 schema、权限、UI 预留和红线；本阶段可以先提供占位但不能是假按钮，必须说明后续数据怎么接。
- S85.5：做总验收：JSON/SQLite 双模式、Mock 完整开局、书生完整路径、地方官丈田委派样例、NPC 对话、交易、背包转移、重要凭证保护、前端 smoke、安全污染和 docs governance。
- S85.6：归档 S81-S85，更新 brief、README、共享上下文、活动台账和 AI 权限矩阵。

验收建议：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser`
- `npm run smoke:dual-mode -- --storage-only`
- `npm run smoke:exam-s69`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`

## 10. 推荐第一施工点

下一步从 S81.1 开始。先写可执行契约和测试骨架，再写后端 schema/view builder；不要先做前端假界面，也不要让 AI 解析结果直接进入存档。

第一批可由多个 Codex 子代理并行：

- 子代理 A：只读梳理现有 state、redacted view、SQLite adapter 和 NPC/relationship 模块，输出 S81 接入点。
- 子代理 B：起草 `assetLedger` / `inventoryLedger` 后端 schema 和测试。
- 子代理 C：起草 `npcRoster` / `delegatedTasks` 后端 schema 和测试。
- 主代理：整合契约、边界、验证和文档，同步台账并提交。

实施子代理不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得回滚他人改动；最终报告必须列出改动文件和验证命令。
