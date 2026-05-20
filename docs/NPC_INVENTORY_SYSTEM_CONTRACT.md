# S81-S85 NPC、资产、储物、交易、委派与经济系统执行契约

本契约把 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md) 转为 S81-S85 可执行交付标准。路线图说明“为什么做”和体验目标；本文件固定字段、API、AI 权限、安全 view、SQLite 派生表和验收矩阵。后续若扩展字段或权限，必须同步本文件、活动台账和共享上下文。

## 1. 总体边界

- Canonical truth 仍是 session `worldState`。JSON 是默认存档路径；SQLite 只做本机派生查询、诊断和可修复 projection。
- 新增账本不得进入 provider `statePatch` 白名单。AI 只能输出结构化 claims、对话草稿、交易 proposal、委派计划或回禀文案；服务器负责资源、物品、NPC、任务、关系、记忆和持久化。
- 浏览器、prompt 和玩家 API 只读安全 view，不读取 raw ledger、hidden dossier、交易底价、资产真数、完整 prompt、provider payload、本地路径、key 或 SQLite 原始行。
- 兼容 `GET /api/game/state/:sessionId` 仍存在，因此 `buildClientWorldState()` 必须剥离新增 raw ledger 的隐藏部分；React 默认仍只走 `player-state` 与新增安全 API。

## 2. Canonical State

### 2.1 `openingBackgroundClaims`

```json
{
  "schemaVersion": "s82.backgroundClaims.v1",
  "source": "server_adjudicated_background_claims",
  "generatedAtTurn": 0,
  "claims": [],
  "auditRefs": [],
  "redaction": {
    "rawBackgroundStored": false,
    "serverAdjudicated": true
  }
}
```

Claim 字段：

- `claimId`：稳定 ID，例如 `claim-wealth-001`。
- `claimType`：`wealth | property | kinship | retainer | education | office | military | artifact | debt | reputation | risk`。
- `claimSummary`：清洗后的宣称摘要，不得包含玩家原始长文本。
- `requestedValue`：数值、数量或物件安全摘要。
- `plausibility`：`accepted | scaled | converted_to_risk | rejected`。
- `serverDecision`：中文裁决说明。
- `grantedRefs`：资产、资源、物品、NPC、关系或事件 ref。
- `riskRefs`：风险、传闻、债务、人情债或审计 ref。

### 2.2 `assetLedger` 与 `resourceLedger`

`assetLedger` 保存房屋、田产、铺面、书斋、马匹、船只、府库、军械库等长期资产。`resourceLedger` 保存银两、黄金、铜钱、粮食、功绩、官声、皇恩、军功、人情债、学望等可计量资源。所有数值由领域配置 clamp；不得让 AI 或前端直接增减。

资产最小字段：

- `assetId`、`assetType`、`name`、`ownerActorId`、`locationRef`
- `status`：`active | pledged | damaged | seized | disputed`
- `valueEstimate`、`incomePerMonth`、`maintenanceCost`
- `linkedItemRefs`、`riskTags`、`visibility`、`publicSummary`

资源账户最小字段：

- `accountId`、`ownerActorId`、`resourceType`、`label`
- `amount`、`unit`、`min`、`max`
- `visibility`、`sourceRefs`、`lastUpdatedTurn`

### 2.3 `inventoryLedger`

`inventoryLedger` 保存容器和物品。容器包括随身背包、家宅仓库、官署库房、军中辎重、宫中内库和 NPC 私人物品摘要。物品包括书籍、文书、权力凭证、财物、药材、兵器、工具和礼物。

物品最小字段：

- `itemId`、`templateId`、`name`、`category`、`subtype`
- `ownerActorId`、`custodianActorId`、`containerId`、`locationRef`
- `quantity`、`unit`、`quality`、`rarity`、`durability`、`condition`
- `legalStatus`：`ordinary | restricted | official_seal | military_token | imperial_artifact | contraband`
- `transferPolicy`：`tradeable | giftable | lendable | bound_to_office | bound_to_actor | server_only`
- `effectRefs`、`provenanceRefs`、`visibility`、`publicSummary`

### 2.4 `npcRoster`

`npcRoster` 整合世界人物、科举网络、官署属员、军营人物、市井人物、家族亲属和立绘分配。

NPC 最小字段：

- `npcId`、`displayName`、`tier`：`ambient | active | signature`
- `roleTags`、`stageTags`、`portraitRef`
- `publicProfile`：公开身份、籍贯、任所、能力摘要、关系摘要
- `relationship`：亲疏、信任、敌意、人情债、师承、同年等安全摘要
- `inventoryRefs`、`assetRefs`、`resourceAccountRefs`
- `availableInteractions`：`talk | ask | gift | trade | command | request | debate | duel | courtship | marriage`
- `hiddenDossier`：只供服务器本地 resolver 使用，不进入 provider、浏览器、prompt 或 SQLite 安全导出。
- `privateSignalTags`：从私档派生的不可逆软倾向标签；外部 provider 只可读这些标签的严格裁剪摘要，不能当作隐藏事实。

立绘规则：`signature` 使用已审核重要 NPC 池，普通 NPC 使用通用池，状态或场景锚点可使用 variant；未审核素材、本地路径和完整 manifest 不进入 API。

### 2.5 `npcInteractionLedger`、`tradeLedger`、`delegatedTaskLedger`

交互记录只存安全摘要和服务器裁决结果。交易记录包含公开报价、状态、双方 refs 和服务器裁决，不暴露 NPC 底价。委派任务包含命令、执行人、所需资源、期限、风险、状态、回禀和后续行动 refs。所有委派预算必须先由服务器确认，不得超过当前可用地方库银；月结结算旧任务时也只能用服务器确认的有效预算影响成功率和扣款。

委派状态：`draft | pending_validation | active | blocked | overdue | completed | failed | cancelled`。
交易状态：`proposed | countered | accepted | rejected | server_blocked`；`accepted` 只表示议价文本被记录，银钱、物品和所有权变更仍需服务器结算路径另行执行。

### 2.6 `marketPriceLedger` 与 `npcEconomyLedger`

S85.1-S85.2 新增两个 server-owned 账本：

- `marketPriceLedger`：保存基础市价目录、身份倍率、市场压力、可得性、旬/月趋势和短历史。覆盖书籍、粮食、药材、马匹、兵器、文书、礼物、宅产维护和官署经费；每旬刷新，月末记录历史。AI 和浏览器只能读取 `marketPriceView`，不能据此自行成交、改库存或写价格。
- `npcEconomyLedger`：保存最近 NPC 经济 tick 摘要、月结 outcome 和玩家可见事件。月末由服务器结算资产维护/收益、库存损耗、委派到期结果、逾期交易承诺、人情债和 NPC 关系记忆；不保存 hidden 私档、NPC 真正底价、交易底线或模型原文。

普通回合和自然语言跳时复用同一条旬/月结算链：世界 tick 先推进日期，`npcEconomy` 再刷新市价或执行月结。考试入场/场内场景只推进科场局部时间，不触发全局经济。两个 raw ledger 必须从 `buildClientWorldState()`、`buildPlayerStateEnvelope()` 和所有浏览器安全 payload 剥离；S85 反馈中的资产、资源和库存变化 path 只能使用公开 `economy.*` 分类，不能暴露 `assetLedger.*`、`resourceLedger.*` 或 `inventoryLedger.*` 内部路径。

## 3. 安全 API

- `GET /api/game/inventory/:sessionId`：返回 `inventoryView`，包含资源账本、资产、容器、物品、重要凭证和可转移边界。
- `POST /api/game/inventory-transfer/:sessionId`：提交容器转移请求；服务器校验归属、数量、绑定、合法性和容器权限。
- `GET /api/game/npcs/:sessionId`：返回分页/分组 `npcRosterView`。
- `GET /api/game/npc/:sessionId/:npcId`：返回单个 `npcDetailView`。
- `POST /api/game/npc-interaction/:sessionId`：交谈、询问、赠礼和预留玩法入口；AI 可扮演，服务器裁决。
- `POST /api/game/trade/:sessionId`：发起、议价、接受、拒绝、赠礼、借贷或典当；服务器裁决价格、库存、合法性和关系结果。
- `POST /api/game/npc-command/:sessionId`：创建或推进委派任务；服务器校验 authority、资源、工具、期限和 NPC 可用性。

所有 API 顶层至少返回 `sessionId`；各安全 view 自带 `schemaVersion`、`generatedAtTurn`、`authorityBoundary`、`safeguards` 或同等安全摘要。错误只返回安全中文摘要，不回显请求中的 raw 背景、provider payload、ledger 原文或本地路径。

普通 `POST /api/game/turn`、SSE `state_preview` / `final_state`、`GET /api/game/player-state/:sessionId` 和兼容 state route 会返回 `marketPriceView` 与 `npcEconomyView`。它们是只读 projection，不新增交易/委派即时 API 写权。

## 4. AI 任务

新增任务进入全局 AI 设置矩阵：

- `background_claim_parser`：读开局表单与自由背景，输出 claims，不授予资产。
- `npc_dialogue`：读 NPC 安全档案、关系摘要和场景契约，输出对话和小幅关系建议。
- `npc_private_planner`：默认本地/Mock 使用 hiddenDossier；外部 provider 只读 privateSignalTags。
- `trade_negotiator`：读双方可见账本和价格边界，输出议价文案与 proposal。
- `delegated_task_planner`：读任务、执行人能力、公开阻力和资源，输出计划 proposal。
- `delegated_task_reporter`：在服务器裁决后生成回禀文案。
- `inventory_effect_explainer`：解释物品效果，不修改状态。

所有 AI 输出必须通过 JSON schema、敏感字段拒绝、数值 clamp、服务器 resolver 和 audit 记录后才可影响 canonical state。

## 5. SQLite 派生表

新增派生表只保存安全摘要，不保存 hiddenDossier、交易底价、完整物品私档或 raw provider proposal：

- `asset_resource_accounts`
- `asset_long_term_assets`
- `inventory_containers`
- `inventory_items`
- `npc_roster_profiles`
- `npc_interaction_events`
- `delegated_tasks`
- `trade_ledger_records`

每表必须包含 `session_id`、`row_id`、`revision`、`domain_schema_version`、`source`、安全摘要列、`metadata_json.contentHash`、`created_at`、`updated_at`。索引至少覆盖 session、owner/container/npc/status/category。读档修复从 `world_sessions.world_state_json` 单向重建派生表。

## 6. 前端契约

S84 React 只消费上述 API：

- 新增 `/game/:sessionId/inventory` “囊箧” route。
- 人物页升级为分组 NPC 名册。
- `SurfaceHost` 或拆分组件承载 NPC 详情、对话、交易、赠礼和委派工作台。
- 浏览器内存状态可以缓存服务器安全 view 以保持页面切换流畅，但 localStorage/sessionStorage 只保存显示偏好等白名单；不得持久化完整背包、NPC 私档、交易明细、provider payload 或 prompt。
- 前端不得计算价格、扣库存、改关系、完成委派或判定任务结果。

S85 React 继续只消费安全 view：

- 主卷安全视图索引把 `marketPriceView` 与 `npcEconomyView` 作为只读就绪信号。
- 县令主卷钱粮卡片可展示基础市价、NPC 月账和服务器边界。
- 前端不得用市价行自行定价、成交、扣银、扣库存、刷新 NPC 任务或推断 hidden 底价。

## 7. 验收矩阵

- 契约与模块：`node --test test/assetLedger.test.js test/inventoryLedger.test.js test/npcRoster.test.js test/delegatedTasks.test.js`
- 背景兑现：`node --test test/npcInventoryRoutes.test.js`
- AI schema/settings：`node --test test/aiSchemas.test.js test/modelRoutePolicy.test.js test/aiSettings.test.js test/aiSettingsRoute.test.js`
- API 与红线：`node --test test/npcInventoryRoutes.test.js test/tradeLedger.test.js test/npcAiSafety.test.js test/gamePlayerStateRoute.test.js`
- SQLite：`node --test test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js test/sessionStoreAdapterContract.test.js`
- 前端：`npm run typecheck:client && npm run test:client -- --pool=vmForks --maxWorkers=2 && npm run build:client && AI_PROVIDER=mock npm run smoke:browser`
- 回归：`npm run smoke:exam-s69 && npm run check:docs-governance && node --test test/documentationGovernance.test.js && npm test`
- S85 经济：`node --test test/delegatedTasks.test.js test/npcEconomy.test.js test/gameTurnNpcEconomy.test.js`
