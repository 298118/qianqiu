# S81-S85 NPC、资产与储物系统归档

本归档收束 2026-05-20 启动的 S81-S85 NPC、资产、储物、交易、委派、经济与长期关系专项。规划源头见 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，执行契约见 [NPC_INVENTORY_SYSTEM_CONTRACT.md](NPC_INVENTORY_SYSTEM_CONTRACT.md)；后续开发应以本归档、契约和活动台账作为接手入口。

## 完成范围

- S81 建立后端数据契约与存储地基：`assetLedger`、`resourceLedger`、`inventoryLedger`、`npcRoster`、`npcInteractionLedger`、`tradeLedger`、`delegatedTaskLedger` 和 SQLite 安全派生表。
- S82 接入开局背景兑现：`background_claim_parser` 只解析自由背景，服务器裁决宅产、银两、书籍、债务、禁物、军权、官职和虚假身份宣称。
- S83 完成 NPC 名册、阶段人口、立绘引用、列表/详情 API 和 NPC 对话基础；AI 只扮演与建议，不能写资源、身份、关系结论或隐藏事实。
- S84 完成 React “囊箧” route、人物 NPC 工作台、对话/交易/委派 tabs、背包转移和主卷开局裁决摘要；浏览器只消费安全 API/view。
- S85.1-S85.2 完成 `marketPriceLedger`、`npcEconomyLedger`、`marketPriceView` 和 `npcEconomyView`，普通回合/跳时共享旬/月 tick，考试场景不跑全局经济。
- S85.3 完成 `npcActiveRequestLedger` 与 `npcActiveRequestView`，NPC 可主动求助、索债、献策、请托、行贿、弹劾、引荐、求婚或背叛；玩家回应由服务器裁决为待查、上交、拒绝、暂缓、风险登记或待后续处理。
- S85.4 完成论道、切磋、求爱、婚姻正式扩展位：`npcRelationshipActions` 提供 schema、权限、NPC eligibility view、服务器 outcome 和前端“礼法”tab；前端伪造胜负、伤势、银钱、配偶、关系 delta 或 state patch 均被服务器忽略。
- S85.5-S85.6 完成聚焦总验收、文档同步和本归档。全量 `npm test` 已以长超时通过 983 个子测，浏览器 smoke 与完整书生科举路径 smoke 均通过。

## 权限边界

- Canonical truth 仍是 session `worldState`；JSON 是默认存档路径，SQLite 只保存可修复安全派生表。
- AI 可解析、扮演、议价、计划、回禀和提出 NPC 主动意图；资源扣减、物品归属、价格、任务结果、婚姻、弹劾、背叛、伤亡、关系落账、科举/官职和持久化由服务器裁决。
- `npc_private_planner` 默认 Mock/本地可用隐藏私档推导软意图；外部 provider 只能读取裁剪后的 `privateSignalTags`，不能读取 hiddenDossier、真实资产、秘密关系、本地路径、key 或 SQLite 行。
- 浏览器、prompt、player-state、兼容 `worldState` 和 SQLite 安全导出均不得暴露 raw ledger、hiddenDossier、privateSignalTags、交易底价、市价原账、月结原账、provider payload、完整 prompt、本地路径或 key。

## 验证入口

S81-S85 后续回归优先运行：

- `node --test test/npcActiveRequests.test.js test/npcRelationshipActions.test.js test/npcAiSafety.test.js`
- `node --test test/npcInventoryRoutes.test.js test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js`
- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm test`

## 后续方向

- 把 S85.4 的礼法扩展位继续拆成专门 resolver：论道可接学问/声望，切磋可接伤势/武备，求爱和婚姻可接家族、礼法、媒妁、聘礼与公开人物关系网。
- 为 NPC 主动来函增加更多来源：委派回禀、交易承诺、月结债务、官署案牍、科举同年和家族压力。
- 继续补真实 provider 长循环、更多交易底价/私档泄漏红队、browser smoke 深度路径和 SQLite 市价/月账派生策略评估。
